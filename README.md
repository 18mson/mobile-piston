# Mobile Piston

Balap mobil mini 3D bergaya pixel art di dua rute **Teluk Sore**. Dibangun dengan Next.js 16, React 19, TypeScript, dan Three.js, dengan simulasi balap 2D yang tetap dipakai untuk fisika, AI, dan lap.

Game ini mengambil mekanik arcade Mini Motor Racing yang diminta: gas otomatis, powerslide, nitro, tabrakan tanpa damage, dan balapan melawan AI. Dunia 3D, model mobil, tekstur, langit, air, lintasan, dan suara dibuat orisinal dari kode. Tidak ada aset dari Mini Motor Racing atau gambar referensi.

## Jalankan

Butuh Node.js 20.9 atau lebih baru dan browser dengan WebGL 2.

```bash
npm install
npm run dev
```

Buka `http://127.0.0.1:3000`.

Build produksi:

```bash
npm run build
npm run start
```

Jika WebGL tidak tersedia, game menampilkan layar error yang menjelaskan masalahnya, bukan kanvas kosong.

## Kontrol

Pemain dapat mengendalikan gas secara manual (W / panah atas) atau membiarkan gas otomatis. Melepas gas (lepas gas / coasting) atau mengerem (S / panah bawah) sebelum tikungan tajam memindahkan bobot ke depan dan menjaga ban tetap di dalam batas traksi. Drift mengisi meter nitro, dan garis chevron oranye di lintasan adalah boost pad.

| Aksi | Keyboard | Sentuh | Gamepad standar |
| --- | --- | --- | --- |
| Setir | A / D atau panah kiri / kanan | tombol kiri dan kanan | stik kiri atau D-pad |
| Gas / akselerasi | W atau panah atas (atau otomatis) | otomatis | RT atau A |
| Rem / mundur | Space, S, atau panah bawah | tombol rem | LT atau B |
| Nitro | Shift | tombol nitro | RT atau A |
| Kamera | V | tombol KAM di HUD | Y |
| Reset mobil | R | tombol RESET di HUD | Select / D-pad Atas |
| Jeda | Esc atau P | tombol jeda di HUD | Start |

Model kendali mengadopsi rasa berkendara Circuit Superstars: pemain harus menjaga kecepatan dan titik pengereman atau lepas gas sebelum tikungan. Masuk tikungan terlalu kencang menyebabkan ban pecah traksi dan mobil tergelincir (slip/understeer), di mana gesekan ban yang meluncur menyerap kecepatan mobil. Tabrakan antar mobil dan benturan pembatas memicu efek percikan api dan perlambatan laju (slowdown). Jika mobil berbalik arah, peringatan arcade SALAH JALAN akan muncul dan mobil dapat dikembalikan ke tengah lintasan dengan tombol RESET atau tombol R.

Tiga sudut kamera tersedia: top (default awal bergaya Mini Motor Racing), chase, dan cockpit. Perpindahan kamera berlangsung mulus dengan camera rig terpadu (damped easing 0.6s). Interpolasi fisika memastikan gerakan mobil meluncur stabil tanpa jitter pixel. Pemain mulai dari grid P6 dengan jalan yang sangat lebar (4-5 lebar mobil), sehingga seluruh pack terlihat jelas dan ada banyak ruang untuk bermanuver dan menyalip.

Menu dapat dioperasikan dengan keyboard dan gamepad: D-pad memindah fokus, A memilih, B kembali.

## Yang ada sekarang

