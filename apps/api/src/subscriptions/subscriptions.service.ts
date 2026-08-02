import {
  ForbiddenException,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, timingSafeEqual } from "node:crypto";

import { parseDto } from "../common/validation.js";
import { TenantContextStore } from "../tenancy/tenant-context.store.js";
import {
  changePlanSchema,
  checkoutConfirmationSchema,
  checkoutSchema,
  createPlanSchema,
  createSubscriptionSchema,
  customDomainSchema,
  lifecycleSchema,
  localizationSchema,
  quotaOverrideSchema,
  sandboxWebhookSchema,
  startTrialSchema,
  updatePlanSchema,
  usageSchema,
  whiteLabelSchema,
  type CreateSubscriptionInput,
} from "./dto.js";
import { SubscriptionsRepository } from "./subscriptions.repository.js";

@Injectable()
export class SubscriptionsService {
  private readonly webhookSecret: string;

  constructor(
    @Inject(SubscriptionsRepository)
    private readonly subscriptions: SubscriptionsRepository,
    @Optional() @Inject(TenantContextStore) private readonly context?: TenantContextStore,
    @Optional() @Inject(ConfigService) config?: ConfigService,
  ) {
    this.webhookSecret =
      config?.get<string>("PFE_SANDBOX_WEBHOOK_SECRET") ?? "rabbehni-pfe-sandbox-webhook-secret";
  }

  listPlans(includeInactive = false) {
    return this.subscriptions.listPlans(includeInactive);
  }

  createPlan(input: unknown) {
    return this.subscriptions.createPlan(parseDto(createPlanSchema, input));
  }

  updatePlan(id: string, input: unknown) {
    return this.subscriptions.updatePlan(id, parseDto(updatePlanSchema, input));
  }

  create(input: CreateSubscriptionInput) {
    return this.subscriptions.create(parseDto(createSubscriptionSchema, input));
  }

  startTrial(input: unknown) {
    return this.subscriptions.startTrial(parseDto(startTrialSchema, input));
  }

  lifecycle(action: "activate" | "renew" | "cancel" | "suspend" | "reactivate", input: unknown) {
    return this.subscriptions.lifecycle(action, parseDto(lifecycleSchema, input));
  }

  changePlan(input: unknown) {
    return this.subscriptions.changePlan(parseDto(changePlanSchema, input));
  }

  async checkout(input: unknown) {
    const parsed = parseDto(checkoutSchema, input);
    const token = this.checkoutToken(this.requiredTenantId(), parsed.idempotencyKey);
    const intent = await this.subscriptions.createCheckout(parsed, token);
    return {
      provider: "PFE_SANDBOX",
      checkoutToken: token,
      expiresAt: intent.expiresAt,
      paymentIntentId: intent.id,
      amountMinor: intent.amountMinor,
      currency: intent.currency,
    };
  }

  confirmCheckout(input: unknown) {
    const parsed = parseDto(checkoutConfirmationSchema, input);
    return this.subscriptions.confirmCheckout(parsed, `checkout:${parsed.idempotencyKey}`);
  }

  async webhook(input: unknown, signature: string | undefined) {
    const parsed = parseDto(sandboxWebhookSchema, input);
    if (!signature) throw new UnauthorizedException("Missing sandbox webhook signature");
    const expected = this.signWebhook({
      tenantId: parsed.tenantId,
      eventId: parsed.eventId,
      paymentIntentId: parsed.paymentIntentId,
      outcome: parsed.outcome,
      ...(parsed.failureCode ? { failureCode: parsed.failureCode } : {}),
    });
    const received = Buffer.from(signature, "hex");
    const target = Buffer.from(expected, "hex");
    if (received.length !== target.length || !timingSafeEqual(received, target)) {
      throw new ForbiddenException("Invalid sandbox webhook signature");
    }
    const webhook = await this.subscriptions.processWebhook(parsed, expected);
    const intent = await this.subscriptions.getPaymentIntent(
      parsed.tenantId,
      parsed.paymentIntentId,
    );
    const payment = await this.subscriptions.confirmCheckout(
      {
        checkoutToken: this.checkoutToken(parsed.tenantId, intent.idempotencyKey),
        outcome: parsed.outcome,
        idempotencyKey: parsed.eventId,
        failureCode: parsed.failureCode,
      },
      `webhook:${parsed.eventId}`,
      parsed.tenantId,
    );
    return { webhook, payment };
  }

  recordUsage(input: unknown) {
    return this.subscriptions.recordUsage(parseDto(usageSchema, input));
  }

  setQuotaOverride(input: unknown) {
    return this.subscriptions.setQuotaOverride(parseDto(quotaOverrideSchema, input));
  }

  overview() {
    return this.subscriptions.overview();
  }

  listCurrent() {
    return this.subscriptions.listCurrent();
  }

  invoices() {
    return this.subscriptions.invoices();
  }

  payments() {
    return this.subscriptions.payments();
  }

  branding() {
    return this.subscriptions.branding();
  }

  updateBranding(input: unknown) {
    return this.subscriptions.updateBranding(parseDto(whiteLabelSchema, input));
  }

  updateLocalization(input: unknown) {
    return this.subscriptions.updateLocalization(parseDto(localizationSchema, input));
  }

  addDomain(input: unknown) {
    return this.subscriptions.addDomain(parseDto(customDomainSchema, input));
  }

  signWebhook(input: {
    tenantId: string;
    eventId: string;
    paymentIntentId: string;
    outcome: string;
    failureCode?: string;
  }): string {
    const message = [
      input.tenantId,
      input.eventId,
      input.paymentIntentId,
      input.outcome,
      input.failureCode ?? "",
    ].join(".");
    return createHmac("sha256", this.webhookSecret).update(message).digest("hex");
  }

  private checkoutToken(tenantId: string, idempotencyKey: string): string {
    return createHmac("sha256", this.webhookSecret)
      .update(`checkout.${tenantId}.${idempotencyKey}`)
      .digest("base64url");
  }

  private requiredTenantId(): string {
    if (!this.context) throw new Error("Tenant context is required");
    return this.context.tenantId();
  }
}
