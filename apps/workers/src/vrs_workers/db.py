"""SQLAlchemy engine + session factory. Schema lives in Prisma; we just read/write
against the same tables. Models are intentionally minimal — only what tasks need."""

from __future__ import annotations

from contextlib import contextmanager
from typing import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from .config import settings

# psycopg3 driver via sqlalchemy 2.x URL prefix
_db_url = settings.database_url.replace("postgresql://", "postgresql+psycopg://", 1)

engine = create_engine(
    _db_url,
    pool_size=5,
    max_overflow=10,
    pool_pre_ping=True,
    pool_recycle=1800,
    future=True,
)

SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


@contextmanager
def session_scope() -> Iterator[Session]:
    db = SessionLocal()
    try:
        yield db
        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
