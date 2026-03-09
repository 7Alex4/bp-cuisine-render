# Process relevé chantier — Opérateur Yves

Ce document décrit le protocole de relevé terrain que l'opérateur Yves suit pour chaque projet cuisine BP Cuisines. Il couvre l'ordre des étapes, ce qui est obligatoire ou optionnel, ce qui bloque un rendu Blender, et ce qui suffit pour générer une preview 3D.

---

## Vue d'ensemble du flux

```
[1] Dimensions pièce
[2] Sous-hauteurs utiles
[3] Ouvertures (portes, fenêtres)
[4] Contraintes techniques (eau, gaz, électricité)
[5] Équipements souhaités par le client
[6] Préférences finition
[7] Références visuelles + checklist finale
```

Le score de complétude (0–100 %) est affiché en temps réel dans le Studio. Le statut passe automatiquement à **Prêt** (vert) dès que le score dépasse 80 % et qu'aucune erreur bloquante n'est détectée.

---

## Étape 1 — Dimensions de la pièce

**Obligatoire. Bloque le rendu si absente ou incohérente.**

| Champ | Unité | Contraintes |
|-------|-------|-------------|
| Largeur (`width`) | mètres | > 0, idéalement ≥ 2 m |
| Profondeur (`depth`) | mètres | > 0, idéalement ≥ 2 m |
| Hauteur sous plafond (`height`) | mètres | > 0, idéalement ≥ 2,2 m |

Ces valeurs alimentent la géométrie canonique de la scène. Si elles divergent de la scène canonique (tolérance 2 cm), un warning de divergence est levé dans la Validation.

---

## Étape 2 — Sous-hauteurs utiles

**Obligatoire. Bloque le rendu si absente.**

Mesurer au minimum la hauteur utile de la pièce entière (`full-room`). Ajouter des relevés par mur si la pièce est irrégulière ou si des obstacles réduisent la hauteur disponible (poutres, gaines, rebords de fenêtre).

| Cible | Quand la renseigner |
|-------|---------------------|
| `full-room` | Toujours (hauteur nominale) |
| `north`, `east`, `south`, `west` | Si hauteur utile différente d'un mur à l'autre |

Chaque valeur doit être strictement positive et inférieure ou égale à la hauteur de la pièce.

---

## Étape 3 — Ouvertures (portes et fenêtres)

**Obligatoire. Bloque le rendu si absente ou géométriquement incohérente.**

Pour chaque ouverture :

| Champ | Description |
|-------|-------------|
| `name` | Label libre (ex. "Fenêtre façade") |
| `wall` | Mur d'ancrage : `north`, `east`, `south`, `west` |
| `kind` | `door` ou `window` |
| `offset` | Distance depuis l'angle gauche du mur (m) |
| `width` | Largeur de l'ouverture (m) |
| `height` | Hauteur de l'ouverture (m) |
| `baseHeight` | Allège (m) — 0 pour une porte standard |

**Contrôles automatiques :**
- `offset + width` ne doit pas dépasser la longueur du mur
- `baseHeight + height` ne doit pas dépasser la hauteur de la pièce
- Une porte avec `baseHeight > 0,05 m` génère un warning (allège non standard)

Les ouvertures du relevé sont synchronisées avec la scène canonique : les IDs doivent correspondre pour éviter les warnings de divergence.

---

## Étape 4 — Contraintes techniques

**Partiellement obligatoire selon les équipements sélectionnés à l'étape 5.**

| Champ | Valeurs possibles | Obligation |
|-------|-------------------|------------|
| `waterSupplyWall` | `north` / `east` / `south` / `west` / `unknown` | Obligatoire si évier requis |
| `drainWall` | idem | Obligatoire si évier requis |
| `hoodMode` | `evacuation` / `recycling` / `unknown` | Recommandé si hotte requise |
| `dedicatedCircuitAvailable` | `true` / `false` | Obligatoire si plaque requise sans gaz |
| `gasSupplyAvailable` | `true` / `false` | Alternatif au circuit dédié pour la plaque |

Si l'évier est marqué "requis" à l'étape 5 mais que `waterSupplyWall` ou `drainWall` reste `unknown`, une **erreur bloquante** est levée.

---

## Étape 5 — Équipements souhaités

