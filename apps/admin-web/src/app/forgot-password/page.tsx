import { AuthShell, ButtonLink, Eyebrow, webAssets } from "@rabbehni/design-system/web";
import type { Metadata } from "next";

import { ResetForm } from "./reset-form";

export const metadata: Metadata = { title: "Réinitialiser le mot de passe" };

export default function ForgotPasswordPage() {
  return (
    <AuthShell
      illustration={{
        alt: "Cadenas de réinitialisation du mot de passe",
        src: webAssets.auth.resetPassword,
      }}
      product="Rabbehni Admin"
      aside={
        <>
          <Eyebrow>Secure recovery</Eyebrow>
          <h1>Return safely, without friction.</h1>
          <p>Recovery is delegated to Keycloak and protected against account enumeration.</p>
        </>
      }
    >
      <Eyebrow>Récupération du compte</Eyebrow>
      <h2>Réinitialiser votre accès.</h2>
      <p>Nous vous enverrons une action Keycloak à durée limitée.</p>
      <ResetForm />
      <div className="r-auth-divider">retour</div>
      <ButtonLink href="/login" variant="quiet">
        Revenir à la connexion
      </ButtonLink>
    </AuthShell>
  );
}
