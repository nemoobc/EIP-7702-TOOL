#!/usr/bin/env node
'use strict';

const { ethers } = require('ethers');

const DEFAULT_FAUCET_URL = 'https://sepolia-faucet.pk910.de';
const DEFAULT_CLIENT_VERSION = '2.4.0';
const DEFAULT_TARGET_ETH = '2.5';
const MAX_TARGET_WEI = ethers.parseEther('2.5');

function usage() {
  console.log(`PK910 Sepolia PoW Faucet CLI

This client does not solve or bypass CAPTCHA. Provide a valid captcha token
obtained through PK910's normal flow, then it runs PoW and submits the claim.

Start a session:
  PK910_CAPTCHA_TOKEN=... npm run faucet:pk910 -- \\
    --address 0x... --target 2.5

Resume an existing session:
  npm run faucet:pk910 -- --session SESSION_ID --target 2.5

Options:
  --address ADDRESS       Target wallet address for a new session
  --captcha-token TOKEN   Valid PK910 captcha token (prefer env variable)
  --session ID             Resume an existing PK910 session
  --target ETH             Stop at this amount; maximum is 2.5 ETH
  --faucet-url URL         Override faucet base URL
  --client-version VER    Override PK910 client version
  --help                   Show this help
`);
}

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') {
      usage();
      process.exit(0);
    }
    if (!arg.startsWith('--')) throw new Error(`Argumen tidak dikenal: ${arg}`);
    const key = arg.slice(2);
    const value = argv[++i];
    if (!value || value.startsWith('--')) throw new Error(`Nilai untuk --${key} wajib diisi.`);
    args[key.replace(/-([a-z])/g, (_, c) => c.toUpperCase())] = value;
  }
  return args;
}

function requireAddress(address) {
  if (!ethers.isAddress(address)) throw new Error(`Alamat wallet tidak valid: ${address}`);
  return ethers.getAddress(address);
}

function parseTarget(value, maxClaim) {
  const requested = ethers.parseEther(value || DEFAULT_TARGET_ETH);
  const maxAllowed = maxClaim > 0n && maxClaim < MAX_TARGET_WEI ? maxClaim : MAX_TARGET_WEI;
  if (requested <= 0n) throw new Error('Target harus lebih besar dari 0.');
  if (requested > maxAllowed) {
    throw new Error(`Target melebihi batas faucet (${ethers.formatEther(maxAllowed)} ETH).`);
  }
  return requested;
}

function base64ToHex(value) {
  return Buffer.from(value, 'base64').toString('hex');
}

function getDifficultyMask(difficulty) {
  const byteCount = Math.floor(difficulty / 8) + 1;
  const bitCount = difficulty - ((byteCount - 1) * 8);
  let mask = (2 ** (8 - bitCount)).toString(16);
  while (mask.length < byteCount * 2) mask = '0' + mask;
  return mask;
}

function getPowParamsString(params, difficulty) {
  switch (params.a) {
    case 'scrypt': return `${params.a}|${params.n}|${params.r}|${params.p}|${params.l}|${difficulty}`;
    case 'cryptonight': return `${params.a}|${params.c}|${params.v}|${params.h}|${difficulty}`;
    case 'argon2': return `${params.a}|${params.t}|${params.v}|${params.i}|${params.m}|${params.p}|${params.l}|${difficulty}`;
    case 'nickminer': return `${params.a}|${params.i}|${params.r}|${params.v}|${params.c}|${params.s}|${params.p}|${difficulty}`;
    default: throw new Error(`Algoritma PoW tidak didukung: ${params.a}`);
  }
}

function loadCryptoNight() {
  try {
    // Optional native dependency. It is intentionally loaded only when PK910
    // reports CryptoNight, so the main wallet CLI remains usable without it.
    return require('cryptonight-hashing');
  } catch (error) {
    throw new Error(
      'Solver CryptoNight belum tersedia. Jalankan `npm install --include=optional` ' +
      'dengan Node/toolchain yang kompatibel (build native lama dapat gagal di Node 24). ' +
      'Detail: ' + error.message
    );
  }
}

