from datetime import datetime
from enum import StrEnum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator


def to_camel(value: str) -> str:
    first, *remaining = value.split("_")
    return first + "".join(part.capitalize() for part in remaining)


class ContractModel(BaseModel):
    model_config = ConfigDict(
        extra="forbid",
        alias_generator=to_camel,
        populate_by_name=True,
    )


class Capability(StrEnum):
    SEGMENT_ASSISTANCE = "SEGMENT_ASSISTANCE"
    CAMPAIGN_AUDIENCE = "CAMPAIGN_AUDIENCE"
    REWARD_RECOMMENDATION = "REWARD_RECOMMENDATION"
    CHURN_RISK = "CHURN_RISK"
    ENGAGEMENT_RISK = "ENGAGEMENT_RISK"
    CAMPAIGN_TIMING = "CAMPAIGN_TIMING"
    ANOMALY_DETECTION = "ANOMALY_DETECTION"
    ANALYTICS_EXPLANATION = "ANALYTICS_EXPLANATION"
    OPERATIONAL_SUMMARY = "OPERATIONAL_SUMMARY"


class InsightRequest(ContractModel):

    tenant_id: str = Field(min_length=36, max_length=36)
    capability: Capability
    metrics: dict[str, float] = Field(min_length=1, max_length=100)
    context: dict[str, str | float | bool] = Field(default_factory=dict, max_length=30)
    requested_at: datetime

    @field_validator("metrics")
    @classmethod
    def validate_metrics(cls, metrics: dict[str, float]) -> dict[str, float]:
        forbidden = ("email", "phone", "name", "address", "secret", "token", "password")
        for key, value in metrics.items():
            normalized = key.lower()
            if any(part in normalized for part in forbidden):
                raise ValueError("Sensitive or identifying metric key rejected")
            if not (-1e15 < value < 1e15):
                raise ValueError("Metric value is outside the accepted range")
        return metrics

    @field_validator("context")
    @classmethod
    def resist_prompt_injection(
        cls, context: dict[str, str | float | bool]
    ) -> dict[str, str | float | bool]:
        blocked = ("ignore previous", "system prompt", "developer message", "<script", "jailbreak")
        for value in context.values():
            if isinstance(value, str) and any(term in value.lower() for term in blocked):
                raise ValueError("Unsafe natural-language instruction rejected")
        return context


class Factor(ContractModel):
    metric: str
    value: float
    impact: Literal["positive", "negative", "neutral"]


class InsightResponse(ContractModel):
    capability: Capability
    summary: str
    confidence: float = Field(ge=0, le=1)
    uncertainty: str
    contributing_factors: list[Factor]
    recommendations: list[str]
    model_version: str
    prompt_version: str
    provider: str
    fallback: bool
    human_review_required: Literal[True] = True
