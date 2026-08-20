#!/usr/bin/env node
/**
 * ONCHAIN TEST — EIP-7702 TOOL
 * =============================
 * Menjalankan seluruh fitur tool secara NYATA di Sepolia testnet.
 * Membutuhkan satu wallet yang sudah di-fund (test-wallet.json / TEST_PRIVATE_KEY).
 *
 * Cakupan:
 *  1. RPC / chain / gas / ETH price (read-only)
 *  2. Send ETH
 *  3. Wizard Deploy ERC20 (mintable)
 *  4. Send Token (ERC20)
 *  5. Batch Call (deploy + delegasi + execute)
 *  6. Rescue ETH (atomic)
 *  7. Rescue ERC20 (direct)
 *  8. Wizard Deploy ERC721 + Rescue ERC721
 *  9. Revoke Delegation
 * 10. Claim Airdrop (atomic)
 * 11. Wizard Deploy ERC1155
 * 12. Wizard Deploy UUPS (impl + proxy + init + upgrade)
 * 13. Info Wallet (balance / nonce / kode akun)
 *
 * Usage:
 *   node onchain-test.js
 *   TEST_PRIVATE_KEY=0x... node onchain-test.js
 */
'use strict';

const { ethers } = require('ethers');
const fs = require('fs');
const path = require('path');
const os = require('os');

const {
  RESCUE_SOURCE, BATCH_SOURCE, AIRDROP_CLAIMER_SOURCE, UUPS_PROXY_TEMPLATE,
  WIZARD_ERC20_TEMPLATE, WIZARD_ERC721_TEMPLATE, WIZARD_ERC1155_TEMPLATE,
  compileContract, delegateWithViem, getDelegatedContract, sendAtomicRescue,
  getProvider, getActiveRpcUrl, getEthPriceUsd
} = require('./EIP-7702-TOOL.js');

const RPC_URL = process.env.TEST_RPC_URL || getActiveRpcUrl();
const CHAIN_ID = 11155111;

