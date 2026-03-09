# Contrat de données catalogue — BP Cuisines Studio

Ce document décrit la structure cible du catalogue produit qui alimentera le Studio paramétrique. Il couvre les familles de modules, les finitions, les électroménagers et les règles de compatibilité.

Le catalogue n'est pas encore implémenté dans le code (mars 2026). Ce document est le point de départ pour sa conception.

---

## Vue d'ensemble

```
Catalogue
├── families/           Familles de modules (base, tall, wall, island)
│   └── templates[]     Gabarits dimensionnels par famille
├── finishes/
│   ├── fronts[]        Façades (couleur, matière, référence fournisseur)
│   ├── worktops[]      Plans de travail
│   ├── splashbacks[]   Crédences
│   └── handles[]       Poignées / systèmes push-to-open
├── appliances/         Électroménagers intégrables
└── compatibilities/    Règles de compatibilité entre éléments
```

---

## 1. Familles de modules

### `ModuleFamily`

```typescript
interface ModuleFamily {
  id: string              // ex. "base", "tall", "wall", "island"
  label: string           // Libellé FR affiché dans le Studio
  kind: ModuleKind        // 'base' | 'tall' | 'wall' | 'island'
  templates: ModuleTemplate[]
}
```

### `ModuleTemplate`

```typescript
interface ModuleTemplate {
  id: string              // ex. "base-60", "base-90-sink"
  sku: string             // Référence commerciale
  label: string           // Libellé FR (ex. "Meuble bas 60 cm")
  kind: ModuleKind
  defaultWidth: number    // mètres
  defaultDepth: number    // mètres
  defaultHeight: number   // mètres
  widths: number[]        // Largeurs disponibles (ex. [0.4, 0.5, 0.6, 0.8, 0.9, 1.0])
  allowsAppliance: boolean
  applianceSlot?: ApplianceSlotKind   // 'sink' | 'hob' | 'oven' | 'fridge' | 'dishwasher'
  compatibleFinishFamilies: string[]  // IDs de familles de façades compatibles
  tags: string[]          // ex. ['angle', 'tiroirs', 'portes']
}
```

**Familles prévues :**

| kind | Description | Largeurs typiques |
|------|-------------|-------------------|
| `base` | Meubles bas (avec plan de travail) | 0,40 à 1,20 m |
| `tall` | Colonnes haute (four, réfrigérateur, garde-manger) | 0,60, 0,90 m |
| `wall` | Meubles hauts muraux | 0,30 à 1,00 m |
| `island` | Îlot central (placement libre) | 0,90 à 2,00 m |

---

## 2. Finitions façades

### `FrontsFinish`

```typescript
interface FrontsFinish {
  id: string              // ex. "mat-blanc-pur"
  label: string           // "Blanc pur mat"
  color: string           // Couleur CSS hex ou référence RAL (ex. "#F5F0EB", "RAL 9010")
  material: 'mat' | 'satiné' | 'brillant' | 'bois' | 'stratifié' | 'laqué'
  textureUrl?: string     // Chemin vers la texture Three.js / Blender
  blenderMaterialId?: string  // ID du matériau Blender correspondant
  collectionId: string    // Collection de couleurs (ex. "essentielle", "signature")
  available: boolean
}
```

---

## 3. Plans de travail

### `WorktopFinish`

```typescript
interface WorktopFinish {
  id: string
  label: string           // "Quartz blanc veiné"
  color: string           // Couleur CSS hex ou référence
  material: 'quartz' | 'granit' | 'stratifié' | 'inox' | 'bois' | 'céramique' | 'béton'
  thickness: number       // Épaisseur en mètres (ex. 0.038)
  textureUrl?: string
  blenderMaterialId?: string
  available: boolean
}
```

---

## 4. Crédences

### `SplashbackFinish`

```typescript
interface SplashbackFinish {
  id: string
  label: string           // "Carrelage métro blanc"
  color: string
  material: 'carrelage' | 'verre' | 'inox' | 'stratifié' | 'béton' | 'brique'
  textureUrl?: string
  blenderMaterialId?: string
  available: boolean
}
```

