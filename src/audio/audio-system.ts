/**
 * Pure Procedural Web Audio Engine for REDLINE.
 * 0-byte download size, instant response, dynamic real-time synthesis.
 */

export interface AudioSettings {
  masterVolume: number;
  sfxVolume: number;
  musicVolume: number;
  muted: boolean;
}

const DEFAULT_AUDIO_SETTINGS: AudioSettings = {
  masterVolume: 0.8,
  sfxVolume: 0.85,
  musicVolume: 0.65,
  muted: false,
};

export class AudioSystem {
  private ctx: AudioContext | null = null;
  private settings: AudioSettings;

  // Master Gain Nodes
  private masterGain: GainNode | null = null;
  private sfxGain: GainNode | null = null;
  private musicGain: GainNode | null = null;

  // Engine Synth
  private engineOsc1: OscillatorNode | null = null;
  private engineOsc2: OscillatorNode | null = null;
  private engineFilter: BiquadFilterNode | null = null;
  private engineGain: GainNode | null = null;
  private isEngineRunning: boolean = false;

  // Boost Drone
  private boostOsc: OscillatorNode | null = null;
  private boostGain: GainNode | null = null;

  // Dynamic Synth Music Arpeggiator
  private musicIntervalId: number | null = null;
  private arpStep: number = 0;
  private comboTier: number = 1;

  constructor() {
    this.settings = { ...DEFAULT_AUDIO_SETTINGS };
    this.loadSettings();
  }

  /**
   * Initialize audio context upon first user gesture (click/keypress)
   */
  public init(): void {
    if (this.ctx) return;

    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    this.ctx = new AudioContextClass();

    // Master node
    this.masterGain = this.ctx.createGain();
    this.masterGain.gain.value = this.settings.muted ? 0 : this.settings.masterVolume;
    this.masterGain.connect(this.ctx.destination);

    // SFX node
    this.sfxGain = this.ctx.createGain();
    this.sfxGain.gain.value = this.settings.sfxVolume;
    this.sfxGain.connect(this.masterGain);

    // Music node
    this.musicGain = this.ctx.createGain();
    this.musicGain.gain.value = this.settings.musicVolume;
    this.musicGain.connect(this.masterGain);

    this.startEngineSynth();
    this.startMusicArpeggiator();
  }

  public resumeIfSuspended(): void {
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  private startEngineSynth(): void {
    if (!this.ctx || !this.sfxGain || this.isEngineRunning) return;

    // Dual-oscillator engine synth
    this.engineOsc1 = this.ctx.createOscillator();
    this.engineOsc2 = this.ctx.createOscillator();
    this.engineFilter = this.ctx.createBiquadFilter();
    this.engineGain = this.ctx.createGain();

    this.engineOsc1.type = 'sawtooth';
    this.engineOsc2.type = 'triangle';

    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 400;
    this.engineFilter.Q.value = 3.0;

    this.engineGain.gain.value = 0.12;

    this.engineOsc1.connect(this.engineFilter);
    this.engineOsc2.connect(this.engineFilter);
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfxGain);

    this.engineOsc1.start();
    this.engineOsc2.start();

    // Boost Synth
    this.boostOsc = this.ctx.createOscillator();
    this.boostGain = this.ctx.createGain();
    this.boostOsc.type = 'sawtooth';
    this.boostGain.gain.value = 0;
    this.boostOsc.connect(this.boostGain);
    this.boostGain.connect(this.sfxGain);
    this.boostOsc.start();

    this.isEngineRunning = true;
  }

