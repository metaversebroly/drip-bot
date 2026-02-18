/**
 * Test getProgramAccounts directly — debug Helius Pro
 */

import { Connection, PublicKey } from '@solana/web3.js';
import 'dotenv/config';

const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const TOKEN_2022 = new PublicKey('TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb');
const TOKEN_MINT = process.env.TOKEN_MINT;
const RPC = process.env.RPC_ENDPOINT || `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;

console.log('🔍 Testing getProgramAccounts...');
console.log('  RPC:', RPC.replace(/api-key=[^&]+/, 'api-key=***'));
console.log('  Mint:', TOKEN_MINT);

const conn = new Connection(RPC, 'confirmed');

async function test(programId, label, filters) {
  try {
    const accounts = await conn.getProgramAccounts(programId, {
      commitment: 'confirmed',
      filters: filters || [],
    });
    console.log(`  ${label}: ${accounts.length} accounts`);
    return accounts.length;
  } catch (err) {
    console.log(`  ${label}: ERROR - ${err.message}`);
    return -1;
  }
}

async function testV2(filters, label, maxPages = 1) {
  let total = 0;
  let paginationKey = null;
  let pages = 0;
  const rpc = process.env.RPC_ENDPOINT || `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
  do {
    const body = {
      jsonrpc: '2.0',
      id: '1',
      method: 'getProgramAccountsV2',
      params: [
        TOKEN_PROGRAM.toString(),
        { encoding: 'base64', filters: filters || [], limit: 2000, ...(paginationKey && { paginationKey }) },
      ],
    };
    const res = await fetch(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.error) {
      console.log(`  ${label}: ERROR - ${data.error.message}`);
      return;
    }
    const accounts = data.result?.accounts || [];
    total += accounts.length;
    paginationKey = data.result?.paginationKey;
    pages++;
    if (pages >= maxPages) break;
  } while (paginationKey);
  console.log(`  ${label}: ${total} accounts (${pages} page(s))`);
}

async function testV2Program(programId, filters, label) {
  let total = 0;
  let paginationKey = null;
  const rpc = process.env.RPC_ENDPOINT || `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;
  do {
    const body = {
      jsonrpc: '2.0',
      id: '1',
      method: 'getProgramAccountsV2',
      params: [
        programId.toString(),
        { encoding: 'base64', filters: filters || [], limit: 2000, ...(paginationKey && { paginationKey }) },
      ],
    };
    const res = await fetch(rpc, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (data.error) {
      console.log(`  ${label}: ERROR - ${data.error.message}`);
      return;
    }
    const accounts = data.result?.accounts || [];
    total += accounts.length;
    paginationKey = data.result?.paginationKey;
  } while (paginationKey);
  console.log(`  ${label}: ${total} accounts`);
}

async function run() {
  console.log('\n--- getProgramAccountsV2 tests ---\n');

  await testV2([{ dataSize: 165 }, { memcmp: { offset: 0, bytes: TOKEN_MINT } }], 'Token Program dataSize+memcmp');
  await testV2([{ memcmp: { offset: 0, bytes: TOKEN_MINT } }], 'Token Program memcmp only', 3);

  await testV2Program(TOKEN_2022, [{ dataSize: 182 }, { memcmp: { offset: 0, bytes: TOKEN_MINT } }], 'Token-2022 dataSize+memcmp');

  const largest = await conn.getTokenLargestAccounts(new PublicKey(TOKEN_MINT));
  console.log('  getTokenLargestAccounts:', largest.value?.length || 0, 'holders');
}

run();
