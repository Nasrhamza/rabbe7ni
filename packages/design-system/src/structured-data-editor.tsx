"use client";

import { useMemo } from "react";

type StructuredValue =
  boolean | number | string | null | StructuredValue[] | { [key: string]: StructuredValue };

type ValueKind = "text" | "number" | "boolean" | "group" | "list";

const arrayFields = new Set(["segmentIds", "steps"]);

const suggestions: Record<string, readonly string[]> = {
  applicability: ["organizationIds", "merchantIds", "branchIds"],
  branding: ["displayName", "logoUrl", "primaryColor", "secondaryColor"],
  communicationPreferences: ["email", "sms", "push", "marketing"],
  conditions: ["combinator", "field", "operator", "value"],
  consents: ["marketing", "analytics", "profiling", "required"],
  eligibility: ["minimumPoints", "customerStatus", "segmentIds"],
  eligibilityRules: ["minimumPoints", "customerStatus", "segmentIds"],
  exitConditions: ["event", "delayMinutes", "customerStatus"],
  metadata: ["source", "category", "note"],
  openingHours: ["monday", "tuesday", "wednesday", "thursday", "friday", "saturday", "sunday"],
  recurrence: ["frequency", "interval", "days"],
  rules: ["combinator", "conditions"],
  settings: ["enabled", "timezone", "currency"],
  steps: ["type", "channel", "delayMinutes", "templateId"],
  triggerConfig: ["event", "channel", "delayMinutes"],
};

const kindLabels: Record<ValueKind, string> = {
  boolean: "Oui / Non",
  group: "Groupe",
  list: "Liste",
  number: "Nombre",
  text: "Texte",
};

function isRecord(value: StructuredValue): value is { [key: string]: StructuredValue } {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function kindOf(value: StructuredValue): ValueKind {
  if (Array.isArray(value)) return "list";
  if (isRecord(value)) return "group";
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "number") return "number";
  return "text";
}

function valueForKind(kind: ValueKind): StructuredValue {
  if (kind === "boolean") return false;
  if (kind === "group") return {};
  if (kind === "list") return [];
  if (kind === "number") return 0;
  return "";
}

function parseValue(
  fieldName: string,
  value: string,
): {
  data: StructuredValue;
  invalid: boolean;
} {
  try {
    const parsed = JSON.parse(value || (arrayFields.has(fieldName) ? "[]" : "{}")) as unknown;
    if (
      parsed === null ||
      typeof parsed === "string" ||
      typeof parsed === "number" ||
      typeof parsed === "boolean" ||
      Array.isArray(parsed) ||
      typeof parsed === "object"
    ) {
      if (
        arrayFields.has(fieldName) &&
        isRecord(parsed as StructuredValue) &&
        Object.keys(parsed as object).length === 0
      ) {
        return { data: [], invalid: false };
      }
      return { data: parsed as StructuredValue, invalid: false };
    }
  } catch {
    // Legacy malformed values are replaced through the friendly reset action below.
  }
  return { data: arrayFields.has(fieldName) ? [] : {}, invalid: true };
}

