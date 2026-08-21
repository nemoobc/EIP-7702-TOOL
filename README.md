<!-- PROJECT SHIELDS -->
<p align="center">
  <a href="https://github.com/nemoobc/EIP-7702-TOOL">
    <img src="https://img.shields.io/badge/Version-3.2.0-brightgreen?style=for-the-badge&logo=github" alt="Version">
  </a>
  <a href="https://github.com/nemoobc/EIP-7702-TOOL/network/members">
    <img src="https://img.shields.io/github/forks/nemoobc/EIP-7702-TOOL?style=for-the-badge&logo=github&color=blue" alt="Forks">
  </a>
  <a href="https://github.com/nemoobc/EIP-7702-TOOL/stargazers">
    <img src="https://img.shields.io/github/stars/nemoobc/EIP-7702-TOOL?style=for-the-badge&logo=github&color=yellow" alt="Stars">
  </a>
  <a href="https://github.com/nemoobc/EIP-7702-TOOL/issues">
    <img src="https://img.shields.io/github/issues/nemoobc/EIP-7702-TOOL?style=for-the-badge&logo=github&color=red" alt="Issues">
  </a>
  <a href="https://github.com/nemoobc/EIP-7702-TOOL/blob/main/LICENSE">
    <img src="https://img.shields.io/github/license/nemoobc/EIP-7702-TOOL?style=for-the-badge&color=orange" alt="License">
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-v18+-green?style=for-the-badge&logo=node.js" alt="Node.js">
  <img src="https://img.shields.io/badge/Network-Mainnet+Sepolia-blue?style=for-the-badge" alt="Network">
  <img src="https://img.shields.io/badge/Status-Active-brightgreen?style=for-the-badge" alt="Status">
</p>

<h1 align="center">
  <img src="https://media.giphy.com/media/hvRJCLFzcasrR4ia7z/giphy.gif" width="30px">
  🔥 EIP-7702 TOOL 🔥
  <img src="https://media.giphy.com/media/hvRJCLFzcasrR4ia7z/giphy.gif" width="30px">
</h1>

<p align="center">
  <b>✨ Wallet CLI & EIP-7702 Toolkit ✨</b><br>
  <i>Create wallet, import, export, send ETH/token, batch call, rescue assets, revoke delegation, claim airdrop, Approval Manager, Mainnet Safety</i>
</p>

<p align="center">
  <img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&size=24&pause=1000&color=F7B93E&center=true&vCenter=true&width=700&lines=Full+Animasi+Warna-warni;EIP-7702+Tool;Wallet+CLI+interaktif;Node.js+%2B+Viem+%2B+Ethers;Mainnet+Ready" alt="Typing SVG" />
</p>

---

## 📖 Deskripsi Proyek

**EIP-7702 Tool** adalah aplikasi Command Line Interface (CLI) interaktif berbasis Node.js untuk membantu pengguna memanfaatkan standar **EIP-7702** di jaringan Ethereum. Tool ini menggabungkan manajemen wallet dan operasi EIP-7702 dalam satu antarmuka penuh warna.

Dengan EIP-7702, sebuah Externally Owned Account (EOA) dapat didelegasikan sementara ke alamat kontrak implementasi, memungkinkan eksekusi kode kontrak atas nama akun tersebut. Tool ini menyediakan cara sederhana untuk delegasi, revoke, batch call, rescue aset (ETH, ERC-20, ERC-721), dan klaim airdrop secara atomik.

---

## 🚀 Fitur Utama

<div align="center">

