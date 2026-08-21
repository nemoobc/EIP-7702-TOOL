<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=190&section=header&text=%F0%9F%94%A5%20EIP-7702%20TOOL%20%F0%9F%94%A5&fontSize=52&fontColor=ffffff&animation=fadeIn&desc=Wallet%20CLI%20%E2%80%A2%20EIP-7702%20Toolkit%20untuk%20Ethereum&descSize=18&descAlignY=68" width="100%" />

<a href="https://github.com/nemoobc/EIP-7702-TOOL"><img src="https://img.shields.io/badge/Version-3.3.0-brightgreen?style=for-the-badge&logo=github" alt="Version"></a>
<a href="https://www.npmjs.com/package/eip7702-tool"><img src="https://img.shields.io/npm/v/eip7702-tool?style=for-the-badge&logo=npm&color=cb3837" alt="npm"></a>
<a href="https://nodejs.org"><img src="https://img.shields.io/badge/Node.js-v18%2B-339933?style=for-the-badge&logo=node.js&logoColor=white" alt="Node.js"></a>
<img src="https://img.shields.io/badge/Network-Mainnet%20%2B%20Sepolia-blue?style=for-the-badge&logo=ethereum&logoColor=white" alt="Network">
<img src="https://img.shields.io/badge/License-MIT-yellow?style=for-the-badge" alt="License">
<img src="https://img.shields.io/badge/Tests-41%20PASS-success?style=for-the-badge&logo=checkmarx&logoColor=white" alt="Tests">

<br>

<a href="https://github.com/nemoobc/EIP-7702-TOOL/stargazers"><img src="https://img.shields.io/github/stars/nemoobc/EIP-7702-TOOL?style=social" alt="Stars"></a>
<a href="https://github.com/nemoobc/EIP-7702-TOOL/network/members"><img src="https://img.shields.io/github/forks/nemoobc/EIP-7702-TOOL?style=social" alt="Forks"></a>
<a href="https://github.com/nemoobc/EIP-7702-TOOL/issues"><img src="https://img.shields.io/github/issues/nemoobc/EIP-7702-TOOL?style=social" alt="Issues"></a>