function createHashSolver(powParams) {
  if (powParams.a !== 'cryptonight') {
    throw new Error(`PK910 saat ini meminta algoritma ${powParams.a}; CLI ini baru mendukung cryptonight.`);
  }
  if (Number(powParams.c || 0) !== 0 || Number(powParams.v || 0) !== 0 || Number(powParams.h || 0) !== 0) {
    throw new Error('Varian CryptoNight PK910 saat ini bukan c=0/v=0/h=0; solver dihentikan demi keamanan hasil.');
  }
  const multiHashing = loadCryptoNight();
  if (typeof multiHashing.cryptonight !== 'function') {
    throw new Error('Modul cryptonight-hashing tidak menyediakan fungsi cryptonight().');
  }
  return (preimageHex, nonce) => {
    const nonceHex = nonce.toString(16).padStart(16, '0');
    const input = Buffer.from(preimageHex + nonceHex, 'hex');
    const result = multiHashing.cryptonight(input);
    const hashHex = Buffer.isBuffer(result) ? result.toString('hex') : String(result).replace(/^0x/, '');
    return '0x' + hashHex;
  };
}

function isValidPowHash(hashHex, difficulty) {
  const mask = getDifficultyMask(difficulty);
  return hashHex.slice(2, 2 + mask.length).toLowerCase() <= mask.toLowerCase();
}

function errorText(error) {
  if (!error) return 'unknown error';
  if (typeof error === 'string') return error;
  if (error.message) return error.message;
  try { return JSON.stringify(error); } catch (_) { return String(error); }
}

class FaucetApi {
  constructor(baseUrl, clientVersion) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiUrl = `${this.baseUrl}/api`;
    this.clientVersion = clientVersion;
  }

  async request(path, options = {}) {
    const response = await fetch(`${this.apiUrl}${path}`, {
      method: options.method || 'GET',
      headers: { 'content-type': 'application/json' },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch (_) { data = text; }
    if (!response.ok) throw new Error(`PK910 API ${response.status}: ${errorText(data)}`);
    return data;
  }

  getConfig() {
    return this.request(`/getFaucetConfig?cliver=${encodeURIComponent(this.clientVersion)}`);
  }

  startSession(address, captchaToken) {
    return this.request(`/startSession?cliver=${encodeURIComponent(this.clientVersion)}`, {
      method: 'POST',
      body: { addr: address, captchaToken },
    });
  }

  getSession(sessionId) {
    return this.request(`/getSession?session=${encodeURIComponent(sessionId)}`);
  }

  getSessionStatus(sessionId) {
    return this.request(`/getSessionStatus?session=${encodeURIComponent(sessionId)}`);
  }

  claimReward(sessionId) {
    return this.request('/claimReward', { method: 'POST', body: { session: sessionId } });
  }
}

class PowSocket {
  constructor(url, sessionId, clientVersion) {
    this.url = `${url.replace(/\/$/, '')}?session=${encodeURIComponent(sessionId)}&cliver=${encodeURIComponent(clientVersion)}`;
    this.nextId = 1;
    this.pending = new Map();
    this.handlers = new Map();
    this.socket = null;
  }

  on(action, handler) {
    this.handlers.set(action, handler);
  }

  async connect() {
    if (typeof WebSocket !== 'function') throw new Error('Runtime Node tidak menyediakan WebSocket global. Gunakan Node.js 22+.');
    await new Promise((resolve, reject) => {
      this.socket = new WebSocket(this.url);
      const timeout = setTimeout(() => reject(new Error('Timeout koneksi PK910 WebSocket.')), 30000);
      this.socket.addEventListener('open', () => { clearTimeout(timeout); resolve(); });
      this.socket.addEventListener('error', () => { clearTimeout(timeout); reject(new Error('PK910 WebSocket error.')); });
      this.socket.addEventListener('message', event => this.handleMessage(event.data));
      this.socket.addEventListener('close', () => {
        for (const pending of this.pending.values()) pending.reject(new Error('PK910 WebSocket ditutup.'));
        this.pending.clear();
      });
    });
  }

  handleMessage(raw) {
    let message;
    try { message = JSON.parse(String(raw)); } catch (_) { return; }
    if (Object.prototype.hasOwnProperty.call(message, 'rsp')) {
      const pending = this.pending.get(message.rsp);
      if (!pending) return;
      this.pending.delete(message.rsp);
      if (message.action === 'error') pending.reject(message.data || message);
      else pending.resolve(message.data);
      return;
    }
    const handler = this.handlers.get(message.action);
    if (handler) Promise.resolve(handler(message.data)).catch(error => console.error('PK910 event error:', errorText(error)));
  }

  request(action, data) {
    if (!this.socket || this.socket.readyState !== WebSocket.OPEN) throw new Error('PK910 WebSocket belum siap.');
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      const message = { id, action };
      if (data !== undefined) message.data = data;
      this.socket.send(JSON.stringify(message));
    });
  }

  close() {
    if (this.socket) this.socket.close();
  }
}