| Icon | Fitur | Deskripsi | Status |
|:----:|:------|:----------|:------:|
| 🧾 | **Wallet Management** | Buat, import, list, export, delete wallet | ✅ |
| 💸 | **Send ETH** | Kirim ETH dengan auto-detect saldo, mode manual & kirim max | ✅ |
| 🪙 | **Send Token** | Kirim ERC-20 dengan auto-detect saldo, mode manual & kirim max | ✅ |
| 🧪 | **EIP-7702** | Delegasikan EOA, batalkan delegasi, rescue assets | ✅ |
| 🧩 | **Batch Call** | Deploy & eksekusi batch call | ✅ |
| 🛟 | **Rescue Atomic** | Rescue aset dari wallet terkunci | ✅ |
| 🔄 | **Revoke Delegation** | Batalkan delegasi EIP-7702 | ✅ |
| 🎁 | **Claim Airdrop** | Klaim airdrop via EIP-7702 | ✅ |
| ✅ | **Auto-Verify** | Verifikasi otomatis ke Sourcify | ✅ |
| 🌐 | **Change Network** | Pilih & kelola network | ✅ |
| ℹ️ | **Info Wallet** | Lihat saldo, nonce, kode akun | ✅ |
| 🧙 | **Wizard Deploy** | Deploy kontrak dari template (ERC-20/721/1155) | ✅ |
| ⛽ | **Gas Fee** | Cek & ubah gas fee | ✅ |
| ⛏️ | **Mining POW** | Claim ETH via PoW mining (PK910) | ✅ |
| 🔐 | **Approval Manager** | Cek & revoke ERC-20 approval aktif | ✅ |
| 🛡️ | **Mainnet Safety** | Warning konfirmasi transaksi di mainnet | ✅ |

</div>

---

## 🌐 Supported Networks

<div align="center">

| Network | Chain ID | Status | Catatan |
|:--------|:--------:|:------:|:--------|
| 🔴 **Ethereum Mainnet** | 1 | ✅ | Gunakan RPC berbayar |
| 🟢 **Sepolia Testnet** | 11155111 | ✅ | Default, untuk testing |
| 🔵 **Arbitrum One** | 42161 | ✅ | Layer 2 |
| 🔴 **OP Mainnet** | 10 | ✅ | Optimism |
| 🔵 **Base** | 8453 | ✅ | Coinbase L2 |
| 🟣 **Polygon** | 137 | ✅ | Sidechain |
| 🟡 **BNB Smart Chain** | 56 | ✅ | Binance |
| ⚪ **Custom Network** | Any | ✅ | Tambah sendiri |

</div>

---

## 🖥️ Menu Interaktif

```
┌──────────────────────────────────────────┐
│        WALLET & EIP-7702 TOOL            │
│ 1. Batch Call (Deploy + Execute)         │
│ 2. Create Wallet                         │
│ 3. Change Wallet                         │
│ 4. Delete Wallet                         │
│ 5. Export Private Key                    │
│ 6. Import Wallet                         │
│ 7. List Wallets                          │
│ 8. Rescue Assets (ETH/ERC20/ERC721)      │
│ 9. Revoke Delegation                     │
│ 10. Send ETH                             │
│ 11. Send Token                           │
│ 12. Info Wallet                          │
│ 13. Network                              │
│ 14. Claim Airdrop (Delegation)           │
│ 15. Wizard Deploy                        │
│ 16. Gas Fee                              │
│ 17. Mining POW                           │
│ 18. Approval Manager                     │
│ 0. Exit                                  │
└──────────────────────────────────────────┘
```

---

## 📚 Penjelasan Fitur Lengkap

### 🧾 1. Wallet Management

Kelola wallet Ethereum secara lokal di komputer Anda.

**Sub-fitur:**
| Aksi | Deskripsi |
|------|-----------|
| **Create Wallet** | Buat wallet baru dengan password, tersimpan di `~/.wallet-cli/wallets/` |
| **Import Wallet** | Import wallet dari private key atau mnemonic phrase |
| **List Wallets** | Lihat semua wallet yang tersimpan |
| **Export Private Key** | Tampilkan private key (untuk backup) |
| **Delete Wallet** | Hapus wallet dari penyimpanan |
| **Change Wallet** | Ganti wallet default |

**Cara Pakai:**
```
1. Pilih menu 2-7 sesuai aksi yang diinginkan
2. Ikuti instruksi di layar
3. Wallet tersimpan secara lokal (tidak dikirim ke server)
```

**Keamanan:**
- Private key disimpan lokal, tidak pernah dikirim ke mana pun
- File wallet di-encrypt dengan password
- Selalu backup folder `wallets/`

