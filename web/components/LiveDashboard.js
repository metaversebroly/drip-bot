'use client';

import { useEffect, useState } from 'react';
import { getSupabase } from '@/lib/supabase';

const TOKEN_MINT = process.env.NEXT_PUBLIC_TOKEN_MINT || '';
const DRIP_INTERVAL_MS = 30 * 60 * 1000; // 30 min

const DURATION_TIERS = [
  { maxHours: 0.5, tier: '🏃 Sniper', mult: 0.1 },
  { maxHours: 2, tier: '🚶 Tourist', mult: 0.5 },
  { maxHours: 6, tier: '💪 Believer', mult: 1.0 },
  { maxHours: 24, tier: '💎 Diamond', mult: 1.5 },
  { maxHours: Infinity, tier: '👑 OG', mult: 2.0 },
];

function getTierFromScore(dripScore, holdDurationHours) {
  for (const t of DURATION_TIERS) {
    if (holdDurationHours <= t.maxHours) return t.tier;
  }
  return '👑 OG';
}

function truncateWallet(w) {
  if (!w || w.length < 12) return w;
  return `${w.slice(0, 4)}...${w.slice(-4)}`;
}

function formatTime(ms) {
  const m = Math.floor(ms / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

export default function LiveDashboard() {
  const [totalSol, setTotalSol] = useState(0);
  const [holderCount, setHolderCount] = useState(0);
  const [qualifiedCount, setQualifiedCount] = useState(0);
  const [topHolders, setTopHolders] = useState([]);
  const [recentDrips, setRecentDrips] = useState([]);
  const [nextDripTimestamp, setNextDripTimestamp] = useState(null);
  const [nextDripMs, setNextDripMs] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Countdown tick
  useEffect(() => {
    if (!nextDripTimestamp) return;
    const tick = () => {
      const now = Date.now();
      if (now >= nextDripTimestamp) setNextDripMs(0);
      else setNextDripMs(nextDripTimestamp - now);
    };
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, [nextDripTimestamp]);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase || !TOKEN_MINT) {
      setError('Supabase or TOKEN_MINT not configured');
      setLoading(false);
      return;
    }

    async function fetchData() {
      try {
        // Total SOL from drip_history
        const { data: history } = await supabase
          .from('drip_history')
          .select('sol_received')
          .eq('token_mint', TOKEN_MINT);
        const total = (history || []).reduce((s, r) => s + Number(r.sol_received || 0), 0);
        setTotalSol(total);

        // Holders count
        const { count: holdersCount } = await supabase
          .from('holders')
          .select('*', { count: 'exact', head: true })
          .eq('token_mint', TOKEN_MINT);
        setHolderCount(holdersCount || 0);

        // Qualified holders
        const { count: qualCount } = await supabase
          .from('holders')
          .select('*', { count: 'exact', head: true })
          .eq('token_mint', TOKEN_MINT)
          .eq('qualified', true);
        setQualifiedCount(qualCount || 0);

        // Top 10 by drip_score
        const { data: holders } = await supabase
          .from('holders')
          .select('wallet, drip_score, first_seen')
          .eq('token_mint', TOKEN_MINT)
          .eq('qualified', true)
          .gt('drip_score', 0)
          .order('drip_score', { ascending: false })
          .limit(10);
        if (holders) {
          setTopHolders(holders.map((h) => ({
            wallet: h.wallet,
            score: Number(h.drip_score),
            tier: getTierFromScore(h.drip_score, (Date.now() - new Date(h.first_seen).getTime()) / 3600000),
          })));
        }

        // Recent distributions (group by cycle)
        const { data: recent } = await supabase
          .from('drip_history')
          .select('cycle_timestamp, wallet, drip_score, sol_received, hold_duration_hours')
          .eq('token_mint', TOKEN_MINT)
          .order('cycle_timestamp', { ascending: false })
          .limit(50);
        setRecentDrips(recent || []);

        // Next drip countdown (last cycle + 30 min)
        const { data: lastCycle } = await supabase
          .from('drip_history')
          .select('cycle_timestamp')
          .eq('token_mint', TOKEN_MINT)
          .order('cycle_timestamp', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (lastCycle?.cycle_timestamp) {
          const last = new Date(lastCycle.cycle_timestamp).getTime();
          setNextDripTimestamp(last + DRIP_INTERVAL_MS);
        } else {
          setNextDripTimestamp(null);
        }
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    }

    fetchData();

    // Realtime subscription (enable in Supabase: Database → Replication)
    const channel = supabase
      .channel('drip-updates')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drip_history' }, fetchData)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'holders' }, fetchData)
      .subscribe();

    // Poll every 30s as fallback (realtime may not be enabled)
    const poll = setInterval(fetchData, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(poll);
    };
  }, []);

  if (loading) {
    return (
      <section id="dashboard" className="py-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-block w-12 h-12 border-2 border-neon border-t-transparent rounded-full animate-spin" />
          <p className="mt-4 text-gray-500">Loading dashboard...</p>
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section id="dashboard" className="py-20 px-4">
        <div className="max-w-5xl mx-auto text-center">
          <p className="text-red-400">Dashboard error: {error}</p>
        </div>
      </section>
    );
  }

  // Group recent by cycle
  const byCycle = {};
  for (const r of recentDrips) {
    const key = r.cycle_timestamp;
    if (!byCycle[key]) byCycle[key] = [];
    byCycle[key].push(r);
  }
  const cycles = Object.entries(byCycle).slice(0, 5);

  return (
    <section id="dashboard" className="py-20 px-4 scroll-mt-20">
      <div className="max-w-5xl mx-auto">
        <h2 className="text-3xl font-bold text-neon mb-2 flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-neon animate-pulse" />
          Live Dashboard
        </h2>
        <p className="text-gray-500 mb-10">Real-time data from Supabase</p>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-5 shadow-neon-sm">
            <p className="text-2xl font-bold text-neon">{totalSol.toFixed(4)}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">Total SOL Distributed</p>
          </div>
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
            <p className="text-2xl font-bold text-gray-200">{holderCount}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">Holders</p>
          </div>
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
            <p className="text-2xl font-bold text-gray-200">{qualifiedCount}</p>
            <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">Qualified Holders</p>
          </div>
          <div className="bg-dark-800 border border-dark-600 rounded-xl p-5">
            <p className="text-2xl font-bold text-neon">
              {nextDripMs !== null ? formatTime(nextDripMs) : '—'}
            </p>
            <p className="text-xs text-gray-500 uppercase tracking-wider mt-1">Next Drip</p>
          </div>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <div>
            <h3 className="text-lg font-semibold text-gray-300 mb-4">Top 10 by Drip Score</h3>
            <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-dark-700 text-gray-500 text-xs uppercase tracking-wider">
                    <th className="text-left p-3">Wallet</th>
                    <th className="text-left p-3">Score</th>
                    <th className="text-left p-3">Tier</th>
                  </tr>
                </thead>
                <tbody>
                  {topHolders.length === 0 ? (
                    <tr><td colSpan={3} className="p-4 text-gray-500 text-center">No qualified holders yet</td></tr>
                  ) : (
                    topHolders.map((h, i) => (
                      <tr key={h.wallet} className="border-t border-dark-600 hover:bg-dark-700/50">
                        <td className="p-3 font-mono text-gray-400">{truncateWallet(h.wallet)}</td>
                        <td className="p-3 text-neon font-semibold">{h.score.toFixed(4)}</td>
                        <td className="p-3 text-gray-400">{h.tier}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div>
            <h3 className="text-lg font-semibold text-gray-300 mb-4">Recent Distributions</h3>
            <div className="bg-dark-800 border border-dark-600 rounded-xl overflow-hidden max-h-80 overflow-y-auto">
              {cycles.length === 0 ? (
                <p className="p-6 text-gray-500 text-center">No drips yet</p>
              ) : (
                cycles.map(([ts, rows]) => (
                  <div key={ts} className="border-b border-dark-600 last:border-0">
                    <p className="p-3 text-xs text-gray-500 bg-dark-700">
                      {new Date(ts).toLocaleString()}
                    </p>
                    {rows.slice(0, 5).map((r) => (
                      <div key={`${ts}-${r.wallet}`} className="px-3 py-2 flex justify-between text-sm">
                        <span className="font-mono text-gray-400">{truncateWallet(r.wallet)}</span>
                        <span className="text-neon">{Number(r.sol_received).toFixed(4)} SOL</span>
                      </div>
                    ))}
                    {rows.length > 5 && (
                      <p className="px-3 pb-2 text-xs text-gray-500">+{rows.length - 5} more</p>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
