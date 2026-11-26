'use client';

import type { RaceResults } from '../../game/types';
import { formatTime } from '../../game/utils';
import type { XpReport } from '../../game/progression';
import XpSummary from '../XpSummary';

export default function ResultsScreen({
  results,
  trackName,
  onRestart,
  onGarage,
  onMenu,
  onReturnToLobby,
  xpReport = null,
}: {
  results: RaceResults;
  xpReport?: XpReport | null;
  trackName: string;
  onRestart: () => void;
  onGarage: () => void;
  onMenu: () => void;
  onReturnToLobby?: () => void;
}) {
  return (
    <section className="screen results-screen" data-menu-scope="active" aria-labelledby="results-heading">
      <div className="results-panel panel">
        <div className="results-heading">
          <div>
            <p className="eyebrow">
              {trackName} / {results.totalLaps ?? 3} putaran
            </p>
            <h2 id="results-heading">Hasil balapan</h2>
          </div>
          <div className="finish-plate" aria-label={`Kamu finis di posisi ${results.playerPosition}`}>
            <span className="label">Posisi kamu</span>
            <strong>P{results.playerPosition}</strong>
          </div>
        </div>

        <div className="race-summary" role="group" aria-label="Ringkasan balapan">
          <div>
            <span className="label">Waktu total</span>
            <strong>{formatTime(results.totalTimeMs)}</strong>
          </div>
          <div>
            <span className="label">Putaran terbaik</span>
            <strong>{formatTime(results.playerBestLapMs)}</strong>
          </div>
          <div>
            <span className="label">Rekor sebelumnya</span>
            <strong>{results.previousBestLapMs == null ? 'Belum ada' : formatTime(results.previousBestLapMs)}</strong>
          </div>
        </div>

        {results.isNewRecord && (
          <p className="record-note" role="status">
            Rekor putaran baru tersimpan di perangkat ini.
          </p>
        )}

        {xpReport && xpReport.award.total > 0 && <XpSummary report={xpReport} />}

        <div className="results-table-wrap">
          <table className="results-table">
            <caption className="sr-only">Urutan finis Mobile Piston di {trackName}</caption>
            <thead>
              <tr>
                <th scope="col">Pos</th>
                <th scope="col">Pembalap</th>
                <th scope="col">Waktu</th>
                <th scope="col">Putaran terbaik</th>
              </tr>
            </thead>
            <tbody>
              {results.results.map((result) => (
                <tr key={result.id} data-player={result.isPlayer}>
                  <td>{result.position}</td>
                  <th scope="row">
                    {result.label}
                    {result.isPlayer && <span className="you-tag">Kamu</span>}
                  </th>
                  <td>{result.timeMs == null ? 'Belum finis' : formatTime(result.timeMs)}</td>
                  <td>{formatTime(result.bestLapMs)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="results-actions">
          {onReturnToLobby ? (
            <button className="btn btn-primary" type="button" onClick={onReturnToLobby} data-nav>
              Kembali ke Lobby
            </button>
          ) : (
            <>
              <button className="btn btn-primary" type="button" onClick={onRestart} data-nav>
                Balap lagi
              </button>
              <button className="btn" type="button" onClick={onGarage} data-nav>
                Ganti mobil
              </button>
            </>
          )}
          <button className="btn btn-quiet" type="button" onClick={onMenu} data-nav data-gamepad-back>
            Menu utama
          </button>
        </div>
      </div>
    </section>
  );
}
