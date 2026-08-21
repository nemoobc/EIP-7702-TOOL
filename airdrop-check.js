#!/usr/bin/env node
'use strict';
// PROTOTIPE AIRDROP AUTO-DETECTOR (untuk pengujian)
// Keyless: pakai API publik Blockscout. Usage: node airdrop-check.js <address>
const { ethers } = require('ethers');
const fs = require('fs');

const RPC = 'https://ethereum-rpc.publicnode.com';
const BLOCKSCOUT = 'https://eth.blockscout.com';
const REGISTRY = require('./network/airdrop-registry.json');
const address = process.argv[2] || ethers.Wallet.createRandom().address;

async function api(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  return res.json();
}

// ===== 1. Deteksi token yang dimiliki wallet =====
async function detectTokens(addr) {
  const j = await api(`${BLOCKSCOUT}/api/v2/addresses/${addr}/token-balances`);
  const list = Array.isArray(j) ? j : [];
  return list.filter(t => (t.token && t.token.type) === 'ERC-20' && BigInt(t.value || 0) > 0n);
}

// ===== 2. Cek registry: apakah wallet punya record klaim di kontrak protokol =====
async function checkRegistry(addr, chainId) {
  const ownerTopic = '0x' + addr.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const results = [];
  for (const p of REGISTRY.filter(p => Number(p.chain) === chainId)) {
    try {
      // event biasanya indexed address di slot 1 atau 2 — cek keduanya
      let found = false;
      for (const slot of [1, 2]) {
        const topics = [ethers.id(p.eventSignature)];
        topics[slot] = ownerTopic;
        const url = `${BLOCKSCOUT}/api?module=logs&action=getLogs&address=${p.claimContract}` +
          `&topic0=${topics[0]}&topic${slot + 1}=${ownerTopic}&fromBlock=0&toBlock=latest`;
        const j = await api(url);
        if (j.status === '1' && Array.isArray(j.result) && j.result.length > 0) { found = true; break; }
      }
      results.push({ name: p.name, status: p.status, claimed: found });
    } catch (e) {
      results.push({ name: p.name, status: p.status, claimed: null, err: e.message.slice(0, 60) });
    }
  }
  return results;
}

(async () => {
  console.log('='.repeat(62));
  console.log('  AIRDROP AUTO-DETECTOR — MODE PENGUJIAN');
  console.log('='.repeat(62));
  console.log('Wallet :', address);

  // Bagian 1: token holdings
  console.log('\n[1] Token di wallet (kandidat airdrop/drop):');
  let tokens;
  try {
    tokens = await detectTokens(address);
    if (tokens.length === 0) console.log('   (tidak ada token ERC-20)');
    for (const t of tokens.slice(0, 15)) {
      const tok = t.token || {};
      const dec = Number(tok.decimals || 18);
      const bal = ethers.formatUnits(t.value || 0, dec);
      const rate = parseFloat(tok.exchange_rate || 0);
      const usd = rate > 0 ? ' ≈ $' + (parseFloat(bal) * rate).toLocaleString('en', { maximumFractionDigits: 2 }) : '';
      console.log(`   • ${(tok.symbol || '?').padEnd(8)} ${Number(bal).toLocaleString('en', { maximumFractionDigits: 4 })}${usd}`);
      console.log(`     ${chalkDim(tok.name || '')} ${tok.address_hash || ''}`);
    }
    if (tokens.length > 15) console.log(`   … dan ${tokens.length - 15} token lainnya`);
  } catch (e) {
    console.log('   ❌ gagal:', e.message.slice(0, 80));
  }

  // Bagian 2: cek registry protokol
  console.log('\n[2] Registry protokol (cek record klaim on-chain):');
  try {
    const rows = await checkRegistry(address, 1);
    for (const r of rows) {
      const st = r.claimed === true ? '✅ SUDAH KLAIM'
        : r.claimed === false ? '⚪ tidak ada record (belum eligible / belum klaim / bukan penerima)'
        : '⚠️ cek gagal: ' + (r.err || '');
      console.log(`   • ${r.name.padEnd(24)} [${r.status}] ${st}`);
    }
  } catch (e) {
    console.log('   ❌', e.message.slice(0, 80));
  }

  console.log('\n' + '='.repeat(62));
  console.log('Catatan uji: registry masih sampel 3 protokol tertutup.');
  console.log('Produksi: registry diperluas + simulasi claim() untuk protokol aktif.');
})().catch(e => { console.error('Fatal:', e.message); process.exit(1); });

function chalkDim(s) { return '\x1b[2m' + s + '\x1b[0m'; }
