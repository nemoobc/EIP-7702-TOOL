'use strict';
// TEST MAINNET-SIM (TERMUX-ONLY) — validasi kontrak & pola delegasi EIP-7702
// terhadap STATE MAINNET ASLI via eth_call + stateOverride.
// Tanpa deploy, tanpa dana, tanpa chain lokal. 100% baca/simulasi.
const { ethers } = require('ethers');
const {
  RESCUE_SOURCE, BATCH_SOURCE, REVOKE_APPROVAL_SOURCE,
  compileContract
} = require('./EIP-7702-TOOL.js');

const RPC = process.env.SIM_RPC || 'https://ethereum-rpc.publicnode.com';
const provider = new ethers.JsonRpcProvider(RPC, 1);

const USDT = '0xdAC17F958D2ee523a2206206994597C13D831ec7';
// Alamat dummy untuk injeksi kode via stateOverride (tidak pernah ada di mainnet)
const IMPL_RESCUE = '0x' + 'aa01'.repeat(10);
const IMPL_BATCH = '0x' + 'aa02'.repeat(10);
const IMPL_REVOKER = '0x' + 'aa03'.repeat(10);
const VICTIM1 = '0x' + 'bb01'.repeat(10);
const VICTIM2 = '0x' + 'bb02'.repeat(10);
const VICTIM3 = '0x' + 'bb03'.repeat(10);

let passed = 0, failed = 0;
function ok(n, x) { passed++; console.log(`  ✅ PASS: ${n}${x ? ' — ' + x : ''}`); }
function fail(n, e) { failed++; console.log(`  ❌ FAIL: ${n} — ${e}`); }

// Panggil eth_call dengan stateOverride: injeksi kode impl + designator delegasi
async function simCall(to, data, from, overrides) {
  return await provider.send('eth_call', [
    { from, to, data, gas: '0x' + (2_000_000).toString(16) },
    'latest',
    overrides
  ]);
}
function delegatedCode(implAddr) {
  return '0xef0100' + implAddr.slice(2).toLowerCase();
}

