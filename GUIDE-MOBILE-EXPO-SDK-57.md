# Installer et lancer Rabbehni Mobile sur un téléphone

Ce guide explique comment une collaboratrice peut récupérer le projet privé, lancer les services sur son PC Windows et ouvrir l'application **Rabbehni Customer** sur son téléphone avec **Expo Go compatible SDK 57**.

## 1. Ce qu'il faut installer

Sur le PC :

- [Git pour Windows](https://git-scm.com/download/win)
- [Node.js 24](https://nodejs.org/)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) avec WSL 2 activé
- [VS Code](https://code.visualstudio.com/)
- `pnpm` version 11 :

```powershell
npm install --global pnpm@11.17.0
```

Sur le téléphone :

- Android ou iPhone connecté au **même Wi-Fi privé** que le PC
- **Expo Go pour SDK 57**, à installer depuis la page officielle : <https://expo.dev/go>

> Le projet utilise Expo `~57.0.9`. Vérifier que la page Expo Go affiche bien **SDK 57** avant l'installation. Sur Android, Expo permet d'installer une version compatible précise. Sur un iPhone physique, Apple autorise uniquement la version Expo Go actuellement publiée dans l'App Store.

## 2. Obtenir le dépôt GitHub privé

1. Hamza ajoute la collaboratrice dans GitHub : dépôt `rabbe7ni` → **Settings** → **Collaborators** → **Add people**.
2. Elle accepte l'invitation reçue par GitHub ou par e-mail.
3. Elle ouvre PowerShell et exécute :

```powershell
cd $env:USERPROFILE\Documents
git clone https://github.com/Nasrhamza/rabbe7ni.git
cd rabbe7ni
code .
```

Si GitHub demande une authentification, se connecter avec le compte qui a accepté l'invitation. Ne jamais partager le mot de passe GitHub de Hamza.

## 3. Installer le projet

Dans un terminal PowerShell ouvert à la racine de `rabbe7ni` :

```powershell
Copy-Item .env.example .env
pnpm install --frozen-lockfile
pnpm db:generate
```

Vérifier les versions :

```powershell
node --version
pnpm --version
docker --version
docker compose version
```

Les versions attendues sont Node 24 ou plus récent et pnpm 11 ou plus récent.

## 4. Trouver l'adresse IP du PC

Le téléphone ne peut pas utiliser `localhost` ni `10.0.2.2` :

- `localhost` désignerait le téléphone lui-même ;
- `10.0.2.2` fonctionne uniquement avec l'émulateur Android.

Dans PowerShell :

```powershell
ipconfig
```

Dans la partie **Carte réseau sans fil Wi-Fi**, noter l'**Adresse IPv4**, par exemple :

```text
192.168.1.20
```

Dans la suite du guide, remplacer `192.168.1.20` par l'adresse réelle du PC.

## 5. Configurer le backend pour le téléphone

Ouvrir le fichier `.env` situé à la racine du projet et remplacer ou ajouter ces valeurs :

```dotenv
KEYCLOAK_PUBLIC_URL=http://192.168.1.20:8080
KEYCLOAK_URL=http://192.168.1.20:8080
OIDC_ISSUER_URL=http://192.168.1.20:8080/realms/rabbehni
NEXT_PUBLIC_OIDC_ISSUER_URL=http://192.168.1.20:8080/realms/rabbehni
EXPO_PUBLIC_API_URL=http://192.168.1.20:4000
EXPO_PUBLIC_OIDC_ISSUER_URL=http://192.168.1.20:8080/realms/rabbehni
EXPO_PUBLIC_OIDC_CLIENT_ID=rabbehni-mobile
EXPO_PUBLIC_PASSWORD_LOGIN=false
```

Ne pas modifier `OIDC_BACKCHANNEL_URL` : il doit rester sur la valeur fournie dans `.env.example`.

Créer ensuite le fichier `apps/customer-mobile/.env.local` avec :

```dotenv
EXPO_PUBLIC_API_URL=http://192.168.1.20:4000
EXPO_PUBLIC_OIDC_ISSUER_URL=http://192.168.1.20:8080/realms/rabbehni
EXPO_PUBLIC_OIDC_CLIENT_ID=rabbehni-mobile
EXPO_PUBLIC_PASSWORD_LOGIN=false
```

Ne pas ajouter manuellement `EXPO_PUBLIC_AUTH_REDIRECT_URI`. L'application le calcule automatiquement :

- Expo Go : `exp://ADRESSE_IP:8081/--/auth/callback`
- Development Build : `rabbehni://auth/callback`

Le client Keycloak `rabbehni-mobile` du projet accepte déjà les redirections `exp://*` et `rabbehni://*`.

> Les fichiers `.env` et `.env.local` sont privés et ignorés par Git. Ne pas les envoyer sur GitHub, Messenger ou e-mail.

## 6. Démarrer les serveurs

1. Ouvrir Docker Desktop et attendre le message indiquant que Docker est prêt.
2. À la racine du projet, exécuter :

```powershell
pnpm infra:up
pnpm db:migrate:deploy
pnpm db:seed
```

Le premier démarrage peut prendre plusieurs minutes, car Docker télécharge et construit les images.

Vérifier les conteneurs :

```powershell
docker compose --env-file .env -f infra/docker/compose.yaml ps
```

Depuis le navigateur du PC, tester :

- API : <http://localhost:4000/v1/health/ready>
- Keycloak : <http://localhost:8080/realms/rabbehni/.well-known/openid-configuration>

Puis tester les mêmes adresses dans le navigateur du téléphone en remplaçant `localhost` par l'adresse IPv4 du PC :

```text
http://192.168.1.20:4000/v1/health/ready
http://192.168.1.20:8080/realms/rabbehni/.well-known/openid-configuration
```

Les deux pages doivent répondre avant de lancer l'application mobile.

## 7. Méthode rapide : Expo Go SDK 57

À la racine du projet, lancer Metro en mode Expo Go :

```powershell
pnpm --filter @rabbehni/customer-mobile exec expo start --go --lan --clear
```

Un QR code apparaît dans le terminal.

### Android

1. Ouvrir Expo Go.
2. Appuyer sur **Scan QR code**.
3. Autoriser la caméra si Android le demande.
4. Scanner le QR code du terminal.

### iPhone

1. Ouvrir l'application **Appareil photo**.
2. Scanner le QR code.
3. Appuyer sur la notification **Open in Expo Go**.

Garder le terminal Metro ouvert pendant l'utilisation. Les changements de code sont normalement rechargés automatiquement sur le téléphone.

### Si le QR code ne se connecte pas

Vérifier d'abord que le téléphone et le PC sont sur le même Wi-Fi. Désactiver temporairement le VPN et les données mobiles du téléphone. Ensuite essayer le tunnel :

```powershell
pnpm --filter @rabbehni/customer-mobile exec expo start --go --tunnel --clear
```

Le tunnel est plus lent que le mode LAN. Il aide Metro à atteindre le téléphone, mais l'API et Keycloak doivent toujours être accessibles à l'adresse configurée.

## 8. Méthode recommandée : installer Rabbehni Development Build

Expo Go est pratique pour une vérification rapide. Pour travailler régulièrement sur cette application, utiliser le **Development Build**, car il installe une vraie application `Rabbehni Customer`, utilise le schéma `rabbehni://` et correspond exactement à la configuration native du projet.

### Option A — Build EAS et installation par QR code

Le projet appartient à l'organisation Expo `hamz2002s-team`. Hamza doit donc inviter la collaboratrice dans cette organisation Expo avant qu'elle puisse construire l'application.

Dans PowerShell :

```powershell
cd apps/customer-mobile
npx eas-cli@latest login
npx eas-cli@latest whoami
npx eas-cli@latest build --platform android --profile development
```

Lors du premier build Android, accepter la génération d'un nouveau keystore si EAS la propose. À la fin :

1. ouvrir le lien du build EAS ;
2. cliquer sur **Install** ;
3. scanner le QR code avec le téléphone Android ;
4. télécharger le fichier `.apk` ;
5. ouvrir le fichier et autoriser l'installation depuis cette source si Android le demande.

Revenir ensuite à la racine du projet et lancer Metro pour le Development Build :

```powershell
cd ../..
pnpm --filter @rabbehni/customer-mobile exec expo start --dev-client --lan --clear
```

Ouvrir **Rabbehni Customer** depuis l'écran d'accueil du téléphone, puis sélectionner le serveur de développement affiché.

### Option B — Build Android local par câble USB

Cette option nécessite Android Studio, le SDK Android et le débogage USB activé sur le téléphone.

1. Sur Android : **Paramètres** → **À propos du téléphone** → appuyer 7 fois sur **Numéro de build**.
2. Ouvrir **Options pour les développeurs** et activer **Débogage USB**.
3. Brancher le téléphone au PC et accepter sa clé RSA.
4. Vérifier la connexion :

```powershell
adb devices
```

5. Compiler et installer l'application :

```powershell
pnpm --filter @rabbehni/customer-mobile exec expo run:android --device
```

6. Pour les lancements suivants :

```powershell
pnpm --filter @rabbehni/customer-mobile exec expo start --dev-client --lan --clear
```

Sur Windows, un build iOS local n'est pas possible. Pour un iPhone physique, utiliser EAS Build avec un compte Apple Developer et enregistrer l'appareil, ou utiliser Expo Go SDK 57 si cette version est disponible dans l'App Store.

## 9. Pare-feu Windows

Au premier lancement, autoriser **Node.js**, **Docker Desktop** et **Java/OpenJDK** sur les réseaux privés. Les ports utiles sont :

- `4000` : API Rabbehni
- `8080` : Keycloak
- `8081` : Expo/Metro

Si le PC répond mais pas le téléphone, ouvrir **Sécurité Windows** → **Pare-feu et protection réseau** → **Autoriser une application via le pare-feu**, puis autoriser ces applications sur le réseau **Privé**.

## 10. Problèmes fréquents

| Problème                                         | Solution                                                                                                  |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------- |
| `Network request failed`                         | Vérifier l'IP dans les deux fichiers `.env`, le Wi-Fi, Docker et le port `4000`.                          |
| Expo Go affiche une incompatibilité SDK          | Installer Expo Go SDK 57 depuis <https://expo.dev/go>, ou utiliser le Development Build.                  |
| Le QR code ne s'ouvre pas                        | Relancer avec `--tunnel`, couper VPN/données mobiles et autoriser Node dans le pare-feu.                  |
| La page Keycloak ne s'ouvre pas sur le téléphone | Vérifier `KEYCLOAK_PUBLIC_URL`, redémarrer l'infrastructure et tester le port `8080`.                     |
| Le login termine dans le navigateur              | Supprimer `EXPO_PUBLIC_AUTH_REDIRECT_URI`, vider le cache Metro et relancer.                              |
| `Invalid parameter: redirect_uri`                | Vérifier que le realm importé contient `exp://*` et `rabbehni://*` pour `rabbehni-mobile`.                |
| L'application garde une ancienne configuration   | Fermer Expo Go, puis relancer Metro avec `--clear`.                                                       |
| Le téléphone n'atteint pas `192.168...`          | Le réseau Wi-Fi isole peut-être les appareils ; essayer un partage de connexion ou un autre réseau privé. |
| Le port est déjà utilisé                         | Exécuter `pnpm infra:down`, fermer les anciens terminaux, puis redémarrer.                                |

Pour voir les logs Docker :

```powershell
docker compose --env-file .env -f infra/docker/compose.yaml logs --tail 100 api keycloak
```

Pour arrêter le projet :

```powershell
pnpm infra:down
```

## 11. Résumé du chemin le plus court

```powershell
git clone https://github.com/Nasrhamza/rabbe7ni.git
cd rabbe7ni
Copy-Item .env.example .env
pnpm install --frozen-lockfile
pnpm db:generate
# Configurer .env et apps/customer-mobile/.env.local avec l'IPv4 du PC
pnpm infra:up
pnpm db:migrate:deploy
pnpm db:seed
pnpm --filter @rabbehni/customer-mobile exec expo start --go --lan --clear
```

Scanner enfin le QR code avec Expo Go SDK 57.

## Documentation officielle Expo

- Expo Go SDK 57 : <https://expo.dev/go>
- Démarrer sur un téléphone et utiliser le tunnel : <https://docs.expo.dev/get-started/start-developing/>
- Différences Expo Go / Development Build : <https://docs.expo.dev/develop/development-builds/faq/>
- Créer un Development Build : <https://docs.expo.dev/develop/development-builds/introduction/>
- Installer un build Android `.apk` : <https://docs.expo.dev/tutorial/eas/android-development-build/>
- AuthSession et URL de redirection : <https://docs.expo.dev/versions/latest/sdk/auth-session/>
