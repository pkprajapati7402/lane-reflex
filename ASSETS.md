# REDLINE — Custom Asset Pipeline & Drop-in Guide

REDLINE features an internal procedural vector engine that operates out of the box with zero external image dependencies. If you wish to replace any procedural asset with custom high-res hand-crafted 2D sprites or 3D renders, simply drop your files into `public/assets/` matching the filenames and specifications listed below. The engine detects and loads overrides automatically.

---

## 1. Vehicle Sprites (Folder: `public/assets/vehicles/`)

| Filename | Purpose | Recommended Size | Format | Perspective & Style Notes |
| :--- | :--- | :--- | :--- | :--- |
| `player_center.png` | Player vehicle (neutral forward) | 640 x 360 px | PNG / WebP (transparent) | Rear chase-cam angle (~15° pitch down). High-contrast scarlet red wedge/supercar with distinct taillights. |
| `player_left.png` | Player vehicle banking left | 640 x 360 px | PNG / WebP (transparent) | Rear view with subtle left roll/yaw tilt (~4°). |
| `player_right.png` | Player vehicle banking right | 640 x 360 px | PNG / WebP (transparent) | Rear view with subtle right roll/yaw tilt (~4°). |
| `player_brake.png` | Player braking flare | 640 x 360 px | PNG / WebP (transparent) | Bright glaring white/red illumination across rear lightbar. |
| `player_boost.png` | Player overdrive flames | 640 x 360 px | PNG / WebP (transparent) | Cyan/magenta twin exhaust flame plumes and underglow flare. |
| `traffic_sedan_cyan.png` | Commuter sedan | 600 x 340 px | PNG / WebP (transparent) | Rear view compact sedan, cyan body, glowing taillights. |
| `traffic_sedan_yellow.png`| Commuter sedan | 600 x 340 px | PNG / WebP (transparent) | Rear view compact sedan, yellow body. |
| `traffic_sport_purple.png`| Fast sports coupe | 620 x 350 px | PNG / WebP (transparent) | Wide sports coupe with rear wing/spoiler, amber turn signals. |
| `traffic_truck_semi.png`  | Heavy semi trailer | 800 x 580 px | PNG / WebP (transparent) | Massive industrial trailer, double-width tires, reflective red/white hazard chevrons. |

---

## 2. Roadside & Scenery Objects (Folder: `public/assets/scenery/`)

| Filename | Purpose | Recommended Size | Format | Style Notes |
| :--- | :--- | :--- | :--- | :--- |
| `pillar_neon.png` | Highway neon light pillar | 120 x 480 px | PNG / WebP | Tall vertical cyber highway marker with bright cyan glow. |
| `palm_synth.png` | Synthwave palm tree | 240 x 440 px | PNG / WebP | Stylized dark purple/cyan neon palm silhouette. |
| `billboard_redline.png` | Overhead highway billboard | 480 x 320 px | PNG / WebP | Cyber billboard with high-voltage neon typography. |

---

## 3. Environment & Horizon Backdrops (Folder: `public/assets/sky/`)

| Filename | Purpose | Recommended Size | Format | Style Notes |
| :--- | :--- | :--- | :--- | :--- |
| `sky_metropolis.png` | Neon Metropolis horizon | 1920 x 540 px | WebP / JPEG | Deep dark indigo sky with glowing magenta grid sun and skyscraper silhouettes. |
| `sky_sunset.png` | Sunset Ridge horizon | 1920 x 540 px | WebP / JPEG | Radiant amber-to-crimson gradient with dark mountain peaks. |
| `sky_coastal.png` | Coastal Midnight horizon | 1920 x 540 px | WebP / JPEG | Cobalt moonlit ocean horizon with distant lighthouse reflections. |

---

## 4. Audio SFX Overrides (Folder: `public/assets/audio/`)

The game synthesizes all engine RPM, Doppler near-misses, and impacts in real-time via the Web Audio API. If you drop standard `.ogg` or `.mp3` files in `public/assets/audio/`, the engine can load them as sample fallbacks:

- `engine_loop.ogg` — Continuous seamless engine RPM loop.
- `near_miss_whoosh.ogg` — Sharp supersonic air pass.
- `boost_drone.ogg` — Ascending sci-fi power surge.
- `crash_impact.ogg` — Heavy metal crunch + sub bass rumble.

