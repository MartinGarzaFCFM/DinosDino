/**
 * Declarative configuration for 3D terrain elevation and surface zones.
 * Modify these values to adjust hill heights, slope gradients, and mud hazard locations
 * without touching any physics or rendering code.
 */

export interface TerrainMudZone {
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
  linearDamping: number;    // Viscous drag factor (e.g. 0.58–0.70; hardpack baseline is 0.15)
  depth: number;            // Negative depression depth in meters (e.g. -2.8)
}

export interface TerrainHill {
  id: string;
  name: string;
  x: number;
  z: number;
  radius: number;
  height: number;           // Elevation in meters (e.g. +19.5)
}

export interface TerrainConfig {
  size: number;
  segments: number;
  hills: TerrainHill[];
  mudZones: TerrainMudZone[];
}

export const DEFAULT_TERRAIN_CONFIG: TerrainConfig = {
  size: 1600,
  segments: 64, // 64x64 grid provides smooth hills and crisp vertex color gradients

  // Modular Hill Placements (Rolling dunes, steep vantage points, and stunt jump crests)
  hills: [
    {
      id: 'hill_center_jump',
      name: 'Apex Launch Ramp',
      x: 80,
      z: 90,
      radius: 95,
      height: 19.5
    },
    {
      id: 'hill_north_east',
      name: 'Lookout Ridge',
      x: 240,
      z: 220,
      radius: 130,
      height: 22.0
    },
    {
      id: 'hill_south_east',
      name: 'Dune Crest',
      x: 280,
      z: -240,
      radius: 145,
      height: 25.0
    },
    {
      id: 'hill_west',
      name: 'Plateau Slope',
      x: -300,
      z: 40,
      radius: 140,
      height: 18.0
    }
  ],

  // Modular Mud / Swamp Hazards (Reduced traction, higher drag, and viscous fluid deceleration)
  mudZones: [
    {
      id: 'mud_central',
      name: 'Central Mud Slough',
      x: -95,
      z: 70,
      radius: 85,
      linearDamping: 0.65,
      depth: -2.8
    },
    {
      id: 'mud_east',
      name: 'East Sinkhole Bog',
      x: 130,
      z: -75,
      radius: 90,
      linearDamping: 0.62,
      depth: -2.6
    },
    {
      id: 'mud_north_west',
      name: 'Quarry Mud Basin',
      x: -220,
      z: 220,
      radius: 110,
      linearDamping: 0.68,
      depth: -3.2
    },
    {
      id: 'mud_south_west',
      name: 'Tar Pits',
      x: -240,
      z: -240,
      radius: 95,
      linearDamping: 0.70,
      depth: -2.8
    },
    {
      id: 'mud_south_central',
      name: 'Swamp Depression',
      x: 50,
      z: -290,
      radius: 100,
      linearDamping: 0.58,
      depth: -2.5
    }
  ]
};

