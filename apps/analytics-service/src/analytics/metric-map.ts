import type { CanonicalEventInput } from "./analytics.schemas.js";

const directMetrics: Readonly<Record<string, readonly string[]>> = {
  "customers.customer.created.v1": ["customers.new", "customers.total"],
  "loyalty.points.reversed.v1": ["loyalty.points_reversed"],
  "rewards.redemption.completed.v1": ["rewards.redemptions", "rewards.stock_consumption"],
  "qr.transaction.succeeded.v1": ["qr.scans", "qr.successful"],
  "qr.transaction.rejected.v1": ["qr.scans", "qr.rejected"],
  "gamification.xp.awarded.v1": ["gamification.xp_earned"],
  "gamification.level.reached.v1": ["gamification.level_reached"],
  "gamification.challenge.enrolled.v1": ["gamification.challenge_enrollment"],
  "gamification.challenge.completed.v1": ["gamification.challenge_completion"],
  "gamification.habit.completed.v1": ["gamification.habit_completion"],
  "gamification.badge.earned.v1": ["gamification.badges_earned"],
  "gamification.leaderboard.snapshot-generated.v1": ["gamification.leaderboard_participation"],
  "marketing.notification.queued.v1": ["campaign.queued"],
  "marketing.notification.sent.v1": ["campaign.sent"],
  "marketing.notification.failed.v1": ["campaign.failed"],
  "marketing.automation.step-executed.v1": ["automation.steps_completed"],
  "marketing.campaign.started.v1": ["campaign.started"],
  "marketing.campaign.completed.v1": ["campaign.completed"],
};

export function metricKeys(event: CanonicalEventInput): readonly string[] {
  if (event.eventType.startsWith("metric.")) return [event.eventType.slice("metric.".length)];
  if (event.eventType === "loyalty.points.posted.v1") {
    const type = String(event.metadata.pointsType ?? "").toLowerCase();
    if (type === "earn") return ["loyalty.points_earned"];
    if (type === "redeem") return ["loyalty.points_redeemed"];
    if (type === "expire") return ["loyalty.points_expired"];
    if (type === "adjust") return ["loyalty.points_adjusted"];
    if (type === "reverse") return ["loyalty.points_reversed"];
  }
  if (event.eventType === "qr.transaction.rejected.v1") {
    const reason = String(event.metadata.failureReason ?? "").toLowerCase();
    const purpose = String(event.metadata.purpose ?? "").toLowerCase();
    return [
      "qr.scans",
      "qr.rejected",
      ...(reason.includes("replay") ? ["qr.replay_attempts"] : []),
      ...(reason.includes("expir") ? ["qr.expired"] : []),
      ...(purpose.includes("earn") ? ["qr.earn_usage"] : []),
      ...(purpose.includes("redeem") ? ["qr.redemption_usage"] : []),
    ];
  }
  return directMetrics[event.eventType] ?? ["system.events"];
}
