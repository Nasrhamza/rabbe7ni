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
import { useEffect, useState, type FormEvent } from "react";

import { QrScannerPanel } from "./qr-scanner";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export type MerchantPhase5Resource =
  "customers" | "loyalty" | "points" | "rewards" | "qr" | "visits";
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
  name: string;
  label: string;
  hidden?: boolean;
  hint?: string;
  required?: boolean;
  source?: "customers" | "organizations" | "programs";
  type?: "boolean" | "json" | "number" | "text";
};
const resources: Record<
  MerchantPhase5Resource,
  { title: string; description: string; endpoint: string; fields: readonly Field[] }
> = {
  customers: {
    title: "Clients",
    description: "Profils, consentements et activité client.",
    endpoint: "/customers",
    fields: [
      { name: "organizationId", label: "Organisation", required: true, source: "organizations" },
      { name: "displayName", label: "Nom affiché", required: true },
      { name: "email", label: "Email" },
      { name: "phone", label: "Téléphone" },
      { name: "locale", label: "Langue du client", required: true },
    ],
  },
  loyalty: {
    title: "Programmes de fidélité",
    description: "Règles de gain, d’échange, seuils et expiration.",
    endpoint: "/loyalty-programs",
    fields: [
      { name: "organizationId", label: "Organisation", required: true, source: "organizations" },
      { name: "code", label: "Code", required: true },
      { name: "name", label: "Nom", required: true },
      { name: "pointsLabel", label: "Libellé", required: true },
      { name: "expirationDays", label: "Expiration en jours", type: "number" },
      { name: "minimumEarnPoints", label: "Gain minimum", type: "number" },
      { name: "minimumRedeemPoints", label: "Échange minimum", type: "number" },
      { name: "appliesToAllMerchants", label: "Tous commerces", type: "boolean" },
      { name: "appliesToAllBranches", label: "Tous points de vente", type: "boolean" },
    ],
  },
  points: {
    title: "Points",
    description: "Ledger immuable et ajustements autorisés.",
    endpoint: "/points/transactions",
    fields: [
      { name: "customerId", label: "Client", required: true, source: "customers" },
      {
        name: "programId",
        label: "Programme de fidélité",
        required: true,
        source: "programs",
      },
      {
        name: "points",
        label: "Nombre de points",
        hint: "Utilisez une valeur négative uniquement pour retirer des points.",
        required: true,
        type: "number",
      },
      { name: "reason", label: "Motif", required: true },
      { name: "idempotencyKey", label: "Référence technique", hidden: true, required: true },
    ],
  },
  rewards: {
    title: "Récompenses",
    description: "Catalogue, stock, éligibilité et disponibilité.",
    endpoint: "/rewards",
    fields: [
      { name: "organizationId", label: "Organisation", required: true, source: "organizations" },
      {
        name: "programId",
        label: "Programme de fidélité",
        required: true,
        source: "programs",
      },
      { name: "code", label: "Code", required: true },
      { name: "name", label: "Nom", required: true },
      { name: "pointsCost", label: "Coût", required: true, type: "number" },
      { name: "stockQuantity", label: "Stock", type: "number" },
      { name: "unlimitedStock", label: "Stock illimité", type: "boolean" },
    ],
  },
  qr: {
    title: "Transactions QR",
    description: "Scans réussis, rejets et protection anti-replay.",
    endpoint: "/qr/transactions",
    fields: [],
  },
  visits: {
    title: "Visites clients",
    description: "Check-ins validés par QR dans vos points de vente.",
    endpoint: "/visits",
    fields: [],
  },
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}/v1${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers },
    ...init,
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(body?.message ?? `Erreur HTTP ${response.status}`);
  }
  return response.json() as Promise<T>;
}
function text(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return typeof value === "object" ? JSON.stringify(value) : String(value);
}

