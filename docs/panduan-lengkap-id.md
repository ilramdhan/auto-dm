# Panduan Lengkap (Bahasa Indonesia)

Dari nol sampai komentar "DRIVE" otomatis dibalas + dikirim DM. Estimasi waktu: 30–60 menit
(belum termasuk menunggu App Review Meta).

> Versi Inggris per topik: [deployment.md](deployment.md) · [meta-setup.md](meta-setup.md) ·
> [n8n.md](n8n.md) · [troubleshooting.md](troubleshooting.md)

### Urutan langkah (centang satu per satu)

| #   | Langkah                | Di mana                 | Tanda berhasil                                    |
| --- | ---------------------- | ----------------------- | ------------------------------------------------- |
| 1   | Buat database          | Supabase                | Punya 2 connection string                         |
| 2   | Buat 2 secret          | Terminal                | Punya `APP_SECRET` dan `CRON_SECRET`              |
| 3   | Deploy app             | Vercel                  | Log build: `[migrate] Database is up to date.`    |
| 4   | Login pertama + cek    | Browser / app           | `/api/health` → `ok`, password sudah diganti      |
| 5   | Siapkan akun Instagram | App Instagram           | Akun Professional, akses pesan ON                 |
| 6   | Buat app Meta          | developers.facebook.com | App ID + Secret tersimpan di Settings → Instagram |
| 7   | Connect Instagram      | App                     | Username tampil di Settings                       |
| 8   | Pasang webhook         | Meta                    | "Verify and save" berhasil                        |
| 9   | Buat campaign & aturan | App                     | "Test a comment" cocok                            |
| 10  | Tes nyata, lalu Live   | Instagram / Meta        | Activity: **Sent**                                |
| 11  | (Opsional) n8n         | n8n                     | Executions hijau                                  |

**n8n itu opsional.** Jangan mulai dari n8n. Selesaikan langkah 1–10 dengan webhook langsung dulu;
kalau sudah jalan, baru tambahkan n8n bila ingin notifikasi Telegram/Sheets dsb.

---

## 0. Yang dibutuhkan

| Kebutuhan                                          | Gratis? | Dipakai untuk                                                              |
| -------------------------------------------------- | ------- | -------------------------------------------------------------------------- |
| Akun **GitHub** (fork/clone repo ini)              | ✅      | Sumber kode untuk Vercel                                                   |
| Akun **Vercel** (Hobby)                            | ✅      | Menjalankan aplikasi + cron harian                                         |
| Akun **Supabase** (Free)                           | ✅      | Database Postgres                                                          |
| Akun **Meta for Developers**                       | ✅      | App Instagram (API + webhook)                                              |
| Akun **Instagram Professional** (Creator/Business) | ✅      | Akun yang dibalas komentarnya                                              |
| **n8n** self-hosted (opsional)                     | ✅      | Hanya jika ingin menambah alur sendiri (notifikasi Telegram, Sheets, dll.) |

**Tidak butuh API key AI apa pun.** Pencocokan keyword dan balasan semuanya berbasis aturan yang
kamu tulis di dashboard. Tidak ada biaya per kontak; batasannya dari Meta (lihat bagian 10).

### Ringkasan semua "kunci" dan di mana diisi

| Nama                                  | Dibuat di                                               | Diisi di                                      | Keterangan                                              |
| ------------------------------------- | ------------------------------------------------------- | --------------------------------------------- | ------------------------------------------------------- |
| `DATABASE_URL`                        | Supabase → Connect → **Transaction pooler** (port 6543) | Vercel → Environment Variables                | Wajib                                                   |
| `DATABASE_URL_UNPOOLED`               | Supabase → Connect → **Session pooler** (port 5432)     | Vercel → Environment Variables                | Wajib di Vercel, untuk migrasi saat build               |
| `APP_SECRET`                          | Kamu generate (`openssl rand -base64 48`)               | Vercel → Environment Variables                | Wajib. **Simpan baik-baik**, jangan diganti             |
| `CRON_SECRET`                         | Kamu generate (`openssl rand -hex 32`)                  | Vercel → Environment Variables                | Wajib di production (refresh token harian)              |
| `ADMIN_DEFAULT_PASSWORD`              | Kamu tentukan (opsional)                                | Vercel → Environment Variables                | Default `changeme123`, wajib diganti saat login pertama |
| Instagram **App ID** & **App Secret** | Meta → Instagram → API setup with Instagram login       | **Dashboard app → Settings → Instagram**      | Bukan di Vercel. Secret disimpan terenkripsi            |
| **Verify token** webhook              | Dibuat otomatis oleh app                                | Disalin dari **Settings → Instagram** ke Meta | —                                                       |
| **API key n8n** (`ard_…`)             | **Settings → n8n → Create key**                         | Credential "Header Auth" di n8n               | Hanya untuk mode n8n                                    |

