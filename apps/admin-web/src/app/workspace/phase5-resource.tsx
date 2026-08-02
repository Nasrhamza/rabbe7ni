"use client";

import {
  AssetImage,
  Button,
  ButtonLink,
  Eyebrow,
  Icon,
  ResourceVisual,
  StatusPill,
  StructuredDataEditor,
  webAssets,
} from "@rabbehni/design-system/web";
import { useEffect, useMemo, useState, type FormEvent } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export type Phase5Resource = "customers" | "loyalty" | "points" | "rewards" | "qr" | "visits";
const resourceVisuals = {
  customers: [webAssets.avatars.customer],
  loyalty: [webAssets.gamification.favorite],
  points: [webAssets.gamification.favorite],
  qr: [webAssets.icons.lock],
  rewards: [webAssets.gamification.reward],
  visits: [webAssets.icons.location],
} as const;
type Row = Record<string, unknown>;
type Field = {
  hidden?: boolean;
  name: string;
  label: string;
  required?: boolean;
  type?: "boolean" | "json" | "number" | "select" | "text";
  source?: "organizations" | "customers" | "programs" | "categories";
};

const definitions: Record<
  Phase5Resource,
  {
    title: string;
    description: string;
    endpoint: string;
    createEndpoint?: string;
    fields: readonly Field[];
    columns: readonly string[];
  }
> = {
  customers: {
    title: "Clients",
    description: "Profils, consentements, préférences et historique d’activité.",
    endpoint: "/customers",
    fields: [
      { name: "organizationId", label: "Organisation", required: true, source: "organizations" },
      { name: "externalReference", label: "Référence externe" },
      { name: "displayName", label: "Nom affiché", required: true },
      { name: "firstName", label: "Prénom" },
      { name: "lastName", label: "Nom" },
      { name: "email", label: "Email" },
      { name: "phone", label: "Téléphone" },
      { name: "locale", label: "Locale", required: true },
    ],
    columns: ["displayName", "email", "phone", "status"],
  },
  loyalty: {
    title: "Programmes de fidélité",
    description: "Points, seuils, expiration, règles et périmètre d’application.",
    endpoint: "/loyalty-programs",
    fields: [
      { name: "organizationId", label: "Organisation", required: true, source: "organizations" },
      { name: "code", label: "Code", required: true },
      { name: "name", label: "Nom", required: true },
      { name: "description", label: "Description" },
      { name: "pointsLabel", label: "Libellé des points", required: true },
      { name: "expirationDays", label: "Expiration (jours)", type: "number" },
      { name: "minimumEarnPoints", label: "Gain minimum", required: true, type: "number" },
      { name: "maximumEarnPoints", label: "Gain maximum", type: "number" },
      { name: "minimumRedeemPoints", label: "Échange minimum", required: true, type: "number" },
      { name: "maximumRedeemPoints", label: "Échange maximum", type: "number" },
      { name: "appliesToAllMerchants", label: "Tous les commerces", type: "boolean" },
      { name: "appliesToAllBranches", label: "Tous les points de vente", type: "boolean" },
    ],
    columns: ["code", "name", "pointsLabel", "status"],
  },
  points: {
    title: "Transactions de points",
    description: "Ledger immuable et ajustements manuels audités.",
    endpoint: "/points/transactions",
    createEndpoint: "/points/adjust",
    fields: [
      { name: "customerId", label: "Client", required: true, source: "customers" },
      { name: "programId", label: "Programme", required: true, source: "programs" },
      { name: "points", label: "Points signés", required: true, type: "number" },
      { name: "reason", label: "Motif", required: true },
      { hidden: true, name: "idempotencyKey", label: "Référence technique", required: true },
    ],
    columns: ["type", "points", "customer", "program", "createdAt"],
  },
  rewards: {
    title: "Catalogue de récompenses",
    description: "Coût, stock, disponibilité, éligibilité et rédemptions.",
    endpoint: "/rewards",
    fields: [
      { name: "organizationId", label: "Organisation", required: true, source: "organizations" },
      { name: "programId", label: "Programme", required: true, source: "programs" },
      { name: "categoryId", label: "Catégorie", source: "categories" },
      { name: "code", label: "Code", required: true },
      { name: "name", label: "Nom", required: true },
      { name: "description", label: "Description" },
      { name: "pointsCost", label: "Coût en points", required: true, type: "number" },
      { name: "stockQuantity", label: "Stock", type: "number" },
      { name: "unlimitedStock", label: "Stock illimité", type: "boolean" },
    ],
    columns: ["code", "name", "pointsCost", "stockQuantity", "status"],
  },
  qr: {
    title: "Historique QR",
    description: "Scans, rejets, anti-replay et références des transactions.",
    endpoint: "/qr/transactions",
    fields: [],
    columns: ["purpose", "status", "customer", "resultReference", "occurredAt"],
  },
  visits: {
    title: "Visites et check-ins",
    description: "Passages validés par QR, commerce et point de vente.",
    endpoint: "/visits",
    fields: [],
    columns: ["status", "customer", "merchant", "branch", "source", "visitedAt"],
  },
};

