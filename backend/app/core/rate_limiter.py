import time
from typing import Dict, List
from fastapi import Request, HTTPException

class InMemoryRateLimiter:
    """
    In-memory rate limiter per client IP.
    Default: 5 requests per 60 seconds for public career apply endpoints.
    Extracts real IP considering Nginx reverse proxy headers (X-Forwarded-For).
    """
    def __init__(self, requests_limit: int = 5, window_seconds: int = 60):
        self.requests_limit = requests_limit
        self.window_seconds = window_seconds
        # ip -> list of timestamps
        self._history: Dict[str, List[float]] = {}

    def get_client_ip(self, request: Request) -> str:
        forwarded = request.headers.get("X-Forwarded-For")
        if forwarded:
            # Client IP is the first IP in the chain
            return forwarded.split(",")[0].strip()
        client = request.client
        return client.host if client else "127.0.0.1"

    def check_rate_limit(self, request: Request):
        ip = self.get_client_ip(request)
        now = time.time()
        timestamps = self._history.get(ip, [])

        # Filter out expired timestamps
        cutoff = now - self.window_seconds
        valid_timestamps = [t for t in timestamps if t > cutoff]

        if len(valid_timestamps) >= self.requests_limit:
            self._history[ip] = valid_timestamps
            retry_after = int(self.window_seconds - (now - valid_timestamps[0]))
            raise HTTPException(
                status_code=429,
                detail="RATE_LIMIT_EXCEEDED: Maximum 5 applications per minute. Please try again later.",
                headers={"Retry-After": str(max(1, retry_after))},
            )

        valid_timestamps.append(now)
        self._history[ip] = valid_timestamps

apply_rate_limiter = InMemoryRateLimiter(requests_limit=5, window_seconds=60)
