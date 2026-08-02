"use client";

import {
  Phase7ResourceScreen as SharedPhase7ResourceScreen,
  type Phase7Resource,
} from "@rabbehni/design-system/phase7-web";

export type { Phase7Resource };

export function Phase7ResourceScreen(
  props: Readonly<{ resource: Phase7Resource; mode: "detail" | "list" | "new"; id?: string }>,
) {
  return (
    <SharedPhase7ResourceScreen
      apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}
      {...props}
    />
  );
}
