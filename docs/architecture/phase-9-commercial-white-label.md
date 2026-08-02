# Phase 9 — Couche commerciale SaaS et personnalisation

## Périmètre

La Phase 9 ajoute la couche commerciale de Rabbehni sans connecter de moyen de paiement réel.
Le fournisseur `PFE_SANDBOX` reproduit le cycle checkout, webhook, facture, paiement réussi ou
échoué et frais de transaction. Il ne collecte aucune donnée bancaire et ne déplace aucun fonds.

## Agrégats

- `Plan` décrit les prix mensuels et annuels, la période d’essai et les frais de transaction.
- `PlanFeatureEntitlement` contrôle l’accès serveur aux capacités incluses dans un plan.
- `PlanQuotaLimit` fixe une limite par métrique et par période.
- `Subscription` porte le cycle trial, actif, past-due, suspendu, annulé et expiré.
- `SubscriptionChange` journalise toute transition avec une clé d’idempotence.
- `PaymentIntent`, `PaymentTransaction` et `Invoice` modélisent le paiement sandbox.
- `BillingWebhook` conserve le résultat de la validation HMAC et empêche le rejeu.
- `UsageRecord` est le registre immuable de consommation.
- `TenantQuotaOverride` permet une exception explicite, motivée et éventuellement expirante.
- `WhiteLabelProfile`, `TenantLocalization` et `CustomDomain` portent la configuration de marque,
  de langue et de domaine du tenant.

Toutes les entités appartenant à un client contiennent `tenant_id` et sont couvertes par les
politiques PostgreSQL RLS. Les plans et leurs définitions restent globaux.

## Cycle d’abonnement

1. Un tenant démarre une période d’essai ou active un plan.
2. Les renouvellements, suspensions, réactivations, annulations, upgrades et downgrades créent une
   entrée `SubscriptionChange`.
3. Une même clé d’idempotence renvoie la transition existante.
4. Le guard d’entitlement vérifie le plan courant pour les capacités protégées.
5. Une consommation est refusée avant écriture si le quota ou l’override actif serait dépassé.

## Paiement PFE Sandbox

1. `POST /v1/commercial/checkout` crée un intent expirant et un token à usage contrôlé.
2. Le résultat peut être confirmé directement dans l’interface de démonstration ou reçu par le
   webhook sandbox.
3. Le webhook public exige `x-rabbehni-sandbox-signature`, un HMAC SHA-256 calculé sur le payload
   canonique.
4. L’event id et la clé de transaction empêchent le rejeu.
5. Le succès active l’abonnement, produit une facture payée et enregistre les frais.
6. L’échec produit une facture irrécouvrable et place l’abonnement en `PAST_DUE`.

## White-label et localisation

Les tokens autorisés sont limités aux couleurs hexadécimales, polices approuvées, mode de thème,
logo, favicon et paramètres email. Les langues supportées sont français, anglais et arabe avec
direction LTR/RTL. Le format des dates, heures et nombres, les devises, pays et fuseaux horaires
sont enregistrés par tenant. Les domaines personnalisés suivent un cycle de vérification séparé.

Les applications web utilisent le thème clair par défaut. Le mode sombre reste un choix explicite
de l’utilisateur et les tokens restent surchargeables par tenant.

## Gouvernance des pays et régions

`PlatformCountry` maintient le catalogue actif des pays avec locale et devise par défaut.
`PlatformRegion` définit un périmètre culturel exploitable (pays, fuseau, locale, devise et profil
culturel) et son cycle `ACTIVE`, `INACTIVE`, `ARCHIVED`. `RegionAdministrator` affecte uniquement
un utilisateur possédant une adhésion active au tenant. Les trois tables sont tenant-scoped,
protégées par RLS et auditées. L’Admin dispose d’un écran dédié « Pays et régions » ; les accès
opérationnels plus fins continuent d’être appliqués par les scopes organisation, franchise,
commerce et point de vente déjà portés par les memberships.

## Contrôles de validation

- validation Prisma et migrations RLS ;
- tests HMAC, rejeu, idempotence, quotas et cycle d’abonnement ;
- test PostgreSQL démontrant qu’un tenant ne voit ni abonnement ni paiement d’un autre tenant ;
- test PostgreSQL démontrant l’isolation du catalogue régional et le rejet des écritures
  inter-tenant ;
- qualité Nx : format, lint, typecheck, tests et builds ;
- revue navigateur des applications Admin, Merchant et du thème Keycloak.
