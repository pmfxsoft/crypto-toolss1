import React, { useState } from 'react';
import TradingViewWidget from './components/TradingViewWidget';

const App: React.FC = () => {
  const [isLogScale, setIsLogScale] = useState(true);

  const handleScaleChange = () => {
    setIsLogScale(prev => !prev);
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-800 flex flex-col items-center p-4 sm:p-6 md:p-8 font-sans">
      <header className="w-full max-w-7xl mx-auto mb-8 text-center">
        <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-gray-900 mb-2">
          نمودار پیشرفته بیت‌کوین
        </h1>
        <p className="text-lg text-gray-500 mb-6">
          نمودار زنده BTC/USD در تایم‌فریم ماهانه
        </p>

        {/* Scale Toggle Switch */}
        <div className="inline-flex items-center justify-center bg-white p-2 rounded-full shadow-sm border border-gray-200">
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

      <main className="w-full max-w-7xl flex-grow flex flex-col">
        <TradingViewWidget isLogScale={isLogScale} />
      </main>
      
      <footer className="mt-8 text-center text-gray-400 text-sm">
        <p>داده‌ها توسط TradingView ارائه می‌شوند</p>
      </footer>
    </div>
  );
};

export default App;