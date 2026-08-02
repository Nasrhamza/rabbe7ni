import { config as loadEnvironment } from "dotenv";
import { resolve } from "node:path";
import {
  AutomationStatus,
  AutomationStepType,
  AutomationType,
  BadgeRarity,
  BadgeVisibility,
  CampaignStatus,
  CampaignType,
  BranchStatus,
  ChallengeCadence,
  ChallengeRewardType,
  ChallengeStatus,
  ChallengeType,
  ChallengeValidation,
  CustomerStatus,
  FranchiseStatus,
  GamificationStatus,
  HabitCadence,
  LeaderboardMetric,
  LeaderboardPeriod,
  LeaderboardScope,
  LoyaltyProgramStatus,
  MembershipStatus,
  MerchantStatus,
  MarketingStatus,
  NotificationCategory,
  NotificationChannel,
  NotificationTemplateStatus,
  OrganizationStatus,
  PlanStatus,
  PointsEntryType,
  RewardStatus,
  ReportFrequency,
  RegionStatus,
  RoleScope,
  StaffStatus,
  SegmentType,
  SubscriptionStatus,
  TenantStatus,
  UserStatus,
  XpEntryType,
} from "../src/generated/prisma/client.js";
import { createPrismaClient } from "../src/client.js";
import { TenantTransactionManager } from "../src/tenant-transaction.js";

loadEnvironment({
  path: resolve(import.meta.dirname, "../../../.env"),
  quiet: true,
});

const IDS = {
  tenant: "10000000-0000-4000-8000-000000000001",
  organization: "10000000-0000-4000-8000-000000000002",
  franchise: "10000000-0000-4000-8000-000000000003",
  merchant: "10000000-0000-4000-8000-000000000004",
  branch: "10000000-0000-4000-8000-000000000005",
  user: "10000000-0000-4000-8000-000000000006",
  membership: "10000000-0000-4000-8000-000000000007",
  staff: "10000000-0000-4000-8000-000000000008",
  role: "10000000-0000-4000-8000-000000000009",
  plan: "10000000-0000-4000-8000-000000000010",
  subscription: "10000000-0000-4000-8000-000000000011",
  setting: "10000000-0000-4000-8000-000000000012",
  customer: "10000000-0000-4000-8000-000000000013",
  loyaltyProgram: "10000000-0000-4000-8000-000000000014",
  earningRule: "10000000-0000-4000-8000-000000000015",
  redemptionRule: "10000000-0000-4000-8000-000000000016",
  rewardCategory: "10000000-0000-4000-8000-000000000017",
  reward: "10000000-0000-4000-8000-000000000018",
  openingPoints: "10000000-0000-4000-8000-000000000019",
  gamificationConfig: "10000000-0000-4000-8000-000000000020",
  bronzeLevel: "10000000-0000-4000-8000-000000000021",
  silverLevel: "10000000-0000-4000-8000-000000000022",
  goldLevel: "10000000-0000-4000-8000-000000000023",
  xpRule: "10000000-0000-4000-8000-000000000024",
  openingXp: "10000000-0000-4000-8000-000000000025",
  gamificationProfile: "10000000-0000-4000-8000-000000000026",
  badgeCategory: "10000000-0000-4000-8000-000000000027",
  firstBadge: "10000000-0000-4000-8000-000000000028",
  streakBadge: "10000000-0000-4000-8000-000000000029",
  achievementRule: "10000000-0000-4000-8000-000000000030",
  challenge: "10000000-0000-4000-8000-000000000031",
  challengeRewardXp: "10000000-0000-4000-8000-000000000032",
  challengeRewardBadge: "10000000-0000-4000-8000-000000000033",
  challengeEnrollment: "10000000-0000-4000-8000-000000000034",
  habit: "10000000-0000-4000-8000-000000000035",
  habitMilestone: "10000000-0000-4000-8000-000000000036",
  customerHabit: "10000000-0000-4000-8000-000000000037",
  streakRule: "10000000-0000-4000-8000-000000000038",
  leaderboard: "10000000-0000-4000-8000-000000000039",
  segment: "10000000-0000-4000-8000-000000000040",
  segmentMembership: "10000000-0000-4000-8000-000000000041",
  campaign: "10000000-0000-4000-8000-000000000042",
  campaignSegment: "10000000-0000-4000-8000-000000000043",
  template: "10000000-0000-4000-8000-000000000044",
  templateVersion: "10000000-0000-4000-8000-000000000045",
  automation: "10000000-0000-4000-8000-000000000046",
  automationStep: "10000000-0000-4000-8000-000000000047",
  communicationPreference: "10000000-0000-4000-8000-000000000048",
  notificationQuotaSetting: "10000000-0000-4000-8000-000000000049",
  reportTemplate: "10000000-0000-4000-8000-000000000050",
  reportTemplateVersion: "10000000-0000-4000-8000-000000000051",
  reportDefinition: "10000000-0000-4000-8000-000000000052",
  reportEmailPreference: "10000000-0000-4000-8000-000000000053",
  starterPlan: "10000000-0000-4000-8000-000000000054",
  growthPlan: "10000000-0000-4000-8000-000000000055",
  subscriptionChange: "10000000-0000-4000-8000-000000000056",
  whiteLabel: "10000000-0000-4000-8000-000000000057",
  localization: "10000000-0000-4000-8000-000000000058",
  countryTunisia: "10000000-0000-4000-8000-000000000059",
  countryFrance: "10000000-0000-4000-8000-000000000060",
  countryUae: "10000000-0000-4000-8000-000000000061",
  regionTunisia: "10000000-0000-4000-8000-000000000062",
  regionEurope: "10000000-0000-4000-8000-000000000063",
  regionGulf: "10000000-0000-4000-8000-000000000064",
  regionAdministrator: "10000000-0000-4000-8000-000000000065",
} as const;

const PERMISSIONS = [
  ["tenant.read", "Read tenant configuration"],
  ["tenant.manage", "Manage tenant configuration"],
  ["organization.read", "Read organizations"],
  ["organization.manage", "Manage the organization"],
  ["franchise.read", "Read franchises"],
  ["franchise.manage", "Manage franchises"],
  ["merchant.read", "Read merchant profiles"],
  ["merchant.manage", "Manage merchants and branches"],
  ["branch.read", "Read branches"],
  ["branch.manage", "Manage branches"],
  ["staff.read", "Read staff assignments"],
  ["staff.manage", "Manage staff assignments"],
  ["customer.read", "Read customer profiles and history"],
  ["customer.manage", "Manage customer profiles, preferences and lifecycle"],
  ["loyalty.read", "Read loyalty programs and rules"],
  ["loyalty.manage", "Manage loyalty programs and rules"],
  ["points.read", "Read customer balances and the points ledger"],
  ["points.adjust", "Perform audited manual points adjustments"],
  ["reward.read", "Read reward catalog and redemptions"],
  ["reward.manage", "Manage reward catalog and stock"],
  ["reward.redeem", "Redeem and reverse customer rewards"],
  ["qr.read", "Read QR transaction history"],
  ["qr.scan", "Scan customer QR codes and execute authorized transactions"],
  ["gamification.read", "Read gamification configuration, XP and customer progression"],
  ["gamification.manage", "Manage gamification configuration, XP rules and levels"],
  ["gamification.process", "Process trusted gamification events and award automatic XP"],
  ["gamification.adjust", "Perform audited manual XP corrections and reversals"],
  ["challenge.read", "Read challenges, participants and progress"],
  ["challenge.manage", "Manage challenges, applicability and rewards"],
  ["challenge.process", "Process trusted challenge progress"],
  ["challenge.validate", "Manually validate challenge completion"],
  ["habit.read", "Read habits, missions and completion history"],
  ["habit.manage", "Manage habits, missions and manual progress"],
  ["streak.read", "Read streak rules and history"],
  ["streak.manage", "Manage streak configuration"],
  ["streak.process", "Process trusted streak qualifying events"],
  ["badge.read", "Read badges, achievements and customer collections"],
  ["badge.manage", "Manage badge catalog and achievement rules"],
  ["badge.award", "Award badges through authorized corrections"],
  ["badge.revoke", "Revoke badges with an audited reason"],
  ["leaderboard.read", "Read leaderboard configuration and results"],
  ["leaderboard.manage", "Manage leaderboard configuration"],
  ["leaderboard.process", "Generate scheduled leaderboard snapshots"],
  ["segment.read", "Read customer segments, previews and membership history"],
  ["segment.manage", "Create, update and refresh customer segments"],
  ["segment.process", "Run scheduled segment recalculation"],
  ["campaign.read", "Read campaigns and operational delivery metrics"],
  ["campaign.manage", "Create, schedule and manage campaigns"],
  ["campaign.approve", "Approve sensitive campaigns"],
  ["campaign.process", "Start and complete scheduled campaigns"],
  ["automation.read", "Read marketing workflows and executions"],
  ["automation.manage", "Create, pause, resume and cancel marketing workflows"],
  ["automation.process", "Consume trusted events and execute automation steps"],
  ["notification.read", "Read templates, delivery history and failures"],
  ["notification.manage", "Create and version notification templates"],
  ["notification.send", "Queue consent-aware notifications"],
  ["notification.test", "Send notification template tests"],
  ["notification.retry", "Retry failed notification deliveries"],
  ["communication.manage", "Manage customer communication preferences and consent"],
  ["analytics.read", "Read tenant-scoped analytics and pipeline health"],
  ["analytics.manage", "Backfill and operate tenant-scoped analytics pipelines"],
  ["analytics.export", "Export tenant-scoped analytics data"],
  ["report.read", "Read report definitions and execution history"],
  ["report.manage", "Create, schedule and execute reports"],
  ["report.download", "Download unexpired report artifacts"],
  ["ai.request", "Request explainable tenant-scoped AI recommendations"],
  ["ai.manage", "Operate AI configuration and evaluation jobs"],
  ["subscription.read", "Read subscription and plan entitlements"],
  ["subscription.manage", "Manage subscription lifecycle and plan changes"],
  ["plan.manage", "Create and maintain the global SaaS plan catalog"],
  ["billing.read", "Read tenant invoices and sandbox payment history"],
  ["billing.manage", "Operate PFE sandbox checkout and payment simulations"],
  ["usage.write", "Record idempotent tenant usage events"],
  ["quota.manage", "Manage tenant quota overrides"],
  ["branding.read", "Read tenant white-label and localization configuration"],
  ["branding.manage", "Manage tenant white-label assets and custom domains"],
  ["localization.manage", "Manage tenant languages, currencies and locale formats"],
  ["audit.read", "Read the tenant audit trail"],
] as const;

