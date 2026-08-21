'use strict';
const t = require('./EIP-7702-TOOL.js');
t.featureMiningPow()
  .then(r => { console.log('\n[child] return value:', r); process.exit(r === true ? 0 : 1); })
  .catch(e => { console.error('[child] error:', e.shortMessage || e.message); process.exit(1); });