export function MerchantPhase5Screen({
  resource,
  mode,
  id,
}: Readonly<{
  resource: MerchantPhase5Resource;
  mode: "detail" | "list" | "new";
  id?: string;
}>) {
  const definition = resources[resource];
  const fields =
    mode === "detail"
      ? definition.fields.filter(
          (field) => !["organizationId", "programId", "code"].includes(field.name),
        )
      : definition.fields;
  const [items, setItems] = useState<readonly Row[]>([]);
  const [catalogs, setCatalogs] = useState<Record<string, readonly Row[]>>({});
  const [detail, setDetail] = useState<Row | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [state, setState] = useState<"error" | "loading" | "ready" | "saving" | "success">(
    "loading",
  );
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      setState("loading");
      try {
        const sources = [
          ...new Set(fields.flatMap((field) => (field.source ? [field.source] : []))),
        ];
        if (sources.length > 0) {
          const loadedCatalogs = await Promise.all(
            sources.map(async (source) => {
              const endpoint =
                source === "organizations"
                  ? "/organizations"
                  : source === "customers"
                    ? "/customers"
                    : "/loyalty-programs";
              const response = await request<{ items: readonly Row[] }>(
                `${endpoint}?pageSize=100`,
              ).catch(() => ({ items: [] }));
              return [source, response.items] as const;
            }),
          );
          if (active) setCatalogs(Object.fromEntries(loadedCatalogs));
        }
        if (mode === "list") {
          const response = await request<{ items: readonly Row[] }>(
            `${definition.endpoint}?pageSize=100`,
          );
          if (active) setItems(response.items);
        } else if (mode === "detail" && id) {
          const response = await request<Row>(`${definition.endpoint}/${id}`);
          if (!active) return;
          setDetail(response);
          setForm(
            Object.fromEntries(
              fields.map((field) => [
                field.name,
                typeof response[field.name] === "object"
                  ? JSON.stringify(response[field.name], null, 2)
                  : String(response[field.name] ?? ""),
              ]),
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
  }, [definition.endpoint, definition.fields, id, mode]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setState("saving");
    try {
      const payload = Object.fromEntries(
        Object.entries(form)
          .filter(([, value]) => value !== "")
          .map(([key, value]) => {
            const field = fields.find((candidate) => candidate.name === key);
            return [
              key,
              field?.type === "json"
                ? JSON.parse(value)
                : field?.type === "number"
                  ? Number(value)
                  : field?.type === "boolean"
                    ? value === "true"
                    : value,
            ];
          }),
      );
      const endpoint =
        resource === "points" && mode === "new"
          ? "/points/adjust"
          : mode === "new"
            ? definition.endpoint
            : `${definition.endpoint}/${id}`;
      const response = await request<Row>(endpoint, {
        method: mode === "new" ? "POST" : "PATCH",
        body: JSON.stringify(payload),
      });
      setMessage("Enregistrement réussi.");
      setState("success");
      if (mode === "new") {
        window.location.assign(
          resource === "points"
            ? "/workspace/points"
            : `/workspace/${resource}/${String(response.id)}`,
        );
      } else setDetail(response);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible");
      setState("error");
    }
  }

  async function action(path: string, body: Row) {
    if (
      (path.includes("/archive") || body.status === "SUSPENDED") &&
      !window.confirm("Confirmer cette action sensible ?")
    )
      return;
    setState("saving");
    try {
      const response = await request<Row>(path, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setDetail(response);
      setMessage("Action exécutée.");
      setState("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible");
      setState("error");
    }
  }

  if (state === "loading")
    return (
      <div className="management-state">
        <h2>Chargement…</h2>
        <p>Synchronisation du périmètre autorisé.</p>
      </div>
    );

  if (mode === "list") {
    const activityMode = resource === "points" || resource === "qr" || resource === "visits";
    return (
      <section
        className="management-page ux-module-page ux-experience-page ux-merchant-experience"
        data-resource={resource}
      >
        <header className="management-heading ux-module-heading">
          <div>
            <Eyebrow>{activityMode ? "Activité du jour" : "Expérience client"}</Eyebrow>
            <h2>{definition.title}</h2>
            <p>{definition.description}</p>
          </div>
          {resource !== "qr" && resource !== "visits" && (
            <ButtonLink href={`/workspace/${resource}/new`}>
              + {resource === "points" ? "Émettre des points" : "Créer"}
            </ButtonLink>
          )}
        </header>

        <div className="ux-merchant-pulse">
          <article>
            <Icon
              name={
                resource === "customers"
                  ? "customer"
                  : resource === "points"
                    ? "points"
                    : resource === "qr"
                      ? "qr"
                      : resource === "visits"
                        ? "location"
                        : "reward"
              }
            />
            <div>
              <strong>{items.length}</strong>
              <span>{activityMode ? "opérations" : "éléments disponibles"}</span>
            </div>
          </article>
          <article>
            <span className="r-live-dot" />
            <div>
              <strong>Prêt à servir</strong>
              <span>Synchronisation temps réel</span>
            </div>
          </article>
          <a
            href={
              resource === "qr"
                ? "#qr-scanner"
                : resource === "visits"
                  ? "#visits-list"
                  : `/workspace/${resource}/new`
            }
          >
            <span>Action rapide</span>
            <strong>
              {resource === "qr"
                ? "Ouvrir le scanner"
                : resource === "visits"
                  ? "Voir les passages"
                  : "Commencer maintenant"}
            </strong>
            <Icon name="chevron" />
          </a>
        </div>

        {resource === "qr" && <QrScannerPanel />}

        {message && <div className="management-notice management-notice--error">{message}</div>}

        {items.length === 0 ? (
          <div className="ux-first-use">
            <AssetImage alt="" src={webAssets.files.emptySearch} />
            <div>
              <Eyebrow>Première utilisation</Eyebrow>
              <h2>Aucun élément pour le moment</h2>
              <p>Commencez par l’action principale ; Rabbehni vous guide ensuite.</p>
              {resource !== "qr" && resource !== "visits" && (
                <ButtonLink href={`/workspace/${resource}/new`}>Commencer</ButtonLink>
              )}
            </div>
          </div>
        ) : activityMode ? (
          <div className="ux-activity-stream" id="visits-list">
            <header>
              <strong>
                {resource === "qr"
                  ? "Scans récents"
                  : resource === "visits"
                    ? "Visites récentes"
                    : "Mouvements de points"}
              </strong>
              <span>Flux opérationnel de votre commerce</span>
            </header>
            <ol>
              {items.map((item) => (
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
                      {resource === "visits"
                        ? `${text((item.customer as Row | undefined)?.displayName)} · ${text((item.branch as Row | undefined)?.name)}`
                        : `${text(item.type ?? item.purpose)} · ${text(item.points ?? item.resultReference)}`}
                    </strong>
                    <span>
                      {resource === "visits"
                        ? `${text((item.merchant as Row | undefined)?.displayName)} · ${text(item.source)}`
                        : `${text((item.customer as Row | undefined)?.displayName)} · opération sécurisée`}
                    </span>
                  </div>
                  <StatusPill
                    tone={
                      item.status === "ACTIVE" || item.status === "SUCCEEDED"
                        ? "success"
                        : "neutral"
                    }
                  >
                    {text(item.status ?? "TRAÇABLE")}
                  </StatusPill>
                </li>
              ))}
            </ol>
          </div>
        ) : (
          <div className={`ux-card-collection ux-card-collection--${resource}`}>
            {items.map((item, index) => (
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
                    {text(item.status)}
                  </StatusPill>
                </header>
                <a
                  className="ux-entity-card__body"
                  href={`/workspace/${resource}/${String(item.id)}`}
                >
                  <span>{text(item.email ?? item.code)}</span>
                  <h3>{text(item.displayName ?? item.name)}</h3>
                  <p>
                    {resource === "customers"
                      ? `${text(item.phone)} · profil client`
                      : resource === "loyalty"
                        ? "Programme et règles de fidélité"
                        : `${text(item.pointsCost)} points · stock ${text(item.stockQuantity)}`}
                  </p>
                </a>
                <footer>
                  <a href={`/workspace/${resource}/${String(item.id)}`}>Gérer →</a>
                </footer>
              </article>
            ))}
          </div>
        )}
      </section>
    );
  }

  if (mode.startsWith("li"))
    return (
      <section className="management-page">
        <header className="management-heading">
          <div>
            <Eyebrow>Expérience client</Eyebrow>
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
            <p>La liste est vide pour votre périmètre.</p>
          </div>
        ) : (
          <div className="management-table-wrap">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Référence</th>
                  <th>Libellé</th>
                  <th>Valeur</th>
                  <th>Statut</th>
                  {!["points", "qr"].includes(resource) && <th>Action</th>}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={String(item.id)}>
                    <td>{text(item.code ?? item.type ?? item.purpose)}</td>
                    <td>
                      {text(
                        item.displayName ??
                          item.name ??
                          (item.customer as Row | undefined)?.displayName,
                      )}
                    </td>
                    <td>{text(item.points ?? item.pointsCost ?? item.resultReference)}</td>
                    <td>
                      <StatusPill
                        tone={
                          item.status === "ACTIVE" || item.status === "SUCCEEDED"
                            ? "success"
                            : "neutral"
                        }
                      >
                        {text(item.status)}
                      </StatusPill>
                    </td>
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

  return (
    <section
      className="management-page ux-module-page ux-editor-page ux-editor-page--merchant"
      data-resource={resource}
    >
      <header className="management-heading">
        <div>
          <Eyebrow>{mode === "new" ? "Nouvel élément" : "Détail"}</Eyebrow>
          <h2>{mode === "new" ? definition.title : text(detail?.name ?? detail?.displayName)}</h2>
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
          <Eyebrow>Parcours guidé</Eyebrow>
          <ol>
            <li className="is-current">
              <span>1</span>
              <div>
                <strong>Essentiel</strong>
                <small>Les informations nécessaires</small>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Conditions</strong>
                <small>Règles et disponibilité</small>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Confirmation</strong>
                <small>Relire puis enregistrer</small>
              </div>
            </li>
          </ol>
          <div className="ux-context-help">
            <Icon name="help" />
            <p>Les modifications restent limitées à votre périmètre autorisé.</p>
          </div>
        </aside>
        <form className="management-form ux-editor-form" onSubmit={submit}>
          <header>
            <div>
              <h3>{mode === "new" ? "Configurer maintenant" : "Modifier la fiche"}</h3>
              <p>Un formulaire court, pensé pour les opérations quotidiennes.</p>
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
                        {text(
                          option.displayName ??
                            option.name ??
                            option.email ??
                            option.code ??
                            option.id,
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
                    required={field.required}
                    type={field.type === "number" ? "number" : "text"}
                    value={form[field.name] ?? ""}
                    onChange={(event) =>
                      setForm((current) => ({ ...current, [field.name]: event.target.value }))
                    }
                  />
                )}
                {field.hint && <small className="management-field__hint">{field.hint}</small>}
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
          <Eyebrow>Accès et activité</Eyebrow>
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
                        <strong>{text(activity.type)}</strong>
                        <small>{text(activity.createdAt)}</small>
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
          <Eyebrow>Règles et disponibilité</Eyebrow>
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
          <Eyebrow>Disponibilité</Eyebrow>
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
          </div>
        </div>
      )}
    </section>
  );
}
