import { Body, Controller, Get, Inject, Param, Patch, Post, Query } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";

import { RequireEntitlement, RequirePermissions } from "../common/security.js";
import { NotificationsService } from "./notifications.service.js";

@ApiTags("notifications")
@RequireEntitlement("multichannel_notifications")
@Controller({ path: "notifications", version: "1" })
export class NotificationsController {
  constructor(@Inject(NotificationsService) private readonly notifications: NotificationsService) {}

  @Get("templates")
  @RequirePermissions("notification.read")
  templates(@Query() query: unknown) {
    return this.notifications.templates(query as never);
  }
  @Get("templates/:id")
  @RequirePermissions("notification.read")
  template(@Param("id") id: string) {
    return this.notifications.template(id);
  }
  @Post("templates")
  @RequirePermissions("notification.manage")
  createTemplate(@Body() body: unknown) {
    return this.notifications.createTemplate(body as never);
  }
  @Post("templates/:id/versions")
  @RequirePermissions("notification.manage")
  addVersion(@Param("id") id: string, @Body() body: unknown) {
    return this.notifications.addVersion(id, body as never);
  }
  @Post("templates/:id/preview")
  @RequirePermissions("notification.read")
  preview(@Param("id") id: string, @Body() body: unknown) {
    return this.notifications.render(id, body as never);
  }
  @Post("templates/:id/test")
  @RequirePermissions("notification.test")
  async test(@Param("id") id: string, @Body() body: unknown) {
    const input = body as Record<string, unknown>;
    return this.notifications.queueDelivery({
      ...input,
      templateId: id,
      idempotencyKey:
        typeof input.idempotencyKey === "string"
          ? input.idempotencyKey
          : `test-${id}-${Date.now()}`,
    } as never);
  }
  @Post("queue")
  @RequirePermissions("notification.send")
  queue(@Body() body: unknown) {
    return this.notifications.queueDelivery(body as never);
  }
  @Get("deliveries")
  @RequirePermissions("notification.read")
  deliveries(@Query() query: unknown) {
    return this.notifications.deliveries(query as never);
  }
  @Get("deliveries/:id")
  @RequirePermissions("notification.read")
  delivery(@Param("id") id: string) {
    return this.notifications.delivery(id);
  }
  @Post("deliveries/:id/retry")
  @RequirePermissions("notification.retry")
  retry(@Param("id") id: string) {
    return this.notifications.retry(id);
  }
  @Get("inbox/:customerId")
  inbox(@Param("customerId") customerId: string, @Query() query: unknown) {
    return this.notifications.inbox(customerId, query as never);
  }
  @Patch("inbox/:customerId/:id/read")
  markRead(@Param("customerId") customerId: string, @Param("id") id: string) {
    return this.notifications.markRead(customerId, id);
  }
  @Patch("inbox/:customerId/read-all")
  markAllRead(@Param("customerId") customerId: string) {
    return this.notifications.markAllRead(customerId);
  }
  @Get("preferences/:customerId")
  preferences(@Param("customerId") customerId: string) {
    return this.notifications.preferences(customerId);
  }
  @Patch("preferences")
  preference(@Body() body: unknown) {
    return this.notifications.preference(body as never);
  }
}
