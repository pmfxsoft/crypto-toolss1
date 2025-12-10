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
  description?: string;
  image?: string;
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

// Static data for Forex and Stocks
const FOREX_PAIRS: AssetData[] = [
  { id: 'fx-usdsek', symbol: 'USDSEK', name: 'USD/SEK', type: 'FOREX', current_price: 9.31603, price_change_percentage_24h: -0.47 },
  { id: 'fx-nzdjpy', symbol: 'NZDJPY', name: 'NZD/JPY', type: 'FOREX', current_price: 90.427, price_change_percentage_24h: -0.34 },
  { id: 'fx-cadchf', symbol: 'CADCHF', name: 'CAD/CHF', type: 'FOREX', current_price: 0.57961, price_change_percentage_24h: -0.57 },
  { id: 'fx-nzdchf', symbol: 'NZDCHF', name: 'NZD/CHF', type: 'FOREX', current_price: 0.46400, price_change_percentage_24h: -0.59 },
  { id: 'fx-audchf', symbol: 'AUDCHF', name: 'AUD/CHF', type: 'FOREX', current_price: 0.53278, price_change_percentage_24h: -0.62 },
  { id: 'fx-usdchf', symbol: 'USDCHF', name: 'USD/CHF', type: 'FOREX', current_price: 0.80288, price_change_percentage_24h: -0.50 },
  { id: 'fx-usdils', symbol: 'USDILS', name: 'USD/ILS', type: 'FOREX', current_price: 3.23854, price_change_percentage_24h: 0.46 },
  { id: 'fx-usdzar', symbol: 'USDZAR', name: 'USD/ZAR', type: 'FOREX', current_price: 16.99200, price_change_percentage_24h: -0.35 },
  { id: 'fx-audjpy', symbol: 'AUDJPY', name: 'AUD/JPY', type: 'FOREX', current_price: 103.819, price_change_percentage_24h: -0.37 },
  { id: 'fx-eurtry', symbol: 'EURTRY', name: 'EUR/TRY', type: 'FOREX', current_price: 49.63950, price_change_percentage_24h: 0.16 },
  { id: 'fx-gbptry', symbol: 'GBPTRY', name: 'GBP/TRY', type: 'FOREX', current_price: 56.79890, price_change_percentage_24h: 0.22 },
  { id: 'fx-nzdusd', symbol: 'NZDUSD', name: 'NZD/USD', type: 'FOREX', current_price: 0.57797, price_change_percentage_24h: -0.08 },
  { id: 'fx-chfjpy', symbol: 'CHFJPY', name: 'CHF/JPY', type: 'FOREX', current_price: 194.869, price_change_percentage_24h: 0.25 },
  { id: 'fx-gbpsek', symbol: 'GBPSEK', name: 'GBP/SEK', type: 'FOREX', current_price: 12.41040, price_change_percentage_24h: -0.29 },
  { id: 'fx-nzdsgd', symbol: 'NZDSGD', name: 'NZD/SGD', type: 'FOREX', current_price: 0.74870, price_change_percentage_24h: -0.21 },
  { id: 'fx-usdhuf', symbol: 'USDHUF', name: 'USD/HUF', type: 'FOREX', current_price: 329.300, price_change_percentage_24h: -0.22 },
  { id: 'fx-cadjpy', symbol: 'CADJPY', name: 'CAD/JPY', type: 'FOREX', current_price: 112.957, price_change_percentage_24h: -0.33 },
  { id: 'fx-eurzar', symbol: 'EURZAR', name: 'EUR/ZAR', type: 'FOREX', current_price: 19.78260, price_change_percentage_24h: -0.23 },
  { id: 'fx-gbpnzd', symbol: 'GBPNZD', name: 'GBP/NZD', type: 'FOREX', current_price: 2.30511, price_change_percentage_24h: 0.27 },
  { id: 'fx-nzdcad', symbol: 'NZDCAD', name: 'NZD/CAD', type: 'FOREX', current_price: 0.80052, price_change_percentage_24h: -0.02 },
  { id: 'fx-usdpln', symbol: 'USDPLN', name: 'USD/PLN', type: 'FOREX', current_price: 3.62881, price_change_percentage_24h: -0.21 },
  { id: 'fx-eurchf', symbol: 'EURCHF', name: 'EUR/CHF', type: 'FOREX', current_price: 0.93479, price_change_percentage_24h: -0.38 },
  { id: 'fx-eurnzd', symbol: 'EURNZD', name: 'EUR/NZD', type: 'FOREX', current_price: 2.01456, price_change_percentage_24h: 0.21 },
  { id: 'fx-gbpcad', symbol: 'GBPCAD', name: 'GBP/CAD', type: 'FOREX', current_price: 1.84530, price_change_percentage_24h: 0.25 },
  { id: 'fx-gbpzar', symbol: 'GBPZAR', name: 'GBP/ZAR', type: 'FOREX', current_price: 22.63570, price_change_percentage_24h: -0.17 },
  { id: 'fx-usdczk', symbol: 'USDCZK', name: 'USD/CZK', type: 'FOREX', current_price: 20.84410, price_change_percentage_24h: -0.15 },
  { id: 'fx-audusd', symbol: 'AUDUSD', name: 'AUD/USD', type: 'FOREX', current_price: 0.66362, price_change_percentage_24h: -0.11 },
  { id: 'fx-eurcad', symbol: 'EURCAD', name: 'EUR/CAD', type: 'FOREX', current_price: 1.61270, price_change_percentage_24h: 0.19 },
  { id: 'fx-eurjpy', symbol: 'EURJPY', name: 'EUR/JPY', type: 'FOREX', current_price: 182.171, price_change_percentage_24h: -0.13 },
  { id: 'fx-eurmxn', symbol: 'EURMXN', name: 'EUR/MXN', type: 'FOREX', current_price: 21.20040, price_change_percentage_24h: 0.15 },
  { id: 'fx-eurusd', symbol: 'EURUSD', name: 'EUR/USD', type: 'FOREX', current_price: 1.16434, price_change_percentage_24h: 0.12 },
  { id: 'fx-gbpaud', symbol: 'GBPAUD', name: 'GBP/AUD', type: 'FOREX', current_price: 2.00757, price_change_percentage_24h: 0.30 },
  { id: 'fx-gbpchf', symbol: 'GBPCHF', name: 'GBP/CHF', type: 'FOREX', current_price: 1.06964, price_change_percentage_24h: -0.32 },
  { id: 'fx-gbpnok', symbol: 'GBPNOK', name: 'GBP/NOK', type: 'FOREX', current_price: 13.52440, price_change_percentage_24h: 0.26 },
  { id: 'fx-gbpusd', symbol: 'GBPUSD', name: 'GBP/USD', type: 'FOREX', current_price: 1.33227, price_change_percentage_24h: 0.18 },
  { id: 'fx-usdjpy', symbol: 'USDJPY', name: 'USD/JPY', type: 'FOREX', current_price: 156.460, price_change_percentage_24h: -0.26 },
  { id: 'fx-usdnok', symbol: 'USDNOK', name: 'USD/NOK', type: 'FOREX', current_price: 10.15160, price_change_percentage_24h: 0.08 },
  { id: 'fx-audcad', symbol: 'AUDCAD', name: 'AUD/CAD', type: 'FOREX', current_price: 0.91916, price_change_percentage_24h: -0.04 },
  { id: 'fx-audnzd', symbol: 'AUDNZD', name: 'AUD/NZD', type: 'FOREX', current_price: 1.14819, price_change_percentage_24h: -0.03 },
  { id: 'fx-eurhkd', symbol: 'EURHKD', name: 'EUR/HKD', type: 'FOREX', current_price: 9.06063, price_change_percentage_24h: 0.12 },
  { id: 'fx-gbpjpy', symbol: 'GBPJPY', name: 'GBP/JPY', type: 'FOREX', current_price: 208.443, price_change_percentage_24h: -0.07 },
  { id: 'fx-usddkk', symbol: 'USDDKK', name: 'USD/DKK', type: 'FOREX', current_price: 6.41506, price_change_percentage_24h: -0.11 },
  { id: 'fx-euraud', symbol: 'EURAUD', name: 'EUR/AUD', type: 'FOREX', current_price: 1.75453, price_change_percentage_24h: 0.23 },
  { id: 'fx-usdkrw', symbol: 'USDKRW', name: 'USD/KRW', type: 'FOREX', current_price: 1468.32, price_change_percentage_24h: -0.01 },
  { id: 'fx-usdsgd', symbol: 'USDSGD', name: 'USD/SGD', type: 'FOREX', current_price: 1.29545, price_change_percentage_24h: -0.12 },
  { id: 'fx-eurpln', symbol: 'EURPLN', name: 'EUR/PLN', type: 'FOREX', current_price: 4.22521, price_change_percentage_24h: -0.09 },
  { id: 'fx-gbpdkk', symbol: 'GBPDKK', name: 'GBP/DKK', type: 'FOREX', current_price: 8.54657, price_change_percentage_24h: 0.07 },
  { id: 'fx-gbpsgd', symbol: 'GBPSGD', name: 'GBP/SGD', type: 'FOREX', current_price: 1.72587, price_change_percentage_24h: 0.06 },
  { id: 'fx-usdcad', symbol: 'USDCAD', name: 'USD/CAD', type: 'FOREX', current_price: 1.38516, price_change_percentage_24h: 0.07 },
  { id: 'fx-usdtry', symbol: 'USDTRY', name: 'USD/TRY', type: 'FOREX', current_price: 42.60250, price_change_percentage_24h: 0.03 },
  { id: 'fx-eurgbp', symbol: 'EURGBP', name: 'EUR/GBP', type: 'FOREX', current_price: 0.87393, price_change_percentage_24h: -0.06 },
  { id: 'fx-eursgd', symbol: 'EURSGD', name: 'EUR/SGD', type: 'FOREX', current_price: 1.50833, price_change_percentage_24h: 0.00 },
  { id: 'fx-usdmxn', symbol: 'USDMXN', name: 'USD/MXN', type: 'FOREX', current_price: 18.20560, price_change_percentage_24h: 0.02 },
  { id: 'fx-usdcnh', symbol: 'USDCNH', name: 'USD/CNH', type: 'FOREX', current_price: 7.06741, price_change_percentage_24h: 0.08 },
];