---

### 💸 2. Send ETH

Kirim ETH ke alamat lain dengan fitur lengkap.

**Fitur:**
- ✅ Auto-detect saldo wallet
- ✅ Mode manual (input jumlah)
- ✅ Mode kirim MAX (semua saldo dikurangi gas)
- ✅ Input dalam ETH atau USD (auto konversi)
- ✅ Auto-estimate gas fee
- ✅ Support EIP-1559 (maxFeePerGas, maxPriorityFeePerGas)

**Cara Pakai:**
```
1. Pilih menu 10. Send ETH
2. Pilih wallet
3. Masukkan alamat penerima
4. Pilih mode (manual/MAX)
5. Masukkan jumlah (ETH atau USD)
6. Konfirmasi transaksi
7. Tunggu konfirmasi
```

**Contoh:**
```
Pilih menu: 10
Wallet: 0x1234...5678
Ke: 0xABCD...9999
Mode: 1 (Manual)
Jumlah: 0.5 ETH
Gas: ~0.002 ETH

✅ Transaksi berhasil!
TX Hash: 0xabc123...
```

---

### 🪙 3. Send Token

Kirim token ERC-20 ke alamat lain.

**Fitur:**
- ✅ Auto-detect saldo token
- ✅ Auto-detect decimal token
- ✅ Mode manual (input jumlah)
- ✅ Mode kirim MAX (semua saldo token)
- ✅ Support semua token ERC-20

**Cara Pakai:**
```
1. Pilih menu 11. Send Token
2. Pilih wallet
3. Masukkan alamat kontrak token
4. Masukkan alamat penerima
5. Pilih mode (manual/MAX)
6. Masukkan jumlah token
7. Konfirmasi transaksi
```

**Contoh:**
```
Pilih menu: 11
Wallet: 0x1234...5678
Token: 0xdAC17F958D2ee523a2206206994597C13D831ec7 (USDT)
Ke: 0xABCD...9999
Mode: 1 (Manual)
Jumlah: 1000 USDT
Gas: ~0.003 ETH

✅ Transaksi berhasil!
TX Hash: 0xdef456...
```

---

### 🧪 4. EIP-7702 Operations

Operasi terkait standar EIP-7702 untuk delegasi EOA.

**Sub-fitur:**
| Aksi | Deskripsi |
|------|-----------|
| **Delegate** | Delegasikan EOA ke kontrak implementasi |
| **Revoke** | Batalkan delegasi EIP-7702 |
| **Rescue** | Rescue aset dari wallet terkunci |

**Cara Kerja Delegate:**
```
1. Deploy kontrak implementasi (atau pakai yang sudah ada)
2. Sign authorization (type: 4 tx)
3. Kirim ke network
4. Sekarang wallet bisa jalankan kode kontrak
```

**Cara Kerja Revoke:**
```
1. Sign revoke authorization
2. Kirim transaksi
3. Wallet kembali normal (EOA biasa)
```

---

### 🧩 5. Batch Call

Eksekusi beberapa transaksi dalam satu transaksi.

**Fitur:**
- ✅ Deploy kontrak batch
- ✅ Eksekusi batch call
- ✅ Hanya deployer yang bisa eksekusi

**Contoh Use Case:**
```
Kirim ETH + Transfer Token + Revoke Approval
         ↓                    ↓              ↓
    Semua jadi SATU transaksi
```

**Cara Pakai:**
```
1. Pilih menu 1. Batch Call
2. Pilih wallet
3. Input list aksi yang mau dilakukan
4. Review & konfirmasi
5. Eksekusi batch
```

---

### 🛟 6. Rescue Atomic

Rescue aset dari wallet yang terkunci secara atomic.

**Fitur:**
- ✅ Deploy kontrak rescue
- ✅ Hanya sponsor yang bisa memanggil rescue
- ✅ Target hanya sign authorization
- ✅ Gas dibayar sponsor

