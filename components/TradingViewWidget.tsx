import React, { useEffect, useRef, memo } from 'react';

// Declare TradingView on the window object to satisfy TypeScript
declare global {
  interface Window {
    TradingView: any;
  }
}

interface TradingViewWidgetProps {
  isLogScale: boolean;
  symbol: string;
}

const TradingViewWidget: React.FC<TradingViewWidgetProps> = ({ isLogScale, symbol }) => {
  // Generate a unique ID for the container. 
  // We use a random suffix because the same symbol might be remounted or used in different contexts
  // although in this grid, symbol is usually unique.
  const containerId = useRef(`tv_${symbol.replace(/[^a-zA-Z0-9]/g, '')}_${Math.random().toString(36).substr(2, 9)}`);

  useEffect(() => {
    // Ensure the container exists and script is loaded
    if (window.TradingView) {
      const container = document.getElementById(containerId.current);
      if (container) {
        container.innerHTML = ''; // Clear previous widget
      }

      new window.TradingView.widget({
        autosize: true,
        symbol: symbol,
        interval: "1M", // Monthly timeframe
        timezone: "Etc/UTC",
        theme: "light", // White theme
        style: "1", // Candles
        locale: "fa",
        toolbar_bg: "#f1f3f6",
        enable_publishing: false,
        hide_top_toolbar: false,
        hide_legend: false,
        save_image: false,
        container_id: containerId.current,
        // Crucial: Disable local storage to ensure overrides (like log scale) are applied every time
        disabled_features: [
          "use_localstorage_for_settings", 
          "header_symbol_search", 
          "header_compare",
          "create_volume_indicator_by_default" // Remove volume indicator
        ],
        enabled_features: ["hide_left_toolbar_by_default"],
        overrides: {
          "mainSeriesProperties.priceAxisProperties.log": isLogScale,
          "mainSeriesProperties.showCountdown": true, // Show candle countdown
          "paneProperties.background": "#ffffff",
          "paneProperties.vertGridProperties.color": "#f8f9fa",
          "paneProperties.horzGridProperties.color": "#f8f9fa",
          "scalesProperties.textColor": "#333333",
        }
      });
    }
  }, [isLogScale, symbol]); // Re-run when isLogScale or symbol changes

  return (
    <div className="w-full h-full border-t border-gray-100">
      <div id={containerId.current} className="h-full w-full" />
    </div>
  );
};

export default memo(TradingViewWidget);