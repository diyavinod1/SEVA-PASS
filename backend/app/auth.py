import time
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional
import bcrypt
import jwt
from fastapi import Depends, HTTPException, status, Header
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from app.config import settings
from app.database import get_db_connection

security = HTTPBearer(auto_error=False)

def hash_password(password: str) -> str:
    salt = bcrypt.gensalt(rounds=12)
    return bcrypt.hashpw(password.encode('utf-8'), salt).decode('utf-8')

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
    except Exception:
        return False

def create_access_token(data: Dict[str, Any], expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.now(timezone.utc) + expires_delta
    else:
        expire = datetime.now(timezone.utc) + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, settings.JWT_SECRET, algorithm=settings.JWT_ALGORITHM)
    return encoded_jwt

def decode_access_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except Exception:
        return None

def get_current_user_optional(
    auth: Optional[HTTPAuthorizationCredentials] = Depends(security)
) -> Optional[Dict[str, Any]]:
    if not auth:
        return None
    payload = decode_access_token(auth.credentials)
    if not payload:
        return None
    user_id = payload.get("sub")
    if not user_id:
        return None

    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT p.*, d.name as department_name, d.code as department_code
        FROM profiles p
        LEFT JOIN departments d ON p.assigned_department_id = d.id
        WHERE p.id = ? AND p.is_active = TRUE
    """, (user_id,))
    row = cursor.fetchone()
    conn.close()
    if not row:
        return None
    return dict(row)

def get_current_user(
    current_user: Optional[Dict[str, Any]] = Depends(get_current_user_optional)
) -> Dict[str, Any]:
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided or have expired.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return current_user

def require_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    role = current_user.get("role", "").upper()
    if role not in ("CENTRAL_ADMIN", "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Central Platform Administrators."
        )
    return current_user

def require_department_head(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    role = current_user.get("role", "").upper()
    if role not in ("DEPARTMENT_HEAD", "CENTRAL_ADMIN", "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Department Heads."
        )
    return current_user

def require_personnel(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    role = current_user.get("role", "").upper()
    if role not in ("PERSONNEL", "DEPARTMENT_HEAD", "CENTRAL_ADMIN", "ADMIN"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to verified Personnel."
        )
    return current_user

def verify_department_access(current_user: Dict[str, Any], department_id: str) -> bool:
    """
    Prevents cross-department IDOR:
    Central Admin can access all departments.
    Department Head can only access their assigned department.
    """
    role = current_user.get("role", "").upper()
    if role in ("CENTRAL_ADMIN", "ADMIN"):
        return True
    user_dept = current_user.get("assigned_department_id")
    return user_dept == department_id
