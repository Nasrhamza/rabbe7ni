-- Reference catalog required by every deployment.
--
-- Permissions and the SaaS plan catalog are part of the product contract, not demonstration data.
-- They previously existed only in prisma/seed.ts, so a database that ran migrations without the
-- demonstration seed had an empty permission table. Every role created there -- including the owner
-- role of a self-registered merchant -- resolved to zero permissions, and the authorization guard,
-- which fails closed, then rejected every request from that tenant.
--
-- Every statement is idempotent so this runs safely against databases already seeded by
-- prisma/seed.ts, which continues to upsert the same catalog.

INSERT INTO "permissions" ("id", "code", "description") VALUES
  (gen_random_uuid(), 'tenant.read', 'Read tenant configuration'),
  (gen_random_uuid(), 'tenant.manage', 'Manage tenant configuration'),
  (gen_random_uuid(), 'organization.read', 'Read organizations'),
  (gen_random_uuid(), 'organization.manage', 'Manage the organization'),
  (gen_random_uuid(), 'franchise.read', 'Read franchises'),
  (gen_random_uuid(), 'franchise.manage', 'Manage franchises'),
  (gen_random_uuid(), 'merchant.read', 'Read merchant profiles'),
  (gen_random_uuid(), 'merchant.manage', 'Manage merchants and branches'),
  (gen_random_uuid(), 'branch.read', 'Read branches'),
  (gen_random_uuid(), 'branch.manage', 'Manage branches'),
  (gen_random_uuid(), 'staff.read', 'Read staff assignments'),
  (gen_random_uuid(), 'staff.manage', 'Manage staff assignments'),
  (gen_random_uuid(), 'customer.read', 'Read customer profiles and history'),
  (gen_random_uuid(), 'customer.manage', 'Manage customer profiles, preferences and lifecycle'),
  (gen_random_uuid(), 'loyalty.read', 'Read loyalty programs and rules'),
  (gen_random_uuid(), 'loyalty.manage', 'Manage loyalty programs and rules'),
  (gen_random_uuid(), 'points.read', 'Read customer balances and the points ledger'),
  (gen_random_uuid(), 'points.adjust', 'Perform audited manual points adjustments'),
  (gen_random_uuid(), 'reward.read', 'Read reward catalog and redemptions'),
  (gen_random_uuid(), 'reward.manage', 'Manage reward catalog and stock'),
  (gen_random_uuid(), 'reward.redeem', 'Redeem and reverse customer rewards'),
  (gen_random_uuid(), 'qr.read', 'Read QR transaction history'),
  (gen_random_uuid(), 'qr.scan', 'Scan customer QR codes and execute authorized transactions'),
  (gen_random_uuid(), 'gamification.read', 'Read gamification configuration, XP and customer progression'),
  (gen_random_uuid(), 'gamification.manage', 'Manage gamification configuration, XP rules and levels'),
  (gen_random_uuid(), 'gamification.process', 'Process trusted gamification events and award automatic XP'),
  (gen_random_uuid(), 'gamification.adjust', 'Perform audited manual XP corrections and reversals'),
  (gen_random_uuid(), 'challenge.read', 'Read challenges, participants and progress'),
  (gen_random_uuid(), 'challenge.manage', 'Manage challenges, applicability and rewards'),
  (gen_random_uuid(), 'challenge.process', 'Process trusted challenge progress'),
  (gen_random_uuid(), 'challenge.validate', 'Manually validate challenge completion'),
  (gen_random_uuid(), 'habit.read', 'Read habits, missions and completion history'),
  (gen_random_uuid(), 'habit.manage', 'Manage habits, missions and manual progress'),
  (gen_random_uuid(), 'streak.read', 'Read streak rules and history'),
  (gen_random_uuid(), 'streak.manage', 'Manage streak configuration'),
  (gen_random_uuid(), 'streak.process', 'Process trusted streak qualifying events'),
  (gen_random_uuid(), 'badge.read', 'Read badges, achievements and customer collections'),
  (gen_random_uuid(), 'badge.manage', 'Manage badge catalog and achievement rules'),
  (gen_random_uuid(), 'badge.award', 'Award badges through authorized corrections'),
  (gen_random_uuid(), 'badge.revoke', 'Revoke badges with an audited reason'),
  (gen_random_uuid(), 'leaderboard.read', 'Read leaderboard configuration and results'),
  (gen_random_uuid(), 'leaderboard.manage', 'Manage leaderboard configuration'),
  (gen_random_uuid(), 'leaderboard.process', 'Generate scheduled leaderboard snapshots'),
  (gen_random_uuid(), 'segment.read', 'Read customer segments, previews and membership history'),
  (gen_random_uuid(), 'segment.manage', 'Create, update and refresh customer segments'),
  (gen_random_uuid(), 'segment.process', 'Run scheduled segment recalculation'),
  (gen_random_uuid(), 'campaign.read', 'Read campaigns and operational delivery metrics'),
  (gen_random_uuid(), 'campaign.manage', 'Create, schedule and manage campaigns'),
  (gen_random_uuid(), 'campaign.approve', 'Approve sensitive campaigns'),
  (gen_random_uuid(), 'campaign.process', 'Start and complete scheduled campaigns'),
  (gen_random_uuid(), 'automation.read', 'Read marketing workflows and executions'),
  (gen_random_uuid(), 'automation.manage', 'Create, pause, resume and cancel marketing workflows'),
  (gen_random_uuid(), 'automation.process', 'Consume trusted events and execute automation steps'),
  (gen_random_uuid(), 'notification.read', 'Read templates, delivery history and failures'),
  (gen_random_uuid(), 'notification.manage', 'Create and version notification templates'),
  (gen_random_uuid(), 'notification.send', 'Queue consent-aware notifications'),
  (gen_random_uuid(), 'notification.test', 'Send notification template tests'),
  (gen_random_uuid(), 'notification.retry', 'Retry failed notification deliveries'),
  (gen_random_uuid(), 'communication.manage', 'Manage customer communication preferences and consent'),
  (gen_random_uuid(), 'analytics.read', 'Read tenant-scoped analytics and pipeline health'),
  (gen_random_uuid(), 'analytics.manage', 'Backfill and operate tenant-scoped analytics pipelines'),
  (gen_random_uuid(), 'analytics.export', 'Export tenant-scoped analytics data'),
  (gen_random_uuid(), 'report.read', 'Read report definitions and execution history'),
  (gen_random_uuid(), 'report.manage', 'Create, schedule and execute reports'),
  (gen_random_uuid(), 'report.download', 'Download unexpired report artifacts'),
  (gen_random_uuid(), 'ai.request', 'Request explainable tenant-scoped AI recommendations'),
  (gen_random_uuid(), 'ai.manage', 'Operate AI configuration and evaluation jobs'),
  (gen_random_uuid(), 'subscription.read', 'Read subscription and plan entitlements'),
  (gen_random_uuid(), 'subscription.manage', 'Manage subscription lifecycle and plan changes'),
  (gen_random_uuid(), 'plan.manage', 'Create and maintain the global SaaS plan catalog'),
  (gen_random_uuid(), 'billing.read', 'Read tenant invoices and sandbox payment history'),
  (gen_random_uuid(), 'billing.manage', 'Operate PFE sandbox checkout and payment simulations'),
  (gen_random_uuid(), 'usage.write', 'Record idempotent tenant usage events'),
  (gen_random_uuid(), 'quota.manage', 'Manage tenant quota overrides'),
  (gen_random_uuid(), 'branding.read', 'Read tenant white-label and localization configuration'),
  (gen_random_uuid(), 'branding.manage', 'Manage tenant white-label assets and custom domains'),
  (gen_random_uuid(), 'localization.manage', 'Manage tenant languages, currencies and locale formats'),
  (gen_random_uuid(), 'audit.read', 'Read the tenant audit trail')
