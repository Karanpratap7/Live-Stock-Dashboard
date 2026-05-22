const API_BASE = '/api';

export async function register(email, password) {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Registration failed');
  }
  return res.json();
}

export async function login(email, password) {
  const formData = new URLSearchParams();
  formData.append('username', email);
  formData.append('password', password);

  const res = await fetch(`${API_BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Login failed');
  }
  return res.json();
}

export async function getMe(token) {
  const res = await fetch(`${API_BASE}/auth/me`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Unauthorized');
  return res.json();
}

export async function updatePreferences(token, theme, default_timeframe) {
  const res = await fetch(`${API_BASE}/auth/preferences`, {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ theme, default_timeframe }),
  });
  if (!res.ok) throw new Error('Failed to update preferences');
  return res.json();
}

export async function getStocks() {
  const res = await fetch(`${API_BASE}/stocks`);
  if (!res.ok) throw new Error('Failed to fetch stock catalog');
  return res.json();
}

export async function getWatchlist(token) {
  const res = await fetch(`${API_BASE}/watchlist`, {
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to fetch watchlist');
  return res.json();
}

export async function addToWatchlist(token, ticker) {
  const res = await fetch(`${API_BASE}/watchlist`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({ ticker }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.detail || 'Failed to add ticker');
  }
  return res.json();
}

export async function removeFromWatchlist(token, ticker) {
  const res = await fetch(`${API_BASE}/watchlist/${ticker}`, {
    method: 'DELETE',
    headers: { 'Authorization': `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Failed to remove ticker');
  return true;
}

export async function getPrices(ticker, period = '1M') {
  const res = await fetch(`${API_BASE}/prices/${ticker}?period=${period}`);
  if (!res.ok) throw new Error(`Failed to fetch history for ${ticker}`);
  return res.json();
}

export async function getLatestTrendingPrices() {
  const res = await fetch(`${API_BASE}/prices/trending/latest`);
  if (!res.ok) throw new Error('Failed to fetch trending prices');
  return res.json();
}
