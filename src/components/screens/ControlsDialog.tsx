'use client';

import { useEffect, useRef } from 'react';

export default function ControlsDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="dialog controls-dialog"
      aria-labelledby="controls-heading"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
    >
      <div className="dialog-heading">
        <div>
          <p className="eyebrow">Tiga cara mengemudi</p>
          <h2 id="controls-heading">Kontrol</h2>
        </div>
        <button className="btn btn-quiet" type="button" onClick={onClose} data-nav data-gamepad-back>
          Tutup
        </button>
      </div>

      <p className="dialog-lead">
        Di desktop, gas dikontrol manual dengan W / panah atas. Di layar sentuh (HP), gas berjalan otomatis saat
        tidak mengerem. Belok tajam dengan gas penuh dan tanpa rem akan membuat mobil drifting, bahkan berputar.
        Rem atau lepas gas sebelum tikungan untuk menjaga traksi, dan luruskan setir untuk memulihkan mobil yang
        tergelincir. Drift terkendali mengisi nitro, dan garis oranye di lintasan adalah boost pad.
      </p>

      <div className="control-groups">
        <section className="control-group" aria-labelledby="keyboard-controls">
          <h3 id="keyboard-controls">Keyboard</h3>
          <dl>
            <div>
              <dt>Setir</dt>
              <dd><kbd>A</kbd> <kbd>D</kbd> atau panah kiri / kanan</dd>
            </div>
            <div>
              <dt>Gas / akselerasi</dt>
              <dd><kbd>W</kbd> atau panah atas (lepas untuk coasting)</dd>
            </div>
            <div>
              <dt>Rem / mundur</dt>
              <dd><kbd>Space</kbd>, <kbd>S</kbd> atau panah bawah</dd>
            </div>
            <div>
              <dt>Nitro</dt>
              <dd><kbd>Shift</kbd></dd>
            </div>
            <div>
              <dt>Kamera</dt>
              <dd><kbd>V</kbd></dd>
            </div>
            <div>
              <dt>Jeda</dt>
              <dd><kbd>Esc</kbd> atau <kbd>P</kbd></dd>
            </div>
          </dl>
        </section>

        <section className="control-group" aria-labelledby="touch-controls">
          <h3 id="touch-controls">Sentuh</h3>
          <dl>
            <div>
              <dt>Setir</dt>
              <dd>Dua tombol di kiri bawah</dd>
            </div>
            <div>
              <dt>Rem / mundur</dt>
              <dd>Tombol rem di kanan bawah</dd>
            </div>
            <div>
              <dt>Nitro</dt>
              <dd>Tombol nitro besar di kanan bawah</dd>
            </div>
            <div>
              <dt>Kamera</dt>
              <dd>Tombol KAM di HUD</dd>
            </div>
            <div>
              <dt>Jeda</dt>
              <dd>Tombol jeda di HUD</dd>
            </div>
          </dl>
        </section>

        <section className="control-group" aria-labelledby="gamepad-controls">
          <h3 id="gamepad-controls">Gamepad</h3>
          <dl>
            <div>
              <dt>Setir</dt>
              <dd>Stik kiri atau D-pad</dd>
            </div>
            <div>
              <dt>Rem / mundur</dt>
              <dd>LT atau B</dd>
            </div>
            <div>
              <dt>Nitro</dt>
              <dd>RT atau A</dd>
            </div>
            <div>
              <dt>Kamera</dt>
              <dd>Y</dd>
            </div>
            <div>
              <dt>Menu</dt>
              <dd>D-pad, A konfirmasi, B kembali, Start jeda</dd>
            </div>
          </dl>
        </section>
      </div>

      <div className="dialog-actions">
        <button className="btn btn-primary" type="button" onClick={onClose} data-nav>
          Mengerti
        </button>
      </div>
    </dialog>
  );
}
