import React, { useMemo } from 'react';
import { Radio, Heart, TrendingUp, TrendingDown } from 'lucide-react';

export default function StatCard({ wsConnected, watchlist, latestPrices, isAuth, catalog }) {
  // Compute analytics from active watchlist (or default catalog)
  const stats = useMemo(() => {
    const trackingTickers = isAuth
      ? watchlist.map(w => w.ticker.toUpperCase())
      : catalog.filter(c => c.is_trending).map(c => c.ticker.toUpperCase());

    const activeQuotes = trackingTickers
      .map(ticker => latestPrices[ticker])
      .filter(q => q && q.pct_change !== undefined);

    let topGainer = null;
    let topLoser = null;

    if (activeQuotes.length > 0) {
      // Find top gainer
      topGainer = activeQuotes.reduce((prev, current) => 
        (prev.pct_change > current.pct_change) ? prev : current
      );

      // Find top loser
      topLoser = activeQuotes.reduce((prev, current) => 
        (prev.pct_change < current.pct_change) ? prev : current
      );
    }

    return {
      count: trackingTickers.length,
      topGainer,
      topLoser
    };
  }, [watchlist, latestPrices, isAuth, catalog]);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
      
      {/* 1. WebSocket Live Stream Card */}
      <div className="p-4 glass-card flex items-center justify-between border border-zinc-800/40">
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 font-sans">
            Socket Feed
          </span>
          <span className="block text-lg font-bold text-white mt-1">
            {wsConnected ? 'LIVE UPDATES' : 'CONNECTING'}
          </span>
        </div>
        <div className={`p-2.5 rounded-xl border flex items-center justify-center ${
          wsConnected 
            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' 
            : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
        }`}>
          <Radio className={`w-5 h-5 ${wsConnected ? 'animate-pulse' : ''}`} />
        </div>
      </div>

      {/* 2. Tracked Asset Counter */}
      <div className="p-4 glass-card flex items-center justify-between border border-zinc-800/40">
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 font-sans">
            {isAuth ? 'Your Deck' : 'Onboarding Deck'}
          </span>
          <span className="block text-lg font-bold text-white mt-1">
            {stats.count} Symbols Active
          </span>
        </div>
        <div className="p-2.5 rounded-xl border border-violet-500/30 bg-violet-500/10 text-violet-400">
          <Heart className="w-5 h-5" />
        </div>
      </div>

      {/* 3. Top Market Gainer */}
      <div className="p-4 glass-card flex items-center justify-between border border-zinc-800/40">
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 font-sans">
            Top Gainer
          </span>
          {stats.topGainer ? (
            <div className="mt-1">
              <span className="font-bold text-white mr-1.5">{stats.topGainer.ticker}</span>
              <span className="text-emerald-400 text-xs font-semibold">
                +{stats.topGainer.pct_change.toFixed(2)}%
              </span>
            </div>
          ) : (
            <span className="block text-sm text-zinc-500 mt-1">Calculating ticks...</span>
          )}
        </div>
        <div className="p-2.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 text-emerald-400">
          <TrendingUp className="w-5 h-5" />
        </div>
      </div>

      {/* 4. Top Market Loser */}
      <div className="p-4 glass-card flex items-center justify-between border border-zinc-800/40">
        <div>
          <span className="block text-xs font-semibold uppercase tracking-wider text-zinc-500 font-sans">
            Top Loser
          </span>
          {stats.topLoser ? (
            <div className="mt-1">
              <span className="font-bold text-white mr-1.5">{stats.topLoser.ticker}</span>
              <span className="text-rose-400 text-xs font-semibold">
                {stats.topLoser.pct_change.toFixed(2)}%
              </span>
            </div>
          ) : (
            <span className="block text-sm text-zinc-500 mt-1">Calculating ticks...</span>
          )}
        </div>
        <div className="p-2.5 rounded-xl border border-rose-500/30 bg-rose-500/10 text-rose-400">
          <TrendingDown className="w-5 h-5" />
        </div>
      </div>

    </div>
  );
}
