import { LevelTheme } from '../core/GameState.ts';

export interface LocalBoxDefinition {
  /** Unscaled size in model-local units */
  size: { x: number; y: number; z: number };
  /** Unscaled center offset in model-local units */
  center: { x: number; y: number; z: number };
}

export interface BuildingMaterialOverride {
  generateBoxUVsScale?: number;
  textureUrl?: string;
  textureRepeat?: number;
  primaryColorHex: number;
  chimneyColorHex?: number;
  roughness: number;
  metalness: number;
}

export interface BuildingBlueprint {
  id: string;
  modelUrl: string;
  /**
   * Explicit compound collision boxes in unscaled model space.
   * If omitted, Building computes a tightened AABB automatically.
   */
  localColliders?: LocalBoxDefinition[];
  autoColliderHorizontalShrink?: number;
  materialOverride?: BuildingMaterialOverride;
}

export interface BuildingPlacement {
  blueprintId: keyof typeof BUILDING_BLUEPRINTS;
  position: { x: number; y: number; z: number };
  rotationY: number;
  scale: number;
}

export interface LevelDefinition {
  id: LevelTheme;
  label: string;
  groundTextureUrl: string;
  groundRepeat: number;
  fogColor: string;
  fogDensity: number;
  buildings: BuildingPlacement[];
}

const INDUSTRIAL_FACTORY_MATERIAL: BuildingMaterialOverride = {
  generateBoxUVsScale: 0.08,
  textureUrl: '/assets/texturas/metal_plate_diff_1k.jpg',
  textureRepeat: 4,
  primaryColorHex: 0xb8c0c8,
  chimneyColorHex: 0xb23b23,
  roughness: 0.5,
  metalness: 0.3
};

/**
 * Open/Closed catalog of 3D building archetypes.
 * New buildings can be registered here with custom compound colliders or material overrides
 * without touching Building.ts physics or rendering code.
 */
export const BUILDING_BLUEPRINTS = {
  lab: {
    id: 'lab',
    modelUrl: '/assets/modelos/Edificios/Lab.fbx',
    autoColliderHorizontalShrink: 0.92
  },
  museo: {
    id: 'museo',
    modelUrl: '/assets/modelos/Edificios/Museo.fbx',
    autoColliderHorizontalShrink: 0.92
  },
  cabin: {
    id: 'cabin',
    modelUrl: '/assets/modelos/Cabin.fbx',
    // L-shaped cabin: Main rear body + Left wing room, leaving front-right porch open
    localColliders: [
      { size: { x: 64, y: 62, z: 52 }, center: { x: 0, y: 31, z: 18 } },
      { size: { x: 32, y: 50, z: 34 }, center: { x: -16, y: 25, z: -25 } }
    ]
  },
  casaBosque: {
    id: 'casaBosque',
    modelUrl: '/assets/modelos/CasaBosque.fbx',
    // True manor volume (ignores stray exported vertices extending to Z = 1887)
    localColliders: [
      { size: { x: 1650, y: 460, z: 900 }, center: { x: 0, y: 230, z: 25 } }
    ]
  },
  factoryMain: {
    id: 'factoryMain',
    modelUrl: '/assets/modelos/Factory.fbx',
    localColliders: [
      { size: { x: 68, y: 90, z: 98 }, center: { x: 6.9, y: 45, z: 1.3 } },
      { size: { x: 22, y: 120, z: 60 }, center: { x: -24, y: 60, z: 20 } }
    ],
    materialOverride: INDUSTRIAL_FACTORY_MATERIAL
  },
  factorySecondary: {
    id: 'factorySecondary',
    modelUrl: '/assets/modelos/Factory2.fbx',
    localColliders: [
      { size: { x: 94, y: 45, z: 82 }, center: { x: -1.4, y: 23, z: -6 } }
    ],
    materialOverride: INDUSTRIAL_FACTORY_MATERIAL
  }
} as const satisfies Record<string, BuildingBlueprint>;

/**
 * Declarative registry of playable arena levels.
 */
export const LEVEL_REGISTRY: Record<LevelTheme, LevelDefinition> = {
  Park: {
    id: 'Park',
    label: 'Park',
    groundTextureUrl: '/assets/texturas/suelo.jpg',
    groundRepeat: 40,
    fogColor: '#1a2634',
    fogDensity: 0.00075,
    buildings: [
      { blueprintId: 'lab', position: { x: -300, y: 0, z: 300 }, rotationY: Math.PI / 2, scale: 2.5 },
      { blueprintId: 'museo', position: { x: -300, y: 0, z: -250 }, rotationY: Math.PI / 2, scale: 2.5 },
      { blueprintId: 'cabin', position: { x: 150, y: 0, z: -100 }, rotationY: 0, scale: 1.1 }
    ]
  },
  Steel: {
    id: 'Steel',
    label: 'Factory',
    groundTextureUrl: '/assets/texturas/metal_plate_diff_1k.jpg',
    groundRepeat: 40,
    fogColor: '#1e242b',
    fogDensity: 0.0008,
    buildings: [
      { blueprintId: 'factoryMain', position: { x: -200, y: 0, z: -200 }, rotationY: 0, scale: 1.2 },
      { blueprintId: 'factorySecondary', position: { x: 200, y: 0, z: 200 }, rotationY: Math.PI / 2, scale: 1.0 }
    ]
  },
  Woods: {
    id: 'Woods',
    label: 'Woods',
    groundTextureUrl: '/assets/texturas/coast_sand_rocks_02_diff_1k.jpg',
    groundRepeat: 40,
    fogColor: '#182620',
    fogDensity: 0.00075,
    buildings: [
      { blueprintId: 'casaBosque', position: { x: -280, y: 0, z: -350 }, rotationY: 0, scale: 0.20 },
      { blueprintId: 'cabin', position: { x: 220, y: 0, z: 180 }, rotationY: Math.PI / 4, scale: 1.2 }
    ]
  }
};

