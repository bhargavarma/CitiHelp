from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session
from app.core.config import settings


def get_database_url() -> str:
    url = settings.DATABASE_URL
    if "aiosqlite" in url:
        url = url.replace("sqlite+aiosqlite://", "sqlite://")
    if url.startswith("postgres://"):
        url = url.replace("postgres://", "postgresql+psycopg://", 1)
    elif url.startswith("postgresql://") and not url.startswith("postgresql+psycopg://"):
        url = url.replace("postgresql://", "postgresql+psycopg://", 1)
    return url


db_url = get_database_url()
is_sqlite = db_url.startswith("sqlite")

connect_args = {}
engine_options = {
    "echo": False,
    "pool_pre_ping": True,
}

if is_sqlite:
    connect_args["check_same_thread"] = False
else:
    # psycopg3 + Supabase's transaction pooler (PgBouncer) do not mix with
    # server-side prepared statements, so disable them for every PostgreSQL
    # connection. This also works with a direct Supabase connection.
    connect_args["prepare_threshold"] = None
    engine_options.update(
        {
            "pool_size": 5,
            "max_overflow": 10,
            "pool_recycle": 300,
            "pool_timeout": 30,
        }
    )

engine = create_engine(
    db_url,
    connect_args=connect_args,
    **engine_options,
)

SessionLocal = sessionmaker(
    bind=engine,
    class_=Session,
    autocommit=False,
    autoflush=False
)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
