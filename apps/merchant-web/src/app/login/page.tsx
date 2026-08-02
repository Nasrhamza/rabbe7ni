import { SlidingAuth } from "@rabbehni/design-system/auth-slider";
import { webAssets } from "@rabbehni/design-system/assets";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Connexion" };

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
const merchantUrl = process.env.NEXT_PUBLIC_MERCHANT_WEB_URL ?? "http://localhost:3002";
const callbackUrl = `${merchantUrl}/auth/callback`;

export default function MerchantLoginPage() {
  const loginUrl = `${apiUrl}/v1/auth/login?redirect_uri=${encodeURIComponent(callbackUrl)}&locale=fr`;
  return (
    <SlidingAuth
      description="Gérez vos clients, vos points de vente, votre fidélité et vos opérations quotidiennes."
      forgotPasswordHref="/forgot-password"
      illustration={webAssets.auth.collaboration}
      loginUrl={loginUrl}
      portalLabel="Espace commerçant"
      productName="Rabbehni Merchant"
      tone="merchant"
    />
  );
}
