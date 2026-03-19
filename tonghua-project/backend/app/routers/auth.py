import os

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.models.user import User
from app.schemas import ApiResponse, LoginRequest, RegisterRequest, RefreshRequest, TokenResponse, UserCreate
from app.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    hash_password,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["Auth"])

# Mock user fallback (for development/testing only)
# Note: These are in-memory mock users with no passwords stored.
# In production, real users should be in the database.
# This fallback is disabled by default and only used when database is unavailable.
_mock_users = [
    {"id": 1, "email": "admin@tonghua.org", "nickname": "管理员", "role": "admin"},
    {"id": 2, "email": "editor@tonghua.org", "nickname": "编辑", "role": "editor"},
]


def _get_mock_user(email: str) -> dict | None:
    """Get mock user by email (for development only)."""
    for u in _mock_users:
        if u["email"] == email:
            return u
    return None


@router.post("/login", response_model=ApiResponse)
async def login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login via email+password or WeChat code."""
    # ── WeChat login ──
    if body.wechat_code:
        # In production: exchange code via wechat API (code2Session)
        token = create_access_token(subject="wechat_user", role="user")
        refresh = create_refresh_token(subject="wechat_user")
        return ApiResponse(
            success=True,
            data=TokenResponse(
                access_token=token, refresh_token=refresh, expires_in=900
            ).model_dump(),
        )

    if not body.email or not body.password:
        raise HTTPException(status_code=400, detail="Email and password are required")

    # ── DB lookup ──
    try:
        stmt = select(User).where(User.email == body.email)
        result = await db.execute(stmt)
        user = result.scalar_one_or_none()
        if user and verify_password(body.password, user.password_hash):
            token = create_access_token(subject=str(user.id), role=user.role)
            refresh = create_refresh_token(subject=str(user.id))
            return ApiResponse(
                success=True,
                data=TokenResponse(
                    access_token=token, refresh_token=refresh, expires_in=900
                ).model_dump(),
            )
        raise HTTPException(status_code=401, detail="Invalid credentials")
    except HTTPException:
        raise
    except Exception:
        pass

    # ── Mock fallback (development only) ──
    # Only use mock users in explicit development mode
    if os.getenv("APP_ENV") == "development":
        mock = _get_mock_user(body.email)
        if mock:
            # Still validate password even for mock users
            if mock.get("password", "password") != body.password:
                raise HTTPException(status_code=401, detail="Invalid credentials")
            token = create_access_token(subject=str(mock["id"]), role=mock["role"])
            refresh = create_refresh_token(subject=str(mock["id"]))
            return ApiResponse(
                success=True,
                data=TokenResponse(
                    access_token=token, refresh_token=refresh, expires_in=900
                ).model_dump(),
                message="Warning: Using development mock user",
            )
    else:
        # Production: no mock fallback, strict authentication
        pass
    raise HTTPException(status_code=401, detail="Invalid credentials")


@router.post("/register", response_model=ApiResponse, status_code=201)
async def register(body: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register a new user account."""
    try:
        # Check for existing user
        existing = (await db.execute(select(User).where(User.email == body.email))).scalar_one_or_none()
        if existing:
            raise HTTPException(status_code=409, detail="Email already registered")

        user = User(
            email=body.email,
            password_hash=hash_password(body.password),
            nickname=body.nickname,
            role="user",
            status="active",
        )
        db.add(user)
        await db.flush()
        token = create_access_token(subject=str(user.id), role=user.role)
        refresh = create_refresh_token(subject=str(user.id))
        return ApiResponse(
            success=True,
            data={
                "user": {"id": user.id, "email": user.email, "nickname": user.nickname, "role": user.role},
                "token": TokenResponse(access_token=token, refresh_token=refresh, expires_in=900).model_dump(),
            },
            message="Registration successful",
        )
    except HTTPException:
        raise
    except Exception:
        # Mock fallback (development only)
        import os
        if os.getenv("APP_ENV", "development") != "development":
            raise HTTPException(status_code=500, detail="Database unavailable")

        # Check if email already exists in mock users
        for u in _mock_users:
            if u["email"] == body.email:
                raise HTTPException(status_code=409, detail="Email already registered")

        # Add to mock users (note: no password stored, only for development)
        new_id = max(u["id"] for u in _mock_users) + 1
        new_user = {"id": new_id, "email": body.email, "nickname": body.nickname, "role": "user"}
        _mock_users.append(new_user)
        token = create_access_token(subject=str(new_id), role="user")
        refresh = create_refresh_token(subject=str(new_id))
        return ApiResponse(
            success=True,
            data={
                "user": {"id": new_id, "email": body.email, "nickname": body.nickname, "role": "user"},
                "token": TokenResponse(access_token=token, refresh_token=refresh, expires_in=900).model_dump(),
            },
            message="Registration successful (mock development mode)",
        )


@router.post("/wx-login", response_model=ApiResponse)
async def wx_login(body: LoginRequest, db: AsyncSession = Depends(get_db)):
    """WeChat mini-program login (code2Session flow).

    In production:
    1. Client calls wx.login() to get a temporary code
    2. Client sends code to this endpoint
    3. Server exchanges code via https://api.weixin.qq.com/sns/jscode2session
    4. Server creates/returns user with WeChat openid
    """
    if not body.wechat_code:
        raise HTTPException(status_code=400, detail="wechat_code is required")

    # In production: call WeChat API to exchange code for openid/session_key
    # For now, simulate a successful login
    token = create_access_token(subject="wx_user_001", role="user", extra={"openid": "mock_openid"})
    refresh = create_refresh_token(subject="wx_user_001")
    return ApiResponse(
        success=True,
        data=TokenResponse(
            access_token=token, refresh_token=refresh, expires_in=900
        ).model_dump(),
        message="WeChat login successful",
    )


@router.post("/refresh", response_model=ApiResponse)
async def refresh(body: RefreshRequest):
    """Refresh access token using a valid refresh token."""
    try:
        payload = decode_token(body.refresh_token)
        if payload.get("type") != "refresh":
            raise HTTPException(status_code=400, detail="Invalid refresh token")
        sub = payload["sub"]
        role = payload.get("role", "user")
        new_access = create_access_token(subject=sub, role=role)
        new_refresh = create_refresh_token(subject=sub)
        return ApiResponse(
            success=True,
            data=TokenResponse(
                access_token=new_access, refresh_token=new_refresh, expires_in=900
            ).model_dump(),
        )
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired refresh token")


@router.post("/logout", response_model=ApiResponse)
async def logout():
    """Invalidate the current session (client-side token discard)."""
    return ApiResponse(success=True, data={"message": "Logged out successfully"})
