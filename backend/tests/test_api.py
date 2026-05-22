from unittest.mock import patch
from datetime import datetime, timezone

def test_list_stock_catalog(client):
    response = client.get("/api/stocks")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert any(s["ticker"] == "AAPL" for s in data)
    assert any(s["ticker"] == "BTC-USD" for s in data)

def test_watchlist_management_unauthorized(client):
    # Retrieve watchlist without auth
    response = client.get("/api/watchlist")
    assert response.status_code == 401

    # Add watchlist without auth
    response = client.post("/api/watchlist", json={"ticker": "AAPL"})
    assert response.status_code == 401

def test_watchlist_management_authorized(client):
    # Register and Login
    client.post(
        "/api/auth/register",
        json={"email": "watchlist@example.com", "password": "password123"}
    )
    login_resp = client.post(
        "/api/auth/login",
        data={"username": "watchlist@example.com", "password": "password123"}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch initial seeded watchlist (defaults should be present)
    response = client.get("/api/watchlist", headers=headers)
    assert response.status_code == 200
    initial_list = response.json()
    assert len(initial_list) > 0
    assert any(item["ticker"] == "AAPL" for item in initial_list)

    # Delete AAPL from watchlist
    del_resp = client.delete("/api/watchlist/AAPL", headers=headers)
    assert del_resp.status_code == 204

    # Confirm deletion
    response = client.get("/api/watchlist", headers=headers)
    assert not any(item["ticker"] == "AAPL" for item in response.json())

    # Add NVDA to watchlist
    add_resp = client.post("/api/watchlist", json={"ticker": "NVDA"}, headers=headers)
    assert add_resp.status_code == 201
    
    # Confirm addition
    response = client.get("/api/watchlist", headers=headers)
    assert any(item["ticker"] == "NVDA" for item in response.json())

    # Add invalid ticker
    add_invalid = client.post("/api/watchlist", json={"ticker": "INVALID"}, headers=headers)
    assert add_invalid.status_code == 400

@patch("app.services.fetch_stock_history")
def test_get_stock_prices(mock_fetch, client):
    # Mock return value for history
    mock_fetch.return_value = [
        {
            "ticker": "MSFT",
            "timestamp": datetime(2026, 5, 20, 12, 0, tzinfo=timezone.utc),
            "open": 420.0,
            "high": 425.0,
            "low": 418.0,
            "close": 422.0,
            "volume": 15000000
        }
    ]

    response = client.get("/api/prices/MSFT?period=1D")
    assert response.status_code == 200
    data = response.json()
    assert len(data) > 0
    assert data[0]["ticker"] == "MSFT"
    assert data[0]["close"] == 422.0
    mock_fetch.assert_called_once_with("MSFT", "1D")

@patch("app.services.fetch_latest_price")
def test_get_latest_price_fallback(mock_latest, client):
    # Mock real-time fetch fallback
    mock_latest.return_value = {
        "ticker": "TSLA",
        "timestamp": datetime.now(timezone.utc),
        "price": 175.5,
        "change": 2.5,
        "pct_change": 1.44,
        "volume": 80000000
    }

    response = client.get("/api/prices/TSLA/latest")
    assert response.status_code == 200
    data = response.json()
    assert data["ticker"] == "TSLA"
    assert data["price"] == 175.5
