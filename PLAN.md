# REDLINE — Architecture & Implementation Plan

## 1. Stack Selection & Justifications

| Component | Choice | Justification |
| :--- | :--- | :--- |
| **Bundler & Tooling** | **Vite 6 + TypeScript** | Instant HMR, strict type safety, zero-config tree-shaking, production bundle <50 KB gzipped. |
| **Rendering Engine** | **Canvas 2D (Optimized Pseudo-3D)** | Classic OutRun segment-trapezoid projection. 300 segments + 30 vehicles render in ~0.6 ms on integrated GPUs (no WebGL context-loss risk, 0 KB external library weight). |
| **Simulation Loop** | **Fixed Timestep (60 Hz)** | Decoupled simulation tick (`dt = 1/60`) with delta-time accumulator and render interpolation (`alpha`), ensuring identical physics on 60, 120, or 144 Hz displays. |
| **RNG** | **Seeded PRNG (Mulberry32)** | Deterministic 32-bit state generator for Daily Challenges, repeatable traffic seeds, ghost replays, and automated testing. |
| **Audio Engine** | **Procedural Web Audio API** | Zero-asset download size. Synthesizes engine RPM pitch, dual-tone FM boost swell, white-noise resonant crash, near-miss Doppler whoosh, and combo-responsive dynamic arpeggios. Master / SFX / Music volume buses. |
| **Memory / GC** | **Object Pooling** | Fixed pools for particles (200), traffic cars (32), score pops (32), and segments (500). Zero heap allocations during hot simulation loops. |
| **Testing** | **Vitest** | Fast automated tests for deterministic simulation, collision detection, near-miss margins, and the pattern escape-route solver. |

---

## 2. Renderer Approach & Benchmark Plan

### Pseudo-3D Road Math
- The road is modeled as an array of discrete segments of length $L$ (e.g., 200 units) in world space $(X, Y, Z)$.
- Segments feature lateral offset ($X$, curves) and vertical elevation ($Y$, hills) modulated by smooth sine waves.
- Perspective camera placed at $(0, H_{cam}, Z_{cam})$ projects world coordinates to screen space:
  $$Y_{screen} = \frac{ScreenHeight}{2} + \frac{(Segment_Y - Camera_Y) \cdot Distance}{Segment_Z - Camera_Z}$$
  $$X_{screen} = \frac{ScreenWidth}{2} + \frac{(Segment_X - Camera_X) \cdot Distance}{Segment_Z - Camera_Z}$$
  $$W_{screen} = \frac{RoadWidth \cdot Distance}{Segment_Z - Camera_Z}$$
- Ground, curbs, lanes, and road stripes are drawn from back to front using clipped trapezoids (`ctx.beginPath()`, `ctx.fill()`).
- High-performance sprite rendering sorts roadside obstacles and traffic vehicles by depth ($Z$), drawing from horizon to foreground with depth-scaled hitboxes.

### Benchmark Targets
- **Framerate:** 60 FPS rock-solid on integrated graphics (Intel Iris Xe / AMD Radeon 680M / Apple M-series / budget laptops).
- **Frame time:** Simulation < 1.5 ms, Render < 3.0 ms (Total frame time < 5.0 ms out of 16.6 ms budget).
- **Quality Scaler:** Automatic dynamic resolution downscaling (1.0x -> 0.75x -> 0.5x) if frame times exceed 14 ms over 30 consecutive frames.

---

## 3. Art Direction: "Hyper-Arcade Synth-Vector"

- **Aesthetic:** High-contrast retro-arcade aesthetic inspired by OutRun, Horizon Chase, and Tron. Bold silhouettes, crisp neon trim, zero visual clutter.
- **Color Palette & Biomes:**
  1. **Neon Metropolis:** Dark asphalt, cyan lane dividers, magenta horizon grid, glowing skyscraper backdrops.
  2. **Sunset Ridge:** Amber tarmac, golden sunset sun, crimson rock mesas, deep purple mountains.
  3. **Coastal Midnight:** Deep navy sky, cobalt ocean reflections, palm tree silhouettes, moonlight glow.
  4. **Cyber Storm:** Dark graphite road, electric blue lightning pulses, neon rain streaks.
