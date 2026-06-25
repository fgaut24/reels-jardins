# Page web « dépôt / récupération » des Reels

Cette page (`index.html`) permet de générer les vidéos **sans ligne de commande** : vous déposez la configuration des soirées, elle la dépose dans votre dépôt GitHub, déclenche l'Action, suit l'avancement et vous donne le lien pour récupérer les vidéos.

## Comment ça marche

1. La page écrit `soirees.json` dans votre dépôt (via l'API GitHub).
2. Ce dépôt déclenche le workflow `.github/workflows/reels.yml`.
3. L'Action génère les MP4 et les publie en artefact.
4. La page suit l'exécution, puis affiche un bouton vers la page GitHub où télécharger les vidéos.

## Mise en place (une fois)

1. Créez un dépôt GitHub et placez-y :
   - à la racine : `index.html`, `generate.js`, `template.html`, `soirees.json`, `package.json` ;
   - et `.github/workflows/reels.yml`.
2. Activez **GitHub Pages** : dépôt → **Settings** → **Pages** → Source : branche `main`, dossier `/ (root)`. Votre page sera à l'adresse `https://VOTRE-COMPTE.github.io/VOTRE-DEPOT/`.
3. Créez un **jeton d'accès** (la page vous guide, section 1) : token *fine-grained*, limité à ce dépôt, permissions **Contents : lecture/écriture** et **Actions : lecture/écriture**.

## Utilisation

1. Ouvrez la page, renseignez owner / repo / branche / token (bouton « Mémoriser » pour ne plus les ressaisir).
2. Déposez un `soirees.json` ou modifiez le contenu directement.
3. Cliquez **« Déposer la configuration et générer »**.
4. Patientez (la page suit l'exécution), puis cliquez **« Récupérer les vidéos sur GitHub »** et téléchargez l'artefact.

## Sécurité

- Le jeton reste **dans votre navigateur** (stockage local) ; il n'est envoyé qu'à `api.github.com`.
- Utilisez un jeton limité à ce seul dépôt et aux deux permissions ci-dessus.
- Ne laissez pas la page ouverte avec le jeton enregistré sur un poste partagé ; vous pouvez révoquer le jeton à tout moment dans les réglages GitHub.

## Limite connue

Le téléchargement final du fichier vidéo se fait **depuis la page GitHub de l'exécution** (et non directement dans la page), car GitHub ne permet pas de récupérer le binaire de l'artefact depuis un site tiers. La page vous y conduit en un clic.
