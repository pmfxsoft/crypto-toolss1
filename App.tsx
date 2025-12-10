import React, { useState, useEffect, useRef, useMemo } from 'react';
import TradingViewWidget from './components/TradingViewWidget';
import { auth, db } from './firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

// Interface for CoinGecko Data
interface CoinData {
  id: string;
  symbol: string;
  name: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  price_change_percentage_24h: number;
  price_change_percentage_7d_in_currency: number;
  price_change_percentage_30d_in_currency: number;
  price_change_percentage_1y_in_currency: number;
  ath: number;
  ath_change_percentage: number;
  circulating_supply: number;
  total_supply: number;
  high_24h: number;
  low_24h: number;
}

// List of stablecoins to exclude
const STABLE_COINS = [
  'usdt', 'usdc', 'dai', 'fdusd', 'tusd', 'usdd', 
  'pyusd', 'usde', 'frax', 'busd', 'gusd', 'usdp', 
  'eurs', 'lusd', 'susd', 'usds', 'crvusd', 'mim', 
  'alusd', 'dola', 'fei', 'ustc', 'gemini-dollar'
];

// Available Timeframes
const TIMEFRAMES = [
  { label: '15m', value: '15' },
  { label: '1H', value: '60' },
  { label: '4H', value: '240' },
  { label: '1D', value: 'D' },
  { label: '1W', value: 'W' },
  { label: '1M', value: '1M' },
];

// Available limits based on market rank
const LIMIT_OPTIONS = [20, 50, 100, 200, 500, 1000, 2000, 5000];

const LOCAL_STORAGE_KEY = 'crypto_layout_preference_v1';
const DATA_CACHE_PREFIX = 'crypto_data_cache_v2_'; // New prefix for data cache

// Lazy Load Wrapper Component with 5s Delay logic
const LazyWidget = ({ children }: { children?: React.ReactNode }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Element is in view
          if (!isLoaded && !timerRef.current) {
            setIsWaiting(true);
            // Start 5-second timer
            timerRef.current = setTimeout(() => {
              setIsLoaded(true);
              setIsWaiting(false);
              observer.disconnect(); // Stop observing once loaded
            }, 5000);
          }
        } else {
          // Element left view
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
            setIsWaiting(false); // Stop showing waiting state
          }
        }
      },
      { 
        threshold: 0.2, // Widget must be at least 20% visible to start timer
        rootMargin: '0px' // No pre-loading, strict visibility
      } 
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      observer.disconnect();
    };
  }, [isLoaded]);

  return (
    <div ref={ref} className="w-full h-full relative">
      {isLoaded ? (
        children
      ) : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400 text-sm rounded-lg border border-gray-100 transition-all duration-300">
          {isWaiting ? (
            <div className="flex flex-col items-center gap-3">
              {/* Custom Loading Circle */}
              <div className="relative w-12 h-12">
                 <svg className="w-full h-full transform -rotate-90">
                   <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-gray-200" />
                   <circle cx="24" cy="24" r="20" stroke="currentColor" strokeWidth="4" fill="transparent" 
                           className="text-blue-500 animate-[dash_5s_linear_forwards]" 
                           strokeDasharray="125.6" 
                           strokeDashoffset="125.6" />
                 </svg>
              </div>
              <span className="text-xs text-blue-500 font-medium">مکث کنید...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 opacity-50">
               <span className="text-2xl">🛑</span>
               <span>اسکرول متوقف شود</span>
            </div>
          )}
        </div>
      )}
      <style>{`
        @keyframes dash {
          to { stroke-dashoffset: 0; }
        }
      `}</style>
    </div>
  );
};

