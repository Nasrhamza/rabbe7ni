import { Body, Controller, Get, Inject, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequirePermissions } from "../common/security.js";
import { QrService } from "./qr.service.js";

@ApiTags("qr")
@Controller({ path: "qr", version: "1" })
export class QrController {
  constructor(@Inject(QrService) private readonly qr: QrService) {}
  @Post("tokens")
  issue(@Body() body: unknown) {
    return this.qr.issue(body as never);
  }
  @Post("scan")
  @RequirePermissions("qr.scan")
  scan(@Body() body: unknown) {
    return this.qr.scan(body as never);
  }
  @Get("transactions")
  @RequirePermissions("qr.read")
  list(@Query() query: unknown) {
    return this.qr.list(query as never);
  }
}
