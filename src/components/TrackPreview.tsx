'use client';

import { useEffect, useRef } from 'react';
import type { Track } from '../game/types';

export default function TrackPreview({ track, className = '' }: { track: Track; className?: string }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = 176;
    const height = 104;
    canvas.width = width;
    canvas.height = height;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, width, height);

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const sample of track.samples) {
      minX = Math.min(minX, sample.x);
      maxX = Math.max(maxX, sample.x);
      minY = Math.min(minY, sample.y);
      maxY = Math.max(maxY, sample.y);
    }
    const padding = 12;
    const scale = Math.min((width - padding * 2) / (maxX - minX), (height - padding * 2) / (maxY - minY));
    const offsetX = (width - (maxX - minX) * scale) / 2;
    const offsetY = (height - (maxY - minY) * scale) / 2;
    const project = (x: number, y: number) => [offsetX + (x - minX) * scale, offsetY + (y - minY) * scale] as const;

    ctx.strokeStyle = '#f5ebd2';
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    for (let i = 0; i < track.samples.length; i += 5) {
      const sample = track.samples[i];
      const [x, y] = project(sample.x, sample.y);
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();
    ctx.globalAlpha = 1;

    const start = track.samples[0];
    const [sx, sy] = project(start.x, start.y);
    ctx.fillStyle = '#ff8f3d';
    ctx.fillRect(Math.round(sx) - 2, Math.round(sy) - 2, 4, 4);
    ctx.fillStyle = '#f5ebd2';
    ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1);
  }, [track]);

  return <canvas ref={ref} className={`track-preview ${className}`} aria-hidden="true" />;
}
