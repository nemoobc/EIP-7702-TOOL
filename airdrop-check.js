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

// ===== Klasifikasi: aset nyata / kandidat airdrop sah / spam =====
function classifyToken(t) {
  const tok = t.token || {};
  const dec = Number(tok.decimals || 18);
  const bal = Number(ethers.formatUnits(t.value || 0, dec));
  const rate = parseFloat(tok.exchange_rate || 0);
  const usd = bal * rate;
  const noMarketData = !rate || rate === 0;
  const isHugeBalance = bal >= 1e20;                  // saldo mustahil = scam umum
  const isUnitTrap = noMarketData && bal > 0 && bal <= 10; // "1 unit" dusting

  let cat, note;
  if (usd >= 1) {
    cat = 'REAL'; note = '$' + usd.toLocaleString('en', { maximumFractionDigits: 2 });
  } else if (isHugeBalance) {
    cat = 'SPAM'; note = 'saldo tidak masuk akal';
  } else if (isUnitTrap) {
    cat = 'SPAM'; note = 'pola dusting attack';
  } else if (noMarketData) {
    cat = 'UNKNOWN'; note = 'tidak terdaftar di pasar — verifikasi manual sebelum interaksi';
  } else {
    cat = 'UNKNOWN'; note = 'nilai kecil ($' + usd.toFixed(4) + ')';
  }
  return { cat, note, bal, usd };
}

(async () => {
  console.log('='.repeat(62));
  console.log('  AIRDROP AUTO-DETECTOR — MODE PENGUJIAN');
  console.log('='.repeat(62));
  console.log('Wallet :', address);

  // Bagian 1: token holdings + klasifikasi
  console.log('\n[1] Token di wallet:');
  let tokens;
  try {
    tokens = await detectTokens(address);
    if (tokens.length === 0) console.log('   (tidak ada token ERC-20)');
    const groups = { REAL: [], UNKNOWN: [], SPAM: [] };
    for (const t of tokens) groups[classifyToken(t).cat].push(t);

    const show = (list, title, colorFn) => {
      console.log(`\n   ${colorFn(title)} (${list.length})`);
      if (list.length === 0) return;
      for (const t of list.slice(0, 12)) {
        const tok = t.token || {};
        const c = classifyToken(t);
        const balStr = c.usd >= 1
          ? Number(c.bal).toLocaleString('en', { maximumFractionDigits: 4 })
          : Number(c.bal).toExponential(2);
        console.log(`   • ${(tok.symbol || '?').padEnd(8)} ${balStr}${c.usd >= 1 ? ' ≈ $' + c.usd.toLocaleString('en', { maximumFractionDigits: 2 }) : ''}`);
        console.log(`     ${chalkDim((tok.name || '') + ' — ' + c.note)} ${tok.address_hash || ''}`);
      }
      if (list.length > 12) console.log(`   … dan ${list.length - 12} lainnya`);
    };

    show(groups.REAL, '✅ ASET NYATA', s => `\x1b[32m${s}\x1b[0m`);
    show(groups.UNKNOWN, '❓ PERLU CEK MANUAL', s => `\x1b[33m${s}\x1b[0m`);
    show(groups.SPAM, '🚨 SPAM — JANGAN DIINTERAKSI', s => `\x1b[31m${s}\x1b[0m`);
    if (tokens.length > 15) console.log(`\n   (total ${tokens.length} token diperiksa)`);
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
