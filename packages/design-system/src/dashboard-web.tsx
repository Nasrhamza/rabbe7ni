"use client";

import { useEffect, useMemo, useState } from "react";

import { Icon, type IconName } from "@rabbehni/design-system/icons";
import { ButtonLink, PageHeader, StatusPill } from "@rabbehni/design-system/web";

type DashboardIdentity = "admin" | "merchant";
type ApiRow = Record<string, unknown>;
type MetricTone = "primary" | "success" | "warning" | "danger";

interface DashboardMetric {
  readonly label: string;
  readonly value: number | null;
  readonly helper: string;
  readonly icon: IconName;
  readonly tone: MetricTone;
}

interface AnalyticsMetric {
  readonly metric: string;
  readonly value: number;
  readonly previousValue: number | null;
  readonly changeRate: number | null;
}

interface QuickAction {
  readonly href: string;
  readonly label: string;
  readonly description: string;
  readonly icon: IconName;
  readonly tone: MetricTone;
}

interface OperationalAlert {
  readonly title: string;
  readonly description: string;
  readonly href: string;
  readonly tone: MetricTone;
}

interface ActivityItem {
  readonly id: string;
  readonly title: string;
  readonly detail: string;
  readonly occurredAt: string | null;
  readonly icon: IconName;
}

interface DashboardState {
  readonly connected: boolean;
  readonly counts: Readonly<Record<string, number>>;
  readonly analytics: readonly AnalyticsMetric[];
  readonly alerts: readonly OperationalAlert[];
  readonly activities: readonly ActivityItem[];
  readonly error: string | null;
  readonly loadedAt: Date;
}

const number = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 1 });

const adminActions: readonly QuickAction[] = [
  {
    href: "/workspace/organizations/new",
    label: "Créer une organisation",
    description: "Ajouter une entreprise cliente et définir son périmètre.",
    icon: "organization",
    tone: "primary",
  },
  {
    href: "/workspace/merchants/new",
    label: "Ajouter un commerce",
    description: "Rattacher un commerce à son organisation.",
    icon: "merchant",
    tone: "success",
  },
  {
    href: "/workspace/staff/new",
    label: "Inviter un responsable",
    description: "Définir son rôle et son périmètre d’accès.",
    icon: "staff",
    tone: "warning",
  },
  {
    href: "/workspace/reports",
    label: "Générer un rapport",
    description: "Exporter les indicateurs calculés par la plateforme.",
    icon: "plan",
    tone: "danger",
  },
];

const merchantActions: readonly QuickAction[] = [
  {
    href: "/workspace/qr",
    label: "Scanner un client",
    description: "Valider une visite, créditer des points ou utiliser une récompense.",
    icon: "qr",
    tone: "primary",
  },
  {
    href: "/workspace/customers/new",
    label: "Ajouter un client",
    description: "Créer sa fiche et enregistrer ses préférences.",
    icon: "customer",
    tone: "success",
  },
  {
    href: "/workspace/points/new",
    label: "Ajuster des points",
    description: "Corriger un solde avec une justification auditée.",
    icon: "points",
    tone: "warning",
  },
  {
    href: "/workspace/campaigns/new",
    label: "Créer une campagne",
    description: "Cibler un segment et programmer les messages.",
    icon: "campaign",
    tone: "danger",
  },
];

const metricLabels: Readonly<Record<string, string>> = {
  "customers.active": "Clients actifs",
  "customers.churn_indicator": "Indicateur de churn",
  "customers.inactive": "Clients inactifs",
  "customers.new": "Nouveaux clients",
  "customers.total": "Clients enregistrés",
  "gamification.badges_earned": "Badges gagnés",
  "gamification.challenge_completed": "Défis terminés",
  "gamification.xp_earned": "XP gagnée",
  "loyalty.outstanding_liability": "Solde de points en circulation",
  "loyalty.points_earned": "Points gagnés",
  "loyalty.points_redeemed": "Points utilisés",
  "loyalty.redemption_rate": "Taux d’utilisation",
  "qr.rejected": "QR refusés",
  "qr.replay_attempts": "Tentatives de rejeu",
  "qr.scans": "Scans QR",
  "qr.successful": "Transactions QR validées",
};

function rows(payload: unknown): readonly ApiRow[] {
  if (Array.isArray(payload)) return payload as readonly ApiRow[];
  if (payload && typeof payload === "object") {
    const candidate = (payload as { items?: unknown }).items;
    if (Array.isArray(candidate)) return candidate as readonly ApiRow[];
  }
  return [];
}

