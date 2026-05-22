import React, { useEffect, useState, useRef, useCallback } from 'react';
import { LogIn, LogOut, Search, User, TrendingUp, HelpCircle } from 'lucide-react';
import { 
  getStocks, 
  getWatchlist, 
  getMe, 
  updatePreferences, 
  addToWatchlist, 
  removeFromWatchlist, 
  getPrices, 
  getLatestTrendingPrices 
} from './utils/api';
import AuthModal from './components/AuthModal';
import StatCard from './components/StatCard';
import TickerGrid from './components/TickerGrid';
import TickerSelector from './components/TickerSelector';
import StockChart from './components/StockChart';

export default function App() {
  // --- State Variables ---
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [catalog, setCatalog] = useState([]);
  const [watchlist, setWatchlist] = useState([]);
  const [latestPrices, setLatestPrices] = useState({});
  const [selectedTicker, setSelectedTicker] = useState('AAPL');
  const [chartPrices, setChartPrices] = useState([]);
  const [chartPeriod, setChartPeriod] = useState('1M');
  const [chartLoading, setChartLoading] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);

  const wsRef = useRef(null);

  // --- Auth callbacks ---
  const handleAuthSuccess = (newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setWatchlist([]);
    setSelectedTicker('AAPL');
  };

  // --- API Sync Helpers ---
  const fetchProfile = async () => {
    try {
      const u = await getMe(token);
      setUser(u);
      setWatchlist(u.watchlist || []);
      if (u.preferences?.default_timeframe) {
        setChartPeriod(u.preferences.default_timeframe);
      }
    } catch (err) {
      handleLogout();
    }
  };

  const fetchCatalogAndTrending = async () => {
    try {
      const cat = await getStocks();
      setCatalog(cat);

      // Load initial price ticks
      const trendingPrices = await getLatestTrendingPrices();
      setLatestPrices(trendingPrices);
    } catch (err) {
      console.error("Failed to load initial catalog/prices", err);
    }
  };

  const fetchHistory = async () => {
    if (!selectedTicker) return;
    setChartLoading(true);
    try {
      const data = await getPrices(selectedTicker, chartPeriod);
      setChartPrices(data);
    } catch (err) {
      console.error("Failed to fetch historical chart data", err);
    } finally {
      setChartLoading(false);
    }
  };

  // Fetch initial profile & catalog
  useEffect(() => {
    fetchCatalogAndTrending();
  }, []);

  useEffect(() => {
    if (token) {
      fetchProfile();
    }
  }, [token]);

  // Fetch history when ticker or period changes
  useEffect(() => {
    fetchHistory();
  }, [selectedTicker, chartPeriod]);

  // --- Watchlist Action Handlers ---
  const handleAddTicker = async (ticker) => {
    try {
      const item = await addToWatchlist(token, ticker);
      setWatchlist(prev => [...prev, item]);
      
      // Seed details immediately
      setSelectedTicker(ticker);
      
      // Fetch latest price dynamically
      fetch(`/api/prices/${ticker}/latest`)
        .then(res => res.json())
        .then(data => {
          setLatestPrices(prev => ({ ...prev, [ticker]: data }));
        })
        .catch(() => {});

    } catch (err) {
      alert(err.message);
    }
  };

  const handleRemoveTicker = async (ticker) => {
    try {
      await removeFromWatchlist(token, ticker);
      setWatchlist(prev => prev.filter(w => w.ticker.toUpperCase() !== ticker.toUpperCase()));
      if (selectedTicker.toUpperCase() === ticker.toUpperCase()) {
        setSelectedTicker(watchlist[0]?.ticker || 'AAPL');
      }
    } catch (err) {
      alert(err.message);
    }
  };

  // --- WebSocket Connection Manager ---
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use location.host to automatically proxy to Docker Compose port 80 / Nginx or dev server
    const wsUrl = `${protocol}//${window.location.host}/api/ws`;

    const connectWebSocket = () => {
      console.log(`Connecting to WebSocket: ${wsUrl}`);
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        console.log("WebSocket connection established successfully");
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const tick = JSON.parse(event.data);
          
          // Update real-time price state
          setLatestPrices(prev => ({
            ...prev,
            [tick.ticker]: tick
          }));

          // High-fidelity live charts:
          // If viewing the 1D chart for the active selected ticker, append the incoming tick in real-time
          if (tick.ticker === selectedTicker && chartPeriod === '1D') {
            setChartPrices(prev => {
              const newTs = new Date(tick.timestamp);
              const lastPoint = prev[prev.length - 1];
              
              if (lastPoint) {
                const lastTs = new Date(lastPoint.timestamp);
                // If tick falls into the same minute, update the last data point
                if (lastTs.getMinutes() === newTs.getMinutes() && lastTs.getHours() === newTs.getHours()) {
                  const updated = [...prev];
                  updated[updated.length - 1] = {
                    ...lastPoint,
                    close: tick.price,
                    high: Math.max(lastPoint.high, tick.price),
                    low: Math.min(lastPoint.low, tick.price)
                  };
                  return updated;
                }
              }
              // Append a new chart row
              return [
                ...prev,
                {
                  ticker: tick.ticker,
                  timestamp: tick.timestamp,
                  open: tick.price,
                  high: tick.price,
                  low: tick.price,
                  close: tick.price,
                  volume: tick.volume
                }
              ];
            });
          }
        } catch (e) {
          console.error("Error parsing WebSocket frame", e);
        }
      };

      ws.onclose = () => {
        console.log("WebSocket disconnected. Retrying connection in 5 seconds...");
        setWsConnected(false);
        setTimeout(connectWebSocket, 5000);
      };

      ws.onerror = (err) => {
        console.error("WebSocket connection failure", err);
        ws.close();
      };
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [selectedTicker, chartPeriod]);

  return (
    <div className="min-h-screen pb-12">
      
      {/* --- Premium Navigation Header --- */}
      <header className="sticky top-0 z-40 bg-zinc-950/70 backdrop-blur-lg border-b border-zinc-800/40">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <span className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-400 via-fuchsia-400 to-pink-500 font-sans tracking-tight">
              AURA
            </span>
            <div className="h-4 w-[1px] bg-zinc-800"></div>
            <span className="text-xs font-semibold text-zinc-400 uppercase tracking-widest font-sans">
              Live Stock Terminal
            </span>
          </div>

          <div className="flex items-center gap-4">
            {user ? (
              <div className="flex items-center gap-4">
                {/* User email badge */}
                <div className="flex items-center gap-2 px-3 py-1 bg-zinc-900 border border-zinc-800 rounded-full text-xs text-zinc-300">
                  <User className="w-3.5 h-3.5 text-violet-400" />
                  <span>{user.email}</span>
                </div>
                <button
                  onClick={handleLogout}
                  className="flex items-center gap-1.5 glass-btn-secondary px-3 py-1.5 text-xs font-semibold rounded-lg"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            ) : (
              <button
                onClick={() => setIsAuthModalOpen(true)}
                className="flex items-center gap-1.5 glass-btn-primary px-4.5 py-1.5 text-xs font-bold rounded-lg"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>Access Terminal</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* --- Main Dashboard Container --- */}
      <main className="max-w-7xl mx-auto px-6 mt-8 space-y-6">
        
        {/* Onboarding Info Card (if guest) */}
        {!user && (
          <div className="p-5 glass-panel border border-violet-500/10 bg-violet-500/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 animate-pulse-slow">
            <div className="flex items-start gap-3.5">
              <span className="text-2xl mt-0.5">💡</span>
              <div>
                <h4 className="font-semibold text-white text-sm">Guest Terminal Active</h4>
                <p className="text-xs text-zinc-400 mt-0.5">
                  You are tracking trending stocks in live view. <strong>Sign In</strong> to build custom watchlists and persist preferences.
                </p>
              </div>
            </div>
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="glass-btn-primary py-1.5 px-4 text-xs tracking-wide shrink-0"
            >
              Sign Up Free
            </button>
          </div>
        )}

        {/* Analytics summary row */}
        <StatCard 
          wsConnected={wsConnected}
          watchlist={watchlist}
          latestPrices={latestPrices}
          isAuth={!!user}
          catalog={catalog}
        />

        {/* Dynamic Watchlist / Ticker selection section */}
        <TickerGrid 
          catalog={catalog}
          watchlist={watchlist}
          latestPrices={latestPrices}
          selectedTicker={selectedTicker}
          onSelectTicker={setSelectedTicker}
          onRemoveTicker={handleRemoveTicker}
          isAuth={!!user}
        />

        {/* Market Graph Analytics & Search catalog layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <StockChart 
              ticker={selectedTicker}
              prices={chartPrices}
              period={chartPeriod}
              onPeriodChange={setChartPeriod}
              loading={chartLoading}
            />
          </div>
          <div className="lg:col-span-1">
            <TickerSelector 
              catalog={catalog}
              watchlist={watchlist}
              onAddTicker={handleAddTicker}
              onRemoveTicker={handleRemoveTicker}
              isAuth={!!user}
              onPromptAuth={() => setIsAuthModalOpen(true)}
            />
          </div>
        </div>

      </main>

      {/* --- Authentication Modal (SignUp/SignIn Overlay) --- */}
      <AuthModal 
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onSuccess={handleAuthSuccess}
      />

    </div>
  );
}
