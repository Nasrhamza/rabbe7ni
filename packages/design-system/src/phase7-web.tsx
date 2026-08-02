"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";

import {
  Button,
  ButtonLink,
  Eyebrow,
  ResourceVisual,
  StatusPill,
  StructuredDataEditor,
  webAssets,
} from "@rabbehni/design-system/web";

export type Phase7Resource =
  | "segments"
  | "campaigns"
  | "automations"
  | "notification-templates"
  | "notification-deliveries"
  | "communication-preferences"
  | "campaign-metrics";

const resourceVisuals = {
  automations: [webAssets.productivity.schedule],
  campaigns: [webAssets.communication.emailMarketing],
  "campaign-metrics": [webAssets.icons.analytics],
  "communication-preferences": [webAssets.communication.emailNotification],
  "notification-deliveries": [webAssets.communication.emailNotification],
  "notification-templates": [webAssets.communication.emailMarketing],
  segments: [webAssets.business.team],
} as const;

const optionLabels: Readonly<Record<string, string>> = {
  ACTIVE: "Actif",
  ANNIVERSARY: "Date anniversaire",
  ARCHIVED: "Archivé",
  BIRTHDAY: "Anniversaire",
  CHALLENGE: "Challenge",
  DRAFT: "Brouillon",
  DYNAMIC: "Dynamique",
  EMAIL: "Email",
  EVENT_TRIGGERED: "Déclenchée par une action",
  GAMIFICATION: "Gamification",
  IN_APP: "Dans l’application",
  INFORMATIONAL: "Information",
  LOYALTY: "Fidélité",
  MARKETING: "Marketing",
  PAUSED: "En pause",
  PROMOTIONAL: "Promotion",
  PUSH: "Notification push",
  REWARD: "Récompense",
  RE_ENGAGEMENT: "Réactivation",
  SCHEDULED: "Planifiée",
  SMS: "SMS",
  STATIC: "Statique",
  SYSTEM: "Système",
  TRANSACTIONAL: "Transactionnel",
  WHATSAPP: "WhatsApp",
  false: "Non",
  true: "Oui",
};

const columnLabels: Readonly<Record<string, string>> = {
  attempts: "Tentatives",
  category: "Catégorie",
  channel: "Canal",
  code: "Code",
  createdAt: "Créé le",
  currentVersion: "Version",
  displayName: "Client",
  email: "Email",
  endsAt: "Fin",
  estimatedSize: "Clients estimés",
  failureReason: "Motif de l’échec",
  lastRefreshedAt: "Dernière mise à jour",
  name: "Nom",
  phone: "Téléphone",
  recipient: "Destinataire",
  startsAt: "Début",
  status: "Statut",
  triggerType: "Déclencheur",
  type: "Type",
};

function optionLabel(value: string): string {
  return optionLabels[value] ?? value.replaceAll("_", " ");
}

function columnLabel(value: string): string {
  return columnLabels[value] ?? value;
}

function isOptionColumn(column: string): boolean {
  return ["category", "channel", "status", "type"].includes(column);
}

type Row = Record<string, unknown>;
type Field = {
  name: string;
  label: string;
  required?: boolean;
  type?: "boolean" | "date" | "json" | "number" | "select" | "text";
  source?: "organizations" | "segments" | "customers" | "campaigns";
  options?: readonly string[];
};
type Definition = {
  title: string;
  description: string;
  endpoint: string;
  createEndpoint?: string;
  fields: readonly Field[];
  columns: readonly string[];
  creatable?: boolean;
};

