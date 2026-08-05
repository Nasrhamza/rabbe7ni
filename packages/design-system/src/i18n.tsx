"use client";

import { createContext, useCallback, useContext, useMemo, useState } from "react";
import type { ReactNode } from "react";

/**
 * Key-based localization with Arabic as the source language.
 *
 * The previous helper translated *from French strings*: the French copy was the lookup key, so
 * editing a French label silently broke its Arabic and English translations, and the catalogue only
 * ever covered navigation labels. Keys here are stable identifiers, so copy can change in any
 * language without breaking the others, and a missing translation falls back to Arabic rather than
 * disappearing.
 */
export type Locale = "ar" | "fr" | "en";

export const locales: readonly Locale[] = ["ar", "fr", "en"];

export const localeLabels: Readonly<Record<Locale, string>> = {
  ar: "العربية",
  fr: "Français",
  en: "English",
};

/** Arabic is the product's first language, so it is the only complete catalogue by contract. */
export type MessageKey = keyof typeof messages.ar;

export const messages = {
  ar: {
    "signup.brand": "ربّحني",
    "signup.title": "أنشئ مساحة عملك",
    "signup.subtitle": "حوّل زبائنك العابرين إلى زبائن أوفياء. جرّب مجاناً، بلا بطاقة بنكية.",
    "signup.step": "الخطوة {current} من {total}",

    "signup.step.business": "نشاطك",
    "signup.step.workspace": "عنوان مساحتك",
    "signup.step.owner": "حسابك",
    "signup.step.review": "المراجعة",

    "signup.business.name": "اسم النشاط",
    "signup.business.namePlaceholder": "مقهى المدينة",
    "signup.business.legalName": "الاسم القانوني",
    "signup.business.legalNameHint": "اختياري — يظهر في الفواتير",
    "signup.business.country": "البلد",
    "signup.business.timezone": "التوقيت",
    "signup.business.currency": "العملة",
    "signup.business.branch": "اسم أول فرع",
    "signup.business.branchHint": "اختياري — نستعمل اسم النشاط إذا تركته فارغاً",

    "signup.workspace.label": "عنوان مساحة العمل",
    "signup.workspace.hint": "حروف صغيرة وأرقام وشرطات فقط",
    "signup.workspace.checking": "جارٍ التحقق…",
    "signup.workspace.available": "متاح",
    "signup.workspace.taken": "محجوز — جرّب عنواناً آخر",
    "signup.workspace.unverified": "تعذّر التحقق من التوفّر. يمكنك المتابعة، وسنتأكد عند الإنشاء.",
    "signup.workspace.plan": "الخطة",

    "signup.owner.name": "اسمك الكامل",
    "signup.owner.email": "البريد الإلكتروني",
    "signup.owner.phone": "رقم الهاتف",
    "signup.owner.password": "كلمة السر",
    "signup.owner.passwordHint": "10 أحرف على الأقل، مع حرف كبير ورقم ورمز",
    "signup.owner.terms": "أوافق على شروط الخدمة وسياسة الخصوصية",
    "signup.owner.language": "لغة الواجهة",

    "signup.review.heading": "راجع قبل الإنشاء",
    "signup.review.business": "النشاط",
    "signup.review.address": "العنوان",
    "signup.review.owner": "المالك",
    "signup.review.plan": "الخطة",

    "signup.action.next": "التالي",
    "signup.action.back": "رجوع",
    "signup.action.submit": "أنشئ مساحة العمل",
    "signup.action.submitting": "جارٍ الإنشاء…",
    "signup.action.login": "عندك حساب؟ سجّل الدخول",

    "signup.done.title": "تم إنشاء مساحة عملك",
    "signup.done.body": "بعثنا رابط تأكيد إلى {email}. أكّد بريدك ثم سجّل الدخول للبدء.",
    "signup.done.trial": "فترتك التجريبية تنتهي في {date}",
    "signup.done.login": "اذهب إلى تسجيل الدخول",

    "signup.error.required": "هذا الحقل مطلوب",
    "signup.error.slug": "اختر عنواناً متاحاً أولاً",
    "signup.error.generic": "تعذّر إنشاء مساحة العمل. حاول مرة أخرى.",

    "signup.value.trial": "{days} يوماً مجاناً",
    "signup.aside.title": "لماذا ربّحني؟",
    "signup.aside.pointOne": "بطاقة ولاء رقمية بمسح QR، بلا أجهزة إضافية",
    "signup.aside.pointTwo": "عجلة حظ وبطاقات حكّ وصناديق مفاجآت تُرجع زبائنك",
    "signup.aside.pointThree": "عادات ذكية تبني تكرار الزيارة، لا مجرد نقاط",
    "signup.aside.pointFour": "تحليلات تقول لك مَن سيغادر قبل أن يغادر",
  },
  fr: {
    "signup.brand": "Rabbehni",
    "signup.title": "Créez votre espace",
    "signup.subtitle":
      "Transformez vos clients de passage en clients fidèles. Essai gratuit, sans carte bancaire.",
    "signup.step": "Étape {current} sur {total}",

    "signup.step.business": "Votre activité",
    "signup.step.workspace": "Votre adresse",
    "signup.step.owner": "Votre compte",
    "signup.step.review": "Vérification",

    "signup.business.name": "Nom de l’activité",
    "signup.business.namePlaceholder": "Café Medina",
    "signup.business.legalName": "Raison sociale",
    "signup.business.legalNameHint": "Facultatif — apparaît sur les factures",
    "signup.business.country": "Pays",
    "signup.business.timezone": "Fuseau horaire",
    "signup.business.currency": "Devise",
    "signup.business.branch": "Nom du premier point de vente",
    "signup.business.branchHint": "Facultatif — le nom de l’activité sera utilisé",

    "signup.workspace.label": "Adresse de l’espace",
    "signup.workspace.hint": "Minuscules, chiffres et tirets uniquement",
    "signup.workspace.checking": "Vérification…",
    "signup.workspace.available": "Disponible",
    "signup.workspace.taken": "Déjà pris — essayez une autre adresse",
    "signup.workspace.unverified":
      "Disponibilité non vérifiée. Vous pouvez continuer, nous confirmerons à la création.",
    "signup.workspace.plan": "Formule",

    "signup.owner.name": "Votre nom complet",
    "signup.owner.email": "Adresse e-mail",
    "signup.owner.phone": "Téléphone",
    "signup.owner.password": "Mot de passe",
    "signup.owner.passwordHint": "10 caractères minimum, avec majuscule, chiffre et symbole",
    "signup.owner.terms":
      "J’accepte les conditions d’utilisation et la politique de confidentialité",
    "signup.owner.language": "Langue de l’interface",

    "signup.review.heading": "Vérifiez avant de créer",
    "signup.review.business": "Activité",
    "signup.review.address": "Adresse",
    "signup.review.owner": "Propriétaire",
    "signup.review.plan": "Formule",

    "signup.action.next": "Suivant",
    "signup.action.back": "Retour",
    "signup.action.submit": "Créer mon espace",
    "signup.action.submitting": "Création…",
    "signup.action.login": "Déjà un compte ? Se connecter",

    "signup.done.title": "Votre espace est prêt",
    "signup.done.body":
      "Un lien de confirmation a été envoyé à {email}. Confirmez votre e-mail puis connectez-vous.",
    "signup.done.trial": "Votre essai se termine le {date}",
    "signup.done.login": "Aller à la connexion",

    "signup.error.required": "Ce champ est obligatoire",
    "signup.error.slug": "Choisissez d’abord une adresse disponible",
    "signup.error.generic": "Impossible de créer l’espace. Réessayez.",

    "signup.value.trial": "{days} jours offerts",
    "signup.aside.title": "Pourquoi Rabbehni ?",
    "signup.aside.pointOne": "Carte de fidélité digitale par QR, sans matériel supplémentaire",
    "signup.aside.pointTwo": "Roue, cartes à gratter et coffres qui font revenir vos clients",
    "signup.aside.pointThree": "Des habitudes intelligentes, pas seulement des points",
    "signup.aside.pointFour": "Des analyses qui signalent un client avant qu’il ne parte",
  },
  en: {
    "signup.brand": "Rabbehni",
    "signup.title": "Create your workspace",
    "signup.subtitle": "Turn one-time visitors into regulars. Free trial, no card required.",
    "signup.step": "Step {current} of {total}",

    "signup.step.business": "Your business",
    "signup.step.workspace": "Your address",
    "signup.step.owner": "Your account",
    "signup.step.review": "Review",

    "signup.business.name": "Business name",
    "signup.business.namePlaceholder": "Café Medina",
    "signup.business.legalName": "Legal name",
    "signup.business.legalNameHint": "Optional — shown on invoices",
    "signup.business.country": "Country",
    "signup.business.timezone": "Time zone",
    "signup.business.currency": "Currency",
    "signup.business.branch": "First branch name",
    "signup.business.branchHint": "Optional — the business name is used instead",

    "signup.workspace.label": "Workspace address",
    "signup.workspace.hint": "Lowercase letters, numbers and hyphens only",
    "signup.workspace.checking": "Checking…",
    "signup.workspace.available": "Available",
    "signup.workspace.taken": "Already taken — try another address",
    "signup.workspace.unverified":
      "Availability could not be checked. You can continue; we will confirm on creation.",
    "signup.workspace.plan": "Plan",

    "signup.owner.name": "Your full name",
    "signup.owner.email": "Email address",
    "signup.owner.phone": "Phone number",
    "signup.owner.password": "Password",
    "signup.owner.passwordHint": "At least 10 characters, with an uppercase, a number and a symbol",
    "signup.owner.terms": "I accept the terms of service and the privacy policy",
    "signup.owner.language": "Interface language",

    "signup.review.heading": "Review before creating",
    "signup.review.business": "Business",
    "signup.review.address": "Address",
    "signup.review.owner": "Owner",
    "signup.review.plan": "Plan",

    "signup.action.next": "Next",
    "signup.action.back": "Back",
    "signup.action.submit": "Create workspace",
    "signup.action.submitting": "Creating…",
    "signup.action.login": "Already have an account? Sign in",

    "signup.done.title": "Your workspace is ready",
    "signup.done.body":
      "A confirmation link was sent to {email}. Confirm your email, then sign in to start.",
    "signup.done.trial": "Your trial ends on {date}",
    "signup.done.login": "Go to sign in",

    "signup.error.required": "This field is required",
    "signup.error.slug": "Pick an available address first",
    "signup.error.generic": "The workspace could not be created. Please try again.",

    "signup.value.trial": "{days} days free",
    "signup.aside.title": "Why Rabbehni?",
    "signup.aside.pointOne": "A digital loyalty card by QR scan, with no extra hardware",
    "signup.aside.pointTwo": "Wheels, scratch cards and mystery boxes that bring customers back",
    "signup.aside.pointThree": "Smart habits that build repeat visits, not just points",
    "signup.aside.pointFour": "Analytics that flag a customer before they leave",
  },
} as const;

