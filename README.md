# Planning

Site statique (HTML, CSS, JavaScript) qui affiche aujourd'hui + 4 jours.
Les données sont dans `data.json`. Chaque modification est enregistrée dans ce fichier sur GitHub, ce qui permet de retrouver le même planning sur le téléphone et l'ordinateur.

## Mise en place

1. Crée un dépôt GitHub (par exemple `planning`) et envoie-y les fichiers : `index.html`, `style.css`, `app.js`, `data.json`.
2. Ouvre `app.js` et remplace `owner` et `repo` dans `CONFIG` par ton pseudo GitHub et le nom du dépôt.
3. Active GitHub Pages : dans le dépôt, *Settings → Pages → Deploy from a branch → main / (root)*. Le site sera disponible à `https://TON_PSEUDO.github.io/planning/`.
4. Crée un token d'accès : *GitHub → Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token*.
   - Repository access : *Only select repositories*, puis ton dépôt `planning`.
   - Permissions : *Repository permissions → Contents → Read and write*.
   - Copie le token (il commence par `github_pat_`).
5. Ouvre le site, clique sur ⚙, colle le token et valide. Répète sur ton téléphone.

## Utilisation

- **Ajouter** : bouton « + Ajouter » en haut à droite. Pour une vignette de la catégorie École, choisis l'importance.
- **Fait** : la case en bas à droite de la vignette la grise.
- **Détails** : clique sur une vignette pour modifier le nom, la description, la date ou l'importance, ou pour la supprimer.
- **Importance des examens (École)** :
  - faible : affiché le jour J seulement ;
  - moyenne : affiché les jours J, J-1 et J-2 ;
  - extrême : affiché les jours J, J-1 et J-2, et un petit rappel en bas de chaque jour jusqu'à J.

## Modifier le planning type

Les vignettes Course, Muscu et Étirements sont créées automatiquement chaque jour à partir de `data.json` :

- `byWeekday` : les activités par jour de la semaine. `0` = dimanche, `1` = lundi, … `6` = samedi.
- `daily` : les activités de chaque jour (actuellement les étirements).

Une vignette supprimée d'un jour ne réapparaît pas ce jour-là.

## Bon à savoir

- **Sans token**, le site fonctionne mais les données restent dans le navigateur de l'appareil (pas de synchronisation).
- **Dépôt public** : GitHub Pages gratuit impose un dépôt public. Le fichier `data.json` est alors lisible par quiconque connaît son adresse, et le site affiche le planning à qui l'ouvre sans token. Le token, lui, n'est jamais dans le dépôt : il reste dans le navigateur de chaque appareil.
- **Sécurité du token** : ne le partage pas. Un token « fine-grained » limité à ce seul dépôt ne peut rien faire d'autre.
- Chaque modification crée un commit (`Mise à jour du planning`), donc tu gardes l'historique de ton planning.
- Pour sauvegarder hors GitHub : ⚙ → *Exporter*.
