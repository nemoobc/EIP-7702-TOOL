#!/usr/bin/env node
'use strict';
// TEST FULL SUITE di MAINNET FORK (BuildBear/Anvil-compatible RPC)
// Semua fitur dites dengan state mainnet asli (USDT dll), tanpa uang nyata.
const { ethers } = require('ethers');
const fs = require('fs');
const {
  RESCUE_SOURCE, BATCH_SOURCE, AIRDROP_CLAIMER_SOURCE, REVOKE_APPROVAL_SOURCE,
  UUPS_PROXY_TEMPLATE, WIZARD_ERC20_TEMPLATE,
  compileContract, delegateWithViem, getDelegatedContract, sendAtomicRescue,
  scanApprovals, loadConfig, saveConfig
} = require('./EIP-7702-TOOL.js');

const RPC_URL = process.env.FORK_RPC || 'https://virtual.mainnet.eu.rpc.tenderly.co/pst4r8/project/d12d33';
// Wallet tetap yang di-fund via dashboard Tenderly (lihat fork-wallets.json)
const WALLETS = JSON.parse(fs.readFileSync('fork-wallets.json', 'utf8'));
const MASTER_PK = WALLETS.master.privateKey;
const VICTIM_PK = WALLETS.victim.privateKey;
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';

const sleep = ms => new Promise(r => setTimeout(r, ms));
let passed = 0, failed = 0;
function ok(n, x) { passed++; console.log(`  ✅ PASS: ${n}${x ? ' — ' + x : ''}`); }
function fail(n, e) { failed++; console.log(`  ❌ FAIL: ${n} — ${e}`); }
function section(t) { console.log('\n' + '─'.repeat(60) + '\n' + t + '\n' + '─'.repeat(60)); }
function errMsg(e) { return String(e?.shortMessage || e?.message || e?.reason || e).slice(0, 140); }

async function deploy(signer, source, name, args = [], immutables = null) {
  const artifact = compileContract(source, name);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  return { contract, address: await contract.getAddress(), abi: artifact.abi };
}

async function waitDelegation(provider, address) {
  for (let i = 0; i < 20; i++) {
    const code = await provider.getCode(address);
    if (code && code.toLowerCase().startsWith('0xef0100')) return code;
    await sleep(1500);
  }
  return null;
}
async function waitForEoa(provider, address) {
  for (let i = 0; i < 20; i++) {
    if ((await provider.getCode(address)) === '0x') return true;
    await sleep(1500);
  }
  return false;
}