const ALL_FEATURES = [
  "core_management",
  "loyalty",
  "qr",
  "gamification",
  "smart_habits",
  "marketing_automation",
  "multichannel_notifications",
  "advanced_analytics",
  "advanced_reporting",
  "ai_intelligence",
  "white_label",
] as const;

const FOUNDATION_QUOTAS = [
  ["branches", 500],
  ["staff", 5_000],
  ["customers", 1_000_000],
  ["monthly_notifications", 2_000_000],
  ["monthly_qr_transactions", 5_000_000],
] as const;

function demoUuid(sequence: number): string {
  return `20000000-0000-4000-8000-${String(sequence).padStart(12, "0")}`;
}

function daysAgo(days: number): Date {
  return new Date(Date.now() - days * 86_400_000);
}

async function seed(): Promise<void> {
  const connectionString = process.env.DIRECT_DATABASE_URL ?? process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DIRECT_DATABASE_URL or DATABASE_URL is required to seed the database");
  }

  const prisma = createPrismaClient(connectionString);
  const tenantTransactions = new TenantTransactionManager(prisma);

  try {
    await prisma.plan.upsert({
      where: { code: "foundation" },
      update: {
        name: "Enterprise",
        status: PlanStatus.ACTIVE,
        description: "Complete Rabbehni commercial sandbox plan for the PFE demonstration",
        currency: "TND",
        monthlyPriceMinor: 299_000,
        annualPriceMinor: 2_990_000,
        transactionFeeBasisPoints: 35,
        trialDays: 30,
        sortOrder: 30,
        entitlements: Object.fromEntries(ALL_FEATURES.map((feature) => [feature, true])),
        limits: Object.fromEntries(FOUNDATION_QUOTAS),
      },
      create: {
        id: IDS.plan,
        code: "foundation",
        name: "Enterprise",
        description: "Complete Rabbehni commercial sandbox plan for the PFE demonstration",
        status: PlanStatus.ACTIVE,
        currency: "TND",
        monthlyPriceMinor: 299_000,
        annualPriceMinor: 2_990_000,
        transactionFeeBasisPoints: 35,
        trialDays: 30,
        sortOrder: 30,
        entitlements: Object.fromEntries(ALL_FEATURES.map((feature) => [feature, true])),
        limits: Object.fromEntries(FOUNDATION_QUOTAS),
      },
    });

    const catalogPlans = [
      {
        id: IDS.starterPlan,
        code: "starter",
        name: "Starter",
        description: "Essential loyalty operations for an independent merchant",
        monthlyPriceMinor: 49_000,
        annualPriceMinor: 490_000,
        transactionFeeBasisPoints: 100,
        trialDays: 14,
        sortOrder: 10,
        features: ["core_management", "loyalty", "qr", "multichannel_notifications"],
        quotas: [
          ["branches", 3],
          ["staff", 15],
          ["customers", 5_000],
          ["monthly_notifications", 10_000],
          ["monthly_qr_transactions", 20_000],
        ] as const,
      },
      {
        id: IDS.growthPlan,
        code: "growth",
        name: "Growth",
        description: "Gamification, automation and analytics for growing networks",
        monthlyPriceMinor: 129_000,
        annualPriceMinor: 1_290_000,
        transactionFeeBasisPoints: 65,
        trialDays: 21,
        sortOrder: 20,
        features: ALL_FEATURES.filter((feature) => feature !== "white_label"),
        quotas: [
          ["branches", 50],
          ["staff", 500],
          ["customers", 100_000],
          ["monthly_notifications", 250_000],
          ["monthly_qr_transactions", 500_000],
        ] as const,
      },
    ] as const;
    for (const plan of catalogPlans) {
      await prisma.plan.upsert({
        where: { code: plan.code },
        update: {
          name: plan.name,
          description: plan.description,
          status: PlanStatus.ACTIVE,
          currency: "TND",
          monthlyPriceMinor: plan.monthlyPriceMinor,
          annualPriceMinor: plan.annualPriceMinor,
          transactionFeeBasisPoints: plan.transactionFeeBasisPoints,
          trialDays: plan.trialDays,
          sortOrder: plan.sortOrder,
          entitlements: Object.fromEntries(plan.features.map((feature) => [feature, true])),
          limits: Object.fromEntries(plan.quotas),
        },
        create: {
          id: plan.id,
          code: plan.code,
          name: plan.name,
          description: plan.description,
          status: PlanStatus.ACTIVE,
          currency: "TND",
          monthlyPriceMinor: plan.monthlyPriceMinor,
          annualPriceMinor: plan.annualPriceMinor,
          transactionFeeBasisPoints: plan.transactionFeeBasisPoints,
          trialDays: plan.trialDays,
          sortOrder: plan.sortOrder,
          entitlements: Object.fromEntries(plan.features.map((feature) => [feature, true])),
          limits: Object.fromEntries(plan.quotas),
        },
      });
      for (const featureKey of plan.features) {
        await prisma.planFeatureEntitlement.upsert({
          where: { planId_featureKey: { planId: plan.id, featureKey } },
          update: { enabled: true },
          create: { planId: plan.id, featureKey, enabled: true },
        });
      }
      for (const [metricKey, limitValue] of plan.quotas) {
        await prisma.planQuotaLimit.upsert({
          where: { planId_metricKey: { planId: plan.id, metricKey } },
          update: { limitValue, period: "MONTH" },
          create: { planId: plan.id, metricKey, limitValue, period: "MONTH" },
        });
      }
    }
    for (const featureKey of ALL_FEATURES) {
      await prisma.planFeatureEntitlement.upsert({
        where: { planId_featureKey: { planId: IDS.plan, featureKey } },
        update: { enabled: true },
        create: { planId: IDS.plan, featureKey, enabled: true },
      });
    }
    for (const [metricKey, limitValue] of FOUNDATION_QUOTAS) {
      await prisma.planQuotaLimit.upsert({
        where: { planId_metricKey: { planId: IDS.plan, metricKey } },
        update: { limitValue, period: "MONTH" },
        create: { planId: IDS.plan, metricKey, limitValue, period: "MONTH" },
      });
    }

    for (const [code, description] of PERMISSIONS) {
      await prisma.permission.upsert({
        where: { code },
        update: { description },
        create: { code, description },
      });
    }

    await prisma.user.upsert({
      where: { normalizedEmail: "owner@demo.rabbehni.local" },
      update: {
        displayName: "Rabbehni Demo Owner",
        externalSubject: IDS.user,
        status: UserStatus.ACTIVE,
      },
      create: {
        id: IDS.user,
        externalSubject: IDS.user,
        email: "owner@demo.rabbehni.local",
        normalizedEmail: "owner@demo.rabbehni.local",
        displayName: "Rabbehni Demo Owner",
        locale: "fr-TN",
        status: UserStatus.ACTIVE,
      },
    });

    await tenantTransactions.run(IDS.tenant, async (transaction) => {
      await transaction.tenant.upsert({
        where: { id: IDS.tenant },
        update: {
          status: TenantStatus.ACTIVE,
        },
        create: {
          id: IDS.tenant,
          slug: "demo-tunisia",
          status: TenantStatus.ACTIVE,
          region: "TN",
          defaultLocale: "fr-TN",
          defaultCurrency: "TND",
        },
      });

      for (const country of [
        {
          id: IDS.countryTunisia,
          code: "TN",
          name: "Tunisie",
          defaultLocale: "fr-TN",
          defaultCurrency: "TND",
        },
        {
          id: IDS.countryFrance,
          code: "FR",
          name: "France",
          defaultLocale: "fr-FR",
          defaultCurrency: "EUR",
        },
        {
          id: IDS.countryUae,
          code: "AE",
          name: "Émirats arabes unis",
          defaultLocale: "ar-AE",
          defaultCurrency: "AED",
        },
      ]) {
        await transaction.platformCountry.upsert({
          where: { tenantId_code: { tenantId: IDS.tenant, code: country.code } },
          update: {
            name: country.name,
            defaultLocale: country.defaultLocale,
            defaultCurrency: country.defaultCurrency,
            active: true,
            archivedAt: null,
          },
          create: { tenantId: IDS.tenant, active: true, ...country },
        });
      }

      for (const region of [
        {
          id: IDS.regionTunisia,
          countryId: IDS.countryTunisia,
          code: "TN-NATIONAL",
          name: "Tunisie",
          timezone: "Africa/Tunis",
          locale: "fr-TN",
          currency: "TND",
          culturalProfile: {
            firstLanguage: "ar",
            secondaryLanguage: "fr",
            rewardStyle: "family-and-value",
          },
        },
        {
          id: IDS.regionEurope,
          countryId: IDS.countryFrance,
          code: "EU-FR",
          name: "Europe francophone",
          timezone: "Europe/Paris",
          locale: "fr-FR",
          currency: "EUR",
          culturalProfile: { firstLanguage: "fr", rewardStyle: "premium-and-sustainable" },
        },
        {
          id: IDS.regionGulf,
          countryId: IDS.countryUae,
          code: "GULF-AE",
          name: "Région du Golfe",
          timezone: "Asia/Dubai",
          locale: "ar-AE",
          currency: "AED",
          culturalProfile: { firstLanguage: "ar", rewardStyle: "premium-and-hospitality" },
        },
      ]) {
        await transaction.platformRegion.upsert({
          where: { tenantId_code: { tenantId: IDS.tenant, code: region.code } },
          update: {
            name: region.name,
            countryId: region.countryId,
            timezone: region.timezone,
            locale: region.locale,
            currency: region.currency,
            status: RegionStatus.ACTIVE,
            culturalProfile: region.culturalProfile,
            archivedAt: null,
          },
          create: { tenantId: IDS.tenant, status: RegionStatus.ACTIVE, ...region },
        });
      }

      await transaction.organization.upsert({
        where: {
          tenantId_code: {
            tenantId: IDS.tenant,
            code: "DEMO-TN",
          },
        },
        update: {
          legalName: "Groupe Carthage Holding SA",
          displayName: "Groupe Carthage",
          status: OrganizationStatus.ACTIVE,
          activatedAt: new Date(),
        },
        create: {
          id: IDS.organization,
          tenantId: IDS.tenant,
          code: "DEMO-TN",
          legalName: "Groupe Carthage Holding SA",
          displayName: "Groupe Carthage",
          countryCode: "TN",
          timezone: "Africa/Tunis",
          status: OrganizationStatus.ACTIVE,
          activatedAt: new Date(),
          settings: {
            supportedLocales: ["fr-TN", "ar-TN", "en"],
          },
        },
      });

      await transaction.franchise.upsert({
        where: {
          tenantId_code: {
            tenantId: IDS.tenant,
            code: "DEMO-FRANCHISE",
          },
        },
        update: { name: "Café Medina Tunisie", status: FranchiseStatus.ACTIVE },
        create: {
          id: IDS.franchise,
          tenantId: IDS.tenant,
          organizationId: IDS.organization,
          code: "DEMO-FRANCHISE",
          name: "Café Medina Tunisie",
          status: FranchiseStatus.ACTIVE,
          settings: {
            accessBoundary: "organization",
          },
        },
      });

      await transaction.merchant.upsert({
        where: {
          tenantId_code: {
            tenantId: IDS.tenant,
            code: "DEMO-MERCHANT",
          },
        },
        update: {
          legalName: "Café Medina SARL",
          displayName: "Café Medina",
          status: MerchantStatus.ACTIVE,
          activatedAt: new Date(),
        },
        create: {
          id: IDS.merchant,
          tenantId: IDS.tenant,
          organizationId: IDS.organization,
          franchiseId: IDS.franchise,
          code: "DEMO-MERCHANT",
          legalName: "Café Medina SARL",
          displayName: "Café Medina",
          status: MerchantStatus.ACTIVE,
          contactEmail: "merchant@demo.rabbehni.local",
          contactPhone: "+216 70 000 000",
          city: "Tunis",
          countryCode: "TN",
          timezone: "Africa/Tunis",
          locale: "fr-TN",
          activatedAt: new Date(),
        },
      });

      await transaction.branch.upsert({
        where: {
          tenantId_code: {
            tenantId: IDS.tenant,
            code: "DEMO-TUNIS",
          },
        },
        update: {
          name: "Café Medina · Lac 2",
          addressLine: "Rue de la Bourse, Les Berges du Lac 2",
          status: BranchStatus.ACTIVE,
        },
        create: {
          id: IDS.branch,
          tenantId: IDS.tenant,
          organizationId: IDS.organization,
          merchantId: IDS.merchant,
          franchiseId: IDS.franchise,
          code: "DEMO-TUNIS",
          name: "Café Medina · Lac 2",
          addressLine: "Rue de la Bourse, Les Berges du Lac 2",
          city: "Tunis",
          countryCode: "TN",
          timezone: "Africa/Tunis",
          locale: "fr-TN",
          currency: "TND",
          status: BranchStatus.ACTIVE,
          openingHours: {
            monday: ["08:00", "18:00"],
            tuesday: ["08:00", "18:00"],
          },
        },
      });

      const demoOrganizations = [
        {
          id: demoUuid(1),
          code: "JASMIN-HOSP",
          legalName: "Groupe Jasmin Hospitality SA",
          displayName: "Groupe Jasmin",
        },
        {
          id: demoUuid(2),
          code: "MEDINA-RETAIL",
          legalName: "Medina Retail Tunisie SA",
          displayName: "Medina Retail",
        },
        {
          id: demoUuid(3),
          code: "ATLAS-WELL",
          legalName: "Atlas Wellness Group SARL",
          displayName: "Atlas Wellness",
        },
      ] as const;
      for (const organization of demoOrganizations) {
        await transaction.organization.upsert({
          where: {
            tenantId_code: {
              tenantId: IDS.tenant,
              code: organization.code,
            },
          },
          update: {
            legalName: organization.legalName,
            displayName: organization.displayName,
            status: OrganizationStatus.ACTIVE,
          },
          create: {
            ...organization,
            tenantId: IDS.tenant,
            countryCode: "TN",
            timezone: "Africa/Tunis",
            status: OrganizationStatus.ACTIVE,
            activatedAt: daysAgo(180),
            settings: {
              supportedLocales: ["fr-TN", "ar-TN", "en"],
              demo: true,
            },
          },
        });
      }

      const demoFranchises = [
        {
          id: demoUuid(10),
          organizationId: demoUuid(1),
          code: "JASMIN-HOTELS",
          name: "Jasmin Hotels & Resorts",
        },
        {
          id: demoUuid(11),
          organizationId: demoUuid(2),
          code: "MEDINA-MARKET",
          name: "Medina Market",
        },
        {
          id: demoUuid(12),
          organizationId: demoUuid(3),
          code: "ATLAS-FIT",
          name: "Atlas Fit & Wellness",
        },
      ] as const;
      for (const franchise of demoFranchises) {
        await transaction.franchise.upsert({
          where: {
            tenantId_code: {
              tenantId: IDS.tenant,
              code: franchise.code,
            },
          },
          update: {
            name: franchise.name,
            status: FranchiseStatus.ACTIVE,
          },
          create: {
            ...franchise,
            tenantId: IDS.tenant,
            description: "Réseau de démonstration pour la soutenance PFE",
            status: FranchiseStatus.ACTIVE,
            settings: { accessBoundary: "organization", demo: true },
          },
        });
      }

      const demoMerchants = [
        {
          id: demoUuid(20),
          organizationId: IDS.organization,
          franchiseId: IDS.franchise,
          code: "DAR-EL-BEY",
          name: "Dar El Bey",
          city: "Tunis",
        },
        {
          id: demoUuid(21),
          organizationId: demoUuid(1),
          franchiseId: demoUuid(10),
          code: "MAISON-JASMIN",
          name: "Maison Jasmin",
          city: "Sousse",
        },
        {
          id: demoUuid(22),
          organizationId: demoUuid(1),
          franchiseId: demoUuid(10),
          code: "JASMIN-SPA",
          name: "Jasmin Spa",
          city: "Hammamet",
        },
        {
          id: demoUuid(23),
          organizationId: demoUuid(2),
          franchiseId: demoUuid(11),
          code: "MEDINA-MARKET",
          name: "Medina Market",
          city: "Tunis",
        },
        {
          id: demoUuid(24),
          organizationId: demoUuid(2),
          franchiseId: demoUuid(11),
          code: "NORTH-COAST",
          name: "North Coast Store",
          city: "Bizerte",
        },
        {
          id: demoUuid(25),
          organizationId: demoUuid(3),
          franchiseId: demoUuid(12),
          code: "ATLAS-FIT",
          name: "Atlas Fit",
          city: "Tunis",
        },
        {
          id: demoUuid(26),
          organizationId: demoUuid(3),
          franchiseId: demoUuid(12),
          code: "ZENITH-WELL",
          name: "Zenith Wellness",
          city: "Sfax",
        },
        {
          id: demoUuid(27),
          organizationId: demoUuid(3),
          franchiseId: demoUuid(12),
          code: "BLUE-LAGOON",
          name: "Blue Lagoon Spa",
          city: "Monastir",
        },
      ] as const;
      for (const merchant of demoMerchants) {
        await transaction.merchant.upsert({
          where: {
            tenantId_code: {
              tenantId: IDS.tenant,
              code: merchant.code,
            },
          },
          update: {
            displayName: merchant.name,
            status: MerchantStatus.ACTIVE,
          },
          create: {
            id: merchant.id,
            tenantId: IDS.tenant,
            organizationId: merchant.organizationId,
            franchiseId: merchant.franchiseId,
            code: merchant.code,
            legalName: `${merchant.name} SARL`,
            displayName: merchant.name,
            status: MerchantStatus.ACTIVE,
            contactEmail: `contact@${merchant.code.toLowerCase()}.demo`,
            contactPhone: `+216 70 10 20 ${String(merchant.id.at(-1) ?? "0").padStart(2, "0")}`,
            city: merchant.city,
            countryCode: "TN",
            timezone: "Africa/Tunis",
            locale: "fr-TN",
            activatedAt: daysAgo(150),
            settings: { demo: true },
          },
        });
      }

      const allDemoMerchants = [
        {
          id: IDS.merchant,
          organizationId: IDS.organization,
          franchiseId: IDS.franchise,
          code: "CAFE-MEDINA",
          name: "Café Medina",
        },
        ...demoMerchants,
      ];
      const branchCities = [
        ["Lac 2", "Rue de la Bourse, Les Berges du Lac 2"],
        ["La Marsa", "Avenue Habib Bourguiba, La Marsa"],
        ["Centre-ville", "Avenue de France, Tunis"],
      ] as const;
      let branchSequence = 100;
      for (const [merchantIndex, merchant] of allDemoMerchants.entries()) {
        const locations = merchantIndex === 0 ? branchCities.slice(1) : branchCities;
        for (const [locationIndex, [location, addressLine]] of locations.entries()) {
          const code = `${merchant.code}-${locationIndex + 1}`;
          await transaction.branch.upsert({
            where: { tenantId_code: { tenantId: IDS.tenant, code } },
            update: {
              name: `${merchant.name} · ${location}`,
              addressLine,
              status: BranchStatus.ACTIVE,
            },
            create: {
              id: demoUuid(branchSequence),
              tenantId: IDS.tenant,
              organizationId: merchant.organizationId,
              merchantId: merchant.id,
              franchiseId: merchant.franchiseId,
              code,
              name: `${merchant.name} · ${location}`,
              addressLine,
              city: location === "La Marsa" ? "La Marsa" : "Tunis",
              countryCode: "TN",
              timezone: "Africa/Tunis",
              locale: "fr-TN",
              currency: "TND",
              phone: `+216 71 200 ${String(branchSequence).slice(-3)}`,
              email: `branch-${branchSequence}@demo.rabbehni.local`,
              status: BranchStatus.ACTIVE,
              settings: { demo: true, dailyTarget: 150 },
              openingHours: {
                monday: ["08:00", "20:00"],
                tuesday: ["08:00", "20:00"],
                wednesday: ["08:00", "20:00"],
                thursday: ["08:00", "20:00"],
                friday: ["08:00", "21:00"],
                saturday: ["09:00", "22:00"],
                sunday: ["09:00", "18:00"],
              },
            },
          });
          branchSequence += 1;
        }
      }

      await transaction.customer.upsert({
        where: { id: IDS.customer },
        update: {
          displayName: "Amira Ben Salah",
          status: CustomerStatus.ACTIVE,
        },
        create: {
          id: IDS.customer,
          tenantId: IDS.tenant,
          organizationId: IDS.organization,
          userId: IDS.user,
          externalReference: "DEMO-CUSTOMER-001",
          email: "owner@demo.rabbehni.local",
          normalizedEmail: "owner@demo.rabbehni.local",
          phone: "+216 20 000 001",
          firstName: "Amira",
          lastName: "Ben Salah",
          displayName: "Amira Ben Salah",
          locale: "fr-TN",
          status: CustomerStatus.ACTIVE,
          activatedAt: new Date(),
          preferences: { preferredCategories: ["cafe", "wellness"] },
          communicationPreferences: { email: true, sms: false, push: true },
          consents: {
            loyalty: { granted: true, grantedAt: new Date().toISOString() },
            marketing: { granted: false },
          },
        },
      });

      const firstNames = [
        "Ahmed",
        "Meriem",
        "Youssef",
        "Sarra",
        "Mohamed",
        "Ines",
        "Aziz",
        "Rania",
        "Walid",
        "Nour",
        "Fares",
        "Aya",
      ] as const;
      const lastNames = ["Trabelsi", "Ben Amor", "Mansour"] as const;
      let customerSequence = 0;
      for (const firstName of firstNames) {
        for (const lastName of lastNames) {
          customerSequence += 1;
          const customerId = demoUuid(300 + customerSequence);
          const email =
            `${firstName}.${lastName}.${customerSequence}@demo.rabbehni.local`.toLowerCase();
          const status =
            customerSequence % 11 === 0 ? CustomerStatus.SUSPENDED : CustomerStatus.ACTIVE;
          await transaction.customer.upsert({
            where: { id: customerId },
            update: {
              displayName: `${firstName} ${lastName}`,
              status,
            },
            create: {
              id: customerId,
              tenantId: IDS.tenant,
              organizationId: IDS.organization,
              externalReference: `DEMO-CUSTOMER-${String(customerSequence + 1).padStart(3, "0")}`,
              email,
              normalizedEmail: email,
              phone: `+216 ${20 + (customerSequence % 8)} ${String(100_000 + customerSequence * 137).slice(-6)}`,
              firstName,
              lastName,
              displayName: `${firstName} ${lastName}`,
              locale: customerSequence % 4 === 0 ? "ar-TN" : "fr-TN",
              status,
              activatedAt: daysAgo((customerSequence * 7) % 180),
              createdAt: daysAgo((customerSequence * 7) % 180),
              preferences: {
                preferredCategories:
                  customerSequence % 3 === 0 ? ["cafe", "rewards"] : ["wellness", "shopping"],
                demoSegment:
                  customerSequence % 8 === 0
                    ? "VIP"
                    : customerSequence % 5 === 0
                      ? "AT_RISK"
                      : "LOYAL",
              },
              communicationPreferences: {
                email: true,
                sms: customerSequence % 2 === 0,
                push: true,
              },
              consents: {
                loyalty: { granted: true, grantedAt: daysAgo(120).toISOString() },
                marketing: { granted: customerSequence % 6 !== 0 },
              },
            },
          });
          const activityId = demoUuid(500 + customerSequence);
          const existingActivity = await transaction.customerActivity.findUnique({
            where: {
              id_tenantId: {
                id: activityId,
                tenantId: IDS.tenant,
              },
            },
          });
          if (!existingActivity) {
            await transaction.customerActivity.create({
              data: {
                id: activityId,
                tenantId: IDS.tenant,
                customerId,
                type: "DEMO_VISIT",
                referenceId: `VISIT-${String(customerSequence).padStart(4, "0")}`,
                metadata: {
                  amountMinor: 1_200 + customerSequence * 75,
                  branch: branchCities[customerSequence % branchCities.length]![0],
                },
                occurredAt: daysAgo(customerSequence % 28),
              },
            });
          }
        }
      }

      await transaction.loyaltyProgram.upsert({
        where: {
          tenantId_code: {
            tenantId: IDS.tenant,
            code: "DEMO-POINTS",
          },
        },
        update: {
          status: LoyaltyProgramStatus.ACTIVE,
        },
        create: {
          id: IDS.loyaltyProgram,
          tenantId: IDS.tenant,
          organizationId: IDS.organization,
          code: "DEMO-POINTS",
          name: "Rabbehni Demo Points",
          description: "Programme de fidélité de démonstration Phase 5",
          pointsLabel: "points",
          status: LoyaltyProgramStatus.ACTIVE,
          expirationDays: 365,
          minimumEarnPoints: 1,
          maximumEarnPoints: 10_000,
          minimumRedeemPoints: 100,
          maximumRedeemPoints: 50_000,
          appliesToAllMerchants: false,
          appliesToAllBranches: false,
          activatedAt: new Date(),
        },
      });

      await transaction.earningRule.upsert({
        where: {
          tenantId_programId_code: {
            tenantId: IDS.tenant,
            programId: IDS.loyaltyProgram,
            code: "PURCHASE",
          },
        },
        update: { active: true },
        create: {
          id: IDS.earningRule,
          tenantId: IDS.tenant,
          programId: IDS.loyaltyProgram,
          code: "PURCHASE",
          name: "Achat standard",
          eventType: "purchase",
          points: 1,
          multiplier: 1,
          minimumAmount: 1,
          maximumPoints: 5_000,
          active: true,
          conditions: { pointsPerCurrencyUnit: 1 },
        },
      });

      await transaction.redemptionRule.upsert({
        where: {
          tenantId_programId_code: {
            tenantId: IDS.tenant,
            programId: IDS.loyaltyProgram,
            code: "STANDARD",
          },
        },
        update: { active: true },
        create: {
          id: IDS.redemptionRule,
          tenantId: IDS.tenant,
          programId: IDS.loyaltyProgram,
          code: "STANDARD",
          name: "Échange standard",
          minimumPoints: 100,
          incrementPoints: 50,
          active: true,
        },
      });

      await transaction.programMerchant.upsert({
        where: {
          tenantId_programId_merchantId: {
            tenantId: IDS.tenant,
            programId: IDS.loyaltyProgram,
            merchantId: IDS.merchant,
          },
        },
        update: {},
        create: {
          tenantId: IDS.tenant,
          programId: IDS.loyaltyProgram,
          merchantId: IDS.merchant,
          organizationId: IDS.organization,
        },
      });

      await transaction.programBranch.upsert({
        where: {
          tenantId_programId_branchId: {
            tenantId: IDS.tenant,
            programId: IDS.loyaltyProgram,
            branchId: IDS.branch,
          },
        },
        update: {},
        create: {
          tenantId: IDS.tenant,
          programId: IDS.loyaltyProgram,
          branchId: IDS.branch,
          organizationId: IDS.organization,
          merchantId: IDS.merchant,
        },
      });

      for (let sequence = 1; sequence <= customerSequence; sequence += 1) {
        const customerPoints = 250 + ((sequence * 175) % 2_500);
        await transaction.pointsLedgerEntry.upsert({
          where: {
            tenantId_idempotencyKey: {
              tenantId: IDS.tenant,
              idempotencyKey: `seed:customer-balance:${sequence}`,
            },
          },
          update: {},
          create: {
            id: demoUuid(900 + sequence),
            tenantId: IDS.tenant,
            organizationId: IDS.organization,
            programId: IDS.loyaltyProgram,
            customerId: demoUuid(300 + sequence),
            merchantId: IDS.merchant,
            branchId: IDS.branch,
            type: PointsEntryType.EARN,
            points: customerPoints,
            idempotencyKey: `seed:customer-balance:${sequence}`,
            referenceType: "purchase",
            referenceId: `DEMO-PURCHASE-${String(sequence).padStart(4, "0")}`,
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1_000),
            metadata: {
              amountMinor: 1_500 + sequence * 95,
              currency: "TND",
              source: "qr-check-in",
            },
            createdAt: daysAgo(sequence % 28),
            createdByUserId: IDS.user,
          },
        });
      }

      await transaction.rewardCategory.upsert({
        where: {
          tenantId_code: {
            tenantId: IDS.tenant,
            code: "DEMO-EXPERIENCES",
          },
        },
        update: { name: "Expériences" },
        create: {
          id: IDS.rewardCategory,
          tenantId: IDS.tenant,
          organizationId: IDS.organization,
          code: "DEMO-EXPERIENCES",
          name: "Expériences",
          description: "Récompenses de démonstration",
        },
      });

      await transaction.reward.upsert({
        where: {
          tenantId_code: {
            tenantId: IDS.tenant,
            code: "DEMO-COFFEE",
          },
        },
        update: {
          status: RewardStatus.ACTIVE,
          stockQuantity: 100,
        },
        create: {
          id: IDS.reward,
          tenantId: IDS.tenant,
          organizationId: IDS.organization,
          programId: IDS.loyaltyProgram,
          categoryId: IDS.rewardCategory,
          code: "DEMO-COFFEE",
          name: "Café offert",
          description: "Un café offert dans le point de vente Demo Tunis",
          status: RewardStatus.ACTIVE,
          pointsCost: 500,
          stockQuantity: 100,
          appliesToAllMerchants: false,
          appliesToAllBranches: false,
          startsAt: new Date(),
        },
      });

      const demoRewardCatalog = [
        {
          id: demoUuid(710),
          code: "DEMO-DISCOUNT-10",
          name: "10 % de remise",
          description: "Une remise de 10 % sur le prochain achat éligible.",
          pointsCost: 750,
          stockQuantity: null,
          unlimitedStock: true,
          eligibilityRules: { minimumPurchaseMinor: 2_000, currency: "TND" },
        },
        {
          id: demoUuid(711),
          code: "DEMO-PASTRY",
          name: "Pâtisserie du jour",
          description: "Une pâtisserie artisanale au choix avec une boisson.",
          pointsCost: 650,
          stockQuantity: 80,
          unlimitedStock: false,
          eligibilityRules: { weekdays: ["MON", "TUE", "WED", "THU", "FRI"] },
        },
        {
          id: demoUuid(712),
          code: "DEMO-BRUNCH-DUO",
          name: "Brunch duo",
          description: "Formule brunch complète pour deux personnes.",
          pointsCost: 1_800,
          stockQuantity: 24,
          unlimitedStock: false,
          eligibilityRules: { tier: ["SILVER", "GOLD"] },
        },
        {
          id: demoUuid(713),
          code: "DEMO-SPA-30",
          name: "Soin bien-être 30 min",
          description: "Une séance découverte dans un espace Jasmin Spa partenaire.",
          pointsCost: 3_500,
          stockQuantity: 12,
          unlimitedStock: false,
          eligibilityRules: { reservationRequired: true },
        },
        {
          id: demoUuid(714),
          code: "DEMO-FIT-DAY",
          name: "Pass fitness journée",
          description: "Accès d'une journée aux espaces Atlas Fit participants.",
          pointsCost: 2_200,
          stockQuantity: 40,
          unlimitedStock: false,
          eligibilityRules: { minimumAge: 16 },
        },
        {
          id: demoUuid(715),
          code: "DEMO-DELIVERY",
          name: "Livraison offerte",
          description: "Frais de livraison offerts sur une commande Medina Market.",
          pointsCost: 400,
          stockQuantity: null,
          unlimitedStock: true,
          eligibilityRules: { minimumPurchaseMinor: 3_500, currency: "TND" },
        },
        {
          id: demoUuid(716),
          code: "DEMO-BIRTHDAY",
          name: "Surprise anniversaire",
          description: "Un cadeau personnalisé disponible pendant le mois d'anniversaire.",
          pointsCost: 1_200,
          stockQuantity: 60,
          unlimitedStock: false,
          eligibilityRules: { birthdayMonthOnly: true },
        },
      ] as const;
      for (const reward of demoRewardCatalog) {
        await transaction.reward.upsert({
          where: { tenantId_code: { tenantId: IDS.tenant, code: reward.code } },
          update: {
            name: reward.name,
            description: reward.description,
            pointsCost: reward.pointsCost,
            stockQuantity: reward.stockQuantity,
            unlimitedStock: reward.unlimitedStock,
            eligibilityRules: reward.eligibilityRules,
            status: RewardStatus.ACTIVE,
          },
          create: {
            ...reward,
            tenantId: IDS.tenant,
            organizationId: IDS.organization,
            programId: IDS.loyaltyProgram,
            categoryId: IDS.rewardCategory,
            status: RewardStatus.ACTIVE,
            appliesToAllMerchants: true,
            appliesToAllBranches: true,
            startsAt: daysAgo(30),
            endsAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1_000),
          },
        });
      }

      const demoGames = [
        {
          id: demoUuid(730),
          code: "SPIN_WHEEL",
          type: "SPIN_WHEEL" as const,
          name: "Roue des cadeaux",
          description: "Tournez la roue et gagnez des points ou une récompense immédiate.",
          cooldownMinutes: 5,
          prizes: [
            {
              code: "SPIN-10",
              label: "+10 points",
              type: "POINTS" as const,
              points: 10,
              weight: 30,
              color: "#2563eb",
            },
            {
              code: "SPIN-50",
              label: "+50 points",
              type: "POINTS" as const,
              points: 50,
              weight: 22,
              color: "#16a34a",
            },
            {
              code: "SPIN-100",
              label: "+100 points",
              type: "POINTS" as const,
              points: 100,
              weight: 10,
              color: "#dc2626",
            },
            {
              code: "SPIN-COFFEE",
              label: "Café offert",
              type: "REWARD" as const,
              points: 0,
              weight: 8,
              color: "#f59e0b",
              rewardId: IDS.reward,
            },
            {
              code: "SPIN-AGAIN",
              label: "Retentez demain",
              type: "TRY_AGAIN" as const,
              points: 0,
              weight: 30,
              color: "#64748b",
            },
          ],
        },
        {
          id: demoUuid(731),
          code: "SCRATCH_CARD",
          type: "SCRATCH_CARD" as const,
          name: "Grattez & Gagnez",
          description: "Grattez la carte pour révéler des points, un cadeau ou une remise.",
          cooldownMinutes: 5,
          prizes: [
            {
              code: "SCRATCH-15",
              label: "+15 points",
              type: "POINTS" as const,
              points: 15,
              weight: 34,
              color: "#0ea5e9",
            },
            {
              code: "SCRATCH-75",
              label: "+75 points",
              type: "POINTS" as const,
              points: 75,
              weight: 20,
              color: "#22c55e",
            },
            {
              code: "SCRATCH-DISCOUNT",
              label: "10 % de remise",
              type: "DISCOUNT" as const,
              points: 0,
              weight: 12,
              color: "#e11d48",
              rewardId: demoUuid(710),
              discountPercent: 10,
            },
            {
              code: "SCRATCH-AGAIN",
              label: "Retentez demain",
              type: "TRY_AGAIN" as const,
              points: 0,
              weight: 34,
              color: "#64748b",
            },
          ],
        },
        {
          id: demoUuid(732),
          code: "MYSTERY_BOX",
          type: "MYSTERY_BOX" as const,
          name: "Coffre mystère",
          description: "Ouvrez le coffre pour découvrir une surprise réservée aux membres.",
          cooldownMinutes: 10,
          prizes: [
            {
              code: "BOX-25",
              label: "+25 points",
              type: "POINTS" as const,
              points: 25,
              weight: 36,
              color: "#7c3aed",
            },
            {
              code: "BOX-150",
              label: "+150 points",
              type: "POINTS" as const,
              points: 150,
              weight: 10,
              color: "#f97316",
            },
            {
              code: "BOX-DELIVERY",
              label: "Livraison offerte",
              type: "REWARD" as const,
              points: 0,
              weight: 14,
              color: "#0891b2",
              rewardId: demoUuid(715),
            },
            {
              code: "BOX-AGAIN",
              label: "Coffre vide",
              type: "TRY_AGAIN" as const,
              points: 0,
              weight: 40,
              color: "#64748b",
            },
          ],
        },
      ] as const;

      for (const definition of demoGames) {
        const game = await transaction.gameConfiguration.upsert({
          where: { tenantId_code: { tenantId: IDS.tenant, code: definition.code } },
          update: {
            type: definition.type,
            name: definition.name,
            description: definition.description,
            programId: IDS.loyaltyProgram,
            organizationId: IDS.organization,
            status: "ACTIVE",
            cooldownMinutes: definition.cooldownMinutes,
            dailyLimit: 1,
          },
          create: {
            id: definition.id,
            tenantId: IDS.tenant,
            organizationId: IDS.organization,
            programId: IDS.loyaltyProgram,
            code: definition.code,
            type: definition.type,
            name: definition.name,
            description: definition.description,
            status: "ACTIVE",
            cooldownMinutes: definition.cooldownMinutes,
            dailyLimit: 1,
          },
        });
        for (const prize of definition.prizes) {
          await transaction.gamePrize.upsert({
            where: {
              tenantId_gameId_code: { tenantId: IDS.tenant, gameId: game.id, code: prize.code },
            },
            update: {
              label: prize.label,
              type: prize.type,
              points: prize.points,
              probabilityWeight: prize.weight,
              color: prize.color,
              active: true,
              rewardId: "rewardId" in prize ? prize.rewardId : null,
              discountPercent: "discountPercent" in prize ? prize.discountPercent : null,
            },
            create: {
              tenantId: IDS.tenant,
              gameId: game.id,
              code: prize.code,
              label: prize.label,
              type: prize.type,
              points: prize.points,
              probabilityWeight: prize.weight,
              color: prize.color,
              active: true,
              ...("rewardId" in prize ? { rewardId: prize.rewardId } : {}),
              ...("discountPercent" in prize ? { discountPercent: prize.discountPercent } : {}),
            },
          });
        }
      }

      await transaction.rewardMerchant.upsert({
        where: {
          tenantId_rewardId_merchantId: {
            tenantId: IDS.tenant,
            rewardId: IDS.reward,
            merchantId: IDS.merchant,
          },
        },
        update: {},
        create: {
          tenantId: IDS.tenant,
          rewardId: IDS.reward,
          merchantId: IDS.merchant,
          organizationId: IDS.organization,
        },
      });

      await transaction.rewardBranch.upsert({
        where: {
          tenantId_rewardId_branchId: {
            tenantId: IDS.tenant,
            rewardId: IDS.reward,
            branchId: IDS.branch,
          },
        },
        update: {},
        create: {
          tenantId: IDS.tenant,
          rewardId: IDS.reward,
          branchId: IDS.branch,
          organizationId: IDS.organization,
          merchantId: IDS.merchant,
        },
      });

      const openingPoints = await transaction.pointsLedgerEntry.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: IDS.tenant,
            idempotencyKey: "seed:opening-points",
          },
        },
      });
      if (!openingPoints) {
        await transaction.pointsLedgerEntry.create({
          data: {
            id: IDS.openingPoints,
            tenantId: IDS.tenant,
            organizationId: IDS.organization,
            programId: IDS.loyaltyProgram,
            customerId: IDS.customer,
            merchantId: IDS.merchant,
            branchId: IDS.branch,
            type: PointsEntryType.EARN,
            points: 1_500,
            idempotencyKey: "seed:opening-points",
            referenceType: "seed",
            referenceId: "phase-5",
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1_000),
            metadata: { reason: "Phase 5 demo opening balance" },
            createdByUserId: IDS.user,
          },
        });
        await transaction.customerActivity.create({
          data: {
            tenantId: IDS.tenant,
            customerId: IDS.customer,
            type: "points.earned",
            referenceId: IDS.openingPoints,
            metadata: { points: 1_500, source: "seed" },
          },
        });
      }

      await transaction.gamificationConfig.upsert({
        where: { tenantId: IDS.tenant },
        update: {
          active: true,
          defaultTimezone: "Africa/Tunis",
          allowManualCorrection: true,
        },
        create: {
          id: IDS.gamificationConfig,
          tenantId: IDS.tenant,
          active: true,
          defaultTimezone: "Africa/Tunis",
          allowManualCorrection: true,
          settings: {
            eventProcessing: "bullmq-outbox",
            celebrationStates: true,
          },
        },
      });

      for (const level of [
        {
          id: IDS.bronzeLevel,
          code: "BRONZE",
          name: "Bronze",
          level: 1,
          xpThreshold: 0,
          benefits: { badgeColor: "#C07A48" },
        },
        {
          id: IDS.silverLevel,
          code: "SILVER",
          name: "Silver",
          level: 2,
          xpThreshold: 1_000,
          benefits: { rewardMultiplier: 1.05 },
        },
        {
          id: IDS.goldLevel,
          code: "GOLD",
          name: "Gold",
          level: 3,
          xpThreshold: 3_000,
          benefits: { rewardMultiplier: 1.1, prioritySupport: true },
        },
      ]) {
        await transaction.levelDefinition.upsert({
          where: { tenantId_code: { tenantId: IDS.tenant, code: level.code } },
          update: {
            name: level.name,
            level: level.level,
            xpThreshold: level.xpThreshold,
            status: GamificationStatus.ACTIVE,
            benefits: level.benefits,
          },
          create: {
            tenantId: IDS.tenant,
            status: GamificationStatus.ACTIVE,
            ...level,
          },
        });
      }

      await transaction.xpRule.upsert({
        where: {
          tenantId_code: {
            tenantId: IDS.tenant,
            code: "POINTS-EARNED",
          },
        },
        update: { status: GamificationStatus.ACTIVE, xp: 25 },
        create: {
          id: IDS.xpRule,
          tenantId: IDS.tenant,
          organizationId: IDS.organization,
          code: "POINTS-EARNED",
          name: "Points gagnés",
          description: "Attribue de l'XP après une transaction de points validée",
          eventType: "loyalty.points.posted.v1",
          xp: 25,
          status: GamificationStatus.ACTIVE,
          conditions: { positivePointsOnly: true },
        },
      });

      const openingXp = await transaction.xpLedgerEntry.findUnique({
        where: {
          tenantId_idempotencyKey: {
            tenantId: IDS.tenant,
            idempotencyKey: "seed:opening-xp",
          },
        },
      });
      if (!openingXp) {
        await transaction.xpLedgerEntry.create({
          data: {
            id: IDS.openingXp,
            tenantId: IDS.tenant,
            organizationId: IDS.organization,
            customerId: IDS.customer,
            type: XpEntryType.AWARD,
            xp: 500,
            idempotencyKey: "seed:opening-xp",
            referenceType: "seed",
            referenceId: "phase-6",
            metadata: { reason: "Phase 6 demo opening XP" },
            createdByUserId: IDS.user,
          },
        });
      }
      await transaction.customerGamificationProfile.upsert({
        where: {
          tenantId_customerId: {
            tenantId: IDS.tenant,
            customerId: IDS.customer,
          },
        },
        update: {
          totalXp: 500,
          currentLevelId: IDS.bronzeLevel,
        },
        create: {
          id: IDS.gamificationProfile,
          tenantId: IDS.tenant,
          organizationId: IDS.organization,
          customerId: IDS.customer,
          totalXp: 500,
          currentLevelId: IDS.bronzeLevel,
          leaderboardAlias: "Amira B.",
        },
      });

      await transaction.badgeCategory.upsert({
        where: {
          tenantId_code: {
            tenantId: IDS.tenant,
            code: "ENGAGEMENT",
          },
        },
        update: { name: "Engagement" },
        create: {
          id: IDS.badgeCategory,
          tenantId: IDS.tenant,
          organizationId: IDS.organization,
          code: "ENGAGEMENT",
          name: "Engagement",
          description: "Badges récompensant la fidélité et la régularité",
        },
      });

      for (const badge of [
        {
          id: IDS.firstBadge,
          code: "FIRST-ACTION",
          name: "Premier pas",
          description: "Première activité fidélité validée",
          rarity: BadgeRarity.COMMON,
        },
        {
          id: IDS.streakBadge,
          code: "STREAK-7",
          name: "Semaine parfaite",
          description: "Sept jours consécutifs",
          rarity: BadgeRarity.RARE,
        },
      ]) {
        await transaction.badge.upsert({
          where: { tenantId_code: { tenantId: IDS.tenant, code: badge.code } },
          update: {
            name: badge.name,
            status: GamificationStatus.ACTIVE,
            rarity: badge.rarity,
          },
          create: {
            tenantId: IDS.tenant,
            organizationId: IDS.organization,
            categoryId: IDS.badgeCategory,
            visibility: BadgeVisibility.VISIBLE,
            status: GamificationStatus.ACTIVE,
            ...badge,
          },
        });
      }

      await transaction.achievementRule.upsert({
        where: {
          tenantId_code: {
            tenantId: IDS.tenant,
            code: "FIRST-POINTS-EVENT",
          },
        },
        update: { status: GamificationStatus.ACTIVE },
        create: {
          id: IDS.achievementRule,
          tenantId: IDS.tenant,
          badgeId: IDS.firstBadge,
          code: "FIRST-POINTS-EVENT",
          eventType: "loyalty.points.posted.v1",
          target: 1,
          status: GamificationStatus.ACTIVE,
        },
      });

      const challengeStart = new Date(Date.now() - 24 * 60 * 60 * 1_000);
      const challengeEnd = new Date(Date.now() + 90 * 24 * 60 * 60 * 1_000);
      await transaction.challenge.upsert({
        where: {
          tenantId_code: {
            tenantId: IDS.tenant,
            code: "VISIT-5",
          },
        },
        update: {
          status: ChallengeStatus.ACTIVE,
          startAt: challengeStart,
          endAt: challengeEnd,
        },
        create: {
          id: IDS.challenge,
          tenantId: IDS.tenant,
          organizationId: IDS.organization,
          code: "VISIT-5",
          name: "Explorateur Rabbehni",
          description: "Réaliser cinq transactions QR",
          type: ChallengeType.INDIVIDUAL,
          cadence: ChallengeCadence.RECURRING,
          status: ChallengeStatus.ACTIVE,
          validationMode: ChallengeValidation.AUTOMATIC,
          objectiveType: "loyalty.qr.completed.v1",
          target: 5,
          startAt: challengeStart,
          endAt: challengeEnd,
          autoEnroll: true,
        },
      });
      await transaction.challengeApplicability.upsert({
        where: {
          tenantId_challengeId_scope_targetId: {
            tenantId: IDS.tenant,
            challengeId: IDS.challenge,
            scope: LeaderboardScope.ORGANIZATION,
            targetId: IDS.organization,
          },
        },
        update: {},
        create: {
          tenantId: IDS.tenant,
          challengeId: IDS.challenge,
          scope: LeaderboardScope.ORGANIZATION,
          targetId: IDS.organization,
        },
      });
      await transaction.challengeReward.upsert({
        where: { id: IDS.challengeRewardXp },
        update: { amount: 250 },
        create: {
          id: IDS.challengeRewardXp,
          tenantId: IDS.tenant,
          challengeId: IDS.challenge,
          type: ChallengeRewardType.XP,
          amount: 250,
        },
      });
      await transaction.challengeReward.upsert({
        where: { id: IDS.challengeRewardBadge },
        update: { badgeId: IDS.firstBadge },
        create: {
          id: IDS.challengeRewardBadge,
          tenantId: IDS.tenant,
          challengeId: IDS.challenge,
          type: ChallengeRewardType.BADGE,
          badgeId: IDS.firstBadge,
        },
      });
      await transaction.challengeEnrollment.upsert({
        where: {
          tenantId_challengeId_customerId: {
            tenantId: IDS.tenant,
            challengeId: IDS.challenge,
            customerId: IDS.customer,
          },
        },
        update: {},
        create: {
          id: IDS.challengeEnrollment,
          tenantId: IDS.tenant,
          challengeId: IDS.challenge,
          customerId: IDS.customer,
        },
      });

      await transaction.habit.upsert({
        where: {
          tenantId_code: {
            tenantId: IDS.tenant,
            code: "DAILY-CHECKIN",
          },
        },
        update: { status: GamificationStatus.ACTIVE },
        create: {
          id: IDS.habit,
          tenantId: IDS.tenant,
          organizationId: IDS.organization,
          code: "DAILY-CHECKIN",
          name: "Visite quotidienne",
          description: "Une activité QR par jour",
          cadence: HabitCadence.DAILY,
          status: GamificationStatus.ACTIVE,
          objectiveType: "loyalty.qr.completed.v1",
          target: 1,
          timezone: "Africa/Tunis",
          graceDays: 1,
          freezeAllowance: 2,
        },
      });
      await transaction.habitMilestone.upsert({
        where: {
          tenantId_habitId_streakThreshold: {
            tenantId: IDS.tenant,
            habitId: IDS.habit,
            streakThreshold: 7,
          },
        },
        update: { badgeId: IDS.streakBadge },
        create: {
          id: IDS.habitMilestone,
          tenantId: IDS.tenant,
          habitId: IDS.habit,
          streakThreshold: 7,
          rewardType: ChallengeRewardType.BADGE,
          badgeId: IDS.streakBadge,
        },
      });
      await transaction.customerHabit.upsert({
        where: {
          tenantId_habitId_customerId: {
            tenantId: IDS.tenant,
            habitId: IDS.habit,
            customerId: IDS.customer,
          },
        },
        update: { active: true },
        create: {
          id: IDS.customerHabit,
          tenantId: IDS.tenant,
          habitId: IDS.habit,
          customerId: IDS.customer,
          freezesRemaining: 2,
        },
      });

      await transaction.streakRule.upsert({
        where: {
          tenantId_code: {
            tenantId: IDS.tenant,
            code: "QR-ACTIVITY",
          },
        },
        update: { status: GamificationStatus.ACTIVE },
        create: {
          id: IDS.streakRule,
          tenantId: IDS.tenant,
          organizationId: IDS.organization,
          code: "QR-ACTIVITY",
          name: "Série de visites QR",
          qualifyingEvent: "loyalty.qr.completed.v1",
          status: GamificationStatus.ACTIVE,
          timezone: "Africa/Tunis",
          graceDays: 1,
          freezeAllowance: 2,
        },
      });

      await transaction.leaderboardConfig.upsert({
        where: {
          tenantId_code: {
            tenantId: IDS.tenant,
            code: "MONTHLY-XP",
          },
        },
        update: { status: GamificationStatus.ACTIVE },
        create: {
          id: IDS.leaderboard,
          tenantId: IDS.tenant,
          code: "MONTHLY-XP",
          name: "Classement XP mensuel",
          scope: LeaderboardScope.ORGANIZATION,
          scopeId: IDS.organization,
          period: LeaderboardPeriod.MONTHLY,
          metric: LeaderboardMetric.XP,
          status: GamificationStatus.ACTIVE,
          maxEntries: 100,
          anonymizeOptedOut: true,
          schedule: "0 * * * *",
        },
      });

      await transaction.customerSegment.upsert({
        where: {
          tenantId_code: {
            tenantId: IDS.tenant,
            code: "ENGAGED-CUSTOMERS",
          },
        },
        update: {
          status: MarketingStatus.ACTIVE,
          rules: {
            combinator: "AND",
            conditions: [
              { field: "profile.status", operator: "EQ", value: "ACTIVE" },
              { field: "loyalty.balance", operator: "GTE", value: 100 },
            ],
          },
        },
        create: {
          id: IDS.segment,
          tenantId: IDS.tenant,
          organizationId: IDS.organization,
          code: "ENGAGED-CUSTOMERS",
          name: "Clients engagés",
          description: "Clients actifs avec un solde de fidélité significatif",
          type: SegmentType.DYNAMIC,
          status: MarketingStatus.ACTIVE,
          timezone: "Africa/Tunis",
          schedule: "0 */6 * * *",
          estimatedSize: 1,
          lastRefreshedAt: new Date(),
          rules: {
            combinator: "AND",
            conditions: [
              { field: "profile.status", operator: "EQ", value: "ACTIVE" },
              { field: "loyalty.balance", operator: "GTE", value: 100 },
            ],
          },
        },
      });
      await transaction.segmentMembership.upsert({
        where: {
          tenantId_segmentId_customerId: {
            tenantId: IDS.tenant,
            segmentId: IDS.segment,
            customerId: IDS.customer,
          },
        },
        update: { source: "SEED" },
        create: {
          id: IDS.segmentMembership,
          tenantId: IDS.tenant,
          segmentId: IDS.segment,
          customerId: IDS.customer,
          source: "SEED",
        },
      });

      await transaction.campaign.upsert({
        where: {
          tenantId_code: {
            tenantId: IDS.tenant,
            code: "WELCOME-LOYALTY",
          },
        },
        update: { status: CampaignStatus.DRAFT },
        create: {
          id: IDS.campaign,
          tenantId: IDS.tenant,
          organizationId: IDS.organization,
          code: "WELCOME-LOYALTY",
          name: "Bienvenue fidélité",
          description: "Campagne de démonstration Phase 7",
          type: CampaignType.LOYALTY,
          status: CampaignStatus.DRAFT,
          timezone: "Africa/Tunis",
          frequencyCap: 1,
          frequencyWindowHours: 24,
          requiresApproval: true,
        },
      });
      await transaction.campaignSegment.upsert({
        where: {
          tenantId_campaignId_segmentId: {
            tenantId: IDS.tenant,
            campaignId: IDS.campaign,
            segmentId: IDS.segment,
          },
        },
        update: {},
        create: {
          id: IDS.campaignSegment,
          tenantId: IDS.tenant,
          campaignId: IDS.campaign,
          segmentId: IDS.segment,
        },
      });

      await transaction.notificationTemplate.upsert({
        where: {
          tenantId_code_channel: {
            tenantId: IDS.tenant,
            code: "LOYALTY-UPDATE",
            channel: NotificationChannel.IN_APP,
          },
        },
        update: {
          status: NotificationTemplateStatus.ACTIVE,
          currentVersion: 1,
        },
        create: {
          id: IDS.template,
          tenantId: IDS.tenant,
          organizationId: IDS.organization,
          code: "LOYALTY-UPDATE",
          name: "Mise à jour fidélité",
          channel: NotificationChannel.IN_APP,
          category: NotificationCategory.LOYALTY,
          status: NotificationTemplateStatus.ACTIVE,
          currentVersion: 1,
          branding: {
            brandName: "{{brand.name}}",
            primaryColor: "{{brand.primaryColor}}",
          },
        },
      });
      const loyaltyTemplateVersion = await transaction.notificationTemplateVersion.findUnique({
        where: {
          tenantId_templateId_version_locale: {
            tenantId: IDS.tenant,
            templateId: IDS.template,
            version: 1,
            locale: "fr-TN",
          },
        },
        select: { id: true },
      });
      if (!loyaltyTemplateVersion) {
        await transaction.notificationTemplateVersion.create({
          data: {
            id: IDS.templateVersion,
            tenantId: IDS.tenant,
            templateId: IDS.template,
            version: 1,
            locale: "fr-TN",
            subject: "Votre fidélité évolue",
            body: "Bonjour {{customerName}}, votre activité Rabbehni a été mise à jour.",
            variables: ["customerName"],
            createdById: IDS.user,
          },
        });
      }
      await transaction.notificationTemplate.upsert({
        where: {
          tenantId_code_channel: {
            tenantId: IDS.tenant,
            code: "ANALYTICS-REPORT",
            channel: NotificationChannel.EMAIL,
          },
        },
        update: {
          status: NotificationTemplateStatus.ACTIVE,
          currentVersion: 1,
        },
        create: {
          id: IDS.reportTemplate,
          tenantId: IDS.tenant,
          organizationId: IDS.organization,
          code: "ANALYTICS-REPORT",
          name: "Rapport analytics Rabbehni",
          channel: NotificationChannel.EMAIL,
          category: NotificationCategory.SYSTEM,
          status: NotificationTemplateStatus.ACTIVE,
          currentVersion: 1,
          branding: { brandName: "Rabbehni" },
        },
      });
      const reportTemplateVersion = await transaction.notificationTemplateVersion.findUnique({
        where: {
          tenantId_templateId_version_locale: {
            tenantId: IDS.tenant,
            templateId: IDS.reportTemplate,
            version: 1,
            locale: "fr-TN",
          },
        },
        select: { id: true },
      });
      if (!reportTemplateVersion) {
        await transaction.notificationTemplateVersion.create({
          data: {
            id: IDS.reportTemplateVersion,
            tenantId: IDS.tenant,
            templateId: IDS.reportTemplate,
            version: 1,
            locale: "fr-TN",
            subject: "Votre rapport {{reportName}} est prêt",
            body: "Le rapport {{reportName}} couvrant {{periodStart}} à {{periodEnd}} est disponible.",
            variables: ["reportName", "periodStart", "periodEnd"],
            createdById: IDS.user,
          },
        });
      }

      await transaction.automationWorkflow.upsert({
        where: {
          tenantId_code: {
            tenantId: IDS.tenant,
            code: "LEVEL-UP-NOTIFICATION",
          },
        },
        update: { status: AutomationStatus.ACTIVE },
        create: {
          id: IDS.automation,
          tenantId: IDS.tenant,
          organizationId: IDS.organization,
          code: "LEVEL-UP-NOTIFICATION",
          name: "Notification de niveau",
          description: "Informe le client après un changement de niveau",
          type: AutomationType.EVENT_TRIGGERED,
          status: AutomationStatus.ACTIVE,
          triggerType: "gamification.level-up.v1",
          timezone: "Africa/Tunis",
          maxExecutionsPerCustomer: 100,
        },
      });
      await transaction.automationStep.upsert({
        where: {
          tenantId_workflowId_code: {
            tenantId: IDS.tenant,
            workflowId: IDS.automation,
            code: "NOTIFY",
          },
        },
        update: {
          type: AutomationStepType.NOTIFICATION,
          configuration: { templateId: IDS.template },
        },
        create: {
          id: IDS.automationStep,
          tenantId: IDS.tenant,
          workflowId: IDS.automation,
          code: "NOTIFY",
          name: "Notifier le client",
          position: 1,
          type: AutomationStepType.NOTIFICATION,
          configuration: { templateId: IDS.template },
        },
      });

      await transaction.customerCommunicationPreference.upsert({
        where: {
          tenantId_customerId_channel_category: {
            tenantId: IDS.tenant,
            customerId: IDS.customer,
            channel: NotificationChannel.IN_APP,
            category: NotificationCategory.LOYALTY,
          },
        },
        update: { optedIn: true, timezone: "Africa/Tunis" },
        create: {
          id: IDS.communicationPreference,
          tenantId: IDS.tenant,
          customerId: IDS.customer,
          channel: NotificationChannel.IN_APP,
          category: NotificationCategory.LOYALTY,
          optedIn: true,
          quietHoursStart: "22:00",
          quietHoursEnd: "08:00",
          timezone: "Africa/Tunis",
          consentSource: "seed",
        },
      });
      await transaction.customerCommunicationPreference.upsert({
        where: {
          tenantId_customerId_channel_category: {
            tenantId: IDS.tenant,
            customerId: IDS.customer,
            channel: NotificationChannel.EMAIL,
            category: NotificationCategory.SYSTEM,
          },
        },
        update: { optedIn: true, timezone: "Africa/Tunis" },
        create: {
          id: IDS.reportEmailPreference,
          tenantId: IDS.tenant,
          customerId: IDS.customer,
          channel: NotificationChannel.EMAIL,
          category: NotificationCategory.SYSTEM,
          optedIn: true,
          timezone: "Africa/Tunis",
          consentSource: "seed",
        },
      });
      await transaction.reportDefinition.upsert({
        where: {
          tenantId_code: {
            tenantId: IDS.tenant,
            code: "WEEKLY-OPERATIONS",
          },
        },
        update: {
          active: true,
          timezone: "Africa/Tunis",
        },
        create: {
          id: IDS.reportDefinition,
          tenantId: IDS.tenant,
          organizationId: IDS.organization,
          recipientCustomerId: IDS.customer,
          notificationTemplateId: IDS.reportTemplate,
          code: "WEEKLY-OPERATIONS",
          name: "Synthèse opérationnelle hebdomadaire",
          frequency: ReportFrequency.WEEKLY,
          timezone: "Africa/Tunis",
          filters: { organizationId: IDS.organization },
          metrics: [
            "customer.total",
            "loyalty.points_earned",
            "loyalty.points_redeemed",
            "qr.successful",
            "campaign.sent",
          ],
          active: true,
          retentionDays: 30,
        },
      });

      await transaction.membership.upsert({
        where: {
          tenantId_userId: {
            tenantId: IDS.tenant,
            userId: IDS.user,
          },
        },
        update: { status: MembershipStatus.ACTIVE },
        create: {
          id: IDS.membership,
          tenantId: IDS.tenant,
          organizationId: IDS.organization,
          userId: IDS.user,
          status: MembershipStatus.ACTIVE,
          joinedAt: new Date(),
        },
      });

      await transaction.role.upsert({
        where: {
          tenantId_code: {
            tenantId: IDS.tenant,
            code: "owner",
          },
        },
        update: { system: true },
        create: {
          id: IDS.role,
          tenantId: IDS.tenant,
          code: "owner",
          name: "Owner",
          scope: RoleScope.ORGANIZATION,
          system: true,
        },
      });

      const permissions = await transaction.permission.findMany({
        where: {
          code: { in: PERMISSIONS.map(([code]) => code) },
        },
        select: { id: true },
      });
      await transaction.rolePermission.createMany({
        data: permissions.map(({ id }) => ({
          tenantId: IDS.tenant,
          roleId: IDS.role,
          permissionId: id,
        })),
        skipDuplicates: true,
      });
      await transaction.membershipRole.upsert({
        where: {
          tenantId_membershipId_roleId: {
            tenantId: IDS.tenant,
            membershipId: IDS.membership,
            roleId: IDS.role,
          },
        },
        update: {},
        create: {
          tenantId: IDS.tenant,
          membershipId: IDS.membership,
          roleId: IDS.role,
        },
      });

      await transaction.regionAdministrator.upsert({
        where: {
          tenantId_regionId_userId: {
            tenantId: IDS.tenant,
            regionId: IDS.regionTunisia,
            userId: IDS.user,
          },
        },
        update: {},
        create: {
          id: IDS.regionAdministrator,
          tenantId: IDS.tenant,
          regionId: IDS.regionTunisia,
          userId: IDS.user,
        },
      });

      await transaction.staff.upsert({
        where: { id: IDS.staff },
        update: { status: StaffStatus.ACTIVE },
        create: {
          id: IDS.staff,
          tenantId: IDS.tenant,
          membershipId: IDS.membership,
          userId: IDS.user,
          organizationId: IDS.organization,
          franchiseId: IDS.franchise,
          merchantId: IDS.merchant,
          branchId: IDS.branch,
          employeeCode: "DEMO-OWNER",
          jobTitle: "Owner",
          status: StaffStatus.ACTIVE,
          activatedAt: new Date(),
        },
      });

      await transaction.subscription.upsert({
        where: { id: IDS.subscription },
        update: {
          status: SubscriptionStatus.ACTIVE,
          planId: IDS.plan,
          billingInterval: "MONTHLY",
          cancelAtPeriodEnd: false,
        },
        create: {
          id: IDS.subscription,
          tenantId: IDS.tenant,
          planId: IDS.plan,
          status: SubscriptionStatus.ACTIVE,
          billingInterval: "MONTHLY",
          startsAt: new Date(),
          currentPeriodStartsAt: new Date(),
          currentPeriodEndsAt: new Date(Date.now() + 30 * 86_400_000),
          nextBillingAt: new Date(Date.now() + 30 * 86_400_000),
        },
      });
      await transaction.subscriptionChange.upsert({
        where: {
          tenantId_idempotencyKey: {
            tenantId: IDS.tenant,
            idempotencyKey: "seed:phase9:subscription",
          },
        },
        update: {
          type: "ACTIVATED",
          toPlanId: IDS.plan,
          reason: "Phase 9 demo subscription",
        },
        create: {
          id: IDS.subscriptionChange,
          tenantId: IDS.tenant,
          subscriptionId: IDS.subscription,
          idempotencyKey: "seed:phase9:subscription",
          type: "ACTIVATED",
          toPlanId: IDS.plan,
          reason: "Phase 9 demo subscription",
        },
      });
      await transaction.whiteLabelProfile.upsert({
        where: { tenantId: IDS.tenant },
        update: {
          productName: "Rabbehni",
          primaryColor: "#0F766E",
          secondaryColor: "#2563EB",
          fontFamily: "Inter",
          emailSenderName: "Rabbehni Demo",
          emailReplyTo: "support@demo.rabbehni.local",
          themeMode: "LIGHT",
        },
        create: {
          id: IDS.whiteLabel,
          tenantId: IDS.tenant,
          productName: "Rabbehni",
          primaryColor: "#0F766E",
          secondaryColor: "#2563EB",
          fontFamily: "Inter",
          emailSenderName: "Rabbehni Demo",
          emailReplyTo: "support@demo.rabbehni.local",
          themeMode: "LIGHT",
        },
      });
      await transaction.tenantLocalization.upsert({
        where: { tenantId: IDS.tenant },
        update: {
          defaultLanguage: "fr",
          enabledLanguages: ["fr", "en", "ar"],
          countries: ["TN", "FR", "AE"],
          currencies: ["TND", "EUR", "USD", "AED"],
          timezones: ["Africa/Tunis", "Europe/Paris", "Asia/Dubai"],
          dateFormat: "DD/MM/YYYY",
          timeFormat: "24h",
          numberLocale: "fr-TN",
          direction: "LTR",
        },
        create: {
          id: IDS.localization,
          tenantId: IDS.tenant,
          defaultLanguage: "fr",
          enabledLanguages: ["fr", "en", "ar"],
          countries: ["TN", "FR", "AE"],
          currencies: ["TND", "EUR", "USD", "AED"],
          timezones: ["Africa/Tunis", "Europe/Paris", "Asia/Dubai"],
          dateFormat: "DD/MM/YYYY",
          timeFormat: "24h",
          numberLocale: "fr-TN",
          direction: "LTR",
        },
      });

      await transaction.tenantSetting.upsert({
        where: {
          tenantId_namespace_key: {
            tenantId: IDS.tenant,
            namespace: "platform",
            key: "locale",
          },
        },
        update: {
          value: { primary: "fr-TN", supported: ["fr-TN", "ar-TN", "en"] },
        },
        create: {
          id: IDS.setting,
          tenantId: IDS.tenant,
          namespace: "platform",
          key: "locale",
          value: { primary: "fr-TN", supported: ["fr-TN", "ar-TN", "en"] },
          updatedById: IDS.user,
        },
      });
      await transaction.tenantSetting.upsert({
        where: {
          tenantId_namespace_key: {
            tenantId: IDS.tenant,
            namespace: "notifications",
            key: "daily_quota",
          },
        },
        update: { value: { value: 10_000 } },
        create: {
          id: IDS.notificationQuotaSetting,
          tenantId: IDS.tenant,
          namespace: "notifications",
          key: "daily_quota",
          value: { value: 10_000 },
          updatedById: IDS.user,
        },
      });
    });
  } finally {
    await prisma.$disconnect();
  }
}

await seed();
