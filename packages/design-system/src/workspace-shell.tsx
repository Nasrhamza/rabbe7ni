"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

import { AssetImage, ButtonLink, RabbehniMark, StatusPill } from "@rabbehni/design-system/web";
import { webAssets, type WebAssetPath } from "@rabbehni/design-system/assets";
import { Icon, type IconName } from "@rabbehni/design-system/icons";
import { LanguageSwitcher } from "@rabbehni/design-system/language-switcher";
import { ThemeToggle } from "@rabbehni/design-system/theme-toggle";
import { translateLabel, useInterfaceLocale } from "@rabbehni/design-system/locale";

type WorkspaceIdentity = "admin" | "merchant";
type CommandItem = readonly [label: string, href: string, icon: IconName];
type WorkspaceNotification = Readonly<{
  id: string;
  title: string;
  detail: string;
  href: string;
  tone: "danger" | "info" | "warning";
}>;

const commands: readonly CommandItem[] = [
  ["Vue d’ensemble", "/workspace", "dashboard"],
  ["Organisations", "/workspace/organizations", "organization"],
  ["Commerces", "/workspace/merchants", "merchant"],
  ["Points de vente", "/workspace/branches", "branch"],
  ["Équipe et accès", "/workspace/staff", "staff"],
  ["Clients", "/workspace/customers", "customer"],
  ["Programmes de fidélité", "/workspace/loyalty", "reward"],
  ["Mouvements de points", "/workspace/points", "points"],
  ["Récompenses", "/workspace/rewards", "reward"],
  ["Scanner et QR", "/workspace/qr", "qr"],
  ["Visites et check-ins", "/workspace/visits", "location"],
  ["Gamification", "/workspace/gamification", "gamification"],
  ["Jeux instantanés", "/workspace/games", "gamification"],
  ["Challenges", "/workspace/challenges", "activity"],
  ["Badges", "/workspace/badges", "badge"],
  ["Segments", "/workspace/segments", "customer"],
  ["Campagnes", "/workspace/campaigns", "campaign"],
  ["Automatisations", "/workspace/automations", "automation"],
  ["Analytics", "/workspace/analytics", "analytics"],
  ["Rapports", "/workspace/reports", "plan"],
  ["Abonnements", "/workspace/subscriptions", "subscription"],
  ["Facturation", "/workspace/billing", "billing"],
];

const merchantCommandHrefs = new Set([
  "/workspace",
  "/workspace/analytics",
  "/workspace/automations",
  "/workspace/badges",
  "/workspace/billing",
  "/workspace/branches",
  "/workspace/campaigns",
  "/workspace/challenges",
  "/workspace/customers",
  "/workspace/gamification",
  "/workspace/games",
  "/workspace/merchants",
  "/workspace/points",
  "/workspace/qr",
  "/workspace/reports",
  "/workspace/rewards",
  "/workspace/segments",
  "/workspace/staff",
  "/workspace/subscriptions",
  "/workspace/visits",
]);

const moduleDescriptions: Readonly<Record<string, string>> = {
  analytics: "Comprendre les résultats, comparer les périodes et repérer les tendances.",
  audit: "Consulter la trace des actions sensibles réalisées sur la plateforme.",
  automations: "Déclencher automatiquement des actions selon le comportement des clients.",
  badges: "Créer les distinctions obtenues par les clients pendant leur progression.",
  billing: "Consulter les factures, paiements et opérations financières.",
  branches: "Gérer les adresses, horaires et informations de chaque point de vente.",
  campaigns: "Préparer, planifier et suivre les communications envoyées aux clients.",
  challenges: "Créer des objectifs simples pour encourager les visites et les achats.",
  customers: "Retrouver les profils clients, leurs préférences et leur activité.",
  franchises: "Organiser les réseaux de franchises rattachés aux entreprises clientes.",
  gamification: "Configurer les règles ludiques qui renforcent l’engagement client.",
  games: "Configurer la roue, la carte à gratter, le coffre et leurs probabilités.",
  habits: "Encourager les visites récurrentes avec des habitudes et des séries.",
  leaderboards: "Afficher les classements et comparer la progression des participants.",
  localization: "Choisir les langues, devises et formats utilisés dans l’application.",
  loyalty: "Configurer comment les clients gagnent et utilisent leurs points.",
  merchants: "Gérer les commerces, leurs coordonnées et leur état opérationnel.",
  "notification-templates": "Préparer les messages envoyés par email, SMS et notification.",
  organizations: "Gérer les entreprises clientes et leur structure sur Rabbehni.",
  plans: "Définir les offres commerciales et les limites de chaque formule.",
  points: "Consulter et contrôler tous les mouvements de points.",
  qr: "Scanner un client et suivre les transactions QR sécurisées.",
  reports: "Générer et télécharger les rapports de suivi de l’activité.",
  rewards: "Gérer le catalogue, le coût en points et le stock des récompenses.",
  segments: "Regrouper les clients selon leur profil et leur comportement.",
  staff: "Inviter les collaborateurs et contrôler leurs rôles et accès.",
  subscriptions: "Gérer les abonnements, renouvellements et consommations.",
  system: "Vérifier la disponibilité des services techniques de la plateforme.",
  tenants: "Gérer les comptes clients isolés et leurs paramètres.",
  visits: "Suivre les visites validées dans chaque commerce et point de vente.",
  "white-label": "Adapter le logo, les couleurs et l’identité visuelle de chaque marque.",
};

