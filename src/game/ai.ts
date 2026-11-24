import type { PlayerInput, RacerState, Track } from './types';
import { getCar } from './data/cars';
import { clamp, shortestAngle } from './utils';
import { curvatureAt, pointAtDistance } from './track/geometry';

function playerProgress(racers: RacerState[], track: Track): number {
  const player = racers.find((racer) => racer.isPlayer);
  if (!player) return 0;
  return player.lap * track.length + player.s;
}

export function computeAiInput(
  racer: RacerState,
  racers: RacerState[],
  track: Track,
  time: number,
): PlayerInput {
  if (racer.finished) return { steer: 0, brake: false, nitro: false, pause: false };

  const spec = getCar(racer.carId);
  const speed = Math.hypot(racer.vx, racer.vy);
  const curvature = curvatureAt(track, racer.s + 26, 96);
  const curvatureFar = curvatureAt(track, racer.s + 84, 110);
  const maxCurve = Math.max(Math.abs(curvature), Math.abs(curvatureFar) * 0.85);
  const skill = racer.skill;

  const leaderProgress = playerProgress(racers, track);
  const ownProgress = racer.lap * track.length + racer.s;
  const catchUp = clamp((leaderProgress - ownProgress) / 2200, -0.032, 0.032);
  const speedFactor = skill * (1 + catchUp);

  let targetSpeed = spec.stats.topSpeed * speedFactor * (1 - clamp(maxCurve * 48, 0, 0.52));
  if (maxCurve > 0.012) targetSpeed *= 0.72;
  targetSpeed = Math.max(54, targetSpeed);

  const lookAhead = clamp(42 + speed * 0.55, 54, 142);
  let lateral = clamp(curvature * 2600, -18, 18);

  for (const other of racers) {
    if (other.id === racer.id || other.finished) continue;
    const dx = other.x - racer.x;
    const dy = other.y - racer.y;
    const forward = dx * Math.cos(racer.angle) + dy * Math.sin(racer.angle);
    const side = -dx * Math.sin(racer.angle) + dy * Math.cos(racer.angle);
    if (forward > 0 && forward < 72 && Math.abs(side) < 26) {
      lateral += side >= 0 ? -22 : 22;
      if (forward < 30) targetSpeed = Math.min(targetSpeed, speed * 0.72);
    }
  }

  const target = pointAtDistance(track, racer.s + lookAhead, clamp(lateral, -28, 28));
  const desiredAngle = Math.atan2(target.y - racer.y, target.x - racer.x);
  const angleError = shortestAngle(racer.angle, desiredAngle);
  let steer = clamp(angleError * 2.7, -1, 1);
  steer += clamp(lateral * 0.008, -0.12, 0.12);

  if (Math.abs(angleError) > 1.2 && speed < 28) {
    steer = angleError > 0 ? 1 : -1;
  }

  const brake = speed > targetSpeed + 7;
  const nitro =
    racer.nitro > 26 &&
    maxCurve < 0.0032 &&
    speed > spec.stats.topSpeed * 0.72 &&
    Math.sin(time * 0.85 + racer.skill * 17) > -0.1;

  return { steer, brake, nitro, pause: false };
}
