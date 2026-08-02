from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from time import monotonic
from typing import Annotated, Literal

from fastapi import FastAPI, Header, HTTPException
from pydantic import BaseModel

from .config import get_settings
from .logging import configure_logging
from .models import InsightRequest, InsightResponse
from .observability import configure_observability
from .provider import ProviderRouter

STARTED_AT = monotonic()
settings = get_settings()
configure_logging(settings.log_level.upper())


class HealthResponse(BaseModel):
    service: Literal["ai-service"]
    status: Literal["ok"]
    phase: Literal["8"]
    timestamp: datetime
    uptime_seconds: float
    version: str


@asynccontextmanager
async def lifespan(_: FastAPI) -> AsyncIterator[None]:
    yield
    tracer_provider.shutdown()


app = FastAPI(
    title="Rabbehni AI",
    description=(
        "Explainable, tenant-safe Rabbehni analytics intelligence "
        "with deterministic fallback."
    ),
    version=settings.service_version,
    lifespan=lifespan,
)
tracer_provider = configure_observability(app, settings)
provider = ProviderRouter(settings)


def technical_status() -> HealthResponse:
    return HealthResponse(
        service="ai-service",
        status="ok",
        phase="8",
        timestamp=datetime.now(UTC),
        uptime_seconds=monotonic() - STARTED_AT,
        version=settings.service_version,
    )


@app.get("/health/live", response_model=HealthResponse, tags=["health"])
async def liveness() -> HealthResponse:
    return technical_status()


@app.get("/health/ready", response_model=HealthResponse, tags=["health"])
async def readiness() -> HealthResponse:
    if not provider.ready():
        raise HTTPException(status_code=503, detail="AI provider circuit is open")
    return technical_status()


@app.post("/v1/insights", response_model=InsightResponse, tags=["intelligence"])
async def insights(
    request: InsightRequest,
    x_tenant_id: Annotated[str | None, Header()] = None,
    x_internal_service_token: Annotated[str | None, Header()] = None,
) -> InsightResponse:
    if x_internal_service_token != settings.internal_service_token:
        raise HTTPException(status_code=401, detail="Invalid internal service token")
    if x_tenant_id is None or x_tenant_id != request.tenant_id:
        raise HTTPException(status_code=403, detail="Cross-tenant AI request rejected")
    return await provider.analyze(request)
