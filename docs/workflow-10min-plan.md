# Plan workflow 10 minutes — Premier rendu opérateur Yves

---

## Objectif réel

Yves sort d'un rendez-vous terrain avec ses mesures, ses photos et un croquis.
Il doit pouvoir montrer quelque chose de crédible au client dans la même journée.
Pas un rendu contractuel. Un volume, une implantation, une ambiance couleur.
Le critère est simple : est-ce que ça ressemble à leur cuisine, dans leur pièce ?

---

## Workflow minimal 10 minutes

| Étape | Action | Temps |
|-------|--------|-------|
| 1 | Créer le projet, nommer "NomClient – date" | 30 s |
| 2 | Saisir largeur, profondeur, hauteur | 45 s |
| 3 | Ajouter une sous-hauteur "Hauteur utile pièce" = hauteur plafond | 30 s |
| 4 | Ajouter les ouvertures (1 porte, 1 fenêtre minimum) | 90 s |
| 5 | Cocher évier + plaque comme "requis", saisir eau/évac si évier | 45 s |
| 6 | Choisir un preset d'implantation (L, linéaire, U) et ajuster les offsets | 90 s |
| 7 | Sélectionner couleur façades, PDT, poignée (texte libre) | 30 s |
| 8 | Uploader 2 photos terrain (le minimum pour débloquer le statut) | 60 s |
| 9 | Cocher la checklist (7 cases) | 30 s |
| 10 | Sauvegarder + Lancer rendu Blender | 30 s |

**Total estimé : 8–10 minutes si les mesures sont déjà notées.**

---

## Obligatoire maintenant

Ces points bloquent le rendu Blender (`surveyStage === 'pret'`). Sans eux, le bouton est grisé.

**Géométrie (erreurs dures) :**
- Largeur, profondeur, hauteur > 0
- Au moins 1 sous-hauteur valide (≤ hauteur pièce)
- Au moins 1 ouverture géométriquement cohérente (offset + largeur ≤ longueur mur)

**Équipements et contraintes :**
- Au moins 1 équipement marqué "requis" avec quantité ≥ 1
- Si évier requis : mur eau + mur évacuation ≠ "unknown"
- Si plaque requise : circuit dédié OU gaz = true

**Finitions :**
- Couleur façades non vide
- Couleur plan de travail non vide
- Style poignée non vide

**Références visuelles (pour `pret`, pas `suffisant`) :**
- `roomPhotosProvided: true`
- `roomPhotoCount ≥ 2`
- `floorPhotoProvided: true`
- `ceilingPhotoProvided: true`
- `fullWallSetProvided: true`

**Checklist :**
- Les 7 cases cochées (dont `photosVerified` qui dépend des photos ci-dessus)

**Note importante :** Le statut `suffisant` (preview Three.js + package Blender possible) est atteignable sans photos ni checklist. Pour le rendu Blender final, les photos et la checklist sont obligatoires.

---

## À repousser

Ces éléments n'ont aucun impact sur la qualité du premier rendu. Yves peut les ignorer.

| Élément | Pourquoi le repousser |
|---------|----------------------|
| Camera match (Cam X/Y/Z, Target, FOV, Lens shift) | Utilisé uniquement pour le matching photo avancé. Valeurs par défaut suffisantes pour un premier rendu. |
| Croquis uploadé | Le croquis valide `sketchProvided` mais ne bloque pas le rendu. |
| Catégorisation des photos (mur-nord, sol, plafond…) | Utile pour le dossier visuel, pas pour le rendu. Les booléens suffisent. |
| Notes de relevé terrain | Utile pour archiver, pas pour le rendu. |
| Étude des finitions catalogue | Futur. Les champs texte libres suffisent. |
| Dossier visuel score | Métrique de suivi, pas un bloquant rendu. |

---

## Freins actuels

**1. Pas de preset d'implantation.**
Yves ajoute chaque module un par un depuis le catalogue et saisit l'offset manuellement pour chaque.
Pour une cuisine en L de 5 modules, ça représente 15 saisies numériques. C'est le principal frein.

**2. Sous-hauteurs non pré-remplies.**
Le projet vide (`createBlankStudioScene`) démarre avec zéro sous-hauteur et des dimensions à 0.
Yves doit d'abord saisir les dimensions, puis cliquer "Ajouter une mesure" et choisir la cible.
Un seul champ pré-rempli à la valeur de la hauteur saisie éviterait cette friction.

**3. Double saisie des ouvertures.**
Les ouvertures existent dans le `StudioFormPanel` ("Pièce et ouvertures") ET dans le `SiteSurveyPanel` (étape 2).
Elles sont bien synchronisées en code (`withSurveyOpenings`), mais l'UI les montre deux fois.
Yves ne sait pas dans quel panel saisir.

**4. La section caméra match est visible par défaut.**
9 champs numériques (Cam X/Y/Z, Target X/Y/Z, FOV, Lens shift X/Y) sont affichés dans le `StudioFormPanel`.
La checkbox "Activer camera match photo" est décochée par défaut, mais les 9 champs restent visibles.
Pour Yves, c'est 9 champs incompréhensibles sur un panel qu'il doit utiliser.

