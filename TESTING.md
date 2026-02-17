# 💧 DRIP Bot — Plan de test et premières étapes

Ce document décrit comment tester le bot par étapes **sans envoyer de SOL** tant que tout n’est pas validé.

---

## Prérequis

1. **Node.js** (v18+)
2. **Fichier `.env`** (copier depuis `.env.example`)
3. **Clé Helius** : [dashboard.helius.dev](https://dashboard.helius.dev) → créer une clé (free tier ~100k credits/jour)
4. **Token mint de test** : un token pump.fun existant (pour tester les holders). Tu peux prendre n’importe quel mint listé sur pump.fun.

---

## Étape 1 — Tester les APIs (aucun SOL envoyé)

Le script `scripts/test-apis.js` appelle uniquement Helius et PumpPortal. Il ne signe pas de transaction de distribution.

```bash
# Remplis .env avec au minimum :
#   HELIUS_API_KEY=...
#   TOKEN_MINT=...   (un vrai mint pump.fun pour les tests)

node scripts/test-apis.js
```

- **Test 1 — Helius token-accounts**  
  - Appel : `POST https://api.helius.xyz/v0/token-accounts` avec `{ mint, limit }`.  
  - À vérifier : la réponse contient bien `token_accounts` et chaque élément a `owner` + `amount`.  
  - Si cet endpoint n’existe plus ou renvoie une autre forme : le code actuel devra être adapté (par ex. RPC `getProgramAccounts` ou autre endpoint Helius). Le script logue la forme de la réponse pour qu’on s’adapte.

- **Test 2 — Helius transaction history**  
  - Appel : `GET .../v0/addresses/{address}/transactions?type=SWAP&limit=50`.  
  - À vérifier : tableau de tx avec `tokenTransfers`, `timestamp`, etc. pour calculer durée de détention et loyauté.

- **Test 3 — PumpPortal collectCreatorFee**  
  - Avec `PUMPPORTAL_API_KEY` : appel direct à l’API trade.  
  - Sans clé : appel à `trade-local` avec `publicKey` (trésorerie).  
  - À vérifier : pas d’erreur 4xx/5xx inattendue ; si 200 + body binaire, c’est une tx sérialisée (comportement attendu pour trade-local).

**Commandes utiles :**

```bash
node scripts/test-apis.js --helius-only      # uniquement Helius
node scripts/test-apis.js --pumpportal-only # uniquement PumpPortal
```

---

## Étape 2 — Tester un cycle complet SANS distribuer (dry-run)

Pour l’instant le bot n’a pas de mode `--dry-run`. Pour tester sans envoyer de SOL :

1. **Option A** : Commenter temporairement l’appel à `distributeDrip()` dans `runDripCycle()` et lancer `node drip-bot.js --once`. Tu verras claim (si config trésorerie), récupération des holders, calcul des scores et du rapport.
2. **Option B** : Ajouter un flag `--dry-run` qui fait tout sauf `distributeDrip()` (recommandé pour la suite).

À faire dans cette étape :

- Vérifier que `getHolderSnapshots()` retourne bien une liste cohérente (nombre et champs `owner`, `amount`).
- Vérifier que les DRIP scores calculés ont du sens (hold %, durée, loyalty).
- Vérifier que le rapport (et le tweet template) sont générés.

---

## Étape 3 — Tester le claim seul (PumpPortal)

Une fois la trésorerie configurée (et un peu de SOL pour les fees) :

1. Lance un cycle avec `--once`.
2. Regarde les logs : “Fees claimed. TX: …” ou un message d’erreur PumpPortal.
3. Vérifie sur Solscan que le wallet trésorerie a bien reçu du SOL (ou que la tx de claim est bien passée).

Si le token n’a pas encore de volume, les fees à claim peuvent être 0 ; dans ce cas tu peux quand même vérifier que l’appel API ne renvoie pas une erreur côté PumpPortal.

---

## Étape 4 — Tester la distribution (petits montants)

Quand tout le reste est OK :

1. Utilise un **petit montant** (ex. 0.01 SOL à distribuer) en modifiant temporairement la logique (ex. `toDistribute = 0.01` pour un test).
2. Utilise un token de test avec **peu de holders** (et des wallets que tu contrôles si possible).
3. Lance un cycle et vérifie sur Solscan que les transferts partent bien du trésor vers les bons wallets et que les montants correspondent au rapport.

---

## Points d’attention connus

| Composant | Risque | Action |
|-----------|--------|--------|
| Helius `v0/token-accounts` | Endpoint n'existe pas (404) | Le bot utilise désormais RPC `getProgramAccounts` ; si 0 résultat, fallback `getTokenLargestAccounts` + `getAccountInfo` (max 20 holders). |
| Helius transactions | Structure `tokenTransfers` / `timestamp` peut varier | Vérifier les logs de `getHolderTradeHistory()` et adapter les champs si besoin. |
| PumpPortal trade-local | Retour = binaire (tx sérialisée) | Le code actuel fait `response.arrayBuffer()` puis `VersionedTransaction.deserialize` + sign + send. Vérifier que la tx est bien construite et confirmée. |
| Distribution | Rate limit / batch size | Réduire `TX_BATCH_SIZE` ou augmenter le délai entre batches si besoin. |

---

## Suite possible

- **Gestion d’erreurs** : retry avec backoff, timeout, gestion rate limit (429).
- **Log file** : écrire chaque cycle dans un fichier (ex. `drip-history.json`) et optionnellement un log texte.
- **Dashboard** : après chaque cycle, mettre à jour `drip-history.json` et régénérer le HTML (déjà prévu dans `drip-dashboard.js`, à brancher sur la sortie du bot).
- **Supabase / Vercel** : possible plus tard pour historique et hébergement ; pas nécessaire pour valider les premières étapes en local.

En commençant par **Étape 1** (`node scripts/test-apis.js`), tu valides les APIs sans risque. Ensuite on peut ajouter le `--dry-run` et enchaîner sur les étapes 2 à 4.