**Cara Kerja:**
```
Kasus: Wallet terkunci tapi ada aset di dalamnya

1. Deploy kontrak rescue dengan hak akses khusus
2. Sponsor bayar gas
3. Target sign authorization
4. Aset dipindahkan ke wallet lain secara atomic
```

**Cara Pakai:**
```
1. Pilih menu 8. Rescue Assets
2. Pilih mode (Rescue ETH/ERC20/ERC721)
3. Masukkan data yang diperlukan
4. Deploy kontrak rescue
5. Eksekusi rescue
```

---

### 🔄 7. Revoke Delegation

Batalkan delegasi EIP-7702.

**Fitur:**
- ✅ Batalkan delegasi EIP-7702
- ✅ Sponsor membayar gas
- ✅ Auto-detect saldo sponsor

**Cara Pakai:**
```
1. Pilih menu 9. Revoke Delegation
2. Masukkan alamat wallet korban
3. Masukkan private key korban
4. Pilih sponsor (opsional)
5. Konfirmasi transaksi
```

---

### 🎁 8. Claim Airdrop (Delegation)

Klaim airdrop via EIP-7702 dengan sponsor.

**Fitur:**
- ✅ Klaim airdrop via EIP-7702
- ✅ Sponsor membayar gas
- ✅ Reward otomatis dikirim ke SAFE

**Cara Pakai:**
```
1. Pilih menu 14. Claim Airdrop
2. Pilih wallet
3. Masukkan data airdrop
4. Pilih sponsor
5. Konfirmasi transaksi
```

---

### ✅ 9. Auto-Verify Sourcify

Verifikasi otomatis kontrak ke Sourcify.

**Fitur:**
- ✅ Verifikasi otomatis setelah deploy
- ✅ Gratis tanpa API key
- ✅ Support semua chain

**Cara Kerja:**
```
1. Deploy kontrak
2. Otomatis verifikasi ke Sourcify
3. Kontrak diverifikasi dan bisa diakses publik
```

---

### 🌐 10. Change Network

Kelola network RPC.

**Fitur:**
- ✅ Pilih network aktif
- ✅ Tambah network baru
- ✅ Hapus network
- ✅ Lihat daftar network
- ✅ Auto-detect chain ID

**Cara Pakai:**
```
1. Pilih menu 13. Network
2. Pilih aksi:
   - 1. Pilih Network Aktif
   - 2. Tambah Network Baru
   - 3. Hapus Network
   - 4. Lihat Daftar Network
3. Ikuti instruksi di layar
```

**Contoh Tambah Network:**
```
Pilih menu: 13
Aksi: 2 (Tambah Network)
Nama: My Custom Network
RPC URL: https://my-rpc.example.com
Chain ID: 12345

✅ Network berhasil ditambahkan!
```

---

### ℹ️ 11. Info Wallet

Lihat informasi lengkap wallet.

**Informasi yang Ditampilkan:**
- ✅ Address
- ✅ ETH Balance (dengan nilai USD)
- ✅ Account Nonce
- ✅ Next auth nonce (self & sponsor)
- ✅ Network (Chain ID)
- ✅ Kode akun (EOA atau delegated)

**Cara Pakai:**
```
1. Pilih menu 12. Info Wallet
2. Pilih wallet
3. Lihat informasi lengkap
```

**Contoh Tampilan:**
```
┌───────────────────────────────────────────┐
│ INFO WALLET                               │
├───────────────────────────────────────────┤
│ Address: 0x1234...5678                    │
│ ETH Balance: 0.5234 ETH ($1,234.56)      │
│ Account Nonce: 42                         │
│ Next auth nonce (self): 43                │
│ Next auth nonce (sponsor): 42             │
│ Network: sepolia (Chain ID: 11155111)     │
│ Kode Akun: EOA (tidak terdelegasi)        │
└───────────────────────────────────────────┘
```

---

### 🧙 12. Wizard Deploy

Buat & deploy smart contract dari template.

**Template yang Tersedia:**

#### ERC-20 (Token)
- ✅ Basic ERC-20
- ✅ Mintable
- ✅ Burnable
- ✅ Pausable
- ✅ Roles (Ownable + AccessControl)
- ✅ Permit (EIP-2612)
- ✅ Flash Minting
- ✅ UUPS Proxy

