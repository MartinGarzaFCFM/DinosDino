# 🦖 DinosDino | Jurassic Vehicular Survival

[![Build & Deploy](https://github.com/MartinGarzaFCFM/DinosDino/actions/workflows/ci-deploy.yml/badge.svg)](https://github.com/MartinGarzaFCFM/DinosDino/actions/workflows/ci-deploy.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-7.0-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r187-black?logo=three.js)](https://threejs.org/)
[![Vite](https://img.shields.io/badge/Bundler-Vite%208-purple?logo=vite)](https://vite.dev/)

An adrenaline-fueled, 3D Jurassic vehicular survival experience built on modern web standards, zero-dependency arcade vehicle physics, and SOLID architectural principles.

Outrun **Rexy**, launch off ridges, drift around hazards, harvest high-value dinosaur eggs, and survive the expedition across treacherous biomes.

---

## 🎮 Gameplay & Features

* **🏎️ Arcade Kinematic Armored Halftrack:** High-speed custom physics controller (350+ km/h) featuring decoupled forward/lateral grip, speed-progressive drift weight, handbrake powerslides, ballistic hill & ramp airtime, suspension compression, and post-hit adrenaline boosts.
* **🦖 Apex Predator AI (Rexy):** Fully rigged and animated T-Rex AI with predictive target interception, sprint lunges, whisker-ray obstacle avoidance, massive ballistic knockback attacks, and an **Acoustic EMP Roar** telegraphed by an MMO-style cast bar (`480m` shockwave radius).
* **🌧️ 3D Terrain & Hydrodynamic Mud Hazards:** Displaced elevation hills, launch ramps, slope gravity resistance, and sunken mud spills that apply quadratic speed-squared drag and viscous bog suction.
* **🎥 Dual Camera System (Rexy Focus Cam):** Seamlessly toggle (<kbd>C</kbd>) between responsive Third-Person Chase Cam and Rocket League-style **Rexy Focus Cam**, framing both your vehicle and Rexy while keeping driving controls car-centric.
* **🥚 Tactical Collectibles & Sky Beacons:**
  * **Dinosaur Eggs (Objective):** Golden beacons marking high-value Jurassic specimens required for victory.
  * **Speed Tires (Boost):** Cyan beacons granting `+15 km/h` permanent top speed per tire collected.
  * **Repellent Spray (Debuff):** Purple beacons discharging tranquilizer mist that slows Rexy down.
  * **First-Aid Hearts (Health):** Crimson beacons restoring vehicle armor integrity.
* **🗺️ Data-Driven Dynamic Biomes:**
  * **Park:** High-tech research lab, dinosaur museum, and wooded outpost.
  * **Factory:** Heavy industrial steel complex with procedural PBR metal UVs and compound chimney colliders.
  * **Woods:** Dense coastal wilderness anchored by a stone estate manor and cabin outpost.
* **🛠️ Wireframe Debugger & Dev Vision Suite:** Instant toggle (<kbd>F</kbd>) for scene wireframes and compound collision boxes, plus a dev-only live telemetry & physics tuning overlay (<kbd>~</kbd> / <kbd>V</kbd>).
* **🔊 Dynamic Procedural & Spatial Audio:** Web Audio API soundscape pairing tribal percussion with engine ignition, synthesized chimes, EMP roar charges, and kinetic crash impacts.

---

## 🕹️ Controls

| Key / Input | Action | Description |
| :---: | :---: | :--- |
| <kbd>W</kbd> / <kbd>▲</kbd> | **Accelerate** | Drive armored halftrack forward |
| <kbd>S</kbd> / <kbd>▼</kbd> | **Reverse / Brake** | Brake at speed or reverse |
| <kbd>A</kbd> / <kbd>◄</kbd> | **Steer Left** | Turn halftrack to the left |
| <kbd>D</kbd> / <kbd>►</kbd> | **Steer Right** | Turn halftrack to the right |
| <kbd>Space</kbd> / <kbd>Shift</kbd> | **Handbrake** | Break rear traction into a high-angle powerslide |
| <kbd>C</kbd> | **Rexy Focus Cam** | Toggle between Chase Cam & Rocket League-style Rexy Focus Cam |
| <kbd>F</kbd> | **Debug Wireframe** | Toggle mesh wireframes and compound collision boxes |
| <kbd>~</kbd> / <kbd>V</kbd> | **Dev Vision** *(Dev)* | Toggle live telemetry & real-time physics/AI tuning sliders |
| <kbd>R</kbd> | **Recover** | Instantly recover orientation |
| <kbd>P</kbd> / <kbd>Esc</kbd> | **Pause** | Open tactical pause screen |

---

## 🏗️ Architecture & SOLID Design

The codebase uses a clean, event-driven modular architecture with zero external physics engine overhead:

```text
src/
├── config/       # Declarative GameBalance, LevelRegistry & TerrainConfig (OCP)
├── core/         # Strongly-typed EventBus, GameState, pause-safe Time & Game orchestrator
├── audio/        # Web Audio API engine (sample buffers + procedural FM oscillator synthesis)
├── graphics/     # AssetLoader (deduped cache), CameraController (Chase + Rexy Focus), DebugVisualsManager
├── input/        # Zero-allocation per-frame keyboard state snapshot
├── physics/      # Analytical 3D TerrainBody (cosine hills, mud zones, surface normals & displaced mesh)
├── entities/     # Entity base class & role interfaces (IDebuggable, IPickupTarget, ICombatTarget, IObstacleQuery)
│   ├── vehicle/  # Custom arcade kinematic halftrack (drift inertia, airtime, hydrodynamic mud drag)
│   ├── dinosaur/ # SkeletonUtils-cloned Rexy AI, predictive pursuit & Acoustic EMP Roar
│   ├── pickups/  # Template-method Pickup base, concrete items & rejection-sampling PickupSpawner
│   └── scenery/  # Blueprint-driven Building entities with compound AABB colliders & Environment
└── ui/           # Glassmorphism HUD, MMO-style Roar Cast Bar, modals & DevVisionOverlay (DEV-gated)
```

* **Single Responsibility (SRP):** Isolated spawner logic, analytical terrain evaluation, kinematic vehicle integration, and procedural audio synthesis.
* **Open/Closed (OCP):** Adding new biomes, terrain hazards, or collectibles requires adding a declarative config entry or subclass without modifying core loops.
* **Liskov Substitution & Interface Segregation (LSP & ISP):** `IPickupTarget`, `ICombatTarget`, and `IObstacleQuery` decouple power-ups and AI from concrete vehicle implementation.
* **Dependency Inversion (DIP):** Abstractions (`IEventBus`, `IAssetLoader`, `IObstacleQuery`) injected throughout.

---

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v22+ recommended)
* `npm` (v10+)

### Installation
```bash
# Clone the repository
git clone https://github.com/MartinGarzaFCFM/DinosDino.git
cd DinosDino

# Install dependencies
npm install
```

### Local Development
```bash
# Launch Vite development server with Hot Module Replacement (HMR)
npm run dev
```
Navigate to `http://localhost:3000/` in your browser.

### Production Build & Preview
```bash
# Perform strict TypeScript typecheck and generate minified production bundles
npm run build

# Preview the production build locally
npm run preview
```

---

## 🚢 Continuous Integration & Deployment

A GitHub Actions workflow (`.github/workflows/ci-deploy.yml`) runs automatically:
1. **Pull Requests (to `main`):** Executes strict TypeScript typechecking (`npx tsc --noEmit`) and production bundling (`npm run build`) to ensure changes compile cleanly before merging.
2. **Push / Merge (to `main`):** Automatically compiles and deploys the production bundle to **GitHub Pages**.

---

## 📄 License
This project was initially developed for educational purposes and upgraded into an open-source production-ready remake. Asset models and audio belong to their respective creators.
