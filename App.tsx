import React, { useState, useEffect, useRef, useMemo } from 'react';
import TradingViewWidget from './components/TradingViewWidget';
import { auth, db } from './firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

// --- Types ---
type Category = 'CRYPTO' | 'FOREX' | 'STOCKS';

interface AssetData {
  id: string;
  symbol: string;
  name: string;
  type: Category;
  image?: string;
  // Optional Stats (Available mostly for Crypto via CoinGecko)
  current_price?: number;
  market_cap?: number;
  market_cap_rank?: number;
  total_volume?: number;
  price_change_percentage_24h?: number;
  price_change_percentage_7d_in_currency?: number;
  price_change_percentage_30d_in_currency?: number;
  price_change_percentage_1y_in_currency?: number;
  ath?: number;
  ath_change_percentage?: number;
  high_24h?: number;
  low_24h?: number;
}

// --- Constants & Data ---

// List of stablecoins to exclude (Crypto only)
const STABLE_COINS = [
  'usdt', 'usdc', 'dai', 'fdusd', 'tusd', 'usdd', 
  'pyusd', 'usde', 'frax', 'busd', 'gusd', 'usdp', 
  'eurs', 'lusd', 'susd', 'usds', 'crvusd', 'mim', 
  'alusd', 'dola', 'fei', 'ustc', 'gemini-dollar'
];

// Forex Pairs List
const FOREX_PAIRS: AssetData[] = [
  { id: 'fx-eurusd', symbol: 'EURUSD', name: 'Euro / US Dollar', type: 'FOREX' },
  { id: 'fx-gbpusd', symbol: 'GBPUSD', name: 'British Pound / US Dollar', type: 'FOREX' },
  { id: 'fx-usdjpy', symbol: 'USDJPY', name: 'US Dollar / Japanese Yen', type: 'FOREX' },
  { id: 'fx-usdchf', symbol: 'USDCHF', name: 'US Dollar / Swiss Franc', type: 'FOREX' },
  { id: 'fx-audusd', symbol: 'AUDUSD', name: 'Australian Dollar / US Dollar', type: 'FOREX' },
  { id: 'fx-usdcad', symbol: 'USDCAD', name: 'US Dollar / Canadian Dollar', type: 'FOREX' },
  { id: 'fx-nzdusd', symbol: 'NZDUSD', name: 'New Zealand Dollar / US Dollar', type: 'FOREX' },
  { id: 'fx-eurgbp', symbol: 'EURGBP', name: 'Euro / British Pound', type: 'FOREX' },
  { id: 'fx-eurjpy', symbol: 'EURJPY', name: 'Euro / Japanese Yen', type: 'FOREX' },
  { id: 'fx-gbpjpy', symbol: 'GBPJPY', name: 'British Pound / Japanese Yen', type: 'FOREX' },
  { id: 'fx-chfjpy', symbol: 'CHFJPY', name: 'Swiss Franc / Japanese Yen', type: 'FOREX' },
  { id: 'fx-audjpy', symbol: 'AUDJPY', name: 'Australian Dollar / Japanese Yen', type: 'FOREX' },
  { id: 'fx-cadjpy', symbol: 'CADJPY', name: 'Canadian Dollar / Japanese Yen', type: 'FOREX' },
  { id: 'fx-euraud', symbol: 'EURAUD', name: 'Euro / Australian Dollar', type: 'FOREX' },
  { id: 'fx-eurchf', symbol: 'EURCHF', name: 'Euro / Swiss Franc', type: 'FOREX' },
  { id: 'fx-gbpchf', symbol: 'GBPCHF', name: 'British Pound / Swiss Franc', type: 'FOREX' },
  { id: 'fx-xauusd', symbol: 'XAUUSD', name: 'Gold / US Dollar', type: 'FOREX' },
  { id: 'fx-xagusd', symbol: 'XAGUSD', name: 'Silver / US Dollar', type: 'FOREX' },
];

