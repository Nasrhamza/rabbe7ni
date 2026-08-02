import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequirePermissions } from "../common/security.js";
import { StaffService } from "./staff.service.js";

@ApiTags("staff")
@Controller({ path: "staff", version: "1" })
export class StaffController {
  constructor(@Inject(StaffService) private readonly staff: StaffService) {}

  @Get()
  @RequirePermissions("staff.read")
  list(@Query() query: unknown) {
    return this.staff.list(query as never);
  }

  @Post("invitations")
  @RequirePermissions("staff.manage")
  invite(@Body() body: unknown) {
    return this.staff.invite(body as never);
  }

  @Get("roles")
  @RequirePermissions("staff.read")
  roles() {
    return this.staff.listRoles();
  }

  @Get(":id")
  @RequirePermissions("staff.read")
  get(@Param("id") id: string) {
    return this.staff.get(id);
  }

  @Patch(":id/assignment")
  @RequirePermissions("staff.manage")
  updateAssignment(@Param("id") id: string, @Body() body: unknown) {
    return this.staff.updateAssignment(id, body as never);
  }

  @Patch(":id/roles")
  @RequirePermissions("staff.manage")
  assignRoles(@Param("id") id: string, @Body() body: unknown) {
    return this.staff.assignRoles(id, body as never);
  }

  @Post(":id/status")
  @RequirePermissions("staff.manage")
  changeStatus(@Param("id") id: string, @Body() body: unknown) {
    return this.staff.changeStatus(id, body as never);
  }
}
