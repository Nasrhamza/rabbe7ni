import { z } from "zod";

export const runtimeEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error", "fatal"]).default("info"),
  SERVICE_VERSION: z.string().min(1).default("0.0.0"),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().url().optional(),
});

export type RuntimeEnvironment = z.infer<typeof runtimeEnvironmentSchema>;

const redisEnvironmentSchema = runtimeEnvironmentSchema.extend({
  BULLMQ_PREFIX: z.string().min(1).default("rabbehni"),
  REDIS_URL: z.string().url(),
});

export const apiEnvironmentSchema = redisEnvironmentSchema.extend({
  API_PORT: z.coerce.number().int().positive().default(4000),
  CORS_ORIGINS: z
    .string()
    .default("http://localhost:3000,http://localhost:3001,http://localhost:3002"),
  DATABASE_URL: z.string().min(1),
  OIDC_ISSUER_URL: z.string().url(),
  OIDC_BACKCHANNEL_URL: z.string().url().optional(),
  OIDC_CLIENT_ID: z.string().min(1).default("rabbehni-web"),
  OIDC_AUDIENCE: z.string().min(1).default("rabbehni-api"),
  OIDC_CALLBACK_URL: z.string().url(),
  OIDC_ALLOWED_REDIRECT_URIS: z.string().min(1),
  KEYCLOAK_ADMIN_CLIENT_ID: z.string().min(1).default("rabbehni-auth-admin"),
  KEYCLOAK_ADMIN_CLIENT_SECRET: z.string().min(16),
  CUSTOMER_SIGNUP_TENANT_ID: z.uuid().default("10000000-0000-4000-8000-000000000001"),
  CUSTOMER_SIGNUP_ORGANIZATION_ID: z.uuid().default("10000000-0000-4000-8000-000000000002"),
  SESSION_COOKIE_NAME: z.string().min(1).default("rabbehni_session"),
  SESSION_SIGNING_SECRET: z.string().min(32),
  SESSION_ENCRYPTION_KEY: z.string().min(32),
  SESSION_ABSOLUTE_TTL_SECONDS: z.coerce.number().int().positive().default(2_592_000),
  SESSION_IDLE_TTL_SECONDS: z.coerce.number().int().positive().default(86_400),
  AUTH_COOKIE_SECURE: z
    .enum(["true", "false"])
    .default("false")
    .transform((value) => value === "true"),
  ANALYTICS_SERVICE_URL: z.string().url().default("http://localhost:4100"),
  AI_SERVICE_URL: z.string().url().default("http://localhost:8000"),
  INTERNAL_SERVICE_TOKEN: z.string().min(24).default("rabbehni-local-internal-token"),
  PFE_SANDBOX_WEBHOOK_SECRET: z.string().min(32).default("rabbehni-pfe-sandbox-webhook-secret"),
});

export const analyticsEnvironmentSchema = runtimeEnvironmentSchema.extend({
  ANALYTICS_PORT: z.coerce.number().int().positive().default(4100),
  CLICKHOUSE_DATABASE: z.string().min(1),
  CLICKHOUSE_PASSWORD: z.string(),
  CLICKHOUSE_URL: z.string().url(),
  CLICKHOUSE_USER: z.string().min(1),
  DATABASE_URL: z.string().min(1),
  INTERNAL_SERVICE_TOKEN: z.string().min(24).default("rabbehni-local-internal-token"),
});

export const notificationWorkerEnvironmentSchema = redisEnvironmentSchema.extend({
  NOTIFICATION_WORKER_PORT: z.coerce.number().int().positive().default(4101),
  DATABASE_URL: z.string().min(1),
});

export function parseRuntimeEnvironment(
  input: Readonly<Record<string, unknown>>,
): RuntimeEnvironment {
  return runtimeEnvironmentSchema.parse(input);
}

export function parseApiEnvironment(input: Readonly<Record<string, unknown>>) {
  return apiEnvironmentSchema.parse(input);
}

export function parseAnalyticsEnvironment(input: Readonly<Record<string, unknown>>) {
  return analyticsEnvironmentSchema.parse(input);
}

export function parseNotificationWorkerEnvironment(input: Readonly<Record<string, unknown>>) {
  return notificationWorkerEnvironmentSchema.parse(input);
}
