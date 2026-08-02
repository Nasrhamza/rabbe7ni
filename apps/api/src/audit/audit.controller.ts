import { Controller, Get, Inject, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequirePermissions } from "../common/security.js";
import { AuditService } from "./audit.service.js";

@ApiTags("audit")
@Controller({ path: "audit", version: "1" })
export class AuditController {
  constructor(@Inject(AuditService) private readonly audit: AuditService) {}

  @Get()
  @RequirePermissions("audit.read")
  list(@Query("limit") limit?: string) {
    const parsed = Number.parseInt(limit ?? "50", 10);
    return this.audit.listRecent(Number.isFinite(parsed) ? parsed : 50);
  }
}
