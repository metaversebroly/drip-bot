/**
 * ╔═══════════════════════════════════════════════════════╗
 * ║  💧 DRIP BOT V1 — Creator Fee Redistribution Engine  ║
 * ║  "Diamond hands get the drip"                         ║
 * ╚═══════════════════════════════════════════════════════╝
 * 
 * WHAT IT DOES:
 * 1. Claims creator fees from pump.fun via PumpPortal API
 * 2. Scans all token holders + calculates DRIP Score
 * 3. Redistributes SOL proportionally to qualifying holders
 * 
 * DRIP SCORE FORMULA:
 *   score = holdAmount (capped 3%) × holdDuration multiplier × loyalty bonus
 *   - Hold < 1h     → multiplier 0.1x (almost nothing)
 *   - Hold 1-6h     → multiplier 0.5x
 *   - Hold 6-24h    → multiplier 1.0x
 *   - Hold 24-72h   → multiplier 1.5x
 *   - Hold 72h+     → multiplier 2.0x (diamond hands)
 *   - Sold > 50%    → DISQUALIFIED (score = 0)
 *   - Max cap per wallet: 3% of supply for score calc
 * 
 * REQUIREMENTS:
 *   npm install @solana/web3.js bs58 dotenv node-fetch
 */

import { Connection, Keypair, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';
import fetch from 'node-fetch';
import 'dotenv/config';

// SPL Token Program — for getProgramAccounts holder lookup
const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
// SPL Token account layout: mint(32) + owner(32) + amount(8) + ...
const TOKEN_ACCOUNT_OWNER_OFFSET = 32;
const TOKEN_ACCOUNT_AMOUNT_OFFSET = 64;

// ═══════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════
const CONFIG = {
  // RPC & API (use Helius RPC if only API key is set)
  RPC_ENDPOINT: process.env.RPC_ENDPOINT || (process.env.HELIUS_API_KEY
    ? `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`
    : 'https://api.mainnet-beta.solana.com'),
  HELIUS_API_KEY: process.env.HELIUS_API_KEY || '',
  PUMPPORTAL_API_KEY: process.env.PUMPPORTAL_API_KEY || '',

  // Token info (set after launch)
  TOKEN_MINT: process.env.TOKEN_MINT || '',
  TOKEN_DECIMALS: Number(process.env.TOKEN_DECIMALS) || 6,  // pump.fun standard
  TOKEN_SUPPLY_RAW: 1_000_000_000 * Math.pow(10, Number(process.env.TOKEN_DECIMALS) || 6),  // 1B tokens in raw units

  // DRIP Treasury wallet (receives creator fees, redistributes)
  TREASURY_PRIVATE_KEY: process.env.TREASURY_PRIVATE_KEY || '',

  // DRIP Score Parameters
  MAX_HOLDER_CAP_PCT: 3.0,       // Max 3% of supply counts for score
  SELL_THRESHOLD_PCT: 50,         // Sold > 50% = disqualified

  // Hold duration multipliers
  DURATION_MULTIPLIERS: [
    { maxHours: 1,    multiplier: 0.1  },  // Snipers get almost nothing
    { maxHours: 6,    multiplier: 0.5  },
    { maxHours: 24,   multiplier: 1.0  },
    { maxHours: 72,   multiplier: 1.5  },
    { maxHours: Infinity, multiplier: 2.0 }, // Diamond hands
  ],

  // ONLY the DEV wallet (token creator) is excluded from drip
  EXCLUDED_WALLETS: [
    // Add ONLY the DEV wallet address here (the one that deploys on pump.fun)
    '9BK3QEBkzw1pjWZarmnYgUiLR1ZkCax3PZheA1WmDxEA',
  ],

  // Operational
  DRIP_INTERVAL_MS: 3600000,  // Every 1 hour — claim + distribute automatically
  PRIORITY_FEE: 0.000001,
  TX_BATCH_SIZE: 10,          // Max transfers per transaction
  MIN_DRIP_AMOUNT_SOL: 0.005, // Don't send less (tx fees not worth it)
  DRY_RUN: false,             // Set true or use --dry-run to skip distribution
};

// ═══════════════════════════════════════════
// STEP 1: CLAIM CREATOR FEES
// ═══════════════════════════════════════════
/**
 * CLAIM TIMING (automatic & intelligent):
 * - In --loop mode: runs every DRIP_INTERVAL_MS (1h by default)
 * - PumpPortal collectCreatorFee claims ALL accumulated fees in one tx
 * - Fees accumulate on pump.fun with every trade (creator fee %)
 * - We claim whenever we run → no volume threshold, just time-based
 * - If fees < MIN_DRIP_AMOUNT_SOL after claim: we skip distribution (save tx fees)
 */
async function claimCreatorFees() {
  console.log('\n💧 [STEP 1] Claiming creator fees from pump.fun...');

  try {
    // Method A: Using PumpPortal Lightning API (simplest)
    if (CONFIG.PUMPPORTAL_API_KEY) {
      const response = await fetch('https://pumpportal.fun/api/trade?api-key=' + CONFIG.PUMPPORTAL_API_KEY, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'collectCreatorFee',
          priorityFee: CONFIG.PRIORITY_FEE,
          // pump.fun claims ALL accumulated fees at once, no need to specify mint
        }),
      });

      const data = await response.json();
      console.log('  ✅ Fees claimed. TX:', data);
      return data;
    }

    // Method B: Using Local Transaction API (no API key needed)
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
// STEP 2: GET TOKEN HOLDERS + HISTORY
// ═══════════════════════════════════════════
/**
 * Get all token holders for CONFIG.TOKEN_MINT.
 * Tries getProgramAccounts first; if it returns 0 (e.g. some RPCs limit it), falls back to getTokenLargestAccounts + getAccountInfo.
 */
