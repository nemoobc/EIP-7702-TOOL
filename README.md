<p align="center">
  <img src="https://img.shields.io/badge/Version-3.3.0-brightgreen?style=for-the-badge" alt="Version">
  <img src="https://img.shields.io/badge/Node.js-v18+-green?style=for-the-badge&logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License">
</p>

<h1 align="center">🔥 EIP-7702 TOOL</h1>

<p align="center">
  <b>Wallet CLI & EIP-7702 Toolkit untuk Ethereum</b><br>
  <i>Buat wallet, kirim ETH/token, delegasi EOA, batch call, rescue aset, revoke approval — semua dari terminal.</i>
</p>

---

## 🚀 Quick Start

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

| Fitur | Deskripsi |
|:------|:----------|
| 🧾 **Wallet Management** | Buat / import / export / hapus wallet, terenkripsi lokal |
| 💸 **Send ETH & Token** | Mode manual atau MAX, input ETH/USD, EIP-1559 |
| 🧪 **EIP-7702 Delegation** | Delegasikan EOA ke kontrak, revoke kapan saja |
| 🧩 **Batch Call** | Banyak aksi dalam SATU transaksi |
| 🛟 **Rescue Atomic** | Selamatkan ETH/ERC20/ERC721 dari wallet terkunci, gas dibayar sponsor |
| 🎁 **Claim Airdrop** | Klaim + forward reward ke SAFE dalam satu TX atomic |
| 🔐 **Approval Manager** | Scan approval ERC-20 nyata via event log, revoke sendiri atau via sponsor |
| 🧙 **Wizard Deploy** | Deploy ERC-20/721/1155 dari template, verifikasi otomatis Sourcify + Blockscout |
| ⛽ **Gas Fee** | Cek & atur kecepatan gas (slow/normal/fast/auto/manual) |
| ⛏️ **Mining POW** | Claim ETH Sepolia via PoW mining PK910 |
| 🛡️ **Mainnet Safety** | Warning konfirmasi + rekomendasi RPC sebelum transaksi mainnet |

---

## 🌐 Jaringan

| Network | Chain ID | | Network | Chain ID |
|:--------|:--------:|-|:--------|:--------:|
| Ethereum Mainnet | 1 | | Base | 8453 |
| Sepolia (default) | 11155111 | | Polygon | 137 |
| Arbitrum One | 42161 | | BNB Smart Chain | 56 |
| OP Mainnet | 10 | | Custom | any |

---

## 📋 Menu

```
┌──────────────────────────────────────────┐
│        WALLET & EIP-7702 TOOL            │
│ 1. Batch Call (Deploy + Execute)         │
│ 2. Create Wallet                         │
│ 3. Change Wallet          10. Send ETH   │
│ 4. Delete Wallet          11. Send Token │
│ 5. Export Private Key     12. Info Wallet│
│ 6. Import Wallet          13. Network    │
│ 7. List Wallets           14. Claim Airdrop │
│ 8. Rescue Assets          15. Wizard Deploy │
│ 9. Revoke Delegation      16. Gas Fee    │
│                           17. Mining POW │
│                           18. Approval Manager │
│ 0. Exit                                  │
└──────────────────────────────────────────┘
```

---

## 🏗️ Cara Kerja EIP-7702

EIP-7702 memungkinkan sebuah EOA mengeksekusi kode kontrak dengan menandatangani *authorization* (tx type 4):

```
┌─────────┐   sign auth    ┌──────────────┐   type-4 tx   ┌─────────────┐
│ EOA     │ ─────────────► │ Authorization│ ────────────► │ Kode akun   │
(target)  │                │ {chainId,    │               │ 0xef0100‖impl│
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
Menu `18` → scan approval aktif via event log `Approval` + verifikasi `allowance()` per spender → pilih yang mau di-revoke:
- **Self** — owner bayar gas
- **Sponsor** — via EIP-7702 atomic dengan kontrak `approvalRevoker`

Bisa tambah alamat token kustom (berguna di testnet). Daftar bawaan: USDT, USDC, DAI, WETH, WBTC, LINK, UNI, AAVE, SHIB, MATIC, ARB, OP, PEPE, CRV, SNX, SUSHI, COMP, MKR, LDO.

> Di RPC publik, scan dibatasi riwayat ~1M blok terakhir. Gunakan RPC berbayar untuk riwayat penuh.

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

Cakupan: compile semua template (offline), RPC read-only, transfer ETH/token, seluruh varian ERC-20, Batch Call + delegasi, Rescue ETH/ERC20/ERC721, Revoke, Claim Airdrop, UUPS upgrade, scan/revoke approval, mining loop.

Hasil uji terakhir: **41 PASS / 0 FAIL** — termasuk verifikasi delegasi (`0xef0100…`) dan revoke kembali ke EOA.

Wallet test: buat wallet baru, simpan di `test-wallet.json` (sudah di-gitignore), fund 0.05–0.1 Sepolia ETH. Laporan tersimpan di `test-report.json`.

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

## 📝 Changelog

### v3.3.0
- **Fixed:** Approval Manager kini scan approval nyata via event log `Approval` + verifikasi `allowance()` per spender; dukungan token kustom (testnet-ready)
- **Added:** Sponsor revoke via EIP-7702 atomic (`approvalRevoker`); mode pembayaran gas Self/Sponsor
- **Fixed:** Bug non-standard ERC20 (USDT) — kontrak `rescue`, `airdropClaimer`, dan `approvalRevoker` kini pakai low-level call agar kompatibel dengan token yang tidak mengembalikan `bool` (v1.1.0)
- **Fixed:** Mining PoW throttle polling status tiap 3 detik; registry kontrak deploy per chainId; reuse kontrak batch verifikasi deployer
- **Fixed:** Flash loan ERC-3156 mengirim alamat token yang benar; ERC-165 untuk ERC-721/1155; NFT token ID pakai BigInt; verifikasi Blockscout pakai endpoint `verifysourcecode`
- **Changed:** Estimasi gas dinamis pada delegasi EIP-7702; config default Sepolia testnet
- **Added:** Test suite lengkap — on-chain Sepolia (35 PASS), Approval Manager (5 PASS), mining loop end-to-end via mock faucet lokal, mainnet fork + simulasi state mainnet via `eth_call`/`stateOverride` (9 PASS)
- **Changed:** README ditulis ulang; dependency terkunci via `package-lock.json`

---

## 💝 Donate

**Ethereum / Sepolia:** `0x5e02fac179dfbd8a63fa7058011b348fdbba7158`

---

## 📜 Lisensi

MIT — lihat [LICENSE](LICENSE).
