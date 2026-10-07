"""Exponential backoff for Google API rate limits and transient 5xx errors."""

import random
import time
from functools import wraps

from googleapiclient.errors import HttpError

RETRYABLE_STATUS = {403, 429, 500, 502, 503}


def with_backoff(max_attempts: int = 5, base_delay: float = 0.5):
    def decorator(fn):
        @wraps(fn)
        def wrapper(*args, **kwargs):
            attempt = 0
            while True:
                try:
                    return fn(*args, **kwargs)
                except HttpError as exc:
                    status = exc.resp.status if exc.resp else None
                    attempt += 1
                    if status not in RETRYABLE_STATUS or attempt >= max_attempts:
                        raise
                    # Full jitter: spreads retries out so many tenants backing off
                    # at once don't all retry on the same tick.
                    delay = base_delay * (2 ** (attempt - 1))
                    time.sleep(random.uniform(0, delay))

        return wrapper

    return decorator
