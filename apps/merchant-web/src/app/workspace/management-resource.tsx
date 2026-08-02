"use client";

import {
  AssetImage,
  BranchMap,
  Button,
  ButtonLink,
  Eyebrow,
  Icon,
  merchantPhotoFor,
  ResourceVisual,
  StatusPill,
  webAssets,
} from "@rabbehni/design-system/web";
import { useEffect, useMemo, useState, type FormEvent } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
export type MerchantResource = "merchants" | "branches" | "staff";
const resourceVisuals = {
  branches: [webAssets.icons.location],
  merchants: [webAssets.icons.shop],
  staff: [webAssets.business.team],
} as const;
type RecordValue = Record<string, unknown>;

interface Field {
  readonly name: string;
  readonly label: string;
  readonly required?: boolean;
  readonly source?: "branches" | "franchises" | "merchants" | "organizations" | "roles";
}

const resourceCopy: Record<
  MerchantResource,
  { title: string; description: string; fields: readonly Field[]; statuses: readonly string[] }
> = {
  merchants: {
    title: "Profil commerce",
    description: "Coordonnées et informations opérationnelles de votre commerce.",
    statuses: ["DRAFT", "ACTIVE", "SUSPENDED"],
    fields: [
      { name: "franchiseId", label: "Franchise", source: "franchises" },
      { name: "legalName", label: "Raison sociale", required: true },
      { name: "displayName", label: "Nom affiché", required: true },
      { name: "contactEmail", label: "Email" },
      { name: "contactPhone", label: "Téléphone" },
      { name: "city", label: "Ville" },
      { name: "countryCode", label: "Pays" },
      { name: "timezone", label: "Fuseau horaire" },
      { name: "locale", label: "Langue" },
    ],
  },
  branches: {
    title: "Points de vente",
    description: "Adresses, horaires et paramètres de vos implantations.",
    statuses: ["ACTIVE", "SUSPENDED"],
    fields: [
      { name: "merchantId", label: "Commerce", required: true, source: "merchants" },
      { name: "franchiseId", label: "Franchise", source: "franchises" },
      { name: "name", label: "Nom", required: true },
      { name: "addressLine", label: "Adresse" },
      { name: "city", label: "Ville" },
      { name: "postalCode", label: "Code postal" },
      { name: "countryCode", label: "Pays", required: true },
      { name: "timezone", label: "Fuseau horaire", required: true },
      { name: "locale", label: "Langue", required: true },
      { name: "currency", label: "Devise", required: true },
    ],
  },
  staff: {
    title: "Équipe",
    description: "Invitations, fonctions, affectations et état des accès.",
    statuses: ["ACTIVE", "SUSPENDED", "REMOVED"],
    fields: [
      { name: "organizationId", label: "Organisation", required: true, source: "organizations" },
      { name: "franchiseId", label: "Franchise", source: "franchises" },
      { name: "merchantId", label: "Commerce", source: "merchants" },
      { name: "branchId", label: "Point de vente", source: "branches" },
      { name: "employeeCode", label: "Matricule" },
      { name: "jobTitle", label: "Fonction" },
      { name: "roleIds", label: "Rôle", required: true, source: "roles" },
    ],
  },
};

const createOnly: Record<MerchantResource, readonly Field[]> = {
  merchants: [
    { name: "organizationId", label: "Organisation", required: true, source: "organizations" },
    { name: "code", label: "Code", required: true },
  ],
  branches: [{ name: "code", label: "Code", required: true }],
  staff: [
    { name: "email", label: "Email", required: true },
    { name: "displayName", label: "Nom complet", required: true },
    { name: "locale", label: "Langue", required: true },
    { name: "roleIds", label: "Rôle", required: true, source: "roles" },
  ],
};

