"""Structured request-id logging middleware."""
import logging
import time
import uuid
from contextvars import ContextVar

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

request_id_ctx: ContextVar[str] = ContextVar("request_id", default="-")


class RequestIdFilter(logging.Filter):
    def filter(self, record: logging.LogRecord) -> bool:
        record.request_id = request_id_ctx.get()
        return True


class RequestIdMiddleware(BaseHTTPMiddleware):
    """Assigns a request id, logs each request with method/path/status/elapsed."""

    def __init__(self, app, logger: logging.Logger) -> None:
        super().__init__(app)
        self.logger = logger

    async def dispatch(self, request: Request, call_next) -> Response:
        rid = request.headers.get("X-Request-Id") or uuid.uuid4().hex[:12]
        token = request_id_ctx.set(rid)
        started = time.time()
        try:
            response = await call_next(request)
            elapsed_ms = int((time.time() - started) * 1000)
            response.headers["X-Request-Id"] = rid
            # Skip noisy paths
            if not request.url.path.startswith(("/api/health", "/static")):
                self.logger.info(
                    "%s %s -> %d in %dms",
                    request.method, request.url.path, response.status_code, elapsed_ms,
                )
            return response
        except Exception:
            self.logger.exception("%s %s -> 500 (unhandled)", request.method, request.url.path)
            raise
        finally:
            request_id_ctx.reset(token)


def configure_logging() -> logging.Logger:
    """Configure root logger with request-id field, returns the app logger."""
    fmt = "%(asctime)s [%(request_id)s] %(name)s %(levelname)s: %(message)s"
    handler = logging.StreamHandler()
    handler.setFormatter(logging.Formatter(fmt))
    handler.addFilter(RequestIdFilter())
    root = logging.getLogger()
    root.setLevel(logging.INFO)
    # Replace handlers so the request-id formatter applies everywhere
    root.handlers = [handler]
    return logging.getLogger("rightllm")