async function getHolderSnapshots() {
  console.log('\n💧 [STEP 2] Fetching token holders...');

  const connection = new Connection(CONFIG.RPC_ENDPOINT, 'confirmed');
  const mintPubkey = new PublicKey(CONFIG.TOKEN_MINT);

  try {
    const accounts = await connection.getProgramAccounts(TOKEN_PROGRAM_ID, {
      commitment: 'confirmed',
      filters: [
        { dataSize: 165 }, // SPL Token account size
        { memcmp: { offset: 0, bytes: CONFIG.TOKEN_MINT } },
      ],
    });

    let holders = accounts.map(({ pubkey, account }) => {
      const data = account.data;
      const owner = new PublicKey(data.subarray(TOKEN_ACCOUNT_OWNER_OFFSET, TOKEN_ACCOUNT_OWNER_OFFSET + 32));
      const amount = data.readBigUInt64LE(TOKEN_ACCOUNT_AMOUNT_OFFSET);
      return { owner: owner.toString(), amount: Number(amount) };
    });

    if (holders.length === 0) {
      console.log('  ⚠️  getProgramAccounts returned 0. Trying getTokenLargestAccounts fallback (max 20)...');
      const largest = await connection.getTokenLargestAccounts(mintPubkey);
      if (largest.value && largest.value.length > 0) {
        const infos = await connection.getMultipleAccountsInfo(
          largest.value.map((v) => v.address)
        );
        holders = infos
          .filter((info) => info && info.data && info.data.length >= 72)
          .map((info) => {
            const data = info.data;
            const owner = new PublicKey(data.subarray(TOKEN_ACCOUNT_OWNER_OFFSET, TOKEN_ACCOUNT_OWNER_OFFSET + 32));
            const amount = data.readBigUInt64LE(TOKEN_ACCOUNT_AMOUNT_OFFSET);
            return { owner: owner.toString(), amount: Number(amount) };
          });
      }
    }

    console.log(`  📊 Found ${holders.length} holders`);
    return holders;
  } catch (error) {
    console.error('  ❌ getHolderSnapshots failed:', error.message);
    return [];
  }
}

/**
 * Get transaction history for a holder to determine:
 * - When they first bought (hold duration)
 * - How much they bought vs sold (loyalty check)
 */
