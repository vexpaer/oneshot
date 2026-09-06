# NATURE EXPLORER · 自然探索之境

An explorable, procedurally generated 3D valley built with React + Three.js (react-three-fiber).
No traditional navigation — content lives inside the landscape:

| Place | Content |
| --- | --- |
| The Elder Tree 古树 | About |
| Valley Stones 山谷石碑 | Projects |
| The Treehouse 树屋 | Notes |
| Lake of Lights 光之湖 | Gallery |
| Crystal Cave 晶石洞穴 | Experiments |
| Sky Lookout 山顶观景台 | Contact (firefly mailbox) |
| A Wild Flower 野花 | scroll in → micro world (pollen, dew, a ladybug) |

## Features
- Four seasons (spring / summer / autumn / winter) driving one `vec4` uniform shared by every material — terrain, grass, canopies, water (ice), particles — with smooth cross-fades.
- Slow day/night cycle: sun & moon, sky dome shader with stars, fog color, fireflies, glowing mushrooms, window light.
- Procedural terrain (simplex fbm heightfield), instanced grass (70k blades with wind + pointer bending), instanced trees, GPU particle systems (fireflies repelled by the pointer, falling leaves, petals, snow, pollen).
- Analytic heightfield ray-march for pointer/ground interaction (no mesh raycasting).
- Procedural ambience via WebAudio: wind, water, birds, crickets.
- Post-processing (bloom, vignette, ACES) on desktop; automatic DPR scaling; reduced counts on mobile.

## Controls
Drag · look — Wheel · move closer / farther — Click ground · walk there — `W A S D` · roam (`Shift` run) — Click a landmark · travel — Scroll into the flower · micro world — `Esc` · return.

## Build & deploy to GitHub Pages
```bash
npm install
npm run build      # produces a single self-contained dist/index.html (+ dist/images)
```
Push the contents of `dist/` to a `gh-pages` branch (or point Pages at `/dist` via an Action). All asset paths are relative, so it works under `https://<user>.github.io/<repo>/` without further configuration.
