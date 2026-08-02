import { BullModule } from "@nestjs/bullmq";
import { Module } from "@nestjs/common";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { CacheModule } from "@rabbehni/cache/nest";
import { parseApiEnvironment } from "@rabbehni/config";
import { DatabaseModule } from "@rabbehni/database/nest";
import { createLoggerHttpOptions } from "@rabbehni/logger";
import { redisConnectionOptions } from "@rabbehni/queue";
import { LoggerModule } from "nestjs-pino";

import { AuditModule } from "./audit/audit.module.js";
import { AnalyticsModule } from "./analytics/analytics.module.js";
import { AutomationsModule } from "./automations/automations.module.js";
import { AuthModule } from "./auth/auth.module.js";
import { BranchesModule } from "./branches/branches.module.js";
import { BadgesModule } from "./badges/badges.module.js";
import { ChallengesModule } from "./challenges/challenges.module.js";
import { CustomersModule } from "./customers/customers.module.js";
import { CampaignsModule } from "./campaigns/campaigns.module.js";
import { FranchisesModule } from "./franchises/franchises.module.js";
import { HealthModule } from "./health/health.module.js";
import { GamificationEventsModule } from "./gamification-events/gamification-events.module.js";
import { GamificationModule } from "./gamification/gamification.module.js";
import { GamesModule } from "./games/games.module.js";
import { HabitsModule } from "./habits/habits.module.js";
import { IdentityModule } from "./identity/identity.module.js";
import { MerchantsModule } from "./merchants/merchants.module.js";
import { MarketingEventsModule } from "./marketing-events/marketing-events.module.js";
import { NotificationsModule } from "./notifications/notifications.module.js";
import { OrganizationsModule } from "./organizations/organizations.module.js";
import { PointsModule } from "./points/points.module.js";
import { QrModule } from "./qr/qr.module.js";
import { RewardsModule } from "./rewards/rewards.module.js";
import { ReportsModule } from "./reports/reports.module.js";
import { RegionsModule } from "./regions/regions.module.js";
import { SegmentsModule } from "./segments/segments.module.js";
import { LoyaltyModule } from "./loyalty/loyalty.module.js";
import { LeaderboardsModule } from "./leaderboards/leaderboards.module.js";
import { StaffModule } from "./staff/staff.module.js";
import { SubscriptionsModule } from "./subscriptions/subscriptions.module.js";
import { SystemController } from "./system.controller.js";
import { TenancyModule } from "./tenancy/tenancy.module.js";
import { VisitsModule } from "./visits/visits.module.js";

@Module({
  imports: [
    ConfigModule.forRoot({
      cache: true,
      isGlobal: true,
      validate: parseApiEnvironment,
    }),
    LoggerModule.forRoot({
      pinoHttp: createLoggerHttpOptions("api"),
    }),
    DatabaseModule,
    CacheModule,
    BullModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        connection: redisConnectionOptions(config.getOrThrow<string>("REDIS_URL")),
        prefix: config.get<string>("BULLMQ_PREFIX", "rabbehni"),
      }),
    }),
    HealthModule,
    AuthModule,
    IdentityModule,
    TenancyModule,
    OrganizationsModule,
    FranchisesModule,
    MerchantsModule,
    BranchesModule,
    StaffModule,
    CustomersModule,
    LoyaltyModule,
    PointsModule,
    RewardsModule,
    QrModule,
    GamificationModule,
    GamesModule,
    BadgesModule,
    ChallengesModule,
    HabitsModule,
    LeaderboardsModule,
    GamificationEventsModule,
    SegmentsModule,
    CampaignsModule,
    NotificationsModule,
    AutomationsModule,
    MarketingEventsModule,
    SubscriptionsModule,
    AuditModule,
    AnalyticsModule,
    ReportsModule,
    RegionsModule,
    VisitsModule,
  ],
  controllers: [SystemController],
})
export class AppModule {}
