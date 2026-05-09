---
name: Alembic SQLAlchemy type patterns
description: Correct SQLAlchemy types to use in Alembic migrations for this project
type: feedback
---

Use `sa.DateTime(timezone=True)` for TIMESTAMPTZ columns in Alembic migrations — NOT `from sqlalchemy.dialects.postgresql import TIMESTAMPTZ` which doesn't exist in SQLAlchemy 2.x.

**Why:** Migration 001 failed at `alembic upgrade head` with `ImportError: cannot import name 'TIMESTAMPTZ'`. SQLAlchemy 2.x removed direct dialect-level type imports for common types.

**How to apply:** In any new Alembic migration that needs a timezone-aware timestamp column, write `sa.DateTime(timezone=True)`. Use `from sqlalchemy.dialects.postgresql import JSONB` only for JSONB (that one is fine).
