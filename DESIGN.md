# Mobile Piston: arah desain

## Design Read

Balap arcade 3D untuk pemain kasual di ponsel dan desktop, dengan bahasa visual diorama pesisir pixel yang padat. Dial: **ENERGY 3 / RHYTHM 2 / MOTION 3**.

- **ENERGY 3:** dunia balap adalah fokus layar. Kamera chase menempel pada mobil, warna material cerah, dan panel HUD yang tegas membuatnya terasa seperti arkade.
- **RHYTHM 2:** judul memakai panel pit board asimetris di atas balapan demo, garasi memakai grid mobil dan panel detail, hasil memakai tabel balap. Setiap layar punya komposisi sesuai fungsinya.
- **MOTION 3:** rasa cepat berasal dari kamera chase, perpindahan kamera, drift, nitro, bayangan, awan, dan ombak. Animasi dekoratif tidak dipakai untuk mengisi ruang.

## Referensi dan batasnya

Referensi yang diminta adalah adegan pulau pixel 3D dari `remix.ui8.ai/fly`. Yang diambil adalah kepadatan pixel, langit berkabut, awan bergumpal, laut beriak, dan kamera yang berada di dalam dunia, bukan di atas papan datar. Aset, tata letak, dan isi referensi tidak ditiru.

Referensi itu menyusun dunia dari tumpukan sprite. Mobile Piston memilih model low-poly 3D sungguhan dengan tekstur pixel. Alasannya: kamera chase, top, dan cockpit harus bisa berputar bebas, dan mobil perlu terbaca dari segala arah. Simulasi balap tetap 2D supaya fisika, AI, tabrakan, dan lap yang sudah teruji tidak berubah. Renderer hanya memetakan posisi 2D ke dunia 3D.

## Palet

| Peran | Warna | Alasan |
| --- | --- | --- |
| Ink | `#0c1820` | Latar panel dan HUD, menjaga teks tetap terbaca di atas dunia yang sibuk. |
| Bone | `#f5ebd2` | Teks utama dan border, kontras tinggi terhadap ink. |
| Asphalt | `#35434a` | Jalan balap, warna netral yang membuat mobil berwarna menonjol. |
| Signal orange | `#ff8f3d` | Hanya untuk pemain, nitro, boost pad, dan aksi utama. |

Dunia memakai ramp hijau, biru laut, pasir, batu, dan kayu. Warna itu adalah material dunia, bukan tambahan palet UI. Aksen oranye tidak dipakai pada semua elemen, sehingga tetap menjadi penanda arah dan tindakan.

## Tipografi

- **Silkscreen** untuk wordmark, HUD, label, dan tombol. Bentuknya seperti papan skor arkade dan cocok dengan tekstur pixel.
- **System sans** untuk paragraf penjelas dan isi tabel. Teks panjang tetap mudah dibaca dan tidak dipaksa mengikuti gaya pixel.
- Uppercase dipakai terbatas pada label kecil, bukan pada seluruh isi. Letter-spacing hanya sedikit.

## Identitas

Motif utama adalah **pennant oranye bertakik**. Motif ini muncul sebagai penanda mobil pemain, indikator mobil terpilih, aksen start, dan garis aksen pada wordmark. Pola kotak-kotak hitam putih dipakai karena itu bahasa asli garis start balap, bukan dekorasi bebas. Gantry start dengan nama lintasan, papan tepi lintasan, dan tumpukan ban memperkuat kesan sirkuit pesisir.

Wordmark disusun dua baris: MOBILE kecil, PISTON besar. Nama Mobile Piston menjadi satu-satunya fokus judul.

## Dunia 3D dan kadar pixel

