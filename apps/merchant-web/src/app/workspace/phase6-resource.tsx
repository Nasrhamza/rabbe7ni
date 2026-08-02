"use client";

import {
  Phase6ResourceScreen as SharedPhase6ResourceScreen,
  type Phase6Resource,
} from "@rabbehni/design-system/phase6-web";

export type { Phase6Resource };

export function Phase6ResourceScreen(
  props: Readonly<{ resource: Phase6Resource; mode: "detail" | "list" | "new"; id?: string }>,
) {
  return (
    <SharedPhase6ResourceScreen
      apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}
      {...props}
    />
  );
}
