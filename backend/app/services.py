import yfinance as yf
from datetime import datetime, timezone
import pandas as pd
from typing import List, Dict, Any, Optional

# Static Comprehensive Catalog of Listed and Trending Stocks (33 tickers)
STOCK_CATALOG = [
    # Tech / Growth
    {"ticker": "AAPL", "name": "Apple Inc.", "sector": "Technology", "category": "Tech Giants", "is_trending": True},
    {"ticker": "MSFT", "name": "Microsoft Corporation", "sector": "Technology", "category": "Tech Giants", "is_trending": True},
    {"ticker": "GOOGL", "name": "Alphabet Inc.", "sector": "Technology", "category": "Tech Giants", "is_trending": True},
    {"ticker": "AMZN", "name": "Amazon.com, Inc.", "sector": "Technology", "category": "Tech Giants", "is_trending": True},
    {"ticker": "TSLA", "name": "Tesla, Inc.", "sector": "Automotive / Energy", "category": "Tech Giants", "is_trending": True},
    {"ticker": "NVDA", "name": "NVIDIA Corporation", "sector": "Technology", "category": "Semiconductors", "is_trending": True},
    {"ticker": "META", "name": "Meta Platforms, Inc.", "sector": "Technology", "category": "Tech Giants", "is_trending": True},
    {"ticker": "NFLX", "name": "Netflix, Inc.", "sector": "Communication Services", "category": "Entertainment", "is_trending": False},
    {"ticker": "AMD", "name": "Advanced Micro Devices, Inc.", "sector": "Technology", "category": "Semiconductors", "is_trending": False},
    {"ticker": "INTC", "name": "Intel Corporation", "sector": "Technology", "category": "Semiconductors", "is_trending": False},
    {"ticker": "CRM", "name": "Salesforce, Inc.", "sector": "Technology", "category": "Enterprise Software", "is_trending": False},
    {"ticker": "ADBE", "name": "Adobe Inc.", "sector": "Technology", "category": "Enterprise Software", "is_trending": False},
    
    # Financials
    {"ticker": "JPM", "name": "JPMorgan Chase & Co.", "sector": "Financial Services", "category": "Banking", "is_trending": False},
    {"ticker": "BAC", "name": "Bank of America Corporation", "sector": "Financial Services", "category": "Banking", "is_trending": False},
    {"ticker": "GS", "name": "The Goldman Sachs Group, Inc.", "sector": "Financial Services", "category": "Banking", "is_trending": False},
    {"ticker": "V", "name": "Visa Inc.", "sector": "Financial Services", "category": "Payments", "is_trending": False},
    {"ticker": "MA", "name": "Mastercard Incorporated", "sector": "Financial Services", "category": "Payments", "is_trending": False},
    
    # Consumer Discretionary & Staples
    {"ticker": "WMT", "name": "Walmart Inc.", "sector": "Consumer Defensive", "category": "Retail", "is_trending": False},
    {"ticker": "COST", "name": "Costco Wholesale Corporation", "sector": "Consumer Defensive", "category": "Retail", "is_trending": False},
    {"ticker": "DIS", "name": "The Walt Disney Company", "sector": "Communication Services", "category": "Entertainment", "is_trending": False},
    {"ticker": "KO", "name": "The Coca-Cola Company", "sector": "Consumer Defensive", "category": "Beverages", "is_trending": False},
    {"ticker": "PEP", "name": "PepsiCo, Inc.", "sector": "Consumer Defensive", "category": "Beverages", "is_trending": False},
    {"ticker": "SBUX", "name": "Starbucks Corporation", "sector": "Consumer Cyclical", "category": "Restaurants", "is_trending": False},
    {"ticker": "NKE", "name": "NIKE, Inc.", "sector": "Consumer Cyclical", "category": "Apparel", "is_trending": False},
    
    # Energy & Industrials
    {"ticker": "XOM", "name": "Exxon Mobil Corporation", "sector": "Energy", "category": "Oil & Gas", "is_trending": False},
    {"ticker": "CVX", "name": "Chevron Corporation", "sector": "Energy", "category": "Oil & Gas", "is_trending": False},
    {"ticker": "CAT", "name": "Caterpillar Inc.", "sector": "Industrials", "category": "Machinery", "is_trending": False},
    {"ticker": "GE", "name": "General Electric Company", "sector": "Industrials", "category": "Conglomerates", "is_trending": False},
    
    # Crypto (Yahoo Finance equivalent trackers)
    {"ticker": "BTC-USD", "name": "Bitcoin USD", "sector": "Financial Services", "category": "Cryptocurrency", "is_trending": True},
    {"ticker": "ETH-USD", "name": "Ethereum USD", "sector": "Financial Services", "category": "Cryptocurrency", "is_trending": True}
]

