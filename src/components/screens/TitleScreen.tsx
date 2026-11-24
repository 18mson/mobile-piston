'use client';

import type { CarSpec, Track } from '../../game/types';
import { formatTime } from '../../game/utils';
import CarThumb from '../CarThumb';
import TrackPreview from '../TrackPreview';

export default function TitleScreen({
  selectedCar,
  track,
  bestLapMs,
  onStart,
  onGarage,
  onTracks,
  onControls,
}: {
  selectedCar: CarSpec;
  track: Track;
  bestLapMs: number | null;
  onStart: () => void;
  onGarage: () => void;
  onTracks: () => void;
  onControls: () => void;
}) {
  return (
    <section className="screen title-screen" data-menu-scope="active" aria-labelledby="main-menu-heading">
      <h2 id="main-menu-heading" className="sr-only">
        Menu utama Mobile Piston
      </h2>

      <div className="title-panel panel">
        <div className="title-copy">
          <p className="eyebrow">Balap mobil mini</p>
          <p className="wordmark" aria-hidden="true">
            <span className="wordmark-mobile">Mobile</span>
            <span className="wordmark-piston">Piston</span>
          </p>
          <p className="title-tagline">
            {track.id === 'mata-air'
              ? 'Tiga putaran mengelilingi danau. Belok, drifting, lalu tekan nitro pada momen yang tepat.'
              : 'Tiga putaran di pesisir Teluk Sore. Belok, drifting, lalu tekan nitro pada momen yang tepat.'}
          </p>
        </div>

        <button
          className="track-card"
          type="button"
          onClick={onTracks}
          aria-label={`Pilih lintasan. Sekarang ${track.name}.`}
          data-nav
        >
          <TrackPreview track={track} />
          <span className="track-card-copy">
            <span className="label">Lintasan</span>
            <strong>{track.name}</strong>
            <span className="track-meta">3 putaran / 6 mobil</span>
            <span className="track-meta">Start P6</span>
            <span className="track-change">Ganti lintasan</span>
          </span>
        </button>

        <div className="selected-car-row">
          <CarThumb car={selectedCar} scale={3} />
          <div>
            <span className="label">Mobil terpilih</span>
            <strong>
              {selectedCar.name} <span className="car-kind">/ {selectedCar.kind}</span>
            </strong>
          </div>
          <span className="best-lap-inline">
            <span className="label">Rekor</span>
            {bestLapMs == null ? 'Belum ada' : formatTime(bestLapMs)}
          </span>
        </div>

        <div className="title-actions">
          <button className="btn btn-primary" type="button" onClick={onStart} data-nav>
            Mulai balapan
          </button>
          <button className="btn" type="button" onClick={onGarage} data-nav>
            Pilih mobil
          </button>
          <button className="btn" type="button" onClick={onTracks} data-nav>
            Lintasan
          </button>
          <button className="btn btn-quiet" type="button" onClick={onControls} data-nav>
            Kontrol
          </button>
        </div>

        <div className="title-notes">
          <p>Gas otomatis. Kamu yang mengatur setir, rem, dan nitro.</p>
          <p className="portrait-note">Putar ponsel ke lanskap untuk lintasan yang lebih lebar.</p>
        </div>
      </div>
    </section>
  );
}
