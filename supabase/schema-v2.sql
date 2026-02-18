-- 💧 DRIP Bot V2 — Cache-based holders + drip history
-- Run this in Supabase Dashboard → SQL Editor
-- Replaces the previous drip_cycles approach with holders cache + drip_history

-- ═══════════════════════════════════════════
-- Table: holders (cache des holders par token)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS holders (
  wallet TEXT NOT NULL,
  token_mint TEXT NOT NULL,
  amount BIGINT NOT NULL DEFAULT 0,
  max_amount BIGINT NOT NULL DEFAULT 0,
  first_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_seen TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  qualified BOOLEAN NOT NULL DEFAULT true,
  drip_score FLOAT NOT NULL DEFAULT 0,
  total_received FLOAT NOT NULL DEFAULT 0,
  PRIMARY KEY (wallet, token_mint)
);

CREATE INDEX IF NOT EXISTS idx_holders_token_mint ON holders(token_mint);
CREATE INDEX IF NOT EXISTS idx_holders_qualified ON holders(token_mint, qualified) WHERE qualified = true;

-- ═══════════════════════════════════════════
-- Table: drip_history (log des distributions)
-- ═══════════════════════════════════════════
CREATE TABLE IF NOT EXISTS drip_history (
  id BIGSERIAL PRIMARY KEY,
  cycle_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  token_mint TEXT NOT NULL,
  wallet TEXT NOT NULL,
  drip_score FLOAT NOT NULL,
  sol_received FLOAT NOT NULL,
  hold_duration_hours FLOAT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_drip_history_token_mint ON drip_history(token_mint);
CREATE INDEX IF NOT EXISTS idx_drip_history_cycle ON drip_history(cycle_timestamp DESC);

-- ═══════════════════════════════════════════
-- Table: drip_cycles (summary par cycle, pour dashboard)
-- ═══════════════════════════════════════════
-- Keep for backward compatibility / dashboard
CREATE TABLE IF NOT EXISTS drip_cycles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token_mint TEXT NOT NULL,
  timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  amount_sol NUMERIC NOT NULL,
  recipient_count INTEGER NOT NULL DEFAULT 0,
  tx_signatures JSONB,
  top_recipients JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ═══════════════════════════════════════════
-- RLS Policies
-- ═══════════════════════════════════════════
ALTER TABLE holders ENABLE ROW LEVEL SECURITY;
ALTER TABLE drip_history ENABLE ROW LEVEL SECURITY;

-- Allow anon (bot + dashboard) full access
CREATE POLICY "holders_anon_all" ON holders FOR ALL TO anon USING (true) WITH CHECK (true);
CREATE POLICY "drip_history_anon_all" ON drip_history FOR ALL TO anon USING (true) WITH CHECK (true);
