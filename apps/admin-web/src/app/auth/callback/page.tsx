import { AuthShell, ButtonLink, Eyebrow, StatusPill, webAssets } from "@rabbehni/design-system/web";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Session sécurisée" };

export default function AdminCallbackPage() {
  return (
    <AuthShell
      illustration={{
        alt: "Compte administrateur protégé sur un ordinateur",
        src: webAssets.security.account,
      }}
      product="Rabbehni Admin"
      aside={
        <>
          <Eyebrow>Identity confirmed</Eyebrow>
          <h1>One identity. One trusted context.</h1>
          <p>Your authorization is resolved from Rabbehni roles and tenant memberships.</p>
        </>
      }
    >
      <StatusPill>Session établie</StatusPill>
      <h2>Votre espace est prêt.</h2>
      <p>L’identité, le tenant actif et les permissions ont été vérifiés côté serveur.</p>
      <ButtonLink href="/workspace">Ouvrir l’administration</ButtonLink>
    </AuthShell>
  );
}
