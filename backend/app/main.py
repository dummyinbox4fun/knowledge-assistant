from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.generation import router as generation_router
from app.api.embedding import router as embedding_router
from app.api.ingestion import router as ingestion_router
from app.config import settings, validate_required_settings
from app.api.retrieval import router as retrieval_router
from fastapi import Depends
from app.auth import require_api_key
import logging
import time

logging.basicConfig(
    level=getattr(logging, settings.log_level.upper(), logging.INFO),
    format="%(asctime)s %(levelname)s %(name)s %(message)s",
)
logger = logging.getLogger("app")

app = FastAPI(title="Personal Knowledge Assistant")


@app.on_event("startup")
def _check_config_on_startup():
    validate_required_settings(settings)


@app.middleware("http")
async def log_requests(request, call_next):
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

app.include_router(ingestion_router, dependencies=[Depends(require_api_key)])
app.include_router(embedding_router, dependencies=[Depends(require_api_key)])
app.include_router(retrieval_router, dependencies=[Depends(require_api_key)])
app.include_router(generation_router, dependencies=[Depends(require_api_key)])


@app.get("/health")
def health():
    return {"status": "ok", "environment": settings.environment}


@app.get("/")
def root():
    return {"message": "Personal Knowledge Assistant API — hello world"}