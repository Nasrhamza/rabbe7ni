import { Body, Controller, Get, Headers, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";

import { Public, RequirePermissions } from "../common/security.js";
import { SubscriptionsService } from "./subscriptions.service.js";

@ApiTags("commercial")
@Controller({ path: "commercial", version: "1" })
export class SubscriptionsController {
  constructor(@Inject(SubscriptionsService) private readonly subscriptions: SubscriptionsService) {}

  @Get("plans")
  @RequirePermissions("subscription.read")
  listPlans(@Query("includeInactive") includeInactive?: string) {
    return this.subscriptions.listPlans(includeInactive === "true");
  }

  @Post("plans")
  @RequirePermissions("plan.manage")
  createPlan(@Body() body: unknown) {
    return this.subscriptions.createPlan(body);
  }

  @Patch("plans/:id")
  @RequirePermissions("plan.manage")
  updatePlan(@Param("id") id: string, @Body() body: unknown) {
    return this.subscriptions.updatePlan(id, body);
  }

  @Get("overview")
  @RequirePermissions("subscription.read")
  overview() {
    return this.subscriptions.overview();
  }

  @Get("subscriptions")
  @RequirePermissions("subscription.read")
  subscriptionsList() {
    return this.subscriptions.listCurrent();
  }

  @Post("subscriptions/trial")
  @RequirePermissions("subscription.manage")
  startTrial(@Body() body: unknown) {
    return this.subscriptions.startTrial(body);
  }

  @Post("subscriptions/activate")
  @RequirePermissions("subscription.manage")
  activate(@Body() body: unknown) {
    return this.subscriptions.lifecycle("activate", body);
  }

  @Post("subscriptions/renew")
  @RequirePermissions("subscription.manage")
  renew(@Body() body: unknown) {
    return this.subscriptions.lifecycle("renew", body);
  }

  @Post("subscriptions/cancel")
  @RequirePermissions("subscription.manage")
  cancel(@Body() body: unknown) {
    return this.subscriptions.lifecycle("cancel", body);
  }

  @Post("subscriptions/suspend")
  @RequirePermissions("subscription.manage")
  suspend(@Body() body: unknown) {
    return this.subscriptions.lifecycle("suspend", body);
  }

  @Post("subscriptions/reactivate")
  @RequirePermissions("subscription.manage")
  reactivate(@Body() body: unknown) {
    return this.subscriptions.lifecycle("reactivate", body);
  }

  @Post("subscriptions/change-plan")
  @RequirePermissions("subscription.manage")
  changePlan(@Body() body: unknown) {
    return this.subscriptions.changePlan(body);
  }

  @Post("checkout")
  @RequirePermissions("billing.manage")
  checkout(@Body() body: unknown) {
    return this.subscriptions.checkout(body);
  }

  @Post("checkout/confirm")
  @RequirePermissions("billing.manage")
  confirmCheckout(@Body() body: unknown) {
    return this.subscriptions.confirmCheckout(body);
  }

  @Post("sandbox/webhook")
  @Public()
  @ApiOperation({ summary: "Validate and process a PFE sandbox-only billing webhook" })
  webhook(@Body() body: unknown, @Headers("x-rabbehni-sandbox-signature") signature?: string) {
    return this.subscriptions.webhook(body, signature);
  }

  @Get("invoices")
  @RequirePermissions("billing.read")
  invoices() {
    return this.subscriptions.invoices();
  }

  @Get("payments")
  @RequirePermissions("billing.read")
  payments() {
    return this.subscriptions.payments();
  }

  @Post("usage")
  @RequirePermissions("usage.write")
  usage(@Body() body: unknown) {
    return this.subscriptions.recordUsage(body);
  }

  @Post("quotas/override")
  @RequirePermissions("quota.manage")
  quotaOverride(@Body() body: unknown) {
    return this.subscriptions.setQuotaOverride(body);
  }

  @Get("branding")
  @RequirePermissions("branding.read")
  branding() {
    return this.subscriptions.branding();
  }

  @Patch("branding")
  @RequirePermissions("branding.manage")
  updateBranding(@Body() body: unknown) {
    return this.subscriptions.updateBranding(body);
  }

  @Patch("localization")
  @RequirePermissions("localization.manage")
  updateLocalization(@Body() body: unknown) {
    return this.subscriptions.updateLocalization(body);
  }

  @Post("domains")
  @RequirePermissions("branding.manage")
  addDomain(@Body() body: unknown) {
    return this.subscriptions.addDomain(body);
  }
}
