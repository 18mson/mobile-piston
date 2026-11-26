'use client';

import { levelProgress } from '../game/progression';
import styles from './progression.module.css';

/** Level chip + XP bar. Used on the title screen. */
export default function ProgressBadge({ xp }: { xp: number }) {
  const progress = levelProgress(xp);
  const percent = Math.round(progress.fraction * 100);
  return (
    <div className={styles.badge} aria-label={`Level ${progress.level}`}>
      <div className={styles.badgeTop}>
        <span className={styles.levelChip}>
          <small>Level</small>
          {progress.level}
        </span>
        <span className={styles.xpText}>
          {progress.nextLevelXp == null ? 'Level maksimum' : `${progress.xpIntoLevel} / ${progress.nextLevelXp - progress.levelStartXp} XP`}
        </span>
      </div>
      <div
        className={styles.bar}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-label="Progres menuju level berikutnya"
      >
        <div className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
