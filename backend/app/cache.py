import json
import redis
from typing import Any, Optional
from .config import settings

class RedisCache:
    """Safely wraps Redis transactions with robust error handling for local resilience."""
    def __init__(self):
        self.url = settings.REDIS_URL
        self._client: Optional[redis.Redis] = None

    @property
    def client(self) -> Optional[redis.Redis]:
        if not self._client:
            try:
                self._client = redis.Redis.from_url(self.url, socket_connect_timeout=3)
            except Exception as e:
                print(f"Redis Cache connection failed: {e}")
                self._client = None
        return self._client

    def get(self, key: str) -> Optional[str]:
        cli = self.client
        if not cli:
            return None
        try:
            val = cli.get(key)
            return val.decode("utf-8") if val else None
        except Exception as e:
            print(f"Redis GET failed for key {key}: {e}")
            return None

    def set(self, key: str, value: str, expire: int = 60) -> bool:
        cli = self.client
        if not cli:
            return False
        try:
            return bool(cli.setex(key, expire, value))
        except Exception as e:
            print(f"Redis SET failed for key {key}: {e}")
            return False

    def publish(self, channel: str, message: str) -> int:
        cli = self.client
        if not cli:
            return 0
        try:
            return cli.publish(channel, message)
        except Exception as e:
            print(f"Redis PUBLISH failed on channel {channel}: {e}")
            return 0

cache_service = RedisCache()
