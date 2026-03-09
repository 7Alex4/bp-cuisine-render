# Blender Ambience v1 — Plan d'attaque

> Audit réalisé sur les fichiers sources + package réel `.data/studio/blender-packages/*/rev-10.json`.
> Objectif : rendu d'ambiance vendeur en ~10 min opérateur, sans dérive.

---

## État actuel

### Ce que le pipeline produit

- Géométrie : cubes Blender primitifs pour tout — murs, sol, plafond, modules, plans de travail, ouvertures
- Matériaux : couleur plate + Principled BSDF par kind (floor/wall/module/worktop/opening/ceiling)
- Éclairage : 1 area light au plafond (500 W/m² × surface) + 1 sun light, angle fixe
- Caméra : 1 angle, TrackTo constraint, preset auto (balanced/hero/wide/island)
- Color management : Filmic uniquement
- Fond de monde : couleur plate hex (ex. `#f4eee6`) via nœud Background — pas de ciel
- Échantillons : 96 express / 192 refined — **aucun débruiteur**
- Sortie : 1 image `final.png` par rendu

### Ce que le package réel contient (rev-10.json)

```
room: 6.0m × 3.4m × 2.5m
meshes: 10 maillages — wall/floor/ceiling/opening uniquement (0 module dans ce projet)
camera: position auto, fov=58 (wide)
renderPreset: refined · warm-showroom · 192 samples · 2200×1466
éclairage: areaColor=#fff4e3, sunColor=#ffe9c7, areaEnergyMultiplier=1.18
```

---

## Ce qui casse l'effet ambiance

**Classement par gravité.**

### 1. Fond de monde = couleur plate (critique)

`configure_render()` affecte un nœud Background avec une couleur hex et une intensité fixe à 0.8.
Il n'y a **aucun ciel, aucune lumière d'ambiance globale, aucun bounce venant de l'extérieur**.
La lumière ne vient que d'en haut et d'une direction fixe. Le résultat est plat, clinique, salle blanche.

Un `ShaderNodeTexSky` Nishita avec azimuth orienté vers une fenêtre est la correction la plus rentable
visuellement. Il n'a pas besoin de fichier HDRI externe, il est intégré dans Blender.

### 2. Aucun débruiteur (critique pour la vitesse)

96 samples sans OIDN = rendu bruité en ~8-15 min selon le CPU.
192 samples sans OIDN = rendu propre mais ~25-40 min.
**Avec OIDN : 48-64 samples donnent un résultat propre en ~4-6 min.**
Ce point débloque complètement le "10 min opérateur".

### 3. Lumière à sens unique — aucun accent chaud (fort)

1 area plafond + 1 sun = éclairage de bureau. Pas de chaleur, pas de direction vendeur.
Il manque une lumière d'accent secondaire : spot chaud positionné en coin de plafond côté fenêtre,
pour simuler spots encastrés ou lumière latérale de showroom. 10 lignes Python, impact visuel immédiat.

### 4. Sol trop mat (moyen)

`MATERIAL_PROFILES["floor"]` a `roughness=0.65` — quasi satin mat.
Un parquet ou béton ciré correct est autour de 0.35-0.45. À 0.65 il ne réfléchit rien,
la pièce paraît sourde.

### 5. Modules = cubes homogènes sans lecture de façade (moyen, déjà connu)

Un module cuisine = 1 cube plein, couleur unie. Pas de trace de montants, de rainures,
de poignée. Le client voit des boîtes colorées. C'est la limite la plus visible mais
la plus coûteuse à corriger : elle nécessite une nouvelle couche de géométrie dans `compiler.ts`.
**Hors scope v1.**

### 6. Pas de plan de travail différencié visuellement du sol (faible)

Le worktop a `roughness=0.12` — c'est bien. Mais il n'y a pas de "bord" visible,
pas de rebord chromé ou de légère différence d'épaisseur que l'oeil lirait.
Compensable en partie en jouant sur la couleur et en gardant le roughness actuel.

---

## Ce qu'on garde

- Architecture du package JSON — aucun changement
- `MATERIAL_PROFILES` existant — on ajuste 2 valeurs, on ne reconstruit pas
- TrackTo camera — fonctionne bien
- Presets d'ambiance existants (`warm-showroom`, `soft-daylight`, `graphite-premium`) — on enrichit leur payload
- `getRenderQualitySettings` / `getRenderAmbienceSettings` — on ajoute des champs, on ne casse pas
- `compileStudioScene` — intact, geometry non touchée en v1
- `buildBlenderRenderPackage` — ajoute seulement le passage de nouveaux champs d'ambiance

---

## Changements prioritaires

### Lot A — `render_scene.py` uniquement (impact max, aucun risque schéma)

| # | Changement | Où | Impact | Complexité |
|---|-----------|-----|--------|------------|
| A1 | **OIDN denoiser** après render | `configure_render()` | Critique — supprime le bruit, divise le temps par 3 | ~8 lignes |
| A2 | **Sky texture Nishita** à la place de Background flat | `configure_render()` | Très fort — ambiance naturelle, bounce light | ~15 lignes |
| A3 | **Spot accent chaud** en coin plafond | `create_lights()` | Fort — chaleur, direction, vendeur | ~12 lignes |
| A4 | **Floor roughness 0.65 → 0.42** | `MATERIAL_PROFILES` | Moyen — le parquet commence à réfléchir | 1 ligne |
| A5 | **Samples express : 96 → 48** | `render-presets.ts` | Critique pour la vitesse avec OIDN actif | 1 nombre |