async function getHolderTradeHistory(walletAddress) {
  try {
    const response = await fetch(
      `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${CONFIG.HELIUS_API_KEY}&type=SWAP&limit=50`
    );
    const txs = await response.json();

    let totalBought = 0;
    let totalSold = 0;
    let firstBuyTime = null;

    for (const tx of txs) {
      // Filter only transactions involving our token
      const tokenTransfers = tx.tokenTransfers?.filter(
        t => t.mint === CONFIG.TOKEN_MINT
      ) || [];

      for (const transfer of tokenTransfers) {
        if (transfer.toUserAccount === walletAddress) {
          // This is a BUY
          totalBought += transfer.tokenAmount;
          if (!firstBuyTime) firstBuyTime = tx.timestamp;
        } else if (transfer.fromUserAccount === walletAddress) {
          // This is a SELL
          totalSold += transfer.tokenAmount;
        }
      }
    }

    return {
      totalBought,
      totalSold,
      firstBuyTime,
      holdDurationHours: firstBuyTime
        ? (Date.now() / 1000 - firstBuyTime) / 3600
        : 0,
      sellPercentage: totalBought > 0 ? (totalSold / totalBought) * 100 : 0,
    };
  } catch (error) {
    console.error(`  ⚠️  Error fetching history for ${walletAddress}:`, error.message);
    return null;
  }
}

// ═══════════════════════════════════════════
// STEP 3: CALCULATE DRIP SCORES
// ═══════════════════════════════════════════
function calculateDripScore(holderData, tradeHistory, totalSupply) {
  const { owner, amount } = holderData;

  // Check exclusions (only DEV wallet)
  if (CONFIG.EXCLUDED_WALLETS.includes(owner)) {
    return { wallet: owner, score: 0, reason: 'EXCLUDED (dev wallet)' };
  }

  // Check loyalty (sold > 50% = disqualified)
  if (tradeHistory && tradeHistory.sellPercentage > CONFIG.SELL_THRESHOLD_PCT) {
    return { wallet: owner, score: 0, reason: `DISQUALIFIED (sold ${tradeHistory.sellPercentage.toFixed(1)}%)` };
  }

  // Calculate hold amount score (capped at 3%) — amount & totalSupply in raw units
  const holdPct = totalSupply > 0 ? (amount / totalSupply) * 100 : 0;
  const cappedPct = Math.min(holdPct, CONFIG.MAX_HOLDER_CAP_PCT);

  // Calculate duration multiplier
  const holdHours = tradeHistory?.holdDurationHours || 0;
  let durationMultiplier = 0.1; // default: just arrived
  for (const tier of CONFIG.DURATION_MULTIPLIERS) {
    if (holdHours <= tier.maxHours) {
      durationMultiplier = tier.multiplier;
      break;
    }
  }

  // Final DRIP Score
  const score = cappedPct * durationMultiplier;

  return {
    wallet: owner,
    score,
    holdPct: holdPct.toFixed(2),
    cappedPct: cappedPct.toFixed(2),
    holdHours: holdHours.toFixed(1),
    durationMultiplier,
    reason: score > 0 ? 'ELIGIBLE' : 'SCORE_ZERO',
  };
}

