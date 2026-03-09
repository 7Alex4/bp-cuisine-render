# Plan rendu express — BP Cuisines

> Objectif : premier rendu d'ambiance vendeur en moins de 10 minutes de travail Yves.
> Périmètre : pipeline `relevé → scène canonique → Blender`. Pas d'IA. Pas de refonte.

---

## Etat actuel

### Pipeline opérationnel

```
StudioScene
  ↓ compileStudioScene()         compiler.ts
  ↓ buildBlenderRenderPackage()  blender.ts  →  rev-N.json
  ↓ Blender -b -P render_scene.py -- rev-N.json output_dir/
  ↓ final.png
```

### Ce qui existe et tourne

| Composant | Etat |
|-----------|------|
| Géométrie (boîtes) | ✅ Floor, ceiling, 4 murs segmentés, modules, worktops |
| Matériaux Principled BSDF | ✅ Par kind : floor/wall/module/worktop/opening (Étape 6) |
| Éclairage | ✅ Area light calibré à la pièce + sun directional |
| Caméra | ✅ TrackTo constraint, position auto depuis dimensions room |
| Déclenchement | ✅ Bouton "Lancer rendu Blender" → API → spawn Blender |
| Sortie | ✅ `final.png` 2400×1600 en `/blender-renders/[id]/rev-N/` |

### Preset actuel

```
Engine : CYCLES
Samples : 256
Output : 2400 × 1600 px, PNG
Color management : Filmic
Denoiser : aucun
Caméra : 1 angle unique, 3/4 SE automatique
Ambiance : 1 seule (neutre)
```

### Temps de rendu estimé sur machine terrain (pas de GPU dédié)

| Contexte | Temps estimé |
|----------|-------------|
| CPU moderne (M3, Ryzen 7) | 12 – 20 min |
| CPU entrée de gamme (i5, M1) | 20 – 35 min |
| GPU NVIDIA RTX / AMD | 2 – 5 min |

**256 samples sans dénoiser sur CPU = trop lent pour une démo client sur place.**

---

## Bottlenecks

### B1 — 256 samples sans dénoiser (bloquant, priorité 1)

Le dénoiser OIDN (Intel Open Image Denoise) est intégré à Blender depuis la v3.0.
Il supprime 80% du bruit visuel en fin de rendu pour un coût CPU de ~20–40 secondes.
Résultat : 64–96 samples + OIDN ≈ visuel de 256 samples, 3–4× plus rapide.

**Sans ce changement, le preset "express" est impossible sur CPU.**

### B2 — Une seule caméra, un seul rendu

Yves ne peut montrer qu'une vue. Trois vues différentes (entrée, façades, coin de travail)
transforment la présentation client sans ajouter de temps opérateur.
Blender peut boucler sur N caméras dans le même script Python, un seul appel.

### B3 — Aucun environnement world / HDRI

L'éclairage actuel (area + sun) produit des ombres dures et une lumière non naturelle.
Un world shader neutre (background gris clair ou HDRI studio) ajoute des inter-réflexions
réalistes sans effort. La pièce "respire" visuellement.

### B4 — Matériaux sans variation de brillance suffisante

Les facades cuisine et le plan de travail ont besoin d'un écart de roughness plus marqué
pour être lisibles en rendu final. Actuellement worktop à 0.12 (bien) mais module à 0.28
peut encore descendre à 0.20 pour laque satiné visible.
Ce n'est pas bloquant mais change la lisibilité en 30 secondes de code.

### B5 — Preset samples/taille unique, non configurable depuis l'UI

Il n'y a aucun moyen pour Yves de choisir "vite mais potable" vs "beau pour le devis".
Les deux presets doivent exister dans `blender.ts` et être sélectionnables au déclenchement.

---

## Changements prioritaires

Classés par ratio **impact visuel / effort d'implémentation**.

### 1 — Activer OIDN + réduire samples (priorité absolue)

**Où** : `render_scene.py`, fonction `configure_render()` + section compositor.
**Quoi** : activer le denoiser Cycles (view_layer) + noeud compositing Denoise.
**Gain** : rendu express 64s → 5 min sur CPU. Qualité quasi-identique à 256s.

```python
# Dans configure_render(), après scene.cycles.samples = ... :
scene.cycles.use_denoising = True
scene.cycles.denoiser = 'OPENIMAGEDENOISE'   # fallback: 'NLM'
```

Pour le compositing (améliore encore le résultat) :
```python
scene.use_nodes = True
tree = scene.node_tree
# Ajouter nœud Denoise entre RenderLayers et Composite
denoise = tree.nodes.new('CompositorNodeDenoise')
denoise.use_hdr = True
# Câbler render_layers → denoise → composite
```

### 2 — 3 caméras fixes par rendu (multi-angle automatique)