---

## 1. Supabase (database)

1. Buka <https://supabase.com> → **New project**. Region: **Southeast Asia (Singapore)**.
   Simpan **database password** yang kamu buat.
2. Setelah project siap, klik **Connect** (tombol di atas) → tab **Connection string** → **URI**.
3. Salin dua URL berikut dan ganti `[YOUR-PASSWORD]` dengan password database:
   - **Transaction pooler** (host `…pooler.supabase.com`, port **6543**) → nanti jadi `DATABASE_URL`.
   - **Session pooler** (host `…pooler.supabase.com`, port **5432**) → nanti jadi `DATABASE_URL_UNPOOLED`.

   > Jangan pakai "Direct connection" (`db.<ref>.supabase.co`) untuk Vercel: di paket gratis
   > alamat itu hanya IPv6, sedangkan server build Vercel memakai IPv4 → migrasi gagal.

   Jika password database mengandung `@ : / ? #` atau spasi, ubah ke bentuk URL-encoded
   (mis. `@` → `%40`), atau pakai password berisi huruf dan angka saja.

4. **Tidak perlu menjalankan SQL apa pun.** Tabel dibuat otomatis saat Vercel build
   (`scripts/migrate.ts` jalan sebelum `next build`). Row Level Security juga otomatis aktif.

   **Sudah terlanjur menjalankan `0000`, `0001`, `0002` manual di SQL Editor?** Tidak apa-apa, tidak
   perlu dihapus. Saat build berikutnya app mendeteksinya, menandainya sebagai sudah diterapkan, dan
   lanjut. Di log build akan muncul
   `[migrate] Found tables created by hand; marked as applied: …` lalu `Database is up to date.`
   Langkah selanjutnya tetap sama: lanjut ke bagian 2 dan 3 (deploy Vercel).

## 2. Buat secret

Di Terminal (Mac/Linux):

```bash
openssl rand -base64 48   # -> APP_SECRET
openssl rand -hex 32      # -> CRON_SECRET
```

Di Windows (atau di mana saja yang ada Node.js):

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64'))"   # APP_SECRET
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"      # CRON_SECRET
```

Simpan `APP_SECRET` di password manager. Kalau hilang/diganti: semua login ter-logout dan secret
yang tersimpan (App Secret Meta, token Instagram) tidak bisa dibaca lagi → harus diisi ulang dan
Instagram di-connect ulang.

## 3. Deploy ke Vercel

1. Fork repo ini ke GitHub kamu (atau pakai repo ini langsung).
2. <https://vercel.com/new> → **Import** repo → Framework otomatis **Next.js**. Biarkan Build
   Command default (memakai script `build` di `package.json`, yang menjalankan migrasi lalu build).
3. Buka **Environment Variables**, isi:

   | Key                     | Value                           |
   | ----------------------- | ------------------------------- |
   | `DATABASE_URL`          | Transaction pooler URL (6543)   |
   | `DATABASE_URL_UNPOOLED` | Session pooler URL (5432)       |
   | `APP_SECRET`            | hasil `openssl rand -base64 48` |
   | `CRON_SECRET`           | hasil `openssl rand -hex 32`    |

   `APP_URL` tidak perlu diisi; otomatis memakai domain production Vercel. Isi hanya jika memakai
   custom domain (mis. `https://autodm.ilramdhan.dev`).

   **Hanya itu yang diisi di Vercel.** App ID/Secret Meta, token Instagram, verify token webhook, dan
   API key n8n diisi **di dalam app** nanti (tersimpan terenkripsi di database), bukan di Vercel.