const chalk = {
  green: s => `\x1b[32m${s}\x1b[0m`,
  red: s => `\x1b[31m${s}\x1b[0m`,
  cyan: s => `\x1b[36m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  gray: s => `\x1b[90m${s}\x1b[0m`,
  bold: s => `\x1b[1m${s}\x1b[0m`,
};

// ================= STATE =================
let passed = 0, failed = 0, skipped = 0;
const results = [];
const log = console.log;

function ok(name, extra) { passed++; results.push({ name, status: 'PASS' }); log(chalk.green(`  ✅ PASS: ${name}${extra ? ' — ' + extra : ''}`)); }
function fail(name, err) { failed++; results.push({ name, status: 'FAIL', error: String(err) }); log(chalk.red(`  ❌ FAIL: ${name} — ${err}`)); }
function skip(name, reason) { skipped++; results.push({ name, status: 'SKIP', reason }); log(chalk.yellow(`  ⏭️  SKIP: ${name} — ${reason}`)); }
function section(t) { log(chalk.bold('\n' + '─'.repeat(64) + `\n${t}\n` + '─'.repeat(64))); }

function getMasterWallet() {
  const envPk = process.env.TEST_PRIVATE_KEY;
  const filePath = path.join(__dirname, 'test-wallet.json');
  let pk = envPk;
  if (!pk && fs.existsSync(filePath)) {
    try { pk = JSON.parse(fs.readFileSync(filePath, 'utf8')).privateKey; } catch (e) {}
  }
  if (!pk) throw new Error('Tidak ada private key. Buat test-wallet.json atau set TEST_PRIVATE_KEY.');
  return new ethers.Wallet(pk);
}

const MOCK_FEATURE_RECEIVER_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract FeatureReceiver {
    address public lastToken;
    uint256 public lastTransferAmount;
    bytes32 public lastFlashToken;
    uint256 public lastFlashAmount;
    function onTransferReceived(address, address, uint256 amount, bytes calldata) external returns (bytes4) {
        lastToken = msg.sender;
        lastTransferAmount = amount;
        return 0x88a7ca5c;
    }
    function onFlashLoan(address, address token, uint256 amount, uint256, bytes calldata) external returns (bytes32) {
        lastFlashToken = bytes32(uint256(uint160(token)));
        lastFlashAmount = amount;
        return keccak256("ERC3156FlashBorrower.onFlashLoan");
    }
}
`;

const MOCK_AIRDROP_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract mockAirdrop {
    receive() external payable {}
    function claim() external {
        uint256 amt = address(this).balance;
        require(amt > 0, "nothing to claim");
        (bool ok, ) = msg.sender.call{value: amt}("");
        require(ok, "claim failed");
    }
    function version() external pure returns (string memory) { return "1.0.0"; }
}`;

// ================= HELPERS =================
async function sendEth(signer, to, amountEth, label) {
  // 100000 gas: cukup untuk EOA maupun akun ter-delegasi (0xef0100) yang menjalankan receive()
  const tx = await signer.sendTransaction({
    to, value: ethers.parseEther(amountEth),
    gasLimit: 100000n
  });
  await tx.wait();
  await sleep(1200);
  return tx.hash;
}

async function deploy(signer, source, name, args = []) {
  const artifact = compileContract(source, name);
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, signer);
  const contract = await factory.deploy(...args);
  await contract.waitForDeployment();
  await sleep(1200);
  return { contract, address: await contract.getAddress(), abi: artifact.abi };
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

function errMsg(e) {
  if (e == null) return 'unknown error';
  const m = e.shortMessage || e.message || e.reason || (e.cause && (e.cause.shortMessage || e.cause.message));
  if (m) return String(m);
  if (typeof e === 'string') return e;
  try { return JSON.stringify(e).slice(0, 300); } catch (_) { return String(e); }
}

async function readWithRetry(fn, attempts = 6, label = 'read') {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      if (i < attempts - 1) await sleep(2000 + i * 1000);
    }
  }
  throw lastErr;
}

async function waitDelegation(provider, address) {
  for (let i = 0; i < 30; i++) {
    try {
      const code = await provider.getCode(address);
      if (code && code.toLowerCase().startsWith('0xef0100')) return code;
    } catch (e) {}
    await sleep(2000);
  }
  return null;
}

async function waitForEoa(provider, address) {
  for (let i = 0; i < 30; i++) {
    try {
      if ((await provider.getCode(address)) === '0x') return true;
    } catch (e) {}
    await sleep(2000);
  }
  return false;
}

async function withRetry(fn, attempts = 3, label = 'op') {
  let lastErr;
  for (let i = 0; i < attempts; i++) {
    try { return await fn(); }
    catch (e) {
      lastErr = e;
      if (i < attempts - 1) {
        log(chalk.yellow(`  ↻ Retry ${label} (${i + 1}/${attempts - 1}) — ${errMsg(e)}`));
        await sleep(6000);
      }
    }
  }
  throw lastErr;
}

// ================= TESTS =================

async function testCompileAllVariants() {
  section('📦 TEST 0: Compile semua template & variant fitur (offline)');
  const cases = [
    { label: 'rescue', source: RESCUE_SOURCE, name: 'rescue' },
    { label: 'batch', source: BATCH_SOURCE, name: 'batch' },
    { label: 'airdropClaimer', source: AIRDROP_CLAIMER_SOURCE, name: 'airdropClaimer' },
    { label: 'mockAirdrop', source: MOCK_AIRDROP_SOURCE, name: 'mockAirdrop' },
    { label: 'feature receiver', source: MOCK_FEATURE_RECEIVER_SOURCE, name: 'FeatureReceiver' },
    { label: 'UUPS Proxy', source: UUPS_PROXY_TEMPLATE, name: 'Proxy' },
    { label: 'ERC721', source: WIZARD_ERC721_TEMPLATE('T', 'T'), name: 'T' },
    { label: 'ERC1155', source: WIZARD_ERC1155_TEMPLATE('M'), name: 'M' },
  ];
  const erc20Variants = [
    ['mintable', 'burnable', 'pausable', 'ownable'],
    ['mintable', 'roles'],
    ['mintable', 'managed'],
    ['mintable', 'managed', 'pausable'],
    ['mintable', 'uups', 'ownable'],
    ['mintable', 'uups', 'roles'],
    ['mintable', 'uups', 'managed'],
    ['permit', 'callback', 'flashMinting'],
    ['mintable', 'burnable', 'pausable', 'ownable', 'permit', 'callback', 'flashMinting'],
  ];
  for (const c of cases) {
    try { compileContract(c.source, c.name); ok(`Compile ${c.label}`); }
    catch (e) { fail(`Compile ${c.label}`, e.message); }
  }
  for (const feats of erc20Variants) {
    const label = 'ERC20 ' + feats.join('+');
    try { compileContract(WIZARD_ERC20_TEMPLATE('V', 'V', '1000', feats), 'V'); ok(`Compile ${label}`); }
    catch (e) { fail(`Compile ${label}`, e.message); }
  }
}

async function testRpc() {
  section('🌐 TEST 1: RPC / Chain / Gas / Harga ETH');
  try {
    const provider = getProvider(RPC_URL);
    const [net, block, feeData] = await Promise.all([
      readWithRetry(() => provider.getNetwork(), 6, 'network'),
      readWithRetry(() => provider.getBlockNumber(), 6, 'block'),
      readWithRetry(() => provider.getFeeData(), 6, 'fee')
    ]);
    const gwei = Number(ethers.formatUnits(feeData.gasPrice ?? feeData.maxFeePerGas, 'gwei'));
    const price = await getEthPriceUsd();
    log(chalk.gray(`  Chain: ${net.name} (${net.chainId}) | Block: ${block} | Gas: ${gwei.toFixed(2)} gwei | ETH: $${price || 'N/A'}`));
    if (Number(net.chainId) === CHAIN_ID) ok('RPC connection (Sepolia)');
    else fail('RPC connection', `wrong chain ${net.chainId}`);
  } catch (e) { fail('RPC connection', e.message); }
}

async function testSendEth(master) {
  section('💸 TEST 2: Send ETH (fund victim)');
  const victim = ethers.Wallet.createRandom();
  const provider = getProvider(RPC_URL);
  try {
    const hash = await sendEth(master.connect(provider), victim.address, '0.02', 'fund victim');
    const bal = await provider.getBalance(victim.address);
    if (bal >= ethers.parseEther('0.019')) ok('Send ETH', `${hash.slice(0, 10)}… → ${ethers.formatEther(bal)} ETH`);
    else fail('Send ETH', 'balance too low');
  } catch (e) { fail('Send ETH', errMsg(e)); return null; }
  return victim;
}

async function testWizardERC20(master) {
  section('🪙 TEST 3: Wizard Deploy ERC20 (mintable)');
  try {
    const source = WIZARD_ERC20_TEMPLATE('TestToken', 'TST', '1000000', ['mintable', 'burnable', 'ownable']);
    const provider = getProvider(RPC_URL);
    const { contract, address } = await deploy(master.connect(provider), source, 'TestToken');
    const [owner, total] = await Promise.all([contract.owner(), contract.totalSupply()]);
    if (owner.toLowerCase() === master.address.toLowerCase() && total > 0n) ok('Wizard ERC20 deploy', address);
    else fail('Wizard ERC20 deploy', 'owner/supply mismatch');
    return { contract, address };
  } catch (e) { fail('Wizard ERC20 deploy', errMsg(e)); return null; }
}

async function testERC20FeatureVariants(master, victim) {
  section('🧪 TEST 4: ERC20 feature variants on-chain');
  const provider = getProvider(RPC_URL);
  const amount = ethers.parseUnits('100', 18);
  const cases = [
    { label: 'ERC20 managed mint', name: 'ManagedToken', features: ['mintable', 'managed'] },
    { label: 'ERC20 roles mint', name: 'RolesToken', features: ['mintable', 'roles'] },
    { label: 'ERC20 pausable + burnable', name: 'PausableToken', features: ['burnable', 'pausable', 'ownable'] },
    { label: 'ERC20 permit', name: 'PermitToken', features: ['permit'] },
    { label: 'ERC20 callback + flash mint', name: 'AdvancedToken', features: ['callback', 'flashMinting'] }
  ];
  for (const c of cases) {
    try {
      const source = WIZARD_ERC20_TEMPLATE(c.name, c.name.slice(0, 3).toUpperCase(), '1000000', c.features);
      const { contract, address } = await deploy(master.connect(provider), source, c.name);
      if (c.features.includes('mintable')) {
        await (await contract.mint(victim.address, amount)).wait();
        if ((await contract.balanceOf(victim.address)) !== amount) throw new Error('mint balance mismatch');
      } else if (c.features.includes('pausable')) {
        await (await contract.pause()).wait();
        await expectRevert(() => contract.transfer(victim.address, 1n), 'paused transfer');
        await (await contract.unpause()).wait();
        await (await contract.transfer(victim.address, 1n)).wait();
        await (await contract.burn(1n)).wait();
      } else if (c.features.includes('permit')) {
        const receiver = victim.address;
        const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);
        const nonce = await contract.nonces(master.address);
        const domain = { name: c.name, version: '1', chainId: CHAIN_ID, verifyingContract: address };
        const types = { Permit: [
          { name: 'owner', type: 'address' }, { name: 'spender', type: 'address' },
          { name: 'value', type: 'uint256' }, { name: 'nonce', type: 'uint256' },
          { name: 'deadline', type: 'uint256' }
        ] };
        const value = { owner: master.address, spender: receiver, value: amount, nonce, deadline };
        const signature = ethers.Signature.from(await master.signTypedData(domain, types, value));
        await (await contract.permit(master.address, receiver, amount, deadline, signature.v, signature.r, signature.s)).wait();
        if ((await contract.allowance(master.address, receiver)) !== amount) throw new Error('permit allowance mismatch');
      } else if (c.features.includes('callback')) {
        const receiver = await deploy(master.connect(provider), MOCK_FEATURE_RECEIVER_SOURCE, 'FeatureReceiver');
        await (await contract.transferWithCallback(receiver.address, amount, '0x')).wait();
        if ((await receiver.contract.lastTransferAmount()) !== amount) throw new Error('callback amount mismatch');
        await (await contract.flashLoan(receiver.address, amount, '0x')).wait();
        if ((await receiver.contract.lastFlashAmount()) !== amount) throw new Error('flash callback mismatch');
      }
      ok(c.label, address);
    } catch (e) { fail(c.label, errMsg(e)); }
  }
}

async function expectRevert(fn, label) {
  try { await (await fn()).wait(); throw new Error(`${label} did not revert`); }
  catch (e) { if (String(e.message || e).includes('did not revert')) throw e; }
}

async function testSendToken(master, token, victim) {
  section('🎫 TEST 5: Send Token (ERC20)');
  try {
    const provider = getProvider(RPC_URL);
    const amount = ethers.parseUnits('1000', 18);
    const tx = await token.connect(master.connect(provider)).transfer(victim.address, amount);
    await tx.wait();
    const bal = await token.balanceOf(victim.address);
    if (bal === amount) ok('Send Token', `1000 TST → ${victim.address.slice(0, 8)}…`);
    else fail('Send Token', `balance ${bal}`);
  } catch (e) { fail('Send Token', errMsg(e)); }
}

async function testBatchCall(master, victim) {
  section('🧩 TEST 5: Batch Call (deploy + delegasi + execute)');
  try {
    const provider = getProvider(RPC_URL);
    const { contract: batch, address: batchAddr } = await deploy(victim.connect(provider), BATCH_SOURCE, 'batch');
    const delegated = await withRetry(() => delegateWithViem(victim.privateKey, batchAddr, RPC_URL, undefined, undefined, false), 3, 'batch delegate');
    if (!delegated) { fail('Batch delegasi', 'delegation failed'); return null; }
    const code = await provider.getCode(victim.address);
    if (!(code && code.toLowerCase().startsWith('0xef0100'))) { fail('Batch delegasi', 'account code not 0xef0100'); return null; }

    const calls = [{ to: master.address, value: ethers.parseEther('0.001'), data: '0x' }];
    const data = batch.interface.encodeFunctionData('execute', [calls]);
    await withRetry(async () => {
      const tx = await victim.connect(provider).sendTransaction({ to: victim.address, data, gasLimit: 200000n });
      await tx.wait();
    }, 3, 'batch execute');
    ok('Batch call (deploy + delegate + execute)');
    return { address: batchAddr };
  } catch (e) { fail('Batch call', errMsg(e)); return null; }
}

async function testRescueEth(master, victim) {
  section('🛟 TEST 6: Rescue ETH (atomic)');
  try {
    const provider = getProvider(RPC_URL);
    // top-up victim agar ada ETH yang bisa di-rescue
    await sendEth(master.connect(provider), victim.address, '0.005', 'topup victim');
    const before = await provider.getBalance(victim.address);

    const { address: rescueAddr } = await deploy(master.connect(provider), RESCUE_SOURCE, 'rescue', [master.address, master.address]);
    const rescueAbi = compileContract(RESCUE_SOURCE, 'rescue').abi;
    const iface = new ethers.Interface(rescueAbi);
    const callData = iface.encodeFunctionData('rescueETH');
    const success = await withRetry(() => sendAtomicRescue(victim.privateKey, rescueAddr, RPC_URL, undefined, master.privateKey, callData), 3, 'rescue atomic');
    if (!success) { fail('Rescue ETH', 'atomic rescue failed'); return null; }
    await waitDelegation(provider, victim.address);
    const after = await provider.getBalance(victim.address);
    if (before > 0n && after < before) ok('Rescue ETH (atomic)', `rescued ${ethers.formatEther(before - after)} ETH`);
    else fail('Rescue ETH', 'balance not moved');
    return { address: rescueAddr, abi: rescueAbi };
  } catch (e) { fail('Rescue ETH', errMsg(e)); return null; }
}

async function testRescueErc20(master, victim, token, rescue) {
  section('🪙 TEST 7: Rescue ERC20 (direct)');
  try {
    const provider = getProvider(RPC_URL);
    const bal = await token.balanceOf(victim.address);
    if (bal === 0n) { skip('Rescue ERC20', 'victim has no token'); return; }
    const rescueC = new ethers.Contract(victim.address, rescue.abi, master.connect(provider));
    const tx = await rescueC.rescueERC20All(await token.getAddress());
    await tx.wait();
    const after = await token.balanceOf(victim.address);
    if (after === 0n) ok('Rescue ERC20 (direct)');
    else fail('Rescue ERC20', `balance still ${after}`);
  } catch (e) { fail('Rescue ERC20', errMsg(e)); }
}

async function testRescueErc721(master, victim, rescue) {
  section('🎨 TEST 8: Wizard Deploy ERC721 + Rescue ERC721');
  let nft;
  try {
    const provider = getProvider(RPC_URL);
    const source = WIZARD_ERC721_TEMPLATE('TestNFT', 'TNFT');
    const d = await deploy(master.connect(provider), source, 'TestNFT');
    nft = d.contract;
    const mintTx = await nft.mint(victim.address, 1);
    await mintTx.wait();
    const ownerBefore = await nft.ownerOf(1);
    if (ownerBefore.toLowerCase() !== victim.address.toLowerCase()) { fail('Rescue ERC721', 'mint failed'); return; }
    const rescueC = new ethers.Contract(victim.address, rescue.abi, master.connect(provider));
    const tx = await rescueC.rescueERC721(await nft.getAddress(), [1]);
    await tx.wait();
    const ownerAfter = await nft.ownerOf(1);
    if (ownerAfter.toLowerCase() === master.address.toLowerCase()) ok('Wizard ERC721 + Rescue ERC721');
    else fail('Rescue ERC721', `still owned by ${ownerAfter}`);
  } catch (e) { fail('Rescue ERC721', errMsg(e)); }
}

async function testRevoke(master, victim) {
  section('🔄 TEST 9: Revoke Delegation');
  try {
    const provider = getProvider(RPC_URL);
    const success = await withRetry(() => delegateWithViem(victim.privateKey, '0x0000000000000000000000000000000000000000', RPC_URL, undefined, master.privateKey, false), 3, 'revoke');
    if (!success) { fail('Revoke', 'revoke tx failed'); return; }
    const revoked = await waitForEoa(provider, victim.address);
    if (revoked) ok('Revoke delegation (EOA kembali)');
    else {
      const code = await provider.getCode(victim.address);
      fail('Revoke delegation', `code still ${code.slice(0, 10)}…`);
    }
  } catch (e) { fail('Revoke delegation', errMsg(e)); }
}

async function testClaimAirdrop(master, victim) {
  section('🎁 TEST 10: Claim Airdrop (atomic)');
  try {
    const provider = getProvider(RPC_URL);
    // deploy mock airdrop yang di-fund ETH
    const { address: airdropAddr } = await deploy(master.connect(provider), MOCK_AIRDROP_SOURCE, 'mockAirdrop');
    const fundTx = await master.connect(provider).sendTransaction({ to: airdropAddr, value: ethers.parseEther('0.002'), gasLimit: 100000n });
    await fundTx.wait();

    const { address: claimerAddr } = await deploy(master.connect(provider), AIRDROP_CLAIMER_SOURCE, 'airdropClaimer', [master.address]);
    const claimerAbi = compileContract(AIRDROP_CLAIMER_SOURCE, 'airdropClaimer').abi;
    const iface = new ethers.Interface(claimerAbi);
    const mockIface = new ethers.Interface(['function claim()']);
    const forwardData = iface.encodeFunctionData('claimAndForward', [
      airdropAddr,
      mockIface.encodeFunctionData('claim'),
      '0x0000000000000000000000000000000000000000',
      master.address
    ]);
    const success = await withRetry(() => sendAtomicRescue(victim.privateKey, claimerAddr, RPC_URL, undefined, master.privateKey, forwardData), 3, 'claim atomic');
    if (!success) { fail('Claim Airdrop', 'atomic claim failed'); return; }
    await waitDelegation(provider, victim.address);
    const airdropBal = await readWithRetry(() => provider.getBalance(airdropAddr), 6, 'airdrop balance');
    if (airdropBal === 0n) ok('Claim Airdrop (atomic)');
    else fail('Claim Airdrop', `airdrop still has ${ethers.formatEther(airdropBal)} ETH`);
  } catch (e) { fail('Claim Airdrop', errMsg(e)); }
}

async function testWizardErc1155(master) {
  section('🧩 TEST 11: Wizard Deploy ERC1155');
  try {
    const provider = getProvider(RPC_URL);
    const source = WIZARD_ERC1155_TEMPLATE('MultiToken');
    const { contract } = await deploy(master.connect(provider), source, 'MultiToken');
    await (await contract.mint(master.address, 1, 5)).wait();
    const bal = await contract.balanceOf(1, master.address);
    if (bal === 5n) ok('Wizard ERC1155 deploy + mint');
    else fail('Wizard ERC1155', `balance ${bal}`);
  } catch (e) { fail('Wizard ERC1155', errMsg(e)); }
}

async function testWizardUups(master) {
  section('🔄 TEST 12: Wizard Deploy UUPS (impl + proxy + init + upgrade)');
  try {
    const provider = getProvider(RPC_URL);
    const source = WIZARD_ERC20_TEMPLATE('UpgToken', 'UTK', '500000', ['mintable', 'uups', 'ownable']);
    const impl = await deploy(master.connect(provider), source, 'UpgToken');
    const proxy = await deploy(master.connect(provider), UUPS_PROXY_TEMPLATE, 'Proxy', [impl.address]);

    const tokenAbi = impl.abi;
    const proxyToken = new ethers.Contract(proxy.address, tokenAbi, master.connect(provider));
    await (await proxyToken.initialize(master.address)).wait();
    const supply = await proxyToken.totalSupply();
    if (supply === 0n) { fail('Wizard UUPS', 'init failed'); return; }

    // upgrade: deploy impl baru, panggil upgradeTo
    const impl2 = await deploy(master.connect(provider), source, 'UpgToken');
    await (await proxy.contract.upgradeTo(impl2.address)).wait();
    const implSlot = await proxy.contract.implementation();
    if (implSlot.toLowerCase() === impl2.address.toLowerCase()) ok('Wizard UUPS (deploy + init + upgrade)');
    else fail('Wizard UUPS', 'upgrade not applied');
  } catch (e) { fail('Wizard UUPS', errMsg(e)); }
}

async function testInfoWallet(master, victim) {
  section('ℹ️ TEST 13: Info Wallet');
  try {
    const provider = getProvider(RPC_URL);
    const [bal, nonce, code] = await Promise.all([
      provider.getBalance(master.address),
      provider.getTransactionCount(master.address),
      provider.getCode(victim.address)
    ]);
    const kind = code === '0x' ? 'EOA' : (code.startsWith('0xef0100') ? 'delegated (0xef0100)' : 'contract');
    log(chalk.gray(`  Master balance: ${ethers.formatEther(bal)} ETH | nonce: ${nonce} | victim code: ${kind}`));
    ok('Info wallet (balance/nonce/code)');
  } catch (e) { fail('Info wallet', e.message); }
}

// ================= MAIN =================
async function main() {
  log(chalk.bold('='.repeat(64)));
  log(chalk.bold('  EIP-7702 TOOL — COMPREHENSIVE ONCHAIN TEST (SEPOLIA)'));
  log(chalk.bold('='.repeat(64)));

  const master = getMasterWallet();
  log(chalk.cyan(`\nMaster (sponsor/deployer): ${master.address}`));

  const provider = getProvider(RPC_URL);
  const masterBal = await readWithRetry(() => provider.getBalance(master.address), 8, 'master balance');
  log(chalk.cyan(`Master balance: ${ethers.formatEther(masterBal)} ETH`));
  await testCompileAllVariants();
  await testRpc();

  if (masterBal < ethers.parseEther('0.01')) {
    log(chalk.red('\n❌ Saldo master terlalu kecil untuk menjalankan test transaksi on-chain.'));
    log(chalk.yellow(`   Kirim minimal 0.05 Sepolia ETH ke: ${master.address}`));
    log(chalk.gray('   Faucet: https://cloud.google.com/application/web3/faucet/ethereum/sepolia  atau  https://sepoliafaucet.com'));    const blocked = [
      'Send ETH', 'Wizard ERC20 deploy', 'Send Token', 'ERC20 feature variants',
      'Batch call', 'Rescue ETH', 'Rescue ERC20', 'Rescue ERC721',
      'Wizard ERC721', 'Revoke delegation', 'Claim Airdrop',
      'Wizard ERC1155', 'Wizard UUPS', 'Info wallet transaction suite'
    ];
    blocked.forEach(name => skip(name, 'saldo Sepolia belum cukup; kirim minimal 0.05 ETH'));
    log(chalk.yellow('Test compile + RPC (read-only) sudah dijalankan di atas; test transaksi di-SKIP.'));
    finishReport();
    return;
  }
  if (masterBal < ethers.parseEther('0.04')) {
    log(chalk.yellow('⚠️  Saldo < 0.04 ETH — beberapa test mungkin gagal karena kehabisan gas.'));
  }

  const victim = await testSendEth(master);
  if (!victim) {
    skip('Remaining transaction suite', 'funding transaction gagal');
    finishReport();
    return;
  }
  const token = await testWizardERC20(master);
  if (token) await testSendToken(master, token.contract, victim);
  await testERC20FeatureVariants(master, victim);
  await testBatchCall(master, victim);
  const rescue = await testRescueEth(master, victim);
  if (rescue && token) await testRescueErc20(master, victim, token.contract, rescue);
  if (rescue) await testRescueErc721(master, victim, rescue);
  await testRevoke(master, victim);
  await testClaimAirdrop(master, victim);
  await testWizardErc1155(master);
  await testWizardUups(master);
  await testInfoWallet(master, victim);

  finishReport();
}

function finishReport() {
  // ================= SUMMARY =================
  log(chalk.bold('\n' + '='.repeat(64)));
  log(chalk.bold('  TEST RESULTS SUMMARY'));
  log(chalk.bold('='.repeat(64)));
  log(chalk.green(`  ✅ Passed: ${passed}`));
  log(chalk.red(`  ❌ Failed: ${failed}`));
  log(chalk.yellow(`  ⏭️  Skipped: ${skipped}`));
  log(chalk.bold(`  Total: ${passed + failed + skipped}`));
  log(chalk.bold('='.repeat(64)));

  if (failed > 0) {
    log(chalk.red('\nFailed tests:'));
    results.filter(r => r.status === 'FAIL').forEach(r => log(chalk.red(`  - ${r.name}: ${r.error}`)));
  }

  const master = (() => { try { return getMasterWallet().address; } catch (e) { return null; } })();
  const report = { timestamp: new Date().toISOString(), chainId: CHAIN_ID, master, passed, failed, skipped, results };
  fs.writeFileSync(path.join(__dirname, 'test-report.json'), JSON.stringify(report, null, 2));
  log(chalk.gray('\nReport saved to test-report.json'));

  process.exit(failed > 0 ? 1 : 0);
}

main().catch(e => { log(chalk.red('Fatal:'), errMsg(e)); process.exit(1); });
