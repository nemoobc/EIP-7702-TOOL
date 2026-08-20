<!-- PROJECT SHIELDS -->
<p align="center">
  <a href="https://github.com/nemoobc/EIP-7702-TOOL">
    <img src="https://img.shields.io/badge/Version-3.0.0-brightgreen?style=for-the-badge&logo=github" alt="Version">
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

<h1 align="center">
  <img src="https://media.giphy.com/media/hvRJCLFzcasrR4ia7z/giphy.gif" width="30px">
  EIP-7702 TOOL
  <img src="https://media.giphy.com/media/hvRJCLFzcasrR4ia7z/giphy.gif" width="30px">
</h1>

<p align="center">
  <b>✨ Wallet CLI & EIP-7702 Toolkit ✨</b><br>
  <i>Create wallet, import, export, send ETH/token, batch call, rescue assets, revoke delegation, claim airdrop, auto-verify Sourcify</i>
</p>

<p align="center">
  <img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&size=24&pause=1000&color=F7B93E&center=true&vCenter=true&width=700&lines=Full+Animasi+Warna-warni;EIP-7702+Tool;Wallet+CLI+interaktif;Node.js+%2B+Viem+%2B+Ethers;Auto-verify+Sourcify" alt="Typing SVG" />
</p>

---

## 📖 Deskripsi Proyek

**EIP-7702 Tool** adalah aplikasi Command Line Interface (CLI) interaktif berbasis Node.js untuk membantu pengguna memanfaatkan standar **EIP-7702** di jaringan Ethereum. Tool ini menggabungkan manajemen wallet dan operasi EIP-7702 dalam satu antarmuka penuh warna.

Dengan EIP-7702, sebuah Externally Owned Account (EOA) dapat didelegasikan sementara ke alamat kontrak implementasi, memungkinkan eksekusi kode kontrak atas nama akun tersebut. Tool ini menyediakan cara sederhana untuk delegasi, revoke, batch call, rescue aset (ETH, ERC-20, ERC-721), dan klaim airdrop secara atomik.

---

## 🚀 Fitur Utama

<div align="center">
  <table border="1" cellpadding="8" cellspacing="0" style="border-collapse: collapse; border-color: #4CAF50; width: 90%;">
    <tr align="center">
      <th style="background-color: #4CAF50; color: white;">Fitur</th>
      <th style="background-color: #4CAF50; color: white;">Deskripsi</th>
    </tr>
    <tr align="center">
      <td>🧾 <b>Wallet Management</b></td>
      <td>Buat, import, list, export, delete, change wallet default.</td>
    </tr>
    <tr align="center">
      <td>💸 <b>Send ETH</b></td>
      <td>Kirim ETH dengan auto-detect saldo, mode manual & kirim max, input ETH atau USD (auto konversi).</td>
    </tr>
    <tr align="center">
      <td>🪙 <b>Send Token</b></td>
      <td>Kirim ERC-20 dengan auto-detect saldo, mode manual & kirim max.</td>
    </tr>
    <tr align="center">
      <td>🧪 <b>EIP-7702</b></td>
      <td>Delegasikan EOA, batalkan delegasi, rescue assets.</td>
    </tr>
    <tr align="center">
      <td>🧩 <b>Batch Call</b></td>
      <td>Deploy kontrak <code>batch</code>, hanya wallet deployer yang bisa mengeksekusi batch call.</td>
    </tr>
    <tr align="center">
      <td>🛟 <b>Rescue Atomic</b></td>
      <td>Deploy kontrak <code>rescue</code> dengan <code>RESCUER</code>, hanya wallet sponsor yang bisa memanggil rescue. Sponsor membayar gas, target hanya tanda tangan authorization.</td>
    </tr>
    <tr align="center">
      <td>🔄 <b>Revoke Delegation</b></td>
      <td>Batalkan delegasi EIP-7702, sponsor membayar gas, auto-detect saldo sponsor.</td>
    </tr>
    <tr align="center">
      <td>🎁 <b>Claim Airdrop (Delegation)</b></td>
      <td>Klaim airdrop via EIP-7702 dengan sponsor, reward otomatis dikirim ke SAFE.</td>
    </tr>
    <tr align="center">
      <td>✅ <b>Auto-Verify Sourcify</b></td>
      <td>Deploy otomatis diverifikasi ke Sourcify (gratis, tanpa API key).</td>
    </tr>
    <tr align="center">
      <td>🌐 <b>Change Network</b></td>
      <td>Pilih, tambah, hapus network RPC secara interaktif, auto-deteksi chain ID.</td>
    </tr>
    <tr align="center">
      <td>ℹ️ <b>Info Wallet</b></td>
      <td>Lihat saldo, nonce, kode akun, dan perkiraan authorization nonce.</td>
    </tr>
    <tr align="center">
      <td>🧙 <b>Wizard Deploy</b></td>
      <td>Buat & deploy kontrak ERC-20 (Mint/Burn/Pause/Roles/Permit/Flash, UUPS), ERC-721, ERC-1155 dari template.</td>
    </tr>
    <tr align="center">
      <td>⛽ <b>Gas Fee</b></td>
      <td>Cek estimasi gas fee & ubah kecepatan default gas (slow/normal/fast/auto/manual).</td>
    </tr>
    <tr align="center">
      <td>⛏️ <b>Mining POW</b></td>
      <td>Claim ETH via PoW mining (PK910 Sepolia Faucet). Auto-delegate EIP-7702 setelah claim. Checkpoint claim di 0.05 ETH.</td>
    </tr>
  </table>
