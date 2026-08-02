import { SlidingAuth } from "@rabbehni/design-system/auth-slider";
import { webAssets } from "@rabbehni/design-system/assets";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Connexion" };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const adminUrl = process.env.NEXT_PUBLIC_ADMIN_WEB_URL ?? "http://localhost:3001";
const callbackUrl = `${adminUrl}/auth/callback`;

export default function AdminLoginPage() {
  const loginUrl = `${apiUrl}/v1/auth/login?redirect_uri=${encodeURIComponent(callbackUrl)}&locale=fr`;
  return (
    <SlidingAuth
      description="Pilotez les organisations, les commerces, les accès et les performances depuis un espace centralisé."
      forgotPasswordHref="/forgot-password"
      illustration={webAssets.auth.adminLogin}
      loginUrl={loginUrl}
      portalLabel="Administration"
      productName="Rabbehni Admin"
      tone="admin"
    />
  );
}