[![Typing SVG](https://readme-typing-svg.demolab.com?font=Fira+Code&weight=600&size=22&pause=1000&color=F7B93E&center=true&vCenter=true&width=650&lines=Buat+wallet+%E2%9A%A1;Kirim+ETH+%26+token+%F0%9F%92%B8;Delegasi+EOA+dengan+EIP-7702+%F0%9F%A7%AA;Batch+call+atomik+%F0%9F%A7%A9;Rescue+aset+dari+wallet+terkunci+%F0%9F%9B%9F;Revoke+approval+berbahaya+%F0%9F%94%90;Deploy+kontrak+ERC-20%2F721%2F1155+%F0%9F%A7%99)](https://github.com/nemoobc/EIP-7702-TOOL)

</div>

---

## 🚀 Quick Start

**Tanpa install (via npx):**

```bash
npx eip7702-tool
```

**Atau dari source:**

```bash
git clone https://github.com/nemoobc/EIP-7702-TOOL.git
cd EIP-7702-TOOL
npm install
npm start
```

> Butuh Node.js v18+. Untuk fitur Mining PoW: `npm install --include=optional` (solver native).

**Pertama kali?** Pilih menu `2. Create Wallet`, lalu funding di Sepolia via menu `17. Mining POW` atau [faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia). Default network sudah Sepolia testnet — aman untuk eksperimen.

---

## ✨ Fitur

<table>
<tr><td>🧾 <b>Wallet Management</b></td><td>Buat / import / export / hapus wallet, terenkripsi lokal</td></tr>
<tr><td>💸 <b>Send ETH & Token</b></td><td>Mode manual atau MAX, input ETH/USD, EIP-1559</td></tr>
<tr><td>🧪 <b>EIP-7702 Delegation</b></td><td>Delegasikan EOA ke kontrak, revoke kapan saja</td></tr>
<tr><td>🧩 <b>Batch Call</b></td><td>Banyak aksi dalam SATU transaksi</td></tr>
<tr><td>🛟 <b>Rescue Atomic</b></td><td>Selamatkan ETH/ERC20/ERC721 dari wallet terkunci, gas dibayar sponsor</td></tr>
<tr><td>🎁 <b>Claim Airdrop</b></td><td>Klaim + forward reward ke SAFE dalam satu TX atomic</td></tr>
<tr><td>🔐 <b>Approval Manager</b></td><td>Scan approval ERC-20 nyata via event log, revoke sendiri atau via sponsor</td></tr>
<tr><td>🧙 <b>Wizard Deploy</b></td><td>Deploy ERC-20/721/1155 dari template, verifikasi otomatis Sourcify + Blockscout</td></tr>
<tr><td>⛽ <b>Gas Fee</b></td><td>Cek & atur kecepatan gas (slow/normal/fast/auto/manual)</td></tr>
<tr><td>⛏️ <b>Mining POW</b></td><td>Claim ETH Sepolia via PoW mining PK910</td></tr>
<tr><td>🛡️ <b>Mainnet Safety</b></td><td>Warning konfirmasi + rekomendasi RPC sebelum transaksi mainnet</td></tr>
</table>

<div align="center">
<a href="https://nodejs.org"><img src="https://skillicons.dev/icons?i=nodejs,js,docker,git,github,vscode&theme=dark" /></a>
</div>

---

## 🌐 Jaringan

| Network | Chain ID | | Network | Chain ID |
|:--------|:--------:|-|:--------|:--------:|
| Ethereum Mainnet | 1 | | Base | 8453 |
| Sepolia (default) 🟢 | 11155111 | | Polygon | 137 |
| Arbitrum One | 42161 | | BNB Smart Chain | 56 |
| OP Mainnet | 10 | | Custom | any |

---

## 🏗️ Cara Kerja EIP-7702

```
┌─────────┐   sign auth    ┌──────────────┐   type-4 tx   ┌─────────────┐
│   EOA   │ ─────────────► │ Authorization│ ────────────► │ Kode akun   │
│ (target)│                │ {chainId,    │               │ 0xef0100‖impl│
└─────────┘                │  impl,nonce} │               └──────┬──────┘
                           └──────────────┘                      │ delegatecall
                     sponsor bayar gas ─────────►        ┌──────▼──────┐
                                                         │ Kontrak impl│
                                                         │ rescue/batch│
                                                         └─────────────┘
```

- **Self-sponsored**: EOA mengirim tx sendiri (auth nonce = nonce + 1)
- **Sponsored**: pihak lain membayar gas; EOA hanya tanda tangan authorization
- **Revoke**: delegasi ke alamat `0x0` → akun kembali EOA biasa

Tool ini menangani RLP encoding, signing, nonce management, dan estimasi gas secara otomatis.

---

## 📚 Panduan Singkat

### Kirim ETH / Token
Pilih menu `10`/`11` → pilih wallet → masukkan tujuan → mode manual/MAX → konfirmasi. Input bisa dalam ETH atau USD (konversi otomatis via CoinGecko).

### Rescue Assets (wallet terkunci)
Menu `8` → deploy kontrak rescue (sekali, lalu reuse) → target hanya sign authorization → sponsor membayar gas → aset pindah atomik ke alamat SAFE.

### Approval Manager
Menu `18` → pilih mode scan:
- **Token populer** — 19 token bawaan (USDT, USDC, DAI, WETH, WBTC, LINK, UNI, AAVE, SHIB, MATIC, ARB, OP, PEPE, CRV, SNX, SUSHI, COMP, MKR, LDO) + alamat token kustom
- **Menyeluruh** — semua token apa pun via [Etherscan API](https://etherscan.io) (API key gratis); riwayat approval diambil dari event log blockchain lalu diverifikasi `allowance()` per spender

Lalu pilih yang mau di-revoke:
- **Self** — owner bayar gas
- **Sponsor** — via EIP-7702 atomic dengan kontrak `approvalRevoker`

> Di RPC publik, mode populer dibatasi riwayat ~1M blok terakhir. Mode menyeluruh tidak terpengaruh karena data diambil dari Etherscan.

### Wizard Deploy
Menu `15` → pilih ERC-20/721/1155 → kombinasikan fitur (mintable, burnable, pausable, roles, permit, flash minting, UUPS proxy) → deploy → verifikasi otomatis ke Sourcify & Blockscout.

### Mining POW (Sepolia)
Menu `17` → ambil CAPTCHA token dari [sepolia-faucet.pk910.de](https://sepolia-faucet.pk910.de) → mining CryptoNight berjalan → checkpoint claim tiap 0.05 ETH → opsional auto-delegate EIP-7702 setelah claim.

---

## 🧪 Testing

```bash
npm test            # suite lengkap on-chain (Sepolia) + offline compile
npm run test:approval  # Approval Manager end-to-end
npm run test:mining    # mining loop end-to-end (mock faucet lokal)
```

Test berhenti dengan aman (SKIP) jika wallet belum dana. Override:

```bash
TEST_RPC_URL=https://your-sepolia-rpc TEST_PRIVATE_KEY=0x... npm test
```

Cakupan: compile semua template (offline), RPC read-only, transfer ETH/token, seluruh varian ERC-20, Batch Call + delegasi, Rescue ETH/ERC20/ERC721, Revoke, Claim Airdrop, UUPS upgrade, scan/revoke approval, mining loop — termasuk pengujian dengan **state mainnet asli** (fork + simulasi `eth_call`/`stateOverride`, lihat `test-fork.js` & `test-mainnet-sim.js`).

Hasil uji terakhir: **41 PASS / 0 FAIL** — termasuk verifikasi delegasi (`0xef0100…`) dan revoke kembali ke EOA.

Wallet test: buat wallet baru, simpan di `test-wallet.json` (sudah di-gitignore), fund 0.05–0.1 Sepolia ETH. Laporan tersimpan di `test-report.json`.

<div align="center">
<a href="https://github.com/nemoobc/EIP-7702-TOOL">
  <img src="https://github-readme-stats.vercel.app/api/pin/?username=nemoobc&repo=EIP-7702-TOOL&theme=tokyonight&show_icons=true" />
</a>
</div>

---

## 🔒 Security

- Private key **tidak pernah** meninggalkan komputer — wallet disimpan sebagai kestore terenkripsi di `~/.wallet-cli/wallets/`
- Transaksi mainnet selalu meminta konfirmasi manual (ketik "YA")
- Kontrak rescue/batch/revoker punya access control ketat: hanya rescuer/deployer yang bisa memanggil
- Registry kontrak deploy di-scope per chainId — tidak ada reuse lintas-jaringan

**Rekomendasi tambahan:**
- Gunakan wallet baru khusus testing, jangan wallet utama
- Untuk mainnet, pakai RPC berbayar (Alchemy/QuickNode) — RPC publik sering tidak mendukung tx type-4
- Backup folder `~/.wallet-cli/wallets/` dan mnemonic di tempat aman

Laporkan kerentanan: buka [Security Advisory](https://github.com/nemoobc/EIP-7702-TOOL/security/advisories/new) (jangan public issue).

---

## ⚠️ Disclaimer

Software ini disediakan **apa adanya**, tanpa jaminan apa pun. Transaksi blockchain bersifat **final dan tidak dapat dibatalkan**. Pengguna bertanggung jawab penuh atas private key, transaksi, dan penggunaan tool ini di jaringan mana pun. Verifikasi setiap alamat dan jumlah sebelum konfirmasi.

---

## ❓ FAQ

**Transaksi gagal di mainnet?**
RPC publik rate-limited / tidak support type-4 → ganti ke Alchemy/QuickNode. Cek juga saldo gas.

**Support hardware wallet?**
Belum. Saat ini JSON keystore saja.

**Berapa banyak token discan Approval Manager?**
19 token populer + token kustom yang Anda tambahkan.

**Support multi-chain?**
Ya — Mainnet, Sepolia, Arbitrum, OP, Base, Polygon, BSC, dan custom network.

---

## 🔧 Troubleshooting

| Error | Solusi |
|-------|--------|
| `RPC provider does not support EIP-7702` | Ganti ke Alchemy/QuickNode |
| `Insufficient funds for gas` | Tambah saldo ETH |
| `Transaction nonce too low` | Tunggu beberapa detik, ulangi |
| `Solver CryptoNight belum tersedia` | `npm install --include=optional` (butuh Python untuk build native) |
| `Password salah atau file wallet rusak` | Cek password / buat wallet baru |
| `Session tidak ditemukan` (mining) | Session expired, buat session baru |

---

## 💝 Donate

**Ethereum / Sepolia:** `0x5e02fac179dfbd8a63fa7058011b348fdbba7158`

---

## 📜 Lisensi

MIT — lihat [LICENSE](LICENSE).

<p align="center">
  <img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=6,11,20&height=150&section=footer&text=Dibuat%20dengan%20%E2%9D%A4%EF%B8%8F%20dan%20%E2%98%95&fontSize=26&fontColor=ffffff&animation=twinkling" alt="footer"/>
</p>