// US Stocks List
const US_STOCKS: AssetData[] = [
  { id: 'st-bynd', symbol: 'NASDAQ:BYND', name: 'Beyond Meat', type: 'STOCKS' },
  { id: 'st-rivn', symbol: 'NASDAQ:RIVN', name: 'Rivian', type: 'STOCKS' },
  { id: 'st-plug', symbol: 'NASDAQ:PLUG', name: 'Plug Power', type: 'STOCKS' },
  { id: 'st-riot', symbol: 'NASDAQ:RIOT', name: 'Riot Platforms', type: 'STOCKS' },
  { id: 'st-trip', symbol: 'NASDAQ:TRIP', name: 'Tripadvisor', type: 'STOCKS' },
  { id: 'st-coin', symbol: 'NASDAQ:COIN', name: 'Coinbase', type: 'STOCKS' },
  { id: 'st-dbx', symbol: 'NASDAQ:DBX', name: 'Dropbox', type: 'STOCKS' },
  { id: 'st-nvax', symbol: 'NASDAQ:NVAX', name: 'Novavax', type: 'STOCKS' },
  { id: 'st-pep', symbol: 'NASDAQ:PEP', name: 'PepsiCo', type: 'STOCKS' },
  { id: 'st-msft', symbol: 'NASDAQ:MSFT', name: 'Microsoft', type: 'STOCKS' },
  { id: 'st-iq', symbol: 'NASDAQ:IQ', name: 'iQIYI', type: 'STOCKS' },
  { id: 'st-wb', symbol: 'NASDAQ:WB', name: 'Weibo', type: 'STOCKS' },
  { id: 'st-intc', symbol: 'NASDAQ:INTC', name: 'Intel', type: 'STOCKS' },
  { id: 'st-docu', symbol: 'NASDAQ:DOCU', name: 'DocuSign', type: 'STOCKS' },
  { id: 'st-rost', symbol: 'NASDAQ:ROST', name: 'Ross Stores', type: 'STOCKS' },
  { id: 'st-wmt', symbol: 'NYSE:WMT', name: 'Walmart', type: 'STOCKS' },
  { id: 'st-pdd', symbol: 'NASDAQ:PDD', name: 'PDD Holdings', type: 'STOCKS' },
  { id: 'st-jd', symbol: 'NASDAQ:JD', name: 'JD.com', type: 'STOCKS' },
  { id: 'st-mrna', symbol: 'NASDAQ:MRNA', name: 'Moderna', type: 'STOCKS' },
  { id: 'st-qcom', symbol: 'NASDAQ:QCOM', name: 'Qualcomm', type: 'STOCKS' },
  { id: 'st-li', symbol: 'NASDAQ:LI', name: 'Li Auto', type: 'STOCKS' },
  { id: 'st-agnc', symbol: 'NASDAQ:AGNC', name: 'AGNC Investment', type: 'STOCKS' },
  { id: 'st-dkng', symbol: 'NASDAQ:DKNG', name: 'DraftKings', type: 'STOCKS' },
  { id: 'st-bkng', symbol: 'NASDAQ:BKNG', name: 'Booking Holdings', type: 'STOCKS' },
  { id: 'st-tsla', symbol: 'NASDAQ:TSLA', name: 'Tesla', type: 'STOCKS' },
  { id: 'st-expe', symbol: 'NASDAQ:EXPE', name: 'Expedia', type: 'STOCKS' },
  { id: 'st-pypl', symbol: 'NASDAQ:PYPL', name: 'PayPal', type: 'STOCKS' },
  { id: 'st-amzn', symbol: 'NASDAQ:AMZN', name: 'Amazon', type: 'STOCKS' },
  { id: 'st-lcid', symbol: 'NASDAQ:LCID', name: 'Lucid Group', type: 'STOCKS' },
  { id: 'st-amd', symbol: 'NASDAQ:AMD', name: 'AMD', type: 'STOCKS' },
  { id: 'st-mdlz', symbol: 'NASDAQ:MDLZ', name: 'Mondelez', type: 'STOCKS' },
  { id: 'st-amgn', symbol: 'NASDAQ:AMGN', name: 'Amgen', type: 'STOCKS' },
  { id: 'st-cvac', symbol: 'NASDAQ:CVAC', name: 'CureVac', type: 'STOCKS' },
  { id: 'st-nflx', symbol: 'NASDAQ:NFLX', name: 'Netflix', type: 'STOCKS' },
  { id: 'st-goog', symbol: 'NASDAQ:GOOG', name: 'Alphabet', type: 'STOCKS' },
  { id: 'st-meta', symbol: 'NASDAQ:META', name: 'Meta', type: 'STOCKS' },
  { id: 'st-zm', symbol: 'NASDAQ:ZM', name: 'Zoom', type: 'STOCKS' },
  { id: 'st-pool', symbol: 'NASDAQ:POOL', name: 'Pool Corp', type: 'STOCKS' },
  { id: 'st-adbe', symbol: 'NASDAQ:ADBE', name: 'Adobe', type: 'STOCKS' },
  { id: 'st-aal', symbol: 'NASDAQ:AAL', name: 'American Airlines', type: 'STOCKS' },
  { id: 'st-lrcx', symbol: 'NASDAQ:LRCX', name: 'Lam Research', type: 'STOCKS' },
  { id: 'st-avgo', symbol: 'NASDAQ:AVGO', name: 'Broadcom', type: 'STOCKS' },
  { id: 'st-bidu', symbol: 'NASDAQ:BIDU', name: 'Baidu', type: 'STOCKS' },
  { id: 'st-panw', symbol: 'NASDAQ:PANW', name: 'Palo Alto', type: 'STOCKS' },
  { id: 'st-csco', symbol: 'NASDAQ:CSCO', name: 'Cisco', type: 'STOCKS' },
  { id: 'st-intu', symbol: 'NASDAQ:INTU', name: 'Intuit', type: 'STOCKS' },
  { id: 'st-gild', symbol: 'NASDAQ:GILD', name: 'Gilead', type: 'STOCKS' },
  { id: 'st-sbux', symbol: 'NASDAQ:SBUX', name: 'Starbucks', type: 'STOCKS' },
  { id: 'st-nvda', symbol: 'NASDAQ:NVDA', name: 'NVIDIA', type: 'STOCKS' },
  { id: 'st-cost', symbol: 'NASDAQ:COST', name: 'Costco', type: 'STOCKS' },
  { id: 'st-okta', symbol: 'NASDAQ:OKTA', name: 'Okta', type: 'STOCKS' },
  { id: 'st-amat', symbol: 'NASDAQ:AMAT', name: 'Applied Materials', type: 'STOCKS' },
  { id: 'st-cme', symbol: 'NASDAQ:CME', name: 'CME Group', type: 'STOCKS' },
  { id: 'st-aapl', symbol: 'NASDAQ:AAPL', name: 'Apple', type: 'STOCKS' },
  { id: 'st-adp', symbol: 'NASDAQ:ADP', name: 'ADP', type: 'STOCKS' },
  { id: 'st-ebay', symbol: 'NASDAQ:EBAY', name: 'eBay', type: 'STOCKS' },
  { id: 'st-ea', symbol: 'NASDAQ:EA', name: 'Electronic Arts', type: 'STOCKS' },
];

