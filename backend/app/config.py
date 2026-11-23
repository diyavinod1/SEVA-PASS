import os
from pathlib import Path
from typing import List, Dict, Any, Optional
from dotenv import load_dotenv

# Base directory for the backend (e.g., .../backend)
BASE_DIR = Path(__file__).resolve().parent.parent

# Load environment variables: check backend/.env first, then root .env
env_file_loaded: Optional[Path] = None
if (BASE_DIR / ".env").is_file():
    load_dotenv(BASE_DIR / ".env")
    env_file_loaded = BASE_DIR / ".env"
elif (BASE_DIR.parent / ".env").is_file():
    load_dotenv(BASE_DIR.parent / ".env")
    env_file_loaded = BASE_DIR.parent / ".env"
else:
    load_dotenv()

def _mask_value(val: Optional[str], reveal_chars: int = 4) -> str:
    """Safely mask secrets so they can be audited without leaking the full token."""
    if not val or not val.strip():
        return "[NOT SET]"
    val = val.strip()
    if "your-" in val.lower() or "example" in val.lower() or "placeholder" in val.lower():
        return "[PLACEHOLDER - PENDING INPUT]"
    if len(val) <= reveal_chars * 2:
        return "[CONFIGURED: " + "*" * len(val) + "]"
    return f"[CONFIGURED: {val[:reveal_chars]}...{val[-reveal_chars:]}]"

def _mask_url(url: Optional[str]) -> str:
    """Safely mask URLs e.g. https://abc***.supabase.co"""
    if not url or not url.strip():
        return "[NOT SET]"
    url = url.strip()
    if "your-" in url.lower() or "placeholder" in url.lower():
        return "[PLACEHOLDER - PENDING INPUT]"
    try:
        from urllib.parse import urlparse
        parsed = urlparse(url)
        host = parsed.netloc
        if len(host) > 10:
            masked_host = host[:4] + "***" + host[-10:]
        else:
            masked_host = host
        return f"{parsed.scheme}://{masked_host}"
    except Exception:
        return "[CONFIGURED]"

