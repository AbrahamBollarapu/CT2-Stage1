# _shared/fastapi_trace.py
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
import time, uuid

class TraceMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        traceparent = request.headers.get('traceparent') or f"00-{uuid.uuid4().hex}0000000000000000-01"
        corr = request.headers.get('x-correlation-id') or str(uuid.uuid4())
        start = time.time()
        response = await call_next(request)
        response.headers['traceparent'] = traceparent
        response.headers['x-correlation-id'] = corr
        dur = int((time.time() - start) * 1000)
        print(f"[trace={traceparent}] [corr={corr}] {request.method} {request.url.path} {response.status_code} {dur}ms")
        return response

def fwd_headers(request: Request) -> dict:
    """Return headers to forward to downstream internal services."""
    return {
        "traceparent": request.headers.get("traceparent"),
        "x-correlation-id": request.headers.get("x-correlation-id"),
    }
