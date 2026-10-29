# Chez Maty : boutique en ligne

Site 100 % HTML, CSS et JavaScript. **Pas de PHP, pas de base de données, pas de serveur** : il n'y a rien à pirater côté serveur, et aucun code secret ni carte bancaire ne passe par le site.

## Comment marche le paiement
1. La cliente remplit son panier (taille, prénom à broder).
2. Elle paie avec **Wave** ou **Orange Money** depuis SON téléphone, directement sur le numéro de la vendeuse. L'argent arrive tout de suite chez la vendeuse.
3. Elle recopie la référence de transaction, puis la commande complète est envoyée sur le **WhatsApp** de la vendeuse.
4. ⚠️ La vendeuse vérifie dans son appli Wave / Orange Money que l'argent est bien arrivé **avant** de livrer (protection contre les fausses références).

## Ce qu'il faut modifier
Tout se change dans **`config.js`** :
- `nom`, `slogan`, `ville`
- `whatsapp` : numéro de la tante (ex. `2250701234567`)
- `wave.numero`, `wave.nomCompte`, `wave.lien` (lien Wave Business, facultatif)
- `orangeMoney.numero`, `orangeMoney.nomCompte`, `orangeMoney.codeMenu`
- `livraison` (prix de la course du livreur), `produits` (articles, prix, photos)
- Photos : les mettre dans `images/` puis écrire `image: "images/body.jpg"`.

## Ouvrir dans Visual Studio Code
1. Dézipper le dossier `boutique-bebe`.
2. Dans VS Code : **Fichier > Ouvrir le dossier…** > choisir `boutique-bebe`.
3. Installer l'extension **Live Server** (Ritwick Dey), clic droit sur `index.html` > **Open with Live Server** : le site s'ouvre et se met à jour à chaque sauvegarde.

## Héberger gratuitement (Netlify, 0 F)
1. Créer un compte gratuit sur https://app.netlify.com
2. **Add new site > Deploy manually**, glisser le dossier `boutique-bebe`.
3. Le site est en ligne en HTTPS (cadenas) avec une adresse du type `lepetitnid.netlify.app`.
   Le fichier `_headers` ajoute automatiquement les protections de sécurité.
Pour mettre à jour : glisser à nouveau le dossier dans l'onglet **Deploys**.

Autre option gratuite : GitHub Pages (Settings > Pages).

## Plus tard
- Application Android / iPhone : on pourra transformer ce site en appli (Capacitor) quand il y aura le MacBook.
- Paiement automatique (sans vérification manuelle) : possible via un agrégateur comme PayDunya ou CinetPay, qui prend une petite commission par vente.

## Activer la connexion avec Google (gratuit avec Firebase)
Le bouton **Compte** permet aux clientes de se connecter avec leur compte Google : pas de mot de passe, coordonnées pré-remplies, historique des commandes. **La connexion Google est obligatoire pour payer.** Tant que Firebase n'est pas configuré, les clientes peuvent commander sans compte (sinon personne ne pourrait commander).

1. Aller sur https://console.firebase.google.com et créer un projet « chez-maty » (plan gratuit **Spark**, Google Analytics inutile).
2. **Build > Authentication > Get started > Sign-in method** : activer **Google**.
3. **Build > Firestore Database > Create database** (mode production, région europe-west).
   Onglet **Rules** : coller le contenu du fichier `firestore.rules`, puis **Publish**.
4. **Paramètres du projet (roue dentée) > Vos applications > icône Web `</>`** : créer l'app, puis recopier `apiKey`, `authDomain`, `projectId`, `appId` dans `firebase-config.js`.
5. **Authentication > Settings > Authorized domains** : ajouter l'adresse du site (ex. `chezmaty.netlify.app`).

La clé `apiKey` n'est pas un secret : elle est faite pour être visible. La sécurité vient des règles `firestore.rules` (chaque cliente ne voit que ses propres données).

### Tester sur l'ordinateur
La connexion ne marche pas en ouvrant `index.html` par double-clic. Utiliser **Live Server** dans VS Code (adresse `http://127.0.0.1:5500`) et ajouter `127.0.0.1` dans les Authorized domains de Firebase.


## Paiement en ligne CinetPay (vérification automatique)
Avec CinetPay, la cliente paie sur la page sécurisée CinetPay (Wave, Orange Money, MTN, Moov ou carte bancaire). Le site vérifie lui-même auprès de CinetPay que le paiement est bien arrivé : plus de référence à recopier, plus de fausse référence possible.

**Comment c'est protégé**
- La clé secrète CinetPay est rangée sur Netlify (variables d'environnement), jamais dans les fichiers du site.
- Le prix est recalculé par le serveur à partir de `config.js` : personne ne peut payer moins cher en trafiquant la page.
- « Paiement reçu » ne s'affiche que si CinetPay répond que le paiement est accepté.
- Chaque paiement apparaît dans l'espace marchand CinetPay de Maty, avec le détail de la commande.

**Activer CinetPay (nouvelle plateforme panel.cinetpay.net)**
1. Dans le panel CinetPay : **Ressources > API & sécurité** : copier la **clé API** (`sk_test_...` en Sandbox, `sk_live_...` en production) et définir un **mot de passe API**. Ne jamais les envoyer par message ni les écrire dans les fichiers du site.
2. Mettre le site sur Netlify **avec ses fonctions** (voir ci-dessous : le glisser-déposer ne suffit pas).
3. Netlify > Site configuration > **Environment variables** : ajouter `CINETPAY_API_KEY` et `CINETPAY_API_PASSWORD`, puis redéployer.
4. Tester en **Sandbox** (argent virtuel). Numéros de test CinetPay pour la Côte d'Ivoire : `+2250707070700` (paiement réussi), `+2250707070703` (paiement échoué).
5. Pour les vrais paiements : remplir les conditions de **Mise en production** dans le panel (vérification du compte), puis remplacer la clé par la clé `sk_live_...` et le mot de passe de production sur Netlify.

Le site choisit tout seul la Sandbox (clé `sk_test_`) ou la production (clé `sk_live_`). Si les clés ne sont pas sur Netlify, il repasse automatiquement au paiement manuel (Wave / Orange Money + référence).

## Mettre en ligne avec les fonctions de paiement
Le glisser-déposer de Netlify publie seulement les pages, **pas les fonctions de paiement** (dossier `netlify/functions`). Deux façons gratuites :

**A. Avec GitHub (conseillé)**
1. Créer un compte sur https://github.com et un dépôt `chez-maty`, puis y envoyer le dossier `boutique-bebe` (bouton « uploading an existing file »).
2. Sur Netlify : **Add new site > Import an existing project > GitHub**, choisir `chez-maty`, puis **Deploy**. Les réglages sont lus dans `netlify.toml`.
3. À chaque modification envoyée sur GitHub, le site se met à jour tout seul.

**B. Depuis VS Code**
1. Installer Node.js (https://nodejs.org, version LTS).
2. Dans le terminal de VS Code, dans le dossier `boutique-bebe` : `npx netlify-cli login`, puis `npx netlify-cli deploy --prod`.

Après la mise en ligne, ajouter l'adresse du site dans Firebase > Authentication > Settings > **Authorized domains**.
