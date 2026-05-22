# AURA // Live Real-Time Stock Terminal

AURA is a high-performance, dark-themed, glassmorphic real-time stock and cryptocurrency tracking dashboard. Built using a modern distributed microservices architecture, it coordinates React 18 + Vite, FastAPI, PostgreSQL, Redis, Celery, and Nginx.

---

## 🏗️ System Architecture

AURA coordinates multiple Docker services to provide a highly concurrent real-time data stream:

```
                  ┌──────────────────────────────────────────┐
                  │              User's Browser              │
                  └────────────────────┬─────────────────────┘
                                       │ HTTP / WebSockets
                                       ▼
                  ┌──────────────────────────────────────────┐
                  │           Nginx Reverse Proxy            │
                  │              (Port 80)                   │
                  └───────┬──────────────────────────┬───────┘
                          │ /                        │ /api & /api/ws
                          ▼                          ▼
┌────────────────────────────────────────┐ ┌────────────────────────────────────────┐
│             Frontend Container         │ │           Backend Container            │
│          (Vite React Dev Server)       │ │            (FastAPI Server)            │
└────────────────────────────────────────┘ └──────┬──────────────────────────┬──────┘
                                                  │                          │
                                                  ▼                          ▼
                                       ┌────────────────────┐     ┌────────────────────┐
                                       │    PostgreSQL DB   │     │    Redis Cache     │
                                       │   (Historical)     │     │     & PubSub       │
                                       └──────────▲─────────┘     └──────────▲─────────┘
                                                  │                          │
                                                  │  Ingest / Publish        │  Sub / Listen
                                                  └─────────┬────────────────┘
                                                            │
                                               ┌────────────┴───────────┐
                                               │   Celery Background    │
                                               │    Workers & Beat      │
                                               └────────────────────────┘
```

*   **Nginx reverse proxy** serves as the single ingress point, forwarding client browser traffic to the **Vite React dev server** (hot module replacement supported) and API/WebSocket routes to the **FastAPI app**.
*   **FastAPI** acts as the high-speed concurrent API service, validating JWT sessions, serving catalog items, and managing the central WebSocket client connections.
*   **Redis** functions both as a fast in-memory key-value cache (storing latest stock quotes to eliminate Yahoo Finance API rate limits) and a PubSub broker.
*   **Celery Beat** triggers asynchronous tasks every 30 seconds, spawning a **Celery Worker** to fetch yfinance quotes for active watchlist symbols, write the prices to **PostgreSQL**, and publish the updates to the Redis PubSub channel.
*   **FastAPI WebSocket Listener** intercepts these Redis PubSub events in a single, lightweight concurrent loop and broadcasts them to all connected user terminals.

---

## ✨ Features

*   **Translucent Dark Glassmorphic Design**: Curated panels matching HSL-tailored slate overlays, radial backdrop glow effects, and modern Outfit & Inter typography.
*   **Glow-Flash WebSocket Ticks**: Custom React handlers animate stock list rows when updates arrive (soft emerald glow for price increases, soft rose glow for decreases).
*   **Dynamic Trend Analytics**: Customized area line charts (Chart.js) that compute canvas color gradients matching the overall positive/negative performance of the selected timeframe.
*   **Zero-reload Live Graphs**: Real-time WebSocket ticks are dynamically appended to the active `1D` historical chart dataset on the fly.
*   **Secure Persistent Preferences**: Includes robust token authorization, password hashing, and customizable defaults (saved watchlist deck, custom themes, preferred timeframe).

---

## 📁 Repository Structure

