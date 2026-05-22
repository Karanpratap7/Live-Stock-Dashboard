def test_register_user(client):
    response = client.post(
        "/api/auth/register",
        json={"email": "test@example.com", "password": "password123"}
    )
    assert response.status_code == 201
    data = response.json()
    assert data["email"] == "test@example.com"
    assert "id" in data
    assert "preferences" in data

def test_register_duplicate_user(client):
    # Register first user
    client.post(
        "/api/auth/register",
        json={"email": "test@example.com", "password": "password123"}
    )
    # Register duplicate
    response = client.post(
        "/api/auth/register",
        json={"email": "test@example.com", "password": "differentpass"}
    )
    assert response.status_code == 400
    assert "already registered" in response.json()["detail"]

def test_login_user(client):
    # Register user
    client.post(
        "/api/auth/register",
        json={"email": "login@example.com", "password": "securepassword"}
    )

    # Login successfully
    response = client.post(
        "/api/auth/login",
        data={"username": "login@example.com", "password": "securepassword"}
    )
    assert response.status_code == 200
    data = response.json()
    assert "access_token" in data
    assert data["token_type"] == "bearer"

    # Login failed password
    response_fail = client.post(
        "/api/auth/login",
        data={"username": "login@example.com", "password": "wrongpassword"}
    )
    assert response_fail.status_code == 400
    assert "Incorrect email" in response_fail.json()["detail"]

def test_get_current_user_profile(client):
    # Register and Login
    client.post(
        "/api/auth/register",
        json={"email": "profile@example.com", "password": "password123"}
    )
    login_resp = client.post(
        "/api/auth/login",
        data={"username": "profile@example.com", "password": "password123"}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Fetch profile
    response = client.get("/api/auth/me", headers=headers)
    assert response.status_code == 200
    data = response.json()
    assert data["email"] == "profile@example.com"
    assert len(data["watchlist"]) > 0  # Preselected trending tickers present

def test_update_preferences(client):
    # Register and Login
    client.post(
        "/api/auth/register",
        json={"email": "pref@example.com", "password": "password123"}
    )
    login_resp = client.post(
        "/api/auth/login",
        data={"username": "pref@example.com", "password": "password123"}
    )
    token = login_resp.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Update preferences
    response = client.put(
        "/api/auth/preferences",
        json={"theme": "light", "default_timeframe": "1W"},
        headers=headers
    )
    assert response.status_code == 200
    data = response.json()
    assert data["theme"] == "light"
    assert data["default_timeframe"] == "1W"