const adminNotifications: readonly WorkspaceNotification[] = [
  {
    id: "subscription",
    title: "2 abonnements arrivent à échéance",
    detail: "Groupe Jasmin et Medina Retail nécessitent une décision.",
    href: "/workspace/subscriptions",
    tone: "danger",
  },
  {
    id: "branch",
    title: "3 points de vente à vérifier",
    detail: "Les adresses et horaires ont été mis à jour.",
    href: "/workspace/branches",
    tone: "warning",
  },
  {
    id: "report",
    title: "Rapport mensuel disponible",
    detail: "Le rapport de performance de juillet est prêt.",
    href: "/workspace/reports",
    tone: "info",
  },
];

const merchantNotifications: readonly WorkspaceNotification[] = [
  {
    id: "stock",
    title: "Stock faible sur 3 récompenses",
    detail: "Une action est recommandée avant la fin de semaine.",
    href: "/workspace/rewards",
    tone: "danger",
  },
  {
    id: "customers",
    title: "428 clients à réactiver",
    detail: "Un segment prêt à contacter a été détecté.",
    href: "/workspace/segments",
    tone: "warning",
  },
  {
    id: "campaign",
    title: "Campagne envoyée avec succès",
    detail: "Le premier bilan est disponible dans les rapports.",
    href: "/workspace/campaigns",
    tone: "info",
  },
];

