import { BadGatewayException, Inject, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AnalyticsMetricPoint, ExplainableInsight } from "@rabbehni/contracts";

import type { AnalyticsRangeDto } from "./dto.js";

@Injectable()
export class AnalyticsGateway {
  constructor(@Inject(ConfigService) private readonly config: ConfigService) {}

  metrics(tenantId: string, range: AnalyticsRangeDto) {
    const query = new URLSearchParams({
      from: range.from.toISOString(),
      to: range.to.toISOString(),
      timezone: range.timezone,
    });
    for (const key of [
      "organizationId",
      "franchiseId",
      "merchantId",
      "branchId",
      "customerId",
    ] as const) {
      if (range[key]) query.set(key, range[key]);
    }
    return this.request<{
      items: readonly AnalyticsMetricPoint[];
      freshnessSeconds: number | null;
    }>(tenantId, `/v1/analytics/metrics?${query.toString()}`);
  }

  quality(tenantId: string) {
    return this.request<Record<string, string>>(tenantId, "/v1/analytics/quality");
  }

  backfill(tenantId: string, range: AnalyticsRangeDto) {
    return this.request<{ accepted: number; duplicates: number; replaySafe: true }>(
      tenantId,
      "/v1/analytics/pipeline/backfill",
      {
        method: "POST",
        body: JSON.stringify({
          ...range,
          from: range.from.toISOString(),
          to: range.to.toISOString(),
        }),
      },
      60_000,
    );
  }

  insight(
    tenantId: string,
    input: {
      capability: string;
      metrics: Readonly<Record<string, number>>;
      context: Readonly<Record<string, string | number | boolean>>;
    },
  ) {
    return this.aiRequest<ExplainableInsight>(tenantId, "/v1/insights", {
      method: "POST",
      body: JSON.stringify({
        tenant_id: tenantId,
        capability: input.capability,
        metrics: input.metrics,
        context: input.context,
        requested_at: new Date().toISOString(),
      }),
    });
  }

  private request<T>(
    tenantId: string,
    path: string,
    init: RequestInit = {},
    timeoutMs = 8_000,
  ): Promise<T> {
    return this.fetchJson<T>(
      `${this.config.getOrThrow<string>("ANALYTICS_SERVICE_URL")}${path}`,
      tenantId,
      init,
      timeoutMs,
    );
  }

  private aiRequest<T>(tenantId: string, path: string, init: RequestInit = {}): Promise<T> {
    return this.fetchJson<T>(
      `${this.config.getOrThrow<string>("AI_SERVICE_URL")}${path}`,
      tenantId,
      init,
    );
  }

  private async fetchJson<T>(
    url: string,
    tenantId: string,
    init: RequestInit,
    timeoutMs = 8_000,
  ): Promise<T> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          "content-type": "application/json",
          "x-tenant-id": tenantId,
          "x-internal-service-token": this.config.getOrThrow<string>("INTERNAL_SERVICE_TOKEN"),
          ...init.headers,
        },
      });
      if (!response.ok) throw new BadGatewayException(`Upstream returned HTTP ${response.status}`);
      return (await response.json()) as T;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException(
        error instanceof Error
          ? `Analytics upstream unavailable: ${error.message}`
          : "Analytics upstream unavailable",
      );
    } finally {
      clearTimeout(timeout);
    }
  }
}
