import type {
  AnchorHTMLAttributes,
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
} from "react";

import { webAssets, type WebAssetPath } from "@rabbehni/design-system/assets";
import { LanguageSwitcher } from "@rabbehni/design-system/language-switcher";
import { Icon, type IconName } from "@rabbehni/design-system/icons";
import { ThemeToggle } from "@rabbehni/design-system/theme-toggle";

export { BranchMap } from "@rabbehni/design-system/branch-map";
export { StructuredDataEditor } from "@rabbehni/design-system/structured-data-editor";
import type { RabbehniSurfaceTone } from "./tokens.js";

export { merchantPhotoFor, webAssets } from "@rabbehni/design-system/assets";
export { Icon, type IconName } from "@rabbehni/design-system/icons";
export { NavigationItem } from "@rabbehni/design-system/navigation-item";

function classes(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(" ");
}

export function RabbehniMark({ compact = false }: Readonly<{ compact?: boolean }>) {
  return (
    <span className={classes("r-logo", compact && "r-logo--compact")} aria-label="Rabbehni">
      <img
        alt=""
        className="r-logo__image r-logo__image--light"
        src="/assets/rabbehni/branding/rabbehni-main-logo-light.png"
      />
      <img
        alt=""
        className="r-logo__image r-logo__image--dark"
        src="/assets/rabbehni/branding/rabbehni-main-logo.png"
      />
    </span>
  );
}

export function GlassCard({
  children,
  className,
  tone = "neutral",
  ...props
}: Readonly<
  HTMLAttributes<HTMLElement> & {
    children: ReactNode;
    tone?: RabbehniSurfaceTone;
  }
>) {
  return (
    <section className={classes("r-glass", `r-glass--${tone}`, className)} {...props}>
      {children}
    </section>
  );
}

export function BentoGrid({
  children,
  className,
  ...props
}: Readonly<HTMLAttributes<HTMLDivElement>>) {
  return (
    <div className={classes("r-bento", className)} {...props}>
      {children}
    </div>
  );
}

export function BentoCard({
  children,
  className,
  span = "single",
  tone = "neutral",
  ...props
}: Readonly<
  HTMLAttributes<HTMLElement> & {
    children: ReactNode;
    span?: "single" | "wide" | "tall" | "hero";
    tone?: RabbehniSurfaceTone;
  }
>) {
  return (
    <article
      className={classes(
        "r-bento-card",
        `r-bento-card--${span}`,
        `r-bento-card--${tone}`,
        className,
      )}
      {...props}
    >
      {children}
    </article>
  );
}

export function Eyebrow({ children }: Readonly<{ children: ReactNode }>) {
  return <span className="r-eyebrow">{children}</span>;
}

export function StatusPill({
  children,
  tone = "success",
}: Readonly<{ children: ReactNode; tone?: "success" | "info" | "warning" | "neutral" }>) {
  return <span className={classes("r-status", `r-status--${tone}`)}>{children}</span>;
}

export function Button({
  children,
  className,
  variant = "primary",
  ...props
}: Readonly<
  ButtonHTMLAttributes<HTMLButtonElement> & {
    variant?: "primary" | "secondary" | "quiet";
  }
>) {
  return (
    <button className={classes("r-button", `r-button--${variant}`, className)} {...props}>
      {children}
    </button>
  );
}

export function ButtonLink({
  children,
  className,
  variant = "primary",
  ...props
}: Readonly<
  AnchorHTMLAttributes<HTMLAnchorElement> & {
    variant?: "primary" | "secondary" | "quiet";
  }
>) {
  return (
    <a className={classes("r-button", `r-button--${variant}`, className)} {...props}>
      {children}
    </a>
  );
}

export function Field({
  hint,
  label,
  ...props
}: Readonly<InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }>) {
  const id = props.id ?? props.name;
  return (
    <label className="r-field" htmlFor={id}>
      <span className="r-field__label">{label}</span>
      <input className="r-input" id={id} {...props} />
      {hint && <span className="r-field__hint">{hint}</span>}
    </label>
  );
}

export function AssetImage({
  alt,
  className,
  eager = false,
  src,
}: Readonly<{
  alt: string;
  className?: string;
  eager?: boolean;
  src: WebAssetPath;
}>) {
  return (
    <img
      alt={alt}
      className={classes("r-asset-image", className)}
      decoding="async"
      loading={eager ? "eager" : "lazy"}
      src={src}
    />
  );
}

export function EmptyState({
  action,
  asset = webAssets.files.emptySearch,
  description,
  title,
}: Readonly<{
  action?: ReactNode;
  asset?: WebAssetPath;
  description: string;
  title: string;
}>) {
  return (
    <div className="r-empty-state">
      <AssetImage alt="" className="r-empty-state__image" src={asset} />
      <div>
        <h2>{title}</h2>
        <p>{description}</p>
        {action}
      </div>
    </div>
  );
}

