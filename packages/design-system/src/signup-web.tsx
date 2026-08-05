"use client";

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { ReactNode } from "react";

import {
  I18nProvider,
  localeLabels,
  locales,
  useI18n,
  type Locale,
  type MessageKey,
} from "./i18n.js";

const COUNTRIES = [
  {
    code: "TN",
    timezone: "Africa/Tunis",
    currency: "TND",
    ar: "تونس",
    fr: "Tunisie",
    en: "Tunisia",
  },
  {
    code: "DZ",
    timezone: "Africa/Algiers",
    currency: "DZD",
    ar: "الجزائر",
    fr: "Algérie",
    en: "Algeria",
  },
  {
    code: "MA",
    timezone: "Africa/Casablanca",
    currency: "MAD",
    ar: "المغرب",
    fr: "Maroc",
    en: "Morocco",
  },
  { code: "AE", timezone: "Asia/Dubai", currency: "AED", ar: "الإمارات", fr: "Émirats", en: "UAE" },
  {
    code: "SA",
    timezone: "Asia/Riyadh",
    currency: "SAR",
    ar: "السعودية",
    fr: "Arabie saoudite",
    en: "Saudi Arabia",
  },
  { code: "QA", timezone: "Asia/Qatar", currency: "QAR", ar: "قطر", fr: "Qatar", en: "Qatar" },
  {
    code: "FR",
    timezone: "Europe/Paris",
    currency: "EUR",
    ar: "فرنسا",
    fr: "France",
    en: "France",
  },
] as const;

const PLANS = [
  { code: "starter", trialDays: 14, ar: "المبتدئة", fr: "Starter", en: "Starter" },
  { code: "growth", trialDays: 21, ar: "النمو", fr: "Growth", en: "Growth" },
] as const;

const STEP_KEYS = [
  "signup.step.business",
  "signup.step.workspace",
  "signup.step.owner",
  "signup.step.review",
] as const satisfies readonly MessageKey[];

type SlugState = "idle" | "checking" | "available" | "taken" | "invalid" | "unverified";

interface FormState {
  businessName: string;
  legalName: string;
  countryCode: string;
  branchName: string;
  workspaceSlug: string;
  planCode: string;
  ownerName: string;
  ownerEmail: string;
  ownerPhone: string;
  password: string;
  acceptsTerms: boolean;
}

const EMPTY: FormState = {
  businessName: "",
  legalName: "",
  countryCode: "TN",
  branchName: "",
  workspaceSlug: "",
  planCode: "starter",
  ownerName: "",
  ownerEmail: "",
  ownerPhone: "",
  password: "",
  acceptsTerms: false,
};

/** Mirrors workspaceSlugSchema on the API so the field cannot submit a value the server rejects. */
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]*[a-z0-9]$/u;

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/gu, "")
    .replace(/[^a-z0-9\s-]/gu, "")
    .trim()
    .replace(/\s+/gu, "-")
    .replace(/-+/gu, "-")
    .slice(0, 48);
}

export interface MerchantSignupProps {
  readonly apiUrl: string;
  readonly loginHref: string;
  readonly initialLocale?: Locale;
}

export function MerchantSignup(props: MerchantSignupProps) {
  return (
    <I18nProvider initialLocale={props.initialLocale ?? "ar"}>
      <SignupSurface {...props} />
    </I18nProvider>
  );
}

