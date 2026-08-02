"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from "react";

import { Button, Icon, MetricCard, PageHeader, StatusPill } from "@rabbehni/design-system/web";

export type Phase9Resource =
  | "audit"
  | "billing"
  | "localization"
  | "regions"
  | "plans"
  | "subscriptions"
  | "system"
  | "tenants"
  | "white-label";

type JsonRecord = Record<string, unknown>;

interface Phase9ScreenProps {
  readonly apiUrl: string;
  readonly identity: "admin" | "merchant";
  readonly resource: Phase9Resource;
}

async function request<T>(apiUrl: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${apiUrl}/v1${path}`, {
    credentials: "include",
    headers: { "content-type": "application/json", ...init?.headers },
    ...init,
  });
  const body = (await response.json().catch(() => null)) as T | { message?: string } | null;
  if (!response.ok) {
    throw new Error(
      body && typeof body === "object" && "message" in body && typeof body.message === "string"
        ? body.message
        : `Erreur HTTP ${response.status}`,
    );
  }
  return body as T;
}

function text(value: unknown, fallback = "—"): string {
  return typeof value === "string" || typeof value === "number" ? String(value) : fallback;
}

function money(minor: unknown, currency: unknown): string {
  const value = typeof minor === "number" ? minor : 0;
  return new Intl.NumberFormat("fr-TN", {
    currency: typeof currency === "string" ? currency : "TND",
    style: "currency",
  }).format(value / 100);
}

function date(value: unknown): string {
  if (typeof value !== "string") return "—";
  return new Intl.DateTimeFormat("fr-TN", { dateStyle: "medium" }).format(new Date(value));
}

function paymentStatusLabel(status: unknown): string {
  const value = text(status);
  return (
    {
      FAILED: "Échoué",
      PAID: "Payée",
      PENDING: "En attente",
      SUCCEEDED: "Réussi",
      UNCOLLECTIBLE: "Impayée",
    }[value] ?? value
  );
}

function paymentReference(value: unknown): string {
  const reference = text(value);
  const suffix = reference.split("_").at(-1)?.slice(-12).toUpperCase();
  return suffix ? `PAY-${suffix}` : reference;
}

function paymentIncident(value: unknown): string {
  const incident = text(value);
  if (incident === "sandbox_card_declined") return "Carte refusée";
  return incident;
}

function tone(status: unknown): "info" | "neutral" | "success" | "warning" {
  if (status === "ACTIVE" || status === "PAID" || status === "SUCCEEDED") return "success";
  if (status === "FAILED" || status === "PAST_DUE" || status === "UNCOLLECTIBLE") return "warning";
  if (status === "TRIALING" || status === "PENDING" || status === "OPEN") return "info";
  return "neutral";
}

const paymentMethods = [
  {
    id: "d17",
    label: "D17",
    src: "/assets/rabbehni/payments/logos/payment-logo-d17.png",
  },
  {
    id: "visa",
    label: "Visa",
    src: "/assets/rabbehni/payments/logos/payment-logo-visa.png",
  },
  {
    id: "mastercard",
    label: "Mastercard",
    src: "/assets/rabbehni/payments/logos/payment-logo-mastercard.png",
  },
  {
    id: "maestro",
    label: "Maestro",
    src: "/assets/rabbehni/payments/logos/payment-logo-maestro.png",
  },
  {
    id: "jcb",
    label: "JCB",
    src: "/assets/rabbehni/payments/logos/payment-logo-jcb.png",
  },
  {
    id: "paypal",
    label: "PayPal",
    src: "/assets/rabbehni/payments/logos/payment-logo-paypal.png",
  },
] as const;

const regionalCatalog = {
  countries: [
    ["TN", "Tunisie"],
    ["FR", "France"],
    ["GB", "Royaume-Uni"],
    ["AE", "Emirats arabes unis"],
    ["SA", "Arabie saoudite"],
    ["QA", "Qatar"],
  ],
  currencies: [
    ["TND", "Dinar tunisien (TND)"],
    ["EUR", "Euro (EUR)"],
    ["GBP", "Livre sterling (GBP)"],
    ["AED", "Dirham des Emirats (AED)"],
    ["SAR", "Riyal saoudien (SAR)"],
    ["QAR", "Riyal qatari (QAR)"],
  ],
  timezones: [
    ["Africa/Tunis", "Tunis (UTC+1)"],
    ["Europe/Paris", "Paris"],
    ["Europe/London", "Londres"],
    ["Asia/Dubai", "Dubai (UTC+4)"],
    ["Asia/Riyadh", "Riyad (UTC+3)"],
    ["Asia/Qatar", "Doha (UTC+3)"],
  ],
} as const;

function PaymentMethods({
  onSelect,
  selected,
}: Readonly<{
  onSelect?: (id: string) => void;
  selected?: string;
}>) {
  return (
    <div aria-label="Modes de paiement acceptés" className="r-payment-methods">
      {paymentMethods.map((method) =>
        onSelect ? (
          <button
            aria-label={`Payer avec ${method.label}`}
            aria-pressed={selected === method.id}
            className="r-payment-method"
            key={method.id}
            onClick={() => onSelect(method.id)}
            type="button"
          >
            <img alt={method.label} src={method.src} />
          </button>
        ) : (
          <span className="r-payment-method" key={method.id}>
            <img alt={method.label} src={method.src} />
          </span>
        ),
      )}
    </div>
  );
}

export function Phase9Screen({ apiUrl, identity, resource }: Phase9ScreenProps) {
  const screen =
    resource === "plans" ? (
      <PlansScreen apiUrl={apiUrl} canManage={identity === "admin"} />
    ) : resource === "subscriptions" ? (
      <SubscriptionScreen apiUrl={apiUrl} />
    ) : resource === "billing" ? (
      <BillingScreen apiUrl={apiUrl} />
    ) : resource === "white-label" ? (
      <BrandingScreen apiUrl={apiUrl} />
    ) : resource === "localization" ? (
      <LocalizationScreen apiUrl={apiUrl} />
    ) : resource === "regions" ? (
      <RegionsScreen apiUrl={apiUrl} />
    ) : resource === "audit" ? (
      <AuditScreen apiUrl={apiUrl} />
    ) : resource === "system" ? (
      <SystemScreen apiUrl={apiUrl} />
    ) : (
      <TenantScreen apiUrl={apiUrl} />
    );
  return (
    <section className="ux-module-page ux-commercial-page" data-resource={resource}>
      {screen}
    </section>
  );
}

function useRemote<T>(loader: () => Promise<T>, dependencies: readonly unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const reload = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setData(await loader());
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Chargement impossible");
    } finally {
      setLoading(false);
    }
  }, dependencies);
  useEffect(() => {
    void reload();
  }, [reload]);
  return { data, error, loading, reload };
}

function LoadingState() {
  return (
    <div className="r-panel r-phase9-state" aria-live="polite">
      <span className="r-spinner" />
      <div>
        <strong>Chargement des données</strong>
        <p>Synchronisation sécurisée avec le compte en cours.</p>
      </div>
    </div>
  );
}

function Notice({ children, error = false }: Readonly<{ children: string; error?: boolean }>) {
  return (
    <div className={`r-notice ${error ? "r-notice--error" : "r-notice--success"}`} role="status">
      {children}
    </div>
  );
}

function PlansScreen({ apiUrl, canManage }: Readonly<{ apiUrl: string; canManage: boolean }>) {
  const remote = useRemote(
    () => request<readonly JsonRecord[]>(apiUrl, "/commercial/plans?includeInactive=true"),
    [apiUrl],
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function createPlan(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage("");
    setError("");
    try {
      await request(apiUrl, "/commercial/plans", {
        method: "POST",
        body: JSON.stringify({
          code: String(form.get("code") ?? ""),
          name: String(form.get("name") ?? ""),
          description: String(form.get("description") ?? ""),
          status: "ACTIVE",
          currency: String(form.get("currency") ?? "TND"),
          monthlyPriceMinor: Math.round(Number(form.get("monthlyPrice") ?? 0) * 100),
          annualPriceMinor: Math.round(Number(form.get("annualPrice") ?? 0) * 100),
          transactionFeeBasisPoints: Number(form.get("transactionFee") ?? 0),
          trialDays: Number(form.get("trialDays") ?? 14),
          sortOrder: 40,
          features: [
            "core_management",
            "loyalty",
            "qr",
            "gamification",
            "smart_habits",
            "marketing_automation",
            "multichannel_notifications",
            "advanced_analytics",
            "advanced_reporting",
          ].map((featureKey) => ({ featureKey, enabled: true, configuration: {} })),
          quotas: [
            { metricKey: "branches", limitValue: 25, period: "MONTH" },
            { metricKey: "staff", limitValue: 250, period: "MONTH" },
            { metricKey: "customers", limitValue: 50_000, period: "MONTH" },
          ],
        }),
      });
      event.currentTarget.reset();
      setMessage("Le plan a été créé et publié.");
      await remote.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Création impossible");
    }
  }

  if (remote.loading) return <LoadingState />;
  const plans = remote.data ?? [];
  return (
    <section>
      <PageHeader
        eyebrow="Catalogue SaaS"
        title="Plans et droits fonctionnels"
        description="Tarification, période d’essai, fonctionnalités incluses et limites de chaque compte."
        actions={
          canManage ? (
            <a className="r-button r-button--primary" href="#new-plan">
              Nouveau plan
            </a>
          ) : undefined
        }
      />
      {(remote.error || error) && <Notice error>{remote.error || error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <div className="r-plan-grid">
        {plans.map((plan) => {
          const features = (plan.featureEntitlements as readonly JsonRecord[] | undefined) ?? [];
          const quotas = (plan.quotaLimits as readonly JsonRecord[] | undefined) ?? [];
          return (
            <article className="r-plan-card" key={text(plan.id)}>
              <header>
                <div>
                  <StatusPill tone={tone(plan.status)}>{text(plan.status)}</StatusPill>
                  <h3>{text(plan.name)}</h3>
                  <p>{text(plan.description)}</p>
                </div>
                <span className="r-plan-card__icon">
                  <Icon name="plan" />
                </span>
              </header>
              <div className="r-plan-price">
                <strong>{money(plan.monthlyPriceMinor, plan.currency)}</strong>
                <span>/ mois</span>
              </div>
              <dl>
                <div>
                  <dt>Essai</dt>
                  <dd>{text(plan.trialDays)} jours</dd>
                </div>
                <div>
                  <dt>Frais transaction</dt>
                  <dd>{Number(plan.transactionFeeBasisPoints ?? 0) / 100}%</dd>
                </div>
                <div>
                  <dt>Abonnements</dt>
                  <dd>{text((plan._count as JsonRecord | undefined)?.subscriptions, "0")}</dd>
                </div>
              </dl>
              <ul className="r-feature-list">
                {features.slice(0, 6).map((feature) => (
                  <li key={text(feature.id)}>
                    <span>✓</span>
                    {text(feature.featureKey).replaceAll("_", " ")}
                  </li>
                ))}
              </ul>
              <div className="r-plan-quotas">
                {quotas.map((quota) => (
                  <span key={text(quota.id)}>
                    {text(quota.metricKey)} · {text(quota.limitValue)}
                  </span>
                ))}
              </div>
            </article>
          );
        })}
      </div>
      {canManage && (
        <form className="r-panel r-enterprise-form" id="new-plan" onSubmit={createPlan}>
          <div className="r-panel__header">
            <h3>Créer un plan commercial</h3>
            <StatusPill tone="info">Configuration commerciale</StatusPill>
          </div>
          <div className="r-form-grid">
            <label>
              <span>Code</span>
              <input name="code" placeholder="business-plus" required />
            </label>
            <label>
              <span>Nom</span>
              <input name="name" placeholder="Business Plus" required />
            </label>
            <label className="r-form-field--wide">
              <span>Description</span>
              <input name="description" placeholder="Positionnement et clientèle cible" required />
            </label>
            <label>
              <span>Prix mensuel</span>
              <input min="0" name="monthlyPrice" step="0.01" type="number" required />
            </label>
            <label>
              <span>Prix annuel</span>
              <input min="0" name="annualPrice" step="0.01" type="number" required />
            </label>
            <label>
              <span>Devise</span>
              <select defaultValue="TND" name="currency">
                <option>TND</option>
                <option>EUR</option>
                <option>USD</option>
              </select>
            </label>
            <label>
              <span>Essai en jours</span>
              <input defaultValue="14" max="90" min="0" name="trialDays" type="number" />
            </label>
            <label>
              <span>Frais (points de base)</span>
              <input defaultValue="50" max="10000" min="0" name="transactionFee" type="number" />
            </label>
          </div>
          <div className="r-form-actions">
            <Button type="submit">Créer le plan</Button>
          </div>
        </form>
      )}
    </section>
  );
}

function SubscriptionScreen({ apiUrl }: Readonly<{ apiUrl: string }>) {
  const remote = useRemote(() => request<JsonRecord>(apiUrl, "/commercial/overview"), [apiUrl]);
  const plansRemote = useRemote(
    () => request<readonly JsonRecord[]>(apiUrl, "/commercial/plans"),
    [apiUrl],
  );
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [checkout, setCheckout] = useState<JsonRecord | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("d17");
  const current = remote.data?.current as JsonRecord | null | undefined;
  const plan = current?.plan as JsonRecord | undefined;

  async function lifecycle(action: string, extra: JsonRecord = {}) {
    setMessage("");
    setError("");
    try {
      await request(apiUrl, `/commercial/subscriptions/${action}`, {
        method: "POST",
        body: JSON.stringify({ idempotencyKey: crypto.randomUUID(), ...extra }),
      });
      setMessage(`Action « ${action} » exécutée avec succès.`);
      await remote.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Action impossible");
    }
  }

  async function startCheckout() {
    if (!current) return;
    setError("");
    try {
      setCheckout(
        await request<JsonRecord>(apiUrl, "/commercial/checkout", {
          method: "POST",
          body: JSON.stringify({
            subscriptionId: current.id,
            idempotencyKey: crypto.randomUUID(),
          }),
        }),
      );
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Checkout impossible");
    }
  }

  async function confirm(outcome: "FAILED" | "SUCCEEDED") {
    if (!checkout) return;
    try {
      await request(apiUrl, "/commercial/checkout/confirm", {
        method: "POST",
        body: JSON.stringify({
          checkoutToken: checkout.checkoutToken,
          outcome,
          idempotencyKey: crypto.randomUUID(),
          ...(outcome === "FAILED" ? { failureCode: "sandbox_card_declined" } : {}),
        }),
      });
      setCheckout(null);
      setMessage(
        outcome === "SUCCEEDED"
          ? "Paiement accepté et facture générée."
          : "Paiement refusé. L’abonnement est passé en impayé.",
      );
      await remote.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Confirmation impossible");
    }
  }

  if (remote.loading) return <LoadingState />;
  const entitlements = (remote.data?.entitlements as readonly JsonRecord[] | undefined) ?? [];
  const usage = (remote.data?.usage as readonly JsonRecord[] | undefined) ?? [];
  return (
    <section>
      <PageHeader
        eyebrow="Cycle commercial"
        title="Abonnement du tenant"
        description="Essai, activation, changement de plan, renouvellement, suspension et résiliation idempotents."
        actions={
          current ? (
            <Button onClick={() => void startCheckout()}>Effectuer un paiement</Button>
          ) : undefined
        }
      />
      {(remote.error || error) && <Notice error>{remote.error || error}</Notice>}
      {message && <Notice>{message}</Notice>}
      {current && plan ? (
        <>
          <div className="r-metrics-grid">
            <MetricCard icon="subscription" label="Plan actuel" value={text(plan.name)} />
            <MetricCard icon="activity" label="Statut" value={text(current.status)} />
            <MetricCard
              icon="billing"
              label="Prochaine échéance"
              value={date(current.nextBillingAt)}
            />
            <MetricCard icon="plan" label="Facturation" value={text(current.billingInterval)} />
          </div>
          <div className="r-two-columns">
            <article className="r-panel">
              <div className="r-panel__header">
                <h3>Actions sur l’abonnement</h3>
                <StatusPill tone={tone(current.status)}>{text(current.status)}</StatusPill>
              </div>
              <div className="r-panel__body r-action-grid">
                <Button variant="secondary" onClick={() => void lifecycle("activate")}>
                  Activer
                </Button>
                <Button variant="secondary" onClick={() => void lifecycle("renew")}>
                  Renouveler
                </Button>
                <Button variant="secondary" onClick={() => void lifecycle("suspend")}>
                  Suspendre
                </Button>
                <Button variant="secondary" onClick={() => void lifecycle("reactivate")}>
                  Réactiver
                </Button>
                <Button
                  variant="quiet"
                  onClick={() =>
                    void lifecycle("cancel", {
                      atPeriodEnd: true,
                      reason: "Résiliation demandée depuis le portail",
                    })
                  }
                >
                  Résilier en fin de période
                </Button>
              </div>
            </article>
            <article className="r-panel">
              <div className="r-panel__header">
                <h3>Changer de plan</h3>
              </div>
              <div className="r-panel__body">
                <select
                  aria-label="Plan de destination"
                  className="r-select-full"
                  defaultValue=""
                  onChange={(event) => {
                    if (event.target.value)
                      void lifecycle("change-plan", {
                        planId: event.target.value,
                        reason: "Changement demandé depuis le portail",
                      });
                  }}
                >
                  <option value="">Sélectionner un plan</option>
                  {(plansRemote.data ?? [])
                    .filter((candidate) => candidate.id !== current.planId)
                    .map((candidate) => (
                      <option key={text(candidate.id)} value={text(candidate.id)}>
                        {text(candidate.name)} ·{" "}
                        {money(candidate.monthlyPriceMinor, candidate.currency)}
                      </option>
                    ))}
                </select>
                <p className="r-help-text">
                  Le système classe automatiquement l’opération comme upgrade ou downgrade.
                </p>
              </div>
            </article>
          </div>
          <div className="r-two-columns r-section-gap">
            <article className="r-panel">
              <div className="r-panel__header">
                <h3>Fonctionnalités autorisées</h3>
              </div>
              <div className="r-panel__body r-entitlement-grid">
                {entitlements.map((item) => (
                  <span key={text(item.key)}>
                    <b>✓</b> {text(item.key).replaceAll("_", " ")}
                  </span>
                ))}
              </div>
            </article>
            <article className="r-panel">
              <div className="r-panel__header">
                <h3>Consommation du mois</h3>
              </div>
              <div className="r-panel__body">
                {usage.length === 0 ? (
                  <p className="r-help-text">Aucune consommation facturable enregistrée.</p>
                ) : (
                  usage.map((item) => {
                    const used = Number(item.used ?? 0);
                    const limit = typeof item.limit === "number" ? item.limit : null;
                    return (
                      <div className="r-usage-row" key={text(item.metricKey)}>
                        <div>
                          <strong>{text(item.metricKey)}</strong>
                          <span>
                            {used} / {limit ?? "∞"}
                          </span>
                        </div>
                        <progress max={limit ?? Math.max(used, 1)} value={used} />
                      </div>
                    );
                  })
                )}
              </div>
            </article>
          </div>
        </>
      ) : (
        <article className="r-panel r-phase9-state">
          <Icon name="subscription" />
          <div>
            <strong>Aucun abonnement actif</strong>
            <p>Sélectionnez un plan pour démarrer une période d’essai sécurisée.</p>
          </div>
        </article>
      )}
      {checkout && (
        <div className="r-dialog-backdrop" role="presentation">
          <section aria-modal="true" className="r-dialog" role="dialog">
            <header>
              <span className="r-dialog__icon">
                <Icon name="billing" />
              </span>
              <div>
                <h3>Paiement sécurisé</h3>
                <p>Choisissez votre moyen de paiement puis confirmez l’opération.</p>
              </div>
            </header>
            <div className="r-payment-choice">
              <strong>Mode de paiement</strong>
              <PaymentMethods onSelect={setPaymentMethod} selected={paymentMethod} />
            </div>
            <dl>
              <div>
                <dt>Montant</dt>
                <dd>{money(checkout.amountMinor, checkout.currency)}</dd>
              </div>
              <div>
                <dt>Moyen choisi</dt>
                <dd>{paymentMethods.find((method) => method.id === paymentMethod)?.label}</dd>
              </div>
              <div>
                <dt>Expiration</dt>
                <dd>{date(checkout.expiresAt)}</dd>
              </div>
            </dl>
            <div className="r-dialog__actions">
              <Button variant="quiet" onClick={() => setCheckout(null)}>
                Fermer
              </Button>
              <Button onClick={() => void confirm("SUCCEEDED")}>Payer maintenant</Button>
            </div>
          </section>
        </div>
      )}
    </section>
  );
}

function BillingScreen({ apiUrl }: Readonly<{ apiUrl: string }>) {
  const remote = useRemote(async () => {
    const [invoices, payments] = await Promise.all([
      request<readonly JsonRecord[]>(apiUrl, "/commercial/invoices"),
      request<readonly JsonRecord[]>(apiUrl, "/commercial/payments"),
    ]);
    return { invoices, payments };
  }, [apiUrl]);
  if (remote.loading) return <LoadingState />;
  const invoices = remote.data?.invoices ?? [];
  const payments = remote.data?.payments ?? [];
  const collected = payments
    .filter((payment) => payment.status === "SUCCEEDED")
    .reduce((sum, payment) => sum + Number(payment.amountMinor ?? 0), 0);
  return (
    <section>
      <PageHeader
        eyebrow="Facturation"
        title="Facturation et paiements"
        description="Consultez les factures, les paiements, les échecs et les frais de transaction."
      />
      {remote.error && <Notice error>{remote.error}</Notice>}
      <article className="r-panel r-payment-panel">
        <div>
          <span>Moyens de paiement</span>
          <strong>Paiement sécurisé et traçable</strong>
        </div>
        <PaymentMethods />
      </article>
      <div className="r-metrics-grid">
        <MetricCard icon="billing" label="Factures" value={String(invoices.length)} />
        <MetricCard icon="activity" label="Paiements" value={String(payments.length)} />
        <MetricCard icon="points" label="Montant validé" value={money(collected, "TND")} />
        <MetricCard
          icon="audit"
          label="Paiements échoués"
          value={String(payments.filter((payment) => payment.status === "FAILED").length)}
        />
      </div>
      <DataTable
        columns={["Numéro", "Période", "Statut", "Sous-total", "Frais", "Total"]}
        empty="Aucune facture générée."
        rows={invoices.map((invoice) => [
          text(invoice.number),
          `${date(invoice.periodStart)} — ${date(invoice.periodEnd)}`,
          <StatusPill key="status" tone={tone(invoice.status)}>
            {paymentStatusLabel(invoice.status)}
          </StatusPill>,
          money(invoice.subtotalMinor, invoice.currency),
          money(invoice.feeMinor, invoice.currency),
          money(invoice.totalMinor, invoice.currency),
        ])}
        title="Factures"
      />
      <div className="r-section-gap">
        <DataTable
          columns={["Référence", "Date", "Statut", "Montant", "Frais", "Incident"]}
          empty="Aucun paiement enregistré."
          rows={payments.map((payment) => [
            paymentReference(payment.providerRef),
            date(payment.processedAt),
            <StatusPill key="status" tone={tone(payment.status)}>
              {paymentStatusLabel(payment.status)}
            </StatusPill>,
            money(payment.amountMinor, payment.currency),
            money(payment.feeMinor, payment.currency),
            paymentIncident(payment.failureCode),
          ])}
          title="Historique des paiements"
        />
      </div>
    </section>
  );
}

function BrandingScreen({ apiUrl }: Readonly<{ apiUrl: string }>) {
  const remote = useRemote(() => request<JsonRecord>(apiUrl, "/commercial/branding"), [apiUrl]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const profile = (remote.data?.profile as JsonRecord | null | undefined) ?? {};

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setMessage("");
    setError("");
    try {
      await request(apiUrl, "/commercial/branding", {
        method: "PATCH",
        body: JSON.stringify({
          productName: String(form.get("productName")),
          logoUrl: String(form.get("logoUrl") ?? "") || null,
          faviconUrl: String(form.get("faviconUrl") ?? "") || null,
          primaryColor: String(form.get("primaryColor")),
          secondaryColor: String(form.get("secondaryColor")),
          fontFamily: String(form.get("fontFamily")),
          emailSenderName: String(form.get("emailSenderName")),
          emailReplyTo: String(form.get("emailReplyTo") ?? "") || null,
          emailFooter: String(form.get("emailFooter") ?? "") || null,
          themeMode: String(form.get("themeMode")),
        }),
      });
      setMessage("Identité de marque enregistrée.");
      await remote.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Enregistrement impossible");
    }
  }

  if (remote.loading) return <LoadingState />;
  return (
    <section>
      <PageHeader
        eyebrow="Marque blanche"
        title="Identité du tenant"
        description="Logo, couleurs, typographie, emails, thème et fondation des domaines personnalisés."
      />
      {(remote.error || error) && <Notice error>{remote.error || error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <div className="r-branding-layout">
        <form className="r-panel r-enterprise-form" onSubmit={submit}>
          <div className="r-panel__header">
            <h3>Paramètres de marque</h3>
            <StatusPill tone="info">Tenant spécifique</StatusPill>
          </div>
          <div className="r-form-grid">
            <label>
              <span>Nom du produit</span>
              <input
                defaultValue={text(profile.productName, "Rabbehni")}
                name="productName"
                required
              />
            </label>
            <label>
              <span>Typographie</span>
              <select defaultValue={text(profile.fontFamily, "Inter")} name="fontFamily">
                <option>Inter</option>
                <option>Manrope</option>
                <option>IBM Plex Sans</option>
                <option>Noto Sans Arabic</option>
              </select>
            </label>
            <label>
              <span>Couleur principale</span>
              <input
                defaultValue={text(profile.primaryColor, "#0F766E")}
                name="primaryColor"
                type="color"
              />
            </label>
            <label>
              <span>Couleur secondaire</span>
              <input
                defaultValue={text(profile.secondaryColor, "#2563EB")}
                name="secondaryColor"
                type="color"
              />
            </label>
            <label className="r-form-field--wide">
              <span>URL du logo</span>
              <input
                defaultValue={text(profile.logoUrl, "")}
                name="logoUrl"
                placeholder="https://…"
              />
            </label>
            <label className="r-form-field--wide">
              <span>URL du favicon</span>
              <input
                defaultValue={text(profile.faviconUrl, "")}
                name="faviconUrl"
                placeholder="https://…"
              />
            </label>
            <label>
              <span>Expéditeur email</span>
              <input
                defaultValue={text(profile.emailSenderName, "Rabbehni")}
                name="emailSenderName"
                required
              />
            </label>
            <label>
              <span>Adresse de réponse</span>
              <input
                defaultValue={text(profile.emailReplyTo, "")}
                name="emailReplyTo"
                type="email"
              />
            </label>
            <label>
              <span>Thème préféré</span>
              <select defaultValue={text(profile.themeMode, "LIGHT")} name="themeMode">
                <option value="LIGHT">Clair</option>
                <option value="DARK">Sombre</option>
                <option value="SYSTEM">Système</option>
              </select>
            </label>
            <label className="r-form-field--wide">
              <span>Pied d’email</span>
              <textarea defaultValue={text(profile.emailFooter, "")} name="emailFooter" rows={3} />
            </label>
          </div>
          <div className="r-form-actions">
            <Button type="submit">Enregistrer la marque</Button>
          </div>
        </form>
        <aside
          className="r-brand-preview"
          style={
            {
              "--preview-primary": text(profile.primaryColor, "#0F766E"),
              "--preview-secondary": text(profile.secondaryColor, "#2563EB"),
            } as CSSProperties
          }
        >
          <span>Aperçu tenant</span>
          <div className="r-brand-preview__window">
            <header>
              <b>{text(profile.productName, "Rabbehni")}</b>
              <i />
            </header>
            <main>
              <small>Tableau de bord</small>
              <strong>Bonjour, équipe Rabbehni</strong>
              <div>
                <span />
                <span />
                <span />
              </div>
              <button type="button">Action principale</button>
            </main>
          </div>
          <p>Prévisualisation uniquement. Aucun style global n’est appliqué avant validation.</p>
        </aside>
      </div>
      <CustomDomains
        apiUrl={apiUrl}
        domains={(remote.data?.domains as readonly JsonRecord[]) ?? []}
        onSaved={remote.reload}
      />
    </section>
  );
}

function CustomDomains({
  apiUrl,
  domains,
  onSaved,
}: Readonly<{
  apiUrl: string;
  domains: readonly JsonRecord[];
  onSaved: () => Promise<void>;
}>) {
  const [message, setMessage] = useState("");
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await request(apiUrl, "/commercial/domains", {
        method: "POST",
        body: JSON.stringify({ hostname: String(form.get("hostname")) }),
      });
      setMessage("Domaine ajouté. La vérification DNS reste en attente.");
      event.currentTarget.reset();
      await onSaved();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Ajout impossible");
    }
  }
  return (
    <section className="r-panel r-section-gap">
      <div className="r-panel__header">
        <h3>Domaines personnalisés</h3>
        <StatusPill tone="neutral">Fondation</StatusPill>
      </div>
      <div className="r-panel__body">
        <form className="r-inline-form" onSubmit={submit}>
          <input name="hostname" placeholder="fidelite.exemple.tn" required />
          <Button type="submit">Ajouter</Button>
        </form>
        {message && <p className="r-help-text">{message}</p>}
        <div className="r-domain-list">
          {domains.map((domain) => (
            <div key={text(domain.id)}>
              <Icon name="globe" />
              <div>
                <strong>{text(domain.hostname)}</strong>
                <span>Token DNS : {text(domain.verificationToken)}</span>
              </div>
              <StatusPill tone={tone(domain.status)}>{text(domain.status)}</StatusPill>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function LocalizationScreen({ apiUrl }: Readonly<{ apiUrl: string }>) {
  const remote = useRemote(() => request<JsonRecord>(apiUrl, "/commercial/branding"), [apiUrl]);
  const [message, setMessage] = useState("");
  const localization = (remote.data?.localization as JsonRecord | null | undefined) ?? {};
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await request(apiUrl, "/commercial/localization", {
        method: "PATCH",
        body: JSON.stringify({
          defaultLanguage: String(form.get("defaultLanguage")),
          enabledLanguages: form.getAll("languages").map(String),
          countries: form.getAll("countries").map(String),
          currencies: form.getAll("currencies").map(String),
          timezones: form.getAll("timezones").map(String),
          dateFormat: String(form.get("dateFormat")),
          timeFormat: String(form.get("timeFormat")),
          numberLocale: String(form.get("numberLocale")),
          direction: String(form.get("direction")),
        }),
      });
      setMessage("Paramètres régionaux enregistrés.");
      await remote.reload();
    } catch (caught) {
      setMessage(caught instanceof Error ? caught.message : "Enregistrement impossible");
    }
  }
  if (remote.loading) return <LoadingState />;
  const languages = (localization.enabledLanguages as readonly string[] | undefined) ?? [
    "fr",
    "en",
    "ar",
  ];
  const selectedCountries = (localization.countries as readonly string[] | undefined) ?? ["TN"];
  const selectedCurrencies = (localization.currencies as readonly string[] | undefined) ?? ["TND"];
  const selectedTimezones = (localization.timezones as readonly string[] | undefined) ?? [
    "Africa/Tunis",
  ];
  return (
    <section>
      <PageHeader
        eyebrow="Internationalisation"
        title="Langues et formats régionaux"
        description="Pays, devises, fuseaux, formats et direction RTL/LTR propres au tenant."
      />
      {message && <Notice error={message.includes("impossible")}>{message}</Notice>}
      <form className="r-panel r-enterprise-form" onSubmit={submit}>
        <div className="r-panel__header">
          <h3>Configuration de localisation</h3>
          <StatusPill tone="info">{text(localization.direction, "LTR")}</StatusPill>
        </div>
        <div className="r-form-grid">
          <label>
            <span>Langue par défaut</span>
            <select defaultValue={text(localization.defaultLanguage, "fr")} name="defaultLanguage">
              <option value="fr">Français</option>
              <option value="en">English</option>
              <option value="ar">العربية</option>
            </select>
          </label>
          <fieldset>
            <legend>Langues actives</legend>
            {(
              [
                ["fr", "Français"],
                ["en", "English"],
                ["ar", "العربية"],
              ] as const
            ).map(([value, label]) => (
              <label className="r-check" key={value}>
                <input
                  defaultChecked={languages.includes(value)}
                  name="languages"
                  type="checkbox"
                  value={value}
                />
                <span>{label}</span>
              </label>
            ))}
          </fieldset>
          {(
            [
              ["countries", "Pays actifs", regionalCatalog.countries, selectedCountries],
              ["currencies", "Devises acceptees", regionalCatalog.currencies, selectedCurrencies],
              ["timezones", "Fuseaux horaires", regionalCatalog.timezones, selectedTimezones],
            ] as const
          ).map(([name, label, options, selected]) => (
            <fieldset className="r-form-field--wide" key={name}>
              <legend>{label}</legend>
              <div className="r-regional-options">
                {options.map(([value, optionLabel]) => (
                  <label className="r-check" key={value}>
                    <input
                      defaultChecked={(selected as readonly string[]).includes(value)}
                      name={name}
                      type="checkbox"
                      value={value}
                    />
                    <span>{optionLabel}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <label>
            <span>Format de date</span>
            <select defaultValue={text(localization.dateFormat, "DD/MM/YYYY")} name="dateFormat">
              <option>DD/MM/YYYY</option>
              <option>MM/DD/YYYY</option>
              <option>YYYY-MM-DD</option>
            </select>
          </label>
          <label>
            <span>Format horaire</span>
            <select defaultValue={text(localization.timeFormat, "24h")} name="timeFormat">
              <option>24h</option>
              <option>12h</option>
            </select>
          </label>
          <label>
            <span>Locale numérique</span>
            <input defaultValue={text(localization.numberLocale, "fr-TN")} name="numberLocale" />
          </label>
          <label>
            <span>Direction</span>
            <select defaultValue={text(localization.direction, "LTR")} name="direction">
              <option>LTR</option>
              <option>RTL</option>
            </select>
          </label>
        </div>
        <div className="r-form-actions">
          <Button type="submit">Enregistrer les formats</Button>
        </div>
      </form>
    </section>
  );
}

function RegionsScreen({ apiUrl }: Readonly<{ apiUrl: string }>) {
  const remote = useRemote(async () => {
    const [countries, regions, staff] = await Promise.all([
      request<{ items: readonly JsonRecord[] }>(apiUrl, "/regions/countries?pageSize=100"),
      request<{ items: readonly JsonRecord[] }>(apiUrl, "/regions?pageSize=100"),
      request<{ items: readonly JsonRecord[] }>(apiUrl, "/staff?pageSize=100&status=ACTIVE"),
    ]);
    return { countries: countries.items, regions: regions.items, staff: staff.items };
  }, [apiUrl]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function mutate(path: string, init: RequestInit, success: string) {
    setError("");
    setMessage("");
    try {
      await request(apiUrl, path, init);
      setMessage(success);
      await remote.reload();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Opération impossible");
    }
  }

  async function createCountry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(
      "/regions/countries",
      {
        method: "POST",
        body: JSON.stringify({
          code: String(form.get("code")),
          name: String(form.get("name")),
          defaultLocale: String(form.get("defaultLocale")),
          defaultCurrency: String(form.get("defaultCurrency")),
          active: true,
        }),
      },
      "Pays ajouté au catalogue.",
    );
    event.currentTarget.reset();
  }

  async function createRegion(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await mutate(
      "/regions",
      {
        method: "POST",
        body: JSON.stringify({
          countryId: String(form.get("countryId")),
          code: String(form.get("code")),
          name: String(form.get("name")),
          timezone: String(form.get("timezone")),
          locale: String(form.get("locale")),
          currency: String(form.get("currency")),
          culturalProfile: {},
          status: "ACTIVE",
        }),
      },
      "Région créée et activée.",
    );
    event.currentTarget.reset();
  }

  if (remote.loading) return <LoadingState />;
  const countries = remote.data?.countries ?? [];
  const regions = remote.data?.regions ?? [];
  const staff = remote.data?.staff ?? [];
  return (
    <section>
      <PageHeader
        eyebrow="Gouvernance internationale"
        title="Pays, régions et administrateurs"
        description="Définissez les périmètres régionaux puis affectez un administrateur actif à chaque zone."
      />
      {(remote.error || error) && <Notice error>{remote.error || error}</Notice>}
      {message && <Notice>{message}</Notice>}
      <div className="r-phase9-grid r-section-gap">
        <form className="r-panel r-enterprise-form" onSubmit={createCountry}>
          <div className="r-panel__header">
            <h3>Ajouter un pays</h3>
            <StatusPill tone="info">Catalogue</StatusPill>
          </div>
          <div className="r-form-grid">
            <label>
              <span>Code ISO</span>
              <input maxLength={2} name="code" placeholder="TN" required />
            </label>
            <label>
              <span>Nom</span>
              <input name="name" placeholder="Tunisie" required />
            </label>
            <label>
              <span>Locale par défaut</span>
              <input name="defaultLocale" placeholder="fr-TN" required />
            </label>
            <label>
              <span>Devise</span>
              <input maxLength={3} name="defaultCurrency" placeholder="TND" required />
            </label>
          </div>
          <div className="r-form-actions">
            <Button type="submit">Ajouter le pays</Button>
          </div>
        </form>
        <form className="r-panel r-enterprise-form" onSubmit={createRegion}>
          <div className="r-panel__header">
            <h3>Créer une région</h3>
            <StatusPill tone="success">Périmètre</StatusPill>
          </div>
          <div className="r-form-grid">
            <label>
              <span>Pays</span>
              <select name="countryId" required>
                <option value="">Sélectionner</option>
                {countries
                  .filter((country) => country.active)
                  .map((country) => (
                    <option key={text(country.id)} value={text(country.id)}>
                      {text(country.name)}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              <span>Code</span>
              <input name="code" placeholder="TN-NATIONAL" required />
            </label>
            <label>
              <span>Nom de la région</span>
              <input name="name" placeholder="Tunisie" required />
            </label>
            <label>
              <span>Fuseau horaire</span>
              <input name="timezone" placeholder="Africa/Tunis" required />
            </label>
            <label>
              <span>Locale</span>
              <input name="locale" placeholder="fr-TN" required />
            </label>
            <label>
              <span>Devise</span>
              <input maxLength={3} name="currency" placeholder="TND" required />
            </label>
          </div>
          <div className="r-form-actions">
            <Button type="submit">Créer la région</Button>
          </div>
        </form>
      </div>
      <DataTable
        columns={[
          "Code",
          "Région",
          "Pays",
          "Locale",
          "Devise",
          "Administration",
          "État",
          "Actions",
        ]}
        empty="Aucune région configurée."
        rows={regions.map((region) => {
          const country = (region.country as JsonRecord | undefined) ?? {};
          const administrators = (region.administrators as readonly JsonRecord[] | undefined) ?? [];
          const active = region.status === "ACTIVE";
          return [
            text(region.code),
            text(region.name),
            text(country.name),
            `${text(region.locale)} · ${text(region.timezone)}`,
            text(region.currency),
            <div className="r-inline-form" key="admins">
              <span>
                {administrators.length
                  ? administrators
                      .map((assignment) =>
                        text((assignment.user as JsonRecord | undefined)?.displayName),
                      )
                      .join(", ")
                  : "Non affecté"}
              </span>
              <select
                aria-label={`Affecter un administrateur à ${text(region.name)}`}
                defaultValue=""
                onChange={(event) => {
                  const userId = event.target.value;
                  if (userId)
                    void mutate(
                      `/regions/${text(region.id)}/administrators`,
                      { method: "POST", body: JSON.stringify({ userId }) },
                      "Administrateur régional affecté.",
                    );
                }}
              >
                <option value="">Affecter…</option>
                {staff.map((person) => {
                  const user = (person.user as JsonRecord | undefined) ?? {};
                  return (
                    <option key={text(user.id)} value={text(user.id)}>
                      {text(user.displayName)}
                    </option>
                  );
                })}
              </select>
            </div>,
            <StatusPill key="status" tone={active ? "success" : "neutral"}>
              {active ? "ACTIVE" : text(region.status)}
            </StatusPill>,
            <div className="r-table-actions" key="actions">
              <Button
                onClick={() =>
                  void mutate(
                    `/regions/${text(region.id)}/status`,
                    {
                      method: "POST",
                      body: JSON.stringify({ status: active ? "INACTIVE" : "ACTIVE" }),
                    },
                    active ? "Région désactivée." : "Région activée.",
                  )
                }
              >
                {active ? "Désactiver" : "Activer"}
              </Button>
            </div>,
          ];
        })}
        title={`${regions.length} régions configurées`}
      />
    </section>
  );
}

function AuditScreen({ apiUrl }: Readonly<{ apiUrl: string }>) {
  const remote = useRemote(
    () => request<readonly JsonRecord[]>(apiUrl, "/audit?limit=100"),
    [apiUrl],
  );
  if (remote.loading) return <LoadingState />;
  const rows = remote.data ?? [];
  return (
    <section>
      <PageHeader
        eyebrow="Gouvernance"
        title="Journal d’audit"
        description="Traçabilité tenant-scoped des opérations sensibles, changements de statut et actions commerciales."
      />
      {remote.error && <Notice error>{remote.error}</Notice>}
      <DataTable
        columns={["Date", "Action", "Type", "Entité", "Corrélation"]}
        empty="Aucun événement d’audit."
        rows={rows.map((row) => [
          date(row.occurredAt),
          text(row.action),
          text(row.entityType),
          text(row.entityId),
          <code key="correlation">{text(row.correlationId)}</code>,
        ])}
        title={`${rows.length} événements récents`}
      />
    </section>
  );
}

function SystemScreen({ apiUrl }: Readonly<{ apiUrl: string }>) {
  const remote = useRemote(async () => {
    const [live, ready] = await Promise.all([
      request<JsonRecord>(apiUrl, "/health/live"),
      request<JsonRecord>(apiUrl, "/health/ready"),
    ]);
    return { live, ready };
  }, [apiUrl]);
  if (remote.loading) return <LoadingState />;
  const ready = remote.data?.ready ?? {};
  const details = (ready.details as JsonRecord | undefined) ?? {};
  return (
    <section>
      <PageHeader
        eyebrow="Supervision technique"
        title="État du système"
        description="Disponibilité de l’API et de ses dépendances techniques essentielles."
        actions={<Button onClick={() => void remote.reload()}>Actualiser</Button>}
      />
      {remote.error && <Notice error>{remote.error}</Notice>}
      <div className="r-metrics-grid">
        <MetricCard
          icon="activity"
          label="API"
          value={text(remote.data?.live.status, "OK").toUpperCase()}
        />
        <MetricCard icon="tenant" label="PostgreSQL" value={serviceStatus(details.postgres)} />
        <MetricCard icon="automation" label="Redis" value={serviceStatus(details.redis)} />
        <MetricCard icon="notification" label="BullMQ" value={serviceStatus(details.bullmq)} />
      </div>
      <article className="r-panel">
        <div className="r-panel__header">
          <h3>Diagnostic de readiness</h3>
          <StatusPill tone={ready.status === "ok" ? "success" : "warning"}>
            {text(ready.status, "unknown")}
          </StatusPill>
        </div>
        <pre className="r-system-json">{JSON.stringify(ready, null, 2)}</pre>
      </article>
    </section>
  );
}

function serviceStatus(value: unknown): string {
  return value && typeof value === "object" && "status" in value
    ? text((value as JsonRecord).status).toUpperCase()
    : "INCONNU";
}

function TenantScreen({ apiUrl }: Readonly<{ apiUrl: string }>) {
  const remote = useRemote(() => request<JsonRecord>(apiUrl, "/tenancy/current"), [apiUrl]);
  if (remote.loading) return <LoadingState />;
  const tenant = remote.data ?? {};
  return (
    <section>
      <PageHeader
        eyebrow="Périmètre sécurisé"
        title="Tenant courant"
        description="Identité technique, région et paramètres par défaut issus du contexte authentifié."
      />
      {remote.error && <Notice error>{remote.error}</Notice>}
      <div className="r-metrics-grid">
        <MetricCard icon="tenant" label="Identifiant" value={text(tenant.slug)} />
        <MetricCard icon="activity" label="Statut" value={text(tenant.status)} />
        <MetricCard icon="globe" label="Région" value={text(tenant.region)} />
        <MetricCard
          icon="localization"
          label="Locale et devise"
          value={`${text(tenant.defaultLocale)} · ${text(tenant.defaultCurrency)}`}
        />
      </div>
      <article className="r-panel">
        <div className="r-panel__header">
          <h3>Contrôles d’isolation</h3>
          <StatusPill>RLS activé</StatusPill>
        </div>
        <div className="r-panel__body r-security-checks">
          <p>
            <b>✓</b> Le tenant provient de l’identité authentifiée.
          </p>
          <p>
            <b>✓</b> Les tables commerciales Phase 9 utilisent PostgreSQL Row-Level Security.
          </p>
          <p>
            <b>✓</b> Les écritures sensibles sont auditées et idempotentes.
          </p>
        </div>
      </article>
    </section>
  );
}

function DataTable({
  columns,
  empty,
  rows,
  title,
}: Readonly<{
  columns: readonly string[];
  empty: string;
  rows: readonly (readonly ReactNode[])[];
  title: string;
}>) {
  const [query, setQuery] = useState("");
  const filtered = useMemo(
    () =>
      rows.filter((row) =>
        row.some(
          (cell) =>
            (typeof cell === "string" || typeof cell === "number") &&
            String(cell).toLowerCase().includes(query.toLowerCase()),
        ),
      ),
    [query, rows],
  );
  return (
    <article className="r-panel">
      <div className="r-table-toolbar">
        <h3>{title}</h3>
        <label>
          <Icon name="search" />
          <input
            aria-label="Rechercher dans le tableau"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Rechercher…"
            value={query}
          />
        </label>
      </div>
      <div className="r-table-scroll">
        <table className="r-data-table">
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column}>{column}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td className="r-table-empty" colSpan={columns.length}>
                  {empty}
                </td>
              </tr>
            ) : (
              filtered.map((row) => (
                <tr key={String(row[0])}>
                  {row.map((cell, cellIndex) => (
                    <td key={columns[cellIndex]}>{cell}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <footer className="r-table-footer">
        <span>
          {filtered.length} résultat{filtered.length > 1 ? "s" : ""}
        </span>
        <div>
          <button disabled type="button">
            Précédent
          </button>
          <b>1</b>
          <button disabled type="button">
            Suivant
          </button>
        </div>
      </footer>
    </article>
  );
}
