import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="fallback-screen">
      <div className="fallback-panel">
        <p className="eyebrow">404 / di luar garis</p>
        <h1>Lintasan tidak ditemukan</h1>
        <p>Alamat ini bukan bagian dari Teluk Sore. Kembali ke garis start untuk memulai balapan.</p>
        <Link className="btn btn-primary" href="/">
          Kembali ke Teluk Sore
        </Link>
      </div>
    </main>
  );
}
