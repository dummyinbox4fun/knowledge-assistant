from fastapi import FastAPI

from app.config import settings

app = FastAPI(title="Personal Knowledge Assistant")


@app.get("/health")
def health():
    return {"status": "ok", "environment": settings.environment}


@app.get("/")
def root():
    return {"message": "Personal Knowledge Assistant API — hello world"}