  public updateEngine(speedRatio: number, isBoosting: boolean, isBraking: boolean): void {
    if (!this.ctx || !this.isEngineRunning || !this.engineOsc1 || !this.engineOsc2 || !this.engineFilter || !this.engineGain) return;

    const t = this.ctx.currentTime;
    const baseFreq = 55 + (speedRatio * 160);
    this.engineOsc1.frequency.setTargetAtTime(baseFreq, t, 0.05);
    this.engineOsc2.frequency.setTargetAtTime(baseFreq * 0.5, t, 0.05);

    const filterFreq = 300 + (speedRatio * 1800) + (isBoosting ? 800 : 0);
    this.engineFilter.frequency.setTargetAtTime(filterFreq, t, 0.05);

    const targetGain = isBraking ? 0.06 : (0.10 + speedRatio * 0.08);
    this.engineGain.gain.setTargetAtTime(targetGain, t, 0.05);

    // Boost drone swell
    if (this.boostGain && this.boostOsc) {
      if (isBoosting) {
        this.boostGain.gain.setTargetAtTime(0.16, t, 0.08);
        this.boostOsc.frequency.setTargetAtTime(220 + speedRatio * 200, t, 0.08);
      } else {
        this.boostGain.gain.setTargetAtTime(0, t, 0.1);
      }
    }
  }

  /**
   * High-intensity Doppler Near-Miss Whoosh
   */
  public playNearMissWhoosh(closeness: 'CLOSE' | 'RAZOR' | 'EXTREME'): void {
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;
    const bufferSize = this.ctx.sampleRate * 0.35;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);

    // Generate filtered noise
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.Q.value = closeness === 'EXTREME' ? 6 : 4;

    // Rapid Doppler pitch sweep down
    filter.frequency.setValueAtTime(closeness === 'EXTREME' ? 2400 : 1800, t);
    filter.frequency.exponentialRampToValueAtTime(320, t + 0.3);

