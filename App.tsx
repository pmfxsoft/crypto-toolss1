import React, { useState, useEffect, useRef, useMemo } from 'react';
import TradingViewWidget from './components/TradingViewWidget';
import { auth, db } from './firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';
import { GoogleGenAI, Type } from "@google/genai";

// --- Types ---
type Category = 'CRYPTO' | 'FOREX' | 'STOCKS' | 'GAINERS';
type ViewMode = 'GRID' | 'TABLE';
type ChartMode = 'PRICE' | 'MCAP' | 'BOTH' | 'INFO';

interface AssetData {
  id: string;
  symbol: string;
  name: string;
  type: Category | 'CRYPTO'; 
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

interface CoinInsight {
  category: string;
  utility: string;
  outlook: string;
}

// --- Configuration ---
const BLOCKED_IDS = new Set([
  'tether', 'usd-coin', 'dai', 'first-digital-usd', 'ethena-usde', 
  'usdd', 'true-usd', 'frax', 'wrapped-steth', 
  'staked-ether', 'wrapped-bitcoin', 'weth', 'lido-staked-ether',
  'paypal-usd', 'paxos-standard', 'gemini-dollar', 'binance-usd'
]);

const BLOCKED_SYMBOLS = new Set(['usdt', 'usdc', 'dai', 'fdusd', 'usde', 'tusd', 'usdd', 'busd', 'wsteth']);

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

// Component: Copy Button
const CopyButton = ({ text }: { text: string }) => {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <button 
      onClick={handleCopy} 
      className="ml-2 p-1.5 rounded-full hover:bg-gray-100 transition-all text-gray-400 hover:text-blue-500" 
      title="کپی نماد"
    >
      {copied ? (
        <span className="text-green-500 font-bold text-xs">✓</span>
      ) : (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 17.25v3.375c0 .621-.504 1.125-1.125 1.125h-9.75a1.125 1.125 0 01-1.125-1.125V7.875c0-.621.504-1.125 1.125-1.125H6.75a9.06 9.06 0 011.5.124m7.5 10.376h3.375c.621 0 1.125-.504 1.125-1.125V11.25c0-4.46-3.243-8.161-7.5-8.876a9.06 9.06 0 00-1.5-.124H9.375c-.621 0-1.125.504-1.125 1.125v3.5m7.5 10.375H9.375a1.125 1.125 0 01-1.125-1.125v-9.25m12 6.625v-1.875a3.375 3.375 0 00-3.375-3.375h-1.5" />
        </svg>
      )}
    </button>
  );
};

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
  const [viewMode, setViewMode] = useState<ViewMode>('GRID');
  const [isLogScale, setIsLogScale] = useState(true);
  const [interval, setInterval] = useState("1M");
  const [expandedRowId, setExpandedRowId] = useState<string | null>(null);
  
  // Sorting State
  const [sortConfig, setSortConfig] = useState<{ key: keyof AssetData | null, direction: 'asc' | 'desc' }>({ key: null, direction: 'desc' });

  // Grid State
  const [gridCols, setGridCols] = useState(() => {
      if (typeof window !== 'undefined') {
          const saved = localStorage.getItem('crypto_grid_cols_v1');
          return saved ? Number(saved) : 3;
      }
      return 3;
  });

  // Chart Modes State (Price vs Market Cap vs Both vs Info)
  const [chartModes, setChartModes] = useState<Record<string, ChartMode>>({});
  
  // AI Insights State
  const [insights, setInsights] = useState<Record<string, CoinInsight>>({});
  const [insightLoading, setInsightLoading] = useState<string | null>(null);

  const toggleChartMode = (id: string, mode: ChartMode) => {
      setChartModes(prev => ({ ...prev, [id]: mode }));
  };

  useEffect(() => {
      localStorage.setItem('crypto_grid_cols_v1', String(gridCols));
      // Smart Auto Adjust: Trigger resize event when grid columns change 
      // to ensure TradingView widgets adapt to the new container size.
      const t1 = setTimeout(() => window.dispatchEvent(new Event('resize')), 50);
      const t2 = setTimeout(() => window.dispatchEvent(new Event('resize')), 350); // After transition
      return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [gridCols]);
  
  // Data State
  const [displayedAssets, setDisplayedAssets] = useState<AssetData[]>([]);
  
  // User Preferences
  // FIX: Initialize removedIds from localStorage immediately to prevent flicker/reappearance of deleted items
  const [removedIds, setRemovedIds] = useState<Set<string>>(() => {
    if (typeof window !== 'undefined') {
        const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
        if (saved) {
            try {
                return new Set(JSON.parse(saved));
            } catch (e) { return new Set(); }
        }
    }
    return new Set();
  });
  
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

  // Load Preferences (Favorites only, RemovedIds is now lazy-loaded in useState)
  useEffect(() => {
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
                    // Only update if remote has more data or to sync, but prioritize local for speed initially
                    setRemovedIds(prev => {
                        const newSet = new Set(prev);
                        data.removedCoinIds.forEach((id: string) => newSet.add(id));
                        return newSet;
                    });
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
  }, [activeCategory, searchQuery, showFavoritesOnly, viewMode]);

  // Handle Default Timeframe and Sorting
  useEffect(() => {
      // Reset sort config based on category
      if (activeCategory === 'CRYPTO') {
          setSortConfig({ key: 'market_cap_rank', direction: 'asc' });
      } else if (activeCategory === 'GAINERS') {
          setSortConfig({ key: 'price_change_percentage_24h', direction: 'desc' });
      } else if (activeCategory === 'FOREX' || activeCategory === 'STOCKS') {
          setSortConfig({ key: null, direction: 'desc' }); // Default order
      }
      
      // Default interval logic
      setInterval("D");

  }, [activeCategory]);

  // Scroll top on page change
  useEffect(() => {
    if (mainContentRef.current) {
        mainContentRef.current.scrollIntoView({ behavior: 'smooth' });
    } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentPage]);

  // Helper function to remove duplicates based on symbol and filter out blacklisted/stablecoins
  const processAssets = (assets: AssetData[]) => {
      const seenSymbols = new Set<string>();
      return assets.filter(asset => {
          // 1. Check ID Blocklist
          if (BLOCKED_IDS.has(asset.id)) return false;
          
          // 2. Check Symbol Blocklist (Stablecoins)
          const sym = asset.symbol.toLowerCase();
          if (BLOCKED_SYMBOLS.has(sym)) return false;
          if (sym.endsWith('usd') && asset.id !== 'solana' && asset.id !== 'terra-luna-2' && asset.id !== 'near') return false; 
          if (asset.name.toLowerCase().includes("stablecoin")) return false;

          // 3. Deduplication (Keep first occurrence)
          if (seenSymbols.has(sym)) return false;
          seenSymbols.add(sym);
          
          return true;
      });
  };

  // --- Data Fetching Strategy ---
  useEffect(() => {
    // 1. Non-Crypto Handling (Static Data)
    if (activeCategory === 'FOREX') {
        // Apply duplicate filter to static lists too
        let data = processAssets(FOREX_PAIRS);
        
        // In TABLE view, show removed items so they can be unblocked. In GRID view, hide them.
        if (viewMode === 'GRID') {
            data = data.filter(a => !removedIds.has(a.id));
        }
        
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
        // Apply duplicate filter to static lists too
        let data = processAssets(STOCK_DATA);

        // In TABLE view, show removed items so they can be unblocked. In GRID view, hide them.
        if (viewMode === 'GRID') {
             data = data.filter(a => !removedIds.has(a.id));
        }
        
        if (showFavoritesOnly) data = data.filter(a => favorites.has(a.id));
        if (searchQuery) {
             const q = searchQuery.toLowerCase();
             data = data.filter(a => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
        }
        setDisplayedAssets(data);
        setCryptoTotalCount(data.length);
        return;
    }

    // 2. Crypto & Gainers Handling (API)
    const controller = new AbortController();

    const fetchData = async () => {
        setLoading(true);
        setError(null);
        try {
            let data: AssetData[] = [];
            
            // CASE A: Gainers - Specific Logic to find Top Movers
            if (activeCategory === 'GAINERS') {
                // Fetch Top 750 coins (3 pages x 250) sequentially to respect rate limits
                const pages = [1, 2, 3];
                let allCoins: any[] = [];
                
                for (const p of pages) {
                    try {
                        // Check abort before fetch
                        if (controller.signal.aborted) break;
                        
                        const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${p}&sparkline=false&price_change_percentage=24h`;
                        const res = await fetch(url, { signal: controller.signal });
                        
                        if (res.status === 429) {
                            console.warn("Rate limit hit, stopping fetch");
                            break; // Stop fetching but use existing data
                        }
                        
                        if (!res.ok) continue;
                        
                        const json = await res.json();
                        if (Array.isArray(json)) {
                            allCoins = [...allCoins, ...json];
                        }
                        
                        // Small delay to prevent rate limit (free tier allows ~10-30 req/min, so bursts are bad)
                        if (p !== pages[pages.length - 1]) {
                             await new Promise(r => setTimeout(r, 1200)); 
                        }

                    } catch (e: any) {
                        if (e.name !== 'AbortError') console.error(e);
                        // If network error, stop loop
                        break; 
                    }
                }

                if (allCoins.length === 0 && !controller.signal.aborted) {
                     // Only throw if we truly have no data and it wasn't an abort
                     if (allCoins.length === 0) throw new Error("API Limit or Network Error");
                }
                
                // Process Assets: Filter Blocklist, Stablecoins, and Duplicates
                const cleanedData = processAssets(allCoins);

                // Sort by 24h change descending (GAINERS logic)
                const sorted = cleanedData.sort((a: any, b: any) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
                
                // Filter by search if needed
                let filtered = sorted;
                if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    filtered = filtered.filter((c: any) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
                }

                if (showFavoritesOnly) {
                    filtered = filtered.filter((c: any) => favorites.has(c.id));
                }

                setCryptoTotalCount(filtered.length);
                const start = (currentPage - 1) * pageSize;
                data = filtered.slice(start, start + pageSize).map((c: any) => ({ ...c, type: 'CRYPTO' }));

            // CASE B: Show Favorites Only (Standard Crypto)
            } else if (showFavoritesOnly) {
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
                
                if (Array.isArray(json)) {
                     // Process Assets: Filter Blocklist, Stablecoins, and Duplicates
                    let filtered = processAssets(json);

                    if (searchQuery) {
                        const q = searchQuery.toLowerCase();
                        filtered = filtered.filter((c: any) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
                    }
                    
                    setCryptoTotalCount(filtered.length);
                    const start = (currentPage - 1) * pageSize;
                    data = filtered.slice(start, start + pageSize).map((c: any) => ({ ...c, type: 'CRYPTO' }));
                } else {
                     data = [];
                }
            
            } else {
                // CASE C: Search Active (Rank or Text) for Standard Crypto
                const rankQuery = parseInt(searchQuery);
                
                if (!isNaN(rankQuery) && rankQuery > 0) {
                    const targetPage = Math.ceil(rankQuery / pageSize);
                    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${pageSize}&page=${targetPage}&sparkline=false&price_change_percentage=24h,7d,30d,1y`;
                    
                    const res = await fetch(url, { signal: controller.signal });
                    if (!res.ok) throw new Error("API Error");
                    const json = await res.json();
                    
                    if (Array.isArray(json)) {
                        const cleaned = processAssets(json);
                        data = cleaned.filter((c:any) => c.market_cap_rank === rankQuery).map((c: any) => ({ ...c, type: 'CRYPTO' }));
                        setCryptoTotalCount(10000); 
                    }

                } else if (searchQuery.trim().length > 0) {
                    // *** STANDARD COINGECKO SEARCH ***
                    const searchRes = await fetch(`https://api.coingecko.com/api/v3/search?query=${searchQuery}`, { signal: controller.signal });
                    const searchJson = await searchRes.json();
                    const searchCoins = searchJson.coins || [];

                    if (searchCoins.length === 0) {
                        setDisplayedAssets([]);
                        setCryptoTotalCount(0);
                        setLoading(false);
                        return;
                    }

                    // Fetch market data for found coins
                    // Use a slice of the search results to fetch market data (max page size)
                    const start = (currentPage - 1) * pageSize;
                    // Note: Search API doesn't support pagination, it returns all matches (or top matches).
                    // We simulate pagination by slicing the result array.
                    const pageCoins = searchCoins.slice(start, start + pageSize);
                    const ids = pageCoins.map((c: any) => c.id).join(',');

                    if (ids) {
                        const marketsRes = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h,7d,30d,1y`, { signal: controller.signal });
                        const marketsJson = await marketsRes.json();
                        if (Array.isArray(marketsJson)) {
                            data = processAssets(marketsJson).map((c: any) => ({ ...c, type: 'CRYPTO' }));
                            setCryptoTotalCount(searchCoins.length);
                        }
                    } else {
                        data = [];
                        setCryptoTotalCount(0);
                    }

                // CASE D: Default Market View (Paginated)
                } else {
                    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${pageSize}&page=${currentPage}&sparkline=false&price_change_percentage=24h,7d,30d,1y`;
                    const res = await fetch(url, { signal: controller.signal });
                    if (!res.ok) {
                         console.warn("Coingecko fetch failed", res.status);
                         // Don't throw if we can help it, just show empty
                         throw new Error("API Limit"); 
                    }
                    const json = await res.json();
                    
                    // CRITICAL FIX: Check if json is array. CoinGecko returns object on error (e.g. Rate Limit)
                    if (Array.isArray(json)) {
                         const cleaned = processAssets(json);
                         data = cleaned.map((c: any) => ({ ...c, type: 'CRYPTO' }));
                         setCryptoTotalCount(10000); 
                    } else {
                        console.error("Invalid API Response", json);
                        throw new Error("Invalid API Data");
                    }
                }
            }

            // In TABLE view, show removed items so they can be unblocked. In GRID view, hide them.
            if (viewMode === 'TABLE') {
                setDisplayedAssets(data);
            } else {
                setDisplayedAssets(data.filter(a => !removedIds.has(a.id)));
            }

        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error(err);
                setError("خطا در برقراری ارتباط با سرور یا محدودیت API.");
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
  }, [activeCategory, currentPage, pageSize, searchQuery, showFavoritesOnly, viewMode, removedIds]); 
  // Added viewMode and removedIds to dependency so it refetches/refilters when switching views or blocking

  // --- Helpers ---
  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return '-';
    // Handle very small prices for meme coins (e.g. 0.00000123)
    if (value < 0.01 && value > 0) {
       return '$' + value.toFixed(8).replace(/\.?0+$/, "");
    }
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
        // Sanitize symbol: Remove special chars like '-' or '.' or numbers that might confuse TV
        // e.g. "uni-v2" -> "UNIV2"
        const cleanSymbol = asset.symbol.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
        return `${cleanSymbol}USDT`;
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

  const toggleBlockStatus = (id: string) => {
    setRemovedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
          newSet.delete(id); // Unblock
      } else {
          newSet.add(id); // Block
      }
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

  // Sorting Helper
  const handleSort = (key: keyof AssetData) => {
    setSortConfig(current => {
        // If clicking the same key, toggle direction
        if (current.key === key) {
             // If currently desc, go to asc
             return { key, direction: current.direction === 'desc' ? 'asc' : 'desc' };
        }
        // New key, default to desc for metrics, asc for rank
        // Others (Price, Vol, Change) -> Descending (High to Low)
        const defaultDir = key === 'market_cap_rank' ? 'asc' : 'desc';
        return { key, direction: defaultDir };
    });
  };

  const getSortIndicator = (key: keyof AssetData) => {
    if (sortConfig.key !== key) return <span className="text-gray-300 text-xs ml-1 opacity-0 group-hover:opacity-50 transition-opacity">⇅</span>;
    return <span className="text-blue-600 text-xs ml-1">{sortConfig.direction === 'asc' ? '↑' : '↓'}</span>;
  };

  // Memoized sorted data
  const sortedAssets = useMemo(() => {
    let data = [...displayedAssets];
    if (sortConfig.key) {
        data.sort((a, b) => {
            // Handle potential undefined/null values safely
            const valA = (a[sortConfig.key!] as number) ?? (sortConfig.direction === 'asc' ? Infinity : -Infinity);
            const valB = (b[sortConfig.key!] as number) ?? (sortConfig.direction === 'asc' ? Infinity : -Infinity);
            
            if (sortConfig.direction === 'asc') return valA - valB;
            return valB - valA;
        });
    }
    return data;
  }, [displayedAssets, sortConfig]);

  const handleSaveLayout = () => {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(Array.from(removedIds)));
    alert("چیدمان فعلی ذخیره شد.");
  };

  const handleResetLayout = () => {
      if (window.confirm("بازنشانی کامل (برگشت همه ارزهای حذف شده)؟")) {
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

  // --- Gemini AI Insight Fetcher ---
  const fetchInsight = async (asset: AssetData) => {
    if (insights[asset.id]) return; // Already cached

    if (!process.env.API_KEY) {
        console.error("Gemini API Key is missing. Ensure process.env.API_KEY is set in your build/deployment environment.");
        alert("کلید API جمنای تنظیم نشده است. لطفا تنظیمات محیطی سایت را بررسی کنید.");
        return;
    }

    setInsightLoading(asset.id);
    try {
        const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
        const prompt = `Analyze the cryptocurrency "${asset.name}" (${asset.symbol}).
        Provide a JSON response in Persian (Farsi) with these fields:
        - category: A short category name (e.g., L1, Meme, AI, DeFi).
        - utility: A brief explanation of its main use case and technology (approx 2 sentences).
        - outlook: A brief analysis of its future potential and investment risks (approx 2 sentences).
        Keep the tone professional and informative.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                responseMimeType: 'application/json',
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        category: { type: Type.STRING },
                        utility: { type: Type.STRING },
                        outlook: { type: Type.STRING },
                    },
                    required: ['category', 'utility', 'outlook']
                }
            }
        });

        let text = response.text || "{}";
        // Clean Markdown code blocks if present (common issue with Gemini responses)
        text = text.replace(/^```json\s*/, "").replace(/```$/, "").trim();

        if (text) {
            const data = JSON.parse(text);
            setInsights(prev => ({ ...prev, [asset.id]: data }));
        }
    } catch (e) {
        console.error("AI Insight Error", e);
    } finally {
        setInsightLoading(null);
    }
  };

  const handleInfoClick = (asset: AssetData) => {
      toggleChartMode(asset.id, 'INFO');
      fetchInsight(asset);
  };

  const getImage = (asset: AssetData) => {
      if (asset.image) return asset.image;
      if (asset.type === 'FOREX') return 'https://img.icons8.com/color/48/currency-exchange.png';
      if (asset.type === 'STOCKS') return 'https://img.icons8.com/color/48/bullish.png';
      return '';
  };
  
  const toggleFullscreen = (elementId: string) => {
      const element = document.getElementById(elementId);
      if (!element) return;
      
      if (!document.fullscreenElement) {
          element.requestFullscreen().catch((err) => {
              console.error(`Error attempting to enable full-screen mode: ${err.message}`);
          });
      } else {
          document.exitFullscreen();
      }
  };

  const removeAsset = (id: string) => {
      toggleBlockStatus(id);
  };
  
  // Smart Card Height Logic using viewport height (100vh) to avoid page scrolling for the card itself
  // Adjusts to fill the screen minus header and padding
  const cardHeightClass = 'h-[calc(100vh-140px)] min-h-[500px]';

  // Helper variables
  const totalPages = Math.ceil(cryptoTotalCount / pageSize);

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gray-50 text-right">
      {/* Header */}
      <header className="bg-white shadow-sm z-20 sticky top-0 border-b border-gray-200">
        <div className="max-w-[1920px] mx-auto px-4 py-3">
          <div className="flex flex-col xl:flex-row justify-between items-center gap-4">
            
            {/* Left: Title & Search */}
            <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
              <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2 whitespace-nowrap">
                <span className="text-blue-600">₿</span>
                بازار مالی
              </h1>

              {/* Category Tabs */}
              <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg overflow-x-auto max-w-[100vw] md:max-w-none">
                <button 
                  onClick={() => setActiveCategory('CRYPTO')} 
                  className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${activeCategory === 'CRYPTO' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  کریپتو
                </button>
                <button 
                  onClick={() => setActiveCategory('GAINERS')} 
                  className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${activeCategory === 'GAINERS' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-green-600'}`}
                >
                  بیشترین سود
                </button>
                <button 
                  onClick={() => setActiveCategory('FOREX')} 
                  className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${activeCategory === 'FOREX' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  فارکس
                </button>
                <button 
                  onClick={() => setActiveCategory('STOCKS')} 
                  className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${activeCategory === 'STOCKS' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                >
                  بازار سهام
                </button>
              </div>
              
              {/* Search Box */}
              <div className="relative w-full md:w-56">
                <input 
                    type="text" 
                    placeholder="جستجو (نام، نماد یا رتبه)..." 
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
              
              {/* View Toggle Button */}
               <button 
                  onClick={() => setViewMode(viewMode === 'GRID' ? 'TABLE' : 'GRID')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm border ${viewMode === 'TABLE' 
                      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
               >
                  {viewMode === 'GRID' ? '📋 لیست ارزها و مسدودی' : '📊 نمای چارت‌ها'}
               </button>

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

              {viewMode === 'GRID' && (
                <>
                  <div className="h-6 w-px bg-gray-300 hidden md:block" />
                  {/* Grid Columns Selector */}
                  <div className="flex items-center gap-1 bg-gray-50 px-2 py-1 rounded-lg border border-gray-200">
                     <span className="text-xs text-gray-500 uppercase">ستون:</span>
                     <select 
                        value={gridCols} 
                        onChange={(e) => setGridCols(Number(e.target.value))}
                        className="bg-transparent text-sm font-semibold outline-none text-gray-700"
                      >
                        <option value={1}>1</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                      </select>
                  </div>
                </>
              )}

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

              {/* Settings Action Buttons */}
              <div className="flex items-center gap-1">
                <button 
                    onClick={handleSaveLayout} 
                    title="ذخیره چیدمان"
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                >
                    💾
                </button>
                <button 
                    onClick={handleResetLayout} 
                    title="بازنشانی"
                    className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                >
                    🔄
                </button>
                <button 
                    onClick={handleExportBackup} 
                    title="دانلود بکاپ"
                    className="p-2 text-gray-600 hover:text-green-600 hover:bg-green-50 rounded-lg transition-colors border border-transparent hover:border-green-100"
                >
                    ⬇️
                </button>
                <label 
                    title="ریستور بکاپ"
                    className="p-2 text-gray-600 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors border border-transparent hover:border-purple-100 cursor-pointer"
                >
                    ⬆️
                    <input type="file" className="hidden" ref={fileInputRef} onChange={handleImportBackup} accept=".json" />
                </label>
              </div>

            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main ref={mainContentRef} className="flex-grow p-4 md:p-6 bg-gray-50">
        
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

        {(!loading && sortedAssets.length === 0) ? (
            <div className="flex flex-col items-center justify-center h-96 text-center">
                <p className="text-gray-500 text-lg">موردی یافت نشد.</p>
                {searchQuery && <p className="text-gray-400 mt-2">برای "{searchQuery}" نتیجه‌ای پیدا نشد.</p>}
            </div>
        ) : (
            <>
               {/* --- GRID VIEW (Default) --- */}
               {viewMode === 'GRID' && (
                  <div className={`grid gap-6 ${
                    gridCols === 1 ? 'grid-cols-1' : 
                    gridCols === 2 ? 'grid-cols-1 md:grid-cols-2' : 
                    'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
                  }`}>
                    {sortedAssets.map((asset) => {
                        const hasDetails = asset.type === 'CRYPTO';
                        // Calculate "To ATH" percentage if applicable
                        const toAth = asset.ath && asset.current_price ? ((asset.ath - asset.current_price) / asset.current_price) * 100 : 0;
                        const currentChartMode = chartModes[asset.id] || 'PRICE';
                        const tvSymbol = currentChartMode === 'PRICE' 
                            ? getTradingViewSymbol(asset) 
                            : `CRYPTOCAP:${asset.symbol.toUpperCase()}`;
                        
                        const insight = insights[asset.id];
                        const isLoadingInsight = insightLoading === asset.id;

                        return (
                      <div 
                        id={`card-${asset.id}`}
                        key={asset.id} 
                        style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 500px' }}
                        className={`bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden flex flex-col ${cardHeightClass} transition-all hover:shadow-md`}
                      >
                        {/* 1. Header */}
                        <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-white shrink-0">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <img src={getImage(asset)} alt={asset.name} className="w-10 h-10 rounded-full object-contain flex-shrink-0" loading="lazy" onError={(e) => (e.currentTarget.style.display = 'none')} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                 <h3 className="font-bold text-gray-800 text-2xl truncate">{asset.symbol.split(':').pop()?.toUpperCase()}</h3>
                                 <CopyButton text={asset.symbol.split(':').pop()?.toUpperCase() || ''} />
                                 {hasDetails && (
                                   <span className="text-base text-gray-500 bg-gray-100 px-2 py-0.5 rounded font-medium flex-shrink-0">
                                      #{asset.market_cap_rank || '-'}
                                   </span>
                                 )}
                                 {!hasDetails && (
                                   <span className="text-sm text-gray-400 bg-gray-50 px-1 py-0.5 rounded uppercase flex-shrink-0">{asset.type}</span>
                                 )}
                              </div>
                              <p className="text-base font-bold text-gray-500 truncate max-w-[200px]">{asset.name}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center flex-shrink-0 gap-1">
                            <button 
                              onClick={() => toggleFavorite(asset.id)}
                              className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${favorites.has(asset.id) ? 'text-yellow-400' : 'text-gray-300'}`}
                            >
                               <span className="text-2xl">★</span>
                            </button>
                            <button 
                              onClick={() => toggleFullscreen(`card-${asset.id}`)}
                              className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                            >
                              <span className="text-2xl">⛶</span>
                            </button>
                            <button 
                              onClick={() => removeAsset(asset.id)}
                              className="p-2 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                            >
                              <span className="text-2xl">✕</span>
                            </button>
                          </div>
                        </div>

                        {/* 2. Primary Stats */}
                        {hasDetails && (
                            <div className="px-5 py-4 bg-gray-50 flex justify-between items-center border-b border-gray-100 shrink-0 h-[65px]">
                               <div className="flex items-center gap-1">
                                  <span className="text-gray-800 font-bold text-3xl">{formatCurrency(asset.current_price)}</span>
                                </div>
                               <div className="flex items-center gap-1">
                                  <span className={`font-bold text-lg ${getPercentClass(asset.price_change_percentage_24h)} dir-ltr`}>
                                      {fmtPct(asset.price_change_percentage_24h)} (24h)
                                  </span>
                               </div>
                            </div>
                        )}

                        {/* 3. Detailed Stats */}
                        {hasDetails ? (
                            <div className="grid grid-cols-3 gap-x-4 gap-y-2 p-4 text-base bg-white border-b border-gray-100 text-gray-600 shrink-0 h-[140px]">
                                {/* Column 1: Historical Changes */}
                                <div className="flex flex-col gap-1.5">
                                    <div className="flex justify-between">
                                        <span className="font-semibold text-gray-600">7d:</span>
                                        <span className={`font-bold ${getPercentClass(asset.price_change_percentage_7d_in_currency)}`}>{fmtPct(asset.price_change_percentage_7d_in_currency)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-semibold text-gray-600">30d:</span>
                                        <span className={`font-bold ${getPercentClass(asset.price_change_percentage_30d_in_currency)}`}>{fmtPct(asset.price_change_percentage_30d_in_currency)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-semibold text-gray-600">1y:</span>
                                        <span className={`font-bold ${getPercentClass(asset.price_change_percentage_1y_in_currency)}`}>{fmtPct(asset.price_change_percentage_1y_in_currency)}</span>
                                    </div>
                                </div>

                                {/* Column 2: ATH Data */}
                                <div className="flex flex-col gap-1.5 border-l border-gray-100 pl-3">
                                    <div className="flex justify-between" title="All Time High Price">
                                        <span className="font-semibold text-gray-600">ATH:</span>
                                        <span className="font-bold text-gray-700">{formatCompact(asset.ath)}</span>
                                    </div>
                                    <div className="flex justify-between" title="Down from ATH">
                                        <span className="font-semibold text-gray-600">Drop:</span>
                                        <span className="font-bold text-red-500">{fmtPct(asset.ath_change_percentage)}</span>
                                    </div>
                                    <div className="flex justify-between" title="Needed to reach ATH">
                                        <span className="font-semibold text-gray-600">To ATH:</span>
                                        <span className="font-bold text-green-600">+{toAth.toFixed(0)}%</span>
                                    </div>
                                </div>

                                {/* Column 3: Market Data */}
                                <div className="flex flex-col gap-1.5 border-l border-gray-100 pl-3">
                                     <div className="flex justify-between">
                                        <span className="font-semibold text-gray-600">Cap:</span>
                                        <span className="font-bold text-gray-700">{formatCompact(asset.market_cap)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-semibold text-gray-600">Vol:</span>
                                        <span className="font-bold text-gray-700">{formatCompact(asset.total_volume)}</span>
                                    </div>
                                    <div className="flex justify-between" title={`H: ${formatCurrency(asset.high_24h)} L: ${formatCurrency(asset.low_24h)}`}>
                                        <span className="font-semibold text-gray-600">H/L:</span>
                                        <span className="font-bold text-gray-500">Info</span>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            // Description for non-crypto assets
                            <div className="px-5 py-4 bg-white border-b border-gray-100 shrink-0 h-[120px] overflow-hidden">
                                <p className="text-base text-gray-500 leading-relaxed text-right line-clamp-4">
                                    {asset.description || 'اطلاعات بیشتری در دسترس نیست.'}
                                </p>
                            </div>
                        )}

                        {/* Action Buttons */}
                        {hasDetails && (
                            <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex flex-col gap-2 shrink-0">
                                {/* External Links */}
                                <div className="flex items-center gap-2">
                                    <a 
                                        href={`https://www.coingecko.com/en/coins/${asset.id}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex-1 text-center py-1.5 rounded bg-white border border-gray-200 text-[10px] md:text-xs font-bold text-gray-600 hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-all shadow-sm truncate"
                                        title="مشاهده در CoinGecko"
                                    >
                                        CoinGecko
                                    </a>
                                    <a 
                                        href={`https://coinmarketcap.com/currencies/${asset.name.trim().toLowerCase().replace(/\s+/g, '-')}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex-1 text-center py-1.5 rounded bg-white border border-gray-200 text-[10px] md:text-xs font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all shadow-sm truncate"
                                        title="مشاهده در CoinMarketCap"
                                    >
                                        CoinMarketCap
                                    </a>
                                    <a 
                                        href="https://app.cryptopective.com/" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex-1 text-center py-1.5 rounded bg-blue-600 border border-blue-600 text-[10px] md:text-xs font-bold text-white hover:bg-blue-700 hover:border-blue-700 transition-all shadow-sm truncate"
                                        title="تحلیل در CryptoPective"
                                    >
                                        CryptoPective
                                    </a>
                                </div>
                                {/* Chart Toggle */}
                                <div className="flex bg-gray-100 rounded-lg p-0.5 w-full">
                                    <button 
                                        onClick={() => toggleChartMode(asset.id, 'PRICE')}
                                        className={`flex-1 py-1 rounded-md text-xs font-bold transition-all ${currentChartMode === 'PRICE' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        قیمت (Price)
                                    </button>
                                    <button 
                                        onClick={() => toggleChartMode(asset.id, 'MCAP')}
                                        className={`flex-1 py-1 rounded-md text-xs font-bold transition-all ${currentChartMode === 'MCAP' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        ارزش بازار
                                    </button>
                                    <button 
                                        onClick={() => toggleChartMode(asset.id, 'BOTH')}
                                        className={`flex-1 py-1 rounded-md text-xs font-bold transition-all ${currentChartMode === 'BOTH' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        همزمان
                                    </button>
                                    <button 
                                        onClick={() => handleInfoClick(asset)}
                                        className={`flex-1 py-1 rounded-md text-xs font-bold transition-all ${currentChartMode === 'INFO' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-purple-600'}`}
                                    >
                                        تحلیل (Info)
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 4. Chart or Info Content */}
                        <div className="flex-grow bg-white relative w-full h-full min-h-0">
                          {currentChartMode === 'INFO' ? (
                            <div className="p-6 h-full overflow-y-auto custom-scrollbar bg-white">
                                <div className="flex flex-col gap-6">
                                    {isLoadingInsight ? (
                                        <div className="flex flex-col items-center justify-center h-full gap-4">
                                            <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                                            <p className="text-purple-600 font-medium animate-pulse">درحال دریافت تحلیل از هوش مصنوعی...</p>
                                        </div>
                                    ) : insight ? (
                                        <>
                                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 animate-[fadeIn_0.5s_ease-out]">
                                                <h4 className="text-purple-800 font-bold mb-2 flex items-center gap-2">
                                                    <span className="text-xl">📂</span> دسته‌بندی
                                                </h4>
                                                <p className="text-gray-700 font-medium leading-relaxed">{insight.category}</p>
                                            </div>

                                            <div className="animate-[fadeIn_0.6s_ease-out]">
                                                <h4 className="text-gray-800 font-bold mb-2 flex items-center gap-2">
                                                    <span className="text-xl">🛠️</span> کاربرد و هدف پروژه
                                                </h4>
                                                <p className="text-gray-600 leading-loose text-justify">{insight.utility}</p>
                                            </div>

                                            <div className="animate-[fadeIn_0.7s_ease-out]">
                                                <h4 className="text-gray-800 font-bold mb-2 flex items-center gap-2">
                                                    <span className="text-xl">🚀</span> آینده و پتانسیل رشد
                                                </h4>
                                                <p className="text-gray-600 leading-loose text-justify">{insight.outlook}</p>
                                            </div>
                                            <div className="text-[10px] text-gray-400 text-center mt-4">
                                                * تحلیل توسط هوش مصنوعی Gemini تولید شده است.
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-70">
                                            <span className="text-4xl mb-4">⚠️</span>
                                            <p className="text-gray-500 font-medium">خطا در دریافت اطلاعات. لطفا دوباره تلاش کنید.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                          ) : currentChartMode === 'BOTH' ? (
                            <div className="flex flex-col md:flex-row h-full w-full">
                                <div className="h-1/2 w-full md:h-full md:w-1/2 border-b md:border-b-0 md:border-r border-gray-200 relative">
                                    <div className="absolute top-2 left-2 z-10 bg-white/90 px-2 py-0.5 rounded text-[10px] font-bold text-gray-500 shadow-sm pointer-events-none border border-gray-100">
                                        قیمت (Price)
                                    </div>
                                    <LazyWidget>
                                        <TradingViewWidget 
                                            symbol={getTradingViewSymbol(asset)} 
                                            isLogScale={isLogScale}
                                            interval={interval}
                                        />
                                    </LazyWidget>
                                </div>
                                <div className="h-1/2 w-full md:h-full md:w-1/2 relative">
                                    <div className="absolute top-2 left-2 z-10 bg-white/90 px-2 py-0.5 rounded text-[10px] font-bold text-gray-500 shadow-sm pointer-events-none border border-gray-100">
                                         ارزش بازار (Market Cap)
                                    </div>
                                    <LazyWidget>
                                        <TradingViewWidget 
                                            symbol={`CRYPTOCAP:${asset.symbol.toUpperCase()}`} 
                                            isLogScale={isLogScale}
                                            interval={interval}
                                        />
                                    </LazyWidget>
                                </div>
                            </div>
                          ) : (
                              <LazyWidget>
                                  <TradingViewWidget 
                                    symbol={tvSymbol} 
                                    isLogScale={isLogScale}
                                    interval={interval}
                                  />
                              </LazyWidget>
                          )}
                        </div>
                      </div>
                    )})}
                  </div>
               )}

               {/* --- TABLE VIEW (CoinGecko Style) --- */}
               {viewMode === 'TABLE' && (
                <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full text-right text-base">
                            <thead className="bg-gray-50 text-gray-600 font-bold text-sm uppercase border-b border-gray-200 sticky top-0 z-10 select-none">
                                <tr>
                                    <th 
                                      className="px-4 py-4 whitespace-nowrap w-20 cursor-pointer hover:bg-gray-100 transition-colors group"
                                      onClick={() => handleSort('market_cap_rank')}
                                      title="مرتب‌سازی بر اساس رنک (حالت پیش‌فرض)"
                                    >
                                      # {getSortIndicator('market_cap_rank')}
                                    </th>
                                    <th className="px-4 py-4 text-right">نام ارز</th>
                                    <th className="px-4 py-4 text-right">قیمت</th>
                                    <th 
                                      className="px-4 py-4 text-right cursor-pointer hover:bg-gray-100 transition-colors group"
                                      onClick={() => handleSort('price_change_percentage_24h')}
                                    >
                                      24h {getSortIndicator('price_change_percentage_24h')}
                                    </th>
                                    <th 
                                      className="px-4 py-4 text-right cursor-pointer hover:bg-gray-100 transition-colors group"
                                      onClick={() => handleSort('price_change_percentage_7d_in_currency')}
                                    >
                                      7d {getSortIndicator('price_change_percentage_7d_in_currency')}
                                    </th>
                                    <th 
                                      className="px-4 py-4 text-right cursor-pointer hover:bg-gray-100 transition-colors group"
                                      onClick={() => handleSort('market_cap')}
                                    >
                                      ارزش بازار {getSortIndicator('market_cap')}
                                    </th>
                                    <th 
                                      className="px-4 py-4 text-right cursor-pointer hover:bg-gray-100 transition-colors group"
                                      onClick={() => handleSort('total_volume')}
                                    >
                                      حجم {getSortIndicator('total_volume')}
                                    </th>
                                    <th className="px-4 py-4 text-center w-24 bg-gray-100 text-gray-700 border-r">مسدودی</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {sortedAssets.map((asset) => {
                                    const isBlocked = removedIds.has(asset.id);
                                    const isExpanded = expandedRowId === asset.id;
                                    const currentChartMode = chartModes[asset.id] || 'PRICE';
                                    const tvSymbol = currentChartMode === 'PRICE' 
                                        ? getTradingViewSymbol(asset) 
                                        : `CRYPTOCAP:${asset.symbol.toUpperCase()}`;
                                    
                                    const insight = insights[asset.id];
                                    const isLoadingInsight = insightLoading === asset.id;
                                    
                                    // Row styling: active state for expanded row
                                    const rowClass = isBlocked 
                                        ? "bg-red-50 hover:bg-red-100 transition-colors border-b border-gray-100" 
                                        : isExpanded
                                            ? "bg-blue-50 border-b-0 border-gray-100 cursor-pointer"
                                            : "bg-white hover:bg-gray-50 transition-colors border-b border-gray-100 cursor-pointer group";

                                    return (
                                        <React.Fragment key={asset.id}>
                                            <tr 
                                                className={rowClass}
                                                onClick={(e) => {
                                                    if ((e.target as HTMLElement).closest('.no-click')) return;
                                                    setExpandedRowId(prev => prev === asset.id ? null : asset.id);
                                                }}
                                            >
                                                <td className="px-4 py-5 whitespace-nowrap text-gray-500 font-medium text-lg no-click cursor-default">
                                                    <div className="flex items-center gap-3">
                                                        <button 
                                                            onClick={(e) => { e.stopPropagation(); toggleFavorite(asset.id); }}
                                                            className={`text-2xl transition-colors ${favorites.has(asset.id) ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`}
                                                        >
                                                            ★
                                                        </button>
                                                        <span>
                                                            {asset.market_cap_rank || '-'}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-5">
                                                    <div className="flex items-center gap-4">
                                                        <img src={getImage(asset)} alt={asset.name} className="w-8 h-8 rounded-full" loading="lazy" />
                                                        <div className="flex flex-col">
                                                            <div className="flex items-center gap-2">
                                                                <span className="font-bold text-gray-900 text-lg group-hover:text-blue-600 transition-colors">{asset.name}</span>
                                                                <CopyButton text={asset.symbol.split(':').pop()?.toUpperCase() || ''} />
                                                            </div>
                                                            <span className="text-sm text-gray-500 uppercase">{asset.symbol.split(':').pop()}</span>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-5 font-bold text-gray-900 text-lg">
                                                    {formatCurrency(asset.current_price)}
                                                </td>
                                                <td className={`px-4 py-5 font-bold text-lg dir-ltr text-right ${getPercentClass(asset.price_change_percentage_24h)}`}>
                                                    {fmtPct(asset.price_change_percentage_24h)}
                                                </td>
                                                <td className={`px-4 py-5 font-bold text-lg dir-ltr text-right ${getPercentClass(asset.price_change_percentage_7d_in_currency)}`}>
                                                    {fmtPct(asset.price_change_percentage_7d_in_currency)}
                                                </td>
                                                <td className="px-4 py-5 text-gray-600 text-lg">
                                                    {formatCompact(asset.market_cap)}
                                                </td>
                                                <td className="px-4 py-5 text-gray-600 text-lg">
                                                    {formatCompact(asset.total_volume)}
                                                </td>
                                                <td className="px-4 py-5 text-center border-r border-gray-100 no-click">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isBlocked}
                                                        onChange={() => toggleBlockStatus(asset.id)}
                                                        className="w-6 h-6 text-red-600 rounded border-gray-300 focus:ring-red-500 cursor-pointer"
                                                        title={isBlocked ? "بازگردانی به لیست" : "مسدود کردن"}
                                                        onClick={(e) => e.stopPropagation()}
                                                    />
                                                </td>
                                            </tr>
                                            {/* Expanded Row */}
                                            {isExpanded && (
                                                <tr>
                                                    <td colSpan={8} className="p-0 border-b border-gray-200 animate-[fadeIn_0.3s_ease-out]">
                                                         <div className="w-full h-[1000px] bg-white relative border-t border-blue-100 shadow-inner flex flex-col">
                                                            {/* Close Button overlay */}
                                                            <button 
                                                                onClick={(e) => { e.stopPropagation(); setExpandedRowId(null); }}
                                                                className="absolute top-4 left-4 z-20 bg-white text-gray-400 hover:text-red-600 border border-gray-200 rounded-lg p-2 shadow-sm transition-all hover:scale-105"
                                                            >
                                                                بستن ✕
                                                            </button>

                                                            {/* Controls Bar for Table Expanded */}
                                                            <div className="flex items-center justify-center gap-4 py-2 bg-gray-50 border-b border-gray-200 z-10">
                                                                <span className="text-sm font-bold text-gray-700">نمودار:</span>
                                                                <div className="flex bg-white rounded-lg p-1 border border-gray-200 shadow-sm">
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); toggleChartMode(asset.id, 'PRICE'); }}
                                                                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${currentChartMode === 'PRICE' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:bg-gray-100'}`}
                                                                    >
                                                                        قیمت
                                                                    </button>
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); toggleChartMode(asset.id, 'MCAP'); }}
                                                                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${currentChartMode === 'MCAP' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-100'}`}
                                                                    >
                                                                        ارزش بازار
                                                                    </button>
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); toggleChartMode(asset.id, 'BOTH'); }}
                                                                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${currentChartMode === 'BOTH' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-100'}`}
                                                                    >
                                                                        همزمان
                                                                    </button>
                                                                    <button 
                                                                        onClick={(e) => { e.stopPropagation(); handleInfoClick(asset); }}
                                                                        className={`px-4 py-1.5 rounded-md text-sm font-bold transition-all ${currentChartMode === 'INFO' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-purple-600'}`}
                                                                    >
                                                                        تحلیل
                                                                    </button>
                                                                </div>
                                                            </div>

                                                            {/* Chart or Info Content for Table View */}
                                                            <div className="flex-grow relative">
                                                                {currentChartMode === 'INFO' ? (
                                                                     <div className="p-6 h-full overflow-y-auto custom-scrollbar bg-white max-w-4xl mx-auto">
                                                                        <div className="flex flex-col gap-6">
                                                                            {isLoadingInsight ? (
                                                                                <div className="flex flex-col items-center justify-center h-full gap-4">
                                                                                    <div className="w-8 h-8 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
                                                                                    <p className="text-purple-600 font-medium animate-pulse">درحال دریافت تحلیل از هوش مصنوعی...</p>
                                                                                </div>
                                                                            ) : insight ? (
                                                                                <>
                                                                                    <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 animate-[fadeIn_0.5s_ease-out]">
                                                                                        <h4 className="text-purple-800 font-bold mb-2 flex items-center gap-2">
                                                                                            <span className="text-xl">📂</span> دسته‌بندی
                                                                                        </h4>
                                                                                        <p className="text-gray-700 font-medium leading-relaxed">{insight.category}</p>
                                                                                    </div>

                                                                                    <div className="animate-[fadeIn_0.6s_ease-out]">
                                                                                        <h4 className="text-gray-800 font-bold mb-2 flex items-center gap-2">
                                                                                            <span className="text-xl">🛠️</span> کاربرد و هدف پروژه
                                                                                        </h4>
                                                                                        <p className="text-gray-600 leading-loose text-justify">{insight.utility}</p>
                                                                                    </div>

                                                                                    <div className="animate-[fadeIn_0.7s_ease-out]">
                                                                                        <h4 className="text-gray-800 font-bold mb-2 flex items-center gap-2">
                                                                                            <span className="text-xl">🚀</span> آینده و پتانسیل رشد
                                                                                        </h4>
                                                                                        <p className="text-gray-600 leading-loose text-justify">{insight.outlook}</p>
                                                                                    </div>
                                                                                    <div className="text-[10px] text-gray-400 text-center mt-4">
                                                                                        * تحلیل توسط هوش مصنوعی Gemini تولید شده است.
                                                                                    </div>
                                                                                </>
                                                                            ) : (
                                                                                <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-70">
                                                                                    <span className="text-4xl mb-4">⚠️</span>
                                                                                    <p className="text-gray-500 font-medium">خطا در دریافت اطلاعات. لطفا دوباره تلاش کنید.</p>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ) : currentChartMode === 'BOTH' ? (
                                                                    <div className="flex flex-col md:flex-row h-full w-full">
                                                                        <div className="h-1/2 w-full md:h-full md:w-1/2 border-b md:border-b-0 md:border-r border-gray-200 relative">
                                                                            <div className="absolute top-2 left-2 z-10 bg-white/90 px-2 py-0.5 rounded text-[10px] font-bold text-gray-500 shadow-sm pointer-events-none border border-gray-100">
                                                                                قیمت (Price)
                                                                            </div>
                                                                            <LazyWidget>
                                                                                <TradingViewWidget 
                                                                                    symbol={getTradingViewSymbol(asset)} 
                                                                                    isLogScale={isLogScale}
                                                                                    interval={interval}
                                                                                />
                                                                            </LazyWidget>
                                                                        </div>
                                                                        <div className="h-1/2 w-full md:h-full md:w-1/2 relative">
                                                                            <div className="absolute top-2 left-2 z-10 bg-white/90 px-2 py-0.5 rounded text-[10px] font-bold text-gray-500 shadow-sm pointer-events-none border border-gray-100">
                                                                                 ارزش بازار (Market Cap)
                                                                            </div>
                                                                            <LazyWidget>
                                                                                <TradingViewWidget 
                                                                                    symbol={`CRYPTOCAP:${asset.symbol.toUpperCase()}`} 
                                                                                    isLogScale={isLogScale}
                                                                                    interval={interval}
                                                                                />
                                                                            </LazyWidget>
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <LazyWidget>
                                                                        <TradingViewWidget 
                                                                            symbol={tvSymbol} 
                                                                            isLogScale={isLogScale}
                                                                            interval={interval}
                                                                        />
                                                                    </LazyWidget>
                                                                )}
                                                            </div>
                                                         </div>
                                                    </td>
                                                </tr>
                                            )}
                                        </React.Fragment>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
               )}

                {/* Pagination Controls */}
                <div className="mt-8 flex flex-col items-center gap-4">
                    <span className="text-base text-gray-500">
                        نمایش {((currentPage - 1) * pageSize) + 1} تا {Math.min(currentPage * pageSize, cryptoTotalCount)} از {cryptoTotalCount} مورد
                    </span>
                    <div className="flex items-center gap-2 bg-white p-2 rounded-lg shadow-sm border border-gray-200">
                        <button 
                            onClick={() => setCurrentPage(1)} 
                            disabled={currentPage === 1}
                            className="px-4 py-2 text-base rounded bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
                        >
                            اولین
                        </button>
                        <button 
                            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))} 
                            disabled={currentPage === 1}
                            className="px-4 py-2 text-base rounded bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
                        >
                            قبلی
                        </button>
                        
                        <div className="px-5 py-2 text-base font-semibold text-blue-600 bg-blue-50 rounded">
                            صفحه {currentPage} از {totalPages || 1}
                        </div>

                        <button 
                            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))} 
                            disabled={currentPage >= totalPages}
                            className="px-4 py-2 text-base rounded bg-gray-50 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-600"
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