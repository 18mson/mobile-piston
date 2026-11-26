import { clamp } from './utils';

export type ImpactKind = 'wall' | 'car';

export interface DrivingAudioState {
  speed: number;
  maxSpeed: number;
  /** 0..1, how far sideways the car is travelling relative to its nose */
  slip: number;
  drifting: boolean;
  offroad: boolean;
  /** true on the frames right after the car picked up a boost pad */
  padHit: boolean;
  racing: boolean;
}

export class GameAudio {
  private context: AudioContext | null = null;
  private master: GainNode | null = null;
  private engineGain: GainNode | null = null;
  private engineOsc: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private tyreGain: GainNode | null = null;
  private tyreFilter: BiquadFilterNode | null = null;
  private dirtGain: GainNode | null = null;
  private dirtFilter: BiquadFilterNode | null = null;
  private rumbleGain: GainNode | null = null;
  private nitroGain: GainNode | null = null;
  private whiteNoise: AudioBuffer | null = null;
  private muted = false;
  private unlocked = false;

  // edge detection for one-shot sounds
  private wasDrifting = false;
  private wasOffroad = false;
  private wasPadHit = false;
  private lastChirpAt = -10;
  private lastThumpAt = -10;

  // menu background music
  private menuMusicTimer: number | null = null;
  private menuMusicDesired = false;
  private menuStep = 0;

  setMuted(muted: boolean): void {
    this.muted = muted;
    if (this.master && this.context) {
      this.master.gain.setTargetAtTime(muted ? 0 : 0.45, this.context.currentTime, 0.03);
    }
  }

  async unlock(): Promise<void> {
    if (this.unlocked) {
      if (this.context?.state === 'suspended') await this.context.resume();
      return;
    }
    if (typeof window === 'undefined') return;
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    try {
      this.context = new Ctor();
      this.master = this.context.createGain();
      this.master.gain.value = this.muted ? 0 : 0.45;
      this.master.connect(this.context.destination);

      const engineBus = this.context.createGain();
      engineBus.gain.value = 0.035;
      engineBus.connect(this.master);
      this.engineGain = engineBus;
      this.engineFilter = this.context.createBiquadFilter();
      this.engineFilter.type = 'lowpass';
      this.engineFilter.frequency.value = 420;
      this.engineFilter.Q.value = 5;
      this.engineFilter.connect(engineBus);

      this.engineOsc = this.context.createOscillator();
      this.engineOsc.type = 'sawtooth';
      this.engineOsc.frequency.value = 52;
      this.engineOsc.connect(this.engineFilter);
      this.engineOsc.start();

      this.engineOsc2 = this.context.createOscillator();
      this.engineOsc2.type = 'square';
      this.engineOsc2.frequency.value = 78;
      const secondGain = this.context.createGain();
      secondGain.gain.value = 0.22;
      this.engineOsc2.connect(secondGain);
      secondGain.connect(this.engineFilter);
      this.engineOsc2.start();

      const soft = this.createNoiseBuffer(2);
      this.whiteNoise = this.createWhiteBuffer(1.5);

      // Tyre squeal: band-passed noise whose pitch and level follow the slide
      const tyreSource = this.context.createBufferSource();
      tyreSource.buffer = soft;
      tyreSource.loop = true;
      this.tyreFilter = this.context.createBiquadFilter();
      this.tyreFilter.type = 'bandpass';
      this.tyreFilter.frequency.value = 1700;
      this.tyreFilter.Q.value = 1.1;
      this.tyreGain = this.context.createGain();
      this.tyreGain.gain.value = 0;
      tyreSource.connect(this.tyreFilter);
      this.tyreFilter.connect(this.tyreGain);
      this.tyreGain.connect(this.master);
      tyreSource.start();

      // Dirt / gravel crunch: white noise, band-passed and chopped by a fast LFO so it crackles
      const dirtSource = this.context.createBufferSource();
      dirtSource.buffer = this.whiteNoise;
      dirtSource.loop = true;
      this.dirtFilter = this.context.createBiquadFilter();
      this.dirtFilter.type = 'bandpass';
      this.dirtFilter.frequency.value = 900;
      this.dirtFilter.Q.value = 0.7;
      this.dirtGain = this.context.createGain();
      this.dirtGain.gain.value = 0;
      dirtSource.connect(this.dirtFilter);
      this.dirtFilter.connect(this.dirtGain);
      this.dirtGain.connect(this.master);
      dirtSource.start();

      const lfo = this.context.createOscillator();
      lfo.type = 'square';
      lfo.frequency.value = 17;
      const lfoDepth = this.context.createGain();
      lfoDepth.gain.value = 0.012;
      lfo.connect(lfoDepth);
      lfoDepth.connect(this.dirtGain.gain);
      lfo.start();

      // Low ground rumble under the crunch
      const rumbleSource = this.context.createBufferSource();
      rumbleSource.buffer = soft;
      rumbleSource.loop = true;
      const rumbleFilter = this.context.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.value = 150;
      this.rumbleGain = this.context.createGain();
      this.rumbleGain.gain.value = 0;
      rumbleSource.connect(rumbleFilter);
      rumbleFilter.connect(this.rumbleGain);
      this.rumbleGain.connect(this.master);
      rumbleSource.start();

      const nitroSource = this.context.createBufferSource();
      nitroSource.buffer = soft;
      nitroSource.loop = true;
      const nitroFilter = this.context.createBiquadFilter();
      nitroFilter.type = 'highpass';
      nitroFilter.frequency.value = 850;
      this.nitroGain = this.context.createGain();
      this.nitroGain.gain.value = 0;
      nitroSource.connect(nitroFilter);
      nitroFilter.connect(this.nitroGain);
      this.nitroGain.connect(this.master);
      nitroSource.start();

      await this.context.resume();
      this.unlocked = true;
      if (this.menuMusicDesired) {
        this.startMenuLoop();
      }
    } catch {
      this.context = null;
    }
  }