function SignupSurface({ apiUrl, loginHref }: MerchantSignupProps) {
  const { t, dir, locale, setLocale, formatDate } = useI18n();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [slugState, setSlugState] = useState<SlugState>("idle");
  const [slugTouched, setSlugTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState<{ email: string; trialEndsAt: string } | undefined>();

  const country = COUNTRIES.find((item) => item.code === form.countryCode) ?? COUNTRIES[0];
  const plan = PLANS.find((item) => item.code === form.planCode) ?? PLANS[0];

  const update = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((current) => ({ ...current, [key]: value }));
  }, []);

  // The business name seeds the workspace address until the merchant edits it directly.
  useEffect(() => {
    if (slugTouched) return;
    setForm((current) => ({ ...current, workspaceSlug: slugify(current.businessName) }));
  }, [form.businessName, slugTouched]);

  const slug = form.workspaceSlug;
  useEffect(() => {
    if (slug.length < 3 || !SLUG_PATTERN.test(slug)) {
      setSlugState(slug.length === 0 ? "idle" : "invalid");
      return;
    }
    setSlugState("checking");
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch(`${apiUrl}/v1/auth/workspace-slug?slug=${encodeURIComponent(slug)}`, {
        signal: controller.signal,
      })
        .then((response) => (response.ok ? response.json() : Promise.reject(new Error("failed"))))
        .then((body: { available?: boolean }) =>
          setSlugState(body.available ? "available" : "taken"),
        )
        .catch(() => {
          // The check is a convenience, not the authority: the unique constraint on the tenant
          // slug is. Treating an unreachable check as "blocked" would strand the merchant on this
          // step with no way forward and nothing explaining why, so surface the doubt and let them
          // continue — a genuine collision still comes back as a conflict on submit.
          if (!controller.signal.aborted) setSlugState("unverified");
        });
    }, 350);
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [slug, apiUrl]);

  const stepValid = useMemo(() => {
    if (step === 0) return form.businessName.trim().length >= 2;
    if (step === 1) return slugState === "available" || slugState === "unverified";
    if (step === 2) {
      return (
        form.ownerName.trim().length >= 2 &&
        /.+@.+\..+/u.test(form.ownerEmail) &&
        form.ownerPhone.trim().length >= 8 &&
        form.password.length >= 10 &&
        form.acceptsTerms
      );
    }
    return true;
  }, [step, form, slugState]);

  async function submit() {
    setSubmitting(true);
    setError("");
    try {
      const response = await fetch(`${apiUrl}/v1/auth/merchant-registration`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          workspaceSlug: form.workspaceSlug,
          businessName: form.businessName.trim(),
          ...(form.legalName.trim() ? { legalName: form.legalName.trim() } : {}),
          countryCode: country.code,
          timezone: country.timezone,
          currency: country.currency,
          locale,
          ...(form.branchName.trim() ? { branchName: form.branchName.trim() } : {}),
          planCode: form.planCode,
          ownerName: form.ownerName.trim(),
          ownerEmail: form.ownerEmail.trim(),
          ownerPhone: form.ownerPhone.trim(),
          password: form.password,
          acceptsTerms: true,
        }),
      });
      const body = (await response.json()) as { trialEndsAt?: string; message?: string };
      if (!response.ok) {
        setError(typeof body.message === "string" ? body.message : t("signup.error.generic"));
        return;
      }
      setDone({ email: form.ownerEmail.trim(), trialEndsAt: body.trialEndsAt ?? "" });
    } catch {
      setError(t("signup.error.generic"));
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="rb-signup" dir={dir} lang={locale}>
        <main className="rb-signup__panel rb-signup__panel--done">
          <div className="rb-done">
            <span aria-hidden="true" className="rb-done__mark">
              ✓
            </span>
            <h1 className="rb-done__title">{t("signup.done.title")}</h1>
            <p className="rb-done__body">{t("signup.done.body", { email: done.email })}</p>
            {done.trialEndsAt ? (
              <p className="rb-done__trial">
                {t("signup.done.trial", { date: formatDate(done.trialEndsAt) })}
              </p>
            ) : null}
            <a className="rb-button rb-button--primary" href={loginHref}>
              {t("signup.done.login")}
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="rb-signup" dir={dir} lang={locale}>
      <aside className="rb-signup__aside">
        <span className="rb-signup__brand">{t("signup.brand")}</span>
        <h2 className="rb-aside__title">{t("signup.aside.title")}</h2>
        <ul className="rb-aside__list">
          <li>{t("signup.aside.pointOne")}</li>
          <li>{t("signup.aside.pointTwo")}</li>
          <li>{t("signup.aside.pointThree")}</li>
          <li>{t("signup.aside.pointFour")}</li>
        </ul>
        <span className="rb-aside__badge">{t("signup.value.trial", { days: plan.trialDays })}</span>
      </aside>

      <main className="rb-signup__panel">
        <div className="rb-signup__head">
          <div>
            <h1 className="rb-signup__title">{t("signup.title")}</h1>
            <p className="rb-signup__subtitle">{t("signup.subtitle")}</p>
          </div>
          <label className="rb-locale">
            <span className="rb-visually-hidden">{t("signup.owner.language")}</span>
            <select onChange={(event) => setLocale(event.target.value as Locale)} value={locale}>
              {locales.map((code) => (
                <option key={code} value={code}>
                  {localeLabels[code]}
                </option>
              ))}
            </select>
          </label>
        </div>

        <ol className="rb-steps" aria-label={t("signup.step", { current: step + 1, total: 4 })}>
          {STEP_KEYS.map((key, index) => (
            <li
              className="rb-steps__item"
              data-state={index === step ? "current" : index < step ? "done" : "todo"}
              key={key}
            >
              <span className="rb-steps__dot">{index < step ? "✓" : index + 1}</span>
              <span className="rb-steps__label">{t(key)}</span>
            </li>
          ))}
        </ol>

        <form
          className="rb-form"
          key={step}
          onSubmit={(event) => {
            event.preventDefault();
            if (!stepValid) return;
            if (step < 3) setStep(step + 1);
            else void submit();
          }}
        >
          {step === 0 ? (
            <BusinessStep country={country} form={form} update={update} />
          ) : step === 1 ? (
            <WorkspaceStep
              form={form}
              slugState={slugState}
              update={update}
              onSlugEdit={() => setSlugTouched(true)}
            />
          ) : step === 2 ? (
            <OwnerStep form={form} update={update} />
          ) : (
            <ReviewStep country={country} form={form} plan={plan} />
          )}

          {error ? (
            <p className="rb-form__error" role="alert">
              {error}
            </p>
          ) : null}

          <div className="rb-form__actions">
            {step > 0 ? (
              <button
                className="rb-button rb-button--ghost"
                onClick={() => setStep(step - 1)}
                type="button"
              >
                {t("signup.action.back")}
              </button>
            ) : (
              <a className="rb-button rb-button--ghost" href={loginHref}>
                {t("signup.action.login")}
              </a>
            )}
            <button
              className="rb-button rb-button--primary"
              disabled={!stepValid || submitting}
              type="submit"
            >
              {step < 3
                ? t("signup.action.next")
                : submitting
                  ? t("signup.action.submitting")
                  : t("signup.action.submit")}
            </button>
          </div>
        </form>
      </main>
    </div>
  );
}

