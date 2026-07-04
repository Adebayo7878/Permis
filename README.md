# Code de la Route — Bénin

Site statique déployable en un clic (aucune compilation nécessaire).

## Structure des fichiers

- `index.html` — page principale, charge les autres fichiers
- `style.css` — tous les styles (thème asphalte/signalisation)
- `questions.js` — banque de questions (QCM + sujets officiels)
- `signs.js` — images des panneaux routiers (en base64)
- `app.js` — logique de l'application (quiz, navigation, résultats)

## Déploiement

Ce dossier est 100% statique : il suffit de l'héberger tel quel.

- **Netlify / Vercel** : glisser-déposer le dossier dans l'interface de déploiement
- **GitHub Pages** : pousser le contenu du dossier dans un dépôt puis activer Pages
- **Local** : ouvrir simplement `index.html` dans un navigateur (ou lancer un petit serveur, ex. `npx serve .`)

Aucune dépendance, aucun build step, aucune variable d'environnement requise.
