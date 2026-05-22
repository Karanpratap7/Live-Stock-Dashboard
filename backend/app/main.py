import asyncio
import json
from contextlib import asynccontextmanager
from typing import List, Optional
from datetime import datetime, timezone

from fastapi import FastAPI, Depends, HTTPException, status, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert

from .config import settings
from .db import engine, get_db, Base
from . import models, schemas, security, services

# --- WebSocket connection manager ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: str):
        for connection in self.active_connections:
            try:
                await connection.send_text(message)
            except Exception:
                # Connection might be dead, clean up in connection disconnect
                pass

manager = ConnectionManager()

async def redis_pubsub_listener():
    """Background listener subscribing to Redis PubSub for broadcasting to WebSockets."""
    import redis.asyncio as aioredis
    while True:
        try:
            r = aioredis.from_url(settings.REDIS_URL)
            pubsub = r.pubsub()
            await pubsub.subscribe("ticker:updates")
            print("Successfully subscribed to Redis PubSub channel: ticker:updates")
            async for message in pubsub.listen():
                if message["type"] == "message":
                    data = message["data"].decode("utf-8")
                    await manager.broadcast(data)
        except asyncio.CancelledError:
            break
        except Exception as e:
            print(f"Redis PubSub listener encountered error: {e}. Retrying in 5 seconds...")
            await asyncio.sleep(5)

import os

# --- FastAPI Lifespan (Startup / Shutdown) ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Bypass DB tables and Redis network hooks during unit testing
    if os.getenv("TESTING") == "True":
        yield
        return

    # Ensure all tables are created automatically on startup
    Base.metadata.create_all(bind=engine)
    
    # Start Redis PubSub Listener task in the background
    pubsub_task = asyncio.create_task(redis_pubsub_listener())
    
    yield
    
    # Cancel background task on shutdown
    pubsub_task.cancel()
    try:
        await pubsub_task
    except asyncio.CancelledError:
        pass

app = FastAPI(
    title="LiveStockDashboard Backend",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json"
)

# Enable CORS for frontend flexibility
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Helper function to upsert prices into Postgres
def upsert_prices(db: Session, prices_list: List[dict]):
    if not prices_list:
        return
    if db.bind.dialect.name == "postgresql":
        for p in prices_list:
            stmt = pg_insert(models.Price).values(
                ticker=p["ticker"],
                timestamp=p["timestamp"],
                open=p["open"],
                high=p["high"],
                low=p["low"],
                close=p["close"],
                volume=p["volume"]
            )
            stmt = stmt.on_conflict_do_update(
                constraint="uniq_ticker_timestamp",
                set_={
                    "open": stmt.excluded.open,
                    "high": stmt.excluded.high,
                    "low": stmt.excluded.low,
                    "close": stmt.excluded.close,
                    "volume": stmt.excluded.volume
                }
            )
            db.execute(stmt)
    else:
        # Fallback database-agnostic upsert for SQLite testing
        for p in prices_list:
            existing = db.query(models.Price).filter(
                models.Price.ticker == p["ticker"],
                models.Price.timestamp == p["timestamp"]
            ).first()
            if existing:
                existing.open = p["open"]
                existing.high = p["high"]
                existing.low = p["low"]
                existing.close = p["close"]
                existing.volume = p["volume"]
            else:
                db_price = models.Price(
                    ticker=p["ticker"],
                    timestamp=p["timestamp"],
                    open=p["open"],
                    high=p["high"],
                    low=p["low"],
                    close=p["close"],
                    volume=p["volume"]
                )
                db.add(db_price)
    db.commit()


# ==========================================
# AUTHENTICATION ENDPOINTS
# ==========================================

@app.post("/api/auth/register", response_model=schemas.UserResponse, status_code=status.HTTP_201_CREATED)
def register(user_in: schemas.UserCreate, db: Session = Depends(get_db)):
    # Check if user already exists
    existing_user = db.query(models.User).filter(models.User.email == user_in.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="A user with this email is already registered."
        )
    
    # Hash password and create User
    hashed_pwd = security.get_password_hash(user_in.password)
    new_user = models.User(email=user_in.email, hashed_password=hashed_pwd)
    db.add(new_user)
    db.flush()  # Obtain user ID before commit

    # Create default preferences
    prefs = models.UserPreference(user_id=new_user.id)
    db.add(prefs)

    # Seed default trending watchlist tickers for onboarding
    for ticker in services.DEFAULT_TICKERS:
        watchlist_item = models.Watchlist(user_id=new_user.id, ticker=ticker)
        db.add(watchlist_item)

    db.commit()
    db.refresh(new_user)
    return new_user

@app.post("/api/auth/login", response_model=schemas.Token)
def login(form_data: OAuth2PasswordRequestForm = Depends(), db: Session = Depends(get_db)):
    user = db.query(models.User).filter(models.User.email == form_data.username).first()
    if not user or not security.verify_password(form_data.password, user.hashed_password):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Incorrect email or password."
        )
    
    # Generate JWT token
    access_token = security.create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}

@app.get("/api/auth/me", response_model=schemas.UserResponse)
def get_current_user_profile(current_user: models.User = Depends(security.get_current_user)):
    return current_user

