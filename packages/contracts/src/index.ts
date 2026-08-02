export interface RequestContext {
  readonly correlationId: string;
  readonly requestId: string;
  readonly tenantId?: string;
  readonly actorId?: string;
}

export interface DomainEvent<TPayload = unknown> {
  readonly id: string;
  readonly type: string;
  readonly version: number;
  readonly occurredAt: string;
  readonly correlationId: string;
  readonly tenantId?: string;
  readonly payload: TPayload;
}

export interface TenantTechnicalEvent<TPayload = unknown> extends DomainEvent<TPayload> {
  readonly tenantId: string;
  readonly aggregateType: string;
  readonly aggregateId: string;
}

export interface ApiErrorBody {
  readonly code: string;
  readonly message: string;
  readonly correlationId: string;
  readonly details?: Readonly<Record<string, unknown>>;
}

export interface TechnicalStatus {
  readonly phase: "1";
  readonly service: string;
  readonly status: "ok";
  readonly timestamp: string;
  readonly uptimeSeconds: number;
  readonly version: string;
}

export interface CanonicalAnalyticsEvent {
  readonly eventId: string;
  readonly eventType: string;
  readonly eventVersion: number;
  readonly tenantId: string;
  readonly organizationId?: string;
  readonly franchiseId?: string;
  readonly merchantId?: string;
  readonly branchId?: string;
  readonly customerId?: string;
  readonly occurredAt: string;
  readonly processedAt: string;
  readonly source: string;
  readonly sourceRecordId: string;
  readonly correlationId: string;
  readonly idempotencyKey: string;
  readonly value: number;
  readonly metadata: Readonly<Record<string, string | number | boolean | null>>;
  readonly lineageDigest: string;
}

export interface AnalyticsMetricPoint {
  readonly metric: string;
  readonly value: number;
  readonly previousValue: number | null;
  readonly changeRate: number | null;
}

export interface ExplainableInsight {
  readonly capability: string;
  readonly summary: string;
  readonly confidence: number;
  readonly uncertainty: string;
  readonly contributingFactors: readonly {
    readonly metric: string;
    readonly value: number;
    readonly impact: "positive" | "negative" | "neutral";
  }[];
  readonly recommendations: readonly string[];
  readonly modelVersion: string;
  readonly promptVersion: string;
  readonly provider: string;
  readonly fallback: boolean;
  readonly humanReviewRequired: true;
}

const STARTED_AT = Date.now();

export function buildTechnicalStatus(service: string, version = "0.0.0"): TechnicalStatus {
  return {
    phase: "1",
    service,
    status: "ok",
    timestamp: new Date().toISOString(),
    uptimeSeconds: Math.round((Date.now() - STARTED_AT) / 1000),
    version,
  };
}
