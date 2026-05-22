import React, { useEffect, useRef, useState } from 'react';
import { TrendingUp, TrendingDown, Trash2, Activity } from 'lucide-react';

function TickerCard({ ticker, name, price, change, pctChange, isSelected, onClick, onRemove, isAuth }) {
  const [flashClass, setFlashClass] = useState('');
  const prevPriceRef = useRef(price);

  // Trigger glowing animations when WebSocket price updates arrive
  useEffect(() => {
    if (price !== undefined && prevPriceRef.current !== undefined && price !== prevPriceRef.current) {
      const isUp = price > prevPriceRef.current;
      setFlashClass(isUp ? 'animate-flash-green' : 'animate-flash-red');
      prevPriceRef.current = price;

      const timer = setTimeout(() => {
        setFlashClass('');
      }, 800);
      return () => clearTimeout(timer);
    } else if (price !== undefined) {
      prevPriceRef.current = price;
    }
  }, [price]);

  const isPositive = change >= 0;

  return (
    <div
      onClick={onClick}
      className={`relative p-5 glass-card cursor-pointer flex flex-col justify-between hover:scale-[1.02] border transition-all duration-300 ${
        isSelected
          ? 'border-violet-500 bg-violet-500/5 shadow-violet-500/5'
          : 'border-zinc-800/40 hover:border-zinc-700/60'
      } ${flashClass}`}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <span className="font-bold text-white tracking-wide text-lg">{ticker}</span>
          <span className="block text-xs text-zinc-400 font-sans truncate max-w-[130px]">{name}</span>
        </div>
        
        {/* Remove Button for watchlists */}
        {isAuth && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onRemove(ticker);
            }}
            className="p-1.5 opacity-0 group-hover:opacity-100 hover:opacity-100 transition-opacity rounded-md text-zinc-500 hover:text-rose-400 hover:bg-rose-500/10"
            title="Remove from watchlist"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      <div className="flex justify-between items-end mt-2">
        <div className="font-mono text-xl font-bold text-white">
          {price !== undefined ? `$${price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}` : '--'}
        </div>
        
        {price !== undefined ? (
          <div className={`flex items-center gap-1 font-semibold text-xs px-2 py-0.5 rounded-full ${
            isPositive
              ? 'text-emerald-400 bg-emerald-500/10'
              : 'text-rose-400 bg-rose-500/10'
          }`}>
            {isPositive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            <span>{isPositive ? '+' : ''}{pctChange?.toFixed(2)}%</span>
          </div>
        ) : (
          <span className="text-xs text-zinc-600 font-medium">Connecting...</span>
        )}
      </div>
      
    </div>
  );
}

export default function TickerGrid({ catalog, watchlist, latestPrices, selectedTicker, onSelectTicker, onRemoveTicker, isAuth }) {
  // Combine user watchlist tickers with catalog details and latest realtime prices
  const activeItems = useMemo(() => {
    // If user is not authenticated, display catalog's default trending tickers
    const trackingTickers = isAuth 
      ? watchlist.map(w => w.ticker.upper()) 
      : catalog.filter(c => c.is_trending).map(c => c.ticker);

    return trackingTickers.map(ticker => {
      const meta = catalog.find(c => c.ticker === ticker) || { name: ticker, sector: 'Unknown' };
      const current = latestPrices[ticker] || {};
      return {
        ticker,
        name: meta.name,
        price: current.price,
        change: current.change,
        pctChange: current.pct_change
      };
    });
  }, [catalog, watchlist, latestPrices, isAuth]);

  // Memoize since combining items has array computations
  function useMemo(factory, deps) {
    return React.useMemo(factory, deps);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <Activity className="w-5 h-5 text-violet-400 animate-pulse" />
        <h3 className="text-md font-bold tracking-wider text-zinc-400 uppercase">
          {isAuth ? 'Your Watchlist' : 'Trending Stock Stream'}
        </h3>
      </div>

      {activeItems.length === 0 ? (
        <div className="p-8 text-center glass-panel">
          <span className="block text-3xl mb-1">🧭</span>
          <p className="text-sm text-zinc-400">Your watchlist is currently empty.</p>
          <p className="text-xs text-zinc-500 mt-1">Search the stock catalogue below to add tickers!</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {activeItems.map((item) => (
            <TickerCard
              key={item.ticker}
              ticker={item.ticker}
              name={item.name}
              price={item.price}
              change={item.change}
              pctChange={item.pctChange}
              isSelected={selectedTicker === item.ticker}
              onClick={() => onSelectTicker(item.ticker)}
              onRemove={onRemoveTicker}
              isAuth={isAuth}
            />
          ))}
        </div>
      )}
    </div>
  );
}
