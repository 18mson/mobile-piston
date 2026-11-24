'use client';

import { useEffect, useRef, useState } from 'react';
import type { CarSpec } from '../game/types';
import { drawCarPreview } from '../game/render/sprites';
import { getCarPreview } from '../game/render3d/preview';

export default function CarThumb({
  car,
  number = 1,
  scale = 4,
  className = '',
}: {
  car: CarSpec;
  number?: number;
  scale?: number;
  className?: string;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const [preview, setPreview] = useState<string | null>(null);

  useEffect(() => {
    if (ref.current) {
      drawCarPreview(ref.current, car.id, car.palette, number, scale);
    }
    setPreview(getCarPreview(car, number));
  }, [car, number, scale]);

  if (preview) {
    return (
      <img
        className={`car-thumb ${className}`}
        src={preview}
        width={256}
        height={256}
        alt=""
        aria-hidden="true"
      />
    );
  }

  return (
    <canvas
      ref={ref}
      className={`car-thumb ${className}`}
      width={34 * scale}
      height={34 * scale}
      aria-hidden="true"
    />
  );
}
