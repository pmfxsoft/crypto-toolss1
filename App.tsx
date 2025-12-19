import React, { useState, useEffect, useRef, useMemo } from 'react';
import TradingViewWidget from './components/TradingViewWidget';
import { auth, db } from './firebase';
import { signInAnonymously, onAuthStateChanged } from 'firebase/auth';
import { doc, onSnapshot, setDoc } from 'firebase/firestore';

// --- Types ---
type Category = 'CRYPTO' | 'FOREX' | 'STOCKS' | 'GAINERS' | 'ATH';
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
  total_supply?: number;
  circulating_supply?: number;
}

interface CoinInsight {
  category: string;
  utility: string;
  outlook: string;
}

// --- Configuration ---
const BLOCKED_IDS = new Set([
  // Original Blocks (Stablecoins & Wrappers)
  'tether', 'usd-coin', 'dai', 'first-digital-usd', 'ethena-usde', 
  'usdd', 'true-usd', 'frax', 'wrapped-steth', 
  'staked-ether', 'wrapped-bitcoin', 'weth', 'lido-staked-ether',
  'paypal-usd', 'paxos-standard', 'gemini-dollar', 'binance-usd',
  
  // User Added Blocks
  'figure-heloc',
  'wrapped-beacon-eth',
  'usds',
  'wrapped-eeth',
  'coinbase-wrapped-btc',
  'susds',
  'usdt0',
  'ethena-staked-usde',
  'usd1-wlfi',
  'falcon-finance',
  'binance-peg-weth',
  'blackrock-usd-institutional-digital-liquidity-fund',
  'syrupusdc',
  'hash-2',
  'global-dollar',
  'hashnote-usyc',
  'syrupusdt',
  'rocket-pool-eth',
  'wbnb',
  'kelp-dao-restaked-eth',
  'ignition-fbtc',
  'lombard-staked-btc',
  'liquid-staked-ethereum',
  'solv-btc',
  'superstate-short-duration-us-government-securities-fund-ustb',
  'usdtb',
  'ousg',
  'janus-henderson-anemoy-aaa-clo-fund',
  'kinetic-staked-hype',
  'ondo-us-dollar-yield',
  'clbtc',
  'bridged-usdc-polygon-pos-bridge',
  'usdai',
  'renzo-restaked-eth',
  'wrapped-flare',
  'l2-standard-bridged-weth-base',
  'jupiter-staked-sol',
  'stakewise-v3-oseth',
  'usual-usd',
  'tbtc',
  'cgeth-hashkey-cloud',
  'eutbl',
  'gho',
  'stader-ethx',
  'ether-fi-liquid-eth',
  'wrapped-apecoin',
  'usdb',
  'sweth',
  'steakhouse-usdc-morpho-vault',
  'lorenzo-wrapped-bitcoin',
  'sbtc-2',
  'coinbase-wrapped-staked-eth',
  'olympus',
  'bitcoin-avalanche-bridged-btc-b',
  'euro-coin',
  'binance-peg-dogecoin',
  'kinesis-gold',
  'usx',
  'ether-fi-staked-eth',
  'resolv-usr',
  'resolv-wstusr',
  'benqi-liquid-staked-avax',
  'arbitrum-bridged-wrapped-eeth',
  'unit-bitcoin',
  'mantle-restaked-eth',
  'astherus-staked-bnb',
  'polygon-pos-bridged-weth-polygon-pos',
  'swissborg',
  'frax-ether',
  'wrapped-stx-velar',
  'wrapped-hype',
  'fidelity-digital-interest-token',
  'janus-henderson-anemoy-treasury-fund',
  'gate-wrapped-btc',
  'mimblewimblecoin',
  'binance-wrapped-btc',
  'ibc-bridged-usdc',
  'wrapped-aave-ethereum-usdc',
  'build-on',
  'susdai',
  'drift-staked-sol',
  'usda-2',
  'ylds',
  'savings-dai',
  'wrapped-avax',
  'blockchain-capital',
  'cheems-token',
  'polygon-bridged-wbtc-polygon-pos',
  'treehouse-eth',
  'ethena-staked-ena',
  'btse-token',
  'tradable-na-rent-financing-platform-sstn',
  'theo-short-duration-us-treasury-fund',
  'sky-coin',
  'solv-protocol-solvbtc-bbn',
  'astherus-usdf',
  'staked-frax-ether',
  'bnb48-club-token',
  'kraken-wrapped-btc',
  'meta-2-2',
  'flare-bridged-xrp-flare',
  'spiko-us-t-bills-money-market-fund',
  'wrapped-aave-ethereum-usdt',
  'midas-mf-one',
  'wrapped-ethereum-sollet',
  'stasis-eurs',
  'origin-ether',
  'bedrock-btc',
  'binance-peg-sol',
  'conscious-token',
  'wrapped-pulse-wpls',
  'nxm',
  'phantom-staked-sol',
  'apollo-diversified-credit-securitize-fund',
  'shuffle-2',
  'bianrensheng',
  'the-american-dream',
  'dola-usd',
  'universal-btc',
  'wrapped-ether-linea',
  'ozone-chain',
  'etherfi-weeths',
  'super-oeth',
  'payfi-strategy-token-usdc',
  'gaib-ai-dollar-alpha-usdc',
  'mag7-ssi',
  'crypto-com-staked-eth',
  'rollbit-coin',
  'resolv-rlp',
  'anzen-usdz',
  'compound-wrapped-btc',
  'usda-3',
  'wrapped-aave-ethereum-weth',
  'reserve-protocol-eth-plus',
  'sad-coin',
  'ether-fi-staked-btc',
  'ring-usd',
  'tradable-singapore-fintech-ssl-2',
  'glue',
  'qusdt',
  'staked-hype',
  'savings-xdai',
  'cash-4',
  'babypie-wrapped-btc',
  'agentfun-ai',
  'compound-ether',
  'temple',
  'novem-pro',
  'midas-mhyper',
  'renzo-restaked-lst',
  'openeden-open-dollar',
  'c8ntinuum',
  'vaneck-treasury-fund',
  'pleasing-gold',
  'vicicoin',
  'staked-usd1',
  'moonwell-flagship-eth-morpho-vault',
  'vaultbridge-bridged-eth-katana',
  'susda',
  'swop-2',
  'burnedfi',
  'gama-token',
  'vaultbridge-bridged-wbtc-katana',
  'okx-wrapped-btc',
  'compounding-open-dollar',
  'unit-pump',
  'verus-coin',
  'wrapped-centrifuge',
  'binance-peg-shib',
  'l2-standard-bridged-weth-optimism',
  'atomone',
  'bridged-wrapped-ether-starkgate',
  'minidoge-5',
  'stargate-bridged-usdc',
  'dfdv-staked-sol',
  'matrixdock-gold',
  'omni-network',
  'mindwavedao',
  'usd-coin-ethereum-bridged',
  'kinetiq-earn-vault',
  'stargate-bridged-weth',
  'fluid-wrapped-staked-eth',
  'usdx',
  'onyc',
  'fx-usd-saving',
  'hastra-wrapped-ylds',
  'restaked-swell-eth',
  'helder',
  'sui-bridged-wbtc-sui',
  'bim-2',
  'vaultbridge-bridged-usdc-katana',
  'midas-msyrupusdp',
  'coco-2',
  'wrapped-cro',
  'escoin-token',
  'steakhouse-eth-morpho-vault',
  'zedxion',
  'fulcrom',
  'sui-bridged-usdt-sui',
  'infrared-bera',
  'usdkg',
  'lcx',
  'project-galaxy',
  'marsmi',
  'infrared-finance',
  'veraone',
  'usd',
  'mountain-protocol-usdm',
  'tether-gold-tokens',
  'ronin-bridged-weth-ronin',
  'firelight-staked-xrp',
  'unit-plasma',
  'hex-trust-usdx',
  'nkyc-token',
  'bridged-wrapped-bitcoin-starkgate',
  'ridges-ai',
  'sui-bridged-ether-sui',
  'rserg',
  'liquity-bold-2',
  'glidr',
  'solv-protocol-solvbtc-jupiter',
  'atoshi',
  'moonwell-flagship-usdc-morpho-vault',
  'austin-capitals',
  'cjournal-2',
  'proprietary-trading-network',
  'ondo-u-s-dollar-token',
  'anvil',
  'kelp-gain',
  'usd-coin-avalanche-bridged-usdc-e',
  'noble-dollar-usdn',
  'amnis-aptos',
  'mezo-wrapped-btc',
  'coinbase-wrapped-xrp',
  'targon',
  'luxxcoin',
  'socean-staked-sol',
  'wrapped-bitcoin-pulsechain',
  'botxcoin',
  'hyperbeat-usdt',
  'btu-protocol',
  'pumpmeme',
  'gogopool-ggavax',
  'snowbank',
  'ventuals-vhype'
]);

