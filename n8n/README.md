# BP Cuisine — Backend n8n

Deux workflows n8n + une migration Supabase pour faire tourner le backend de rendu.

## Architecture

```
Frontend (Next.js)
  │
  ├─ POST /webhook/bpcuisines-render/start   ──▶  workflow-start.json
  │       multipart: room, sketch, prompt…          │
  │       ◀── { id, status: "processing" }          ├─ Crée le job dans Supabase
  │                                                  ├─ Appelle Replicate (adirik/interior-design)
  │                                                  └─ Retourne l'ID immédiatement
  │
  └─ GET  /webhook/bpcuisines-render/status?id=…  ──▶  workflow-status.json
          ◀── { id, status, outputUrl?, error? }         │
                                                          ├─ Lit le job dans Supabase
                                                          ├─ Si terminal → répond directement (cache)
                                                          ├─ Sinon → vérifie Replicate
                                                          ├─ Si succeeded → télécharge l'image
                                                          │   → upload dans Supabase Storage
                                                          │   → met à jour le job
                                                          └─ Répond avec le statut final
```

---

## 1. Prérequis

| Service | Usage |
|---------|-------|
| **n8n** | self-hosted ou n8n.cloud |
| **Supabase** | base de données + stockage images |
| **Replicate** | génération IA (`adirik/interior-design`) |

---

## 2. Supabase — setup

1. Ouvre **Supabase Dashboard → SQL Editor**
2. Colle et exécute le contenu de `setup.sql`
3. Note tes clés dans **Settings → API** :
   - `Project URL` → `SUPABASE_URL`
   - `anon public` → `SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_KEY` ⚠️ garde cette clé secrète

---

## 3. Replicate — API token

1. Crée un compte sur [replicate.com](https://replicate.com)
2. **Account → API Tokens → Create token**
3. Note ton token → `REPLICATE_API_TOKEN`

Le modèle utilisé : [`adirik/interior-design`](https://replicate.com/adirik/interior-design)
— spécialisé redesign d'intérieur, prend une photo de la pièce + prompt texte.

---

## 4. n8n — variables d'environnement

Dans **n8n → Settings → Variables** (ou variables d'env sur ton serveur) :

```
SUPABASE_URL          https://xxxx.supabase.co
SUPABASE_ANON_KEY     eyJ...
SUPABASE_SERVICE_KEY  eyJ...   ← clé service_role, jamais exposée au frontend
REPLICATE_API_TOKEN   r8_...
```

---

## 5. Import des workflows

1. Dans n8n : **Workflows → Import from file**
2. Importe `workflow-start.json`
3. Importe `workflow-status.json`
4. **Active** les deux workflows (toggle en haut à droite)

Les webhooks seront disponibles à :
```
POST {N8N_URL}/webhook/bpcuisines-render/start
GET  {N8N_URL}/webhook/bpcuisines-render/status?id=<job_id>
```

---

## 6. Frontend — .env.local

```env
NEXT_PUBLIC_N8N_BASE_URL=https://ton-instance.n8n.cloud
```

(ou l'URL de ton n8n self-hosted avec HTTPS)

---

## 7. Flux complet

```
1. User upload room.jpg + sketch.jpg + formulaire
2. POST /start → n8n génère un jobId, insère en DB, appelle Replicate
3. Replicate reçoit la photo de la pièce + le prompt construit
4. n8n répond immédiatement : { id: "abc123", status: "processing" }
5. Frontend poll /status?id=abc123 toutes les 4 secondes
6. n8n vérifie Replicate à chaque poll
7. Quand Replicate termine :
   - Télécharge l'image générée
   - Upload dans Supabase Storage (bucket: renders)
   - Met à jour le job : status=succeeded, output_url=<url publique>
8. Frontend reçoit { status: "succeeded", outputUrl: "https://..." }
9. Résultat affiché dans ResultViewer
```

---

## 8. Dépannage

| Symptôme | Cause probable |
|----------|---------------|
| `400` sur `/start` | Champs manquants ou body mal parsé — inspecte l'exécution n8n |
| `Replicate n'a pas retourné d'ID` | Token Replicate invalide ou modèle non disponible |
| Images non sauvegardées | Vérifier `SUPABASE_SERVICE_KEY` et que le bucket `renders` existe |
| Job introuvable en poll | `SUPABASE_URL` / `SUPABASE_ANON_KEY` incorrects |
| CORS | Vérifie que les webhooks n8n ont `Access-Control-Allow-Origin: *` (déjà configuré dans les workflows) |

Pour débugger, utilise le **DebugPanel** dans l'appli (visible en mode dev) : il fait un POST brut à `/start` et affiche la réponse JSON complète.
