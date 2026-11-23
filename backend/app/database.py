import sqlite3
import json
import uuid
import re
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
from app.config import settings

try:
    import psycopg2
    from psycopg2.extras import RealDictCursor
    PSYCOPG2_AVAILABLE = True
except ImportError:
    PSYCOPG2_AVAILABLE = False

def convert_placeholders(sql: str) -> str:
    """
    Safely converts SQLite '?' parameter markers to PostgreSQL '%s' markers
    without corrupting '?' characters inside quoted string literals.
    """
    result = []
    in_quote = False
    quote_char = None
    for char in sql:
        if char in ("'", '"'):
            if not in_quote:
                in_quote = True
                quote_char = char
            elif quote_char == char:
                in_quote = False
                quote_char = None
            result.append(char)
        elif char == '?' and not in_quote:
            result.append('%s')
        else:
            result.append(char)
    return "".join(result)

def adapt_sql_for_postgres(sql: str) -> str:
    """
    Adapts SQLite queries to PostgreSQL standard syntax:
    - Translates parameter markers from '?' to '%s'.
    - Translates 'INSERT OR IGNORE INTO' to 'INSERT INTO ... ON CONFLICT DO NOTHING'.
    - Adapts boolean comparisons (is_active = 1/0, must_change_password = 1/0) to TRUE/FALSE.
    - Defensively converts literal integer boolean values in VALUES clauses to PostgreSQL TRUE/FALSE.
    """
    cleaned = sql.strip()
    
    # Translate SQLite INSERT OR IGNORE into standard PostgreSQL ON CONFLICT DO NOTHING
    if cleaned.upper().startswith("INSERT OR IGNORE INTO"):
        rest = cleaned[len("INSERT OR IGNORE INTO"):].strip()
        cleaned = f"INSERT INTO {rest} ON CONFLICT DO NOTHING"

    # Adapt integer boolean comparisons to PostgreSQL native booleans (outside quotes)
    cleaned = re.sub(r'\bis_active\s*=\s*1\b', 'is_active = TRUE', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\bis_active\s*=\s*0\b', 'is_active = FALSE', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\bmust_change_password\s*=\s*1\b', 'must_change_password = TRUE', cleaned, flags=re.IGNORECASE)
    cleaned = re.sub(r'\bmust_change_password\s*=\s*0\b', 'must_change_password = FALSE', cleaned, flags=re.IGNORECASE)

    # Defensive conversion of integer booleans in VALUES lists for services, departments, and profiles
    cleaned = re.sub(
        r'(\bINTO\s+(?:services|departments)\b[^)]*\bis_active\b[^)]*\)\s*VALUES\s*\([^)]*?),\s*1\s*,',
        r'\1, TRUE,',
        cleaned,
        flags=re.IGNORECASE | re.DOTALL
    )
    cleaned = re.sub(
        r'(\bINTO\s+(?:services|departments)\b[^)]*\bis_active\b[^)]*\)\s*VALUES\s*\([^)]*?),\s*0\s*,',
        r'\1, FALSE,',
        cleaned,
        flags=re.IGNORECASE | re.DOTALL
    )
    cleaned = re.sub(
        r'(\bINTO\s+profiles\b[^)]*\bmust_change_password\b[^)]*\bis_active\b[^)]*\)\s*VALUES\s*\([^)]*?),\s*0\s*,\s*1\s*,',
        r'\1, FALSE, TRUE,',
        cleaned,
        flags=re.IGNORECASE | re.DOTALL
    )
    cleaned = re.sub(
        r'(\bINTO\s+profiles\b[^)]*\bmust_change_password\b[^)]*\bis_active\b[^)]*\)\s*VALUES\s*\([^)]*?),\s*1\s*,\s*1\s*,',
        r'\1, TRUE, TRUE,',
        cleaned,
        flags=re.IGNORECASE | re.DOTALL
    )

    return convert_placeholders(cleaned)

