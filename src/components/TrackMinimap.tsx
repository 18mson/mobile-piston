'use client';

import { useEffect, useRef } from 'react';
import type { RaceSnapshot, Track } from '../game/types';

export default function TrackMinimap({
  snapshot,
  track,
}: {
  snapshot: RaceSnapshot | null;
  track: Track;
}) {
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

    const cx = width / 2;
    const cy = height / 2;
    const radarRadius = Math.min(width, height) / 2 - 4;

    const playerRacer = snapshot?.racers.find((r) => r.isPlayer);
    const px = snapshot?.playerX ?? playerRacer?.x ?? track.startPoint.x;
    const py = snapshot?.playerY ?? playerRacer?.y ?? track.startPoint.y;
    const pAngle = snapshot?.playerAngle ?? 0;

    // Dynamic rotation: car heading always points straight UP (-Y)
    const rot = -pAngle - Math.PI / 2;
    const cosR = Math.cos(rot);
    const sinR = Math.sin(rot);
    // Zoomed radius: ~195 world units around player
    const viewRange = 195;
    const scale = radarRadius / viewRange;
    const roadWidthPx = Math.max(12, track.width * scale);
    const shoulderWidthPx = Math.max(roadWidthPx + 4, (track.width + track.shoulder * 1.4) * scale);

    // 1. Radar background with circular clipping (semi-transparent so 3D world peeks through)
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
    ctx.clip();

    ctx.fillStyle = 'rgba(10, 20, 29, 0.42)';
    ctx.fillRect(0, 0, width, height);

    // Range rings & crosshairs
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, radarRadius * 0.52, 0, Math.PI * 2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(cx - radarRadius, cy);
    ctx.lineTo(cx + radarRadius, cy);
    ctx.moveTo(cx, cy - radarRadius);
    ctx.lineTo(cx, cy + radarRadius);
    ctx.stroke();

    // 2. Local track ribbon segments within radar range
    const maxRange = viewRange * 1.35;
    const segments: { sx: number; sy: number }[][] = [];
    let currentSeg: { sx: number; sy: number }[] = [];

    const sampleCount = track.samples.length;
    for (let i = 0; i <= sampleCount; i += 1) {
      const sample = track.samples[i % sampleCount];
      const dx = sample.x - px;
      const dy = sample.y - py;
      const dist = Math.hypot(dx, dy);

      if (dist <= maxRange) {
        const rx = dx * cosR - dy * sinR;
        const ry = dx * sinR + dy * cosR;
        currentSeg.push({ sx: cx + rx * scale, sy: cy + ry * scale });
      } else {
        if (currentSeg.length > 1) {
          segments.push(currentSeg);
        }
        currentSeg = [];
      }
    }
    if (currentSeg.length > 1) {
      segments.push(currentSeg);
    }

    // Outer road shoulder / crisp dark outline scaled to actual track width
    ctx.strokeStyle = 'rgba(12, 22, 30, 0.88)';
    ctx.lineWidth = shoulderWidthPx;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (const seg of segments) {
      ctx.beginPath();
      seg.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.sx, pt.sy) : ctx.lineTo(pt.sx, pt.sy)));
      ctx.stroke();
    }

    // Asphalt surface scaled to actual track.width
    ctx.strokeStyle = 'rgba(54, 78, 96, 0.92)';
    ctx.lineWidth = roadWidthPx;
    for (const seg of segments) {
      ctx.beginPath();
      seg.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.sx, pt.sy) : ctx.lineTo(pt.sx, pt.sy)));
      ctx.stroke();
    }

    // High-visibility centerline
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.85)';
    ctx.lineWidth = 1.6;
    for (const seg of segments) {
      ctx.beginPath();
      seg.forEach((pt, idx) => (idx === 0 ? ctx.moveTo(pt.sx, pt.sy) : ctx.lineTo(pt.sx, pt.sy)));
      ctx.stroke();
    }

    // Start / finish gate tick if nearby
    const s0 = track.samples[0];
    const s0dx = s0.x - px;
    const s0dy = s0.y - py;
    if (Math.hypot(s0dx, s0dy) <= maxRange) {
      const s0rx = s0dx * cosR - s0dy * sinR;
      const s0ry = s0dx * sinR + s0dy * cosR;
      const s0x = cx + s0rx * scale;
      const s0y = cy + s0ry * scale;
      const s0nx = -s0.ty * cosR - s0.tx * sinR;
      const s0ny = -s0.ty * sinR + s0.tx * cosR;
      ctx.strokeStyle = '#ffe44d';
      ctx.lineWidth = 2.8;
      ctx.beginPath();
      const gateHalf = roadWidthPx * 0.5;
      ctx.moveTo(s0x - s0nx * gateHalf, s0y - s0ny * gateHalf);
      ctx.lineTo(s0x + s0nx * gateHalf, s0y + s0ny * gateHalf);
      ctx.stroke();
    }

    // 3. Nearby opponent cars
    if (snapshot) {
      for (const racer of snapshot.racers) {
        if (racer.isPlayer) continue;
        const rdx = racer.x - px;
        const rdy = racer.y - py;
        if (Math.hypot(rdx, rdy) > maxRange) continue;
        const rrx = rdx * cosR - rdy * sinR;
        const rry = rdx * sinR + rdy * cosR;
        const rx = cx + rrx * scale;
        const ry = cy + rry * scale;

        ctx.fillStyle = '#081016';
        ctx.fillRect(Math.round(rx) - 2.5, Math.round(ry) - 2.5, 5, 5);
        ctx.fillStyle = '#f0f5fa';
        ctx.fillRect(Math.round(rx) - 1.5, Math.round(ry) - 1.5, 3, 3);
      }
    }

    // 4. Player car fixed at center, pointing straight UP
    ctx.fillStyle = '#ff8f3d';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 7);
    ctx.lineTo(cx + 4.5, cy + 4.5);
    ctx.lineTo(cx, cy + 2);
    ctx.lineTo(cx - 4.5, cy + 4.5);
    ctx.closePath();
    ctx.fill();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 1, cy - 2, 2, 2);

    ctx.restore();

    // 5. Bezel and forward heading indicator
    ctx.strokeStyle = 'rgba(255, 143, 61, 0.75)';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.arc(cx, cy, radarRadius, 0, Math.PI * 2);
    ctx.stroke();

    ctx.fillStyle = '#ff8f3d';
    ctx.beginPath();
    ctx.moveTo(cx, cy - radarRadius - 2);
    ctx.lineTo(cx - 4, cy - radarRadius + 5);
    ctx.lineTo(cx + 4, cy - radarRadius + 5);
    ctx.closePath();
    ctx.fill();
  }, [snapshot, track]);

  return (
    <canvas
      ref={ref}
      className="minimap"
      width={148}
      height={148}
      role="img"
      aria-label={`Radar radar pelacak lintasan ${track.name}.`}
    />
  );
}
