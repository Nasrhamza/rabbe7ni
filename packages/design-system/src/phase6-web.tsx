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

export type Phase6Resource =
  | "games"
  | "gamification"
  | "challenges"
  | "habits"
  | "badges"
  | "leaderboards"
  | "customer-gamification";

const resourceVisuals = {
  badges: [webAssets.badges.gold, webAssets.badges.silver, webAssets.badges.bronze],
  challenges: [webAssets.gamification.trophy],
  "customer-gamification": [webAssets.avatars.customer],
  gamification: [webAssets.gamification.spin, webAssets.gamification.scratch],
  games: [
    webAssets.gamification.spin,
    webAssets.gamification.scratch,
    webAssets.gamification.reward,
  ],
  habits: [webAssets.badges.missionComplete],
  leaderboards: [
    webAssets.badges.rankingGold,
    webAssets.badges.rankingSilver,
    webAssets.badges.rankingBronze,
  ],
} as const;

const optionLabels: Readonly<Record<string, string>> = {
  ACTIVE: "Actif",
  ALL_TIME: "Depuis le début",
  ARCHIVED: "Archivé",
  AUTOMATIC: "Automatique",
  BRANCH: "Point de vente",
  CHALLENGES: "Challenges",
  COMMON: "Commun",
  COMMUNITY: "Communautaire",
  DAILY: "Quotidien",
  DRAFT: "Brouillon",
  EPIC: "Épique",
  FRANCHISE: "Franchise",
  HIDDEN: "Masqué",
  INDIVIDUAL: "Individuel",
  LEGENDARY: "Légendaire",
  MANUAL: "Manuelle",
  MERCHANT: "Commerce",
  MONTHLY: "Mensuel",
  ONE_TIME: "Ponctuel",
  ORGANIZATION: "Organisation",
  POINTS: "Points",
  MYSTERY_BOX: "Coffre mystère",
  SCRATCH_CARD: "Carte à gratter",
  SPIN_WHEEL: "Roue de gains",
  RARE: "Rare",
  RECURRING: "Récurrent",
  STREAK: "Séries",
  SUSPENDED: "Suspendu",
  TENANT: "Compte client",
  UNCOMMON: "Peu commun",
  VISIBLE: "Visible",
  WEEKLY: "Hebdomadaire",
  XP: "XP",
  false: "Non",
  true: "Oui",
};

const columnLabels: Readonly<Record<string, string>> = {
  cadence: "Fréquence",
  code: "Code",
  endAt: "Fin",
  eventType: "Événement",
  metric: "Classement par",
  name: "Nom",
  objectiveType: "Objectif",
  period: "Période",
  phone: "Téléphone",
  rarity: "Rareté",
  scope: "Périmètre",
  startAt: "Début",
  status: "Statut",
  target: "Objectif",
  type: "Type",
  visibility: "Visibilité",
  xp: "XP",
};

function optionLabel(value: string): string {
  return optionLabels[value] ?? value.replaceAll("_", " ");
}

function columnLabel(value: string): string {
  return columnLabels[value] ?? value;
}

function isOptionColumn(column: string): boolean {
  return [
    "cadence",
    "metric",
    "period",
    "rarity",
    "scope",
    "status",
    "type",
    "visibility",
  ].includes(column);
}

type Row = Record<string, unknown>;
type Field = {
  name: string;
  label: string;
  required?: boolean;
  type?: "boolean" | "date" | "json" | "number" | "select" | "text";
  source?: "organizations" | "customers" | "badges" | "programs" | "rewards";
  options?: readonly string[];
};
type Definition = {
  title: string;
  description: string;
  endpoint: string;
  fields: readonly Field[];
  columns: readonly string[];
  creatable?: boolean;
};

