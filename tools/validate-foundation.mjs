import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const failures = [];
const passes = [];
const warnings = [];

function check(condition, message) {
  (condition ? passes : failures).push(message);
}

function read(path) {
  return readFileSync(join(root, path), "utf8");
}

function json(path) {
  try {
    return JSON.parse(read(path));
  } catch (error) {
    failures.push(`${path}: invalid JSON (${error.message})`);
    return undefined;
  }
}

function filesBelow(directory, filename) {
  const result = [];
  const visit = (current) => {
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if ([".git", ".next", ".nx", ".venv", "dist", "node_modules"].includes(entry.name)) {
        continue;
      }
      const path = join(current, entry.name);
      if (entry.isDirectory()) visit(path);
      else if (entry.name === filename) result.push(relative(root, path).replaceAll("\\", "/"));
    }
  };
  visit(join(root, directory));
  return result;
}

const applications = [
  "admin-web",
  "merchant-web",
  "customer-mobile",
  "api",
  "ai-service",
  "analytics-service",
  "notification-worker",
];
const packages = [
  "cache",
  "config",
  "contracts",
  "database",
  "design-system",
  "logger",
  "nestjs-platform",
  "observability",
  "queue",
];

for (const app of applications) {
  check(existsSync(join(root, "apps", app)), `application exists: ${app}`);
}
for (const legacy of ["ai", "mobile", "web", "worker"]) {
  const legacyRoot = join(root, "apps", legacy);
  const hasManifest =
    existsSync(join(legacyRoot, "package.json")) ||
    existsSync(join(legacyRoot, "project.json")) ||
    existsSync(join(legacyRoot, "pyproject.toml"));
  check(!hasManifest, `legacy application is not registered: ${legacy}`);
}
for (const pkg of packages) {
  check(existsSync(join(root, "packages", pkg)), `shared package exists: ${pkg}`);
}

const manifests = filesBelow(".", "package.json").filter(
  (path) => path === "package.json" || path.startsWith("apps") || path.startsWith("packages"),
);
const packageNames = new Map();
for (const path of manifests) {
  const manifest = json(path);
  if (!manifest) continue;
  check(typeof manifest.name === "string" && manifest.name.length > 0, `${path}: package name`);
  if (packageNames.has(manifest.name)) {
    failures.push(`${path}: duplicate package name ${manifest.name}`);
  } else {
    packageNames.set(manifest.name, path);
  }
}
for (const path of manifests) {
  const manifest = json(path);
  if (!manifest) continue;
  for (const group of ["dependencies", "devDependencies", "peerDependencies"]) {
    for (const [name, version] of Object.entries(manifest[group] ?? {})) {
      if (version === "workspace:*") {
        check(packageNames.has(name), `${path}: workspace dependency resolves (${name})`);
      }
    }
  }
}

const projects = filesBelow(".", "project.json");
const projectNames = new Set();
for (const path of projects) {
  const project = json(path);
  if (!project) continue;
  check(typeof project.name === "string", `${path}: Nx project name`);
  check(!projectNames.has(project.name), `${path}: unique Nx project name`);
  projectNames.add(project.name);
  check(
    typeof project.sourceRoot === "string" && existsSync(join(root, project.sourceRoot)),
    `${path}: sourceRoot exists`,
  );
}
for (const name of [...applications, ...packages]) {
  check(projectNames.has(name), `Nx project registered: ${name}`);
}

for (const file of filesBelow(".", "tsconfig.json")) json(file);
for (const file of filesBelow(".", "project.json")) json(file);
for (const file of filesBelow(".", "package.json")) json(file);
json("nx.json");
json("apps/customer-mobile/app.json");
json("apps/customer-mobile/eas.json");

for (const app of [
  "admin-web",
  "merchant-web",
  "api",
  "ai-service",
  "analytics-service",
  "notification-worker",
]) {
  check(existsSync(join(root, "apps", app, "Dockerfile")), `Dockerfile exists: ${app}`);
}

