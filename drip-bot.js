/**
 * ╔═══════════════════════════════════════════════════════╗
 * ║  💧 DRIP BOT V2 — Creator Fee Redistribution Engine  ║
 * ║  Cache-based: Supabase holders, zero history API      ║
 * ╚═══════════════════════════════════════════════════════╝
 *
 * 1. getTokenAccounts (DAS API) → current holders
 * 2. UPSERT Supabase holders (cache)
 * 3. qualified = amount >= 50% max_amount, present in list
 * 4. drip_score = hold_weight (capped 2%) × duration_multiplier
 * 5. Distribute SOL, log drip_history
 */

import { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import fetch from 'node-fetch';
import 'dotenv/config';

// SPL Token account layout (for fallback)
const TOKEN_ACCOUNT_OWNER_OFFSET = 32;
const TOKEN_ACCOUNT_AMOUNT_OFFSET = 64;

// ═══════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════
const CONFIG = {
  RPC_ENDPOINT: process.env.RPC_ENDPOINT || (process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : 'https://api.mainnet-beta.solana.com'),
  HELIUS_API_KEY: process.env.HELIUS_API_KEY || '',
  PUMPPORTAL_API_KEY: process.env.PUMPPORTAL_API_KEY || '',

  TOKEN_MINT: process.env.TOKEN_MINT || '',
  TOKEN_DECIMALS: Number(process.env.TOKEN_DECIMALS) || 6,
  TOKEN_SUPPLY_RAW: 1_000_000_000 * Math.pow(10, Number(process.env.TOKEN_DECIMALS) || 6),

  TREASURY_PRIVATE_KEY: process.env.TREASURY_PRIVATE_KEY || '',

  MAX_HOLDER_CAP_PCT: 2.0,
  MIN_HOLD_TOKENS: 100_000,
  MIN_DRIP_AMOUNT_SOL: 0.005,

  // Excluded from distribution (DEV + WASH) — still tracked in holders
  EXCLUDED_WALLETS: [
    process.env.DEV_WALLET || '9BK3QEBkzw1pjWZarmnYgUiLR1ZkCax3PZheA1WmDxEA',
    // process.env.WASH_WALLET_1 || '',
    // process.env.WASH_WALLET_2 || '',
  ].filter(Boolean),

  DRIP_INTERVAL_MS: 1800000,  // 30 minutes
  PRIORITY_FEE: 0.000001,
  TX_BATCH_SIZE: 10,
  DRY_RUN: false,
};

// ═══════════════════════════════════════════
// STEP 1: CLAIM CREATOR FEES
// ═══════════════════════════════════════════
async function claimCreatorFees() {
  console.log('\n💧 [STEP 1] Claiming creator fees from pump.fun...');

  try {
    if (CONFIG.PUMPPORTAL_API_KEY) {
      const response = await fetch('https://pumpportal.fun/api/trade?api-key=' + CONFIG.PUMPPORTAL_API_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'collectCreatorFee', priorityFee: CONFIG.PRIORITY_FEE }),
      });
      const data = await response.json();
      console.log('  ✅ Fees claimed. TX:', data);
      return data;
    }

    const treasuryKeypair = Keypair.fromSecretKey(bs58.decode(CONFIG.TREASURY_PRIVATE_KEY));
    const response = await fetch('https://pumpportal.fun/api/trade-local', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        publicKey: treasuryKeypair.publicKey.toString(),
        action: 'collectCreatorFee',
        priorityFee: CONFIG.PRIORITY_FEE,
      }),
    });

    if (response.status !== 200) {
      console.log('  ⚠️  No fees to claim or error:', response.statusText);
      return null;
    }

    const connection = new Connection(CONFIG.RPC_ENDPOINT, 'confirmed');
    const data = await response.arrayBuffer();
    const { VersionedTransaction } = await import('@solana/web3.js');
    const tx = VersionedTransaction.deserialize(new Uint8Array(data));
    tx.sign([treasuryKeypair]);
    const signature = await connection.sendTransaction(tx);
    console.log('  ✅ Fees claimed. TX:', signature);
    return signature;
  } catch (error) {
    console.error('  ❌ Claim failed:', error.message);
    return null;
  }
}