function classes(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

function labelForSegment(segment: string): string {
  if (segment === "new") return "Création";
  const item = commands.find(([, href]) => href.endsWith(`/${segment}`));
  return item?.[0] ?? "Détail";
}

export function WorkspaceShell({
  avatarSrc = webAssets.avatars.default,
  children,
  context,
  identity,
  navigation,
  title,
}: Readonly<{
  avatarSrc?: WebAssetPath;
  children: ReactNode;
  context: string;
  identity: WorkspaceIdentity;
  navigation: ReactNode;
  title: string;
}>) {
  const [commandOpen, setCommandOpen] = useState(false);
  const [contextOpen, setContextOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [notificationOpen, setNotificationOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [readNotifications, setReadNotifications] = useState<readonly string[]>([]);
  const [query, setQuery] = useState("");
  const [path, setPath] = useState("/workspace");
  const locale = useInterfaceLocale();
  const notifications = identity === "admin" ? adminNotifications : merchantNotifications;
  const unreadNotifications = notifications.filter(
    (notification) => !readNotifications.includes(notification.id),
  );
  const t = (value: string) => translateLabel(value, locale);

  useEffect(() => {
    const currentPath = window.location.pathname;
    setPath(currentPath);
    const navigationLinks = document.querySelectorAll<HTMLAnchorElement>(
      ".r-sidebar__nav .r-nav-item[href]",
    );
    navigationLinks.forEach((link) => {
      const href = link.getAttribute("href");
      const isCurrent =
        href === "/workspace"
          ? currentPath === href
          : Boolean(href && (currentPath === href || currentPath.startsWith(`${href}/`)));
      if (isCurrent) link.closest<HTMLDetailsElement>(".r-nav-section")?.setAttribute("open", "");
    });
    function keyboard(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen((current) => !current);
      }
      if (event.key === "Escape") {
        setCommandOpen(false);
        setContextOpen(false);
        setHelpOpen(false);
        setMobileNavOpen(false);
        setNotificationOpen(false);
        setProfileOpen(false);
      }
    }
    window.addEventListener("keydown", keyboard);
    return () => window.removeEventListener("keydown", keyboard);
  }, []);

  const visibleCommands = useMemo(
    () =>
      commands.filter(
        ([label, href]) =>
          (identity === "admin" || merchantCommandHrefs.has(href)) &&
          label.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
      ),
    [identity, query],
  );
  const segments = path.split("/").filter(Boolean).slice(1);
  const currentModule = segments[0]
    ? labelForSegment(segments[0])
    : identity === "admin"
      ? "Vue d’ensemble"
      : "Tableau de bord";
  const currentDescription = segments[0] ? (moduleDescriptions[segments[0]] ?? context) : context;

  async function logout() {
    try {
      const apiBaseUrl = `${window.location.protocol}//${window.location.hostname}:4000`;
      await fetch(`${apiBaseUrl}/v1/auth/logout`, {
        credentials: "include",
        method: "POST",
      });
    } finally {
      window.location.assign("/login");
    }
  }

  return (
    <main
      className={classes(
        "r-app-shell",
        `r-app-shell--${identity}`,
        mobileNavOpen && "r-app-shell--nav-open",
      )}
    >
      <button
        aria-label="Fermer la navigation"
        className="r-sidebar-scrim"
        onClick={() => setMobileNavOpen(false)}
        type="button"
      />

      <aside className="r-sidebar d-flex flex-column">
        <div className="r-sidebar__brand">
          <RabbehniMark />
          <span className="r-sidebar__product">
            {identity === "admin"
              ? locale === "ar"
                ? "الإدارة"
                : locale === "en"
                  ? "Administration"
                  : "Administration"
              : locale === "ar"
                ? "فضاء التاجر"
                : locale === "en"
                  ? "Merchant workspace"
                  : "Espace commerçant"}
          </span>
        </div>

        <button
          aria-expanded={contextOpen}
          className="r-workspace-switcher"
          onClick={() => {
            setContextOpen((current) => !current);
            setNotificationOpen(false);
            setProfileOpen(false);
          }}
          type="button"
        >
          <span className="r-workspace-switcher__badge">{identity === "admin" ? "GC" : "CM"}</span>
          <span>
            <strong>{identity === "admin" ? "Groupe Carthage" : "Café Medina"}</strong>
            <small>
              {identity === "admin" ? "Organisation sélectionnée" : "Commerce sélectionné"}
            </small>
          </span>
          <Icon name="chevron" />
        </button>
        {contextOpen && (
          <section className="r-context-menu" aria-label="Contexte de gestion">
            <header>
              <span>{identity === "admin" ? "Contexte administratif" : "Commerce actif"}</span>
              <strong>{identity === "admin" ? "Groupe Carthage" : "Café Medina"}</strong>
            </header>
            <p>
              {identity === "admin"
                ? "Votre compte démo appartient à Groupe Carthage. Les données affichées sont isolées dans cette organisation."
                : "Toutes les opérations affichées concernent Café Medina et ses points de vente."}
            </p>
            <a href={identity === "admin" ? "/workspace/organizations" : "/workspace/branches"}>
              {identity === "admin"
                ? "Voir ou changer l’organisation"
                : "Choisir un point de vente"}
            </a>
          </section>
        )}

        <nav
          className="accordion accordion-flush r-sidebar__nav"
          aria-label="Navigation principale"
        >
          {navigation}
        </nav>

        <div className="r-sidebar__utility mt-auto">
          <button onClick={() => setHelpOpen(true)} type="button">
            <Icon name="help" />
            {t("Centre d’aide")}
          </button>
          <a href={identity === "admin" ? "/workspace/system" : "/workspace"}>
            <span className="r-live-dot" />
            {identity === "admin" ? t("Tous les services actifs") : t("Commerce synchronisé")}
          </a>
        </div>

        <button
          aria-expanded={profileOpen}
          className="r-sidebar__account"
          onClick={() => {
            setProfileOpen((current) => !current);
            setContextOpen(false);
            setNotificationOpen(false);
          }}
          type="button"
        >
          <span className="r-protected__avatar" aria-label="Compte">
            <AssetImage alt="Avatar du compte" eager src={avatarSrc} />
          </span>
          <div>
            <strong>{identity === "admin" ? "Rabbehni Owner" : "Ahmed Ben Salah"}</strong>
            <span>
              {identity === "admin" ? "Administrateur" : "Responsable commerce"} · En ligne
            </span>
          </div>
        </button>
      </aside>

      <section className="r-app-main">
        <header className="r-topbar">
          <button
            aria-label="Ouvrir la navigation"
            className="r-mobile-nav-trigger"
            onClick={() => setMobileNavOpen(true)}
            type="button"
          >
            <span />
            <span />
            <span />
          </button>
          <button
            aria-label="Rechercher"
            className="r-topbar__search"
            onClick={() => setCommandOpen(true)}
            type="button"
          >
            <Icon name="search" />
            <span>
              {locale === "ar"
                ? "ابحث عن عميل أو صفحة أو إجراء…"
                : locale === "en"
                  ? "Search for a customer, page or action…"
                  : "Rechercher un client, une page ou une action…"}
            </span>
            <kbd>Ctrl K</kbd>
          </button>
          <div className="r-topbar__actions">
            <ButtonLink
              className="r-topbar__create"
              href={
                identity === "admin" ? "/workspace/organizations/new" : "/workspace/customers/new"
              }
            >
              + {identity === "admin" ? t("Nouvelle organisation") : t("Nouveau client")}
            </ButtonLink>
            <LanguageSwitcher />
            <ThemeToggle />
            <button
              aria-expanded={notificationOpen}
              aria-label={`${t("Notifications")} (${unreadNotifications.length})`}
              className="r-icon-button"
              onClick={() => {
                setNotificationOpen((current) => !current);
                setContextOpen(false);
                setProfileOpen(false);
              }}
              type="button"
            >
              <Icon name="notification" />
              {unreadNotifications.length > 0 && (
                <span className="r-notification-count">{unreadNotifications.length}</span>
              )}
            </button>
            <button
              aria-expanded={profileOpen}
              aria-label="Ouvrir le profil"
              className="r-topbar__avatar"
              onClick={() => {
                setProfileOpen((current) => !current);
                setContextOpen(false);
                setNotificationOpen(false);
              }}
              type="button"
            >
              <AssetImage alt="" eager src={avatarSrc} />
            </button>
          </div>
        </header>

        <div className="r-app-content">
          <header className="r-page-intro">
            <nav aria-label="Fil d’Ariane" className="r-breadcrumbs">
              <a href="/workspace">{title}</a>
              {segments.map((segment, index) => (
                <span key={`${segment}-${index}`}>
                  <span>/</span>
                  <span>{labelForSegment(segment)}</span>
                </span>
              ))}
            </nav>
            <div className="r-page-intro__row">
              <span className="r-page-context">
                <strong>{currentModule}</strong>
                <span>{currentDescription}</span>
              </span>
              <div className="r-page-intro__meta">
                <span>{t("Dernière mise à jour : aujourd’hui, 13:30")}</span>
                <StatusPill>{t("En ligne")}</StatusPill>
              </div>
            </div>
          </header>
          <div className="r-page-transition" key={path}>
            {children}
          </div>
        </div>
      </section>

      {commandOpen && (
        <div
          className="r-command-backdrop"
          onMouseDown={() => setCommandOpen(false)}
          role="presentation"
        >
          <section
            aria-label="Recherche globale"
            aria-modal="true"
            className="r-command-palette"
            onMouseDown={(event) => event.stopPropagation()}
            role="dialog"
          >
            <label className="r-command-palette__search">
              <Icon name="search" />
              <input
                autoFocus
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Où souhaitez-vous aller ?"
                value={query}
              />
              <kbd>Esc</kbd>
            </label>
            <div className="r-command-palette__body">
              <span>Navigation rapide</span>
              {visibleCommands.map(([label, href, icon]) => (
                <a href={href} key={href}>
                  <Icon name={icon} />
                  <span>{label}</span>
                  <small>Ouvrir</small>
                </a>
              ))}
              {visibleCommands.length === 0 && (
                <p className="r-command-palette__empty">
                  Aucun résultat. Essayez un nom de module.
                </p>
              )}
            </div>
            <footer>
              <span>↑↓ naviguer</span>
              <span>Entrée ouvrir</span>
              <span>Échap fermer</span>
            </footer>
          </section>
        </div>
      )}

      {profileOpen && (
        <aside className="r-profile-menu" aria-label="Menu du profil">
          <header>
            <span className="r-profile-menu__avatar">
              <AssetImage alt="" eager src={avatarSrc} />
            </span>
            <div>
              <strong>{identity === "admin" ? "Rabbehni Owner" : "Ahmed Ben Salah"}</strong>
              <small>
                {identity === "admin" ? "owner@demo.rabbehni.local" : "manager@demo.rabbehni.local"}
              </small>
            </div>
            <StatusPill>{identity === "admin" ? "Admin" : "Merchant"}</StatusPill>
          </header>
          <nav>
            <a href="http://localhost:8080/realms/rabbehni/account/" target="_blank">
              <Icon name="customer" />
              <span>
                <strong>Gérer mon profil</strong>
                <small>Identité, email et mot de passe</small>
              </span>
            </a>
            <a href="/workspace/localization">
              <Icon name="localization" />
              <span>
                <strong>Langue et préférences</strong>
                <small>Formats, langue et devise</small>
              </span>
            </a>
          </nav>
          <button onClick={() => void logout()} type="button">
            <Icon name="logout" />
            Se déconnecter
          </button>
        </aside>
      )}

      <aside
        aria-hidden={!notificationOpen}
        className={classes(
          "r-notification-panel",
          notificationOpen && "r-notification-panel--open",
        )}
      >
        <header>
          <div>
            <span className="r-eyebrow">{t("Notifications")}</span>
            <h2>
              {unreadNotifications.length > 0
                ? `${unreadNotifications.length} ${
                    locale === "ar"
                      ? "إشعارات جديدة"
                      : locale === "en"
                        ? "new notifications"
                        : "nouvelles notifications"
                  }`
                : locale === "ar"
                  ? "أنت على اطلاع"
                  : locale === "en"
                    ? "You are up to date"
                    : "Vous êtes à jour"}
            </h2>
          </div>
          <button
            aria-label="Fermer les notifications"
            onClick={() => setNotificationOpen(false)}
            type="button"
          >
            ×
          </button>
        </header>
        <div className="r-notification-panel__actions">
          <button
            disabled={unreadNotifications.length === 0}
            onClick={() => setReadNotifications(notifications.map(({ id }) => id))}
            type="button"
          >
            {locale === "ar"
              ? "تحديد الكل كمقروء"
              : locale === "en"
                ? "Mark all as read"
                : "Tout marquer comme lu"}
          </button>
        </div>
        <div className="r-notification-panel__list">
          {notifications.map((notification) => {
            const isRead = readNotifications.includes(notification.id);
            return (
              <a
                className={classes(
                  "r-notification-item",
                  `r-notification-item--${notification.tone}`,
                  isRead && "is-read",
                )}
                href={notification.href}
                key={notification.id}
                onClick={() =>
                  setReadNotifications((current) =>
                    current.includes(notification.id) ? current : [...current, notification.id],
                  )
                }
              >
                <span className="r-notification-item__indicator" />
                <span>
                  <strong>{notification.title}</strong>
                  <small>{notification.detail}</small>
                </span>
                {!isRead && <em>Nouveau</em>}
              </a>
            );
          })}
        </div>
        <footer>
          <a href="/workspace/notification-deliveries">
            {locale === "ar"
              ? "عرض سجل الإشعارات"
              : locale === "en"
                ? "View notification history"
                : "Voir l’historique des notifications"}
          </a>
        </footer>
      </aside>

      <aside
        aria-hidden={!helpOpen}
        className={classes("r-help-panel", helpOpen && "r-help-panel--open")}
      >
        <header>
          <div>
            <span className="r-eyebrow">Guide de la page</span>
            <h2>Comment utiliser ce module ?</h2>
          </div>
          <button aria-label="Fermer" onClick={() => setHelpOpen(false)} type="button">
            ×
          </button>
        </header>
        <AssetImage alt="Équipe support Rabbehni" src={webAssets.support.agent} />
        <div className="r-help-panel__content">
          <strong>{currentModule}</strong>
          <p>
            Retrouvez ici l’objectif du module, les actions disponibles et la prochaine étape
            recommandée.
          </p>
          <a href="/workspace">Voir le guide de démarrage</a>
          <button type="button">Contacter le support</button>
        </div>
      </aside>
    </main>
  );
}
