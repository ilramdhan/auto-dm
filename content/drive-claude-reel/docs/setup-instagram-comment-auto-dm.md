# Setup Auto-DM dari Komentar Instagram (Keyword: DRIVE)

Panduan praktis untuk Reel **"Cara merapikan Google Drive dengan Claude"** oleh Ilham Ramadhan ([@ilramadhan_](https://www.instagram.com/ilramadhan_/) · [ilramdhan.dev](https://ilramdhan.dev/)).

CTA: **komen `DRIVE` -> otomatis dapat prompt lengkap lewat DM.**

> Catatan verifikasi (dicek Oktober 2026): sebagian besar sumber yang tersedia adalah blog pihak ketiga, bukan dokumentasi resmi Meta/ManyChat (halaman resmi tidak bisa dibuka saat riset). Angka harga, batas kontak, dan menu bisa berubah. **Cek ulang di halaman resmi sebelum bayar atau mengandalkan angka tertentu.** Bagian yang belum terkonfirmasi ditandai [cek ulang].

---

## 1. Ringkasan alur

```
Viewer komen "DRIVE" di Reel
        |
        v
Tool otomasi mendeteksi keyword (via Instagram API)
        |
        +--> (a) Balas komentar publik (variasi acak)
        |
        +--> (b) Kirim DM pembuka + tombol "Kirim prompt"
                      |
                      v  (viewer tap tombol = balas, membuka jendela 24 jam)
                 (c) DM final: intro + link/prompt lengkap
```

Aturan Meta yang membentuk alur ini:

- **Private reply**: akun Professional boleh mengirim **satu** pesan ke orang yang berkomentar (post, Reel, live), **maksimal 7 hari** setelah komentar dibuat.
- Pesan lanjutan baru boleh dikirim kalau orangnya **membalas/menekan tombol** dulu, dan hanya di dalam **jendela 24 jam** sejak interaksi terakhirnya. Di luar itu muncul error (kode 10).
- Karena itu desain terbaiknya: **DM pembuka singkat + tombol**, baru isi utama setelah tombol ditekan.

---

## 2. Prasyarat akun

1. Akun Instagram **Professional** (Creator atau Business). Akun personal tidak bisa dihubungkan. Ganti di: Profil -> Settings and activity -> Account type and tools -> Switch to professional account.
2. **Facebook Page tertaut**: beberapa sumber menyebut ManyChat membutuhkan Page yang terhubung ke akun IG [cek ulang di dokumentasi ManyChat; kalau diminta, buat Page kosong dan tautkan].
3. Aktifkan **Allow access to messages**:
   Settings and activity -> Messages and story replies -> Message controls -> **Connected tools** -> nyalakan *Allow access to messages*.
   Kalau mati, otomasi akan "tuli": flow terlihat benar tapi tidak ada DM yang terkirim.
4. Reel harus **publik** (bukan Close Friends / akun private).
5. Kalau tombol connect hanya menampilkan "Request Sent", akun kemungkinan sudah terhubung ke workspace ManyChat lain.

---

## 3. Opsi A: ManyChat (rekomendasi)

### Harga & batas (cek ulang di manychat.com/pricing)

- Beberapa sumber 2026 melaporkan perubahan harga pada **2 Maret 2026**: paket **Free turun dari 1.000 menjadi sekitar 25 kontak**. Sumber lama masih menulis 1.000. Anggap 25 sebagai angka terbaru, tapi verifikasi.
- Perkiraan paket berbayar (tagihan tahunan, dari sumber pihak ketiga): Essential ~US$14/bln (250 kontak), Pro mulai ~US$15/bln (500 kontak), Business ~US$69/bln, Advanced ~US$139/bln. Kelebihan kontak kena biaya overage; fitur AI add-on terpisah.
- Satu moderator komunitas ManyChat menyebut trigger komentar post/Reel adalah fitur **Pro** [cek ulang]. Jadi jangan berharap Free cukup untuk Reel yang viral.

### Langkah demi langkah

1. **Daftar** di manychat.com dan pilih channel **Instagram**.
2. **Connect Instagram**: login, pilih akun `@ilramadhan_`, izinkan semua permission yang diminta.
3. Buka **Automations -> New Automation**. Cari template **"Auto DM links from comments"** (atau "Auto-reply to comment in DM"). Nama template bisa berbeda; kalau tidak ada, pilih *Start from scratch*.
4. **Trigger**: pilih *Instagram -> Post or Reel Comments* -> **Specific Post or Reel** -> pilih Reel "Cara merapikan Google Drive dengan Claude".
5. **Keyword**: pilih *comment contains* dan masukkan:
   ```
   DRIVE
   drive
   Drive
   DRIVE 🙏
   ```
   Beberapa sumber menyebut keyword ManyChat tidak case-sensitive, jadi variasi huruf mungkin redundan; tetap tambahkan variasi dengan emoji/typo (`drive`, `DRIVEE`). Gunakan "contains" supaya "DRIVE kak" tetap kena.
6. **Public reply**: aktifkan *Reply to comment* dan masukkan beberapa variasi (lihat bagian copy di bawah) agar tidak terlihat seperti spam.
7. **Opening DM** dengan tombol **"Kirim prompt"** (lihat copy). Tombol = respons user, sehingga jendela 24 jam terbuka dan deliverability naik.
8. **Final DM**: dikirim setelah tombol ditekan (lihat copy).
9. **Follow-gate (opsional)**: tambah kondisi "apakah user follow?"; kalau belum, minta follow lalu tombol "Sudah follow". 
   - Plus: menambah follower.
   - Minus: gesekan lebih tinggi (conversion turun), pengecekan follow tidak selalu andal, dan Meta/komunitas kurang menyukai "gate" yang terasa memaksa. Saya tidak menemukan konfirmasi fitur follow-gate bawaan ManyChat di sumber yang tersedia [cek ulang]. Rekomendasi: **jangan pakai gate di awal**; cukup ajakan follow halus di DM final.
10. **Set Live**, lalu lakukan testing (bagian 5).

### Batas panjang DM

Dokumentasi Meta (via kutipan pihak ketiga): teks DM harus **kurang dari 1.000 karakter** dan juga disebut **maks 1.000 byte UTF-8**. Emoji dan huruf beraksen memakan lebih banyak byte. Prompt lengkap di repo ini jauh lebih panjang dari itu (sekitar 2.500+ karakter), jadi pilih salah satu:

- **Rekomendasi: kirim link** ke halaman yang menghosting prompt, mis. `https://ilramdhan.dev/prompt/drive` (atau GitHub Gist). Mudah di-update tanpa edit flow.
- Alternatif: pecah menjadi 3-4 pesan berurutan, masing-masing di bawah ~800 karakter (sisakan margin untuk emoji). Pesan terpisah bisa tiba tidak berurutan; beri penomoran "1/4".
- Teks dan lampiran dikirim sebagai pesan terpisah (batasan API).

### Copy siap tempel

**Public reply (acak, pilih 3-5 variasi):**
```
Sip, udah aku kirim ke DM ya! Cek inbox kamu 📩
```
```
Done! Prompt-nya meluncur ke DM kamu 🚀
```
```
Makasih udah komen! Cek DM-mu ya, prompt lengkapnya ada di sana 🙌
```
```
Udah masuk ke DM! Kalau belum muncul, cek tab Message Requests ya 👀
```
```
Terkirim! Selamat merapikan Drive-nya 😄 Cek DM kamu.
```

**Opening DM (dengan tombol):**
```
Halo {{first_name}}! 👋
Makasih udah komen DRIVE. Aku Ilham, yang bikin Reel "Cara merapikan Google Drive dengan Claude".

Tap tombol di bawah, nanti prompt lengkapnya langsung aku kirim.
```
Tombol: `Kirim prompt`

**Final DM (versi link, aman di bawah 1.000 karakter):**
```
Ini dia prompt lengkapnya 👇
https://ilramdhan.dev/prompt/drive

Cara pakai:
1. Buka drive.google.com di Chrome
2. Buka Claude in Chrome (side panel), pastikan Google Drive connector sudah terhubung
3. Paste prompt, lalu ikuti 3 fase: Audit -> Plan -> Execute

⚠️ Claude akan berhenti dulu di fase Plan sampai kamu balas "APPROVED", dan tidak akan menghapus apa pun.

Kalau berguna, follow @ilramadhan_ buat tips AI & dev lainnya 🙌
```

**Final DM (versi singkat untuk dipakai di video, jika dikirim langsung, di bawah 1.000 karakter):**
```
Hi Claude, review this Drive/folder recursively down to the deepest file.
1. Suggest a folder structure based on my files.
2. Flag possible duplicates & anything you can't identify.
3. Show me the plan BEFORE moving anything.
⚠ DON'T DELETE ANYTHING. Ask me if you have questions.
Use sub-agents: Sonnet for easy tasks, Opus for medium-heavy tasks
to save tokens & context.
```
Versi lengkap ada di `prompts/drive-organizer-prompt.md`; hosting di halaman web lalu kirim link.

---

## 4. Opsi B: Tool native Meta & Opsi C: alternatif

### Opsi B: Meta Business Suite -> Inbox -> Automations (native, gratis)

Beberapa sumber 2026 menyebut Meta Business Suite punya fitur komentar-ke-DM bawaan di **Inbox -> Automations** (versi desktop): pilih post, isi trigger, tulis DM. Hal yang saya temukan:

- Gratis, tapi lebih sederhana (tanpa flow bercabang, tanpa tombol bertahap).
- Sumber bertentangan soal jumlah keyword (ada yang bilang 5 case-sensitive, ada yang 10) dan apakah memicu hashtag atau keyword [cek ulang dan uji sendiri].
- Beberapa sumber menyebut keyword automation baru terkirim setelah ~15 menit kecuali kamu membalas manual terlebih dahulu [cek ulang].
- Tidak ditemukan konfirmasi fitur serupa di aplikasi Instagram mobile; satu sumber bahkan menyebut Instagram tidak punya auto-reply komentar bawaan. Anggap tersedia lewat Business Suite desktop saja, dan itu pun harus diverifikasi di akunmu.

Cocok sebagai percobaan gratis. Untuk kontrol penuh (tombol, variasi reply, analitik) tetap ManyChat.

### Opsi C: alternatif

- **LinkDM, CreatorFlow, InstantDM, dan sejenisnya**: tool khusus comment-to-DM, biasanya lebih murah/simpel daripada ManyChat. Cek harga dan kebijakan masing-masing.
- **Zapier / Make + Instagram Graph API**: kontrol penuh, tapi perlu Meta App, review permission, dan pengerjaan teknis. Cocok bagi developer; overkill untuk satu Reel.

---

## 5. Testing checklist

- [ ] Pakai **akun kedua** (bukan akun yang sama; komentar dari akun sendiri sering diabaikan).
- [ ] Komen `DRIVE`, lalu `drive` dan `DRIVE 🙏`; semuanya harus memicu.
- [ ] Balasan publik muncul di bawah komentar.
- [ ] DM pembuka masuk. Kalau akun penguji tidak mengikuti kamu, cek **Message Requests** (Requests/Spam) di inbox-nya.
- [ ] Tap tombol "Kirim prompt" -> final DM tiba.
- [ ] Link bisa dibuka dan teks tidak terpotong.
- [ ] Coba tap tombol setelah >24 jam; pahami bahwa pesan bisa gagal (error window).
- [ ] Cek *Allow access to messages* masih menyala bila tidak ada yang terkirim, dan coba reconnect IG di ManyChat.
- [ ] Pastikan flow berstatus **Live**, bukan Draft.

---

## 6. Tips anti-spam & best practice

- **Variasikan public reply** (3-5 kalimat) dan jangan kirim teks identik ratusan kali.
- Batas kecepatan: sumber berbeda pendapat. Satu menyebut plafon sekitar 750 private reply/jam, yang lain bilang Meta tidak mempublikasikan batas DM per jam dan angka 200/jam hanyalah kebiasaan tool [belum terkonfirmasi]. Untuk Reel yang meledak, biarkan tool mengantre dan jangan paksa.
- Satu private reply per komentar, maksimal 7 hari setelah komentar.
- Jangan DM pembuka yang terlalu promosi; mulai dengan sapaan + manfaat.
- **Tulis keyword di caption, video (teks di layar), dan pinned comment** supaya orang tahu persis apa yang diketik.
- **Ganti keyword per konten** (mis. `DRIVE`, `NOTION`, `CV`) agar konten mudah dilacak dan tidak bentrok antar flow.
- Jangan minta data sensitif lewat DM otomatis.
- Pantau analitik beberapa hari pertama; kalau banyak DM tidak terkirim, periksa permission dan window 24 jam.

---

## 7. Caption & pinned comment

**Caption Reel:**
```
Google Drive-mu berantakan? Biar Claude yang rapikan, tanpa ada file yang dihapus 🗂️

Caranya:
1️⃣ Buka Drive di Chrome + aktifkan Claude in Chrome & Google Drive connector
2️⃣ Paste prompt-nya, Claude audit semua folder & tandai duplikat
3️⃣ Review rencananya, balas "APPROVED", baru Claude pindahkan file

👇 Mau prompt lengkapnya?
Komen "DRIVE" di sini, nanti aku kirim langsung ke DM kamu 📩
(Kalau belum masuk, cek Message Requests ya)

#googledrive #claude #claudeai #aitools #produktivitas #tipsproduktif #belajarai #fullstackdeveloper #developerindonesia #otomasi #tipsteknologi #workflow
```

**Pinned comment:**
```
Komen "DRIVE" di sini ya, prompt lengkapnya otomatis meluncur ke DM kamu 📩 Kalau belum muncul, cek Message Requests 🙌
```

---

## Sumber

Catatan: sebagian besar adalah blog/vendor pihak ketiga; verifikasi ke dokumentasi resmi.

- [Meta: Private Replies (Instagram Messaging)](https://developers.facebook.com/documentation/business-messaging/instagram-messaging/features/private-replies)
- [ManyChat pricing 2026 (Chatarmin)](https://chatarmin.com/en/blog/manychat-pricing)
- [ManyChat Review 2026 (Featurebase)](https://www.featurebase.app/blog/manychat-review)
- [ManyChat Free Plan 2026 (Costbench)](https://costbench.com/software/ai-chatbot-platforms/manychat/free-plan/)
- [ManyChat pricing 2026 (DEV Community)](https://dev.to/sakthivel_instantdm/manychat-pricing-2026-real-costs-5-honest-alternatives-with-math-4d74)
- [ManyChat for Instagram: setup and rules (Kanal)](https://getkanal.com/blog/manychat-instagram)
- [ManyChat automation not working 2026 (InstantDM)](https://instantdm.com/blog/manychat-automation-not-working-2026)
- [Setting up ManyChat comment automation](https://support.coffeecontracts.com/en/articles/9822109-how-to-set-up-a-comment-automation-on-instagram-with-manychat)
- [Instagram DM automation (Buffer)](https://buffer.com/resources/instagram-dm-automation/)
- [Instagram built-in automation (CreatorFlow)](https://creatorflow.so/blog/instagram-built-in-automation/)
- [Instagram auto reply (CreatorFlow)](https://creatorflow.so/blog/instagram-auto-reply/)
- [Instagram 24-hour reply window (CreatorFlow)](https://creatorflow.so/blog/instagram-24-hour-messaging-window-error-10/)
- [Understanding comment reply limitations (ChatDaddy)](https://help.chatdaddy.tech/article/understanding-comment-reply-limitations-on-instagram-and-messenger-chatdaddy)
- [Instagram DM limits 2026 (Inro)](https://inro.social/blog/how-many-direct-messages-can-you-send-on-instagram)
- [Instagram Messaging limitations (ContentStudio)](https://docs.contentstudio.io/article/880-social-inbox-platform-limitations)
- [Instagram comment automation API safe guide (Rocket)](https://www.rocket.new/blog/instagram-comment-automation-api-safe-guide)