const definitions: Record<Phase7Resource, Definition> = {
  segments: {
    title: "Segments clients",
    description: "Créez des groupes de clients selon des critères simples ou combinés.",
    endpoint: "/segments",
    fields: [
      { name: "organizationId", label: "Organisation", required: true, source: "organizations" },
      { name: "code", label: "Code", required: true },
      { name: "name", label: "Nom", required: true },
      { name: "description", label: "Description" },
      { name: "type", label: "Type", type: "select", options: ["STATIC", "DYNAMIC"] },
      {
        name: "status",
        label: "Statut",
        type: "select",
        options: ["DRAFT", "ACTIVE", "PAUSED", "ARCHIVED"],
      },
      { name: "timezone", label: "Fuseau horaire", required: true },
      { name: "schedule", label: "Fréquence de mise à jour" },
      {
        name: "ruleField",
        label: "Critère client",
        type: "select",
        options: [
          "activity.inactiveDays",
          "behavior.visits",
          "loyalty.balance",
          "gamification.xp",
          "profile.locale",
        ],
      },
      {
        name: "ruleOperator",
        label: "Comparaison",
        type: "select",
        options: ["GTE", "GT", "EQ", "LTE", "LT"],
      },
      { name: "ruleValue", label: "Valeur du critère" },
    ],
    columns: ["code", "name", "type", "status", "estimatedSize", "lastRefreshedAt"],
  },
  campaigns: {
    title: "Campagnes",
    description: "Préparez une campagne, choisissez son audience et planifiez son envoi.",
    endpoint: "/campaigns",
    fields: [
      { name: "organizationId", label: "Organisation", required: true, source: "organizations" },
      { name: "code", label: "Code", required: true },
      { name: "name", label: "Nom", required: true },
      { name: "description", label: "Description" },
      {
        name: "type",
        label: "Type",
        type: "select",
        options: [
          "INFORMATIONAL",
          "PROMOTIONAL",
          "LOYALTY",
          "REWARD",
          "RE_ENGAGEMENT",
          "CHALLENGE",
          "BIRTHDAY",
          "ANNIVERSARY",
        ],
      },
      { name: "timezone", label: "Fuseau horaire", required: true },
      { name: "startsAt", label: "Début", type: "date" },
      { name: "endsAt", label: "Fin", type: "date" },
      { name: "frequencyCap", label: "Nombre maximum d’envois", type: "number" },
      { name: "frequencyWindowHours", label: "Période de limitation (heures)", type: "number" },
      { name: "requiresApproval", label: "Approbation requise", type: "boolean" },
      { name: "segmentId", label: "Audience ciblée", required: true, source: "segments" },
    ],
    columns: ["code", "name", "type", "status", "startsAt", "endsAt"],
  },
  automations: {
    title: "Automatisations marketing",
    description: "Déclenchez automatiquement une action selon le comportement du client.",
    endpoint: "/automations",
    fields: [
      { name: "organizationId", label: "Organisation", required: true, source: "organizations" },
      { name: "code", label: "Code", required: true },
      { name: "name", label: "Nom", required: true },
      { name: "description", label: "Description" },
      {
        name: "type",
        label: "Type",
        type: "select",
        options: ["EVENT_TRIGGERED", "SCHEDULED"],
      },
      { name: "triggerType", label: "Événement déclencheur", required: true },
      { name: "schedule", label: "Planification automatique" },
      { name: "timezone", label: "Fuseau horaire", required: true },
      {
        name: "maxExecutionsPerCustomer",
        label: "Nombre maximum par client",
        type: "number",
      },
      {
        name: "stepType",
        label: "Action à exécuter",
        type: "select",
        options: ["NOTIFICATION", "REWARD", "WAIT", "EXIT"],
      },
      { name: "stepName", label: "Nom de l’étape", required: true },
      { name: "delayMinutes", label: "Attente avant l’action (minutes)", type: "number" },
    ],
    columns: ["code", "name", "type", "triggerType", "status"],
  },
  "notification-templates": {
    title: "Modèles de notification",
    description: "Préparez les messages Email, push, SMS, in-app et WhatsApp.",
    endpoint: "/notifications/templates",
    fields: [
      { name: "organizationId", label: "Organisation", required: true, source: "organizations" },
      { name: "code", label: "Code", required: true },
      { name: "name", label: "Nom", required: true },
      {
        name: "channel",
        label: "Canal",
        type: "select",
        options: ["EMAIL", "PUSH", "SMS", "IN_APP", "WHATSAPP"],
      },
      {
        name: "category",
        label: "Catégorie",
        type: "select",
        options: ["TRANSACTIONAL", "MARKETING", "LOYALTY", "REWARD", "GAMIFICATION", "SYSTEM"],
      },
      {
        name: "status",
        label: "Statut",
        type: "select",
        options: ["DRAFT", "ACTIVE", "ARCHIVED"],
      },
      { name: "locale", label: "Langue", required: true },
      { name: "subject", label: "Sujet" },
      { name: "body", label: "Corps", required: true },
    ],
    columns: ["code", "name", "channel", "category", "status", "currentVersion"],
  },
  "notification-deliveries": {
    title: "Historique des envois",
    description: "Suivez les messages envoyés, reçus, échoués ou à réessayer.",
    endpoint: "/notifications/deliveries",
    fields: [],
    columns: [
      "channel",
      "category",
      "status",
      "recipient",
      "provider",
      "providerMessageId",
      "attempts",
      "failureReason",
      "createdAt",
    ],
    creatable: false,
  },
  "communication-preferences": {
    title: "Préférences de communication",
    description: "Gérez le consentement, les canaux autorisés et les heures de silence.",
    endpoint: "/customers",
    createEndpoint: "/notifications/preferences",
    fields: [
      { name: "customerId", label: "Client", required: true, source: "customers" },
      {
        name: "channel",
        label: "Canal",
        type: "select",
        options: ["EMAIL", "PUSH", "SMS", "IN_APP", "WHATSAPP"],
      },
      {
        name: "category",
        label: "Catégorie",
        type: "select",
        options: ["TRANSACTIONAL", "MARKETING", "LOYALTY", "REWARD", "GAMIFICATION", "SYSTEM"],
      },
      { name: "optedIn", label: "Communication autorisée", type: "boolean" },
      { name: "quietHoursStart", label: "Début heures calmes (HH:mm)" },
      { name: "quietHoursEnd", label: "Fin heures calmes (HH:mm)" },
      { name: "timezone", label: "Fuseau horaire" },
      { name: "consentSource", label: "Source du consentement" },
    ],
    columns: ["displayName", "email", "phone", "status"],
  },
  "campaign-metrics": {
    title: "Résultats des campagnes",
    description: "Clients ciblés, messages envoyés, ouverts, cliqués et convertis.",
    endpoint: "/campaigns",
    fields: [],
    columns: ["code", "name", "status", "type", "startsAt"],
    creatable: false,
  },
};

