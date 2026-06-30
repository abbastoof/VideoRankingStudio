# syntax=docker/dockerfile:1.7
# Production image for @vrs/workers. Includes ffmpeg + yt-dlp.

FROM python:3.11-slim-bookworm AS base
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1 PIP_NO_CACHE_DIR=1 PIP_DISABLE_PIP_VERSION_CHECK=1
RUN apt-get update && apt-get install -y --no-install-recommends \
      ffmpeg \
      tini \
      curl \
      ca-certificates \
      libgomp1 \
   && rm -rf /var/lib/apt/lists/*

FROM base AS build
WORKDIR /build
COPY apps/workers/pyproject.toml ./pyproject.toml
COPY apps/workers/src ./src
RUN pip install --upgrade pip wheel \
 && pip install .

FROM base AS runtime
WORKDIR /app
RUN useradd --create-home --shell /bin/bash vrs
COPY --from=build /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=build /usr/local/bin /usr/local/bin
COPY apps/workers/src /app/src

ENV PYTHONPATH=/app/src
USER vrs
EXPOSE 5000
HEALTHCHECK --interval=15s --timeout=4s --start-period=20s --retries=3 \
  CMD curl -fsS http://127.0.0.1:5000/health || exit 1

# Two entrypoints in one image: API (default) or Celery worker (override CMD).
ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["uvicorn", "vrs_workers.main:app", "--host", "0.0.0.0", "--port", "5000"]

# Run as a worker by overriding:
#   docker run vrs-workers:latest celery -A vrs_workers.celery_app:celery_app worker -Q transcription,tts -c 2
