import type { CarSpec } from '../game/types';
import { statRatio } from '../game/data/cars';

const BARS: { key: 'topSpeed' | 'acceleration' | 'grip'; label: string }[] = [
  { key: 'topSpeed', label: 'Top' },
  { key: 'acceleration', label: 'Aksel' },
  { key: 'grip', label: 'Grip' },
];

export default function StatBars({ car, compact = false }: { car: CarSpec; compact?: boolean }) {
  return (
    <span className={`stat-bars ${compact ? 'is-compact' : ''}`} aria-label={`Stat ${car.name}`}>
      {BARS.map((bar) => {
        const value = Math.round(statRatio(car, bar.key) * 100);
        return (
          <span className="stat-row" key={bar.key}>
            <span className="stat-label">{bar.label}</span>
            <span
              className="stat-track"
              role="meter"
              aria-label={`${car.name} ${bar.label}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={value}
            >
              <span className="stat-fill" style={{ width: `${Math.max(10, value)}%` }} />
            </span>
          </span>
        );
      })}
    </span>
  );
}
