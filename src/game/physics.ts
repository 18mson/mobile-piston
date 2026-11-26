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
      racer.impactKind = 'wall';
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

// ---------------------------------------------------------------------------
// Vehicle dynamics (semi-realistic, Circuit Superstars-style)
//
// Bicycle model with a yaw-rate state, per-axle tire slip angles and a tire
// force curve that has a PEAK and then falls off:
//   - turn too hard / too fast without braking  -> front or rear tires pass the peak
//     and the car slides (drift) or rotates (spin-out)
//   - lift off / brake  -> weight moves to the front: sharper turn-in, rear gets lighter
//   - throttle in a corner -> rear tires lose lateral grip (power oversteer)
//   - braking early keeps speed below the grip limit -> clean, fast corner
// ---------------------------------------------------------------------------
const LF = 7; // CG -> front axle (world units)
const LR = 7.5; // CG -> rear axle
const YAW_INERTIA = 58; // per unit mass
const GRIP_SCALE = 25; // lateral accel (units/s^2) per point of the car's `grip` stat
const SLIP_PEAK = 0.13; // tire slip angle (rad) at which lateral force peaks
const SLIDE_FORCE = 0.86; // fraction of peak force that remains when fully sliding
const SPIN_ANGLE = 0.95; // body slip angle (rad) beyond which the car is "spinning out"
const PHYSICS_SUBSTEPS = 2;

/** Max front-wheel steering angle (rad). Shrinks with speed like real steering. */
export function maxSteerAngle(spec: CarSpec, speed: number): number {
  const base = 0.62 * (spec.stats.steerRate / 2.7);
  return base / (1 + Math.pow(speed / 95, 1.6));
}

/** Lateral acceleration (units/s^2) the car can sustain at a given speed with fresh tires. */
export function lateralGripAt(spec: CarSpec, speed: number): number {
  const r = clamp(speed / spec.stats.topSpeed, 0, 1.3);
  return spec.stats.grip * GRIP_SCALE * (1 + 0.22 * r * r);
}

/** Tire force curve: rises to a peak at SLIP_PEAK, then drops to sliding friction. */
function tireCurve(slip: number): number {
  const x = Math.abs(slip) / SLIP_PEAK;
  if (x <= 1) return 2 * x - x * x;
  return Math.max(SLIDE_FORCE, 1 - ((x - 1) * (1 - SLIDE_FORCE)) / 1.4);
}