  private createNoiseBuffer(seconds: number): AudioBuffer {
    const context = this.context as AudioContext;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < data.length; i += 1) {
      const white = Math.random() * 2 - 1;
      last = last * 0.96 + white * 0.04;
      data[i] = last * 1.6;
    }
    return buffer;
  }

  private createWhiteBuffer(seconds: number): AudioBuffer {
    const context = this.context as AudioContext;
    const buffer = context.createBuffer(1, Math.floor(context.sampleRate * seconds), context.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /** Engine, nitro and (when not racing) silence for every looping surface sound. */
  updateEngine(speed: number, maxSpeed: number, _drifting: boolean, nitro: boolean, racing: boolean): void {
    if (!this.context || !this.engineOsc || !this.engineOsc2 || !this.engineFilter) return;
    const now = this.context.currentTime;
    const ratio = clamp(speed / Math.max(1, maxSpeed), 0, 1.2);
    const targetGain = racing ? 0.03 + ratio * 0.028 : 0;
    this.engineGain?.gain.setTargetAtTime(targetGain, now, 0.08);
    const base = 48 + ratio * 86 + (nitro ? 16 : 0);
    this.engineOsc.frequency.setTargetAtTime(base, now, 0.06);
    this.engineOsc2.frequency.setTargetAtTime(base * 1.51, now, 0.06);
    this.engineFilter.frequency.setTargetAtTime(300 + ratio * 900, now, 0.08);
    this.nitroGain?.gain.setTargetAtTime(racing && nitro ? 0.04 : 0, now, 0.05);

    if (!racing) {
      this.tyreGain?.gain.setTargetAtTime(0, now, 0.05);
      this.dirtGain?.gain.setTargetAtTime(0, now, 0.05);
      this.rumbleGain?.gain.setTargetAtTime(0, now, 0.05);
      this.wasDrifting = false;
      this.wasOffroad = false;
    }
  }

  /** Surface and slide sounds. Call every frame while racing, after updateEngine. */
  updateDriving(state: DrivingAudioState): void {
    if (!this.context || !this.tyreGain || !this.tyreFilter || !this.dirtGain || !this.dirtFilter || !this.rumbleGain) return;
    const now = this.context.currentTime;
    if (!state.racing) {
      this.wasDrifting = false;
      this.wasOffroad = false;
      this.wasPadHit = false;
      return;
    }
    const speedRatio = clamp(state.speed / Math.max(1, state.maxSpeed), 0, 1.2);

    // tyre squeal: louder and higher the further the car slides; quiet on dirt
    const sliding = state.drifting && !state.offroad && state.speed > 36;
    const slip = clamp(state.slip, 0, 1);
    const tyreLevel = sliding ? 0.03 + slip * 0.07 + speedRatio * 0.015 : 0;
    this.tyreGain.gain.setTargetAtTime(tyreLevel, now, 0.045);
    this.tyreFilter.frequency.setTargetAtTime(1250 + slip * 1500 + speedRatio * 350, now, 0.06);
    this.tyreFilter.Q.setTargetAtTime(1.0 + slip * 1.6, now, 0.08);
    if (sliding && !this.wasDrifting && now - this.lastChirpAt > 0.35) {
      this.chirp(0.4 + slip * 0.6);
      this.lastChirpAt = now;
    }
    this.wasDrifting = sliding;

    // dirt / gravel: crunch + rumble scale with speed
    const dirtLevel = state.offroad && state.speed > 20 ? clamp(state.speed / 170, 0, 1) : 0;
    this.dirtGain.gain.setTargetAtTime(dirtLevel > 0 ? 0.018 + dirtLevel * 0.06 : 0, now, 0.07);
    this.dirtFilter.frequency.setTargetAtTime(650 + dirtLevel * 1100, now, 0.08);
    this.rumbleGain.gain.setTargetAtTime(dirtLevel > 0 ? 0.03 + dirtLevel * 0.1 : 0, now, 0.08);
    if (state.offroad !== this.wasOffroad && state.speed > 55 && now - this.lastThumpAt > 0.25) {
      this.thump(clamp(state.speed / 200, 0.25, 0.8));
      this.lastThumpAt = now;
    }
    this.wasOffroad = state.offroad;

    // boost pad pick-up
    if (state.padHit && !this.wasPadHit) this.boost();
    this.wasPadHit = state.padHit;
  }

  /** Short rising tyre chirp when a slide starts. */
  private chirp(strength: number): void {
    if (!this.context || !this.master) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(820, now);
    osc.frequency.exponentialRampToValueAtTime(1500 + 400 * strength, now + 0.12);
    filter.type = 'bandpass';
    filter.frequency.value = 1700;
    filter.Q.value = 3;
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.045 * strength + 0.01, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /** Soft bump when tyres leave / re-enter the asphalt. */
  private thump(strength: number): void {
    if (!this.context || !this.master) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(110, now);
    osc.frequency.exponentialRampToValueAtTime(48, now + 0.12);
    gain.gain.setValueAtTime(0.14 * strength, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + 0.18);
  }

  /** Boost pad: a quick upward whoosh. */
  boost(): void {
    if (!this.context || !this.master || !this.whiteNoise) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.whiteNoise;
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = 1.6;
    filter.frequency.setValueAtTime(500, now);
    filter.frequency.exponentialRampToValueAtTime(3600, now + 0.32);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.11, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(this.master);
    src.start(now, Math.random() * 0.8);
    src.stop(now + 0.4);

    const tone = ctx.createOscillator();
    const toneGain = ctx.createGain();
    tone.type = 'triangle';
    tone.frequency.setValueAtTime(260, now);
    tone.frequency.exponentialRampToValueAtTime(780, now + 0.26);
    toneGain.gain.setValueAtTime(0.0001, now);
    toneGain.gain.exponentialRampToValueAtTime(0.06, now + 0.05);
    toneGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);
    tone.connect(toneGain);
    toneGain.connect(this.master);
    tone.start(now);
    tone.stop(now + 0.32);
  }

  /**
   * Collision, layered: a low body thump, a noisy crunch, and (for hard hits) a short metallic ring.
   * Walls sound drier with a scrape tail; car-to-car hits are heavier and more "clanky".
   */
  impact(strength = 1, kind: ImpactKind = 'wall'): void {
    if (!this.context || !this.master || !this.whiteNoise) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const s = clamp(strength, 0.05, 1);
    const pitch = 0.9 + Math.random() * 0.2;
    const isCar = kind === 'car';

    // 1. body thump
    const thump = ctx.createOscillator();
    const thumpGain = ctx.createGain();
    thump.type = 'sine';
    thump.frequency.setValueAtTime((isCar ? 170 : 140) * pitch, now);
    thump.frequency.exponentialRampToValueAtTime(42, now + 0.22);
    thumpGain.gain.setValueAtTime(0.1 + 0.3 * s, now);
    thumpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.26);
    thump.connect(thumpGain);
    thumpGain.connect(this.master);
    thump.start(now);
    thump.stop(now + 0.28);

    // 2. crunch (noise burst)
    const crunch = ctx.createBufferSource();
    crunch.buffer = this.whiteNoise;
    const crunchFilter = ctx.createBiquadFilter();
    crunchFilter.type = 'bandpass';
    crunchFilter.frequency.value = (isCar ? 780 : 1150) * pitch;
    crunchFilter.Q.value = 0.8;
    const crunchGain = ctx.createGain();
    crunchGain.gain.setValueAtTime(0.06 + 0.24 * s, now);
    crunchGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05 + 0.13 * s);
    crunch.connect(crunchFilter);
    crunchFilter.connect(crunchGain);
    crunchGain.connect(this.master);
    crunch.start(now, Math.random() * 0.8);
    crunch.stop(now + 0.22);

    // 3. metal ring on hard hits
    if (s > 0.42) {
      const ringBase = (isCar ? 520 : 340) * pitch;
      for (const ratio of [1, 1.62]) {
        const ring = ctx.createOscillator();
        const ringGain = ctx.createGain();
        ring.type = 'triangle';
        ring.frequency.value = ringBase * ratio;
        ringGain.gain.setValueAtTime(0.045 * s, now);
        ringGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.28);
        ring.connect(ringGain);
        ringGain.connect(this.master);
        ring.start(now);
        ring.stop(now + 0.3);
      }
    }

    // 4. scrape tail when sliding along a barrier
    if (!isCar) {
      const scrape = ctx.createBufferSource();
      scrape.buffer = this.whiteNoise;
      const scrapeFilter = ctx.createBiquadFilter();
      scrapeFilter.type = 'highpass';
      scrapeFilter.frequency.value = 2600;
      const scrapeGain = ctx.createGain();
      scrapeGain.gain.setValueAtTime(0.0001, now + 0.03);
      scrapeGain.gain.exponentialRampToValueAtTime(0.05 * s + 0.01, now + 0.07);
      scrapeGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
      scrape.connect(scrapeFilter);
      scrapeFilter.connect(scrapeGain);
      scrapeGain.connect(this.master);
      scrape.start(now, Math.random() * 0.8);
      scrape.stop(now + 0.34);
    }
  }

  beep(frequency = 640, duration = 0.11, volume = 0.16): void {
    if (!this.context || !this.master) return;
    const ctx = this.context;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'square';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + duration);
    osc.connect(gain);
    gain.connect(this.master);
    osc.start(now);
    osc.stop(now + duration + 0.02);
  }

  click(): void {
    this.beep(430, 0.055, 0.09);
  }

  setMenuMusic(active: boolean): void {
    this.menuMusicDesired = active;
    if (active) {
      if (this.unlocked && this.context) {
        this.startMenuLoop();
      }
    } else {
      this.stopMenuLoop();
    }
  }

  private startMenuLoop(): void {
    if (this.menuMusicTimer != null || typeof window === 'undefined') return;
    // Upbeat 120 BPM retro arcade groove (bass + soft synth arpeggio)
    const bassNotes = [130.81, 130.81, 196.0, 196.0, 110.0, 110.0, 87.31, 98.0];
    const leadNotes = [523.25, 659.25, 783.99, 659.25, 587.33, 659.25, 523.25, 392.0];
    this.menuMusicTimer = window.setInterval(() => {
      if (!this.menuMusicDesired || !this.context || !this.master || this.muted) return;
      if (this.context.state !== 'running') return;
      const now = this.context.currentTime;
      const idx = this.menuStep % bassNotes.length;
      this.menuStep += 1;

      const bass = this.context.createOscillator();
      const bassGain = this.context.createGain();
      bass.type = 'triangle';
      bass.frequency.value = bassNotes[idx];
      bassGain.gain.setValueAtTime(0.065, now);
      bassGain.gain.exponentialRampToValueAtTime(0.001, now + 0.21);
      bass.connect(bassGain);
      bassGain.connect(this.master);
      bass.start(now);
      bass.stop(now + 0.22);

      if (this.menuStep % 2 === 1) {
        const lead = this.context.createOscillator();
        const leadFilter = this.context.createBiquadFilter();
        const leadGain = this.context.createGain();
        lead.type = 'sine';
        lead.frequency.value = leadNotes[idx];
        leadFilter.type = 'lowpass';
        leadFilter.frequency.value = 1400;
        leadGain.gain.setValueAtTime(0.04, now);
        leadGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);
        lead.connect(leadFilter);
        leadFilter.connect(leadGain);
        leadGain.connect(this.master);
        lead.start(now);
        lead.stop(now + 0.23);
      }
    }, 250);
  }

  private stopMenuLoop(): void {
    if (this.menuMusicTimer != null && typeof window !== 'undefined') {
      window.clearInterval(this.menuMusicTimer);
      this.menuMusicTimer = null;
    }
  }

  dispose(): void {
    this.stopMenuLoop();
    try {
      this.engineOsc?.stop();
      this.engineOsc2?.stop();
      this.context?.close();
    } catch {
      // Audio cleanup is best-effort.
    }
    this.context = null;
  }
}
