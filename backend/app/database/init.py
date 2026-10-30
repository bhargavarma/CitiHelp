"""Safe, non-destructive database initialisation.

SQLite (local development and tests) keeps using ``Base.metadata.create_all``.
PostgreSQL (Supabase / Render) is initialised through Alembic so the schema is
versioned and future migrations can be applied without wiping data.
"""

import logging
from pathlib import Path
from typing import Optional

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from app.core.config import settings
from app.database.session import engine, get_database_url
from app.models.base import Base
import app.models  # noqa: F401  (registers every model on Base.metadata)

logger = logging.getLogger(__name__)

BACKEND_DIR = Path(__file__).resolve().parents[2]
ALEMBIC_INI = BACKEND_DIR / "alembic.ini"
ALEMBIC_DIR = BACKEND_DIR / "alembic"


def _alembic_config(database_url: str) -> Config:
    config = Config(str(ALEMBIC_INI))
    config.set_main_option("script_location", str(ALEMBIC_DIR))
    config.set_main_option("prepend_sys_path", str(BACKEND_DIR))
    # ConfigParser treats ``%`` as interpolation; escape it for URL passwords.
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    return config


def run_migrations(database_url: Optional[str] = None) -> None:
    """Apply every Alembic revision. Never drops or rewrites existing data."""
    url = database_url or get_database_url()
    config = _alembic_config(url)

    probe_engine = create_engine(url, pool_pre_ping=True)
    try:
        tables = set(inspect(probe_engine).get_table_names())
    finally:
        probe_engine.dispose()

    if "alembic_version" not in tables and "users" in tables:
        # A schema created before Alembic was wired into startup (for example
        # by an older ``create_all`` run) is assumed to match the current head.
        logger.warning(
            "Existing schema without alembic_version; stamping head before upgrade."
        )
        command.stamp(config, "head")

    command.upgrade(config, "head")


def initialize_database() -> None:
    """Create or upgrade the schema for the configured database."""
    if engine.dialect.name == "postgresql":
        logger.info("PostgreSQL detected; applying Alembic migrations.")
        run_migrations()
    else:
        logger.info("Non-PostgreSQL database detected; ensuring tables exist.")
        Base.metadata.create_all(bind=engine)
