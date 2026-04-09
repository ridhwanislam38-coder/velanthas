// ── Area Config — Multi-area definitions for Ashfields region ───────────────
// Each area is a 1024x1024 pre-rendered background displayed at 480x480 game px.
// Areas connect via transition zones (invisible rectangles).

export interface TransitionConfig {
  /** Rectangle trigger zone in world coordinates */
  x: number; y: number; w: number; h: number;
  /** Area ID to load when player enters this zone */
  targetArea: string;
  /** Where player spawns in the target area */
  targetSpawn: { x: number; y: number };
  /** Optional label shown briefly on transition ("Entering Tavern...") */
  label?: string;
}

export interface AreaConfig {
  /** Unique area identifier */
  id: string;
  /** Display name shown on area entry */
  name: string;
  /** Phaser texture key (preloaded in BootScene) */
  background: string;
  /** Path in public/ for the image */
  imagePath: string;
  /** World dimensions in game pixels */
  worldW: number;
  worldH: number;
  /** Default player spawn position */
  playerSpawn: { x: number; y: number };
  /** Transition zones linking to other areas */
  transitions: TransitionConfig[];
}

// ── Ashfields Areas ─────────────────────────────────────────────────────────

const WORLD = 480;

export const AREA_CONFIGS: Record<string, AreaConfig> = {
  ashfields_hub: {
    id: 'ashfields_hub',
    name: 'Ashfields — Town Square',
    background: 'ashfields_hub',
    imagePath: 'assets/areas/ashfields/town_square_2.jpg',
    worldW: WORLD,
    worldH: WORLD,
    playerSpawn: { x: 240, y: 390 },  // open cobblestone courtyard
    transitions: [
      {
        // Bottom-center → street
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'ashfields_street',
        targetSpawn: { x: 240, y: 30 },
        label: 'To the Street',
      },
      {
        // Right side → tavern
        x: 460, y: 180, w: 20, h: 80,
        targetArea: 'ashfields_tavern',
        targetSpawn: { x: 30, y: 240 },
        label: 'Enter Tavern',
      },
    ],
  },

  ashfields_street: {
    id: 'ashfields_street',
    name: 'Ashfields — Back Alley',
    background: 'ashfields_street',
    imagePath: 'assets/areas/ashfields/street_1.jpg',
    worldW: WORLD,
    worldH: WORLD,
    playerSpawn: { x: 240, y: 240 },
    transitions: [
      {
        // Top → back to hub
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'ashfields_hub',
        targetSpawn: { x: 240, y: 440 },
        label: 'To Town Square',
      },
      {
        // Bottom → market square
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'ashfields_market',
        targetSpawn: { x: 240, y: 30 },
        label: 'To Market Square',
      },
    ],
  },

  ashfields_tavern: {
    id: 'ashfields_tavern',
    name: 'Ashfields — Tavern',
    background: 'ashfields_tavern',
    imagePath: 'assets/areas/ashfields/tavern_3.jpg',
    worldW: WORLD,
    worldH: WORLD,
    playerSpawn: { x: 240, y: 350 },  // floor area between tables
    transitions: [
      {
        // Bottom-center → back to hub
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'ashfields_hub',
        targetSpawn: { x: 440, y: 220 },
        label: 'Exit Tavern',
      },
    ],
  },

  ashfields_market: {
    id: 'ashfields_market',
    name: 'Ashfields — Market Square',
    background: 'ashfields_market',
    imagePath: 'assets/areas/ashfields/square_2.jpg',
    worldW: WORLD,
    worldH: WORLD,
    playerSpawn: { x: 240, y: 240 },
    transitions: [
      {
        // Top → back to street
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'ashfields_street',
        targetSpawn: { x: 240, y: 440 },
        label: 'To Back Alley',
      },
    ],
  },
};

/** Look up an area config by ID. Throws if not found. */
export function getAreaConfig(areaId: string): AreaConfig {
  const cfg = AREA_CONFIGS[areaId];
  if (!cfg) throw new Error(`[AreaConfig] Unknown area: "${areaId}"`);
  return cfg;
}
