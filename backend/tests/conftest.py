import os
import sys
import shutil

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker, Session

backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

# Configure the test environment BEFORE importing the application so that
# Settings picks up the isolated database and explicit bootstrap credentials.
os.environ.setdefault("DATABASE_URL", "sqlite:///./test_suite.db")
os.environ.setdefault("JWT_SECRET_KEY", "test-only-secret-key-not-for-production-0123456789")
os.environ.setdefault("ADMIN_BOOTSTRAP_EMAIL", "admin@grievance.gov.in")
os.environ.setdefault("ADMIN_BOOTSTRAP_PASSWORD", "Admin@123456")
os.environ.setdefault("ADMIN_BOOTSTRAP_NAME", "Chief Grievance Officer")
os.environ.setdefault("UPLOAD_DIR", "test_uploads")
os.environ.setdefault("GEMINI_API_KEY", "")

# Remove artifacts from any previous test run before the app is imported.
TEST_UPLOAD_DIR = os.path.join(backend_dir, "test_uploads")
if os.path.isdir(TEST_UPLOAD_DIR):
    shutil.rmtree(TEST_UPLOAD_DIR, ignore_errors=True)

from app.models.base import Base  # noqa: E402
from app.database.session import get_db  # noqa: E402
from app.database.seed import seed_database  # noqa: E402
from app.main import app  # noqa: E402

# Isolated SQLite test database inside the backend directory.
TEST_DB_PATH = os.path.join(backend_dir, "test_suite.db")
if os.path.exists(TEST_DB_PATH):
    try:
        os.remove(TEST_DB_PATH)
    except Exception:
        pass

test_engine = create_engine(f"sqlite:///{TEST_DB_PATH}", connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(bind=test_engine, class_=Session, autocommit=False, autoflush=False)

# Create tables and seed initial data once for the test session.
Base.metadata.create_all(bind=test_engine)
with TestingSessionLocal() as session:
    seed_database(session)


@pytest.fixture(scope="function")
def db_session():
    with TestingSessionLocal() as session:
        yield session


@pytest.fixture(scope="function")
def client(db_session: Session):
    def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    # Plain TestClient without context manager avoids running the global lifespan.
    c = TestClient(app=app, base_url="http://testserver/api/v1")
    yield c
    app.dependency_overrides.clear()
