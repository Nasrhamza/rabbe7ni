"use client";

import { Phase8Screen, type Phase8Resource } from "@rabbehni/design-system/phase8-web";

export type { Phase8Resource };

export function Phase8ResourceScreen({ resource }: Readonly<{ resource: Phase8Resource }>) {
  return (
    <Phase8Screen
      apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}
      identity="merchant"
      resource={resource}
    />
  );
}
