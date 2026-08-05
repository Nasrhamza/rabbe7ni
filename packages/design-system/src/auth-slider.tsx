"use client";

import { useState, type FormEvent } from "react";

import { webAssets, type WebAssetPath } from "@rabbehni/design-system/assets";

type PortalTone = "admin" | "merchant";

type SlidingAuthProps = Readonly<{
  description: string;
  forgotPasswordHref: string;
  illustration: WebAssetPath;
  loginUrl: string;
  portalLabel: string;
  productName: string;
  /**
   * Self-service registration entry point. When set, the first-access panel invites the visitor to
   * create a workspace instead of telling them an administrator must do it for them.
   */
  signupHref?: string;
  tone: PortalTone;
}>;

function AuthIcon({ name }: Readonly<{ name: "lock" | "mail" | "shield" }>) {
  if (name === "mail") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M3.5 6.5h17v11h-17z" />
        <path d="m4.5 7.5 7.5 5 7.5-5" />
      </svg>
    );
  }
  if (name === "shield") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 3.5 19 6v5.5c0 4.4-2.8 7.5-7 9-4.2-1.5-7-4.6-7-9V6z" />
        <path d="m8.8 12 2 2 4.4-4.5" />
      </svg>
    );
  }
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <rect height="9" rx="2" width="14" x="5" y="11" />
      <path d="M8.5 11V8a3.5 3.5 0 0 1 7 0v3" />
    </svg>
  );
}

export function SlidingAuth({
  description,
  forgotPasswordHref,
  illustration,
  loginUrl,
  portalLabel,
  productName,
  signupHref,
  tone,
}: SlidingAuthProps) {
  const [firstAccess, setFirstAccess] = useState(false);

  function continueToIdentity(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    window.location.assign(loginUrl);
  }

  return (
    <main className={`rb-login rb-login--${tone}`}>
      <div className="rb-login__ambient" aria-hidden="true" />
      <header className="rb-login__brand">
        <img alt="Rabbehni" src={webAssets.branding.logoLight} />
        <div>
          <strong>{productName}</strong>
          <span>{portalLabel}</span>
        </div>
      </header>

      <section
        aria-label={`Authentification ${productName}`}
        className={`rb-login__container${firstAccess ? " rb-login__container--first-access" : ""}`}
      >
        <div className="rb-login__form-panel rb-login__form-panel--first-access">
          <form onSubmit={continueToIdentity}>
            <span className="rb-login__eyebrow">
              {signupHref ? "Essai gratuit" : "Accès sur invitation"}
            </span>
            <h1>{signupHref ? "Créer mon espace" : "Première connexion"}</h1>
            <p>
              {signupHref
                ? "Ouvrez votre espace Rabbehni en quelques minutes. Aucune carte bancaire n’est demandée."
                : "Votre compte doit être créé par un administrateur et associé à votre organisation ou commerce."}
            </p>
            <div className="rb-login__steps" aria-label="Étapes d’activation">
              {signupHref ? (
                <>
                  <span>
                    <b>1</b> Décrivez votre commerce
                  </span>
                  <span>
                    <b>2</b> Choisissez votre adresse
                  </span>
                  <span>
                    <b>3</b> Commencez votre essai
                  </span>
                </>
              ) : (
                <>
                  <span>
                    <b>1</b> Ouvrez votre invitation sécurisée
                  </span>
                  <span>
                    <b>2</b> Créez votre mot de passe
                  </span>
                  <span>
                    <b>3</b> Accédez à votre espace
                  </span>
                </>
              )}
            </div>
            {signupHref ? (
              <a className="rb-login__primary" href={signupHref}>
                Créer mon espace
              </a>
            ) : (
              <button className="rb-login__primary" type="submit">
                Activer mon accès
              </button>
            )}
            <button
              className="rb-login__mobile-switch"
              onClick={() => setFirstAccess(false)}
              type="button"
            >
              J’ai déjà un compte
            </button>
          </form>
        </div>

        <div className="rb-login__form-panel rb-login__form-panel--signin">
          <form onSubmit={continueToIdentity}>
            <span className="rb-login__eyebrow">Espace sécurisé</span>
            <h1>Connexion</h1>
            <p>{description}</p>
            <div className="rb-login__identity-card">
              <span className="rb-login__identity-icon">
                <AuthIcon name="shield" />
              </span>
              <span>
                <strong>Identité Rabbehni</strong>
                <small>OIDC · PKCE · session protégée</small>
              </span>
              <span className="rb-login__identity-status">Sécurisé</span>
            </div>
            <button className="rb-login__primary" type="submit">
              <AuthIcon name="lock" />
              Se connecter
            </button>
            <a className="rb-login__forgot" href={forgotPasswordHref}>
              <AuthIcon name="mail" /> Mot de passe oublié ?
            </a>
            <button
              className="rb-login__mobile-switch"
              onClick={() => setFirstAccess(true)}
              type="button"
            >
              Première connexion
            </button>
          </form>
        </div>

        <div className="rb-login__overlay-wrap">
          <div className="rb-login__overlay">
            <div className="rb-login__overlay-panel rb-login__overlay-panel--left">
              <img alt="" src={illustration} />
              <h2>Content de vous revoir !</h2>
              <p>Retrouvez votre espace, vos équipes et vos opérations en toute sécurité.</p>
              <button
                className="rb-login__ghost"
                onClick={() => setFirstAccess(false)}
                type="button"
              >
                Se connecter
              </button>
            </div>
            <div className="rb-login__overlay-panel rb-login__overlay-panel--right">
              <img alt="" src={illustration} />
              <h2>Bienvenue chez Rabbehni</h2>
              <p>Vous avez reçu une invitation ? Activez votre accès en quelques étapes.</p>
              <button
                className="rb-login__ghost"
                onClick={() => setFirstAccess(true)}
                type="button"
              >
                Première connexion
              </button>
            </div>
          </div>
        </div>
      </section>

      <footer className="rb-login__footer">
        <span>
          <AuthIcon name="shield" /> Connexion protégée
        </span>
        <span>© 2026 Rabbehni</span>
      </footer>
    </main>
  );
}
