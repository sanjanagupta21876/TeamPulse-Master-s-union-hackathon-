import os
from contextlib import asynccontextmanager
from typing import List
from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.routes.repositories import router as repositories_router
from app.routes.diagnosis import router as diagnosis_router
from app.routes.fixes import router as fixes_router
from app.routes.verification import router as verification_router
from app.routes.publishing import router as publishing_router
from app.routes.monitoring import router as monitoring_router
from app.routes.team import router as team_router
from app.services.team import ensure_seeded

load_dotenv()


def get_allowed_origins() -> List[str]:
    """Retrieves allowed CORS origins from FRONTEND_ORIGINS environment variable."""
    raw_origins = os.getenv(
        "FRONTEND_ORIGINS",
        "http://localhost:5173,http://localhost:5174,http://localhost:5175,http://localhost:3000,http://127.0.0.1:5173,http://127.0.0.1:5174,http://127.0.0.1:5175",
    )
    return [origin.strip() for origin in raw_origins.split(",") if origin.strip()]


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup tasks
    ensure_seeded()
    yield
    # Shutdown tasks


app = FastAPI(
    title="TeamPulse API",
    description="Backend service for GitHub repository inspection, AST analysis, and AI debugging integration.",
    version="1.0.0",
    lifespan=lifespan,
)

# Configure CORS strictly to permitted origins
allowed_origins = get_allowed_origins()
app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization", "Accept", "X-Hub-Signature-256", "X-GitHub-Event", "X-GitHub-Delivery"],
)


@app.get(
    "/api/health",
    tags=["System"],
    summary="Health check endpoint",
    description="Returns backend running status and service identifier.",
)
async def health_check():
    return {
        "status": "ok",
        "service": "TeamPulse API",
    }


# Include Routers
app.include_router(repositories_router)
app.include_router(diagnosis_router)
app.include_router(fixes_router)
app.include_router(verification_router)
app.include_router(publishing_router)
app.include_router(monitoring_router)
app.include_router(team_router)


# Global Exception Handler for consistent error shape
@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    return JSONResponse(
        status_code=500,
        content={
            "error": {
                "code": "INTERNAL_SERVER_ERROR",
                "message": "An unhandled server exception occurred.",
            }
        },
    )
