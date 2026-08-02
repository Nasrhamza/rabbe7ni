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
        <h1>Cette page n’existe pas.</h1>
        <p>Le lien est peut-être incorrect ou la ressource n’est plus disponible.</p>
        <ButtonLink href="/workspace">Revenir à l’administration</ButtonLink>
      </div>
    </main>
  );
}
