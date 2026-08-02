from fastapi import FastAPI
from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from opentelemetry.sdk.resources import Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor

from .config import Settings


def configure_observability(app: FastAPI, settings: Settings) -> TracerProvider:
    provider = TracerProvider(
        resource=Resource.create(
            {
                "deployment.environment.name": settings.node_env,
                "service.name": "ai-service",
                "service.version": settings.service_version,
            }
        )
    )
    if settings.otel_exporter_otlp_endpoint is not None:
        endpoint = str(settings.otel_exporter_otlp_endpoint).rstrip("/")
        trace_endpoint = endpoint if endpoint.endswith("/v1/traces") else f"{endpoint}/v1/traces"
        exporter = OTLPSpanExporter(endpoint=trace_endpoint)
        provider.add_span_processor(BatchSpanProcessor(exporter))

    FastAPIInstrumentor.instrument_app(app, tracer_provider=provider)
    return provider
