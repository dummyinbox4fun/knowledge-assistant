FROM python:3.12-slim

WORKDIR /app

# System deps needed by sentence-transformers/torch
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install CPU-only torch explicitly BEFORE requirements.txt. Without this,
# pip pulls the default GPU-capable torch build (800MB-2GB+), which is both
# unnecessary (no GPU on Render) and almost certainly what's been causing
# out-of-memory crashes on the free-tier 512MB instance. The CPU-only wheel
# is a fraction of the size. Once torch is satisfied here, installing
# sentence-transformers from requirements.txt won't pull in the GPU version.
RUN pip install --no-cache-dir torch==2.4.1 --extra-index-url https://download.pytorch.org/whl/cpu

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download embedding model at build time so it's cached in the image,
# not downloaded on first request (which caused crashes on free-tier hosts).
# Must match app/config.py's default — if you change one, change both.
ARG EMBEDDING_MODEL_NAME=sentence-transformers/all-MiniLM-L6-v2
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('${EMBEDDING_MODEL_NAME}')"

COPY . .

RUN useradd -m appuser && chown -R appuser /app
USER appuser

EXPOSE 8000
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