const env = read(".env.example");
for (const key of [
  "DATABASE_URL",
  "REDIS_URL",
  "BULLMQ_PREFIX",
  "CLICKHOUSE_URL",
  "OTEL_EXPORTER_OTLP_ENDPOINT",
  "ADMIN_WEB_PORT",
  "MERCHANT_WEB_PORT",
  "API_PORT",
  "AI_PORT",
  "ANALYTICS_PORT",
  "NOTIFICATION_WORKER_PORT",
  "OIDC_ISSUER_URL",
  "OIDC_BACKCHANNEL_URL",
  "OIDC_CALLBACK_URL",
  "OIDC_AUDIENCE",
  "SESSION_SIGNING_SECRET",
  "SESSION_ENCRYPTION_KEY",
]) {
  check(new RegExp(`^${key}=`, "m").test(env), `.env.example defines ${key}`);
}

const compose = read("infra/docker/compose.yaml");
for (const service of [
  ...applications.filter((name) => name !== "customer-mobile"),
  "postgres",
  "redis",
  "keycloak",
  "mailpit",
  "clickhouse",
  "otel-collector",
]) {
  check(new RegExp(`^  ${service}:`, "m").test(compose), `Compose service defined: ${service}`);
}

for (const document of [
  "README.md",
  "docs/architecture/README.md",
  "docs/architecture/system.md",
  "docs/architecture/phase-1-foundation.md",
  "docs/architecture/phase-2-core-domain.md",
  "docs/architecture/phase-3-auth-design-system.md",
  "docs/architecture/testing.md",
  "docs/architecture/deployment.md",
  "docs/architecture/observability.md",
  "docs/adr/0009-phase-1-technical-topology.md",
]) {
  check(existsSync(join(root, document)), `documentation exists: ${document}`);
}

for (const moduleName of [
  "identity",
  "tenancy",
  "organizations",
  "franchises",
  "merchants",
  "subscriptions",
  "audit",
]) {
  check(
    existsSync(join(root, "apps", "api", "src", moduleName)),
    `Phase 2 API module exists: ${moduleName}`,
  );
}

const prismaSchema = read("packages/database/prisma/schema.prisma");
for (const model of [
  "User",
  "Tenant",
  "Organization",
  "Franchise",
  "Merchant",
  "Branch",
  "Membership",
  "Staff",
  "Role",
  "Permission",
  "Plan",
  "Subscription",
  "TenantSetting",
  "AuditLog",
  "OutboxEvent",
  "AuthSession",
  "Customer",
  "CustomerActivity",
  "LoyaltyProgram",
  "EarningRule",
  "RedemptionRule",
  "PointsLedgerEntry",
  "RewardCategory",
  "Reward",
  "RewardRedemption",
  "CustomerQrToken",
  "QrTransaction",
]) {
  check(
    new RegExp(`^model ${model} \\{`, "m").test(prismaSchema),
    `Prisma core model exists: ${model}`,
  );
}

const coreMigration =
  "packages/database/prisma/migrations/20260726120000_phase_2_core_domain/migration.sql";
check(existsSync(join(root, coreMigration)), "Phase 2 core migration exists");
if (existsSync(join(root, coreMigration))) {
  const migration = read(coreMigration);
  check(
    migration.includes("ENABLE ROW LEVEL SECURITY"),
    "Phase 2 migration enables PostgreSQL RLS",
  );
  check(migration.includes("FORCE ROW LEVEL SECURITY"), "Phase 2 migration forces PostgreSQL RLS");
  check(
    migration.includes("app.current_tenant_id"),
    "Phase 2 migration uses transaction tenant context",
  );
}

check(existsSync(join(root, "apps/api/src/auth")), "Phase 3 authentication module exists");
for (const securityFile of [
  "authentication.guard.ts",
  "authorization.guard.ts",
  "auth.decorators.ts",
  "oidc.service.ts",
  "session-crypto.service.ts",
]) {
  check(
    existsSync(join(root, "apps/api/src/auth", securityFile)),
    `Phase 3 authentication component exists: ${securityFile}`,
  );
}

const authMigration =
  "packages/database/prisma/migrations/20260726190000_phase_3_authentication/migration.sql";