**Où** : `render_scene.py` + `blender.ts` (config cameras dans renderPreset).
**Quoi** : boucler sur une liste de caméras, `scene.camera = cam`, `render.filepath = .../A01.png`.
**Gain** : 3 images pour le prix d'1.7× le temps de rendu (Blender réutilise la scène chargée).

```python
for camera_spec in package["renderPreset"]["cameras"]:
    create_or_update_camera(bpy, camera_spec)
    scene.render.filepath = os.path.join(output_dir, camera_spec["id"] + ".png")
    bpy.ops.render.render(write_still=True)
```

### 3 — World HDRI neutre (fond + inter-réflexions)

**Où** : `render_scene.py`, fonction dédiée `setup_world()`.
**Quoi** : world background gris chaud (pas de fichier HDRI requis, une couleur suffit pour commencer).
**Gain** : élimine le fond noir/transparent, ajoute de l'ambiance indirecte.

```python
def setup_world(bpy, ambiance):
    world = bpy.context.scene.world
    world.use_nodes = True
    bg = world.node_tree.nodes['Background']
    if ambiance == 'chaud':
        bg.inputs['Color'].default_value = (0.82, 0.75, 0.65, 1.0)
        bg.inputs['Strength'].default_value = 0.35
    else:  # lumineux / studio
        bg.inputs['Color'].default_value = (0.90, 0.90, 0.88, 1.0)
        bg.inputs['Strength'].default_value = 0.45
```

### 4 — Preset rapide vs vendeur dans blender.ts

**Où** : `blender.ts`, `buildBlenderRenderPackage()`.
**Quoi** : accepter un paramètre `preset: 'express' | 'full'`.

| Paramètre | Express | Full |
|-----------|---------|------|
| samples | 64 | 256 |
| width | 1920 | 2400 |
| height | 1280 | 1600 |
| cameras | 3 | 3 |
| denoiser | OIDN | OIDN |
| ambiance | lumineux | lumineux |

### 5 — Worktop specular légèrement renforcé

**Où** : `render_scene.py`, `MATERIAL_PROFILES['worktop']`.
**Quoi** : `roughness: 0.08` (au lieu de 0.12) + `metallic: 0.04`.
**Gain** : le plan de travail devient la surface "premium" visible. Aucune autre modification.

---

## Cameras recommandees

Toutes exprimées en coordonnées scène (Y=haut). La scène est centrée à l'origine.
`W` = room.width, `D` = room.depth, `H` = room.height.

### A01 — Vue client (angle vendeur principal)

```
Nom      : "Vue client"
Position : (W*0.42, H*0.48, D*1.10)
Target   : (0, H*0.40, 0)
FOV      : 52°
Usage    : vue d'entrée, montre toute la cuisine, référence pour le client
```

Correspond sensiblement à l'angle actuel (légèrement élargi). Priorité absolue.

### A02 — Angle façades

```
Nom      : "Facades"
Position : (0, H*0.52, D*0.75)
Target   : (-W*0.08, H*0.44, -D*0.15)
FOV      : 40°
Usage    : montre les matières des facades et le plan de travail de face
```

Angle frontal sur le mur principal (nord). Maximum de lisibilité matière.

### A03 — Coin de travail

```
Nom      : "Coin travail"
Position : (-W*0.62, H*0.54, D*0.80)
Target   : (-W*0.10, H*0.44, -D*0.20)
FOV      : 46°
Usage    : montre l'organisation en L ou en U, l'ilot si présent
```

### A04 — Vue debout (optionnelle, 4ème image)

```
Nom      : "Debout"
Position : (W*0.45, 1.65, D*1.15)
Target   : (0, 1.45, 0)
FOV      : 55°
Usage    : perspective humaine, émotion immédiate
```

**Pour le preset express : A01 + A02 + A03. A04 en option.**

---

## Presets d ambiance

### Ambiance 1 — Lumineux (défaut, jour)

```python
# Area light
energy = 500 * width * depth   # déjà en place
color  = (1.00, 0.98, 0.95)    # blanc légèrement chaud

# Sun
energy = 2.2
angle  = (42°, 10°, 24°)       # déjà en place

# World background
color    = (0.90, 0.90, 0.88)
strength = 0.45
```

Utilisation : journée type, exposition en showroom, présentation standard.

### Ambiance 2 — Chaud (soir / cosy)

```python
# Area light
energy = 380 * width * depth
color  = (1.00, 0.88, 0.72)    # 3200K

# Sun désactivé

# World background
color    = (0.75, 0.68, 0.58)
strength = 0.25

# Emission plafond (optionnel) : ajouter un shader Emission à ceiling mesh
# strength 0.8, color (1.0, 0.92, 0.80)
```

Utilisation : cuisine de particulier, ambiance "à la maison", vente émotionnelle.

