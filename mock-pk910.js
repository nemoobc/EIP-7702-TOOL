'use strict';
// MOCK PK910 FAUCET — meniru API sepolia-faucet.pk910.de untuk testing offline.
// 100% lokal: tidak ada request ke server asli. CAPTCHA apa saja diterima.
const http = require('http');
const crypto = require('crypto');

const PORT = Number(process.env.MOCK_PORT || 9911);
const state = {
  session: 'mock-session-001',
  preImage: crypto.randomBytes(38).toString('base64'),
  balance: 0n,
  claimable: false,
};

function json(res, obj) { res.writeHead(200, { 'content-type': 'application/json' }); res.end(JSON.stringify(obj)); }
function readBody(req) { return new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => r(b)); }); }

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;
  if (p === '/api/getFaucetConfig') {
    return json(res, { maxClaim: '2500000000000000000', modules: { pow: { powParams: { a: 'cryptonight', c: 0, v: 0, h: 0 }, powDifficulty: 4 } } });
  }
  if (p === '/api/startSession') {
    const body = JSON.parse((await readBody(req)) || '{}');
    if (!body.captchaToken) return json(res, { status: 'failed', failedCode: 'INVALID_CAPTCHA', failedReason: 'captcha kosong' });
    state.balance = 0n; state.claimable = false;
    console.log('[mock] startSession addr=' + body.addr + ' captcha=diterima');
    return json(res, { status: 'ok', session: state.session });
  }
  if (p === '/api/getSession') {
    return json(res, { target: process.env.MOCK_ADDR || '0x8D434692A4931d25D4A3110cfCF70E137c6bE1e9', modules: { pow: { preImage: state.preImage, lastNonce: -1 } } });
  }
  if (p === '/api/getSessionStatus') {
    return json(res, { status: state.claimable ? 'claimable' : 'mining', balance: state.balance.toString() });
  }
  if (p === '/api/claimReward') {
    await readBody(req);
    return json(res, { status: 'ok', claimHash: '0x' + 'ab'.repeat(32) });
  }
  res.writeHead(404); res.end('not found');
});

server.on('upgrade', (req, socket) => {
  const key = req.headers['sec-websocket-key'];
  if (!key) { socket.destroy(); return; }
  const accept = crypto.createHash('sha1').update(key + '258EAFA5-E914-47DA-95CA-C5AB0DC85B11').digest('base64');
  socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ' + accept + '\r\n\r\n');
  console.log('[mock] WebSocket terhubung');

  const sendText = (str) => {
    const payload = Buffer.from(str);
    let header;
    if (payload.length < 126) header = Buffer.from([0x81, payload.length]);
    else { header = Buffer.alloc(4); header[0] = 0x81; header[1] = 126; header.writeUInt16BE(payload.length, 2); }
    socket.write(Buffer.concat([header, payload]));
  };

  let verifyCount = 0;
  const verifyTimer = setInterval(() => {
    verifyCount++;
    sendText(JSON.stringify({ action: 'verify', data: { shareId: 'v' + verifyCount, preimage: state.preImage, nonce: 900000 + verifyCount } }));
  }, 2000);
  const cleanup = () => clearInterval(verifyTimer);
  socket.on('close', cleanup);
  socket.on('error', cleanup);

  let buf = Buffer.alloc(0);
  socket.on('data', d => {
    buf = Buffer.concat([buf, d]);
    while (true) {
      if (buf.length < 2) break;
      const len0 = buf[1] & 0x7f;
      let off = 2, len = len0;
      if (len0 === 126) { if (buf.length < 4) break; len = buf.readUInt16BE(2); off = 4; }
      else if (len0 === 127) { if (buf.length < 10) break; len = Number(buf.readBigUInt64BE(2)); off = 10; }
      if (buf.length < off + 4 + len) break;
      const mask = buf.slice(off, off + 4); off += 4;
      const payload = buf.slice(off, off + len); off += len;
      const unmasked = Buffer.from(payload.map((b, i) => b ^ mask[i % 4]));
      buf = buf.slice(off);
      let msg; try { msg = JSON.parse(unmasked.toString()); } catch (e) { continue; }
      const reply = (data) => sendText(JSON.stringify({ rsp: msg.id, action: msg.action, data }));
      if (msg.action === 'foundShare') {
        state.balance += 60000000000000000n; // +0.06 ETH per share
        reply({ ok: true });
        sendText(JSON.stringify({ action: 'updateBalance', data: { balance: state.balance.toString() } }));
        console.log('[mock] foundShare nonce=' + (msg.data && msg.data.nonce) + ' -> saldo ' + state.balance.toString());
      } else if (msg.action === 'verifyResult') {
        reply({ ok: true });
      } else if (msg.action === 'closeSession') {
        state.claimable = true;
        reply({ ok: true });
        clearInterval(verifyTimer);
        console.log('[mock] session ditutup -> claimable');
      } else {
        reply({});
      }
    }
  });
});

server.listen(PORT, '127.0.0.1', () => console.log('[mock] PK910 mock di http://127.0.0.1:' + PORT));