check(existsSync(join(root, authMigration)), "Phase 3 authentication migration exists");
if (existsSync(join(root, authMigration))) {
  const migration = read(authMigration);
  check(migration.includes('"auth_sessions"'), "Phase 3 migration creates auth sessions");
  check(migration.includes("FORCE ROW LEVEL SECURITY"), "Phase 3 sessions force PostgreSQL RLS");
}

for (const screen of [
  "apps/admin-web/src/app/login/page.tsx",
  "apps/admin-web/src/app/workspace/layout.tsx",
  "apps/admin-web/src/app/design-system/page.tsx",
  "apps/merchant-web/src/app/login/page.tsx",
  "apps/merchant-web/src/app/workspace/layout.tsx",
  "apps/merchant-web/src/app/design-system/page.tsx",
]) {
  check(existsSync(join(root, screen)), `Phase 3 frontend surface exists: ${screen}`);
}

for (const forbidden of [
  "apps/api/src/tenants",
  "apps/api/src/payments",
  "apps/ai-service/src/rabbehni_ai/models",
]) {
  check(!existsSync(join(root, forbidden)), `business module absent: ${forbidden}`);
}

for (const phase5Module of ["customers", "loyalty", "points", "rewards", "qr"]) {
  check(
    existsSync(join(root, "apps/api/src", phase5Module)),
    `Phase 5 API module exists: ${phase5Module}`,
  );
}

const phase5Migration =
  "packages/database/prisma/migrations/20260727102711_phase_5_loyalty_qr/migration.sql";
check(existsSync(join(root, phase5Migration)), "Phase 5 loyalty and QR migration exists");
if (existsSync(join(root, phase5Migration))) {
  const migration = read(phase5Migration);
  check(migration.includes("points_ledger_entries"), "Phase 5 migration creates points ledger");
  check(migration.includes("FORCE ROW LEVEL SECURITY"), "Phase 5 tables force PostgreSQL RLS");
  check(
    migration.includes("points_ledger_entries_append_only"),
    "Phase 5 points ledger is append-only",
  );
  check(migration.includes("qr_transactions_append_only"), "Phase 5 QR history is append-only");
}

for (const screen of [
  "apps/admin-web/src/app/workspace/phase5-resource.tsx",
  "apps/merchant-web/src/app/workspace/phase5-resource.tsx",
  "apps/customer-mobile/App.tsx",
]) {
  check(existsSync(join(root, screen)), `Phase 5 frontend surface exists: ${screen}`);
}

for (const phase6Module of [
  "gamification",
  "gamification-events",
  "challenges",
  "habits",
  "badges",
  "leaderboards",
]) {
  check(
    existsSync(join(root, "apps/api/src", phase6Module)),
    `Phase 6 API module exists: ${phase6Module}`,
  );
}

for (const model of [
  "GamificationConfig",
  "XpRule",
  "LevelDefinition",
  "CustomerGamificationProfile",
  "XpLedgerEntry",
  "CustomerLevelHistory",
  "Challenge",
  "ChallengeEnrollment",
  "ChallengeProgressEvent",
  "ChallengeRewardGrant",
  "Habit",
  "HabitCompletion",
  "StreakRule",
  "CustomerStreak",
  "StreakHistory",
  "Badge",
  "AchievementRule",
  "AchievementProgress",
  "CustomerBadge",
  "LeaderboardConfig",
  "LeaderboardSnapshot",
  "LeaderboardEntry",
  "GamificationEventReceipt",
]) {
  check(
    new RegExp(`^model ${model} \\{`, "m").test(prismaSchema),
    `Phase 6 Prisma model exists: ${model}`,
  );
}

const phase6Migration =
  "packages/database/prisma/migrations/20260727112720_phase_6_gamification/migration.sql";
