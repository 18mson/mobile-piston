'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <main className="fallback-screen">
      <div className="fallback-panel" role="alert">
        <p className="eyebrow">Mesin berhenti</p>
        <h1>Lintasan gagal dimuat</h1>
        <p>Ada gangguan saat menyiapkan Mobile Piston. Coba jalankan ulang mesin.</p>
        <div className="fallback-actions">
          <button className="btn btn-primary" type="button" onClick={reset}>
            Coba lagi
          </button>
          <button className="btn" type="button" onClick={() => window.location.reload()}>
            Muat ulang
          </button>
        </div>
      </div>
    </main>
  );
}
