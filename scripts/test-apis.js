/**
 * 💧 DRIP Bot — API test script (no SOL sent)
 *
 * Tests:
 * 1. Helius: get holders for a token (v0/token-accounts or RPC fallback)
 * 2. Helius: get transaction history for one holder
 * 3. PumpPortal: collectCreatorFee (optional, requires treasury)
 *
 * Usage:
 *   Set in .env: HELIUS_API_KEY, TOKEN_MINT (use a real pump.fun token for testing)
 *   node scripts/test-apis.js
 *   node scripts/test-apis.js --helius-only
 *   node scripts/test-apis.js --pumpportal-only
 */

import fetch from 'node-fetch';
import 'dotenv/config';

const HELIUS_API_KEY = process.env.HELIUS_API_KEY || '';
const TOKEN_MINT = process.env.TOKEN_MINT || '';
const PUMPPORTAL_API_KEY = process.env.PUMPPORTAL_API_KEY || '';
const TREASURY_PRIVATE_KEY = process.env.TREASURY_PRIVATE_KEY || '';

// Known pump.fun token for testing (replace with any valid mint if you prefer)
const FALLBACK_TEST_MINT = '6nsxY5NVBvR3eL6bXxEmFLaNfJA2FhWoZQz4pUVn5b7C'; // example — use a real one

const MINT = TOKEN_MINT || FALLBACK_TEST_MINT;

async function testHeliusTokenAccounts() {
  console.log('\n💧 [TEST 1] Helius — Get token holders (v0/token-accounts)...');
  if (!HELIUS_API_KEY) {
    console.log('  ⚠️  HELIUS_API_KEY not set. Skip or add to .env');
    return null;
  }

  try {
    const url = `https://api.helius.xyz/v0/token-accounts?api-key=${HELIUS_API_KEY}`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mint: MINT, limit: 100 }),
    });

    const data = await response.json();
    console.log('  Status:', response.status);
    console.log('  Response keys:', Object.keys(data));

    if (data.token_accounts && Array.isArray(data.token_accounts)) {
      console.log('  ✅ token_accounts count:', data.token_accounts.length);
      const first = data.token_accounts[0];
      if (first) {
        console.log('  First holder shape:', { owner: first.owner, amount: first.amount, mint: first.mint });
      }
      return data.token_accounts;
    }

    // If v0 API returned something else, try RPC getTokenAccounts (by mint via Helius RPC)
    if (response.status !== 200 || data.error) {
      console.log('  ⚠️  v0 API response:', JSON.stringify(data).slice(0, 300));
      console.log('  Trying RPC getTokenLargestAccounts for same mint...');
      return await testHeliusRpcLargestAccounts();
    }

    return data.token_accounts || [];
  } catch (err) {
    console.error('  ❌', err.message);
    return null;
  }
}

async function testHeliusRpcLargestAccounts() {
  const rpcUrl = `https://mainnet.helius-rpc.com/?api-key=${HELIUS_API_KEY}`;
  const response = await fetch(rpcUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: '1',
      method: 'getTokenLargestAccounts',
      params: [MINT],
    }),
  });
  const data = await response.json();
  if (data.result && data.result.value) {
    console.log('  ✅ getTokenLargestAccounts count:', data.result.value.length);
    console.log('  Note: RPC returns token account addresses, not owner wallets. Bot needs v0 API or getProgramAccounts for full holder list.');
    return data.result.value;
  }
  console.log('  RPC response:', JSON.stringify(data).slice(0, 200));
  return null;
}

async function testHeliusTransactionHistory(walletAddress) {
  console.log('\n💧 [TEST 2] Helius — Get transaction history for one wallet...');
  if (!HELIUS_API_KEY) {
    console.log('  ⚠️  HELIUS_API_KEY not set.');
    return null;
  }

  try {
    const url = `https://api.helius.xyz/v0/addresses/${walletAddress}/transactions?api-key=${HELIUS_API_KEY}&type=SWAP&limit=10`;
    const response = await fetch(url);
    const txs = await response.json();
    console.log('  Status:', response.status);
    if (Array.isArray(txs)) {
      console.log('  ✅ Transactions count:', txs.length);
      const first = txs[0];
      if (first) {
        console.log('  First tx keys:', Object.keys(first));
        console.log('  tokenTransfers present:', !!first.tokenTransfers);
      }
      return txs;
    }
    console.log('  Response (sample):', JSON.stringify(txs).slice(0, 250));
    return txs;
  } catch (err) {
    console.error('  ❌', err.message);
    return null;
  }
}

async function testPumpPortalClaim() {
  console.log('\n💧 [TEST 3] PumpPortal — collectCreatorFee (dry check)...');
  if (PUMPPORTAL_API_KEY) {
    try {
      const response = await fetch(
        `https://pumpportal.fun/api/trade?api-key=${PUMPPORTAL_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'collectCreatorFee', priorityFee: 0.000001 }),
        }
      );
      const data = await response.json();
      console.log('  Status:', response.status);
      console.log('  Response:', typeof data === 'object' ? JSON.stringify(data).slice(0, 200) : data);
      return data;
    } catch (err) {
      console.error('  ❌', err.message);
      return null;
    }
  }
  if (TREASURY_PRIVATE_KEY) {
    console.log('  Using trade-local (no API key). POST to trade-local...');
    try {
      const { Keypair } = await import('@solana/web3.js');
      const bs58 = await import('bs58');
      const kp = Keypair.fromSecretKey(bs58.default.decode(TREASURY_PRIVATE_KEY));
      const response = await fetch('https://pumpportal.fun/api/trade-local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          publicKey: kp.publicKey.toString(),
          action: 'collectCreatorFee',
          priorityFee: 0.000001,
        }),
      });
      console.log('  Status:', response.status);
      if (response.status === 200 && response.headers.get('content-type')?.includes('application/octet-stream')) {
        console.log('  ✅ Returns serialized transaction (arrayBuffer)');
        return { ok: true, type: 'serialized_tx' };
      }
      const text = await response.text();
      console.log('  Body:', text.slice(0, 200));
      return { ok: response.status === 200, body: text };
    } catch (err) {
      console.error('  ❌', err.message);
      return null;
    }
  }
  console.log('  ⚠️  No PUMPPORTAL_API_KEY or TREASURY_PRIVATE_KEY. Skipping.');
  return null;
}

async function main() {
  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  💧 DRIP Bot — API Tests                  ║');
  console.log('║  Token mint:', MINT.slice(0, 8) + '...');
  console.log('╚═══════════════════════════════════════════╝');

  const heliusOnly = process.argv.includes('--helius-only');
  const pumpportalOnly = process.argv.includes('--pumpportal-only');

  let holders = null;
  if (!pumpportalOnly) {
    holders = await testHeliusTokenAccounts();
    if (holders && holders.length > 0 && holders[0].owner) {
      await testHeliusTransactionHistory(holders[0].owner);
    } else if (holders && holders.length > 0) {
      console.log('  ⚠️  First item has no .owner — check API response shape for getTokenLargestAccounts');
    }
  }

  if (!heliusOnly) {
    await testPumpPortalClaim();
  }

  console.log('\n✅ API test run finished.\n');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
