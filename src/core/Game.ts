import * as THREE from 'three';
import { EventBus, IEventBus } from './EventBus.ts';
import { GameState, Difficulty, LevelTheme } from './GameState.ts';
import { Time } from './Time.ts';
import { Renderer } from '../graphics/Renderer.ts';
import { SceneManager } from '../graphics/SceneManager.ts';
import { CameraController } from '../graphics/CameraController.ts';
import { DebugVisualsManager } from '../graphics/DebugVisualsManager.ts';
import { TerrainBody } from '../physics/TerrainBody.ts';
import { InputManager } from '../input/InputManager.ts';
import { AudioManager } from '../audio/AudioManager.ts';
import { UIManager } from '../ui/UIManager.ts';
import { DevVisionOverlay } from '../ui/DevVisionOverlay.ts';
import { Vehicle } from '../entities/vehicle/Vehicle.ts';
import { Rexy } from '../entities/dinosaur/Rexy.ts';
import { Environment } from '../entities/scenery/Environment.ts';
import { Pickup } from '../entities/pickups/Pickup.ts';
import { PickupSpawner } from '../entities/pickups/PickupSpawner.ts';
import { AssetLoader, IAssetLoader } from '../graphics/AssetLoader.ts';
import { ARENA_CONFIG, DIFFICULTY_PRESETS, VEHICLE_CONFIG } from '../config/GameBalance.ts';

/**
 * High-level application orchestrator.
 * Coordinates subsystems via interfaces and EventBus without owning low-level
 * physics constraint cleanup, collider recipes, or DOM manipulation.
 */
export class Game {
  private readonly container: HTMLElement;
  private readonly bus: IEventBus;
  private readonly loader: IAssetLoader;
  private readonly time: Time = new Time();

  private renderer!: Renderer;
  private sceneManager!: SceneManager;
  private cameraController!: CameraController;
  private debugVisuals!: DebugVisualsManager;
  private terrain!: TerrainBody;
  private inputManager!: InputManager;
  private audioManager!: AudioManager;
  private uiManager!: UIManager;
  private devVisionOverlay?: DevVisionOverlay;
  private environment!: Environment;
  private pickupSpawner!: PickupSpawner;

  private state: GameState = GameState.BOOT;
  private expeditionToken: number = 0;

  // Active match entities
  private player?: Vehicle;
  private rexy?: Rexy;
  private pickups: Pickup[] = [];
  private totalEggs: number = 0;
  private collectedEggs: number = 0;

  private currentDifficulty: Difficulty = 'Medium';
  private currentLevel: LevelTheme = 'Park';

  constructor(
    container: HTMLElement,
    bus: IEventBus = EventBus.getInstance(),
    loader: IAssetLoader = AssetLoader.getInstance()
  ) {
    this.container = container;
    this.bus = bus;
    this.loader = loader;
  }

  public async init(): Promise<void> {
    this.state = GameState.LOADING;

    // 1. Initialize Core Subsystems
    this.renderer = new Renderer(this.container);
    this.sceneManager = new SceneManager(this.loader);
    this.cameraController = new CameraController(this.container);
    this.debugVisuals = new DebugVisualsManager(this.sceneManager.scene, this.bus);

    this.terrain = new TerrainBody();
    this.sceneManager.attachTerrain(this.terrain.group, this.terrain.mesh);

    this.environment = new Environment(this.sceneManager.scene, this.loader);
    this.pickupSpawner = new PickupSpawner(this.environment, this.bus, this.loader, this.terrain);

    this.debugVisuals.register(this.terrain);
    this.debugVisuals.register(this.environment);

    this.inputManager = new InputManager();
    this.audioManager = AudioManager.getInstance();
    this.uiManager = new UIManager(document.getElementById('app-container')!, this.bus);

    // Developer Vision (Active in Dev mode only)
    if (import.meta.env.DEV) {
      this.devVisionOverlay = new DevVisionOverlay(
        document.getElementById('app-container')!,
        this.bus
      );
    }

    this.setupBusListeners();

    // 2. Preload critical 3D assets & audio buffers
    this.uiManager.setScreen(GameState.LOADING);
    await Promise.all([this.audioManager.preload(), this.loader.preloadGameAssets()]);

    // 3. Enter Main Menu
    this.state = GameState.MAIN_MENU;
    this.uiManager.setScreen(GameState.MAIN_MENU);
    this.audioManager.playBGM();

    // 4. Start Main Loop
    this.time.reset();
    this.loop();
  }

