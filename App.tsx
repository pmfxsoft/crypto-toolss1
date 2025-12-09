import React, { useState } from 'react';
import TradingViewWidget from './components/TradingViewWidget';

const TOP_CRYPTOS = [
  { symbol: "BITSTAMP:BTCUSD", name: "بیت‌کوین (BTC)" },
  { symbol: "BITSTAMP:ETHUSD", name: "اتریوم (ETH)" },
  { symbol: "BITSTAMP:XRPUSD", name: "ریپل (XRP)" },
  { symbol: "BINANCE:BNBUSDT", name: "بایننس کوین (BNB)" },
  { symbol: "BINANCE:SOLUSDT", name: "سولانا (SOL)" },
  { symbol: "BINANCE:DOGEUSDT", name: "دوج کوین (DOGE)" }
];

const App: React.FC = () => {
  const [isLogScale, setIsLogScale] = useState(true);

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 flex flex-col items-center p-4 sm:p-6 font-sans">
      <header className="w-full max-w-7xl mx-auto mb-8 text-center">
        <h1 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-2">
          داشبورد بازار کریپتو
        </h1>
        <p className="text-lg text-gray-500 mb-6">
          نمودار ۶ ارز برتر بازار در تایم‌فریم ماهانه
        </p>

        {/* Scale Toggle Switch */}
        <div className="inline-flex items-center justify-center bg-white p-2 rounded-full shadow-sm border border-gray-200 mb-4">
            <span 
              className={`cursor-pointer px-4 py-1 rounded-full text-sm font-medium transition-all duration-200 ${isLogScale ? 'bg-orange-500 text-white shadow' : 'text-gray-500 hover:text-gray-900'}`} 
              onClick={() => setIsLogScale(true)}
            >
            لگاریتمی
          </span>
          
          <div className="mx-2 text-gray-300">|</div>

           <span 
              className={`cursor-pointer px-4 py-1 rounded-full text-sm font-medium transition-all duration-200 ${!isLogScale ? 'bg-blue-500 text-white shadow' : 'text-gray-500 hover:text-gray-900'}`} 
              onClick={() => setIsLogScale(false)}
            >
            زمانی (خطی)
          </span>
        </div>
      </header>

      <main className="w-full max-w-[1920px] mx-auto flex-grow">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {TOP_CRYPTOS.map((crypto) => (
            <div key={crypto.symbol} className="flex flex-col">
              <h2 className="text-xl font-bold text-gray-700 mb-2 px-1 text-center md:text-right">{crypto.name}</h2>
              <TradingViewWidget isLogScale={isLogScale} symbol={crypto.symbol} />
            </div>
          ))}
        </div>
      </main>
      
      <footer className="mt-12 text-center text-gray-400 text-sm pb-4">
        <p>داده‌ها توسط TradingView ارائه می‌شوند</p>
      </footer>
    </div>
  );
};

export default App;