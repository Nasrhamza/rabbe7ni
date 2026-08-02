import { NavigationItem, NavigationSection } from "@rabbehni/design-system/web";
import { WorkspaceShell } from "@rabbehni/design-system/workspace-shell";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";

export default async function MerchantWorkspaceLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const cookieStore = await cookies();
  if (!cookieStore.has("rabbehni_session")) redirect("/login");

  return (
    <WorkspaceShell
      identity="merchant"
      context="Suivez l’activité du jour, les clients, les points et les récompenses."
      navigation={
        <>
          <NavigationSection defaultOpen title="Aujourd’hui">
            <NavigationItem href="/workspace" icon="dashboard">
              Tableau de bord
            </NavigationItem>
            <NavigationItem href="/workspace/qr" icon="qr">
              Scanner et QR
            </NavigationItem>
            <NavigationItem href="/workspace/customers" icon="customer">
              Clients
            </NavigationItem>
            <NavigationItem href="/workspace/visits" icon="location">
              Visites clients
            </NavigationItem>
          </NavigationSection>
          <NavigationSection title="Mon établissement">
            <NavigationItem href="/workspace/merchants" icon="merchant">
              Mon commerce
            </NavigationItem>
            <NavigationItem href="/workspace/branches" icon="branch">
              Points de vente
            </NavigationItem>
            <NavigationItem href="/workspace/staff" icon="staff">
              Équipe
            </NavigationItem>
          </NavigationSection>
          <NavigationSection title="Fidélisation clients">
            <NavigationItem href="/workspace/loyalty" icon="reward">
              Programmes
            </NavigationItem>
            <NavigationItem href="/workspace/points" icon="points">
              Mouvements de points
            </NavigationItem>
            <NavigationItem href="/workspace/rewards" icon="reward">
              Récompenses
            </NavigationItem>
            <NavigationItem href="/workspace/gamification" icon="gamification">
              Gamification
            </NavigationItem>
            <NavigationItem href="/workspace/games" icon="gamification">
              Jeux et gains
            </NavigationItem>
            <NavigationItem href="/workspace/challenges" icon="activity">
              Challenges
            </NavigationItem>
            <NavigationItem href="/workspace/badges" icon="badge">
              Badges
            </NavigationItem>
          </NavigationSection>
          <NavigationSection title="Marketing et analyse">
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
            <NavigationItem href="/workspace/analytics" icon="analytics">
              Analytics
            </NavigationItem>
            <NavigationItem href="/workspace/reports" icon="plan">
              Rapports
            </NavigationItem>
          </NavigationSection>
          <NavigationSection title="Réglages du compte">
            <NavigationItem href="/workspace/subscriptions" icon="subscription">
              Abonnement
            </NavigationItem>
            <NavigationItem href="/workspace/billing" icon="billing">
              Factures et paiements
            </NavigationItem>
            <NavigationItem href="/workspace/white-label" icon="settings">
              Identité de marque
            </NavigationItem>
            <NavigationItem href="/workspace/localization" icon="localization">
              Langues et formats
            </NavigationItem>
          </NavigationSection>
        </>
      }
      title="Café Medina"
    >
      {children}
    </WorkspaceShell>
  );
}
