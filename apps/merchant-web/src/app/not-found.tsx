import { AssetImage, ButtonLink, Eyebrow, webAssets } from "@rabbehni/design-system/web";

export default function NotFound() {
  return (
    <main className="r-error-page">
      <AssetImage
        alt="Livraison égarée pour illustrer une page introuvable"
        eager
        src={webAssets.errors.notFound}
      />
      <div>
        <Eyebrow>Erreur 404</Eyebrow>
        <h1>Page introuvable.</h1>
        <p>Cette adresse ne correspond à aucun écran disponible dans votre espace marchand.</p>
        <ButtonLink href="/workspace">Revenir à l’espace marchand</ButtonLink>
      </div>
    </main>
  );
}
