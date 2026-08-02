import { useEffect, useState } from "react";

export type SupportedLocale = "ar" | "en" | "fr";

export const localeEventName = "rabbehni:locale-change";

const translations: Record<Exclude<SupportedLocale, "fr">, Record<string, string>> = {
  en: {
    Accueil: "Home",
    "Accueil et opérations": "Home and operations",
    "Abonnement et paramètres": "Subscription and settings",
    "Abonnements et facturation": "Subscriptions and billing",
    Ajouter: "Add",
    "Analyse et rapports": "Analytics and reports",
    Analytics: "Analytics",
    Automatisations: "Automations",
    Badges: "Badges",
    Campagnes: "Campaigns",
    Challenges: "Challenges",
    Clients: "Customers",
    "Clients et fidélité": "Customers and loyalty",
    Commerces: "Merchants",
    "Compte démo": "Demo account",
    "Centre d’aide": "Help center",
    "Dernière mise à jour : aujourd’hui, 13:30": "Last update: today, 13:30",
    Démonstration: "Demo",
    "En ligne": "Online",
    Facturation: "Billing",
    Fidélité: "Loyalty",
    Franchises: "Franchises",
    Gamification: "Gamification",
    "Identité visuelle": "Brand identity",
    "Engagement et marketing": "Engagement and marketing",
    "Langues et devises": "Languages and currencies",
    Marketing: "Marketing",
    "Mon commerce": "My business",
    "Mon établissement": "My business",
    "Nouveau client": "New customer",
    Notifications: "Notifications",
    Organisations: "Organizations",
    "Points de vente": "Branches",
    Rapports: "Reports",
    Rechercher: "Search",
    Récompenses: "Rewards",
    "Scanner et QR": "Scan and QR",
    "Structure et accès": "Structure and access",
    "Paramètres et contrôle": "Settings and control",
    "Tableau de bord": "Dashboard",
    "Tous les services actifs": "All services operational",
    "Vue d’ensemble": "Overview",
    Équipe: "Team",
    "Équipe et accès": "Team and access",
  },
  ar: {
    Accueil: "الرئيسية",
    "Accueil et opérations": "الرئيسية والعمليات",
    "Abonnement et paramètres": "الاشتراك والإعدادات",
    "Abonnements et facturation": "الاشتراكات والفوترة",
    Ajouter: "إضافة",
    "Analyse et rapports": "التحليلات والتقارير",
    Analytics: "التحليلات",
    Automatisations: "الأتمتة",
    Badges: "الشارات",
    Campagnes: "الحملات",
    Challenges: "التحديات",
    Clients: "العملاء",
    "Clients et fidélité": "العملاء والولاء",
    Commerces: "المتاجر",
    "Compte démo": "حساب تجريبي",
    "Centre d’aide": "مركز المساعدة",
    "Dernière mise à jour : aujourd’hui, 13:30": "آخر تحديث: اليوم، 13:30",
    Démonstration: "عرض تجريبي",
    "En ligne": "متصل",
    Facturation: "الفوترة",
    Fidélité: "الولاء",
    Franchises: "الامتيازات",
    Gamification: "التلعيب",
    "Identité visuelle": "الهوية البصرية",
    "Engagement et marketing": "التفاعل والتسويق",
    "Langues et devises": "اللغات والعملات",
    Marketing: "التسويق",
    "Mon commerce": "متجري",
    "Mon établissement": "مؤسستي",
    "Nouveau client": "عميل جديد",
    Notifications: "الإشعارات",
    Organisations: "المؤسسات",
    "Points de vente": "نقاط البيع",
    Rapports: "التقارير",
    Rechercher: "بحث",
    Récompenses: "المكافآت",
    "Scanner et QR": "المسح ورمز QR",
    "Structure et accès": "الهيكلة والصلاحيات",
    "Paramètres et contrôle": "الإعدادات والرقابة",
    "Tableau de bord": "لوحة القيادة",
    "Tous les services actifs": "كل الخدمات تعمل",
    "Vue d’ensemble": "نظرة عامة",
    Équipe: "الفريق",
    "Équipe et accès": "الفريق والصلاحيات",
  },
};

export function getStoredLocale(): SupportedLocale {
  if (typeof window === "undefined") return "fr";
  const stored = window.localStorage.getItem("rabbehni.locale");
  return stored === "en" || stored === "ar" ? stored : "fr";
}

export function setInterfaceLocale(locale: SupportedLocale): void {
  document.documentElement.lang = locale;
  document.documentElement.dir = locale === "ar" ? "rtl" : "ltr";
  window.localStorage.setItem("rabbehni.locale", locale);
  document.querySelectorAll<HTMLElement>("[data-rabbehni-i18n]").forEach((element) => {
    const source = element.dataset.rabbehniI18n;
    if (source) element.textContent = translateLabel(source, locale);
  });
  window.dispatchEvent(new CustomEvent<SupportedLocale>(localeEventName, { detail: locale }));
}

export function translateLabel(value: string, locale: SupportedLocale): string {
  return locale === "fr" ? value : (translations[locale][value] ?? value);
}

export function useInterfaceLocale(): SupportedLocale {
  const [locale, setLocale] = useState<SupportedLocale>("fr");

  useEffect(() => {
    setLocale(getStoredLocale());
    const update = (event: Event) => {
      setLocale((event as CustomEvent<SupportedLocale>).detail);
    };
    window.addEventListener(localeEventName, update);
    return () => window.removeEventListener(localeEventName, update);
  }, []);

  return locale;
}
