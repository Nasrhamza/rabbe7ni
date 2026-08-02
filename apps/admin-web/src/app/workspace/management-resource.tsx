"use client";

import {
  AssetImage,
  BranchMap,
  Button,
  ButtonLink,
  Eyebrow,
  Icon,
  merchantPhotoFor,
  StatusPill,
  StructuredDataEditor,
  webAssets,
} from "@rabbehni/design-system/web";
import { useEffect, useMemo, useState, type FormEvent } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export type ManagementResource =
  "organizations" | "franchises" | "merchants" | "branches" | "staff";

interface FieldDefinition {
  readonly name: string;
  readonly label: string;
  readonly required?: boolean;
  readonly type?: "email" | "json" | "select" | "text";
  readonly options?: readonly string[];
  readonly catalog?: "organizations" | "franchises" | "merchants" | "branches" | "roles";
}

interface ResourceDefinition {
  readonly singular: string;
  readonly title: string;
  readonly description: string;
  readonly createFields: readonly FieldDefinition[];
  readonly editFields: readonly FieldDefinition[];
  readonly statuses: readonly string[];
}

const commonStatuses = ["DRAFT", "ACTIVE", "SUSPENDED"] as const;
const definitions: Record<ManagementResource, ResourceDefinition> = {
  organizations: {
    singular: "organisation",
    title: "Organisations",
    description: "Gérez les entreprises clientes, leurs paramètres et leur statut.",
    statuses: commonStatuses,
    createFields: [
      { name: "code", label: "Code", required: true },
      { name: "legalName", label: "Raison sociale", required: true },
      { name: "displayName", label: "Nom affiché", required: true },
      { name: "registrationNumber", label: "Registre" },
      { name: "taxIdentifier", label: "Identifiant fiscal" },
      { name: "countryCode", label: "Pays (ISO)", required: true },
      { name: "timezone", label: "Fuseau horaire", required: true },
      { name: "status", label: "Statut", type: "select", options: commonStatuses },
    ],
    editFields: [
      { name: "legalName", label: "Raison sociale", required: true },
      { name: "displayName", label: "Nom affiché", required: true },
      { name: "registrationNumber", label: "Registre" },
      { name: "taxIdentifier", label: "Identifiant fiscal" },
      { name: "countryCode", label: "Pays (ISO)", required: true },
      { name: "timezone", label: "Fuseau horaire", required: true },
    ],
  },
  franchises: {
    singular: "franchise",
    title: "Franchises",
    description: "Réseaux rattachés aux organisations et limites d’accès.",
    statuses: ["ACTIVE", "SUSPENDED"],
    createFields: [
      {
        name: "organizationId",
        label: "Organisation",
        required: true,
        type: "select",
        catalog: "organizations",
      },
      { name: "code", label: "Code", required: true },
      { name: "name", label: "Nom", required: true },
      { name: "description", label: "Description" },
      { name: "status", label: "Statut", type: "select", options: ["ACTIVE", "SUSPENDED"] },
    ],
    editFields: [
      { name: "name", label: "Nom", required: true },
      { name: "description", label: "Description" },
    ],
  },
  merchants: {
    singular: "commerce",
    title: "Commerces",
    description: "Profils, contacts, rattachements et activation opérationnelle.",
    statuses: commonStatuses,
    createFields: [
      {
        name: "organizationId",
        label: "Organisation",
        required: true,
        type: "select",
        catalog: "organizations",
      },
      { name: "franchiseId", label: "Franchise", type: "select", catalog: "franchises" },
      { name: "code", label: "Code", required: true },
      { name: "legalName", label: "Raison sociale", required: true },
      { name: "displayName", label: "Nom affiché", required: true },
      { name: "contactEmail", label: "Email", type: "email" },
      { name: "contactPhone", label: "Téléphone" },
      { name: "city", label: "Ville" },
      { name: "countryCode", label: "Pays (ISO)" },
      { name: "timezone", label: "Fuseau horaire" },
      { name: "locale", label: "Locale" },
      { name: "status", label: "Statut", type: "select", options: commonStatuses },
    ],
    editFields: [
      { name: "franchiseId", label: "Franchise", type: "select", catalog: "franchises" },
      { name: "legalName", label: "Raison sociale", required: true },
      { name: "displayName", label: "Nom affiché", required: true },
      { name: "contactEmail", label: "Email", type: "email" },
      { name: "contactPhone", label: "Téléphone" },
      { name: "city", label: "Ville" },
      { name: "countryCode", label: "Pays (ISO)" },
      { name: "timezone", label: "Fuseau horaire" },
      { name: "locale", label: "Locale" },
    ],
  },
  branches: {
    singular: "point de vente",
    title: "Points de vente",
    description: "Adresse, horaires, locale et paramètres opérationnels.",
    statuses: ["ACTIVE", "SUSPENDED"],
    createFields: [
      {
        name: "merchantId",
        label: "Commerce",
        required: true,
        type: "select",
        catalog: "merchants",
      },
      { name: "franchiseId", label: "Franchise", type: "select", catalog: "franchises" },
      { name: "code", label: "Code", required: true },
      { name: "name", label: "Nom", required: true },
      { name: "addressLine", label: "Adresse" },
      { name: "city", label: "Ville" },
      { name: "postalCode", label: "Code postal" },
      { name: "countryCode", label: "Pays (ISO)", required: true },
      { name: "timezone", label: "Fuseau horaire", required: true },
      { name: "locale", label: "Locale", required: true },
      { name: "currency", label: "Devise", required: true },
    ],
    editFields: [
      {
        name: "merchantId",
        label: "Commerce",
        required: true,
        type: "select",
        catalog: "merchants",
      },
      { name: "franchiseId", label: "Franchise", type: "select", catalog: "franchises" },
      { name: "name", label: "Nom", required: true },
      { name: "addressLine", label: "Adresse" },
      { name: "city", label: "Ville" },
      { name: "postalCode", label: "Code postal" },
      { name: "countryCode", label: "Pays (ISO)", required: true },
      { name: "timezone", label: "Fuseau horaire", required: true },
      { name: "locale", label: "Locale", required: true },
      { name: "currency", label: "Devise", required: true },
    ],
  },
  staff: {
    singular: "membre",
    title: "Équipe",
    description: "Invitations, affectations, rôles et contrôle des accès.",
    statuses: ["ACTIVE", "SUSPENDED", "REMOVED"],
    createFields: [
      { name: "email", label: "Email", required: true, type: "email" },
      { name: "displayName", label: "Nom complet", required: true },
      { name: "locale", label: "Locale", required: true },
      {
        name: "organizationId",
        label: "Organisation",
        required: true,
        type: "select",
        catalog: "organizations",
      },
      { name: "franchiseId", label: "Franchise", type: "select", catalog: "franchises" },
      { name: "merchantId", label: "Commerce", type: "select", catalog: "merchants" },
      { name: "branchId", label: "Point de vente", type: "select", catalog: "branches" },
      { name: "employeeCode", label: "Matricule" },
      { name: "jobTitle", label: "Fonction" },
      { name: "roleIds", label: "Rôle", required: true, type: "select", catalog: "roles" },
    ],
    editFields: [
      {
        name: "organizationId",
        label: "Organisation",
        required: true,
        type: "select",
        catalog: "organizations",
      },
      { name: "franchiseId", label: "Franchise", type: "select", catalog: "franchises" },
      { name: "merchantId", label: "Commerce", type: "select", catalog: "merchants" },
      { name: "branchId", label: "Point de vente", type: "select", catalog: "branches" },
      { name: "employeeCode", label: "Matricule" },
      { name: "jobTitle", label: "Fonction" },
    ],
  },
};

