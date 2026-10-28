import { Difficulty } from '../core/GameState.ts';

export interface DifficultyPreset {
  rexySpeed: number;
  vehicleSpeed: number;
  eggCount: number;
}

export const DIFFICULTY_PRESETS: Record<Difficulty, DifficultyPreset> = {
  Easy: { rexySpeed: 12, vehicleSpeed: 7000, eggCount: 4 },
  Medium: { rexySpeed: 17, vehicleSpeed: 6200, eggCount: 6 },
  Hard: { rexySpeed: 23, vehicleSpeed: 5500, eggCount: 8 }
};

export const ARENA_CONFIG = {
  terrainSize: 1600,
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
  chassisSize: { x: 5.6, y: 2.6, z: 12 },
  mass: 550,
  linearDamping: 0.15,
  angularDamping: 0.45,
  centerOfMassOffsetY: -0.4,
  spawnElevationOffset: 3,
  maxHealth: 5,
  baseEngineForce: 6500,
  maxSteerVal: 0.55,
  brakeForce: 220,
  wheel: {
    radius: 1.35,
    halfWidth: 2.4,
    halfLength: 4.4,
    axleY: -0.55,
    suspensionStiffness: 40,
    suspensionRestLength: 0.55,
    frictionSlip: 3.8,
    dampingRelaxation: 2.8,
    dampingCompression: 4.2,
    maxSuspensionForce: 16000,
    rollInfluence: 0.05,
    maxSuspensionTravel: 0.35
  },
  rexyHit: {
    elevationKick: 1.5,
    horizontalSpeed: 75,
    verticalLift: 45,
    pitchTorque: 16,
    yawTorque: 12,
    rollTorque: 16
  }
} as const;

export const REXY_CONFIG = {
  modelUrl: '/assets/modelos/Rexy/Rexy.gltf',
  animationClipName: 'Bip001|Take 001|BaseLayer',
  scale: 2.4,
  minSpeed: 9,
  detectionRange: 800,
  attackRange: 38,
  bodyTouchRadius: 26,
  bodyShoveStrength: 38,
  attackCooldown: 1.2,
  turnLerpSpeed: 3.5,
  hitUpwardBias: 0.55
} as const;

export const PICKUP_DEFAULTS = {
  pickupRadius: 9.5,
  hoverOffsetY: 2.5,
  bobAmplitude: 0.7,
  bobFrequency: 2.5,
  spinSpeed: 2.0,
  speedTireBonus: 600,
  spraySlowAmount: 3.5,
  heartHealAmount: 1,
  counts: {
    speedTires: 4,
    sprays: 4,
    hearts: 3
  }
} as const;

