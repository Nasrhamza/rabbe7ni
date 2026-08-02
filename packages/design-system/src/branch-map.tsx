"use client";

import { useMemo, useState } from "react";

import { Icon } from "@rabbehni/design-system/icons";

type BranchRecord = Readonly<Record<string, unknown>>;

const cityCoordinates: Readonly<Record<string, readonly [number, number]>> = {
  ariana: [36.8665, 10.1647],
  bizerte: [37.2746, 9.8739],
  gabes: [33.8815, 10.0982],
  hammamet: [36.4, 10.6167],
  "la marsa": [36.878, 10.3247],
  monastir: [35.7643, 10.8113],
  nabeul: [36.4513, 10.7355],
  sfax: [34.7406, 10.7603],
  sousse: [35.8256, 10.63699],
  tunis: [36.8065, 10.1815],
};
const tunisCoordinates: readonly [number, number] = [36.8065, 10.1815];

function stringValue(record: BranchRecord, key: string): string {
  const value = record[key];
  return typeof value === "string" ? value : "";
}

function coordinates(branch: BranchRecord, index: number): readonly [number, number] {
  const city = stringValue(branch, "city").trim().toLocaleLowerCase();
  const [latitude, longitude] = cityCoordinates[city] ?? tunisCoordinates;
  const offset = (index % 5) * 0.006;
  return [latitude + offset, longitude - offset];
}

export function BranchMap({
  branches,
  heading = "Carte des points de vente",
}: Readonly<{ branches: readonly BranchRecord[]; heading?: string }>) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const safeIndex = branches.length === 0 ? 0 : Math.min(selectedIndex, branches.length - 1);
  const selected = branches[safeIndex] ?? {};
  const [latitude, longitude] = coordinates(selected, safeIndex);
  const branchName =
    stringValue(selected, "name") || stringValue(selected, "displayName") || "Point de vente";
  const address = [stringValue(selected, "addressLine"), stringValue(selected, "city")]
    .filter(Boolean)
    .join(", ");
  const mapUrl = useMemo(() => {
    const longitudeDelta = 0.07;
    const latitudeDelta = 0.045;
    const bbox = [
      longitude - longitudeDelta,
      latitude - latitudeDelta,
      longitude + longitudeDelta,
      latitude + latitudeDelta,
    ].join(",");
    return `https://www.openstreetmap.org/export/embed.html?bbox=${encodeURIComponent(
      bbox,
    )}&layer=mapnik&marker=${latitude}%2C${longitude}`;
  }, [latitude, longitude]);
  const externalUrl = `https://www.openstreetmap.org/?mlat=${latitude}&mlon=${longitude}#map=14/${latitude}/${longitude}`;

  return (
    <aside className="ux-branch-map ux-branch-map--real" aria-label={heading}>
      <header className="ux-branch-map__header">
        <div>
          <span>Localisation réelle</span>
          <strong>{heading}</strong>
        </div>
        <a href={externalUrl} rel="noreferrer" target="_blank">
          Ouvrir la carte
        </a>
      </header>
      <div className="ux-branch-map__frame">
        <iframe
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          src={mapUrl}
          title={`${heading} — ${branchName}`}
        />
      </div>
      <div className="ux-branch-map__selection">
        <div>
          <Icon name="branch" />
          <span>
            <strong>{branchName}</strong>
            <small>{address || "Adresse non renseignée"}</small>
          </span>
        </div>
        <div className="ux-branch-map__chips" aria-label="Choisir un point de vente">
          {branches.slice(0, 8).map((branch, index) => (
            <button
              aria-pressed={safeIndex === index}
              key={String(branch.id ?? index)}
              onClick={() => setSelectedIndex(index)}
              type="button"
            >
              {stringValue(branch, "name") ||
                stringValue(branch, "displayName") ||
                `Point ${index + 1}`}
            </button>
          ))}
        </div>
      </div>
    </aside>
  );
}