const TIMEFRAMES = [
  { label: '15m', value: '15' },
  { label: '1H', value: '60' },
  { label: '4H', value: '240' },
  { label: '1D', value: 'D' },
  { label: '1W', value: 'W' },
  { label: '1M', value: '1M' },
];

const FETCH_LIMIT_OPTIONS = [100, 500, 1000, 1500, 2000, 5000];
const PAGE_SIZE_OPTIONS = [15, 30, 45, 60, 90];

const LOCAL_STORAGE_KEY = 'crypto_layout_preference_v1';
const DATA_CACHE_PREFIX = 'crypto_data_cache_v3_'; 

// Lazy Load Wrapper
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
            }, 1000);
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
  const [activeCategory, setActiveCategory] = useState<Category>('CRYPTO');
  const [isLogScale, setIsLogScale] = useState(true);
  const [interval, setInterval] = useState("1M");
  
  // Assets
  const [assets, setAssets] = useState<AssetData[]>([]);
  
  // User Preferences
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  
  // Fetch Config (Crypto only)
  const [fetchLimit, setFetchLimit] = useState(1500); 
  const [loading, setLoading] = useState(false);
  const [loadingProgress, setLoadingProgress] = useState<string>('');
  const [error, setError] = useState<string | null>(null);
  const [retryTrigger, setRetryTrigger] = useState(0);
  
  // UI Filters
  const [user, setUser] = useState<any>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
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
                  setRemovedIds(prev => {
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
                    setRemovedIds(new Set(data.removedCoinIds));
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

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [fetchLimit, showFavoritesOnly, searchQuery, assets.length, activeCategory]);

  // Scroll top
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

  const minifyAndCacheData = (key: string, data: AssetData[]) => {
      try {
          const minified = data.map(coin => ({
             ...coin
          }));
          localStorage.setItem(key, JSON.stringify({ timestamp: Date.now(), data: minified }));
      } catch (e) { console.warn("Quota Exceeded"); }
  };

  useEffect(() => {
    // 1. Handle non-crypto categories (Instant load)
    if (activeCategory === 'FOREX') {
        setAssets(FOREX_PAIRS);
        setLoading(false);
        setError(null);
        return;
    }
    if (activeCategory === 'STOCKS') {
        setAssets(US_STOCKS);
        setLoading(false);
        setError(null);
        return;
    }

    // 2. Handle Crypto Fetching
    const controller = new AbortController();
    const fetchCoins = async () => {
      setError(null);
      setLoadingProgress('');
      const cacheKey = `${DATA_CACHE_PREFIX}${fetchLimit}`;
      let usedCache = false;

      // Try Cache
      try {
          const stored = localStorage.getItem(cacheKey);
          if (stored) {
              const { timestamp, data } = JSON.parse(stored);
              if (Array.isArray(data) && data.length > 0) {
                  setAssets(data as AssetData[]);
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
        const accumulatedCoins: AssetData[] = [];
        
        for (let i = 1; i <= batchesNeeded; i++) {
            if (controller.signal.aborted) break;
            if (!usedCache) setLoadingProgress(`در حال دریافت بخش ${i} از ${batchesNeeded}...`);

            try {
                const batchData = await fetchWithRetry(
                    `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${BATCH_SIZE}&page=${i}&sparkline=false&price_change_percentage=24h,7d,30d,1y`,
                    3, 2000, controller.signal
                );
                
                if (batchData && Array.isArray(batchData)) {
                    const mapped: AssetData[] = batchData.map((c: any) => ({
                        ...c,
                        type: 'CRYPTO'
                    }));
                    accumulatedCoins.push(...mapped);
                }
            } catch (batchError) {
                if (accumulatedCoins.length > 0) break;
                else throw batchError;
            }
            if (i < batchesNeeded) await new Promise(r => setTimeout(r, 1200)); 
        }

        if (!controller.signal.aborted) {
            const filteredData = accumulatedCoins.filter((coin) => 
                !STABLE_COINS.includes(coin.symbol.toLowerCase()) && 
                !STABLE_COINS.includes(coin.id.toLowerCase())
            );

            if (filteredData.length > 0) {
                setAssets(filteredData);
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
  }, [activeCategory, fetchLimit, retryTrigger]);

  // --- Filtering & Pagination ---
  const { paginatedAssets, totalPages, totalCount } = useMemo(() => {
    let result = assets.filter((a) => !removedIds.has(a.id));

    if (showFavoritesOnly) {
        result = result.filter(a => favorites.has(a.id));
    }

    if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        result = result.filter(a => 
            a.symbol.toLowerCase().includes(query) || 
            a.name.toLowerCase().includes(query)
        );
    }

    const totalCount = result.length;
    const totalPages = Math.ceil(totalCount / pageSize);

    const startIndex = (currentPage - 1) * pageSize;
    const paginatedAssets = result.slice(startIndex, startIndex + pageSize);
    
    return { paginatedAssets, totalPages, totalCount };
  }, [assets, removedIds, favorites, showFavoritesOnly, searchQuery, currentPage, pageSize]);

  // --- Helpers ---
  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: value < 1 ? 6 : 2 }).format(value);
  };
  
  const formatCompact = (value?: number) => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD',
        notation: "compact",
        maximumFractionDigits: 1
    }).format(value);
  };

  const getTradingViewSymbol = (asset: AssetData) => {
    if (asset.type === 'CRYPTO') {
        if (asset.symbol.toLowerCase() === 'usdt') return 'USDCUSDT';
        return `${asset.symbol.toUpperCase()}USDT`;
    }
    // For Stocks and Forex, we usually rely on the symbol provided in the list (e.g., NASDAQ:AAPL or EURUSD)
    return asset.symbol;
  };

  const getPercentClass = (val?: number) => {
      if (val === undefined || val === null) return 'text-gray-400';
      if (val === 0) return 'text-gray-500';
      return val > 0 ? 'text-green-600' : 'text-red-600';
  };

  const fmtPct = (val?: number) => {
      if (val === undefined || val === null) return '-';
      return `${val > 0 ? '+' : ''}${val.toFixed(1)}%`;
  };

  const toggleFullscreen = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (document.fullscreenElement) document.exitFullscreen();
    else el.requestFullscreen().catch(() => {});
  };

  const removeAsset = async (id: string) => {
    setRemovedIds((prev) => {
      const newSet = new Set(prev);
      newSet.add(id);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(newSet)));
      if (user) {
          const userDocRef = doc(db, 'users', user.uid);
          setDoc(userDocRef, { removedCoinIds: Array.from(newSet) }, { merge: true });
      }
      return newSet;
    });
  };

  const toggleFavorite = (id: string) => {
      setFavorites(prev => {
          const newSet = new Set(prev);
          if (newSet.has(id)) newSet.delete(id);
          else newSet.add(id);
          localStorage.setItem('crypto_favorites_v1', JSON.stringify(Array.from(newSet)));
          if (user) {
              const userDocRef = doc(db, 'users', user.uid);
              setDoc(userDocRef, { favorites: Array.from(newSet) }, { merge: true });
          }
          return newSet;
      });
  };

  const handleSaveLayout = () => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(removedIds)));
    alert("چیدمان فعلی ذخیره شد.");
  };

  const handleResetLayout = () => {
      if (window.confirm("بازنشانی کامل؟")) {
          setRemovedIds(new Set());
          localStorage.removeItem(LOCAL_STORAGE_KEY);
      }
  };

  const handleExportBackup = () => {
    const data = { removedCoinIds: Array.from(removedIds), favorites: Array.from(favorites), exportedAt: new Date().toISOString() };
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
        if (json.removedCoinIds) setRemovedIds(new Set(json.removedCoinIds));
        if (json.favorites) setFavorites(new Set(json.favorites));
        alert("Backup restored!");
      } catch (err) { alert("Invalid file"); }
    };
    reader.readAsText(file);
  };

  const getImage = (asset: AssetData) => {
      if (asset.image) return asset.image;
      if (asset.type === 'FOREX') return 'https://img.icons8.com/color/48/currency-exchange.png';
      if (asset.type === 'STOCKS') return 'https://img.icons8.com/color/48/bullish.png';
      return '';
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
                بازار مالی
              </h1>

              {/* Category Tabs */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
                <button 
                  onClick={() => setActiveCategory('CRYPTO')} 
                  className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${activeCategory === 'CRYPTO' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  کریپتو
                </button>
                <button 
                  onClick={() => setActiveCategory('FOREX')} 
                  className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${activeCategory === 'FOREX' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  فارکس
                </button>
                <button 
                  onClick={() => setActiveCategory('STOCKS')} 
                  className={`px-4 py-1.5 rounded-md text-sm font-semibold transition-all ${activeCategory === 'STOCKS' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  بورس آمریکا
                </button>
              </div>
              
              {/* Search Box */}
              <div className="relative w-full md:w-56">
                <input 
                    type="text" 
                    placeholder="جستجو..." 
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
                {showFavoritesOnly ? '★' : '☆'}
              </button>

              <div className="h-6 w-px bg-gray-300 hidden md:block" />
              
              {/* Fetch Limit Selector (Only relevant for Crypto) */}
              {activeCategory === 'CRYPTO' && (
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
              )}

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
                  {paginatedAssets.map((asset) => {
                      const hasDetails = asset.type === 'CRYPTO';
                      // Calculate "To ATH" percentage if applicable
                      const toAth = asset.ath && asset.current_price ? ((asset.ath - asset.current_price) / asset.current_price) * 100 : 0;
                      
                      return (
                    <div 
                      id={`card-${asset.id}`}
                      key={asset.id} 
                      style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 500px' }}
                      className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col aspect-square transition-all hover:shadow-md"
                    >
                      {/* 1. Header */}
                      <div className="px-3 py-2 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
                        <div className="flex items-center gap-2">
                          <img src={getImage(asset)} alt={asset.name} className="w-8 h-8 rounded-full object-contain" loading="lazy" />
                          <div>
                            <div className="flex items-center gap-1.5">
                               <h3 className="font-bold text-gray-800 text-lg">{asset.symbol.split(':').pop()?.toUpperCase()}</h3>
                               {hasDetails && (
                                 <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-medium">#{asset.market_cap_rank}</span>
                               )}
                               {!hasDetails && (
                                 <span className="text-[10px] text-gray-400 bg-gray-50 px-1 py-0.5 rounded uppercase">{asset.type}</span>
                               )}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center">
                          <button 
                            onClick={() => toggleFavorite(asset.id)}
                            className={`p-1.5 rounded-lg hover:bg-gray-100 transition-colors ${favorites.has(asset.id) ? 'text-yellow-400' : 'text-gray-300'}`}
                          >
                             <span className="text-xl">★</span>
                          </button>
                          <button 
                            onClick={() => toggleFullscreen(`card-${asset.id}`)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                          >
                            <span className="text-xl">⛶</span>
                          </button>
                          <button 
                            onClick={() => removeAsset(asset.id)}
                            className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                          >
                            <span className="text-xl">✕</span>
                          </button>
                        </div>
                      </div>

                      {/* 2. Primary Stats (Price & 24h) - Only if details available */}
                      {hasDetails && (
                          <div className="px-4 py-2 bg-gray-50 flex justify-between items-center border-b border-gray-100 shrink-0">
                             <div className="flex items-center gap-1">
                                <span className="text-gray-800 font-bold text-xl">{formatCurrency(asset.current_price)}</span>
                             </div>
                             <div className="flex items-center gap-1">
                                <span className={`font-bold text-sm ${getPercentClass(asset.price_change_percentage_24h)} dir-ltr`}>
                                    {fmtPct(asset.price_change_percentage_24h)} (24h)
                                </span>
                             </div>
                          </div>
                      )}

                      {/* 3. Detailed Stats Grid - Only if details available */}
                      {hasDetails && (
                          <div className="grid grid-cols-3 gap-x-2 gap-y-1 p-3 text-xs bg-white border-b border-gray-100 text-gray-600 shrink-0">
                              {/* Column 1: Historical Changes */}
                              <div className="flex flex-col gap-1">
                                  <div className="flex justify-between">
                                      <span>7d:</span>
                                      <span className={getPercentClass(asset.price_change_percentage_7d_in_currency)}>{fmtPct(asset.price_change_percentage_7d_in_currency)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                      <span>30d:</span>
                                      <span className={getPercentClass(asset.price_change_percentage_30d_in_currency)}>{fmtPct(asset.price_change_percentage_30d_in_currency)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                      <span>1y:</span>
                                      <span className={getPercentClass(asset.price_change_percentage_1y_in_currency)}>{fmtPct(asset.price_change_percentage_1y_in_currency)}</span>
                                  </div>
                              </div>

                              {/* Column 2: ATH Data */}
                              <div className="flex flex-col gap-1 border-l border-gray-100 pl-2">
                                  <div className="flex justify-between" title="All Time High Price">
                                      <span>ATH:</span>
                                      <span className="text-gray-700">{formatCompact(asset.ath)}</span>
                                  </div>
                                  <div className="flex justify-between" title="Down from ATH">
                                      <span>Drop:</span>
                                      <span className="text-red-500">{fmtPct(asset.ath_change_percentage)}</span>
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
                                      <span className="text-gray-700">{formatCompact(asset.market_cap)}</span>
                                  </div>
                                  <div className="flex justify-between">
                                      <span>Vol:</span>
                                      <span className="text-gray-700">{formatCompact(asset.total_volume)}</span>
                                  </div>
                                  <div className="flex justify-between" title={`H: ${formatCurrency(asset.high_24h)} L: ${formatCurrency(asset.low_24h)}`}>
                                      <span>H/L:</span>
                                      <span className="text-gray-500">Info</span>
                                  </div>
                              </div>
                          </div>
                      )}

                      {/* 4. Chart */}
                      <div className="flex-grow bg-white relative w-full h-full min-h-0">
                        <LazyWidget>
                            <TradingViewWidget 
                              symbol={getTradingViewSymbol(asset)} 
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
                        نمایش {((currentPage - 1) * pageSize) + 1} تا {Math.min(currentPage * pageSize, totalCount)} از {totalCount} مورد
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