import logging
import time
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import settings
from app.database import engine, Base, AsyncSessionLocal
from app.deps import rate_limit_check, get_current_user_from_request

logger = logging.getLogger("tonghua")
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s - %(message)s",
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup: create tables if they don't exist
    try:
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
    except Exception:
        pass  # DB may not be available; mock data will be used
    yield
    # Shutdown
    await engine.dispose()


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="Tonghua Public Welfare x Sustainable Fashion — Backend API",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Rate Limiting middleware (applied before logging) ────────────
@app.middleware("http")
async def rate_limit_middleware(request: Request, call_next):
    # Apply rate limiting (skip for health check endpoint)
    if request.url.path != "/health":
        try:
            # Create DB session for user extraction
            async with AsyncSessionLocal() as db:
                current_user = await get_current_user_from_request(request, db)
                await rate_limit_check(request, current_user)
        except Exception:
            # If rate limiting fails, let the request continue (fails open)
            pass
    response = await call_next(request)
    return response


# ── Request logging middleware ───────────────────────────────────
@app.middleware("http")
async def request_logging_middleware(request: Request, call_next):
    start = time.time()
    response = await call_next(request)
    elapsed = time.time() - start
    logger.info(
        "%s %s %.3fs %d",
        request.method,
        request.url.path,
        elapsed,
        response.status_code,
    )
    response.headers["X-Process-Time"] = f"{elapsed:.3f}"
    return response


# ── Exception handlers ──────────────────────────────────────────
@app.exception_handler(422)
async def validation_exception_handler(request: Request, exc):
    return JSONResponse(
        status_code=422,
        content={
            "success": False,
            "data": None,
            "message": "Validation error",
            "errors": exc.errors() if hasattr(exc, "errors") else str(exc),
        },
    )


@app.exception_handler(500)
async def internal_server_error_handler(request: Request, exc):
    logger.error("Internal server error: %s %s", request.method, request.url.path, exc_info=True)
    return JSONResponse(
        status_code=500,
        content={
            "success": False,
            "data": None,
            "message": "Internal server error",
        },
    )


# Health check
@app.get("/health", tags=["Health"])
async def health():
    return {"status": "ok", "app": settings.APP_NAME, "version": settings.APP_VERSION}


# ── Register routers ─────────────────────────────────────────────
from app.routers.auth import router as auth_router
from app.routers.users import router as users_router
from app.routers.artworks import router as artworks_router
from app.routers.campaigns import router as campaigns_router
from app.routers.donations import router as donations_router
from app.routers.products import router as products_router
from app.routers.orders import router as orders_router
from app.routers.payments import router as payments_router
from app.routers.admin import router as admin_router
from app.routers.supply_chain import router as supply_chain_router

app.include_router(auth_router, prefix="/api/v1")
app.include_router(users_router, prefix="/api/v1")
app.include_router(artworks_router, prefix="/api/v1")
app.include_router(campaigns_router, prefix="/api/v1")
app.include_router(donations_router, prefix="/api/v1")
app.include_router(products_router, prefix="/api/v1")
app.include_router(orders_router, prefix="/api/v1")
app.include_router(payments_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(supply_chain_router, prefix="/api/v1")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
