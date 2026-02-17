-- 💧 DRIP Bot — Supabase schema
-- Run this in Supabase Dashboard → SQL Editor

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

-- Optional: index for fast lookups by token
CREATE INDEX IF NOT EXISTS idx_drip_cycles_token_mint ON drip_cycles(token_mint);
CREATE INDEX IF NOT EXISTS idx_drip_cycles_timestamp ON drip_cycles(timestamp DESC);

-- Enable RLS (Row Level Security) — allow anonymous insert for bot, read for anon
ALTER TABLE drip_cycles ENABLE ROW LEVEL SECURITY;

-- Policy: allow insert with anon key (bot uses anon key)
CREATE POLICY "Allow insert for anon" ON drip_cycles
  FOR INSERT TO anon WITH CHECK (true);

-- Policy: allow public read (for dashboard)
CREATE POLICY "Allow public read" ON drip_cycles
  FOR SELECT TO anon USING (true);