class PostgresCursorWrapper:
    """Cursor wrapper that translates placeholders and maintains dict-like row access."""
    def __init__(self, cursor):
        self._cursor = cursor

    def execute(self, sql: str, params=None):
        adapted = adapt_sql_for_postgres(sql)
        if params is not None:
            return self._cursor.execute(adapted, params)
        return self._cursor.execute(adapted)

    def fetchone(self):
        row = self._cursor.fetchone()
        return dict(row) if row is not None else None

    def fetchall(self):
        rows = self._cursor.fetchall()
        return [dict(r) for r in rows]

    def close(self):
        self._cursor.close()

    @property
    def rowcount(self):
        return self._cursor.rowcount

    def __iter__(self):
        for row in self._cursor:
            yield dict(row)

class PostgresConnectionWrapper:
    """Connection wrapper for PostgreSQL exposing the standard connection interface."""
    def __init__(self, conn):
        self._conn = conn

    def cursor(self):
        return PostgresCursorWrapper(self._conn.cursor(cursor_factory=RealDictCursor))

    def commit(self):
        self._conn.commit()

    def rollback(self):
        self._conn.rollback()

    def close(self):
        self._conn.close()

    def execute(self, sql: str, params=None):
        cur = self.cursor()
        return cur.execute(sql, params)