#### ERC-721 (NFT)
- ✅ Basic ERC-721
- ✅ ERC721A (batch mint)

#### ERC-1155 (Multi-Token)
- ✅ Basic ERC-1155

**Cara Pakai:**
```
1. Pilih menu 15. Wizard Deploy
2. Pilih tipe kontrak (ERC-20/721/1155)
3. Pilih fitur yang diinginkan
4. Masukkan parameter (name, symbol, dll)
5. Deploy kontrak
6. Otomatis verifikasi ke Sourcify
```

**Contoh Deploy ERC-20:**
```
Pilih menu: 15
Tipe: ERC-20
Fitur: Mintable, Burnable, Pausable, Roles
Name: MyToken
Symbol: MTK
Decimals: 18
Initial Supply: 1000000

✅ Kontrak berhasil di-deploy!
Address: 0xABC...123
TX Hash: 0xDEF...456
```

---

### ⛽ 13. Gas Fee

Cek & ubah pengaturan gas fee.

**Fitur:**
- ✅ Cek estimasi gas fee
- ✅ Ubah kecepatan gas (slow/normal/fast/auto/manual)
- ✅ Lihat gas price saat ini

**Mode Gas:**
| Mode | Deskripsi |
|------|-----------|
| **Slow** | Gas rendah, transaksi lambat |
| **Normal** | Gas sedang, transaksi normal |
| **Fast** | Gas tinggi, transaksi cepat |
| **Auto** | Otomatis sesuai kondisi jaringan |
| **Manual** | Input gas fee sendiri |

**Cara Pakai:**
```
1. Pilih menu 16. Gas Fee
2. Pilih aksi:
   - 1. Cek Gas Fee
   - 2. Ubah Gas Fee
3. Pilih mode gas
4. Konfirmasi
```

---

### ⛏️ 14. Mining POW

Claim ETH via PoW mining dari PK910 Sepolia Faucet.

**Fitur:**
- ✅ Mining dengan algoritma CryptoNight
- ✅ Checkpoint claim di 0.05 ETH
- ✅ Target default 2.5 ETH
- ✅ Auto-delegate EIP-7702 setelah claim
- ✅ Tampilan real-time: hashrate, nonce, balance, shares

**Cara Pakai:**

**Session baru:**
```
1. Pilih menu 17. Mining POW
2. Pilih 1) Session baru (butuh CAPTCHA token)
3. Masukkan CAPTCHA token dari website PK910
4. Mining akan dimulai secara otomatis
```

**Resume session:**
```
1. Pilih menu 17. Mining POW
2. Pilih 2) Resume session (session ID)
3. Masukkan session ID yang tersimpan
```

**Contoh Tampilan:**
```
⛏️  PoW Mining
   Algoritma : cryptonight
   Difficulty: 10
   Target    : 2.5 ETH
──────────────────────────────────────────────────
   ⚡ 2 H/s | nonce 153 | 0.008 ETH | 0 shares
```

**Catatan:**
- Solver CryptoNight dipasang sebagai optional dependency native
- Jalankan `npm install --include=optional`
- Dependency berlisensi GPL-3.0-or-later

---

### 🔐 15. Approval Manager

Kelola ERC-20 approval aktif pada wallet.

**Fitur:**
- ✅ Scan approval **nyata** via event log `Approval` dari 19 token populer (bukan cuma cek allowance ke alamat nol)
- ✅ Verifikasi ulang setiap spender via `allowance()` — hanya approval yang masih aktif ditampilkan
- ✅ Tampilkan spender per approval, pilih mana yang mau di-revoke
- ✅ Rentang scan adaptif (1M → 100k → 10k → 2k blok) agar tetap jalan di RPC publik yang membatasi `eth_getLogs`
- ✅ Mode pembayaran gas:
  - **Self Revoke** — Owner bayar gas sendiri (`approve(spender, 0)`)
  - **Sponsor Revoke** — Sponsor bayar gas via **EIP-7702 atomic**: kontrak `approvalRevoker` di-deploy sponsor, EOA owner didelegasikan atomik, revoke dieksekusi sebagai owner

