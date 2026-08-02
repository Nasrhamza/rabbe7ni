import { Inject, Injectable, NotFoundException } from "@nestjs/common";

import { parseDto } from "../common/validation.js";
import {
  createTemplateSchema,
  createTemplateVersionSchema,
  deliveryListSchema,
  inboxListSchema,
  notificationIdSchema,
  preferenceSchema,
  queueNotificationSchema,
  renderTemplateSchema,
  templateListSchema,
} from "./dto.js";
import { NotificationQueue } from "./notifications.queue.js";
import { NotificationsRepository } from "./notifications.repository.js";

@Injectable()
export class NotificationsService {
  constructor(
    @Inject(NotificationsRepository) private readonly notifications: NotificationsRepository,
    @Inject(NotificationQueue) private readonly queue: NotificationQueue,
  ) {}

  templates(input: never = {} as never) {
    return this.notifications.templates(parseDto(templateListSchema, input));
  }
  async template(id: string) {
    const result = await this.notifications.template(parseDto(notificationIdSchema, id));
    if (!result) throw new NotFoundException("Template not found or outside scope");
    return result;
  }
  createTemplate(input: never) {
    return this.notifications.createTemplate(parseDto(createTemplateSchema, input));
  }
  async addVersion(id: string, input: never) {
    const result = await this.notifications.addVersion(
      parseDto(notificationIdSchema, id),
      parseDto(createTemplateVersionSchema, input),
    );
    if (!result) throw new NotFoundException("Template not found or outside scope");
    return result;
  }
  async render(id: string, input: never) {
    const dto = parseDto(renderTemplateSchema, input);
    const result = await this.notifications.render(
      parseDto(notificationIdSchema, id),
      dto.locale,
      dto.variables,
    );
    if (!result) throw new NotFoundException("Template not found or outside scope");
    return result;
  }
  async queueDelivery(input: never) {
    const result = await this.notifications.queue(parseDto(queueNotificationSchema, input));
    if (!result.duplicate) {
      await this.queue.enqueue(
        result.delivery.tenantId,
        result.delivery.id,
        result.delivery.scheduledAt,
      );
    }
    return result;
  }
  deliveries(input: never = {} as never) {
    return this.notifications.deliveries(parseDto(deliveryListSchema, input));
  }
  async delivery(id: string) {
    const result = await this.notifications.delivery(parseDto(notificationIdSchema, id));
    if (!result) throw new NotFoundException("Delivery not found");
    return result;
  }
  async retry(id: string) {
    const delivery = await this.notifications.prepareRetry(parseDto(notificationIdSchema, id));
    if (!delivery) throw new NotFoundException("Delivery not found");
    await this.queue.retry(delivery.tenantId, delivery.id);
    return delivery;
  }
  inbox(customerId: string, input: never = {} as never) {
    return this.notifications.inbox(
      parseDto(notificationIdSchema, customerId),
      parseDto(inboxListSchema, input),
    );
  }
  async markRead(customerId: string, id: string) {
    const result = await this.notifications.markRead(
      parseDto(notificationIdSchema, customerId),
      parseDto(notificationIdSchema, id),
    );
    if (!result) throw new NotFoundException("Notification not found");
    return result;
  }
  markAllRead(customerId: string) {
    return this.notifications.markAllRead(parseDto(notificationIdSchema, customerId));
  }
  preferences(customerId: string) {
    return this.notifications.preferences(parseDto(notificationIdSchema, customerId));
  }
  preference(input: never) {
    return this.notifications.upsertPreference(parseDto(preferenceSchema, input));
  }
}
