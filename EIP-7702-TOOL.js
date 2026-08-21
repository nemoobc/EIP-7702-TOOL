#!/usr/bin/env node

const { ethers } = require('ethers');
const chalk = require('chalk');
const ora = require('ora');
const readline = require('readline');
const fs = require('fs');
const path = require('path');
const os = require('os');
const solc = require('solc');

const { createPublicClient, createWalletClient, http, parseEther, formatEther } = require('viem');
const { mainnet, sepolia, arbitrum, optimism, base, polygon, bsc } = require('viem/chains');
const { privateKeyToAccount } = require('viem/accounts');

// ================= KONFIGURASI =================
const APP_DIR = path.join(os.homedir(), '.wallet-cli');
const WALLET_DIR = path.join(os.homedir(), '.wallet-cli', 'wallets');
const NETWORK_DIR = path.join(__dirname, 'network');
const CONFIG_FILE = path.join(NETWORK_DIR, 'config.json');
if (!fs.existsSync(APP_DIR)) fs.mkdirSync(APP_DIR, { recursive: true });
if (!fs.existsSync(WALLET_DIR)) fs.mkdirSync(WALLET_DIR, { recursive: true });
if (!fs.existsSync(NETWORK_DIR)) fs.mkdirSync(NETWORK_DIR, { recursive: true });

const DEFAULT_CONFIG = {
  rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com',
  chainId: 11155111,
  networkName: 'Sepolia Testnet',
  defaultWallet: null,
  gasSettings: { speed: 'auto' },
  networks: [
    { name: 'Sepolia Testnet', rpcUrl: 'https://ethereum-sepolia-rpc.publicnode.com', chainId: 11155111 },
    { name: 'Ethereum Mainnet', rpcUrl: 'https://ethereum-rpc.publicnode.com', chainId: 1 },
    { name: 'Arbitrum One', rpcUrl: 'https://arb1.arbitrum.io/rpc', chainId: 42161 },
    { name: 'OP Mainnet', rpcUrl: 'https://mainnet.optimism.io', chainId: 10 },
    { name: 'Base', rpcUrl: 'https://mainnet.base.org', chainId: 8453 },
    { name: 'Polygon', rpcUrl: 'https://polygon-rpc.com', chainId: 137 },
    { name: 'BNB Smart Chain', rpcUrl: 'https://bsc-dataseed.bnbchain.org', chainId: 56 }
  ]
};

