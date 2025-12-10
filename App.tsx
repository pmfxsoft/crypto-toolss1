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

// Available limits based on market rank (Data Fetch Limit)
const FETCH_LIMIT_OPTIONS = [100, 500, 1000, 1500, 2000, 5000];

// Pagination Options (View Limit)
const PAGE_SIZE_OPTIONS = [15, 30, 45, 60, 90];

const LOCAL_STORAGE_KEY = 'crypto_layout_preference_v1';
const DATA_CACHE_PREFIX = 'crypto_data_cache_v3_'; // Updated cache version

// Lazy Load Wrapper Component
const LazyWidget = ({ children }: { children?: React.ReactNode }) => {
  const [isLoaded, setIsLoaded] = useState(false);
  const [isWaiting, setIsWaiting] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          if (!isLoaded && !timerRef.current) {
            setIsWaiting(true);
            timerRef.current = setTimeout(() => {
              setIsLoaded(true);
              setIsWaiting(false);
              observer.disconnect();
            }, 1000); // Reduced to 1s
          }
        } else {
          if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
            setIsWaiting(false);
          }
        }
      },
      { threshold: 0.1, rootMargin: '100px' } 
    );

    if (ref.current) observer.observe(ref.current);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
      observer.disconnect();
    };
  }, [isLoaded]);

  return (
    <div ref={ref} className="w-full h-full relative">
      {isLoaded ? children : (
        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400 text-sm rounded-lg border border-gray-100 transition-all duration-300">
          {isWaiting ? (
            <div className="flex flex-col items-center gap-3">
              <div className="w-8 h-8 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
              <span className="text-sm text-blue-500 font-medium">لودینگ...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 opacity-50">
               <span className="text-2xl">📊</span>
               <span className="text-sm">مکث کنید</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

const App: React.FC = () => {
  // --- State ---
  const [isLogScale, setIsLogScale] = useState(true);
  const [interval, setInterval] = useState("1M");
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [removedCoinIds, setRemovedCoinIds] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  
  // Data Fetching Config
  const [fetchLimit, setFetchLimit] = useState(1500); 
  const [loading, setLoading] = useState(true);
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
  
  // User & Search
  const [user, setUser] = useState<any>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // Load Preferences
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
          } catch(e) {}
      }
      const savedFavs = localStorage.getItem('crypto_favorites_v1');
      if (savedFavs) {
          try {
              const parsed = JSON.parse(savedFavs);
              if (Array.isArray(parsed)) setFavorites(new Set(parsed));
          } catch(e) {}
      }
  }, []);

  // Firebase Auth
  useEffect(() => {
    signInAnonymously(auth).catch(() => {});
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const userDocRef = doc(db, 'users', currentUser.uid);
        onSnapshot(userDocRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                if (data.removedCoinIds && Array.isArray(data.removedCoinIds)) {
                    setRemovedCoinIds(new Set(data.removedCoinIds));
                }
                if (data.favorites && Array.isArray(data.favorites)) {
                    setFavorites(new Set(data.favorites));
                }
            }
        });
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Reset pagination when data source changes
  useEffect(() => {
    setCurrentPage(1);
  }, [fetchLimit, showFavoritesOnly, searchQuery, coins.length]);

  // Scroll to top on page change
  useEffect(() => {
    if (mainContentRef.current) {
        mainContentRef.current.scrollIntoView({ behavior: 'smooth' });
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

  // --- Data Fetching ---
  const fetchWithRetry = async (url: string, retries = 3, baseBackoff = 2000, signal?: AbortSignal): Promise<any> => {
    for (let i = 0; i < retries; i++) {
      try {
        if (signal?.aborted) throw new DOMException('Aborted', 'AbortError');
        const response = await fetch(url, { headers: { 'Accept': 'application/json' }, mode: 'cors', signal });
        
        if (response.ok) return await response.json();
        if (response.status === 429) {
            await new Promise(r => setTimeout(r, baseBackoff * Math.pow(2, i + 1)));
            continue;
        }
        if (response.status >= 500) {
             await new Promise(r => setTimeout(r, baseBackoff * Math.pow(2, i)));
             continue;
        }
        throw new Error(`HTTP Error: ${response.status}`);
      } catch (err: any) {
        if (err.name === 'AbortError' || signal?.aborted) throw err;
        const isNetworkError = err.message === 'Failed to fetch';
        if (i === retries - 1) throw err;
        await new Promise(r => setTimeout(r, isNetworkError ? 5000 : baseBackoff * Math.pow(2, i)));
      }
    }
  };

  const minifyAndCacheData = (key: string, data: CoinData[]) => {
      try {
          const minified = data.map(coin => ({
              id: coin.id,
              symbol: coin.symbol,
              name: coin.name,
              image: coin.image,
              current_price: coin.current_price,
              market_cap_rank: coin.market_cap_rank,
              price_change_percentage_24h: coin.price_change_percentage_24h,
              // Extended Data
              market_cap: coin.market_cap,
              total_volume: coin.total_volume,
              high_24h: coin.high_24h,
              low_24h: coin.low_24h,
              ath: coin.ath,
              ath_change_percentage: coin.ath_change_percentage,
              price_change_percentage_7d_in_currency: coin.price_change_percentage_7d_in_currency,
              price_change_percentage_30d_in_currency: coin.price_change_percentage_30d_in_currency,
              price_change_percentage_1y_in_currency: coin.price_change_percentage_1y_in_currency
          }));
          localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data: minified }));
      } catch (e) { console.warn("Quota Exceeded"); }
  };

  useEffect(() => {
    const controller = new AbortController();
    const fetchCoins = async () => {
      setError(null);
      setLoadingProgress('');
      const cacheKey = `${DATA_CACHE_PREFIX}${fetchLimit}`;
      let usedCache = false;

      try {
          const stored = localStorage.getItem(cacheKey);
          if (stored) {
              const { timestamp, data } = JSON.parse(stored);
              if (Array.isArray(data) && data.length > 0) {
                  setCoins(data as CoinData[]);
                  usedCache = true;
                  setLoading(false);
                  if (Date.now() - timestamp < 300 * 1000) return;
              }
          }
      } catch (e) {}

      if (!usedCache) setLoading(true);

      try {
        const BATCH_SIZE = 250;
        const batchesNeeded = Math.ceil(fetchLimit / BATCH_SIZE);
        const accumulatedCoins: CoinData[] = [];
        
        for (let i = 1; i <= batchesNeeded; i++) {
            if (controller.signal.aborted) break;
            if (!usedCache) setLoadingProgress(`در حال دریافت بخش ${i} از ${batchesNeeded}...`);

            try {
                const batchData = await fetchWithRetry(
                    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${BATCH_SIZE}&page=${i}&sparkline=false&price_change_percentage=24h,7d,30d,1y`,
                    3, 2000, controller.signal
                );
                if (batchData && Array.isArray(batchData)) accumulatedCoins.push(...batchData);
            } catch (batchError) {
                if (accumulatedCoins.length > 0) break;
                else throw batchError;
            }
            if (i < batchesNeeded) await new Promise(r => setTimeout(r, 1200)); 
        }

        if (!controller.signal.aborted) {
            const filteredData = accumulatedCoins.filter((coin: CoinData) => 
                !STABLE_COINS.includes(coin.symbol.toLowerCase()) && 
                !STABLE_COINS.includes(coin.id.toLowerCase())
            );

            if (filteredData.length > 0) {
                setCoins(filteredData);
                minifyAndCacheData(cacheKey, filteredData);
            } else throw new Error("No data received");
        }
      } catch (err: any) {
        if (err.name !== 'AbortError' && !usedCache) setError("خطا در برقراری ارتباط. لطفاً دوباره تلاش کنید.");
      } finally {
        if (!controller.signal.aborted) {
            setLoading(false);
            setLoadingProgress('');
        }
      }
    };
    fetchCoins();
    return () => controller.abort();
  }, [fetchLimit, retryTrigger]);

  // --- Filtering & Pagination Logic ---
  const { paginatedCoins, totalPages, totalCount } = useMemo(() => {
    let result = coins.filter((coin) => !removedCoinIds.has(coin.id));

    if (showFavoritesOnly) {
        result = result.filter(c => favorites.has(c.id));
    }

    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        result = result.filter(c => 
            c.symbol.toLowerCase().includes(query) || 
            c.name.toLowerCase().includes(query)
        );
    }

    const totalCount = result.length;
    const totalPages = Math.ceil(totalCount / pageSize);

    const startIndex = (currentPage - 1) * pageSize;
    const paginatedCoins = result.slice(startIndex, startIndex + pageSize);
    
    return { paginatedCoins, totalPages, totalCount };
  }, [coins, removedCoinIds, favorites, showFavoritesOnly, searchQuery, currentPage, pageSize]);

  // --- Helpers ---
  const formatCurrency = (value: number) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value < 1 ? 6 : 2 }).format(value);
  };
  
  const formatCompact = (value: number) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: "compact",
        maximumFractionDigits: 1
    }).format(value);
  };

  const getTradingViewSymbol = (coinSymbol: string) => {
    if (coinSymbol.toLowerCase() === 'usdt') return 'USDCUSDT'; 
    return `${coinSymbol.toUpperCase()}USDT`;
  };

  const getPercentClass = (val: number | null | undefined) => {
      if (val === null || val === undefined) return 'text-gray-400';
      if (val === 0) return 'text-gray-500';
      return val > 0 ? 'text-green-600' : 'text-red-600';
  };

  // Helper to format percentage with sign
  const fmtPct = (val: number | null | undefined) => {
      if (val === null || val === undefined) return '-';
      return `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;
  };

  const toggleFullscreen = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen().catch(() => {});
  };

  const removeCoin = async (coinId: string) => {
    setRemovedCoinIds((prev) => {
      const newSet = new Set(prev);
      newSet.add(coinId);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(newSet)));
      if (user) {
          const userDocRef = doc(db, 'users', user.uid);
          setDoc(userDocRef, { removedCoinIds: Array.from(newSet) }, { merge: true });
      }
      return newSet;
    });
  };

  const toggleFavorite = (coinId: string) => {
      setFavorites(prev => {
          const newSet = new Set(prev);
          if (newSet.has(coinId)) newSet.delete(coinId);
          else newSet.add(coinId);
          localStorage.setItem('crypto_favorites_v1', JSON.stringify(Array.from(newSet)));
          if (user) {
              const userDocRef = doc(db, 'users', user.uid);
              setDoc(userDocRef, { favorites: Array.from(newSet) }, { merge: true });
          }
          return newSet;
      });
  };

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
    const data = { removedCoinIds: Array.from(removedCoinIds), favorites: Array.from(favorites), exportedAt: new Date().toISOString() };
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
        if (json.removedCoinIds) setRemovedCoinIds(new Set(json.removedCoinIds));
        if (json.favorites) setFavorites(new Set(json.favorites));
        alert("Backup restored!");
      } catch (err) { alert("Invalid file"); }
    };
    reader.readAsText(file);
  };

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm z-20 sticky top-0">
        <div className="max-w-[1920px] mx-auto px-4 py-3">
          <div className="flex flex-col xl:flex-row justify-between items-center gap-4">
            
            {/* Left: Title & Search */}
            <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 whitespace-nowrap">
                <span className="text-blue-600">₿</span>
                نمودار ارز دیجیتال
              </h1>
              
              {/* Search Box */}
              <div className="relative w-full md:w-64">
                <input 
                    type="text" 
                    placeholder="جستجوی نام یا نماد..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                />
                {searchQuery && (
                    <button 
                        onClick={() => setSearchQuery('')}
                        className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                        ✕
                    </button>
                )}
              </div>
            </div>

            {/* Right: Controls */}
            <div className="flex flex-wrap items-center justify-center gap-2 w-full xl:w-auto">
              
              <button
                onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors flex items-center gap-1 ${showFavoritesOnly ? 'bg-yellow-50 border-yellow-300 text-yellow-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
              >
                {showFavoritesOnly ? '★ برگزیده‌ها' : '☆ علاقه‌مندی‌ها'}
              </button>

              <div className="h-6 w-px bg-gray-300 hidden md:block" />
              
              {/* Fetch Limit Selector */}
              <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200">
                 <span className="text-xs text-gray-500 uppercase">دانلود:</span>
                 <select 
                    value={fetchLimit} 
                    onChange={(e) => setFetchLimit(Number(e.target.value))}
                    className="bg-transparent text-sm font-semibold outline-none text-gray-700"
                  >
                    {FETCH_LIMIT_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
              </div>

              {/* View Per Page Selector */}
              <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200">
                 <span className="text-xs text-gray-500 uppercase">صفحه:</span>
                 <select 
                    value={pageSize} 
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="bg-transparent text-sm font-semibold outline-none text-gray-700"
                  >
                    {PAGE_SIZE_OPTIONS.map(opt => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
              </div>

              <div className="h-6 w-px bg-gray-300 hidden md:block" />

              <button
                onClick={() => setIsLogScale(!isLogScale)}
                className={`px-3 py-2 rounded-lg border text-sm font-medium transition-colors ${isLogScale ? 'bg-blue-50 border-blue-200 text-blue-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
              >
                {isLogScale ? 'Log' : 'Lin'}
              </button>

              <select 
                value={interval} 
                onChange={(e) => setInterval(e.target.value)}
                className="px-2 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {TIMEFRAMES.map(tf => (
                  <option key={tf.value} value={tf.value}>{tf.label}</option>
                ))}
              </select>

              <div className="h-6 w-px bg-gray-300 hidden md:block" />

              <div className="relative group">
                <button className="px-3 py-2 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 text-sm">
                  ⚙️
                </button>
                <div className="absolute left-0 mt-2 w-48 bg-white rounded-lg shadow-xl border border-gray-100 hidden group-hover:block p-2 z-50">
                  <button onClick={handleSaveLayout} className="w-full text-right px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded">ذخیره چیدمان</button>
                  <button onClick={handleResetLayout} className="w-full text-right px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded">بازنشانی</button>
                  <hr className="my-1" />
                  <button onClick={handleExportBackup} className="w-full text-right px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded">بکاپ</button>
                  <label className="block w-full text-right px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded cursor-pointer">
                    ریستور
                    <input type="file" className="hidden" ref={fileInputRef} onChange={handleImportBackup} accept=".json" />
                  </label>
                </div>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main ref={mainContentRef} className="flex-grow p-4 md:p-6 bg-gray-100">
        {loading ? (
            <div className="flex flex-col items-center justify-center h-96">
                <div className="w-16 h-16 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
                <p className="text-gray-800 font-medium animate-pulse mb-2">در حال دریافت اطلاعات...</p>
                {loadingProgress && (
                    <p className="text-blue-600 text-sm font-medium bg-blue-50 px-3 py-1 rounded-full">{loadingProgress}</p>
                )}
            </div>
        ) : error ? (
            <div className="flex flex-col items-center justify-center h-96 text-center">
                <div className="text-red-500 text-5xl mb-4">⚠️</div>
                <p className="text-gray-800 font-medium text-lg mb-2">خطا در دریافت</p>
                <p className="text-gray-500 mb-6 max-w-md">{error}</p>
                <button 
                    onClick={() => setRetryTrigger(prev => prev + 1)}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-all shadow-lg hover:shadow-xl"
                >
                    تلاش مجدد
                </button>
            </div>
        ) : totalCount === 0 ? (
            <div className="flex flex-col items-center justify-center h-96 text-center">
                <p className="text-gray-500 text-lg">موردی یافت نشد.</p>
                {searchQuery && <p className="text-gray-400 mt-2">برای "{searchQuery}" نتیجه‌ای پیدا نشد.</p>}
            </div>
        ) : (
            <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {paginatedCoins.map((coin) => {
                      // Calculate "To ATH" percentage
                      const toAth = coin.ath && coin.current_price ? ((coin.ath - coin.current_price) / coin.current_price) * 100 : 0;
                      
                      return (
                    <div 
                      id={`card-${coin.id}`}
                      key={coin.id} 
                      style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 500px' }}
                      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col aspect-square transition-all hover:shadow-md"
                    >
                      {/* 1. Header */}
                      <div className="px-3 py-2 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
                        <div className="flex items-center gap-2">
                          <img src={coin.image} alt={coin.name} className="w-8 h-8 rounded-full" loading="lazy" />
                          <div>
                            <div className="flex items-center gap-1.5">
                               <h3 className="font-bold text-gray-800 text-lg">{coin.symbol.toUpperCase()}</h3>
                               <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-medium">#{coin.market_cap_rank}</span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center">
                          <button 
                            onClick={() => toggleFavorite(coin.id)}
                            className={`p-1.5 rounded-lg hover:bg-gray-100 transition-colors ${favorites.has(coin.id) ? 'text-yellow-400' : 'text-gray-300'}`}
                          >
                             <span className="text-xl">★</span>
                          </button>
                          <button 
                            onClick={() => toggleFullscreen(`card-${coin.id}`)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <span className="text-xl">⛶</span>
                          </button>
                          <button 
                            onClick={() => removeCoin(coin.id)}
                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <span className="text-xl">✕</span>
                          </button>
                        </div>
                      </div>

                      {/* 2. Primary Stats (Price & 24h) */}
                      <div className="px-4 py-2 bg-gray-50 flex justify-between items-center border-b border-gray-100 shrink-0">
                         <div className="flex items-center gap-1">
                            <span className="text-gray-800 font-bold text-xl">{formatCurrency(coin.current_price)}</span>
                         </div>
                         <div className="flex items-center gap-1">
                            <span className={`font-bold text-sm ${getPercentClass(coin.price_change_percentage_24h)} dir-ltr`}>
                                {fmtPct(coin.price_change_percentage_24h)} (24h)
                            </span>
                         </div>
                      </div>

                      {/* 3. Detailed Stats Grid */}
                      <div className="grid grid-cols-3 gap-x-2 gap-y-1 p-3 text-xs bg-white border-b border-gray-100 text-gray-600 shrink-0">
                          {/* Column 1: Historical Changes */}
                          <div className="flex flex-col gap-1">
                              <div className="flex justify-between">
                                  <span>7d:</span>
                                  <span className={getPercentClass(coin.price_change_percentage_7d_in_currency)}>{fmtPct(coin.price_change_percentage_7d_in_currency)}</span>
                              </div>
                              <div className="flex justify-between">
                                  <span>30d:</span>
                                  <span className={getPercentClass(coin.price_change_percentage_30d_in_currency)}>{fmtPct(coin.price_change_percentage_30d_in_currency)}</span>
                              </div>
                              <div className="flex justify-between">
                                  <span>1y:</span>
                                  <span className={getPercentClass(coin.price_change_percentage_1y_in_currency)}>{fmtPct(coin.price_change_percentage_1y_in_currency)}</span>
                              </div>
                          </div>

                          {/* Column 2: ATH Data */}
                          <div className="flex flex-col gap-1 border-l border-gray-100 pl-2">
                              <div className="flex justify-between" title="All Time High Price">
                                  <span>ATH:</span>
                                  <span className="text-gray-700">{formatCompact(coin.ath)}</span>
                              </div>
                              <div className="flex justify-between" title="Down from ATH">
                                  <span>Drop:</span>
                                  <span className="text-red-500">{fmtPct(coin.ath_change_percentage)}</span>
                              </div>
                              <div className="flex justify-between" title="Needed to reach ATH">
                                  <span>To ATH:</span>
                                  <span className="text-green-600 font-medium">+{toAth.toFixed(0)}%</span>
                              </div>
                          </div>

                          {/* Column 3: Market Data */}
                          <div className="flex flex-col gap-1 border-l border-gray-100 pl-2">
                               <div className="flex justify-between">
                                  <span>Cap:</span>
                                  <span className="text-gray-700">{formatCompact(coin.market_cap)}</span>
                              </div>
                              <div className="flex justify-between">
                                  <span>Vol:</span>
                                  <span className="text-gray-700">{formatCompact(coin.total_volume)}</span>
                              </div>
                              <div className="flex justify-between" title={`H: ${formatCurrency(coin.high_24h)} L: ${formatCurrency(coin.low_24h)}`}>
                                  <span>H/L:</span>
                                  <span className="text-gray-500">Info</span>
                              </div>
                          </div>
                      </div>

                      {/* 4. Chart */}
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
                  )})}
                </div>

                {/* Pagination Controls */}
                <div className="mt-8 flex flex-col items-center gap-4">
                    <span className="text-sm text-gray-500">
                        نمایش {((currentPage - 1) * pageSize) + 1} تا {Math.min(currentPage * pageSize, totalCount)} از {totalCount} ارز
                    </span>
                    <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
                        <button 
                            onClick={() => setCurrentPage(1)} 
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 text-sm rounded bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
                        >
                            اولین
                        </button>
                        <button 
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                            disabled={currentPage === 1}
                            className="px-3 py-1.5 text-sm rounded bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
                        >
                            قبلی
                        </button>
                        
                        <div className="px-4 py-1.5 text-sm font-semibold text-blue-600 bg-blue-50 rounded">
                            صفحه {currentPage} از {totalPages}
                        </div>

                        <button 
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 text-sm rounded bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
                        >
                            بعدی
                        </button>
                        <button 
                            onClick={() => setCurrentPage(totalPages)} 
                            disabled={currentPage === totalPages}
                            className="px-3 py-1.5 text-sm rounded bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
                        >
                            آخرین
                        </button>
                    </div>
                </div>
            </>
        )}
      </main>
    </div>
  );
};

export default App;