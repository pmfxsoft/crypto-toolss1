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
