"""Copy CitiHelp data from a local SQLite database into PostgreSQL.

The copy is additive and idempotent:

* existing rows are never updated or deleted;
* primary keys, reference numbers and timestamps are preserved;
* users matched by email are reused and foreign keys are remapped;
* seeded services and knowledge documents are matched by name/title so a copy
  onto an already-seeded target does not duplicate them;
* ``--dry-run`` performs the copy inside a transaction and rolls it back.

Typical usage (from ``backend/``)::

    .\\.venv\\Scripts\\python.exe -m scripts.migrate_sqlite_to_postgres --dry-run
    .\\.venv\\Scripts\\python.exe -m scripts.migrate_sqlite_to_postgres

The target defaults to ``DATABASE_URL`` and must be PostgreSQL. Run
``alembic upgrade head`` first, or pass ``--init-schema`` to apply migrations
before copying.
"""

import argparse
import logging
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional, Type

from sqlalchemy import create_engine, select
from sqlalchemy.engine import Engine
from sqlalchemy.orm import Session, sessionmaker

BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

from app.core.config import settings  # noqa: E402
from app.database.init import run_migrations  # noqa: E402
from app.models.base import Base  # noqa: E402
from app.models.chat import ChatMessage, ChatSession  # noqa: E402
from app.models.grievance import Grievance, GrievanceHistory  # noqa: E402
from app.models.knowledge import KnowledgeDocument  # noqa: E402
from app.models.service import Service  # noqa: E402
from app.models.user import User  # noqa: E402

logger = logging.getLogger("migrate_sqlite_to_postgres")

# Parent tables must be copied before their children (foreign keys).
COPY_ORDER: List[Type] = [
    User,
    Service,
    KnowledgeDocument,
    Grievance,
    GrievanceHistory,
    ChatSession,
    ChatMessage,
]


def _normalize_value(value):
    """SQLite returns naive datetimes; store them as explicit UTC."""
    if isinstance(value, datetime) and value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _row_values(model: Type, row) -> Dict:
    return {
        column.name: _normalize_value(getattr(row, column.name))
        for column in model.__table__.columns
    }


def copy_database(
    source_engine: Engine,
    target_engine: Engine,
    *,
    dry_run: bool = False,
    include_chat: bool = True,
) -> Dict[str, Dict[str, int]]:
    """Copy every supported table and return per-table insert/skip counts."""
    if source_engine.url == target_engine.url:
        raise ValueError("Source and target database URLs must differ.")

    source_session = sessionmaker(bind=source_engine, autoflush=False)()
    target_session = sessionmaker(bind=target_engine, autoflush=False)()
    stats: Dict[str, Dict[str, int]] = {}
    user_id_map: Dict[str, str] = {}
    grievance_id_map: Dict[str, str] = {}

    models = list(COPY_ORDER)
    if not include_chat:
        models = [m for m in models if m not in (ChatSession, ChatMessage)]

    try:
        for model in models:
            table = model.__tablename__
            inserted = 0
            skipped = 0

            for row in source_session.scalars(select(model)).all():
                values = _row_values(model, row)

                if model is Grievance:
                    values["user_id"] = user_id_map.get(values["user_id"], values["user_id"])
                elif model is GrievanceHistory:
                    values["grievance_id"] = grievance_id_map.get(
                        values["grievance_id"], values["grievance_id"]
                    )
                    if values.get("changed_by"):
                        values["changed_by"] = user_id_map.get(
                            values["changed_by"], values["changed_by"]
                        )
                elif model is ChatSession:
                    values["user_id"] = user_id_map.get(values["user_id"], values["user_id"])

                existing = target_session.get(model, values["id"])

                if existing is None and model is User:
                    existing = target_session.scalar(
                        select(User).where(User.email == values["email"])
                    )
                    if existing is not None:
                        user_id_map[values["id"]] = existing.id
                        skipped += 1
                        logger.info(
                            "User %s already exists with a different id; remapping references.",
                            values["email"],
                        )
                        continue

                if existing is None and model is Grievance:
                    existing = target_session.scalar(
                        select(Grievance).where(
                            Grievance.reference_number == values["reference_number"]
                        )
                    )
                    if existing is not None:
                        grievance_id_map[values["id"]] = existing.id
                        skipped += 1
                        logger.info(
                            "Grievance %s already exists with a different id; remapping history.",
                            values["reference_number"],
                        )
                        continue

                if existing is None and model is Service:
                    # Seed data is inserted with fresh UUIDs on first boot, so
                    # match by name to avoid duplicating the service directory.
                    existing = target_session.scalar(
                        select(Service).where(Service.name == values["name"])
                    )
                    if existing is not None:
                        skipped += 1
                        logger.info(
                            "Service %s already exists with a different id; skipping.",
                            values["name"],
                        )
                        continue

                if existing is None and model is KnowledgeDocument:
                    # Same reasoning as services: titles are the natural key.
                    existing = target_session.scalar(
                        select(KnowledgeDocument).where(
                            KnowledgeDocument.title == values["title"]
                        )
                    )
                    if existing is not None:
                        skipped += 1
                        logger.info(
                            "Knowledge document %s already exists with a different id; skipping.",
                            values["title"],
                        )
                        continue

                if existing is not None:
                    skipped += 1
                    continue

                target_session.add(model(**values))
                inserted += 1

            target_session.flush()
            stats[table] = {"inserted": inserted, "skipped": skipped}
            logger.info(
                "%s: %s inserted, %s skipped (already present)",
                table,
                inserted,
                skipped,
            )

        if dry_run:
            target_session.rollback()
            logger.info("Dry run complete; target transaction rolled back.")
        else:
            target_session.commit()
            logger.info("Copy committed; no existing rows were modified or deleted.")
        return stats

    except Exception:
        target_session.rollback()
        raise
    finally:
        source_session.close()
        target_session.close()