4. **Deploy**. Di log build harus muncul `[migrate] Database is up to date.`
5. Cek kesehatan: buka `https://<app-kamu>.vercel.app/api/health` → `{"status":"ok","db":"ok",…}`.
   Kalau `503`: `DATABASE_URL` atau password salah; lihat **Vercel → Logs**.
6. Buka `https://<app-kamu>.vercel.app/`. Muncul landing page dengan tombol **Sign in**. Kalau muncul
   kotak kuning **Setup needed**, isinya nama variabel yang belum diisi.

> **Mengubah/menambah env setelah deploy?** Vercel tidak menerapkannya ke deployment yang sedang
> jalan. Buka **Deployments → ⋯ (deployment teratas) → Redeploy**.
>
> Pakai domain **production** (Vercel → Project → Domains, mis. `https://nama-app.vercel.app`),
> bukan URL preview yang panjang dan acak. URL inilah yang nanti dipakai di Meta.

> Alternatif: integrasi resmi **Vercel ↔ Supabase** (Vercel → Storage/Integrations → Supabase)
> mengisi `POSTGRES_URL` dan `POSTGRES_URL_NON_POOLING` otomatis; app memakai keduanya sebagai
> fallback. Tetap isi `APP_SECRET` dan `CRON_SECRET` manual.

## 4. Login pertama

1. Buka app → login **`admin` / `changeme123`** (atau password dari `ADMIN_DEFAULT_PASSWORD`).
2. Kamu langsung diminta **ganti password** (min. 12 karakter). Setelah diganti, password default
   tidak bisa dipakai lagi.
3. Lakukan ini **segera setelah deploy**, karena sebelum diganti siapa pun yang tahu default bisa
   masuk duluan.
4. **Settings → Processing → Time zone** → pilih `Asia/Jakarta` (atau zona waktumu) supaya hari di
   Analytics sesuai kalender.

## 5. Siapkan akun Instagram

1. Instagram → **Settings → Account type and tools → Switch to professional account**
   (Creator atau Business).
2. Instagram → **Settings → Messages and story replies → Message controls → Connected tools →
   Allow access to messages: ON**. Tanpa ini DM otomatis gagal.

## 6. Buat app di Meta for Developers

1. <https://developers.facebook.com/apps> → **Create app**.
2. Use case: pilih yang berkaitan dengan **Instagram** ("Manage messaging & content on Instagram"),
   atau **Other → Business** jika tidak ada. Nama app bebas.
3. Di dashboard app buka **Instagram → API setup with Instagram login**. (Di dashboard versi baru:
   **Use cases → Manage messaging & content on Instagram → Customize → API setup with Instagram login**.)
4. Salin **Instagram app ID** dan **Instagram app secret** dari halaman itu (bukan dari
   App settings → Basic).
5. Di app kita: **Settings → Instagram** → isi **Instagram App ID** + **Instagram App Secret** →
   **Save credentials**.
6. Kembali ke Meta, di langkah **"Set up Instagram business login" → Business login settings →
   OAuth redirect URIs**, tambahkan persis URL yang ditampilkan di Settings → Instagram:
   `https://<app-kamu>/api/instagram/oauth/callback` → Save.
7. **App roles → Roles → Add people → Instagram Tester** → masukkan username IG kamu.
   Lalu di Instagram: **Settings → Website permissions → Apps and websites → Tester invites →
   Accept**.

## 7. Hubungkan Instagram

1. App → **Settings → Instagram → Connect Instagram** → login → **Allow** semua izin.
2. Kembali ke app; username + foto profil tampil. Token disimpan terenkripsi dan diperpanjang
   otomatis setiap hari oleh cron (berlaku ~60 hari, diperpanjang saat sisa < 15 hari).

## 8. Pasang webhook

