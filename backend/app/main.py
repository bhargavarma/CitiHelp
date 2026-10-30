import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, Response, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from sqlalchemy import text
from app.core.config import settings
from app.database.init import initialize_database
from app.database.session import engine, SessionLocal
from app.database.seed import seed_database
from app.api import auth, services, grievances, chat, admin

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s"
)
logger = logging.getLogger("public_grievance_api")

@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("Initializing database schema and seed data...")
    try:
        initialize_database()
        logger.info("Database schema ready.")

        with SessionLocal() as session:
            seed_database(session)
        logger.info("Database bootstrap & seed sequence complete.")
    except Exception:
        # Fail fast instead of serving a broken deployment; Render surfaces the
        # traceback in the service logs and keeps the previous release active.
        logger.exception("Database startup bootstrap failed.")
        raise

    yield

    logger.info("Shutting down application...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="Centralized Public Grievance and Citizen Services Portal with AI-assisted guidance (HACK-P438).",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan
)

origins = list(set(settings.CORS_ORIGINS + [settings.FRONTEND_URL]))
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix=settings.API_V1_STR)
app.include_router(services.router, prefix=settings.API_V1_STR)
app.include_router(grievances.router, prefix=settings.API_V1_STR)
app.include_router(chat.router, prefix=settings.API_V1_STR)
app.include_router(admin.router, prefix=settings.API_V1_STR)

# Serve uploaded grievance attachments. Filenames are UUID-based and validated
# by the upload endpoint before they are written here.
upload_dir = Path(settings.UPLOAD_DIR)
upload_dir.mkdir(parents=True, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=str(upload_dir)), name="uploads")

@app.get("/", tags=["Root"])
def root():
    return {
        "project": settings.PROJECT_NAME,
        "problem_id": "HACK-P438",
        "category": "Government and Public Services",
        "status": "Operational",
        "api_documentation": "/docs"
    }

@app.get(f"{settings.API_V1_STR}/health", tags=["Health"])
def health_check(response: Response):
    """Readiness probe used by Render and uptime checks."""
    database_ok = True
    try:
        with engine.connect() as connection:
            connection.execute(text("SELECT 1"))
    except Exception:
        database_ok = False
        logger.exception("Health check database probe failed.")

    if not database_ok:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE

    return {
        "status": "healthy" if database_ok else "unhealthy",
        "service": settings.PROJECT_NAME,
        "environment": settings.ENVIRONMENT,
        "database": "connected" if database_ok else "unavailable",
    }