function display(row: Row, key: string): string {
  const raw = row[key];
  if (raw === null || raw === undefined || raw === "") return "—";
  if (typeof raw === "object") return JSON.stringify(raw);
  if (typeof raw === "string" && /^\d{4}-\d{2}-\d{2}T/.test(raw)) {
    return new Date(raw).toLocaleString();
  }
  return String(raw);
}

function payload(resource: Phase7Resource, fields: readonly Field[], form: Record<string, string>) {
  const result = Object.fromEntries(
    fields.flatMap((field) => {
      const value = form[field.name];
      if (value === undefined || value === "") return [];
      if (field.type === "number") return [[field.name, Number(value)]];
      if (field.type === "boolean") return [[field.name, value === "true"]];
      if (field.type === "json") return [[field.name, JSON.parse(value) as unknown]];
      if (field.type === "date") return [[field.name, new Date(value).toISOString()]];
      return [[field.name, value]];
    }),
  );
  if (resource === "segments") {
    const field = form.ruleField;
    const operator = form.ruleOperator;
    if (field && operator) {
      const raw = form.ruleValue ?? "";
      const numeric = Number(raw);
      result.rules = {
        combinator: "AND",
        conditions: [
          { field, operator, value: raw !== "" && Number.isFinite(numeric) ? numeric : raw },
        ],
      };
    } else {
      result.rules = { combinator: "AND", conditions: [] };
    }
    delete result.ruleField;
    delete result.ruleOperator;
    delete result.ruleValue;
  }
  if (resource === "campaigns") {
    if (form.segmentId) result.segmentIds = [form.segmentId];
    result.applicability = form.organizationId ? [{ organizationId: form.organizationId }] : [];
    result.settings = {};
    delete result.segmentId;
  }
  if (resource === "automations") {
    const stepType = form.stepType || "NOTIFICATION";
    result.triggerConfig = {};
    result.exitConditions = {};
    result.steps = [
      {
        code: "STEP-1",
        name: form.stepName || "Première action",
        position: 1,
        type: stepType,
        configuration: {},
        delaySeconds: Math.max(0, Number(form.delayMinutes ?? 0) * 60),
      },
    ];
    delete result.stepType;
    delete result.stepName;
    delete result.delayMinutes;
  }
  if (resource === "notification-templates") {
    result.branding = {};
    result.metadata = {};
  }
  return result;
}

