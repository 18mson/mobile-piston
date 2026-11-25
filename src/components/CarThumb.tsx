'use client';

import { useEffect, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import type { CarSpec } from '../game/types';
import { drawCarPreview } from '../game/render/sprites';
import { renderCarPreview3D } from '../game/render3d/preview';

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
  const yawRef = useRef(0.35);
  const pitchRef = useRef(0.38);
  const draggingRef = useRef(false);
  const lastPointerRef = useRef<{ x: number; y: number } | null>(null);
  const [dragging, setDragging] = useState(false);

  useEffect(() => {
    let raf = 0;
    let lastTime = performance.now();
    let webglOk = true;

    const frame = (now: number) => {
      const dt = Math.min(0.05, (now - lastTime) / 1000);
      lastTime = now;
      if (!draggingRef.current) {
        yawRef.current += dt * 0.65;
      }
      const canvas = ref.current;
      if (canvas) {
        if (webglOk) {
          const ok = renderCarPreview3D(canvas, car, number, yawRef.current, pitchRef.current);
          if (!ok) {
            webglOk = false;
            drawCarPreview(canvas, car.id, car.palette, number, scale);
          }
        }
      }
      if (webglOk) {
        raf = requestAnimationFrame(frame);
      }
    };

    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [car, number, scale]);

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    draggingRef.current = true;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    setDragging(true);
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (!draggingRef.current || !lastPointerRef.current) return;
    const dx = event.clientX - lastPointerRef.current.x;
    const dy = event.clientY - lastPointerRef.current.y;
    lastPointerRef.current = { x: event.clientX, y: event.clientY };
    yawRef.current += dx * 0.012;
    pitchRef.current = Math.max(0.15, Math.min(0.85, pitchRef.current + dy * 0.008));
  };

  const stopDrag = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    draggingRef.current = false;
    lastPointerRef.current = null;
    setDragging(false);
  };

  return (
    <canvas
      ref={ref}
      className={`car-thumb car-thumb-3d ${className}`}
      width={256}
      height={256}
      data-dragging={dragging}
      aria-label={`Preview 3D ${car.name}, geser untuk memutar`}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={stopDrag}
      onPointerCancel={stopDrag}
      onLostPointerCapture={() => {
        draggingRef.current = false;
        lastPointerRef.current = null;
        setDragging(false);
      }}
    />
  );
}