function NodeEditor({
  depth,
  onChange,
  suggestionsForKeys,
  value,
}: Readonly<{
  depth: number;
  onChange: (next: StructuredValue) => void;
  suggestionsForKeys: readonly string[];
  value: StructuredValue;
}>) {
  const kind = kindOf(value);

  return (
    <div className={`r-structured-node r-structured-node--${kind}`}>
      <select
        aria-label="Type de valeur"
        className="r-structured-node__type"
        value={kind}
        onChange={(event) => onChange(valueForKind(event.target.value as ValueKind))}
      >
        {Object.entries(kindLabels).map(([option, label]) => (
          <option key={option} value={option}>
            {label}
          </option>
        ))}
      </select>

      {kind === "text" ? (
        <input
          aria-label="Valeur"
          placeholder="Saisir une valeur"
          value={typeof value === "string" ? value : ""}
          onChange={(event) => onChange(event.target.value)}
        />
      ) : null}

      {kind === "number" ? (
        <input
          aria-label="Valeur numérique"
          type="number"
          value={typeof value === "number" ? value : 0}
          onChange={(event) => onChange(Number(event.target.value))}
        />
      ) : null}

      {kind === "boolean" ? (
        <select
          aria-label="Valeur oui ou non"
          value={value === true ? "true" : "false"}
          onChange={(event) => onChange(event.target.value === "true")}
        >
          <option value="true">Oui</option>
          <option value="false">Non</option>
        </select>
      ) : null}

      {kind === "group" && isRecord(value) ? (
        <div className="r-structured-collection">
          {Object.entries(value).map(([key, childValue], index) => (
            <div className="r-structured-entry" key={`${key}-${index}`}>
              <input
                aria-label={`Nom du paramètre ${index + 1}`}
                className="r-structured-entry__key"
                list={`structured-keys-${depth}`}
                placeholder="Nom du paramètre"
                value={key}
                onChange={(event) => {
                  const nextKey = event.target.value;
                  const entries = Object.entries(value);
                  entries[index] = [nextKey, childValue];
                  onChange(Object.fromEntries(entries));
                }}
              />
              <NodeEditor
                depth={depth + 1}
                onChange={(nextChild) => onChange({ ...value, [key]: nextChild })}
                suggestionsForKeys={suggestionsForKeys}
                value={childValue}
              />
              <button
                aria-label={`Supprimer ${key || `le paramètre ${index + 1}`}`}
                className="r-structured-remove"
                type="button"
                onClick={() =>
                  onChange(
                    Object.fromEntries(Object.entries(value).filter((_, item) => item !== index)),
                  )
                }
              >
                ×
              </button>
            </div>
          ))}
          <datalist id={`structured-keys-${depth}`}>
            {suggestionsForKeys.map((option) => (
              <option key={option} value={option} />
            ))}
          </datalist>
          <button
            className="r-structured-add"
            type="button"
            onClick={() => {
              let key = suggestionsForKeys.find((item) => !(item in value)) ?? "nouveauParametre";
              let suffix = 2;
              while (key in value) {
                key = `nouveauParametre${suffix}`;
                suffix += 1;
              }
              onChange({ ...value, [key]: "" });
            }}
          >
            + Ajouter un paramètre
          </button>
        </div>
      ) : null}

      {kind === "list" && Array.isArray(value) ? (
        <div className="r-structured-collection">
          {value.map((childValue, index) => (
            <div className="r-structured-entry r-structured-entry--list" key={index}>
              <span className="r-structured-entry__index">{index + 1}</span>
              <NodeEditor
                depth={depth + 1}
                onChange={(nextChild) =>
                  onChange(value.map((item, itemIndex) => (itemIndex === index ? nextChild : item)))
                }
                suggestionsForKeys={suggestionsForKeys}
                value={childValue}
              />
              <button
                aria-label={`Supprimer l’élément ${index + 1}`}
                className="r-structured-remove"
                type="button"
                onClick={() => onChange(value.filter((_, itemIndex) => itemIndex !== index))}
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="r-structured-add"
            type="button"
            onClick={() => onChange([...value, ""])}
          >
            + Ajouter un élément
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function StructuredDataEditor({
  fieldName,
  onChange,
  value,
}: Readonly<{
  fieldName: string;
  onChange: (value: string) => void;
  value: string;
}>) {
  const parsed = useMemo(() => parseValue(fieldName, value), [fieldName, value]);
  const fieldSuggestions = suggestions[fieldName] ?? suggestions.settings ?? [];

  return (
    <section className="r-structured-editor">
      <div className="r-structured-editor__intro">
        <span>Configuration guidée</span>
        <small>Ajoutez uniquement les options dont vous avez besoin.</small>
      </div>
      {parsed.invalid ? (
        <div className="r-structured-editor__error" role="alert">
          <span>Cette ancienne valeur est illisible.</span>
          <button type="button" onClick={() => onChange(arrayFields.has(fieldName) ? "[]" : "{}")}>
            Réinitialiser proprement
          </button>
        </div>
      ) : (
        <NodeEditor
          depth={0}
          onChange={(next) => onChange(JSON.stringify(next))}
          suggestionsForKeys={fieldSuggestions}
          value={parsed.data}
        />
      )}
    </section>
  );
}