type JsonRecord = Record<string, unknown>;
type Catalogs = Record<string, readonly JsonRecord[]>;

async function api<T>(path: string, init?: RequestInit): Promise<T> {
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

function displayValue(item: JsonRecord, key: string): string {
  const value = item[key];
  if (typeof value === "string") return value;
  if (value === null || value === undefined) return "—";
  return JSON.stringify(value);
}

function itemLabel(resource: ManagementResource, item: JsonRecord): string {
  if (resource === "staff") {
    const user = item.user as JsonRecord | undefined;
    return displayValue(user ?? {}, "displayName");
  }
  return displayValue(
    item,
    resource === "organizations" || resource === "merchants" ? "displayName" : "name",
  );
}

export function ManagementResourceScreen({
  resource,
  mode,
  id,
}: Readonly<{
  resource: ManagementResource;
  mode: "detail" | "list" | "new";
  id?: string;
}>) {
  const definition = definitions[resource];
  const [items, setItems] = useState<readonly JsonRecord[]>([]);
  const [detail, setDetail] = useState<JsonRecord | null>(null);
  const [catalogs, setCatalogs] = useState<Catalogs>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [state, setState] = useState<"error" | "loading" | "ready" | "saving" | "success">(
    "loading",
  );
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<readonly string[]>([]);
  const fields = mode === "new" ? definition.createFields : definition.editFields;

  useEffect(() => {
    let alive = true;
    async function load() {
      setState("loading");
      try {
        const catalogNames = [
          ...new Set(fields.flatMap((field) => (field.catalog ? [field.catalog] : []))),
        ];
        const catalogEntries = await Promise.all(
          catalogNames.map(async (name) => {
            const path = name === "roles" ? "/staff/roles" : `/${name}?pageSize=100`;
            const result = await api<JsonRecord | readonly JsonRecord[]>(path);
            const list = Array.isArray(result)
              ? result
              : (((result as JsonRecord).items as readonly JsonRecord[]) ?? []);
            return [name, list] as const;
          }),
        );
        if (!alive) return;
        setCatalogs(Object.fromEntries(catalogEntries));
        if (mode === "list") {
          const result = await api<{ items: readonly JsonRecord[] }>(`/${resource}?pageSize=100`);
          if (!alive) return;
          setItems(result.items);
        } else if (mode === "detail" && id) {
          const result = await api<JsonRecord>(`/${resource}/${id}`);
          if (!alive) return;
          setDetail(result);
          setForm(
            Object.fromEntries(
              fields.map((field) => {
                const value =
                  field.name === "roleIds"
                    ? ((
                        (
                          (result.membership as JsonRecord | undefined)?.roles as
                            readonly JsonRecord[] | undefined
                        )?.[0]?.role as JsonRecord | undefined
                      )?.id ?? "")
                    : result[field.name];
                return [
                  field.name,
                  typeof value === "object" && value !== null
                    ? JSON.stringify(value, null, 2)
                    : String(value ?? ""),
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
                  : field.name === "locale"
                    ? "fr-TN"
                    : field.name === "timezone"
                      ? "Africa/Tunis"
                      : field.name === "currency"
                        ? "TND"
                        : "",
              ]),
            ),
          );
        }
        setState("ready");
      } catch (error) {
        if (!alive) return;
        setMessage(error instanceof Error ? error.message : "Chargement impossible");
        setState("error");
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [fields, id, mode, resource]);

  const columns = useMemo(
    () =>
      resource === "staff"
        ? ["displayName", "email", "jobTitle", "status"]
        : [
            "code",
            resource === "organizations" || resource === "merchants" ? "displayName" : "name",
            "status",
          ],
    [resource],
  );

  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return items;
    return items.filter((item) => JSON.stringify(item).toLocaleLowerCase().includes(normalized));
  }, [items, query]);

  function toggleSelection(itemId: string) {
    setSelected((current) =>
      current.includes(itemId) ? current.filter((value) => value !== itemId) : [...current, itemId],
    );
  }

  function exportSelection() {
    const exported = items.filter((item) => selected.includes(String(item.id)));
    const body = [
      ["id", "label", "status"],
      ...exported.map((item) => [
        String(item.id ?? ""),
        itemLabel(resource, item),
        String(item.status ?? ""),
      ]),
    ]
      .map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(","))
      .join("\n");
    const url = URL.createObjectURL(new Blob([body], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${resource}-selection.csv`;
    anchor.click();
    URL.revokeObjectURL(url);
    setMessage(`${exported.length} élément(s) exporté(s).`);
    setState("success");
  }

  async function bulkLifecycleAction() {
    if (selected.length === 0) return;
    const actionLabel = resource === "staff" ? "suspendre" : "archiver";
    if (!window.confirm(`Confirmer : ${actionLabel} ${selected.length} élément(s) ?`)) return;
    setState("saving");
    try {
      await Promise.all(
        selected.map((itemId) =>
          api<JsonRecord>(
            resource === "staff" ? `/staff/${itemId}/status` : `/${resource}/${itemId}/archive`,
            {
              method: "POST",
              body: JSON.stringify(resource === "staff" ? { status: "SUSPENDED" } : {}),
            },
          ),
        ),
      );
      setItems((current) =>
        current.map((item) =>
          selected.includes(String(item.id))
            ? { ...item, status: resource === "staff" ? "SUSPENDED" : "ARCHIVED" }
            : item,
        ),
      );
      setMessage(`${selected.length} élément(s) mis à jour.`);
      setSelected([]);
      setState("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action groupée impossible");
      setState("error");
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setState("saving");
    setMessage("");
    try {
      const payload = Object.fromEntries(
        Object.entries(form)
          .filter(([, value]) => value !== "")
          .map(([key, value]) => {
            const field = fields.find((candidate) => candidate.name === key);
            return [
              key,
              field?.type === "json" ? JSON.parse(value) : key === "roleIds" ? [value] : value,
            ];
          }),
      );
      const path =
        mode === "new"
          ? resource === "staff"
            ? "/staff/invitations"
            : `/${resource}`
          : resource === "staff"
            ? `/staff/${id}/assignment`
            : `/${resource}/${id}`;
      const roleIds = resource === "staff" ? payload.roleIds : undefined;
      if (resource === "staff" && mode === "detail") delete payload.roleIds;
      const result = await api<JsonRecord>(path, {
        method: mode === "new" ? "POST" : "PATCH",
        body: JSON.stringify(payload),
      });
      if (resource === "staff" && mode === "detail" && Array.isArray(roleIds)) {
        await api<JsonRecord>(`/staff/${id}/roles`, {
          method: "PATCH",
          body: JSON.stringify({ roleIds }),
        });
      }
      setState("success");
      setMessage("Enregistré avec succès.");
      if (mode === "new") window.location.assign(`/workspace/${resource}/${String(result.id)}`);
      else setDetail(result);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible");
      setState("error");
    }
  }

  async function setStatus(status: string) {
    if (!id) return;
    if (
      (status === "SUSPENDED" || status === "REMOVED") &&
      !window.confirm(`Confirmer le changement de statut vers ${status} ?`)
    )
      return;
    setState("saving");
    try {
      const result = await api<JsonRecord>(`/${resource}/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status }),
      });
      setDetail(result);
      setMessage(`Statut mis à jour : ${status}.`);
      setState("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible");
      setState("error");
    }
  }

  async function archive() {
    if (!id || resource === "staff") return;
    if (!window.confirm("Archiver cet élément ? Il ne sera plus disponible dans les opérations."))
      return;
    setState("saving");
    try {
      const result = await api<JsonRecord>(`/${resource}/${id}/archive`, {
        method: "POST",
        body: "{}",
      });
      setDetail(result);
      setMessage("Élément archivé.");
      setState("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Archivage impossible");
      setState("error");
    }
  }

  if (state === "loading")
    return <ManagementState title="Chargement…" detail="Synchronisation des données autorisées." />;
  if (mode.startsWith("li")) {
    return (
      <section className="management-page ux-module-page" data-resource={resource}>
        <ManagementHeader definition={definition} resource={resource} />

        <div className="ux-module-summary">
          <article>
            <span>Éléments visibles</span>
            <strong>{items.length}</strong>
            <small>Données accessibles à ce compte</small>
          </article>
          <article>
            <span>Actifs</span>
            <strong>{items.filter((item) => item.status === "ACTIVE").length}</strong>
            <small>Prêts pour les opérations</small>
          </article>
          <article className="ux-next-step">
            <Icon
              name={
                resource === "staff"
                  ? "permission"
                  : resource === "branches"
                    ? "branch"
                    : "activity"
              }
            />
            <div>
              <span>Prochaine action recommandée</span>
              <strong>
                {resource === "organizations"
                  ? "Rattacher un commerce"
                  : resource === "branches"
                    ? "Vérifier les horaires"
                    : resource === "staff"
                      ? "Contrôler les rôles"
                      : "Compléter la configuration"}
              </strong>
            </div>
          </article>
        </div>

        <div className="ux-collection-toolbar">
          <label>
            <Icon name="search" />
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Rechercher dans ${definition.title.toLocaleLowerCase()}…`}
              value={query}
            />
          </label>
          <span>{visibleItems.length} résultat(s)</span>
          <button type="button">Filtres</button>
          <button type="button">Trier : récent</button>
        </div>

        {selected.length > 0 && (
          <div className="ux-bulk-bar" role="status">
            <strong>{selected.length} sélectionné(s)</strong>
            <button onClick={exportSelection} type="button">
              Exporter CSV
            </button>
            <button onClick={() => void bulkLifecycleAction()} type="button">
              {resource === "staff" ? "Suspendre" : "Archiver"}
            </button>
            <button onClick={() => setSelected([])} type="button">
              Annuler
            </button>
          </div>
        )}

        {message && (
          <ManagementNotice tone={state === "error" ? "error" : "success"}>
            {message}
          </ManagementNotice>
        )}

        {visibleItems.length === 0 ? (
          <div className="ux-first-use">
            <AssetImage alt="" src={webAssets.files.emptySearch} />
            <div>
              <Eyebrow>Première étape</Eyebrow>
              <h2>{query ? "Aucun résultat" : `Créez votre première ${definition.singular}`}</h2>
              <p>
                {query
                  ? "Modifiez votre recherche ou retirez les filtres."
                  : "Un parcours guidé vous aide à renseigner les informations indispensables."}
              </p>
              {!query && <ButtonLink href={`/workspace/${resource}/new`}>Commencer</ButtonLink>}
            </div>
          </div>
        ) : (
          <div className={resource === "branches" ? "ux-branch-layout" : "ux-resource-grid"}>
            {resource === "branches" && (
              <BranchMap branches={visibleItems} heading="Couverture du réseau" />
            )}
            <div className={resource === "branches" ? "ux-branch-list" : "ux-card-collection"}>
              {visibleItems.map((item, index) => {
                const itemId = String(item.id);
                const user = item.user as JsonRecord | undefined;
                const active = selected.includes(itemId);
                return (
                  <article
                    className={active ? "ux-entity-card is-selected" : "ux-entity-card"}
                    key={itemId}
                  >
                    <header>
                      <label>
                        <input
                          checked={active}
                          onChange={() => toggleSelection(itemId)}
                          type="checkbox"
                        />
                        <span className="sr-only">Sélectionner</span>
                      </label>
                      <span className="ux-entity-card__icon">
                        {resource === "staff" ? (
                          <AssetImage
                            alt=""
                            src={
                              index % 2 === 0
                                ? webAssets.avatars.customer
                                : webAssets.avatars.default
                            }
                          />
                        ) : (
                          <Icon
                            name={
                              resource === "organizations"
                                ? "organization"
                                : resource === "franchises"
                                  ? "franchise"
                                  : resource === "branches"
                                    ? "branch"
                                    : "merchant"
                            }
                          />
                        )}
                      </span>
                      <details className="ux-action-menu">
                        <summary aria-label="Actions">•••</summary>
                        <div>
                          <a href={`/workspace/${resource}/${itemId}`}>Ouvrir le détail</a>
                          <a href={`/workspace/${resource}/${itemId}`}>Modifier</a>
                          <a href={`/workspace/${resource}/new`}>Dupliquer</a>
                        </div>
                      </details>
                    </header>
                    {resource === "merchants" && (
                      <a
                        className="ux-entity-card__photo"
                        href={`/workspace/${resource}/${itemId}`}
                      >
                        <AssetImage
                          alt={`Espace de ${itemLabel(resource, item)}`}
                          src={merchantPhotoFor(
                            `${displayValue(item, "code")} ${itemLabel(resource, item)}`,
                          )}
                        />
                      </a>
                    )}
                    <a className="ux-entity-card__body" href={`/workspace/${resource}/${itemId}`}>
                      <span>{displayValue(item, "code")}</span>
                      <h3>
                        {resource === "staff"
                          ? displayValue(user ?? {}, "displayName")
                          : itemLabel(resource, item)}
                      </h3>
                      <p>
                        {resource === "staff"
                          ? displayValue(user ?? {}, "email")
                          : resource === "branches"
                            ? [displayValue(item, "addressLine"), displayValue(item, "city")].join(
                                " · ",
                              )
                            : definition.description}
                      </p>
                    </a>
                    <footer>
                      <StatusPill tone={item.status === "ACTIVE" ? "success" : "neutral"}>
                        {displayValue(item, "status")}
                      </StatusPill>
                      <span>Mis à jour récemment</span>
                    </footer>
                  </article>
                );
              })}
            </div>
          </div>
        )}
      </section>
    );
  }
  if (mode === "list") {
    return (
      <section className="management-page">
        <ManagementHeader definition={definition} resource={resource} />
        {state === "error" && <ManagementNotice tone="error">{message}</ManagementNotice>}
        {items.length === 0 ? (
          <ManagementState
            title={`Aucune ${definition.singular}`}
            detail="Créez le premier élément pour démarrer."
          />
        ) : (
          <div className="management-table-wrap">
            <table className="management-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column}>{column}</th>
                  ))}
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const user = item.user as JsonRecord | undefined;
                  return (
                    <tr key={String(item.id)}>
                      {columns.map((column) => (
                        <td key={column}>
                          {column === "displayName" && resource === "staff" ? (
                            displayValue(user ?? {}, "displayName")
                          ) : column === "email" && resource === "staff" ? (
                            displayValue(user ?? {}, "email")
                          ) : column === "status" ? (
                            <StatusPill tone={item.status === "ACTIVE" ? "success" : "neutral"}>
                              {displayValue(item, column)}
                            </StatusPill>
                          ) : (
                            displayValue(item, column)
                          )}
                        </td>
                      ))}
                      <td>
                        <a
                          className="r-inline-link"
                          href={`/workspace/${resource}/${String(item.id)}`}
                        >
                          Ouvrir
                        </a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="management-page ux-module-page ux-editor-page" data-resource={resource}>
      <header className="management-heading">
        <div>
          <Eyebrow>{mode === "new" ? "Création" : "Détail et modification"}</Eyebrow>
          <h2>
            {mode === "new" ? `Nouvelle ${definition.singular}` : itemLabel(resource, detail ?? {})}
          </h2>
          <p>{definition.description}</p>
        </div>
        <span className="ux-heading-icon">
          <Icon
            name={
              resource === "organizations"
                ? "organization"
                : resource === "franchises"
                  ? "franchise"
                  : resource === "branches"
                    ? "branch"
                    : resource === "staff"
                      ? "staff"
                      : "merchant"
            }
          />
        </span>
        <ButtonLink href={`/workspace/${resource}`} variant="secondary">
          Retour à la liste
        </ButtonLink>
      </header>
      {message && (
        <ManagementNotice tone={state === "error" ? "error" : "success"}>
          {message}
        </ManagementNotice>
      )}
      <div className="ux-editor-layout">
        <aside className="ux-editor-rail">
          <Eyebrow>{mode === "new" ? "Parcours guidé" : "Fiche active"}</Eyebrow>
          <ol>
            <li className="is-current">
              <span>1</span>
              <div>
                <strong>Informations essentielles</strong>
                <small>Identité et rattachement</small>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Paramètres opérationnels</strong>
                <small>Locale, horaires et règles</small>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Vérification</strong>
                <small>Contrôle avant activation</small>
              </div>
            </li>
          </ol>
          <div className="ux-context-help">
            <Icon name="help" />
            <p>Les champs obligatoires suffisent pour enregistrer un brouillon.</p>
          </div>
        </aside>
        <form className="management-form ux-editor-form" onSubmit={submit}>
          <header>
            <div>
              <h3>{mode === "new" ? "Configurer les informations" : "Modifier la fiche"}</h3>
              <p>Les changements sont contrôlés, enregistrés et limités à votre compte.</p>
            </div>
            {mode === "detail" && (
              <StatusPill tone={detail?.status === "ACTIVE" ? "success" : "neutral"}>
                {String(detail?.status ?? "DRAFT")}
              </StatusPill>
            )}
          </header>
          {fields.map((field) => (
            <label
              className={
                field.type === "json"
                  ? "management-field management-field--wide"
                  : "management-field"
              }
              key={field.name}
            >
              <span>{field.label}</span>
              {field.type === "select" ? (
                <select
                  required={field.required}
                  value={form[field.name] ?? ""}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, [field.name]: event.target.value }))
                  }
                >
                  <option value="">Sélectionner</option>
                  {(field.options ?? []).map((option) => (
                    <option key={option} value={option}>
                      {option}
                    </option>
                  ))}
                  {(field.catalog ? (catalogs[field.catalog] ?? []) : []).map((option) => (
                    <option key={String(option.id)} value={String(option.id)}>
                      {displayValue(
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
              ) : (
                <input
                  type={field.type === "email" ? "email" : "text"}
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
              {state === "saving" ? "Enregistrement…" : "Enregistrer"}
            </Button>
          </div>
        </form>
      </div>
      {mode === "detail" && (
        <div className="management-status-actions">
          <Eyebrow>Cycle de vie</Eyebrow>
          <div>
            {definition.statuses.map((status) => (
              <Button
                key={status}
                type="button"
                variant="secondary"
                onClick={() => void setStatus(status)}
              >
                {status}
              </Button>
            ))}
            {resource !== "staff" && (
              <Button type="button" variant="quiet" onClick={() => void archive()}>
                Archiver
              </Button>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function ManagementHeader({
  definition,
  resource,
}: Readonly<{ definition: ResourceDefinition; resource: ManagementResource }>) {
  return (
    <header className="management-heading ux-module-heading">
      <div>
        <Eyebrow>Gestion administrative</Eyebrow>
        <h2>{definition.title}</h2>
        <p>{definition.description}</p>
      </div>
      <ButtonLink href={`/workspace/${resource}/new`}>Créer</ButtonLink>
    </header>
  );
}

function ManagementState({ title, detail }: Readonly<{ title: string; detail: string }>) {
  return (
    <div className="management-state">
      <AssetImage alt="" className="management-state__asset" src={webAssets.files.emptySearch} />
      <span className="management-state__icon" aria-hidden="true">
        ◇
      </span>
      <h2>{title}</h2>
      <p>{detail}</p>
    </div>
  );
}

function ManagementNotice({
  children,
  tone,
}: Readonly<{ children: string; tone: "error" | "success" }>) {
  return (
    <div className={`management-notice management-notice--${tone}`} role="status">
      {children}
    </div>
  );
}