1. Meta → **Instagram → API setup with Instagram login → Configure webhooks**.
2. **Callback URL**: `https://<app-kamu>/api/webhooks/instagram` (salin dari Settings → Instagram).
3. **Verify token**: salin dari Settings → Instagram (tombol mata untuk melihat, tombol copy).
4. **Verify and save**, lalu **Subscribe** field **`comments`**.
5. Kartu "Webhook" di Settings berubah jadi **Receiving events** setelah komentar pertama masuk.

## 9. Buat campaign & aturan

1. **Campaigns → New campaign** → pilih post/reel (atau **All posts**) → simpan.
2. **Add rule**:
   - **Keywords**: `drive` (tekan Enter per keyword; bisa banyak, mis. `drive`, `prompt`).
   - **Match mode**: _Whole word_ (disarankan) – cocok untuk "DRIVE", "drive 🙏", "Drive!!".
   - **Public replies**: beberapa variasi, dipilih acak, mis. `Sudah aku kirim ke DM ya {username} 🙌`.
   - **DM message** (maks 1000 karakter): mis.
     `Hai {username}! Ini prompt lengkap merapikan Google Drive dengan Claude: https://ilramdhan.dev/prompt/drive`
   - **Button** (opsional): judul + URL. Jika Meta menolak tombol, app otomatis mengirim teks + link.
   - **Once per user**: ON (satu orang hanya dapat DM sekali per aturan).
3. Pakai kotak **Test a comment** untuk simulasi (tidak mengirim apa pun).
4. Tes sungguhan: komentar `DRIVE` dari **akun lain yang sudah jadi Instagram Tester** (selama app
   masih Development mode). Lihat hasilnya di **Activity** dan **Analytics**.

## 10. Supaya berlaku untuk semua orang (Live mode + App Review)

Selama app di **Development mode**, hanya akun dengan role di app (tester/admin) yang memicu webhook.
Agar komentar **publik** diproses:

1. Lengkapi **App settings → Basic**: Privacy Policy URL (mis. `https://ilramdhan.dev/privacy`),
   Terms URL, ikon app, kategori.
2. **App Review → Permissions and features**: minta **Advanced Access** untuk
   `instagram_business_basic`, `instagram_business_manage_comments`,
   `instagram_business_manage_messages`. Siapkan video screencast alur aplikasi (connect IG →
   buat rule → komentar → DM terkirim) dan penjelasan penggunaan.
3. **Business Verification** (Meta meminta untuk Advanced Access).
4. Setelah disetujui, ubah app ke **Live**.

Batasan dari Meta (berlaku untuk semua tool, termasuk ManyChat):

- **1 DM (private reply) per komentar**, maksimal **7 hari** setelah komentar dibuat.
- Pesan lanjutan hanya bisa dikirim jika penerima membalas (jendela 24 jam).
- Ada rate limit Meta per akun; app mencoba ulang otomatis saat kena 429.

## 11. (Opsional) Mode n8n

Pakai hanya jika ingin menambah langkah sendiri (notifikasi Telegram/Slack, simpan ke Google Sheets,
CRM). App tetap yang mencocokkan keyword dan mengirim balasan; n8n hanya meneruskan event.

**Syarat:** langkah 1–10 sudah berhasil dengan webhook langsung, dan n8n bisa diakses lewat
**HTTPS publik** (n8n Cloud atau self-hosted dengan domain + TLS). `http://localhost:5678` tidak
bisa dipanggil Meta.

**A. Di app**

1. **Settings → n8n → API keys → Create API key** → beri nama `n8n` → **Copy API key** (diawali
   `ard_`, hanya tampil sekali).
2. **Settings → n8n → Relay workflow → Download** (file sudah berisi URL app kamu).

**B. Di n8n: import**

3. **Workflows → Create workflow** → menu **⋯** kanan atas → **Import from File** → pilih file tadi.

**C. Setelah import: yang perlu diubah hanya 3 hal**

4. Klik dua kali node **App: verify token** → **Credential for Header Auth → Create new credential**:
   - **Name**: `Authorization`
   - **Value**: `Bearer ard_…` (kata `Bearer`, satu spasi, lalu key-nya)
   - Ganti nama credential jadi `auto-reply-ig API key` → **Save**.