const STOCK_DATA: AssetData[] = [
  { id: 'st-bynd', symbol: 'NASDAQ:BYND', name: 'Beyond Meat', type: 'STOCKS', description: 'تولیدکننده جایگزین‌های گیاهی گوشت مستقر در لس‌آنجلس.' },
  { id: 'st-rivn', symbol: 'NASDAQ:RIVN', name: 'Rivian Automotive', type: 'STOCKS', description: 'شرکت فناوری خودروسازی آمریکایی که بر تولید خودروهای برقی متمرکز است.' },
  { id: 'st-plug', symbol: 'NASDAQ:PLUG', name: 'Plug Power', type: 'STOCKS', description: 'توسعه‌دهنده سیستم‌های سلول سوختی هیدروژنی جایگزین باتری‌های سنتی.' },
  { id: 'st-riot', symbol: 'NASDAQ:RIOT', name: 'Riot Platforms', type: 'STOCKS', description: 'یکی از بزرگترین شرکت‌های استخراج بیت‌کوین و زیرساخت دیجیتال در آمریکا.' },
  { id: 'st-coin', symbol: 'NASDAQ:COIN', name: 'Coinbase Global', type: 'STOCKS', description: 'پلتفرم مبادله ارزهای دیجیتال و کیف پول آنلاین.' },
  { id: 'st-nvda', symbol: 'NASDAQ:NVDA', name: 'NVIDIA', type: 'STOCKS', description: 'پیشرو در تولید واحدهای پردازش گرافیکی (GPU) و هوش مصنوعی.' },
  { id: 'st-tsla', symbol: 'NASDAQ:TSLA', name: 'Tesla', type: 'STOCKS', description: 'تولیدکننده خودروهای برقی، پنل‌های خورشیدی و راه‌حل‌های انرژی پاک.' },
  { id: 'st-aapl', symbol: 'NASDAQ:AAPL', name: 'Apple', type: 'STOCKS', description: 'بزرگترین شرکت فناوری جهان، سازنده آیفون، مک و سرویس‌های دیجیتال.' },
  { id: 'st-msft', symbol: 'NASDAQ:MSFT', name: 'Microsoft', type: 'STOCKS', description: 'غول نرم‌افزاری جهان، مالک ویندوز، آفیس، آژور و لینکدین.' },
  { id: 'st-amzn', symbol: 'NASDAQ:AMZN', name: 'Amazon', type: 'STOCKS', description: 'بزرگترین شرکت تجارت الکترونیک و ارائه دهنده خدمات ابری (AWS) در جهان.' },
  { id: 'st-goog', symbol: 'NASDAQ:GOOG', name: 'Alphabet (Google)', type: 'STOCKS', description: 'مالک موتور جستجوی گوگل، یوتیوب و سیستم عامل اندروید.' },
  { id: 'st-meta', symbol: 'NASDAQ:META', name: 'Meta Platforms', type: 'STOCKS', description: 'مالک فیس‌بوک، اینستاگرام و واتس‌اپ، پیشرو در حوزه واقعیت مجازی.' },
  { id: 'st-amd', symbol: 'NASDAQ:AMD', name: 'AMD', type: 'STOCKS', description: 'تولیدکننده پردازنده‌های کامپیوتری و گرافیکی برای دیتاسنترها و گیمینگ.' },
  { id: 'st-nflx', symbol: 'NASDAQ:NFLX', name: 'Netflix', type: 'STOCKS', description: 'ارائه‌دهنده پیشرو خدمات پخش آنلاین فیلم و سریال در جهان.' },
  { id: 'st-pep', symbol: 'NASDAQ:PEP', name: 'PepsiCo', type: 'STOCKS', description: 'شرکت چندملیتی تولید مواد غذایی، اسنک و نوشیدنی.' },
  { id: 'st-cost', symbol: 'NASDAQ:COST', name: 'Costco Wholesale', type: 'STOCKS', description: 'زنجیره فروشگاه‌های عضویت محور با قیمت عمده‌فروشی.' },
  { id: 'st-avgo', symbol: 'NASDAQ:AVGO', name: 'Broadcom', type: 'STOCKS', description: 'طراح و تولیدکننده جهانی نیمه‌هادی‌ها و نرم‌افزارهای زیرساختی.' },
  { id: 'st-intc', symbol: 'NASDAQ:INTC', name: 'Intel', type: 'STOCKS', description: 'یکی از بزرگترین تولیدکنندگان چیپ‌های نیمه‌هادی در جهان.' },
  { id: 'st-pypl', symbol: 'NASDAQ:PYPL', name: 'PayPal', type: 'STOCKS', description: 'سیستم پرداخت آنلاین بین‌المللی برای انتقال وجه الکترونیکی.' },
  { id: 'st-jpm', symbol: 'NYSE:JPM', name: 'JPMorgan Chase', type: 'STOCKS', description: 'بزرگترین بانک ایالات متحده و یکی از بزرگترین موسسات مالی جهان.' },
  { id: 'st-bac', symbol: 'NYSE:BAC', name: 'Bank of America', type: 'STOCKS', description: 'شرکت خدمات مالی و بانکداری چندملیتی آمریکایی.' },
  { id: 'st-wmt', symbol: 'NYSE:WMT', name: 'Walmart', type: 'STOCKS', description: 'بزرگترین شرکت خرده‌فروشی جهان از نظر درآمد.' },
  { id: 'st-lly', symbol: 'NYSE:LLY', name: 'Eli Lilly', type: 'STOCKS', description: 'شرکت داروسازی آمریکایی پیشرو در تولید داروهای دیابت و سرطان.' },
  { id: 'st-pson', symbol: 'NYSE:PSO', name: 'Pearson', type: 'STOCKS', description: 'شرکت خدمات آموزشی و انتشاراتی بریتانیایی.' },
  { id: 'st-hsba', symbol: 'NYSE:HSBC', name: 'HSBC Holdings', type: 'STOCKS', description: 'یکی از بزرگترین سازمان‌های بانکداری و خدمات مالی در جهان.' },
  { id: 'st-blnd', symbol: 'OTC:BTLCY', name: 'British Land', type: 'STOCKS', description: 'شرکت سرمایه‌گذاری املاک و مستغلات بریتانیایی.' },
  { id: 'st-rno', symbol: 'OTC:RNLSY', name: 'Renault', type: 'STOCKS', description: 'تولیدکننده خودرو فرانسوی چندملیتی.' },
  { id: 'st-tsco', symbol: 'OTC:TSCDY', name: 'Tesco', type: 'STOCKS', description: 'شرکت خرده‌فروشی بریتانیایی و یکی از بزرگترین سوپرمارکت‌های جهان.' },
  { id: 'st-brby', symbol: 'OTC:BURBY', name: 'Burberry Group', type: 'STOCKS', description: 'خانه مد لوکس بریتانیایی معروف به لباس‌های خاص و اکسسوری.' },
  { id: 'st-vod', symbol: 'NASDAQ:VOD', name: 'Vodafone Group', type: 'STOCKS', description: 'شرکت مخابراتی چندملیتی بریتانیایی.' },
  { id: 'st-bmw', symbol: 'OTC:BMWYY', name: 'BMW', type: 'STOCKS', description: 'شرکت خودروسازی آلمانی تولیدکننده خودروهای لوکس و موتورسیکلت.' },
  { id: 'st-sie', symbol: 'OTC:SIEGY', name: 'Siemens', type: 'STOCKS', description: 'خوشه صنعتی آلمانی متمرکز بر اتوماسیون و دیجیتالی‌سازی.' },
  { id: 'st-ads', symbol: 'OTC:ADDYY', name: 'Adidas', type: 'STOCKS', description: 'دومین تولیدکننده بزرگ لباس ورزشی در جهان مستقر در آلمان.' },
  { id: 'st-asml', symbol: 'NASDAQ:ASML', name: 'ASML Holding', type: 'STOCKS', description: 'تولیدکننده هلندی سیستم‌های لیتوگرافی برای صنعت نیمه‌هادی.' },
  { id: 'st-air', symbol: 'OTC:EADSY', name: 'Airbus', type: 'STOCKS', description: 'شرکت هوافضای اروپایی و تولیدکننده هواپیماهای مسافربری.' },
  { id: 'st-mc', symbol: 'OTC:LVMUY', name: 'LVMH', type: 'STOCKS', description: 'بزرگترین شرکت کالاهای لوکس جهان (لویی ویتون، دیور و ...).' },
  { id: 'st-tte', symbol: 'NYSE:TTE', name: 'TotalEnergies', type: 'STOCKS', description: 'شرکت نفت و گاز چندملیتی فرانسوی.' },
  { id: 'st-alv', symbol: 'OTC:ALIZY', name: 'Allianz', type: 'STOCKS', description: 'شرکت خدمات مالی و بیمه چندملیتی آلمانی.' },
  { id: 'st-barc', symbol: 'NYSE:BCS', name: 'Barclays', type: 'STOCKS', description: 'بانک جهانی بریتانیایی.' },
  { id: 'st-baba', symbol: 'NYSE:BABA', name: 'Alibaba Group', type: 'STOCKS', description: 'غول تجارت الکترونیک و فناوری چینی.' },
  { id: 'st-nio', symbol: 'NYSE:NIO', name: 'NIO Inc.', type: 'STOCKS', description: 'تولیدکننده خودروهای برقی هوشمند چین.' },
];

