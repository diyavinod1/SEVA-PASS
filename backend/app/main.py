from typing import Dict, Any
from contextlib import asynccontextmanager
from fastapi import FastAPI, Depends
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
from app.auth import require_admin
from app.seed import seed_database
from app.supabase_client import supabase_client
from app.routers import (
    auth_routes,
    departments_routes,
    passes_routes,
    verification_routes,
    stats_routes,
    audit_routes
)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Print clear, safe environment and Supabase configuration audit
    settings.print_startup_banner()
    print("[SEVA PASS] Initialising cryptographic authorities and command registries...")
    seed_database()
    print("[SEVA PASS] Core authorities established. Ready for incoming requests.")
    yield
    print("[SEVA PASS] System shutdown completed.")

app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description=settings.DESCRIPTION,
    lifespan=lifespan
)

# Cross-Origin Resource Sharing
# Production CORS is strictly locked down to explicit intended origins in settings.CORS_ORIGINS (no wildcard regex).
# Development permits localhost and 127.0.0.1 loopback origins.
is_prod = settings.ENVIRONMENT.lower() == "production"
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=None if is_prod else r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register API Routers
app.include_router(auth_routes.router)
app.include_router(departments_routes.router)
app.include_router(passes_routes.router)
app.include_router(verification_routes.router)
app.include_router(stats_routes.router)
app.include_router(audit_routes.router)

@app.get("/")
def root_endpoint():
    return {
        "service": "SEVA PASS Digital Service Gateway",
        "status": "operational"
    }

@app.get("/api/health")
def health_check():
    """Minimal, unauthenticated public health check for service monitoring."""
    return {
        "status": "operational",
        "service": settings.PROJECT_NAME
    }

@app.get("/api/config/status")
def config_status(current_user: Dict[str, Any] = Depends(require_admin)):
    """Returns safe environment configuration status. Restricted strictly to CENTRAL_ADMIN."""
    return settings.get_environment_status()

@app.get("/api/supabase/status")
async def supabase_live_status(current_user: Dict[str, Any] = Depends(require_admin)):
    """Live connectivity check against configured Supabase project. Restricted strictly to CENTRAL_ADMIN."""
    return await supabase_client.check_connection()
