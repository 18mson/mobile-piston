'use client';

import type { Track } from '../../game/types';
import ProgressBadge from '../ProgressBadge';

export default function TitleScreen({
  track,
  onStart,
  onMultiplayer,
  xp = 0,
}: {
  track: Track;
  xp?: number;
  onStart: () => void;
  onMultiplayer: () => void;
  onControls?: () => void;
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
              : track.id === 'lereng-kopi'
                ? 'Tiga putaran menyusuri lereng kopi. Rem sebelum tikungan jepit, atau bersiap berputar.'
                : track.id === 'pelabuhan'
                  ? 'Tiga putaran di pelabuhan. Lurusan panjang menggoda, tapi rem tetap wajib di chicane kontainer.'
                  : 'Tiga putaran di pesisir Teluk Sore. Belok, drifting, lalu tekan nitro pada momen yang tepat.'}
          </p>
        </div>

        <ProgressBadge xp={xp} />

        <div className="title-actions">
          <button className="btn btn-primary" type="button" onClick={onStart} data-nav>
            Mulai balapan
          </button>
          <button className="btn" type="button" onClick={onMultiplayer} data-nav>
            Multiplayer (WiFi / Online)
          </button>
        </div>

        <div className="title-notes">
          <p>Tekan Esc untuk mode Explore Map.</p>
          <p className="portrait-note">Putar ponsel ke lanskap untuk lintasan yang lebih lebar.</p>
        </div>
      </div>
    </section>
  );
}
