import { AuthShell, ButtonLink, Eyebrow, webAssets } from "@rabbehni/design-system/web";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Vérifier l’e-mail" };

export default function VerifyEmailPage() {
  return (
    <AuthShell
      illustration={{
        alt: "Notification de vérification de l’adresse e-mail",
        src: webAssets.communication.emailNotification,
      }}
      product="Rabbehni Admin"
      aside={
        <>
          <Eyebrow>Verified identity</Eyebrow>
          <h1>Trust begins with a verified channel.</h1>
          <p>Keycloak controls verification actions while Rabbehni records the security event.</p>
        </>
      }
    >
      <Eyebrow>Vérification</Eyebrow>
      <h2>Confirmez votre adresse.</h2>
      <p>Une session authentifiée est nécessaire pour demander un nouveau lien.</p>
      <ButtonLink href="/workspace">Continuer dans l’espace protégé</ButtonLink>
    </AuthShell>
  );
}
