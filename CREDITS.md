# REDLINE — Credits & Audio Licenses

## 1. Procedural Audio Synthesis
All audio effects and dynamic soundtrack in REDLINE are generated entirely via client-side procedural synthesis using the standard **W3C Web Audio API** (`AudioContext`), resulting in **0 KB** audio asset download weight and zero external copyright dependencies:

- **Engine Synthesis:** Dual-oscillator FM (sawtooth + triangle) with real-time frequency and low-pass filter cutoff modulation driven continuously by forward velocity and RPM.
- **Near-Miss Doppler Effect:** Bandpass-filtered resonant white-noise sweeps combined with high-register harmonic sinusoidal chimes.
- **Boost Swell:** High-resonance ascending sawtooth synthesizer with detuned dual voicing.
- **Crash Explosion:** Low-frequency sine wave sub-bass impulse (140 Hz down to 25 Hz) layered with exponential-decay white noise through a dynamic low-pass sweep.
- **Dynamic Soundtrack:** 16-step procedural synthwave arpeggiator in F-minor scale, dynamically escalating harmonic complexity and timbre with in-game combo tiers (x1 to x8).

All procedural synthesizer code is original work created specifically for REDLINE and licensed under the **MIT License**.

---

## 2. Open-Source Software & Tooling
- **Vite 6** — MIT License
- **TypeScript** — Apache 2.0 License
- **Vitest** — MIT License
- **Puppeteer** — Apache 2.0 License

