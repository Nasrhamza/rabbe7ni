"use client";

import { useEffect, useState, type ReactNode } from "react";

import { Icon, type IconName } from "@rabbehni/design-system/icons";
import { translateLabel, useInterfaceLocale } from "@rabbehni/design-system/locale";

export function NavigationItem({
  active,
  children,
  href,
  icon,
}: Readonly<{
  active?: boolean;
  children: ReactNode;
  href: string;
  icon: IconName;
}>) {
  const [current, setCurrent] = useState(active ?? false);
  const locale = useInterfaceLocale();
  const label = typeof children === "string" ? translateLabel(children, locale) : children;

  useEffect(() => {
    const path = window.location.pathname;
    setCurrent(
      active ??
        (href === "/workspace" ? path === href : path === href || path.startsWith(`${href}/`)),
    );
  }, [active, href]);

  return (
    <a
      aria-current={current ? "page" : undefined}
      className={`nav-link r-nav-item${current ? " r-nav-item--active" : ""}`}
      href={href}
      title={typeof label === "string" ? label : undefined}
    >
      <span className="r-nav-item__icon">
        <Icon name={icon} />
      </span>
      <span className="r-nav-item__label">{label}</span>
    </a>
  );
}
