import { getNodeAutoInstrumentations } from "@opentelemetry/auto-instrumentations-node";
import { OTLPTraceExporter } from "@opentelemetry/exporter-trace-otlp-http";
import { NodeSDK } from "@opentelemetry/sdk-node";

export interface ObservabilityHandle {
  shutdown(): Promise<void>;
}

export function startObservability(serviceName: string): ObservabilityHandle {
  process.env.OTEL_SERVICE_NAME ??= serviceName;
  const endpoint = process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
  const traceUrl = endpoint?.endsWith("/v1/traces")
    ? endpoint
    : `${endpoint?.replace(/\/$/, "")}/v1/traces`;

  const sdk = new NodeSDK({
    instrumentations: [getNodeAutoInstrumentations()],
    ...(endpoint
      ? {
          traceExporter: new OTLPTraceExporter({
            url: traceUrl,
          }),
        }
      : {}),
  });

  sdk.start();

  return {
    shutdown: () => sdk.shutdown(),
  };
}