function total(payload: unknown): number {
  if (payload && typeof payload === "object") {
    const candidate = (payload as { total?: unknown }).total;
    if (typeof candidate === "number" && Number.isFinite(candidate)) return candidate;
  }
  return rows(payload).length;
}

function text(row: ApiRow, ...keys: readonly string[]): string {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return "—";
}

async function request(apiUrl: string, path: string): Promise<unknown> {
  const response = await fetch(`${apiUrl}/v1${path}`, {
    credentials: "include",
    headers: { accept: "application/json" },
  });
  if (!response.ok) throw new Error(`HTTP ${response.status} sur ${path}`);
  return response.json() as Promise<unknown>;
}

function buildActivity(identity: DashboardIdentity, payload: unknown): readonly ActivityItem[] {
  return rows(payload)
    .slice(0, 6)
    .map((row, index) => {
      if (identity === "admin") {
        return {
          id: text(row, "id") + index,
          title: text(row, "action", "eventType", "entityType"),
          detail: [text(row, "entityType", "resourceType"), text(row, "entityId")]
            .filter((value) => value !== "—")
            .join(" · "),
          occurredAt:
            text(row, "createdAt", "occurredAt") === "—"
              ? null
              : text(row, "createdAt", "occurredAt"),
          icon: "audit" as IconName,
        };
      }
      return {
        id: text(row, "id") + index,
        title:
          text(row, "customerName", "source", "status") === "—"
            ? "Visite client"
            : text(row, "customerName", "source", "status"),
        detail: [text(row, "merchantName"), text(row, "branchName")]
          .filter((value) => value !== "—")
          .join(" · "),
        occurredAt:
          text(row, "visitedAt", "createdAt") === "—" ? null : text(row, "visitedAt", "createdAt"),
        icon: "activity" as IconName,
      };
    });
}

function buildAlerts(
  identity: DashboardIdentity,
  subscriptions: unknown,
  merchants: unknown,
  rewards: unknown,
  qrTransactions: unknown,
): readonly OperationalAlert[] {
  const alerts: OperationalAlert[] = [];
  if (identity === "admin") {
    const suspendedSubscriptions = rows(subscriptions).filter(
      (item) => text(item, "status") === "SUSPENDED",
    ).length;
    const suspendedMerchants = rows(merchants).filter(
      (item) => text(item, "status") === "SUSPENDED",
    ).length;
    if (suspendedSubscriptions > 0) {
      alerts.push({
        title: `${suspendedSubscriptions} abonnement(s) suspendu(s)`,
        description: "Vérifiez la facturation et la décision de réactivation.",
        href: "/workspace/subscriptions",
        tone: "danger",
      });
    }
    if (suspendedMerchants > 0) {
      alerts.push({
        title: `${suspendedMerchants} commerce(s) suspendu(s)`,
        description: "Consultez le motif et les actions d’audit associées.",
        href: "/workspace/merchants",
        tone: "warning",
      });
    }
  } else {
    const lowStock = rows(rewards).filter((item) => {
      const stock = item.stockQuantity;
      return typeof stock === "number" && stock >= 0 && stock <= 10;
    }).length;
    const rejected = rows(qrTransactions).filter(
      (item) => text(item, "status") === "REJECTED",
    ).length;
    if (lowStock > 0) {
      alerts.push({
        title: `${lowStock} récompense(s) avec un stock faible`,
        description: "Réapprovisionnez ou suspendez les récompenses concernées.",
        href: "/workspace/rewards",
        tone: "warning",
      });
    }
    if (rejected > 0) {
      alerts.push({
        title: `${rejected} transaction(s) QR refusée(s)`,
        description: "Contrôlez les expirations, rejeux et erreurs de périmètre.",
        href: "/workspace/qr-history",
        tone: "danger",
      });
    }
  }
  return alerts;
}

function MetricCard({ metric }: Readonly<{ metric: DashboardMetric }>) {
  return (
    <article className={`r-admin-metric r-admin-metric--${metric.tone}`}>
      <span className="r-admin-metric__icon">
        <Icon name={metric.icon} />
      </span>
      <div className="r-admin-metric__copy">
        <span>{metric.label}</span>
        <strong>{metric.value == null ? "—" : number.format(metric.value)}</strong>
        <small>{metric.helper}</small>
      </div>
      <span className="r-admin-metric__change">API</span>
    </article>
  );
}

