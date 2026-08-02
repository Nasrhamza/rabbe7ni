"use client";

import { useEffect, useState } from "react";

import { webAssets } from "@rabbehni/design-system/assets";
import {
  getStoredLocale,
  setInterfaceLocale,
  type SupportedLocale,
} from "@rabbehni/design-system/locale";

export function LanguageSwitcher() {
  const [locale, setLocale] = useState<SupportedLocale>("fr");

  useEffect(() => {
    const initial = getStoredLocale();
    setLocale(initial);
    setInterfaceLocale(initial);
  }, []);

  function select(nextLocale: SupportedLocale) {
    setLocale(nextLocale);
    setInterfaceLocale(nextLocale);
  }

  return (
    <div className="r-language-switcher" aria-label="Langue de l’interface">
      <button
        aria-label="Afficher l’interface en français"
        aria-pressed={locale === "fr"}
        onClick={() => select("fr")}
        type="button"
      >
        <img alt="" height="18" src={webAssets.languages.fr} width="27" />
        <span>FR</span>
      </button>
      <button
        aria-label="Display the interface in English"
        aria-pressed={locale === "en"}
        onClick={() => select("en")}
        type="button"
      >
        <img alt="" height="18" src={webAssets.languages.en} width="27" />
        <span>EN</span>
      </button>
      <button
        aria-label="عرض الواجهة باللغة العربية"
        aria-pressed={locale === "ar"}
        onClick={() => select("ar")}
        type="button"
      >
        <span className="r-language-switcher__ar" aria-hidden="true">
          ع
        </span>
        <span>AR</span>
      </button>
    </div>
  );
}
