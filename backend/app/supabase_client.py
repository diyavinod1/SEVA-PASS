"""
SEVA PASS — Supabase Service Client Integration
Integrates backend operations with Supabase REST API (PostgREST) and PostgreSQL.
Safe fallback when operating in offline/SQLite development mode.
"""

from typing import Dict, Any, Optional, List
import httpx
from app.config import settings

class SupabaseServiceClient:
    def __init__(self):
        self.base_url = settings.SUPABASE_URL.rstrip("/") if settings.SUPABASE_URL else ""
        self.service_role_key = settings.SUPABASE_SERVICE_ROLE_KEY
        self.anon_key = settings.SUPABASE_ANON_KEY

    @property
    def is_configured(self) -> bool:
        return settings.is_supabase_configured()

    def _get_headers(self, use_service_role: bool = True) -> Dict[str, str]:
        key = self.service_role_key if use_service_role else self.anon_key
        return {
            "apikey": key,
            "Authorization": f"Bearer {key}",
            "Content-Type": "application/json",
            "Prefer": "return=representation"
        }

    async def check_connection(self) -> Dict[str, Any]:
        """Performs a non-blocking health check against the Supabase REST gateway."""
        if not self.is_configured:
            return {
                "connected": False,
                "configured": False,
                "error": "Supabase credentials are not configured in backend/.env"
            }
        
        url = f"{self.base_url}/rest/v1/"
        try:
            async with httpx.AsyncClient(timeout=4.0) as client:
                res = await client.get(url, headers=self._get_headers())
                if res.status_code in (200, 404):
                    return {
                        "connected": True,
                        "configured": True,
                        "status_code": res.status_code,
                        "project_url": self.base_url
                    }
                return {
                    "connected": False,
                    "configured": True,
                    "status_code": res.status_code,
                    "error": f"Supabase responded with HTTP {res.status_code}"
                }
        except httpx.RequestError as exc:
            return {
                "connected": False,
                "configured": True,
                "error": f"Failed to reach Supabase endpoint: {str(exc)}"
            }

    async def select(
        self,
        table_name: str,
        columns: str = "*",
        params: Optional[Dict[str, str]] = None
    ) -> List[Dict[str, Any]]:
        """Queries rows from a Supabase table."""
        if not self.is_configured:
            return []
        
        url = f"{self.base_url}/rest/v1/{table_name}"
        q_params = {"select": columns}
        if params:
            q_params.update(params)

        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.get(url, headers=self._get_headers(), params=q_params)
                if res.status_code == 200:
                    return res.json()
                return []
        except Exception as e:
            print(f"[SupabaseClient] Select from {table_name} error: {e}")
            return []

    async def insert(self, table_name: str, payload: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Inserts a row into a Supabase table."""
        if not self.is_configured:
            return None
            
        url = f"{self.base_url}/rest/v1/{table_name}"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.post(url, headers=self._get_headers(), json=payload)
                if res.status_code in (200, 201):
                    data = res.json()
                    return data[0] if isinstance(data, list) and data else data
                return None
        except Exception as e:
            print(f"[SupabaseClient] Insert into {table_name} error: {e}")
            return None

    async def update(
        self,
        table_name: str,
        filters: Dict[str, str],
        updates: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Updates matching rows in a Supabase table."""
        if not self.is_configured:
            return []
            
        url = f"{self.base_url}/rest/v1/{table_name}"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.patch(url, headers=self._get_headers(), params=filters, json=updates)
                if res.status_code == 200:
                    return res.json()
                return []
        except Exception as e:
            print(f"[SupabaseClient] Update {table_name} error: {e}")
            return []

    async def delete(self, table_name: str, filters: Dict[str, str]) -> bool:
        """Deletes matching rows in a Supabase table."""
        if not self.is_configured:
            return False
            
        url = f"{self.base_url}/rest/v1/{table_name}"
        try:
            async with httpx.AsyncClient(timeout=5.0) as client:
                res = await client.delete(url, headers=self._get_headers(), params=filters)
                return res.status_code in (200, 204)
        except Exception as e:
            print(f"[SupabaseClient] Delete from {table_name} error: {e}")
            return False

supabase_client = SupabaseServiceClient()
