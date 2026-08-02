import { AuthShell, ButtonLink, Eyebrow, webAssets } from "@rabbehni/design-system/web";
import type { Metadata } from "next";

import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Récupérer l’accès" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      illustration={{
        alt: "Protection mobile du compte marchand",
        src: webAssets.security.mobileProtection,
      }}
      product="Rabbehni Merchant"
      aside={
        <>
          <Eyebrow>Account recovery</Eyebrow>
          <h1>A quick, secure way back.</h1>
          <p>A time-limited Keycloak action protects every recovery request.</p>
        </>
      }
    >
      <Eyebrow>Récupération</Eyebrow>
      <h2>Retrouver votre accès.</h2>
      <p>La réponse reste identique, que le compte existe ou non.</p>
      <ResetForm />
      <ButtonLink href="/login" variant="quiet">
        Retour à la connexion
      </ButtonLink>
    </AuthShell>
  );
}
