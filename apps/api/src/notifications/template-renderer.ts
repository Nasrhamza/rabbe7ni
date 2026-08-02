import { BadRequestException } from "@nestjs/common";

const variablePattern = /\{\{\s*([a-zA-Z][a-zA-Z0-9_.-]{0,79})\s*\}\}/g;

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export function templateVariables(input: string): readonly string[] {
  return [...new Set([...input.matchAll(variablePattern)].map((match) => match[1] as string))];
}

export function renderSafeTemplate(
  input: string,
  variables: Readonly<Record<string, unknown>>,
): string {
  return input.replace(variablePattern, (_full, name: string) => {
    const value = variables[name];
    if (value === undefined || value === null) {
      throw new BadRequestException(`Missing template variable: ${name}`);
    }
    if (!["string", "number", "boolean"].includes(typeof value)) {
      throw new BadRequestException(`Unsafe template variable type: ${name}`);
    }
    return escapeHtml(String(value));
  });
}
