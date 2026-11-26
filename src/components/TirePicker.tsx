'use client';

import { useState } from 'react';
import type { TireId } from '../game/types';
import { TIRE_ORDER, TIRES, tireGripMultiplier } from '../game/data/tires';
import { isTireUnlocked, tireUnlockDef } from '../game/progression';
import styles from './progression.module.css';

function pct(value: number): string {
  const rounded = Math.round((value - 1) * 100);
  return `${rounded > 0 ? '+' : ''}${rounded}%`;
}

/** Tyre selector. Tyres fit every car; locked ones can be read about but not selected. */
export default function TirePicker({
  selectedTire,
  xp,
  unlocks,
  onSelect,
}: {
  selectedTire: TireId;
  xp: number;
  unlocks?: string[];
  onSelect: (id: TireId) => void;
}) {
  const [previewId, setPreviewId] = useState<TireId | null>(null);
  const shownId: TireId = previewId ?? selectedTire;
  const shown = TIRES[shownId];
  const shownLocked = !isTireUnlocked(shownId, { xp, unlocks });
  const shownLevel = tireUnlockDef(shownId)?.level;

  const dry = tireGripMultiplier(shown, 0);
  const wet = tireGripMultiplier(shown, 1);
  const standardWet = tireGripMultiplier(TIRES.standard, 1);
  const offroad = shown.offroadPenalty;

  return (
    <div className={styles.tireBlock} role="group" aria-label="Pilih jenis ban">
      <span className="label">Ban (berlaku untuk semua mobil)</span>
      <div className={styles.tireRow}>
        {TIRE_ORDER.map((id) => {
          const locked = !isTireUnlocked(id, { xp, unlocks });
          const level = tireUnlockDef(id)?.level;
          const selected = id === selectedTire && previewId == null;
          return (
            <button
              key={id}
              type="button"
              className={styles.tireBtn}
              data-selected={selected}
              data-locked={locked}
              aria-pressed={selected}
              onClick={() => {
                if (locked) {
                  setPreviewId(id);
                  return;
                }
                setPreviewId(null);
                onSelect(id);
              }}
              data-nav
            >
              <strong>{TIRES[id].name}</strong>
              {locked && level != null && <span className={styles.tireLock}>Lv {level}</span>}
            </button>
          );
        })}
      </div>

      {shownLocked && shownLevel != null && (
        <p className={styles.lockNote} role="status">
          Terkunci. Capai Level {shownLevel} untuk membuka ban {shown.name}.
        </p>
      )}
      <p className={styles.tireInfo}>
        <strong>{shown.kind}.</strong> {shown.blurb}
      </p>
      <ul className={styles.tireEffects}>
        <li className={dry >= 1 ? styles.good : styles.bad}>Kering: {pct(dry)}</li>
        <li className={wet >= standardWet ? styles.good : styles.bad}>Basah: {pct(wet)}</li>
        {offroad !== 1 && (
          <li className={offroad < 1 ? styles.good : styles.bad}>Rumput/tanah: {offroad < 1 ? 'lebih baik' : 'lebih buruk'}</li>
        )}
      </ul>
    </div>
  );
}
