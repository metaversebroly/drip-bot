# 💧 Supabase — Configuration pas à pas

## Étape 1 : Créer le projet

1. Va sur [supabase.com](https://supabase.com) → **New Project**
2. **Organization** : garde celle par défaut (ou crée-en une)
3. **Name** : `drip-bot` (ou ce que tu veux)
4. **Database Password** : 
   - C'est le mot de passe de la base Postgres (accès direct)
   - Choisis un mot de passe **fort** (ex: `DripBot2024!Secure#`)
   - **Sauvegarde-le** dans un gestionnaire de mots de passe — tu en auras besoin si tu accèdes à la DB en direct
   - Le bot n'utilise PAS ce mot de passe (il utilise l'API avec anon key)
5. **Region** : choisis la plus proche (ex: `West EU` si tu es en France)
6. Clique **Create new project**
7. Attends 1-2 minutes que le projet soit créé

---

## Étape 2 : Créer les tables

1. Dans le dashboard Supabase, menu gauche → **SQL Editor**
2. Clique **New query**
3. Copie-colle **tout** le contenu du fichier `supabase/schema-v2.sql` (DRIP V2 : holders + drip_history)
4. Clique **Run** (ou Ctrl+Enter)
5. Tu dois voir : `Success` (pas d'erreur)

---

## Étape 3 : Récupérer les clés API

1. Menu gauche → **Project Settings** (icône engrenage)
2. Onglet **API**
3. Tu vois :
   - **Project URL** → `https://xxxxx.supabase.co`
   - **Project API keys** → section `anon` `public`
   - Clique sur **Reveal** à côté de `anon public` pour voir la clé

---

## Étape 4 : Ajouter dans ton .env

Ouvre ton fichier `.env` et ajoute ces deux lignes (remplace par tes vraies valeurs) :

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## Étape 5 : Vérifier

Lance un cycle dry-run :

```bash
node drip-bot.js --once --dry-run
```

À la fin de l'exécution, tu devrais voir :

```
✅ Cycle saved to Supabase
```

Si tu vois `⚠️ Supabase save failed` → vérifie que les variables sont bien dans `.env` et que le schéma SQL a été exécuté.

---

## C'est tout

Le bot va maintenant sauvegarder chaque cycle dans Supabase. Le dashboard peut lire ces données pour afficher l'historique.
