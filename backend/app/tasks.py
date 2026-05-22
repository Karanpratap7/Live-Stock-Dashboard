import os
import json
from datetime import datetime, timezone
# pyrefly: ignore [missing-import]
from celery import Celery
from sqlalchemy.orm import Session
from sqlalchemy.dialects.postgresql import insert as pg_insert

from .config import settings
from .db import SessionLocal, engine
from . import models, services, cache

# Initialize Celery Application
celery_app = Celery(
    "livestock_tasks",
    broker=settings.REDIS_URL,
    backend=settings.REDIS_URL
)

# Optional: configure timezone and task serializations
celery_app.conf.update(
    timezone="UTC",
    enable_utc=True,
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json"
)

# Helper to upsert a price row into the database
def db_upsert_price(db: Session, p: dict):
    if db.bind.dialect.name == "postgresql":
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
        # SQLite fallback for offline checks / tests
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

@celery_app.task
def fetch_prices_task():
    """
    Periodic task running every 30s.
    Queries all unique user watchlists + defaults, fetches latest from yfinance,
    caches to Redis, publishes to WebSockets PubSub channel, and logs in Postgres.
    """
    db: Session = SessionLocal()
    try:
        # 1. Fetch unique tickers in active use
        active_watchlists = db.query(models.Watchlist.ticker).distinct().all()
        active_tickers = [item[0].upper() for item in active_watchlists]
        
        # If no users have watchlisted anything yet, fallback to default trending tickers
        if not active_tickers:
            active_tickers = services.DEFAULT_TICKERS

        print(f"Celery task active. Fetching prices for {len(active_tickers)} tickers: {active_tickers}")

        # 2. Iterate and scrape each active ticker
        for ticker in active_tickers:
            price_info = services.fetch_latest_price(ticker)
            if not price_info:
                continue

            # Standardize timestamp string representation for JSON compatibility
            serializable_info = price_info.copy()
            serializable_info["timestamp"] = price_info["timestamp"].isoformat()

            # 3. Cache latest price in Redis (expire in 60s)
            cache.cache_service.set(
                f"price:latest:{ticker}",
                json.dumps(serializable_info),
                expire=60
            )

            # 4. Broadcast price update via Redis PubSub
            cache.cache_service.publish("ticker:updates", json.dumps(serializable_info))

            # 5. Persist price candle in PostgreSQL (round to nearest minute to avoid bloating database)
            rounded_timestamp = price_info["timestamp"].replace(second=0, microsecond=0)
            
            db_item = {
                "ticker": ticker,
                "timestamp": rounded_timestamp,
                "open": price_info["price"],
                "high": price_info["price"],
                "low": price_info["price"],
                "close": price_info["price"],
                "volume": price_info["volume"]
            }
            
            try:
                db_upsert_price(db, db_item)
            except Exception as e:
                print(f"Error committing database log for {ticker}: {e}")

    except Exception as e:
        print(f"Celery prices background fetcher error: {e}")
    finally:
        db.close()

# Configure Celery Beat scheduler
celery_app.conf.beat_schedule = {
    "fetch-active-prices-every-30-seconds": {
        "task": "app.tasks.fetch_prices_task",
        "schedule": 30.0,
    }
}