class Settings:
    PROJECT_NAME: str = "SEVA PASS"
    VERSION: str = "2.0.0"
    DESCRIPTION: str = "Secure Electronic Verification and Authorisation for Military Toll Exemptions"
    
    BASE_DIR: Path = BASE_DIR
    ENV_FILE_PATH: Optional[Path] = env_file_loaded
    ENVIRONMENT: str = os.getenv("ENVIRONMENT", "development")
    
    # Network and Host
    PORT: int = int(os.getenv("PORT", "8000"))
    HOST: str = os.getenv("HOST", "127.0.0.1")
    
    # CORS Origins
    _raw_cors = os.getenv(
        "CORS_ORIGINS",
        "https://seva-pass-ui.onrender.com,http://localhost:5173,http://127.0.0.1:5173,http://localhost:3000,http://127.0.0.1:3000"
    )
    CORS_ORIGINS: List[str] = [origin.strip() for origin in _raw_cors.split(",") if origin.strip()]
    
    # Database Settings
    DB_MODE: str = os.getenv("DB_MODE", "sqlite").lower()
    SQLITE_DB_NAME: str = os.getenv("SQLITE_DB_NAME", "seva_pass.db")
    DATABASE_PATH: Path = BASE_DIR / SQLITE_DB_NAME
    DATABASE_URL: str = os.getenv("DATABASE_URL", "").strip()
    
    # Supabase Cloud Configuration
    SUPABASE_URL: str = os.getenv("SUPABASE_URL", "").strip()
    SUPABASE_ANON_KEY: str = os.getenv("SUPABASE_ANON_KEY", "").strip()
    # Supabase service role key (Secret, server-side only)
    SUPABASE_SERVICE_ROLE_KEY: str = os.getenv(
        "SUPABASE_SERVICE_ROLE_KEY",
        os.getenv("SUPABASE_SERVICE_KEY", "")
    ).strip()

    # JWT Authentication
    JWT_SECRET: str = os.getenv("JWT_SECRET", "seva-pass-production-auth-secret-key-ed25519-2026")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", str(60 * 24)))
    
    # Ed25519 Cryptographic Signing
    KEY_ID: str = os.getenv("KEY_ID", "seva-ed25519-v1")
    ED25519_PRIVATE_KEY_HEX: str = os.getenv("ED25519_PRIVATE_KEY_HEX", "").strip()
    ED25519_PRIVATE_KEY_PEM: str = os.getenv("ED25519_PRIVATE_KEY_PEM", "").strip()
    
    # Initial / Default System Admin Bootstrap
    DEFAULT_ADMIN_USERNAME: str = os.getenv("SEVA_ADMIN_USER", "admin")
    DEFAULT_ADMIN_PASSWORD: str = os.getenv("SEVA_ADMIN_PASS", "SevaAdm!n#2026$Drdo")
    DEFAULT_ADMIN_EMAIL: str = os.getenv("SEVA_ADMIN_EMAIL", "admin@sevapass.internal")

    # Demo accounts toggle (disabled by default in production)
    ENABLE_DEMO_ACCOUNTS: bool = os.getenv(
        "ENABLE_DEMO_ACCOUNTS",
        "false" if os.getenv("ENVIRONMENT") == "production" else "true"
    ).lower() in ("true", "1", "yes")

    def is_supabase_configured(self) -> bool:
        """Returns True if valid non-placeholder Supabase URL and service key are present."""
        url_valid = bool(self.SUPABASE_URL) and "your-" not in self.SUPABASE_URL.lower()
        key_valid = bool(self.SUPABASE_SERVICE_ROLE_KEY) and "your-" not in self.SUPABASE_SERVICE_ROLE_KEY.lower()
        return url_valid and key_valid

    def is_postgres(self) -> bool:
        """Returns True if operating against a direct PostgreSQL connection."""
        return bool(self.DATABASE_URL) and "your-" not in self.DATABASE_URL.lower()

    def get_environment_status(self) -> Dict[str, Any]:
        """Provides a safe dictionary auditing environment variable presence without leaking secrets."""
        is_supabase_ready = self.is_supabase_configured()
        missing_supabase_vars: List[str] = []
        
        if not self.SUPABASE_URL or "your-" in self.SUPABASE_URL.lower():
            missing_supabase_vars.append("SUPABASE_URL")
        if not self.SUPABASE_ANON_KEY or "your-" in self.SUPABASE_ANON_KEY.lower():
            missing_supabase_vars.append("SUPABASE_ANON_KEY")
        if not self.SUPABASE_SERVICE_ROLE_KEY or "your-" in self.SUPABASE_SERVICE_ROLE_KEY.lower():
            missing_supabase_vars.append("SUPABASE_SERVICE_ROLE_KEY")

        return {
            "status": "operational",
            "environment": self.ENVIRONMENT,
            "env_file_loaded": str(self.ENV_FILE_PATH) if self.ENV_FILE_PATH else "system_environment_only",
            "database_mode": "supabase" if (is_supabase_ready and self.DB_MODE == "supabase") else "sqlite",
            "sqlite_database_path": str(self.DATABASE_PATH),
            "supabase": {
                "configured": is_supabase_ready,
                "url": _mask_url(self.SUPABASE_URL),
                "anon_key_status": _mask_value(self.SUPABASE_ANON_KEY),
                "service_role_key_status": _mask_value(self.SUPABASE_SERVICE_ROLE_KEY),
                "database_url_configured": bool(self.DATABASE_URL) and "your-" not in self.DATABASE_URL.lower(),
                "missing_variables": missing_supabase_vars
            },
            "security": {
                "jwt_secret_configured": bool(self.JWT_SECRET),
                "ed25519_key_id": self.KEY_ID,
                "ed25519_custom_hex_provided": bool(self.ED25519_PRIVATE_KEY_HEX)
            }
        }

    def print_startup_banner(self):
        """Prints a professional, human-readable startup audit to the console."""
        status = self.get_environment_status()
        sup = status["supabase"]
        
        print("\n" + "=" * 76)
        print(f"  {self.PROJECT_NAME} v{self.VERSION} — SYSTEM STARTUP VALIDATION")
        print("=" * 76)
        print(f" [✓] Environment File:     {status['env_file_loaded']}")
        print(f" [✓] Cryptography Engine:  Ed25519 RFC 8032 (Key ID: {self.KEY_ID})")
        print(f" [✓] JWT Token Engine:     HS256 [INITIALISED]")
        print(f" [✓] Active DB Engine:     {status['database_mode'].upper()}")
        print("-" * 76)
        print("  SUPABASE CLOUD CONFIGURATION AUDIT:")
        print(f"  • SUPABASE_URL:              {sup['url']}")
        print(f"  • SUPABASE_ANON_KEY:         {sup['anon_key_status']}")
        print(f"  • SUPABASE_SERVICE_ROLE_KEY: {sup['service_role_key_status']}")
        print(f"  • DATABASE_URL (PostgreSQL): {sup['database_url_configured']}")

        if sup["configured"]:
            print("  ==> [STATUS: SUPABASE CONNECTED & CONFIGURED]")
        else:
            print("  ==> [STATUS: SUPABASE CREDENTIALS PENDING]")
            print("      Missing / Placeholder variables: " + (", ".join(sup["missing_variables"]) or "None"))
            print("      Active fallback: Running on local SQLite database (full functionality active).")
            print("      To link your cloud Supabase database, update backend/.env with your credentials.")
        print("=" * 76 + "\n")

settings = Settings()
