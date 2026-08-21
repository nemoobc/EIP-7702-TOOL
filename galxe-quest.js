#!/usr/bin/env node
'use strict';
// GALXE AUTO-QUEST — PROTOTIPE PENGUJIAN
// Karena API publik Galxe kini butuh session, campaign dibuat sebagai SAMPEL lokal.
// Task ONCHAIN disimulasikan sungguhan via eth_call (dry-run, tanpa kirim TX).
const { ethers } = require('ethers');
const chalk = require('chalk');
const { printBox, printResult } = require('./EIP-7702-TOOL.js');

// ===== Sampel kampanye (bentuk mirin struktur Galxe) =====
const SAMPLE_CAMPAIGN = {
  id: 'GCMP0001',
  name: 'Sample Protocol Testnet Quest',
  tasks: [
    { type: 'SOCIAL', title: 'Follow @sampleproto di X', link: 'https://x.com/sampleproto' },
    { type: 'SOCIAL', title: 'Join Discord sampleproto', link: 'https://discord.gg/sample' },
    { type: 'ONCHAIN', title: 'Swap minimal 0.001 ETH ke USDT di Uniswap', chain: 1,
      action: { kind: 'swap', router: '0x7a250d5630B4cF539739dfF2C5dAcb4c659F2488D',
                path: ['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2', '0xdAC17F958D2ee523a2206206994597C13D831ec7'],
                amountEth: '0.001' } },
    { type: 'QUIZ', title: 'Quiz: apa nama token protokol ini?', answerHint: 'lihat docs' },
    { type: 'CREDENTIAL', title: 'Punya minimal 1 transaksi di mainnet', check: 'txcount' },
  ],
};

const ROUTER_ABI = ['function swapExactETHForTokens(uint256 amountOutMin,address[] path,address to,uint256 deadline) payable returns (uint256[])'];

(async () => {
  const pk = process.env.TEST_PRIVATE_KEY || require('fs').existsSync('test-wallet.json')
    ? (() => { try { return JSON.parse(require('fs').readFileSync('test-wallet.json','utf8')).privateKey; } catch(e){ return null; } })()
    : null;
  const provider = new ethers.JsonRpcProvider('https://ethereum-rpc.publicnode.com', 1);
  const wallet = pk ? new ethers.Wallet(pk).connect(provider) : null;
  const from = wallet ? wallet.address : ethers.Wallet.createRandom().address;

  printBox('GALXE AUTO-QUEST', [`Kampanye: ${SAMPLE_CAMPAIGN.name}`, `Wallet  : ${from}`, 'MODE: DRY-RUN (tanpa kirim TX)'], 0, 66);

  const plan = { AUTO: [], SEMI: [], MANUAL: [] };
  const simResult = { ok: 0, fail: 0 };
  for (const task of SAMPLE_CAMPAIGN.tasks) {
    if (task.type === 'ONCHAIN') plan.AUTO.push(task);
    else if (task.type === 'QUIZ') plan.SEMI.push(task);
    else plan.MANUAL.push(task); // SOCIAL & CREDENTIAL
  }

  // ===== Task ONCHAIN: dry-run sungguhan via eth_call =====
  if (plan.AUTO.length > 0) {
    console.log(chalk.blue('\n⚙️  Menyiapkan eksekusi task ONCHAIN (simulasi)...'));
    for (const task of plan.AUTO) {
      if (task.action.kind !== 'swap') continue;
      const router = new ethers.Contract(task.action.router, ROUTER_ABI, provider);
      const data = router.interface.encodeFunctionData('swapExactETHForTokens', [
        1n, // slippage min absolut (testing)
        task.action.path,
        from,
        Math.floor(Date.now() / 1000) + 600,
      ]);
      try {
        await provider.call({ from, to: task.action.router, data, value: ethers.parseEther(task.action.amountEth), gasLimit: 300000n });
        simResult.ok++;
        console.log(chalk.green(`   ✅ SIMULASI LOLOS: ${task.title}`));
        console.log(chalk.dim(`      TX siap dikirim (${task.action.amountEth} ETH + gas). Mode testing: TIDAK dikirim.`));
      } catch (e) {
        simResult.fail++;
        const reason = String(e?.message || '');
        console.log(chalk.yellow(`   ⚠️  Simulasi revert (wajar di testing): ${reason.slice(0, 80)}`));
        console.log(chalk.dim(`      Calldata tetap tersiapkan untuk mode produksi.`));
      }
    }
  }

  // ===== Task QUIZ: semi-auto =====
  if (plan.SEMI.length > 0) {
    console.log(chalk.blue('\n🧠 Task QUIZ (semi-auto — jawaban manual):'));
    plan.SEMI.forEach(t => console.log(chalk.yellow(`   ❓ ${t.title} ${chalk.dim(`[${t.answerHint}]`)}`)));
  }

  // ===== Task MANUAL =====
  if (plan.MANUAL.length > 0) {
    console.log(chalk.blue('\n📋 Task MANUAL (checklist — jangan diotomasi demi keamanan akun sosial):'));
    plan.MANUAL.forEach((t, i) => {
      console.log(chalk.cyan(`   [ ] ${t.title}`) + chalk.gray(`  ${t.link || ''}`));
    });
  }

  // ===== Ringkasan =====
  printBox('RENCANA EKSEKUSI', [
    `⚡ Auto (on-chain) : ${plan.AUTO.length} task (simulasi ✅${simResult.ok} / ⚠️${simResult.fail})`,
    `🧠 Semi-auto (quiz): ${plan.SEMI.length} task`,
    `📋 Manual          : ${plan.MANUAL.length} task`,
    chalkDim('Produksi: tambah auth Galxe + auto-submit verifikasi'),
  ], 0, 66);

  function chalkDim(s){ return '\x1b[2m' + s + '\x1b[0m'; }
})().catch(e => { console.error(chalk.red('Fatal:'), e.message); process.exit(1); });