**Cara Pakai:**
```
1. Pilih menu 18. Approval Manager
2. Pilih wallet
3. Tunggu scanning selesai
4. Pilih approval mana yang mau di-revoke (y/n)
5. Pilih mode gas (Self/Sponsor)
6. Konfirmasi transaksi
```

**Token yang Di-scan:**
USDT, USDC, DAI, WETH, WBTC, LINK, UNI, AAVE, SHIB, MATIC, ARB, OP, PEPE, CRV, SNX, SUSHI, COMP, MKR, LDO

**Contoh Tampilan:**
```
┌──────────────────────────────────────────┐
│ APPROVAL MANAGER                         │
│ Cek & revoke semua ERC-20 approval aktif │
└──────────────────────────────────────────┘

  Wallet: 0x1234...5678
  Scanning approval...

  Ditemukan 3 approval aktif:

  1. USDT → spender 0x63c79FcC... (unlimited) → Revoke? (y/n):
  2. WETH → spender 0x1111111254... (5.0)     → Revoke? (y/n):
  3. DAI  → spender 0x68b3465833... (1000.0)  → Revoke? (y/n):

  Pilih mode pembayaran gas:
    1) Self — bayar gas sendiri
    2) Sponsor — sponsor bayar gas (EIP-7702 atomic)
```

> ⚠️ Catatan: pada RPC publik dengan batas `getLogs`, hanya approval dalam rentang blok terbaru yang terdeteksi. Gunakan RPC berbayar (Alchemy/QuickNode) untuk scan riwayat penuh.

**Mengapa Penting:**
- Mencegah serangan drainer yang menggunakan approval lama
- Bersihkan approval yang tidak digunakan
- Tingkatkan keamanan wallet

---

### 🛡️ 16. Mainnet Safety

Fitur keamanan untuk penggunaan di mainnet.

**Fitur:**
- ✅ **Auto-Detect Chain** — Otomatis deteksi jaringan dan tampilkan status
- ✅ **Warning Konfirmasi** — Minta konfirmasi sebelum eksekusi transaksi di mainnet
- ✅ **RPC Recommendation** — Rekomendasi RPC provider untuk mainnet (Alchemy, QuickNode)

**Kapan Muncul:**
- **Network Status** — Setiap kali pilih fitur kirim transaksi
- **RPC Recommendation** — Saat di mainnet + pakai RPC publik
- **Confirm TX** — Sebelum eksekusi transaksi di mainnet

**Contoh Network Status:**
```
┌───────────────────────────────────────────┐
│ NETWORK STATUS                            │
│ Chain ID    : 1                           │
│ Network     : Ethereum Mainnet            │
│ Status      : 🔴 MAINNET (UANG NYATA)     │
│ RPC Provider: ethereum-rpc.publicnode.com │
└───────────────────────────────────────────┘
  ⚠️  Anda di MAINNET — semua transaksi menggunakan uang NYATA!
  💡 RPC publik mungkin tidak stabil. Rekomendasi: Alchemy / QuickNode
```

**Contoh Warning Konfirmasi:**
```
  ╔═══════════════════════════════════════════════════╗
  ║  ⚠️  PERINGATAN MAINNET                         ║
  ╚═══════════════════════════════════════════════════╝

  Anda sedang di: Ethereum Mainnet (chainId: 1)
  ⚡ Ini adalah jaringan NYATA dengan uang NYATA!

  ┌─────────────────────────────────────────────────┐
  │ Dari : 0x1234...5678
  │ Ke   : 0xABCD...9999
  │ Jumlah: 0.5 ETH ($1,200.00)
  └─────────────────────────────────────────────────┘

  Ketik "YA" untuk konfirmasi:
```

---

## ⚠️ Catatan Penting