  private setupBusListeners(): void {
    this.bus.on('ui_click', () => this.audioManager.playClick());
    this.bus.on('toggle_music', (enabled) => this.audioManager.setMusicEnabled(enabled));
    this.bus.on('toggle_sfx', (enabled) => this.audioManager.setSfxEnabled(enabled));

    this.bus.on('start_game_request', ({ difficulty, level }) => {
      this.currentDifficulty = difficulty;
      this.currentLevel = level;
      void this.startExpedition();
    });

    this.bus.on('resume_game', () => {
      if (this.state === GameState.PAUSED) {
        this.time.reset();
        this.state = GameState.PLAYING;
        this.uiManager.setScreen(GameState.PLAYING);
      }
    });

    this.bus.on('return_to_menu', () => {
      this.expeditionToken++; // Cancel any in-flight expedition load
      this.clearEntities();
      this.state = GameState.MAIN_MENU;
      this.uiManager.setScreen(GameState.MAIN_MENU);
    });

    this.bus.on('rexy_slow_requested', ({ amount }) => {
      this.rexy?.slowDown(amount);
    });

    this.bus.on('rexy_attack', () => {
      this.cameraController.addTrauma(0.65);
    });

    this.bus.on('rexy_roar', () => {
      this.cameraController.addTrauma(0.4);
    });

    this.bus.on('camera_trauma', ({ amount }) => {
      this.cameraController.addTrauma(amount);
    });

    this.bus.on('toggle_dev_vision', () => {
      this.devVisionOverlay?.toggle();
    });

    this.bus.on('toggle_camera_mode', () => {
      const mode = this.cameraController.toggleMode();
      this.bus.emit('camera_mode_changed', { mode });
    });

    this.bus.on('egg_collected', () => {
      if (this.state !== GameState.PLAYING) return;
      this.collectedEggs++;
      this.bus.emit('eggs_updated', { collected: this.collectedEggs, total: this.totalEggs });

      // Enrage Rexy when few eggs remain to heighten endgame pressure
      if (this.totalEggs - this.collectedEggs <= 2) {
        this.rexy?.setEnraged(true);
      }

      if (this.collectedEggs >= this.totalEggs) {
        this.state = GameState.VICTORY;
        this.uiManager.setScreen(GameState.VICTORY);
      }
    });

    this.bus.on('toggle_wireframe_debug', () => this.debugVisuals.toggle());

    this.bus.on('player_died', () => {
      if (this.state !== GameState.PLAYING) return;
      this.state = GameState.GAME_OVER;
      this.uiManager.setScreen(GameState.GAME_OVER);
    });
  }