export function direction(locale: Locale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/** BCP 47 tags for Intl. Arabic uses Tunisian Arabic numerals-as-latin conventions by default. */
const intlTags: Readonly<Record<Locale, string>> = {
  ar: "ar-TN",
  fr: "fr-TN",
  en: "en-GB",
};

export function translate(
  locale: Locale,
  key: MessageKey,
  values?: Readonly<Record<string, string | number>>,
): string {
  const catalogue = messages[locale] as Readonly<Record<string, string>>;
  const template = catalogue[key] ?? messages.ar[key];
  if (!values) return template;
  return Object.entries(values).reduce(
    (result, [name, value]) => result.replaceAll(`{${name}}`, String(value)),
    template,
  );
}

interface I18nValue {
  readonly locale: Locale;
  readonly dir: "rtl" | "ltr";
  readonly t: (key: MessageKey, values?: Readonly<Record<string, string | number>>) => string;
  readonly formatDate: (value: Date | string) => string;
  readonly formatNumber: (value: number) => string;
  readonly setLocale: (locale: Locale) => void;
}

const I18nContext = createContext<I18nValue | undefined>(undefined);

export function I18nProvider({
  children,
  initialLocale = "ar",
}: Readonly<{ children: ReactNode; initialLocale?: Locale }>) {
  const [locale, setLocale] = useState<Locale>(initialLocale);

  const value = useMemo<I18nValue>(() => {
    const tag = intlTags[locale];
    return {
      locale,
      dir: direction(locale),
      setLocale,
      t: (key, values) => translate(locale, key, values),
      formatDate: (input) =>
        new Intl.DateTimeFormat(tag, { dateStyle: "long" }).format(
          typeof input === "string" ? new Date(input) : input,
        ),
      formatNumber: (input) => new Intl.NumberFormat(tag).format(input),
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const value = useContext(I18nContext);
  if (!value) {
    throw new Error("useI18n must be used inside an I18nProvider");
  }
  return value;
}

/** Standalone translator for surfaces that render outside a provider. */
export function useStandaloneI18n(locale: Locale) {
  return useCallback(
    (key: MessageKey, values?: Readonly<Record<string, string | number>>) =>
      translate(locale, key, values),
    [locale],
  );
}