</div>

---

## ⚙️ Instalasi

```bash
git clone https://github.com/nemoobc/EIP-7702-TOOL.git
cd EIP-7702-TOOL
npm install
```

Dependencies: `ethers` v6, `viem` v2, `chalk` v4, `ora` v5, `solc` v0.8.20

---

## 🖥️ Cara Pakai

Jalankan:

```bash
node EIP-7702-TOOL.js
```

Menu interaktif:

```text
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
│ 0. Exit                                  │
└──────────────────────────────────────────┘
```

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

- **Offline** — compile seluruh source rescue, batch, airdrop claimer, UUPS proxy, ERC-721, ERC-1155, mock receiver, dan seluruh kombinasi ERC-20.
- **Read-only** — validasi chain ID Sepolia, block terbaru, gas fee, dan harga ETH.
- **On-chain** — transfer ETH/token, deploy ERC-20, managed/roles/pausable/burnable/permit/callback/flash minting, Batch Call + EIP-7702 delegation, Rescue ETH/ERC-20/ERC-721, Revoke Delegation, Claim Airdrop, ERC-1155, dan UUPS proxy upgrade.

### Wallet test

Jangan pernah memasukkan private key utama. Gunakan wallet test baru dan simpan private key di `test-wallet.json` (sudah di-`gitignore`) atau environment variable `TEST_PRIVATE_KEY`.

Kirim minimal `0.05 Sepolia ETH`; disarankan `0.08–0.1 ETH` agar seluruh deployment dan retry memiliki gas cukup. Faucet: [Google Cloud Faucet](https://cloud.google.com/application/web3/faucet/ethereum/sepolia) / [sepoliafaucet.com](https://sepoliafaucet.com).

Address wallet test harus dicetak oleh runner test—jangan menaruh private key di README. Hasil test tersimpan di `test-report.json` (juga di-`gitignore`) dengan status PASS/FAIL/SKIP.

---

## ⛏️ Mining POW (PK910 Sepolia Faucet)

Tool menyediakan fitur **Mining POW** untuk claim ETH via PoW mining dari **PK910 Sepolia Faucet**. CAPTCHA tetap harus diperoleh melalui flow resmi PK910; tool ini hanya menjalankan PoW dan claim setelah session/token yang sah tersedia.

### Cara Pakai

**Session baru:**
1. Pilih menu `17. Mining POW`
2. Pilih `1) Session baru (butuh CAPTCHA token)`
3. Masukkan CAPTCHA token dari website PK910
4. Mining akan dimulai secara otomatis

**Resume session:**
1. Pilih menu `17. Mining POW`
2. Pilih `2) Resume session (session ID)`
3. Masukkan session ID yang tersimpan

### Fitur
- Mining dengan algoritma CryptoNight
- Checkpoint claim di **0.05 ETH** (opsi claim atau lanjut mining)
- Target default **2.5 ETH** (maksimal dari PK910)
- Auto-delegate EIP-7702 setelah claim
- Tampilan real-time: hashrate, nonce, balance, shares

### Catatan
- Solver CryptoNight dipasang sebagai optional dependency native
- Jalankan `npm install --include=optional` dan pastikan toolchain `node-gyp` tersedia
- Dependency berlisensi GPL-3.0-or-later; periksa kewajiban lisensi sebelum distribusi
- Client tidak melakukan bypass CAPTCHA, rate-limit, atau anti-bot PK910

---

## 💝 Donate

Dukung pengembangan tool ini:

**Ethereum / Sepolia:** `0x5e02fac179dfbd8a63fa7058011b348fdbba7158`

Terima kasih! 🙏

---

## ⚠️ Catatan Penting

- Jangan bagikan private key atau mnemonic.
- Gunakan hanya di **Sepolia testnet** untuk testing.
- Selalu buat wallet baru untuk testing, jangan gunakan wallet utama.
- Pastikan wallet sponsor memiliki cukup ETH untuk gas.
- Beberapa RPC publik mungkin tidak mendukung transaksi `type: 4`. Gunakan RPC berbayar seperti Alchemy/QuickNode jika perlu.
- Simpan kestore wallet di folder `wallets/` (privat).

---

## 📜 Lisensi

Proyek ini menggunakan lisensi **MIT**.

<p align="center">
  <b>Dibuat dengan ❤️ dan ☕</b><br>
  <img src="https://readme-typing-svg.herokuapp.com?font=Fira+Code&size=22&pause=1000&color=00FF00&center=true&vCenter=true&width=500&lines=Selamat+menggunakan+EIP-7702+Tool!;Semoga+bermanfaat+untuk+Ethereum" alt="Footer Typing SVG" />
</p>