def _build_engine(url: str) -> Engine:
    connect_args = {}
    options = {"pool_pre_ping": True}
    if url.startswith("sqlite"):
        connect_args["check_same_thread"] = False
    else:
        connect_args["prepare_threshold"] = None
    return create_engine(url, connect_args=connect_args, **options)


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--source",
        default="sqlite:///./grievance_dev.db",
        help="Source SQLite URL (default: sqlite:///./grievance_dev.db).",
    )
    parser.add_argument(
        "--target",
        default=None,
        help="Target PostgreSQL URL (default: DATABASE_URL).",
    )
    parser.add_argument("--dry-run", action="store_true", help="Roll back after copying.")
    parser.add_argument("--skip-chat", action="store_true", help="Do not copy chat history.")
    parser.add_argument(
        "--init-schema",
        action="store_true",
        help="Apply Alembic migrations to the target before copying.",
    )
    parser.add_argument(
        "--allow-sqlite-target",
        action="store_true",
        help="Allow a SQLite target (only useful for local verification).",
    )
    args = parser.parse_args(argv)

    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )

    source_url = args.source
    target_url = args.target or settings.DATABASE_URL

    if source_url == target_url:
        raise SystemExit("Source and target URLs are identical; refusing to copy.")
    if target_url.startswith("sqlite") and not args.allow_sqlite_target:
        raise SystemExit(
            "Refusing to copy into SQLite. Set DATABASE_URL to PostgreSQL or pass "
            "--allow-sqlite-target for local verification."
        )

    source_engine = _build_engine(source_url)
    target_engine = _build_engine(target_url)

    try:
        if args.init_schema:
            if target_engine.dialect.name == "postgresql":
                run_migrations(target_url)
            else:
                Base.metadata.create_all(bind=target_engine)

        stats = copy_database(
            source_engine,
            target_engine,
            dry_run=args.dry_run,
            include_chat=not args.skip_chat,
        )
    finally:
        source_engine.dispose()
        target_engine.dispose()

    total_inserted = sum(item["inserted"] for item in stats.values())
    total_skipped = sum(item["skipped"] for item in stats.values())
    print(
        f"{'DRY RUN' if args.dry_run else 'COPIED'}: "
        f"{total_inserted} rows inserted, {total_skipped} already present."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