export function stepRacer(
  racer: RacerState,
  spec: CarSpec,
  track: Track,
  input: PlayerInput,
  dt: number,
): RacerState {
  const speed = Math.hypot(racer.vx, racer.vy);
  const speedRatio = clamp(speed / spec.stats.topSpeed, 0, 1.2);

  const hitBefore = nearestOnTrack(track, racer.x, racer.y);
  const offroadRatio = clamp((hitBefore.distance - (track.width / 2 - 2)) / (CAR_RADIUS * 2.2), 0, 1);
  racer.offroad = offroadRatio > 0.15;
  const wantNitro = input.nitro && racer.nitro > 0.5 && !racer.finished;

  racer.nitroActive = wantNitro;
  if (wantNitro) {
    racer.nitro = Math.max(0, racer.nitro - 34 * dt);
  }

  const topSpeed = spec.stats.topSpeed + (wantNitro ? spec.stats.nitroBoost : 0);
  const acceleration = spec.stats.acceleration + (wantNitro ? spec.stats.nitroAcceleration : 0);

  const isBraking = Boolean(input.brake && !racer.finished);
  const isCoasting = input.gas === false && !isBraking && !racer.finished;
  const onThrottle = !isBraking && !isCoasting && !racer.finished;
  const brakeWhileThrottle = isBraking && input.gas !== false;

  // 1. Car-local velocity (forward / lateral) in the current heading
  const cosA0 = Math.cos(racer.angle);
  const sinA0 = Math.sin(racer.angle);
  let forward = racer.vx * cosA0 + racer.vy * sinA0;
  let lateral = -racer.vx * sinA0 + racer.vy * cosA0;
  let yaw = racer.yawRate ?? 0;
  const forwardBefore = forward;

  // 2. Longitudinal: engine / brake / coast / drag (progressive slowdown as more tires touch dirt)
  const engineFactor = 1 - offroadRatio * 0.22;
  const speedFraction = clamp(forward / topSpeed, 0, 1);
  const powerCurve = Math.max(0.18, 1.0 - Math.pow(speedFraction, 1.3));
  const effectiveAcceleration = acceleration * powerCurve * engineFactor;

  if (isBraking) {
    if (forward > 0) {
      // Progressive braking: gentler deceleration when gas is still held (trail-braking)
      const brakeDecel = brakeWhileThrottle ? 135 : 210;
      const minFloor = brakeWhileThrottle ? 18 : 0;
      forward = Math.max(minFloor, forward - brakeDecel * dt);
    } else if (!brakeWhileThrottle) {
      forward = Math.max(-56, forward - 140 * dt);
    }
  } else if (isCoasting) {
    forward *= 1 - 0.55 * dt;
  } else if (!racer.finished) {
    if (forward < topSpeed) {
      forward += effectiveAcceleration * dt;
      if (forward > topSpeed) forward = topSpeed;
    } else {
      forward *= 1 - 0.75 * dt;
    }
  }
  const drag = 0.05 + offroadRatio * 0.95;
  forward *= 1 - drag * dt;

  // 3. Weight transfer (smoothed longitudinal acceleration). Braking / lift-off -> front is loaded.
  const longAccel = (forward - forwardBefore) / dt;
  const smoothedAccel = (racer.longAccel ?? 0) + (longAccel - (racer.longAccel ?? 0)) * Math.min(1, dt * 7);
  racer.longAccel = smoothedAccel;
  const liftOff = isCoasting ? 0.03 : 0;
  const loadShift = clamp(-smoothedAccel / 2800, -0.06, 0.1) + liftOff; // + = more on the front

  // 4. Per-axle lateral grip budget
  const gripBudget = lateralGripAt(spec, speed) * (1 - offroadRatio * 0.32);
  const throttleLoss = onThrottle ? (0.07 + 0.11 * clamp(speedRatio, 0, 1)) * (wantNitro ? 1.25 : 1) : 0;
  const brakeLoss = isBraking ? 0.04 : 0;
  const frontCap = gripBudget * (0.5 + loadShift);
  const rearCap = gripBudget * (0.5 - loadShift) * (1 - throttleLoss - brakeLoss) * (spec.stats.rearGrip ?? 1);

  // 5. Steering angle (+ automatic counter-steer so a slide is catchable on a keyboard)
  const steerInput = clamp(input.steer, -1, 1);
  const refSpeed = Math.max(Math.abs(forward), 30);
  const bodySlip = Math.atan2(lateral, refSpeed);
  const spinning = Math.abs(bodySlip) > SPIN_ANGLE && speed > 28;
  const authority = spinning ? 0.35 : 1;
  let delta = steerInput * maxSteerAngle(spec, speed) * authority;
  let assist = 0;
  if (!spinning && speed > 40 && !racer.finished) {
    const dead = 0.10;
    const excess = Math.abs(bodySlip) - dead;
    const assistGain = spec.stats.slideAssist ?? 1;
    if (excess > 0) assist = Math.sign(bodySlip) * Math.min(0.42 * assistGain, excess * 1.4 * assistGain);
  }
  delta = clamp(delta + assist, -0.7, 0.7);
  racer.steer = clamp(steerInput * 0.55 + assist / 0.4, -1, 1);

  // 6. Lateral + yaw dynamics (sub-stepped; stiff tire model)
  const h = dt / PHYSICS_SUBSTEPS;
  const tanD = Math.tan(delta);
  const sinD = Math.sin(delta);
  const cosD = Math.cos(delta);
  let angle = racer.angle;
  let frontSlip = 0;
  let rearSlip = 0;
  for (let i = 0; i < PHYSICS_SUBSTEPS; i += 1) {
    const ref = Math.max(Math.abs(forward), 30);
    const slipVelFront = lateral + yaw * LF - forward * tanD;
    const slipVelRear = lateral - yaw * LR;
    frontSlip = Math.atan2(slipVelFront, ref);
    rearSlip = Math.atan2(slipVelRear, ref);
    const forceFront = -Math.sign(slipVelFront) * frontCap * tireCurve(frontSlip);
    const forceRear = -Math.sign(slipVelRear) * rearCap * tireCurve(rearSlip);

    const latAccel = forceFront * cosD + forceRear - yaw * forward;
    const yawAccel = (LF * forceFront * cosD - LR * forceRear) / YAW_INERTIA;
    const fwdCoupling = yaw * lateral - forceFront * sinD;

    lateral += latAccel * h;
    yaw += yawAccel * h;
    forward += fwdCoupling * h;
    angle += yaw * h;
  }
  // low-speed stabiliser so the car doesn't pirouette forever once it has nearly stopped
  if (speed < 50) {
    yaw *= Math.exp(-3.2 * (1 - speed / 50) * dt);
  }
  if (offroadRatio > 0) lateral *= Math.exp(-0.9 * offroadRatio * dt);

  // 7. Sliding scrubs speed (tires pushing sideways instead of gripping)
  const frontSat = Math.max(0, Math.abs(frontSlip) / SLIP_PEAK - 1);
  const rearSat = Math.max(0, Math.abs(rearSlip) / SLIP_PEAK - 1);
  const sat = clamp(Math.max(frontSat, rearSat), 0, 2.5);
  if (sat > 0 && forward > 0) {
    forward = Math.max(0, forward - gripBudget * 0.26 * Math.min(1, sat) * dt - sat * 18 * dt);
  }

  // drift flag (skid marks / smoke / tyre audio / nitro reward only while it is still a controlled slide)
  const sliding = Math.max(Math.abs(frontSlip), Math.abs(rearSlip)) > SLIP_PEAK * 1.12;
  racer.drifting = Boolean(sliding && speed > 40 && !racer.finished);
  if (racer.drifting && !spinning && speed > 48) {
    racer.nitro = Math.min(100, racer.nitro + 9.5 * (spec.stats.driftBoost ?? 1) * dt);
  }

  const maxSpeed = topSpeed + 12;
  const total = Math.hypot(forward, lateral);
  if (total > maxSpeed) {
    const scale = maxSpeed / total;
    forward *= scale;
    lateral *= scale;
  }

  racer.angle = Math.atan2(Math.sin(angle), Math.cos(angle));
  racer.yawRate = yaw;
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

  // Wrong way detection (based on where the nose points, but ignore spin-outs)
  const trackHeadingSample = sampleAtDistance(track, racer.s);
  const forwardX = trackHeadingSample.tx;
  const forwardY = trackHeadingSample.ty;
  const headingX = Math.cos(racer.angle);
  const headingY = Math.sin(racer.angle);
  const alignment = headingX * forwardX + headingY * forwardY;
  const travelAlignment = speed > 1 ? (racer.vx * forwardX + racer.vy * forwardY) / speed : 1;

  if (speed > 16 && alignment < -0.28 && travelAlignment < 0.2) {
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
  const AXLE_OFFSET = 5.2;
  const CIRCLE_RADIUS = 6.6;
  const MIN_CIRCLE_DIST = CIRCLE_RADIUS * 2;
  const MIN_CENTER_DIST = CAR_RADIUS * 2;

  for (let i = 0; i < racers.length; i += 1) {
    for (let j = i + 1; j < racers.length; j += 1) {
      const a = racers[i];
      const b = racers[j];
      if (a.finished || b.finished) continue;

      const cdx = b.x - a.x;
      const cdy = b.y - a.y;
      const cDist = Math.hypot(cdx, cdy);
      // Fast broadphase cull: if cars are farther than diagonal extent, they cannot collide
      if (cDist > 32) continue;

      // Dual-circle capsule representation: front and rear collision centers
      const cosA = Math.cos(a.angle);
      const sinA = Math.sin(a.angle);
      const cosB = Math.cos(b.angle);
      const sinB = Math.sin(b.angle);

      const afx = a.x + cosA * AXLE_OFFSET;
      const afy = a.y + sinA * AXLE_OFFSET;
      const arx = a.x - cosA * AXLE_OFFSET;
      const ary = a.y - sinA * AXLE_OFFSET;

      const bfx = b.x + cosB * AXLE_OFFSET;
      const bfy = b.y + sinB * AXLE_OFFSET;
      const brx = b.x - cosB * AXLE_OFFSET;
      const bry = b.y - sinB * AXLE_OFFSET;

      let maxOverlap = 0;
      let nx = 0;
      let ny = 0;

      // Check all 4 front/rear circle pairings to prevent bumper/corner clipping
      const pairs: [number, number, number, number][] = [
        [afx, afy, bfx, bfy],
        [afx, afy, brx, bry],
        [arx, ary, bfx, bfy],
        [arx, ary, brx, bry],
      ];

      for (const [pax, pay, pbx, pby] of pairs) {
        const pdx = pbx - pax;
        const pdy = pby - pay;
        const pDist = Math.hypot(pdx, pdy);
        if (pDist < MIN_CIRCLE_DIST && pDist > 0.0001) {
          const overlap = MIN_CIRCLE_DIST - pDist;
          if (overlap > maxOverlap) {
            maxOverlap = overlap;
            nx = pdx / pDist;
            ny = pdy / pDist;
          }
        }
      }

      // Also ensure center-to-center distance maintains at least MIN_CENTER_DIST
      if (cDist < MIN_CENTER_DIST && cDist > 0.0001) {
        const centerOverlap = MIN_CENTER_DIST - cDist;
        if (centerOverlap > maxOverlap) {
          maxOverlap = centerOverlap;
          nx = cdx / cDist;
          ny = cdy / cDist;
        }
      }

      if (maxOverlap <= 0.0001) continue;

      const massA = getCar(a.carId).stats.mass;
      const massB = getCar(b.carId).stats.mass;
      const totalMass = massA + massB;

      a.x -= nx * maxOverlap * (massB / totalMass);
      a.y -= ny * maxOverlap * (massB / totalMass);
      b.x += nx * maxOverlap * (massA / totalMass);
      b.y += ny * maxOverlap * (massA / totalMass);

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
        a.impactKind = 'car';
        b.impactKind = 'car';
      }
    }
  }
}

