import type { PlayerInput, RacerState, Track } from './types';
import { getCar } from './data/cars';
import { clamp, shortestAngle } from './utils';
import { curvatureAt, pointAtDistance } from './track/geometry';
import { lateralGripAt, maxSteerAngle } from './physics';

const AI_WHEELBASE = 14.5;
const AI_BRAKE_DECEL = 300;

/** Fastest speed the AI will carry through the next stretch of road, given the car's real grip limit. */
function gripLimitedSpeed(track: Track, s: number, spec: ReturnType<typeof getCar>, skill: number, speed: number): number {
  const axleFactor = 0.5 + 0.5 * (spec.stats.rearGrip ?? 1);
  const grip = lateralGripAt(spec, spec.stats.topSpeed * 0.8) * axleFactor * (0.78 + 0.16 * skill);
  let limit = Infinity;
  for (let d = 0; d <= 240; d += 20) {
    const curve = Math.abs(curvatureAt(track, s + d, 56));
    if (curve < 1e-4) continue;
    const corner = Math.sqrt(grip / curve);
    // speed we may still have right now if we brake at AI_BRAKE_DECEL for d units
    limit = Math.min(limit, Math.sqrt(corner * corner + 2 * AI_BRAKE_DECEL * d));
  }
  return Math.max(70, limit);
}

function playerProgress(racers: RacerState[], track: Track): number {
  let maxProgress = -Infinity;
  for (const racer of racers) {
    if (racer.isHuman ?? racer.isPlayer) {
      const p = racer.lap * track.length + racer.s;
      if (p > maxProgress) maxProgress = p;
    }
  }
  return maxProgress === -Infinity ? 0 : maxProgress;
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

  let targetSpeed = Math.min(spec.stats.topSpeed * speedFactor, gripLimitedSpeed(track, racer.s, spec, skill, speed));
  targetSpeed = Math.max(68, targetSpeed);

  const lookAhead = clamp(42 + speed * 0.55, 54, 142);
  const maxLateralLane = (track.width / 2) * 0.62;
  let lateral = clamp(curvature * 2800, -maxLateralLane, maxLateralLane);
  let shouldTriggerOvertakeNitro = false;

  for (const other of racers) {
    if (other.id === racer.id || other.finished) continue;
    const dx = other.x - racer.x;
    const dy = other.y - racer.y;
    const forward = dx * Math.cos(racer.angle) + dy * Math.sin(racer.angle);
    const side = -dx * Math.sin(racer.angle) + dy * Math.cos(racer.angle);

    // Active overtaking: detect car or player ahead within 110 units
    if (forward > 0 && forward < 110 && Math.abs(side) < 38) {
      // Pick the open passing lane
      let passOffset = side >= 0 ? -36 : 36;
      // If passing on that side pushes outside the road, switch to the other side
      if (Math.abs(lateral + passOffset) > maxLateralLane) {
        passOffset = -passOffset;
      }
      lateral += passOffset;

      if (forward < 20 && Math.abs(side) < 13) {
        // Only brake lightly if directly behind their bumper
        targetSpeed = Math.min(targetSpeed, speed * 0.85);
      } else {
        // Keep throttle down to complete the pass
        targetSpeed = Math.max(targetSpeed, spec.stats.topSpeed * speedFactor);
        if (forward < 85 && maxCurve < 0.0035) {
          shouldTriggerOvertakeNitro = true;
        }
      }
    }
  }

  const target = pointAtDistance(track, racer.s + lookAhead, clamp(lateral, -maxLateralLane, maxLateralLane));
  const desiredAngle = Math.atan2(target.y - racer.y, target.x - racer.x);
  const angleError = shortestAngle(racer.angle, desiredAngle);
  // pure pursuit: wheel angle needed to arc onto the target point, converted to a steering fraction
  const wheelAngle = Math.atan2(2 * AI_WHEELBASE * Math.sin(angleError), Math.max(30, Math.hypot(target.x - racer.x, target.y - racer.y)));
  let steer = clamp(wheelAngle / Math.max(0.05, maxSteerAngle(spec, speed)), -1, 1);

  if (Math.abs(angleError) > 1.2 && speed < 28) {
    steer = angleError > 0 ? 1 : -1;
  }

  const brake = speed > targetSpeed + 7;
  const regularNitro =
    racer.nitro > 26 &&
    maxCurve < 0.0032 &&
    speed > spec.stats.topSpeed * 0.72 &&
    Math.sin(time * 0.85 + racer.skill * 17) > -0.1;
  const nitro = (regularNitro || (shouldTriggerOvertakeNitro && racer.nitro > 20)) && !brake;

  const gas = !brake && speed < targetSpeed + 4;
  return { steer, brake, nitro, pause: false, gas };
}