- **Framebuffer internal 960x540.** Ini dua kali lipat resolusi internal 480x270 sebelumnya, jadi tepi model dan tekstur tidak lagi sebesar blok bangunan. Kanvas diskalakan dengan `image-rendering: pixelated` supaya pixel tetap tajam, bukan blur.
- **Tekstur nearest-neighbor.** Aspal, rumput, air, awan, dan papan dibuat dari kanvas kecil lalu diperbesar tanpa interpolasi. Model memakai flat shading dan warna material, bukan tekstur foto.
- **Mobil low-poly bervolume tebal dengan detail pixel.** Empat model dibangun berlapis ala voxel/sprite-stacking chunky mini racer dengan siluet tegas, kabin menonjol, pengemudi dengan helm berwarna, roda oversized, bayangan bawah bodi, dan detail aerodinamika khas. Gerak hidup mencakup suspensi membal, kemiringan bodi saat menikung, setir dan roda berbelok, serta semburan nitro.
- **Kamera top-down sebagai tampilan awal dengan rig terpadu.** Kamera top-down berada di posisi tinggi berorientasi tetap (north-up) dengan look-ahead halus sehingga lintasan di depan dan seluruh mobil terlihat jelas seperti peta taktis Mini Motor Racing. Perpindahan ke chase dan cockpit memakai rig terpadu dengan damped easing 0.6s tanpa potongan gambar/cut. Cockpit menampilkan kap mesin, setir, tangan pengemudi, dan spion tengah tanpa clipping. FOV kick dinamis menyertai pemakaian nitro.
- **Lintasan lebih lebar.** Jalan diperlebar menjadi 4-5 lebar mobil (Teluk Sore 176 unit, Mata Air 160 unit), memberikan ruang manuver leluasa dan garis balap dinamis bagi AI dan pemain untuk menyalip.
- **Pemain mulai dari P6.** Ini memberi kamera ruang untuk melihat seluruh pack tanpa mobil di belakang kamera, dan menciptakantujuan menyalip yang jelas.
- **Judul memakai balapan demo 3D.** Tiga mobil AI mengikuti segmen lintasan di belakang panel, sehingga judul memperlihatkan model dan dunia yang sebenarnya. Saat reduced motion aktif, mobil demo, awan, air, dan getaran kamera berhenti.
- **Gantry start dengan nama lintasan.** Ini penanda lokasi yang spesifik, bukan billboard generik. Banner menghadap mobil yang datang dan menjadi bingkai saat balapan dimulai.

## Dua rute

- **Teluk Sore:** rute pesisir dengan tikungan cepat, straight panjang, dan pemandangan laut. Warna siang yang netral.
- **Mata Air:** rute dalam yang lebih pendek dan teknis, melingkari danau dan dikelilingi vegetasi. Lapisan cahaya sore yang tipis membedakan suasananya tanpa mengganti seluruh palet.
- **Pemilihan lintasan:** preview rute dan rekor per lintasan ditampilkan sebelum balapan, sehingga pilihan pemain punya konsekuensi yang terlihat.

## Alasan keputusan visual

- **Panel ink solid dan border bone:** HUD harus terbaca pada jalan gelap maupun laut terang tanpa blur atau glow. Offset shadow 2px memberi kedalaman tanpa membuat semua elemen melayang.
- **Sudut panel dipotong 45 derajat:** memberi karakter papan sirkuit. Tombol tetap persegi agar tindakan lebih mudah dipindai.
- **Kamera 3D, fisika 2D:** arah pandang bisa berubah tanpa mengorbankan rasa setir yang sudah stabil di 120 Hz.
- **Aspal lebih tenang dari tepi lintasan:** detail rapat ditempatkan pada vegetasi, laut, awan, dan properti. Mobil tetap fokus.
- **Dunia dibuat dari kode:** semua tekstur, pohon, mercusuar, mobil, papan, dan suara dihasilkan sendiri. Three.js adalah renderer, bukan sumber aset.
- **Tema gelap untuk panel:** warna ini dipilih karena HUD arkade perlu duduk di atas pemandangan siang yang terang, bukan karena tema gelap dianggap modern.

## Aksesibilitas dan responsif

- Kontras teks minimal WCAG AA; panel opaque, bukan teks langsung di atas gambar.
- Target sentuh minimal 44px, dengan jarak antar tombol. Tombol KAM dan jeda berada di HUD atas.
- Fokus keyboard terlihat; dialog jeda dan kontrol memakai `<dialog>` native dengan focus trap.
- Kamera bisa diganti dengan V, tombol KAM, atau Y pada gamepad.
- `prefers-reduced-motion` mematikan getaran kamera, mobil demo, awan, air, dan animasi non-esensial.
- Layout punya state khusus untuk desktop, ponsel lanskap pendek, dan ponsel potret. Tidak ada overflow horizontal.
- Gamepad memakai standard mapping dan dapat memindah fokus menu.

## Suara

Suara disintesis dengan Web Audio: mesin, ban selip, nitro, tabrakan, beep hitung mundur, dan klik. Tidak ada musik atau sampel pihak ketiga. Audio baru menyala setelah interaksi pengguna, dan status mute disimpan.
