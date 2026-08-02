import { AuthShell, ButtonLink, Eyebrow, webAssets } from "@rabbehni/design-system/web";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Vérifier l’e-mail" };

export default function MerchantVerifyEmailPage() {
  return (
    <AuthShell
      illustration={{
        alt: "Canal e-mail professionnel du commerce",
        src: webAssets.communication.emailMarketing,
      }}
      product="Rabbehni Merchant"
      aside={
        <>
          <Eyebrow>Verified channel</Eyebrow>
          <h1>Keep your team connected securely.</h1>
          <p>Email verification is managed by Keycloak and audited by Rabbehni.</p>
        </>
      }
    >
      <Eyebrow>Adresse professionnelle</Eyebrow>
      <h2>Vérifiez votre e-mail.</h2>
      <p>Ouvrez une session protégée pour renvoyer une action de vérification.</p>
      <ButtonLink href="/workspace">Continuer</ButtonLink>
    </AuthShell>
  );
}