// ═══════════════════════════════════════════
// STEP 2: GET TOKEN HOLDERS (DAS API)
// ═══════════════════════════════════════════
async function getHolderSnapshots() {
  console.log('\n💧 [STEP 2] Fetching token holders (getTokenAccounts)...');

  const connection = new Connection(CONFIG.RPC_ENDPOINT, 'confirmed');
  const mintPubkey = new PublicKey(CONFIG.TOKEN_MINT);

  const parseRawAccount = (acc) => {
    const raw = acc.data;
    const data = Buffer.isBuffer(raw) ? raw : Buffer.from(Array.isArray(raw) ? raw[0] : raw, 'base64');
    const owner = new PublicKey(data.subarray(TOKEN_ACCOUNT_OWNER_OFFSET, TOKEN_ACCOUNT_OWNER_OFFSET + 32));
    const amount = data.readBigUInt64LE(TOKEN_ACCOUNT_AMOUNT_OFFSET);
    return { owner: owner.toString(), amount: Number(amount) };
  };

  try {
    const rpcUrl = CONFIG.RPC_ENDPOINT.includes('helius') ? CONFIG.RPC_ENDPOINT : `https://mainnet.helius-rpc.com/?api-key=${CONFIG.HELIUS_API_KEY}`;
    let holders = [];
    let cursor = null;

    do {
      const body = {
        jsonrpc: '2.0',
        id: 'drip-holders',
        method: 'getTokenAccounts',
        params: { mint: CONFIG.TOKEN_MINT, limit: 1000, ...(cursor && { cursor }) },
      };
      const res = await fetch(rpcUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (data.error) throw new Error(data.error.message || 'getTokenAccounts failed');
      const result = data.result;
      const accounts = result?.token_accounts || [];
      holders = holders.concat(accounts.map((a) => ({ owner: a.owner, amount: Number(a.amount ?? 0) })));
      cursor = result?.cursor || null;
    } while (cursor);

    if (holders.length > 0) {
      console.log(`  ✅ getTokenAccounts: ${holders.length} holders`);
    } else {
      throw new Error('No token_accounts in response');
    }
    return holders;
  } catch (error) {
    console.error('  ❌ getTokenAccounts failed:', error.message);
    console.log('  ⚠️  Falling back to getTokenLargestAccounts (max 20)...');
    try {
      const largest = await connection.getTokenLargestAccounts(mintPubkey);
      if (largest.value?.length > 0) {
        const infos = await connection.getMultipleAccountsInfo(largest.value.map((v) => v.address));
        const holders = infos
          .filter((i) => i?.data?.length >= 72)
          .map((i) => parseRawAccount({ data: i.data }));
        console.log(`  📊 Found ${holders.length} holders (fallback)`);
        return holders;
      }
    } catch (e) {
      console.error('  ❌ Fallback failed:', e.message);
    }
    return [];
  }
}

// ═══════════════════════════════════════════
// STEP 3: DISTRIBUTE SOL
// ═══════════════════════════════════════════
async function distributeDrip(distributions, totalSolToDistribute) {
  console.log('\n💧 [STEP 4] Distributing DRIP...');
  if (CONFIG.DRY_RUN) {
    console.log('  ⚠️  DRY RUN — skipping actual transfers');
  }
  console.log(`  💰 Total to distribute: ${totalSolToDistribute} SOL`);

  const connection = new Connection(CONFIG.RPC_ENDPOINT, 'confirmed');
  const treasuryKeypair = Keypair.fromSecretKey(bs58.decode(CONFIG.TREASURY_PRIVATE_KEY));

  const totalScore = distributions.reduce((s, d) => s + d.dripScore, 0);
  if (totalScore === 0 || distributions.length === 0) {
    console.log('  ⚠️  No eligible holders.');
    return [];
  }

  const toSend = distributions
    .map((d) => ({
      ...d,
      amountSOL: (d.dripScore / totalScore) * totalSolToDistribute,
      amountLamports: Math.floor(((d.dripScore / totalScore) * totalSolToDistribute) * LAMPORTS_PER_SOL),
    }))
    .filter((d) => d.amountSOL >= CONFIG.MIN_DRIP_AMOUNT_SOL);

  console.log(`  📤 Sending to ${toSend.length} holders:`);
  toSend.slice(0, 5).forEach((d) => console.log(`     ${d.wallet.slice(0, 8)}... → ${d.amountSOL.toFixed(6)} SOL`));
  if (toSend.length > 5) console.log(`     ... and ${toSend.length - 5} more`);

  if (CONFIG.DRY_RUN) {
    console.log('  ✅ DRY RUN complete.');
    return toSend.map((d) => ({ ...d, signature: 'dry-run' }));
  }

  const results = [];
  for (let i = 0; i < toSend.length; i += CONFIG.TX_BATCH_SIZE) {
    const batch = toSend.slice(i, i + CONFIG.TX_BATCH_SIZE);
    const transaction = new Transaction();
    for (const d of batch) {
      transaction.add(SystemProgram.transfer({
        fromPubkey: treasuryKeypair.publicKey,
        toPubkey: new PublicKey(d.wallet),
        lamports: d.amountLamports,
      }));
    }
    try {
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = treasuryKeypair.publicKey;
      transaction.sign(treasuryKeypair);
      const signature = await connection.sendRawTransaction(transaction.serialize());
      await connection.confirmTransaction(signature, 'confirmed');
      console.log(`  ✅ Batch ${Math.floor(i / CONFIG.TX_BATCH_SIZE) + 1} sent. TX: ${signature}`);
      results.push(...batch.map((d) => ({ ...d, signature })));
    } catch (error) {
      console.error(`  ❌ Batch failed:`, error.message);
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  return results;
}

// ═══════════════════════════════════════════
// MAIN: RUN DRIP CYCLE
// ═══════════════════════════════════════════
async function runDripCycle() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  💧 DRIP CYCLE V2 (Cache-based)           ║');
  console.log('║  ' + new Date().toISOString() + '       ║');
  console.log('╚═══════════════════════════════════════════╝');

  if (!process.env.SUPABASE_URL || !process.env.SUPABASE_ANON_KEY) {
    console.error('  ❌ SUPABASE_URL and SUPABASE_ANON_KEY required.');
    return;
  }

  const connection = new Connection(CONFIG.RPC_ENDPOINT, 'confirmed');
  const treasuryKeypair = Keypair.fromSecretKey(bs58.decode(CONFIG.TREASURY_PRIVATE_KEY));
  const balanceBefore = await connection.getBalance(treasuryKeypair.publicKey);
  console.log(`  💰 Treasury balance before claim: ${balanceBefore / LAMPORTS_PER_SOL} SOL`);

  await claimCreatorFees();
  await new Promise((r) => setTimeout(r, 3000));

  const balanceAfter = await connection.getBalance(treasuryKeypair.publicKey);
  const feesEarned = (balanceAfter - balanceBefore) / LAMPORTS_PER_SOL;
  console.log(`  💰 Fees earned: ${feesEarned} SOL`);

  let toDistribute = feesEarned * 0.9;
  if (toDistribute < CONFIG.MIN_DRIP_AMOUNT_SOL) {
    if (CONFIG.DRY_RUN) {
      toDistribute = 0.1;
      console.log('  ⚠️  DRY RUN: using 0.1 SOL (fake)');
    } else {
      console.log('  ⚠️  Not enough fees. Skipping.');
      return;
    }
  }

  // 1. Get current holders
  const currentHolders = await getHolderSnapshots();
  if (currentHolders.length === 0) {
    console.log('  ⚠️  No holders found.');
    return;
  }

  // 2. Upsert Supabase holders
  const { upsertHolders, getQualifiedHolders, updateHolderScores, logDripHistory, saveCycleToSupabase } = await import('./lib/supabase.js');
  await upsertHolders(CONFIG.TOKEN_MINT, currentHolders);
  console.log('  ✅ Holders cache updated');

  // 3. Get qualified holders with drip_score
  const minHoldRaw = CONFIG.MIN_HOLD_TOKENS * Math.pow(10, CONFIG.TOKEN_DECIMALS);
  let scored = await getQualifiedHolders(CONFIG.TOKEN_MINT, CONFIG.TOKEN_SUPPLY_RAW, CONFIG.EXCLUDED_WALLETS);
  scored = scored.filter((s) => s.amount >= minHoldRaw);

  console.log(`  📊 ${scored.length} qualified holders (min ${CONFIG.MIN_HOLD_TOKENS.toLocaleString()} tokens)`);

  // 4. Distribute
  const distributions = await distributeDrip(scored, toDistribute);

  // 5. Log drip_history + update total_received
  if (distributions.length > 0) {
    const forHistory = distributions.map((d) => ({
      wallet: d.wallet,
      dripScore: d.dripScore,
      amountSOL: d.amountSOL,
      holdDurationHours: d.holdDurationHours,
    }));
    await logDripHistory(CONFIG.TOKEN_MINT, forHistory);
    await updateHolderScores(CONFIG.TOKEN_MINT, scored);
  }

  // 6. Save cycle summary
  const report = {
    timestamp: new Date().toISOString(),
    totalDistributedSOL: toDistribute,
    recipientCount: distributions.length,
    transactions: distributions.map((d) => ({ signature: d.signature })),
    topRecipients: distributions.slice(0, 5).map((d) => ({
      wallet: d.wallet.slice(0, 4) + '...' + d.wallet.slice(-4),
      amount: (d.amountSOL || 0).toFixed(6) + ' SOL',
      score: d.dripScore?.toFixed(4),
    })),
  };
  await saveCycleToSupabase(report);

  console.log('\n✅ DRIP CYCLE COMPLETE\n');
}

// ═══════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════
const args = process.argv.slice(2);
if (args.includes('--dry-run')) CONFIG.DRY_RUN = true;

if (args.includes('--once')) {
  runDripCycle().catch(console.error);
} else if (args.includes('--loop')) {
  console.log(`🔄 DRIP bot loop (every ${CONFIG.DRIP_INTERVAL_MS / 60000} min)`);
  runDripCycle().catch(console.error);
  setInterval(() => runDripCycle().catch(console.error), CONFIG.DRIP_INTERVAL_MS);
  // Health check log every 5 min (for Railway/monitoring)
  setInterval(() => {
    console.log(`💓 [${new Date().toISOString()}] DRIP bot alive`);
  }, 5 * 60 * 1000);
} else {
  console.log(`
💧 DRIP BOT V2 — Usage:
  node drip-bot.js --once
  node drip-bot.js --once --dry-run
  node drip-bot.js --loop

⚙️  Required: .env with SUPABASE_URL, SUPABASE_ANON_KEY, TOKEN_MINT, TREASURY_PRIVATE_KEY
  `);
}
