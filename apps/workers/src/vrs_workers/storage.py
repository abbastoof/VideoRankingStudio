"""Thin wrapper around boto3 S3. Handles bucket routing + presigned URLs."""

from __future__ import annotations

import os
import tempfile
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator, Literal

import boto3
from botocore.client import Config

from .config import settings
from .logging import logger


_s3 = boto3.client(
    "s3",
    config=Config(signature_version="s3v4", s3={"addressing_style": "path" if settings.s3_force_path_style else "auto"}),
    **settings.s3_kwargs,
)


Bucket = Literal["uploads", "generated", "exports", "public"]
_BUCKETS: dict[str, str] = {
    "uploads": settings.s3_bucket_uploads,
    "generated": settings.s3_bucket_generated,
    "exports": settings.s3_bucket_exports,
    "public": settings.s3_bucket_public,
}


def bucket_name(bucket: Bucket) -> str:
    return _BUCKETS[bucket]


def download_to(bucket: Bucket, key: str, dest: Path) -> Path:
    logger.info("s3.download", bucket=bucket, key=key, dest=str(dest))
    dest.parent.mkdir(parents=True, exist_ok=True)
    _s3.download_file(bucket_name(bucket), key, str(dest))
    return dest


@contextmanager
def download_tempfile(bucket: Bucket, key: str, suffix: str = "") -> Iterator[Path]:
    fd, path = tempfile.mkstemp(suffix=suffix)
    os.close(fd)
    p = Path(path)
    try:
        download_to(bucket, key, p)
        yield p
    finally:
        p.unlink(missing_ok=True)


def upload_file(bucket: Bucket, key: str, src: Path, content_type: str | None = None) -> None:
    logger.info("s3.upload", bucket=bucket, key=key, src=str(src))
    extra = {"ContentType": content_type} if content_type else {}
    _s3.upload_file(str(src), bucket_name(bucket), key, ExtraArgs=extra)


def upload_bytes(bucket: Bucket, key: str, data: bytes, content_type: str | None = None) -> None:
    logger.info("s3.upload_bytes", bucket=bucket, key=key, size=len(data))
    extra = {"ContentType": content_type} if content_type else {}
    _s3.put_object(Bucket=bucket_name(bucket), Key=key, Body=data, **extra)


def presigned_get(bucket: Bucket, key: str, expires_in_seconds: int = 3600) -> str:
    return _s3.generate_presigned_url(
        "get_object",
        Params={"Bucket": bucket_name(bucket), "Key": key},
        ExpiresIn=expires_in_seconds,
    )


def presigned_put(bucket: Bucket, key: str, content_type: str, expires_in_seconds: int = 3600) -> str:
    return _s3.generate_presigned_url(
        "put_object",
        Params={"Bucket": bucket_name(bucket), "Key": key, "ContentType": content_type},
        ExpiresIn=expires_in_seconds,
    )
