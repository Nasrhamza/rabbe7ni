"use client";

import { useEffect, useState } from "react";

import { Icon } from "@rabbehni/design-system/icons";

type Theme = "dark" | "light";

function applyTheme(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
  window.localStorage.setItem("rabbehni.admin-theme-v2", theme);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>("light");

  useEffect(() => {
    const stored = window.localStorage.getItem("rabbehni.admin-theme-v2");
    const initial: Theme = stored === "dark" ? "dark" : "light";
    setTheme(initial);
    applyTheme(initial);
  }, []);

  function toggle() {
    const next = theme === "light" ? "dark" : "light";
    setTheme(next);
    applyTheme(next);
  }

  return (
    <button
      aria-label={theme === "light" ? "Activer le mode sombre" : "Activer le mode clair"}
      className="r-icon-button"
      onClick={toggle}
      title={theme === "light" ? "Mode sombre" : "Mode clair"}
      type="button"
    >
      <Icon name="theme" />
    </button>
  );
}
