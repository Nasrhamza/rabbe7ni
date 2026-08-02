"use client";

import { Phase9Screen, type Phase9Resource } from "@rabbehni/design-system/phase9-web";

export type { Phase9Resource };

export function Phase9ResourceScreen({ resource }: Readonly<{ resource: Phase9Resource }>) {
  return (
    <Phase9Screen
      apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}
      identity="admin"
      resource={resource}
    />
  );
}