async function request<T>(path: string, init?: RequestInit): Promise<T> {
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

function text(record: RecordValue, key: string): string {
  const value = record[key];
  if (value === undefined || value === null || value === "") return "—";
  return typeof value === "string" ? value : JSON.stringify(value);
}

export function MerchantManagementScreen({
  resource,
  mode,
  id,
}: Readonly<{ resource: MerchantResource; mode: "detail" | "list" | "new"; id?: string }>) {
  const copy = resourceCopy[resource];
  const fields = useMemo(
    () => (mode === "new" ? [...createOnly[resource], ...copy.fields] : copy.fields),
    [copy.fields, mode, resource],
  );
  const [items, setItems] = useState<readonly RecordValue[]>([]);
  const [detail, setDetail] = useState<RecordValue | null>(null);
  const [catalogs, setCatalogs] = useState<Record<string, readonly RecordValue[]>>({});
  const [form, setForm] = useState<Record<string, string>>({});
  const [status, setStatus] = useState<"error" | "loading" | "ready" | "saving" | "success">(
    "loading",
  );
  const [message, setMessage] = useState("");
  const [query, setQuery] = useState("");
  const visibleItems = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return items;
    return items.filter((item) => JSON.stringify(item).toLocaleLowerCase().includes(normalized));
  }, [items, query]);

  useEffect(() => {
    let alive = true;
    async function load() {
      setStatus("loading");
      try {
        const sources = [
          ...new Set(fields.flatMap((field) => (field.source ? [field.source] : []))),
        ];
        const pairs = await Promise.all(
          sources.map(async (source) => {
            const result = await request<RecordValue | readonly RecordValue[]>(
              source === "roles" ? "/staff/roles" : `/${source}?pageSize=100`,
            );
            return [
              source,
              Array.isArray(result)
                ? result
                : (((result as RecordValue).items as readonly RecordValue[]) ?? []),
            ] as const;
          }),
        );
        if (!alive) return;
        setCatalogs(Object.fromEntries(pairs));
        if (mode === "list") {
          const result = await request<{ items: readonly RecordValue[] }>(
            `/${resource}?pageSize=100`,
          );
          if (!alive) return;
          setItems(result.items);
        } else if (mode === "detail" && id) {
          const result = await request<RecordValue>(`/${resource}/${id}`);
          if (!alive) return;
          setDetail(result);
          setForm(
            Object.fromEntries(
              fields.map((field) => {
                const value =
                  field.name === "roleIds"
                    ? ((
                        (
                          (result.membership as RecordValue | undefined)?.roles as
                            readonly RecordValue[] | undefined
                        )?.[0]?.role as RecordValue | undefined
                      )?.id ?? "")
                    : result[field.name];
                return [field.name, value === undefined || value === null ? "" : String(value)];
              }),
            ),
          );
        } else {
          setForm(
            Object.fromEntries(
              fields.map((field) => [
                field.name,
                field.name === "locale"
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
        setStatus("ready");
      } catch (error) {
        if (!alive) return;
        setMessage(error instanceof Error ? error.message : "Chargement impossible");
        setStatus("error");
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [fields, id, mode, resource]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setStatus("saving");
    try {
      const payload = Object.fromEntries(
        Object.entries(form)
          .filter(([, value]) => value !== "")
          .map(([key, value]) => [key, key === "roleIds" ? [value] : value]),
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
      const result = await request<RecordValue>(path, {
        method: mode === "new" ? "POST" : "PATCH",
        body: JSON.stringify(payload),
      });
      if (resource === "staff" && mode === "detail" && Array.isArray(roleIds)) {
        await request<RecordValue>(`/staff/${id}/roles`, {
          method: "PATCH",
          body: JSON.stringify({ roleIds }),
        });
      }
      setDetail(result);
      setMessage("Enregistré avec succès.");
      setStatus("success");
      if (mode === "new") window.location.assign(`/workspace/${resource}/${String(result.id)}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Enregistrement impossible");
      setStatus("error");
    }
  }

  async function changeStatus(nextStatus: string) {
    if (!id) return;
    if (
      (nextStatus === "SUSPENDED" || nextStatus === "REMOVED") &&
      !window.confirm(`Confirmer le changement de statut vers ${nextStatus} ?`)
    )
      return;
    setStatus("saving");
    try {
      const result = await request<RecordValue>(`/${resource}/${id}/status`, {
        method: "POST",
        body: JSON.stringify({ status: nextStatus }),
      });
      setDetail(result);
      setMessage(`Statut mis à jour : ${nextStatus}.`);
      setStatus("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Action impossible");
      setStatus("error");
    }
  }

  async function archive() {
    if (!id || resource === "staff" || resource === "merchants") return;
    if (!window.confirm("Archiver ce point de vente ?")) return;
    setStatus("saving");
    try {
      const result = await request<RecordValue>(`/${resource}/${id}/archive`, {
        method: "POST",
        body: "{}",
      });
      setDetail(result);
      setMessage("Élément archivé.");
      setStatus("success");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Archivage impossible");
      setStatus("error");
    }
  }

  if (status === "loading") {
    return (
      <div className="management-state">
        <h2>Chargement…</h2>
        <p>Lecture du périmètre autorisé.</p>
      </div>
    );
  }

  if (mode.startsWith("li")) {
    return (
      <section
        className="management-page ux-module-page ux-merchant-operations"
        data-resource={resource}
      >
        <header className="management-heading ux-module-heading">
          <div>
            <Eyebrow>Opérations quotidiennes</Eyebrow>
            <h2>{copy.title}</h2>
            <p>{copy.description}</p>
          </div>
          <ButtonLink href={`/workspace/${resource}/new`}>+ Ajouter</ButtonLink>
        </header>

        <div className="ux-merchant-pulse">
          <article>
            <Icon
              name={
                resource === "branches" ? "branch" : resource === "staff" ? "staff" : "merchant"
              }
            />
            <div>
              <strong>{items.length}</strong>
              <span>
                {resource === "branches"
                  ? "implantations"
                  : resource === "staff"
                    ? "membres"
                    : "profils"}
              </span>
            </div>
          </article>
          <article>
            <span className="r-live-dot" />
            <div>
              <strong>{items.filter((item) => item.status === "ACTIVE").length} actifs</strong>
              <span>Disponibles aujourd’hui</span>
            </div>
          </article>
          <a href={`/workspace/${resource}/new`}>
            <span>Action rapide</span>
            <strong>{resource === "staff" ? "Inviter un collègue" : "Ajouter maintenant"}</strong>
            <Icon name="chevron" />
          </a>
        </div>

        <div className="ux-collection-toolbar">
          <label>
            <Icon name="search" />
            <input
              onChange={(event) => setQuery(event.target.value)}
              placeholder={`Rechercher dans ${copy.title.toLocaleLowerCase()}…`}
              value={query}
            />
          </label>
          <span>{visibleItems.length} résultat(s)</span>
          <button type="button">Statut : tous</button>
        </div>

        {message && <div className="management-notice management-notice--error">{message}</div>}

        {visibleItems.length === 0 ? (
          <div className="ux-first-use">
            <AssetImage alt="" src={webAssets.files.emptySearch} />
            <div>
              <Eyebrow>Prêt à commencer</Eyebrow>
              <h2>{query ? "Aucun résultat" : "Ajoutez votre premier élément"}</h2>
              <p>
                {query
                  ? "Essayez un autre nom ou statut."
                  : "Le formulaire guidé vous demande uniquement les informations utiles."}
              </p>
              {!query && <ButtonLink href={`/workspace/${resource}/new`}>Commencer</ButtonLink>}
            </div>
          </div>
        ) : (
          <div className={resource === "branches" ? "ux-branch-layout" : "ux-card-shell"}>
            {resource === "branches" && (
              <BranchMap branches={visibleItems} heading="Vos points de vente" />
            )}
            <div className={resource === "branches" ? "ux-branch-list" : "ux-card-collection"}>
              {visibleItems.map((item, index) => {
                const user = item.user as RecordValue | undefined;
                const itemId = String(item.id);
                return (
                  <article className="ux-entity-card ux-entity-card--merchant" key={itemId}>
                    <header>
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
                          <Icon name={resource === "branches" ? "branch" : "merchant"} />
                        )}
                      </span>
                      <details className="ux-action-menu">
                        <summary aria-label="Actions">•••</summary>
                        <div>
                          <a href={`/workspace/${resource}/${itemId}`}>Ouvrir</a>
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
                          alt={`Espace de ${text(item, item.displayName ? "displayName" : "name")}`}
                          src={merchantPhotoFor(
                            `${text(item, "code")} ${text(item, item.displayName ? "displayName" : "name")}`,
                          )}
                        />
                      </a>
                    )}
                    <a className="ux-entity-card__body" href={`/workspace/${resource}/${itemId}`}>
                      <span>
                        {resource === "staff" ? text(user ?? {}, "email") : text(item, "code")}
                      </span>
                      <h3>
                        {resource === "staff"
                          ? text(user ?? {}, "displayName")
                          : text(item, item.displayName ? "displayName" : "name")}
                      </h3>
                      <p>
                        {resource === "branches"
                          ? `${text(item, "addressLine")} · ${text(item, "city")}`
                          : copy.description}
                      </p>
                    </a>
                    <footer>
                      <StatusPill tone={item.status === "ACTIVE" ? "success" : "neutral"}>
                        {text(item, "status")}
                      </StatusPill>
                      <a href={`/workspace/${resource}/${itemId}`}>Gérer →</a>
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
        <header className="management-heading">
          <div>
            <Eyebrow>Gestion quotidienne</Eyebrow>
            <h2>{copy.title}</h2>
            <p>{copy.description}</p>
          </div>
          <ResourceVisual alt={`Illustration ${copy.title}`} assets={resourceVisuals[resource]} />
          <ButtonLink href={`/workspace/${resource}/new`}>Créer</ButtonLink>
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
            <p>La liste est vide pour votre périmètre d’accès.</p>
          </div>
        ) : (
          <div className="management-table-wrap">
            <table className="management-table">
              <thead>
                <tr>
                  <th>Nom</th>
                  <th>Référence</th>
                  <th>Statut</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => {
                  const user = item.user as RecordValue | undefined;
                  return (
                    <tr key={String(item.id)}>
                      <td>
                        {resource === "staff"
                          ? text(user ?? {}, "displayName")
                          : text(item, item.displayName ? "displayName" : "name")}
                      </td>
                      <td>
                        {resource === "staff" ? text(user ?? {}, "email") : text(item, "code")}
                      </td>
                      <td>
                        <StatusPill tone={item.status === "ACTIVE" ? "success" : "neutral"}>
                          {text(item, "status")}
                        </StatusPill>
                      </td>
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
    <section
      className="management-page ux-module-page ux-editor-page ux-editor-page--merchant"
      data-resource={resource}
    >
      <header className="management-heading">
        <div>
          <Eyebrow>{mode === "new" ? "Création" : "Détail"}</Eyebrow>
          <h2>
            {mode === "new"
              ? copy.title
              : text(
                  detail ?? {},
                  detail?.displayName ? "displayName" : detail?.name ? "name" : "jobTitle",
                )}
          </h2>
          <p>{copy.description}</p>
        </div>
        <ResourceVisual alt={`Illustration ${copy.title}`} assets={resourceVisuals[resource]} />
        <ButtonLink href={`/workspace/${resource}`} variant="secondary">
          Retour
        </ButtonLink>
      </header>
      {message && (
        <div
          className={`management-notice management-notice--${status === "error" ? "error" : "success"}`}
        >
          {message}
        </div>
      )}
      <div className="ux-editor-layout">
        <aside className="ux-editor-rail">
          <Eyebrow>{mode === "new" ? "Assistant de création" : "Fiche opérationnelle"}</Eyebrow>
          <ol>
            <li className="is-current">
              <span>1</span>
              <div>
                <strong>Informations utiles</strong>
                <small>Les données visibles par l’équipe</small>
              </div>
            </li>
            <li>
              <span>2</span>
              <div>
                <strong>Affectation</strong>
                <small>Commerce, branche et rôle</small>
              </div>
            </li>
            <li>
              <span>3</span>
              <div>
                <strong>Mise en service</strong>
                <small>Vérifier puis activer</small>
              </div>
            </li>
          </ol>
          <div className="ux-context-help">
            <Icon name="help" />
            <p>Vous pourrez modifier ces informations après l’enregistrement.</p>
          </div>
        </aside>
        <form className="management-form ux-editor-form" onSubmit={submit}>
          <header>
            <div>
              <h3>{mode === "new" ? "Ajouter en quelques étapes" : "Mettre à jour la fiche"}</h3>
              <p>Renseignez uniquement les informations nécessaires aux opérations.</p>
            </div>
          </header>
          {fields.map((field) => (
            <label className="management-field" key={field.name}>
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
                        option,
                        option.displayName ? "displayName" : option.name ? "name" : "code",
                      )}
                    </option>
                  ))}
                </select>
              ) : (
                <input
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
            <Button disabled={status === "saving"} type="submit">
              Enregistrer
            </Button>
          </div>
        </form>
      </div>
      {mode === "detail" && (
        <div className="management-status-actions">
          <Eyebrow>Accès et statut</Eyebrow>
          <div>
            {copy.statuses.map((nextStatus) => (
              <Button
                key={nextStatus}
                type="button"
                variant="secondary"
                onClick={() => void changeStatus(nextStatus)}
              >
                {nextStatus}
              </Button>
            ))}
            {resource === "branches" && (
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
