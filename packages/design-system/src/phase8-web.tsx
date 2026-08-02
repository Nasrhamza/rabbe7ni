"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

import {
  BentoCard,
  BentoGrid,
  Button,
  Eyebrow,
  Field,
  ResourceVisual,
  StatusPill,
  webAssets,
} from "@rabbehni/design-system/web";

export type Phase8Resource = "analytics" | "reports";
type Metric = {
  metric: string;
  value: number;
  previousValue: number | null;
  changeRate: number | null;
};
type Dashboard = { items: Metric[]; freshnessSeconds: number | null };
type Artifact = { id: string; fileName: string; expiresAt: string };
type Execution = { id: string; status: string; createdAt: string; artifact?: Artifact | null };
type Report = {
  id: string;
  name: string;
  frequency: string;
  timezone: string;
  executions: Execution[];
};
type Insight = {
  summary: string;
  confidence: number;
  uncertainty: string;
  recommendations: string[];
  provider: string;
  fallback: boolean;
  humanReviewRequired: boolean;
};

function formatFreshness(seconds: number | null | undefined): string {
  if (seconds == null) return "indisponible";
  if (seconds < 60) return `${seconds} s`;
  if (seconds < 3_600) return `${Math.round(seconds / 60)} min`;
  if (seconds < 86_400) return `${Math.round(seconds / 3_600)} h`;
  return `${Math.round(seconds / 86_400)} j`;
}

