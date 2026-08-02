import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequireEntitlement, RequirePermissions } from "../common/security.js";
import { SegmentsService } from "./segments.service.js";

@ApiTags("segments")
@RequireEntitlement("marketing_automation")
@Controller({ path: "segments", version: "1" })
export class SegmentsController {
  constructor(@Inject(SegmentsService) private readonly segments: SegmentsService) {}

  @Get()
  @RequirePermissions("segment.read")
  list(@Query() query: unknown) {
    return this.segments.list(query as never);
  }
  @Get(":id")
  @RequirePermissions("segment.read")
  get(@Param("id") id: string) {
    return this.segments.get(id);
  }
  @Post()
  @RequirePermissions("segment.manage")
  create(@Body() body: unknown) {
    return this.segments.create(body as never);
  }
  @Patch(":id")
  @RequirePermissions("segment.manage")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.segments.update(id, body as never);
  }
  @Post("preview")
  @RequirePermissions("segment.read")
  preview(@Body() body: unknown) {
    return this.segments.preview(body as never);
  }
  @Post(":id/refresh")
  @RequirePermissions("segment.manage")
  refresh(@Param("id") id: string) {
    return this.segments.refresh(id);
  }
  @Post(":id/members")
  @RequirePermissions("segment.manage")
  replaceMembers(@Param("id") id: string, @Body() body: unknown) {
    return this.segments.replaceMembers(id, body as never);
  }
}