export function Phase7ResourceScreen({
  apiUrl,
  resource,
  mode,
  id,
}: Readonly<{
  apiUrl: string;
  resource: Phase7Resource;
  mode: "detail" | "list" | "new";
  id?: string;
}>) {
  const definition = definitions[resource];
  const [items, setItems] = useState<readonly Row[]>([]);
  const [detail, setDetail] = useState<Row | null>(null);
  const [metrics, setMetrics] = useState<Row | null>(null);
  const [catalogs, setCatalogs] = useState<Record<string, readonly Row[]>>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"error" | "loading" | "ready" | "saving" | "success">(
    "loading",
  );

  const api = useMemo(
    () =>
      async <T,>(path: string, init?: RequestInit): Promise<T> => {
        const response = await fetch(`${apiUrl}/v1${path}`, {
          credentials: "include",
          headers: { "content-type": "application/json", ...init?.headers },
          ...init,
        });
        if (!response.ok) {
          const problem = (await response.json().catch(() => null)) as {
            message?: string | { message?: string };
          } | null;
          const problemMessage =
            typeof problem?.message === "string" ? problem.message : problem?.message?.message;
          throw new Error(problemMessage ?? `Erreur HTTP ${response.status}`);
        }
        return response.json() as Promise<T>;
      },
    [apiUrl],
  );

  useEffect(() => {
    let active = true;
    async function load() {
      setState("loading");
      try {
        const sources = [
          ...new Set(definition.fields.flatMap((field) => (field.source ? [field.source] : []))),
        ];
        const sourcePairs = await Promise.all(
          sources.map(async (source) => {
            const result = await api<Row>(`/${source}?pageSize=100`);
            return [source, (result.items as readonly Row[]) ?? []] as const;
          }),
        );
        if (!active) return;
        setCatalogs(Object.fromEntries(sourcePairs));
        if (mode === "detail" && id) {
          const response = await api<Row>(`${definition.endpoint}/${id}`);
          if (!active) return;
          setDetail(response);
          setForm(
            Object.fromEntries(
              definition.fields.map((field) => {
                const value = response[field.name];
                return [
                  field.name,
                  typeof value === "object"
                    ? JSON.stringify(value ?? {})
                    : value === undefined || value === null
                      ? ""
                      : String(value),
                ];
              }),
            ),
          );
          if (resource === "campaigns" || resource === "campaign-metrics") {
            setMetrics(await api<Row>(`/campaigns/${id}/metrics`));
          }
        } else if (mode === "list") {
          const response = await api<Row>(`${definition.endpoint}?pageSize=100`);
          if (!active) return;
          setItems((response.items as readonly Row[]) ?? []);
        } else {
          setForm({
            type: resource === "segments" ? "DYNAMIC" : "EVENT_TRIGGERED",
            status: "DRAFT",
            timezone: "Africa/Tunis",
            schedule: "0 */6 * * *",
            ruleField: "activity.inactiveDays",
            ruleOperator: "GTE",
            ruleValue: "30",
            stepType: "NOTIFICATION",
            stepName: "Envoyer un rappel",
            delayMinutes: "0",
            frequencyCap: "1",
            frequencyWindowHours: "24",
            maxExecutionsPerCustomer: "1",
            optedIn: "true",
          });
        }
        setState("ready");
      } catch (error) {
        if (!active) return;
        setMessage(error instanceof Error ? error.message : "Chargement impossible");
        setState("error");
      }
    }
    void load();
    return () => {
      active = false;
    };
  }, [api, definition, id, mode, resource]);

  async function save(event: FormEvent) {
    event.preventDefault();
    setState("saving");
    try {
      const target = definition.createEndpoint ?? definition.endpoint;
      await api(mode === "detail" ? `${definition.endpoint}/${id}` : target, {
        method: resource === "communication-preferences" || mode === "detail" ? "PATCH" : "POST",
        body: JSON.stringify(payload(resource, definition.fields, form)),
      });
      setMessage("Enregistrement effectué.");
      setState("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible");
      setState("error");
    }
  }

  async function action(kind: string) {
    if (!id) return;
    setState("saving");
    try {
      if (kind === "preview" && detail) {
        const result = await api<Row>("/segments/preview", {
          method: "POST",
          body: JSON.stringify({
            organizationId: detail.organizationId,
            rules: detail.rules,
            limit: 20,
          }),
        });
        setMessage(`Aperçu: ${String(result.estimatedSize)} client(s).`);
      } else if (kind === "schedule") {
        const start = window.prompt(
          "Date ISO de démarrage",
          new Date(Date.now() + 3_600_000).toISOString(),
        );
        if (start) {
          await api(`/campaigns/${id}/schedule`, {
            method: "POST",
            body: JSON.stringify({ startsAt: start, timezone: "Africa/Tunis" }),
          });
        }
      } else {
        const endpoint =
          kind === "refresh"
            ? `/segments/${id}/refresh`
            : kind === "retry"
              ? `/notifications/deliveries/${id}/retry`
              : `/${resource === "automations" ? "automations" : "campaigns"}/${id}/${kind}`;
        await api(endpoint, { method: "POST", body: "{}" });
      }
      setMessage("Action exécutée.");
      setState("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible");
      setState("error");
    }
  }

  const actions: readonly (readonly [string, string])[] =
    mode !== "detail"
      ? []
      : resource === "segments"
        ? [
            ["preview", "Aperçu"],
            ["refresh", "Actualiser"],
          ]
        : resource === "campaigns"
          ? [
              ["review", "Soumettre"],
              ["approve", "Approuver"],
              ["schedule", "Planifier"],
              ["pause", "Pause"],
              ["resume", "Reprendre"],
              ["cancel", "Annuler"],
            ]
          : resource === "automations"
            ? [
                ["activate", "Activer"],
                ["pause", "Pause"],
                ["resume", "Reprendre"],
                ["cancel", "Annuler"],
              ]
            : resource === "notification-deliveries"
              ? [["retry", "Réessayer"]]
              : [];

  if (state === "loading") return <div className="state-panel">Chargement…</div>;

  return (
    <section className="resource-page ux-module-page ux-marketing-page" data-resource={resource}>
      <header className="resource-heading ux-module-heading">
        <div>
          <Eyebrow>Marketing et automatisations</Eyebrow>
          <h1>{definition.title}</h1>
          <p>{definition.description}</p>
        </div>
        <ResourceVisual
          alt={`Illustration ${definition.title}`}
          assets={resourceVisuals[resource]}
        />
        <div className="resource-actions">
          {actions.map(([key, label]) => (
            <Button key={key} onClick={() => void action(key)} type="button" variant="secondary">
              {label}
            </Button>
          ))}
          {mode === "list" && definition.creatable !== false ? (
            <ButtonLink href={`/workspace/${resource}/new`}>Créer</ButtonLink>
          ) : (
            <ButtonLink href={`/workspace/${resource}`} variant="secondary">
              Retour
            </ButtonLink>
          )}
        </div>
      </header>

      <div className="ux-guidance-strip">
        <span className="ux-guidance-strip__icon">
          {resource === "automations" ? "↳" : resource === "campaigns" ? "✦" : "1"}
        </span>
        <div>
          <strong>
            {resource === "segments"
              ? "Construisez une audience compréhensible avant de l’activer"
              : resource === "campaigns"
                ? "Préparez, prévisualisez, planifiez puis suivez"
                : resource === "automations"
                  ? "Reliez un déclencheur, une condition et une action"
                  : "Gardez un message clair et une préférence vérifiable"}
          </strong>
          <span>Une étape à la fois, avec un retour visible après chaque action.</span>
        </div>
        <a href="#marketing-content">Guide du module</a>
      </div>

      {message ? (
        <div className={`inline-message ${state === "error" ? "is-error" : "is-success"}`}>
          {message}
        </div>
      ) : null}

      {mode === "list" ? (
        <>
          {resource === "automations" && (
            <div className="ux-workflow-preview">
              <div>
                <span>Déclencheur</span>
                <strong>Événement client</strong>
              </div>
              <i>→</i>
              <div>
                <span>Condition</span>
                <strong>Segment éligible</strong>
              </div>
              <i>→</i>
              <div>
                <span>Action</span>
                <strong>Notifier</strong>
              </div>
              <ButtonLink href="/workspace/automations/new">Créer un workflow</ButtonLink>
            </div>
          )}
          <div className="ux-card-collection ux-marketing-collection" id="marketing-content">
            {items.map((row) => (
              <article className="ux-entity-card ux-marketing-card" key={String(row.id)}>
                <header>
                  <span className="ux-entity-card__icon">
                    <ResourceVisual alt="" assets={resourceVisuals[resource]} />
                  </span>
                  <StatusPill>{optionLabel(display(row, "status"))}</StatusPill>
                </header>
                <a
                  className="ux-entity-card__body"
                  href={`/workspace/${resource}/${String(row.id)}`}
                >
                  <span>{display(row, "code")}</span>
                  <h3>{display(row, "name")}</h3>
                  <p>{definition.description}</p>
                </a>
                <div className="ux-card-facts">
                  {definition.columns
                    .filter((column) => !["code", "name", "status"].includes(column))
                    .slice(0, 3)
                    .map((column) => (
                      <span key={column}>
                        <small>{columnLabel(column)}</small>
                        <strong>
                          {isOptionColumn(column)
                            ? optionLabel(display(row, column))
                            : display(row, column)}
                        </strong>
                      </span>
                    ))}
                </div>
                {resource === "campaigns" && (
                  <div className="ux-campaign-steps">
                    <span className="is-done">Audience</span>
                    <span className="is-done">Contenu</span>
                    <span>Envoi</span>
                  </div>
                )}
                <footer>
                  <a href={`/workspace/${resource}/${String(row.id)}`}>Ouvrir le workflow →</a>
                </footer>
              </article>
            ))}
            {items.length === 0 && <div className="empty-state">Aucune donnée disponible.</div>}
          </div>
          <div className="table-shell ux-legacy-table">
            <table>
              <thead>
                <tr>
                  {definition.columns.map((column) => (
                    <th key={column}>{columnLabel(column)}</th>
                  ))}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((row) => (
                  <tr key={String(row.id)}>
                    {definition.columns.map((column) => (
                      <td key={column}>
                        {column === "status" ? (
                          <StatusPill>{optionLabel(display(row, column))}</StatusPill>
                        ) : isOptionColumn(column) ? (
                          optionLabel(display(row, column))
                        ) : (
                          display(row, column)
                        )}
                      </td>
                    ))}
                    <td>
                      <ButtonLink href={`/workspace/${resource}/${String(row.id)}`} variant="quiet">
                        Ouvrir
                      </ButtonLink>
                    </td>
                  </tr>
                ))}
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={definition.columns.length + 1}>
                      <div className="empty-state">Aucune donnée disponible.</div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : definition.fields.length > 0 ? (
        <form className="resource-form ux-builder-form" onSubmit={(event) => void save(event)}>
          <header className="ux-builder-form__header">
            <div>
              <Eyebrow>
                {resource === "automations"
                  ? "Workflow builder"
                  : resource === "campaigns"
                    ? "Campaign builder"
                    : "Configuration guidée"}
              </Eyebrow>
              <h2>{mode === "new" ? "Construire étape par étape" : "Modifier la configuration"}</h2>
              <p>Définissez d’abord l’objectif, puis le ciblage et enfin l’exécution.</p>
            </div>
            <span>Étape 1 sur 4</span>
          </header>
          <div className="ux-builder-progress">
            <span className="is-active">Objectif</span>
            <span>Audience</span>
            <span>Contenu</span>
            <span>Planification</span>
          </div>
          <div className="form-grid">
            {definition.fields.map((field) => (
              <label
                className={field.type === "json" ? "form-field--structured" : undefined}
                key={field.name}
              >
                <span>{field.label}</span>
                {field.source ? (
                  <select
                    required={field.required}
                    value={form[field.name] ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [field.name]: event.target.value }))
                    }
                  >
                    <option value="">Sélectionner</option>
                    {(catalogs[field.source] ?? []).map((row) => (
                      <option key={String(row.id)} value={String(row.id)}>
                        {String(row.name ?? row.displayName ?? row.code ?? row.id)}
                      </option>
                    ))}
                  </select>
                ) : field.type === "select" || field.type === "boolean" ? (
                  <select
                    required={field.required}
                    value={form[field.name] ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [field.name]: event.target.value }))
                    }
                  >
                    {(field.type === "boolean" ? ["true", "false"] : (field.options ?? [])).map(
                      (option) => (
                        <option key={option} value={option}>
                          {optionLabel(option)}
                        </option>
                      ),
                    )}
                  </select>
                ) : field.type === "json" ? (
                  <StructuredDataEditor
                    fieldName={field.name}
                    value={form[field.name] ?? "{}"}
                    onChange={(nextValue) =>
                      setForm((current) => ({ ...current, [field.name]: nextValue }))
                    }
                  />
                ) : (
                  <input
                    required={field.required}
                    type={
                      field.type === "number"
                        ? "number"
                        : field.type === "date"
                          ? "datetime-local"
                          : "text"
                    }
                    value={form[field.name] ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [field.name]: event.target.value }))
                    }
                  />
                )}
              </label>
            ))}
          </div>
          <Button disabled={state === "saving"} type="submit">
            {state === "saving" ? "Enregistrement…" : "Enregistrer"}
          </Button>
        </form>
      ) : (
        <article className="detail-card">
          <h3>Détails opérationnels</h3>
          <pre>{JSON.stringify(detail, null, 2)}</pre>
        </article>
      )}

      {metrics ? (
        <article className="detail-card">
          <h3>Métriques de campagne</h3>
          <pre>{JSON.stringify(metrics, null, 2)}</pre>
        </article>
      ) : null}
    </section>
  );
}