ON CONFLICT ("code") DO UPDATE SET "description" = EXCLUDED."description";

INSERT INTO "plans" (
  "id", "code", "name", "description", "status", "currency",
  "monthly_price_minor", "annual_price_minor", "transaction_fee_basis_points",
  "trial_days", "sort_order", "entitlements", "limits", "updated_at"
) VALUES
  (gen_random_uuid(), 'starter', 'Starter', 'Essential loyalty operations for an independent merchant', 'ACTIVE', 'TND', 49000, 490000, 100, 14, 10, '{"core_management":true,"loyalty":true,"qr":true,"multichannel_notifications":true}'::jsonb, '{"branches":3,"staff":15,"customers":5000,"monthly_notifications":10000,"monthly_qr_transactions":20000}'::jsonb, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'growth', 'Growth', 'Gamification, automation and analytics for growing networks', 'ACTIVE', 'TND', 129000, 1290000, 65, 21, 20, '{"core_management":true,"loyalty":true,"qr":true,"gamification":true,"smart_habits":true,"marketing_automation":true,"multichannel_notifications":true,"advanced_analytics":true,"advanced_reporting":true,"ai_intelligence":true}'::jsonb, '{"branches":50,"staff":500,"customers":100000,"monthly_notifications":250000,"monthly_qr_transactions":500000}'::jsonb, CURRENT_TIMESTAMP),
  (gen_random_uuid(), 'foundation', 'Enterprise', 'Complete Rabbehni commercial sandbox plan', 'ACTIVE', 'TND', 299000, 2990000, 35, 30, 30, '{"core_management":true,"loyalty":true,"qr":true,"gamification":true,"smart_habits":true,"marketing_automation":true,"multichannel_notifications":true,"advanced_analytics":true,"advanced_reporting":true,"ai_intelligence":true,"white_label":true}'::jsonb, '{"branches":500,"staff":5000,"customers":1000000,"monthly_notifications":2000000,"monthly_qr_transactions":5000000}'::jsonb, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "description" = EXCLUDED."description",
  "status" = EXCLUDED."status",
  "currency" = EXCLUDED."currency",
  "monthly_price_minor" = EXCLUDED."monthly_price_minor",
  "annual_price_minor" = EXCLUDED."annual_price_minor",
  "transaction_fee_basis_points" = EXCLUDED."transaction_fee_basis_points",
  "trial_days" = EXCLUDED."trial_days",
  "sort_order" = EXCLUDED."sort_order",
  "entitlements" = EXCLUDED."entitlements",
  "limits" = EXCLUDED."limits",
  "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "plan_feature_entitlements" ("id", "plan_id", "feature_key", "enabled", "updated_at")
SELECT gen_random_uuid(), v.plan_id, v.feature_key, v.enabled, CURRENT_TIMESTAMP
FROM (VALUES
  ((SELECT "id" FROM "plans" WHERE "code" = 'starter'), 'core_management', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'starter'), 'loyalty', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'starter'), 'qr', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'starter'), 'multichannel_notifications', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'growth'), 'core_management', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'growth'), 'loyalty', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'growth'), 'qr', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'growth'), 'gamification', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'growth'), 'smart_habits', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'growth'), 'marketing_automation', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'growth'), 'multichannel_notifications', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'growth'), 'advanced_analytics', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'growth'), 'advanced_reporting', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'growth'), 'ai_intelligence', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'foundation'), 'core_management', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'foundation'), 'loyalty', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'foundation'), 'qr', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'foundation'), 'gamification', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'foundation'), 'smart_habits', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'foundation'), 'marketing_automation', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'foundation'), 'multichannel_notifications', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'foundation'), 'advanced_analytics', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'foundation'), 'advanced_reporting', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'foundation'), 'ai_intelligence', true),
  ((SELECT "id" FROM "plans" WHERE "code" = 'foundation'), 'white_label', true)
) AS v(plan_id, feature_key, enabled)
ON CONFLICT ("plan_id", "feature_key") DO UPDATE SET "enabled" = EXCLUDED."enabled", "updated_at" = CURRENT_TIMESTAMP;