**Obligatoire. Bloque le rendu si aucun équipement n'est marqué comme requis.**

Équipements disponibles : `sink`, `hob`, `oven`, `fridge`, `dishwasher`, `hood`

Pour chaque équipement :
- `type` : identifiant technique
- `required` : `true` si le client en a impérativement besoin
- `quantity` : entier ≥ 1 (si `required: true`)
- `notes` : commentaire libre (optionnel)

Au moins un équipement doit être `required: true` avec `quantity ≥ 1` pour que cette section soit considérée complète.

---

## Étape 6 — Préférences finition

**Recommandé. Contribue au score de complétude (1 check sur 7).**

| Champ | Description | Obligatoire pour le score |
|-------|-------------|--------------------------|
| `frontsColor` | Couleur/finition des façades | Oui |
| `worktopColor` | Couleur/finition du plan de travail | Oui |
| `splashbackColor` | Couleur/finition de la crédence | Non |
| `handleStyle` | Style de poignée (ou "sans poignée") | Oui |
| `applianceFinish` | Finition des électroménagers | Non |

Les trois champs marqués "Oui" doivent être non vides pour que la check de finition soit validée. Ces valeurs sont des chaînes libres — elles alimenteront le futur catalogue de matériaux.

---

## Étape 7 — Références visuelles + checklist finale

**Recommandé. Contribue au score de complétude (2 checks sur 7).**

### Références visuelles

| Champ | Recommandation |
|-------|----------------|
| `sketchProvided` | Idéalement `true` — plan de référence ou croquis annoté |
| `roomPhotosProvided` | `true` si au moins une photo disponible |
| `roomPhotoCount` | Minimum 2 recommandé |
| `floorPhotoProvided` | `true` pour le futur matching texture sol |
| `ceilingPhotoProvided` | `true` pour valider les hauteurs et gaines |
| `fullWallSetProvided` | `true` si toutes les faces de mur sont couvertes |

Pour que la check "références visuelles" soit validée : `roomPhotosProvided: true`, `roomPhotoCount ≥ 2`, `floorPhotoProvided: true`, `ceilingPhotoProvided: true`, `fullWallSetProvided: true`.

### Checklist opérateur

7 cases à cocher par Yves en fin de relevé :

| Case | Ce qu'elle valide |
|------|-------------------|
| `dimensionsVerified` | Dimensions re-mesurées et confirmées |
| `heightsVerified` | Sous-hauteurs contrôlées |
| `openingsVerified` | Ouvertures cohérentes avec le plan |
| `technicalVerified` | Contraintes techniques vérifiées sur place |
| `clientNeedsVerified` | Besoins client confirmés oralement |
| `finishesVerified` | Préférences de finition validées avec le client |
| `photosVerified` | Photos téléchargées et exploitables |

Toutes les cases doivent être cochées pour que la checklist contribue positivement au score.

---

## Récapitulatif : ce qui bloque le rendu Blender

Le bouton **Lancer rendu Blender** est désactivé tant que `completeness.status !== 'pret'`.

Causes bloquantes (erreurs dures) :
1. Dimensions manquantes ou nulles
2. Sous-hauteurs manquantes ou supérieures à la hauteur de la pièce
3. Ouverture géométriquement incohérente (dépasse le mur ou la hauteur)
4. Évier requis sans mur d'alimentation/évacuation renseigné
5. Plaque requise sans circuit dédié ni gaz

Score < 80 % sans erreurs → statut `incomplet` → rendu également bloqué.

---

## Ce qui suffit pour une preview 3D

La preview Three.js (onglet "Preview 3D three.js") est générée en continu, indépendamment du score de complétude. Elle est disponible dès qu'une scène existe, même vide.

Le **package Blender** (bouton "Générer package Blender") peut être généré à tout moment pour inspection, mais le **rendu final** nécessite `status === 'pret'`.

---

## Flux de statut projet

```
draft  →  (survey complété)  →  ready
ready  →  (rendu lancé)      →  rendering
rendering → (rendu terminé)  →  ready
rendering → (erreur rendu)   →  draft
```

Le statut est dérivé du champ `completeness.status` stocké dans la scène au moment de la sauvegarde. Il est mis à jour lors de chaque appel à "Sauvegarder une révision".
