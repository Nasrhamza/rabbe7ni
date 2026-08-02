import { AuthShell, ButtonLink, Eyebrow, StatusPill, webAssets } from "@rabbehni/design-system/web";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Accès confirmé" };

export default function MerchantCallbackPage() {
  return (
    <AuthShell
      illustration={{
        alt: "Connexion mobile sécurisée du compte marchand",
        src: webAssets.security.secureLogin,
      }}
      product="Rabbehni Merchant"
      aside={
        <>
          <Eyebrow>Context resolved</Eyebrow>
          <h1>Your team. Your tenant. Your boundary.</h1>
          <p>The active merchant context is derived from your authenticated membership.</p>
        </>
      }
    >
      <StatusPill>Identité confirmée</StatusPill>
      <h2>Connexion réussie.</h2>
      <p>La session est chiffrée et les permissions RBAC ont été chargées.</p>
      <ButtonLink href="/workspace">Entrer dans l’espace</ButtonLink>
    </AuthShell>
  );
}