function AnalyticsPanel({ items }: Readonly<{ items: readonly AnalyticsMetric[] }>) {
  const visible = items.filter((item) => Number.isFinite(item.value)).slice(0, 8);
  const max = Math.max(1, ...visible.map((item) => Math.abs(item.value)));
  return (
    <section className="r-admin-panel r-admin-panel--chart">
      <header className="r-admin-panel__header">
        <div>
          <span className="r-section-kicker">30 derniers jours</span>
          <h3>Indicateurs calculés</h3>
        </div>
        <a href="/workspace/analytics">Analyse complète</a>
      </header>
      {visible.length === 0 ? (
        <div className="r-admin-empty">
          <strong>Aucune agrégation disponible</strong>
          <span>Lancez le pipeline depuis la page Analytics pour calculer les indicateurs.</span>
        </div>
      ) : (
        <div
          className="r-admin-chart"
          role="img"
          aria-label="Indicateurs issus du pipeline analytics"
        >
          <div className="r-admin-chart__bars">
            {visible.map((item) => (
              <div className="r-admin-chart__column" key={item.metric}>
                <span className="r-admin-chart__value">{number.format(item.value)}</span>
                <span
                  className="r-admin-chart__bar"
                  style={{ height: `${Math.max(5, (Math.abs(item.value) / max) * 100)}%` }}
                />
                <small>{metricLabels[item.metric] ?? item.metric}</small>
              </div>
            ))}
          </div>
        </div>
      )}
      <footer className="r-admin-chart__legend">
        <span>
          <i className="is-blue" /> PostgreSQL → ClickHouse, sans valeur inventée
        </span>
      </footer>
    </section>
  );
}

function AlertsPanel({ alerts }: Readonly<{ alerts: readonly OperationalAlert[] }>) {
  return (
    <section className="r-admin-panel r-admin-panel--alerts">
      <header className="r-admin-panel__header">
        <div>
          <span className="r-section-kicker">À traiter</span>
          <h3>Alertes opérationnelles</h3>
        </div>
        <span className="r-alert-count">{alerts.length}</span>
      </header>
      {alerts.length === 0 ? (
        <div className="r-admin-empty">
          <strong>Aucune alerte détectée</strong>
          <span>Les contrôles actuels ne signalent aucun incident prioritaire.</span>
        </div>
      ) : (
        <div className="r-alert-list">
          {alerts.map((alert) => (
            <a
              className={`r-alert-item r-alert-item--${alert.tone}`}
              href={alert.href}
              key={alert.title}
            >
              <span className="r-alert-item__signal" />
              <div>
                <strong>{alert.title}</strong>
                <small>{alert.description}</small>
              </div>
              <Icon name="chevron" />
            </a>
          ))}
        </div>
      )}
    </section>
  );
}

