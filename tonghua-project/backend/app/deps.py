from typing import Optional

from fastapi import Depends, HTTPException, Header, Request
from jose import JWTError
from sqlalchemy.ext.asyncio import AsyncSession
import redis.asyncio as redis
import time

from app.database import get_db
from app.models.user import User
from app.security import decode_token
from app.config import settings

# Redis client for rate limiting
redis_client = None


async def get_redis_client():
    """Get or create Redis client for rate limiting."""
    global redis_client
    if redis_client is None:
        redis_client = redis.from_url(settings.REDIS_URL, decode_responses=True)
    return redis_client


async def get_current_user(
    request: Request,
    authorization: Optional[str] = Header(None),
    db: AsyncSession = Depends(get_db),
) -> dict:
    """Extract the current user from the JWT token in the Authorization header."""
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Missing or invalid Authorization header")

    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            raise HTTPException(status_code=401, detail="Invalid token type")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    # Try DB lookup; fallback to payload data
    try:
        from sqlalchemy import select

        stmt = select(User).where(User.id == int(payload["sub"]))
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        if user and user.status == "banned":
            raise HTTPException(status_code=403, detail="User is banned")
        if user:
            return {"id": user.id, "email": user.email, "role": user.role, "nickname": user.nickname}
    except HTTPException:
        raise
    except Exception:
        pass

    # Fallback from token payload
    return {"id": int(payload["sub"]), "role": payload.get("role", "user"), "email": "", "nickname": ""}


def require_role(*roles: str):
    """Dependency factory that enforces the current user has one of the specified roles."""

    async def _check(current_user: dict = Depends(get_current_user)) -> dict:
        if current_user.get("role") not in roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return current_user

    return _check


async def rate_limit_check(request: Request, current_user: Optional[dict] = None) -> bool:
    """Rate limiting using Redis sliding window algorithm.

    Limits:
    - Global: 1000 requests per second (burst allowed for slight accommodation)
    - User: 60 requests per minute (if user is authenticated)

    Returns True if the request is allowed, raises HTTPException 429 if rate limited.
    """
    try:
        redis_client = await get_redis_client()

        # Get client IP for global rate limiting
        x_forwarded_for = request.headers.get("X-Forwarded-For")
        if x_forwarded_for:
            client_ip = x_forwarded_for.split(",")[0].strip()
        else:
            client_ip = request.client.host or "unknown"

        current_time = time.time()

        # Global rate limit: 1000 requests per minute
        global_key = f"rate_limit:global:{int(current_time // 60)}"
        try:
            global_count = await redis_client.incr(global_key)
            if global_count == 1:
                await redis_client.expire(global_key, 60)  # 1 minute window
            if global_count > settings.GLOBAL_RATE_LIMIT:
                raise HTTPException(
                    status_code=429,
                    detail="Too many requests. Please slow down."
                )
        except redis.RedisError:
            # If Redis fails, allow the request but log the issue
            pass

        # User-specific rate limit: 60 requests per minute (if authenticated)
        if current_user and "id" in current_user:
            user_id = current_user["id"]
            user_key = f"rate_limit:user:{user_id}:{int(current_time // 60)}"
            try:
                user_count = await redis_client.incr(user_key)
                if user_count == 1:
                    await redis_client.expire(user_key, 60)  # 1 minute window
                if user_count > settings.USER_RATE_LIMIT:
                    raise HTTPException(
                        status_code=429,
                        detail="Too many requests. Please slow down."
                    )
            except redis.RedisError:
                # If Redis fails, allow the request but log the issue
                pass

        return True
    except HTTPException:
        raise
    except Exception:
        # If rate limiting fails for any reason, allow the request
        return True


async def get_current_user_from_request(request: Request, db: AsyncSession) -> Optional[dict]:
    """Try to extract current user from request without raising exceptions."""
    authorization = request.headers.get("Authorization")
    if not authorization or not authorization.startswith("Bearer "):
        return None

    token = authorization.split(" ", 1)[1]
    try:
        payload = decode_token(token)
        if payload.get("type") != "access":
            return None

        # Try DB lookup
        try:
            from sqlalchemy import select
            stmt = select(User).where(User.id == int(payload["sub"]))
            result = await db.execute(stmt)
            user = result.scalar_one_or_none()
            if user and user.status == "banned":
                return None
            if user:
                return {"id": user.id, "email": user.email, "role": user.role, "nickname": user.nickname}
        except Exception:
            pass

        # Fallback from token payload
        return {"id": int(payload["sub"]), "role": payload.get("role", "user"), "email": "", "nickname": ""}
    except Exception:
        return None
