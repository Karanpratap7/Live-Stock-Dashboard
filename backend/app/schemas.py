from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import List, Optional

# --- Preference Schemas ---
class UserPreferenceBase(BaseModel):
    theme: str = Field(default="dark", max_length=10)
    default_timeframe: str = Field(default="1D", max_length=10)

class UserPreferenceResponse(UserPreferenceBase):
    id: int
    user_id: int

    class Config:
        from_attributes = True

class UserPreferenceUpdate(BaseModel):
    theme: Optional[str] = Field(None, max_length=10)
    default_timeframe: Optional[str] = Field(None, max_length=10)

# --- Watchlist Schemas ---
class WatchlistBase(BaseModel):
    ticker: str = Field(..., max_length=10)

class WatchlistCreate(WatchlistBase):
    pass

class WatchlistResponse(WatchlistBase):
    id: int
    created_at: datetime

    class Config:
        from_attributes = True

# --- User Schemas ---
class UserBase(BaseModel):
    email: EmailStr

class UserCreate(UserBase):
    password: str = Field(..., min_length=6)

class UserResponse(UserBase):
    id: int
    created_at: datetime
    preferences: Optional[UserPreferenceBase] = None
    watchlist: List[WatchlistResponse] = []

    class Config:
        from_attributes = True

# --- Auth Token Schemas ---
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    user_id: Optional[int] = None

# --- Price Data Schemas ---
class PriceResponse(BaseModel):
    ticker: str
    timestamp: datetime
    open: float
    high: float
    low: float
    close: float
    volume: int

    class Config:
        from_attributes = True

# --- Stock Catalog Metadata ---
class StockMetadata(BaseModel):
    ticker: str
    name: str
    sector: str
    category: str
    is_trending: bool = False
