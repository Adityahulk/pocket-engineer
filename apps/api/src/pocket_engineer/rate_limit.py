from __future__ import annotations

import time

from fastapi import HTTPException


class RateLimiter:
    def __init__(self) -> None:
        self._hits: dict[str, list[float]] = {}

    def check(self, key: str, limit: int, window_seconds: float) -> None:
        now = time.monotonic()
        bucket = [stamp for stamp in self._hits.get(key, []) if now - stamp < window_seconds]
        if len(bucket) >= limit:
            raise HTTPException(429, "Too many requests. Wait a moment and try again.")
        bucket.append(now)
        self._hits[key] = bucket


limiter = RateLimiter()
