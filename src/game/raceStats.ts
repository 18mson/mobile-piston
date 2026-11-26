import type { RaceStats, RacerState } from './types';

/**
 * Collects the numbers the XP system cares about while the local player races:
 * controlled drift time, time off the asphalt, hits, and how many laps were "clean".
 * Purely observational: it never touches physics.
 */
export class RaceStatsTracker {
  private driftSeconds = 0;
  private offroadSeconds = 0;
  private hits = 0;
  private cleanLaps = 0;
  private lapsCompleted = 0;
  private lapHit = false;
  private lapOffroad = 0;
  private prevImpact = 0;
  private prevLap = 0;

  reset(): void {
    this.driftSeconds = 0;
    this.offroadSeconds = 0;
    this.hits = 0;
    this.cleanLaps = 0;
    this.lapsCompleted = 0;
    this.lapHit = false;
    this.lapOffroad = 0;
    this.prevImpact = 0;
    this.prevLap = 0;
  }

  update(dt: number, racer: RacerState): void {
    if (!(dt > 0)) return;

    if (!racer.finished) {
      const speed = Math.hypot(racer.vx, racer.vy);

      // controlled drift: sliding on the road, fast enough, and not yet a spin-out
      const forward = racer.vx * Math.cos(racer.angle) + racer.vy * Math.sin(racer.angle);
      const lateral = -racer.vx * Math.sin(racer.angle) + racer.vy * Math.cos(racer.angle);
      const slipAngle = Math.abs(Math.atan2(lateral, Math.max(Math.abs(forward), 30)));
      if (racer.drifting && !racer.offroad && speed > 45 && slipAngle < 0.95) this.driftSeconds += dt;

      if (racer.offroad && speed > 20) {
        this.offroadSeconds += dt;
        this.lapOffroad += dt;
      }

      // A fresh impact = value jumped up since the last frame. Barrier hits count from a light touch;
      // a bump from another car must be a real hit (traffic scrapes are not the player's fault).
      const threshold = racer.impactKind === 'car' ? 0.5 : 0.3;
      if (racer.impact > this.prevImpact + 0.22 && racer.impact > threshold) {
        this.hits += 1;
        this.lapHit = true;
      }
      this.prevImpact = racer.impact;
    }

    // Lap boundary (racer.lap only increases when a lap is completed). Runs even on the frame the race
    // finishes, otherwise the final lap would never be counted.
    while (racer.lap > this.prevLap) {
      this.prevLap += 1;
      this.lapsCompleted += 1;
      if (!this.lapHit && this.lapOffroad < 0.8) this.cleanLaps += 1;
      this.lapHit = false;
      this.lapOffroad = 0;
    }
  }

  result(): RaceStats {
    return {
      driftSeconds: Math.round(this.driftSeconds * 10) / 10,
      offroadSeconds: Math.round(this.offroadSeconds * 10) / 10,
      hits: this.hits,
      cleanLaps: this.cleanLaps,
      lapsCompleted: this.lapsCompleted,
    };
  }
}