- **Traffic Hierarchy & Telegraphing:**
  - **Player:** High-visibility scarlet wedge sports car with bright cyan taillights and responsive steering yaw tilt.
  - **Sedans (Medium speed):** High contrast teal/silver; brake light flare when decelerating.
  - **Coupes (Fast speed):** Yellow/orange; 600ms animated blinker indicator prior to lane transitions.
  - **Heavy Trucks (Slow obstacles):** Wide double-lane trucks with reflective red-and-white chevron hazard rear bars.

---

## 4. Milestone Schedule

- [x] **Milestone 0: Architecture & Foundation**
  - Project setup (Vite, TS, Vitest, CSS reset).
  - Seeded PRNG, fixed-timestep loop, pooling utilities.
- [ ] **Milestone 1: Vertical Slice (Feel & Core Movement)**
  - Pseudo-3D road projection with curves and hills.
  - Player car physics: acceleration, braking, lateral steering with subtle inertia, yaw tilt.
  - Single traffic wave pattern, forgiving AABB hitboxes.
  - Crash detection, hit-stop, camera shake, <1s instant retry loop (`R` / Space).
  - Browser playtesting & screenshot validation.
- [ ] **Milestone 2: Juice & Core Mechanics**
  - Near-miss detection system (distance threshold + relative velocity check).
  - Combo multiplier and boost meter fill.
  - Procedural traffic pattern generator with guaranteed escape routes (zigzags, single gaps, slow trucks, lane cutters).
  - Audio synthesizer: engine pitch, near-miss whoosh, boost swell, crash impact, dynamic combo music.
  - Visual juice: camera FOV kick, speed lines, tire smoke, boost flame particles.
- [ ] **Milestone 3: Unified Input & UI Shell**
  - Normalized Input Abstraction (`InputManager`).
  - Keyboard, Mouse (smoothed steer + click actions), Gamepad API (sticks, triggers, vibration haptics).
  - Rebinding UI and sensitivity/deadzone controls.
  - HUD overlay (speedometer, combo meter, boost gauge, reaction flash).
  - 30-second guided interactive tutorial.
- [ ] **Milestone 4: Training & Stats System**
  - Reaction time tracking: time from hazard visibility threshold to avoidance steering.
  - Decision accuracy and near-miss frequency metrics.
  - Game Modes: Endless, Daily Challenge (seeded), Sprint (score attack), Reaction Drill.
  - Results screen with personal bests & session progress charts (canvas-rendered trends).
  - LocalStorage persistence with versioned schema & JSON export/import.
- [ ] **Milestone 5: Biomes, Accessibility, PWA & Polish**
  - Biome cycling (Metropolis, Sunset, Coast, Storm).
  - Accessibility settings: colorblind palettes, reduced motion mode, photosensitivity clamps.
  - PWA manifest & offline service worker.
  - Asset catalog (`ASSETS.md`) and license documentation (`CREDITS.md`).
  - Vitest automated test suite verification.

---

## 5. Key Risks & Mitigations

1. **Floaty / Laggy Steering:**
   - *Mitigation:* Steering responds directly to normalized input with responsive angular velocity damping instead of second-order spring delays. Instant visual sprite yaw gives immediate 0-frame visual feedback.
2. **Unfair "Wall-of-Death" Traffic Spawns:**
   - *Mitigation:* Pattern generator generates strictly pre-validated wave templates with algorithmic validation ensuring at least one clear passage width at current maximum player velocity.
3. **Garbage Collection Stutter:**
   - *Mitigation:* Zero allocations inside simulation `tick()` and `render()`. Object pools for all active entities, particles, and floating text.