    const gain = this.ctx.createGain();
    const peakGain = closeness === 'EXTREME' ? 0.8 : (closeness === 'RAZOR' ? 0.6 : 0.45);
    gain.gain.setValueAtTime(peakGain, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.32);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxGain);

    noise.start(t);
    noise.stop(t + 0.35);

    // Harmonic chime accent
    const chime = this.ctx.createOscillator();
    const chimeGain = this.ctx.createGain();
    chime.type = 'sine';
    chime.frequency.setValueAtTime(closeness === 'EXTREME' ? 880 : 660, t);
    chime.frequency.exponentialRampToValueAtTime(1320, t + 0.2);

    chimeGain.gain.setValueAtTime(0.25, t);
    chimeGain.gain.exponentialRampToValueAtTime(0.001, t + 0.25);

    chime.connect(chimeGain);
    chimeGain.connect(this.sfxGain);

    chime.start(t);
    chime.stop(t + 0.25);
  }

  /**
   * Crash Impact Boom + Metal Crunch
   */
  public playCrash(): void {
    if (!this.ctx || !this.sfxGain) return;

    const t = this.ctx.currentTime;

    // Low-frequency Sub Bass Thump
    const sub = this.ctx.createOscillator();
    const subGain = this.ctx.createGain();
    sub.type = 'sine';
    sub.frequency.setValueAtTime(140, t);
    sub.frequency.exponentialRampToValueAtTime(25, t + 0.5);

    subGain.gain.setValueAtTime(0.9, t);
    subGain.gain.exponentialRampToValueAtTime(0.01, t + 0.5);

    sub.connect(subGain);
    subGain.connect(this.sfxGain);
    sub.start(t);
    sub.stop(t + 0.5);

    // Metal Crunch Noise
    const bufferSize = this.ctx.sampleRate * 0.45;
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.3));
    }

    const noise = this.ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = this.ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1200, t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.4);

    const crunchGain = this.ctx.createGain();
    crunchGain.gain.setValueAtTime(0.7, t);
    crunchGain.gain.exponentialRampToValueAtTime(0.01, t + 0.45);

    noise.connect(filter);
    filter.connect(crunchGain);
    crunchGain.connect(this.sfxGain);

    noise.start(t);
    noise.stop(t + 0.45);
  }

  /**
   * UI Click / Blip
   */
  public playUiBlip(): void {
    if (!this.ctx || !this.sfxGain) return;
    const t = this.ctx.currentTime;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(700, t);
    osc.frequency.exponentialRampToValueAtTime(950, t + 0.06);

    gain.gain.setValueAtTime(0.18, t);
    gain.gain.exponentialRampToValueAtTime(0.01, t + 0.06);

    osc.connect(gain);
    gain.connect(this.sfxGain);
    osc.start(t);
    osc.stop(t + 0.06);
  }

  public setComboTier(tier: number): void {
    this.comboTier = Math.max(1, Math.min(5, tier));
  }

  /**
   * Dynamic Synthwave Arpeggiator that evolves with combo
   */
  private startMusicArpeggiator(): void {
    if (this.musicIntervalId !== null) return;

    // F-minor synthwave scale notes (Hz)
    const notes = [174.61, 207.65, 233.08, 261.63, 311.13, 349.23, 415.30, 466.16];

    this.musicIntervalId = window.setInterval(() => {
      if (!this.ctx || !this.musicGain || this.settings.muted) return;

      const t = this.ctx.currentTime;
      const noteIdx = (this.arpStep * (this.comboTier >= 3 ? 2 : 1)) % notes.length;
      const freq = notes[noteIdx] * (this.comboTier >= 4 ? 2 : 1);

      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = this.comboTier >= 2 ? 'sawtooth' : 'triangle';
      osc.frequency.setValueAtTime(freq, t);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450 + this.comboTier * 300, t);

      const noteDuration = 0.12;
      gain.gain.setValueAtTime(0.08 * (this.comboTier * 0.3 + 0.7), t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + noteDuration);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.musicGain);

      osc.start(t);
      osc.stop(t + noteDuration);

      this.arpStep = (this.arpStep + 1) % 16;
    }, 130); // ~115 BPM 16th notes
  }

  public setMasterVolume(v: number): void {
    this.settings.masterVolume = Math.max(0, Math.min(1, v));
    if (this.masterGain && !this.settings.muted) {
      this.masterGain.gain.setTargetAtTime(this.settings.masterVolume, this.ctx?.currentTime || 0, 0.05);
    }
    this.saveSettings();
  }

  public setSfxVolume(v: number): void {
    this.settings.sfxVolume = Math.max(0, Math.min(1, v));
    if (this.sfxGain) {
      this.sfxGain.gain.setTargetAtTime(this.settings.sfxVolume, this.ctx?.currentTime || 0, 0.05);
    }
    this.saveSettings();
  }

  public setMusicVolume(v: number): void {
    this.settings.musicVolume = Math.max(0, Math.min(1, v));
    if (this.musicGain) {
      this.musicGain.gain.setTargetAtTime(this.settings.musicVolume, this.ctx?.currentTime || 0, 0.05);
    }
    this.saveSettings();
  }

  public toggleMute(): boolean {
    this.settings.muted = !this.settings.muted;
    if (this.masterGain) {
      this.masterGain.gain.setTargetAtTime(
        this.settings.muted ? 0 : this.settings.masterVolume,
        this.ctx?.currentTime || 0,
        0.05
      );
    }
    this.saveSettings();
    return this.settings.muted;
  }

  public getSettings(): AudioSettings {
    return { ...this.settings };
  }

  private saveSettings(): void {
    try {
      localStorage.setItem('redline_audio_settings', JSON.stringify(this.settings));
    } catch {
      // ignore
    }
  }

  private loadSettings(): void {
    try {
      const data = localStorage.getItem('redline_audio_settings');
      if (data) {
        this.settings = { ...this.settings, ...JSON.parse(data) };
      }
    } catch {
      // ignore
    }
  }

  public destroy(): void {
    if (this.musicIntervalId !== null) {
      clearInterval(this.musicIntervalId);
      this.musicIntervalId = null;
    }
    if (this.ctx) {
      this.ctx.close();
      this.ctx = null;
    }
  }
}