### Ambiance 3 — Studio (présentation catalogue)

```python
# Area light unique, orientée 90° (côté)
energy = 600 * width * depth
color  = (1.00, 1.00, 1.00)    # blanc pur

# Contre-jour droit : second area light, 30% énergie, côté opposé
energy_fill = 180 * width * depth

# Sun désactivé

# World background
color    = (0.95, 0.95, 0.95)
strength = 0.55
```

Utilisation : envoi par email, intégration dans une présentation Powerpoint, devis formel.

---

## Preset Blender rapide

> Objectif : rendu acceptable en 4–6 min sur CPU moderne (M3 / Ryzen 7).
> Acceptable = propre, vendeur, montrable au client sans excuse.

```json
{
  "name": "express",
  "engine": "CYCLES",
  "samples": 64,
  "denoiser": "OPENIMAGEDENOISE",
  "output": {
    "width": 1920,
    "height": 1280,
    "format": "PNG"
  },
  "colorManagement": "AgX - Base Contrast",
  "cameras": ["A01", "A02", "A03"],
  "ambiance": "lumineux"
}
```

**Note sur AgX** : remplace Filmic depuis Blender 4.0. Consulter les looks disponibles
avec `scene.view_settings.bl_rna.properties['look'].enum_items` (déjà géré dans le code).

---

## Preset Blender vendeur

> Objectif : rendu final pour devis, email client, présentation chiffrée.
> Temps cible : 15–25 min sur CPU, 5–8 min sur GPU.

```json
{
  "name": "full",
  "engine": "CYCLES",
  "samples": 256,
  "denoiser": "OPENIMAGEDENOISE",
  "output": {
    "width": 2400,
    "height": 1600,
    "format": "PNG"
  },
  "colorManagement": "AgX - Base Contrast",
  "cameras": ["A01", "A02", "A03"],
  "ambiance": "lumineux"
}
```

---

## Ce qu il faut differer

| Fonctionnalité | Pourquoi différer |
|----------------|-------------------|
| HDRI extérieur (fichier .exr) | Complexité setup fichier, gain marginal vs world color |
| Textures procédurales (bois, marbre) | +30 min de code Python, besoin de UV mapping |
| Géométrie fine (poignées, robinets) | Nécessite import .blend ou .obj, hors scope boîte |
| Rendu volumétrique (brume, lumière rayonnante) | Coût CPU prohibitif en temps express |
| Émission lumineuse sous meubles | Agréable mais non différenciant pour une première démo |
| Rafraîchissement auto du rendu | Inutile tant que le temps de rendu > 5 min |
| Preview Blender en temps réel (EEVEE) | EEVEE Next n'est pas encore stable hors GPU |

---

## Prompt Codex