  private async startExpedition(): Promise<void> {
    const token = ++this.expeditionToken;
    this.state = GameState.LOADING;
    this.clearEntities();
    this.uiManager.setScreen(GameState.LOADING);

    const preset = DIFFICULTY_PRESETS[this.currentDifficulty];

    // 1. Atmosphere & Environment
    await this.sceneManager.setupEnvironment(this.currentLevel);
    if (token !== this.expeditionToken) return;

    await this.environment.buildTheme(this.currentLevel);
    if (token !== this.expeditionToken) {
      this.environment.clear();
      return;
    }

    // 2. Spawn Player Vehicle
    const { x: px, y: py, z: pz } = ARENA_CONFIG.playerSpawn;
    const player = new Vehicle(
      'player_halftrack',
      new THREE.Vector3(px, py, pz),
      this.bus,
      this.loader
    );
    player.maxSpeedKmh = preset.vehicleSpeed;
    player.setTerrain(this.terrain);
    player.setEnvironment(this.environment);
    await player.loadModel();
    if (token !== this.expeditionToken) {
      player.destroy();
      return;
    }

    this.player = player;
    this.sceneManager.scene.add(player.group);
    this.debugVisuals.register(player);

    // 3. Spawn Rexy Pursuer
    const { x: rx, y: ry, z: rz } = ARENA_CONFIG.rexySpawn;
    const rexy = new Rexy(
      'rexy',
      new THREE.Vector3(rx, ry, rz),
      preset.rexySpeed,
      this.bus,
      this.loader
    );
    rexy.setTarget(player);
    rexy.setEnvironment(this.environment);
    rexy.setTerrain(this.terrain);
    if (this.currentDifficulty === 'Hard') {
      rexy.setEnraged(true);
    }

    await rexy.loadModel();
    if (token !== this.expeditionToken) {
      rexy.destroy();
      return;
    }

    this.rexy = rexy;
    this.sceneManager.scene.add(rexy.group);
    this.debugVisuals.register(rexy);
    this.cameraController.snapTo(player.position, player.quaternion, rexy.position);
    this.devVisionOverlay?.attachEntities(player, rexy, this.cameraController);

    // 4. Spawn Collectibles with Terrain Elevation Awareness
    const pickups = await this.pickupSpawner.spawnMatchPickups(preset.eggCount, player);
    if (token !== this.expeditionToken) {
      pickups.forEach((p) => p.destroy());
      return;
    }

    this.pickups = pickups;
    for (const p of this.pickups) {
      this.sceneManager.scene.add(p.group);
    }

    // 5. Sync HUD, Wireframes & Begin Active Play
    this.totalEggs = preset.eggCount;
    this.collectedEggs = 0;
    this.bus.emit('eggs_updated', { collected: 0, total: this.totalEggs });
    this.bus.emit('player_health_changed', {
      health: VEHICLE_CONFIG.maxHealth,
      max: VEHICLE_CONFIG.maxHealth
    });
    this.bus.emit('player_speed_bonus', { bonus: 0 });
    this.bus.emit('hazard_state_changed', { inHazard: false, name: '' });
    this.bus.emit('player_recovered');

    this.debugVisuals.syncAll();
    this.time.reset();
    this.state = GameState.PLAYING;
    this.uiManager.setScreen(GameState.PLAYING);
  }

  private clearEntities(): void {
    if (this.player) {
      this.debugVisuals.unregister(this.player);
      this.player.destroy();
      this.player = undefined;
    }

    if (this.rexy) {
      this.debugVisuals.unregister(this.rexy);
      this.rexy.destroy();
      this.rexy = undefined;
    }

    for (const p of this.pickups) {
      p.destroy();
    }
    this.pickups = [];
    this.environment.clear();
  }

  private loop(): void {
    requestAnimationFrame(this.loop.bind(this));

    const isPlaying = this.state === GameState.PLAYING;
    this.time.update(isPlaying);
    const inputs = this.inputManager.update();

    if (inputs.pause && (this.state === GameState.PLAYING || this.state === GameState.PAUSED)) {
      if (this.state === GameState.PLAYING) {
        this.state = GameState.PAUSED;
      } else {
        this.time.reset();
        this.state = GameState.PLAYING;
      }
      this.uiManager.setScreen(this.state);
    }

    if (inputs.toggleCamera) {
      const mode = this.cameraController.toggleMode();
      this.bus.emit('camera_mode_changed', { mode });
    }

    if (inputs.toggleWireframe) {
      this.debugVisuals.toggle();
    }

    if (inputs.toggleDevVision) {
      this.devVisionOverlay?.toggle();
    }

    if (this.state === GameState.PLAYING) {
      if (this.player) {
        const surface = this.terrain.getSurfaceAt(this.player.position.x, this.player.position.z);
        this.player.applyInputs(inputs);
        this.player.update(this.time.delta, surface);
        this.uiManager.updateSpeed(this.player.currentSpeedKmh);

        this.cameraController.update(
          this.player.position,
          this.player.quaternion,
          this.time.delta,
          this.player.currentSpeedKmh,
          this.rexy?.position
        );
        this.sceneManager.updateLightTarget(this.player.position);
      }

      this.rexy?.update(this.time.delta);

      for (let i = this.pickups.length - 1; i >= 0; i--) {
        const p = this.pickups[i];
        p.update(this.time.delta);
        if (p.isCollected || p.isDestroyed) {
          this.pickups.splice(i, 1);
        }
      }
    }

    // Update Developer Vision telemetry overlay (dev mode only)
    this.devVisionOverlay?.update(this.player, this.rexy, this.terrain, this.cameraController);

    this.renderer.render(this.sceneManager.scene, this.cameraController.camera);
  }
}
