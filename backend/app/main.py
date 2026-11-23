from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
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
# Allows configured CORS_ORIGINS as well as onrender.com companion web origins and local development hosts.
is_prod = settings.ENVIRONMENT.lower() == "production"
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_origin_regex=r"^https?://([a-zA-Z0-9_-]+\.)*onrender\.com(:[0-9]+)?$" if is_prod else r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
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
        "description": "Secure Electronic Verification and Authorisation for Military Toll Exemptions",
        "status": "operational",
        "version": settings.VERSION,
        "docs": "/docs",
        "health": "/api/health",
        "config_status": "/api/config/status"
    }

@app.get("/api/health")
def health_check():
    env_status = settings.get_environment_status()
    return {
        "status": "operational",
        "service": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "cryptography": "Ed25519 (RFC 8032)",
        "key_id": settings.KEY_ID,
        "database_engine": env_status["database_mode"],
        "supabase_configured": env_status["supabase"]["configured"]
    }

@app.get("/api/config/status")
def config_status():
    """Returns safe, audit-compliant environment configuration status without secret leakage."""
    return settings.get_environment_status()

@app.get("/api/supabase/status")
async def supabase_live_status():
    """Live connectivity check against configured Supabase project."""
    return await supabase_client.check_connection()
