export const rabbehniTokens = {
  color: {
    ink: "#142126",
    inkSoft: "#43565c",
    canvas: "#f5f8f6",
    canvasDark: "#071012",
    mint: "#4bd5a7",
    mintDeep: "#158766",
    aqua: "#58cbd4",
    violet: "#8f82ff",
    coral: "#ff8878",
    amber: "#f5c45e",
    white: "#ffffff",
  },
  radius: {
    sm: 12,
    md: 20,
    lg: 28,
    xl: 36,
    pill: 999,
  },
  space: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 48,
  },
  motion: {
    fast: 160,
    standard: 260,
    slow: 520,
  },
  typography: {
    display: "Manrope",
    body: "Inter",
    arabic: "Noto Sans Arabic",
  },
} as const;

export type RabbehniThemeMode = "light" | "dark" | "system";
export type RabbehniSurfaceTone = "neutral" | "mint" | "aqua" | "violet" | "coral";
