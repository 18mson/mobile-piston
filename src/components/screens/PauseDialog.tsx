'use client';

import { useEffect, useRef } from 'react';

export default function PauseDialog({
  open,
  muted,
  onResume,
  onRestart,
  onGarage,
  onMenu,
  onControls,
  onToggleMute,
}: {
  open: boolean;
  muted: boolean;
  onResume: () => void;
  onRestart: () => void;
  onGarage: () => void;
  onMenu: () => void;
  onControls: () => void;
  onToggleMute: () => void;
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
      className="dialog pause-dialog"
      aria-labelledby="pause-heading"
      onCancel={(event) => {
        event.preventDefault();
        onResume();
      }}
    >
      <p className="eyebrow">Balapan dihentikan sementara</p>
      <h2 id="pause-heading">Jeda</h2>
      <p className="dialog-lead">Mobil berhenti, waktu juga berhenti.</p>

      <div className="pause-actions">
        <button className="btn btn-primary" type="button" onClick={onResume} data-nav data-gamepad-back>
          Lanjut
        </button>
        <button className="btn" type="button" onClick={onRestart} data-nav>
          Ulangi balapan
        </button>
        <button className="btn" type="button" onClick={onGarage} data-nav>
          Ganti mobil
        </button>
        <button className="btn" type="button" onClick={onMenu} data-nav>
          Menu utama
        </button>
        <button className="btn btn-quiet" type="button" onClick={onControls} data-nav>
          Kontrol
        </button>
        <button className="btn btn-quiet" type="button" onClick={onToggleMute} data-nav>
          Suara: {muted ? 'mati' : 'nyala'}
        </button>
      </div>
    </dialog>
  );
}
