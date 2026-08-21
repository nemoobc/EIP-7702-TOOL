'use strict';
// TEST MINING END-TO-END — mock PK910 lokal + featureMiningPow asli (stdin terskrip)
const { spawn } = require('child_process');

const ADDR = '0x8D434692A4931d25D4A3110cfCF70E137c6bE1e9';
const steps = [
  { marker: 'Pilih mode:', answer: '1' },
  { marker: 'Faucet URL', answer: 'http://127.0.0.1:9911' },
  { marker: 'Client version', answer: '' },
  { marker: 'Target ETH', answer: '0.5' },
  { marker: 'Alamat wallet', answer: ADDR },
  { marker: 'CAPTCHA token', answer: 'mock-captcha' },
  { marker: 'Checkpoint', answer: '1' },
  { marker: 'Tekan Enter', answer: '' },
];

require('./mock-pk910.js');
console.log('[driver] mock server siap, menjalankan featureMiningPow...\n');
setTimeout(() => {
const child = spawn('node', ['mining-driver-child.js'], { stdio: ['pipe', 'pipe', 'inherit'] });
let out = '';
let i = 0;
let done = false;
child.stdout.on('data', d => {
  process.stdout.write(d);
  out += d.toString();
});
// Kirim jawaban bergantian dengan jeda agar readline sempat attach
(async () => {
  await sleep(1000);
  for (const step of steps) {
    if (done) return;
    // tunggu marker muncul di output
    const t0 = Date.now();
    while (!out.includes(step.marker)) {
      if (done || Date.now() - t0 > 30000) { console.log(`\n[driver] marker tidak muncul: ${step.marker}`); return; }
      await sleep(200);
    }
    child.stdin.write(step.answer + '\n');
    i++;
    await sleep(700);
  }
})();
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
child.on('exit', code => {
  done = true;
  console.log('\n[driver] featureMiningPow exit code:', code);
  if (i === steps.length && code === 0) { console.log('✅ PASS: mining loop end-to-end (session → hash → share → checkpoint claim)'); process.exit(0); }
  console.log(i < steps.length ? `❌ FAIL: berhenti di step ${i + 1}/${steps.length} (${steps[i].marker})` : '❌ FAIL: exit code ' + code);
  process.exit(1);
});
setTimeout(() => { if (!done) { console.log('\n❌ FAIL: timeout 120s'); child.kill(); process.exit(1); } }, 120000);
}, 500);
