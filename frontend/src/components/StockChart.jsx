import React, { useMemo, useState } from 'react';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line } from 'react-chartjs-2';
import { CalendarRange } from 'lucide-react';

// Register necessary Chart.js modules
ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

export default function StockChart({ ticker, prices, period, onPeriodChange, loading }) {
  const timeframes = ['1D', '1W', '1M', '1Y'];

  // Check the trend (Up/Down) based on the first and last prices
  const isUpTrend = useMemo(() => {
    if (!prices || prices.length < 2) return true;
    const first = prices[0].close;
    const last = prices[prices.length - 1].close;
    return last >= first;
  }, [prices]);

  // Construct chart data with gorgeous canvas gradients
  const chartData = useMemo(() => {
    if (!prices || prices.length === 0) return { labels: [], datasets: [] };

    const labels = prices.map(p => {
      const date = new Date(p.timestamp);
      if (period === '1D') {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      }
      return date.toLocaleDateString([], { month: 'short', day: '2-digit' });
    });

    const closePrices = prices.map(p => p.close);
    const accentColor = isUpTrend ? 'rgb(16, 185, 129)' : 'rgb(244, 63, 94)'; // emerald vs rose

    return {
      labels,
      datasets: [
        {
          label: `${ticker} Price`,
          data: closePrices,
          borderColor: accentColor,
          borderWidth: 2,
          pointRadius: prices.length > 50 ? 0 : 2,
          pointHoverRadius: 5,
          pointBackgroundColor: accentColor,
          fill: true,
          backgroundColor: (context) => {
            const chart = context.chart;
            const { ctx, chartArea } = chart;
            if (!chartArea) return null;
            
            const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
            if (isUpTrend) {
              gradient.addColorStop(0, 'rgba(16, 185, 129, 0.22)');
              gradient.addColorStop(1, 'rgba(16, 185, 129, 0.00)');
            } else {
              gradient.addColorStop(0, 'rgba(244, 63, 94, 0.22)');
              gradient.addColorStop(1, 'rgba(244, 63, 94, 0.00)');
            }
            return gradient;
          },
          tension: 0.15,
        }
      ]
    };
  }, [prices, ticker, isUpTrend, period]);

  // Premium, customized Chart options
  const chartOptions = useMemo(() => {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false,
        },
        tooltip: {
          mode: 'index',
          intersect: false,
          backgroundColor: 'rgba(24, 24, 27, 0.95)',
          titleFont: { family: 'Outfit', size: 13, weight: 'bold' },
          bodyFont: { family: 'Inter', size: 12 },
          borderColor: 'rgba(63, 63, 70, 0.4)',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 8,
          displayColors: false,
          callbacks: {
            label: (context) => {
              return ` Price: $${context.raw.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            display: false,
          },
          ticks: {
            color: 'rgb(113, 113, 122)',
            font: { family: 'Inter', size: 10 },
            maxTicksLimit: period === '1D' ? 8 : 12,
          }
        },
        y: {
          grid: {
            color: 'rgba(63, 63, 70, 0.15)',
          },
          ticks: {
            color: 'rgb(113, 113, 122)',
            font: { family: 'Inter', size: 10 },
            callback: (value) => `$${value.toLocaleString()}`,
          }
        }
      }
    };
  }, [period]);

  return (
    <div className="p-6 glass-panel flex flex-col h-[400px]">
      
      {/* Chart Toolbar */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div className="flex items-center gap-2">
          <CalendarRange className="w-5 h-5 text-violet-400" />
          <h3 className="text-lg font-bold text-white font-sans">
            Market Analytics <span className="text-zinc-500 font-normal">({ticker})</span>
          </h3>
        </div>
        
        {/* Timeframe Selectors */}
        <div className="flex gap-1.5 p-1 bg-zinc-950 border border-zinc-800 rounded-lg">
          {timeframes.map((tf) => (
            <button
              key={tf}
              onClick={() => onPeriodChange(tf)}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all duration-200 ${
                period === tf
                  ? 'bg-violet-600 text-white shadow-md shadow-violet-500/10'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              {tf}
            </button>
          ))}
        </div>
      </div>

      {/* Main Canvas Chart */}
      <div className="relative grow min-h-0 w-full flex items-center justify-center">
        {loading ? (
          <div className="flex flex-col items-center gap-2.5">
            <div className="w-8 h-8 border-2 border-violet-500/20 border-t-violet-500 rounded-full animate-spin"></div>
            <p className="text-xs text-zinc-500">Loading candles...</p>
          </div>
        ) : !prices || prices.length === 0 ? (
          <div className="text-center p-4">
            <span className="block text-3xl mb-1">📭</span>
            <p className="text-sm text-zinc-500">No trading logs recorded for {ticker}.</p>
          </div>
        ) : (
          <Line data={chartData} options={chartOptions} />
        )}
      </div>

    </div>
  );
}