export function ResourceVisual({
  alt,
  assets,
}: Readonly<{ alt: string; assets: readonly WebAssetPath[] }>) {
  return (
    <div className={classes("r-resource-visual", assets.length > 1 && "r-resource-visual--group")}>
      {assets.map((asset) => (
        <AssetImage alt={alt} key={asset} src={asset} />
      ))}
    </div>
  );
}

export function AuthShell({
  children,
  aside,
  illustration,
  product,
}: Readonly<{
  children: ReactNode;
  aside: ReactNode;
  illustration?: Readonly<{ alt: string; src: WebAssetPath }>;
  product: string;
}>) {
  return (
    <main className="r-auth-shell">
      <div className="r-aurora" aria-hidden="true">
        <span className="r-aurora__orb r-aurora__orb--one" />
        <span className="r-aurora__orb r-aurora__orb--two" />
        <span className="r-aurora__orb r-aurora__orb--three" />
      </div>
      <section className="r-auth-shell__editorial" aria-label={`${product} introduction`}>
        <RabbehniMark />
        <div className="r-auth-shell__aside">
          {aside}
          {illustration && (
            <AssetImage
              alt={illustration.alt}
              className="r-auth-shell__illustration"
              eager
              src={illustration.src}
            />
          )}
        </div>
        <p className="r-auth-shell__foot">Secure by design · Built for every culture</p>
        <LanguageSwitcher />
      </section>
      <section className="r-auth-shell__form">
        <div className="r-auth-shell__mobile-brand">
          <RabbehniMark />
        </div>
        <GlassCard className="r-auth-card">{children}</GlassCard>
      </section>
    </main>
  );
}

export function ProtectedShell({
  children,
  navigation,
  title,
  context,
  avatarSrc = webAssets.avatars.default,
}: Readonly<{
  avatarSrc?: WebAssetPath;
  children: ReactNode;
  navigation: ReactNode;
  title: string;
  context: string;
}>) {
  return (
    <main className="r-app-shell">
      <aside className="r-sidebar">
        <div className="r-sidebar__brand">
          <RabbehniMark />
          <span className="r-sidebar__product">{title}</span>
        </div>
        <nav className="r-sidebar__nav" aria-label="Navigation principale">
          {navigation}
        </nav>
        <div className="r-sidebar__account">
          <span className="r-protected__avatar" aria-label="Compte">
            <AssetImage alt="Avatar du compte" eager src={avatarSrc} />
          </span>
          <div>
            <strong>Compte démo</strong>
            <span>Session sécurisée</span>
          </div>
        </div>
      </aside>
      <section className="r-app-main">
        <header className="r-topbar">
          <button className="r-topbar__search" type="button" aria-label="Rechercher">
            <Icon name="search" />
            <span>Rechercher dans Rabbehni</span>
            <kbd>⌘ K</kbd>
          </button>
          <div className="r-topbar__actions">
            <LanguageSwitcher />
            <ThemeToggle />
            <button className="r-icon-button" type="button" aria-label="Notifications">
              <Icon name="notification" />
            </button>
            <span className="r-topbar__avatar">
              <AssetImage alt="" eager src={avatarSrc} />
            </span>
          </div>
        </header>
        <div className="r-app-content">
          <header className="r-page-intro">
            <nav aria-label="Fil d’Ariane" className="r-breadcrumbs">
              <a href="/workspace">Accueil</a>
              <span>/</span>
              <span>{title}</span>
            </nav>
            <div className="r-page-intro__row">
              <div>
                <h1>{title}</h1>
                <p>{context}</p>
              </div>
              <StatusPill>Session protégée</StatusPill>
            </div>
          </header>
          {children}
        </div>
      </section>
    </main>
  );
}

export function NavigationSection({
  children,
  defaultOpen = false,
  title,
}: Readonly<{ children: ReactNode; defaultOpen?: boolean; title: string }>) {
  return (
    <details className="accordion-item r-nav-section" open={defaultOpen}>
      <summary className="accordion-button">
        <span data-rabbehni-i18n={title}>{title}</span>
        <Icon name="chevron" />
      </summary>
      <div className="accordion-collapse r-nav-section__collapse">{children}</div>
    </details>
  );
}

export function PageHeader({
  actions,
  description,
  eyebrow,
  title,
}: Readonly<{
  actions?: ReactNode;
  description: string;
  eyebrow?: string;
  title: string;
}>) {
  return (
    <header className="r-content-header">
      <div>
        {eyebrow && <Eyebrow>{eyebrow}</Eyebrow>}
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actions && <div className="r-content-header__actions">{actions}</div>}
    </header>
  );
}

export function MetricCard({
  detail,
  icon,
  label,
  value,
}: Readonly<{ detail?: string; icon: IconName; label: string; value: string }>) {
  return (
    <article className="r-metric-card">
      <span className="r-metric-card__icon">
        <Icon name={icon} />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        {detail && <small>{detail}</small>}
      </div>
    </article>
  );
}