// ═══════════════════════════════════════════
// STEP 4: DISTRIBUTE SOL TO HOLDERS
// ═══════════════════════════════════════════
async function distributeDrip(scores, totalSolToDistribute) {
  console.log('\n💧 [STEP 4] Distributing DRIP...');
  if (CONFIG.DRY_RUN) {
    console.log('  ⚠️  DRY RUN — skipping actual transfers');
  }
  console.log(`  💰 Total to distribute: ${totalSolToDistribute} SOL`);

  const connection = new Connection(CONFIG.RPC_ENDPOINT, 'confirmed');
  const treasuryKeypair = Keypair.fromSecretKey(bs58.decode(CONFIG.TREASURY_PRIVATE_KEY));

  // Filter eligible holders
  const eligible = scores.filter(s => s.score > 0);
  const totalScore = eligible.reduce((sum, s) => sum + s.score, 0);

  if (totalScore === 0 || eligible.length === 0) {
    console.log('  ⚠️  No eligible holders for this drip cycle.');
    return [];
  }

  console.log(`  👥 ${eligible.length} eligible holders (total score: ${totalScore.toFixed(4)})`);

  // Calculate each holder's share
  const distributions = eligible.map(holder => ({
    wallet: holder.wallet,
    score: holder.score,
    sharePct: (holder.score / totalScore) * 100,
    amountSOL: (holder.score / totalScore) * totalSolToDistribute,
    amountLamports: Math.floor(((holder.score / totalScore) * totalSolToDistribute) * LAMPORTS_PER_SOL),
  })).filter(d => d.amountSOL >= CONFIG.MIN_DRIP_AMOUNT_SOL);

  console.log(`  📤 Sending to ${distributions.length} holders (after min filter):`);
  distributions.forEach(d => {
    console.log(`     ${d.wallet.slice(0, 8)}... → ${d.amountSOL.toFixed(6)} SOL (${d.sharePct.toFixed(1)}%)`);
  });

  if (CONFIG.DRY_RUN) {
    console.log('  ✅ DRY RUN complete. No SOL sent.');
    return [{ batch: 1, signature: 'dry-run', recipients: distributions.length }];
  }

  // Send in batches
  const results = [];
  for (let i = 0; i < distributions.length; i += CONFIG.TX_BATCH_SIZE) {
    const batch = distributions.slice(i, i + CONFIG.TX_BATCH_SIZE);

    const transaction = new Transaction();
    for (const dist of batch) {
      transaction.add(
        SystemProgram.transfer({
          fromPubkey: treasuryKeypair.publicKey,
          toPubkey: new PublicKey(dist.wallet),
          lamports: dist.amountLamports,
        })
      );
    }

    try {
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = treasuryKeypair.publicKey;
      transaction.sign(treasuryKeypair);

      const signature = await connection.sendRawTransaction(transaction.serialize());
      await connection.confirmTransaction(signature, 'confirmed');

      console.log(`  ✅ Batch ${Math.floor(i / CONFIG.TX_BATCH_SIZE) + 1} sent. TX: ${signature}`);
      results.push({ batch: Math.floor(i / CONFIG.TX_BATCH_SIZE) + 1, signature, recipients: batch.length });
    } catch (error) {
      console.error(`  ❌ Batch ${Math.floor(i / CONFIG.TX_BATCH_SIZE) + 1} failed:`, error.message);
    }

    // Small delay between batches
    await new Promise(r => setTimeout(r, 1000));
  }

  return results;
}

// ═══════════════════════════════════════════
// STEP 5: GENERATE DRIP REPORT (for X posts)
// ═══════════════════════════════════════════
function generateDripReport(distributions, totalDistributed, txResults) {
  const now = new Date().toISOString();
  const report = {
    timestamp: now,
    totalDistributedSOL: totalDistributed,
    recipientCount: distributions.length,
    transactions: txResults,
    topRecipients: distributions
      .sort((a, b) => b.amountSOL - a.amountSOL)
      .slice(0, 5)
      .map(d => ({
        wallet: d.wallet.slice(0, 4) + '...' + d.wallet.slice(-4),
        amount: d.amountSOL.toFixed(6) + ' SOL',
        score: d.score.toFixed(4),
      })),
  };

  // Generate tweet-ready text
  const tweet = `💧 DRIP REPORT #${Math.floor(Date.now() / 1000)}

✅ ${totalDistributed.toFixed(4)} SOL redistributed
👥 ${distributions.length} diamond hand holders rewarded
🔗 On-chain proof: solscan.io/tx/${txResults[0]?.signature || 'pending'}

Hold $DRIP → Earn SOL. Every hour. Automatically.

The longer you hold, the more you drip 💎🤲`;

  console.log('\n═══════════════════════════════════');
  console.log('📋 DRIP REPORT');
  console.log('═══════════════════════════════════');
  console.log(JSON.stringify(report, null, 2));
  console.log('\n🐦 TWEET TEMPLATE:');
  console.log(tweet);

  return { report, tweet };
}

