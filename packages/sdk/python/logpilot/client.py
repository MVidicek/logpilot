import atexit
import threading
import time
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

import requests


class LogPilot:
    """LogPilot Python SDK — ships logs to a LogPilot server.

    Usage:
        from logpilot import LogPilot

        logger = LogPilot(
            endpoint="http://localhost:3100",
            api_key="your-api-key",
            source="my-service",
        )

        logger.info("User logged in", user_id="123")
        logger.error("Payment failed", order_id="456")
    """

    def __init__(
        self,
        endpoint: str,
        api_key: str,
        source: str,
        batch_size: int = 10,
        flush_interval: float = 5.0,
        max_retries: int = 3,
        timeout: float = 10.0,
        flush_on_exit: bool = True,
    ):
        self._endpoint = endpoint.rstrip("/")
        self._api_key = api_key
        self._source = source
        self._batch_size = batch_size
        self._max_retries = max_retries
        self._timeout = timeout

        self._buffer: List[Dict[str, Any]] = []
        self._lock = threading.Lock()
        self._closed = False

        # Start background flush thread
        self._flush_event = threading.Event()
        self._flush_thread = threading.Thread(
            target=self._flush_loop,
            args=(flush_interval,),
            daemon=True,
        )
        self._flush_thread.start()

        # Register exit handler
        if flush_on_exit:
            atexit.register(self.shutdown)

    def debug(self, message: str, **metadata: str) -> None:
        """Log a debug-level message."""
        self._log("debug", message, metadata)

    def info(self, message: str, **metadata: str) -> None:
        """Log an info-level message."""
        self._log("info", message, metadata)

    def warn(self, message: str, **metadata: str) -> None:
        """Log a warn-level message."""
        self._log("warn", message, metadata)

    def error(self, message: str, **metadata: str) -> None:
        """Log an error-level message."""
        self._log("error", message, metadata)

    def fatal(self, message: str, **metadata: str) -> None:
        """Log a fatal-level message."""
        self._log("fatal", message, metadata)

    def _log(self, level: str, message: str, metadata: Dict[str, str]) -> None:
        if self._closed:
            return

        entry = {
            "level": level,
            "message": message,
            "source": self._source,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "metadata": {k: str(v) for k, v in metadata.items()},
        }

        with self._lock:
            self._buffer.append(entry)
            should_flush = len(self._buffer) >= self._batch_size

        if should_flush:
            self._flush_event.set()

    def _flush_loop(self, interval: float) -> None:
        while not self._closed:
            self._flush_event.wait(timeout=interval)
            self._flush_event.clear()
            self._flush()

    def _flush(self) -> None:
        with self._lock:
            if not self._buffer:
                return
            batch = self._buffer[: self._batch_size]
            self._buffer = self._buffer[self._batch_size :]

        try:
            self._send_with_retry(batch)
        except Exception as e:
            # Put failed entries back at the front
            with self._lock:
                self._buffer = batch + self._buffer
            # Log locally but don't crash
            import logging
            logging.getLogger("logpilot").error("Flush error: %s", e)

    def _send_with_retry(self, batch: List[Dict[str, Any]]) -> None:
        last_error: Optional[Exception] = None

        for attempt in range(self._max_retries):
            try:
                self._send(batch)
                return
            except Exception as e:
                last_error = e
                if attempt < self._max_retries - 1:
                    delay = 0.1 * (2**attempt)
                    time.sleep(delay)

        if last_error:
            raise last_error

    def _send(self, batch: List[Dict[str, Any]]) -> None:
        url = f"{self._endpoint}/api/v1/logs"
        headers = {
            "Content-Type": "application/json",
            "X-API-Key": self._api_key,
        }

        response = requests.post(
            url,
            json=batch,
            headers=headers,
            timeout=self._timeout,
        )

        if response.status_code >= 400:
            raise Exception(
                f"LogPilot API error: {response.status_code} {response.text}"
            )

    def flush(self) -> None:
        """Manually flush all buffered logs to the server."""
        while True:
            with self._lock:
                if not self._buffer:
                    break
            self._flush()

    def shutdown(self) -> None:
        """Flush remaining logs and stop the background thread."""
        self._closed = True
        self._flush_event.set()
        self._flush_thread.join(timeout=10)
        self.flush()

    def __enter__(self) -> "LogPilot":
        return self

    def __exit__(self, *_: Any) -> None:
        self.shutdown()
