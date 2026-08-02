import { Body, Controller, Get, Inject, Param, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequirePermissions } from "../common/security.js";
import { PointsService } from "./points.service.js";

@ApiTags("points")
@Controller({ path: "points", version: "1" })
export class PointsController {
  constructor(@Inject(PointsService) private readonly points: PointsService) {}
  @Get("balance")
  balance(@Query() query: unknown) {
    return this.points.balance(query as never);
  }
  @Get("transactions")
  @RequirePermissions("points.read")
  list(@Query() query: unknown) {
    return this.points.list(query as never);
  }
  @Post("earn")
  @RequirePermissions("points.adjust")
  earn(@Body() body: unknown) {
    return this.points.earn(body as never);
  }
  @Post("expire")
  @RequirePermissions("points.adjust")
  expire(@Body() body: unknown) {
    return this.points.expire(body as never);
  }
  @Post("adjust")
  @RequirePermissions("points.adjust")
  adjust(@Body() body: unknown) {
    return this.points.adjust(body as never);
  }
  @Post("transactions/:id/reverse")
  @RequirePermissions("points.adjust")
  reverse(@Param("id") id: string, @Body() body: unknown) {
    return this.points.reverse(id, body as never);
  }
}
