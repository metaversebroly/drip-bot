# 💧 DRIP Bot — Déploiement & Hébergement

## Supabase (gratuit) ✅

- **Rôle** : Stocker l’historique des cycles (drip_cycles)
- **Setup** :
  1. Créer un projet sur [supabase.com](https://supabase.com)
  2. SQL Editor → exécuter `supabase/schema.sql`
  3. Settings → API : copier `SUPABASE_URL` et `SUPABASE_ANON_KEY`
  4. Ajouter ces variables dans `.env`

---

## Vercel : limites importantes ⚠️

**Le bot ne peut pas tourner sur Vercel** :

- **Timeout** : 10 s (free) ou 60 s (Pro) par requête
- Un cycle complet (holders + historique + distribution) prend **2 à 5 minutes**
- Les fonctions serverless Vercel sont faites pour des requêtes courtes

**Ce que Vercel peut faire** :
- Héberger un **dashboard statique** (HTML généré)
- Ou une **API légère** qui lit Supabase et renvoie des données

---

## Où faire tourner le bot 24/7

| Service | Free tier | Idéal pour |
|---------|-----------|------------|
| **Railway** | 500 h/mois | Bot Node.js en continu |
| **Render** | 750 h/mois | Idem |
| **Fly.io** | 3 VM gratuites | Idem |
| **Local** | Illimité | PC allumé en permanence |

### Railway (recommandé)

1. [railway.app](https://railway.app) → New Project
2. Deploy from GitHub (ou upload du code)
3. Variables d’environnement : copier tout le `.env`
4. Start command : `node drip-bot.js --loop`
5. Le bot tourne en continu

### Render

1. [render.com](https://render.com) → New → Background Worker
2. Connect repo, build : `npm install`, start : `node drip-bot.js --loop`
3. Variables d’environnement depuis le dashboard

---

## Checklist avant le lancement (vendredi)

- [ ] `.env` rempli (RPC, Helius, TOKEN_MINT, TREASURY_PRIVATE_KEY)
- [ ] Wallet DEV ajouté dans `EXCLUDED_WALLETS`
- [ ] Trésorerie financée (SOL pour fees + claim)
- [ ] Supabase configuré (optionnel)
- [ ] Bot testé en `--once --dry-run`
- [ ] Hébergement choisi (Railway / Render / local)