check(existsSync(join(root, phase6Migration)), "Phase 6 gamification migration exists");
if (existsSync(join(root, phase6Migration))) {
  const migration = read(phase6Migration);
  check(migration.includes("xp_ledger_entries"), "Phase 6 migration creates XP ledger");
  check(migration.includes("FORCE ROW LEVEL SECURITY"), "Phase 6 tables force PostgreSQL RLS");
  check(migration.includes("xp_ledger_entries_append_only"), "Phase 6 XP ledger is append-only");
  check(
    migration.includes("challenge_reward_grants_append_only"),
    "Phase 6 challenge reward grants are append-only",
  );
  check(
    migration.includes("leaderboard_snapshots_append_only"),
    "Phase 6 leaderboard snapshots are append-only",
  );
}

for (const screen of [
  "packages/design-system/src/phase6-web.tsx",
  "apps/admin-web/src/app/workspace/phase6-resource.tsx",
  "apps/merchant-web/src/app/workspace/phase6-resource.tsx",
  "apps/customer-mobile/App.tsx",
]) {
  check(existsSync(join(root, screen)), `Phase 6 frontend surface exists: ${screen}`);
}

check(
  existsSync(join(root, "docs/architecture/phase-6-gamification.md")),
  "Phase 6 architecture documentation exists",
);

for (const phase7Module of [
  "segments",
  "campaigns",
  "automations",
  "notifications",
  "marketing-events",
]) {
  check(
    existsSync(join(root, "apps/api/src", phase7Module)),
    `Phase 7 API module exists: ${phase7Module}`,
  );
}

for (const model of [
  "CustomerSegment",
  "SegmentMembership",
  "SegmentMembershipHistory",
  "Campaign",
  "CampaignSegment",
  "CampaignApplicability",
  "AutomationWorkflow",
  "AutomationStep",
  "AutomationExecution",
  "AutomationStepExecution",
  "NotificationTemplate",
  "NotificationTemplateVersion",
  "NotificationDelivery",
  "NotificationAttempt",
  "InAppNotification",
  "CustomerCommunicationPreference",
  "CampaignMetric",
  "MarketingEventReceipt",
]) {
  check(
    new RegExp(`^model ${model} \\{`, "m").test(prismaSchema),
    `Phase 7 Prisma model exists: ${model}`,
  );
}

const phase7Migration =
  "packages/database/prisma/migrations/20260727124615_phase_7_marketing/migration.sql";
check(existsSync(join(root, phase7Migration)), "Phase 7 marketing migration exists");
if (existsSync(join(root, phase7Migration))) {
  const migration = read(phase7Migration);
  check(migration.includes("notification_deliveries"), "Phase 7 creates delivery records");
  check(migration.includes("FORCE ROW LEVEL SECURITY"), "Phase 7 tables force PostgreSQL RLS");
  check(
    migration.includes("notification_attempts_append_only"),
    "Phase 7 delivery attempts are append-only",
  );
}

for (const surface of [
  "packages/design-system/src/phase7-web.tsx",
  "apps/admin-web/src/app/workspace/phase7-resource.tsx",
  "apps/merchant-web/src/app/workspace/phase7-resource.tsx",
  "apps/customer-mobile/App.tsx",
  "apps/notification-worker/src/delivery/notification-delivery.processor.ts",
]) {
  check(existsSync(join(root, surface)), `Phase 7 surface exists: ${surface}`);
}

check(
  existsSync(join(root, "docs/architecture/phase-7-marketing-automation.md")),
  "Phase 7 architecture documentation exists",
);

if (!existsSync(join(root, "pnpm-lock.yaml"))) {
  warnings.push(
    "pnpm-lock.yaml is absent; frozen installs and Docker image builds remain blocked.",
  );
}
if (!existsSync(join(root, "packages/database/src/generated/prisma/client.ts"))) {
  warnings.push(
    "Prisma Client is not generated; database typecheck and application builds remain blocked.",
  );
}

for (const message of passes) console.log(`[PASS] ${message}`);
for (const message of warnings) console.warn(`[WARN] ${message}`);
for (const message of failures) console.error(`[FAIL] ${message}`);
console.log(
  `Static foundation validation: ${passes.length} passed, ${warnings.length} warning(s), ${failures.length} failed.`,
);
process.exitCode = failures.length === 0 ? 0 : 1;
