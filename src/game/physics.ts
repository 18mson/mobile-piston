import type { CarSpec, PlayerInput, RacerState, Track } from './types';
import { getCar } from './data/cars';
import { clamp } from './utils';
import { nearestOnTrack, sampleAtDistance } from './track/geometry';

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
      racer.vx -= outwardX * outwardSpeed * 1.2;
      racer.vy -= outwardY * outwardSpeed * 1.2;
      racer.vx *= 0.68;
      racer.vy *= 0.68;
      racer.impact = Math.max(racer.impact, Math.min(1, outwardSpeed / 90));
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

  const hitBefore = nearestOnTrack(track, racer.x, racer.y);
  const offroad = hitBefore.distance > track.width / 2 - CAR_RADIUS * 0.5;
  const wantNitro = input.nitro && racer.nitro > 0.5 && !racer.finished;

  racer.nitroActive = wantNitro;
  if (wantNitro) {
    racer.nitro = Math.max(0, racer.nitro - 34 * dt);
  }

  const topSpeed = spec.stats.topSpeed + (wantNitro ? spec.stats.nitroBoost : 0);
  const acceleration = spec.stats.acceleration + (wantNitro ? spec.stats.nitroAcceleration : 0);

  // Circuit Superstars vehicle dynamics:
  // 1. Steering turns the car's heading first
  const isBraking = Boolean(input.brake && !racer.finished);
  const isCoasting = input.gas === false && !isBraking && !racer.finished;
  // Weight transfer: braking or lifting off gas shifts weight forward for crisp turn-in
  const weightTransferAuthority = isBraking ? 1.38 : (isCoasting ? 1.18 : 1.0);
  // High speed understeer: carrying full speed into a turn pushes the front tires wide
  const highSpeedUndersteer = 1.0 - Math.min(0.40, speedRatio * 0.38);
  const turnFactor = clamp(speed / 36, 0, 1) * highSpeedUndersteer * weightTransferAuthority;
  racer.angle += racer.steer * spec.stats.steerRate * turnFactor * dt;
  racer.angle = Math.atan2(Math.sin(racer.angle), Math.cos(racer.angle));

  // 2. Decompose existing momentum into car-local forward and lateral velocity relative to new heading
  let forward = racer.vx * Math.cos(racer.angle) + racer.vy * Math.sin(racer.angle);
  let lateral = -racer.vx * Math.sin(racer.angle) + racer.vy * Math.cos(racer.angle);

  // 3. Engine acceleration with progressive power curve (climbs 0-100 punchily and builds to top speed)
  const engineFactor = offroad ? 0.6 : 1;
  const speedFraction = clamp(forward / topSpeed, 0, 1);
  const powerCurve = Math.max(0.18, 1.0 - Math.pow(speedFraction, 1.3));
  const effectiveAcceleration = acceleration * powerCurve * engineFactor;

  if (isBraking) {
    if (forward > 0) {
      forward = Math.max(0, forward - 390 * dt);
    } else {
      forward = Math.max(-56, forward - 170 * dt);
    }
  } else if (isCoasting) {
    // Lepas gas: gentle engine braking allowing player to set up corner entry without hard braking
    forward *= 1 - 0.55 * dt;
  } else {
    // Throttle applied (manual gas or auto-gas)
    if (forward < topSpeed) {
      forward += effectiveAcceleration * dt;
      if (forward > topSpeed) forward = topSpeed;
    } else {
      forward *= 1 - 0.75 * dt;
    }
  }

  const drag = offroad ? 3.0 : 0.05;
  forward *= 1 - drag * dt;

  // 4. Tire traction and cornering slip (Circuit Superstars feel)
  // Tires have a grip threshold. If entering too fast without braking, the car breaks into a real slide
  // that persists across the road, and only the sliding tires scrub forward speed.
  const slipSpeed = Math.abs(lateral);
  const gripThreshold = 18.0 + spec.stats.grip * 1.5;

  if (slipSpeed <= gripThreshold) {
    // Clean grip: car carries full speed through turn without artificial slowdown
    const gripRate = spec.stats.grip * 1.25;
    lateral *= Math.exp(-gripRate * dt);
    racer.drifting = false;
  } else {
    // Excess slip: car slides sideways (understeer / drift push)
    const excessSlip = slipSpeed - gripThreshold;
    const slipRatio = Math.min(2.5, excessSlip / 28);

    // Restoring damping drops to kinetic sliding friction so slide persists visibly
    const slideGrip = spec.stats.grip * 0.42;
    lateral *= Math.exp(-slideGrip * dt);

    // Kinetic tire scrub drag: bleeds forward speed only while actively sliding
    const scrubRate = Math.min(1.8, Math.pow(slipRatio, 1.25) * 1.05);
    forward *= Math.max(0.35, 1.0 - scrubRate * dt);

    if (excessSlip > 3 && speed > 48 && !racer.finished) {
      racer.nitro = Math.min(100, racer.nitro + 9.5 * dt);
      racer.drifting = true;
    } else {
      racer.drifting = false;
    }
  }

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

  // Wrong way detection
  const trackHeadingSample = sampleAtDistance(track, racer.s);
  const forwardX = trackHeadingSample.tx;
  const forwardY = trackHeadingSample.ty;
  const headingX = Math.cos(racer.angle);
  const headingY = Math.sin(racer.angle);
  const alignment = headingX * forwardX + headingY * forwardY;

  if (speed > 16 && alignment < -0.28) {
    racer.wrongWayTime = (racer.wrongWayTime || 0) + dt;
    if (racer.wrongWayTime > 0.35) {
      racer.wrongWay = true;
    }
  } else {
    racer.wrongWayTime = Math.max(0, (racer.wrongWayTime || 0) - dt * 2.2);
    if (racer.wrongWayTime <= 0.08) {
      racer.wrongWay = false;
    }
  }

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
        const impulse = (-approach * 1.25) / totalMass;
        a.vx -= nx * impulse * massB;
        a.vy -= ny * impulse * massB;
        b.vx += nx * impulse * massA;
        b.vy += ny * impulse * massA;
        const strength = Math.min(1, Math.abs(approach) / 100);
        // Circuit Superstars collision slowdown: kinetic energy dissipation
        const slowdown = 1.0 - Math.min(0.42, strength * 0.36);
        a.vx *= slowdown;
        a.vy *= slowdown;
        b.vx *= slowdown;
        b.vy *= slowdown;
        a.impact = Math.max(a.impact, strength);
        b.impact = Math.max(b.impact, strength);
      }
    }
  }
}

