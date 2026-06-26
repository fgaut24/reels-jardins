# Reels avec vos vidéos (intro animée + vidéo + carton « Réserver »)

Ce module assemble, pour chaque soirée : une **carte d'intro animée**, puis **votre vidéo** (avec son), puis un **carton « Réserver »**. Tout en 9:16 (1080 × 1920).

## Fichiers ajoutés
- `card.html` — les cartes d'intro et d'outro animées.
- `assemble.js` — le script d'assemblage (Puppeteer + ffmpeg).
- `.github/workflows/reels-video.yml` — l'Action dédiée.

## Mode d'emploi

1. Créez un dossier **`videos/`** dans le dépôt et déposez-y vos clips, par exemple :
   `videos/groupe_21.mp4`, `videos/groupe_28.mp4`, `videos/groupe_13.mp4`.
2. Dans `soirees.json`, chaque soirée a un champ **`"video"`** qui pointe vers son clip
   (déjà pré-rempli avec ces noms). Adaptez si vos fichiers ont d'autres noms.
3. Réglez si besoin **`introDuration`** et **`outroDuration`** (en secondes) en haut de `soirees.json`.
4. Lancez l'Action **« Générer les Reels (vidéo) »** (onglet Actions → Run workflow),
   ou en local : `node assemble.js`.
5. Récupérez l'artefact **`reels-jardins-video`** : un MP4 par soirée.

Seules les soirées dont la vidéo **existe réellement** sont traitées ; les autres sont ignorées.

## En local
Prérequis : Node 18+, `npm install`, et **ffmpeg + ffprobe** installés (`brew install ffmpeg`).

## Bon à savoir
- Vidéos attendues **verticales (9:16)**. Si le ratio diffère légèrement, le script ajoute des bandes pour rester en 1080 × 1920 (pas de déformation).
- Le **son de votre vidéo est conservé** ; l'intro et l'outro sont muettes.
- Gardez des clips **courts et compressés** : ils vivent dans le dépôt Git. Pour de gros fichiers, préférez Git LFS.

## Droits (important)
Avant diffusion sur les réseaux de la commune, assurez-vous d'avoir l'**accord des artistes** pour leur image et leur musique. Une bande-son protégée peut être bloquée ou coupée par Instagram/Facebook.
