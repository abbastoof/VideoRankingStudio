"""Test bootstrap. Injects minimum-viable env before any src module imports.

vrs_workers.config's Settings is required-field; importing anything downstream
(compose, logging, etc.) triggers instantiation, so pytest collection blows up
without these values. Keeping them here — instead of in each test file — means
pytest picks them up at collect time regardless of the entry point.
"""

from __future__ import annotations

import os

_DEFAULTS = {
    "NODE_ENV": "test",
    "LOG_LEVEL": "error",
    "API_URL": "http://localhost:4000",
    "WEB_URL": "http://localhost:3000",
    "DATABASE_URL": "postgresql://vrs:vrs@localhost/vrs_test",
    "REDIS_URL": "redis://localhost:6379/9",
    "BROKER_URL": "redis://localhost:6379/9",
    "S3_ENDPOINT": "http://localhost:9000",
    "S3_ACCESS_KEY_ID": "minioadmin",
    "S3_SECRET_ACCESS_KEY": "minioadmin",
    "S3_BUCKET_UPLOADS": "vrs-uploads",
    "S3_BUCKET_GENERATED": "vrs-generated",
    "S3_BUCKET_EXPORTS": "vrs-exports",
    "S3_BUCKET_PUBLIC": "vrs-public",
    "INTERNAL_SERVICE_TOKEN": "test-internal-token-16bytes",
}

for k, v in _DEFAULTS.items():
    os.environ.setdefault(k, v)