DEFAULT_TICKERS = [s["ticker"] for s in STOCK_CATALOG if s["is_trending"]]

def get_stock_metadata(ticker: str) -> Optional[Dict[str, Any]]:
    """Returns catalog details for a ticker."""
    for stock in STOCK_CATALOG:
        if stock["ticker"].upper() == ticker.upper():
            return stock
    return None

def fetch_stock_history(ticker: str, period: str = "1M") -> List[Dict[str, Any]]:
    """
    Fetches historical OHLCV data from yfinance.
    Maps periods: 1D (5m ticks), 1W (15m ticks), 1M (daily), 1Y (daily)
    """
    yf_period = "1mo"
    yf_interval = "1d"

    if period == "1D":
        yf_period = "1d"
        yf_interval = "5m"
    elif period == "1W":
        yf_period = "5d"
        yf_interval = "15m"
    elif period == "1M":
        yf_period = "1mo"
        yf_interval = "1d"
    elif period == "1Y":
        yf_period = "1y"
        yf_interval = "1d"

    try:
        stock = yf.Ticker(ticker)
        df = stock.history(period=yf_period, interval=yf_interval)
        if df.empty:
            return []

        history = []
        for index, row in df.iterrows():
            # Convert pandas Timestamp to datetime timezone-aware
            ts = index.to_pydatetime()
            if ts.tzinfo is None:
                ts = ts.replace(tzinfo=timezone.utc)

            history.append({
                "ticker": ticker.upper(),
                "timestamp": ts,
                "open": float(row["Open"]),
                "high": float(row["High"]),
                "low": float(row["Low"]),
                "close": float(row["Close"]),
                "volume": int(row["Volume"])
            })
        return history
    except Exception as e:
        print(f"Error fetching {ticker} history: {e}")
        return []

def fetch_latest_price(ticker: str) -> Dict[str, Any]:
    """
    Fetches current market details from yfinance.
    Calculates 24h price change and percentage change.
    """
    try:
        stock = yf.Ticker(ticker)
        info = stock.fast_info
        
        price = info.get("last_price")
        volume = info.get("last_volume", 0)

        # Fallback if fast_info is sparse
        if price is None:
            df = stock.history(period="1d")
            if not df.empty:
                price = float(df["Close"].iloc[-1])
                volume = int(df["Volume"].iloc[-1])
            else:
                return {}

        # Calculate daily change and percentage
        prev_close = info.get("previous_close")
        if prev_close is None:
            df = stock.history(period="2d")
            if len(df) >= 2:
                prev_close = float(df["Close"].iloc[-2])
            else:
                prev_close = price

        change = price - prev_close
        pct_change = (change / prev_close) * 100 if prev_close else 0.0

        return {
            "ticker": ticker.upper(),
            "timestamp": datetime.now(timezone.utc),
            "price": price,
            "change": change,
            "pct_change": pct_change,
            "volume": int(volume) if volume else 0
        }
    except Exception as e:
        print(f"Error fetching latest price for {ticker}: {e}")
        return {}