---

## 5. Poignées

### `HandleStyle`

```typescript
interface HandleStyle {
  id: string              // ex. "barre-inox", "push-to-open", "bouton-rond"
  label: string
  kind: 'barre' | 'bouton' | 'coquille' | 'sans-poignée'
  finish: 'inox' | 'noir-mat' | 'doré' | 'blanc' | 'chrome'
  blenderObjectId?: string  // Objet Blender associé
  available: boolean
}
```

---

## 6. Électroménagers

### `Appliance`

```typescript
interface Appliance {
  id: string
  type: SurveyEquipmentType   // 'sink' | 'hob' | 'oven' | 'fridge' | 'dishwasher' | 'hood'
  label: string               // "Évier 1 bac 60 cm inox"
  sku: string
  brand?: string
  width: number               // Encombrement en mètres
  depth: number
  height: number
  finish: string              // 'inox' | 'blanc' | 'noir' | etc.
  blenderObjectId?: string
  requiresSlot: ApplianceSlotKind
  available: boolean
}
```

---

## 7. Règles de compatibilité

### `CompatibilityRule`

```typescript
interface CompatibilityRule {
  id: string
  kind: 'finish-family' | 'appliance-slot' | 'dimension' | 'collection'
  description: string
  // Exemple: une façade "bois" n'est pas disponible avec le plan de travail "inox"
  sourceType: 'fronts' | 'worktop' | 'splashback' | 'handle' | 'template'
  sourceId: string        // ID de l'élément source
  targetType: string
  targetIds: string[]     // IDs des éléments incompatibles ou compatibles
  mode: 'exclude' | 'require'
}
```

**Exemples de règles :**
- Façade bois → exclut plan de travail inox
- Module évier → requiert `applianceSlot: 'sink'`
- Collection "Signature" → requiert finition "laqué" ou "satiné"
- Largeur ≤ 0,40 m → exclut le tiroir trois pans

---

## 8. Structure racine du catalogue

```typescript
interface BPCuisineCatalog {
  version: string           // ex. "1.0.0"
  generatedAt: string       // ISO 8601
  families: ModuleFamily[]
  finishes: {
    fronts: FrontsFinish[]
    worktops: WorktopFinish[]
    splashbacks: SplashbackFinish[]
    handles: HandleStyle[]
  }
  appliances: Appliance[]
  compatibilities: CompatibilityRule[]
}
```

---

## 9. Intégration avec le Studio

### Champs actuels dans `KitchenModuleSpec` qui seront liés au catalogue

| Champ actuel | Liaison catalogue |
|--------------|-------------------|
| `templateId` | `ModuleTemplate.id` |
| `sku` | `ModuleTemplate.sku` |
| `frontsMaterialId` | `FrontsFinish.id` |
| `applianceLabel` | `Appliance.label` |
| `kind` | `ModuleFamily.kind` |

### Champs dans `MaterialAssignments` qui seront liés

| Champ actuel | Liaison catalogue |
|--------------|-------------------|
| `fronts` | `FrontsFinish.id` |
| `worktop` | `WorktopFinish.id` |
| `floor` | (futur `FloorFinish.id`) |
| `walls` | (futur `WallFinish.id`) |

### Champs dans `SiteSurveyFinishPreferences` comme entrée libre → référence catalogue

Les préférences de finition saisies lors du relevé (`frontsColor`, `worktopColor`, etc.) sont actuellement des chaînes libres. Elles seront remplacées par des sélecteurs catalogue (`frontsFinishId`, `worktopFinishId`, etc.) dans une prochaine version.

---

## 10. Points ouverts

- **Dimensionnement** : comment gérer les modules sur-mesure (largeurs non standard) ?
- **Multi-collection** : peut-on mixer deux collections de façades sur un même projet ?
- **Texture Blender** : pipeline de synchronisation entre `textureUrl` et les `.blend` de référence
- **Tarification** : le catalogue doit-il inclure les prix unitaires ou seulement les références ?
- **Source de vérité** : catalogue stocké en JSON statique, base Supabase, ou API fournisseur ?
