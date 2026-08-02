import { WorkspaceDashboard } from "@rabbehni/design-system/dashboard-web";

export default function AdminWorkspacePage() {
  return (
    <WorkspaceDashboard
      apiUrl={process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000"}
      identity="admin"
    />
  );
}
