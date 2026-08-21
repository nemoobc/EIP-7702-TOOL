#!/usr/bin/env node
'use strict';
// TEST APPROVAL MANAGER — scan + revoke Self & Sponsor (EIP-7702 atomic) di Sepolia
const { ethers } = require('ethers');
const fs = require('fs');
const {
  REVOKE_APPROVAL_SOURCE, WIZARD_ERC20_TEMPLATE, compileContract,
  scanApprovals, sendAtomicRescue, getDelegatedContract
} = require('./EIP-7702-TOOL.js');

const RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';
const CHAIN_ID = 11155111;
const sleep = ms => new Promise(r => setTimeout(r, ms));
let passed = 0, failed = 0;
function ok(n, x) { passed++; console.log(`  ✅ PASS: ${n}${x ? ' — ' + x : ''}`); }
function fail(n, e) { failed++; console.log(`  ❌ FAIL: ${n} — ${e}`); }

(async () => {
  console.log('='.repeat(60));
  console.log('  TEST APPROVAL MANAGER (SEPOLIA)');
  console.log('='.repeat(60));
  const master = new ethers.Wallet(JSON.parse(fs.readFileSync('test-wallet.json', 'utf8')).privateKey);
  const provider = new ethers.JsonRpcProvider(RPC_URL, CHAIN_ID);
  const bal = await provider.getBalance(master.address);
  console.log(`Master: ${master.address} | saldo: ${ethers.formatEther(bal)} ETH\n`);
  if (bal < ethers.parseEther('0.02')) { console.log('❌ Saldo master < 0.02 ETH, fund dulu.'); process.exit(1); }

  const victim = ethers.Wallet.createRandom();
  const spender = ethers.Wallet.createRandom().address;
  console.log(`Victim : ${victim.address}`);
  console.log(`Spender: ${spender}\n`);

  // 0. Fund victim
  let tx = await master.connect(provider).sendTransaction({ to: victim.address, value: ethers.parseEther('0.005'), gasLimit: 100000n });
  await tx.wait();

  // 1. Deploy token + mint ke victim
  console.log('[1] Deploy ERC20 + mint ke victim...');
  const source = WIZARD_ERC20_TEMPLATE('ApprToken', 'APR', '1000000', ['mintable']);
  const artifact = compileContract(source, 'ApprToken');
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, master.connect(provider));
  const token = await factory.deploy();
  await token.waitForDeployment();
  const tokenAddr = await token.getAddress();
  await (await token.mint(victim.address, ethers.parseUnits('5000', 18))).wait();
  ok('Deploy ERC20 + mint', tokenAddr);

  // 2. Victim approve spender
  console.log('[2] Victim approve spender 1000 APR...');
  const amt = ethers.parseUnits('1000', 18);
  tx = await token.connect(new ethers.Wallet(victim.privateKey, provider)).approve(spender, amt);
  await tx.wait(); await sleep(2000);

  // 3. Scan approvals
  console.log('[3] scanApprovals (event log + allowance, token kustom)...');
  const found = await scanApprovals(victim.address, provider, [{ symbol: null, address: ethers.getAddress(tokenAddr) }]);
  const hit = found.find(a =>
    a.address.toLowerCase() === tokenAddr.toLowerCase() && a.spender.toLowerCase() === spender.toLowerCase());
  if (hit && hit.allowance === amt) ok('Scan menemukan approval aktif', `${hit.symbol} spender ${spender.slice(0,10)}...`);
  else fail('Scan menemukan approval aktif', JSON.stringify(found));

  // 4. Self revoke
  console.log('[4] Self revoke (owner bayar gas)...');
  const erc20 = ['function approve(address,uint256) returns (bool)'];
  tx = await new ethers.Contract(tokenAddr, erc20, new ethers.Wallet(victim.privateKey, provider)).approve(spender, 0n);
  await tx.wait(); await sleep(2000);
  if ((await token.allowance(victim.address, spender)) === 0n) ok('Self revoke — allowance = 0');
  else fail('Self revoke', 'allowance belum 0');

  // 5. Sponsor revoke via EIP-7702 atomic
  console.log('[5] Approve ulang lalu sponsor revoke via EIP-7702...');
  tx = await token.connect(new ethers.Wallet(victim.privateKey, provider)).approve(spender, amt);
  await tx.wait();

  const rArtifact = compileContract(REVOKE_APPROVAL_SOURCE, 'approvalRevoker');
  const rFactory = new ethers.ContractFactory(rArtifact.abi, rArtifact.bytecode, master.connect(provider));
  const revoker = await rFactory.deploy(master.address); // rescuer = sponsor (master)
  await revoker.waitForDeployment();
  const revokerAddr = await revoker.getAddress();
  console.log(`    approvalRevoker: ${revokerAddr}`);

  const iface = new ethers.Interface(rArtifact.abi);
  const callData = iface.encodeFunctionData('revoke', [[tokenAddr], [spender]]);
  const success = await sendAtomicRescue(victim.privateKey, revokerAddr, RPC_URL, undefined, master.privateKey, callData);
  if (!success) { fail('Sponsor revoke (EIP-7702 atomic)', 'tx gagal'); }
  else {
    for (let i = 0; i < 15; i++) {
      await sleep(2000);
      if ((await token.allowance(victim.address, spender)) === 0n) break;
    }
    if ((await token.allowance(victim.address, spender)) === 0n) ok('Sponsor revoke — allowance = 0 (sponsor bayar gas)');
    else fail('Sponsor revoke', 'allowance belum 0');
    const code = await getDelegatedContract(victim.address, provider);
    if (code && code.toLowerCase() === revokerAddr.toLowerCase()) ok('Victim terdelegasi ke approvalRevoker', code.slice(0, 12) + '...');
    else fail('Cek delegasi', String(code));
  }

  console.log('\n' + '='.repeat(60));
  console.log(`  HASIL: ✅ ${passed} PASS | ❌ ${failed} FAIL`);
  console.log('='.repeat(60));
  process.exit(failed > 0 ? 1 : 0);
})().catch(e => { console.error('Fatal:', e.shortMessage || e.message); process.exit(1); });