async function api<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}/v1${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers },
    ...init,
  });
  if (!response.ok) {
    const problem = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(problem?.message ?? `Erreur HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}

function value(row: Row, key: string): string {
  const nested = row[key];
  if (key === "customer") return value((nested as Row | undefined) ?? {}, "displayName");
  if (key === "program") return value((nested as Row | undefined) ?? {}, "name");
  if (nested === undefined || nested === null || nested === "") return "—";
  if (typeof nested === "object") return JSON.stringify(nested);
  return String(nested);
}

export function Phase5ResourceScreen({
  resource,
  mode,
  id,
}: Readonly<{ resource: Phase5Resource; mode: "detail" | "list" | "new"; id?: string }>) {
  const definition = definitions[resource];
  const fields = useMemo(
    () =>
      mode === "detail"
        ? definition.fields.filter(
            (field) => !["organizationId", "programId", "code"].includes(field.name),
          )
        : definition.fields,
    [definition.fields, mode],
  );
  const [items, setItems] = useState<readonly Row[]>([]);
  const [detail, setDetail] = useState<Row | null>(null);
  const [catalogs, setCatalogs] = useState<Record<string, readonly Row[]>>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return items;
    return items.filter((item) => JSON.stringify(item).toLocaleLowerCase().includes(normalized));
  }, [items, query]);
  const [state, setState] = useState<"error" | "loading" | "ready" | "saving" | "success">(
    "loading",
  );

  useEffect(() => {
    let active = true;
    async function load() {
      setState("loading");
      try {
        const sources = [
          ...new Set(fields.flatMap((field) => (field.source ? [field.source] : []))),
        ];
        const pairs = await Promise.all(
          sources.map(async (source) => {
            const path =
              source === "programs"
                ? "/loyalty-programs?pageSize=100"
                : source === "categories"
                  ? "/rewards/categories"
                  : `/${source}?pageSize=100`;
            const response = await api<Row | readonly Row[]>(path);
            return [
              source,
              Array.isArray(response)
                ? response
                : (((response as Row).items as readonly Row[]) ?? []),
            ] as const;
          }),
        );
        if (!active) return;
        setCatalogs(Object.fromEntries(pairs));
        if (mode === "list") {
          const response = await api<{ items: readonly Row[] }>(
            `${definition.endpoint}?pageSize=100`,
          );
          setItems(response.items);
        } else if (mode === "detail" && id) {
          const response = await api<Row>(`${definition.endpoint}/${id}`);
          setDetail(response);
          setForm(
            Object.fromEntries(
              fields.map((field) => {
                const raw = response[field.name];
                return [
                  field.name,
                  typeof raw === "object" && raw !== null
                    ? JSON.stringify(raw, null, 2)
                    : String(raw ?? ""),
                ];
              }),
            ),
          );
        } else {
          setForm(
            Object.fromEntries(
              fields.map((field) => [
                field.name,
                field.type === "json"
                  ? "{}"
                  : field.type === "boolean"
                    ? "false"
                    : field.name === "locale"
                      ? "fr-TN"
                      : field.name === "pointsLabel"
                        ? "points"
                        : field.name === "minimumEarnPoints" || field.name === "minimumRedeemPoints"
                          ? "1"
                          : field.name === "idempotencyKey"
                            ? `manual:${crypto.randomUUID()}`
                            : "",
              ]),
            ),
          );
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
  }, [definition.endpoint, fields, id, mode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState("saving");
    try {
      const payload = Object.fromEntries(
        Object.entries(form)
          .filter(([, entry]) => entry !== "")
          .map(([key, entry]) => {
            const field = fields.find((candidate) => candidate.name === key);
            return [
              key,
              field?.type === "json"
                ? JSON.parse(entry)
                : field?.type === "number"
                  ? Number(entry)
                  : field?.type === "boolean"
                    ? entry === "true"
                    : entry,
            ];
          }),
      );
      const endpoint =
        mode === "new"
          ? (definition.createEndpoint ?? definition.endpoint)
          : `${definition.endpoint}/${id}`;
      const response = await api<Row>(endpoint, {
        method: mode === "new" ? "POST" : "PATCH",
        body: JSON.stringify(payload),
      });
      setMessage("Enregistrement réussi.");
      setState("success");
      if (mode === "new" && resource !== "points") {
        window.location.assign(`/workspace/${resource}/${String(response.id)}`);
      } else if (resource === "points") {
        window.location.assign("/workspace/points");
      } else {
        setDetail(response);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible");
      setState("error");
    }
  }

  async function action(path: string, body: Row = {}) {
    if (
      (path.includes("/archive") || body.status === "SUSPENDED") &&
      !window.confirm("Confirmer cette action sensible ?")
    )
      return;
    setState("saving");
    try {
      const response = await api<Row>(path, { method: "POST", body: JSON.stringify(body) });
      setDetail(response);
      setMessage("Action exécutée.");
      setState("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible");
      setState("error");
    }
  }

  async function addRule(kind: "earning" | "redemption") {
    if (!id) return;
    const code = window.prompt("Code de la règle");
    const name = window.prompt("Nom de la règle");
    if (!code || !name) return;
    const body =
      kind === "earning"
        ? { code, name, eventType: "purchase", points: 1, multiplier: 1 }
        : { code, name, minimumPoints: 100, incrementPoints: 50 };
    await action(`/loyalty-programs/${id}/${kind}-rules`, body);
    window.location.reload();
  }

  if (state === "loading")
    return (
      <div className="management-state">
        <h2>Chargement…</h2>
        <p>Chargement des données accessibles à votre compte.</p>
      </div>
    );

  if (mode.startsWith("li")) {
    const activityMode = resource === "points" || resource === "qr" || resource === "visits";
    return (
      <section
        className="management-page ux-module-page ux-experience-page"
        data-resource={resource}
      >
        <header className="management-heading ux-module-heading">
          <div>
            <Eyebrow>
              {resource === "customers"
                ? "Relation client"
                : resource === "loyalty"
                  ? "Program builder"
                  : resource === "rewards"
                    ? "Catalogue"
                    : "Activité sécurisée"}
            </Eyebrow>
            <h2>{definition.title}</h2>
            <p>{definition.description}</p>
          </div>
          {resource !== "qr" && resource !== "visits" && (
            <ButtonLink href={`/workspace/${resource}/new`}>
              + {resource === "points" ? "Ajuster des points" : "Créer"}
            </ButtonLink>
          )}
        </header>

        <div className="ux-experience-summary">
          <article>
            <Icon
              name={
                resource === "customers"
                  ? "customer"
                  : resource === "loyalty"
                    ? "reward"
                    : resource === "points"
                      ? "points"
                      : resource === "qr" || resource === "visits"
                        ? "qr"
                        : "reward"
              }
            />
            <div>
              <strong>{items.length}</strong>
              <span>{activityMode ? "transactions" : "éléments configurés"}</span>
            </div>
          </article>
          <article>
            <span className="ux-mini-chart">
              <i />
              <i />
              <i />
              <i />
              <i />
            </span>
            <div>
              <strong>+12,4 %</strong>
              <span>sur les 30 derniers jours</span>
            </div>
          </article>
          <aside>
            <span>Conseil</span>
            <strong>
              {resource === "customers"
                ? "Consultez la timeline avant de contacter un client."
                : resource === "loyalty"
                  ? "Testez vos seuils avant l’activation."
                  : resource === "rewards"
                    ? "Surveillez les stocks faibles."
                    : "Utilisez les filtres pour isoler une anomalie."}
            </strong>
          </aside>
        </div>

        <div className="ux-collection-toolbar">
          <label>
            <Icon name="search" />
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Rechercher par nom, référence ou statut…"
              value={query}
            />
          </label>
          <span>{visibleItems.length} résultat(s)</span>
          <button type="button">Filtres</button>
          <button type="button">Période : 30 jours</button>
        </div>

        {message && <div className="management-notice management-notice--error">{message}</div>}

        {visibleItems.length === 0 ? (
          <div className="ux-first-use">
            <AssetImage alt="" src={webAssets.files.emptySearch} />
            <div>
              <Eyebrow>Première utilisation</Eyebrow>
              <h2>
                {query
                  ? "Aucun résultat"
                  : `Commencez avec ${definition.title.toLocaleLowerCase()}`}
              </h2>
              <p>
                {query
                  ? "Modifiez vos critères de recherche."
                  : "Suivez le parcours guidé pour créer une configuration claire et exploitable."}
              </p>
              {!query && resource !== "qr" && resource !== "visits" && (
                <ButtonLink href={`/workspace/${resource}/new`}>Commencer</ButtonLink>
              )}
            </div>
          </div>
        ) : activityMode ? (
          <div className="ux-activity-stream">
            <header>
              <strong>
                {resource === "qr"
                  ? "Flux des scans"
                  : resource === "visits"
                    ? "Journal des visites"
                    : "Ledger des points"}
              </strong>
              <span>Les événements les plus récents apparaissent en premier.</span>
            </header>
            <ol>
              {visibleItems.map((item) => (
                <li key={String(item.id)}>
                  <span className="ux-activity-stream__icon">
                    <Icon
                      name={
                        resource === "qr" ? "qr" : resource === "visits" ? "location" : "points"
                      }
                    />
                  </span>
                  <div>
                    <strong>
                      {resource === "qr"
                        ? `${value(item, "purpose")} · ${value(item, "status")}`
                        : resource === "visits"
                          ? `${value(item, "customer")} · ${value(item, "branch")}`
                          : `${value(item, "type")} · ${value(item, "points")} points`}
                    </strong>
                    <span>
                      {resource === "visits" ? value(item, "merchant") : value(item, "customer")} ·{" "}
                      {value(
                        item,
                        resource === "qr"
                          ? "occurredAt"
                          : resource === "visits"
                            ? "visitedAt"
                            : "createdAt",
                      )}
                    </span>
                  </div>
                  <StatusPill
                    tone={
                      item.status === "ACTIVE" || item.status === "SUCCEEDED"
                        ? "success"
                        : "neutral"
                    }
                  >
                    {resource === "qr" ? value(item, "status") : "Traçable"}
                  </StatusPill>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className={`ux-card-collection ux-card-collection--${resource}`}>
            {visibleItems.map((item, index) => (
              <article className="ux-entity-card ux-experience-card" key={String(item.id)}>
                <header>
                  <span className="ux-entity-card__icon">
                    {resource === "customers" ? (
                      <AssetImage
                        alt=""
                        src={
                          index % 2 === 0 ? webAssets.avatars.customer : webAssets.avatars.default
                        }
                      />
                    ) : (
                      <Icon name="reward" />
                    )}
                  </span>
                  <StatusPill tone={item.status === "ACTIVE" ? "success" : "neutral"}>
                    {value(item, "status")}
                  </StatusPill>
                </header>
                <a
                  className="ux-entity-card__body"
                  href={`/workspace/${resource}/${String(item.id)}`}
                >
                  <span>{value(item, resource === "customers" ? "email" : "code")}</span>
                  <h3>{value(item, resource === "customers" ? "displayName" : "name")}</h3>
                  <p>
                    {resource === "customers"
                      ? `${value(item, "phone")} · Profil fidélité`
                      : resource === "loyalty"
                        ? `${value(item, "pointsLabel")} · Règles configurables`
                        : `${value(item, "pointsCost")} points · Stock ${value(item, "stockQuantity")}`}
                  </p>
                </a>
                {resource === "loyalty" && (
                  <div className="ux-program-progress">
                    <span className="is-done">Identité</span>
                    <span className="is-done">Gain</span>
                    <span>Échange</span>
                  </div>
                )}
                <footer>
                  <a href={`/workspace/${resource}/${String(item.id)}`}>Ouvrir le détail</a>
                  <details className="ux-action-menu">
                    <summary>•••</summary>
                    <div>
                      <a href={`/workspace/${resource}/${String(item.id)}`}>Modifier</a>
                      <a href={`/workspace/${resource}/new`}>Dupliquer</a>
                    </div>
                  </details>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }
  if (mode === "list") {
    return (
      <section className="management-page">
        <header className="management-heading">
          <div>
            <Eyebrow>Clients et fidélité</Eyebrow>
            <h2>{definition.title}</h2>
            <p>{definition.description}</p>
          </div>
          <ResourceVisual
            alt={`Illustration ${definition.title}`}
            assets={resourceVisuals[resource]}
          />
          {resource !== "qr" && <ButtonLink href={`/workspace/${resource}/new`}>Créer</ButtonLink>}
        </header>
        {message && <div className="management-notice management-notice--error">{message}</div>}
        {items.length === 0 ? (
          <div className="management-state">
            <AssetImage
              alt=""
              className="management-state__asset"
              src={webAssets.files.emptySearch}
            />
            <h2>Aucun élément</h2>
            <p>La liste est vide pour ce périmètre.</p>
          </div>
        ) : (
          <div className="management-table-wrap">
            <table className="management-table">
              <thead>
                <tr>
                  {definition.columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                  {!["points", "qr"].includes(resource) && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={String(item.id)}>
                    {definition.columns.map((column) => (
                      <td key={column}>
                        {column === "status" ? (
                          <StatusPill
                            tone={
                              item.status === "ACTIVE" || item.status === "SUCCEEDED"
                                ? "success"
                                : "neutral"
                            }
                          >
                            {value(item, column)}
                          </StatusPill>
                        ) : (
                          value(item, column)
                        )}
                      </td>
                    ))}
                    {!["points", "qr"].includes(resource) && (
                      <td>
                        <a
                          className="r-inline-link"
                          href={`/workspace/${resource}/${String(item.id)}`}
                        >
                          Ouvrir
                        </a>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  return (
    <section
      className="management-page ux-module-page ux-editor-page ux-experience-editor"
      data-resource={resource}
    >
      <header className="management-heading">
        <div>
          <Eyebrow>{mode === "new" ? "Création" : "Détail"}</Eyebrow>
          <h2>{mode === "new" ? definition.title : value(detail ?? {}, "name")}</h2>
          <p>{definition.description}</p>
        </div>
        <ResourceVisual
          alt={`Illustration ${definition.title}`}
          assets={resourceVisuals[resource]}
        />
        <ButtonLink href={`/workspace/${resource}`} variant="secondary">
          Retour
        </ButtonLink>
      </header>
      {message && (
        <div
          className={`management-notice management-notice--${state === "error" ? "error" : "success"}`}
        >
          {message}
        </div>
      )}
      <div className="ux-editor-layout">
        <aside className="ux-editor-rail">
          <Eyebrow>
            {resource === "loyalty"
              ? "Program builder"
              : resource === "rewards"
                ? "Catalogue"
                : resource === "points"
                  ? "Opération auditée"
                  : "Profil client"}
          </Eyebrow>
          <ol>
            <li className="is-current">
              <span>1</span>
              <div>
                <strong>Informations</strong>
                <small>Nom, rattachement et référence</small>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>{resource === "loyalty" ? "Règles de gain" : "Paramètres"}</strong>
                <small>Définir le comportement attendu</small>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Vérification</strong>
                <small>Prévisualiser puis enregistrer</small>
              </div>
            </li>
          </ol>
          <div className="ux-context-help">
            <Icon name="help" />
            <p>
              {resource === "points"
                ? "Chaque ajustement est immuable, idempotent et journalisé."
                : "Vous pouvez enregistrer un brouillon avant l’activation."}
            </p>
          </div>
        </aside>
        <form className="management-form ux-editor-form" onSubmit={submit}>
          <header>
            <div>
              <h3>{mode === "new" ? "Configurer étape par étape" : "Modifier la configuration"}</h3>
              <p>Les champs obligatoires sont indiqués et contrôlés avant l’enregistrement.</p>
            </div>
          </header>
          {fields
            .filter((field) => !field.hidden)
            .map((field) => (
              <label
                className={
                  field.type === "json"
                    ? "management-field management-field--wide"
                    : "management-field"
                }
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
                    {(catalogs[field.source] ?? []).map((option) => (
                      <option key={String(option.id)} value={String(option.id)}>
                        {value(
                          option,
                          option.displayName ? "displayName" : option.name ? "name" : "code",
                        )}
                      </option>
                    ))}
                  </select>
                ) : field.type === "json" ? (
                  <StructuredDataEditor
                    fieldName={field.name}
                    value={form[field.name] ?? "{}"}
                    onChange={(nextValue) =>
                      setForm((current) => ({ ...current, [field.name]: nextValue }))
                    }
                  />
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
                ) : (
                  <input
                    type={field.type === "number" ? "number" : "text"}
                    required={field.required}
                    value={form[field.name] ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [field.name]: event.target.value }))
                    }
                  />
                )}
              </label>
            ))}
          <div className="management-form__actions">
            <ButtonLink href={`/workspace/${resource}`} variant="quiet">
              Annuler
            </ButtonLink>
            <Button disabled={state === "saving"} type="submit">
              Enregistrer
            </Button>
          </div>
        </form>
      </div>
      {mode === "detail" && resource === "customers" && (
        <div className="management-status-actions">
          <Eyebrow>Cycle de vie et activité</Eyebrow>
          <div>
            <Button
              variant="secondary"
              onClick={() => void action(`/customers/${id}/status`, { status: "ACTIVE" })}
            >
              Activer
            </Button>
            <Button
              variant="secondary"
              onClick={() => void action(`/customers/${id}/status`, { status: "SUSPENDED" })}
            >
              Suspendre
            </Button>
            <Button variant="quiet" onClick={() => void action(`/customers/${id}/archive`)}>
              Archiver
            </Button>
          </div>
          <div className="ux-detail-timeline">
            <h3>Activité récente</h3>
            {((detail?.activities as readonly Row[] | undefined) ?? []).length === 0 ? (
              <p>Aucune activité enregistrée pour ce client.</p>
            ) : (
              <ol>
                {((detail?.activities as readonly Row[] | undefined) ?? []).map(
                  (activity, index) => (
                    <li key={String(activity.id ?? index)}>
                      <span />
                      <div>
                        <strong>{value(activity, "type")}</strong>
                        <small>{value(activity, "createdAt")}</small>
                      </div>
                    </li>
                  ),
                )}
              </ol>
            )}
          </div>
        </div>
      )}
      {mode === "detail" && resource === "loyalty" && (
        <div className="management-status-actions">
          <Eyebrow>Règles et cycle de vie</Eyebrow>
          <div>
            <Button variant="secondary" onClick={() => void addRule("earning")}>
              Ajouter règle de gain
            </Button>
            <Button variant="secondary" onClick={() => void addRule("redemption")}>
              Ajouter règle d’échange
            </Button>
            <Button
              variant="secondary"
              onClick={() => void action(`/loyalty-programs/${id}/status`, { status: "ACTIVE" })}
            >
              Activer
            </Button>
            <Button
              variant="secondary"
              onClick={() => void action(`/loyalty-programs/${id}/status`, { status: "SUSPENDED" })}
            >
              Suspendre
            </Button>
          </div>
          <div className="ux-rule-board">
            <article>
              <span>Règles de gain</span>
              <strong>{((detail?.earningRules as readonly Row[] | undefined) ?? []).length}</strong>
              <small>Événements qui créditent des points</small>
            </article>
            <article>
              <span>Règles d’échange</span>
              <strong>
                {((detail?.redemptionRules as readonly Row[] | undefined) ?? []).length}
              </strong>
              <small>Seuils et conditions de dépense</small>
            </article>
          </div>
        </div>
      )}
      {mode === "detail" && resource === "rewards" && (
        <div className="management-status-actions">
          <Eyebrow>Stock et disponibilité</Eyebrow>
          <div>
            <Button
              variant="secondary"
              onClick={() => void action(`/rewards/${id}/status`, { status: "ACTIVE" })}
            >
              Activer
            </Button>
            <Button
              variant="secondary"
              onClick={() => void action(`/rewards/${id}/status`, { status: "SUSPENDED" })}
            >
              Suspendre
            </Button>
            <Button variant="quiet" onClick={() => void action(`/rewards/${id}/archive`)}>
              Archiver
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