const BLOCKED_SYMBOLS = new Set(['usdt', 'usdc', 'dai', 'fdusd', 'usde', 'tusd', 'usdd', 'busd', 'wsteth']);

// --- Insights Database ---
const COIN_INSIGHTS: Record<string, CoinInsight> = {
  'bitcoin': {
    category: 'ذخیره ارزش / پول دیجیتال',
    utility: 'اولین ارز دیجیتال، طلای دیجیتال، انتقال همتا به همتا بدون واسطه و سانسور.',
    outlook: 'به عنوان پادشاه بازار، کم‌ریسک‌ترین دارایی کریپتویی محسوب می‌شود. با پذیرش نهادی (ETFها) انتظار رشد پایدار در بلندمدت وجود دارد.'
  },
  'ethereum': {
    category: 'پلتفرم قرارداد هوشمند (L1)',
    utility: 'میزبان هزاران برنامه غیرمتمرکز (dApps)، امور مالی غیرمتمرکز (DeFi) و NFTها.',
    outlook: 'رهبر بی چون و چرای اکوسیستم دیفای. با آپدیت‌های مقیاس‌پذیری، جایگاه خود را به عنوان لایه پایه اینترنت آینده محکم کرده است.'
  },
  'binancecoin': {
    category: 'ارز صرافی / زیرساخت',
    utility: 'توکن بومی صرافی بایننس و شبکه BSC. استفاده برای تخفیف کارمزد و سوخت شبکه.',
    outlook: 'بستگی شدید به موفقیت صرافی بایننس دارد. با وجود چالش‌های رگولاتوری، همچنان یکی از پرکاربردترین اکوسیستم‌هاست.'
  },
  'solana': {
    category: 'قرارداد هوشمند (L1) پرسرعت',
    utility: 'پردازش تراکنش‌های بسیار سریع و ارزان. مناسب برای دیفای، گیمینگ و پرداخت‌های خرد.',
    outlook: 'رقیب جدی اتریوم با جامعه کاربری بسیار قوی. اگر مشکلات قطعی شبکه کاملا حل شود، پتانسیل رشد انفجاری دارد.'
  },
  'ripple': {
    category: 'پرداخت‌های بین‌المللی',
    utility: 'جایگزین سریع و ارزان برای سیستم سوئیفت بانکی جهت انتقال پول بین مرزی.',
    outlook: 'پیروزی‌های حقوقی اخیر موقعیت آن را تثیت کرده است. پتانسیل بالایی در صورت پذیرش توسط بانک‌های مرکزی دارد.'
  },
  'cardano': {
    category: 'قرارداد هوشمند (L1) علمی',
    utility: 'پلتفرمی با رویکرد آکادمیک و امنیت بالا برای قراردادهای هوشمند و هویت دیجیتال.',
    outlook: 'توسعه کند اما مطمئن. جامعه وفاداری دارد اما برای رقابت با سولانا و اتریوم نیاز به جذب پروژه‌های دیفای بیشتری دارد.'
  },
  'dogecoin': {
    category: 'میم کوین / پرداخت',
    utility: 'ارز دیجیتال شوخی که به ابزار پرداخت و انعام در اینترنت تبدیل شده است.',
    outlook: 'ریسک بالا، پاداش بالا. قیمت آن به شدت تحت تاثیر حمایت‌های ایلان ماسک و جو بازار است.'
  },
  'toncoin': {
    category: 'وب 3 / پیام‌رسان',
    utility: 'ادغام شده با تلگرام برای پرداخت‌های درون برنامه‌ای، کیف پول و اکوسیستم مینی‌اپ‌ها.',
    outlook: 'با دسترسی به 900 میلیون کاربر تلگرام، یکی از بالاترین پتانسیل‌ها را برای پذیرش عمومی (Mass Adoption) دارد.'
  },
  'shiba-inu': {
    category: 'میم کوین اکوسیستم‌دار',
    utility: 'تلاش برای تبدیل شدن از یک میم به یک اکوسیستم کامل با شیباریوم (L2) و صرافی غیرمتمرکز.',
    outlook: 'جامعه کاربری بسیار قوی دارد. موفقیت آن به کاربردی شدن پروژه‌های جانبی‌اش بستگی دارد.'
  },
  'polkadot': {
    category: 'تعامل‌پذیری (Layer 0)',
    utility: 'اتصال بلاکچین‌های مختلف به یکدیگر برای انتقال داده و دارایی (اینترنت بلاکچین‌ها).',
    outlook: 'تکنولوژی بسیار پیشرفته‌ای دارد. اگر آینده بلاکچین‌ها "چندزنجیره‌ای" باشد، پولکادات مهره کلیدی خواهد بود.'
  },
  'chainlink': {
    category: 'اوراکل (Oracle)',
    utility: 'پل ارتباطی بین دنیای واقعی و قراردادهای هوشمند (تامین قیمت‌ها و داده‌ها).',
    outlook: 'زیرساخت حیاتی دیفای. تقریبا تمام پروژه‌های بزرگ به چین‌لینک نیاز دارند، بنابراین پروژه‌ای بسیار بنیادی و امن است.'
  },
  'tron': {
    category: 'پلتفرم محتوا / پرداخت',
    utility: 'انتقال بسیار ارزان تتر (USDT) و پلتفرم برنامه‌های غیرمتمرکز.',
    outlook: 'شبکه‌ای بسیار محبوب برای جابجایی استیبل‌کوین‌ها. کاربردی و پر درآمد است اما از نظر تکنولوژی نوآوری خاصی ندارد.'
  },
  'avalanche-2': {
    category: 'قرارداد هوشمند مقیاس‌پذیر',
    utility: 'شبکه‌ای با قابلیت شخصی‌سازی بالا (Subnets) برای سازمان‌ها و گیمینگ.',
    outlook: 'رقیب قدرتمند اتریوم با تمرکز بر توکنیزه کردن دارایی‌های واقعی (RWA) و همکاری‌های سازمانی.'
  },
  'matic-network': {
    category: 'لایه 2 اتریوم (Polygon)',
    utility: 'افزایش سرعت و کاهش هزینه تراکنش‌های اتریوم. تبدیل شدن به "لایه تجمیع" نقدینگی.',
    outlook: 'با تغییر نام به POL و ارتقای فنی، نقش کلیدی در مقیاس‌پذیری اتریوم خواهد داشت.'
  },
  'near': {
    category: 'قرارداد هوشمند با کاربری آسان',
    utility: 'تمرکز بر تجربه کاربری (UX) ساده شبیه وب 2 و هوش مصنوعی غیرمتمرکز.',
    outlook: 'پیشرو در ترکیب هوش مصنوعی و بلاکچین. پتانسیل رشد بالایی در سایکل هوش مصنوعی دارد.'
  },
  'litecoin': {
    category: 'پول دیجیتال / پرداخت',
    utility: 'نسخه سبک‌تر بیت‌کوین برای پرداخت‌های سریع و ارزان روزمره.',
    outlook: 'نوآوری خاصی ندارد اما به دلیل سابقه طولانی و امنیت، همچنان به عنوان "نقره دیجیتال" پذیرفته شده است.'
  },
  'uniswap': {
    category: 'صرافی غیرمتمرکز (DEX)',
    utility: 'بزرگترین صرافی غیرمتمرکز برای تبادل توکن‌ها بدون نیاز به احراز هویت.',
    outlook: 'رهبر بازار DEX. با فشارهای رگولاتوری روبروست اما مدل کسب و کار بسیار قدرتمندی دارد.'
  },
  'kaspa': {
    category: 'لایه 1 (PoW) پرسرعت',
    utility: 'بلاکچین اثبات کار با ساختار BlockDAG برای سرعت بسیار بالا و امنیت بیت‌کوین.',
    outlook: 'محبوبیت بالایی بین ماینرها و تکنیکال‌کارها دارد. پروژه‌ای نوظهور با پتانسیل رشد فنی.'
  },
   'pepe': {
    category: 'میم کوین خالص',
    utility: 'صرفا جهت سرگرمی و سفته‌بازی بر اساس میم معروف Pepe the Frog.',
    outlook: 'بسیار پرنوسان. نماد فرهنگ اینترنتی در کریپتو است و پتانسیل سودهای انفجاری (و ضررهای سنگین) دارد.'
  },
   'render-token': {
    category: 'هوش مصنوعی / رندرینگ',
    utility: 'شبکه غیرمتمرکز برای اجاره قدرت پردازش GPU جهت رندر گرافیکی و AI.',
    outlook: 'یکی از مهم‌ترین پروژه‌های حوزه AI و Metaverse. با رشد تقاضا برای GPU، آینده درخشانی دارد.'
  },
   'fetch-ai': {
    category: 'هوش مصنوعی (AI)',
    utility: 'پلتفرم عوامل هوشمند خودکار برای انجام وظایف اقتصادی.',
    outlook: 'بخشی از اتحاد بزرگ ASI (Superintelligence). پیشرو در ترند هوش مصنوعی.'
  }
};

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
  { id: 'stock-aapl', symbol: 'AAPL', name: 'Apple Inc.', type: 'STOCKS', current_price: 220.50, price_change_percentage_24h: 1.25 },
  { id: 'stock-msft', symbol: 'MSFT', name: 'Microsoft Corp.', type: 'STOCKS', current_price: 415.30, price_change_percentage_24h: 0.85 },
  { id: 'stock-googl', symbol: 'GOOGL', name: 'Alphabet Inc.', type: 'STOCKS', current_price: 175.20, price_change_percentage_24h: -0.45 },
  { id: 'stock-amzn', symbol: 'AMZN', name: 'Amazon.com Inc.', type: 'STOCKS', current_price: 185.10, price_change_percentage_24h: 2.10 },
  { id: 'stock-tsla', symbol: 'TSLA', name: 'Tesla Inc.', type: 'STOCKS', current_price: 240.40, price_change_percentage_24h: -1.55 },
  { id: 'stock-nvda', symbol: 'NVDA', name: 'NVIDIA Corp.', type: 'STOCKS', current_price: 120.80, price_change_percentage_24h: 3.50 },
  { id: 'stock-meta', symbol: 'META', name: 'Meta Platforms', type: 'STOCKS', current_price: 500.25, price_change_percentage_24h: 1.15 },
  { id: 'stock-nflx', symbol: 'NFLX', name: 'Netflix Inc.', type: 'STOCKS', current_price: 650.10, price_change_percentage_24h: 0.45 },
  { id: 'stock-amd', symbol: 'AMD', name: 'Advanced Micro Devices', type: 'STOCKS', current_price: 155.60, price_change_percentage_24h: 1.80 },
  { id: 'stock-intc', symbol: 'INTC', name: 'Intel Corp.', type: 'STOCKS', current_price: 30.50, price_change_percentage_24h: -0.90 },
  { id: 'stock-pypl', symbol: 'PYPL', name: 'PayPal Holdings', type: 'STOCKS', current_price: 65.40, price_change_percentage_24h: 0.60 },
  { id: 'stock-adbe', symbol: 'ADBE', name: 'Adobe Inc.', type: 'STOCKS', current_price: 480.20, price_change_percentage_24h: -1.20 },
  { id: 'stock-crm', symbol: 'CRM', name: 'Salesforce Inc.', type: 'STOCKS', current_price: 260.30, price_change_percentage_24h: 0.75 },
  { id: 'stock-csco', symbol: 'CSCO', name: 'Cisco Systems', type: 'STOCKS', current_price: 48.90, price_change_percentage_24h: 0.30 },
  { id: 'stock-pep', symbol: 'PEP', name: 'PepsiCo Inc.', type: 'STOCKS', current_price: 170.50, price_change_percentage_24h: -0.20 },
  { id: 'stock-ko', symbol: 'KO', name: 'Coca-Cola Co.', type: 'STOCKS', current_price: 60.10, price_change_percentage_24h: 0.15 },
  { id: 'stock-dis', symbol: 'DIS', name: 'Walt Disney Co.', type: 'STOCKS', current_price: 95.60, price_change_percentage_24h: 1.40 },
  { id: 'stock-nke', symbol: 'NKE', name: 'Nike Inc.', type: 'STOCKS', current_price: 85.30, price_change_percentage_24h: -0.80 },
  { id: 'stock-xom', symbol: 'XOM', name: 'Exxon Mobil Corp.', type: 'STOCKS', current_price: 115.40, price_change_percentage_24h: 0.90 },
  { id: 'stock-cvx', symbol: 'CVX', name: 'Chevron Corp.', type: 'STOCKS', current_price: 155.70, price_change_percentage_24h: 0.50 },
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
const PREF_INTERVAL_KEY = 'crypto_interval_v1';
const PREF_CATEGORY_KEY = 'crypto_category_v1';
const FAV_LISTS_KEY = 'crypto_fav_lists_v1'; // New key for multiple lists

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