// ================= UTILITAS =================
function loadConfig() {
  try {
    if (fs.existsSync(CONFIG_FILE)) {
      const config = JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8'));
      const before = JSON.stringify(config);
      if (!config.networks) config.networks = [];
      for (const defNet of DEFAULT_CONFIG.networks) {
        if (!config.networks.some(n => Number(n.chainId) === Number(defNet.chainId))) config.networks.push(defNet);
      }
      if (!config.rpcUrl || !config.chainId || !config.networkName) {
        config.rpcUrl = DEFAULT_CONFIG.rpcUrl;
        config.chainId = DEFAULT_CONFIG.chainId;
        config.networkName = DEFAULT_CONFIG.networkName;
      }
      if (!config.gasSettings) config.gasSettings = DEFAULT_CONFIG.gasSettings;
      if (JSON.stringify(config) !== before) saveConfig(config);
      return config;
    }
  } catch (e) {}
  const def = { ...DEFAULT_CONFIG, networks: [...DEFAULT_CONFIG.networks] };
  saveConfig(def);
  return def;
}
function saveConfig(config) {
  if (!fs.existsSync(NETWORK_DIR)) fs.mkdirSync(NETWORK_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}
function getProvider(rpcOverride) {
  const c = loadConfig();
  const rpcUrl = rpcOverride || c.rpcUrl;
  return new ethers.JsonRpcProvider(rpcUrl, Number(c.chainId), { timeout: 120000 });
}
function getActiveRpcUrl() { return loadConfig().rpcUrl; }
function getViemChain(chainId) {
  switch (Number(chainId)) {
    case 1: return mainnet;
    case 11155111: return sepolia;
    case 42161: return arbitrum;
    case 10: return optimism;
    case 8453: return base;
    case 137: return polygon;
    case 56: return bsc;
    default: {
      const config = loadConfig();
      return {
        id: Number(chainId),
        name: config.networkName || `Custom network ${chainId}`,
        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
        rpcUrls: {
          default: { http: [config.rpcUrl] },
          public: { http: [config.rpcUrl] },
        },
      };
    }
  }
}
function listWalletFiles() {
  const files = fs.readdirSync(WALLET_DIR).filter(f => f.endsWith('.json'));
  return files.map(f => {
    const p = path.join(WALLET_DIR, f);
    const st = fs.statSync(p);
    return { address: f.replace('.json', ''), path: p, mtime: st.mtimeMs };
  }).sort((a,b) => b.mtime - a.mtime).map(({address, path}) => ({address, path}));
}
function getWalletPathByIdentifier(id) {
  const wallets = listWalletFiles();
  if (/^\d+$/.test(id)) {
    const idx = parseInt(id) - 1;
    if (idx >= 0 && idx < wallets.length) return wallets[idx].path;
  } else {
    const w = wallets.find(x => x.address.toLowerCase() === id.toLowerCase());
    if (w) return w.path;
  }
  throw new Error(`Wallet "${id}" tidak ditemukan.`);
}

// ================= WARNA & TAMPILAN =================
const ANSI_COLORS = [31,32,33,34,35,36,91,92,93,94,95,96];
function stripAnsi(s){return s.replace(/\x1b\[[0-9;]*m/g,'');}
function rainbowText(t,o=0){let r='';for(let i=0;i<t.length;i++){const c=ANSI_COLORS[(i+o)%ANSI_COLORS.length];r+=`\x1b[${c}m${t[i]}\x1b[0m`;}return r;}
function colorizeBorder(c,o=0){return `\x1b[${ANSI_COLORS[o%ANSI_COLORS.length]}m${c}\x1b[0m`;}
function printBox(title, lines=[], bo=0, maxWidth=72) {
  const tv = stripAnsi(title);
  const cw = Math.max(tv.length+4, ...lines.map(stripAnsi).map(l=>l.length+4), 20);
  const w = Math.min(cw, maxWidth);
  const h = '─'.repeat(w-2);
  const top = colorizeBorder('┌',bo) + colorizeBorder(h,bo+1) + colorizeBorder('┐',bo+2);
  const bottom = colorizeBorder('└',bo+3) + colorizeBorder(h,bo+4) + colorizeBorder('┘',bo+5);
  const tpad = w-2-tv.length-1;
  const tline = colorizeBorder('│',bo+6)+' '+rainbowText(tv,bo)+' '.repeat(Math.max(0,tpad))+colorizeBorder('│',bo+7);
  console.log(top); console.log(tline);
  lines.forEach((line,i)=>{
    const vl = stripAnsi(line).length;
    if (vl <= w-4) {
      const rp = w-2-vl-1;
      console.log(colorizeBorder('│',bo+i)+' '+line+' '.repeat(Math.max(0,rp))+colorizeBorder('│',bo+i+1));
    } else {
      const plain = stripAnsi(line);
      let rem = plain;
      while (rem.length > 0) {
        const chunk = rem.slice(0, w-4);
        rem = rem.slice(w-4);
        const rp = w-2-chunk.length-1;
        console.log(colorizeBorder('│',bo+i)+' '+chunk+' '.repeat(Math.max(0,rp))+colorizeBorder('│',bo+i+1));
      }
    }
  });
  console.log(bottom);
}
function printResult(title, lines=[]){
  console.log(chalk.bold.cyan(title));
  lines.forEach(line=>{ if(typeof line!=='string')return; let d=line; if(line.includes('Address:')||line.includes('Hash:')||line.includes('Private Key:')||line.includes('Signature:')||line.includes('Saldo:')||line.includes('Balance:')||line.includes('Nonce:')||line.includes('Target:')||line.includes('Status:')||line.includes('Code:')){ const idx=line.indexOf(':'); if(idx!==-1) d=line.slice(0,idx+1)+' '+chalk.green(line.slice(idx+1).trim()); } console.log(d); });
}
function clearScreen(){process.stdout.write('\x1b[2J\x1b[3J\x1b[H');}
async function animateBox(title, lines, duration=3000, maxWidth=72){
  let o=0;
  const iv=setInterval(()=>{ clearScreen(); printBox(title, lines, o, maxWidth); o=(o+1)%ANSI_COLORS.length; },100);
  await new Promise(r=>setTimeout(()=>{ clearInterval(iv); clearScreen(); r(); },duration));
}

// ================= MAINNET SAFETY =================
const MAINNET_CHAIN_IDS = [1];
const TESTNET_CHAIN_IDS = [11155111, 17000, 80002];
function isMainnet(chainId) { return MAINNET_CHAIN_IDS.includes(Number(chainId)); }
function isTestnet(chainId) { return TESTNET_CHAIN_IDS.includes(Number(chainId)); }
function getNetworkStatusEmoji(chainId) {
  if (isMainnet(chainId)) return '🔴';
  if (isTestnet(chainId)) return '🟢';
  return '🟡';
}
function getNetworkStatusLabel(chainId) {
  if (isMainnet(chainId)) return 'MAINNET (UANG NYATA)';
  if (isTestnet(chainId)) return 'TESTNET (Testing)';
  return 'UNKNOWN (Hati-hati)';
}
async function showNetworkStatus() {
  const c = loadConfig();
  const chainId = Number(c.chainId);
  const emoji = getNetworkStatusEmoji(chainId);
  const label = getNetworkStatusLabel(chainId);
  console.log();
  printBox('NETWORK STATUS', [
    `Chain ID    : ${chainId}`,
    `Network     : ${c.networkName}`,
    `Status      : ${emoji} ${label}`,
    `RPC Provider: ${c.rpcUrl.replace(/https?:\/\//, '').slice(0, 40)}`,
  ]);
  if (isMainnet(chainId)) {
    console.log(chalk.red.bold('  ⚠️  Anda di MAINNET — semua transaksi menggunakan uang NYATA!'));
  }
}
async function suggestRpcProvider() {
  const c = loadConfig();
  const chainId = Number(c.chainId);
  if (!isMainnet(chainId)) return;
  const rpcHost = c.rpcUrl.replace(/https?:\/\//, '').split('/')[0];
  const isPublic = rpcHost.includes('publicnode') || rpcHost.includes('rpc.org') || rpcHost.includes('cloudflare');
  if (!isPublic) return;
  console.log();
  console.log(chalk.yellow('  💡 RPC publik mungkin tidak stabil. Rekomendasi: Alchemy / QuickNode'));
  const choice = await ask(chalk.yellow('  Pilihan (1/2/3 = Ganti RPC, Enter = Pakai yang sekarang): '));
  if (choice === '1' || choice === '2' || choice === '3') {
    const providerNames = { '1': 'Alchemy', '2': 'QuickNode', '3': 'Infura' };
    const newRpc = await ask(chalk.cyan(`  Masukkan RPC URL ${providerNames[choice]}: `));
    if (newRpc && newRpc.startsWith('http')) {
      c.rpcUrl = newRpc;
      saveConfig(c);
      console.log(chalk.green('  ✅ RPC berhasil diganti!'));
    } else {
      console.log(chalk.red('  ❌ URL tidak valid, RPC tidak diganti.'));
    }
  } else {
    console.log(chalk.gray('  Menggunakan RPC yang sekarang.'));
  }
}
async function confirmMainnetTx(actionDesc, details) {
  const c = loadConfig();
  const chainId = Number(c.chainId);
  if (!isMainnet(chainId)) return true;
  console.log();
  console.log(chalk.red.bold('  ╔═══════════════════════════════════════════════════╗'));
  console.log(chalk.red.bold('  ║  ⚠️  PERINGATAN MAINNET                         ║'));
  console.log(chalk.red.bold('  ╚═══════════════════════════════════════════════════╝'));
  console.log();
  console.log(chalk.yellow(`  Anda sedang di: ${c.networkName} (chainId: ${chainId})`));
  console.log(chalk.red.bold('  ⚡ Ini adalah jaringan NYATA dengan uang NYATA!'));
  console.log(chalk.red.bold('  ⚡ Pastikan semua data sudah benar!'));
  console.log();
  if (details && details.length > 0) {
    console.log(chalk.cyan('  ┌─────────────────────────────────────────────────┐'));
    details.forEach(d => console.log(chalk.cyan('  │ ') + d));
    console.log(chalk.cyan('  └─────────────────────────────────────────────────┘'));
  }
  console.log();
  const confirm = await ask(chalk.yellow('  Ketik "YA" untuk konfirmasi: '));
  if (confirm !== 'YA' && confirm !== 'ya') {
    console.log(chalk.red('  ❌ Transaksi DIBATALKAN.'));
    return false;
  }
  return true;
}

// ================= INPUT =================
function ask(q){ const rl=readline.createInterface({input:process.stdin,output:process.stdout}); return new Promise(res=>rl.question(q,a=>{rl.close();res(a.trim());})); }
function askPassword(prompt='🔒 Password: '){
  return new Promise(res=>{
    process.stdout.write(prompt);
    const stdin=process.stdin;
    let input='';
    stdin.setRawMode(true); stdin.resume(); stdin.setEncoding('utf8');
    const onData=ch=>{
      ch=ch+'';
      switch(ch){
        case '\n': case '\r': case '\u0004':
          stdin.removeListener('data',onData); stdin.setRawMode(false); stdin.pause(); process.stdout.write('\n'); res(input); break;
        case '\u0003': process.exit(); break;
        case '\b': case '\u007f':
          if(input.length>0){ input=input.slice(0,-1); process.stdout.write('\b \b'); } break;
        default:
          if(ch>=' ' && ch!=='\u007f'){ input+=ch; process.stdout.write('*'); } break;
      }
    };
    stdin.on('data',onData);
  });
}
async function getPassword(){
  if(process.env.WALLET_PASSWORD) return process.env.WALLET_PASSWORD;
  return askPassword();
}

// ================= RLP ENCODING =================
function rlpEncodeBytes(buf){ if(buf.length===1&&buf[0]<=0x7f)return buf; if(buf.length<=55)return Buffer.concat([Buffer.from([0x80+buf.length]),buf]); const lenHex=buf.length.toString(16); const lenBuf=Buffer.from(lenHex.length%2?'0'+lenHex:lenHex,'hex'); return Buffer.concat([Buffer.from([0xb7+lenBuf.length]),lenBuf,buf]); }
function rlpEncodeInteger(value){ if(value===0n||value===0)return Buffer.from([0x80]); let hex=BigInt(value).toString(16); if(hex.length%2)hex='0'+hex; const buf=Buffer.from(hex,'hex'); let i=0; while(i<buf.length&&buf[i]===0)i++; const trimmed=buf.slice(i); if(trimmed.length===0)return Buffer.from([0x80]); if(trimmed.length===1&&trimmed[0]<=0x7f)return trimmed; return rlpEncodeBytes(trimmed); }
function rlpEncodeList(items){ const payload=Buffer.concat(items.map(rlpEncode)); if(payload.length<=55)return Buffer.concat([Buffer.from([0xc0+payload.length]),payload]); const lenHex=payload.length.toString(16); const lenBuf=Buffer.from(lenHex.length%2?'0'+lenHex:lenHex,'hex'); return Buffer.concat([Buffer.from([0xf7+lenBuf.length]),lenBuf,payload]); }
function rlpEncode(item){ if(item===undefined||item===null)throw new Error('RLP item undefined'); if(typeof item==='bigint'||typeof item==='number')return rlpEncodeInteger(BigInt(item)); if(Buffer.isBuffer(item))return rlpEncodeBytes(item); if(typeof item==='string'&&item.startsWith('0x'))return rlpEncodeBytes(Buffer.from(item.slice(2),'hex')); if(Array.isArray(item))return rlpEncodeList(item); throw new Error('Unsupported RLP type'); }

// ================= SOLC SOURCES =================
const RESCUE_SOURCE = `// SPDX-License-Identifier: CC0-1.0
pragma solidity ^0.8.20;
contract rescue {
    address public immutable SAFE;
    address public immutable RESCUER;
    constructor(address safe, address rescuer) { require(safe != address(0), "SAFE=0"); require(rescuer != address(0), "RESCUER=0"); SAFE=safe; RESCUER=rescuer; }
    modifier onlyRescuer() { require(msg.sender == RESCUER, "rescue: caller is not rescuer"); _; }
    receive() external payable {}
    function rescueETH() external onlyRescuer { (bool success, ) = SAFE.call{value: address(this).balance}(""); require(success, "ETH transfer failed"); }
    // Low-level call agar kompatibel dengan token non-standard (mis. USDT tidak mengembalikan bool)
    function rescueERC20(address token, uint256 amount) external onlyRescuer { (bool success, ) = token.call(abi.encodeWithSelector(0xa9059cbb, SAFE, amount)); require(success, "ERC20 transfer failed"); }
    function rescueERC20All(address token) external onlyRescuer {
        (bool okBal, bytes memory ret) = token.call(abi.encodeWithSelector(0x70a08231, address(this)));
        require(okBal && ret.length >= 32, "balanceOf failed");
        (bool success, ) = token.call(abi.encodeWithSelector(0xa9059cbb, SAFE, abi.decode(ret, (uint256))));
        require(success, "ERC20 transfer failed");
    }
    function rescueERC721(address token, uint256[] calldata ids) external onlyRescuer { for (uint256 i=0; i<ids.length; ++i) { (bool success, ) = token.call(abi.encodeWithSignature("transferFrom", address(this), SAFE, ids[i])); require(success, "ERC721 transfer failed"); } }
    function version() external pure returns (string memory) { return "1.1.0"; }
}`;

const BATCH_SOURCE = `// SPDX-License-Identifier: UNLICENSED
pragma solidity ^0.8.20;
contract batch {
    event CallExecuted(address indexed to, uint256 indexed value, bytes data, bool success);
    struct Call { bytes data; address to; uint256 value; }
    address public immutable DEPLOYER;
    modifier onlyDeployer() { require(msg.sender == DEPLOYER, "batch: caller is not deployer"); _; }
    constructor() { DEPLOYER = msg.sender; }
    receive() external payable {}
    fallback() external payable {}
    function execute(Call[] calldata calls) external payable onlyDeployer {
        require(calls.length > 0, "batch: empty call list");
        for (uint256 i=0; i<calls.length; i++) {
            Call memory call = calls[i];
            require(call.to != address(0), "batch: call target zero");
            (bool success, ) = call.to.call{value: call.value}(call.data);
            require(success, "batch: call reverted");
            emit CallExecuted(call.to, call.value, call.data, success);
        }
    }
    function version() external pure returns (string memory) { return "1.0.0"; }
}`;

const AIRDROP_CLAIMER_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;
contract airdropClaimer {
    address public immutable RESCUER;
    constructor(address rescuer) { require(rescuer != address(0), "RESCUER=0"); RESCUER = rescuer; }
    modifier onlyRescuer() { require(msg.sender == RESCUER, "airdropClaimer: caller is not rescuer"); _; }
    receive() external payable {}
    function claimAndForward(address airdropContract, bytes calldata claimData, address token, address safe) external onlyRescuer {
        require(safe != address(0), "SAFE=0");
        (bool success, ) = airdropContract.call(claimData);
        require(success, "claim failed");
        if (token == address(0)) {
            (success, ) = safe.call{value: address(this).balance}("");
            require(success, "ETH transfer failed");
        } else {
            // Low-level call agar kompatibel dengan token non-standard (mis. USDT)
            (bool okBal, bytes memory ret) = token.call(abi.encodeWithSelector(0x70a08231, address(this)));
            require(okBal && ret.length >= 32, "balanceOf failed");
            (success, ) = token.call(abi.encodeWithSelector(0xa9059cbb, safe, abi.decode(ret, (uint256))));
            require(success, "ERC20 transfer failed");
        }
    }
    function version() external pure returns (string memory) { return "1.1.0"; }
}`;

const REVOKE_APPROVAL_SOURCE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract approvalRevoker {
    address public immutable RESCUER;
    constructor(address rescuer) { require(rescuer != address(0), "RESCUER=0"); RESCUER = rescuer; }
    modifier onlyRescuer() { require(msg.sender == RESCUER, "approvalRevoker: caller is not rescuer"); _; }
    // Low-level call agar kompatibel dengan token non-standard (mis. USDT tidak mengembalikan bool)
    function revoke(address[] calldata tokens, address[] calldata spenders) external onlyRescuer {
        require(tokens.length == spenders.length, "len mismatch");
        for (uint256 i = 0; i < tokens.length; i++) {
            (bool success, ) = tokens[i].call(abi.encodeWithSelector(0x095ea7b3, spenders[i], 0));
            require(success, "revoke failed");
        }
    }
    function version() external pure returns (string memory) { return "1.1.0"; }
}`;

// ================= WIZARD TEMPLATES =================
function WIZARD_ERC20_TEMPLATE(name, symbol, supply, features) {
  let ownerCode = '';
  let featureCode = '';
  let interfaceCode = '';
  let constructorCode = '';
  let managedState = '';

  const hasOwnable = features.includes('ownable');
  const hasRoles = features.includes('roles');
  const hasManaged = features.includes('managed');
  const hasUUPS = features.includes('uups');
  const hasMintable = features.includes('mintable');
  const hasBurnable = features.includes('burnable');
  const hasPausable = features.includes('pausable');
  const hasCallback = features.includes('callback');
  const hasPermit = features.includes('permit');
  const hasFlashMinting = features.includes('flashMinting');

  if (hasManaged) managedState = 'address public authority;';

  if (hasCallback) {
    interfaceCode += `interface IERC1363Receiver { function onTransferReceived(address operator, address from, uint256 amount, bytes calldata data) external returns (bytes4); }`;
    featureCode += `function transferWithCallback(address to, uint256 amount, bytes calldata data) external returns (bool) { _transfer(msg.sender, to, amount); if (to.code.length > 0) { require(IERC1363Receiver(to).onTransferReceived(msg.sender, msg.sender, amount, data) == 0x88a7ca5c, "callback failed"); } return true; }`;
  }
  if (hasFlashMinting) {
    interfaceCode += `interface IERC3156FlashBorrower { function onFlashLoan(address initiator, address token, uint256 amount, uint256 fee, bytes calldata data) external returns (bytes32); }`;
    featureCode += `function flashLoan(address receiver, uint256 amount, bytes calldata data) external { uint256 supplyBefore = totalSupply; _mint(receiver, amount); if (receiver.code.length > 0) { require(IERC3156FlashBorrower(receiver).onFlashLoan(msg.sender, address(this), amount, 0, data) == keccak256("ERC3156FlashBorrower.onFlashLoan"), "invalid callback"); } _burn(receiver, amount); require(totalSupply == supplyBefore, "flash failed"); }`;
  }
  if (hasPermit) {
    featureCode += `mapping(address => uint256) public nonces; bytes32 public constant PERMIT_TYPEHASH = keccak256("Permit(address owner,address spender,uint256 value,uint256 nonce,uint256 deadline)"); bytes32 public constant EIP712_DOMAIN_TYPEHASH = keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"); function DOMAIN_SEPARATOR() public view returns (bytes32) { return keccak256(abi.encode(EIP712_DOMAIN_TYPEHASH, keccak256(bytes(name)), keccak256(bytes("1")), block.chainid, address(this))); } function permit(address owner, address spender, uint256 value, uint256 deadline, uint8 v, bytes32 r, bytes32 s) external { require(deadline >= block.timestamp, "expired"); uint256 nonce = nonces[owner]; bytes32 structHash = keccak256(abi.encode(PERMIT_TYPEHASH, owner, spender, value, nonce, deadline)); bytes32 digest = keccak256(abi.encodePacked("\\x19\\x01", DOMAIN_SEPARATOR(), structHash)); address signer = ecrecover(digest, v, r, s); require(signer != address(0) && signer == owner, "invalid signature"); nonces[owner] = nonce + 1; allowance[owner][spender] = value; emit Approval(owner, spender, value); }`;
  }

  if (hasOwnable) ownerCode += `modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }`;
  if (hasRoles) {
    featureCode += `mapping(bytes32 => mapping(address => bool)) private _roles; bytes32 public constant DEFAULT_ADMIN_ROLE = 0x00; bytes32 public constant MINTER_ROLE = keccak256("MINTER_ROLE"); modifier onlyRole(bytes32 role) { require(_roles[role][msg.sender], "not role"); _; } function hasRole(bytes32 role, address account) public view returns (bool) { return _roles[role][account]; } function grantRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) { _roles[role][account] = true; } function revokeRole(bytes32 role, address account) external onlyRole(DEFAULT_ADMIN_ROLE) { _roles[role][account] = false; }`;
  }
  if (hasManaged) ownerCode += `modifier onlyAuthority() { require(msg.sender == authority, "not authority"); _; }`;

  if (hasUUPS) featureCode += `address public implementation; function upgradeTo(address newImplementation) external { require(msg.sender == owner, "not owner"); implementation = newImplementation; }`;

  const transferGuard = hasPausable ? ' whenNotPaused' : '';
  if (hasMintable) {
    let mintGuard = '';
    if (hasRoles) mintGuard = ' onlyRole(MINTER_ROLE)';
    else if (hasOwnable) mintGuard = ' onlyOwner';
    else if (hasManaged) mintGuard = ' onlyAuthority';
    featureCode += `function mint(address to, uint256 amount) external${mintGuard}${transferGuard} { _mint(to, amount); }`;
  }
  if (hasBurnable) featureCode += `function burn(uint256 amount) external${transferGuard} { _burn(msg.sender, amount); }`;
  if (hasPausable) {
    let pauseRequire;
    if (hasRoles) pauseRequire = 'require(hasRole(DEFAULT_ADMIN_ROLE, msg.sender), "not authorized");';
    else if (hasOwnable) pauseRequire = 'require(msg.sender == owner, "not authorized");';
    else if (hasManaged) pauseRequire = 'require(msg.sender == authority, "not authorized");';
    else pauseRequire = 'require(msg.sender == owner, "not authorized");';
    featureCode += `bool public paused; modifier whenNotPaused() { require(!paused, "paused"); _; } function pause() external { ${pauseRequire} paused = true; } function unpause() external { ${pauseRequire} paused = false; }`;
  }

  if (hasUUPS) {
    let initRoles = '';
    let initManaged = '';
    if (hasRoles) initRoles = '_roles[DEFAULT_ADMIN_ROLE][_owner] = true; _roles[MINTER_ROLE][_owner] = true;';
    if (hasManaged) initManaged = 'authority = _owner;';
    constructorCode += `bool private _initialized; function initialize(address _owner) external { require(!_initialized, "already initialized"); _initialized = true; name = "${name}"; symbol = "${symbol}"; decimals = 18; owner = _owner; _mint(_owner, ${supply} * 10 ** decimals); ${initRoles} ${initManaged} }`;
  } else {
    let constructorOwner = 'owner = msg.sender;';
    let constructorRoles = '';
    let constructorManaged = '';
    if (hasRoles) constructorRoles = '_roles[DEFAULT_ADMIN_ROLE][msg.sender] = true; _roles[MINTER_ROLE][msg.sender] = true;';
    if (hasManaged) constructorManaged = 'authority = msg.sender;';
    constructorCode += `constructor() { ${constructorOwner} ${constructorRoles} ${constructorManaged} _mint(msg.sender, ${supply} * 10 ** decimals); }`;
  }

  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

${interfaceCode}
contract ${name} {
    address public owner;
${managedState}
    string public name = "${name}";
    string public symbol = "${symbol}";
    uint8 public decimals = 18;
    uint256 public totalSupply;
    mapping(address => uint256) public balanceOf;
    mapping(address => mapping(address => uint256)) public allowance;

    event Transfer(address indexed from, address indexed to, uint256 value);
    event Approval(address indexed owner, address indexed spender, uint256 value);

${ownerCode}
${constructorCode}

    function transfer(address to, uint256 amount) external${transferGuard} returns (bool) { _transfer(msg.sender, to, amount); return true; }
    function approve(address spender, uint256 amount) external returns (bool) { allowance[msg.sender][spender] = amount; emit Approval(msg.sender, spender, amount); return true; }
    function transferFrom(address from, address to, uint256 amount) external${transferGuard} returns (bool) { require(allowance[from][msg.sender] >= amount, "allowance too low"); allowance[from][msg.sender] -= amount; _transfer(from, to, amount); return true; }
    function _transfer(address from, address to, uint256 amount) internal { require(to != address(0), "transfer to zero"); require(balanceOf[from] >= amount, "balance too low"); balanceOf[from] -= amount; balanceOf[to] += amount; emit Transfer(from, to, amount); }
    function _mint(address to, uint256 amount) internal { totalSupply += amount; balanceOf[to] += amount; emit Transfer(address(0), to, amount); }
    function _burn(address from, uint256 amount) internal { require(balanceOf[from] >= amount, "burn too high"); balanceOf[from] -= amount; totalSupply -= amount; emit Transfer(from, address(0), amount); }

${featureCode}
}`;
}

const UUPS_PROXY_TEMPLATE = `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract Proxy {
    bytes32 private constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;
    bytes32 private constant ADMIN_SLOT = 0xb53127684a568b3173ae13b9f8a6016e243e63b6e8ee1178d6a717850b5d6103;

    event Upgraded(address indexed implementation);

    constructor(address _implementation) {
        require(_implementation != address(0), "impl zero");
        _setImplementation(_implementation);
        _setAdmin(msg.sender);
    }

    fallback() external payable { _delegate(_getImplementation()); }
    receive() external payable { _delegate(_getImplementation()); }

    function implementation() external view returns (address) { return _getImplementation(); }
    function admin() external view returns (address) { return _getAdmin(); }

    function upgradeTo(address newImplementation) external {
        require(msg.sender == _getAdmin(), "not admin");
        _setImplementation(newImplementation);
        emit Upgraded(newImplementation);
    }

    function _delegate(address impl) internal {
        assembly {
            calldatacopy(0, 0, calldatasize())
            let result := delegatecall(gas(), impl, 0, calldatasize(), 0, 0)
            returndatacopy(0, 0, returndatasize())
            switch result
            case 0 { revert(0, returndatasize()) }
            default { return(0, returndatasize()) }
        }
    }

    function _setImplementation(address newImplementation) internal {
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly { sstore(slot, newImplementation) }
    }
    function _getImplementation() internal view returns (address) {
        bytes32 slot = IMPLEMENTATION_SLOT;
        address impl;
        assembly { impl := sload(slot) }
        return impl;
    }
    function _setAdmin(address newAdmin) internal {
        bytes32 slot = ADMIN_SLOT;
        assembly { sstore(slot, newAdmin) }
    }
    function _getAdmin() internal view returns (address) {
        bytes32 slot = ADMIN_SLOT;
        address ad;
        assembly { ad := sload(slot) }
        return ad;
    }
}`;

const WIZARD_ERC721_TEMPLATE = (name, symbol) => `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ${name} {
    address public immutable owner;
    string public name = "${name}";
    string public symbol = "${symbol}";
    uint256 public totalSupply;
    mapping(uint256 => address) public ownerOf;
    mapping(address => uint256) public balanceOf;
    mapping(uint256 => address) public getApproved;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    event Transfer(address indexed from, address indexed to, uint256 indexed id);
    event Approval(address indexed owner, address indexed spender, uint256 indexed id);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }
    constructor() { owner = msg.sender; }
    function mint(address to, uint256 id) external onlyOwner { require(to != address(0), "mint zero"); require(ownerOf[id] == address(0), "already minted"); ownerOf[id] = to; balanceOf[to]++; totalSupply++; emit Transfer(address(0), to, id); }
    function transferFrom(address from, address to, uint256 id) external { require(to != address(0), "transfer zero"); require(ownerOf[id] == from, "not owner"); require(msg.sender == from || getApproved[id] == msg.sender || isApprovedForAll[from][msg.sender], "not authorized"); delete getApproved[id]; ownerOf[id] = to; balanceOf[from]--; balanceOf[to]++; emit Transfer(from, to, id); }
    function approve(address spender, uint256 id) external { require(ownerOf[id] == msg.sender, "not owner"); getApproved[id] = spender; emit Approval(msg.sender, spender, id); }
    function setApprovalForAll(address operator, bool approved) external { isApprovedForAll[msg.sender][operator] = approved; emit ApprovalForAll(msg.sender, operator, approved); }
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) { return interfaceId == 0x01ffc9a7 || interfaceId == 0x80ac58cd || interfaceId == 0x5b5e139f; }
}`;

const WIZARD_ERC1155_TEMPLATE = (name) => `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

contract ${name} {
    address public immutable owner;
    string public name = "${name}";
    mapping(uint256 => mapping(address => uint256)) public balanceOf;
    mapping(address => mapping(address => bool)) public isApprovedForAll;

    event TransferSingle(address indexed operator, address indexed from, address indexed to, uint256 id, uint256 amount);
    event TransferBatch(address indexed operator, address indexed from, address indexed to, uint256[] ids, uint256[] amounts);
    event ApprovalForAll(address indexed owner, address indexed operator, bool approved);

    modifier onlyOwner() { require(msg.sender == owner, "not owner"); _; }
    constructor() { owner = msg.sender; }
    function mint(address to, uint256 id, uint256 amount) external onlyOwner { require(to != address(0), "mint zero"); require(amount > 0, "amount zero"); balanceOf[id][to] += amount; emit TransferSingle(msg.sender, address(0), to, id, amount); }
    function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes calldata data) external { require(from == msg.sender || isApprovedForAll[from][msg.sender], "not authorized"); require(balanceOf[id][from] >= amount, "balance low"); balanceOf[id][from] -= amount; balanceOf[id][to] += amount; emit TransferSingle(msg.sender, from, to, id, amount); }
    function setApprovalForAll(address operator, bool approved) external { isApprovedForAll[msg.sender][operator] = approved; emit ApprovalForAll(msg.sender, operator, approved); }
    function supportsInterface(bytes4 interfaceId) external pure returns (bool) { return interfaceId == 0x01ffc9a7 || interfaceId == 0xd9b67a26 || interfaceId == 0x0e89341c; }
}`;

// ================= COMPILE & VERIFIKASI =================
function compileContract(source, name, options = {}) {
  const settings = {
    outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object'] } },
    optimizer: { enabled: options.optimization !== undefined ? options.optimization : false, runs: options.optimizationRuns || 200 }
  };
  if (options.evmVersion && options.evmVersion !== 'default') settings.evmVersion = options.evmVersion;
  const input = { language: 'Solidity', sources: { [name+'.sol']: { content: source } }, settings };
  const output = JSON.parse(solc.compile(JSON.stringify(input)));
  if (output.errors) {
    output.errors.forEach(e => { if (e.severity === 'error') console.error(chalk.red('Compile error:'), e.formattedMessage); });
    if (output.errors.some(e => e.severity === 'error')) throw new Error('Compile failed');
  }
  const c = output.contracts[name+'.sol'] && output.contracts[name+'.sol'][name];
  if (!c || !c.evm || !c.evm.bytecode || !c.evm.bytecode.object) throw new Error('Bytecode tidak ditemukan untuk kontrak ' + name);
  return { abi: c.abi, bytecode: '0x' + c.evm.bytecode.object, settings };
}

const SOURCIFY_API = 'https://sourcify.dev/server';
function formatSolcVersionForSourcify() { const raw = solc.version(); const m = raw.match(/(\d+\.\d+\.\d+\+commit\.[0-9a-fA-F]{8})/); if (!m) throw new Error('Tidak bisa parse versi solc'); return m[1]; }
async function verifyOnSourcify({ address, sourceCode, contractName, creationTxHash, chainId, optimization, optimizationRuns }) {
  const activeChainId = chainId || loadConfig().chainId;
  const spinner = ora(chalk.blue('Verifikasi ke Sourcify...')).start();
  try {
    await new Promise(r => setTimeout(r, 5000));
    const stdJsonInput = {
      language: 'Solidity',
      sources: { [contractName+'.sol']: { content: sourceCode } },
      settings: {
        optimizer: { enabled: optimization !== undefined ? optimization : false, runs: optimizationRuns || 200 },
        outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object', 'metadata'] } }
      }
    };
    const submitRes = await fetch(SOURCIFY_API + '/v2/verify/' + activeChainId + '/' + address, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ stdJsonInput, compilerVersion: formatSolcVersionForSourcify(), contractIdentifier: contractName+'.sol:'+contractName, ...(creationTxHash ? { creationTransactionHash: creationTxHash } : {}) })
    });
    const submitJson = await submitRes.json();
    if (!submitJson.verificationId) {
      const msg = (submitJson.error || submitJson.message || '').toLowerCase();
      if (msg.includes('already verified')) {
        spinner.succeed(chalk.green('✅ Kontrak sudah terverifikasi di Sourcify!'));
        console.log(chalk.gray('   https://repo.sourcify.dev/' + activeChainId + '/' + address));
      } else {
        spinner.fail(chalk.red('Gagal submit Sourcify: ' + (submitJson.error || submitJson.message)));
      }
      return;
    }
    spinner.text = chalk.blue('Menunggu hasil Sourcify...');
    for (let i=0; i<12; i++) {
      await new Promise(r=>setTimeout(r,3000));
      const checkRes = await fetch(SOURCIFY_API + '/v2/verify/' + submitJson.verificationId);
      const checkJson = await checkRes.json();
      if (checkJson.isJobCompleted) {
        const match = checkJson.contract && checkJson.contract.match;
        if (match === 'exact_match' || match === 'match') {
          spinner.succeed(chalk.green('✅ Terverifikasi di Sourcify (' + match + ')!'));
          console.log(chalk.gray('   https://repo.sourcify.dev/' + activeChainId + '/' + address));
        } else spinner.fail(chalk.red('❌ Verifikasi Sourcify gagal: bytecode tidak cocok.'));
        return;
      }
    }
    spinner.warn(chalk.yellow('⏱️ Timeout menunggu Sourcify.'));
  } catch(e) { spinner.fail(chalk.red('Error Sourcify: ' + e.message)); }
}

const BLOCKSCOUT_BASE_URLS = {
  1: 'https://eth.blockscout.com', 11155111: 'https://eth-sepolia.blockscout.com',
  42161: 'https://arbitrum.blockscout.com', 10: 'https://optimism.blockscout.com',
  8453: 'https://base.blockscout.com', 137: 'https://polygon.blockscout.com', 56: 'https://bsc.blockscout.com'
};
function formatSolcVersionForBlockscout() { const raw = solc.version(); const m = raw.match(/(\d+\.\d+\.\d+\+commit\.[0-9a-fA-F]{8})/); if (!m) throw new Error('Tidak bisa parse versi solc'); return 'v' + m[1]; }
async function verifyOnBlockscout({ address, sourceCode, contractName, chainId, optimization, optimizationRuns }) {
  const baseUrl = BLOCKSCOUT_BASE_URLS[Number(chainId)];
  if (!baseUrl) { console.log(chalk.yellow('⚠️ Blockscout tidak tersedia untuk chainId ' + chainId)); return; }
  const spinner = ora(chalk.blue('Verifikasi ke Blockscout...')).start();
  try {
    const compilerversion = formatSolcVersionForBlockscout();
    const body = new URLSearchParams({
      module: 'contract', action: 'verifysourcecode',
      contractAddress: address, sourceCode: sourceCode,
      codeformat: 'solidity-single-file', contractname: contractName,
      compilerversion, optimizationUsed: optimization ? '1' : '0',
      runs: String(optimizationRuns || 200), licenseType: '3'
    });
    const res = await fetch(baseUrl + '/api', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: body.toString() });
    const json = await res.json();
    if (json.status !== '1' || !json.result) {
      const msg = String(json.result || json.message || 'unknown');
      if (msg.toLowerCase().includes('already verified')) {
        spinner.succeed(chalk.green('✅ Terverifikasi di Blockscout!'));
        console.log(chalk.gray('   ' + baseUrl + '/address/' + address + '#code'));
      } else spinner.fail(chalk.red('Gagal submit verifikasi Blockscout: ' + msg));
      return;
    }
    const guid = json.result;
    for (let i = 0; i < 10; i++) {
      await new Promise(r => setTimeout(r, 3000));
      const checkUrl = baseUrl + '/api?module=contract&action=checkverifystatus&guid=' + encodeURIComponent(guid);
      const checkJson = await (await fetch(checkUrl)).json();
      if (checkJson.status === '1' && String(checkJson.result).toLowerCase() === 'pending') continue;
      if (checkJson.status === '1') {
        spinner.succeed(chalk.green('✅ Terverifikasi di Blockscout!'));
        console.log(chalk.gray('   ' + baseUrl + '/address/' + address + '#code'));
      } else spinner.fail(chalk.red('Gagal verifikasi Blockscout: ' + (checkJson.result || checkJson.message || 'unknown')));
      return;
    }
    spinner.warn(chalk.yellow('⏱️ Timeout menunggu hasil verifikasi Blockscout.'));
  } catch(e) { spinner.fail(chalk.red('Error Blockscout: ' + e.message)); }
}

async function verifyOnBoth(params) { await verifyOnSourcify(params); await verifyOnBlockscout(params); }

// ================= DEPLOYED CONTRACTS =================
const DEPLOYED_CONTRACTS_FILE = path.join(NETWORK_DIR, 'deployed-contracts.json');
function loadDeployedContracts() { try { if (fs.existsSync(DEPLOYED_CONTRACTS_FILE)) return JSON.parse(fs.readFileSync(DEPLOYED_CONTRACTS_FILE,'utf8')); } catch(e) {} return { batch: [], rescue: [], airdrop: [], proxy: [], revoker: [] }; }
function getActiveChainIdNum() { try { return Number(loadConfig().chainId); } catch (e) { return 0; } }
function saveDeployedContract(type, address, extra={}) { const data = loadDeployedContracts(); if (!data[type]) data[type] = []; data[type].push({ address, chainId: getActiveChainIdNum(), ...extra }); fs.writeFileSync(DEPLOYED_CONTRACTS_FILE, JSON.stringify(data, null, 2)); }
function findRescueContract(rescuerAddress, safeAddress) {
  const chainIdNum = getActiveChainIdNum();
  for (const item of loadDeployedContracts().rescue || []) {
    if (typeof item !== 'object') continue;
    if (Number(item.chainId) !== chainIdNum) continue;
    if (item.rescuer && item.safe && item.rescuer.toLowerCase()===rescuerAddress.toLowerCase() && item.safe.toLowerCase()===safeAddress.toLowerCase()) return item.address;
  }
  return null;
}
function findAirdropContract(rescuerAddress, safeAddress) {
  const chainIdNum = getActiveChainIdNum();
  for (const item of loadDeployedContracts().airdrop || []) {
    if (typeof item !== 'object') continue;
    if (Number(item.chainId) !== chainIdNum) continue;
    if (item.rescuer && item.safe && item.rescuer.toLowerCase()===rescuerAddress.toLowerCase() && item.safe.toLowerCase()===safeAddress.toLowerCase()) return item.address;
  }
  return null;
}

// ================= EIP-7702 HELPERS =================
async function delegateWithViem(privateKey, implAddress, rpcUrl, nonceOverride, sponsorPrivateKey, verbose=true, data='0x') {
  if (!ethers.isAddress(implAddress)) throw new Error('Alamat implementation tidak valid.');
  if (!rpcUrl) throw new Error('RPC URL wajib diisi.');
  if (nonceOverride !== undefined && (!Number.isSafeInteger(nonceOverride) || nonceOverride < 0)) throw new Error('Authorization nonce tidak valid.');
  const account = privateKeyToAccount(privateKey);
  const publicClient = createPublicClient({ chain: getViemChain(loadConfig().chainId), transport: http(rpcUrl) });
  const sponsorAccount = sponsorPrivateKey ? privateKeyToAccount(sponsorPrivateKey) : account;
  const walletClient = createWalletClient({ account: sponsorAccount, chain: getViemChain(loadConfig().chainId), transport: http(rpcUrl) });
  const isSelfSponsored = sponsorAccount.address.toLowerCase() === account.address.toLowerCase();
  const delegatorNonce = await publicClient.getTransactionCount({ address: account.address, blockTag: 'pending' });
  let authNonce = nonceOverride;
  if (authNonce === undefined || authNonce === null) {
    authNonce = isSelfSponsored ? delegatorNonce + 1 : delegatorNonce;
    if (verbose) console.log(chalk.cyan(`ℹ️  Nonce akun terdelegasi: ${delegatorNonce} → authorization nonce (${isSelfSponsored ? 'self-sponsored +1' : 'disponsori, tanpa +1'}): ${authNonce}`));
  } else if (verbose) console.log(chalk.cyan(`ℹ️  Authorization nonce (manual): ${authNonce}`));

  const walletEth = new ethers.Wallet(privateKey);
  const chainId = Number((await publicClient.getChainId()).toString());
  const addressBytes = Buffer.from(implAddress.slice(2).padStart(40,'0'), 'hex');
  const authDigest = ethers.keccak256(Buffer.concat([Buffer.from([0x05]), rlpEncode([chainId, addressBytes, authNonce])]));
  const sigEth = ethers.Signature.from(walletEth.signingKey.sign(authDigest));
  const recovered = ethers.recoverAddress(authDigest, sigEth);
  if (recovered.toLowerCase() !== account.address.toLowerCase()) { console.log(chalk.red('❌ Verifikasi ethers GAGAL!')); return false; }
  if (verbose) console.log(chalk.green('✅ Verifikasi ethers: recovered address cocok.'));

  const authorization = { chainId, address: implAddress, nonce: authNonce, r: sigEth.r, s: sigEth.s, yParity: sigEth.yParity };
  if (verbose) { console.log(chalk.cyan('Authorization:')); console.log(chalk.gray(JSON.stringify({...authorization, r: authorization.r, s: authorization.s}, null, 2))); }

  // Gunakan fee dinamis (dengan headroom 1.5x) agar tidak gagal saat base fee naik.
  let maxFeePerGas = 3000000000n;
  let maxPriorityFeePerGas = 1000000000n;
  try {
    const fees = await publicClient.estimateFeesPerGas();
    if (fees && fees.maxFeePerGas) maxFeePerGas = (fees.maxFeePerGas * 150n) / 100n;
    if (fees && fees.maxPriorityFeePerGas) maxPriorityFeePerGas = fees.maxPriorityFeePerGas;
  } catch (e) {}
  const txOptions = { to: account.address, authorizationList: [authorization], gas: 500000n, maxFeePerGas, maxPriorityFeePerGas, value: 0n, data };
  if (isSelfSponsored) txOptions.nonce = delegatorNonce;
  try {
    const estimated = await publicClient.estimateGas({ account: sponsorAccount.address, to: account.address, data, value: 0n });
    txOptions.gas = (estimated * 120n) / 100n + 60000n;
  } catch (e) { /* fallback ke 500000n */ }
  const txHash = await walletClient.sendTransaction(txOptions);
  console.log(chalk.green('✅ Transaksi EIP-7702 terkirim!')); console.log('Hash:', txHash);
  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
  if (receipt.status === 'success') {
    const code = await publicClient.getCode({ address: account.address });
    if (code && code.toLowerCase().startsWith('0xef0100')) { console.log(chalk.green('✅ Delegasi berhasil! Kode akun sekarang:'), code); return true; }
    else { console.log(chalk.green('✅ Delegasi dihapus, akun kembali EOA.')); return true; }
  } else { console.log(chalk.red('❌ Transaksi gagal (receipt status = 0).')); return false; }
}
async function getDelegatedContract(address, provider) { const code = await provider.getCode(address); if (code && code.toLowerCase().startsWith('0xef0100')) return '0x' + code.slice(8); return null; }
async function sendAtomicRescue(targetPrivateKey, implAddress, rpcUrl, nonceOverride, sponsorPrivateKey, callData) {
  return await delegateWithViem(targetPrivateKey, implAddress, rpcUrl, nonceOverride, sponsorPrivateKey, false, callData);
}

// ================= FITUR WALLET =================
async function actionCreateWallet(){
  const spinner=ora(chalk.blue('Membuat wallet baru...')).start();
  try{
    const wallet=ethers.Wallet.createRandom();
    spinner.succeed(chalk.green('Wallet berhasil dibuat!'));
    printResult('Wallet Baru',['Address: '+wallet.address,'Mnemonic (simpan aman):']);
    console.log(chalk.yellow(wallet.mnemonic.phrase));
    const password=await getPassword();
    const encrypted=await wallet.encrypt(password);
    const filePath=path.join(WALLET_DIR, wallet.address.toLowerCase()+'.json');
    fs.writeFileSync(filePath, encrypted);
    console.log(chalk.green(`\n✅ Wallet tersimpan di ${filePath}`));
  }catch(err){spinner.fail(chalk.red('Gagal membuat wallet.'));console.error(err.message);}
}
async function actionImportWallet(){
  const input=await ask(chalk.cyan('Masukkan private key atau mnemonic: '));
  const spinner=ora(chalk.blue('Mengimpor wallet...')).start();
  try{
    let wallet;
    if (input.includes(' ')) wallet=ethers.Wallet.fromPhrase(input);
    else wallet=new ethers.Wallet(input);
    spinner.succeed(chalk.green('Wallet berhasil diimpor!'));
    printResult('Wallet Diimpor',['Address: '+wallet.address]);
    const password=await getPassword();
    const encrypted=await wallet.encrypt(password);
    const filePath=path.join(WALLET_DIR, wallet.address.toLowerCase()+'.json');
    fs.writeFileSync(filePath, encrypted);
    console.log(chalk.green(`\n✅ Wallet tersimpan di ${filePath}`));
  }catch(err){spinner.fail(chalk.red('Gagal mengimpor wallet.'));console.error(err.message);}
}
function actionListWallets(){
  const wallets=listWalletFiles();
  if (wallets.length===0){ printResult('Daftar Wallet',['Belum ada wallet tersimpan.']); return; }
  const lines=wallets.map((w,i)=>(i+1)+'. '+w.address);
  printResult('Daftar Wallet',lines);
}
async function promptWalletSelection(){
  const wallets=listWalletFiles();
  if (wallets.length===0) throw new Error('Belum ada wallet tersimpan.');
  if (wallets.length===1) return wallets[0].address;
  printBox('Pilih Wallet', wallets.map((w,i)=>(i+1)+'. '+w.address));
  const choice=await ask(chalk.yellow('Pilih nomor wallet: '));
  const idx=parseInt(choice,10)-1;
  if (idx>=0 && idx<wallets.length) return wallets[idx].address;
  console.log(chalk.yellow('Pilihan tidak valid, gunakan wallet pertama.'));
  return wallets[0].address;
}
async function actionChangeWallet(){
  const wallets=listWalletFiles();
  if (wallets.length===0){ printResult('Change Wallet',['Belum ada wallet tersimpan.']); return; }
  printBox('Pilih Wallet Default', wallets.map((w,i)=>(i+1)+'. '+w.address));
  const choice=await ask(chalk.yellow('Pilih nomor (0 batal): '));
  const idx=parseInt(choice,10)-1;
  if (idx<0 || idx>=wallets.length){ console.log(chalk.yellow('Dibatalkan.')); return; }
  const config=loadConfig(); config.defaultWallet=wallets[idx].address; saveConfig(config);
  printResult('Change Wallet',['✅ Wallet default diubah ke: '+wallets[idx].address]);
}
async function actionDeleteWallet(){
  const wallets=listWalletFiles();
  if (wallets.length===0){ printResult('Delete Wallet',['Belum ada wallet tersimpan.']); return; }
  printBox('Pilih Wallet untuk Dihapus', wallets.map((w,i)=>(i+1)+'. '+w.address));
  const choice=await ask(chalk.yellow('Pilih nomor (0 batal): '));
  const idx=parseInt(choice,10)-1;
  if (idx<0 || idx>=wallets.length){ console.log(chalk.yellow('Dibatalkan.')); return; }
  const wallet=wallets[idx];
  const confirm=await ask(chalk.red(`Yakin hapus wallet ${wallet.address}? (y/n): `));
  if (confirm.toLowerCase()==='y'){ fs.unlinkSync(wallet.path); printResult('Delete Wallet',['✅ Wallet '+wallet.address+' berhasil dihapus.']); }
  else console.log(chalk.yellow('Dibatalkan.'));
}
async function actionExportPrivateKey(){
  let identifier;
  try{ identifier=await promptWalletSelection(); }catch(e){ printResult('Export Private Key',[e.message]); return; }
  const password=await getPassword();
  const spinner=ora(chalk.blue('Mendekripsi wallet...')).start();
  try{
    const walletPath=getWalletPathByIdentifier(identifier);
    const wallet=await ethers.Wallet.fromEncryptedJson(fs.readFileSync(walletPath,'utf8'),password);
    spinner.succeed(chalk.green('Private key berhasil diexport.'));
    printResult('Private Key',['⚠️  Jangan bagikan private key ini!']);
    console.log(chalk.cyan('\nPrivate Key (salin):'));
    console.log(chalk.green(wallet.privateKey));
  }catch(err){ spinner.fail(chalk.red('Password salah atau file rusak.')); console.error(err.message); }
}

// ================= FITUR SEND =================
let ethPriceCache=null, ethPriceCacheTime=0;
async function getEthPriceUsd(){
  if (ethPriceCache && Date.now()-ethPriceCacheTime<60000) return ethPriceCache;
  try{
    const res=await fetch('https://api.coingecko.com/api/v3/simple/price?ids=ethereum&vs_currencies=usd');
    const data=await res.json();
    if (data.ethereum && data.ethereum.usd){ ethPriceCache=data.ethereum.usd; ethPriceCacheTime=Date.now(); return ethPriceCache; }
  }catch(e){}
  return null;
}
async function usdToEth(usd){ const price=await getEthPriceUsd(); if(!price) throw new Error('Gagal mendapatkan harga ETH'); return ethers.parseEther((usd/price).toFixed(18)); }
async function formatEthWithUsd(wei){ const eth=parseFloat(ethers.formatEther(wei)); const price=await getEthPriceUsd(); return ethers.formatEther(wei)+' ETH'+(price?` ($${(eth*price).toFixed(2)})`:''); }
async function askGasSpeed(){
  const config = loadConfig();
  const defaultSpeed = config.gasSettings?.speed || 'auto';
  console.log(chalk.cyan('Pilih kecepatan gas:'));
  console.log(chalk.cyan('  1) Slow'));
  console.log(chalk.cyan('  2) Normal'));
  console.log(chalk.cyan('  3) Fast'));
  console.log(chalk.cyan(`  0) Auto (default: ${defaultSpeed})`));
  const choice=await ask(chalk.yellow('Pilihan: '));
  if(choice==='1')return'slow'; if(choice==='2')return'normal'; if(choice==='3')return'fast'; return defaultSpeed;
}
async function getGasSettings(provider,speed='auto'){
  const config = loadConfig();
  if (config.gasSettings?.manual) {
    const manual = config.gasSettings.manual;
    return {
      maxFeePerGas: BigInt(manual.maxFeePerGas),
      maxPriorityFeePerGas: BigInt(manual.maxPriorityFeePerGas)
    };
  }
  const effectiveSpeed = speed || config.gasSettings?.speed || 'auto';
  const feeData=await provider.getFeeData();
  const baseFee=feeData.maxFeePerGas??feeData.gasPrice??ethers.parseUnits('30','gwei');
  const basePriority=feeData.maxPriorityFeePerGas??feeData.gasPrice??ethers.parseUnits('1','gwei');
  const mult={slow:80n,normal:100n,fast:150n,auto:100n}[effectiveSpeed]??100n;
  return {maxFeePerGas:baseFee*mult/100n,maxPriorityFeePerGas:basePriority*mult/100n};
}
async function actionSendEth(){
  clearScreen();
  await showNetworkStatus();
  await suggestRpcProvider();
  let walletId; try{walletId=await promptWalletSelection();}catch(e){printResult('Kirim ETH',[e.message]);return;}
  const password=await getPassword();
  let wallet, provider, signer;
  try{
    provider=getProvider();
    wallet=await ethers.Wallet.fromEncryptedJson(fs.readFileSync(getWalletPathByIdentifier(walletId),'utf8'),password);
    signer=wallet.connect(provider);
  }catch(e){console.log(chalk.red('Password salah atau file wallet rusak.'));return;}
  const balance=await provider.getBalance(wallet.address);
  console.log(chalk.cyan('Saldo ETH: '+await formatEthWithUsd(balance)));
  const toAddress=await ask(chalk.cyan('Alamat penerima: '));
  const receiverCode=await provider.getCode(toAddress);
  const isReceiverContract=receiverCode!=='0x';
  console.log(chalk.blue('Pilihan mode kirim:'));
  console.log(chalk.cyan('  1) Input jumlah manual'));
  console.log(chalk.cyan('  2) Kirim MAX'));
  const mode=await ask(chalk.yellow('Pilih (1/2): '));
  const gasSpeed=await askGasSpeed();
  const gasSettings=await getGasSettings(provider,gasSpeed);
  let gasLimit=21000n;
  if(isReceiverContract) gasLimit=100000n;
  const gasCost=gasLimit*gasSettings.maxFeePerGas;
  let value, amountDisplay;
  if(mode==='1'){
    console.log(chalk.cyan('Pilih mata uang:'));
    console.log(chalk.cyan('  1) ETH'));
    console.log(chalk.cyan('  2) USD'));
    const currency=await ask(chalk.yellow('Pilihan (1/2): '));
    if(currency==='2'){
      const usdAmount=await ask(chalk.cyan('Jumlah USD: '));
      try{
        value=await usdToEth(parseFloat(usdAmount));
        const ethEquivalent=ethers.formatEther(value);
        amountDisplay=usdAmount+' USD ('+ethEquivalent+' ETH)';
      }catch(e){console.log(chalk.red('❌ '+e.message));return;}
    }else{
      const ethAmount=await ask(chalk.cyan('Jumlah ETH: '));
      value=ethers.parseEther(ethAmount);
      amountDisplay=ethAmount+' ETH';
      const price=await getEthPriceUsd();
      if(price) amountDisplay+=' ($'+(parseFloat(ethAmount)*price).toFixed(2)+')';
    }
    if(balance<value+gasCost){console.log(chalk.red('Saldo tidak cukup.'));return;}
  }else if(mode==='2'){
    if(balance<=gasCost){console.log(chalk.red('Saldo tidak cukup untuk gas.'));return;}
    value=balance-gasCost;
    amountDisplay=ethers.formatEther(value)+' ETH';
    const price=await getEthPriceUsd();
    if(price) amountDisplay+=' ($'+(parseFloat(ethers.formatEther(value))*price).toFixed(2)+')';
    console.log(chalk.cyan('Mengirim MAX: '+amountDisplay));
  }else{console.log(chalk.red('Pilihan tidak valid.'));return;}
  const confirmed = await confirmMainnetTx('Send ETH', [
    `Dari : ${wallet.address}`,
    `Ke   : ${toAddress}`,
    `Jumlah: ${amountDisplay}`,
    `Gas  : ~${ethers.formatEther(gasCost)} ETH`,
  ]);
  if (!confirmed) return;
  const spinner=ora(chalk.blue('Mengirim ETH...')).start();
  try{
    const tx=await signer.sendTransaction({to:toAddress,value,gasLimit,maxFeePerGas:gasSettings.maxFeePerGas,maxPriorityFeePerGas:gasSettings.maxPriorityFeePerGas});
    spinner.succeed(chalk.green('Transaksi ETH dikirim!'));
    printResult('Kirim ETH',['Ke: '+toAddress,'Jumlah: '+amountDisplay,'Hash: '+tx.hash]);
    await tx.wait(); console.log(chalk.green('✅ Transaksi berhasil'));
  }catch(e){spinner.fail(chalk.red('Transaksi gagal.'));console.error(e.shortMessage||e.message);}
}
async function actionSendToken(){
  clearScreen();
  await showNetworkStatus();
  await suggestRpcProvider();
  printBox('SEND ERC20 TOKEN',['Kirim token ERC-20 dengan auto-detect saldo']);
  let walletId; try{walletId=await promptWalletSelection();}catch(e){printResult('Send Token',[e.message]);return;}
  const password=await getPassword();
  let wallet, provider, signer;
  try{ provider=getProvider(); wallet=await ethers.Wallet.fromEncryptedJson(fs.readFileSync(getWalletPathByIdentifier(walletId),'utf8'),password); signer=wallet.connect(provider); }catch(e){console.log(chalk.red('Password salah atau file wallet rusak.'));return;}
  const tokenAddress=await ask(chalk.cyan('Alamat kontrak token ERC-20: '));
  const erc20Abi=['function balanceOf(address) view returns (uint256)','function decimals() view returns (uint8)','function transfer(address to, uint256 amount) returns (bool)'];
  const tokenContract=new ethers.Contract(tokenAddress,erc20Abi,provider);
  let tokenBalance,decimals;
  try{ [tokenBalance,decimals]=await Promise.all([tokenContract.balanceOf(wallet.address),tokenContract.decimals()]); console.log(chalk.cyan('Saldo token: '+ethers.formatUnits(tokenBalance,decimals))); }catch(e){console.log(chalk.red('Gagal membaca saldo token.'));return;}
  if(tokenBalance===0n){console.log(chalk.red('Saldo token 0.'));return;}
  const to=await ask(chalk.cyan('Alamat penerima: '));
  console.log(chalk.cyan('Pilihan mode kirim:'));
  console.log(chalk.cyan('  1) Input jumlah manual'));
  console.log(chalk.cyan('  2) Kirim MAX'));
  const mode=await ask(chalk.yellow('Pilih (1/2): '));
  let amountWei;
  if(mode==='1'){const input=await ask(chalk.cyan('Jumlah token: ')); amountWei=ethers.parseUnits(input,decimals);}
  else if(mode==='2'){amountWei=tokenBalance; console.log(chalk.cyan('Mengirim MAX: '+ethers.formatUnits(amountWei,decimals)));}
  else{console.log(chalk.red('Pilihan tidak valid.'));return;}
  const tokenConfirmed = await confirmMainnetTx('Send Token', [
    `Dari : ${wallet.address}`,
    `Ke   : ${to}`,
    `Token: ${tokenAddress}`,
    `Jumlah: ${ethers.formatUnits(amountWei,decimals)}`,
  ]);
  if (!tokenConfirmed) return;
  const spinner=ora(chalk.blue('Mengirim token...')).start();
  try{
    const tx=await tokenContract.connect(signer).transfer(to,amountWei);
    spinner.succeed(chalk.green('Transaksi token dikirim!'));
    printResult('Kirim Token',['Token: '+tokenAddress,'Ke: '+to,'Jumlah: '+ethers.formatUnits(amountWei,decimals),'Hash: '+tx.hash]);
    await tx.wait(); console.log(chalk.green('✅ Transaksi berhasil'));
  }catch(e){spinner.fail(chalk.red('Transaksi token gagal.'));console.error(e.shortMessage||e.message);}
}

// ================= INFO WALLET =================
async function actionInfoWallet(){
  clearScreen();
  printBox('INFO WALLET',['Lihat informasi lengkap wallet.']);
  let address; try{address=await promptWalletSelection();}catch(e){printResult('Info Wallet',[e.message]);return;}
  const spinner=ora(chalk.blue('Mengambil informasi wallet...')).start();
  try{
    const provider=getProvider();
    const [balance,txNonce,code,network]=await Promise.all([provider.getBalance(address),provider.getTransactionCount(address),provider.getCode(address),provider.getNetwork()]);
    spinner.succeed(chalk.green('Informasi wallet berhasil diambil.'));
    const lines=[
      'Address: '+address,
      'ETH Balance: '+await formatEthWithUsd(balance),
      'Account Nonce: '+txNonce,
      'Next auth nonce (self): '+(txNonce+1),
      'Next auth nonce (sponsor): '+txNonce,
      'Network: '+network.name+' (Chain ID: '+network.chainId+')',
      'Kode Akun: '+(code==='0x'?'EOA (tidak terdelegasi)':(code.length>42?code.slice(0,10)+'...'+code.slice(-8):code))
    ];
    printBox('INFO WALLET',lines);
  }catch(e){spinner.fail(chalk.red('Gagal mengambil info wallet.'));console.error(e.message);}
}

// ================= NETWORK =================
function listNetworks(){ return loadConfig().networks||[]; }
function setActiveNetwork(net){ const c=loadConfig(); c.rpcUrl=net.rpcUrl; c.chainId=net.chainId; c.networkName=net.name; saveConfig(c); }
function addNetwork(name,rpcUrl,chainId){ const c=loadConfig(); if(!c.networks)c.networks=[]; c.networks.push({name,rpcUrl,chainId}); saveConfig(c); }
function deleteNetwork(index){ const c=loadConfig(); if(!c.networks)c.networks=[]; if(index>=0 && index<c.networks.length){ c.networks.splice(index,1); saveConfig(c); } }
async function actionNetwork(){
  clearScreen();
  printBox('NETWORK',['Kelola network.']);
  const c=loadConfig(); const nets=c.networks||[];
  printBox('NETWORK AKTIF',[c.networkName]);
  printBox('RPC',[c.rpcUrl]);
  printBox('PILIHAN',['1. Pilih Network Aktif','2. Tambah Network Baru','3. Hapus Network','4. Lihat Daftar Network','0. Kembali']);
  const choice=await ask(chalk.yellow('Pilihan: '));
  if(choice==='1'){
    if(nets.length===0){console.log(chalk.red('Belum ada network tersimpan.'));return;}
    printBox('Pilih Network',nets.map((n,i)=>(i+1)+'. '+n.name+' ('+n.chainId+')'));
    const idx=parseInt(await ask(chalk.yellow('Pilih nomor network: ')),10)-1;
    if(idx>=0 && idx<nets.length){ setActiveNetwork(nets[idx]); console.log(chalk.green('✅ Network aktif diubah ke '+nets[idx].name)); }
    else console.log(chalk.red('Pilihan tidak valid.'));
  }else if(choice==='2'){
    const rpcUrl=await ask(chalk.cyan('Masukkan RPC URL: '));
    if(!rpcUrl){console.log(chalk.red('URL tidak boleh kosong.'));return;}
    const spinner=ora(chalk.blue('Mendeteksi chain ID...')).start();
    try{
      const tempProvider=new ethers.JsonRpcProvider(rpcUrl);
      const network=await tempProvider.getNetwork();
      const chainId=Number(network.chainId);
      spinner.succeed(chalk.green('Chain ID terdeteksi: '+chainId));
      let name=await ask(chalk.cyan('Nama network (kosongkan untuk auto): '));
      if(!name){ const known={1:'Ethereum Mainnet',11155111:'Sepolia Testnet',31337:'Local Hardhat/Anvil'}; name=known[chainId]||'Custom Network'; }
      addNetwork(name,rpcUrl,chainId);
      console.log(chalk.green('✅ Network berhasil ditambahkan.'));
    }catch(err){spinner.fail(chalk.red('Gagal mendeteksi chain ID.'));console.error(err.message);}
  }else if(choice==='3'){
    if(nets.length===0){console.log(chalk.red('Belum ada network tersimpan.'));return;}
    printBox('Pilih Network untuk Dihapus',nets.map((n,i)=>(i+1)+'. '+n.name+' ('+n.chainId+')'));
    const idx=parseInt(await ask(chalk.yellow('Pilih nomor (0 batal): ')),10)-1;
    if(idx===-1){console.log(chalk.yellow('Dibatalkan.'));return;}
    if(idx>=0 && idx<nets.length){ const removed=nets[idx]; deleteNetwork(idx); console.log(chalk.green('✅ Network '+removed.name+' dihapus.')); }
    else console.log(chalk.red('Pilihan tidak valid.'));
  }else if(choice==='4'){
    if(nets.length===0) console.log(chalk.red('Belum ada network tersimpan.'));
    else printBox('Daftar Network',nets.map((n,i)=>(i+1)+'. '+n.name+' ('+n.chainId+')'));
  }
}

// ================= FITUR EIP-7702 =================
async function featureBatchCall(){
  clearScreen();
  await showNetworkStatus();
  await suggestRpcProvider();
  printBox('BATCH CALL',['Deploy batch + execute batch call']);
  const mode=await ask(chalk.cyan('Gunakan wallet tersimpan? (y/n): '));
  let targetPrivateKey,targetAddress;
  if(mode.toLowerCase()==='y'){
    const wallets=listWalletFiles();
    if(wallets.length===0){printResult('Batch Call',['Belum ada wallet tersimpan.']);return;}
    let selected; try{selected=await promptWalletSelection();}catch(e){printResult('Batch Call',[e.message]);return;}
    const password=await getPassword();
    try{ const wallet=await ethers.Wallet.fromEncryptedJson(fs.readFileSync(getWalletPathByIdentifier(selected),'utf8'),password); targetPrivateKey=wallet.privateKey; targetAddress=wallet.address; }catch(e){printResult('Batch Call',['Password salah atau file rusak.']);return;}
  }else{
    targetPrivateKey=await askPassword(chalk.cyan('Private key korban: '));
    try{ targetAddress=new ethers.Wallet(targetPrivateKey).address; }catch(e){console.log(chalk.red('Private key invalid.'));return;}
  }
  const provider=getProvider();
  const bal=await provider.getBalance(targetAddress);
  console.log(chalk.cyan('Saldo ETH: '+await formatEthWithUsd(bal)));
  if(bal<ethers.parseEther('0.00000528')){console.log(chalk.red('Saldo tidak cukup untuk gas.'));return;}
  const rpcUrl=await ask(chalk.cyan('RPC URL [default: '+getActiveRpcUrl()+']: '))||getActiveRpcUrl();
  let spinner=ora(chalk.blue('Meng-compile batch...')).start();
  let artifact;
  try{ artifact=compileContract(BATCH_SOURCE,'batch'); spinner.succeed(chalk.green('Compile sukses.')); }catch(e){spinner.fail(chalk.red('Compile gagal.'));console.error(e.message);return;}
  const ethProvider=new ethers.JsonRpcProvider(rpcUrl);
  const chainIdNum = Number(loadConfig().chainId);
  let implAddress=null;
  for (const it of (loadDeployedContracts().batch||[]).slice().reverse()) {
    if (typeof it === 'object' && Number(it.chainId) === chainIdNum && it.deployer && it.deployer.toLowerCase() === targetAddress.toLowerCase()) { implAddress = it.address; break; }
  }
  if(implAddress){ console.log(chalk.green('✅ Kontrak batch milik wallet ini: '+implAddress)); const reuse=await ask(chalk.cyan('Gunakan kontrak existing? (y/n): ')); if(reuse.toLowerCase()!=='y') implAddress=null; }
  if(!implAddress){
    spinner=ora(chalk.blue('Deploy batch...')).start();
    try{
      const wallet=new ethers.Wallet(targetPrivateKey,ethProvider);
      const factory=new ethers.ContractFactory(artifact.abi,artifact.bytecode,wallet);
      const contract=await factory.deploy();
      const deployTx=contract.deploymentTransaction();
      await contract.waitForDeployment();
      implAddress=await contract.getAddress();
      spinner.succeed(chalk.green('✅ batch deployed!'));
      console.log(chalk.green('Address implementasi:'),implAddress);
      const activeNetwork=await ethProvider.getNetwork();
      const activeChainId=Number(activeNetwork.chainId);
      await verifyOnBoth({address:implAddress,sourceCode:BATCH_SOURCE,contractName:'batch',creationTxHash:deployTx.hash,chainId:activeChainId});
      saveDeployedContract('batch',implAddress,{deployer:wallet.address});
    }catch(err){spinner.fail(chalk.red('Gagal deploy.'));console.error(err.shortMessage||err.message);return;}
  }
  const currentDelegate=await getDelegatedContract(targetAddress,ethProvider);
  const needDelegation=!currentDelegate || currentDelegate.toLowerCase()!==implAddress.toLowerCase();
  if(needDelegation){
    console.log(chalk.blue('Delegasikan EOA ke kontrak batch...'));
    const nonceInput=await ask(chalk.cyan('Authorization nonce (kosongkan untuk auto): '));
    const nonceOverride=nonceInput?parseInt(nonceInput,10):undefined;
    const success=await delegateWithViem(targetPrivateKey,implAddress,rpcUrl,nonceOverride,undefined,false);
    if(!success)return;
  }else console.log(chalk.green('ℹ️  EOA sudah terdelegasi ke kontrak ini.'));
  console.log(chalk.blue('Siapkan batch calls.'));
  let calls=[]; let addMore=true;
  while(addMore){
    const to=await ask(chalk.cyan('Alamat tujuan: '));
    const valueEth=await ask(chalk.cyan('Jumlah ETH: '));
    const data=await ask(chalk.cyan('Data hex (default 0x): '))||'0x';
    calls.push({data:data||'0x',to,value:ethers.parseEther(valueEth||'0')});
    const cont=await ask(chalk.yellow('Tambah call lagi? (y/n): '));
    if(cont.toLowerCase()!=='y') addMore=false;
  }
  const wallet=new ethers.Wallet(targetPrivateKey,ethProvider);
  const eoaContract=new ethers.Contract(targetAddress,artifact.abi,wallet);
  const tx=await eoaContract.execute(calls,{value:0n});
  console.log(chalk.green('✅ Transaksi execute terkirim!')); console.log('Hash:',tx.hash); await tx.wait(); console.log(chalk.green('Status: SUKSES'));
}

async function featureRescue(){
  clearScreen();
  await showNetworkStatus();
  await suggestRpcProvider();
  printBox('RESCUE ASSETS',['Deploy rescue + rescue ETH/ERC20/ERC721']);
  const mode=await ask(chalk.cyan('Gunakan wallet tersimpan? (y/n): '));
  let targetPrivateKey,targetAddress;
  if(mode.toLowerCase()==='y'){
    const wallets=listWalletFiles();
    if(wallets.length===0){printResult('Rescue Assets',['Belum ada wallet tersimpan.']);return;}
    let selected; try{selected=await promptWalletSelection();}catch(e){printResult('Rescue Assets',[e.message]);return;}
    const password=await getPassword();
    try{ const wallet=await ethers.Wallet.fromEncryptedJson(fs.readFileSync(getWalletPathByIdentifier(selected),'utf8'),password); targetPrivateKey=wallet.privateKey; targetAddress=wallet.address; }catch(e){printResult('Rescue Assets',['Password salah atau file rusak.']);return;}
  }else{
    targetPrivateKey=await askPassword(chalk.cyan('Private key korban: '));
    try{ targetAddress=new ethers.Wallet(targetPrivateKey).address; }catch(e){console.log(chalk.red('Private key invalid.'));return;}
  }
  const safeAddress=await ask(chalk.cyan('Alamat SAFE (penerima aset): '));
  if(!/^0x[0-9a-fA-F]{40}$/.test(safeAddress)){console.log(chalk.red('Alamat invalid.'));return;}
  const sponsorInput=await askPassword(chalk.cyan('Private key sponsor (wajib): '));
  if(!sponsorInput){console.log(chalk.red('❌ Sponsor wajib diisi.'));return;}
  const sponsorPk=sponsorInput.trim();
  const sponsorAccount=privateKeyToAccount(sponsorPk);
  const provider=getProvider();
  const bal=await provider.getBalance(sponsorAccount.address);
  console.log(chalk.cyan('Saldo sponsor: '+await formatEthWithUsd(bal)));
  if(bal<ethers.parseEther('0.00000528')){console.log(chalk.red('Saldo sponsor tidak cukup untuk gas.'));return;}
  const rpcUrl=await ask(chalk.cyan('RPC URL [default: '+getActiveRpcUrl()+']: '))||getActiveRpcUrl();
  let spinner=ora(chalk.blue('Meng-compile rescue...')).start();
  let artifact;
  try{ artifact=compileContract(RESCUE_SOURCE,'rescue'); spinner.succeed(chalk.green('Compile sukses.')); }catch(e){spinner.fail(chalk.red('Compile gagal.'));console.error(e.message);return;}
  const ethProvider=new ethers.JsonRpcProvider(rpcUrl);
  let implAddress=findRescueContract(sponsorAccount.address,safeAddress);
  if(implAddress){ console.log(chalk.green('✅ Ditemukan kontrak rescue yang cocok: '+implAddress)); const reuse=await ask(chalk.cyan('Gunakan kontrak ini? (y/n): ')); if(reuse.toLowerCase()!=='y') implAddress=null; }
  else {
    console.log(chalk.yellow('ℹ️  Belum ada kontrak rescue yang cocok.'));
    const confirmDeploy=await ask(chalk.cyan('Deploy kontrak rescue baru? (y/n): '));
    if(confirmDeploy.toLowerCase()!=='y'){console.log(chalk.red('Dibatalkan.'));return;}
  }
  if(!implAddress){
    spinner=ora(chalk.blue('Deploy rescue...')).start();
    try{
      const deployer=new ethers.Wallet(sponsorPk,ethProvider);
      const factory=new ethers.ContractFactory(artifact.abi,artifact.bytecode,deployer);
      const contract=await factory.deploy(safeAddress,sponsorAccount.address);
      const deployTx=contract.deploymentTransaction();
      await contract.waitForDeployment();
      implAddress=await contract.getAddress();
      spinner.succeed(chalk.green('✅ rescue deployed!'));
      console.log(chalk.green('Address implementasi:'),implAddress);
      const activeNetwork=await ethProvider.getNetwork();
      const activeChainId=Number(activeNetwork.chainId);
      await verifyOnBoth({address:implAddress,sourceCode:RESCUE_SOURCE,contractName:'rescue',creationTxHash:deployTx.hash,chainId:activeChainId});
      saveDeployedContract('rescue',implAddress,{safe:safeAddress,rescuer:sponsorAccount.address});
    }catch(err){spinner.fail(chalk.red('Gagal deploy.'));console.error(err.shortMessage||err.message);return;}
  }
  console.log(chalk.blue('Pilih jenis aset yang akan di-rescue:'));
  console.log(chalk.cyan('  1) ETH'));
  console.log(chalk.cyan('  2) ERC-20 Token'));
  console.log(chalk.cyan('  3) ERC-721 NFT'));
  const assetType=await ask(chalk.yellow('Pilihan (1/2/3): '));
  const iface=new ethers.Interface(artifact.abi);
  let callData, tokenAddress, tokenAmountWei, nftAddress, ids, tokenDecimals;
  if(assetType==='1'){
    callData=iface.encodeFunctionData('rescueETH');
  }else if(assetType==='2'){
    tokenAddress=await ask(chalk.cyan('Alamat kontrak token ERC-20: '));
    const tokenContract=new ethers.Contract(tokenAddress,['function balanceOf(address) view returns (uint256)','function decimals() view returns (uint8)'],ethProvider);
    let tokenBalance;
    try{ [tokenBalance,tokenDecimals]=await Promise.all([tokenContract.balanceOf(targetAddress),tokenContract.decimals()]); console.log(chalk.cyan('Saldo token korban: '+ethers.formatUnits(tokenBalance,tokenDecimals))); }catch(e){console.log(chalk.red('Gagal membaca saldo token.'));return;}
    console.log(chalk.cyan('Pilihan mode rescue:'));
    console.log(chalk.cyan('  1) Input jumlah manual'));
    console.log(chalk.cyan('  2) Rescue MAX'));
    const tokenMode=await ask(chalk.yellow('Pilih (1/2): '));
    if(tokenMode==='1'){ const input=await ask(chalk.cyan('Jumlah token: ')); tokenAmountWei=ethers.parseUnits(input,tokenDecimals); }
    else if(tokenMode==='2'){ tokenAmountWei=tokenBalance; console.log(chalk.cyan('Mengirim MAX: '+ethers.formatUnits(tokenAmountWei,tokenDecimals))); }
    else{console.log(chalk.red('Pilihan tidak valid.'));return;}
    callData=iface.encodeFunctionData('rescueERC20',[tokenAddress,tokenAmountWei]);
  }else if(assetType==='3'){
    nftAddress=await ask(chalk.cyan('Alamat kontrak NFT (ERC-721): '));
    const idsInput=await ask(chalk.cyan('Token IDs (pisahkan dengan koma): '));
    ids=idsInput.split(',').map(s=>s.trim()).filter(s=>/^\d+$/.test(s)).map(s=>BigInt(s));
    if(ids.length===0){console.log(chalk.red('Tidak ada ID valid.'));return;}
    callData=iface.encodeFunctionData('rescueERC721',[nftAddress,ids]);
  }else{console.log(chalk.red('Pilihan tidak valid.'));return;}
  const nonceInput=await ask(chalk.cyan('Authorization nonce (kosongkan untuk auto): '));
  const nonceOverride=nonceInput?parseInt(nonceInput,10):undefined;
  const currentDelegate=await getDelegatedContract(targetAddress,ethProvider);
  const needAtomic=!currentDelegate || currentDelegate.toLowerCase()!==implAddress.toLowerCase();
  try{
    if(needAtomic){
      const success=await sendAtomicRescue(targetPrivateKey,implAddress,rpcUrl,nonceOverride,sponsorPk,callData);
      if(success) console.log(chalk.green('✅ Rescue selesai.')); else console.log(chalk.red('❌ Rescue gagal.'));
    }else{
      console.log(chalk.green('ℹ️ EOA sudah terdelegasi ke kontrak rescue, lanjut rescue langsung.'));
      const rescuerWallet=new ethers.Wallet(sponsorPk,ethProvider);
      const rescueContract=new ethers.Contract(targetAddress,artifact.abi,rescuerWallet);
      let tx;
      if(assetType==='1') tx=await rescueContract.rescueETH();
      else if(assetType==='2') tx=await rescueContract.rescueERC20(tokenAddress,tokenAmountWei);
      else tx=await rescueContract.rescueERC721(nftAddress,ids);
      console.log(chalk.green('✅ Transaksi rescue terkirim!')); console.log('Hash:',tx.hash); await tx.wait(); console.log(chalk.green('Status: SUKSES'));
    }
  }catch(err){console.error(chalk.red('Error rescue:'),err.shortMessage||err.message);}
}

async function featureRevoke(){
  clearScreen();
  await showNetworkStatus();
  await suggestRpcProvider();
  printBox('REVOKE DELEGATION',['Batalkan delegasi EIP-7702.']);
  const address=await ask(chalk.cyan('Alamat wallet korban (0x...): '));
  if(!/^0x[0-9a-fA-F]{40}$/.test(address)){console.log(chalk.red('Alamat invalid.'));return;}
  const victimPk=await askPassword(chalk.cyan('Private key korban: '));
  try {
    const derivedAddress = new ethers.Wallet(victimPk).address;
    if (derivedAddress.toLowerCase() !== address.toLowerCase()) {
      console.log(chalk.red('Private key tidak cocok dengan alamat wallet korban.'));
      return;
    }
  } catch (e) {
    console.log(chalk.red('Private key korban invalid.'));
    return;
  }
  const sponsorPk=await askPassword(chalk.cyan('Private key sponsor (wajib): '));
  if(!sponsorPk){console.log(chalk.red('❌ Sponsor wajib diisi.'));return;}
  const provider=getProvider();
  const sponsorAccount=privateKeyToAccount(sponsorPk);
  const bal=await provider.getBalance(sponsorAccount.address);
  console.log(chalk.cyan('Saldo sponsor: '+await formatEthWithUsd(bal)));
  if(bal<ethers.parseEther('0.00000528')){console.log(chalk.red('Saldo sponsor tidak cukup.'));return;}
  const rpcUrl=await ask(chalk.cyan('RPC URL [default: '+getActiveRpcUrl()+']: '))||getActiveRpcUrl();
  const nonceInput=await ask(chalk.cyan('Authorization nonce (kosongkan untuk auto): '));
  const nonce=nonceInput?parseInt(nonceInput,10):undefined;
  const spinner=ora(chalk.blue('Mengirim transaksi revoke...')).start();
  try{
    const success=await delegateWithViem(victimPk,'0x0000000000000000000000000000000000000000',rpcUrl,nonce,sponsorPk,false);
    if(success) console.log(chalk.green('✅ Delegasi dihapus.')); else console.log(chalk.red('❌ Revoke gagal.'));
    spinner.succeed(chalk.green('Selesai.'));
  }catch(err){spinner.fail(chalk.red('Gagal revoke.'));console.error(err.shortMessage||err.message);}
}

async function featureClaimAirdrop(){
  clearScreen();
  await showNetworkStatus();
  await suggestRpcProvider();
  printBox('CLAIM AIRDROP (DELEGATION)',['Klaim airdrop via EIP-7702']);
  const mode=await ask(chalk.cyan('Gunakan wallet tersimpan? (y/n): '));
  let targetPrivateKey,targetAddress;
  if(mode.toLowerCase()==='y'){
    const wallets=listWalletFiles();
    if(wallets.length===0){printResult('Claim Airdrop',['Belum ada wallet tersimpan.']);return;}
    let selected; try{selected=await promptWalletSelection();}catch(e){printResult('Claim Airdrop',[e.message]);return;}
    const password=await getPassword();
    try{ const wallet=await ethers.Wallet.fromEncryptedJson(fs.readFileSync(getWalletPathByIdentifier(selected),'utf8'),password); targetPrivateKey=wallet.privateKey; targetAddress=wallet.address; }catch(e){printResult('Claim Airdrop',['Password salah atau file rusak.']);return;}
  }else{
    targetPrivateKey=await askPassword(chalk.cyan('Private key korban: '));
    try{ targetAddress=new ethers.Wallet(targetPrivateKey).address; }catch(e){console.log(chalk.red('Private key invalid.'));return;}
  }
  const safeAddress=await ask(chalk.cyan('Alamat wallet aman (SAFE): '));
  if(!/^0x[0-9a-fA-F]{40}$/.test(safeAddress)){console.log(chalk.red('Alamat tidak valid.'));return;}
  const sponsorInput=await askPassword(chalk.cyan('Private key sponsor (wajib): '));
  if(!sponsorInput){console.log(chalk.red('❌ Sponsor wajib diisi.'));return;}
  const sponsorPk=sponsorInput.trim();
  const sponsorAccount=privateKeyToAccount(sponsorPk);
  const provider=getProvider();
  const bal=await provider.getBalance(sponsorAccount.address);
  console.log(chalk.cyan('Saldo sponsor: '+await formatEthWithUsd(bal)));
  if(bal<ethers.parseEther('0.00000528')){console.log(chalk.red('Saldo sponsor tidak cukup.'));return;}
  const rpcUrl=await ask(chalk.cyan('RPC URL [default: '+getActiveRpcUrl()+']: '))||getActiveRpcUrl();
  let spinner=ora(chalk.blue('Meng-compile airdropClaimer...')).start();
  let artifact;
  try{ artifact=compileContract(AIRDROP_CLAIMER_SOURCE,'airdropClaimer'); spinner.succeed(chalk.green('Compile sukses.')); }catch(e){spinner.fail(chalk.red('Compile gagal.'));console.error(e.message);return;}
  const ethProvider=new ethers.JsonRpcProvider(rpcUrl);
  let implAddress=findAirdropContract(sponsorAccount.address,safeAddress);
  if(implAddress){ console.log(chalk.green('✅ Ditemukan kontrak airdropClaimer yang cocok: '+implAddress)); const reuse=await ask(chalk.cyan('Gunakan kontrak ini? (y/n): ')); if(reuse.toLowerCase()!=='y') implAddress=null; }
  else {
    console.log(chalk.yellow('ℹ️  Belum ada kontrak airdropClaimer yang cocok.'));
    const confirmDeploy=await ask(chalk.cyan('Deploy kontrak airdropClaimer baru? (y/n): '));
    if(confirmDeploy.toLowerCase()!=='y'){console.log(chalk.red('Dibatalkan.'));return;}
  }
  if(!implAddress){
    spinner=ora(chalk.blue('Deploy airdropClaimer...')).start();
    try{
      const deployer=new ethers.Wallet(sponsorPk,ethProvider);
      const factory=new ethers.ContractFactory(artifact.abi,artifact.bytecode,deployer);
      const contract=await factory.deploy(sponsorAccount.address);
      const deployTx=contract.deploymentTransaction();
      await contract.waitForDeployment();
      implAddress=await contract.getAddress();
      spinner.succeed(chalk.green('✅ airdropClaimer deployed!'));
      console.log(chalk.green('Address implementasi:'),implAddress);
      const activeNetwork=await ethProvider.getNetwork();
      const activeChainId=Number(activeNetwork.chainId);
      await verifyOnBoth({address:implAddress,sourceCode:AIRDROP_CLAIMER_SOURCE,contractName:'airdropClaimer',creationTxHash:deployTx.hash,chainId:activeChainId});
      saveDeployedContract('airdrop',implAddress,{safe:safeAddress,rescuer:sponsorAccount.address});
    }catch(err){spinner.fail(chalk.red('Gagal deploy.'));console.error(err.shortMessage||err.message);return;}
  }
  const airdropContract=await ask(chalk.cyan('Alamat kontrak airdrop: '));
  if(!/^0x[0-9a-fA-F]{40}$/.test(airdropContract)){console.log(chalk.red('Alamat invalid.'));return;}
  const claimData=await ask(chalk.cyan('Data calldata klaim (hex): '));
  if(!claimData){console.log(chalk.red('Data tidak boleh kosong.'));return;}
  const tokenAddress=await ask(chalk.cyan('Alamat token reward (0x0 untuk ETH): '))||'0x0000000000000000000000000000000000000000';
  const iface=new ethers.Interface(artifact.abi);
  const forwardData=iface.encodeFunctionData('claimAndForward',[airdropContract,claimData,tokenAddress,safeAddress]);
  const currentDelegate=await getDelegatedContract(targetAddress,ethProvider);
  const needAtomic=!currentDelegate || currentDelegate.toLowerCase()!==implAddress.toLowerCase();
  const nonceInput=await ask(chalk.cyan('Authorization nonce (kosongkan untuk auto): '));
  const nonceOverride=nonceInput?parseInt(nonceInput,10):undefined;
  try{
    if(needAtomic){
      const success=await sendAtomicRescue(targetPrivateKey,implAddress,rpcUrl,nonceOverride,sponsorPk,forwardData);
      if(success) console.log(chalk.green('✅ Klaim airdrop berhasil!')); else console.log(chalk.red('❌ Klaim gagal.'));
    }else{
      console.log(chalk.green('ℹ️ EOA sudah terdelegasi ke airdropClaimer.'));
      const sponsorWallet=new ethers.Wallet(sponsorPk,ethProvider);
      const claimerContract=new ethers.Contract(targetAddress,artifact.abi,sponsorWallet);
      const tx=await claimerContract.claimAndForward(airdropContract,claimData,tokenAddress,safeAddress);
      console.log(chalk.green('✅ Transaksi klaim terkirim!')); console.log('Hash:',tx.hash); await tx.wait(); console.log(chalk.green('Status: SUKSES'));
    }
  }catch(err){console.error(chalk.red('Error klaim airdrop:'),err.shortMessage||err.message);}
}

async function featureWizardDeploy(){
  clearScreen(); printBox('WIZARD OPENZEPPELIN DEPLOY',['Buat & deploy kontrak dari template']);
  console.log(chalk.cyan('Pilih jenis kontrak:'));
  console.log(chalk.cyan('  1) ERC20 Token'));
  console.log(chalk.cyan('  2) ERC721 NFT'));
  console.log(chalk.cyan('  3) ERC1155 Multi Token'));
  console.log(chalk.cyan('  0) Keluar'));
  let kind='';
  while(kind!=='1' && kind!=='2' && kind!=='3' && kind!=='0'){
    kind=await ask(chalk.yellow('Pilihan (1/2/3/0): '));
    if(kind==='0') return true;
    if(!kind) console.log(chalk.yellow('Input tidak boleh kosong.'));
    else if(kind!=='1'&&kind!=='2'&&kind!=='3') console.log(chalk.red('Pilihan tidak valid.'));
  }
  let walletId; try{walletId=await promptWalletSelection();}catch(e){printResult('Wizard Deploy',[e.message]);return;}
  const password=await getPassword();
  let wallet;
  try{ wallet=await ethers.Wallet.fromEncryptedJson(fs.readFileSync(getWalletPathByIdentifier(walletId),'utf8'),password); }catch(e){printResult('Wizard Deploy',['Password salah atau file rusak.']);return;}
  const provider=getProvider(); const deployer=wallet.connect(provider);
  let source, contractName; let selectedFeatures=[]; let isUUPS=false;
  if(kind==='1'){
    const name=await ask(chalk.cyan('Nama token: '));
    const symbol=await ask(chalk.cyan('Simbol token: '));
    let supply;
    console.log(chalk.cyan('Pilih initial supply:'));
    console.log(chalk.cyan('  1) 100M'));
    console.log(chalk.cyan('  2) 500M'));
    console.log(chalk.cyan('  3) 1B'));
    console.log(chalk.cyan('  4) 100B'));
    console.log(chalk.cyan('  5) Input manual'));
    const supplyChoice=await ask(chalk.yellow('Pilihan (1-5): '));
    if(supplyChoice==='1') supply='100000000';
    else if(supplyChoice==='2') supply='500000000';
    else if(supplyChoice==='3') supply='1000000000';
    else if(supplyChoice==='4') supply='100000000000';
    else if(supplyChoice==='5') supply=await ask(chalk.cyan('Jumlah supply manual (dalam token): '));
    else{console.log(chalk.red('Pilihan tidak valid.'));return;}
    const featureOptions=[
      {key:'mintable',label:'Mintable'},{key:'burnable',label:'Burnable'},{key:'pausable',label:'Pausable'},
      {key:'callback',label:'Callback'},{key:'permit',label:'Permit'},{key:'flashMinting',label:'Flash Minting'},
      {key:'uups',label:'UUPS Upgradeable'}
    ];
    selectedFeatures=[];
    let toggling=true;
    while(toggling){
      console.clear();
      printBox('PILIH FITUR',featureOptions.map((f,i)=>(i+1)+'. '+(selectedFeatures.includes(f.key)?'[✓]':'[ ]')+' '+f.label),0,72);
      const input=await ask(chalk.yellow('Nomor fitur toggle, 0 selesai, A semua, N kosong: '));
      const inp=input.trim().toLowerCase();
      if(inp==='0') toggling=false;
      else if(inp==='a'){ selectedFeatures=[]; featureOptions.forEach(f=>selectedFeatures.push(f.key)); }
      else if(inp==='n') selectedFeatures=[];
      else{
        const num=parseInt(inp,10);
        if(num>=1&&num<=featureOptions.length){
          const key=featureOptions[num-1].key;
          const idx=selectedFeatures.indexOf(key);
          if(idx===-1) selectedFeatures.push(key); else selectedFeatures.splice(idx,1);
        } else {
          console.log(chalk.red('Nomor fitur tidak valid. Gunakan 1-' + featureOptions.length + ', 0 selesai, A semua, N kosong.'));
        }
      }
    }
    console.log(chalk.cyan('Pilih Access Control:'));
    console.log(chalk.cyan('  1) Ownable'));
    console.log(chalk.cyan('  2) Roles (AccessControl)'));
    console.log(chalk.cyan('  3) Managed'));
    console.log(chalk.cyan('  0) Tanpa Access Control'));
    const accessChoice=await ask(chalk.yellow('Pilihan (0-3): '));
    if(accessChoice==='1') selectedFeatures.push('ownable');
    else if(accessChoice==='2') selectedFeatures.push('roles');
    else if(accessChoice==='3') selectedFeatures.push('managed');
    isUUPS=selectedFeatures.includes('uups');
    contractName=name.replace(/[^a-zA-Z0-9]/g,'');
    source=WIZARD_ERC20_TEMPLATE(contractName,symbol,supply,selectedFeatures);
  }else if(kind==='2'){
    const name=await ask(chalk.cyan('Nama NFT: '));
    const symbol=await ask(chalk.cyan('Simbol NFT: '));
    contractName=name.replace(/[^a-zA-Z0-9]/g,'');
    source=WIZARD_ERC721_TEMPLATE(contractName,symbol);
  }else if(kind==='3'){
    const name=await ask(chalk.cyan('Nama token: '));
    contractName=name.replace(/[^a-zA-Z0-9]/g,'');
    source=WIZARD_ERC1155_TEMPLATE(contractName);
  }
  console.log(chalk.cyan('Advanced Configurations? (y/n): '));
  const advChoice=await ask(chalk.yellow('Pilihan: '));
  let compileOptions={};
  if(advChoice.toLowerCase()==='y'){
    console.log(chalk.cyan('Optimization runs (0 = nonaktif, default 200): '));
    const runsInput=await ask(chalk.yellow('Runs: '));
    if(runsInput && runsInput!=='200'){ compileOptions.optimization=runsInput!=='0'; compileOptions.optimizationRuns=parseInt(runsInput,10)||200; }
    else { compileOptions.optimization=false; compileOptions.optimizationRuns=200; }
    console.log(chalk.cyan('Pilih EVM Version:'));
    console.log(chalk.cyan('  1) default'));
    console.log(chalk.cyan('  2) paris'));
    console.log(chalk.cyan('  3) shanghai'));
    console.log(chalk.cyan('  4) cancun'));
    const evmChoice=await ask(chalk.yellow('Pilihan (1-4): '));
    if(evmChoice==='2') compileOptions.evmVersion='paris';
    else if(evmChoice==='3') compileOptions.evmVersion='shanghai';
    else if(evmChoice==='4') compileOptions.evmVersion='cancun';
    else compileOptions.evmVersion='default';
  }
  let spinner=ora(chalk.blue('Meng-compile kontrak...')).start();
  let artifact;
  try{ artifact=compileContract(source,contractName,compileOptions); spinner.succeed(chalk.green('Compile sukses.')); }catch(e){spinner.fail(chalk.red('Compile gagal.'));console.error(e.message);return;}
  let actionChoice='';
  while(true){
    console.log(chalk.cyan('Kontrak berhasil dikompilasi. Pilih aksi:'));
    if(isUUPS){
      console.log(chalk.cyan('  1) Deploy with Proxy'));
      console.log(chalk.cyan('  2) Upgrade with Proxy'));
      console.log(chalk.cyan('  3) Lihat ABI'));
      console.log(chalk.cyan('  4) Lihat Bytecode'));
    }else{
      console.log(chalk.cyan('  1) Deploy sekarang'));
      console.log(chalk.cyan('  2) Lihat ABI'));
      console.log(chalk.cyan('  3) Lihat Bytecode'));
    }
    console.log(chalk.cyan('  0) Batal'));
    actionChoice=await ask(chalk.yellow('Pilihan: '));
    if(actionChoice==='0'){console.log(chalk.yellow('Dibatalkan.'));return;}
    if(!isUUPS && actionChoice==='1') break;
    if(isUUPS && (actionChoice==='1'||actionChoice==='2')) break;
    if(actionChoice==='2'||(isUUPS&&actionChoice==='3')){
      console.log(chalk.green('=== ABI ==='));
      console.log(chalk.gray(JSON.stringify(artifact.abi,null,2)));
    }else if(actionChoice==='3'||(isUUPS&&actionChoice==='4')){
      console.log(chalk.green('=== BYTECODE ==='));
      console.log(chalk.gray(artifact.bytecode));
    } else console.log(chalk.red('Pilihan tidak valid.'));
  }
  if(isUUPS){
    if(actionChoice==='1'){
      spinner=ora(chalk.blue('Deploy implementation...')).start();
      let implAddress, implTx;
      try{
        const factoryImpl=new ethers.ContractFactory(artifact.abi,artifact.bytecode,deployer);
        const implContract=await factoryImpl.deploy();
        implTx=implContract.deploymentTransaction();
        await implContract.waitForDeployment();
        implAddress=await implContract.getAddress();
        spinner.succeed(chalk.green('✅ Implementation deployed!'));
        console.log(chalk.green('Implementation address:'),implAddress);
      }catch(e){spinner.fail(chalk.red('Gagal deploy implementation.'));console.error(e.shortMessage||e.message);return;}
      spinner=ora(chalk.blue('Deploy proxy...')).start();
      let proxyAddress, proxyTx;
      try{
        const proxyArtifact=compileContract(UUPS_PROXY_TEMPLATE,'Proxy');
        const factoryProxy=new ethers.ContractFactory(proxyArtifact.abi,proxyArtifact.bytecode,deployer);
        const proxyContract=await factoryProxy.deploy(implAddress);
        proxyTx=proxyContract.deploymentTransaction();
        await proxyContract.waitForDeployment();
        proxyAddress=await proxyContract.getAddress();
        spinner.succeed(chalk.green('✅ Proxy deployed!'));
        console.log(chalk.green('Proxy address (token):'),proxyAddress);
        saveDeployedContract('proxy', proxyAddress, { implementation: implAddress, admin: deployer.address });
      }catch(e){spinner.fail(chalk.red('Gagal deploy proxy.'));console.error(e.shortMessage||e.message);return;}
      spinner=ora(chalk.blue('Menginisialisasi proxy...')).start();
      try{
        const proxyContract=new ethers.Contract(proxyAddress,artifact.abi,deployer);
        const tx=await proxyContract.initialize(deployer.address);
        await tx.wait();
        spinner.succeed(chalk.green('✅ Proxy initialized!'));
      }catch(e){spinner.fail(chalk.red('Gagal init proxy.'));console.error(e.shortMessage||e.message);return;}
      printResult('Deploy Sukses (UUPS)',[
        'Proxy Address: '+proxyAddress,
        'Implementation Address: '+implAddress,
        'Hash proxy: '+proxyTx.hash,
        'Hash impl: '+implTx.hash
      ]);
      const activeNetwork=await provider.getNetwork();
      const activeChainId=Number(activeNetwork.chainId);
      await verifyOnBoth({address:proxyAddress,sourceCode:UUPS_PROXY_TEMPLATE,contractName:'Proxy',creationTxHash:proxyTx.hash,chainId:activeChainId});
      await verifyOnBoth({address:implAddress,sourceCode:source,contractName,creationTxHash:implTx.hash,chainId:activeChainId, optimization:compileOptions.optimization, optimizationRuns:compileOptions.optimizationRuns, evmVersion:compileOptions.evmVersion});
    }else if(actionChoice==='2'){
      spinner=ora(chalk.blue('Deploy new implementation...')).start();
      let implAddress, implTx;
      try{
        const factoryImpl=new ethers.ContractFactory(artifact.abi,artifact.bytecode,deployer);
        const implContract=await factoryImpl.deploy();
        implTx=implContract.deploymentTransaction();
        await implContract.waitForDeployment();
        implAddress=await implContract.getAddress();
        spinner.succeed(chalk.green('✅ New implementation deployed!'));
        console.log(chalk.green('Implementation address:'),implAddress);
      }catch(e){spinner.fail(chalk.red('Gagal deploy implementation.'));console.error(e.shortMessage||e.message);return;}
      let proxyAddress = null;
      const chainIdNum = Number(loadConfig().chainId);
      const allProxies = loadDeployedContracts().proxy || [];
      const myProxies = allProxies.filter(p => {
        const item = typeof p === 'object' ? p : { address: p, admin: null };
        return item.admin && deployer && Number(item.chainId) === chainIdNum && item.admin.toLowerCase() === deployer.address.toLowerCase();
      });
      if (myProxies.length > 0) {
        printBox('Pilih Proxy yang Pernah Anda Deploy', myProxies.map((p, i) => {
          const addr = typeof p === 'object' ? p.address : p;
          return (i+1) + '. ' + addr;
        }), 0, 72);
        const choice = await ask(chalk.yellow('Pilih nomor proxy (0 untuk proxy lain): '));
        const idx = parseInt(choice, 10) - 1;
        if (choice !== '0' && idx >= 0 && idx < myProxies.length) {
          const selected = myProxies[idx];
          proxyAddress = typeof selected === 'object' ? selected.address : selected;
        }
      } else {
        console.log(chalk.yellow('Tidak ada proxy yang tercatat untuk wallet ini.'));
      }
      if (!proxyAddress) {
        proxyAddress = await ask(chalk.cyan('Alamat proxy manual: '));
        if (!/^0x[0-9a-fA-F]{40}$/.test(proxyAddress)) { console.log(chalk.red('Alamat proxy invalid.')); return; }
        const proxyCode = await provider.getCode(proxyAddress);
        if (proxyCode === '0x') {
          console.log(chalk.red('❌ Alamat yang dimasukkan bukan kontrak. Gunakan alamat proxy yang benar.'));
          return;
        }
      }
      spinner=ora(chalk.blue('Upgrade proxy...')).start();
      try{
        const proxyAbi=['function upgradeTo(address newImplementation)'];
        const proxyContract=new ethers.Contract(proxyAddress,proxyAbi,deployer);
        const tx=await proxyContract.upgradeTo(implAddress);
        await tx.wait();
        spinner.succeed(chalk.green('✅ Proxy upgraded!'));
        printResult('Upgrade Sukses',['Proxy: '+proxyAddress,'Implementation Baru: '+implAddress,'Hash: '+tx.hash]);
        const activeNetwork=await provider.getNetwork();
        const activeChainId=Number(activeNetwork.chainId);
        await verifyOnBoth({address:implAddress,sourceCode:source,contractName,creationTxHash:implTx.hash,chainId:activeChainId, optimization:compileOptions.optimization, optimizationRuns:compileOptions.optimizationRuns, evmVersion:compileOptions.evmVersion});
      }catch(e){spinner.fail(chalk.red('Gagal upgrade proxy.'));console.error(e.shortMessage||e.message);return;}
    }
  }else{
    spinner=ora(chalk.blue('Deploy kontrak...')).start();
    try{
      const factory=new ethers.ContractFactory(artifact.abi,artifact.bytecode,deployer);
      const contract=await factory.deploy();
      const deployTx=contract.deploymentTransaction();
      await contract.waitForDeployment();
      const address=await contract.getAddress();
      spinner.succeed(chalk.green('✅ Kontrak deployed!'));
      printResult('Deploy Sukses',['Address: '+address,'Hash: '+deployTx.hash]);
      const activeNetwork=await provider.getNetwork();
      const activeChainId=Number(activeNetwork.chainId);
      await verifyOnBoth({address,sourceCode:source,contractName,creationTxHash:deployTx.hash,chainId:activeChainId, optimization:compileOptions.optimization, optimizationRuns:compileOptions.optimizationRuns, evmVersion:compileOptions.evmVersion});
    }catch(e){spinner.fail(chalk.red('Gagal deploy.'));console.error(e.shortMessage||e.message);}
  }
}

// ================= MINING POW =================
const PK910_DEFAULT_URL = 'https://sepolia-faucet.pk910.de';
const PK910_DEFAULT_VERSION = '2.4.0';
const PK910_MAX_TARGET_WEI = parseEther('2.5');

function pk910Base64ToHex(value) { return Buffer.from(value, 'base64').toString('hex'); }
function pk910GetDifficultyMask(difficulty) {
  const byteCount = Math.floor(difficulty / 8) + 1;
  const bitCount = difficulty - ((byteCount - 1) * 8);
  let mask = (2 ** (8 - bitCount)).toString(16);
  while (mask.length < byteCount * 2) mask = '0' + mask;
  return mask;
}
function pk910GetPowParamsString(params, difficulty) {
  switch (params.a) {
    case 'scrypt': return `${params.a}|${params.n}|${params.r}|${params.p}|${params.l}|${difficulty}`;
    case 'cryptonight': return `${params.a}|${params.c}|${params.v}|${params.h}|${difficulty}`;
    case 'argon2': return `${params.a}|${params.t}|${params.v}|${params.i}|${params.m}|${params.p}|${params.l}|${difficulty}`;
    case 'nickminer': return `${params.a}|${params.i}|${params.r}|${params.v}|${params.c}|${params.s}|${params.p}|${difficulty}`;
    default: throw new Error(`Algoritma PoW tidak didukung: ${params.a}`);
  }
}
function pk910LoadCryptoNight() {
  try { return require('@leocuvee/cryptonight-hashing'); }
  catch (error) {
    try { return require('cryptonight-hashing'); }
    catch (error2) {
      throw new Error('Solver CryptoNight belum tersedia. Jalankan `npm install @leocuvee/cryptonight-hashing`. Detail: ' + error.message);
    }
  }
}
function pk910CreateHashSolver(powParams) {
  if (powParams.a !== 'cryptonight') throw new Error(`Algoritma ${powParams.a} belum didukung.`);
  if (Number(powParams.c || 0) !== 0 || Number(powParams.v || 0) !== 0 || Number(powParams.h || 0) !== 0)
    throw new Error('Varian CryptoNight bukan c=0/v=0/h=0; dihentikan demi keamanan.');
  const multiHashing = pk910LoadCryptoNight();
  if (typeof multiHashing.cryptonight !== 'function') throw new Error('Modul cryptonight-hashing tidak menyediakan fungsi cryptonight().');
  return (preimageHex, nonce) => {
    const nonceHex = nonce.toString(16).padStart(16, '0');
    const input = Buffer.from(preimageHex + nonceHex, 'hex');
    const result = multiHashing.cryptonight(input);
    const hashHex = Buffer.isBuffer(result) ? result.toString('hex') : String(result).replace(/^0x/, '');
    return '0x' + hashHex;
  };
}
function pk910IsValidPowHash(hashHex, difficulty) {
  const mask = pk910GetDifficultyMask(difficulty);
  return hashHex.slice(2, 2 + mask.length).toLowerCase() <= mask.toLowerCase();
}

class Pk910Api {
  constructor(baseUrl, clientVersion) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiUrl = `${this.baseUrl}/api`;
    this.clientVersion = clientVersion;
  }
  async request(path, options = {}) {
    const res = await fetch(`${this.apiUrl}${path}`, {
      method: options.method || 'GET',
      headers: { 'content-type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await res.text();
    let data; try { data = JSON.parse(text); } catch (_) { data = text; }
    if (!res.ok) throw new Error(`PK910 API ${res.status}: ${typeof data === 'string' ? data : JSON.stringify(data)}`);
    return data;
  }
  getConfig() { return this.request(`/getFaucetConfig?cliver=${encodeURIComponent(this.clientVersion)}`); }
  startSession(address, captchaToken) { return this.request(`/startSession?cliver=${encodeURIComponent(this.clientVersion)}`, { method: 'POST', body: { addr: address, captchaToken } }); }
  getSession(sessionId) { return this.request(`/getSession?session=${encodeURIComponent(sessionId)}`); }
  getSessionStatus(sessionId) { return this.request(`/getSessionStatus?session=${encodeURIComponent(sessionId)}`); }
  claimReward(sessionId) { return this.request('/claimReward', { method: 'POST', body: { session: sessionId } }); }
}

class Pk910PowSocket {
  constructor(url, sessionId, clientVersion) {
    this.url = `${url.replace(/\/$/, '')}?session=${encodeURIComponent(sessionId)}&cliver=${encodeURIComponent(clientVersion)}`;
    this.nextId = 1; this.pending = new Map(); this.handlers = new Map(); this.socket = null;
  }
  on(action, handler) { this.handlers.set(action, handler); }
  async connect() {
    if (typeof WebSocket !== 'function') throw new Error('Runtime Node tidak menyediakan WebSocket global. Gunakan Node.js 22+.');
    await new Promise((resolve, reject) => {
      this.socket = new WebSocket(this.url);
      const timeout = setTimeout(() => reject(new Error('Timeout koneksi PK910 WebSocket.')), 30000);
      this.socket.addEventListener('open', () => { clearTimeout(timeout); resolve(); });
      this.socket.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('PK910 WebSocket error.')); });
      this.socket.addEventListener('message', event => this._handleMessage(event.data));
      this.socket.addEventListener('close', () => { for (const p of this.pending.values()) p.reject(new Error('WebSocket ditutup.')); this.pending.clear(); });
    });
  }
  _handleMessage(raw) {
    let msg; try { msg = JSON.parse(String(raw)); } catch (_) { return; }
    if (Object.prototype.hasOwnProperty.call(msg, 'rsp')) {
      const p = this.pending.get(msg.rsp); if (!p) return; this.pending.delete(msg.rsp);
      if (msg.action === 'error') p.reject(msg.data || msg); else p.resolve(msg.data); return;
    }
    const handler = this.handlers.get(msg.action);
    if (handler) Promise.resolve(handler(msg.data)).catch(e => console.error('PK910 event error:', e.message || e));
  }
  request(action, data) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) throw new Error('PK910 WebSocket belum siap.');
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const msg = { id, action }; if (data !== undefined) msg.data = data;
      this.socket.send(JSON.stringify(msg));
    });
  }
  close() { if (this.socket) this.socket.close(); }
}

async function pk910WaitForClaimable(api, sessionId, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await api.getSessionStatus(sessionId);
    if (status.status === 'claimable' || status.status === 'failed') return status;
    await new Promise(r => setTimeout(r, 2000));
  }
  throw new Error('Timeout menunggu session claimable.');
}

async function featureMiningPow() {
  clearScreen();
  printBox('MINING POW', ['Claim ETH via PoW + auto-delegate']);
  console.log(chalk.cyan('Pilih mode:'));
  console.log(chalk.cyan('  1) Session baru (butuh CAPTCHA token)'));
  console.log(chalk.cyan('  2) Resume session (session ID)'));
  console.log(chalk.cyan('  0) Kembali'));
  const mode = await ask(chalk.yellow('Pilihan: '));
  if (mode === '0') return true;

  const faucetUrl = await ask(chalk.cyan(`Faucet URL [${PK910_DEFAULT_URL}]: `)) || PK910_DEFAULT_URL;
  const clientVersion = await ask(chalk.cyan(`Client version [${PK910_DEFAULT_VERSION}]: `)) || PK910_DEFAULT_VERSION;
  const api = new Pk910Api(faucetUrl, clientVersion);
  const config = await api.getConfig();
  const maxClaim = BigInt(config.maxClaim || PK910_MAX_TARGET_WEI.toString());

  const targetInput = `Target ETH [2.5, max ${formatEther(maxClaim)}]: `;
  const targetWei = pk910ParseTarget(await ask(targetInput) || '2.5', maxClaim);
  let address = null, sessionId = null, captchaToken = null;

  if (mode === '1') {
    address = await ask(chalk.cyan('Alamat wallet (0x...): '));
    if (!ethers.isAddress(address)) { console.log(chalk.red('Alamat invalid.')); return; }
    captchaToken = process.env.PK910_CAPTCHA_TOKEN || await ask(chalk.cyan('CAPTCHA token: '));
    if (!captchaToken) { console.log(chalk.red('CAPTCHA token wajib.')); return; }
    console.log(chalk.blue(`Memulai session untuk ${address}...`));
    const started = await api.startSession(address, captchaToken);
    if (started.status === 'failed') throw new Error(`[${started.failedCode || 'START_FAILED'}] ${started.failedReason || 'ditolak'}`);
    sessionId = started.session;
    console.log(chalk.green(`Session: ${sessionId}`));
  } else if (mode === '2') {
    sessionId = await ask(chalk.cyan('Session ID: '));
    if (!sessionId) { console.log(chalk.red('Session ID wajib.')); return; }
  } else { console.log(chalk.red('Pilihan tidak valid.')); return; }

  let session = await api.getSession(sessionId);
  if (!session || session.error) throw new Error(`Session tidak ditemukan: ${sessionId}`);
  address = address || session.target;
  if (!ethers.isAddress(address)) { console.log(chalk.red('Alamat tidak valid di session.')); return; }
  address = ethers.getAddress(address);

  let status = await api.getSessionStatus(sessionId);
  let balance = BigInt(status.balance || 0);

  if (status.status === 'claimable') {
    console.log(chalk.green(`Session claimable: ${formatEther(balance)} ETH`));
  } else if (status.status === 'failed') {
    throw new Error(`[${status.failedCode || 'SESSION_FAILED'}] ${status.failedReason || 'gagal'}`);
  } else {
    const powConfig = config.modules && config.modules.pow;
    const powState = session.modules && session.modules.pow;
    if (!powConfig || !powState) throw new Error('Session tidak memiliki modul PoW.');
    const solver = pk910CreateHashSolver(powConfig.powParams);
    const difficulty = Number(powConfig.powDifficulty);
    const params = pk910GetPowParamsString(powConfig.powParams, difficulty);
    const preimageHex = pk910Base64ToHex(powState.preImage);
    const socket = new Pk910PowSocket(`${faucetUrl.replace(/^http/, 'ws')}/ws/pow`, sessionId, clientVersion);
    let lastVerificationError = null;
    socket.on('updateBalance', data => {
      // Update balance silently - sudah ditampilkan di baris hashrate
      if (data && data.balance !== undefined) balance = BigInt(data.balance);
    });
    socket.on('verify', async verification => {
      try {
        const vPreimage = pk910Base64ToHex(verification.preimage);
        const hash = solver(vPreimage, Number(verification.nonce));
        const valid = pk910IsValidPowHash(hash, difficulty) &&
          (!verification.data || hash.toLowerCase() === String(verification.data).toLowerCase());
        await socket.request('verifyResult', { shareId: verification.shareId, params, isValid: valid });
      } catch (error) { lastVerificationError = error; }
    });
    await socket.connect();
    clearScreen();
    console.log();
    console.log('⛏️  PoW Mining');
    console.log('   Algoritma : ' + powConfig.powParams.a);
    console.log('   Difficulty: ' + difficulty);
    console.log('   Target    : ' + formatEther(targetWei) + ' ETH');
    console.log('─'.repeat(50));

    let nonce = Number(powState.lastNonce || -1) + 1;
    let hashes = 0, sharesFound = 0, lastReport = Date.now();
    const startTime = Date.now();
    let checkpointClaimed = false;
    let lastStatusCheck = Date.now();
    const CHECKPOINT_WEI = parseEther('0.05');
    while (balance < targetWei) {
      const hash = solver(preimageHex, nonce); hashes++;
      if (pk910IsValidPowHash(hash, difficulty)) {
        sharesFound++;
        await socket.request('foundShare', { nonce, data: null, params, hashrate: hashes });
        process.stdout.write('\n   🎯 Share #' + sharesFound + ': nonce ' + nonce + ' | hash ' + hash.slice(0, 14) + '…\n');
      }
      nonce++;
      if (lastVerificationError) throw lastVerificationError;
      if (Date.now() - lastReport >= 5000) {
        const elapsed = (Date.now() - startTime) / 1000;
        const hashrate = (hashes / Math.max(elapsed, 1)).toFixed(0);
        process.stdout.write('\r   ⚡ ' + hashrate + ' H/s | nonce ' + nonce + ' | ' + formatEther(balance) + ' ETH | ' + sharesFound + ' shares' + ' '.repeat(10));
        lastReport = Date.now();
      }
      if (hashes % 250 === 0) await new Promise(r => setImmediate(r));
      // Polling status dibatasi tiap 3 detik agar tidak mengganggu loop hashing
      if (Date.now() - lastStatusCheck >= 3000) {
        lastStatusCheck = Date.now();
        status = await api.getSessionStatus(sessionId);
        if (status.status === 'failed') throw new Error(`[${status.failedCode || 'SESSION_FAILED'}] ${status.failedReason || 'gagal'}`);
        if (status.balance !== undefined) balance = BigInt(status.balance);
      }

      // Checkpoint: tawarkan claim di 0.05 ETH
      if (!checkpointClaimed && balance >= CHECKPOINT_WEI) {
        checkpointClaimed = true;
        process.stdout.write('\n');
        console.log('   ⏸️  Checkpoint 0.05 ETH tercapai!');
        console.log('   1) Claim sekarang (mining berhenti)');
        console.log('   2) Skip, lanjut mining');
        const cpChoice = await ask(chalk.yellow('   Pilihan (1/2): '));
        if (cpChoice === '1') {
          console.log('   ⏳ Menunggu claimable...');
          await socket.request('closeSession');
          socket.close();
          const cpStatus = await pk910WaitForClaimable(api, sessionId);
          if (cpStatus.status === 'failed') throw new Error(`[${cpStatus.failedCode || 'CLAIM_FAILED'}] ${cpStatus.failedReason || 'claim gagal'}`);
          const cpClaim = await api.claimReward(sessionId);
          if (cpClaim.status === 'failed') throw new Error(`[${cpClaim.failedCode || 'CLAIM_FAILED'}] ${cpClaim.failedReason || 'claim gagal'}`);
          console.log();
          console.log('─'.repeat(50));
          console.log('   ✅ CLAIM BERHASIL!');
          console.log('   Saldo  : ' + formatEther(balance) + ' ETH');
          if (cpClaim.claimHash) console.log('   TX Hash: ' + cpClaim.claimHash);
          console.log('   Session: ' + sessionId);
          console.log('─'.repeat(50));
          console.log('   Mining berhenti. Session bisa di-resume nanti.');
          await ask(chalk.gray('\nTekan Enter untuk kembali ke menu...'));
          return true;
        } else {
          console.log('   ⏩ Skip, mining berlanjut...');
        }
      }
    }
    process.stdout.write('\n');
    console.log('✅ Target tercapai: ' + formatEther(balance) + ' ETH');
    console.log('─'.repeat(50));
    await socket.request('closeSession');
    socket.close();
  }

  status = await pk910WaitForClaimable(api, sessionId);
  if (status.status === 'failed') throw new Error(`[${status.failedCode || 'CLAIM_FAILED'}] ${status.failedReason || 'claim gagal'}`);
  const claim = await api.claimReward(sessionId);
  if (claim.status === 'failed') throw new Error(`[${claim.failedCode || 'CLAIM_FAILED'}] ${claim.failedReason || 'claim gagal'}`);
  console.log();
  console.log('─'.repeat(50));
  console.log('   ✅ CLAIM BERHASIL!');
  console.log('   Saldo  : ' + formatEther(balance) + ' ETH');
  if (claim.claimHash) console.log('   TX Hash: ' + claim.claimHash);
  console.log('   Session: ' + sessionId);
  console.log('─'.repeat(50));
  await ask(chalk.gray('\nTekan Enter untuk lanjut...'));

  // ===== EIP-7702 AUTO-DELEGATE =====
  console.log(chalk.cyan('\nAuto-delegate EIP-7702 setelah claim?'));
  console.log(chalk.cyan('  1) Ya, delegate ke kontrak'));
  console.log(chalk.cyan('  2) Tidak, selesai'));
  const delegateChoice = await ask(chalk.yellow('Pilihan (1/2): '));
  if (delegateChoice === '1') {
    const mode2 = await ask(chalk.cyan('Gunakan wallet tersimpan? (y/n): '));
    let pk, targetAddr;
    if (mode2.toLowerCase() === 'y') {
      const wallets = listWalletFiles();
      if (wallets.length === 0) { console.log(chalk.red('Belum ada wallet tersimpan.')); return; }
      let selected; try { selected = await promptWalletSelection(); } catch(e) { console.log(chalk.red(e.message)); return; }
      const pw = await getPassword();
      try {
        const w = await ethers.Wallet.fromEncryptedJson(fs.readFileSync(getWalletPathByIdentifier(selected), 'utf8'), pw);
        pk = w.privateKey; targetAddr = w.address;
      } catch(e) { console.log(chalk.red('Password salah.')); return; }
    } else {
      pk = await askPassword(chalk.cyan('Private key: '));
      try { targetAddr = new ethers.Wallet(pk).address; } catch(e) { console.log(chalk.red('PK invalid.')); return; }
    }
    const implAddr = await ask(chalk.cyan('Alamat impl contract (0x...): '));
    if (!ethers.isAddress(implAddr)) { console.log(chalk.red('Alamat impl invalid.')); return; }
    const rpcUrl = await ask(chalk.cyan(`RPC URL [${getActiveRpcUrl()}]: `)) || getActiveRpcUrl();
    const spinner2 = ora(chalk.blue('Delegasi EIP-7702...')).start();
    try {
      const ok = await delegateWithViem(pk, implAddr, rpcUrl, undefined, undefined, false);
      if (ok) spinner2.succeed(chalk.green(`✅ Delegasi berhasil! ${targetAddr} → ${implAddr}`));
      else spinner2.fail(chalk.red('❌ Delegasi gagal.'));
    } catch(e) { spinner2.fail(chalk.red('Error delegasi: ' + e.message)); }
  } else {
    console.log(chalk.green('Selesai. Claim dikirim ke queue.'));
  }
  return true;
}

function pk910ParseTarget(value, maxClaim) {
  const requested = parseEther(value || '2.5');
  const maxAllowed = maxClaim > 0n && maxClaim < PK910_MAX_TARGET_WEI ? maxClaim : PK910_MAX_TARGET_WEI;
  if (requested <= 0n) throw new Error('Target harus > 0.');
  if (requested > maxAllowed) throw new Error(`Target melebihi batas ${formatEther(maxAllowed)} ETH.`);
  return requested;
}

// ================= APPROVAL MANAGER =================
const POPULAR_TOKENS = [
  { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
  { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
  { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' },
  { symbol: 'WETH', address: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2' },
  { symbol: 'WBTC', address: '0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599' },
  { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA' },
  { symbol: 'UNI', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984' },
  { symbol: 'AAVE', address: '0x7Fc66500c84A76Ad7e9c93437bFc5Ac33E2DDaE9' },
  { symbol: 'SHIB', address: '0x95aD61b0a150d79219dCF64E1E6Cc01f0B64C4cE' },
  { symbol: 'MATIC', address: '0x7D1AfA7B718fb893dB30A3aBc0Cfc608AaCfeBB0' },
  { symbol: 'ARB', address: '0xB50721BCf8d664c30412Cfbc6cf7a15145234ad1' },
  { symbol: 'OP', address: '0x4200000000000000000000000000000000000042' },
  { symbol: 'PEPE', address: '0x6982508145454Ce325dDbE47a25d4ec3d2311933' },
  { symbol: 'CRV', address: '0xD533a949740bb3306d119CC777fa900bA034cd52' },
  { symbol: 'SNX', address: '0xC011a73ee8576Fb46F5E1c5751cA3B9Fe0af2a6F' },
  { symbol: 'SUSHI', address: '0x6B3595068778DD592e39A122f4f5a5cF09C90fE2' },
  { symbol: 'COMP', address: '0xc00e94Cb662C3520282E6f5717214004A7f26888' },
  { symbol: 'MKR', address: '0x9f8F72aA9304c8B593d555F12eF6589cC3A579A2' },
  { symbol: 'LDO', address: '0x5A98FcBEA516Cf06857215779Fd812CA3beF1B32' },
];
const ERC20_ABI = [
  'function allowance(address owner, address spender) view returns (uint256)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function approve(address spender, uint256 amount) returns (bool)',
];
const APPROVAL_EVENT_TOPIC = ethers.id('Approval(address,address,uint256)');
async function fetchApprovalLogs(provider, tokenAddress, ownerTopic) {
  const latest = await provider.getBlockNumber();
  // Rentang adaptif: mulai dari yang terluas, turun bertahap jika RPC membatasi getLogs
  const ranges = [1000000, 100000, 10000, 2000];
  for (const back of ranges) {
    try {
      return await provider.getLogs({ address: tokenAddress, topics: [APPROVAL_EVENT_TOPIC, ownerTopic], fromBlock: Math.max(0, latest - back), toBlock: 'latest' });
    } catch (e) { /* coba rentang lebih kecil */ }
  }
  throw new Error('getLogs gagal pada semua rentang');
}
async function scanApprovals(walletAddress, provider, extraTokens = []) {
  const results = [];
  const tokens = [...POPULAR_TOKENS, ...extraTokens];
  const ownerTopic = '0x' + walletAddress.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  for (const token of tokens) {
    try {
      const contract = new ethers.Contract(token.address, ERC20_ABI, provider);
      let symbol = token.symbol || 'TOKEN';
      try { symbol = await contract.symbol(); } catch (e) {}
      let logs;
      try { logs = await fetchApprovalLogs(provider, token.address, ownerTopic); }
      catch (e) { continue; }
      const spenders = [...new Set(logs.map(l => ethers.getAddress('0x' + l.topics[2].slice(26))))];
      for (const spender of spenders) {
        try {
          const allowance = await contract.allowance(walletAddress, spender);
          if (allowance > 0n) results.push({ symbol, address: token.address, allowance, spender });
        } catch (e) { /* skip */ }
      }
    } catch (e) { /* skip error */ }
  }
  return results;
}

// ===== Scan approval MENYELURUH via Etherscan API (semua token, bukan cuma populer) =====
const ETHERSCAN_V2 = 'https://api.etherscan.io/v2/api';
async function fetchApprovalPairsEtherscan(walletAddress, apiKey, chainId) {
  const ownerTopic = '0x' + walletAddress.toLowerCase().replace(/^0x/, '').padStart(64, '0');
  const pairs = new Map(); // key: token-spender lowercase
  for (let page = 1; ; page++) {
    const url = `${ETHERSCAN_V2}?chainid=${chainId}&module=logs&action=getLogs&fromBlock=0&toBlock=latest` +
      `&topic0=${APPROVAL_EVENT_TOPIC}&topic1=${ownerTopic}&page=${page}&offset=1000&apikey=${apiKey}`;
    const res = await fetch(url);
    const json = await res.json();
    if (json.status !== '1' || !Array.isArray(json.result)) {
      if (json.message === 'No transactions found') break;
      throw new Error('Etherscan: ' + (json.result && json.result.message ? json.result.message : json.message || 'unknown error'));
    }
    for (const log of json.result) {
      if (!log.address || !log.topics || log.topics.length < 3) continue;
      const token = ethers.getAddress(log.address);
      const spender = ethers.getAddress('0x' + log.topics[2].slice(26));
      pairs.set(token.toLowerCase() + '-' + spender.toLowerCase(), { token, spender });
    }
    if (json.result.length < 1000) break;
  }
  return [...pairs.values()];
}
async function scanApprovalsFull(walletAddress, provider, apiKey, chainId) {
  const pairs = await fetchApprovalPairsEtherscan(walletAddress, apiKey, chainId);
  const results = [];
  const symbolCache = new Map();
  for (const { token, spender } of pairs) {
    try {
      let symbol = symbolCache.get(token);
      if (symbol === undefined) {
        try { symbol = await new ethers.Contract(token, ['function symbol() view returns (string)'], provider).symbol(); }
        catch (e) { symbol = 'TOKEN'; }
        symbolCache.set(token, symbol);
      }
      const allowance = await new ethers.Contract(token, ['function allowance(address,address) view returns (uint256)'], provider).allowance(walletAddress, spender);
      if (allowance > 0n) results.push({ symbol, address: token, allowance, spender });
    } catch (e) { /* skip */ }
  }
  return results;
}
async function featureApprovalManager() {
  clearScreen();
  await showNetworkStatus();
  printBox('APPROVAL MANAGER', ['Cek & revoke semua ERC-20 approval aktif']);
  let walletId;
  try { walletId = await promptWalletSelection(); } catch (e) { printResult('Approval Manager', [e.message]); return; }
  const password = await getPassword();
  let wallet, provider;
  try {
    provider = getProvider();
    wallet = await ethers.Wallet.fromEncryptedJson(fs.readFileSync(getWalletPathByIdentifier(walletId), 'utf8'), password);
  } catch (e) { console.log(chalk.red('Password salah atau file wallet rusak.')); return; }
  console.log(chalk.cyan(`