(async () => {
  console.log('='.repeat(60));
  console.log('  TEST MAINNET-SIM (stateOverride, RPC: ' + new URL(RPC).host + ')');
  console.log('='.repeat(60));

  // Cek dukungan stateOverride
  try {
    await provider.send('eth_call', [{ to: USDT, data: '0x18160ddd' }, 'latest', {}]);
  } catch (e) {
    console.log('❌ RPC tidak mendukung stateOverride:', e.message); process.exit(1);
  }
  ok('RPC mendukung eth_call + stateOverride');

  const sponsor = ethers.Wallet.createRandom().address;
  const safe = ethers.Wallet.createRandom().address;
  const stranger = ethers.Wallet.createRandom().address;

  // ===== 1. RESCUE: delegasi semu + access control =====
  console.log('\n[1] Kontrak rescue (delegasi EIP-7702 disimulasi)');
  const rescue = compileContract(RESCUE_SOURCE, 'rescue');
  const rescueIface = new ethers.Interface(rescue.abi);
  // runtime bytecode: ambil deployedBytecode agar alamat immutable terisi benar
  const rescueRuntime = compileDeployed(RESCUE_SOURCE, 'rescue', { SAFE: safe, RESCUER: sponsor });
  const ovRescue = {
    [IMPL_RESCUE]: { code: rescueRuntime },
    [VICTIM1]: { code: delegatedCode(IMPL_RESCUE), balance: '0xDE0B6B3A7640000' } // 1 ETH
  };
  try {
    await simCall(VICTIM1, rescueIface.encodeFunctionData('rescueETH'), sponsor, ovRescue);
    ok('rescueETH via akun ter-delegasi (sponsor memanggil)');
  } catch (e) { fail('rescueETH delegated', short(e)); }
  try {
    await simCall(VICTIM1, rescueIface.encodeFunctionData('rescueETH'), stranger, ovRescue);
    fail('Access control rescue', 'seharusnya revert utk non-rescuer');
  } catch (e) {
    if (String(e).includes('not rescuer')) ok('Access control: non-rescuer ditolak ("caller is not rescuer")');
    else fail('Access control rescue', 'revert tapi pesan tak dikenal: ' + short(e));
  }
  try {
    await simCall(VICTIM1, rescueIface.encodeFunctionData('version'), stranger, ovRescue);
    ok('version() terbaca via delegasi');
  } catch (e) { fail('version()', short(e)); }

  // ===== 2. BATCH: hanya deployer bisa execute =====
  console.log('\n[2] Kontrak batch (deployer = sponsor)');
  const batchRuntime = compileDeployed(BATCH_SOURCE, 'batch', { DEPLOYER: sponsor });
  const batchIface = new ethers.Interface(compileContract(BATCH_SOURCE, 'batch').abi);
  const ovBatch = {
    [IMPL_BATCH]: { code: batchRuntime },
    [VICTIM2]: { code: delegatedCode(IMPL_BATCH), balance: '0x2386F26FC10000' } // 0.01 ETH
  };
  const calls = [{ to: safe, value: ethers.parseEther('0.001'), data: '0x' }];
  try {
    await simCall(VICTIM2, batchIface.encodeFunctionData('execute', [calls]), sponsor, ovBatch);
    ok('execute() oleh deployer via delegasi');
  } catch (e) { fail('batch execute', short(e)); }
  try {
    await simCall(VICTIM2, batchIface.encodeFunctionData('execute', [calls]), stranger, ovBatch);
    fail('Access control batch', 'seharusnya revert utk non-deployer');
  } catch (e) {
    if (String(e).includes('not deployer')) ok('Access control: non-deployer ditolak');
    else fail('Access control batch', short(e));
  }

  // ===== 3. APPROVAL REVOKER: approve(spender,0) di USDT ASLI =====
  console.log('\n[3] approvalRevoker — revoke approval di USDT mainnet asli');
  const revokerRuntime = compileDeployed(REVOKE_APPROVAL_SOURCE, 'approvalRevoker', { RESCUER: sponsor });
  const revokerIface = new ethers.Interface(compileContract(REVOKE_APPROVAL_SOURCE, 'approvalRevoker').abi);
  const spender = ethers.Wallet.createRandom().address;
  const ovRevoker = {
    [IMPL_REVOKER]: { code: revokerRuntime },
    [VICTIM3]: { code: delegatedCode(IMPL_REVOKER) }
  };
  try {
    await simCall(VICTIM3, revokerIface.encodeFunctionData('revoke', [[USDT], [spender]]), sponsor, ovRevoker);
    ok('revoke(USDT, spender) dieksekusi sebagai owner (simulasi)');
  } catch (e) { fail('approvalRevoker revoke', short(e)); }
  try {
    await simCall(VICTIM3, revokerIface.encodeFunctionData('revoke', [[USDT], [spender]]), stranger, ovRevoker);
    fail('Access control revoker', 'seharusnya revert');
  } catch (e) {
    if (String(e).includes('not rescuer')) ok('Access control: non-rescuer ditolak');
    else fail('Access control revoker', short(e));
  }

  // ===== 4. Sanity: USDT totalSupply terbaca (state asli) =====
  const ts = await provider.call({ to: USDT, data: '0x18160ddd' });
  const supply = Number(ethers.formatUnits(BigInt(ts), 6));
  if (supply > 1e9) ok(`State mainnet asli terbaca (USDT supply: ${Math.round(supply / 1e6)}M)`);
  else fail('USDT supply', ts);

  console.log('\n' + '='.repeat(60));
  console.log(`  HASIL: ✅ ${passed} PASS | ❌ ${failed} FAIL`);
  console.log('='.repeat(60));
  process.exit(failed > 0 ? 1 : 0);
})().catch(e => { console.error('Fatal:', e.shortMessage || e.message); process.exit(1); });

// Compile dan kembalikan deployedBytecode dengan immutable diganti constant
// (immutableReferences solc memakai stack-slot ID, jadi kita patch source-nya langsung)
function compileDeployed(source, name, immutables) {
  let src = source;
  for (const [varName, addr] of Object.entries(immutables)) {
    const re = new RegExp('address public immutable ' + varName + ';');
    if (!re.test(src)) throw new Error(`Immutable ${varName} tidak ditemukan di ${name}`);
    src = src.replace(re, `address public constant ${varName} = ${addr};`);
    src = src.replace(new RegExp('constructor\\([^)]*\\) \\{[^}]*' + varName + '[^}]*\\}'), '');
  }
  const solc = require('solc');
  const input = { language: 'Solidity', sources: { [name + '.sol']: { content: src } }, settings: { outputSelection: { '*': { '*': ['evm.deployedBytecode.object'] } } } };
  const out = JSON.parse(solc.compile(JSON.stringify(input)));
  return '0x' + out.contracts[name + '.sol'][name].evm.deployedBytecode.object;
}
function short(e) { return String(e?.message || e).slice(0, 120); }
