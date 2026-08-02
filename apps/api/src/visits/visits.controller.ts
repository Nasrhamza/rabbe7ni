import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequirePermissions } from "../common/security.js";
import { VisitsService } from "./visits.service.js";

@ApiTags("visits")
@Controller({ path: "visits", version: "1" })
export class VisitsController {
  constructor(@Inject(VisitsService) private readonly visits: VisitsService) {}

  @Get()
  @RequirePermissions("customer.read")
  list(@Query() query: unknown) {
    return this.visits.list(query);
  }

  @Post()
  @RequirePermissions("qr.scan")
  createManual(@Body() body: unknown) {
    return this.visits.createManual(body);
  }

  @Post(":id/reverse")
  @RequirePermissions("qr.scan")
  reverse(@Param("id") id: string, @Body() body: unknown) {
    return this.visits.reverse(id, body);
  }
}
