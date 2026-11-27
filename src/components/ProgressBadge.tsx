'use client';

import { levelProgress } from '../game/progression';
import styles from './progression.module.css';

/** Circular HUD level + XP ring used on the title screen. */
export default function ProgressBadge({ xp }: { xp: number }) {
  const progress = levelProgress(xp);
  const percent = Math.round(progress.fraction * 100);
  const r = 42;
  const circ = 2 * Math.PI * r;
  const dashOffset = circ * (1 - progress.fraction);

  return (
    <div
      className={styles.ringBadge}
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={percent}
      aria-label={`Level ${progress.level}, ${percent}% menuju level berikutnya`}
    >
      <svg className={styles.ringSvg} viewBox="0 0 104 104" aria-hidden="true">
        <circle className={styles.ringOuter} cx="52" cy="52" r="49" />
        <circle className={styles.ringTrack} cx="52" cy="52" r={r} />
        <circle
          className={styles.ringFill}
          cx="52"
          cy="52"
          r={r}
          strokeDasharray={circ}
          strokeDashoffset={dashOffset}
        />
      </svg>
      <div className={styles.ringCenter}>
        <span className={styles.ringLevel}>LVL {progress.level}</span>
        <span className={styles.ringXp}>
          {progress.nextLevelXp == null
            ? 'MAX XP'
            : `${progress.xpIntoLevel} / ${progress.nextLevelXp - progress.levelStartXp} XP`}
        </span>
      </div>
    </div>
  );
}