**5. La checklist est monolithique.**
7 cases dont `photosVerified` bloquent le statut `pret`.
Si Yves a uploadé 2 photos mais oublié de cocher `ceilingPhotoProvided`, le statut reste `a_verifier`.
Il n'y a pas de retour visuel clair sur ce qui manque exactement dans les cases.

**6. Le bouton "Lancer rendu Blender" est grisé sans message explicatif immédiat.**
L'action suivante est affichée dans un banner en bas du header, mais pas directement sur le bouton.
Yves doit faire défiler pour comprendre pourquoi le bouton est inactif.

---

## Presets rapides recommandés

3 presets suffisent pour 80 % des projets BP Cuisines.
Chaque preset = liste de modules + murs + offsets calculés depuis la pièce.

### Preset 1 — Linéaire (mur nord)
Adapté aux cuisines longues, étroites.
```
[bas-évier-900]   mur nord, offset 0.30
[bas-plaque-900]  mur nord, offset 1.25
[colonne-four]    mur nord, offset 2.20
[meuble-haut-900] mur nord, offset 0.30
```

### Preset 2 — En L (nord + ouest)
Le plus courant. Adapté aux pièces carrées.
```
[bas-évier-900]   mur nord, offset 0.30
[bas-plaque-900]  mur nord, offset 1.25
[meuble-haut-900] mur nord, offset 0.30
[colonne-four]    mur ouest, offset 0.30
[bas-complément]  mur ouest, offset 1.25
```

### Preset 3 — En U (nord + ouest + est)
Cuisines spacieuses, souvent avec îlot.
```
[bas-évier-900]   mur nord, offset 0.30
[bas-plaque-900]  mur nord, offset 1.25
[meuble-haut-900] mur nord, offset 0.30
[colonne-four]    mur ouest, offset 0.30
[bas-complément]  mur est, offset 0.30
[îlot-1800]       centre pièce, x=0, z=0
```

**Règle de calcul offset automatique :**
Chaque module suivant sur le même mur = `offset_précédent + largeur_précédente + 0.05 m` (joint).

---

## Defaults recommandés

Actuellement, `createBlankStudioScene` démarre avec dimensions = 0 et zéro sous-hauteur.
Voici les defaults qui feraient gagner 2 minutes à Yves :

| Champ | Valeur actuelle | Default recommandé |
|-------|----------------|-------------------|
| `room.width` | 0 | 4.00 m |
| `room.depth` | 0 | 2.80 m |
| `room.height` | 0 | 2.50 m |
| `usefulHeights` | [] | [{ label: "Hauteur utile pièce", target: "full-room", height: 2.50 }] |
| `desiredEquipment` | [] | évier (required, qty 1) + plaque (required, qty 1) |
| `technicalConstraints.waterSupplyWall` | "unknown" | "north" |
| `technicalConstraints.drainWall` | "unknown" | "north" |
| `technicalConstraints.dedicatedCircuitAvailable` | false | true |
| `materials.fronts` | preset actuel | `fronts-matte-white` |
| `materials.worktop` | preset actuel | `worktop-quartz-ivory` |

---

## Prompt Codex

```
Objectif : réduire le temps de premier rendu de 10 minutes à 5 minutes pour Yves.

Fichier principal : lib/studio/catalog.ts
Fichiers concernés : lib/studio/catalog.ts, tests/studio.test.ts

Tâche 1 — Améliorer createBlankStudioScene
Modifier createBlankStudioScene pour préremplir :
- room = { width: 4.00, depth: 2.80, height: 2.50, wallThickness: 0.12 }
- usefulHeights = [{ id: crypto.randomUUID(), label: 'Hauteur utile pièce', target: 'full-room', height: 2.50 }]
- desiredEquipment = [
    { type: 'sink', required: true, quantity: 1 },
    { type: 'hob', required: true, quantity: 1 },
  ]
- technicalConstraints.waterSupplyWall = 'north'
- technicalConstraints.drainWall = 'north'
- technicalConstraints.dedicatedCircuitAvailable = true
Ne pas modifier createDefaultStudioScene (utilisé par les tests existants).
Mettre à jour les tests qui assertent created.scene.modules.length === 0 ou
created.scene.siteSurvey.completeness.status === 'bloquant'
si les nouveaux defaults changent le statut attendu.

Tâche 2 — Ajouter 3 fonctions de preset d'implantation dans catalog.ts
Ajouter et exporter :
  applyPresetLineaire(scene: StudioScene): StudioScene
  applyPresetEnL(scene: StudioScene): StudioScene
  applyPresetEnU(scene: StudioScene): StudioScene

Chaque fonction repart des dimensions de la pièce existante (scene.room)
et remplace scene.modules par une liste de modules correctement positionnés.
Les offsets sont calculés dynamiquement depuis scene.room.width et scene.room.depth.
La liste des templates utilisés : base-sink-900, base-hob-900, tall-oven-600,
wall-cab-900, island-1800, fridge-tall-600.

Contrainte : les fonctions ne modifient rien d'autre que scene.modules.
Contrainte : npm test et npm run build doivent passer avant merge.

Tâche 3 — Ajouter les tests correspondants dans tests/studio.test.ts
  it('applyPresetLineaire places modules on the north wall without overflow')
  it('applyPresetEnL uses north and west walls')
  it('applyPresetEnU uses north, west and east walls')
Chaque test vérifie : aucun module ne dépasse son mur (offset + width ≤ wall length).
```
