import React, { useState, useEffect, useRef, useMemo } from 'react';
import TradingViewWidget from './components/TradingViewWidget';
import { auth, db } from './firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc, getDoc } from 'firebase/firestore';

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

const LOCAL_STORAGE_KEY = 'crypto_layout_preference_v1';

const App: React.FC = () => {
  const [isLogScale, setIsLogScale] = useState(true);
  const [interval, setInterval] = useState("1M"); // Default Timeframe
  const [coins, setCoins] = useState<CoinData[]>([]); // Raw fetched data (buffer)
  const [removedCoinIds, setRemovedCoinIds] = useState<Set<string>>(new Set()); // Persist removed IDs
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0); // For manual retry
  const [user, setUser] = useState<any>(null); // Firebase User
  
  // State for Pagination Tooltip
  const [hoveredPageInfo, setHoveredPageInfo] = useState<{ page: number; rect: DOMRect } | null>(null);
  const [previewAvgCap, setPreviewAvgCap] = useState<number | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  
  // Refs for debouncing hover fetch & aborting requests
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const currentHoveredPageRef = useRef<number | null>(null);
  const tooltipAbortControllerRef = useRef<AbortController | null>(null);

  // File Input Ref for Import
  const fileInputRef = useRef<HTMLInputElement>(null);

  const DISPLAY_COUNT = 12;
  // Fetch slightly more to create a buffer for deletions/stablecoins, but keep it light
  const FETCH_PER_PAGE = 20; 
  // Estimate for 5000+ coins. 5000 / 12 = ~417 pages.
  const TOTAL_PAGES = 417;

  // Load from LocalStorage on mount
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
  }, []);

  // Firebase Authentication & Database Sync
  useEffect(() => {
    // 1. Sign in anonymously
    signInAnonymously(auth).catch((err) => {
        // If API key is invalid (default), we just ignore persistence silently
        if (err.code !== 'auth/invalid-api-key' && err.code !== 'auth/api-key-not-valid') {
            console.warn("Firebase Auth Error:", err.message);
        }
    });

    // 2. Listen for auth state
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      
      if (currentUser) {
        // 3. Connect to Firestore for this user
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
            }
        }, (err) => {
            // Permission denied usually means Firestore rules aren't set or DB doesn't exist yet
            if (err.code !== 'permission-denied') {
                 console.warn("Firestore Read Error:", err.message);
            }
        });

        return () => unsubscribeSnapshot();
      }
    });

    return () => unsubscribeAuth();
  }, []);

  // Robust fetch with retry logic, exponential backoff, and AbortSignal support
  const fetchWithRetry = async (url: string, retries = 3, baseBackoff = 1500, signal?: AbortSignal): Promise<any> => {
    for (let i = 0; i < retries; i++) {
      try {
        if (signal?.aborted) {
            throw new DOMException('Aborted', 'AbortError');
        }

        const response = await fetch(url, {
            headers: {
                'Accept': 'application/json'
            },
            mode: 'cors', // Explicitly state CORS
            signal
        });
        
        if (response.ok) {
            return await response.json();
        }

        // If rate limited (429), wait longer with exponential backoff
        if (response.status === 429) {
            const waitTime = baseBackoff * Math.pow(2, i + 1); // 3s, 6s, 12s...
            console.warn(`Rate limit (429). Retrying in ${waitTime}ms...`);
            await new Promise(r => setTimeout(r, waitTime));
            continue; // Retry
        }

        // For other server errors, retry normally
        if (response.status >= 500) {
             const waitTime = baseBackoff * Math.pow(2, i);
             console.warn(`Server error (${response.status}). Retrying in ${waitTime}ms...`);
             await new Promise(r => setTimeout(r, waitTime));
             continue;
        }

        // For 4xx errors (other than 429), throw immediately (e.g. 404)
        throw new Error(`HTTP Error: ${response.status}`);

      } catch (err: any) {
        // Don't retry if aborted
        if (err.name === 'AbortError' || signal?.aborted) {
            throw err;
        }

        // If it's the last retry, throw
        if (i === retries - 1) {
            throw err;
        }
        
        // Exponential backoff for network errors (Failed to fetch)
        const waitTime = baseBackoff * Math.pow(2, i);
        console.log(`Fetch attempt ${i + 1} failed (${err.message}). Retrying in ${waitTime}ms...`);
        await new Promise(r => setTimeout(r, waitTime));
      }
    }
  };

  // Fetch data from CoinGecko
  useEffect(() => {
    const controller = new AbortController();

    const fetchCoins = async () => {
      setLoading(true);
      setError(null);
      try {
        // Fetch a batch to handle filtering and deletions
        const data = await fetchWithRetry(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${FETCH_PER_PAGE}&page=${page}&sparkline=false&price_change_percentage=24h,7d,30d,1y`,
          4, // Increased retries
          2000, // Initial backoff 2s
          controller.signal
        );
        
        // Initial filter for stablecoins (we still filter removedCoins later)
        const filteredData = data.filter((coin: CoinData) => 
            !STABLE_COINS.includes(coin.symbol.toLowerCase()) && 
            !STABLE_COINS.includes(coin.id.toLowerCase())
        );

        if (!controller.signal.aborted) {
            setCoins(filteredData);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
            console.error("Final Fetch Error:", err);
            setError("اتصال به سرور برقرار نشد. ممکن است محدودیت API اعمال شده باشد. لطفاً کمی صبر کنید و دوباره تلاش کنید.");
        }
      } finally {
        if (!controller.signal.aborted) {
            setLoading(false);
        }
      }
    };

    fetchCoins();
    
    // Scroll to top on page change
    window.scrollTo({ top: 0, behavior: 'smooth' });

    return () => {
        controller.abort();
    };
  }, [page, retryTrigger]);

  // Derive the coins to display from the buffer
  const visibleCoins = useMemo(() => {
    return coins
      .filter((coin) => !removedCoinIds.has(coin.id))
      .slice(0, DISPLAY_COUNT);
  }, [coins, removedCoinIds]);

  // Format currency
  const formatCurrency = (value: number) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      maximumFractionDigits: value < 1 ? 6 : 2,
    }).format(value);
  };

  // Format Compact Numbers (Market Cap, Volume)
  const formatCompact = (value: number) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
      notation: "compact",
      maximumFractionDigits: 2
    }).format(value);
  };
  
  // Helper to map CoinGecko symbol to TradingView Symbol
  const getTradingViewSymbol = (coinSymbol: string) => {
    if (coinSymbol.toLowerCase() === 'usdt') return 'USDCUSDT'; 
    return `${coinSymbol.toUpperCase()}USDT`;
  };

  // Generate ALL page numbers (no truncation)
  const getPageNumbers = () => {
    return Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);
  };

  // Helper for percentage color
  const getPercentClass = (val: number | null | undefined) => {
      if (val === null || val === undefined) return 'text-gray-500';
      return val >= 0 ? 'text-green-600' : 'text-red-600';
  };

  // Toggle Fullscreen
  const toggleFullscreen = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;

    if (document.fullscreenElement) {
        document.exitFullscreen();
    } else {
        el.requestFullscreen().catch(err => {
            console.error(`Error attempting to enable full-screen mode: ${err.message}`);
        });
    }
  };

  // Remove Coin with Firestore & LocalStorage Sync
  const removeCoin = async (coinId: string) => {
    setRemovedCoinIds((prev) => {
      const newSet = new Set(prev);
      newSet.add(coinId);
      
      // Sync to LocalStorage
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(newSet)));

      // Sync to Firestore if user is logged in
      if (user) {
          const userDocRef = doc(db, 'users', user.uid);
          setDoc(userDocRef, { removedCoinIds: Array.from(newSet) }, { merge: true })
            .catch(err => console.error("Error saving to DB:", err));
      }
      
      return newSet;
    });
  };

  // --- Local Storage & File Backup Logic ---

  // Manual Save to LocalStorage (User Triggered)
  const handleSaveLayout = () => {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(removedCoinIds)));
        alert("چیدمان فعلی با موفقیت در مرورگر ذخیره شد.");
    } catch (error) {
        alert("خطا در ذخیره‌سازی.");
    }
  };

  // Manual Reset
  const handleResetLayout = () => {
      if (window.confirm("آیا مطمئن هستید؟ تمام ارزهای حذف شده بازگردانده می‌شوند.")) {
          setRemovedCoinIds(new Set());
          localStorage.removeItem(LOCAL_STORAGE_KEY);
          // Optional: clear firestore too? keeping it simple for now.
      }
  };

  // Export Settings to JSON
  const handleExportBackup = () => {
    const data = {
      removedCoinIds: Array.from(removedCoinIds),
      exportedAt: new Date().toISOString(),
      version: 1
    };
    
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `crypto-backup-${new Date().toISOString().slice(0,10)}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Import Settings from JSON
  const handleImportBackup = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const json = JSON.parse(e.target?.result as string);
        if (json.removedCoinIds && Array.isArray(json.removedCoinIds)) {
          const newSet = new Set(json.removedCoinIds);
          
          setRemovedCoinIds(prev => {
             const merged = new Set([...Array.from(prev), ...Array.from(newSet)]);
             // Sync LS
             localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(merged)));
             return merged;
          });

          alert(`بازیابی با موفقیت انجام شد! ${json.removedCoinIds.length} ارز به لیست سیاه اضافه شد.`);
          
          // Also sync to firebase if connected
           if (user) {
              const userDocRef = doc(db, 'users', user.uid);
              setDoc(userDocRef, { removedCoinIds: Array.from(newSet) }, { merge: true }) // Note: logic here might want to be merge with existing DB data, but for now we trust the file/local
                .catch(err => console.warn("Error syncing import to DB", err));
           }

        } else {
          alert("فرمت فایل نامعتبر است.");
        }
      } catch (err) {
        console.error(err);
        alert("خطا در خواندن فایل.");
      }
      // Reset input
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const triggerImportClick = () => {
    fileInputRef.current?.click();
  };

  // Handle Mouse Enter on Page Number
  const onPageEnter = (pageNum: number, e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setHoveredPageInfo({ page: pageNum, rect });
      currentHoveredPageRef.current = pageNum;

      // Cancel any pending tooltip logic
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (tooltipAbortControllerRef.current) tooltipAbortControllerRef.current.abort();
      
      setPreviewAvgCap(null);
      setIsPreviewLoading(true);

      // If hovering current page, estimate from visible coins
      if (pageNum === page && visibleCoins.length > 0) {
          const total = visibleCoins.reduce((acc, c) => acc + c.market_cap, 0);
          setPreviewAvgCap(total / visibleCoins.length);
          setIsPreviewLoading(false);
          return;
      }
      
      // If the main list is loading, don't spam tooltip requests
      if (loading) {
          // Keep loading state but don't fetch
          return;
      }

      // Debounce fetch for other pages - Increased to 700ms to allow mouse movement without requests
      hoverTimeoutRef.current = setTimeout(async () => {
          if (currentHoveredPageRef.current !== pageNum) return;

          const controller = new AbortController();
          tooltipAbortControllerRef.current = controller;

          try {
              // Using fetchWithRetry here too but with fewer retries for tooltips
              const data = await fetchWithRetry(
                  `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=12&page=${pageNum}&sparkline=false`,
                  1, // Only 1 retry for tooltip to be snappy or fail silently
                  1000,
                  controller.signal
              );
              
              if (currentHoveredPageRef.current === pageNum && data && data.length > 0) {
                  const filtered = data.filter((c: any) => !STABLE_COINS.includes(c.symbol.toLowerCase()));
                  if (filtered.length > 0) {
                      const total = filtered.reduce((acc: any, c: any) => acc + c.market_cap, 0);
                      setPreviewAvgCap(total / filtered.length);
                  } else {
                      setPreviewAvgCap(0);
                  }
              } else {
                  setPreviewAvgCap(0);
              }
          } catch (error: any) {
              // Silently fail for tooltips unless it's a real logic error
              if (error.name !== 'AbortError') {
                 // Only log strictly necessary errors
                 if (error.message !== 'Failed to fetch') {
                    console.warn("Preview fetch warning:", error.message);
                 }
                 setPreviewAvgCap(null); 
              }
          } finally {
              if (currentHoveredPageRef.current === pageNum) {
                  setIsPreviewLoading(false);
              }
          }
      }, 700); 
  };

  const onPageLeave = () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (tooltipAbortControllerRef.current) tooltipAbortControllerRef.current.abort();
      
      currentHoveredPageRef.current = null;
      setHoveredPageInfo(null);
      setPreviewAvgCap(null);
      setIsPreviewLoading(false);
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 flex flex-col items-center font-sans">
      {/* Header */}
      <header className="w-full bg-white shadow-sm sticky top-0 z-20 px-4 py-3 border-b border-gray-200">
        <div className="flex flex-col xl:flex-row items-center justify-between max-w-full mx-auto gap-4 xl:gap-0">
          <div className="flex items-center">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 mr-4">
               بازار حرفه‌ای ارزهای دیجیتال
            </h1>
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              صفحه {page} از {TOTAL_PAGES}
            </span>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4">
            
            {/* Backup/Restore & Quick Save Group */}
            <div className="flex items-center gap-2">
                 {/* Hidden File Input */}
                 <input 
                    type="file" 
                    ref={fileInputRef} 
                    onChange={handleImportBackup} 
                    accept=".json" 
                    className="hidden" 
                 />
                 
                 {/* Quick Save (LocalStorage) */}
                 <button 
                    onClick={handleSaveLayout}
                    className="flex items-center gap-1 bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg border border-green-200 transition-colors text-sm font-medium"
                    title="ذخیره چیدمان فعلی در مرورگر"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path>
                        <polyline points="17 21 17 13 7 13 7 21"></polyline>
                        <polyline points="7 3 7 8 15 8"></polyline>
                    </svg>
                    <span>ذخیره چیدمان</span>
                 </button>

                 {/* Reset */}
                 <button 
                    onClick={handleResetLayout}
                    className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg border border-red-200 transition-colors text-sm font-medium"
                    title="بازگشت به تنظیمات اولیه (نمایش همه)"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M3 3v5h5"></path>
                        <path d="M3.05 13A9 9 0 1 0 6 5.3L3 8"></path>
                    </svg>
                    <span>بازنشانی</span>
                 </button>

                 <div className="h-6 w-px bg-gray-300 mx-1"></div>

                 {/* File Export (Small) */}
                 <button 
                    onClick={handleExportBackup}
                    className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-md border border-gray-200 transition-colors"
                    title="دانلود فایل پشتیبان (Export JSON)"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="7 10 12 15 17 10"></polyline>
                        <line x1="12" y1="15" x2="12" y2="3"></line>
                    </svg>
                 </button>
                 
                 {/* File Import (Small) */}
                 <button 
                    onClick={triggerImportClick}
                    className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-md border border-gray-200 transition-colors"
                    title="بازیابی از فایل (Import JSON)"
                 >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                        <polyline points="17 8 12 3 7 8"></polyline>
                        <line x1="12" y1="3" x2="12" y2="15"></line>
                    </svg>
                 </button>
            </div>

            {/* Timeframe Selector */}
            <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200 overflow-x-auto max-w-full">
                {TIMEFRAMES.map((tf) => (
                    <button
                        key={tf.value}
                        onClick={() => setInterval(tf.value)}
                        className={`px-3 py-1 rounded-md text-sm font-medium transition-all whitespace-nowrap ${
                            interval === tf.value 
                            ? 'bg-white text-blue-600 shadow-sm' 
                            : 'text-gray-500 hover:text-gray-900'
                        }`}
                    >
                        {tf.label}
                    </button>
                ))}
            </div>

            {/* Log/Linear Selector */}
            <div className="inline-flex items-center justify-center bg-gray-100 p-1 rounded-lg border border-gray-200 flex-shrink-0">
                <span 
                  className={`cursor-pointer px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${isLogScale ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`} 
                  onClick={() => setIsLogScale(true)}
                >
                لگاریتمی
              </span>
              <span 
                  className={`cursor-pointer px-3 py-1 rounded-md text-sm font-medium transition-all duration-200 ${!isLogScale ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`} 
                  onClick={() => setIsLogScale(false)}
                >
                خطی
              </span>
            </div>
          </div>
        </div>
      </header>

      <main className="w-full flex-grow p-4">
        {error && (
          <div className="w-full max-w-2xl mx-auto mt-10 p-4 bg-red-100 text-red-700 rounded-lg text-center border border-red-200">
            <p className="font-bold mb-2">خطا در دریافت اطلاعات</p>
            <p className="text-sm mb-4">{error}</p>
            <button 
                onClick={() => setRetryTrigger(prev => prev + 1)} 
                className="text-sm px-6 py-2 bg-white text-red-700 font-bold rounded shadow-sm hover:bg-red-50 border border-red-200 transition-colors"
            >
                تلاش مجدد
            </button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center h-[80vh]">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-500 animate-pulse">در حال دریافت و تحلیل داده‌های بازار...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 w-full">
            {visibleCoins.map((coin) => {
              // Calculate percentage needed to reach ATH
              const recoveryToAth = coin.current_price && coin.ath ? ((coin.ath - coin.current_price) / coin.current_price) * 100 : 0;
              const chartContainerId = `chart-container-${coin.id}`;

              return (
              <div key={coin.id} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col aspect-square relative group">
                
                {/* Remove Button */}
                <button 
                    onClick={(e) => {
                        e.stopPropagation();
                        removeCoin(coin.id);
                    }}
                    className="absolute top-2 right-2 bg-white/90 hover:bg-red-50 text-gray-400 hover:text-red-500 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 z-30 shadow-sm border border-transparent hover:border-red-100"
                    title="حذف این ارز"
                >
                    <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="6" x2="6" y2="18"></line>
                        <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                </button>

                {/* Professional Card Header & Stats */}
                <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0">
                    
                    {/* Top Row: Identity & Price */}
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                             <div className="flex flex-col items-center justify-center bg-gray-100 w-12 h-12 rounded-full border border-gray-200">
                                <span className="text-sm font-bold text-gray-500">#{coin.market_cap_rank}</span>
                             </div>
                             <img src={coin.image} alt={coin.name} className="w-10 h-10 rounded-full" />
                             <div>
                                 <h2 className="text-lg font-bold text-gray-900 leading-tight">{coin.name}</h2>
                                 <span className="text-sm text-gray-500 font-semibold uppercase">{coin.symbol}</span>
                             </div>
                        </div>
                        <div className="text-right pr-8">
                            <div className="text-2xl font-extrabold text-gray-900 font-mono tracking-tight">
                                {formatCurrency(coin.current_price)}
                            </div>
                            <div className={`text-sm font-bold ${getPercentClass(coin.price_change_percentage_24h)}`}>
                                {coin.price_change_percentage_24h?.toFixed(2)}% (24h)
                            </div>
                        </div>
                    </div>

                    {/* Performance Strip - 5 Columns */}
                    <div className="grid grid-cols-5 gap-1 text-center text-xs mb-4 bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <div className="flex flex-col">
                            <span className="text-gray-400 mb-1">7d</span>
                            <span className={`font-bold text-sm ${getPercentClass(coin.price_change_percentage_7d_in_currency)}`}>
                                {coin.price_change_percentage_7d_in_currency?.toFixed(2)}%
                            </span>
                        </div>
                        <div className="flex flex-col border-l border-gray-200 pl-1">
                            <span className="text-gray-400 mb-1">30d</span>
                            <span className={`font-bold text-sm ${getPercentClass(coin.price_change_percentage_30d_in_currency)}`}>
                                {coin.price_change_percentage_30d_in_currency?.toFixed(2)}%
                            </span>
                        </div>
                        <div className="flex flex-col border-l border-gray-200 pl-1">
                            <span className="text-gray-400 mb-1">1y</span>
                            <span className={`font-bold text-sm ${getPercentClass(coin.price_change_percentage_1y_in_currency)}`}>
                                {coin.price_change_percentage_1y_in_currency?.toFixed(2)}%
                            </span>
                        </div>
                        <div className="flex flex-col border-l border-gray-200 pl-1">
                            <span className="text-gray-400 mb-1">ATH</span>
                            <span className={`font-bold text-sm ${getPercentClass(coin.ath_change_percentage)}`}>
                                {coin.ath_change_percentage?.toFixed(1)}%
                            </span>
                        </div>
                        <div className="flex flex-col border-l border-gray-200 pl-1">
                            <span className="text-gray-400 mb-1 font-medium">To ATH</span>
                            <span className="font-bold text-sm text-green-600">
                                +{recoveryToAth.toFixed(1)}%
                            </span>
                        </div>
                    </div>

                    {/* Detailed Stats Grid */}
                    <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                         <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                             <span className="text-gray-500">Market Cap</span>
                             <span className="font-bold text-gray-900">${formatCompact(coin.market_cap)}</span>
                         </div>
                         <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                             <span className="text-gray-500">Volume (24h)</span>
                             <span className="font-bold text-gray-900">${formatCompact(coin.total_volume)}</span>
                         </div>
                         <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                             <span className="text-gray-500">High (24h)</span>
                             <span className="font-bold text-gray-900">{formatCurrency(coin.high_24h)}</span>
                         </div>
                         <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                             <span className="text-gray-500">Low (24h)</span>
                             <span className="font-bold text-gray-900">{formatCurrency(coin.low_24h)}</span>
                         </div>
                         <div className="flex justify-between items-center">
                             <span className="text-gray-500">Circ. Supply</span>
                             <span className="font-bold text-gray-900">{formatCompact(coin.circulating_supply)}</span>
                         </div>
                         <div className="flex justify-between items-center">
                             <span className="text-gray-500">Total Supply</span>
                             <span className="font-bold text-gray-900">{coin.total_supply ? formatCompact(coin.total_supply) : '∞'}</span>
                         </div>
                    </div>
                </div>

                {/* Chart Area */}
                <div id={chartContainerId} className="flex-grow bg-white relative w-full overflow-hidden border-t border-gray-100 group">
                  <TradingViewWidget 
                    isLogScale={isLogScale} 
                    symbol={getTradingViewSymbol(coin.symbol)} 
                    interval={interval}
                  />
                  {/* Fullscreen Button */}
                  <button
                    onClick={() => toggleFullscreen(chartContainerId)}
                    className="absolute top-2 right-2 bg-white bg-opacity-90 hover:bg-opacity-100 p-1.5 rounded-md shadow-md border border-gray-200 text-gray-600 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"
                    title="تمام صفحه"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="15 3 21 3 21 9"></polyline>
                        <polyline points="9 21 3 21 3 15"></polyline>
                        <line x1="21" y1="3" x2="14" y2="10"></line>
                        <line x1="3" y1="21" x2="10" y2="14"></line>
                    </svg>
                  </button>
                </div>
              </div>
            )})}
          </div>
        )}
      </main>
      
      {/* Bottom Pagination */}
      <footer className="w-full bg-white border-t border-gray-200 p-4 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="flex flex-col gap-4">
            
            <div className="flex items-center gap-1 overflow-x-auto w-full px-2 pb-2" style={{ scrollbarWidth: 'thin' }}>
              {getPageNumbers().map((p) => {
                  return (
                    <button
                      key={p}
                      onClick={() => setPage(p)}
                      onMouseEnter={(e) => onPageEnter(p, e)}
                      onMouseLeave={onPageLeave}
                      disabled={loading}
                      className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-md text-sm font-medium transition-colors border
                        ${p === page 
                          ? 'bg-blue-600 text-white border-blue-600 shadow-md' 
                          : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100 hover:border-gray-300'
                        }`}
                    >
                      {p}
                    </button>
                  );
              })}
            </div>
            
             <div className="flex justify-between items-center text-sm text-gray-500 px-2">
                 <span>نمایش 1 تا {TOTAL_PAGES} از {TOTAL_PAGES} صفحه</span>
                 <div className="flex gap-2">
                     <button 
                        disabled={page === 1 || loading}
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                     >
                        قبلی
                     </button>
                     <button 
                        disabled={page === TOTAL_PAGES || loading}
                        onClick={() => setPage(p => Math.min(TOTAL_PAGES, p + 1))}
                        className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50"
                     >
                        بعدی
                     </button>
                 </div>
             </div>
        </div>
      </footer>

      {/* Pagination Tooltip Portal/Overlay */}
      {hoveredPageInfo && (
          <div 
            className="fixed z-50 bg-gray-900 text-white text-xs rounded px-3 py-2 shadow-xl border border-gray-700 pointer-events-none"
            style={{
                top: `${hoveredPageInfo.rect.top - 70}px`,
                left: `${hoveredPageInfo.rect.left + (hoveredPageInfo.rect.width / 2)}px`,
                transform: 'translateX(-50%)',
                minWidth: '160px'
            }}
          >
              {(() => {
                   const startRank = (hoveredPageInfo.page - 1) * DISPLAY_COUNT + 1;
                   const endRank = hoveredPageInfo.page * DISPLAY_COUNT;
                  return (
                      <div className="flex flex-col gap-1 text-center">
                          <div className="font-bold text-yellow-400 mb-1 border-b border-gray-700 pb-1">صفحه {hoveredPageInfo.page}</div>
                          <div className="flex justify-between">
                              <span className="text-gray-400">رنک‌ها (تخمینی):</span>
                              <span className="font-mono">{startRank} - {endRank}</span>
                          </div>
                          <div className="flex flex-col mt-1 bg-gray-800 rounded p-1">
                              <span className="text-gray-400 text-[10px] mb-0.5">میانگین مارکت کپ:</span>
                              <span className={`font-bold ${isPreviewLoading ? 'text-gray-500 animate-pulse' : 'text-green-400'}`}>
                                  {isPreviewLoading 
                                    ? 'در حال محاسبه...' 
                                    : previewAvgCap ? `$${formatCompact(previewAvgCap)}` : 'نامشخص'}
                              </span>
                          </div>
                      </div>
                  );
              })()}
              <div className="absolute top-full left-1/2 -ml-1 border-4 border-transparent border-t-gray-900"></div>
          </div>
      )}
    </div>
  );
};

export default App;