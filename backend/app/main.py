import logging
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from app.core.config import settings
from app.models.base import Base
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
        Base.metadata.create_all(bind=engine)
        logger.info("Database tables verified.")

        with SessionLocal() as session:
            seed_database(session)
        logger.info("Database bootstrap & seed sequence complete.")
    except Exception as e:
        logger.error(f"Error during database startup bootstrap: {e}")
    
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
def health_check():
    return {
        "status": "healthy",
        "service": settings.PROJECT_NAME,
        "database": "connected"
    }
