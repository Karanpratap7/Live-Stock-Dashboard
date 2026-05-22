import React, { useState, useMemo } from 'react';
import { Search, Plus, Check, Lock, ChevronRight } from 'lucide-react';

export default function TickerSelector({ catalog, watchlist, onAddTicker, onRemoveTicker, isAuth, onPromptAuth }) {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');

  // Extract all categories
  const categories = useMemo(() => {
    const cats = new Set(catalog.map(s => s.category));
    return ['All', ...Array.from(cats)];
  }, [catalog]);

  // Filter catalog based on search input & category tab
  const filteredCatalog = useMemo(() => {
    return catalog.filter(stock => {
      const matchesSearch = 
        stock.ticker.toLowerCase().includes(search.toLowerCase()) ||
        stock.name.toLowerCase().includes(search.toLowerCase());
      
      const matchesCategory = activeCategory === 'All' || stock.category === activeCategory;
      
      return matchesSearch && matchesCategory;
    });
  }, [catalog, search, activeCategory]);

  const isTracked = (ticker) => {
    return watchlist.some(item => item.ticker.upper() === ticker.upper());
  };

  const handleToggle = (ticker) => {
    if (!isAuth) {
      onPromptAuth();
      return;
    }
    if (isTracked(ticker)) {
      onRemoveTicker(ticker);
    } else {
      onAddTicker(ticker);
    }
  };

  // Helper because watchlist objects have upper/lower strings
  String.prototype.upper = function() {
    return this.toUpperCase();
  };

  return (
    <div className="p-6 glass-panel space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h3 className="text-lg font-bold text-white font-sans">Supported Ticker Catalog</h3>
          <p className="text-xs text-zinc-500">Discover and track 30+ equities & tokens across primary exchanges</p>
        </div>

        {/* Search Box */}
        <div className="relative max-w-xs w-full">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">
            <Search className="w-4 h-4" />
          </span>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search symbol or company..."
            className="w-full pl-9 pr-4 py-1.5 glass-input text-xs"
          />
        </div>
      </div>

      {/* Category Tabs */}
      <div className="flex gap-1.5 overflow-x-auto pb-2 border-b border-zinc-800/40">
        {categories.map(cat => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 rounded-full text-xs font-medium whitespace-nowrap transition-all duration-200 ${
              activeCategory === cat
                ? 'bg-violet-500/20 border border-violet-500/40 text-violet-300'
                : 'bg-zinc-900/30 border border-zinc-800/30 text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Grid of Catalog Stocks */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3 max-h-[250px] overflow-y-auto pr-1">
        {filteredCatalog.map(stock => {
          const tracked = isTracked(stock.ticker);
          return (
            <div
              key={stock.ticker}
              className={`p-3.5 flex items-center justify-between border rounded-xl transition-all duration-200 ${
                tracked 
                  ? 'border-violet-500/30 bg-violet-500/5' 
                  : 'border-zinc-850 bg-zinc-900/10 hover:border-zinc-850 hover:bg-zinc-900/30'
              }`}
            >
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white text-sm">{stock.ticker}</span>
                  <span className="text-[10px] text-zinc-500 px-1.5 py-0.2 bg-zinc-900 border border-zinc-800 rounded font-medium">
                    {stock.sector}
                  </span>
                </div>
                <span className="block text-[11px] text-zinc-400 font-sans truncate max-w-[150px] mt-0.5">
                  {stock.name}
                </span>
              </div>

              {/* Action Toggle Button */}
              <button
                onClick={() => handleToggle(stock.ticker)}
                className={`p-1.5 rounded-lg border transition-all duration-200 ${
                  tracked
                    ? 'bg-violet-500/20 border-violet-500/40 text-violet-400 hover:bg-rose-500/10 hover:border-rose-500/30 hover:text-rose-400'
                    : 'bg-zinc-950 border-zinc-800 text-zinc-400 hover:text-white hover:border-zinc-700'
                }`}
              >
                {!isAuth ? (
                  <Lock className="w-3.5 h-3.5" />
                ) : tracked ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Plus className="w-3.5 h-3.5" />
                )}
              </button>
            </div>
          );
        })}
      </div>

    </div>
  );
}