async function waitForClaimable(api, sessionId, timeoutMs = 180000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await api.getSessionStatus(sessionId);
    if (status.status === 'claimable' || status.status === 'failed') return status;
    await new Promise(resolve => setTimeout(resolve, 2000));
  }
  throw new Error('Timeout menunggu session menjadi claimable.');
}

async function run() {
  const args = parseArgs(process.argv.slice(2));
  const faucetUrl = args.faucetUrl || process.env.PK910_FAUCET_URL || DEFAULT_FAUCET_URL;
  const clientVersion = args.clientVersion || process.env.PK910_CLIENT_VERSION || DEFAULT_CLIENT_VERSION;
  const api = new FaucetApi(faucetUrl, clientVersion);
  const config = await api.getConfig();
  const maxClaim = BigInt(config.maxClaim || MAX_TARGET_WEI.toString());
  const target = parseTarget(args.target || DEFAULT_TARGET_ETH, maxClaim);
  let address = args.address ? requireAddress(args.address) : null;
  let sessionId = args.session || process.env.PK910_SESSION_ID;
  let captchaToken = args.captchaToken || process.env.PK910_CAPTCHA_TOKEN;

  if (!sessionId) {
    if (!address) throw new Error('--address wajib diisi saat membuat session baru.');
    if (!captchaToken) {
      throw new Error('PK910 mewajibkan CAPTCHA. Isi PK910_CAPTCHA_TOKEN atau --captcha-token dari flow CAPTCHA yang sah.');
    }
    console.log(`Memulai PK910 session untuk ${address}...`);
    const started = await api.startSession(address, captchaToken);
    if (started.status === 'failed') throw new Error(`[${started.failedCode || 'START_FAILED'}] ${started.failedReason || 'session ditolak'}`);
    sessionId = started.session;
    console.log(`Session: ${sessionId}`);
  }

  let session = await api.getSession(sessionId);
  if (!session || session.error) throw new Error(`Session PK910 tidak ditemukan: ${sessionId}`);
  address = requireAddress(address || session.target);
  if (session.target && requireAddress(session.target).toLowerCase() !== address.toLowerCase()) {
    throw new Error('Alamat target berbeda dari alamat di session PK910.');
  }

  let status = await api.getSessionStatus(sessionId);
  if (status.status === 'claimable') {
    console.log(`Session sudah claimable: ${ethers.formatEther(BigInt(status.balance || 0))} ETH`);
  } else if (status.status === 'failed') {
    throw new Error(`[${status.failedCode || 'SESSION_FAILED'}] ${status.failedReason || 'session gagal'}`);
  } else {
    const powConfig = config.modules && config.modules.pow;
    const powState = session.modules && session.modules.pow;
    if (!powConfig || !powState) throw new Error('Session tidak memiliki modul PoW.');
    const solver = createHashSolver(powConfig.powParams);
    const difficulty = Number(powConfig.powDifficulty);
    const params = getPowParamsString(powConfig.powParams, difficulty);
    const preimageHex = base64ToHex(powState.preImage);
    const mask = getDifficultyMask(difficulty);
    const socket = new PowSocket(`${faucetUrl.replace(/^http/, 'ws')}/ws/pow`, sessionId, clientVersion);
    let balance = BigInt(status.balance || session.balance || 0);
    let lastVerificationError = null;
    socket.on('updateBalance', data => {
      if (data && data.balance !== undefined) balance = BigInt(data.balance);
      console.log(`Saldo PoW: ${ethers.formatEther(balance)} ETH`);
    });
    socket.on('verify', async verification => {
      try {
        const verificationPreimage = base64ToHex(verification.preimage);
        const hash = solver(verificationPreimage, Number(verification.nonce));
        const valid = isValidPowHash(hash, difficulty) &&
          (!verification.data || hash.toLowerCase() === String(verification.data).toLowerCase());
        await socket.request('verifyResult', { shareId: verification.shareId, params, isValid: valid });
      } catch (error) {
        lastVerificationError = error;
      }
    });
    await socket.connect();
    console.log(`PoW aktif: ${powConfig.powParams.a}, difficulty ${difficulty}, target ${ethers.formatEther(target)} ETH`);
    console.log('Tekan Ctrl+C untuk berhenti; session dapat dilanjutkan dengan --session.');

    let nonce = Number(powState.lastNonce || -1) + 1;
    let hashes = 0;
    let lastReport = Date.now();
    const startTime = Date.now();
    while (balance < target) {
      const hash = solver(preimageHex, nonce);
      hashes++;
      if (isValidPowHash(hash, difficulty)) {
        await socket.request('foundShare', { nonce, data: null, params, hashrate: hashes });
        console.log(`Share diterima pada nonce ${nonce}; hash ${hash.slice(0, 18)}…`);
      }
      nonce++;
      if (lastVerificationError) throw lastVerificationError;
      if (Date.now() - lastReport >= 10000) {
        const elapsed = (Date.now() - startTime) / 1000;
        console.log(`Hashrate: ${(hashes / Math.max(elapsed, 1)).toFixed(0)} H/s | nonce: ${nonce} | saldo: ${ethers.formatEther(balance)} ETH`);
        lastReport = Date.now();
      }
      if (hashes % 250 === 0) await new Promise(resolve => setImmediate(resolve));
      status = await api.getSessionStatus(sessionId);
      if (status.status === 'failed') throw new Error(`[${status.failedCode || 'SESSION_FAILED'}] ${status.failedReason || 'session gagal'}`);
      if (status.balance !== undefined) balance = BigInt(status.balance);
    }
    await socket.request('closeSession');
    socket.close();
    console.log(`Target tercapai: ${ethers.formatEther(balance)} ETH. Menunggu claim queue...`);
  }

  status = await waitForClaimable(api, sessionId);
  if (status.status === 'failed') throw new Error(`[${status.failedCode || 'CLAIM_FAILED'}] ${status.failedReason || 'claim gagal'}`);
  const claim = await api.claimReward(sessionId);
  if (claim.status === 'failed') throw new Error(`[${claim.failedCode || 'CLAIM_FAILED'}] ${claim.failedReason || 'claim gagal'}`);
  console.log('Claim berhasil dikirim ke queue PK910.');
  if (claim.claimHash) console.log(`TX: ${claim.claimHash}`);
  else console.log(`Session: ${sessionId}`);
}

let stopping = false;
process.on('SIGINT', () => {
  if (stopping) process.exit(130);
  stopping = true;
  console.log('\nDihentikan. Session PK910 tetap dapat dilanjutkan dengan --session.');
  process.exit(130);
});

run().catch(error => {
  console.error(`PK910 faucet gagal: ${errorText(error)}`);
  process.exitCode = 1;
});