### Lot B — enrichir les presets (risque schéma faible, gain maîtrise)

| # | Changement | Où | Impact |
|---|-----------|-----|--------|
| B1 | Ajouter `skyAzimuth`, `skyElevation`, `skyIntensity` dans `getRenderAmbienceSettings` | `render-presets.ts` + `blender.ts` | Permet d'orienter le ciel par ambiance (showroom vs jour doux) |
| B2 | Ajouter `accentLightColor`, `accentLightEnergy` dans le payload ambiance | idem | Contrôle la chaleur de l'accent par preset |
| B3 | Passer `useDenoiser: true/false` dans le renderPreset | idem | Permet de désactiver OIDN si Blender CPU cible ne l'a pas |

### Lot C — deferred, ne pas toucher v1

| Changement | Pourquoi deferred |
|-----------|-------------------|
| Géométrie façades (rainures, montants) | Nécessite nouveau type de mesh dans `compiler.ts`, tests, validation |
| Multi-caméra (3 angles par rendu) | Multiplexage output + UI pour choisir — bon impact mais périmètre large |
| HDRI externe (fichier .hdr) | Dépendance fichier externe, gestion path, pas nécessaire avec sky node |
| DOF (profondeur de champ) | Microoptimisation, risque de flouter des modules en premier plan |
| Splashback comme mesh séparé | Requiert changement compiler + schéma |
| Textures procédurales (parquet, béton) | Impact fort mais complexité nodale Blender élevée, à prévoir en v2 |

---

## Risque principal

**OIDN disponibilité.**
Le débruiteur OIDN est inclus dans les builds officiels Blender ≥ 3.4 pour macOS/Linux/Windows.
Sur une machine Yves en chantier (MacBook ou PC bureau), il sera présent.
Le script doit vérifier la dispo et tomber back sur `NLM` (débruiteur natif plus lent) si absent :

```python
if hasattr(scene.cycles, 'use_denoising'):
    scene.cycles.use_denoising = True
    if hasattr(scene.cycles, 'denoiser'):
        try:
            scene.cycles.denoiser = 'OPENIMAGEDENOISE'
        except TypeError:
            scene.cycles.denoiser = 'NLM'
```

Deuxième risque : le sky Nishita n'existe qu'en Blender ≥ 3.2 (stable depuis 3.4).
Fallback immédiat : si le nœud `ShaderNodeTexSky` échoue, on retombe sur Background flat.

---

## Prompt Codex

