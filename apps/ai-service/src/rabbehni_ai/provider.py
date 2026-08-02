from dataclasses import dataclass
from time import monotonic
from typing import Literal

from .config import Settings
from .models import Capability, Factor, InsightRequest, InsightResponse


@dataclass
class CircuitBreaker:
    failures: int = 0
    opened_at: float | None = None

    def available(self) -> bool:
        if self.opened_at is None:
            return True
        if monotonic() - self.opened_at >= 60:
            self.failures = 0
            self.opened_at = None
            return True
        return False

    def failed(self) -> None:
        self.failures += 1
        if self.failures >= 3:
            self.opened_at = monotonic()

    def succeeded(self) -> None:
        self.failures = 0
        self.opened_at = None


class DeterministicProvider:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def analyze(self, request: InsightRequest, *, fallback: bool = False) -> InsightResponse:
        ordered = sorted(request.metrics.items(), key=lambda item: (-abs(item[1]), item[0]))
        factors = [
            Factor(
                metric=metric,
                value=value,
                impact=self._impact(metric, value),
            )
            for metric, value in ordered[:5]
        ]
        confidence = min(0.9, 0.45 + 0.05 * min(len(request.metrics), 9))
        summary = self._summary(request.capability, factors)
        recommendations = self._recommendations(request.capability, factors)
        return InsightResponse(
            capability=request.capability,
            summary=summary,
            confidence=confidence,
            uncertainty=(
                "Confidence is limited to the supplied aggregate metrics; this is not a causal "
                "claim or an autonomous decision."
            ),
            contributing_factors=factors,
            recommendations=recommendations,
            model_version=self.settings.ai_model_version,
            prompt_version=self.settings.ai_prompt_version,
            provider="deterministic-fallback" if fallback else "deterministic-local",
            fallback=fallback,
            human_review_required=True,
        )

    def _impact(
        self, metric: str, value: float
    ) -> Literal["positive", "negative", "neutral"]:
        negative_terms = ("failed", "churn", "inactive", "rejected", "opt_out", "expired")
        if any(term in metric.lower() for term in negative_terms):
            return "negative" if value > 0 else "neutral"
        return "positive" if value > 0 else "neutral"

    def _summary(self, capability: Capability, factors: list[Factor]) -> str:
        if not factors:
            return f"No supported evidence is available for {capability.value.lower()}."
        evidence = ", ".join(f"{item.metric}={item.value:g}" for item in factors[:3])
        return f"{capability.value.replace('_', ' ').title()} is based on: {evidence}."

    def _recommendations(self, capability: Capability, factors: list[Factor]) -> list[str]:
        if capability in {Capability.CAMPAIGN_AUDIENCE, Capability.SEGMENT_ASSISTANCE}:
            return [
                "Review the proposed audience against consent and frequency-cap policies.",
                "Preview the segment and require human approval before activation.",
            ]
        if capability is Capability.REWARD_RECOMMENDATION:
            return [
                "Review reward eligibility and real stock before publishing.",
                "Validate the recommendation with a controlled human-reviewed cohort.",
            ]
        if capability in {Capability.CHURN_RISK, Capability.ENGAGEMENT_RISK}:
            return [
                "Review customers with sustained inactivity using consent-safe outreach.",
                "Treat the score as prioritization support, not a customer-level fact.",
            ]
        if capability is Capability.ANOMALY_DETECTION:
            return ["Verify source freshness and compare the same metric with the previous period."]
        if factors:
            return ["Review the leading contributing metrics before taking any business action."]
        return ["Collect more validated operational data before making a decision."]


class ProviderRouter:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings
        self.fallback = DeterministicProvider(settings)
        self.breaker = CircuitBreaker()

    async def analyze(self, request: InsightRequest) -> InsightResponse:
        if self.settings.ai_provider == "local":
            return self.fallback.analyze(request)
        if self.settings.ai_provider_url is None or not self.breaker.available():
            return self.fallback.analyze(request, fallback=True)
        # Remote providers are intentionally disabled until a validated provider adapter is
        # configured. Returning constrained deterministic output prevents fabricated results.
        self.breaker.failed()
        return self.fallback.analyze(request, fallback=True)

    def ready(self) -> bool:
        return self.settings.ai_provider == "local" or self.breaker.available()
