import React, { useState, useEffect } from 'react';
import TradingViewWidget from './components/TradingViewWidget';

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

const App: React.FC = () => {
  const [isLogScale, setIsLogScale] = useState(true);
  const [coins, setCoins] = useState<CoinData[]>([]);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const PER_PAGE = 12;
  // Estimate for 5000+ coins. 5000 / 12 = ~417 pages.
  const TOTAL_PAGES = 417;

  // Fetch data from CoinGecko
  useEffect(() => {
    const fetchCoins = async () => {
      setLoading(true);
      setError(null);
      try {
        // Added price_change_percentage parameter to fetch 7d, 30d, 1y data
        const response = await fetch(
          `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${PER_PAGE}&page=${page}&sparkline=false&price_change_percentage=24h,7d,30d,1y`
        );
        
        if (!response.ok) {
          if (response.status === 429) {
            throw new Error("تعداد درخواست‌ها زیاد است. لطفاً چند لحظه صبر کنید.");
          }
          throw new Error("خطا در دریافت اطلاعات");
        }

        const data = await response.json();
        setCoins(data);
      } catch (err: any) {
        setError(err.message || "خطایی رخ داده است");
      } finally {
        setLoading(false);
      }
    };

    fetchCoins();
    
    // Scroll to top on page change
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [page]);

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
  
  // Format Regular Numbers
  const formatNumber = (value: number) => {
    if (value === null || value === undefined) return '-';
    return new Intl.NumberFormat('en-US', {
        maximumFractionDigits: 0
    }).format(value);
  }

  // Helper to map CoinGecko symbol to TradingView Symbol (Binance USDT pair preference)
  const getTradingViewSymbol = (coinSymbol: string) => {
    if (coinSymbol.toLowerCase() === 'usdt') return 'BINANCE:USDCUSDT'; 
    return `BINANCE:${coinSymbol.toUpperCase()}USDT`;
  };

  // Generate page numbers for pagination
  const getPageNumbers = () => {
    const pages = [];
    const maxVisible = 5; 

    if (TOTAL_PAGES <= maxVisible + 2) {
      for (let i = 1; i <= TOTAL_PAGES; i++) pages.push(i);
    } else {
      pages.push(1);
      if (page > 3) pages.push('...');
      let start = Math.max(2, page - 1);
      let end = Math.min(TOTAL_PAGES - 1, page + 1);
      if (page < 4) end = 4;
      if (page > TOTAL_PAGES - 3) start = TOTAL_PAGES - 3;
      for (let i = start; i <= end; i++) pages.push(i);
      if (page < TOTAL_PAGES - 2) pages.push('...');
      pages.push(TOTAL_PAGES);
    }
    return pages;
  };

  // Helper for percentage color
  const getPercentClass = (val: number | null | undefined) => {
      if (val === null || val === undefined) return 'text-gray-500';
      return val >= 0 ? 'text-green-600' : 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gray-100 text-gray-800 flex flex-col items-center font-sans">
      {/* Header */}
      <header className="w-full bg-white shadow-sm sticky top-0 z-20 px-4 py-3 border-b border-gray-200">
        <div className="flex flex-col md:flex-row items-center justify-between max-w-full mx-auto">
          <div className="flex items-center mb-2 md:mb-0">
            <h1 className="text-xl md:text-2xl font-bold text-gray-900 ml-4">
               بازار حرفه‌ای ارزهای دیجیتال
            </h1>
            <span className="text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded">
              صفحه {page} از {TOTAL_PAGES}
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="inline-flex items-center justify-center bg-gray-100 p-1 rounded-lg border border-gray-200">
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
            <p className="font-bold">خطا:</p>
            <p>{error}</p>
            <button onClick={() => window.location.reload()} className="mt-2 text-sm underline">تلاش مجدد</button>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center h-[80vh]">
            <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
            <p className="mt-4 text-gray-500">در حال دریافت و تحلیل داده‌های ۵۰۰۰ ارز دیجیتال...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 w-full">
            {coins.map((coin) => (
              <div key={coin.id} className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden flex flex-col aspect-square">
                
                {/* Professional Card Header & Stats */}
                <div className="p-3 border-b border-gray-200 bg-white flex-shrink-0">
                    
                    {/* Top Row: Identity & Price */}
                    <div className="flex justify-between items-start mb-3">
                        <div className="flex items-center gap-2">
                             <div className="flex flex-col items-center justify-center bg-gray-100 w-10 h-10 rounded-full border border-gray-200">
                                <span className="text-xs font-bold text-gray-500">#{coin.market_cap_rank}</span>
                             </div>
                             <img src={coin.image} alt={coin.name} className="w-8 h-8 rounded-full" />
                             <div>
                                 <h2 className="text-base font-bold text-gray-900 leading-tight">{coin.name}</h2>
                                 <span className="text-xs text-gray-500 font-semibold uppercase">{coin.symbol}</span>
                             </div>
                        </div>
                        <div className="text-left">
                            <div className="text-xl font-extrabold text-gray-900 font-mono tracking-tight">
                                {formatCurrency(coin.current_price)}
                            </div>
                            <div className={`text-xs font-bold text-right ${getPercentClass(coin.price_change_percentage_24h)} dir-ltr`}>
                                {coin.price_change_percentage_24h?.toFixed(2)}% (24h)
                            </div>
                        </div>
                    </div>

                    {/* Performance Strip */}
                    <div className="grid grid-cols-4 gap-2 text-center text-[10px] mb-3 bg-gray-50 p-2 rounded-lg border border-gray-100">
                        <div className="flex flex-col">
                            <span className="text-gray-400 mb-0.5">7d</span>
                            <span className={`font-bold ${getPercentClass(coin.price_change_percentage_7d_in_currency)} dir-ltr`}>
                                {coin.price_change_percentage_7d_in_currency?.toFixed(2)}%
                            </span>
                        </div>
                        <div className="flex flex-col border-r border-gray-200 border-l px-1">
                            <span className="text-gray-400 mb-0.5">30d</span>
                            <span className={`font-bold ${getPercentClass(coin.price_change_percentage_30d_in_currency)} dir-ltr`}>
                                {coin.price_change_percentage_30d_in_currency?.toFixed(2)}%
                            </span>
                        </div>
                        <div className="flex flex-col border-l border-gray-200 pl-1">
                            <span className="text-gray-400 mb-0.5">1y</span>
                            <span className={`font-bold ${getPercentClass(coin.price_change_percentage_1y_in_currency)} dir-ltr`}>
                                {coin.price_change_percentage_1y_in_currency?.toFixed(2)}%
                            </span>
                        </div>
                        <div className="flex flex-col">
                            <span className="text-gray-400 mb-0.5">ATH</span>
                            <span className={`font-bold ${getPercentClass(coin.ath_change_percentage)} dir-ltr`}>
                                {coin.ath_change_percentage?.toFixed(2)}%
                            </span>
                        </div>
                    </div>

                    {/* Detailed Stats Grid */}
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-[11px]">
                         <div className="flex justify-between items-center border-b border-gray-50 pb-1">
                             <span className="text-gray-500">Market Cap</span>
                             <span className="font-bold text-gray-800 dir-ltr">${formatCompact(coin.market_cap)}</span>
                         </div>
                         <div className="flex justify-between items-center border-b border-gray-50 pb-1">
                             <span className="text-gray-500">Volume (24h)</span>
                             <span className="font-bold text-gray-800 dir-ltr">${formatCompact(coin.total_volume)}</span>
                         </div>
                         <div className="flex justify-between items-center border-b border-gray-50 pb-1">
                             <span className="text-gray-500">High (24h)</span>
                             <span className="font-bold text-gray-800 dir-ltr">{formatCurrency(coin.high_24h)}</span>
                         </div>
                         <div className="flex justify-between items-center border-b border-gray-50 pb-1">
                             <span className="text-gray-500">Low (24h)</span>
                             <span className="font-bold text-gray-800 dir-ltr">{formatCurrency(coin.low_24h)}</span>
                         </div>
                         <div className="flex justify-between items-center">
                             <span className="text-gray-500">Circ. Supply</span>
                             <span className="font-bold text-gray-800 dir-ltr">{formatCompact(coin.circulating_supply)}</span>
                         </div>
                         <div className="flex justify-between items-center">
                             <span className="text-gray-500">Total Supply</span>
                             <span className="font-bold text-gray-800 dir-ltr">{coin.total_supply ? formatCompact(coin.total_supply) : '∞'}</span>
                         </div>
                    </div>
                </div>

                {/* Chart Area */}
                <div className="flex-grow bg-white relative w-full overflow-hidden border-t border-gray-100">
                  <TradingViewWidget 
                    isLogScale={isLogScale} 
                    symbol={getTradingViewSymbol(coin.symbol)} 
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </main>
      
      {/* Bottom Pagination */}
      <footer className="w-full bg-white border-t border-gray-200 p-4 sticky bottom-0 z-10 shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)]">
        <div className="flex flex-col sm:flex-row justify-center items-center gap-4 max-w-full overflow-x-auto">
            <button 
              disabled={page === 1 || loading}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow disabled:opacity-50 hover:bg-blue-700 transition text-sm flex-shrink-0"
            >
              قبلی
            </button>
            
            <div className="flex items-center gap-1 flex-wrap justify-center dir-ltr">
              {getPageNumbers().map((p, index) => (
                <button
                  key={index}
                  onClick={() => typeof p === 'number' ? setPage(p) : null}
                  disabled={p === '...' || loading}
                  className={`w-8 h-8 flex items-center justify-center rounded-md text-sm font-medium transition-colors
                    ${p === page 
                      ? 'bg-blue-100 text-blue-700 border border-blue-200 font-bold' 
                      : p === '...' 
                        ? 'cursor-default text-gray-400' 
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <button 
              disabled={page === TOTAL_PAGES || loading}
              onClick={() => setPage(p => Math.min(TOTAL_PAGES, p + 1))}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg shadow disabled:opacity-50 hover:bg-blue-700 transition text-sm flex-shrink-0"
            >
              بعدی
            </button>
        </div>
      </footer>
    </div>
  );
};

export default App;