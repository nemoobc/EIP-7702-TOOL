#!/usr/bin/env node
'use strict';
// AIRDROP AUTO-DETECTOR — tampilan konsisten dengan tool utama
// Usage: node airdrop-check.js <address>
const { ethers } = require('ethers');
const chalk = require('chalk');
const fs = require('fs');
const path = require('path');
const { printBox, printResult } = require('./EIP-7702-TOOL.js');

const RPC = 'https://ethereum-rpc.publicnode.com';
const BLOCKSCOUT = 'https://eth.blockscout.com';
const REGISTRY = JSON.parse(fs.readFileSync(path.join(__dirname, 'network', 'airdrop-registry.json'), 'utf8'));
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

// ===== Klasifikasi: aset nyata / perlu cek manual / spam =====
function classifyToken(t) {
  const tok = t.token || {};
  const dec = Number(tok.decimals || 18);
  const bal = Number(ethers.formatUnits(t.value || 0, dec));
  const rate = parseFloat(tok.exchange_rate || 0);
  const usd = bal * rate;
  const noMarketData = !rate || rate === 0;
  const isHugeBalance = bal >= 1e20;
  const isUnitTrap = noMarketData && bal > 0 && bal <= 10;

  let cat, note;
  if (usd >= 1) {
    cat = 'REAL'; note = '$' + usd.toLocaleString('en', { maximumFractionDigits: 2 });
  } else if (isHugeBalance) {
    cat = 'SPAM'; note = 'saldo tidak masuk akal';
  } else if (isUnitTrap) {
    cat = 'SPAM'; note = 'pola dusting attack';
  } else if (noMarketData) {
    cat = 'UNKNOWN'; note = 'tidak terdaftar di pasar';
  } else {
    cat = 'UNKNOWN'; note = 'nilai kecil ($' + usd.toFixed(4) + ')';
  }
  return { cat, note, bal, usd };
}

// ===== 2. Cek registry: record klaim on-chain per protokol =====
async function checkRegistry(addr, chainId) {
  const ownerTopic = '0x' + addr.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const results = [];
  for (const p of REGISTRY.filter(p => Number(p.chain) === chainId)) {
    try {
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
  printBox('AIRDROP AUTO-DETECTOR', ['Deteksi airdrop & klasifikasi token wallet'], 0, 62);
  printResult('Target', ['Address: ' + address]);

  // Bagian 1: token
  console.log(chalk.blue('\n📡 Memindai token di wallet...'));
  let tokens;
  try {
    tokens = await detectTokens(address);
  } catch (e) {
    printResult('Gagal scan', [e.message.slice(0, 70)]); process.exit(1);
  }

  if (tokens.length === 0) {
    printResult('Hasil', ['✅ Tidak ada token ERC-20 di wallet ini.']);
  } else {
    const groups = { REAL: [], UNKNOWN: [], SPAM: [] };
    for (const t of tokens) groups[classifyToken(t).cat].push(t);

    const showGroup = (list, title, colorFn, iconFn) => {
      console.log('');
      printBox(title + ` (${list.length})`, list.length === 0 ? ['Tidak ada.'] :
        list.slice(0, 10).map(t => {
          const tok = t.token || {};
          const cls = classifyToken(t);
          const balStr = cls.usd >= 1 ? Number(cls.bal).toLocaleString('en', { maximumFractionDigits: 4 })
            : cls.bal >= 1e12 ? cls.bal.toExponential(2)
            : cls.bal < 1 ? cls.bal.toExponential(2) : cls.bal.toLocaleString('en', { maximumFractionDigits: 2 });
          return `${iconFn} ${chalk.bold(tok.symbol || '?')}  ${balStr}${cls.usd >= 1 ? chalk.green(' (' + cls.note + ')') : ''}`;
        }).concat(list.length > 10 ? [chalk.dim(`… dan ${list.length - 10} lainnya`)] : []), 0, 66);
      if (list.length > 0) {
        list.slice(0, 3).forEach((t, i) => {
          const tok = t.token || {};
          const cls = classifyToken(t);
          console.log(colorFn(`   ${i + 1}. ${(tok.symbol || '?')}: ${cls.note}`));
          console.log(chalk.gray(`      ${tok.address_hash || ''}`));
        });
      }
    };

    showGroup(groups.REAL, '✅ ASET NYATA', chalk.green.bind(chalk), '💰');
    showGroup(groups.UNKNOWN, '❓ PERLU CEK MANUAL', chalk.yellow.bind(chalk), '🔍');
    showGroup(groups.SPAM, '⚠ SPAM - JANGAN DIINTERAKSI', chalk.red.bind(chalk), '⛔');

    console.log(chalk.cyan('\n   Total diperiksa: ' + tokens.length + ' token '
      + `(✅ ${groups.REAL.length} · ❓ ${groups.UNKNOWN.length} · 🚨 ${groups.SPAM.length})`));
  }

  // Bagian 2: registry
  console.log(chalk.blue('\n📖 Memeriksa registry protokol...'));
  try {
    const rows = await checkRegistry(address, 1);
    const lines = rows.map(r => {
      const st = r.claimed === true ? chalk.green('✅ SUDAH KLAIM')
        : r.claimed === false ? chalk.gray('⚪ tidak ada record')
        : chalk.yellow('⚠️ gagal: ' + (r.err || ''));
      return `${r.name.padEnd(24)} [${r.status}] ${st}`;
    });
    printBox('REGISTRY PROTOKOL', lines, 0, 66);
  } catch (e) {
    printResult('Registry gagal', [e.message.slice(0, 70)]);
  }

  console.log(chalk.gray('\n💡 Registry masih sampel — versi produksi akan mencakup protokol aktif.\n'));
})().catch(e => { console.error(chalk.red('Fatal:'), e.message); process.exit(1); });
