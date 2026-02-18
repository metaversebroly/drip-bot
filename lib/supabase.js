/**
 * 💧 DRIP Bot V2 — Supabase client
 * Holders cache + drip_history. All data in Supabase.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

export function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * Upsert holders from current snapshot.
 * New wallet → INSERT. Existing → UPDATE amount, last_seen, max_amount, qualified.
 */
export async function upsertHolders(tokenMint, currentHolders) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const now = new Date().toISOString();

  // Fetch existing holders for this token
  const { data: existingRows } = await supabase
    .from('holders')
    .select('wallet, max_amount, first_seen')
    .eq('token_mint', tokenMint);

  const existingMap = new Map((existingRows || []).map((r) => [r.wallet, { max_amount: Number(r.max_amount), first_seen: r.first_seen }]));
  const currentWallets = new Set(currentHolders.map((h) => h.owner));

  const toUpsert = currentHolders.map(({ owner: wallet, amount }) => {
    const prev = existingMap.get(wallet);
    const prevMax = prev?.max_amount || 0;
    const newMaxAmount = Math.max(prevMax, amount);
    const qualified = amount >= newMaxAmount * 0.5;

    return {
      wallet,
      token_mint: tokenMint,
      amount,
      max_amount: newMaxAmount,
      first_seen: prev?.first_seen || now,
      last_seen: now,
      qualified,
    };
  });

  if (toUpsert.length > 0) {
    const { error } = await supabase.from('holders').upsert(toUpsert, {
      onConflict: 'wallet,token_mint',
      ignoreDuplicates: false,
    });
    if (error) throw error;
  }

  // Mark wallets NOT in current list as qualified=false (sold everything)
  for (const row of existingRows || []) {
    if (!currentWallets.has(row.wallet)) {
      await supabase
        .from('holders')
        .update({ qualified: false, amount: 0 })
        .eq('wallet', row.wallet)
        .eq('token_mint', tokenMint);
    }
  }
}

/**
 * Get qualified holders with computed drip_score.
 */
export async function getQualifiedHolders(tokenMint, totalSupply, excludedWallets) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const { data: rows, error } = await supabase
    .from('holders')
    .select('*')
    .eq('token_mint', tokenMint)
    .eq('qualified', true);

  if (error) throw error;

  const DURATION_MULTIPLIERS = [
    { maxHours: 0.5, multiplier: 0.1 },   // < 30 min = Sniper
    { maxHours: 2, multiplier: 0.5 },    // 30min - 2h = Tourist
    { maxHours: 6, multiplier: 1.0 },    // 2h - 6h = Believer
    { maxHours: 24, multiplier: 1.5 },   // 6h - 24h = Diamond
    { maxHours: Infinity, multiplier: 2.0 }, // 24h+ = OG
  ];

  const now = Date.now();
  const MAX_HOLDER_CAP_PCT = 2.0;

  const scored = (rows || [])
    .filter((r) => !excludedWallets.includes(r.wallet))
    .map((row) => {
      const firstSeen = new Date(row.first_seen).getTime();
      const holdDurationHours = (now - firstSeen) / (1000 * 3600);

      let multiplier = 0.1;
      for (const tier of DURATION_MULTIPLIERS) {
        if (holdDurationHours <= tier.maxHours) {
          multiplier = tier.multiplier;
          break;
        }
      }

      const holdPct = totalSupply > 0 ? (row.amount / totalSupply) * 100 : 0;
      const cappedPct = Math.min(holdPct, MAX_HOLDER_CAP_PCT);
      const dripScore = cappedPct * multiplier;

      return {
        wallet: row.wallet,
        amount: Number(row.amount),
        dripScore,
        holdDurationHours,
      };
    })
    .filter((r) => r.dripScore > 0);

  return scored;
}

/**
 * Update drip_score in holders (for display).
 */
export async function updateHolderScores(tokenMint, scoredHolders) {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  for (const { wallet, dripScore } of scoredHolders) {
    await supabase
      .from('holders')
      .update({ drip_score: dripScore })
      .eq('wallet', wallet)
      .eq('token_mint', tokenMint);
  }
}

/**
 * Log distribution to drip_history and update total_received.
 */
export async function logDripHistory(tokenMint, distributions) {
  const supabase = getSupabaseClient();
  if (!supabase) throw new Error('Supabase not configured');

  const cycleTs = new Date().toISOString();

  for (const d of distributions) {
    await supabase.from('drip_history').insert({
      cycle_timestamp: cycleTs,
      token_mint: tokenMint,
      wallet: d.wallet,
      drip_score: d.dripScore,
      sol_received: d.amountSOL,
      hold_duration_hours: d.holdDurationHours,
    });
    await incrementTotalReceived(tokenMint, d.wallet, d.amountSOL);
  }
}

/**
 * Increment total_received (simpler: just update)
 */
export async function incrementTotalReceived(tokenMint, wallet, amountSOL) {
  const supabase = getSupabaseClient();
  if (!supabase) return;

  const { data } = await supabase
    .from('holders')
    .select('total_received')
    .eq('wallet', wallet)
    .eq('token_mint', tokenMint)
    .single();

  if (data) {
    await supabase
      .from('holders')
      .update({ total_received: (data.total_received || 0) + amountSOL })
      .eq('wallet', wallet)
      .eq('token_mint', tokenMint);
  }
}

/**
 * Save cycle summary to drip_cycles (for dashboard).
 */
export async function saveCycleToSupabase(cycleData) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('drip_cycles')
      .insert({
        token_mint: process.env.TOKEN_MINT,
        timestamp: cycleData.timestamp,
        amount_sol: cycleData.totalDistributedSOL,
        recipient_count: cycleData.recipientCount,
        tx_signatures: cycleData.transactions,
        top_recipients: cycleData.topRecipients,
      })
      .select()
      .single();

    if (error) {
      console.error('  ⚠️  Supabase save failed:', error.message);
      return null;
    }
    console.log('  ✅ Cycle saved to Supabase');
    return data;
  } catch (err) {
    console.error('  ⚠️  Supabase error:', err.message);
    return null;
  }
}

/**
 * Load drip history from Supabase (for dashboard)
 */
export async function loadHistoryFromSupabase(tokenMint) {
  const supabase = getSupabaseClient();
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('drip_cycles')
      .select('*')
      .eq('token_mint', tokenMint || process.env.TOKEN_MINT)
      .order('timestamp', { ascending: false })
      .limit(100);

    if (error) return null;
    return data;
  } catch {
    return null;
  }
}