const TIMEFRAMES = [
  { label: '15m', value: '15' },
  { label: '1H', value: '60' },
  { label: '4H', value: '240' },
  { label: '1D', value: 'D' },
  { label: '1W', value: 'W' },
  { label: '1M', value: '1M' },
];

const PAGE_SIZE_OPTIONS = [15, 30, 45, 60, 90];

const LOCAL_STORAGE_KEY = 'crypto_layout_preference_v1';

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
            }, 300); 
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
              <div className="w-6 h-6 border-2 border-gray-200 border-t-blue-500 rounded-full animate-spin"></div>
              <span className="text-xs text-blue-500 font-medium">لودینگ...</span>
            </div>
          ) : (
            <div className="flex flex-col items-center gap-2 opacity-50">
               <span className="text-xl">📊</span>
               <span className="text-xs">منتظر نمایش</span>
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
  
  // Data State
  const [displayedAssets, setDisplayedAssets] = useState<AssetData[]>([]);
  
  // User Preferences
  const [removedIds, setRemovedIds] = useState<Set<string>>(new Set());
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  
  // Fetch Config
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // UI Filters
  const [user, setUser] = useState<any>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [cryptoTotalCount, setCryptoTotalCount] = useState(10000); 

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

  // Reset pagination on category change or search
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, searchQuery, showFavoritesOnly]);

  // Scroll top on page change
  useEffect(() => {
    if (mainContentRef.current) {
        mainContentRef.current.scrollIntoView({ behavior: 'smooth' });
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);


  // --- Data Fetching Strategy ---
  useEffect(() => {
    // 1. Non-Crypto Handling (Static Data)
    if (activeCategory === 'FOREX') {
        let data = FOREX_PAIRS.filter(a => !removedIds.has(a.id));
        if (showFavoritesOnly) data = data.filter(a => favorites.has(a.id));
        if (searchQuery) {
             const q = searchQuery.toLowerCase();
             data = data.filter(a => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
        }
        setDisplayedAssets(data);
        setCryptoTotalCount(data.length);
        return;
    }
    if (activeCategory === 'STOCKS') {
        let data = STOCK_DATA.filter(a => !removedIds.has(a.id));
        if (showFavoritesOnly) data = data.filter(a => favorites.has(a.id));
        if (searchQuery) {
             const q = searchQuery.toLowerCase();
             data = data.filter(a => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
        }
        setDisplayedAssets(data);
        setCryptoTotalCount(data.length);
        return;
    }

    // 2. Crypto Handling (API Pagination / Search)
    const controller = new AbortController();

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            let data: AssetData[] = [];
            
            // CASE A: Show Favorites Only
            if (showFavoritesOnly) {
                const favIds = Array.from(favorites);
                if (favIds.length === 0) {
                    setDisplayedAssets([]);
                    setCryptoTotalCount(0);
                    setLoading(false);
                    return;
                }
                
                const idsParam = favIds.join(',');
                const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${idsParam}&order=market_cap_desc&sparkline=false&price_change_percentage=24h,7d,30d,1y`;
                const res = await fetch(url, { signal: controller.signal });
                const json = await res.json();
                
                let filtered = json;
                if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    filtered = filtered.filter((c: any) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
                }
                
                setCryptoTotalCount(filtered.length);
                const start = (currentPage - 1) * pageSize;
                data = filtered.slice(start, start + pageSize).map((c: any) => ({ ...c, type: 'CRYPTO' }));
            
            // CASE B: Search Active (Server-side Search)
            } else if (searchQuery.trim().length > 0) {
                const searchRes = await fetch(`https://api.coingecko.com/api/v3/search?query=${searchQuery}`, { signal: controller.signal });
                const searchJson = await searchRes.json();
                const coins = searchJson.coins || [];
                
                if (coins.length === 0) {
                    setDisplayedAssets([]);
                    setCryptoTotalCount(0);
                    setLoading(false);
                    return;
                }

                setCryptoTotalCount(coins.length);

                const start = (currentPage - 1) * pageSize;
                const pageCoins = coins.slice(start, start + pageSize);
                const ids = pageCoins.map((c: any) => c.id).join(',');
                
                if (ids) {
                    const marketsRes = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h,7d,30d,1y`, { signal: controller.signal });
                    const marketsJson = await marketsRes.json();
                    data = marketsJson.map((c: any) => ({ ...c, type: 'CRYPTO' }));
                }

            // CASE C: Default Market View (Paginated)
            } else {
                const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${pageSize}&page=${currentPage}&sparkline=false&price_change_percentage=24h,7d,30d,1y`;
                const res = await fetch(url, { signal: controller.signal });
                if (!res.ok) throw new Error("Rate Limit or API Error");
                const json = await res.json();
                
                data = json.map((c: any) => ({ ...c, type: 'CRYPTO' }));
                setCryptoTotalCount(10000); 
            }

            setDisplayedAssets(data.filter(a => !removedIds.has(a.id)));

        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error(err);
                setError("خطا در برقراری ارتباط با سرور.");
            }
        } finally {
            if (!controller.signal.aborted) setLoading(false);
        }
    };

    const debounceTimer = setTimeout(fetchData, 400); 
    return () => {
        clearTimeout(debounceTimer);
        controller.abort();
    };
  }, [activeCategory, currentPage, pageSize, searchQuery, showFavoritesOnly]); 

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
    setDisplayedAssets(prev => prev.filter(a => a.id !== id));
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

  // Helper variables
  const totalPages = Math.ceil(cryptoTotalCount / pageSize);

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
                  className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${activeCategory === 'CRYPTO' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  کریپتو
                </button>
                <button 
                  onClick={() => setActiveCategory('FOREX')} 
                  className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${activeCategory === 'FOREX' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  فارکس
                </button>
                <button 
                  onClick={() => setActiveCategory('STOCKS')} 
                  className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all ${activeCategory === 'STOCKS' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  بازار سهام
                </button>
              </div>
              
              {/* Search Box */}
              <div className="relative w-full md:w-56">
                <input 
                    type="text" 
                    placeholder="جستجو (نام یا نماد)..." 
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
                {/* Changed this block: Added wrapper with padding (bridge) instead of margin */}
                <div className="absolute left-0 top-full pt-2 w-48 hidden group-hover:block z-50">
                  <div className="bg-white rounded-lg shadow-xl border border-gray-100 p-2">
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
        </div>
      </header>

      {/* Main Content */}
      <main ref={mainContentRef} className="flex-grow p-4 md:p-6 bg-gray-100">
        
        {/* Loading/Error States */}
        {loading && (
            <div className="fixed top-[70px] left-1/2 -translate-x-1/2 z-30 bg-blue-600 text-white px-4 py-1.5 rounded-full shadow-lg text-sm font-medium flex items-center gap-2 animate-pulse">
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                بروزرسانی لیست...
            </div>
        )}
        {error && (
            <div className="fixed top-[70px] left-1/2 -translate-x-1/2 z-30 bg-red-600 text-white px-4 py-1.5 rounded-full shadow-lg text-sm font-medium">
                {error}
            </div>
        )}

        {(!loading && displayedAssets.length === 0) ? (
            <div className="flex flex-col items-center justify-center h-96 text-center">
                <p className="text-gray-500 text-lg">موردی یافت نشد.</p>
                {searchQuery && <p className="text-gray-400 mt-2">برای "{searchQuery}" نتیجه‌ای پیدا نشد.</p>}
            </div>
        ) : (
            <>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {displayedAssets.map((asset) => {
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
                        <div className="flex items-center gap-2 overflow-hidden">
                          <img src={getImage(asset)} alt={asset.name} className="w-8 h-8 rounded-full object-contain flex-shrink-0" loading="lazy" onError={(e) => (e.currentTarget.style.display = 'none')} />
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                               <h3 className="font-bold text-gray-800 text-lg truncate">{asset.symbol.split(':').pop()?.toUpperCase()}</h3>
                               {hasDetails && (
                                 <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded font-medium flex-shrink-0">#{asset.market_cap_rank || '-'}</span>
                               )}
                               {!hasDetails && (
                                 <span className="text-[10px] text-gray-400 bg-gray-50 px-1 py-0.5 rounded uppercase flex-shrink-0">{asset.type}</span>
                               )}
                            </div>
                            <p className="text-xs text-gray-500 truncate max-w-[150px]">{asset.name}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center flex-shrink-0">
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

                      {/* 2. Primary Stats */}
                      {hasDetails && (
                          <div className="px-4 py-2 bg-gray-50 flex justify-between items-center border-b border-gray-100 shrink-0 h-[45px]">
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

                      {/* 3. Detailed Stats */}
                      {hasDetails ? (
                          <div className="grid grid-cols-3 gap-x-2 gap-y-1 p-3 text-xs bg-white border-b border-gray-100 text-gray-600 shrink-0 h-[85px]">
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
                      ) : (
                          // Description for non-crypto assets
                          <div className="px-4 py-3 bg-white border-b border-gray-100 shrink-0 h-[80px] overflow-hidden">
                              <p className="text-xs text-gray-500 leading-relaxed text-right line-clamp-3">
                                  {asset.description || 'اطلاعات بیشتری در دسترس نیست.'}
                              </p>
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
                        نمایش {((currentPage - 1) * pageSize) + 1} تا {Math.min(currentPage * pageSize, cryptoTotalCount)} از {cryptoTotalCount} مورد
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
                            صفحه {currentPage} از {totalPages || 1}
                        </div>

                        <button 
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                            disabled={currentPage >= totalPages}
                            className="px-3 py-1.5 text-sm rounded bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
                        >
                            بعدی
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