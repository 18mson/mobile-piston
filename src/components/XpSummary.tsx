'use client';

import { useEffect, useState } from 'react';
import { CARS } from '../game/data/cars';
import { levelProgress, type UnlockKind, type XpReport } from '../game/progression';
import styles from './progression.module.css';

function unlockKindLabel(kind: UnlockKind): string {
  switch (kind) {
    case 'car':
      return 'Mobil terbuka';
    case 'tire':
      return 'Ban terbuka';
    case 'track':
      return 'Lintasan terbuka';
    case 'feature':
      return 'Fitur terbuka';
  }
}

/** XP breakdown shown on the results screen, with the bar filling up to the new total. */
export default function XpSummary({ report }: { report: XpReport }) {
  const before = levelProgress(report.xpBefore);
  const after = levelProgress(report.xpAfter);
  const leveledUp = report.levelAfter > report.levelBefore;
  // start the bar where the race began, then animate to where it ended
  const [percent, setPercent] = useState(leveledUp ? 0 : Math.round(before.fraction * 100));

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => setPercent(Math.round(after.fraction * 100)));
    return () => window.cancelAnimationFrame(frame);
  }, [after.fraction]);

  return (
    <div className={styles.xpPanel} role="status" aria-label="Pengalaman yang didapat">
      <div className={styles.xpHeader}>
        <span>
          Level {report.levelAfter}
          {after.nextLevelXp != null
            ? ` · ${after.xpToNext} XP lagi ke Level ${report.levelAfter + 1}`
            : ' (Maksimum)'}
        </span>
        <span className={styles.xpTotal}>+{report.award.total} XP</span>
      </div>

      <ul className={styles.rows}>
        {report.award.rows.map((row) => (
          <li key={row.id}>
            <span>{row.label}</span>
            <span>+{row.xp}</span>
          </li>
        ))}
      </ul>

      <div className={styles.bar} aria-hidden="true">
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>

      {leveledUp && (
        <div className={styles.levelUp}>
          <span>
            Naik ke Level {report.levelAfter} (dari Level {report.levelBefore})
          </span>
          {report.unlocked.length > 0 && (
            <ul className={styles.unlockList}>
              {report.unlocked.map((item) => (
                <li key={item.id}>{unlockKindLabel(item.kind)}: {item.label}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {report.cosmeticUnlocks && report.cosmeticUnlocks.items.length > 0 && (
        <div className={styles.levelUp}>
          <span>
            Terbuka untuk {CARS[report.cosmeticUnlocks.carId].name}:{' '}
            {report.cosmeticUnlocks.items.map((item) => item.label).join(', ')}
          </span>
        </div>
      )}
    </div>
  );
}