@app.put("/api/auth/preferences", response_model=schemas.UserPreferenceResponse)
def update_preferences(
    pref_in: schemas.UserPreferenceUpdate,
    current_user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    prefs = db.query(models.UserPreference).filter(models.UserPreference.user_id == current_user.id).first()
    if not prefs:
        prefs = models.UserPreference(user_id=current_user.id)
        db.add(prefs)

    if pref_in.theme is not None:
        prefs.theme = pref_in.theme
    if pref_in.default_timeframe is not None:
        prefs.default_timeframe = pref_in.default_timeframe

    db.commit()
    db.refresh(prefs)
    return prefs


# ==========================================
# WATCHLIST & STOCK CATALOG ENDPOINTS
# ==========================================

@app.get("/api/stocks", response_model=List[schemas.StockMetadata])
def list_stock_catalog():
    """Returns the comprehensive trading catalog available in the app."""
    return services.STOCK_CATALOG

@app.get("/api/watchlist", response_model=List[schemas.WatchlistResponse])
def get_watchlist(
    current_user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    """Retrieves all tracked stocks in the user's custom watchlist."""
    return db.query(models.Watchlist).filter(models.Watchlist.user_id == current_user.id).all()

@app.post("/api/watchlist", response_model=schemas.WatchlistResponse, status_code=status.HTTP_201_CREATED)
def add_to_watchlist(
    watchlist_in: schemas.WatchlistCreate,
    current_user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    ticker = watchlist_in.ticker.upper()
    # Verify stock metadata exists in our comprehensive catalog
    metadata = services.get_stock_metadata(ticker)
    if not metadata:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Ticker '{ticker}' is not supported in the current catalog."
        )

    # Check for duplicates
    exists = db.query(models.Watchlist).filter(
        models.Watchlist.user_id == current_user.id,
        models.Watchlist.ticker == ticker
    ).first()
    if exists:
        return exists

    new_item = models.Watchlist(user_id=current_user.id, ticker=ticker)
    db.add(new_item)
    db.commit()
    db.refresh(new_item)
    return new_item

@app.delete("/api/watchlist/{ticker}", status_code=status.HTTP_204_NO_CONTENT)
def remove_from_watchlist(
    ticker: str,
    current_user: models.User = Depends(security.get_current_user),
    db: Session = Depends(get_db)
):
    item = db.query(models.Watchlist).filter(
        models.Watchlist.user_id == current_user.id,
        models.Watchlist.ticker == ticker.upper()
    ).first()
    
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticker '{ticker}' not found in your watchlist."
        )
    
    db.delete(item)
    db.commit()
    return


# ==========================================
# STOCK PRICES ENDPOINTS
# ==========================================

@app.get("/api/prices/{ticker}", response_model=List[schemas.PriceResponse])
def get_stock_prices(ticker: str, period: str = "1M", db: Session = Depends(get_db)):
    """
    Fetches historical OHLCV. 
    Checks/Syncs with yfinance and stores/upserts to PostgreSQL for high-speed persistence.
    """
    ticker_upper = ticker.upper()
    metadata = services.get_stock_metadata(ticker_upper)
    if not metadata:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Ticker '{ticker_upper}' is not in the supported catalog."
        )

    # Scrape fresh data from yfinance and upsert it into the DB
    history = services.fetch_stock_history(ticker_upper, period)
    if history:
        upsert_prices(db, history)

    # Query the DB to return the sorted values
    db_prices = db.query(models.Price).filter(
        models.Price.ticker == ticker_upper
    ).order_by(models.Price.timestamp.asc()).all()

    return db_prices

@app.get("/api/prices/{ticker}/latest")
def get_latest_price(ticker: str):
    """
    Retrieves the latest price. First checks Redis cache.
    Falls back to a real-time fetch if cache is empty.
    """
    import redis
    ticker_upper = ticker.upper()
    
    # Try reading from Redis cache first
    try:
        r = redis.Redis.from_url(settings.REDIS_URL)
        cached_data = r.get(f"price:latest:{ticker_upper}")
        if cached_data:
            return json.loads(cached_data.decode("utf-8"))
    except Exception as e:
        print(f"Redis cache connection failed: {e}")

    # Fallback to direct yfinance API
    price_info = services.fetch_latest_price(ticker_upper)
    if not price_info:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Could not retrieve real-time price for '{ticker_upper}'."
        )
    
    # Cache the result in Redis (expire in 60s)
    try:
        r.setex(
            f"price:latest:{ticker_upper}",
            60,
            json.dumps(price_info, default=str)
        )
    except Exception:
        pass

    return price_info

@app.get("/api/prices/trending/latest")
def get_trending_prices():
    """Returns real-time prices for the default trending catalog stocks (for onboarding/anonymous users)."""
    import redis
    results = {}
    r = None
    try:
        r = redis.Redis.from_url(settings.REDIS_URL)
    except Exception:
        pass

    for ticker in services.DEFAULT_TICKERS:
        cached = None
        if r:
            try:
                cached = r.get(f"price:latest:{ticker}")
            except Exception:
                pass
        
        if cached:
            results[ticker] = json.loads(cached.decode("utf-8"))
        else:
            p = services.fetch_latest_price(ticker)
            if p:
                results[ticker] = p
                if r:
                    try:
                        r.setex(f"price:latest:{ticker}", 60, json.dumps(p, default=str))
                    except Exception:
                        pass
    return results


# ==========================================
# WEBSOCKET REAL-TIME BROADCASTER
# ==========================================

@app.websocket("/api/ws")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Keep-alive loop
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)
    except Exception:
        manager.disconnect(websocket)
