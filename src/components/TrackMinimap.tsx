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

    const buildPath = () => {
      ctx.beginPath();
      for (let i = 0; i < track.samples.length; i += 4) {
        const sample = track.samples[i];
        const x = offsetX + sample.x * scale;
        const y = offsetY + sample.y * scale;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
    };

    // Layer 1: Road shoulder / dark border
    ctx.strokeStyle = '#121e27';
    ctx.lineWidth = 7;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    buildPath();
    ctx.stroke();

    // Layer 2: Asphalt surface
    ctx.strokeStyle = '#2d3f4d';
    ctx.lineWidth = 4.5;
    buildPath();
    ctx.stroke();

    // Layer 3: Crisp high-contrast centerline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.45)';
    ctx.lineWidth = 1.0;
    buildPath();
    ctx.stroke();

    // Start / finish gate tick mark
    const s0 = track.samples[0];
    const s0x = offsetX + s0.x * scale;
    const s0y = offsetY + s0.y * scale;
    ctx.strokeStyle = '#ffe44d';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.moveTo(s0x - s0.ny * 4.5, s0y + s0.nx * 4.5);
    ctx.lineTo(s0x + s0.ny * 4.5, s0y - s0.nx * 4.5);
    ctx.stroke();

    if (!snapshot) return;

    // AI Racers: crisp white dots with dark outline
    for (const racer of snapshot.racers) {
      if (racer.isPlayer) continue;
      const x = Math.round(offsetX + racer.x * scale);
      const y = Math.round(offsetY + racer.y * scale);
      ctx.fillStyle = '#081016';
      ctx.fillRect(x - 2, y - 2, 5, 5);
      ctx.fillStyle = '#e8edf2';
      ctx.fillRect(x - 1, y - 1, 3, 3);
    }

    // Player: prominent neon orange marker with bright center
    const playerRacer = snapshot.racers.find((r) => r.isPlayer);
    if (playerRacer) {
      const px = Math.round(offsetX + playerRacer.x * scale);
      const py = Math.round(offsetY + playerRacer.y * scale);
      ctx.fillStyle = '#000000';
      ctx.fillRect(px - 4, py - 4, 8, 8);
      ctx.fillStyle = '#ff8f3d';
      ctx.fillRect(px - 3, py - 3, 6, 6);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(px - 1, py - 1, 2, 2);
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
