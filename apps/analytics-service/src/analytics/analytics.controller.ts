import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Inject,
  Post,
  Query,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ApiTags } from "@nestjs/swagger";
import { timingSafeEqual } from "node:crypto";

import { AnalyticsRepository } from "./analytics.repository.js";
import { backfillSchema, canonicalEventSchema, rangeSchema } from "./analytics.schemas.js";
import { BackfillService } from "./backfill.service.js";

@ApiTags("analytics")
@Controller({ path: "analytics", version: "1" })
export class AnalyticsController {
  constructor(
    @Inject(ConfigService) private readonly config: ConfigService,
    @Inject(AnalyticsRepository) private readonly analytics: AnalyticsRepository,
    @Inject(BackfillService) private readonly backfill: BackfillService,
  ) {}

  @Post("events")
  async event(
    @Headers("x-internal-service-token") token: string | undefined,
    @Headers("x-tenant-id") tenantId: string | undefined,
    @Body() body: unknown,
  ) {
    this.authorize(token);
    const event = this.parse(canonicalEventSchema, body);
    if (!tenantId || tenantId !== event.tenantId) {
      throw new UnauthorizedException("Cross-tenant analytics event rejected");
    }
    return this.analytics.ingest(event);
  }

  @Post("pipeline/backfill")
  backfillEvents(
    @Headers("x-internal-service-token") token: string | undefined,
    @Headers("x-tenant-id") tenantId: string | undefined,
    @Body() body: unknown,
  ) {
    this.authorize(token);
    if (!tenantId) throw new UnauthorizedException("Tenant header required");
    return this.backfill.replay(tenantId, this.parse(backfillSchema, body));
  }

  @Post("pipeline/aggregate")
  async aggregate(
    @Headers("x-internal-service-token") token: string | undefined,
    @Headers("x-tenant-id") tenantId: string | undefined,
    @Body() body: unknown,
  ) {
    this.authorize(token);
    if (!tenantId) throw new UnauthorizedException("Tenant header required");
    const range = this.parse(rangeSchema, body);
    await this.analytics.aggregate(tenantId, range);
    return { aggregated: true };
  }

  @Get("metrics")
  metrics(
    @Headers("x-internal-service-token") token: string | undefined,
    @Headers("x-tenant-id") tenantId: string | undefined,
    @Query() query: unknown,
  ) {
    this.authorize(token);
    if (!tenantId) throw new UnauthorizedException("Tenant header required");
    return this.analytics.metrics(tenantId, this.parse(rangeSchema, query));
  }

  @Get("quality")
  quality(
    @Headers("x-internal-service-token") token: string | undefined,
    @Headers("x-tenant-id") tenantId: string | undefined,
  ) {
    this.authorize(token);
    if (!tenantId) throw new UnauthorizedException("Tenant header required");
    return this.analytics.quality(tenantId);
  }

  private authorize(candidate: string | undefined): void {
    const expected = this.config.getOrThrow<string>("INTERNAL_SERVICE_TOKEN");
    if (
      !candidate ||
      candidate.length !== expected.length ||
      !timingSafeEqual(Buffer.from(candidate), Buffer.from(expected))
    ) {
      throw new UnauthorizedException("Invalid internal service token");
    }
  }

  private parse<T>(
    schema: { safeParse(value: unknown): { success: boolean; data?: T; error?: unknown } },
    value: unknown,
  ): T {
    const result = schema.safeParse(value);
    if (!result.success) throw new BadRequestException(result.error);
    return result.data as T;
  }
}
