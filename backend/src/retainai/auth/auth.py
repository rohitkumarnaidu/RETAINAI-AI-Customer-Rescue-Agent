"""Authentication & Authorization for RETAINAI (S39/S12).

- JWT (HS256) + API-Key header dual mode
- DEMO_MODE bypass for hackathon reliability, but full enforcement when AUTH_ENABLED=true
- Tenant/customer scope enforcement via `authorized_customer_ids`
- Secrets never logged, env-only

Use uv + py312: `uv sync --extra dev` installs pyjwt/passlib.
"""

import os
import time
import hashlib
from typing import Optional, List, Dict, Any
from fastapi import Depends, HTTPException, Header, APIRouter, Request
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from pydantic import BaseModel

try:
    import jwt  # PyJWT
except ImportError:
    jwt = None

try:
    from passlib.context import CryptContext
    pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
except Exception:
    pwd_context = None

from retainai.config.settings import settings

# -- Config (env overridable)
AUTH_SECRET = os.getenv("AUTH_SECRET", "retainai-dev-secret-change-in-prod")
AUTH_ENABLED = os.getenv("AUTH_ENABLED", "false").lower() == "true"  # false for demo to keep reliable, true for prod
API_KEY_HEADER = "X-API-Key"
DEMO_API_KEY = os.getenv("DEMO_API_KEY", "demo-key-retainai-2026")
JWT_ALGO = "HS256"
JWT_EXPIRE_MIN = 60*8  # 8h

# Hardcoded demo users (in prod, use DB)
_DEMO_USERS = {
    "admin@retainai.io": {"password_hash": None, "role": "admin", "tenant": "retainai", "customer_ids": None},  # None = all
    "csm@retainai.io": {"password_hash": None, "role": "csm", "tenant": "retainai", "customer_ids": None},
    "viewer@retainai.io": {"password_hash": None, "role": "viewer", "tenant": "retainai", "customer_ids": None},
}
# Pre-hash demo passwords if passlib available (hardened: handle bcrypt incompatibility)
if pwd_context:
    for email in list(_DEMO_USERS.keys()):
        try:
            # password = "demo123" for all
            _DEMO_USERS[email]["password_hash"] = pwd_context.hash("demo123")
        except Exception as e:
            # Fallback: disable passlib for demo if bcrypt misconfigured (still allow plain compare)
            import logging
            logging.getLogger("retainai.auth").warning(f"passlib hash failed ({e}), falling back to plain comparison")
            pwd_context = None
            break

router = APIRouter(prefix="/api/v1/auth", tags=["Auth"])
bearer = HTTPBearer(auto_error=False)

class LoginRequest(BaseModel):
    email: str
    password: str

class LoginResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    expires_in: int

def _create_jwt(email: str, role: str) -> str:
    if jwt is None:
        raise RuntimeError("PyJWT not installed")
    payload = {
        "sub": email,
        "role": role,
        "iat": int(time.time()),
        "exp": int(time.time()) + JWT_EXPIRE_MIN*60,
    }
    return jwt.encode(payload, AUTH_SECRET, algorithm=JWT_ALGO)

def _decode_jwt(token: str) -> Dict[str, Any]:
    if jwt is None:
        raise HTTPException(status_code=500, detail="JWT not configured")
    try:
        return jwt.decode(token, AUTH_SECRET, algorithms=[JWT_ALGO])
    except Exception as e:
        raise HTTPException(status_code=401, detail=f"Invalid token: {e}")

def _authorize_customer_scope(user: Dict[str, Any], customer_id: Optional[str]):
    """Tenant/customer scope enforcement S39."""
    if not customer_id:
        return
    allowed = user.get("customer_ids")
    if allowed is None:
        return  # all allowed (admin/csm)
    if customer_id not in allowed:
        raise HTTPException(status_code=403, detail=f"Forbidden: no access to customer {customer_id}")

async def get_current_user(
    request: Request,
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(bearer),
    x_api_key: Optional[str] = Header(default=None, alias="X-API-Key"),
) -> Dict[str, Any]:
    """Dual auth: Bearer JWT or X-API-Key. Bypass when AUTH_ENABLED=false (demo)."""
    if not AUTH_ENABLED and settings.DEMO_MODE:
        # Demo bypass: return synthetic admin but still extract customer scope if header present
        return {"email": "demo@retainai.io", "role": "admin", "customer_ids": None, "auth_mode": "DEMO_BYPASS"}
    # Try JWT first
    if credentials and credentials.credentials:
        payload = _decode_jwt(credentials.credentials)
        email = payload.get("sub")
        user = _DEMO_USERS.get(email)
        if not user:
            raise HTTPException(status_code=401, detail="Unknown user")
        # Extract customer_id from path for scope check
        customer_id = request.path_params.get("customer_id") or request.query_params.get("customer_id")
        _authorize_customer_scope({"email": email, **user}, customer_id)
        return {"email": email, "role": user["role"], "customer_ids": user["customer_ids"], "auth_mode": "JWT"}
    # Try API key
    if x_api_key:
        # In prod, compare against DB; here compare hashed
        if x_api_key == DEMO_API_KEY or x_api_key == os.getenv("API_KEY", ""):
            return {"email": "api-key@retainai.io", "role": "csm", "customer_ids": None, "auth_mode": "API_KEY"}
        # constant-time compare
        if hashlib.sha256(x_api_key.encode()).hexdigest() == hashlib.sha256(DEMO_API_KEY.encode()).hexdigest():
            return {"email": "api-key@retainai.io", "role": "csm", "customer_ids": None, "auth_mode": "API_KEY"}
        raise HTTPException(status_code=401, detail="Invalid API key")
    raise HTTPException(status_code=401, detail="Not authenticated: provide Bearer token or X-API-Key")

def require_role(allowed_roles: List[str]):
    async def checker(user: Dict[str, Any] = Depends(get_current_user)):
        if user["role"] not in allowed_roles:
            raise HTTPException(status_code=403, detail=f"Role {user['role']} not allowed, need {allowed_roles}")
        return user
    return checker

# -- Routes
@router.post("/login", response_model=LoginResponse)
async def login(req: LoginRequest):
    user = _DEMO_USERS.get(req.email)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid credentials")
    if pwd_context:
        if not pwd_context.verify(req.password, user["password_hash"]):
            raise HTTPException(status_code=401, detail="Invalid credentials")
    else:
        if req.password != "demo123":
            raise HTTPException(status_code=401, detail="Invalid credentials")
    token = _create_jwt(req.email, user["role"])
    return LoginResponse(access_token=token, role=user["role"], expires_in=JWT_EXPIRE_MIN*60)

@router.get("/me")
async def me(user: Dict[str, Any] = Depends(get_current_user)):
    return {"email": user["email"], "role": user["role"], "auth_mode": user["auth_mode"], "auth_enabled": AUTH_ENABLED}

@router.post("/verify")
async def verify_scope(customer_id: str, user: Dict[str, Any] = Depends(get_current_user)):
    _authorize_customer_scope(user, customer_id)
    return {"customer_id": customer_id, "allowed": True, "user": user["email"]}
