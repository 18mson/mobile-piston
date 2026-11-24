import type { CarSpec, PlayerInput, RacerState, Track } from './types';
import { getCar } from './data/cars';
import { clamp } from './utils';
import { nearestOnTrack } from './track/geometry';

export const CAR_RADIUS = 7.6;

function applyTrackPenalty(racer: RacerState, track: Track, spec: CarSpec, dt: number): void {
  const hit = nearestOnTrack(track, racer.x, racer.y);
  const hardLimit = track.width / 2 + track.shoulder - CAR_RADIUS;
  const softLimit = track.width / 2 - CAR_RADIUS;

  if (hit.distance > hardLimit) {
    const side = hit.side >= 0 ? 1 : -1;
    racer.x = hit.x + hit.nx * hardLimit * side;
    racer.y = hit.y + hit.ny * hardLimit * side;
    const outwardX = hit.nx * side;
    const outwardY = hit.ny * side;
    const outwardSpeed = racer.vx * outwardX + racer.vy * outwardY;
    if (outwardSpeed > 0) {
      racer.vx -= outwardX * outwardSpeed * 1.18;
      racer.vy -= outwardY * outwardSpeed * 1.18;
      racer.vx *= 0.78;
      racer.vy *= 0.78;
      racer.impact = Math.max(racer.impact, Math.min(1, outwardSpeed / 110));
    }
  } else if (hit.distance > softLimit) {
    const slowdown = clamp((hit.distance - softLimit) / Math.max(1, track.shoulder), 0, 1);
    if (slowdown > 0) {
      racer.vx *= 1 - 0.9 * dt * slowdown;
      racer.vy *= 1 - 0.9 * dt * slowdown;
    }
  }

  racer.s = hit.s;
}

export function stepRacer(
  racer: RacerState,
  spec: CarSpec,
  track: Track,
  input: PlayerInput,
  dt: number,
): RacerState {
  racer.steer = clamp(input.steer, -1, 1);
  const speed = Math.hypot(racer.vx, racer.vy);
  const speedRatio = clamp(speed / spec.stats.topSpeed, 0, 1.2);

  let forward = racer.vx * Math.cos(racer.angle) + racer.vy * Math.sin(racer.angle);
  let lateral = -racer.vx * Math.sin(racer.angle) + racer.vy * Math.cos(racer.angle);

  const hitBefore = nearestOnTrack(track, racer.x, racer.y);
  const offroad = hitBefore.distance > track.width / 2 - CAR_RADIUS * 0.5;
  const wantNitro = input.nitro && racer.nitro > 0.5 && !racer.finished;

  racer.nitroActive = wantNitro;
  if (wantNitro) {
    racer.nitro = Math.max(0, racer.nitro - 34 * dt);
  }

  const topSpeed = spec.stats.topSpeed + (wantNitro ? spec.stats.nitroBoost : 0);
  const acceleration = spec.stats.acceleration + (wantNitro ? spec.stats.nitroAcceleration : 0);

  if (input.brake && !racer.finished) {
    if (forward > 0) {
      forward = Math.max(0, forward - 390 * dt);
    } else {
      forward = Math.max(-52, forward - 160 * dt);
    }
  } else {
    const engineFactor = offroad ? 0.6 : 1;
    if (forward < topSpeed) {
      forward = Math.min(topSpeed, forward + acceleration * engineFactor * dt);
    } else {
      forward *= 1 - 0.9 * dt;
    }
  }

  const drag = offroad ? 3.2 : 0.16;
  forward *= 1 - drag * dt;

  const steerGripLoss = 1 - Math.abs(racer.steer) * Math.min(0.48, speedRatio * 0.42);
  const brakeGripLoss = input.brake ? 0.58 : 1;
  const grip = spec.stats.grip * steerGripLoss * brakeGripLoss;
  lateral *= Math.exp(-grip * dt);

  if (Math.abs(lateral) > 18 && speed > 46 && !racer.finished) {
    racer.nitro = Math.min(100, racer.nitro + 7.5 * dt);
    racer.drifting = true;
  } else {
    racer.drifting = false;
  }

  const turnFactor = clamp(speed / 62, 0, 1) * (1 - Math.min(0.2, speedRatio * 0.17));
  racer.angle += racer.steer * spec.stats.steerRate * turnFactor * dt;
  racer.angle = Math.atan2(Math.sin(racer.angle), Math.cos(racer.angle));

  const maxSpeed = topSpeed + 12;
  const total = Math.hypot(forward, lateral);
  if (total > maxSpeed) {
    const scale = maxSpeed / total;
    forward *= scale;
    lateral *= scale;
  }

  racer.vx = Math.cos(racer.angle) * forward - Math.sin(racer.angle) * lateral;
  racer.vy = Math.sin(racer.angle) * forward + Math.cos(racer.angle) * lateral;

  racer.x += racer.vx * dt;
  racer.y += racer.vy * dt;

  applyTrackPenalty(racer, track, spec, dt);

  const pad = track.boostPads.find(
    (candidate) => Math.abs(candidate.distance - racer.s) < candidate.length && Math.abs(hitBefore.side - candidate.lateral) < 28,
  );
  if (pad && racer.padCooldown <= 0) {
    racer.nitro = Math.min(100, racer.nitro + 38);
    racer.padCooldown = 0.7;
  }
  racer.padCooldown = Math.max(0, racer.padCooldown - dt);
  racer.impact = Math.max(0, racer.impact - dt * 2.4);

  return racer;
}

export function resolveRacerCollisions(racers: RacerState[]): void {
  for (let i = 0; i < racers.length; i += 1) {
    for (let j = i + 1; j < racers.length; j += 1) {
      const a = racers[i];
      const b = racers[j];
      if (a.finished || b.finished) continue;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const distance = Math.hypot(dx, dy);
      const minDistance = CAR_RADIUS * 2;
      if (distance >= minDistance || distance < 0.0001) continue;

      const nx = dx / distance;
      const ny = dy / distance;
      const overlap = minDistance - distance;
      const massA = getCar(a.carId).stats.mass;
      const massB = getCar(b.carId).stats.mass;
      const totalMass = massA + massB;

      a.x -= nx * overlap * (massB / totalMass);
      a.y -= ny * overlap * (massB / totalMass);
      b.x += nx * overlap * (massA / totalMass);
      b.y += ny * overlap * (massA / totalMass);

      const relativeX = b.vx - a.vx;
      const relativeY = b.vy - a.vy;
      const approach = relativeX * nx + relativeY * ny;
      if (approach < 0) {
        const impulse = (-approach * 1.2) / totalMass;
        a.vx -= nx * impulse * massB;
        a.vy -= ny * impulse * massB;
        b.vx += nx * impulse * massA;
        b.vy += ny * impulse * massA;
        const strength = Math.min(1, Math.abs(approach) / 120);
        a.impact = Math.max(a.impact, strength);
        b.impact = Math.max(b.impact, strength);
      }
    }
  }
}

