import { Difficulty } from '../core/GameState.ts';

export interface DifficultyPreset {
  rexySpeed: number;
  vehicleSpeed: number;
  eggCount: number;
}

export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyPreset> = {
  // Player hyper-speed cruising ~245-275 km/h; Rexy base ~165 to 210 km/h; Rexy sprint ~240 to 300 km/h
  Easy: { rexySpeed: 46.0, vehicleSpeed: 275, eggCount: 4 },
  Medium: { rexySpeed: 52.0, vehicleSpeed: 260, eggCount: 6 },
  Hard: { rexySpeed: 58.0, vehicleSpeed: 245, eggCount: 8 }
};

export const ARENA_CONFIG = {
  terrainSize: 1600,
  arenaDriveBound: 780,
  wallHeight: 40,
  wallThickness: 10,
  pickupSpawnBound: 350,
  minDistanceFromOrigin: 25,
  buildingClearanceMargin: 25,
  playerSpawn: { x: 0, y: 2, z: 0 },
  rexySpawn: { x: -180, y: 0, z: -180 }
} as const;

export const VEHICLE_CONFIG = {
  modelUrl: '/assets/modelos/Carro/carro.gltf',
  modelScale: 4,
  chassisSize: { x: 5.6, y: 2.2, z: 11.2 },
  rideHeight: 1.1,             // Ground offset clearance for wheels/tracks
  maxHealth: 5,

  // Arcade Driving Dynamics (High Speed, Heavy Drift & Ballistic Airtime)
  maxSpeedKmh: 260,            // Base cruising speed on flat terrain (km/h) (tunable up to 420 km/h)
  maxReverseSpeedKmh: 65,      // Reverse speed limit (km/h)
  acceleration: 36.0,          // m/s²: Explosive, punchy throttle thrust (0 to 100 km/h in < 0.8s)
  launchBoost: 2.4,            // Low-speed punch multiplier off the line (0 to 65% of top speed)
  brakeDecel: 54.0,            // m/s²: Active stopping power matching hyper cruising speeds
  coastDecel: 7.0,             // m/s²: Natural rolling resistance when releasing throttle
  turnSpeed: 1.85,             // rad/sec: Lower sensitivity for weighted, stable cornering
  driftGrip: 9.0,              // Base lateral grip; dynamically slips at high speeds for realistic drift
  handbrakeGrip: 2.8,          // Drift grip when holding space/handbrake (allows power-sliding)
  gravity: 38.0,               // m/s²: Realistic downward gravity for jumps/launches

  rexyHit: {
    horizontalSpeed: 125,       // Visceral, extreme ballistic knockback thrust
    verticalLift: 24,           // Massive dramatic airborne launch
    yawTorque: 8
  },
  damageGraceDuration: 2.5,     // Post-hit invulnerability grace (seconds)
  adrenalineBoostDuration: 2.5, // Emergency launch boost window after taking damage (seconds)
  adrenalineTorqueMultiplier: 2.0 // Extra launch torque multiplier during adrenaline surge
} as const;

export const REXY_CONFIG = {
  modelUrl: '/assets/modelos/Rexy/Rexy.gltf',
  animationClipName: 'Bip001|Take 001|BaseLayer',
  scale: 2.4,
  baseSpeed: 52.0,              // Cruising pursuit locomotion velocity (~187 km/h)
  minSpeed: 38.0,
  detectionRange: 1200,
  attackRange: 42,
  bodyTouchRadius: 28,
  bodyShoveStrength: 95,        // Massive physical body shove launching the player way farther
  attackCooldown: 3.0,          // Minimum interval between successive bite attacks
  postAttackRecoveryDuration: 2.5, // Predator pause/triumph delay after landing a hit (seconds)
  turnLerpSpeed: 4.5,          // Snappy turning to cut off high-speed evasion maneuvers
  hitUpwardBias: 0.55,

  // --- Target leading (predictive intercept) ---
  leadTimeMin: 0.3,
  leadTimeMax: 2.0,

  // --- Sprint Lunge Burst ---
  sprintMultiplier: 1.45,      // Bursts up to ~271 km/h to overtake player!
  sprintDuration: 2.6,
  sprintCooldown: 7.0,
  sprintTriggerDistance: 130,

  // --- Post-sprint exhaustion window ---
  exhaustionDuration: 1.4,
  exhaustionSpeedMultiplier: 0.75,

  // --- Enraged Mode ---
  enragedSpeedMultiplier: 1.25,// +25% permanent base speed when enraged!
  enragedSprintMultiplier: 1.45,

  // --- Distant Pursuit Roar & Acoustic EMP Shockwave ---
  roarMinDistance: 45,         // Roars across arena
  roarMaxDistance: 500,
  roarInitialWarmup: 12.0,     // Gives player 12s opening buffer to drive and build speed
  roarCooldown: 16.0,          // Periodic roar during chase
  roarCastDuration: 2.8,       // 2.8s telegraph cast bar for player to react and escape
  roarStunDuration: 2.0,       // Shuts down engine and stalls vehicle for 2.0s
  roarShockwaveRadius: 480,    // 480m massive shockwave blast

  // --- Obstacle Avoidance Raycast Whiskers ---
  whiskerDistance: 50,
  whiskerAngle: 0.52           // ~30 degrees in radians
} as const;

export const PICKUP_DEFAULTS = {
  pickupRadius: 9.5,
  hoverOffsetY: 2.5,
  bobAmplitude: 0.7,
  bobFrequency: 2.5,
  spinSpeed: 2.0,
  speedTireBonus: 15,          // +15 km/h permanent top speed boost per tire
  spraySlowAmount: 4.0,        // 4.0 m/s (~14.4 km/h) speed reduction on Rexy
  heartHealAmount: 1,
  counts: {
    speedTires: 4,
    sprays: 4,
    hearts: 3
  }
} as const;
