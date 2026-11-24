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

Gas selalu menyala otomatis. Drift mengisi meter nitro, dan garis chevron oranye di lintasan adalah boost pad.

| Aksi | Keyboard | Sentuh | Gamepad standar |
| --- | --- | --- | --- |
| Setir | A / D atau panah kiri / kanan | tombol kiri dan kanan | stik kiri atau D-pad |
| Rem / mundur | S atau panah bawah | tombol rem | LT atau B |
| Nitro | Space | tombol nitro | RT atau A |
| Kamera | V | tombol KAM di HUD | Y |
| Jeda | Esc atau P | tombol jeda di HUD | Start |

Tiga sudut kamera tersedia: chase, top, dan cockpit. Chase adalah tampilan awal. Pemain mulai dari grid P6, jadi seluruh pack terlihat di depan dan kamera punya ruang untuk mengikuti balapan.

Menu dapat dioperasikan dengan keyboard dan gamepad: D-pad memindah fokus, A memilih, B kembali.

## Yang ada sekarang

- Dua lintasan di Teluk Sore: **Teluk Sore** yang mengelilingi pesisir, dan **Mata Air** yang melingkari danau di tengah kebun.
- Pilihan lintasan dengan preview rute dan rekor terpisah untuk setiap lintasan.
- Empat mobil dengan model 3D dan karakter fisika berbeda: Sirip, Bagas, Okra, dan Kepik.
- Lima AI dengan livery berbeda, grid enam mobil, tiga putaran, boost pad, drift, dan tabrakan.
- Renderer 3D dengan framebuffer internal 960x540, tekstur nearest-neighbor, langit, awan, air, vegetasi, mercusuar, gantry start, dan bayangan.
- Kamera chase, top, dan cockpit, dengan tombol KAM untuk pengguna sentuh.
- Judul dengan tiga mobil demo yang mengikuti lintasan, serta thumbnail mobil 3D di garasi.
- Hasil balapan dengan waktu nyata, rekor putaran lokal, dan dukungan keyboard, sentuh, serta gamepad.
- UI responsif untuk desktop, ponsel lanskap, dan ponsel potret.
- Pengaturan suara, mobil, lintasan terpilih, dan rekor per lintasan disimpan di perangkat dengan key `mobile-piston.save.v2`. Save v1 lama dimigrasikan otomatis.

Career, upgrade, multiplayer, dan lintasan ketiga belum termasuk.

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