// ═══════════════════════════════════════════
// MAIN: RUN DRIP CYCLE
// ═══════════════════════════════════════════
async function runDripCycle() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  💧 DRIP CYCLE STARTING...                ║');
  console.log('║  ' + new Date().toISOString() + '       ║');
  console.log('╚═══════════════════════════════════════════╝');

  const connection = new Connection(CONFIG.RPC_ENDPOINT, 'confirmed');

  // 1. Check treasury balance BEFORE claiming
  const treasuryKeypair = Keypair.fromSecretKey(bs58.decode(CONFIG.TREASURY_PRIVATE_KEY));
  const balanceBefore = await connection.getBalance(treasuryKeypair.publicKey);
  console.log(`  💰 Treasury balance before claim: ${balanceBefore / LAMPORTS_PER_SOL} SOL`);

  // 2. Claim creator fees
  await claimCreatorFees();

  // Small delay for tx confirmation
  await new Promise(r => setTimeout(r, 3000));

  // 3. Check balance AFTER claiming (difference = fees earned)
  const balanceAfter = await connection.getBalance(treasuryKeypair.publicKey);
  const feesEarned = (balanceAfter - balanceBefore) / LAMPORTS_PER_SOL;
  console.log(`  💰 Treasury balance after claim: ${balanceAfter / LAMPORTS_PER_SOL} SOL`);
  console.log(`  💰 Fees earned this cycle: ${feesEarned} SOL`);

  // Keep 10% for tx fees, distribute 90%
  let toDistribute = feesEarned * 0.90;
  const keepForFees = feesEarned * 0.10;

  if (toDistribute < CONFIG.MIN_DRIP_AMOUNT_SOL) {
    if (CONFIG.DRY_RUN) {
      toDistribute = 0.1; // Fake amount to run full pipeline (holders + scores + report)
      console.log('  ⚠️  No fees this cycle. DRY RUN: using 0.1 SOL (fake) to run full pipeline.');
    } else {
      console.log('  ⚠️  Not enough fees to distribute. Waiting for next cycle.');
      return;
    }
  }

  // 4. Get all holders
  const holders = await getHolderSnapshots();
  const totalSupply = CONFIG.TOKEN_SUPPLY_RAW; // 1B tokens in raw units (with decimals)

  // 5. Calculate DRIP scores for each holder
  console.log('\n💧 [STEP 3] Calculating DRIP scores...');
  const scores = [];
  for (const holder of holders) {
    const history = await getHolderTradeHistory(holder.owner);
    const score = calculateDripScore(holder, history, totalSupply);
    scores.push(score);

    if (score.score > 0) {
      console.log(`  ✓ ${score.wallet.slice(0, 8)}... | Hold: ${score.holdPct}% | ${score.holdHours}h | x${score.durationMultiplier} | Score: ${score.score.toFixed(4)}`);
    }
  }

  // 6. Distribute
  const eligible = scores.filter(s => s.score > 0);
  const totalScore = eligible.reduce((sum, s) => sum + s.score, 0);

  const distributions = eligible.map(s => ({
    wallet: s.wallet,
    score: s.score,
    sharePct: (s.score / totalScore) * 100,
    amountSOL: (s.score / totalScore) * toDistribute,
    amountLamports: Math.floor(((s.score / totalScore) * toDistribute) * LAMPORTS_PER_SOL),
  })).filter(d => d.amountSOL >= CONFIG.MIN_DRIP_AMOUNT_SOL);

  const txResults = await distributeDrip(scores, toDistribute);

  // 7. Generate report
  const { report } = generateDripReport(distributions, toDistribute, txResults);

  // 8. Save to Supabase (if configured)
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    const { saveCycleToSupabase } = await import('./lib/supabase.js');
    await saveCycleToSupabase(report);
  }

  console.log('\n✅ DRIP CYCLE COMPLETE\n');
}

// ═══════════════════════════════════════════
// ENTRY POINT: Run once or in loop
// ═══════════════════════════════════════════
const args = process.argv.slice(2);
if (args.includes('--dry-run')) {
  CONFIG.DRY_RUN = true;
}

if (args.includes('--once')) {
  // Single run
  runDripCycle().catch(console.error);
} else if (args.includes('--loop')) {
  // Continuous loop
  console.log(`🔄 Starting DRIP bot in loop mode (every ${CONFIG.DRIP_INTERVAL_MS / 60000} min)`);
  runDripCycle().catch(console.error);
  setInterval(() => runDripCycle().catch(console.error), CONFIG.DRIP_INTERVAL_MS);
} else {
  console.log(`
💧 DRIP BOT V1 — Usage:
  node drip-bot.js --once        Run a single drip cycle
  node drip-bot.js --once --dry-run   Same but skip distribution (no SOL sent)
  node drip-bot.js --loop        Run continuously (every ${CONFIG.DRIP_INTERVAL_MS / 60000} min)
  
⚙️  Configure via .env file (see .env.example)
  `);
}