<table>
  <tr>
    <td style="background-color: #ffcdd2; border-left: 5px solid #f44336; padding: 15px;">
      <h3>🔴 WARNING</h3>
      <ul>
        <li>Jangan bagikan private key atau mnemonic.</li>
        <li>Gunakan hanya di <b>Sepolia testnet</b> untuk testing.</li>
        <li>Selalu buat wallet baru untuk testing, jangan gunakan wallet utama.</li>
      </ul>
    </td>
  </tr>
</table>

<table>
  <tr>
    <td style="background-color: #c8e6c9; border-left: 5px solid #4caf50; padding: 15px;">
      <h3>💡 INFO</h3>
      <ul>
        <li>Tool ini sudah support <b>mainnet</b> dengan safety features.</li>
        <li>Gunakan RPC berbayar (Alchemy/QuickNode) untuk mainnet.</li>
        <li>Simpan kestore wallet di folder <code>wallets/</code> (privat).</li>
      </ul>
    </td>
  </tr>
</table>

<table>
  <tr>
    <td style="background-color: #bbdefb; border-left: 5px solid #2196f3; padding: 15px;">
      <h3>📌 TIP</h3>
      <ul>
        <li>Pastikan wallet sponsor memiliki cukup ETH untuk gas.</li>
        <li>Beberapa RPC publik mungkin tidak mendukung transaksi <code>type: 4</code>.</li>
        <li>Gunakan RPC berbayar seperti Alchemy/QuickNode jika perlu.</li>
      </ul>
    </td>
  </tr>
</table>

---

## 🧪 Testing (On-chain & Offline)

Test otomatis berjalan di **Sepolia testnet** dan berhenti dengan aman jika wallet belum cukup dana:

```bash
npm test
# atau
node onchain-test.js
```

RPC default dibaca dari `network/config.json`. Untuk override sementara:

```bash
TEST_RPC_URL=https://your-sepolia-rpc.example TEST_PRIVATE_KEY=0x... npm test
```

Cakupan test:

- **Offline** — compile seluruh source rescue, batch, airdrop claimer, approval revoker, UUPS proxy, ERC-721, ERC-1155, mock receiver, dan seluruh kombinasi ERC-20.
- **Read-only** — validasi chain ID Sepolia, block terbaru, gas fee, dan harga ETH.
- **On-chain** — transfer ETH/token, deploy ERC-20, managed/roles/pausable/burnable/permit/callback/flash minting, Batch Call + EIP-7702 delegation, Rescue ETH/ERC-20/ERC-721, Revoke Delegation, Claim Airdrop, ERC-1155, dan UUPS proxy upgrade.

Hasil uji terakhir (Sepolia): **35 PASS / 0 FAIL / 0 SKIP** — termasuk verifikasi delegasi EIP-7702 (`0xef0100…`) dan revoke kembali ke EOA.

### Wallet test

Jangan pernah memasukkan private key utama. Gunakan wallet test baru dan simpan private key di `test-wallet.json` (sudah di-`gitignore`) atau environment variable `TEST_PRIVATE_KEY`.