Pilih mode scan:`));
  console.log(chalk.cyan('  1) Token populer (19 token bawaan)'));
  console.log(chalk.cyan('  2) Menyeluruh — semua token via Etherscan API (butuh API key gratis)'));
  const scanMode = await ask(chalk.yellow('Pilihan (1/2): '));
  let approvals;
  if (scanMode === '2') {
    let apiKey = process.env.ETHERSCAN_API_KEY || loadConfig().etherscanApiKey || '';
    if (!apiKey) {
      console.log(chalk.gray('  API key gratis: daftar di https://etherscan.io → MyAPIKey'));
      apiKey = await ask(chalk.cyan('  Etherscan API key: '));
      if (!apiKey) { console.log(chalk.red('  ❌ Tanpa API key, mode menyeluruh tidak tersedia.')); return true; }
      const cfg = loadConfig(); cfg.etherscanApiKey = apiKey.trim(); saveConfig(cfg);
      console.log(chalk.green('  ✅ API key tersimpan di config.'));
    }
    const chainIdNum = Number(loadConfig().chainId);
    const spinner = ora(chalk.blue('Mengambil riwayat approval dari Etherscan...')).start();
    try {
      approvals = await scanApprovalsFull(wallet.address, provider, apiKey.trim(), chainIdNum);
      spinner.succeed(chalk.green(`Scan menyeluruh selesai (${approvals.length} approval aktif).`));
    } catch (e) {
      spinner.fail(chalk.red('Scan menyeluruh gagal: ' + (e.shortMessage || e.message)));
      console.log(chalk.yellow('  💡 Cek API key / kuota, atau lanjut mode populer.'));
      await ask(chalk.gray('\nTekan Enter untuk kembali...'));
      return true;
    }
  } else {
    const extraTokens = [];
    while (true) {
      const custom = await ask(chalk.cyan('Tambah alamat token kustom untuk di-scan (kosongkan = lanjut): '));
      if (!custom) break;
      if (!/^0x[0-9a-fA-F]{40}$/.test(custom)) { console.log(chalk.red('  Alamat token invalid.')); continue; }
      extraTokens.push({ symbol: null, address: ethers.getAddress(custom) });
    }
    const spinner = ora(chalk.blue('Membaca approval...')).start();
    approvals = await scanApprovals(wallet.address, provider, extraTokens);
    spinner.stop();
  }
  if (approvals.length === 0) {
    console.log(); console.log(chalk.green('  ✅ Tidak ada approval aktif ditemukan!'));
    await ask(chalk.gray('\nTekan Enter untuk kembali...'));
    return true;
  }
  console.log(chalk.yellow(`
  Ditemukan ${approvals.length} approval aktif:
