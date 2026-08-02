import { notFound } from "next/navigation";

import { ManagementResourceScreen, type ManagementResource } from "../../management-resource";
import { Phase5ResourceScreen, type Phase5Resource } from "../../phase5-resource";
import { Phase6ResourceScreen, type Phase6Resource } from "../../phase6-resource";
import { Phase7ResourceScreen, type Phase7Resource } from "../../phase7-resource";
import { Phase8ResourceScreen, type Phase8Resource } from "../../phase8-resource";
import { Phase9ResourceScreen, type Phase9Resource } from "../../phase9-resource";

const resources = new Set<ManagementResource>([
  "organizations",
  "franchises",
  "merchants",
  "branches",
  "staff",
]);
const phase5Resources = new Set<Phase5Resource>([
  "customers",
  "loyalty",
  "points",
  "rewards",
  "qr",
  "visits",
]);
const phase6Resources = new Set<Phase6Resource>([
  "games",
  "gamification",
  "challenges",
  "habits",
  "badges",
  "leaderboards",
  "customer-gamification",
]);
const phase7Resources = new Set<Phase7Resource>([
  "segments",
  "campaigns",
  "automations",
  "notification-templates",
  "notification-deliveries",
  "communication-preferences",
  "campaign-metrics",
]);
const phase8Resources = new Set<Phase8Resource>(["analytics", "reports"]);
const phase9Resources = new Set<Phase9Resource>([
  "audit",
  "billing",
  "localization",
  "regions",
  "plans",
  "subscriptions",
  "system",
  "tenants",
  "white-label",
]);

export default async function AdminManagementPage({
  params,
}: Readonly<{ params: Promise<{ resource: string; segments?: string[] }> }>) {
  const { resource, segments = [] } = await params;
  if (
    (!resources.has(resource as ManagementResource) &&
      !phase5Resources.has(resource as Phase5Resource) &&
      !phase6Resources.has(resource as Phase6Resource) &&
      !phase7Resources.has(resource as Phase7Resource) &&
      !phase8Resources.has(resource as Phase8Resource) &&
      !phase9Resources.has(resource as Phase9Resource)) ||
    segments.length > 1
  )
    notFound();
  const segment = segments[0];
  if (phase9Resources.has(resource as Phase9Resource)) {
    if (segment) notFound();
    return <Phase9ResourceScreen resource={resource as Phase9Resource} />;
  }
  if (phase8Resources.has(resource as Phase8Resource)) {
    if (segment) notFound();
    return <Phase8ResourceScreen resource={resource as Phase8Resource} />;
  }
  if (phase5Resources.has(resource as Phase5Resource)) {
    return (
      <Phase5ResourceScreen
        resource={resource as Phase5Resource}
        mode={!segment ? "list" : segment === "new" ? "new" : "detail"}
        {...(segment && segment !== "new" ? { id: segment } : {})}
      />
    );
  }
  if (phase6Resources.has(resource as Phase6Resource)) {
    return (
      <Phase6ResourceScreen
        resource={resource as Phase6Resource}
        mode={!segment ? "list" : segment === "new" ? "new" : "detail"}
        {...(segment && segment !== "new" ? { id: segment } : {})}
      />
    );
  }
  if (phase7Resources.has(resource as Phase7Resource)) {
    return (
      <Phase7ResourceScreen
        resource={resource as Phase7Resource}
        mode={!segment ? "list" : segment === "new" ? "new" : "detail"}
        {...(segment && segment !== "new" ? { id: segment } : {})}
      />
    );
  }
  return (
    <ManagementResourceScreen
      resource={resource as ManagementResource}
      mode={!segment ? "list" : segment === "new" ? "new" : "detail"}
      {...(segment && segment !== "new" ? { id: segment } : {})}
    />
  );
}