INSERT INTO "plan_quota_limits" ("id", "plan_id", "metric_key", "limit_value", "period", "updated_at")
SELECT gen_random_uuid(), v.plan_id, v.metric_key, v.limit_value, v.period, CURRENT_TIMESTAMP
FROM (VALUES
  ((SELECT "id" FROM "plans" WHERE "code" = 'starter'), 'branches', 3, 'MONTH'),
  ((SELECT "id" FROM "plans" WHERE "code" = 'starter'), 'staff', 15, 'MONTH'),
  ((SELECT "id" FROM "plans" WHERE "code" = 'starter'), 'customers', 5000, 'MONTH'),
  ((SELECT "id" FROM "plans" WHERE "code" = 'starter'), 'monthly_notifications', 10000, 'MONTH'),
  ((SELECT "id" FROM "plans" WHERE "code" = 'starter'), 'monthly_qr_transactions', 20000, 'MONTH'),
  ((SELECT "id" FROM "plans" WHERE "code" = 'growth'), 'branches', 50, 'MONTH'),
  ((SELECT "id" FROM "plans" WHERE "code" = 'growth'), 'staff', 500, 'MONTH'),
  ((SELECT "id" FROM "plans" WHERE "code" = 'growth'), 'customers', 100000, 'MONTH'),
  ((SELECT "id" FROM "plans" WHERE "code" = 'growth'), 'monthly_notifications', 250000, 'MONTH'),
  ((SELECT "id" FROM "plans" WHERE "code" = 'growth'), 'monthly_qr_transactions', 500000, 'MONTH'),
  ((SELECT "id" FROM "plans" WHERE "code" = 'foundation'), 'branches', 500, 'MONTH'),
  ((SELECT "id" FROM "plans" WHERE "code" = 'foundation'), 'staff', 5000, 'MONTH'),
  ((SELECT "id" FROM "plans" WHERE "code" = 'foundation'), 'customers', 1000000, 'MONTH'),
  ((SELECT "id" FROM "plans" WHERE "code" = 'foundation'), 'monthly_notifications', 2000000, 'MONTH'),
  ((SELECT "id" FROM "plans" WHERE "code" = 'foundation'), 'monthly_qr_transactions', 5000000, 'MONTH')
) AS v(plan_id, metric_key, limit_value, period)
ON CONFLICT ("plan_id", "metric_key") DO UPDATE SET "limit_value" = EXCLUDED."limit_value", "updated_at" = CURRENT_TIMESTAMP;