5. Klik dua kali node **App: relay events** → pilih credential yang sama.
6. Klik dua kali node **Config** → pastikan `appUrl` = URL app kamu, mis.
   `https://nama-app.vercel.app`, **tanpa garis miring di akhir**.
7. **Save** workflow (Ctrl/Cmd+S), lalu ubah toggle di atas dari **Inactive** ke **Active**.

Jangan ubah node Webhook, node Code, atau pengaturan body di **App: relay events**: signature Meta
dicek ulang dari byte aslinya.

**D. Arahkan Meta ke n8n**

8. Klik dua kali **Webhook POST (Meta events)** → tab **Production URL** → salin
   (`https://n8n.domainmu/webhook/instagram`). Bukan Test URL.
9. Meta → **Instagram → API setup with Instagram login → Configure webhooks**:
   **Callback URL** = Production URL n8n, **Verify token** = tetap dari app Settings → Instagram →
   **Verify and save**. Pastikan `comments` tetap ter-subscribe.
10. App → **Settings → Processing → Receive comments via → Through n8n** → Save.

**E. Tes**

11. Komentar keyword dari akun tester.
12. n8n → **Executions**: ada eksekusi hijau untuk verifikasi dan untuk setiap komentar. Di app,
    komentar muncul di **Activity** seperti biasa.

Kembali ke webhook langsung: ubah Callback URL di Meta ke `https://<app>/api/webhooks/instagram`,
Verify and save, lalu pilih **Direct webhook** di Settings → Processing.

n8n di balik reverse proxy: set env `WEBHOOK_URL=https://n8n.domainmu/` dan jangan biarkan proxy
mengubah body request. Detail & troubleshooting: [n8n.md](n8n.md).

## 12. Checklist cepat

- [ ] `/api/health` → `ok`
- [ ] Login & password sudah diganti
- [ ] IG Professional + "Allow access to messages" ON
- [ ] App ID + App Secret tersimpan, redirect URI ditambahkan
- [ ] Connect Instagram berhasil
- [ ] Webhook verified + `comments` subscribed
- [ ] Campaign + rule aktif, "Test a comment" cocok
- [ ] Komentar dari akun tester → muncul di Activity sebagai **Sent**
- [ ] (Publik) App Review + Live mode

## Alternatif: Docker / VPS

Jika tidak ingin memakai Vercel + Supabase, aplikasi bisa dijalankan di VPS sendiri dengan Docker Compose
(image siap pakai di `ghcr.io/ilramdhan/auto-reply-ig`, sudah termasuk Postgres dan cron refresh token).
Webhook Meta wajib HTTPS, jadi pasang reverse proxy seperti Caddy. Langkah lengkap: [docker.md](docker.md).

## 13. Masalah umum

| Gejala                                  | Penyebab & solusi                                                                                                                    |
| --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------ |
| Build Vercel gagal di `[migrate]`       | `DATABASE_URL_UNPOOLED` memakai Direct connection (IPv6). Ganti ke **Session pooler** 5432                                           |
| "Verify and save" di Meta gagal         | URL salah / app belum ter-deploy / verify token salah                                                                                |
| Komentar tidak muncul di Activity       | App masih Development mode & pengomentar bukan tester; field `comments` belum di-subscribe; App Secret salah (signature ditolak 401) |
| Activity: `skipped · no_match`          | Keyword tidak cocok; cek mode & ejaan dengan "Test a comment"                                                                        |
| Activity: `skipped · already_delivered` | "Once per user" aktif dan orang itu sudah pernah dapat DM                                                                            |
| DM gagal kode `551`                     | Pengguna tidak bisa menerima pesan (privasi) – bukan error app                                                                       |
| DM gagal kode `10` / `200`              | Izin kurang atau app belum Live/Advanced Access                                                                                      |
| Token kedaluwarsa                       | Pastikan `CRON_SECRET` terisi; atau klik Connect Instagram lagi                                                                      |

Log aplikasi (format JSON) ada di **Vercel → Project → Logs**; cari `scope` seperti `webhook`,
`engine`, `auth`.
