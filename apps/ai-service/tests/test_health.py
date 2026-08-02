import asyncio

from rabbehni_ai.main import liveness


def test_liveness() -> None:
    response = asyncio.run(liveness())

    payload = response.model_dump()
    assert payload["service"] == "ai-service"
    assert payload["status"] == "ok"
    assert payload["phase"] == "8"
    assert payload["version"] == "0.0.0"
    assert payload["uptime_seconds"] >= 0
