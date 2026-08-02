"use client";

import { AssetImage, Button, Eyebrow, webAssets } from "@rabbehni/design-system/web";

export default function ErrorPage({ reset }: Readonly<{ reset: () => void }>) {
  return (
    <main className="r-error-page">
      <AssetImage
        alt="Dossier indisponible après une erreur de chargement"
        eager
        src={webAssets.files.notFound}
      />
      <div>
        <Eyebrow>Erreur de chargement</Eyebrow>
        <h1>Impossible d’afficher cet écran.</h1>
        <p>Réessayez sans quitter votre contexte administrateur sécurisé.</p>
        <Button onClick={reset}>Réessayer</Button>
      </div>
    </main>
  );
}
