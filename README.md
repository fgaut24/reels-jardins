# Générateur de Reels — Les Jardins en scène

Produit automatiquement une vidéo verticale **MP4 (1080 × 1920)** par soirée, à partir de l'affiche animée. Aucun tournage, aucun enregistrement d'écran : le script rend l'animation dans un navigateur sans interface (Puppeteer), capture les images et les assemble avec ffmpeg.

## Contenu du dossier

- `template.html` — l'affiche animée (à garder dans le même dossier).
- `soirees.json` — la configuration : la liste des soirées et les champs communs.
- `generate.js` — le script de génération.
- `package.json` — la dépendance (Puppeteer).

## Prérequis (à installer une seule fois)

1. **Node.js 18 ou plus** — https://nodejs.org
2. **ffmpeg** — sur Mac : `brew install ffmpeg` (sinon https://ffmpeg.org).
3. Dans ce dossier, installez Puppeteer (télécharge un Chromium dédié) :
   ```bash
   npm install
   ```

## Générer les vidéos

```bash
node generate.js
```

Les fichiers apparaissent dans le sous-dossier **`out/`** :
`reel_21_juillet.mp4`, `reel_28_juillet.mp4`, `reel_13_aout.mp4`.

> Remarque : la police Archivo est chargée depuis Google Fonts, une connexion Internet est donc nécessaire au lancement.

## Personnaliser

Tout se passe dans **`soirees.json`** :

- `fps` (par défaut 30), `duration` en secondes (par défaut 8), `scale` (2 = rendu plus net).
- Bloc `common` : les champs identiques à toutes les soirées (titre, sous-titre, tarifs, lien, e-mail).
- Tableau `soirees` : une entrée par vidéo, avec `out` (nom du fichier), `day`, `mo`, `a1`, `a2`, `gen`,
  `accent` (couleur de la pastille) et `discink` (couleur du texte de la pastille : `#fff` ou `#2E1F16`).

Ajouter une soirée = ajouter un objet dans `soirees`. Réutilisable pour les prochaines saisons ou d'autres événements.

Le texte accepte un peu de HTML simple (`<b>…</b>`, `&amp;`, `&nbsp;`), comme dans l'exemple des tarifs.

## Aller plus loin

- **Musique** : ces MP4 sont muets. Ajoutez une musique libre de droits dans Canva, CapCut ou directement à la publication sur Instagram/Facebook.
- **Automatisation** : le script peut tourner dans une **GitHub Action** (runner avec Node + ffmpeg) pour régénérer les vidéos à chaque modification de `soirees.json`.
- **Qualité** : passez `scale` à 3 pour un rendu encore plus net (fichiers plus lourds, génération plus lente).
