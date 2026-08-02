import type { SVGProps } from "react";

export type IconName =
  | "activity"
  | "analytics"
  | "audit"
  | "automation"
  | "badge"
  | "billing"
  | "branch"
  | "campaign"
  | "chevron"
  | "customer"
  | "dashboard"
  | "franchise"
  | "gamification"
  | "globe"
  | "help"
  | "localization"
  | "location"
  | "logout"
  | "merchant"
  | "notification"
  | "organization"
  | "permission"
  | "plan"
  | "points"
  | "qr"
  | "reward"
  | "search"
  | "settings"
  | "staff"
  | "subscription"
  | "tenant"
  | "theme";

const paths: Record<IconName, readonly string[]> = {
  activity: ["M4 13h4l2-8 4 14 2-6h4"],
  analytics: ["M5 19V9m7 10V5m7 14v-7", "M3 19h18"],
  audit: ["M7 3h10v4H7z", "M5 7h14v14H5z", "m8 12 2 2 4-5"],
  automation: [
    "M12 3v4m0 10v4M3 12h4m10 0h4",
    "m6.4 6.4 2.8 2.8m5.6 5.6 2.8 2.8m0-11.2-2.8 2.8m-5.6 5.6-2.8 2.8",
    "M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z",
  ],
  badge: ["m12 3 2.2 4.4 4.8.7-3.5 3.4.8 4.8-4.3-2.3-4.3 2.3.8-4.8-3.5-3.4 4.8-.7z"],
  billing: ["M3 6h18v12H3z", "M3 10h18", "M7 15h4"],
  branch: ["M12 3v6m0 0H6v5m6-5h6v5", "M4 14h4v4H4zm6 0h4v4h-4zm6 0h4v4h-4z"],
  campaign: ["M4 11v4h4l7 4V7L8 11z", "M18 9a4 4 0 0 1 0 8"],
  chevron: ["m9 6 6 6-6 6"],
  customer: [
    "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2",
    "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    "M22 21v-2a4 4 0 0 0-3-3.87",
  ],
  dashboard: ["M4 4h6v6H4zM14 4h6v10h-6zM4 14h6v6H4zM14 18h6v2h-6z"],
  franchise: ["M4 20V8l8-5 8 5v12", "M8 20v-6h8v6", "M9 9h6"],
  gamification: [
    "M8 8h8a5 5 0 0 1 4.6 7l-1.2 3a2 2 0 0 1-3.2.8L14 17h-4l-2.2 1.8A2 2 0 0 1 4.6 18l-1.2-3A5 5 0 0 1 8 8Z",
    "M8 12v4m-2-2h4m6-1h.01m2 2h.01",
  ],
  globe: [
    "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Z",
    "M3 12h18",
    "M12 3c2.3 2.5 3.5 5.5 3.5 9S14.3 18.5 12 21c-2.3-2.5-3.5-5.5-3.5-9S9.7 5.5 12 3Z",
  ],
  help: [
    "M9.1 9a3 3 0 1 1 4.8 2.4c-1.3.9-1.9 1.4-1.9 2.6",
    "M12 18h.01",
    "M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20Z",
  ],
  localization: [
    "M4 5h9",
    "M8 3v2c0 4-2 7-5 9",
    "M5 10c2 0 4 1 6 3",
    "m14 8 4 11m-7 0 4-11 4 11",
    "M13 16h6",
  ],
  location: [
    "M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z",
    "M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  ],
  logout: ["M10 17l5-5-5-5", "M15 12H3", "M14 3h5a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-5"],
  merchant: ["M4 10h16", "M5 10l1-6h12l1 6", "M6 10v10h12V10", "M9 20v-6h6v6"],
  notification: ["M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9", "M10 21h4"],
  organization: ["M4 21V5h10v16", "M14 9h6v12", "M8 9h2m-2 4h2m-2 4h2m8-4h.01m0 4h.01"],
  permission: ["M12 3 4 5v4c0 5-2.7 8-8 10-5.3-2-8-5-8-10V8z", "m9 12 2 2 4-5"],
  plan: ["M4 4h16v16H4z", "M8 8h8M8 12h8M8 16h5"],
  points: [
    "M12 3v18m5-14.5c0-2-2.2-3.5-5-3.5S7 4.4 7 7s2 3.3 5 3.8 5 1.3 5 3.8-2.2 4.4-5 4.4-5-1.5-5-3.5",
  ],
  qr: ["M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z", "M14 14h2v2h-2zm4 0h2v4h-2zm-4 4h4v2h-4z"],
  reward: [
    "M20 12v9H4v-9",
    "M2 7h20v5H2z",
    "M12 7v14",
    "M12 7H8.5a2.5 2.5 0 1 1 0-5C12 2 12 7 12 7Zm0 0h3.5a2.5 2.5 0 1 0 0-5C12 2 12 7 12 7Z",
  ],
  search: ["M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16Z", "m21 21-4.35-4.35"],
  settings: ["M4 6h16M4 12h16M4 18h16", "M8 4v4M16 10v4M10 16v4"],
  staff: [
    "M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2",
    "M8.5 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8Z",
    "m18 8 4 4-4 4m2-4h-6",
  ],
  subscription: ["M4 7h16v12H4z", "M8 7V5a4 4 0 0 1 8 0v2", "M8 13h8"],
  tenant: ["M3 21h18", "M5 21V7l7-4 7 4v14", "M9 10h6m-6 4h6"],
  theme: ["M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z"],
};

export function Icon({ name, ...props }: Readonly<{ name: IconName } & SVGProps<SVGSVGElement>>) {
  return (
    <svg aria-hidden="true" fill="none" height="20" viewBox="0 0 24 24" width="20" {...props}>
      {paths[name].map((path) => (
        <path
          d={path}
          key={path}
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth="1.8"
        />
      ))}
    </svg>
  );
}