- Dua lintasan lebar di Teluk Sore: **Teluk Sore** yang mengelilingi pesisir (lebar 176 unit), dan **Mata Air** yang melingkari danau di tengah kebun (lebar 160 unit), memberikan ruang salip 4-5 mobil.
- Pilihan lintasan dengan preview rute dan rekor terpisah untuk setiap lintasan.
- Empat mobil dengan model 3D bervolume tebal (voxel/sprite-stacking chunky racer): Sirip (rally hatchback dengan roof scoop & spoiler), Bagas (muscle car dengan supercharger blower), Okra (truk pikap kargo dengan rollbar & lampu sorot), dan Kepik (buggy offroad dengan sangkar pipa & ban raksasa). Detail gerak hidup: suspensi mental, kemiringan bodi di tikungan (body roll), roda berputar dan membelok, semburan nitro ganda, lampu rem dinamis, bekas ban aspal ganda (skid marks) di permukaan jalan saat mobil drifting/slip, serta gumpalan asap ban.
- Lima AI dengan livery berbeda, grid enam mobil dengan posisi start berjarak, tiga putaran, boost pad lebar, drift, dan tabrakan tanpa crash macet.
- Renderer 3D dengan framebuffer internal 960x540, tekstur nearest-neighbor, langit, awan, air, vegetasi, mercusuar, gantry start, dan bayangan.
- Kamera rig terpadu dengan 3 sudut pandang (top-down default, chase, cockpit), transisi terbang mulus tanpa cut, getaran kamera responsif benturan/laju, serta efek FOV kick saat nitro aktif. Tombol KAM di HUD menampilkan mode kamera aktif.
- Judul dengan tiga mobil demo yang mengikuti lintasan, serta thumbnail mobil 3D di garasi.
- Hasil balapan dengan waktu nyata, rekor putaran lokal, dan dukungan keyboard, sentuh, serta gamepad.
- UI responsif untuk desktop, ponsel lanskap, dan ponsel potret.
- Pengaturan suara, mobil, lintasan terpilih, dan rekor per lintasan disimpan di perangkat dengan key `mobile-piston.save.v2`. Save v1 lama dimigrasikan otomatis.

## Multiplayer Online (WebSocket Server + Render)

Mobile Piston mendukung balapan multiplayer online hingga 6 pemain (sisa slot otomatis diisi Bot AI) dengan *full-contact collision*, prediksi lokal, interpolasi lawan, serta *auto-reconnect* (grace window 15 detik).

Menjalankan server multiplayer secara lokal:

```bash
npm run server
```

Deploy gratis di **Render.com** (Blueprint [render.yaml](render.yaml), region Singapore):
1. Hubungkan repository ke Render sebagai **Web Service** (`npm install` build command, `npm run server` start command, health check `/health`).
2. Salin URL WebSocket dari Render (mis. `wss://mobile-piston-ws.onrender.com`).
3. Set environment variable `NEXT_PUBLIC_WS_URL=wss://mobile-piston-ws.onrender.com` di project frontend (Vercel / Next.js).

## Skrip

```bash
npm run typecheck   # TypeScript
npm test            # unit test dan simulasi soak
npm run build       # build produksi Next.js
npm run smoke       # smoke test browser (butuh Chromium Playwright)
```

Smoke test memakai `playwright-core` dan mencari Chrome for Testing di cache Playwright. Untuk menunjuk browser lain:

```bash
PLAYWRIGHT_CHROMIUM_EXECUTABLE="/path/to/chrome" npm run smoke
```

Verifikasi lengkap bisa dijalankan terhadap server yang aktif:

```bash
BASE_URL=http://127.0.0.1:3000 npm run smoke
```

Laporan verifikasi dan Delivery Gate ada di [AUDIT.md](AUDIT.md).

## Struktur

- `app/`: shell Next.js, metadata, font lokal, dan stylesheet.
- `src/components/`: layar React, HUD, dialog, kontrol sentuh, dan thumbnail mobil.
- `src/game/`: simulasi balapan, fisika, AI, input, audio, dan save.
- `src/game/render3d/`: renderer Three.js, dunia pesisir, model mobil, kamera, dan preview garasi.
- `src/game/render/`: sprite 2D yang dipakai sebagai fallback thumbnail saat preview 3D belum siap.
- `tests/`: pengujian geometri, input, save, lap, fisika tabrakan, dan soak simulation.

## Aset dan lisensi font

Semua model, tekstur, langit, air, lintasan, dan audio game dibuat oleh kode di repositori ini. Three.js dipakai sebagai library renderer. Font **Silkscreen** disimpan lokal di `app/fonts/` dengan lisensi SIL Open Font License 1.1 di `app/fonts/OFL.txt`.

Proyek ini tidak berafiliasi dengan The Binary Mill atau Mini Motor Racing.
