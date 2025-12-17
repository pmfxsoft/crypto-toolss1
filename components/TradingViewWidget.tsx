import React, { useEffect, memo } from 'react';

// Declare TradingView on the window object to satisfy TypeScript
declare global {
  interface Window {
    TradingView: any;
  }
}

interface TradingViewWidgetProps {
  isLogScale: boolean;
  symbol: string;
  interval: string;
}

const TradingViewWidget: React.FC<TradingViewWidgetProps> = ({ isLogScale, symbol, interval }) => {
  // Use a stable, simple container ID based on the symbol
  const containerId = `tv_widget_${symbol.replace(/[^a-zA-Z0-9]/g, '_')}`;

  useEffect(() => {
    // Ensure the container exists and script is loaded
    if (window.TradingView) {
      const container = document.getElementById(containerId);
      if (container) {
        container.innerHTML = ''; // Clear previous widget
      }

      new window.TradingView.widget({
        autosize: true,
        symbol: symbol,
        interval: interval, 
        timezone: "Etc/UTC",
        theme: "light",
        style: "1", // Candles
        locale: "fa",
        toolbar_bg: "#f1f3f6",
        enable_publishing: false,
        allow_symbol_change: true,
        hide_top_toolbar: false, 
        hide_legend: false,
        save_image: true,
        container_id: containerId,
        disabled_features: [
          "header_compare",
          "create_volume_indicator_by_default",
          "display_market_status"
        ],
        enabled_features: ["hide_left_toolbar_by_default"],
        overrides: {
          "mainSeriesProperties.priceAxisProperties.log": isLogScale,
          "mainSeriesProperties.showCountdown": true,
          "paneProperties.background": "#ffffff",
          "paneProperties.vertGridProperties.color": "#f8f9fa",
          "paneProperties.horzGridProperties.color": "#f8f9fa",
          "scalesProperties.textColor": "#333333",
          // Custom Candle Colors
          "mainSeriesProperties.candleStyle.upColor": "#81c784", 
          "mainSeriesProperties.candleStyle.downColor": "#636363",
          "mainSeriesProperties.candleStyle.borderUpColor": "#636363",
          "mainSeriesProperties.candleStyle.borderDownColor": "#636363",
          "mainSeriesProperties.candleStyle.wickUpColor": "#636363",
          "mainSeriesProperties.candleStyle.wickDownColor": "#636363",
        }
      });
    }
  }, [isLogScale, symbol, interval, containerId]);

  return (
    <div className="w-full h-full bg-white">
      <div id={containerId} className="h-full w-full" />
    </div>
  );
};

export default memo(TradingViewWidget);