export function Phase8Screen({
  apiUrl,
  resource,
  identity,
}: Readonly<{ apiUrl: string; resource: Phase8Resource; identity: "admin" | "merchant" }>) {
  const now = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(
    new Date(now.getTime() - 30 * 86_400_000).toISOString().slice(0, 10),
  );
  const [to, setTo] = useState(now.toISOString().slice(0, 10));
  const [timezone, setTimezone] = useState("Africa/Tunis");
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [reports, setReports] = useState<Report[]>([]);
  const [insight, setInsight] = useState<Insight | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const api = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const response = await fetch(`${apiUrl}/v1${path}`, {
        credentials: "include",
        ...init,
        headers: { "content-type": "application/json", ...init?.headers },
      });
      if (!response.ok) {
        const problem = (await response.json().catch(() => null)) as {
          message?: string;
        } | null;
        const message = problem?.message ?? `Service indisponible (${response.status})`;
        throw new Error(
          message.includes("Analytics upstream unavailable")
            ? "Les données analytiques sont temporairement indisponibles. Réessayez dans quelques instants."
            : message,
        );
      }
      return response.json() as Promise<T>;
    },
    [apiUrl],
  );
  const range = useMemo(
    () =>
      new URLSearchParams({
        from: new Date(`${from}T00:00:00Z`).toISOString(),
        to: new Date(`${to}T23:59:59.999Z`).toISOString(),
        timezone,
      }),
    [from, timezone, to],
  );

  const load = useCallback(async () => {
    setBusy(true);
    setError("");
    try {
      if (resource === "analytics") {
        setDashboard(await api<Dashboard>(`/analytics/dashboard?${range.toString()}`));
      } else {
        setReports(await api<Report[]>("/reports"));
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }, [api, range, resource]);
  useEffect(() => void load(), [load]);

  async function refreshPipeline() {
    setBusy(true);
    try {
      await api("/analytics/refresh", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(range.entries())),
      });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
      setBusy(false);
    }
  }
  async function requestInsight() {
    setBusy(true);
    try {
      setInsight(
        await api<Insight>("/analytics/insights", {
          method: "POST",
          body: JSON.stringify({
            ...Object.fromEntries(range.entries()),
            capability: "OPERATIONAL_SUMMARY",
            idempotencyKey: `ui-${identity}-${from}-${to}-${Date.now()}`,
            context: { audience: identity },
          }),
        }),
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }
  async function runReport(id: string) {
    setBusy(true);
    try {
      await api(`/reports/${id}/run`, { method: "POST" });
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }
  async function createReport(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    setBusy(true);
    try {
      await api("/reports", {
        method: "POST",
        body: JSON.stringify({
          organizationId: data.get("organizationId"),
          code: data.get("code"),
          name: data.get("name"),
          frequency: data.get("frequency"),
          timezone: data.get("timezone"),
          filters: { organizationId: data.get("organizationId") },
          metrics: String(data.get("metrics"))
            .split(",")
            .map((item) => item.trim())
            .filter(Boolean),
          active: true,
          retentionDays: 30,
        }),
      });
      event.currentTarget.reset();
      await load();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setBusy(false);
    }
  }

  if (resource === "reports") {
    return (
      <section className="resource-page ux-module-page ux-reports-page" data-resource="reports">
        <header className="resource-heading ux-module-heading">
          <Eyebrow>Rapports et pilotage</Eyebrow>
          <h1>Rapports planifiés</h1>
          <p>CSV sécurisé, historique d’exécution, rétention et livraison email.</p>
          <ResourceVisual
            alt="Rapports livrés par e-mail"
            assets={[webAssets.communication.emailNotification]}
          />
        </header>
        {error && (
          <div className="ux-inline-alert" role="alert">
            <strong>Action impossible</strong>
            <span>{error}</span>
          </div>
        )}
        <div className="ux-guidance-strip">
          <span className="ux-guidance-strip__icon">↓</span>
          <div>
            <strong>Choisissez les métriques, la fréquence et le canal de livraison</strong>
            <span>Chaque exécution garde son historique et son artefact téléchargeable.</span>
          </div>
          <a href="#report-builder">Configurer</a>
        </div>
        <BentoGrid>
          <BentoCard span="wide" tone="aqua">
            <h2>Nouvelle définition</h2>
            <form
              className="ux-report-builder"
              id="report-builder"
              onSubmit={createReport}
              style={{ display: "grid", gap: 12 }}
            >
              <div className="ux-builder-progress">
                <span className="is-active">Périmètre</span>
                <span>Métriques</span>
                <span>Planification</span>
                <span>Livraison</span>
              </div>
              <Field label="Organisation UUID" name="organizationId" required />
              <Field label="Code" name="code" required />
              <Field label="Nom" name="name" required />
              <label>
                Fréquence
                <select className="r-input" name="frequency" defaultValue="WEEKLY">
                  <option>DAILY</option>
                  <option>WEEKLY</option>
                  <option>MONTHLY</option>
                </select>
              </label>
              <Field label="Fuseau IANA" name="timezone" defaultValue="Africa/Tunis" required />
              <Field
                label="Métriques (séparées par virgules)"
                name="metrics"
                defaultValue="customers.total,loyalty.points_earned,qr.successful"
                required
              />
              <Button disabled={busy} type="submit">
                Créer et planifier
              </Button>
            </form>
          </BentoCard>
          <BentoCard span="wide">
            <h2>Définitions et historique</h2>
            {reports.length === 0 ? (
              <p>Aucun rapport dans ce périmètre.</p>
            ) : (
              reports.map((report) => (
                <article
                  key={report.id}
                  style={{ borderTop: "1px solid var(--r-border)", padding: "14px 0" }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", gap: 12 }}>
                    <div>
                      <strong>{report.name}</strong>
                      <p>
                        {report.frequency} · {report.timezone}
                      </p>
                    </div>
                    <Button
                      disabled={busy}
                      onClick={() => void runReport(report.id)}
                      variant="secondary"
                    >
                      Générer
                    </Button>
                  </div>
                  {report.executions.map((execution) => (
                    <div key={execution.id} style={{ display: "flex", gap: 12 }}>
                      <StatusPill tone={execution.status === "COMPLETED" ? "success" : "info"}>
                        {execution.status}
                      </StatusPill>
                      <span>{new Date(execution.createdAt).toLocaleString()}</span>
                      {execution.artifact && (
                        <span className="ux-report-downloads">
                          <a
                            href={`${apiUrl}/v1/reports/artifacts/${execution.artifact.id}?format=csv`}
                          >
                            Télécharger CSV
                          </a>
                          <a
                            href={`${apiUrl}/v1/reports/artifacts/${execution.artifact.id}?format=pdf`}
                          >
                            Télécharger PDF
                          </a>
                        </span>
                      )}
                    </div>
                  ))}
                </article>
              ))
            )}
          </BentoCard>
        </BentoGrid>
      </section>
    );
  }

  const items = dashboard?.items ?? [];
  const max = Math.max(1, ...items.map((item) => Math.abs(item.value)));
  return (
    <section className="resource-page ux-module-page ux-analytics-page" data-resource="analytics">
      <header className="resource-heading ux-module-heading">
        <Eyebrow>Analyse des données</Eyebrow>
        <h1>{identity === "admin" ? "Pilotage plateforme" : "Performance opérationnelle"}</h1>
        <p>Chaque indicateur conserve sa lignée complète PostgreSQL → ClickHouse.</p>
        <ResourceVisual
          alt="Croissance et analyse des indicateurs"
          assets={[webAssets.icons.analytics]}
        />
      </header>
      <div className="ux-analytics-tabs">
        <button className="is-active" type="button">
          Vue d’ensemble
        </button>
        <button type="button">Acquisition</button>
        <button type="button">Fidélité</button>
        <button type="button">Engagement</button>
        <button type="button">Comparaisons</button>
      </div>
      <div
        className="ux-analytics-filters"
        style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "end" }}
      >
        <Field
          label="Du"
          type="date"
          value={from}
          onChange={(event) => setFrom(event.target.value)}
        />
        <Field label="Au" type="date" value={to} onChange={(event) => setTo(event.target.value)} />
        <Field
          label="Fuseau"
          value={timezone}
          onChange={(event) => setTimezone(event.target.value)}
        />
        <Button disabled={busy} onClick={() => void load()} variant="secondary">
          Actualiser
        </Button>
        <Button disabled={busy} onClick={() => void refreshPipeline()}>
          Rejouer le pipeline
        </Button>
      </div>
      {error && (
        <div className="ux-inline-alert" role="alert">
          <strong>Données non disponibles</strong>
          <span>{error}</span>
        </div>
      )}
      {busy && <p role="status">Chargement des données validées…</p>}
      <BentoGrid>
        {items.slice(0, 6).map((item) => (
          <BentoCard className="ux-metric-card" key={item.metric} tone="mint">
            <span>{item.metric}</span>
            <strong style={{ fontSize: "2rem" }}>{item.value.toLocaleString()}</strong>
            <StatusPill tone={item.changeRate !== null && item.changeRate < 0 ? "warning" : "info"}>
              {item.changeRate === null
                ? "Pas de base comparable"
                : `${(item.changeRate * 100).toFixed(1)} %`}
            </StatusPill>
          </BentoCard>
        ))}
        <BentoCard span="wide" tone="aqua">
          <h2>Comparaison des métriques</h2>
          {items.length ? (
            items.slice(0, 15).map((item) => (
              <div
                key={item.metric}
                style={{
                  display: "grid",
                  gridTemplateColumns: "minmax(160px, 1fr) 3fr auto",
                  gap: 10,
                  alignItems: "center",
                  margin: "9px 0",
                }}
              >
                <span>{item.metric}</span>
                <span style={{ height: 9, borderRadius: 99, background: "var(--r-border)" }}>
                  <span
                    style={{
                      display: "block",
                      height: "100%",
                      width: `${Math.max(2, (Math.abs(item.value) / max) * 100)}%`,
                      borderRadius: 99,
                      background: "var(--r-accent)",
                    }}
                  />
                </span>
                <strong>{item.value.toLocaleString()}</strong>
              </div>
            ))
          ) : (
            <p>Aucune activité agrégée sur cette période.</p>
          )}
        </BentoCard>
        <BentoCard span="wide">
          <details className="ux-metric-catalog">
            <summary>
              <span>
                <strong>Catalogue complet</strong>
                <small>{items.length} métriques disponibles</small>
              </span>
              <span>Afficher les données détaillées</span>
            </summary>
            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr>
                    <th>Métrique</th>
                    <th>Valeur</th>
                    <th>Précédente</th>
                    <th>Évolution</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item) => (
                    <tr key={item.metric}>
                      <td>{item.metric}</td>
                      <td>{item.value}</td>
                      <td>{item.previousValue ?? "—"}</td>
                      <td>
                        {item.changeRate === null ? "—" : `${(item.changeRate * 100).toFixed(2)} %`}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        </BentoCard>
        <BentoCard span="wide" tone="violet">
          <h2>Intelligence explicable</h2>
          <p>Fraîcheur : {formatFreshness(dashboard?.freshnessSeconds)}</p>
          <Button disabled={busy || !items.length} onClick={() => void requestInsight()}>
            Analyser les métriques visibles
          </Button>
          {insight && (
            <div>
              <p>
                <strong>{insight.summary}</strong>
              </p>
              <StatusPill tone={insight.fallback ? "warning" : "success"}>
                Confiance {(insight.confidence * 100).toFixed(0)} % · {insight.provider}
              </StatusPill>
              <p>{insight.uncertainty}</p>
              <ul>
                {insight.recommendations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
              <small>
                Validation humaine obligatoire : {insight.humanReviewRequired ? "oui" : "non"}
              </small>
            </div>
          )}
        </BentoCard>
      </BentoGrid>
    </section>
  );
}
