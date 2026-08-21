'use strict';
// TEST CLAIM AIRDROP di SEPOLIA — selector claim() sudah benar (0x4e71d92d)
const { ethers } = require('ethers');
const fs = require('fs');
const {
  AIRDROP_CLAIMER_SOURCE, compileContract, sendAtomicRescue,
  getDelegatedContract, loadConfig, saveConfig
} = require('./EIP-7702-TOOL.js');

const RPC_URL = 'https://ethereum-sepolia-rpc.publicnode.com';
const W = JSON.parse(fs.readFileSync('test-wallet.json', 'utf8'));
const sleep = ms => new Promise(r => setTimeout(r, ms));

(async () => {
  const provider = new ethers.JsonRpcProvider(RPC_URL, 11155111);
  const cfg = loadConfig();
  cfg.rpcUrl = RPC_URL; cfg.chainId = 11155111; cfg.networkName = 'Sepolia Testnet';
  saveConfig(cfg);
  const master = new ethers.Wallet(W.privateKey, provider); // sponsor + SAFE
  const victim = ethers.Wallet.createRandom().connect(provider);
  console.log('Master:', master.address, '| saldo:', ethers.formatEther(await provider.getBalance(master.address)));
  console.log('Victim:', victim.address, '(tidak butuh ETH, sponsor bayar gas)\n');

  // mockAirdrop + fund
  const mockSource = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract mockAirdrop { receive() external payable {}
  function claim() external { uint256 amt = address(this).balance; require(amt > 0, "nothing"); (bool ok,) = msg.sender.call{value: amt}(""); require(ok, "fail"); } }`;
  const art = compileContract(mockSource, 'mockAirdrop');
  let f = new ethers.ContractFactory(art.abi, art.bytecode, master);
  const airdrop = await f.deploy();
  await airdrop.waitForDeployment();
  await (await master.sendTransaction({ to: await airdrop.getAddress(), value: ethers.parseEther('0.002'), gasLimit: 100000n })).wait();
  const airdropAddr = await airdrop.getAddress();
  console.log('[1] mockAirdrop:', airdropAddr, '| saldo:', ethers.formatEther(await provider.getBalance(airdropAddr)), 'ETH');

  // claimer
  const rArt = compileContract(AIRDROP_CLAIMER_SOURCE, 'airdropClaimer');
  f = new ethers.ContractFactory(rArt.abi, rArt.bytecode, master);
  const claimer = await f.deploy(master.address);
  await claimer.waitForDeployment();
  const claimerAddr = await claimer.getAddress();
  console.log('[2] claimer:', claimerAddr);

  // selector BENAR
  const iface = new ethers.Interface(rArt.abi);
  const sel = ethers.id('claim()').slice(0, 10);
  console.log('[3] selector claim():', sel);
  const forwardData = iface.encodeFunctionData('claimAndForward', [airdropAddr, sel, '0x' + '00'.repeat(20), master.address]);

  console.log('[4] kirim type-4 atomic...');
  const ok = await sendAtomicRescue(victim.privateKey, claimerAddr, RPC_URL, undefined, W.privateKey, forwardData);
  if (!ok) { console.log('❌ FAIL: tx gagal'); process.exit(1); }
  for (let i = 0; i < 15; i++) { await sleep(1500); if ((await provider.getBalance(airdropAddr)) === 0n) break; }
  const left = await provider.getBalance(airdropAddr);
  if (left === 0n) {
    console.log('✅ PASS: Claim Airdrop atomic — reward forward ke SAFE');
    const code = await getDelegatedContract(victim.address, provider);
    if (code && code.toLowerCase() === claimerAddr.toLowerCase()) console.log('✅ PASS: Victim terdelegasi ke claimer');
    process.exit(0);
  } else {
    console.log('❌ FAIL: airdrop masih pegang', ethers.formatEther(left), 'ETH');
    process.exit(1);
  }
})().catch(e => { console.error('Fatal:', String(e?.message || e).slice(0, 250)); process.exit(1); });