```
LiveStockDashboard/
├── docker-compose.yml        # Multi-container service definitions
├── .env.example              # Core configuration parameters template
├── .gitignore                # Global workspace exclusions
│
├── frontend/                 # Vite React 18 Application
│   ├── src/
│   │   ├── components/       # AuthModal, StatCard, TickerGrid, StockChart, TickerSelector
│   │   ├── utils/            # api.js REST fetch calls
│   │   ├── App.jsx           # Main WebSocket and layout orchestrator
│   │   └── index.css         # Outfits typography and custom glass utilities
│   ├── Dockerfile
│   ├── tailwind.config.js    # Keyframe glows and styling configs
│   └── package.json
│
├── backend/                  # FastAPI Application, Tasks, and Database
│   ├── app/
│   │   ├── config.py         # Settings & environment parser
│   │   ├── db.py             # SQLAlchemy configuration engine
│   │   ├── models.py         # DB schemas (User, Watchlist, UserPreference, Price)
│   │   ├── security.py       # JWT creation and native bcrypt password tools
│   │   ├── services.py       # Stock catalog and yfinance scraper services
│   │   ├── tasks.py          # Celery ingest tasks
│   │   └── main.py           # REST entry points and WebSocket broadcaster
│   ├── tests/                # Automated pytest modules (test_auth.py, test_api.py)
│   ├── Dockerfile
│   └── requirements.txt
│
└── nginx/                    # Reverse Proxy Configuration
    ├── default.conf          # REST, WS, and Dev server routing rules
    └── Dockerfile
```

---

## ⚡ Quick Start

### 1. Prerequisites
Install [Docker Desktop](https://www.docker.com/products/docker-desktop/) on your machine.

### 2. Configure Environment Parameters
Clone this repository and copy the environment template:
```bash
cp .env.example .env
```
*(The default parameters inside the `.env` template are pre-configured to wire the database, Redis cache, Celery worker nodes, and security tokens automatically.)*

### 3. Launch Services
Start the entire stack using Docker Compose:
```bash
docker compose up --build
```
This builds your Node frontend, Python backend, and Nginx containers, pulls Postgres/Redis images, and runs everything in sync.

### 4. Port Gateways & Dashboards
*   🌐 **Interactive Dashboard / Terminal**: Access [http://localhost](http://localhost) (Port `80`).
*   🛠️ **Swagger FastAPI Endpoint Documentation**: Access [http://localhost/api/docs](http://localhost/api/docs).

---

## 📡 API Reference

### 🔐 Authentication (`/api/auth`)
*   `POST /api/auth/register` - Registers a new account, generates default preferences, and seeds standard trending watchlists.
*   `POST /api/auth/login` - Exchanges a username and password for a JWT token.
*   `GET /api/auth/me` - Resolves the current active user profile and preferred configurations.
*   `PUT /api/auth/preferences` - Updates persistent theme ("light" / "dark") and default chart timeframe.

### 📋 Watchlist Catalog (`/api/watchlist`)
*   `GET /api/watchlist` - Retrieves all tracked stock tickers for the authenticated session.
*   `POST /api/watchlist` - Adds a valid ticker symbol to the custom watchlist.
*   `DELETE /api/watchlist/{ticker}` - Removes a ticker from the tracked deck.

### 📊 Stock Prices (`/api/prices`)
*   `GET /api/prices/{ticker}?period={period}` - Returns historical data, automatically syncing fresh rows with yfinance. Supports periods: `1D`, `1W`, `1M`, `1Y`.
*   `GET /api/prices/{ticker}/latest` - Pulls the latest real-time stock price (checks Redis cache first, falls back to direct scraper).
*   `GET /api/prices/trending/latest` - Returns prices for default trending symbols (ideal for onboarding and guest states).

### ⚡ Live Stream Gateway
*   `WS /api/ws` - WebSocket route. Connect and receive real-time JSON price notifications:
    ```json
    {
      "ticker": "AAPL",
      "price": 178.43,
      "change": 1.22,
      "pct_change": 0.69,
      "timestamp": "2026-05-22T09:24:00Z",
      "volume": 52390100
    }
    ```

---

## 🧪 Local Testing & Verification

AURA includes a comprehensive test suite mapped to SQLite in-memory databases, letting you verify authentication flows, watchlists, and price retrieval modules offline:

### 1. Set Up Local Virtual Environment
```bash
python3 -m venv backend/.venv
source backend/.venv/bin/activate
pip install -r backend/requirements.txt
```

### 2. Execute Pytest Tests
Run the automated test runner inside your active virtual environment:
```bash
pytest backend
```

Output details:
```bash
backend/tests/test_api.py .....                                          [ 50%]
backend/tests/test_auth.py .....                                         [100%]
======================= 10 passed, 15 warnings in 2.33s ========================
```