`));
  const selected = [];
  for (let i = 0; i < approvals.length; i++) {
    const a = approvals[i];
    const allowanceStr = ethers.formatEther(a.allowance);
    const answer = await ask(chalk.cyan(`  ${i + 1}. ${a.symbol} → spender ${a.spender.slice(0, 10)}... (${allowanceStr}) → Revoke? (y/n): `));
    if (answer.toLowerCase() === 'y') selected.push(i);
  }
  if (selected.length === 0) {
    console.log(); console.log(chalk.gray('  Tidak ada yang dipilih.'));
    await ask(chalk.gray('\nTekan Enter untuk kembali...'));
    return true;
  }
  console.log(chalk.cyan(`
  ${selected.length} approval akan di-revoke.`));
  console.log(chalk.cyan('  Pilih mode pembayaran gas:'));
  console.log(chalk.cyan('    1) Self — bayar gas sendiri'));
  console.log(chalk.cyan('    2) Sponsor — sponsor bayar gas'));
  const gasMode = await ask(chalk.yellow('  Pilihan (1/2): '));
  let sponsorAddress = null;
  if (gasMode === '2') {
    sponsorAddress = await ask(chalk.cyan('  Alamat sponsor (0x...): '));
    if (!ethers.isAddress(sponsorAddress)) { console.log(chalk.red('  Alamat sponsor invalid.')); return; }
  }
  const confirmed = await confirmMainnetTx('Revoke Approval', [
    `Wallet : ${wallet.address}`,
    `Jumlah : ${selected.length} approval`,
    `Mode   : ${gasMode === '2' ? 'Sponsor (EIP-7702 atomic)' : 'Self'}`,
  ]);
  if (!confirmed) return true;
  if (gasMode === '2') {
    const sponsorPk = await askPassword(chalk.cyan('  Private key sponsor: '));
    if (!sponsorPk) { console.log(chalk.red('  ❌ Private key sponsor wajib.')); return true; }
    let sponsorAccount;
    try { sponsorAccount = privateKeyToAccount(sponsorPk.trim()); }
    catch (e) { console.log(chalk.red('  ❌ Private key sponsor invalid.')); return true; }
    const rpcUrl = getActiveRpcUrl();
    const ethProvider = new ethers.JsonRpcProvider(rpcUrl);
    const spinner = ora(chalk.blue('  Menyiapkan revoke via EIP-7702...')).start();
    try {
      let revokerArtifact;
      try { revokerArtifact = compileContract(REVOKE_APPROVAL_SOURCE, 'approvalRevoker'); }
      catch (e) { throw new Error('Compile approvalRevoker gagal: ' + e.message); }
      const arr = loadDeployedContracts().revoker || [];
      let implAddress = null;
      const chainIdNum = Number(loadConfig().chainId);
      for (let i = arr.length - 1; i >= 0; i--) {
        const it = arr[i];
        if (typeof it === 'object' && Number(it.chainId) === chainIdNum && it.rescuer && it.rescuer.toLowerCase() === sponsorAccount.address.toLowerCase()) { implAddress = it.address; break; }
      }
      if (implAddress) {
        console.log(chalk.green(`\n  ℹ️  Kontrak approvalRevoker existing: ${implAddress}`));
      } else {
        const deployer = new ethers.Wallet(sponsorPk.trim(), ethProvider);
        const factory = new ethers.ContractFactory(revokerArtifact.abi, revokerArtifact.bytecode, deployer);
        const contract = await factory.deploy(sponsorAccount.address);
        await contract.waitForDeployment();
        implAddress = await contract.getAddress();
        saveDeployedContract('revoker', implAddress, { rescuer: sponsorAccount.address });
        console.log(chalk.green(`\n  ✅ approvalRevoker deployed: ${implAddress} (TX: ${contract.deploymentTransaction().hash})`));
      }
      const tokens = selected.map(idx => approvals[idx].address);
      const spenders = selected.map(idx => approvals[idx].spender);
      const iface = new ethers.Interface(revokerArtifact.abi);
      const callData = iface.encodeFunctionData('revoke', [tokens, spenders]);
      spinner.text = chalk.blue('  Mengirim revoke atomik (sponsor bayar gas)...');
      const success = await sendAtomicRescue(wallet.privateKey, implAddress, rpcUrl, undefined, sponsorPk.trim(), callData);
      if (success) {
        console.log(chalk.green(`  ✅ Selesai: ${selected.length}/${selected.length} approval revoked`));
      } else {
        console.log(chalk.red('  ❌ Revoke atomik gagal.'));
      }
    } catch (e) {
      console.log(chalk.red(`  ❌ Gagal: ${e.shortMessage || e.message}`));
    }
    await ask(chalk.gray('\nTekan Enter untuk kembali...'));
    return true;
  }
  let successCount = 0;
  const signer = wallet.connect(provider);
  for (const idx of selected) {
    const a = approvals[idx];
    console.log(chalk.blue(`
  Revoke ${a.symbol}...`));
    try {
      const contract = new ethers.Contract(a.address, ERC20_ABI, signer);
      const tx = await contract.approve(a.spender, 0n);
      console.log(chalk.gray(`    TX: ${tx.hash}`));
      await tx.wait();
      console.log(chalk.green(`    ✅ ${a.symbol} revoked!`));
      successCount++;
    } catch (e) {
      console.log(chalk.red(`    ❌ ${a.symbol} gagal: ${e.shortMessage || e.message}`));
    }
  }
  console.log(); console.log(chalk.bold.cyan('  ════════════════════════════════════════'));
  console.log(chalk.green(`  ✅ Selesai: ${successCount}/${selected.length} approval revoked`));
  console.log(chalk.bold.cyan('  ════════════════════════════════════════'));
  await ask(chalk.gray('\nTekan Enter untuk kembali...'));
  return true;
}

// ================= GAS FEE =================
async function actionGasFee(){
  clearScreen();
  printBox('GAS FEE', ['Cek & ubah pengaturan gas fee']);
  console.log(chalk.cyan('Pilih aksi:'));
  console.log(chalk.cyan('  1) Cek Gas Fee'));
  console.log(chalk.cyan('  2) Ubah Gas Fee'));
  console.log(chalk.cyan('  0) Kembali'));
  const choice = await ask(chalk.yellow('Pilihan: '));
  if (choice === '1') await checkGasFee();
  else if (choice === '2') await changeGasFee();
  else if (choice === '0') {
    return true;
  } else {
    console.log(chalk.red('Pilihan tidak valid.'));
    return false;
  }
}

async function checkGasFee(){
  const spinner = ora(chalk.blue('Mengambil data gas...')).start();
  try {
    const provider = getProvider();
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice ?? feeData.maxFeePerGas ?? ethers.parseUnits('30','gwei');
    const priority = feeData.maxPriorityFeePerGas ?? feeData.gasPrice ?? ethers.parseUnits('1','gwei');
    const ethPrice = await getEthPriceUsd();
    spinner.succeed(chalk.green('Data gas berhasil diambil.'));

    const gasPriceGwei = Number(ethers.formatUnits(gasPrice,'gwei')).toFixed(2);
    const priorityGwei = Number(ethers.formatUnits(priority,'gwei')).toFixed(2);
    const usdPerEth = ethPrice || 0;

    const txTypes = [
      { name:'Transfer ETH', gas: 21000n },
      { name:'EIP-7702', gas: 300000n },
      { name:'Deploy Kontrak', gas: 500000n }
    ];
    const lines = [];
    for (const t of txTypes) {
      const costWei = t.gas * gasPrice;
      const costEth = Number(ethers.formatEther(costWei));
      const costUsd = ethPrice ? (costEth * ethPrice).toFixed(4) : 'N/A';
      lines.push(t.name + ': ' + costEth.toFixed(8) + ' ETH ($' + costUsd + ')');
    }

    printBox('ESTIMASI GAS FEE', [
      'Gas Price: ' + gasPriceGwei + ' Gwei',
      'Priority Fee: ' + priorityGwei + ' Gwei',
      'Harga ETH: $' + usdPerEth.toFixed(2),
      ...lines
    ], 0, 80);
  } catch(e) {
    spinner.fail(chalk.red('Gagal mengambil data gas.'));
    console.error(e.message);
  }
}

async function changeGasFee(){
  const config = loadConfig();
  console.log(chalk.cyan('Pilih kecepatan default gas fee:'));
  console.log(chalk.cyan('  1) Slow'));
  console.log(chalk.cyan('  2) Normal'));
  console.log(chalk.cyan('  3) Fast'));
  console.log(chalk.cyan('  4) Auto'));
  console.log(chalk.cyan('  5) Manual Gwei'));
  const choice = await ask(chalk.yellow('Pilihan: '));

  if (choice === '1') config.gasSettings = { speed: 'slow' };
  else if (choice === '2') config.gasSettings = { speed: 'normal' };
  else if (choice === '3') config.gasSettings = { speed: 'fast' };
  else if (choice === '4') config.gasSettings = { speed: 'auto' };
  else if (choice === '5') {
    const gweiInput = await ask(chalk.cyan('Gas fee manual (Gwei, contoh: 30): '));
    const gwei = gweiInput ? parseFloat(gweiInput) : 30;
    if (!Number.isFinite(gwei) || gwei <= 0) {
      console.log(chalk.red('Gas fee harus berupa angka positif.'));
      return;
    }
    config.gasSettings = {
      manual: {
        maxFeePerGas: ethers.parseUnits(gwei.toFixed(9), 'gwei').toString(),
        maxPriorityFeePerGas: ethers.parseUnits(gwei.toFixed(9), 'gwei').toString()
      }
    };
  } else {
    console.log(chalk.red('Pilihan tidak valid.'));
    return;
  }
  saveConfig(config);
  console.log(chalk.green('✅ Pengaturan gas fee disimpan.'));
}

// ================= RUN FEATURE & MENU =================
async function runFeature(fn){
  while(true){
    let result;
    try{ result = await fn(); }catch(e){ console.error(chalk.red('Error:'), e.message||e.shortMessage||e); }
    if (result === true) return;
    const again=await ask(chalk.yellow('\n0 untuk kembali ke menu, Enter untuk mengulangi fitur: '));
    if(again==='0') return;
  }
}

let firstMenuLoad=true;
async function showMainMenu(){
  clearScreen(); console.log('\n\n');
  if(firstMenuLoad){ await animateBox('EIP-7702 TOOL',['','','BY NEMO'],3000,72); firstMenuLoad=false; }
  printBox('WALLET & EIP-7702 TOOL',[
    '1. Batch Call (Deploy + Execute)',
    '2. Create Wallet',
    '3. Change Wallet',
    '4. Delete Wallet',
    '5. Export Private Key',
    '6. Import Wallet',
    '7. List Wallets',
    '8. Rescue Assets (ETH/ERC20/ERC721)',
    '9. Revoke Delegation',
    '10. Send ETH',
    '11. Send Token',
    '12. Info Wallet',
    '13. Network',
    '14. Claim Airdrop (Delegation)',
    '15. Wizard Deploy',
    '16. Gas Fee',
    '17. Mining POW',
    '18. Approval Manager',
    '0. Exit'
  ],0,72);
  const choice=await ask(chalk.yellow('\nPilihan (0-18): '));
  switch(choice){
    case '1': await runFeature(featureBatchCall); break;
    case '2': await runFeature(actionCreateWallet); break;
    case '3': await runFeature(actionChangeWallet); break;
    case '4': await runFeature(actionDeleteWallet); break;
    case '5': await runFeature(actionExportPrivateKey); break;
    case '6': await runFeature(actionImportWallet); break;
    case '7': await runFeature(actionListWallets); break;
    case '8': await runFeature(featureRescue); break;
    case '9': await runFeature(featureRevoke); break;
    case '10': await runFeature(actionSendEth); break;
    case '11': await runFeature(actionSendToken); break;
    case '12': await runFeature(actionInfoWallet); break;
    case '13': await runFeature(actionNetwork); break;
    case '14': await runFeature(featureClaimAirdrop); break;
    case '15': await runFeature(featureWizardDeploy); break;
    case '16': await runFeature(actionGasFee); break;
    case '17': await runFeature(featureMiningPow); break;
    case '18': await runFeature(featureApprovalManager); break;
    case '0':
      clearScreen();
      await animateBox('TERIMA KASIH',[
        'Terima kasih sudah menggunakan Tools EIP-7702',
        '',
        'Peringatan: Jangan bagikan private key.',
        'Transaksi blockchain bersifat final.',
        '',
        'Selalu buat wallet baru untuk testing.',
        'Jangan pernah menggunakan wallet utama Anda.'
      ],7000,62);
      process.exit(0); break;
    default:
      console.log(chalk.red('❌ Pilihan tidak valid. Silakan masukkan 0-18.'));
      await ask(chalk.gray('Tekan Enter untuk melanjutkan...'));
  }
  await showMainMenu();
}
if (require.main === module) {
  showMainMenu().catch(err=>{ console.error(chalk.red('Error:'), err.message); process.exit(1); });
}

module.exports = {
  APP_DIR, WALLET_DIR, NETWORK_DIR, CONFIG_FILE, DEFAULT_CONFIG,
  loadConfig, saveConfig, getProvider, getActiveRpcUrl, getViemChain,
  listWalletFiles, getWalletPathByIdentifier,
  rlpEncode, rlpEncodeBytes, rlpEncodeInteger, rlpEncodeList,
  RESCUE_SOURCE, BATCH_SOURCE, AIRDROP_CLAIMER_SOURCE, UUPS_PROXY_TEMPLATE, REVOKE_APPROVAL_SOURCE,
  WIZARD_ERC20_TEMPLATE, WIZARD_ERC721_TEMPLATE, WIZARD_ERC1155_TEMPLATE,
  compileContract, delegateWithViem, getDelegatedContract, sendAtomicRescue,
  verifyOnSourcify, verifyOnBlockscout, verifyOnBoth,
  loadDeployedContracts, saveDeployedContract,
  findRescueContract, findAirdropContract,
  getEthPriceUsd, getGasSettings, scanApprovals, scanApprovalsFull,
  printBox, printResult,
  Pk910Api, Pk910PowSocket, pk910GetDifficultyMask, pk910IsValidPowHash,
  pk910ParseTarget, pk910CreateHashSolver, pk910GetPowParamsString,
  featureMiningPow
};
