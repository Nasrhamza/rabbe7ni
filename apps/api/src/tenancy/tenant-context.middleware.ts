import { BadRequestException, Inject, Injectable, type NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import { z } from "zod";

import { TenantContextStore } from "./tenant-context.store.js";

interface RequestLike {
  readonly headers: Readonly<Record<string, string | readonly string[] | undefined>>;
}

const uuidSchema = z.uuid();

function firstHeader(headers: RequestLike["headers"], name: string): string | undefined {
  const value = headers[name];
  return typeof value === "string" ? value : value?.[0];
}

function optionalUuid(value: string | undefined, headerName: string): string | undefined {
  if (!value) {
    return undefined;
  }
  const result = uuidSchema.safeParse(value);
  if (!result.success) {
    throw new BadRequestException(`${headerName} must be a UUID`);
  }
  return result.data;
}

@Injectable()
export class TenantContextMiddleware implements NestMiddleware {
  constructor(@Inject(TenantContextStore) private readonly context: TenantContextStore) {}

  use(request: RequestLike, _response: unknown, next: () => void): void {
    const requestId =
      optionalUuid(firstHeader(request.headers, "x-request-id"), "x-request-id") ?? randomUUID();
    const correlationId =
      optionalUuid(firstHeader(request.headers, "x-correlation-id"), "x-correlation-id") ??
      requestId;
    const requestedTenantId = optionalUuid(
      firstHeader(request.headers, "x-tenant-id"),
      "x-tenant-id",
    );

    this.context.run(
      {
        requestId,
        correlationId,
        ...(requestedTenantId ? { requestedTenantId } : {}),
      },
      next,
    );
  }
}
