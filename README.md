# 🦖 DinosDino | Jurassic Vehicular Survival

[![Build & Deploy](https://github.com/MartinGarzaFCFM/DinosDino/actions/workflows/ci-deploy.yml/badge.svg)](https://github.com/MartinGarzaFCFM/DinosDino/actions/workflows/ci-deploy.yml)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.6-blue?logo=typescript)](https://www.typescriptlang.org/)
[![Three.js](https://img.shields.io/badge/Three.js-r170-black?logo=three.js)](https://threejs.org/)
[![Cannon-es](https://img.shields.io/badge/Physics-Cannon--es-orange)](https://github.com/pmndrs/cannon-es)
[![Vite](https://img.shields.io/badge/Bundler-Vite%206-purple?logo=vite)](https://vitejs.dev/)

An adrenaline-fueled, 3D Jurassic vehicular survival experience rebuilt from the ground up on modern web standards and SOLID architectural principles. 

Outrun **Rexy**, harvest high-value dinosaur eggs, grab emergency tactical power-ups, and survive the expedition across hazardous biomes.

---

## 🎮 Gameplay & Features

* **🏎️ Physics-Driven Armored Halftrack:** True 4-wheel `RaycastVehicle` simulation with independent suspension, drifting handbrake, tire slip, roll stability, and flip recovery.
* **🦖 Intelligent Pursuer AI (Rexy):** Fully rigged and animated T-Rex AI featuring smooth turning slerp, pursuit velocity matching animation tempo, physical body shove collisions, and devastating lunge attacks that blast the player into the sky with dynamic camera trauma.
* **🥚 Tactical Collectibles & Beacons:**
  * **Dinosaur Eggs (Objective):** Golden beacons marking high-value Jurassic specimens required for victory.
  * **Speed Tires (Boost):** Cyan beacons granting +600 engine force for blistering escape speeds.
  * **Repellent Spray (Debuff):** Purple beacons discharging dinosaur tranquilizer spray that slows Rexy down.
  * **First-Aid Hearts (Health):** Crimson beacons restoring vehicle armor integrity.
* **🗺️ Data-Driven Dynamic Biomes:**
  * **Park:** High-tech research lab, dinosaur museum, and wooded outpost.
  * **Factory:** Heavy industrial steel complex with procedural PBR metal textures and compound chimney colliders.
  * **Woods:** Dense coastal wilderness anchored by a massive stone estate manor and cabin outpost.
* **🛠️ In-Game Wireframe & Physics Collider Debugger:** Instant toggle (<kbd>F</kbd>) visualizing scene geometry and bright neon green Cannon collision boxes in world space.
* **🔊 Dynamic Procedural & Spatial Audio:** Web Audio API soundscape pairing high-tension tribal percussion with synthesized chimes and crunchy kinetic crash impacts.

---

## 🕹️ Controls

| Key / Input | Action | Description |
| :---: | :---: | :--- |
| <kbd>W</kbd> / <kbd>▲</kbd> | **Accelerate** | Drive armored halftrack forward |
| <kbd>S</kbd> / <kbd>▼</kbd> | **Reverse** | Back up / brake |
| <kbd>A</kbd> / <kbd>◄</kbd> | **Steer Left** | Turn wheels to the left |
| <kbd>D</kbd> / <kbd>►</kbd> | **Steer Right** | Turn wheels to the right |
| <kbd>Space</kbd> / <kbd>Shift</kbd> | **Handbrake** | Lock rear wheels into a controlled drift |
| <kbd>C</kbd> | **Camera Mode** | Switch between Third-Person Chase & Free Orbit camera |
| <kbd>F</kbd> | **Debug Wireframe** | Toggle mesh wireframes and green physics collision boxes |
| <kbd>R</kbd> | **Flip / Reset** | Instantly right the vehicle if flipped or tipped over |
| <kbd>P</kbd> / <kbd>Esc</kbd> | **Pause** | Open tactical pause screen |

---

## 🏗️ Architecture & SOLID Design

The remake replaces the legacy monolithic structure with a decoupled, modular architecture:

```text
src/
├── config/       # Declarative GameBalance tuning & data-driven LevelRegistry (OCP)
├── core/         # Strongly-typed EventBus, GameState, Time (deterministic 60Hz accumulator) & Game orchestrator
├── audio/        # Web Audio API engine (sample buffers + procedural oscillator synthesis)
├── graphics/     # AssetLoader (deduped cache), CameraController (zero-alloc + trauma shake), DebugVisualsManager
├── physics/      # Cannon-es world wrapper, contact materials, static boundary walls
├── entities/     # Entity base class & role interfaces (IDebuggable, IPickupTarget, ICombatTarget, IObstacleQuery)
│   ├── vehicle/  # RaycastVehicle physics & armored car model
│   ├── dinosaur/ # SkeletonUtils cloned Rexy AI & attack physics
│   ├── pickups/  # Template-method Pickup base, concrete items & rejection-sampling PickupSpawner
│   └── scenery/  # Blueprint-driven Building entities & level Environment
└── ui/           # Glassmorphism HUD & reactive modal screens
```

* **Single Responsibility (SRP):** Isolated spawner logic, procedural UV projection, physics stepping, and audio generation.
* **Open/Closed (OCP):** Adding new levels or collectibles requires adding a config entry or subclass without modifying core loops.
* **Liskov Substitution & Interface Segregation (LSP & ISP):** `IPickupTarget` and `ICombatTarget` decouple power-ups and AI from concrete vehicle physics.
* **Dependency Inversion (DIP):** Abstractions (`IEventBus`, `IAssetLoader`, `IObstacleQuery`) injected throughout.

---

## 🚀 Getting Started

### Prerequisites
* [Node.js](https://nodejs.org/) (v18+ recommended)
* `npm` (v9+)

### Installation
```bash
# Clone the repository
git clone https://github.com/MartinGarzaFCFM/DinosDino.git
cd DinosDino

# Switch to the remake branch
git checkout remake/v2

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

A GitHub Actions workflow (`.github/workflows/ci-deploy.yml`) is configured:
1. **Pull Requests (to `main`):** Executes strict TypeScript typechecking (`npx tsc --noEmit`) and production bundling (`npm run build`) to ensure changes compile cleanly before merging.
2. **Push / Merge (to `main`):** Automatically compiles and deploys the production bundle to **GitHub Pages**.

---

## 📄 License
This project was initially developed for educational purposes and upgraded into an open-source production-ready remake. Asset models and audio belong to their respective creators.
