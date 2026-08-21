'use strict';
// TEST 3 FITUR TERSISA di fork (hemat quota): Claim Airdrop, UUPS, Approval Manager
const { ethers } = require('ethers');
const fs = require('fs');
const {
  AIRDROP_CLAIMER_SOURCE, REVOKE_APPROVAL_SOURCE, UUPS_PROXY_TEMPLATE,
  WIZARD_ERC20_TEMPLATE, compileContract, delegateWithViem, sendAtomicRescue,
  scanApprovals, getDelegatedContract, loadConfig, saveConfig
} = require('./EIP-7702-TOOL.js');

const RPC_URL = process.env.FORK_RPC || 'https://virtual.mainnet.eu.rpc.tenderly.co/pst4r8/project/d12d33';
const WALLETS = JSON.parse(fs.readFileSync('fork-wallets.json', 'utf8'));
const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
const sleep = ms => new Promise(r => setTimeout(r, ms));
let passed = 0, failed = 0;
const ok = (n, x) => { passed++; console.log(`  ✅ PASS: ${n}${x ? ' — ' + x : ''}`); };
const fail = (n, e) => { failed++; console.log(`  ❌ FAIL: ${n} — ${String(e?.shortMessage || e?.message || e).slice(0, 160)}`); };

async function deploy(signer, source, name, args = []) {
  const artifact = compileContract(source, name);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  return { contract, address: await contract.getAddress(), abi: artifact.abi };
}

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const cfg = loadConfig();
  cfg.rpcUrl = RPC_URL; cfg.chainId = Number((await provider.getNetwork()).chainId); cfg.networkName = 'Mainnet Fork';
  saveConfig(cfg);
  const master = new ethers.Wallet(WALLETS.master.privateKey, provider);
  const victim = new ethers.Wallet(WALLETS.victim.privateKey, provider);
  console.log('Master:', master.address, '| victim ETH:', ethers.formatEther(await provider.getBalance(victim.address)));

  // ===== [A] Claim Airdrop Atomic =====
  console.log('\n[A] Claim Airdrop Atomic');
  try {
    if (await provider.getBalance(victim.address) < ethers.parseEther('0.001')) throw new Error('victim butuh ETH utk state delegasi? (sponsor bayar gas, ini cek sanity)');
    const mockSource = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract mockAirdrop { receive() external payable {}
  function claim() external { uint256 amt = address(this).balance; require(amt > 0, "nothing"); (bool ok,) = msg.sender.call{value: amt}(""); require(ok, "fail"); } }`;
    const airdrop = await deploy(master, mockSource, 'mockAirdrop');
    await (await master.sendTransaction({ to: airdrop.address, value: ethers.parseEther('0.002'), gasLimit: 100000n })).wait();
    const claimer = await deploy(master, AIRDROP_CLAIMER_SOURCE, 'airdropClaimer', [master.address]);
    console.log('  mockAirdrop saldo:', ethers.formatEther(await provider.getBalance(airdrop.address)), 'ETH | claimer:', claimer.address);
    const iface = new ethers.Interface(claimer.abi);
    const forwardData = iface.encodeFunctionData('claimAndForward', [airdrop.address, ethers.id('claim()').slice(0, 10), '0x' + '00'.repeat(20), master.address]);
    const success = await sendAtomicRescue(victim.privateKey, claimer.address, RPC_URL, undefined, WALLETS.master.privateKey, forwardData);
    if (!success) throw new Error('tx gagal');
    for (let i = 0; i < 15; i++) { await sleep(1500); if ((await provider.getBalance(airdrop.address)) === 0n) break; }
    if ((await provider.getBalance(airdrop.address)) === 0n) ok('Claim Airdrop atomic — reward forward ke SAFE');
    else fail('Claim Airdrop', 'airdrop masih pegang saldo');
  } catch (e) { fail('Claim Airdrop', e); }

  // ===== [B] UUPS =====
  console.log('\n[B] Wizard UUPS');
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
  } catch (e) { fail('UUPS', e); }

  // ===== [C] Approval Manager =====
  console.log('\n[C] Approval Manager (USDT asli)');
  try {
    const erc20 = ['function approve(address,uint256)', 'function allowance(address,address) view returns (uint256)'];
    const victimUsdt = new ethers.Contract(USDT, erc20, victim);
    const spender = ethers.Wallet.createRandom().address;
    const amt = ethers.parseUnits('999', 6);
    await (await victimUsdt.approve(spender, amt)).wait();
    const found = await scanApprovals(victim.address, provider);
    const hit = found.find(a => a.address.toLowerCase() === USDT.toLowerCase() && a.spender.toLowerCase() === spender.toLowerCase());
    if (!(hit && hit.allowance === amt)) throw new Error('scan tidak menemukan approval');
    ok('Scan menemukan approval USDT aktif', `spender ${spender.slice(0, 10)}…`);
    await (await victimUsdt.approve(spender, 0n)).wait();
    if ((await victimUsdt.allowance(victim.address, spender)) !== 0n) throw new Error('self revoke gagal');
    ok('Self revoke — allowance = 0');
    await (await victimUsdt.approve(spender, amt)).wait();
    const revoker = await deploy(master, REVOKE_APPROVAL_SOURCE, 'approvalRevoker', [master.address]);
    const rIface = new ethers.Interface(revoker.abi);
    const callData = rIface.encodeFunctionData('revoke', [[USDT], [spender]]);
    const success = await sendAtomicRescue(victim.privateKey, revoker.address, RPC_URL, undefined, WALLETS.master.privateKey, callData);
    if (!success) throw new Error('sponsor revoke tx gagal');
    for (let i = 0; i < 15; i++) { await sleep(1500); if ((await victimUsdt.allowance(victim.address, spender)) === 0n) break; }
    if ((await victimUsdt.allowance(victim.address, spender)) === 0n) ok('Sponsor revoke via EIP-7702 — allowance = 0');
    else throw new Error('allowance belum 0');
    const code = await getDelegatedContract(victim.address, provider);
    if (code && code.toLowerCase() === revoker.address.toLowerCase()) ok('Victim terdelegasi ke approvalRevoker');
    else throw new Error('delegasi: ' + code);
  } catch (e) { fail('Approval Manager', e); }

  console.log('\n' + '='.repeat(60));
  console.log(`  HASIL: ✅ ${passed} PASS | ❌ ${failed} FAIL`);
  console.log('='.repeat(60));
  process.exit(failed > 0 ? 1 : 0);
})().catch(e => { console.error('Fatal:', String(e?.message || e).slice(0, 250)); process.exit(1); });
