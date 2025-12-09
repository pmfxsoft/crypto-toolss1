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

const LOCAL_STORAGE_KEY = 'crypto_layout_preference_v1';
const CACHE_DURATION = 60 * 1000; // 1 minute cache validity

// Filter Interface
interface FilterState {
  search: string;
  minPrice: string;
  maxPrice: string;
  performance: 'all' | 'gainers' | 'losers';
  minCap: string;
}

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
  
  // Cache Ref
  const pageCache = useRef(new Map<string, { timestamp: number; data: CoinData[] }>());
  
  // Filter States
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    minPrice: '',
    maxPrice: '',
    performance: 'all',
    minCap: ''
  });

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

  const DISPLAY_COUNT = 9;
  // Fetch MORE to allow effective client-side filtering without emptying the page
  const FETCH_PER_PAGE = 40; 
  // Estimate for 5000+ coins.
  const TOTAL_PAGES = 100; // Limited to 100 pages to keep UI cleaner

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
  const fetchWithRetry = async (url: string, retries = 5, baseBackoff = 2500, signal?: AbortSignal): Promise<any> => {
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
            console.warn(`Rate limit (429). Retrying in ${waitTime}ms...`);
            await new Promise(r => setTimeout(r, waitTime));
            continue;
        }

        if (response.status >= 500) {
             const waitTime = baseBackoff * Math.pow(2, i);
             console.warn(`Server error (${response.status}). Retrying in ${waitTime}ms...`);
             await new Promise(r => setTimeout(r, waitTime));
             continue;
        }

        throw new Error(`HTTP Error: ${response.status}`);

      } catch (err: any) {
        if (err.name === 'AbortError' || signal?.aborted) throw err;
        if (i === retries - 1) throw err;
        
        const waitTime = baseBackoff * Math.pow(2, i);
        console.log(`Fetch attempt ${i + 1} failed. Retrying in ${waitTime}ms...`);
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
      
      const cacheKey = `page_${page}_per_${FETCH_PER_PAGE}`;
      const cached = pageCache.current.get(cacheKey);
      
      // Check Cache validity
      if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
          setCoins(cached.data);
          setLoading(false);
          return;
      }

      try {
        const data = await fetchWithRetry(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${FETCH_PER_PAGE}&page=${page}&sparkline=false&price_change_percentage=24h,7d,30d,1y`,
          5, // Increased retries
          2500, // Increased backoff
          controller.signal
        );
        
        const filteredData = data.filter((coin: CoinData) => 
            !STABLE_COINS.includes(coin.symbol.toLowerCase()) && 
            !STABLE_COINS.includes(coin.id.toLowerCase())
        );

        if (!controller.signal.aborted) {
            // Update Cache
            pageCache.current.set(cacheKey, { timestamp: Date.now(), data: filteredData });
            setCoins(filteredData);
        }
      } catch (err: any) {
        if (err.name !== 'AbortError') {
            console.error("Final Fetch Error:", err);
            setError("اتصال به سرور برقرار نشد. لطفاً چند لحظه صبر کنید و سپس دکمه تلاش مجدد را بزنید.");
        }
      } finally {
        if (!controller.signal.aborted) {
            setLoading(false);
        }
      }
    };

    fetchCoins();
    window.scrollTo({ top: 0, behavior: 'smooth' });

    return () => controller.abort();
  }, [page, retryTrigger]);

  // Derive the coins to display with Filters Applied
  const { processedCoins, finalCoins } = useMemo(() => {
    let result = coins.filter((coin) => !removedCoinIds.has(coin.id));

    // Apply Search
    if (filters.search) {
      const q = filters.search.toLowerCase();
      result = result.filter(c => c.name.toLowerCase().includes(q) || c.symbol.toLowerCase().includes(q));
    }

    // Apply Price Range
    if (filters.minPrice) {
      result = result.filter(c => c.current_price >= parseFloat(filters.minPrice));
    }
    if (filters.maxPrice) {
      result = result.filter(c => c.current_price <= parseFloat(filters.maxPrice));
    }

    // Apply Market Cap
    if (filters.minCap) {
        const cap = parseFloat(filters.minCap);
        result = result.filter(c => c.market_cap >= cap);
    }

    // Apply Performance Filter
    if (filters.performance !== 'all') {
      if (filters.performance === 'gainers') {
        result = result.filter(c => c.price_change_percentage_24h > 0);
      } else {
        result = result.filter(c => c.price_change_percentage_24h < 0);
      }
    }

    // Apply Sorting based on Performance
    // This ensures that when 'gainers' is selected, the highest gainers are shown first.
    if (filters.performance === 'gainers') {
        result.sort((a, b) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
    } else if (filters.performance === 'losers') {
        result.sort((a, b) => (a.price_change_percentage_24h || 0) - (b.price_change_percentage_24h || 0));
    }
    // If 'all', we default to API sort (Market Cap desc), so no extra sort needed unless we want to support user custom sort later.

    const sliced = result.slice(0, DISPLAY_COUNT);
    return { processedCoins: result, finalCoins: sliced };
  }, [coins, removedCoinIds, filters]);

  // Format Helpers
  const formatCurrency = (value: number) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value < 1 ? 6 : 2 }).format(value);
  };

  const formatCompact = (value: number) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', { notation: "compact", maximumFractionDigits: 2 }).format(value);
  };
  
  const getTradingViewSymbol = (coinSymbol: string) => {
    if (coinSymbol.toLowerCase() === 'usdt') return 'USDCUSDT'; 
    return `${coinSymbol.toUpperCase()}USDT`;
  };

  const getPageNumbers = () => Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);

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
    const data = { removedCoinIds: Array.from(removedCoinIds), exportedAt: new Date().toISOString() };
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
        if (json.removedCoinIds) {
          const newSet = new Set(json.removedCoinIds);
          setRemovedCoinIds(prev => {
             const merged = new Set([...Array.from(prev), ...Array.from(newSet)]);
             localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(merged)));
             return merged;
          });
          alert("بازیابی موفقیت‌آمیز بود.");
        }
      } catch (err) { alert("خطا در فایل."); }
      if (fileInputRef.current) fileInputRef.current.value = "";
    };
    reader.readAsText(file);
  };

  // Tooltip Logic
  const onPageEnter = (pageNum: number, e: React.MouseEvent) => {
      const rect = e.currentTarget.getBoundingClientRect();
      setHoveredPageInfo({ page: pageNum, rect });
      currentHoveredPageRef.current = pageNum;
      
      // Cancel previous timers and requests
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (tooltipAbortControllerRef.current) tooltipAbortControllerRef.current.abort();
      
      setPreviewAvgCap(null);
      setIsPreviewLoading(true);

      // If we already have this page loaded, calc from cache/state
      if (pageNum === page && finalCoins.length > 0) {
          const total = finalCoins.reduce((acc, c) => acc + c.market_cap, 0);
          setPreviewAvgCap(total / finalCoins.length);
          setIsPreviewLoading(false);
          return;
      }
      
      // Check cache for tooltip data too
      const cacheKey = `page_${pageNum}_per_${DISPLAY_COUNT}`;
      const cached = pageCache.current.get(cacheKey);
      if (cached && (Date.now() - cached.timestamp < CACHE_DURATION)) {
          const total = cached.data.reduce((acc, c) => acc + c.market_cap, 0);
          setPreviewAvgCap(total / cached.data.length);
          setIsPreviewLoading(false);
          return;
      }

      if (loading) return;

      hoverTimeoutRef.current = setTimeout(async () => {
          if (currentHoveredPageRef.current !== pageNum) return;
          const controller = new AbortController();
          tooltipAbortControllerRef.current = controller;
          try {
              const data = await fetchWithRetry(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${DISPLAY_COUNT}&page=${pageNum}&sparkline=false`, 1, 1500, controller.signal);
              if (currentHoveredPageRef.current === pageNum && data?.length) {
                  const filtered = data.filter((c: any) => !STABLE_COINS.includes(c.symbol.toLowerCase()));
                  // Cache this light request too
                  pageCache.current.set(cacheKey, { timestamp: Date.now(), data: filtered });
                  
                  if (filtered.length > 0) {
                      setPreviewAvgCap(filtered.reduce((acc: any, c: any) => acc + c.market_cap, 0) / filtered.length);
                  } else {
                      setPreviewAvgCap(0);
                  }
              }
          } catch (error) { setPreviewAvgCap(null); } 
          finally { if (currentHoveredPageRef.current === pageNum) setIsPreviewLoading(false); }
      }, 700); 
  };

  const onPageLeave = () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
      if (tooltipAbortControllerRef.current) tooltipAbortControllerRef.current.abort();
      currentHoveredPageRef.current = null;
      setHoveredPageInfo(null);
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 flex flex-col items-center font-sans">
      <header className="w-full bg-white shadow-sm sticky top-0 z-20 border-b border-gray-200">
        <div className="px-4 py-3 flex flex-col xl:flex-row items-center justify-between max-w-full mx-auto gap-4 xl:gap-0">
          <div className="flex items-center">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 mr-4">بازار ارزهای دیجیتال</h1>
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">صفحه {page} از {TOTAL_PAGES}</span>
          </div>

          <div className="flex flex-col md:flex-row items-center gap-4">
            {/* Action Buttons */}
            <div className="flex items-center gap-2">
                 <input type="file" ref={fileInputRef} onChange={handleImportBackup} accept=".json" className="hidden" />
                 
                 <button onClick={handleSaveLayout} className="flex items-center gap-1 bg-green-50 hover:bg-green-100 text-green-700 px-3 py-1.5 rounded-lg border border-green-200 text-sm font-medium transition-colors">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/></svg>
                    <span>ذخیره چیدمان</span>
                 </button>

                 <button onClick={handleResetLayout} className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-700 px-3 py-1.5 rounded-lg border border-red-200 text-sm font-medium transition-colors">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 3v5h5M3.05 13A9 9 0 1 0 6 5.3L3 8"/></svg>
                    <span>بازنشانی</span>
                 </button>

                 <div className="h-6 w-px bg-gray-300 mx-1"></div>

                 <button onClick={handleExportBackup} className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-md border border-gray-200" title="Export">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>
                 </button>
                 <button onClick={() => fileInputRef.current?.click()} className="p-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-md border border-gray-200" title="Import">
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M17 8l-5-5-5 5M12 3v12"/></svg>
                 </button>
            </div>

            {/* Filter Toggle */}
            <button 
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-sm font-medium transition-colors ${showFilters ? 'bg-indigo-50 border-indigo-200 text-indigo-700' : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'}`}
            >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon></svg>
                <span>فیلترها</span>
            </button>

            {/* Timeframe */}
            <div className="flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200 overflow-x-auto">
                {TIMEFRAMES.map((tf) => (
                    <button key={tf.value} onClick={() => setInterval(tf.value)} className={`px-3 py-1 rounded-md text-sm font-medium whitespace-nowrap ${interval === tf.value ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>{tf.label}</button>
                ))}
            </div>

            {/* Scale */}
            <div className="inline-flex items-center bg-gray-100 p-1 rounded-lg border border-gray-200">
                <span className={`cursor-pointer px-3 py-1 rounded-md text-sm font-medium ${isLogScale ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500'}`} onClick={() => setIsLogScale(true)}>لگاریتمی</span>
                <span className={`cursor-pointer px-3 py-1 rounded-md text-sm font-medium ${!isLogScale ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500'}`} onClick={() => setIsLogScale(false)}>خطی</span>
            </div>
          </div>
        </div>

        {/* Filter Panel */}
        {showFilters && (
            <div className="border-t border-gray-200 bg-gray-50 px-4 py-4 animate-in slide-in-from-top-2 duration-200">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4 max-w-7xl mx-auto">
                    {/* Search */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">جستجو (نام/نماد)</label>
                        <div className="relative">
                            <input 
                                type="text" 
                                placeholder="BTC, Ethereum..." 
                                value={filters.search}
                                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                                className="w-full pl-3 pr-8 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                            />
                            <svg className="w-4 h-4 text-gray-400 absolute right-2.5 top-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                        </div>
                    </div>

                    {/* Performance */}
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">روند ۲۴ ساعته</label>
                        <select 
                            value={filters.performance}
                            onChange={(e) => setFilters(prev => ({ ...prev, performance: e.target.value as any }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        >
                            <option value="all">همه</option>
                            <option value="gainers">صعودی (Gainers) - بیشترین رشد</option>
                            <option value="losers">نزولی (Losers) - بیشترین ریزش</option>
                        </select>
                    </div>

                    {/* Price Range */}
                    <div className="grid grid-cols-2 gap-2">
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">حداقل قیمت ($)</label>
                            <input 
                                type="number" 
                                placeholder="0" 
                                value={filters.minPrice}
                                onChange={(e) => setFilters(prev => ({ ...prev, minPrice: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 text-sm"
                            />
                        </div>
                        <div>
                            <label className="block text-xs font-semibold text-gray-500 mb-1">حداکثر قیمت ($)</label>
                            <input 
                                type="number" 
                                placeholder="Max" 
                                value={filters.maxPrice}
                                onChange={(e) => setFilters(prev => ({ ...prev, maxPrice: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 text-sm"
                            />
                        </div>
                    </div>

                    {/* Market Cap Filter */}
                     <div>
                        <label className="block text-xs font-semibold text-gray-500 mb-1">مارکت کپ</label>
                        <select 
                            value={filters.minCap}
                            onChange={(e) => setFilters(prev => ({ ...prev, minCap: e.target.value }))}
                            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        >
                            <option value="">همه</option>
                            <option value="1000000000">بالای ۱ میلیارد دلار</option>
                            <option value="100000000">بالای ۱۰۰ میلیون دلار</option>
                            <option value="10000000">بالای ۱۰ میلیون دلار</option>
                        </select>
                    </div>
                </div>
                
                {/* Filter Stats & Actions */}
                <div className="max-w-7xl mx-auto mt-4 pt-3 border-t border-gray-200 flex flex-col md:flex-row justify-between items-center gap-2">
                    <div className="text-xs text-gray-600 bg-white px-3 py-1.5 rounded-full border border-gray-200 shadow-sm flex items-center gap-2">
                         <span className="font-bold text-indigo-600">{coins.length}</span> ارز بارگذاری شده
                         <span className="text-gray-300">|</span>
                         <span className="font-bold text-indigo-600">{processedCoins.length}</span> ارز منطبق با فیلتر
                         <span className="text-gray-300">|</span>
                         <span className="font-bold text-indigo-600">{finalCoins.length}</span> ارز در حال نمایش
                    </div>
                    
                    <button 
                        onClick={() => setFilters({ search: '', minPrice: '', maxPrice: '', performance: 'all', minCap: '' })}
                        className="text-xs text-red-600 hover:text-red-800 font-medium px-3 py-1"
                    >
                        پاک کردن فیلترها
                    </button>
                </div>
            </div>
        )}
      </header>

      <main className="w-full flex-grow p-4">
        {error && (
          <div className="w-full max-w-2xl mx-auto mt-10 p-4 bg-red-100 text-red-700 rounded-lg text-center border border-red-200">
            <p className="font-bold mb-2">خطا در دریافت اطلاعات</p>
            <p className="text-sm mb-4">{error}</p>
            <button onClick={() => setRetryTrigger(prev => prev + 1)} className="text-sm px-6 py-2 bg-white text-red-700 font-bold rounded shadow-sm hover:bg-red-50 border border-red-200">تلاش مجدد</button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center h-[80vh]">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-500 animate-pulse">در حال دریافت داده‌های بازار...</p>
          </div>
        ) : (
          <>
            {finalCoins.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-gray-500">
                    <svg className="w-16 h-16 mb-4 text-gray-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                    <p className="text-lg font-medium">هیچ ارزی با این فیلترها در این صفحه یافت نشد.</p>
                    <p className="text-sm mt-2">لطفاً فیلترها را تغییر دهید یا به صفحه دیگری بروید.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 w-full">
                    {finalCoins.map((coin) => {
                    const recoveryToAth = coin.current_price && coin.ath ? ((coin.ath - coin.current_price) / coin.current_price) * 100 : 0;
                    const chartContainerId = `chart-container-${coin.id}`;

                    return (
                    <div key={coin.id} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col aspect-square relative group">
                        <button onClick={(e) => { e.stopPropagation(); removeCoin(coin.id); }} className="absolute top-2 right-2 bg-white/90 hover:bg-red-50 text-gray-400 hover:text-red-500 p-1.5 rounded-full opacity-0 group-hover:opacity-100 transition-all duration-200 z-30 shadow-sm border border-transparent hover:border-red-100">
                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
                        </button>

                        <div className="p-4 border-b border-gray-200 bg-white flex-shrink-0">
                            <div className="flex justify-between items-start mb-4">
                                <div className="flex items-center gap-3">
                                    <div className="flex flex-col items-center justify-center bg-gray-100 w-12 h-12 rounded-full border border-gray-200"><span className="text-sm font-bold text-gray-500">#{coin.market_cap_rank}</span></div>
                                    <img src={coin.image} alt={coin.name} className="w-10 h-10 rounded-full" />
                                    <div><h2 className="text-lg font-bold text-gray-900 leading-tight">{coin.name}</h2><span className="text-sm text-gray-500 font-semibold uppercase">{coin.symbol}</span></div>
                                </div>
                                <div className="text-right pr-8">
                                    <div className="text-2xl font-extrabold text-gray-900 font-mono tracking-tight">{formatCurrency(coin.current_price)}</div>
                                    <div className={`text-sm font-bold ${getPercentClass(coin.price_change_percentage_24h)}`}>{coin.price_change_percentage_24h?.toFixed(2)}% (24h)</div>
                                </div>
                            </div>

                            <div className="grid grid-cols-5 gap-1 text-center text-xs mb-4 bg-gray-50 p-2 rounded-lg border border-gray-100">
                                <div className="flex flex-col"><span className="text-gray-400 mb-1">7d</span><span className={`font-bold text-sm ${getPercentClass(coin.price_change_percentage_7d_in_currency)}`}>{coin.price_change_percentage_7d_in_currency?.toFixed(2)}%</span></div>
                                <div className="flex flex-col border-l border-gray-200 pl-1"><span className="text-gray-400 mb-1">30d</span><span className={`font-bold text-sm ${getPercentClass(coin.price_change_percentage_30d_in_currency)}`}>{coin.price_change_percentage_30d_in_currency?.toFixed(2)}%</span></div>
                                <div className="flex flex-col border-l border-gray-200 pl-1"><span className="text-gray-400 mb-1">1y</span><span className={`font-bold text-sm ${getPercentClass(coin.price_change_percentage_1y_in_currency)}`}>{coin.price_change_percentage_1y_in_currency?.toFixed(2)}%</span></div>
                                <div className="flex flex-col border-l border-gray-200 pl-1"><span className="text-gray-400 mb-1">ATH</span><span className={`font-bold text-sm ${getPercentClass(coin.ath_change_percentage)}`}>{coin.ath_change_percentage?.toFixed(1)}%</span></div>
                                <div className="flex flex-col border-l border-gray-200 pl-1"><span className="text-gray-400 mb-1 font-medium">To ATH</span><span className="font-bold text-sm text-green-600">+{recoveryToAth.toFixed(1)}%</span></div>
                            </div>

                            <div className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
                                <div className="flex justify-between items-center border-b border-gray-50 pb-2"><span className="text-gray-500">Market Cap</span><span className="font-bold text-gray-900">${formatCompact(coin.market_cap)}</span></div>
                                <div className="flex justify-between items-center border-b border-gray-50 pb-2"><span className="text-gray-500">Volume (24h)</span><span className="font-bold text-gray-900">${formatCompact(coin.total_volume)}</span></div>
                                <div className="flex justify-between items-center border-b border-gray-50 pb-2"><span className="text-gray-500">High (24h)</span><span className="font-bold text-gray-900">{formatCurrency(coin.high_24h)}</span></div>
                                <div className="flex justify-between items-center border-b border-gray-50 pb-2"><span className="text-gray-500">Low (24h)</span><span className="font-bold text-gray-900">{formatCurrency(coin.low_24h)}</span></div>
                            </div>
                        </div>

                        <div id={chartContainerId} className="flex-grow bg-white relative w-full overflow-hidden border-t border-gray-100 group">
                            <TradingViewWidget isLogScale={isLogScale} symbol={getTradingViewSymbol(coin.symbol)} interval={interval} />
                            <button onClick={() => toggleFullscreen(chartContainerId)} className="absolute top-2 right-2 bg-white bg-opacity-90 hover:bg-opacity-100 p-1.5 rounded-md shadow-md border border-gray-200 text-gray-600 hover:text-blue-600 opacity-0 group-hover:opacity-100 transition-all duration-200 z-10"><svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="15 3 21 3 21 9"></polyline><polyline points="9 21 3 21 3 15"></polyline><line x1="21" y1="3" x2="14" y2="10"></line><line x1="3" y1="21" x2="10" y2="14"></line></svg></button>
                        </div>
                    </div>
                    )})}
                </div>
            )}
          </>
        )}
      </main>
      
      <footer className="w-full bg-white border-t border-gray-200 p-4 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="flex flex-col gap-4">
            <div className="flex items-center gap-1 overflow-x-auto w-full px-2 pb-2" style={{ scrollbarWidth: 'thin' }}>
              {getPageNumbers().map((p) => (
                <button key={p} onClick={() => setPage(p)} onMouseEnter={(e) => onPageEnter(p, e)} onMouseLeave={onPageLeave} disabled={loading} className={`w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-md text-sm font-medium transition-colors border ${p === page ? 'bg-blue-600 text-white border-blue-600 shadow-md' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-100 hover:border-gray-300'}`}>{p}</button>
              ))}
            </div>
             <div className="flex justify-between items-center text-sm text-gray-500 px-2">
                 <span>نمایش {Math.min((page - 1) * DISPLAY_COUNT + 1, TOTAL_PAGES * DISPLAY_COUNT)} تا {Math.min(page * DISPLAY_COUNT, TOTAL_PAGES * DISPLAY_COUNT)} (تخمینی)</span>
                 <div className="flex gap-2">
                     <button disabled={page === 1 || loading} onClick={() => setPage(p => Math.max(1, p - 1))} className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">قبلی</button>
                     <button disabled={page === TOTAL_PAGES || loading} onClick={() => setPage(p => Math.min(TOTAL_PAGES, p + 1))} className="px-3 py-1 bg-white border border-gray-300 rounded hover:bg-gray-50 disabled:opacity-50">بعدی</button>
                 </div>
             </div>
        </div>
      </footer>

      {hoveredPageInfo && (
          <div className="fixed z-50 bg-gray-900 text-white text-xs rounded px-3 py-2 shadow-xl border border-gray-700 pointer-events-none" style={{ top: `${hoveredPageInfo.rect.top - 70}px`, left: `${hoveredPageInfo.rect.left + (hoveredPageInfo.rect.width / 2)}px`, transform: 'translateX(-50%)', minWidth: '160px' }}>
               <div className="flex flex-col gap-1 text-center">
                  <div className="font-bold text-yellow-400 mb-1 border-b border-gray-700 pb-1">صفحه {hoveredPageInfo.page}</div>
                  <div className="flex flex-col mt-1 bg-gray-800 rounded p-1">
                      <span className="text-gray-400 text-[10px] mb-0.5">میانگین مارکت کپ:</span>
                      <span className={`font-bold ${isPreviewLoading ? 'text-gray-500 animate-pulse' : 'text-green-400'}`}>{isPreviewLoading ? 'در حال محاسبه...' : previewAvgCap ? `$${formatCompact(previewAvgCap)}` : 'نامشخص'}</span>
                  </div>
              </div>
              <div className="absolute top-full left-1/2 -ml-1 border-4 border-transparent border-t-gray-900"></div>
          </div>
      )}
    </div>
  );
};

export default App;