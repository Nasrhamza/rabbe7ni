"use client";

import { AssetImage, Button, Eyebrow, webAssets } from "@rabbehni/design-system/web";

export default function ErrorPage({ reset }: Readonly<{ reset: () => void }>) {
  return (
    <main className="r-error-page">
      <AssetImage alt="État d’erreur de l’espace marchand" eager src={webAssets.errors.sad} />
      <div>
        <Eyebrow>Service indisponible</Eyebrow>
        <h1>Nous n’avons pas pu charger cet écran.</h1>
        <p>Votre action n’a pas été appliquée. Vous pouvez relancer le chargement en sécurité.</p>
        <Button onClick={reset}>Réessayer</Button>
      </div>
    </main>
  );
}