// Component: Blocked List Modal
const BlockedListModal = ({ 
  blockedIds, 
  allAssets, 
  onClose 
}: { 
  blockedIds: Set<string>, 
  allAssets: AssetData[], 
  onClose: () => void 
}) => {
  const [copied, setCopied] = useState(false);

  // Prepare data for display
  const blockedList = useMemo(() => {
    return Array.from(blockedIds).map(id => {
       const found = allAssets.find(a => a.id === id);
       return {
         id,
         symbol: found ? found.symbol : '?',
         name: found ? found.name : 'Unknown / Not Loaded'
       };
    });
  }, [blockedIds, allAssets]);

  const handleCopyList = () => {
    const listText = blockedList.map(item => `'${item.id}'`).join(',\n');
    navigator.clipboard.writeText(listText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-2xl">🚫</span> لیست ارزهای مسدود شده (Blocked)
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-gray-100 transition-colors">
            ✕
          </button>
        </div>

        {/* Content */}
        <div className="flex-grow overflow-y-auto p-4 custom-scrollbar">
           <p className="text-sm text-gray-500 mb-4 bg-red-50 p-3 rounded-lg border border-red-100 leading-relaxed text-justify">
             این لیست شامل تمام ارزهایی است که شما به صورت دستی مسدود کرده‌اید. با توجه به عدم امکان ذخیره‌سازی دائمی آنلاین، می‌توانید این لیست را کپی کرده و برای توسعه‌دهنده ارسال کنید تا به صورت دائمی از سایت حذف شوند.
           </p>
           {blockedList.length === 0 ? (
               <div className="text-center py-10 text-gray-400">
                   هیچ ارزی مسدود نشده است.
               </div>
           ) : (
               <table className="w-full text-right text-sm">
                 <thead className="bg-gray-50 text-gray-600 font-bold sticky top-0 z-10 bg-white">
                   <tr>
                     <th className="px-3 py-2 border-b">شناسه (ID)</th>
                     <th className="px-3 py-2 border-b">نام</th>
                     <th className="px-3 py-2 border-b">نماد</th>
                   </tr>
                 </thead>
                 <tbody className="divide-y divide-gray-100">
                   {blockedList.map((item) => (
                     <tr key={item.id} className="hover:bg-gray-50">
                       <td className="px-3 py-2 text-gray-800 font-mono select-all font-bold" dir="ltr">{item.id}</td>
                       <td className="px-3 py-2 text-gray-600">{item.name}</td>
                       <td className="px-3 py-2 text-gray-500 uppercase">{item.symbol}</td>
                     </tr>
                   ))}
                 </tbody>
               </table>
           )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-gray-100 bg-gray-50 rounded-b-xl flex justify-between items-center">
           <span className="text-sm text-gray-500">تعداد: {blockedList.length}</span>
           <button 
             onClick={handleCopyList}
             disabled={blockedList.length === 0}
             className={`px-6 py-2.5 rounded-lg font-bold shadow-sm transition-all flex items-center gap-2 ${copied ? 'bg-green-600 text-white' : 'bg-red-600 text-white hover:bg-red-700 disabled:bg-gray-300 disabled:cursor-not-allowed'}`}
           >
             {copied ? (
               <><span>✓</span> کپی شد</>
             ) : (
               <><span>📋</span> کپی لیست برای ارسال</>
             )}
           </button>
        </div>
      </div>
    </div>
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
            }, 3000); 
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
  // Load initial states from localStorage
  const [activeCategory, setActiveCategory] = useState<Category>(() => {
    if (typeof window !== 'undefined') {
       return (localStorage.getItem(PREF_CATEGORY_KEY) as Category) || 'CRYPTO';
    }
    return 'CRYPTO';
  });

  const [viewMode, setViewMode] = useState<ViewMode>('GRID');
  const [isLogScale, setIsLogScale] = useState(true);
  
  const [interval, setInterval] = useState(() => {
    if (typeof window !== 'undefined') {
       return localStorage.getItem(PREF_INTERVAL_KEY) || "1M";
    }
    return "1M";
  });

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
  
  // Save interval change
  useEffect(() => {
      localStorage.setItem(PREF_INTERVAL_KEY, interval);
  }, [interval]);

  // Save category change
  useEffect(() => {
      localStorage.setItem(PREF_CATEGORY_KEY, activeCategory);
  }, [activeCategory]);
  
  // Data State
  const [displayedAssets, setDisplayedAssets] = useState<AssetData[]>([]);
  const [allFetchedAssets, setAllFetchedAssets] = useState<AssetData[]>([]); // Store raw fetched data to lookup names for blocked list
  
  // User Preferences
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
  
  // New: Multiple Favorites Lists
  // Structure: { "List Name": Set(["btc", "eth"]) }
  const [favLists, setFavLists] = useState<Record<string, Set<string>>>({ "لیست اصلی": new Set<string>() });
  const [activeFavList, setActiveFavList] = useState<string>("لیست اصلی");
  const [openFavMenuId, setOpenFavMenuId] = useState<string | null>(null);
  
  // Fetch Config
  const [loading, setLoading] = useState(false);
  const [scanProgress, setScanProgress] = useState(0); // Progress tracker
  const [error, setError] = useState<string | null>(null);
  
  // UI Filters
  const [user, setUser] = useState<any>(null);
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSymbolList, setShowSymbolList] = useState(false); // Modal State
  const [calcInput, setCalcInput] = useState<string>("1"); // Investment calculator amount

  // New List State
  const [newListName, setNewListName] = useState("");
  const [showAddListInput, setShowAddListInput] = useState(false);

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState('1'); // Input state
  const [pageSize, setPageSize] = useState(15);
  const [cryptoTotalCount, setCryptoTotalCount] = useState(10000); 

  const fileInputRef = useRef<HTMLInputElement>(null);
  const mainContentRef = useRef<HTMLDivElement>(null);

  // --- Effects ---

  // Sync pageInput with currentPage
  useEffect(() => {
      setPageInput(String(currentPage));
  }, [currentPage]);

  // Load Preferences (Favorites Lists)
  useEffect(() => {
      // 1. Try to load the new list format
      const savedLists = localStorage.getItem(FAV_LISTS_KEY);
      if (savedLists) {
          try {
              const parsed = JSON.parse(savedLists);
              const hydrated: Record<string, Set<string>> = {};
              for (const [key, val] of Object.entries(parsed)) {
                  hydrated[key] = new Set(val as string[]);
              }
              setFavLists(hydrated);
              // Ensure active list exists
              if (!hydrated[activeFavList]) {
                  setActiveFavList(Object.keys(hydrated)[0] || "لیست اصلی");
              }
              return; // Loaded successfully
          } catch(e) {
              console.error("Failed to parse fav lists", e);
          }
      }

      // 2. Migration: If no new format, check for old single list format
      const oldFavs = localStorage.getItem('crypto_favorites_v1');
      if (oldFavs) {
          try {
              const parsed = JSON.parse(oldFavs);
              if (Array.isArray(parsed)) {
                  setFavLists({ "لیست اصلی": new Set(parsed) });
              }
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
                    setRemovedIds(prev => {
                        const newSet = new Set(prev);
                        data.removedCoinIds.forEach((id: string) => newSet.add(id));
                        return newSet;
                    });
                }
                // Sync Fav Lists from Firebase (Simple overwrite for now, ideally merge)
                if (data.favLists) {
                    const hydrated: Record<string, Set<string>> = {};
                    for (const [key, val] of Object.entries(data.favLists)) {
                        hydrated[key] = new Set(val as string[]);
                    }
                    setFavLists(hydrated);
                }
            }
        });
      }
    });
    return () => unsubscribeAuth();
  }, []);

  // Close favorites menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      // Logic to check if click is inside menu
      if (openFavMenuId && !(event.target as Element).closest('.fav-menu-container')) {
         setOpenFavMenuId(null);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [openFavMenuId]);

  // Reset pagination on category change or search
  useEffect(() => {
    setCurrentPage(1);
  }, [activeCategory, searchQuery, showFavoritesOnly, viewMode, activeFavList]);

  // Handle Default Sorting (removed auto-reset of interval)
  useEffect(() => {
      // Reset sort config based on category
      if (activeCategory === 'CRYPTO') {
          setSortConfig({ key: 'market_cap_rank', direction: 'asc' });
      } else if (activeCategory === 'GAINERS') {
          setSortConfig({ key: 'price_change_percentage_24h', direction: 'desc' });
      } else if (activeCategory === 'ATH') {
          // Sort by drop percentage ascending (e.g. -99% before -10%) to show biggest potential
          setSortConfig({ key: 'ath_change_percentage', direction: 'asc' });
      } else if (activeCategory === 'FOREX' || activeCategory === 'STOCKS') {
          setSortConfig({ key: null, direction: 'desc' }); // Default order
      }
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

  // Derived state for easy access to current favorites set
  const currentFavoritesSet = useMemo(() => {
      return favLists[activeFavList] || new Set<string>();
  }, [favLists, activeFavList]);

  // --- Data Fetching Strategy ---
  useEffect(() => {
    // 1. Non-Crypto Handling (Static Data)
    if (activeCategory === 'FOREX') {
        // Apply duplicate filter to static lists too
        let data = processAssets(FOREX_PAIRS);
        
        setAllFetchedAssets(data);

        // In TABLE view, show removed items so they can be unblocked. In GRID view, hide them.
        if (viewMode === 'GRID') {
            data = data.filter(a => !removedIds.has(a.id));
        }
        
        if (showFavoritesOnly) data = data.filter(a => currentFavoritesSet.has(a.id));
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
        
        setAllFetchedAssets(data);

        // In TABLE view, show removed items so they can be unblocked. In GRID view, hide them.
        if (viewMode === 'GRID') {
             data = data.filter(a => !removedIds.has(a.id));
        }
        
        if (showFavoritesOnly) data = data.filter(a => currentFavoritesSet.has(a.id));
        if (searchQuery) {
             const q = searchQuery.toLowerCase();
             data = data.filter(a => a.symbol.toLowerCase().includes(q) || a.name.toLowerCase().includes(q));
        }
        setDisplayedAssets(data);
        setCryptoTotalCount(data.length);
        return;
    }

    // 2. Crypto & Gainers & ATH Handling (API)
    const controller = new AbortController();

    const fetchData = async () => {
        setLoading(true);
        setScanProgress(0);
        setError(null);
        try {
            let data: AssetData[] = [];
            
            // CASE A: Gainers OR ATH - Specific Logic to find Top Movers/Highest ATH
            if (activeCategory === 'GAINERS' || activeCategory === 'ATH') {
                // Fetch Top 10,000 coins (40 pages x 250)
                const totalPagesToScan = 40; 
                let allCoins: any[] = [];
                let consecutiveFailures = 0;
                
                for (let p = 1; p <= totalPagesToScan; p++) {
                    setScanProgress(p); // Update progress indicator
                    
                    if (consecutiveFailures >= 3) {
                        console.warn("Too many consecutive failures, stopping scan early.");
                        break;
                    }

                    try {
                        if (controller.signal.aborted) break;
                        
                        const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=250&page=${p}&sparkline=false&price_change_percentage=24h`;
                        
                        let res = null;
                        try {
                            res = await fetch(url, { signal: controller.signal });
                        } catch (e) {
                            if (controller.signal.aborted) throw e;
                            await new Promise(r => setTimeout(r, 2000));
                            res = await fetch(url, { signal: controller.signal });
                        }

                        if (res && res.status === 429) {
                            console.warn("Rate limit hit (429). Pausing...");
                            await new Promise(r => setTimeout(r, 5000)); 
                            consecutiveFailures++;
                            continue;
                        }
                        
                        if (!res || !res.ok) {
                            consecutiveFailures++;
                            continue;
                        }
                        
                        const json = await res.json();
                        if (Array.isArray(json)) {
                            if (json.length === 0) break; 
                            allCoins = [...allCoins, ...json];
                            consecutiveFailures = 0; 
                        } else {
                            consecutiveFailures++;
                        }
                        
                        const delay = p < 5 ? 1200 : 1600;
                        if (p !== totalPagesToScan) {
                             await new Promise(r => setTimeout(r, delay)); 
                        }

                    } catch (e: any) {
                        if (e.name !== 'AbortError') console.error(e);
                        consecutiveFailures++;
                        if (e.name === 'AbortError') break;
                    }
                }

                if (allCoins.length === 0 && !controller.signal.aborted) {
                     throw new Error("No data found (API Error)");
                }
                
                const cleanedData = processAssets(allCoins);

                let sorted = cleanedData;
                if (activeCategory === 'GAINERS') {
                     sorted = cleanedData.sort((a: any, b: any) => (b.price_change_percentage_24h || 0) - (a.price_change_percentage_24h || 0));
                } else if (activeCategory === 'ATH') {
                     sorted = cleanedData.sort((a: any, b: any) => (a.ath_change_percentage || 0) - (b.ath_change_percentage || 0));
                }
                
                let filtered = sorted;
                if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    filtered = filtered.filter((c: any) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
                }

                if (showFavoritesOnly) {
                    filtered = filtered.filter((c: any) => currentFavoritesSet.has(c.id));
                }

                setCryptoTotalCount(filtered.length);
                const start = (currentPage - 1) * pageSize;
                const rawPageData = filtered.slice(start, start + pageSize).map((c: any) => ({ ...c, type: 'CRYPTO' }));
                
                setAllFetchedAssets(rawPageData);
                data = rawPageData;

            // CASE B: Show Favorites Only (Standard Crypto)
            } else if (showFavoritesOnly) {
                const favIds = Array.from(currentFavoritesSet);
                if (favIds.length === 0) {
                    setDisplayedAssets([]);
                    setAllFetchedAssets([]);
                    setCryptoTotalCount(0);
                    setLoading(false);
                    return;
                }
                
                const idsParam = favIds.join(',');
                const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${idsParam}&order=market_cap_desc&sparkline=false&price_change_percentage=24h,7d,30d,1y`;
                const res = await fetch(url, { signal: controller.signal });
                const json = await res.json();
                
                let filtered = processAssets(json);

                if (searchQuery) {
                    const q = searchQuery.toLowerCase();
                    filtered = filtered.filter((c: any) => c.symbol.toLowerCase().includes(q) || c.name.toLowerCase().includes(q));
                }
                
                setCryptoTotalCount(filtered.length);
                const start = (currentPage - 1) * pageSize;
                const rawPageData = filtered.slice(start, start + pageSize).map((c: any) => ({ ...c, type: 'CRYPTO' }));
                
                setAllFetchedAssets(rawPageData);
                data = rawPageData;
            
            } else {
                // CASE C: Search Active (Rank or Text) for Standard Crypto
                const rankQuery = parseInt(searchQuery);
                
                if (!isNaN(rankQuery) && rankQuery > 0) {
                    const targetPage = Math.ceil(rankQuery / pageSize);
                    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${pageSize}&page=${targetPage}&sparkline=false&price_change_percentage=24h,7d,30d,1y`;
                    
                    const res = await fetch(url, { signal: controller.signal });
                    if (!res.ok) throw new Error("API Error");
                    const json = await res.json();
                    
                    const cleaned = processAssets(json);
                    const rawData = cleaned.filter((c:any) => c.market_cap_rank === rankQuery).map((c: any) => ({ ...c, type: 'CRYPTO' }));
                    
                    setAllFetchedAssets(rawData);
                    data = rawData;
                    setCryptoTotalCount(10000); 

                } else if (searchQuery.trim().length > 0) {
                    // *** STANDARD COINGECKO SEARCH ***
                    const searchRes = await fetch(`https://api.coingecko.com/api/v3/search?query=${searchQuery}`, { signal: controller.signal });
                    const searchJson = await searchRes.json();
                    const searchCoins = searchJson.coins || [];

                    if (searchCoins.length === 0) {
                        setDisplayedAssets([]);
                        setAllFetchedAssets([]);
                        setCryptoTotalCount(0);
                        setLoading(false);
                        return;
                    }

                    const start = (currentPage - 1) * pageSize;
                    const pageCoins = searchCoins.slice(start, start + pageSize);
                    const ids = pageCoins.map((c: any) => c.id).join(',');

                    if (ids) {
                        const marketsRes = await fetch(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids}&order=market_cap_desc&sparkline=false&price_change_percentage=24h,7d,30d,1y`, { signal: controller.signal });
                        const marketsJson = await marketsRes.json();
                        const rawData = processAssets(marketsJson).map((c: any) => ({ ...c, type: 'CRYPTO' }));
                        
                        setAllFetchedAssets(rawData);
                        data = rawData;
                        setCryptoTotalCount(searchCoins.length);
                    } else {
                        data = [];
                        setAllFetchedAssets([]);
                        setCryptoTotalCount(0);
                    }

                // CASE D: Default Market View (Paginated)
                } else {
                    const url = `https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=${pageSize}&page=${currentPage}&sparkline=false&price_change_percentage=24h,7d,30d,1y`;
                    const res = await fetch(url, { signal: controller.signal });
                    if (!res.ok) throw new Error("Rate Limit or API Error");
                    const json = await res.json();
                    const cleaned = processAssets(json);
                    const rawData = cleaned.map((c: any) => ({ ...c, type: 'CRYPTO' }));
                    
                    setAllFetchedAssets(rawData);
                    data = rawData;
                    setCryptoTotalCount(10000); 
                }
            }

            if (viewMode === 'TABLE') {
                setDisplayedAssets(data);
            } else {
                setDisplayedAssets(data.filter(a => !removedIds.has(a.id)));
            }

        } catch (err: any) {
            if (err.name !== 'AbortError') {
                console.error(err);
                if (displayedAssets.length === 0) {
                    setError("خطا در برقراری ارتباط با سرور. (لطفا دوباره تلاش کنید)");
                }
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
  }, [activeCategory, currentPage, pageSize, searchQuery, showFavoritesOnly, viewMode, removedIds, activeFavList, favLists]); 

  // --- Helpers ---
  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null) return '-';
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

  const formatCompactNum = (value?: number) => {
    if (value === undefined || value === null) return '-';
    return new Intl.NumberFormat('en-US', {
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

  const toggleBlockStatus = (id: string) => {
    setRemovedIds((prev: Set<string>) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
          newSet.delete(id); // Unblock
      } else {
          newSet.add(id); // Block
      }
      const asArray = Array.from(newSet);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(asArray));
      if (user) {
          const userDocRef = doc(db, 'users', user.uid);
          setDoc(userDocRef, { removedCoinIds: asArray }, { merge: true });
      }
      return newSet;
    });
  };

  const toggleAssetInList = (listName: string, assetId: string) => {
      setFavLists((prev: Record<string, Set<string>>) => {
          const currentSet = new Set(prev[listName] || []);
          if (currentSet.has(assetId)) currentSet.delete(assetId);
          else currentSet.add(assetId);
          
          const newLists = { ...prev, [listName]: currentSet };
          
          // Persist
          const serialized: Record<string, string[]> = {};
          for (const [key, val] of Object.entries(newLists)) {
              serialized[key] = Array.from(val as Set<string>);
          }
          localStorage.setItem(FAV_LISTS_KEY, JSON.stringify(serialized));
          
          if (user) {
              const userDocRef = doc(db, 'users', user.uid);
              setDoc(userDocRef, { favLists: serialized }, { merge: true });
          }
          
          return newLists;
      });
  };

  const createNewList = () => {
      if (!newListName.trim()) return;
      if (favLists[newListName]) {
          alert("این نام قبلا استفاده شده است.");
          return;
      }
      setFavLists(prev => ({ ...prev, [newListName]: new Set() }));
      setActiveFavList(newListName);
      setNewListName("");
      setShowAddListInput(false);
  };

  const deleteCurrentList = () => {
      if (activeFavList === "لیست اصلی") return;
      if (!window.confirm(`آیا مطمئن هستید که می‌خواهید لیست "${activeFavList}" را حذف کنید؟`)) return;
      
      setFavLists((prev: Record<string, Set<string>>) => {
          const newState = { ...prev };
          delete newState[activeFavList];
          
          // Persist
          const serialized: Record<string, string[]> = {};
          for (const [key, val] of Object.entries(newState)) {
              serialized[key] = Array.from(val as Set<string>);
          }
          localStorage.setItem(FAV_LISTS_KEY, JSON.stringify(serialized));
          if (user) {
              const userDocRef = doc(db, 'users', user.uid);
              setDoc(userDocRef, { favLists: serialized }, { merge: true });
          }
          
          return newState;
      });
      setActiveFavList("لیست اصلی");
  };

  // Sorting Helper
  const handleSort = (key: keyof AssetData) => {
    setSortConfig(current => {
        if (current.key === key) {
             return { key, direction: current.direction === 'desc' ? 'asc' : 'desc' };
        }
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
    const serializedFavs: Record<string, string[]> = {};
    for (const [key, val] of Object.entries(favLists)) {
        serializedFavs[key] = Array.from(val as Set<string>);
    }
    const data = { 
        removedCoinIds: Array.from(removedIds), 
        favLists: serializedFavs, 
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
        if (json.removedCoinIds) setRemovedIds(new Set(json.removedCoinIds as string[]));
        
        // Handle old format vs new format
        if (json.favLists) {
            const hydrated: Record<string, Set<string>> = {};
            for (const [key, val] of Object.entries(json.favLists as Record<string, unknown>)) {
                hydrated[key] = new Set(val as string[]);
            }
            setFavLists(hydrated);
        } else if (json.favorites) {
            // Old format
            setFavLists(prev => ({ ...prev, "لیست اصلی": new Set(json.favorites as string[]) }));
        }
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

  const handleInfoClick = (asset: AssetData) => {
      const prompt = `حلیل جامع و پیش‌بینی آینده ارز دیجیتال ${asset.name} (${asset.symbol}) چیست؟آمار دقیق توکن‌های در حال گردش و توکن‌های کلیدر توکن های در حال گردش ،تحلیل جامع پروژه: توکن چیست و چه کاربردی دارد؟،پیش‌بینی آینده توکن: چه قیمتی و چه کاربردی؟`;
      navigator.clipboard.writeText(prompt).catch(() => {});
      window.open("https://gemini.google.com/", "_blank");
  };
  
  const toggleFavMenu = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      setOpenFavMenuId(prev => prev === id ? null : id);
  };
  
  const cardHeightClass = 'h-[calc(100vh-140px)] min-h-[500px]';
  const totalPages = Math.ceil(cryptoTotalCount / pageSize);

  const handlePageChange = (newPage: number) => {
      if (newPage >= 1 && newPage <= totalPages) {
          setCurrentPage(newPage);
          window.scrollTo({ top: 0, behavior: 'smooth' });
      }
  };

  // Reusable Pagination Component
  const PaginationControls = () => (
      <div className="flex justify-center items-center gap-3 py-4" dir="ltr">
          <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1 || loading}
              className="px-3 py-1 rounded bg-white border border-gray-300 shadow-sm disabled:opacity-50 hover:bg-gray-100 text-gray-700 transition-colors"
          >
              Previous
          </button>
          <div className="flex items-center gap-2">
              <span className="text-sm text-gray-500 font-medium">Page</span>
              <input
                  type="number"
                  value={pageInput}
                  onChange={(e) => setPageInput(e.target.value)}
                  onBlur={() => {
                      let p = parseInt(pageInput);
                      if (isNaN(p) || p < 1) p = 1;
                      if (p > totalPages) p = totalPages;
                      handlePageChange(p);
                  }}
                  onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                          let p = parseInt(pageInput);
                          if (isNaN(p) || p < 1) p = 1;
                          if (p > totalPages) p = totalPages;
                          handlePageChange(p);
                      }
                  }}
                  className="w-12 h-8 text-center border border-gray-300 rounded text-sm outline-none focus:border-blue-500 font-bold text-gray-700"
              />
              <span className="text-sm text-gray-500 font-medium">of {totalPages}</span>
          </div>
          <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages || loading}
              className="px-3 py-1 rounded bg-white border border-gray-300 shadow-sm disabled:opacity-50 hover:bg-gray-100 text-gray-700 transition-colors"
          >
              Next
          </button>
      </div>
  );

  return (
    <div className="min-h-screen flex flex-col font-sans bg-gray-50 text-right">
      {/* Header */}
      <header className="bg-white shadow-sm z-20 sticky top-0 border-b border-gray-200">
        <div className="max-w-[1920px] mx-auto px-4 py-3">
          <div className="flex flex-col xl:flex-row justify-between items-center gap-4">
            
            {/* Left: Title & Search */}
            <div className="flex flex-col md:flex-row items-center gap-4 w-full xl:w-auto">
              <h1 
                onClick={() => window.location.reload()} 
                className="text-2xl font-bold text-gray-800 flex items-center gap-2 whitespace-nowrap cursor-pointer hover:opacity-80 transition-opacity select-none"
                title="بازنشانی و بارگذاری مجدد برنامه"
              >
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
                  onClick={() => setActiveCategory('ATH')} 
                  className={`px-3 py-1.5 rounded-md text-sm font-semibold transition-all whitespace-nowrap ${activeCategory === 'ATH' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-purple-600'}`}
                >
                  بیشترین ATH
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
              
              {/* Calculator Input */}
              <div className="flex items-center gap-2 bg-white border border-gray-200 px-2 py-1.5 rounded-lg shadow-sm">
                  <span className="text-xs font-bold text-gray-500">خرید ($):</span>
                  <input
                      type="number"
                      min="0"
                      value={calcInput}
                      onChange={(e) => setCalcInput(e.target.value)}
                      className="w-12 text-center text-sm font-bold text-blue-600 outline-none bg-transparent"
                  />
              </div>
              
              {/* View Toggle Button */}
               <button 
                  onClick={() => setViewMode(viewMode === 'GRID' ? 'TABLE' : 'GRID')}
                  className={`px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm border ${viewMode === 'TABLE' 
                      ? 'bg-blue-600 text-white border-blue-600 hover:bg-blue-700' 
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
               >
                  {viewMode === 'GRID' ? '📋 لیست ارزها و مسدودی' : '📊 نمای چارت‌ها'}
               </button>

              {/* --- New Favorite Lists Manager --- */}
              <div className="flex items-center gap-1 bg-white border border-gray-200 rounded-lg p-1 shadow-sm">
                  <button
                    onClick={() => setShowFavoritesOnly(!showFavoritesOnly)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${showFavoritesOnly ? 'bg-yellow-50 text-yellow-600' : 'text-gray-400 hover:text-yellow-500'}`}
                    title="نمایش فقط لیست علاقه‌مندی فعال"
                  >
                    ★
                  </button>
                  
                  <div className="relative group">
                      <select
                        value={activeFavList}
                        onChange={(e) => setActiveFavList(e.target.value)}
                        className="text-sm font-bold text-gray-700 bg-transparent outline-none cursor-pointer py-1 max-w-[100px] sm:max-w-[150px]"
                      >
                        {Object.keys(favLists).map(name => (
                            <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                  </div>

                  <button 
                    onClick={() => setShowAddListInput(true)} 
                    className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 text-xs"
                    title="ساخت لیست جدید"
                  >
                    +
                  </button>

                  {activeFavList !== 'لیست اصلی' && (
                      <button 
                        onClick={deleteCurrentList} 
                        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-50 text-gray-400 hover:text-red-500 text-xs"
                        title="حذف لیست فعلی"
                      >
                        ✕
                      </button>
                  )}
              </div>

              {/* Add List Modal/Input */}
              {showAddListInput && (
                  <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20 backdrop-blur-sm" onClick={() => setShowAddListInput(false)}>
                      <div className="bg-white p-4 rounded-xl shadow-lg flex gap-2" onClick={e => e.stopPropagation()}>
                          <input 
                            type="text" 
                            value={newListName} 
                            onChange={(e) => setNewListName(e.target.value)} 
                            placeholder="نام لیست جدید..."
                            className="border border-gray-300 rounded-lg px-3 py-1 outline-none focus:border-blue-500"
                            autoFocus
                          />
                          <button onClick={createNewList} className="bg-blue-600 text-white px-4 py-1 rounded-lg">ایجاد</button>
                      </div>
                  </div>
              )}

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
                 {/* New: Symbol List Button */}
                <button 
                    onClick={() => setShowSymbolList(true)} 
                    title="مشاهده لیست ارزهای مسدود شده"
                    className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                >
                    📜
                </button>

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
                {(activeCategory === 'GAINERS' || activeCategory === 'ATH') 
                    ? `اسکن ارزها (${scanProgress} از 40 صفحه)...` 
                    : "بروزرسانی لیست..."}
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
               {/* Pagination Top */}
               {!loading && sortedAssets.length > 0 && <PaginationControls />}

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
                        const insight = COIN_INSIGHTS[asset.id];
                        const isFav = currentFavoritesSet.has(asset.id);
                        
                        // Investment Potential Calculation
                        const investment = parseFloat(calcInput) || 0;
                        const potentialValue = (asset.ath && asset.current_price)
                            ? (investment / asset.current_price) * asset.ath
                            : 0;
                        const multiplier = (asset.ath && asset.current_price)
                            ? (asset.ath / asset.current_price)
                            : 0;

                        return (
                      <div 
                        id={`card-${asset.id}`}
                        key={asset.id} 
                        style={{ contentVisibility: 'auto', containIntrinsicSize: '1px 500px' }}
                        className={`bg-white rounded-xl shadow-sm border border-gray-200 flex flex-col relative ${cardHeightClass} transition-all hover:shadow-md`}
                      >
                        {/* 1. Header */}
                        <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center bg-white shrink-0 rounded-t-xl">
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
                          
                          <div className="flex items-center flex-shrink-0 gap-1 relative fav-menu-container">
                            {openFavMenuId === asset.id && (
                                <div className="absolute top-10 left-0 z-50 bg-white rounded-xl shadow-xl border border-gray-100 p-3 min-w-[200px] animate-[fadeIn_0.1s_ease-out] text-right">
                                    <div className="text-xs font-bold text-gray-400 mb-2 px-1">ذخیره در لیست‌های:</div>
                                    <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto custom-scrollbar">
                                        {Object.keys(favLists).map(listName => {
                                            const isChecked = favLists[listName]?.has(asset.id);
                                            return (
                                                <label key={listName} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer transition-colors justify-start">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={isChecked}
                                                        onChange={() => toggleAssetInList(listName, asset.id)}
                                                        className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-gray-300"
                                                    />
                                                    <span className={`text-sm ${isChecked ? 'text-gray-800 font-bold' : 'text-gray-600'}`}>{listName}</span>
                                                </label>
                                            );
                                        })}
                                    </div>
                                    <div className="border-t border-gray-100 mt-2 pt-2 text-center">
                                        <button 
                                            onClick={(e) => { e.stopPropagation(); setShowAddListInput(true); setOpenFavMenuId(null); }}
                                            className="text-xs text-blue-600 hover:text-blue-800 font-bold w-full"
                                        >
                                            + لیست جدید
                                        </button>
                                    </div>
                                </div>
                            )}
                            <button 
                              onClick={(e) => toggleFavMenu(e, asset.id)}
                              className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${isFav ? 'text-yellow-400' : 'text-gray-300'}`}
                              title="مدیریت علاقه‌مندی‌ها"
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

                        {/* 3. Detailed Stats (Responsive 2x2 or 5 cols) */}
                        {hasDetails ? (
                            <div className="grid grid-cols-2 sm:grid-cols-5 gap-x-4 gap-y-3 p-4 bg-white border-b border-gray-100 text-gray-600 shrink-0 min-h-[160px]">
                                {/* Column 1: Historical Changes */}
                                <div className="flex flex-col gap-1.5 text-sm">
                                    <div className="flex justify-between">
                                        <span className="font-semibold text-gray-500">7d:</span>
                                        <span className={`font-bold ${getPercentClass(asset.price_change_percentage_7d_in_currency)}`}>{fmtPct(asset.price_change_percentage_7d_in_currency)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-semibold text-gray-500">30d:</span>
                                        <span className={`font-bold ${getPercentClass(asset.price_change_percentage_30d_in_currency)}`}>{fmtPct(asset.price_change_percentage_30d_in_currency)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-semibold text-gray-500">1y:</span>
                                        <span className={`font-bold ${getPercentClass(asset.price_change_percentage_1y_in_currency)}`}>{fmtPct(asset.price_change_percentage_1y_in_currency)}</span>
                                    </div>
                                </div>

                                {/* Column 2: ATH Data */}
                                <div className="flex flex-col gap-1.5 sm:border-l border-gray-100 sm:pl-3 text-sm">
                                    <div className="flex justify-between" title="All Time High Price">
                                        <span className="font-semibold text-gray-500">ATH:</span>
                                        <span className="font-bold text-gray-700">{formatCompact(asset.ath)}</span>
                                    </div>
                                    <div className="flex justify-between" title="Down from ATH">
                                        <span className="font-semibold text-gray-500">Drop:</span>
                                        <span className="font-bold text-red-500">{fmtPct(asset.ath_change_percentage)}</span>
                                    </div>
                                    <div className="flex justify-between" title="Needed to reach ATH">
                                        <span className="font-semibold text-gray-500">To ATH:</span>
                                        <span className="font-bold text-green-600">+{toAth.toFixed(0)}%</span>
                                    </div>
                                </div>

                                {/* Column 3: Market Data */}
                                <div className="flex flex-col gap-1.5 sm:border-l border-gray-100 sm:pl-3 text-sm">
                                     <div className="flex justify-between">
                                        <span className="font-semibold text-gray-500">Cap:</span>
                                        <span className="font-bold text-gray-700">{formatCompact(asset.market_cap)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-semibold text-gray-500">Vol:</span>
                                        <span className="font-bold text-gray-700">{formatCompact(asset.total_volume)}</span>
                                    </div>
                                    <div className="flex justify-between">
                                        <span className="font-semibold text-gray-500">H/L:</span>
                                        <span className="font-bold text-gray-400">Stats</span>
                                    </div>
                                </div>

                                {/* Column 4: Supply Data */}
                                <div className="flex flex-col gap-1.5 sm:border-l border-gray-100 sm:pl-3 text-sm">
                                    <div className="flex justify-between" title="Total Supply">
                                        <span className="font-semibold text-gray-500">Total:</span>
                                        <span className="font-bold text-gray-700">{formatCompactNum(asset.total_supply)}</span>
                                    </div>
                                    <div className="flex justify-between" title="Circulating Supply">
                                        <span className="font-semibold text-gray-500">Circ:</span>
                                        <span className="font-bold text-gray-700">{formatCompactNum(asset.circulating_supply)}</span>
                                    </div>
                                    <div className="flex justify-between" title="Circulating Percentage">
                                        <span className="font-semibold text-gray-500">Circ %:</span>
                                        <span className="font-bold text-blue-600">
                                            {asset.total_supply && asset.circulating_supply 
                                                ? ((asset.circulating_supply / asset.total_supply) * 100).toFixed(1) + '%'
                                                : '-'}
                                        </span>
                                    </div>
                                </div>

                                {/* Column 5: Potential (New) */}
                                <div className="flex flex-col gap-1.5 sm:border-l border-gray-100 sm:pl-3 text-sm bg-blue-50/50 rounded-lg p-1 sm:bg-transparent sm:p-0">
                                    <div className="flex justify-between" title={`Investment: $${calcInput}`}>
                                        <span className="font-semibold text-gray-500">Inv:</span>
                                        <span className="font-bold text-gray-700">${calcInput}</span>
                                    </div>
                                    <div className="flex justify-between" title="Value if ATH reached">
                                        <span className="font-semibold text-gray-500">Val:</span>
                                        <span className="font-bold text-blue-600">{potentialValue > 0 ? formatCurrency(potentialValue) : '-'}</span>
                                    </div>
                                    <div className="flex justify-between" title="Multiplier to ATH">
                                        <span className="font-semibold text-gray-500">X:</span>
                                        <span className="font-bold text-green-600">{multiplier > 0 ? multiplier.toFixed(1) + 'x' : '-'}</span>
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
                            <div className="px-4 py-3 bg-gray-50 border-b border-gray-100 flex flex-col gap-3 shrink-0">
                                {/* External Links */}
                                <div className="flex items-center gap-2">
                                    <a 
                                        href={`https://www.coingecko.com/en/coins/${asset.id}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex-1 text-center py-2 rounded bg-white border border-gray-200 text-xs font-bold text-gray-600 hover:bg-green-50 hover:text-green-700 hover:border-green-200 transition-all shadow-sm truncate"
                                        title="مشاهده در CoinGecko"
                                    >
                                        CoinGecko
                                    </a>
                                    <a 
                                        href={`https://coinmarketcap.com/currencies/${asset.name.trim().toLowerCase().replace(/\s+/g, '-')}`} 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex-1 text-center py-2 rounded bg-white border border-gray-200 text-xs font-bold text-gray-600 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-200 transition-all shadow-sm truncate"
                                        title="مشاهده در CoinMarketCap"
                                    >
                                        CoinMarketCap
                                    </a>
                                    <a 
                                        href="https://app.cryptopective.com/" 
                                        target="_blank" 
                                        rel="noopener noreferrer"
                                        className="flex-1 text-center py-2 rounded bg-blue-600 border border-blue-600 text-xs font-bold text-white hover:bg-blue-700 hover:border-blue-700 transition-all shadow-sm truncate"
                                        title="تحلیل در CryptoPective"
                                    >
                                        CryptoPective
                                    </a>
                                </div>
                                {/* Chart Toggle */}
                                <div className="flex bg-gray-100 rounded-lg p-1 w-full">
                                    <button 
                                        onClick={() => toggleChartMode(asset.id, 'PRICE')}
                                        className={`flex-1 py-1.5 rounded-md text-sm font-bold transition-all ${currentChartMode === 'PRICE' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        قیمت
                                    </button>
                                    <button 
                                        onClick={() => toggleChartMode(asset.id, 'MCAP')}
                                        className={`flex-1 py-1.5 rounded-md text-sm font-bold transition-all ${currentChartMode === 'MCAP' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        ارزش بازار
                                    </button>
                                    <button 
                                        onClick={() => toggleChartMode(asset.id, 'BOTH')}
                                        className={`flex-1 py-1.5 rounded-md text-sm font-bold transition-all ${currentChartMode === 'BOTH' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                    >
                                        همزمان
                                    </button>
                                    <button 
                                        onClick={() => handleInfoClick(asset)}
                                        className={`flex-1 py-1.5 rounded-md text-sm font-bold transition-all ${currentChartMode === 'INFO' ? 'bg-blue-600 text-white shadow-sm' : 'text-gray-500 hover:text-gray-100'}`}
                                    >
                                        تحلیل
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* 4. Chart or Info Content */}
                        <div className="flex-grow bg-white relative w-full h-full min-h-0 rounded-b-xl overflow-hidden">
                          {currentChartMode === 'INFO' ? (
                            <div className="p-6 h-full overflow-y-auto custom-scrollbar bg-white">
                                <div className="flex flex-col gap-6">
                                    {insight ? (
                                        <>
                                            <div className="bg-purple-50 p-4 rounded-xl border border-purple-100">
                                                <h4 className="text-purple-800 font-bold mb-2 flex items-center gap-2">
                                                    <span className="text-xl">📂</span> دسته‌بندی
                                                </h4>
                                                <p className="text-gray-700 font-medium leading-relaxed">{insight.category}</p>
                                            </div>

                                            <div>
                                                <h4 className="text-gray-800 font-bold mb-2 flex items-center gap-2">
                                                    <span className="text-xl">🛠️</span> کاربرد و هدف پروژه
                                                </h4>
                                                <p className="text-gray-600 leading-loose text-justify">{insight.utility}</p>
                                            </div>

                                            <div>
                                                <h4 className="text-gray-800 font-bold mb-2 flex items-center gap-2">
                                                    <span className="text-xl">🚀</span> آینده و پتانسیل رشد
                                                </h4>
                                                <p className="text-gray-600 leading-loose text-justify">{insight.outlook}</p>
                                            </div>
                                        </>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center h-full text-center py-10 opacity-70">
                                            <span className="text-4xl mb-4">📝</span>
                                            <p className="text-gray-500 font-medium">داده‌های تحلیلی برای این ارز در دسترس نیست.</p>
                                        </div>
                                    )}
                                </div>
                            </div>
                          ) : (
                            <div className="w-full h-full">
                                {currentChartMode === 'BOTH' ? (
                                    <div className="flex flex-col h-full">
                                        <div className="h-1/2 border-b border-gray-100 relative">
                                            <LazyWidget>
                                                <TradingViewWidget isLogScale={isLogScale} symbol={getTradingViewSymbol(asset)} interval={interval} />
                                            </LazyWidget>
                                        </div>
                                        <div className="h-1/2 relative">
                                            <LazyWidget>
                                                <TradingViewWidget isLogScale={isLogScale} symbol={`CRYPTOCAP:${asset.symbol.toUpperCase()}`} interval={interval} />
                                            </LazyWidget>
                                        </div>
                                    </div>
                                ) : (
                                    <LazyWidget>
                                        <TradingViewWidget 
                                            isLogScale={isLogScale} 
                                            symbol={tvSymbol} 
                                            interval={interval} 
                                        />
                                    </LazyWidget>
                                )}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  </div>
               )}

               {viewMode === 'TABLE' && (
                  <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-x-auto min-h-[500px]">
                      <table className="w-full text-right text-sm">
                        <thead className="bg-gray-50 text-gray-600 font-bold border-b border-gray-200">
                           <tr>
                             <th className="px-4 py-3 cursor-pointer whitespace-nowrap" onClick={() => handleSort('market_cap_rank')}># {getSortIndicator('market_cap_rank')}</th>
                             <th className="px-4 py-3 cursor-pointer whitespace-nowrap" onClick={() => handleSort('name')}>نام ارز {getSortIndicator('name')}</th>
                             <th className="px-4 py-3 cursor-pointer whitespace-nowrap" onClick={() => handleSort('current_price')}>قیمت {getSortIndicator('current_price')}</th>
                             <th className="px-4 py-3 cursor-pointer whitespace-nowrap" onClick={() => handleSort('price_change_percentage_24h')}>تغییر 24h {getSortIndicator('price_change_percentage_24h')}</th>
                             <th className="px-4 py-3 cursor-pointer whitespace-nowrap" onClick={() => handleSort('market_cap')}>ارزش بازار {getSortIndicator('market_cap')}</th>
                             <th className="px-4 py-3 cursor-pointer whitespace-nowrap" onClick={() => handleSort('total_volume')}>حجم معاملات {getSortIndicator('total_volume')}</th>
                             <th className="px-4 py-3 whitespace-nowrap">عملیات</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {sortedAssets.map((asset) => {
                              const isFav = currentFavoritesSet.has(asset.id);
                              return (
                                <tr key={asset.id} className="hover:bg-gray-50 transition-colors relative">
                                  <td className="px-4 py-3 font-mono text-gray-500">{asset.market_cap_rank || '-'}</td>
                                  <td className="px-4 py-3">
                                      <div className="flex items-center gap-2">
                                          <img src={getImage(asset)} alt={asset.name} className="w-6 h-6 rounded-full" />
                                          <div className="flex flex-col">
                                              <span className="font-bold text-gray-800">{asset.symbol.toUpperCase()}</span>
                                              <span className="text-xs text-gray-500">{asset.name}</span>
                                          </div>
                                      </div>
                                  </td>
                                  <td className="px-4 py-3 font-medium text-gray-700">{formatCurrency(asset.current_price)}</td>
                                  <td className={`px-4 py-3 font-bold dir-ltr text-right ${getPercentClass(asset.price_change_percentage_24h)}`}>
                                      {fmtPct(asset.price_change_percentage_24h)}
                                  </td>
                                  <td className="px-4 py-3 text-gray-600">{formatCompact(asset.market_cap)}</td>
                                  <td className="px-4 py-3 text-gray-600">{formatCompact(asset.total_volume)}</td>
                                  <td className="px-4 py-3">
                                      <div className="flex items-center gap-2 relative fav-menu-container">
                                          
                                          {/* Popup Menu */}
                                          {openFavMenuId === asset.id && (
                                              <div className="absolute right-8 top-0 z-50 bg-white rounded-xl shadow-xl border border-gray-100 p-3 min-w-[200px] animate-[fadeIn_0.1s_ease-out] text-right">
                                                  <div className="text-xs font-bold text-gray-400 mb-2 px-1">ذخیره در لیست‌های:</div>
                                                  <div className="flex flex-col gap-1 max-h-[200px] overflow-y-auto custom-scrollbar">
                                                      {Object.keys(favLists).map(listName => {
                                                          const isChecked = favLists[listName]?.has(asset.id);
                                                          return (
                                                              <label key={listName} className="flex items-center gap-2 px-2 py-1.5 hover:bg-gray-50 rounded cursor-pointer transition-colors justify-start">
                                                                  <input 
                                                                      type="checkbox" 
                                                                      checked={isChecked}
                                                                      onChange={() => toggleAssetInList(listName, asset.id)}
                                                                      className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4 border-gray-300"
                                                                  />
                                                                  <span className={`text-sm ${isChecked ? 'text-gray-800 font-bold' : 'text-gray-600'}`}>{listName}</span>
                                                              </label>
                                                          );
                                                      })}
                                                  </div>
                                                  <div className="border-t border-gray-100 mt-2 pt-2 text-center">
                                                      <button 
                                                          onClick={(e) => { e.stopPropagation(); setShowAddListInput(true); setOpenFavMenuId(null); }}
                                                          className="text-xs text-blue-600 hover:text-blue-800 font-bold w-full"
                                                      >
                                                          + لیست جدید
                                                      </button>
                                                  </div>
                                              </div>
                                          )}

                                          <button 
                                              onClick={(e) => toggleFavMenu(e, asset.id)}
                                              className={`text-lg transition-colors p-1 rounded hover:bg-gray-100 ${isFav ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-400'}`}
                                          >
                                              ★
                                          </button>
                                          <button 
                                              onClick={() => removeAsset(asset.id)}
                                              className="text-gray-300 hover:text-red-500 transition-colors p-1 rounded hover:bg-red-50"
                                          >
                                              ✕
                                          </button>
                                      </div>
                                  </td>
                                </tr>
                              );
                          })}
                        </tbody>
                      </table>
                  </div>
               )}

               {/* Pagination Bottom */}
               {!loading && sortedAssets.length > 0 && <PaginationControls />}
            </>
        )}
      </main>
      
      {showSymbolList && (
        <BlockedListModal 
            blockedIds={removedIds} 
            allAssets={allFetchedAssets} 
            onClose={() => setShowSymbolList(false)} 
        />
      )}
    </div>
  );
};

export default App;