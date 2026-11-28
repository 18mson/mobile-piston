'use client';

import { CARS, getCarPalette } from '../game/data/cars';
import type { CarId } from '../game/types';

/**
 * Compact 2D side-profile pixel/vector car sprite for track leaderboards.
 */
export default function CarSideBadge({
  carId,
  colorIndex = 0,
  className = '',
}: {
  carId: CarId;
  colorIndex?: number;
  className?: string;
}) {
  const car = CARS[carId] ?? CARS.mcqueen;
  const palette = getCarPalette(car.id, colorIndex);
  const wheelColor = palette.wheel;
  const rimColor = carId === 'mcqueen' || carId === 'chick' || carId === 'storm' ? palette.stripe : '#d9dfe6';

  if (carId === 'francesco') {
    return (
      <svg
        width="44"
        height="18"
        viewBox="0 0 44 18"
        className={className}
        shapeRendering="crispEdges"
        role="img"
        aria-label={car.name}
      >
        <rect x="4" y="4" width="5" height="2" fill={palette.body} />
        <rect x="6" y="6" width="2" height="4" fill="#2e3742" />
        <rect x="9" y="8" width="12" height="5" fill={palette.body} />
        <rect x="19" y="6" width="5" height="3" fill={palette.shade} />
        <rect x="21" y="9" width="16" height="4" fill={palette.body} />
        <rect x="18" y="9" width="14" height="1.5" fill={palette.stripe} />
        <rect x="35" y="10" width="6" height="3" fill={palette.highlight} />
        <circle cx="11" cy="13" r="4.2" fill={wheelColor} />
        <circle cx="11" cy="13" r="2" fill={rimColor} />
        <circle cx="32" cy="13.5" r="3.6" fill={wheelColor} />
        <circle cx="32" cy="13.5" r="1.7" fill={rimColor} />
      </svg>
    );
  }

  if (carId === 'mater') {
    return (
      <svg
        width="44"
        height="18"
        viewBox="0 0 44 18"
        className={className}
        shapeRendering="crispEdges"
        role="img"
        aria-label={car.name}
      >
        <rect x="5" y="9" width="14" height="4" fill={palette.shade} />
        <path d="M12 9 L6 4 L5 6" stroke="#2e3742" strokeWidth="1.6" fill="none" />
        <rect x="19" y="3" width="12" height="10" fill={palette.body} />
        <rect x="21" y="4.5" width="7" height="4.5" fill={palette.glass} />
        <rect x="31" y="7" width="8" height="6" fill={palette.body} />
        <rect x="20" y="9" width="18" height="1.5" fill={palette.stripe} />
        <circle cx="11" cy="13.2" r="4" fill={wheelColor} />
        <circle cx="11" cy="13.2" r="1.8" fill={rimColor} />
        <circle cx="33" cy="13.5" r="3.5" fill={wheelColor} />
        <circle cx="33" cy="13.5" r="1.6" fill={rimColor} />
      </svg>
    );
  }

  if (carId === 'guido') {
    return (
      <svg
        width="44"
        height="18"
        viewBox="0 0 44 18"
        className={className}
        shapeRendering="crispEdges"
        role="img"
        aria-label={car.name}
      >
        <rect x="10" y="8" width="18" height="6" fill={palette.body} />
        <rect x="13" y="3" width="12" height="6" fill={palette.glass} />
        <rect x="12" y="2.5" width="14" height="1.5" fill={palette.highlight} />
        <rect x="29" y="3" width="2" height="11" fill="#2e3742" />
        <rect x="31" y="11" width="6" height="2" fill="#9aa4b0" />
        <circle cx="14" cy="14" r="3.2" fill={wheelColor} />
        <circle cx="14" cy="14" r="1.5" fill={rimColor} />
        <circle cx="25" cy="14" r="3.2" fill={wheelColor} />
        <circle cx="25" cy="14" r="1.5" fill={rimColor} />
      </svg>
    );
  }

  const hasWing = carId === 'mcqueen' || carId === 'cruz' || carId === 'storm' || carId === 'sally';
  const compact = carId === 'luigi';

  return (
    <svg
      width="44"
      height="18"
      viewBox="0 0 44 18"
      className={className}
      shapeRendering="crispEdges"
      role="img"
      aria-label={car.name}
    >
      {hasWing && <rect x="4" y="5" width="5" height="2" fill={palette.stripe} />}
      <path
        d={
          compact
            ? 'M8 13 L8 8 L13 4 L27 4 L33 8 L36 10 L36 13 Z'
            : 'M5 13 L6 8 L13 4 L25 4 L31 8 L39 9.5 L39 13 Z'
        }
        fill={palette.body}
      />
      <rect
        x={compact ? 14 : 13}
        y="5"
        width={compact ? 12 : 12}
        height="3.5"
        fill={palette.glass}
      />
      <rect x={compact ? 20 : 20} y="4.8" width="2" height="4" fill={palette.body} />
      <rect x={compact ? 10 : 8} y="10" width={compact ? 24 : 28} height="1.5" fill={palette.stripe} />
      <circle cx={compact ? 13 : 12} cy="13.5" r="3.6" fill={wheelColor} />
      <circle cx={compact ? 13 : 12} cy="13.5" r="1.6" fill={rimColor} />
      <circle cx={compact ? 30 : 32} cy="13.5" r="3.6" fill={wheelColor} />
      <circle cx={compact ? 30 : 32} cy="13.5" r="1.6" fill={rimColor} />
    </svg>
  );
}