```
Tu travailles sur le repo BP Cuisines Render.
Repo local, TypeScript/Next.js, script Blender Python.

Mission : améliorer l'effet d'ambiance du rendu Blender sans toucher à la géométrie de la scène
ni au schéma du package JSON. Seuls les fichiers suivants sont en scope :
- scripts/blender/render_scene.py
- lib/studio/render-presets.ts
- lib/server/blender.ts (ajout de champs dans le renderPreset uniquement)

Changements à implémenter dans cet ordre exact :

--- CHANGEMENT 1 : OIDN denoiser dans render_scene.py ---

Dans la fonction configure_render(bpy, render_preset, output_dir),
après avoir configuré les samples, ajoute l'activation du débruiteur :

    scene.cycles.use_denoising = True
    if hasattr(scene.cycles, 'denoiser'):
        try:
            scene.cycles.denoiser = 'OPENIMAGEDENOISE'
        except (TypeError, AttributeError):
            scene.cycles.denoiser = 'NLM'

Aucune autre modification dans configure_render.

--- CHANGEMENT 2 : Sky texture Nishita dans render_scene.py ---

Remplace dans configure_render() le bloc qui affecte la couleur du Background node
par une sky texture Nishita paramétrée depuis le renderPreset :

    Le renderPreset peut contenir un champ optionnel "sky" avec les clés :
    { "azimuth": float (degrés), "elevation": float (degrés), "intensity": float }
    Si absent, utiliser les valeurs par défaut : azimuth=205, elevation=32, intensity=0.6

    Code Python à produire :
    world = scene.world or bpy.data.worlds.new('StudioWorld')
    scene.world = world
    world.use_nodes = True
    nodes = world.node_tree.nodes
    links = world.node_tree.links
    nodes.clear()
    sky_node = nodes.new('ShaderNodeTexSky')
    sky_node.sky_type = 'NISHITA'
    bg_node = nodes.new('ShaderNodeBackground')
    out_node = nodes.new('ShaderNodeOutputWorld')
    links.new(sky_node.outputs['Color'], bg_node.inputs['Color'])
    links.new(bg_node.outputs['Background'], out_node.inputs['Surface'])
    sky_cfg = render_preset.get('sky', {})
    sky_node.sun_elevation = math.radians(sky_cfg.get('elevation', 32))
    sky_node.sun_rotation = math.radians(sky_cfg.get('azimuth', 205))
    bg_node.inputs['Strength'].default_value = sky_cfg.get('intensity', 0.6)

    Entoure le tout d'un try/except : si ShaderNodeTexSky échoue (ancienne version Blender),
    tomber back sur le Background flat existant avec la couleur backgroundColor du preset.

--- CHANGEMENT 3 : Spot accent chaud dans create_lights() ---

Dans create_lights(bpy, room, render_preset),
après avoir créé l'area light et le sun, ajouter un troisième spot d'accent :

    Les paramètres viennent du renderPreset sous la clé optionnelle "accent" :
    { "color": "#ffd090", "energy": 180, "spotSize": 45 }
    Si absent, utiliser ces valeurs par défaut.

    Positionner le spot à :
    x = width * 0.55, y (blender Z) = height * 0.92, z (blender Y) = depth * 0.38
    (coin plafond côté fenêtre attendue, vise vers le centre bas de la scène)

    Code Python à produire :
    accent_cfg = render_preset.get('lighting', {}).get('accent', {})
    accent_color_hex = accent_cfg.get('color', '#ffd090')
    accent_energy = accent_cfg.get('energy', 180)
    accent_spot_size = math.radians(accent_cfg.get('spotSize', 45))
    bpy.ops.object.light_add(type='SPOT',
        location=(width * 0.55, depth * 0.38, height * 0.92))
    accent = bpy.context.active_object
    accent.rotation_euler = (math.radians(55), 0.0, math.radians(-25))
    accent.data.energy = accent_energy
    accent.data.spot_size = accent_spot_size
    accent.data.spot_blend = 0.4
    accent.data.color = hex_to_linear(accent_color_hex)

--- CHANGEMENT 4 : Floor roughness dans MATERIAL_PROFILES ---

Dans render_scene.py, modifier MATERIAL_PROFILES :
    "floor": {"roughness": 0.42, "metallic": 0.00, "transmission": 0.00}
(était 0.65)

--- CHANGEMENT 5 : Samples express dans render-presets.ts ---

Dans getRenderQualitySettings(), pour le preset express (bloc else/default) :
    samples: 48  (était 96)

Ne pas toucher le preset refined.

--- CHANGEMENT 6 : Enrichir les presets d'ambiance dans render-presets.ts ---

Dans getRenderAmbienceSettings(), ajouter les champs suivants dans chaque preset retourné :
    sky: { azimuth: number, elevation: number, intensity: number }
    accent: { color: string, energy: number, spotSize: number }  (spotSize en degrés)

Valeurs par preset :

warm-showroom:
    sky: { azimuth: 195, elevation: 28, intensity: 0.55 }
    accent: { color: '#ffd090', energy: 220, spotSize: 42 }

graphite-premium:
    sky: { azimuth: 210, elevation: 22, intensity: 0.38 }
    accent: { color: '#ffe0b0', energy: 160, spotSize: 38 }

soft-daylight (défaut) :
    sky: { azimuth: 185, elevation: 38, intensity: 0.72 }
    accent: { color: '#fff0d0', energy: 140, spotSize: 50 }

Mettre à jour le type de retour de la fonction pour inclure ces champs.

--- CHANGEMENT 7 : Passer sky et accent dans buildBlenderRenderPackage dans blender.ts ---

Dans buildBlenderRenderPackage(), dans l'objet renderPreset retourné,
ajouter les champs "sky" et "accent" issus de ambience :

    sky: ambience.sky,
    accent: { ...ambience.accent },  // dans la clé lighting

La clé lighting devient :
    lighting: {
      areaEnergyMultiplier: ambience.areaEnergyMultiplier,
      areaColor: ambience.areaColor,
      sunEnergy: ambience.sunEnergy,
      sunColor: ambience.sunColor,
      accent: ambience.accent,
    },

Et ajouter au même niveau que lighting :
    sky: ambience.sky,

--- CONTRAINTES ---

- Ne pas modifier lib/studio/compiler.ts
- Ne pas modifier lib/studio/schema.ts
- Ne pas modifier lib/studio/catalog.ts
- Ne pas modifier de fichiers UI
- Ne pas créer de nouveaux fichiers
- Aucune dépendance externe (pas de fichier HDRI, pas de bibliothèque Python additionnelle)
- Tous les tests doivent passer : npm test (vitest)
- Le build TypeScript doit être propre : npm run build
- Pas de any implicite TypeScript
- Respecter le style du code existant (pas de console.log, pas de commentaires superflus)
```

---

## Résumé exécutif

Le pipeline actuel est solide architecturalement. La scène est déterministe, le package est propre, les presets sont en place. Ce qui manque pour le vendeur, c'est uniquement dans le script Python :

1. **OIDN** → le rendu express devient faisable en ~4-6 min
2. **Sky Nishita** → la lumière devient naturelle et chaleureuse
3. **Spot accent** → la cuisine a une direction, un caractère
4. **Floor roughness ajusté** → le sol respire

Ces 4 points = un rendu montrable au client, sans toucher à la géométrie, sans ML, sans refonte.