function RecentActivity({
  identity,
  items,
}: Readonly<{ identity: DashboardIdentity; items: readonly ActivityItem[] }>) {
  return (
    <section className="r-admin-panel">
      <header className="r-admin-panel__header">
        <div>
          <span className="r-section-kicker">Données réelles</span>
          <h3>{identity === "admin" ? "Journal d’audit récent" : "Visites récentes"}</h3>
        </div>
        <a href={identity === "admin" ? "/workspace/audit" : "/workspace/visits"}>Tout afficher</a>
      </header>
      {items.length === 0 ? (
        <div className="r-admin-empty">
          <strong>Aucune activité dans ce périmètre</strong>
          <span>Les prochaines opérations apparaîtront ici automatiquement.</span>
        </div>
      ) : (
        <ol className="r-admin-timeline">
          {items.map((item) => (
            <li key={item.id}>
              <span>
                <Icon name={item.icon} />
              </span>
              <div>
                <strong>{item.title}</strong>
                <small>{item.detail || "Opération sécurisée"}</small>
              </div>
              <time>
                {item.occurredAt ? new Date(item.occurredAt).toLocaleString("fr-FR") : "—"}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}

function DashboardGuide({ identity }: Readonly<{ identity: DashboardIdentity }>) {
  const steps =
    identity === "admin"
      ? ([
          [
            "organization",
            "Configurer l’entreprise",
            "Créez l’organisation et son périmètre.",
            "/workspace/organizations",
          ],
          [
            "merchant",
            "Structurer le réseau",
            "Ajoutez commerces, points de vente et équipes.",
            "/workspace/merchants",
          ],
          [
            "analytics",
            "Suivre la plateforme",
            "Contrôlez activité, sécurité et revenus.",
            "/workspace/analytics",
          ],
        ] as const)
      : ([
          [
            "qr",
            "Scanner le client",
            "Identifiez le client avec son QR sécurisé.",
            "/workspace/qr",
          ],
          [
            "points",
            "Attribuer les points",
            "Enregistrez l’opération et créditez les points.",
            "/workspace/points/new",
          ],
          [
            "reward",
            "Fidéliser le client",
            "Proposez une récompense ou une campagne.",
            "/workspace/rewards",
          ],
        ] as const);
  return (
    <section className={`r-dashboard-guide r-dashboard-guide--${identity}`}>
      <header>
        <span>Parcours recommandé</span>
        <div>
          <h2>
            {identity === "admin"
              ? "Administrer Rabbehni en 3 étapes"
              : "Servir un client en 3 étapes"}
          </h2>
          <p>
            {identity === "admin"
              ? "Structure, contrôle puis analyse."
              : "Le parcours quotidien le plus simple pour votre équipe."}
          </p>
        </div>
      </header>
      <div>
        {steps.map(([icon, label, description, href], index) => (
          <a href={href} key={href}>
            <span className="r-dashboard-guide__number">{index + 1}</span>
            <span className="r-dashboard-guide__icon">
              <Icon name={icon} />
            </span>
            <span>
              <strong>{label}</strong>
              <small>{description}</small>
            </span>
            <Icon name="chevron" />
          </a>
        ))}
      </div>
    </section>
  );
}

export function WorkspaceDashboard({
  apiUrl,
  identity,
}: Readonly<{ apiUrl: string; identity: DashboardIdentity }>) {
  const [state, setState] = useState<DashboardState | null>(null);
  const actions = identity === "admin" ? adminActions : merchantActions;
  const range = useMemo(() => {
    const to = new Date();
    const from = new Date(to.getTime() - 30 * 86_400_000);
    return new URLSearchParams({
      from: from.toISOString(),
      to: to.toISOString(),
      timezone: "Africa/Tunis",
    });
  }, []);

  useEffect(() => {
    let active = true;
    const paths =
      identity === "admin"
        ? [
            "/organizations?take=100",
            "/merchants?take=100",
            "/branches?take=100",
            "/customers?take=100",
            "/subscriptions?take=100",
            "/audit?take=6",
          ]
        : [
            "/customers?take=100",
            "/visits?take=100",
            "/rewards?take=100",
            "/campaigns?take=100",
            "/qr/transactions?take=100",
            "/visits?take=6",
          ];
    void Promise.allSettled([
      ...paths.map((path) => request(apiUrl, path)),
      request(apiUrl, `/analytics/dashboard?${range.toString()}`),
    ]).then((results) => {
      if (!active) return;
      const values = results.map((result) => (result.status === "fulfilled" ? result.value : null));
      const baseFailures = results
        .slice(0, 4)
        .filter((result) => result.status === "rejected").length;
      const analyticsPayload = values.at(-1) as { items?: AnalyticsMetric[] } | null;
      const counts =
        identity === "admin"
          ? {
              organizations: total(values[0]),
              merchants: total(values[1]),
              branches: total(values[2]),
              customers: total(values[3]),
            }
          : {
              customers: total(values[0]),
              visits: total(values[1]),
              rewards: total(values[2]),
              campaigns: total(values[3]),
            };
      setState({
        connected: baseFailures === 0,
        counts,
        analytics: Array.isArray(analyticsPayload?.items) ? analyticsPayload.items : [],
        alerts: buildAlerts(
          identity,
          values[4],
          identity === "admin" ? values[1] : null,
          identity === "merchant" ? values[2] : null,
          identity === "merchant" ? values[4] : null,
        ),
        activities: buildActivity(identity, values[5]),
        error:
          baseFailures === 0 ? null : `${baseFailures} source(s) opérationnelle(s) indisponible(s)`,
        loadedAt: new Date(),
      });
    });
    return () => {
      active = false;
    };
  }, [apiUrl, identity, range]);

  const metrics: readonly DashboardMetric[] =
    identity === "admin"
      ? [
          {
            label: "Organisations",
            value: state?.counts.organizations ?? null,
            helper: "Entreprises du tenant",
            icon: "organization",
            tone: "primary",
          },
          {
            label: "Commerces",
            value: state?.counts.merchants ?? null,
            helper: "Profils commerciaux",
            icon: "merchant",
            tone: "success",
          },
          {
            label: "Points de vente",
            value: state?.counts.branches ?? null,
            helper: "Implantations opérationnelles",
            icon: "branch",
            tone: "warning",
          },
          {
            label: "Clients",
            value: state?.counts.customers ?? null,
            helper: "Profils clients accessibles",
            icon: "customer",
            tone: "danger",
          },
        ]
      : [
          {
            label: "Clients",
            value: state?.counts.customers ?? null,
            helper: "Profils clients du commerce",
            icon: "customer",
            tone: "primary",
          },
          {
            label: "Visites",
            value: state?.counts.visits ?? null,
            helper: "Check-ins enregistrés",
            icon: "activity",
            tone: "success",
          },
          {
            label: "Récompenses",
            value: state?.counts.rewards ?? null,
            helper: "Catalogue accessible",
            icon: "reward",
            tone: "warning",
          },
          {
            label: "Campagnes",
            value: state?.counts.campaigns ?? null,
            helper: "Actions marketing",
            icon: "campaign",
            tone: "danger",
          },
        ];

  return (
    <section className="r-dashboard r-admin-dashboard">
      <PageHeader
        actions={
          <ButtonLink
            href={identity === "admin" ? "/workspace/organizations/new" : "/workspace/qr"}
          >
            <Icon name={identity === "admin" ? "organization" : "qr"} />
            {identity === "admin" ? "Nouvelle organisation" : "Scanner un client"}
          </ButtonLink>
        }
        description={
          identity === "admin"
            ? "Configurez les entreprises, contrôlez le réseau et analysez les résultats réels."
            : "Retrouvez les actions et données utiles aux opérations quotidiennes."
        }
        eyebrow={identity === "admin" ? "Administration Rabbehni" : "Espace commerçant"}
        title={identity === "admin" ? "Pilotage de la plateforme" : "Tableau de bord opérationnel"}
      />

      <DashboardGuide identity={identity} />

      <div className="r-demo-banner">
        <span className="r-demo-banner__icon">
          <Icon name="activity" />
        </span>
        <div>
          <strong>Données issues de l’API Rabbehni</strong>
          <span>Le seed PFE alimente les mêmes endpoints que les opérations utilisateur.</span>
        </div>
        <span
          className={`r-demo-banner__live is-${state?.connected ? "connected" : state ? "offline" : "checking"}`}
        >
          <i />
          {state?.connected
            ? `Synchronisé · ${state.loadedAt.toLocaleTimeString("fr-FR")}`
            : (state?.error ?? "Connexion…")}
        </span>
      </div>

      <div className="r-admin-metrics" aria-label="Indicateurs clés">
        {metrics.map((metric) => (
          <MetricCard key={metric.label} metric={metric} />
        ))}
      </div>

      <div className="r-admin-dashboard__main">
        <AnalyticsPanel items={state?.analytics ?? []} />
        <AlertsPanel alerts={state?.alerts ?? []} />
      </div>

      <section className="r-admin-panel r-admin-panel--quick">
        <header className="r-admin-panel__header">
          <div>
            <span className="r-section-kicker">Raccourcis</span>
            <h3>Que souhaitez-vous faire ?</h3>
          </div>
          <span>Actions principales</span>
        </header>
        <div className="r-admin-quick-actions">
          {actions.map((action) => (
            <a
              className={`r-admin-quick-action is-${action.tone}`}
              href={action.href}
              key={action.href}
            >
              <span>
                <Icon name={action.icon} />
              </span>
              <div>
                <strong>{action.label}</strong>
                <small>{action.description}</small>
              </div>
              <Icon name="chevron" />
            </a>
          ))}
        </div>
      </section>

      <RecentActivity identity={identity} items={state?.activities ?? []} />
      <footer className="r-dashboard-source">
        <StatusPill tone={state?.connected ? "success" : "warning"}>
          {state?.connected ? "Sources opérationnelles disponibles" : "Connexion partielle"}
        </StatusPill>
        <a href="/workspace/system-status">État des services</a>
      </footer>
    </section>
  );
}
