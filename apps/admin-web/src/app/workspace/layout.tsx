import { NavigationItem, NavigationSection } from "@rabbehni/design-system/web";
import { WorkspaceShell } from "@rabbehni/design-system/workspace-shell";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function AdminWorkspaceLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  if (!cookieStore.has("rabbehni_session")) redirect("/login");

  return (
    <WorkspaceShell
      identity="admin"
      context="Gérez les entreprises clientes, le réseau, la fidélisation et la facturation."
      navigation={
        <>
          <NavigationSection defaultOpen title="Pilotage">
            <NavigationItem href="/workspace" icon="dashboard">
              Vue d’ensemble
            </NavigationItem>
            <NavigationItem href="/workspace/organizations" icon="organization">
              Organisations
            </NavigationItem>
            <NavigationItem href="/workspace/franchises" icon="franchise">
              Franchises
            </NavigationItem>
            <NavigationItem href="/workspace/merchants" icon="merchant">
              Commerces
            </NavigationItem>
            <NavigationItem href="/workspace/branches" icon="branch">
              Points de vente
            </NavigationItem>
            <NavigationItem href="/workspace/staff" icon="staff">
              Équipe et accès
            </NavigationItem>
          </NavigationSection>
          <NavigationSection title="Fidélisation clients">
            <NavigationItem href="/workspace/customers" icon="customer">
              Clients
            </NavigationItem>
            <NavigationItem href="/workspace/loyalty" icon="reward">
              Fidélité
            </NavigationItem>
            <NavigationItem href="/workspace/points" icon="points">
              Points
            </NavigationItem>
            <NavigationItem href="/workspace/rewards" icon="reward">
              Récompenses
            </NavigationItem>
            <NavigationItem href="/workspace/qr" icon="qr">
              Transactions QR
            </NavigationItem>
            <NavigationItem href="/workspace/visits" icon="location">
              Visites et check-ins
            </NavigationItem>
          </NavigationSection>
          <NavigationSection title="Engagement et marketing">
            <NavigationItem href="/workspace/gamification" icon="gamification">
              Gamification
            </NavigationItem>
            <NavigationItem href="/workspace/games" icon="gamification">
              Jeux instantanés
            </NavigationItem>
            <NavigationItem href="/workspace/challenges" icon="gamification">
              Challenges
            </NavigationItem>
            <NavigationItem href="/workspace/habits" icon="activity">
              Habitudes
            </NavigationItem>
            <NavigationItem href="/workspace/badges" icon="badge">
              Badges
            </NavigationItem>
            <NavigationItem href="/workspace/leaderboards" icon="analytics">
              Classements
            </NavigationItem>
            <NavigationItem href="/workspace/segments" icon="customer">
              Segments
            </NavigationItem>
            <NavigationItem href="/workspace/campaigns" icon="campaign">
              Campagnes
            </NavigationItem>
            <NavigationItem href="/workspace/automations" icon="automation">
              Automatisations
            </NavigationItem>
            <NavigationItem href="/workspace/notification-templates" icon="notification">
              Notifications
            </NavigationItem>
          </NavigationSection>
          <NavigationSection title="Analyse et revenus">
            <NavigationItem href="/workspace/analytics" icon="analytics">
              Analytics et IA
            </NavigationItem>
            <NavigationItem href="/workspace/reports" icon="plan">
              Rapports
            </NavigationItem>
            <NavigationItem href="/workspace/plans" icon="plan">
              Plans
            </NavigationItem>
            <NavigationItem href="/workspace/subscriptions" icon="subscription">
              Abonnements
            </NavigationItem>
            <NavigationItem href="/workspace/billing" icon="billing">
              Facturation
            </NavigationItem>
          </NavigationSection>
          <NavigationSection title="Configuration et contrôle">
            <NavigationItem href="/workspace/tenants" icon="tenant">
              Comptes clients
            </NavigationItem>
            <NavigationItem href="/workspace/white-label" icon="settings">
              Identité visuelle
            </NavigationItem>
            <NavigationItem href="/workspace/localization" icon="localization">
              Langues et devises
            </NavigationItem>
            <NavigationItem href="/workspace/regions" icon="location">
              Pays et régions
            </NavigationItem>
            <NavigationItem href="/workspace/audit" icon="audit">
              Audit
            </NavigationItem>
            <NavigationItem href="/workspace/system" icon="activity">
              État du système
            </NavigationItem>
          </NavigationSection>
        </>
      }
      title="Rabbehni Administration"
    >
      {children}
    </WorkspaceShell>
  );
}