Kirim minimal `0.05 Sepolia ETH`; disarankan `0.08–0.1 ETH` agar seluruh deployment dan retry memiliki gas cukup. Faucet: [Google Cloud Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) / [sepoliafaucet.com](https://sepoliafaucet.com).

Address wallet test harus dicetak oleh runner test—jangan menaruh private key di README. Hasil test tersimpan di `test-report.json` (juga di-`gitignore`) dengan status PASS/FAIL/SKIP.

---

## ❓ FAQ

**Q: Apakah tool ini aman digunakan di mainnet?**

A: Ya, dengan catatan:
- Selalu perhatikan warning konfirmasi sebelum transaksi
- Gunakan RPC berbayar (Alchemy/QuickNode)
- Jangan share private key

**Q: Bagaimana cara backup wallet?**

A: Wallet tersimpan di `~/.wallet-cli/wallets/`. Backup folder ini.

**Q: Apakah support hardware wallet (Ledger/Trezor)?**

A: Belum. Saat ini hanya support software wallet (JSON keystore).

**Q: Kenapa transaksi gagal di mainnet?**

A: Kemungkinan:
- RPC publik rate-limited → Ganti ke RPC berbayar
- Gas fee tidak cukup → Cek saldo
- EIP-7702 tidak didukung → Cek RPC provider

**Q: Bagaimana cara revoke approval?**

A: Pilih menu `18. Approval Manager`, pilih wallet, lalu pilih approval yang mau di-revoke.

**Q: Berapa banyak token yang di-scan di Approval Manager?**

A: Saat ini 19 token populer (USDT, USDC, DAI, WETH, dll). Bisa ditambah jika diperlukan.

**Q: Apakah support multiple chain?**

A: Ya! Support Ethereum Mainnet, Sepolia, Arbitrum, Optimism, Base, Polygon, BSC, dan custom network.

---

## 🔧 Troubleshooting

| Error | Solusi |
|-------|--------|
| `RPC provider does not support EIP-7702` | Ganti RPC provider ke Alchemy/QuickNode |
| `Insufficient funds for gas` | Pastikan wallet memiliki saldo ETH yang cukup |
| `Transaction nonce too low` | Tunggu beberapa detik, lalu coba lagi |
| `Solver CryptoNight belum tersedia` | Jalankan `npm install @leocuvee/cryptonight-hashing` |
| `Password salah atau file wallet rusak` | Cek password, atau buat wallet baru |
| `Session tidak ditemukan` | Session sudah expired, buat session baru |
| `Allocation failed` | Tidak ada token yang di-approval ke wallet ini |

---

## 📝 Changelog

### v3.2.0
- ✅ **Fixed:** Approval Manager kini scan approval nyata via event log `Approval` + verifikasi `allowance()` per spender (sebelumnya hanya cek allowance ke alamat nol sehingga tidak pernah menemukan approval)
- ✅ **Added:** Mode Sponsor Revoke via EIP-7702 atomic dengan kontrak `approvalRevoker` (sponsor bayar gas, revoke dieksekusi sebagai owner)
- ✅ **Fixed:** Rentang scan adaptif untuk RPC publik yang membatasi `eth_getLogs`
- ✅ **Fixed:** Duplikat alamat token FIL (= CRV) dihapus dari daftar scan
- ✅ **Fixed:** Mining PoW tidak lagi melakukan HTTP request setiap hash (status di-poll tiap 3 detik)
- ✅ **Fixed:** Kontrak deploy tersimpan per chainId; reuse kontrak batch kini memverifikasi deployer
- ✅ **Fixed:** Flash loan ERC-3156 mengirim alamat token yang benar ke callback
- ✅ **Fixed:** Verifikasi Blockscout menggunakan endpoint `verifysourcecode` + polling status
- ✅ **Fixed:** ERC-721/1155 template mendukung ERC-165; NFT token ID pakai BigInt
- ✅ **Changed:** Estimasi gas dinamis pada transaksi delegasi EIP-7702
- ✅ **Changed:** Config default aktif kembali ke Sepolia testnet

### v3.1.0 (2024-XX-XX)
- ✅ **Added:** Approval Manager (revoke ERC-20 approvals)
- ✅ **Added:** Mainnet Safety Features (warning, RPC recommendation)
- ✅ **Fixed:** Mining display text overlap

### v3.0.0
- ✅ Initial release
- ✅ Wallet management
- ✅ Send ETH/Token
- ✅ EIP-7702 operations
- ✅ Batch Call
- ✅ Rescue Assets
- ✅ Mining POW
- ✅ Wizard Deploy

---

## 💝 Donate

Dukung pengembangan tool ini:

**Ethereum / Sepolia:** `0x5e02fac179dfbd8a63fa7058011b348fdbba7158`

Terima kasih! 🙏

---

## 📜 Lisensi

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

---

<p align="center">
  <b>Dibuat dengan ❤️ dan ☕</b><br>
  <img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&size=22&pause=1000&color=00FF00&center=true&vCenter=true&width=500&lines=Selamat+menggunakan+EIP-7702+Tool!;Semoga+bermanfaat+untuk+Ethereum" alt="Typing SVG" />
</p>