```
Tu travailles sur le repo BP Cuisines Render (Next.js / TypeScript / Python).

Objectif de cette session :
Améliorer le pipeline Blender pour qu'Yves obtienne 3 vues vendeur
en une seule exécution, en mode express (< 6 min sur CPU moderne).

Les fichiers à modifier sont :
  - scripts/blender/render_scene.py
  - lib/server/blender.ts
  - lib/studio/schema.ts  (si ajout de type pour preset/cameras)
  - app/api/studio/projects/[id]/render/route.ts  (si preset sélectionnable)

---

Tâche 1 — render_scene.py : OIDN denoiser

Dans la fonction configure_render(), après avoir défini scene.cycles.samples,
activer le denoiser natif Cycles :

  scene.cycles.use_denoising = True
  scene.cycles.denoiser = 'OPENIMAGEDENOISE'

Et activer le compositing denoiser pour un résultat encore plus propre :

  scene.use_nodes = True
  tree = scene.node_tree
  links = tree.links

  # Récupérer les nœuds existants
  render_layers = tree.nodes.get('Render Layers')
  composite = tree.nodes.get('Composite')

  if render_layers and composite:
      # Insérer un nœud Denoise
      denoise_node = tree.nodes.new('CompositorNodeDenoise')
      denoise_node.use_hdr = True
      denoise_node.location = (composite.location[0] - 220, composite.location[1])

      # Débrancher le lien direct existant Image → Composite
      for link in list(links):
          if link.from_node == render_layers and link.to_node == composite:
              links.remove(link)

      # Rebrancher via le nœud Denoise
      links.new(render_layers.outputs['Image'], denoise_node.inputs['Image'])
      links.new(render_layers.outputs['Denoising Normal'], denoise_node.inputs['Normal'])
      links.new(render_layers.outputs['Denoising Albedo'], denoise_node.inputs['Albedo'])
      links.new(denoise_node.outputs['Image'], composite.inputs['Image'])

S'assurer que les passes Denoising Normal et Albedo sont activées :
  view_layer = bpy.context.view_layer
  view_layer.use_pass_normal = True
  view_layer.use_pass_diffuse_color = True

---

Tâche 2 — render_scene.py : world background neutre

Ajouter une fonction setup_world(bpy, ambiance: str) appelée dans main()
avant bpy.ops.render.render() :

  def setup_world(bpy, ambiance):
      world = bpy.context.scene.world
      if world is None:
          world = bpy.data.worlds.new('StudioWorld')
          bpy.context.scene.world = world
      world.use_nodes = True
      bg = world.node_tree.nodes.get('Background')
      if bg is None:
          bg = world.node_tree.nodes.new('ShaderNodeBackground')
      if ambiance == 'chaud':
          bg.inputs['Color'].default_value = (0.82, 0.75, 0.65, 1.0)
          bg.inputs['Strength'].default_value = 0.30
      else:
          bg.inputs['Color'].default_value = (0.90, 0.90, 0.88, 1.0)
          bg.inputs['Strength'].default_value = 0.45

Dans main(), lire package["renderPreset"].get("ambiance", "lumineux")
et appeler setup_world(bpy, ambiance) après reset_scene().

---

Tâche 3 — render_scene.py : multi-camera

Modifier main() pour boucler sur package["renderPreset"]["cameras"] :

  def main():
      package_path, output_dir = parse_args()
      os.makedirs(output_dir, exist_ok=True)
      import bpy

      package = load_package(package_path)
      reset_scene(bpy)
      setup_world(bpy, package["renderPreset"].get("ambiance", "lumineux"))

      material_cache = {}
      for mesh in package["compiled"]["meshes"]:
          create_box(bpy, mesh, material_cache)

      cameras_spec = package["renderPreset"].get("cameras", [package["compiled"]["camera"]])
      configure_render(bpy, package["renderPreset"], output_dir)

      for cam_spec in cameras_spec:
          cam_id = cam_spec.get("id", "final")
          bpy.context.scene.render.filepath = os.path.join(output_dir, cam_id + ".png")
          create_camera(bpy, cam_spec)
          bpy.ops.render.render(write_still=True)

      print(f"Rendered {len(cameras_spec)} camera(s) → {output_dir}")

La fonction create_camera() doit supprimer la caméra précédente avant d'en créer une nouvelle.
Ajouter en début de create_camera() :
  for obj in list(bpy.context.scene.objects):
      if obj.type == 'CAMERA':
          bpy.data.objects.remove(obj, do_unlink=True)

---

Tâche 4 — blender.ts : deux presets + 3 caméras auto

Dans buildBlenderRenderPackage(), accepter un second paramètre preset: 'express' | 'full' = 'full'.

Ajouter juste après les imports une fonction buildAutoCamera(room, id, ...) qui retourne
un objet { id, position, target, fov } en utilisant les ratios du plan render-express-plan.md :

  A01 Vue client   : pos=(W*0.42, H*0.48, D*1.10), target=(0, H*0.40, 0), fov=52
  A02 Facades      : pos=(0, H*0.52, D*0.75), target=(-W*0.08, H*0.44, -D*0.15), fov=40
  A03 Coin travail : pos=(-W*0.62, H*0.54, D*0.80), target=(-W*0.10, H*0.44, -D*0.20), fov=46

Le champ renderPreset doit devenir :
  {
    engine: 'CYCLES',
    output: { width, height, format: 'PNG', samples },
    colorManagement: 'AgX - Base Contrast',
    ambiance: 'lumineux',
    cameras: [
      { id: 'A01', position: {...}, target: {...}, fov: 52 },
      { id: 'A02', position: {...}, target: {...}, fov: 40 },
      { id: 'A03', position: {...}, target: {...}, fov: 46 },
    ]
  }

Express : samples=64, width=1920, height=1280
Full    : samples=256, width=2400, height=1600

Si scene.cameraMatch.enabled === true, remplacer cameras[0] par la caméra matchée
(les angles A02 et A03 restent automatiques).

---

Tâche 5 — schema.ts + blender.ts : mettre à jour BlenderRenderPackage

Mettre à jour le type BlenderRenderPackage dans schema.ts pour refléter la nouvelle
structure de renderPreset (ambiance + cameras au lieu du champ camera compilé).

Ne pas casser les tests existants. Si buildBlenderRenderPackage() change de signature,
mettre à jour l'appel dans tests/studio.test.ts en conséquence.

---

Contraintes :
- npm test doit passer (36 tests)
- npm run build doit compiler sans erreur TypeScript
- ne pas modifier les autres composants (StudioWorkspace, SiteSurveyPanel, Plan2DCanvas)
- ne pas ajouter de dépendances npm
- les caméras auto doivent utiliser les coordonnées scène (Y=haut, origine au centre)

Livrable : diff propre, npm test vert, npm run build propre.
```
