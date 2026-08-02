import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequirePermissions } from "../common/security.js";
import { CustomersService } from "./customers.service.js";

@ApiTags("customers")
@Controller({ path: "customers", version: "1" })
export class CustomersController {
  constructor(@Inject(CustomersService) private readonly customers: CustomersService) {}

  @Get("me")
  me() {
    return this.customers.me();
  }
  @Patch("me/preferences")
  updateMyPreferences(@Body() body: unknown) {
    return this.customers.updateMyPreferences(body as never);
  }
  @Patch("me/profile")
  updateMyProfile(@Body() body: unknown) {
    return this.customers.updateMyProfile(body as never);
  }
  @Get("me/referral")
  myReferral() {
    return this.customers.myReferral();
  }
  @Get("me/referrals")
  myReferralHistory() {
    return this.customers.myReferralHistory();
  }
  @Get()
  @RequirePermissions("customer.read")
  list(@Query() query: unknown) {
    return this.customers.list(query as never);
  }
  @Post()
  @RequirePermissions("customer.manage")
  create(@Body() body: unknown) {
    return this.customers.create(body as never);
  }
  @Get(":id")
  @RequirePermissions("customer.read")
  get(@Param("id") id: string) {
    return this.customers.get(id);
  }
  @Patch(":id")
  @RequirePermissions("customer.manage")
  update(@Param("id") id: string, @Body() body: unknown) {
    return this.customers.update(id, body as never);
  }
  @Post(":id/status")
  @RequirePermissions("customer.manage")
  status(@Param("id") id: string, @Body() body: unknown) {
    return this.customers.changeStatus(id, body as never);
  }
  @Post(":id/archive")
  @RequirePermissions("customer.manage")
  archive(@Param("id") id: string) {
    return this.customers.archive(id);
  }
}