type Updater = <K extends keyof FormState>(key: K, value: FormState[K]) => void;

function Field({
  children,
  hint,
  label,
  status,
}: Readonly<{ children: ReactNode; hint?: string; label: string; status?: ReactNode }>) {
  return (
    <label className="rb-field">
      <span className="rb-field__label">{label}</span>
      {children}
      {status}
      {hint ? <small className="rb-field__hint">{hint}</small> : null}
    </label>
  );
}

function BusinessStep({
  country,
  form,
  update,
}: Readonly<{ country: (typeof COUNTRIES)[number]; form: FormState; update: Updater }>) {
  const { t, locale } = useI18n();
  return (
    <div className="rb-form__grid">
      <Field label={t("signup.business.name")}>
        <input
          autoFocus
          onChange={(event) => update("businessName", event.target.value)}
          placeholder={t("signup.business.namePlaceholder")}
          required
          value={form.businessName}
        />
      </Field>
      <Field hint={t("signup.business.legalNameHint")} label={t("signup.business.legalName")}>
        <input
          onChange={(event) => update("legalName", event.target.value)}
          value={form.legalName}
        />
      </Field>
      <Field label={t("signup.business.country")}>
        <select
          onChange={(event) => update("countryCode", event.target.value)}
          value={form.countryCode}
        >
          {COUNTRIES.map((item) => (
            <option key={item.code} value={item.code}>
              {item[locale]}
            </option>
          ))}
        </select>
      </Field>
      <Field
        hint={`${country.timezone} · ${country.currency}`}
        label={t("signup.business.currency")}
      >
        <input disabled readOnly value={country.currency} />
      </Field>
      <Field hint={t("signup.business.branchHint")} label={t("signup.business.branch")}>
        <input
          onChange={(event) => update("branchName", event.target.value)}
          value={form.branchName}
        />
      </Field>
    </div>
  );
}