(async () => {
  console.log('='.repeat(60));
  console.log('  FULL SUITE di MAINNET FORK');
  console.log('='.repeat(60));

  // Arahkan config tool ke fork
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const cfg = loadConfig();
  cfg.rpcUrl = RPC_URL; cfg.chainId = Number((await provider.getNetwork()).chainId); cfg.networkName = 'Mainnet Fork';
  saveConfig(cfg);

  const master = new ethers.Wallet(MASTER_PK, provider);
  const victim = new ethers.Wallet(VICTIM_PK, provider);
  const spender = ethers.Wallet.createRandom().address;
  console.log(`Master: ${master.address}`);
  console.log(`Victim: ${victim.address}\n`);

  // ===== 1. RPC & state mainnet =====
  section('🌐 [1] RPC & State Mainnet Asli');
  try {
    const usdt = new ethers.Contract(USDT, ['function totalSupply() view returns (uint256)'], provider);
    const supply = Number(ethers.formatUnits(await usdt.totalSupply(), 6));
    ok('Fork hidup + state mainnet asli', `USDT supply ${Math.round(supply / 1e6)}M`);
  } catch (e) { fail('RPC/state', errMsg(e)); }

  // ===== 2. Cek saldo awal (sudah di-fund via dashboard) =====
  section('💸 [2] Saldo Awal');
  try {
    const bal = await provider.getBalance(victim.address);
    if (bal < ethers.parseEther('0.1')) throw new Error('victim belum di-fund');
    ok('Send ETH ke victim', ethers.formatEther(bal) + ' ETH');
  } catch (e) { fail('Saldo victim', errMsg(e)); }

  // ===== 3. Wizard ERC20 + send token =====
  section('🪙 [3] Wizard Deploy ERC20 + Send Token');
  let token;
  try {
    token = await deploy(master, WIZARD_ERC20_TEMPLATE('ForkToken', 'FRK', '1000000', ['mintable']), 'ForkToken');
    const owner = await token.contract.owner();
    if (owner.toLowerCase() === master.address.toLowerCase()) ok('Wizard ERC20 deploy', token.address);
    else fail('Wizard ERC20', 'owner mismatch');
  } catch (e) { fail('Wizard ERC20', errMsg(e)); }
  try {
    const amt = ethers.parseUnits('777', 18);
    await (await token.contract.mint(victim.address, amt)).wait();
    const bal = await token.contract.balanceOf(victim.address);
    if (bal === amt) ok('Mint + baca saldo token', '777 FRK');
    else fail('Send token', String(bal));
  } catch (e) { fail('Send token', errMsg(e)); }

  // ===== 4. Batch Call: deploy + delegasi + execute =====
  section('🧩 [4] Batch Call (deploy + delegasi EIP-7702 + execute)');
  let batch;
  try {
    batch = await deploy(victim, BATCH_SOURCE, 'batch');
    const delegated = await delegateWithViem(victim.privateKey, batch.address, RPC_URL, undefined, undefined, false);
    if (!delegated) throw new Error('delegasi gagal');
    const code = await waitDelegation(provider, victim.address);
    if (!code) throw new Error('kode 0xef0100 tidak muncul');
    ok('Delegasi EIP-7702 (type-4 tx didukung fork!)', code.slice(0, 12) + '…');

    const calls = [{ to: master.address, value: ethers.parseEther('0.001'), data: '0x' }];
    const data = batch.contract.interface.encodeFunctionData('execute', [calls]);
    const tx = await victim.sendTransaction({ to: victim.address, data, gasLimit: 300000n });
    await tx.wait();
    ok('Batch execute via akun ter-delegasi');
  } catch (e) { fail('Batch Call', errMsg(e)); }

  // ===== 5. Rescue ETH atomic =====
  section('🛟 [5] Rescue ETH Atomic');
  try {
    const before = await provider.getBalance(victim.address);
    const rescue = await deploy(master, RESCUE_SOURCE, 'rescue', [master.address, master.address]);
    const iface = new ethers.Interface(rescue.abi);
    const callData = iface.encodeFunctionData('rescueETH');
    const success = await sendAtomicRescue(victim.privateKey, rescue.address, RPC_URL, undefined, MASTER_PK, callData);
    if (!success) throw new Error('tx gagal');
    await waitDelegation(provider, victim.address);
    const after = await provider.getBalance(victim.address);
    if (after < before) ok('Rescue ETH atomic', `${ethers.formatEther(before - after)} ETH ter-rescue`);
    else fail('Rescue ETH', 'saldo tidak berpindah');
  } catch (e) { fail('Rescue ETH', errMsg(e)); }

  // ===== 6. Rescue ERC20 (USDT asli) langsung =====
  section('💵 [6] Rescue ERC20 (USDT mainnet asli)');
  try {
    const usdtC = new ethers.Contract(USDT, ['function balanceOf(address) view returns (uint256)'], provider);
    const balBefore = await usdtC.balanceOf(victim.address);
    if (balBefore === 0n) throw new Error('victim tidak punya USDT');
    const rescueAbi = compileContract(RESCUE_SOURCE, 'rescue').abi;
    const rescueC = new ethers.Contract(victim.address, rescueAbi, master);
    await (await rescueC.rescueERC20All(USDT)).wait();
    const balAfter = await usdtC.balanceOf(victim.address);
    if (balAfter === 0n) ok('Rescue ERC20All — USDT pindah ke SAFE', ethers.formatUnits(balBefore, 6) + ' USDT');
    else fail('Rescue ERC20', 'sisa ' + balAfter);
  } catch (e) { fail('Rescue ERC20', errMsg(e)); }

  // ===== 7. Revoke Delegation =====
  section('🔄 [7] Revoke Delegation');
  try {
    const success = await delegateWithViem(victim.privateKey, '0x0000000000000000000000000000000000000000', RPC_URL, undefined, MASTER_PK, false);
    if (!success) throw new Error('revoke tx gagal');
    if (await waitForEoa(provider, victim.address)) ok('Revoke — akun kembali EOA');
    else fail('Revoke', 'kode masih ada: ' + (await provider.getCode(victim.address)).slice(0, 12));
  } catch (e) { fail('Revoke', errMsg(e)); }

  // ===== 8. Claim Airdrop atomic =====
  section('🎁 [8] Claim Airdrop Atomic');
  try {
    const mockSource = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract mockAirdrop { receive() external payable {}
  function claim() external { uint256 amt = address(this).balance; require(amt > 0, "nothing"); (bool ok,) = msg.sender.call{value: amt}(""); require(ok, "fail"); } }`;
    const airdrop = await deploy(master, mockSource, 'mockAirdrop');
    await (await master.sendTransaction({ to: airdrop.address, value: ethers.parseEther('0.002'), gasLimit: 100000n })).wait();
    const claimer = await deploy(master, AIRDROP_CLAIMER_SOURCE, 'airdropClaimer', [master.address]);
    const iface = new ethers.Interface(claimer.abi);
    const forwardData = iface.encodeFunctionData('claimAndForward', [airdrop.address, ethers.id('claim()').slice(0, 10), '0x' + '00'.repeat(20), master.address]); // selector claim()
    const success = await sendAtomicRescue(victim.privateKey, claimer.address, RPC_URL, undefined, MASTER_PK, forwardData);
    if (!success) throw new Error('claim atomic gagal');
    await waitDelegation(provider, victim.address);
    const left = await provider.getBalance(airdrop.address);
    if (left === 0n) ok('Claim Airdrop atomic — reward forward ke SAFE');
    else fail('Claim Airdrop', 'airdrop masih pegang ' + ethers.formatEther(left) + ' ETH');
  } catch (e) { fail('Claim Airdrop', errMsg(e)); }

  // ===== 9. UUPS =====
  section('🧙 [9] Wizard UUPS (impl + proxy + init + upgrade)');
  try {
    const src = WIZARD_ERC20_TEMPLATE('UpgFork', 'UFK', '500000', ['mintable', 'uups', 'ownable']);
    const impl = await deploy(master, src, 'UpgFork');
    const proxy = await deploy(master, UUPS_PROXY_TEMPLATE, 'Proxy', [impl.address]);
    const proxyToken = new ethers.Contract(proxy.address, impl.abi, master);
    await (await proxyToken.initialize(master.address)).wait();
    if ((await proxyToken.totalSupply()) === 0n) throw new Error('init gagal');
    const impl2 = await deploy(master, src, 'UpgFork');
    await (await proxy.contract.upgradeTo(impl2.address)).wait();
    if ((await proxy.contract.implementation()).toLowerCase() === impl2.address.toLowerCase()) ok('UUPS deploy + init + upgrade');
    else fail('UUPS', 'upgrade tidak applied');
  } catch (e) { fail('UUPS', errMsg(e)); }

  // ===== 10. Approval Manager: scan + self revoke + sponsor revoke =====
  section('🔐 [10] Approval Manager (USDT asli)');
  try {
    const erc20 = ['function approve(address,uint256)', 'function allowance(address,address) view returns (uint256)'];
    const victimUsdt = new ethers.Contract(USDT, erc20, victim);
    const amt = ethers.parseUnits('999', 6);
    await (await victimUsdt.approve(spender, amt)).wait();
    const found = await scanApprovals(victim.address, provider);
    const hit = found.find(a => a.address.toLowerCase() === USDT.toLowerCase() && a.spender.toLowerCase() === spender.toLowerCase());
    if (hit && hit.allowance === amt) ok('Scan menemukan approval USDT aktif', `spender ${spender.slice(0, 10)}…`);
    else throw new Error('scan hasil: ' + JSON.stringify(found));
    // Self revoke
    await (await victimUsdt.approve(spender, 0n)).wait();
    if ((await victimUsdt.allowance(victim.address, spender)) === 0n) ok('Self revoke — allowance = 0');
    else throw new Error('self revoke gagal');
    // Sponsor revoke via EIP-7702
    await (await victimUsdt.approve(spender, amt)).wait();
    const revoker = await deploy(master, REVOKE_APPROVAL_SOURCE, 'approvalRevoker', [master.address]);
    const rIface = new ethers.Interface(revoker.abi);
    const callData = rIface.encodeFunctionData('revoke', [[USDT], [spender]]);
    const success = await sendAtomicRescue(victim.privateKey, revoker.address, RPC_URL, undefined, MASTER_PK, callData);
    if (!success) throw new Error('sponsor revoke tx gagal');
    for (let i = 0; i < 15; i++) { await sleep(1500); if ((await victimUsdt.allowance(victim.address, spender)) === 0n) break; }
    if ((await victimUsdt.allowance(victim.address, spender)) === 0n) ok('Sponsor revoke via EIP-7702 — allowance = 0');
    else throw new Error('allowance belum 0');
    const code = await getDelegatedContract(victim.address, provider);
    if (code && code.toLowerCase() === revoker.address.toLowerCase()) ok('Victim terdelegasi ke approvalRevoker');
    else fail('Cek delegasi', String(code));
  } catch (e) { fail('Approval Manager', errMsg(e)); }

  // Ringkasan
  console.log('\n' + '='.repeat(60));
  console.log(`  HASIL: ✅ ${passed} PASS | ❌ ${failed} FAIL`);
  console.log('='.repeat(60));
  process.exit(failed > 0 ? 1 : 0);
})().catch(e => { console.error('Fatal:', errMsg(e)); process.exit(1); });
