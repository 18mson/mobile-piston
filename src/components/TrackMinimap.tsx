'use client';

import { useEffect, useRef } from 'react';
import type { RaceSnapshot } from '../game/types';
import type { Track } from '../game/types';

export default function TrackMinimap({ snapshot, track }: { snapshot: RaceSnapshot | null; track: Track }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const width = canvas.width;
    const height = canvas.height;
    ctx.clearRect(0, 0, width, height);
    ctx.imageSmoothingEnabled = false;

    const padding = 7;
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
    const margin = 38;
    minX -= margin;
    maxX += margin;
    minY -= margin;
    maxY += margin;
    const scale = Math.min((width - padding * 2) / (maxX - minX), (height - padding * 2) / (maxY - minY));
    const offsetX = (width - (maxX - minX) * scale) / 2 - minX * scale;
    const offsetY = (height - (maxY - minY) * scale) / 2 - minY * scale;

    ctx.strokeStyle = 'rgba(245, 235, 210, 0.62)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let i = 0; i < track.samples.length; i += 4) {
      const sample = track.samples[i];
      const x = offsetX + sample.x * scale;
      const y = offsetY + sample.y * scale;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.stroke();

    if (!snapshot) return;
    for (const racer of snapshot.racers) {
      const x = offsetX + racer.x * scale;
      const y = offsetY + racer.y * scale;
      if (racer.isPlayer) {
        ctx.fillStyle = '#ff8f3d';
        ctx.fillRect(Math.round(x) - 2, Math.round(y) - 2, 4, 4);
        ctx.fillStyle = '#0c1820';
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      } else {
        ctx.fillStyle = '#f5ebd2';
        ctx.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
      }
    }
  }, [snapshot, track]);

  const player = snapshot?.racers.find((racer) => racer.isPlayer);
  return (
    <canvas
      ref={ref}
      className="minimap"
      width={132}
      height={78}
      role="img"
      aria-label={player ? `Peta lintasan ${track.name}. Kamu di posisi ${player.position} dari ${snapshot?.totalRacers ?? 6}.` : `Peta lintasan ${track.name}.`}
    />
  );
}
