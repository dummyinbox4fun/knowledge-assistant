from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from app.api.generation import router as generation_router
from app.api.embedding import router as embedding_router
from app.api.ingestion import router as ingestion_router
from app.config import settings, validate_required_settings
from app.api.retrieval import router as retrieval_router
from app.request_context import request_id_ctx_var, RequestIdLogFilter
from fastapi import Depends
from app.auth import require_auth
from slowapi import Limiter
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from slowapi.middleware import SlowAPIMiddleware
import logging
import time
import uuid

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s [%(request_id)s] %(message)s",
)
for _handler in logging.getLogger().handlers:
    _handler.addFilter(RequestIdLogFilter())
logger = logging.getLogger("app")

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Runs once at startup: fail fast and loudly if required settings are missing.
    validate_required_settings(settings)
    yield


app = FastAPI(title="Personal Knowledge Assistant", lifespan=lifespan)

limiter = Limiter(key_func=get_remote_address, default_limits=[settings.rate_limit])
app.state.limiter = limiter


# slowapi's default 429 body is {"error": ...}; every other error in this API
# uses {"detail": ...}, so the frontend can show them all the same way.
# This must stay a plain `def`: slowapi's middleware ignores `async def`
# handlers and silently falls back to its own default.
# (Rate-limit headers are not enabled on the Limiter, so none are added here.)
def rate_limit_exceeded_handler(request, exc: RateLimitExceeded):
    return JSONResponse(
        {"detail": f"Rate limit exceeded: {exc.detail}"}, status_code=429
    )


app.add_exception_handler(RateLimitExceeded, rate_limit_exceeded_handler)


# Registered first (innermost): SlowAPIMiddleware checks the rate limit and,
# if exceeded, returns its own 429 response directly rather than raising an
# exception that propagates further out. Registering it before log_requests
# means log_requests wraps it — so call_next() below gets that 429 response
# back like any other, and our request-ID/logging still applies to it.
app.add_middleware(SlowAPIMiddleware)


@app.middleware("http")
async def log_requests(request, call_next):
    incoming_request_id = request.headers.get("X-Request-ID")
    request_id = incoming_request_id or str(uuid.uuid4())
    token = request_id_ctx_var.set(request_id)

    start = time.time()
    response = await call_next(request)
    duration_ms = round((time.time() - start) * 1000, 1)

    logger.info(
        "%s %s -> %s (%sms)",
        request.method,
        request.url.path,
        response.status_code,
        duration_ms,
    )

    request_id_ctx_var.reset(token)
    response.headers["X-Request-ID"] = request_id
    return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        settings.frontend_url,
    ],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ingestion_router, dependencies=[Depends(require_auth)])
app.include_router(embedding_router, dependencies=[Depends(require_auth)])
app.include_router(retrieval_router, dependencies=[Depends(require_auth)])
app.include_router(generation_router, dependencies=[Depends(require_auth)])


@app.get("/health")
def health():
    return {"status": "ok", "environment": settings.environment}


@app.get("/")
def root():
    return {"message": "Personal Knowledge Assistant API — hello world"}