function WorkspaceStep({
  form,
  onSlugEdit,
  slugState,
  update,
}: Readonly<{
  form: FormState;
  onSlugEdit: () => void;
  slugState: SlugState;
  update: Updater;
}>) {
  const { t } = useI18n();
  const statusId = useId();
  const statusKey: MessageKey | undefined =
    slugState === "checking"
      ? "signup.workspace.checking"
      : slugState === "available"
        ? "signup.workspace.available"
        : slugState === "taken"
          ? "signup.workspace.taken"
          : slugState === "invalid"
            ? "signup.workspace.hint"
            : slugState === "unverified"
              ? "signup.workspace.unverified"
              : undefined;

  return (
    <div className="rb-form__grid">
      <Field
        hint={t("signup.workspace.hint")}
        label={t("signup.workspace.label")}
        status={
          statusKey ? (
            <span className="rb-slug__status" data-state={slugState} id={statusId} role="status">
              {t(statusKey)}
            </span>
          ) : null
        }
      >
        <span className="rb-slug">
          <span className="rb-slug__prefix" dir="ltr">
            rabbehni.app/
          </span>
          <input
            aria-describedby={statusId}
            autoFocus
            dir="ltr"
            onChange={(event) => {
              onSlugEdit();
              update("workspaceSlug", slugify(event.target.value));
            }}
            required
            value={form.workspaceSlug}
          />
        </span>
      </Field>

      <fieldset className="rb-plans">
        <legend className="rb-field__label">{t("signup.workspace.plan")}</legend>
        {PLANS.map((item) => (
          <label className="rb-plan" data-selected={form.planCode === item.code} key={item.code}>
            <input
              checked={form.planCode === item.code}
              name="plan"
              onChange={() => update("planCode", item.code)}
              type="radio"
              value={item.code}
            />
            <PlanLabel plan={item} />
          </label>
        ))}
      </fieldset>
    </div>
  );
}

function PlanLabel({ plan }: Readonly<{ plan: (typeof PLANS)[number] }>) {
  const { t, locale } = useI18n();
  return (
    <span className="rb-plan__body">
      <strong>{plan[locale]}</strong>
      <small>{t("signup.value.trial", { days: plan.trialDays })}</small>
    </span>
  );
}

function OwnerStep({ form, update }: Readonly<{ form: FormState; update: Updater }>) {
  const { t } = useI18n();
  return (
    <div className="rb-form__grid">
      <Field label={t("signup.owner.name")}>
        <input
          autoFocus
          onChange={(event) => update("ownerName", event.target.value)}
          required
          value={form.ownerName}
        />
      </Field>
      <Field label={t("signup.owner.email")}>
        <input
          dir="ltr"
          onChange={(event) => update("ownerEmail", event.target.value)}
          required
          type="email"
          value={form.ownerEmail}
        />
      </Field>
      <Field label={t("signup.owner.phone")}>
        <input
          dir="ltr"
          onChange={(event) => update("ownerPhone", event.target.value)}
          required
          type="tel"
          value={form.ownerPhone}
        />
      </Field>
      <Field hint={t("signup.owner.passwordHint")} label={t("signup.owner.password")}>
        <input
          dir="ltr"
          onChange={(event) => update("password", event.target.value)}
          required
          type="password"
          value={form.password}
        />
      </Field>
      <label className="rb-check">
        <input
          checked={form.acceptsTerms}
          onChange={(event) => update("acceptsTerms", event.target.checked)}
          type="checkbox"
        />
        <span>{t("signup.owner.terms")}</span>
      </label>
    </div>
  );
}

function ReviewStep({
  country,
  form,
  plan,
}: Readonly<{
  country: (typeof COUNTRIES)[number];
  form: FormState;
  plan: (typeof PLANS)[number];
}>) {
  const { t, locale } = useI18n();
  const rows: readonly (readonly [MessageKey, string])[] = [
    ["signup.review.business", `${form.businessName} · ${country[locale]}`],
    ["signup.review.address", `rabbehni.app/${form.workspaceSlug}`],
    ["signup.review.owner", `${form.ownerName} · ${form.ownerEmail}`],
    [
      "signup.review.plan",
      `${plan[locale]} · ${t("signup.value.trial", { days: plan.trialDays })}`,
    ],
  ];
  return (
    <div className="rb-review">
      <h2 className="rb-review__title">{t("signup.review.heading")}</h2>
      <dl className="rb-review__list">
        {rows.map(([key, value]) => (
          <div className="rb-review__row" key={key}>
            <dt>{t(key)}</dt>
            <dd dir="auto">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
