/**
 * 💧 DRIP Bot — Supabase client (optional)
 * Saves drip cycle history for dashboard + analytics.
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || '';

export function getSupabaseClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
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

/**
 * Save a drip cycle to Supabase (if configured)
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