const definitions: Record<Phase6Resource, Definition> = {
  games: {
    title: "Jeux et gains instantanés",
    description: "Roue, carte à gratter et coffre mystère avec probabilités contrôlées.",
    endpoint: "/games",
    fields: [
      { name: "organizationId", label: "Organisation", required: true, source: "organizations" },
      { name: "programId", label: "Programme de fidélité", required: true, source: "programs" },
      { name: "code", label: "Code", required: true },
      {
        name: "type",
        label: "Expérience",
        type: "select",
        options: ["SPIN_WHEEL", "SCRATCH_CARD", "MYSTERY_BOX"],
      },
      { name: "name", label: "Nom", required: true },
      { name: "description", label: "Description" },
      { name: "cooldownMinutes", label: "Délai entre deux essais (minutes)", type: "number" },
      { name: "dailyLimit", label: "Essais maximum par jour", type: "number" },
      { name: "startsAt", label: "Début", type: "date" },
      { name: "endsAt", label: "Fin", type: "date" },
    ],
    columns: ["code", "name", "type", "status", "dailyLimit", "cooldownMinutes"],
  },
  gamification: {
    title: "Moteur de gamification",
    description: "Règles XP, niveaux et progression du programme.",
    endpoint: "/gamification/xp-rules",
    fields: [
      { name: "organizationId", label: "Organisation", required: true, source: "organizations" },
      { name: "code", label: "Code", required: true },
      { name: "name", label: "Nom", required: true },
      { name: "eventType", label: "Événement déclencheur", required: true },
      { name: "xp", label: "XP attribué", required: true, type: "number" },
      { name: "priority", label: "Priorité", type: "number" },
      {
        name: "status",
        label: "Statut",
        type: "select",
        options: ["DRAFT", "ACTIVE", "SUSPENDED", "ARCHIVED"],
      },
    ],
    columns: ["code", "name", "eventType", "xp", "status"],
  },
  challenges: {
    title: "Challenges",
    description: "Défis individuels et communautaires, participants, progrès et récompenses.",
    endpoint: "/challenges",
    fields: [
      { name: "organizationId", label: "Organisation", required: true, source: "organizations" },
      { name: "code", label: "Code", required: true },
      { name: "name", label: "Nom", required: true },
      { name: "description", label: "Description" },
      {
        name: "type",
        label: "Type",
        type: "select",
        options: ["INDIVIDUAL", "COMMUNITY"],
      },
      {
        name: "cadence",
        label: "Cadence",
        type: "select",
        options: ["ONE_TIME", "DAILY", "WEEKLY", "RECURRING"],
      },
      {
        name: "validationMode",
        label: "Validation",
        type: "select",
        options: ["AUTOMATIC", "MANUAL"],
      },
      { name: "objectiveType", label: "Objectif/événement", required: true },
      { name: "target", label: "Cible", required: true, type: "number" },
      { name: "startAt", label: "Début", required: true, type: "date" },
      { name: "endAt", label: "Fin", required: true, type: "date" },
      { name: "autoEnroll", label: "Inscription automatique", type: "boolean" },
    ],
    columns: ["code", "name", "type", "cadence", "target", "status", "startAt", "endAt"],
  },
  habits: {
    title: "Habitudes et missions",
    description: "Missions récurrentes, suivi des jours consécutifs et droit à l’oubli.",
    endpoint: "/habits",
    fields: [
      { name: "organizationId", label: "Organisation", required: true, source: "organizations" },
      { name: "code", label: "Code", required: true },
      { name: "name", label: "Nom", required: true },
      { name: "description", label: "Description" },
      {
        name: "cadence",
        label: "Cadence",
        type: "select",
        options: ["DAILY", "WEEKLY"],
      },
      { name: "objectiveType", label: "Événement qualifiant", required: true },
      { name: "target", label: "Cible", required: true, type: "number" },
      { name: "timezone", label: "Fuseau horaire" },
      { name: "graceDays", label: "Jours de grâce", type: "number" },
      { name: "freezeAllowance", label: "Jokers de série", type: "number" },
      {
        name: "status",
        label: "Statut",
        type: "select",
        options: ["DRAFT", "ACTIVE", "SUSPENDED", "ARCHIVED"],
      },
    ],
    columns: ["code", "name", "cadence", "objectiveType", "target", "status"],
  },
  badges: {
    title: "Badges et réussites",
    description: "Catalogue, rareté, visibilité, conditions et collections clients.",
    endpoint: "/badges",
    fields: [
      { name: "organizationId", label: "Organisation", required: true, source: "organizations" },
      { name: "code", label: "Code", required: true },
      { name: "name", label: "Nom", required: true },
      { name: "description", label: "Description" },
      {
        name: "rarity",
        label: "Rareté",
        type: "select",
        options: ["COMMON", "UNCOMMON", "RARE", "EPIC", "LEGENDARY"],
      },
      {
        name: "visibility",
        label: "Visibilité",
        type: "select",
        options: ["VISIBLE", "HIDDEN"],
      },
      {
        name: "status",
        label: "Statut",
        type: "select",
        options: ["DRAFT", "ACTIVE", "SUSPENDED", "ARCHIVED"],
      },
    ],
    columns: ["code", "name", "rarity", "visibility", "status"],
  },
  leaderboards: {
    title: "Classements",
    description: "Classements par période et par périmètre, avec respect de la confidentialité.",
    endpoint: "/leaderboards",
    fields: [
      { name: "code", label: "Code", required: true },
      { name: "name", label: "Nom", required: true },
      {
        name: "scope",
        label: "Périmètre",
        type: "select",
        options: ["TENANT", "ORGANIZATION", "FRANCHISE", "MERCHANT", "BRANCH"],
      },
      { name: "scopeId", label: "Élément concerné" },
      {
        name: "period",
        label: "Période",
        type: "select",
        options: ["DAILY", "WEEKLY", "MONTHLY", "ALL_TIME"],
      },
      {
        name: "metric",
        label: "Classement par",
        type: "select",
        options: ["XP", "POINTS", "CHALLENGES", "STREAK"],
      },
      { name: "maxEntries", label: "Nombre de places", type: "number" },
      { name: "anonymizeOptedOut", label: "Anonymiser les opt-out", type: "boolean" },
      { name: "schedule", label: "Fréquence de mise à jour" },
      {
        name: "status",
        label: "Statut",
        type: "select",
        options: ["DRAFT", "ACTIVE", "SUSPENDED", "ARCHIVED"],
      },
    ],
    columns: ["code", "name", "scope", "period", "metric", "status"],
  },
  "customer-gamification": {
    title: "Profils gamification clients",
    description: "XP, niveau, badges, séries, historique et corrections autorisées.",
    endpoint: "/customers",
    fields: [],
    columns: ["displayName", "email", "phone", "status"],
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

function normalizePayload(fields: readonly Field[], form: Record<string, string>) {
  return Object.fromEntries(
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
}

export function Phase6ResourceScreen({
  apiUrl,
  resource,
  mode,
  id,
}: Readonly<{
  apiUrl: string;
  resource: Phase6Resource;
  mode: "detail" | "list" | "new";
  id?: string;
}>) {
  const definition = definitions[resource];
  const [items, setItems] = useState<readonly Row[]>([]);
  const [detail, setDetail] = useState<Row | null>(null);
  const [auxiliary, setAuxiliary] = useState<Record<string, unknown>>({});
  const [catalogs, setCatalogs] = useState<Record<string, readonly Row[]>>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [prizeDrafts, setPrizeDrafts] = useState<Row[]>([]);
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
            message?: string;
          } | null;
          throw new Error(problem?.message ?? `Erreur HTTP ${response.status}`);
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
        if (resource === "games" && !sources.includes("rewards")) sources.push("rewards");
        const sourcePairs = await Promise.all(
          sources.map(async (source) => {
            const path =
              source === "programs" ? "/loyalty-programs?pageSize=100" : `/${source}?pageSize=100`;
            const response = await api<Row | readonly Row[]>(path);
            const rows = Array.isArray(response)
              ? response
              : (((response as Row).items as readonly Row[]) ?? []);
            return [source, rows] as const;
          }),
        );
        if (!active) return;
        setCatalogs(Object.fromEntries(sourcePairs));

        if (mode === "detail" && id) {
          const path =
            resource === "customer-gamification"
              ? `/gamification/profile?customerId=${id}`
              : `${definition.endpoint}/${id}`;
          const response = await api<Row>(path);
          if (!active) return;
          setDetail(response);
          if (resource === "games") {
            setPrizeDrafts(
              (((response.prizes as readonly Row[] | undefined) ?? []).map((prize) => ({
                ...prize,
              })) as Row[]) ?? [],
            );
          }
          setForm(
            Object.fromEntries(
              definition.fields.map((field) => {
                const value = response[field.name];
                if (field.type === "date" && typeof value === "string") {
                  return [field.name, value.slice(0, 16)];
                }
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
        } else if (mode === "list") {
          const response = await api<Row | readonly Row[]>(
            resource === "games" ? "/games?view=management" : `${definition.endpoint}?pageSize=100`,
          );
          if (!active) return;
          setItems(
            Array.isArray(response)
              ? response
              : (((response as Row).items as readonly Row[]) ?? []),
          );
          if (resource === "gamification") {
            const [config, levels] = await Promise.all([
              api<Row>("/gamification/config"),
              api<readonly Row[]>("/gamification/levels"),
            ]);
            setAuxiliary({ config, levels });
          }
          if (resource === "habits") {
            setAuxiliary({ streakRules: await api<readonly Row[]>("/habits/streaks/rules") });
          }
        } else {
          setForm({
            status: "DRAFT",
            conditions: "{}",
            eligibility: "{}",
            recurrence: "{}",
            metadata: "{}",
            priority: "100",
            target: "1",
            graceDays: "0",
            freezeAllowance: "0",
            maxEntries: "100",
            schedule: "0 * * * *",
            cooldownMinutes: "1440",
            dailyLimit: "1",
            type: resource === "games" ? "SPIN_WHEEL" : "",
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
      const payload = normalizePayload(definition.fields, form);
      const saved = await api<Row>(
        mode === "detail" ? `${definition.endpoint}/${id}` : definition.endpoint,
        {
          method: mode === "detail" ? "PATCH" : "POST",
          body: JSON.stringify(payload),
        },
      );
      setMessage("Enregistrement effectué.");
      setState("success");
      if (resource === "games" && mode === "new") {
        window.location.assign(`/workspace/games/${String(saved.id)}`);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible");
      setState("error");
    }
  }

  function updatePrize(index: number, key: string, value: string | number | boolean) {
    setPrizeDrafts((current) =>
      current.map((prize, prizeIndex) =>
        prizeIndex === index ? { ...prize, [key]: value } : prize,
      ),
    );
  }

  function addPrize() {
    setPrizeDrafts((current) => [
      ...current,
      {
        active: true,
        code: `LOT-${current.length + 1}`,
        color: "#2563eb",
        label: "Nouveau lot",
        points: 0,
        probabilityWeight: 10,
        type: "TRY_AGAIN",
      },
    ]);
  }

  async function savePrizes() {
    if (!id || prizeDrafts.length < 2) {
      setMessage("Ajoutez au moins deux résultats possibles.");
      setState("error");
      return;
    }
    try {
      setState("saving");
      await api(`/games/${id}/prizes`, {
        method: "PUT",
        body: JSON.stringify({
          prizes: prizeDrafts.map((prize) => ({
            active: prize.active !== false,
            code: String(prize.code ?? ""),
            color: String(prize.color ?? "#2563eb"),
            label: String(prize.label ?? ""),
            metadata: {},
            points: Number(prize.points ?? 0),
            probabilityWeight: Number(prize.probabilityWeight ?? 1),
            type: String(prize.type ?? "TRY_AGAIN"),
            ...(prize.rewardId ? { rewardId: String(prize.rewardId) } : {}),
            ...(prize.discountPercent ? { discountPercent: Number(prize.discountPercent) } : {}),
            ...(prize.stockQuantity !== null && prize.stockQuantity !== undefined
              ? { stockQuantity: Number(prize.stockQuantity) }
              : {}),
          })),
        }),
      });
      setMessage("Lots et probabilités enregistrés.");
      setState("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Configuration des lots impossible");
      setState("error");
    }
  }

  async function action(kind: string) {
    try {
      setState("saving");
      if (kind === "level") {
        const level = Number(window.prompt("Numéro du niveau", "4"));
        const xpThreshold = Number(window.prompt("Seuil XP", "6000"));
        const name = window.prompt("Nom du niveau", "Platinum") ?? "Level";
        await api("/gamification/levels", {
          method: "POST",
          body: JSON.stringify({
            code: name.toUpperCase().replaceAll(" ", "-"),
            name,
            level,
            xpThreshold,
            status: "ACTIVE",
          }),
        });
      }
      if (kind === "config") {
        await api("/gamification/config", {
          method: "PATCH",
          body: JSON.stringify({
            active: true,
            defaultTimezone: window.prompt("Fuseau horaire", "Africa/Tunis") ?? "UTC",
            allowManualCorrection: true,
          }),
        });
      }
      if (kind === "streak") {
        const organizationId = window.prompt("ID organisation") ?? "";
        await api("/habits/streaks/rules", {
          method: "POST",
          body: JSON.stringify({
            organizationId,
            code: `STREAK-${Date.now()}`,
            name: window.prompt("Nom de la règle", "Série quotidienne") ?? "Série",
            qualifyingEvent: window.prompt("Événement qualifiant", "loyalty.qr.completed.v1") ?? "",
            status: "ACTIVE",
            timezone: "Africa/Tunis",
            graceDays: 1,
            freezeAllowance: 1,
          }),
        });
      }
      if (kind === "achievement" && id) {
        await api("/badges/achievement-rules", {
          method: "POST",
          body: JSON.stringify({
            badgeId: id,
            code: `ACH-${Date.now()}`,
            eventType: window.prompt("Événement", "loyalty.points.posted.v1") ?? "",
            target: Number(window.prompt("Cible", "1")),
            status: "ACTIVE",
          }),
        });
      }
      if (kind === "snapshot" && id) {
        await api(`/leaderboards/${id}/snapshots`, {
          method: "POST",
          body: JSON.stringify({}),
        });
      }
      if (kind === "xp" && id) {
        await api("/gamification/xp/adjust", {
          method: "POST",
          body: JSON.stringify({
            customerId: id,
            xp: Number(window.prompt("Correction XP signée", "100")),
            reason: window.prompt("Motif de correction", "Correction autorisée") ?? "",
            authorizedCorrection: true,
            idempotencyKey: crypto.randomUUID(),
          }),
        });
      }
      if ((kind === "activate-game" || kind === "suspend-game") && id) {
        await api(`/games/${id}/status`, {
          method: "POST",
          body: JSON.stringify({ status: kind === "activate-game" ? "ACTIVE" : "SUSPENDED" }),
        });
      }
      setMessage("Action exécutée.");
      setState("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible");
      setState("error");
    }
  }

  const actions: readonly (readonly [string, string])[] =
    mode === "detail" && resource === "games"
      ? [
          ["activate-game", "Activer"],
          ["suspend-game", "Suspendre"],
        ]
      : resource === "gamification"
        ? [
            ["config", "Configurer"],
            ["level", "Ajouter un niveau"],
          ]
        : resource === "habits"
          ? [["streak", "Nouvelle règle de streak"]]
          : mode === "detail" && resource === "badges"
            ? [["achievement", "Ajouter une condition"]]
            : mode === "detail" && resource === "leaderboards"
              ? [["snapshot", "Générer le snapshot"]]
              : mode === "detail" && resource === "customer-gamification"
                ? [["xp", "Correction XP"]]
                : [];

  if (state === "loading") return <div className="state-panel">Chargement…</div>;

  return (
    <section className="resource-page ux-module-page ux-engagement-page" data-resource={resource}>
      <header className="resource-heading ux-module-heading">
        <div>
          <Eyebrow>Engagement et gamification</Eyebrow>
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
        <span className="ux-guidance-strip__icon">1</span>
        <div>
          <strong>
            {mode === "list"
              ? resource === "challenges"
                ? "Commencez par un objectif simple et mesurable"
                : resource === "badges"
                  ? "Utilisez la rareté pour rendre la progression lisible"
                  : "Configurez une règle, testez-la puis activez-la"
              : "Suivez les étapes, enregistrez un brouillon puis vérifiez l’expérience client"}
          </strong>
          <span>Les actions sensibles restent auditées et limitées à votre périmètre.</span>
        </div>
        <a href="#module-content">Voir les recommandations</a>
      </div>

      {message ? (
        <div className={`inline-message ${state === "error" ? "is-error" : "is-success"}`}>
          {message}
        </div>
      ) : null}

      {mode === "list" ? (
        <>
          {resource === "gamification" ? (
            <div className="ux-game-overview">
              <article className="detail-card ux-game-config">
                <span>Configuration active</span>
                <h3>Moteur XP</h3>
                <p>
                  Les règles ci-dessous déterminent la progression, les niveaux et les récompenses
                  accessibles.
                </p>
                <div className="ux-game-config__facts">
                  {Object.entries((auxiliary.config as Row | undefined) ?? {})
                    .filter(([key]) => !["id", "tenantId", "createdAt", "updatedAt"].includes(key))
                    .slice(0, 4)
                    .map(([key, value]) => (
                      <span key={key}>
                        <small>{key}</small>
                        <strong>{display({ value }, "value")}</strong>
                      </span>
                    ))}
                  {Object.keys((auxiliary.config as Row | undefined) ?? {}).length === 0 && (
                    <span>
                      <small>État</small>
                      <strong>Prêt à configurer</strong>
                    </span>
                  )}
                </div>
              </article>
              <article className="detail-card ux-levels-panel">
                <header>
                  <div>
                    <span>Parcours client</span>
                    <h3>Niveaux de progression</h3>
                  </div>
                  <strong>
                    {((auxiliary.levels as readonly Row[] | undefined) ?? []).length} niveaux
                  </strong>
                </header>
                <div className="ux-level-track">
                  {((auxiliary.levels as readonly Row[] | undefined) ?? []).map((level, index) => (
                    <div className="ux-level-track__item" key={String(level.id ?? index)}>
                      <span>{display(level, "level")}</span>
                      <div>
                        <strong>{display(level, "name")}</strong>
                        <small>{display(level, "xpThreshold")} XP requis</small>
                      </div>
                      <StatusPill>{optionLabel(display(level, "status"))}</StatusPill>
                    </div>
                  ))}
                </div>
              </article>
            </div>
          ) : null}
          {resource === "habits" ? (
            <article className="detail-card">
              <h3>Configuration des séries</h3>
              <div className="ux-rule-board">
                {((auxiliary.streakRules as readonly Row[] | undefined) ?? []).map(
                  (rule, index) => (
                    <article key={String(rule.id ?? index)}>
                      <span>{display(rule, "code")}</span>
                      <strong>{display(rule, "name")}</strong>
                      <small>{optionLabel(display(rule, "status"))} · série suivie</small>
                    </article>
                  ),
                )}
                {((auxiliary.streakRules as readonly Row[] | undefined) ?? []).length === 0 && (
                  <p>Aucune règle de série configurée.</p>
                )}
              </div>
            </article>
          ) : null}
          <div className="ux-card-collection ux-gamification-collection" id="module-content">
            {items.map((row) => (
              <article className="ux-entity-card ux-gamification-card" key={String(row.id)}>
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
                <footer>
                  <a href={`/workspace/${resource}/${String(row.id)}`}>Configurer →</a>
                </footer>
              </article>
            ))}
            {items.length === 0 && (
              <div className="empty-state">Aucun élément pour ce périmètre.</div>
            )}
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
                      <div className="empty-state">Aucun élément pour ce périmètre.</div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </>
      ) : mode === "detail" && resource === "customer-gamification" ? (
        <div className="detail-grid">
          <article className="detail-card">
            <h3>Progression</h3>
            <div className="ux-operational-facts">
              {Object.entries(detail ?? {})
                .filter(([key]) => !["id", "tenantId", "metadata"].includes(key))
                .slice(0, 8)
                .map(([key, value]) => (
                  <span key={key}>
                    <small>{key}</small>
                    <strong>{display({ value }, "value")}</strong>
                  </span>
                ))}
            </div>
          </article>
          <article className="detail-card">
            <h3>Actions autorisées</h3>
            <p>Correction XP auditée et protégée par la permission gamification.adjust.</p>
          </article>
        </div>
      ) : (
        <form className="resource-form ux-builder-form" onSubmit={(event) => void save(event)}>
          <header className="ux-builder-form__header">
            <div>
              <Eyebrow>Assistant de configuration</Eyebrow>
              <h2>{mode === "new" ? "Créer étape par étape" : "Modifier la configuration"}</h2>
              <p>
                Identité, règles, récompenses et validation sont regroupées dans un flux lisible.
              </p>
            </div>
            <span>Étape 1 sur 3</span>
          </header>
          <div className="ux-builder-progress">
            <span className="is-active">Identité</span>
            <span>Conditions</span>
            <span>Validation</span>
          </div>
          <div className="form-grid">
            {definition.fields.map((field) => (
              <label
                className={
                  field.type === "json" ? "form-field form-field--structured" : "form-field"
                }
                key={field.name}
              >
                <span>{field.label}</span>
                {field.source || field.options ? (
                  <select
                    required={field.required}
                    value={form[field.name] ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [field.name]: event.target.value }))
                    }
                  >
                    <option value="">Sélectionner</option>
                    {(
                      field.options ??
                      catalogs[field.source ?? ""]?.map((row) => String(row.id)) ??
                      []
                    ).map((option, index) => {
                      const row = field.source ? catalogs[field.source]?.[index] : undefined;
                      return (
                        <option key={option} value={option}>
                          {row ? display(row, "displayName") : optionLabel(option)}
                        </option>
                      );
                    })}
                  </select>
                ) : field.type === "boolean" ? (
                  <select
                    value={form[field.name] ?? "false"}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [field.name]: event.target.value }))
                    }
                  >
                    <option value="false">Non</option>
                    <option value="true">Oui</option>
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
          {resource === "games" && mode === "detail" ? (
            <section className="r-game-prize-editor">
              <header>
                <div>
                  <Eyebrow>Probabilités et lots</Eyebrow>
                  <h3>Résultats possibles</h3>
                  <p>Le poids relatif détermine la chance de chaque résultat.</p>
                </div>
                <Button onClick={addPrize} type="button" variant="secondary">
                  + Ajouter un lot
                </Button>
              </header>
              <div className="r-game-prize-editor__list">
                {prizeDrafts.map((prize, index) => (
                  <article key={String(prize.id ?? index)}>
                    <label>
                      <span>Code</span>
                      <input
                        value={String(prize.code ?? "")}
                        onChange={(event) => updatePrize(index, "code", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Libellé client</span>
                      <input
                        value={String(prize.label ?? "")}
                        onChange={(event) => updatePrize(index, "label", event.target.value)}
                      />
                    </label>
                    <label>
                      <span>Type de gain</span>
                      <select
                        value={String(prize.type ?? "TRY_AGAIN")}
                        onChange={(event) => updatePrize(index, "type", event.target.value)}
                      >
                        <option value="POINTS">Points</option>
                        <option value="REWARD">Récompense</option>
                        <option value="DISCOUNT">Remise</option>
                        <option value="TRY_AGAIN">Réessayer</option>
                      </select>
                    </label>
                    {prize.type === "POINTS" ? (
                      <label>
                        <span>Points</span>
                        <input
                          min="1"
                          type="number"
                          value={Number(prize.points ?? 0)}
                          onChange={(event) =>
                            updatePrize(index, "points", Number(event.target.value))
                          }
                        />
                      </label>
                    ) : prize.type === "REWARD" || prize.type === "DISCOUNT" ? (
                      <label>
                        <span>Récompense liée</span>
                        <select
                          value={String(prize.rewardId ?? "")}
                          onChange={(event) => updatePrize(index, "rewardId", event.target.value)}
                        >
                          <option value="">Sélectionner</option>
                          {(catalogs.rewards ?? []).map((reward) => (
                            <option key={String(reward.id)} value={String(reward.id)}>
                              {display(reward, "name")}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : (
                      <span className="r-game-prize-editor__empty">Aucun gain attribué</span>
                    )}
                    <label>
                      <span>Poids de probabilité</span>
                      <input
                        min="1"
                        type="number"
                        value={Number(prize.probabilityWeight ?? 1)}
                        onChange={(event) =>
                          updatePrize(index, "probabilityWeight", Number(event.target.value))
                        }
                      />
                    </label>
                    <label>
                      <span>Couleur</span>
                      <input
                        type="color"
                        value={String(prize.color ?? "#2563eb")}
                        onChange={(event) => updatePrize(index, "color", event.target.value)}
                      />
                    </label>
                    <button
                      aria-label={`Supprimer ${String(prize.label ?? "ce lot")}`}
                      className="r-structured-remove"
                      disabled={prizeDrafts.length <= 2}
                      onClick={() =>
                        setPrizeDrafts((current) => current.filter((_, item) => item !== index))
                      }
                      type="button"
                    >
                      ×
                    </button>
                  </article>
                ))}
                {prizeDrafts.length === 0 ? (
                  <div className="empty-state">
                    Ajoutez au moins deux résultats: un gain et une alternative.
                  </div>
                ) : null}
              </div>
              <footer>
                <Button
                  disabled={state === "saving"}
                  onClick={() => void savePrizes()}
                  type="button"
                >
                  Enregistrer les lots
                </Button>
              </footer>
            </section>
          ) : null}
          {detail ? (
            <article className="detail-card">
              <h3>Données opérationnelles</h3>
              <div className="ux-operational-facts">
                {Object.entries(detail)
                  .filter(
                    ([key]) =>
                      !["id", "tenantId", "createdAt", "updatedAt", "metadata"].includes(key),
                  )
                  .slice(0, 10)
                  .map(([key, value]) => (
                    <span key={key}>
                      <small>{key}</small>
                      <strong>{display({ value }, "value")}</strong>
                    </span>
                  ))}
              </div>
            </article>
          ) : null}
          <div className="resource-actions">
            <Button disabled={state === "saving"} type="submit">
              {state === "saving" ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </form>
      )}
    </section>
  );
}