def get_db_connection():
    """
    Returns an active database connection.
    
    FAIL-CLOSED SAFETY RULES:
    1. In production (ENVIRONMENT=production):
       - SQLite is strictly forbidden.
       - A valid DATABASE_URL must be configured.
       - Any PostgreSQL connection failure MUST raise a fatal exception.
       - NEVER silently fall back to an ephemeral SQLite database.
    2. When DB_MODE in ('supabase', 'postgres'):
       - Explicit PostgreSQL mode must fail closed if connection fails.
    3. In development when DB_MODE=sqlite:
       - Connects to local SQLite store (seva_pass.db) with foreign keys enabled.
    """
    is_prod = settings.ENVIRONMENT.lower() == "production"
    is_pg_mode = settings.DB_MODE in ("supabase", "postgres")

    if is_prod:
        if settings.DB_MODE == "sqlite":
            raise RuntimeError(
                "[CRITICAL PRODUCTION MISCONFIGURATION] "
                "SQLite database is strictly forbidden in production mode. "
                "Set DB_MODE=supabase or DB_MODE=postgres and supply a valid DATABASE_URL in your environment."
            )
        if not settings.DATABASE_URL:
            raise RuntimeError(
                "[CRITICAL PRODUCTION MISCONFIGURATION] "
                "DATABASE_URL is not configured in production environment. "
                "Provide the PostgreSQL connection string in your Render deployment."
            )
        if not PSYCOPG2_AVAILABLE:
            raise RuntimeError(
                "[CRITICAL PRODUCTION MISCONFIGURATION] "
                "psycopg2 PostgreSQL driver is not installed in production environment."
            )
        try:
            conn = psycopg2.connect(settings.DATABASE_URL)
            return PostgresConnectionWrapper(conn)
        except Exception as e:
            raise RuntimeError(
                f"[FATAL PRODUCTION DATABASE FAILURE] "
                f"Failed to connect to production PostgreSQL database ({e}). "
                f"Fail-closed policy active: refusing fallback to ephemeral SQLite."
            )

    if is_pg_mode and not is_prod:
        if not settings.DATABASE_URL:
            raise RuntimeError(
                "[CRITICAL DATABASE CONFIGURATION] "
                "DB_MODE is configured for PostgreSQL/Supabase, but DATABASE_URL is not set. "
                "Provide DATABASE_URL or set DB_MODE=sqlite for local development."
            )
        if not PSYCOPG2_AVAILABLE:
            raise RuntimeError(
                "[CRITICAL DATABASE CONFIGURATION] "
                "psycopg2 is not installed. Install psycopg2-binary to connect to PostgreSQL."
            )
        try:
            conn = psycopg2.connect(settings.DATABASE_URL)
            return PostgresConnectionWrapper(conn)
        except Exception as e:
            raise RuntimeError(
                f"[FATAL DATABASE FAILURE] "
                f"Failed to connect to PostgreSQL database ({e}). "
                f"Fail-closed policy active: refusing silent fallback to SQLite."
            )

    # Local SQLite mode (permitted exclusively in non-production when DB_MODE=sqlite)
    conn = sqlite3.connect(settings.DATABASE_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()

    is_pg = not isinstance(conn, sqlite3.Connection)

    # Column type mappings between SQLite and PostgreSQL
    bool_type = "BOOLEAN DEFAULT TRUE" if is_pg else "INTEGER DEFAULT 1"
    timestamp_type = "TIMESTAMPTZ DEFAULT NOW()" if is_pg else "TEXT DEFAULT CURRENT_TIMESTAMP"
    json_type = "JSONB" if is_pg else "TEXT"

    # 1. Services / Branches (Army, Navy, Air Force, Coast Guard)
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS services (
        id VARCHAR(64) PRIMARY KEY,
        code VARCHAR(32) UNIQUE NOT NULL,
        name VARCHAR(128) NOT NULL,
        description TEXT,
        is_active {bool_type},
        created_at {timestamp_type},
        updated_at {timestamp_type}
    );
    """)

    # 2. Departments / Formations
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS departments (
        id VARCHAR(64) PRIMARY KEY,
        service_id VARCHAR(64) NOT NULL,
        parent_id VARCHAR(64),
        code VARCHAR(64) UNIQUE NOT NULL,
        name VARCHAR(255) NOT NULL,
        category VARCHAR(64) DEFAULT 'Command',
        location VARCHAR(255),
        description TEXT,
        head_personnel_id VARCHAR(64),
        head_account_id VARCHAR(64),
        status VARCHAR(32) DEFAULT 'active',
        is_active {bool_type},
        created_at {timestamp_type},
        updated_at {timestamp_type}
    );
    """)

    # 3. Profiles / User Accounts
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS profiles (
        id VARCHAR(64) PRIMARY KEY,
        username VARCHAR(64) UNIQUE NOT NULL,
        email VARCHAR(255) UNIQUE NOT NULL,
        password_hash VARCHAR(255) NOT NULL,
        full_name VARCHAR(255) NOT NULL,
        service_category VARCHAR(64) NOT NULL,
        service_number VARCHAR(64) NOT NULL,
        rank VARCHAR(64) DEFAULT 'Officer',
        phone VARCHAR(32),
        role VARCHAR(32) NOT NULL DEFAULT 'PERSONNEL',
        account_type VARCHAR(32) NOT NULL DEFAULT 'personnel',
        linked_personnel_id VARCHAR(64),
        assigned_department_id VARCHAR(64),
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        must_change_password {bool_type.replace('TRUE', 'FALSE').replace('1', '0')},
        failed_login_attempts INT DEFAULT 0,
        locked_until {timestamp_type},
        is_active {bool_type},
        created_at {timestamp_type},
        updated_at {timestamp_type}
    );
    """)

    # 4. Pass Applications
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS pass_applications (
        id VARCHAR(64) PRIMARY KEY,
        application_number VARCHAR(64) UNIQUE NOT NULL,
        applicant_id VARCHAR(64) NOT NULL,
        department_id VARCHAR(64) NOT NULL,
        vehicle_registration_number VARCHAR(64) NOT NULL,
        vehicle_type VARCHAR(64) NOT NULL,
        journey_origin VARCHAR(255) NOT NULL,
        journey_destination VARCHAR(255) NOT NULL,
        journey_purpose VARCHAR(255) NOT NULL,
        journey_date VARCHAR(32) NOT NULL,
        requested_start_time {timestamp_type},
        requested_end_time {timestamp_type},
        approved_start_time {timestamp_type},
        approved_end_time {timestamp_type},
        eligibility_basis TEXT NOT NULL,
        supporting_document_ref VARCHAR(255),
        status VARCHAR(32) NOT NULL DEFAULT 'submitted',
        rejection_reason TEXT,
        admin_notes TEXT,
        reviewed_by VARCHAR(64),
        reviewed_at {timestamp_type},
        created_at {timestamp_type},
        updated_at {timestamp_type}
    );
    """)

    # 5. Issued Passes
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS issued_passes (
        id VARCHAR(64) PRIMARY KEY,
        pass_code VARCHAR(64) UNIQUE NOT NULL,
        application_id VARCHAR(64) NOT NULL,
        applicant_id VARCHAR(64) NOT NULL,
        department_id VARCHAR(64) NOT NULL,
        vehicle_registration_number VARCHAR(64) NOT NULL,
        vehicle_type VARCHAR(64) NOT NULL,
        journey_origin VARCHAR(255) NOT NULL,
        journey_destination VARCHAR(255) NOT NULL,
        journey_purpose VARCHAR(255) NOT NULL,
        valid_from {timestamp_type},
        valid_until {timestamp_type},
        eligibility_basis TEXT NOT NULL,
        status VARCHAR(32) NOT NULL DEFAULT 'active',
        signature_algorithm VARCHAR(32) DEFAULT 'Ed25519',
        key_id VARCHAR(64) DEFAULT 'seva-ed25519-v1',
        signature_hex TEXT NOT NULL,
        canonical_payload_json TEXT NOT NULL,
        qr_payload_encoded TEXT NOT NULL,
        issued_by VARCHAR(64) NOT NULL,
        issued_at {timestamp_type},
        created_at {timestamp_type}
    );
    """)

    # 6. Pass Revocations
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS pass_revocations (
        id VARCHAR(64) PRIMARY KEY,
        pass_id VARCHAR(64) NOT NULL,
        revoked_by VARCHAR(64) NOT NULL,
        revocation_reason TEXT NOT NULL,
        revocation_category VARCHAR(64) DEFAULT 'Administrative Cancellation',
        revoked_at {timestamp_type}
    );
    """)

    # 7. Verification Logs
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS verification_logs (
        id VARCHAR(64) PRIMARY KEY,
        pass_id VARCHAR(64),
        pass_code VARCHAR(64),
        toll_plaza_name VARCHAR(255) NOT NULL,
        operator_id VARCHAR(64),
        source VARCHAR(32) DEFAULT 'public_web',
        scanned_vehicle_reg VARCHAR(64),
        authorised_vehicle_reg VARCHAR(64),
        verification_result VARCHAR(64) NOT NULL,
        reason_detail TEXT,
        signature_valid {bool_type.replace('TRUE', 'FALSE').replace('1', '0')},
        created_at {timestamp_type}
    );
    """)

    # 8. Append-Only Audit Logs
    cursor.execute(f"""
    CREATE TABLE IF NOT EXISTS audit_logs (
        id VARCHAR(64) PRIMARY KEY,
        event_type VARCHAR(64) NOT NULL,
        actor_id VARCHAR(64),
        actor_email VARCHAR(255),
        actor_role VARCHAR(32),
        department_id VARCHAR(64),
        entity_type VARCHAR(64) NOT NULL,
        entity_id VARCHAR(255),
        outcome VARCHAR(32) NOT NULL DEFAULT 'SUCCESS',
        details {json_type},
        ip_address VARCHAR(64),
        created_at {timestamp_type}
    );
    """)

    # Indexes
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_profiles_username ON profiles(username);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_profiles_email ON profiles(email);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_profiles_role ON profiles(role);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_profiles_dept ON profiles(assigned_department_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_dept_code ON departments(code);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_dept_head ON departments(head_personnel_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_issued_passes_code ON issued_passes(pass_code);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_pass_apps_applicant ON pass_applications(applicant_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_pass_apps_dept ON pass_applications(department_id);")
    cursor.execute("CREATE INDEX IF NOT EXISTS idx_audit_logs_event ON audit_logs(event_type);")

    conn.commit()
    conn.close()

def log_audit(
    event_type: str,
    actor_id: Optional[str],
    actor_email: Optional[str],
    actor_role: Optional[str],
    entity_type: str,
    entity_id: Optional[str],
    outcome: str = "SUCCESS",
    department_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
    ip_address: Optional[str] = "127.0.0.1"
):
    try:
        conn = get_db_connection()
        cursor = conn.cursor()
        audit_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()
        cursor.execute(
            """
            INSERT INTO audit_logs
            (id, event_type, actor_id, actor_email, actor_role, department_id, entity_type, entity_id, outcome, details, ip_address, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                audit_id,
                event_type,
                actor_id,
                actor_email,
                actor_role,
                department_id,
                entity_type,
                entity_id,
                outcome,
                json.dumps(details or {}, ensure_ascii=False),
                ip_address,
                now
            )
        )
        conn.commit()
        conn.close()
    except Exception as e:
        print(f"[Audit] Failed to record audit log: {e}")