const App: React.FC = () => {
  const [isLogScale, setIsLogScale] = useState(true);
  const [interval, setInterval] = useState("1M"); // Default Timeframe
  const [coins, setCoins] = useState<CoinData[]>([]); // Raw fetched data (buffer)
  const [removedCoinIds, setRemovedCoinIds] = useState<Set<string>>(new Set()); // Persist removed IDs
  const [favorites, setFavorites] = useState<Set<string>>(new Set()); // Favorites
  const [itemsPerPage, setItemsPerPage] = useState(100); // Total Items Limit
  
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<string>(''); // Progress text
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0); // For manual retry
  const [user, setUser] = useState<any>(null); // Firebase User
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  
  // File Input Ref for Import
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Load Layout Preferences from LocalStorage
  useEffect(() => {
      const savedLayout = localStorage.getItem(LOCAL_STORAGE_KEY);
      if (savedLayout) {
          try {
              const parsed = JSON.parse(savedLayout);
              if (Array.isArray(parsed)) {
                  setRemovedCoinIds(prev => {
                      const newSet = new Set(prev);
                      parsed.forEach((id: string) => newSet.add(id));
                      return newSet;
                  });
              }
          } catch(e) {
              console.error("Error loading layout from local storage", e);
          }
      }

      const savedFavs = localStorage.getItem('crypto_favorites_v1');
      if (savedFavs) {
          try {
              const parsed = JSON.parse(savedFavs);
              if (Array.isArray(parsed)) {
                  setFavorites(new Set(parsed));
              }
          } catch(e) {}
      }
  }, []);

  // Firebase Authentication & Database Sync
  useEffect(() => {
    signInAnonymously(auth).catch((err) => {
        if (err.code !== 'auth/invalid-api-key' && err.code !== 'auth/api-key-not-valid') {
            console.warn("Firebase Auth Error:", err.message);
        }
    });

    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        const unsubscribeSnapshot = onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.removedCoinIds && Array.isArray(data.removedCoinIds)) {
                    setRemovedCoinIds(prev => {
                        const newSet = new Set(prev);
                        data.removedCoinIds.forEach((id: string) => newSet.add(id));
                        return newSet;
                    });
                }
                if (data.favorites && Array.isArray(data.favorites)) {
                    setFavorites(new Set(data.favorites));
                }
            }
        }, (err) => {
            if (err.code !== 'permission-denied') {
                 console.warn("Firestore Read Error:", err.message);
            }
        });
        return () => unsubscribeSnapshot();
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Robust fetch with retry logic
  const fetchWithRetry = async (url: string, retries = 3, baseBackoff = 2000, signal?: AbortSignal): Promise<any> => {
    for (let i = 0; i < retries; i++) {
      try {
        if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }

        const response = await fetch(url, {
            headers: { 'Accept': 'application/json' },
            mode: 'cors',
            signal
        });
        
        if (response.ok) return await response.json();

        // Handle 429 Rate Limit specifically
        if (response.status === 429) {
            const waitTime = baseBackoff * Math.pow(2, i + 1);
            // console.warn(`Rate limit (429). Retrying in ${waitTime}ms...`);
            await new Promise(r => setTimeout(r, waitTime));
            continue;
        }

        if (response.status >= 500) {
             const waitTime = baseBackoff * Math.pow(2, i);
             await new Promise(r => setTimeout(r, waitTime));
             continue;
        }

        throw new Error(`HTTP Error: ${response.status}`);

      } catch (err: any) {
        if (err.name === 'AbortError' || signal?.aborted) throw err;
        if (i === retries - 1) throw err;
        
        const waitTime = baseBackoff * Math.pow(2, i);
        await new Promise(r => setTimeout(r, waitTime));
      }
    }
  };

  // Main Data Fetching Logic with Persistent Caching and Sequential Fetching
  useEffect(() => {
    const controller = new AbortController();

    const fetchCoins = async () => {
      setError(null);
      setLoadingProgress('');
      
      const cacheKey = `${DATA_CACHE_PREFIX}${itemsPerPage}`;
      let usedCache = false;

      // 1. Try to load from LocalStorage first
      try {
          const stored = localStorage.getItem(cacheKey);
          if (stored) {
              const { timestamp, data } = JSON.parse(stored);
              // Use cached data immediately
              if (Array.isArray(data) && data.length > 0) {
                  setCoins(data);
                  usedCache = true;
                  setLoading(false); // Instant load

                  // Check if cache is stale (older than 2 minutes)
                  // If so, we continue to fetch in background to update it
                  if (Date.now() - timestamp < 120 * 1000) {
                      return; // Cache is fresh enough, stop here
                  }
              }
          }
      } catch (e) {
          console.warn("Cache read error:", e);
      }

      // If we didn't use cache, show loading state
      if (!usedCache) {
          setLoading(true);
      }

      try {
        const BATCH_SIZE = 250;
        const batchesNeeded = Math.ceil(itemsPerPage / BATCH_SIZE);
        const accumulatedCoins: CoinData[] = [];
        
        // Sequential Fetching Loop to avoid "Failed to fetch" (Browser/Network overload)
        for (let i = 1; i <= batchesNeeded; i++) {
            if (controller.signal.aborted) break;

            // Update user feedback only if they are waiting (no cache)
            if (!usedCache) {
                setLoadingProgress(`در حال دریافت بخش ${i} از ${batchesNeeded}...`);
            }

            const batchData = await fetchWithRetry(
                `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${BATCH_SIZE}&page=${i}&sparkline=false&price_change_percentage=24h`,
                3, // retries
                1500, // backoff
                controller.signal
            );
            
            if (batchData && Array.isArray(batchData)) {
                accumulatedCoins.push(...batchData);
            }

            // Small delay between requests to be polite to the API and prevent browser queue lockup
            if (i < batchesNeeded) {
                await new Promise(r => setTimeout(r, 300)); 
            }
        }

        if (!controller.signal.aborted) {
            const filteredData = accumulatedCoins.filter((coin: CoinData) => 
                !STABLE_COINS.includes(coin.symbol.toLowerCase()) && 
                !STABLE_COINS.includes(coin.id.toLowerCase())
            );

            // Update State
            setCoins(filteredData);
            
            // Save to LocalStorage
            try {
                // Minimal data to save space if needed, but saving full object for now
                localStorage.setItem(cacheKey, JSON.stringify({ 
                    timestamp: Date.now(), 
                    data: filteredData 
                }));
            } catch (e) {
                console.warn("Failed to save to localStorage (Quota exceeded probably):", e);
            }
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
            console.error("Final Fetch Error:", err);
            // Only show error screen if we have no data at all
            if (!usedCache) {
                setError("اتصال به سرور برقرار نشد یا محدودیت درخواست وجود دارد. لطفاً چند لحظه صبر کنید.");
            }
        }
      } finally {
        if (!controller.signal.aborted) {
            setLoading(false);
            setLoadingProgress('');
        }
      }
    };

    fetchCoins();

    return () => controller.abort();
  }, [itemsPerPage, retryTrigger]);

  // Derive the coins to display
  const { processedCoins, finalCoins } = useMemo(() => {
    let result = coins.filter((coin) => !removedCoinIds.has(coin.id));

    if (showFavoritesOnly) {
        result = result.filter(c => favorites.has(c.id));
    }

    // Limit total items displayed to the selected number (or filtered result size)
    // Note: If we fetched 5000, itemsPerPage is 5000.
    const sliced = result.slice(0, itemsPerPage);
    
    return { processedCoins: result, finalCoins: sliced };
  }, [coins, removedCoinIds, favorites, showFavoritesOnly, itemsPerPage]);

  // Format Helpers
  const formatCurrency = (value: number) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value < 1 ? 6 : 2 }).format(value);
  };
  
  const getTradingViewSymbol = (coinSymbol: string) => {
    if (coinSymbol.toLowerCase() === 'usdt') return 'USDCUSDT'; 
    return `${coinSymbol.toUpperCase()}USDT`;
  };

  const getPercentClass = (val: number | null | undefined) => {
      if (val === null || val === undefined) return 'text-gray-500';
      return val >= 0 ? 'text-green-600' : 'text-red-600';
  };

  const toggleFullscreen = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen().catch(err => console.error(err));
  };

  const removeCoin = async (coinId: string) => {
    setRemovedCoinIds((prev) => {
      const newSet = new Set(prev);
      newSet.add(coinId);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(newSet)));
      if (user) {
          const userDocRef = doc(db, 'users', user.uid);
          setDoc(userDocRef, { removedCoinIds: Array.from(newSet) }, { merge: true }).catch(console.error);
      }
      return newSet;
    });
  };

  const toggleFavorite = (coinId: string) => {
      setFavorites(prev => {
          const newSet = new Set(prev);
          if (newSet.has(coinId)) {
              newSet.delete(coinId);
          } else {
              newSet.add(coinId);
          }
          localStorage.setItem('crypto_favorites_v1', JSON.stringify(Array.from(newSet)));
          if (user) {
              const userDocRef = doc(db, 'users', user.uid);
              setDoc(userDocRef, { favorites: Array.from(newSet) }, { merge: true }).catch(console.error);
          }
          return newSet;
      });
  };

  // Layout Handlers
  const handleSaveLayout = () => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(removedCoinIds)));
    alert("چیدمان فعلی ذخیره شد.");
  };

  const handleResetLayout = () => {
      if (window.confirm("بازنشانی کامل؟")) {
          setRemovedCoinIds(new Set());
          localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
  };

  const handleExportBackup = () => {
    const data = { 
        removedCoinIds: Array.from(removedCoinIds), 
        favorites: Array.from(favorites),
        exportedAt: new Date().toISOString() 
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crypto-backup.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.removedCoinIds && Array.isArray(json.removedCoinIds)) {
          const newSet = new Set<string>(json.removedCoinIds);
          setRemovedCoinIds(newSet);
          localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(newSet)));
          if (user) {
             const userDocRef = doc(db, 'users', user.uid);
             setDoc(userDocRef, { removedCoinIds: Array.from(newSet) }, { merge: true });
          }
        }
        if (json.favorites && Array.isArray(json.favorites)) {
            const newFavs = new Set<string>(json.favorites);
            setFavorites(newFavs);
            localStorage.setItem('crypto_favorites_v1', JSON.stringify(Array.from(newFavs)));
            if (user) {
                const userDocRef = doc(db, 'users', user.uid);
                setDoc(userDocRef, { favorites: Array.from(newFavs) }, { merge: true });
            }
        }
        alert("Backup restored successfully!");
      } catch (err) {
        alert("Invalid backup file.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm z-20 sticky top-0">
        <div className="max-w-[1920px] mx-auto px-4 py-3">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            {/* Title & Stats */}
            <div className="flex items-center gap-4">
              <h1 className="text-xl md:text-2xl font-bold text-gray-800 flex items-center gap-2">
                <span className="text-blue-600">₿</span>
                نمودار پیشرفته ارز دیجیتال
              </h1>
              <div className="hidden md:flex items-center gap-3 text-sm text-gray-500 border-r border-gray-200 pr-4 mr-4">
                <span>نمایش: {finalCoins.length} از {processedCoins.length}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3 w-full md:w-auto">
              {/* Favorites Toggle */}
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1 ${showFavoritesOnly ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
              >
                {showFavoritesOnly ? '★ نمایش همه' : '☆ فقط علاقه‌مندی‌ها'}
              </button>

              <div className="h-6 w-px bg-gray-300 hidden md:block" />
              
              {/* Items Per Page Limit */}
              <div className="flex items-center gap-1">
                 <span className="text-xs text-gray-500">تعداد کل:</span>
                 <select 
                    value={itemsPerPage} 
                    onChange={(e) => {
                        setItemsPerPage(Number(e.target.value));
                    }}
                    className="px-2 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  >
                    {LIMIT_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
              </div>

              <div className="h-6 w-px bg-gray-300 hidden md:block" />

              <button
                onClick={() => setIsLogScale(!isLogScale)}
                className={`px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${isLogScale ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
              >
                {isLogScale ? 'Lg' : 'Ln'}
              </button>

              <select 
                value={interval} 
                onChange={(e) => setInterval(e.target.value)}
                className="px-2 py-1.5 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {TIMEFRAMES.map(tf => (
                  <option key={tf.value} value={tf.value}>{tf.label}</option>
                ))}
              </select>

              <div className="h-6 w-px bg-gray-300 hidden md:block" />

              <div className="relative group">
                <button className="px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm">
                  مدیریت
                </button>
                <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 hidden group-hover:block p-2 z-50">
                  <button onClick={handleSaveLayout} className="w-full text-right px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded">ذخیره چیدمان</button>
                  <button onClick={handleResetLayout} className="w-full text-right px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded">بازنشانی</button>
                  <hr className="my-1" />
                  <button onClick={handleExportBackup} className="w-full text-right px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded">دریافت بکاپ</button>
                  <label className="block w-full text-right px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded cursor-pointer">
                    بازگردانی بکاپ
                    <input type="file" className="hidden" ref={fileInputRef} onChange={handleImportBackup} accept=".json" />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-grow p-4 md:p-6">
        {loading ? (
            <div className="flex flex-col items-center justify-center h-96">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-800 font-medium animate-pulse mb-2">در حال دریافت اطلاعات بازار...</p>
                {loadingProgress && (
                    <p className="text-blue-600 text-sm font-medium bg-blue-50 px-3 py-1 rounded-full">{loadingProgress}</p>
                )}
            </div>
        ) : error ? (
            <div className="flex flex-col items-center justify-center h-96 text-center">
                <div className="text-red-500 text-5xl mb-4">⚠️</div>
                <p className="text-gray-800 font-medium text-lg mb-2">خطا در دریافت اطلاعات</p>
                <p className="text-gray-500 mb-6 max-w-md">{error}</p>
                <button 
                    onClick={() => setRetryTrigger(prev => prev + 1)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl"
                >
                    تلاش مجدد
                </button>
            </div>
        ) : finalCoins.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-96 text-center">
                <p className="text-gray-500 text-lg">هیچ ارزی یافت نشد.</p>
            </div>
        ) : (
            // Modified Grid for Square Cards - Restricted to max 3 columns on large screens
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 pb-20">
              {finalCoins.map((coin) => (
                <div 
                  id={`card-${coin.id}`}
                  key={coin.id} 
                  // Added content-visibility: auto and contain-intrinsic-size
                  // This tells the browser to skip painting off-screen content but keep the state.
                  // 'containIntrinsicSize' gives the browser a placeholder height (approx 500px) so the scrollbar doesn't jump.
                  style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 500px' }}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col aspect-square transition-all hover:shadow-md"
                >
                  {/* Card Header - Compact */}
                  <div className="px-3 py-2 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
                    <div className="flex items-center gap-2">
                      <img src={coin.image} alt={coin.name} className="w-6 h-6 rounded-full" loading="lazy" />
                      <div>
                        <div className="flex items-center gap-1.5">
                           <h3 className="font-bold text-gray-800 text-sm">{coin.symbol.toUpperCase()}</h3>
                           <span className="text-[10px] text-gray-400 bg-gray-100 px-1 py-0.5 rounded">#{coin.market_cap_rank}</span>
                        </div>
                      </div>
                    </div>
                    
                    <div className="flex items-center">
                      <button 
                        onClick={() => toggleFavorite(coin.id)}
                        className={`p-1.5 rounded-lg hover:bg-gray-100 transition-colors ${favorites.has(coin.id) ? 'text-yellow-400' : 'text-gray-300'}`}
                      >
                         ★
                      </button>
                      <button 
                        onClick={() => toggleFullscreen(`card-${coin.id}`)}
                        className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                      >
                        ⛶
                      </button>
                      <button 
                        onClick={() => removeCoin(coin.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        ✕
                      </button>
                    </div>
                  </div>

                  {/* Card Stats Bar - Compact */}
                  <div className="px-3 py-1.5 bg-gray-50 flex justify-between items-center text-[10px] border-b border-gray-100 overflow-hidden shrink-0">
                     <div className="flex items-center gap-1">
                        <span className="text-gray-500">{formatCurrency(coin.current_price)}</span>
                     </div>
                     <div className="flex items-center gap-1">
                        <span className={`font-bold ${getPercentClass(coin.price_change_percentage_24h)} dir-ltr`}>
                            {coin.price_change_percentage_24h?.toFixed(1)}%
                        </span>
                     </div>
                  </div>

                  {/* Chart Area - Fills remaining space */}
                  <div className="flex-grow bg-white relative w-full h-full min-h-0">
                    <LazyWidget>
                        <TradingViewWidget 
                          symbol={getTradingViewSymbol(coin.symbol)} 
                          isLogScale={isLogScale}
                          interval={interval}
                        />
                    </LazyWidget>
                  </div>
                </div>
              ))}
            </div>
        )}
      </main>
      
      {/* Footer Removed */}
    </div>
  );
};

export default App;