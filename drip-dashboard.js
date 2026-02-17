/**
 * 💧 DRIP DASHBOARD — Generates public drip reports
 *
 * Data source: Supabase (if configured) or drip-history.json
 */

import fs from 'fs';
import 'dotenv/config';

const HISTORY_FILE = './drip-history.json';

function loadHistorySync() {
  try {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  } catch {
    return { cycles: [], totalDistributed: 0, totalRecipients: 0 };
  }
}

async function loadHistory() {
  if (process.env.SUPABASE_URL && process.env.SUPABASE_ANON_KEY) {
    const { loadHistoryFromSupabase } = await import('./lib/supabase.js');
    const rows = await loadHistoryFromSupabase(process.env.TOKEN_MINT);
    if (rows && rows.length > 0) {
      const cycles = rows.map((r) => ({
        timestamp: r.timestamp,
        amountSOL: Number(r.amount_sol),
        recipients: (r.top_recipients || []).map((rec) => ({
          wallet: rec.wallet,
          score: rec.score,
          amount: typeof rec.amount === 'string' ? rec.amount.replace(' SOL', '') : rec.amount,
          holdTime: 'N/A',
        })),
      }));
      const totalDistributed = cycles.reduce((s, c) => s + c.amountSOL, 0);
      const totalRecipients = new Set(cycles.flatMap((c) => c.recipients.map((r) => r.wallet))).size;
      return { cycles, totalDistributed, totalRecipients };
    }
  }
  return loadHistorySync();
}

function saveCycle(cycleData) {
  const history = loadHistorySync();
  history.cycles.push(cycleData);
  history.totalDistributed += cycleData.amountSOL;
  history.totalRecipients = new Set(
    history.cycles.flatMap(c => c.recipients.map(r => r.wallet))
  ).size;
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
  return history;
}

function generateHTML(history) {
  const latestCycle = history.cycles[history.cycles.length - 1];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>💧 DRIP Dashboard</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #0a0a0f;
      color: #e0e0e0;
      font-family: 'JetBrains Mono', 'Fira Code', monospace;
      padding: 40px;
    }
    .container { max-width: 800px; margin: 0 auto; }
    .header {
      text-align: center;
      margin-bottom: 40px;
    }
    .header h1 {
      font-size: 48px;
      background: linear-gradient(135deg, #00d4ff, #7b2ff7);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 8px;
    }
    .header .subtitle {
      color: #888;
      font-size: 14px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
      margin-bottom: 32px;
    }
    .stat-card {
      background: #12121a;
      border: 1px solid #1e1e2e;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
    }
    .stat-card .value {
      font-size: 28px;
      font-weight: bold;
      color: #00d4ff;
      margin-bottom: 4px;
    }
    .stat-card .label {
      font-size: 11px;
      color: #666;
      text-transform: uppercase;
      letter-spacing: 1px;
    }
    .drip-table {
      width: 100%;
      background: #12121a;
      border: 1px solid #1e1e2e;
      border-radius: 12px;
      overflow: hidden;
      margin-bottom: 32px;
    }
    .drip-table th {
      background: #1a1a2e;
      padding: 12px 16px;
      text-align: left;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #666;
    }
    .drip-table td {
      padding: 12px 16px;
      border-top: 1px solid #1e1e2e;
      font-size: 13px;
    }
    .drip-table tr:hover td {
      background: #1a1a25;
    }
    .amount { color: #00ff88; font-weight: bold; }
    .score { color: #7b2ff7; }
    .wallet { color: #888; font-family: monospace; }
    .footer {
      text-align: center;
      color: #444;
      font-size: 12px;
      margin-top: 40px;
    }
    .live-dot {
      display: inline-block;
      width: 8px;
      height: 8px;
      background: #00ff88;
      border-radius: 50%;
      margin-right: 6px;
      animation: pulse 2s infinite;
    }
    @keyframes pulse {
      0%, 100% { opacity: 1; }
      50% { opacity: 0.3; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>💧 DRIP</h1>
      <p class="subtitle">
        <span class="live-dot"></span>
        Creator Fee Redistribution Protocol — Live Dashboard
      </p>
    </div>

    <div class="stats-grid">
      <div class="stat-card">
        <div class="value">${history.totalDistributed.toFixed(4)}</div>
        <div class="label">Total SOL Distributed</div>
      </div>
      <div class="stat-card">
        <div class="value">${history.cycles.length}</div>
        <div class="label">Drip Cycles</div>
      </div>
      <div class="stat-card">
        <div class="value">${history.totalRecipients}</div>
        <div class="label">Unique Recipients</div>
      </div>
    </div>

    ${latestCycle ? `
    <h3 style="margin-bottom: 12px; color: #888; font-size: 13px;">
      LATEST DRIP — ${new Date(latestCycle.timestamp).toLocaleString()}
    </h3>
    <table class="drip-table">
      <thead>
        <tr>
          <th>Wallet</th>
          <th>DRIP Score</th>
          <th>Amount</th>
          <th>Hold Time</th>
        </tr>
      </thead>
      <tbody>
        ${latestCycle.recipients.map(r => `
        <tr>
          <td class="wallet">${r.wallet}</td>
          <td class="score">${r.score}</td>
          <td class="amount">${r.amount} SOL</td>
          <td>${r.holdTime || 'N/A'}</td>
        </tr>
        `).join('')}
      </tbody>
    </table>
    ` : '<p style="text-align:center;color:#666;">No drip cycles yet. First drip coming soon... 💧</p>'}

    <div class="footer">
      <p>DRIP Protocol — 100% of creator fees redistributed to holders</p>
      <p style="margin-top: 4px;">Diamond hands get the drip 💧💎</p>
    </div>
  </div>
</body>
</html>`;

  fs.writeFileSync('./drip-dashboard.html', html);
  console.log('✅ Dashboard HTML generated: drip-dashboard.html');
}

// Generate sample data for testing
function generateSampleData() {
  const sample = {
    cycles: [
      {
        timestamp: new Date().toISOString(),
        amountSOL: 0.45,
        recipients: [
          { wallet: 'Ax3f...k9Wm', score: '2.84', amount: '0.128', holdTime: '48h' },
          { wallet: 'Bp7g...mN2x', score: '2.12', amount: '0.095', holdTime: '36h' },
          { wallet: 'Cv9k...pQ4z', score: '1.50', amount: '0.067', holdTime: '24h' },
          { wallet: 'Dw2m...rS6a', score: '1.05', amount: '0.047', holdTime: '12h' },
          { wallet: 'Ex4n...tU8b', score: '0.89', amount: '0.040', holdTime: '8h' },
          { wallet: 'Fy6p...vW0c', score: '0.75', amount: '0.034', holdTime: '6h' },
          { wallet: 'Gz8q...xY2d', score: '0.45', amount: '0.020', holdTime: '3h' },
          { wallet: 'Ha0r...zA4e', score: '0.30', amount: '0.013', holdTime: '2h' },
        ],
        txSignature: 'sample_tx_signature_here',
      }
    ],
    totalDistributed: 0.45,
    totalRecipients: 8,
  };

  fs.writeFileSync(HISTORY_FILE, JSON.stringify(sample, null, 2));
  return sample;
}

// Run
const args = process.argv.slice(2);
if (args.includes('--sample')) {
  const data = generateSampleData();
  generateHTML(data);
  console.log('📊 Sample dashboard generated with mock data');
} else {
  loadHistory().then((data) => {
    generateHTML(data);
  }).catch((err) => {
    console.error('Failed to load history:', err);
    generateHTML(loadHistorySync());
  });
}
