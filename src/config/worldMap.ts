// ── World Map — Single source of truth for the entire Velanthas world ────────
// ~65 rooms across 6 regions. Triangle Strategy scale.
// Each area is a 480x480 game-px room with transitions connecting them.

const WORLD = 480;

// ── Types ──────────────────────────────────────────────────────────────────

export interface WorldTransition {
  x: number; y: number; w: number; h: number;
  targetArea: string;
  targetSpawn: { x: number; y: number };
  type: 'path' | 'door' | 'stairs' | 'cave';
  label?: string;
}

export interface WorldAreaConfig {
  id: string;
  name: string;
  region: string;
  background: string;
  hasRealBackground: boolean;
  worldW: number;
  worldH: number;
  playerSpawn: { x: number; y: number };
  transitions: WorldTransition[];
  lightTint?: { color: number; alpha: number };
  particles?: 'dust' | 'embers' | 'fireflies' | 'rain' | 'none';
  collisionMap?: string;
  npcs?: string[];
  enemies?: string[];
  ambientAudio?: string;
}

export interface RegionConfig {
  id: string;
  name: string;
  areas: Record<string, WorldAreaConfig>;
}

// ── Lighting presets ───────────────────────────────────────────────────────

const LIGHT_OUTDOOR  = { color: 0xaa8855, alpha: 0.06 };
const LIGHT_INDOOR   = { color: 0xcc8844, alpha: 0.10 };
const LIGHT_SEWER    = { color: 0x446688, alpha: 0.12 };
const LIGHT_TEMPLE   = { color: 0xF5F0E8, alpha: 0.05 };
const LIGHT_FOREST   = { color: 0x55aa66, alpha: 0.06 };
const LIGHT_CEMETERY = { color: 0x667788, alpha: 0.08 };
const LIGHT_CRYPT    = { color: 0x556688, alpha: 0.12 };
const LIGHT_CITY     = { color: 0xbbaa77, alpha: 0.05 };
const LIGHT_UNDERCIT = { color: 0x556644, alpha: 0.10 };
const LIGHT_VOID     = { color: 0x8844cc, alpha: 0.10 };
const LIGHT_VOID_D   = { color: 0x6622aa, alpha: 0.14 };
const LIGHT_HOLLOW   = { color: 0xF5F0E8, alpha: 0.04 };

// ── Helper: placeholder area ───────────────────────────────────────────────

function placeholder(
  id: string, name: string, region: string,
  opts?: Partial<WorldAreaConfig>,
): WorldAreaConfig {
  return {
    id, name, region,
    background: '',
    hasRealBackground: false,
    worldW: WORLD,
    worldH: WORLD,
    playerSpawn: { x: 240, y: 240 },
    transitions: [],
    ...opts,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// ASHFIELDS — 13 rooms
// ═══════════════════════════════════════════════════════════════════════════
//
// [Town Gate] <-> [Town Square] <-> [Market Square]
//                     |                    |
//               [Back Alley]         [Merchant Row]
//                     |                    |
//               [Slum Quarter]       [Guild Hall]
//                     |
//               [Sewer Entrance]
//                     |
//               [Sewer 1] <-> [Sewer 2]
//                     |
//               [Sewer Boss]
// [Town Square] -> [Tavern]
// [Town Square] -> [Temple]

const ASHFIELDS_AREAS: Record<string, WorldAreaConfig> = {
  ash_town_gate: placeholder('ash_town_gate', 'Town Gate', 'ashfields', {
    lightTint: LIGHT_OUTDOOR,
    particles: 'dust',
    npcs: ['captain_rhoe'],
    transitions: [
      {
        // Right edge -> Town Square
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'ash_town_square',
        targetSpawn: { x: 30, y: 240 },
        type: 'path',
        label: 'To Town Square',
      },
    ],
  }),

  ash_town_square: {
    id: 'ash_town_square',
    name: 'Town Square',
    region: 'ashfields',
    background: 'ashfields_hub',
    hasRealBackground: true,
    worldW: WORLD,
    worldH: WORLD,
    playerSpawn: { x: 240, y: 280 },
    lightTint: LIGHT_OUTDOOR,
    particles: 'dust',
    collisionMap: 'assets/areas/ashfields/square_2_collision.json',
    transitions: [
      {
        // Left edge -> Town Gate
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'ash_town_gate',
        targetSpawn: { x: 440, y: 240 },
        type: 'path',
        label: 'To Town Gate',
      },
      {
        // Right edge -> Market Square
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'ash_market',
        targetSpawn: { x: 30, y: 240 },
        type: 'path',
        label: 'To Market Square',
      },
      {
        // Bottom edge -> Back Alley
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'ash_back_alley',
        targetSpawn: { x: 240, y: 30 },
        type: 'path',
        label: 'To Back Alley',
      },
      {
        // Door -> Tavern (specific location on bg)
        x: 380, y: 160, w: 40, h: 20,
        targetArea: 'ash_tavern',
        targetSpawn: { x: 240, y: 420 },
        type: 'door',
        label: 'Enter Tavern',
      },
      {
        // Door -> Temple (specific location on bg)
        x: 100, y: 160, w: 40, h: 20,
        targetArea: 'ash_temple',
        targetSpawn: { x: 240, y: 420 },
        type: 'door',
        label: 'Enter Temple',
      },
    ],
  },

  ash_market: {
    id: 'ash_market',
    name: 'Market Square',
    region: 'ashfields',
    background: 'ashfields_market',
    hasRealBackground: true,
    worldW: WORLD,
    worldH: WORLD,
    playerSpawn: { x: 240, y: 240 },
    lightTint: LIGHT_OUTDOOR,
    particles: 'dust',
    npcs: ['verso'],
    transitions: [
      {
        // Left edge -> Town Square
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'ash_town_square',
        targetSpawn: { x: 440, y: 240 },
        type: 'path',
        label: 'To Town Square',
      },
      {
        // Bottom edge -> Merchant Row
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'ash_merchant_row',
        targetSpawn: { x: 240, y: 30 },
        type: 'path',
        label: 'To Merchant Row',
      },
    ],
  },

  ash_back_alley: {
    id: 'ash_back_alley',
    name: 'Back Alley',
    region: 'ashfields',
    background: 'ashfields_street',
    hasRealBackground: true,
    worldW: WORLD,
    worldH: WORLD,
    playerSpawn: { x: 240, y: 240 },
    lightTint: { color: 0x6688aa, alpha: 0.08 },
    particles: 'dust',
    transitions: [
      {
        // Top edge -> Town Square
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'ash_town_square',
        targetSpawn: { x: 240, y: 440 },
        type: 'path',
        label: 'To Town Square',
      },
      {
        // Bottom edge -> Slum Quarter
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'ash_slum',
        targetSpawn: { x: 240, y: 30 },
        type: 'path',
        label: 'To Slum Quarter',
      },
    ],
  },

  ash_merchant_row: placeholder('ash_merchant_row', 'Merchant Row', 'ashfields', {
    lightTint: LIGHT_OUTDOOR,
    particles: 'dust',
    transitions: [
      {
        // Top edge -> Market Square
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'ash_market',
        targetSpawn: { x: 240, y: 440 },
        type: 'path',
        label: 'To Market Square',
      },
      {
        // Bottom edge -> Guild Hall
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'ash_guild_hall',
        targetSpawn: { x: 240, y: 30 },
        type: 'path',
        label: 'To Guild Hall',
      },
    ],
  }),

  ash_slum: placeholder('ash_slum', 'Slum Quarter', 'ashfields', {
    lightTint: LIGHT_OUTDOOR,
    particles: 'dust',
    npcs: ['maren'],
    transitions: [
      {
        // Top edge -> Back Alley
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'ash_back_alley',
        targetSpawn: { x: 240, y: 440 },
        type: 'path',
        label: 'To Back Alley',
      },
      {
        // Bottom edge -> Sewer Entrance
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'ash_sewer_entrance',
        targetSpawn: { x: 240, y: 30 },
        type: 'stairs',
        label: 'To Sewer Entrance',
      },
    ],
  }),

  ash_guild_hall: placeholder('ash_guild_hall', 'Guild Hall', 'ashfields', {
    lightTint: LIGHT_INDOOR,
    particles: 'dust',
    transitions: [
      {
        // Top edge -> Merchant Row
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'ash_merchant_row',
        targetSpawn: { x: 240, y: 440 },
        type: 'path',
        label: 'To Merchant Row',
      },
    ],
  }),

  ash_sewer_entrance: placeholder('ash_sewer_entrance', 'Sewer Entrance', 'ashfields', {
    lightTint: LIGHT_SEWER,
    particles: 'none',
    transitions: [
      {
        // Top edge -> Slum Quarter
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'ash_slum',
        targetSpawn: { x: 240, y: 440 },
        type: 'stairs',
        label: 'To Slum Quarter',
      },
      {
        // Bottom edge -> Sewer Tunnels
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'ash_sewer_1',
        targetSpawn: { x: 240, y: 30 },
        type: 'cave',
        label: 'To Sewer Tunnels',
      },
    ],
  }),

  ash_sewer_1: placeholder('ash_sewer_1', 'Sewer Tunnels', 'ashfields', {
    lightTint: LIGHT_SEWER,
    particles: 'none',
    transitions: [
      {
        // Top edge -> Sewer Entrance
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'ash_sewer_entrance',
        targetSpawn: { x: 240, y: 440 },
        type: 'cave',
        label: 'To Sewer Entrance',
      },
      {
        // Right edge -> Deep Sewers
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'ash_sewer_2',
        targetSpawn: { x: 30, y: 240 },
        type: 'cave',
        label: 'To Deep Sewers',
      },
      {
        // Bottom edge -> Sewer Boss
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'ash_sewer_boss',
        targetSpawn: { x: 240, y: 30 },
        type: 'cave',
        label: 'To Sewer Chamber',
      },
    ],
  }),

  ash_sewer_2: placeholder('ash_sewer_2', 'Deep Sewers', 'ashfields', {
    lightTint: LIGHT_SEWER,
    particles: 'none',
    transitions: [
      {
        // Left edge -> Sewer Tunnels
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'ash_sewer_1',
        targetSpawn: { x: 440, y: 240 },
        type: 'cave',
        label: 'To Sewer Tunnels',
      },
    ],
  }),

  ash_sewer_boss: placeholder('ash_sewer_boss', 'Sewer Chamber', 'ashfields', {
    lightTint: LIGHT_SEWER,
    particles: 'none',
    transitions: [
      {
        // Top edge -> Sewer Tunnels
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'ash_sewer_1',
        targetSpawn: { x: 240, y: 440 },
        type: 'cave',
        label: 'To Sewer Tunnels',
      },
    ],
  }),

  ash_tavern: {
    id: 'ash_tavern',
    name: 'Tavern Interior',
    region: 'ashfields',
    background: 'ashfields_tavern',
    hasRealBackground: true,
    worldW: WORLD,
    worldH: WORLD,
    playerSpawn: { x: 240, y: 350 },
    lightTint: LIGHT_INDOOR,
    particles: 'embers',
    transitions: [
      {
        // Bottom-center -> exit to Town Square
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'ash_town_square',
        targetSpawn: { x: 380, y: 180 },
        type: 'door',
        label: 'Exit Tavern',
      },
    ],
  },

  ash_temple: placeholder('ash_temple', 'Temple Sanctum', 'ashfields', {
    lightTint: LIGHT_TEMPLE,
    particles: 'dust',
    npcs: ['magistra_eon'],
    transitions: [
      {
        // Bottom-center -> exit to Town Square
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'ash_town_square',
        targetSpawn: { x: 100, y: 180 },
        type: 'door',
        label: 'Exit Temple',
      },
    ],
  }),
};

// ═══════════════════════════════════════════════════════════════════════════
// VERDENMERE — 12 rooms
// ═══════════════════════════════════════════════════════════════════════════
//
// [Forest Path] -> [Clearing] -> [Grove]
//                      |     \-> [Stream] -> [Hidden Spring]
//                      |
//                [Elder Hut]
//                      |
//                [Deep Woods] -> [Mushroom Cave]
//                      |
//                [Canopy Bridge] -> [Luma Nest]
//                      |
//                [Old Grove Entrance] -> [Old Grove Arena]

const VERDENMERE_AREAS: Record<string, WorldAreaConfig> = {
  ver_forest_path: placeholder('ver_forest_path', 'Forest Path', 'verdenmere', {
    lightTint: LIGHT_FOREST,
    particles: 'fireflies',
    transitions: [
      {
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'ver_clearing',
        targetSpawn: { x: 30, y: 240 },
        type: 'path',
        label: 'To the Clearing',
      },
    ],
  }),

  ver_clearing: placeholder('ver_clearing', 'Woodland Clearing', 'verdenmere', {
    lightTint: LIGHT_FOREST,
    particles: 'fireflies',
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'ver_forest_path',
        targetSpawn: { x: 440, y: 240 },
        type: 'path',
        label: 'To Forest Path',
      },
      {
        x: 460, y: 120, w: 20, h: 80,
        targetArea: 'ver_grove',
        targetSpawn: { x: 30, y: 240 },
        type: 'path',
        label: 'To the Grove',
      },
      {
        x: 460, y: 300, w: 20, h: 80,
        targetArea: 'ver_stream',
        targetSpawn: { x: 30, y: 240 },
        type: 'path',
        label: 'To the Stream',
      },
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'ver_elder_hut',
        targetSpawn: { x: 240, y: 30 },
        type: 'path',
        label: 'To Elder Hut',
      },
    ],
  }),

  ver_grove: placeholder('ver_grove', 'Sacred Grove', 'verdenmere', {
    lightTint: LIGHT_FOREST,
    particles: 'fireflies',
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'ver_clearing',
        targetSpawn: { x: 440, y: 160 },
        type: 'path',
        label: 'To Clearing',
      },
    ],
  }),

  ver_stream: placeholder('ver_stream', 'Mossy Stream', 'verdenmere', {
    lightTint: LIGHT_FOREST,
    particles: 'fireflies',
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'ver_clearing',
        targetSpawn: { x: 440, y: 340 },
        type: 'path',
        label: 'To Clearing',
      },
      {
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'ver_hidden_spring',
        targetSpawn: { x: 30, y: 240 },
        type: 'path',
        label: 'To Hidden Spring',
      },
    ],
  }),

  ver_hidden_spring: placeholder('ver_hidden_spring', 'Hidden Spring', 'verdenmere', {
    lightTint: { color: 0x44bbaa, alpha: 0.06 },
    particles: 'fireflies',
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'ver_stream',
        targetSpawn: { x: 440, y: 240 },
        type: 'path',
        label: 'To Stream',
      },
    ],
  }),

  ver_elder_hut: placeholder('ver_elder_hut', 'Elder Hut', 'verdenmere', {
    lightTint: LIGHT_INDOOR,
    particles: 'dust',
    npcs: ['elder_moss'],
    transitions: [
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'ver_clearing',
        targetSpawn: { x: 240, y: 440 },
        type: 'door',
        label: 'To Clearing',
      },
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'ver_deep_woods',
        targetSpawn: { x: 240, y: 30 },
        type: 'path',
        label: 'To Deep Woods',
      },
    ],
  }),

  ver_deep_woods: placeholder('ver_deep_woods', 'Deep Woods', 'verdenmere', {
    lightTint: { color: 0x336644, alpha: 0.10 },
    particles: 'fireflies',
    transitions: [
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'ver_elder_hut',
        targetSpawn: { x: 240, y: 440 },
        type: 'path',
        label: 'To Elder Hut',
      },
      {
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'ver_mushroom_cave',
        targetSpawn: { x: 30, y: 240 },
        type: 'cave',
        label: 'To Mushroom Cave',
      },
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'ver_canopy_bridge',
        targetSpawn: { x: 240, y: 30 },
        type: 'path',
        label: 'To Canopy Bridge',
      },
    ],
  }),

  ver_mushroom_cave: placeholder('ver_mushroom_cave', 'Mushroom Cave', 'verdenmere', {
    lightTint: { color: 0x8866cc, alpha: 0.10 },
    particles: 'fireflies',
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'ver_deep_woods',
        targetSpawn: { x: 440, y: 240 },
        type: 'cave',
        label: 'To Deep Woods',
      },
    ],
  }),

  ver_canopy_bridge: placeholder('ver_canopy_bridge', 'Canopy Bridge', 'verdenmere', {
    lightTint: LIGHT_FOREST,
    particles: 'fireflies',
    transitions: [
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'ver_deep_woods',
        targetSpawn: { x: 240, y: 440 },
        type: 'path',
        label: 'To Deep Woods',
      },
      {
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'ver_luma_nest',
        targetSpawn: { x: 30, y: 240 },
        type: 'path',
        label: 'To Luma Nest',
      },
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'ver_old_grove_entrance',
        targetSpawn: { x: 240, y: 30 },
        type: 'path',
        label: 'To Old Grove',
      },
    ],
  }),

  ver_luma_nest: placeholder('ver_luma_nest', 'Luma Nest', 'verdenmere', {
    lightTint: { color: 0x66ddaa, alpha: 0.08 },
    particles: 'fireflies',
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'ver_canopy_bridge',
        targetSpawn: { x: 440, y: 240 },
        type: 'path',
        label: 'To Canopy Bridge',
      },
    ],
  }),

  ver_old_grove_entrance: placeholder('ver_old_grove_entrance', 'Old Grove Entrance', 'verdenmere', {
    lightTint: { color: 0x224422, alpha: 0.12 },
    particles: 'fireflies',
    transitions: [
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'ver_canopy_bridge',
        targetSpawn: { x: 240, y: 440 },
        type: 'path',
        label: 'To Canopy Bridge',
      },
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'ver_old_grove_arena',
        targetSpawn: { x: 240, y: 30 },
        type: 'path',
        label: 'To Old Grove Arena',
      },
    ],
  }),

  ver_old_grove_arena: placeholder('ver_old_grove_arena', 'Old Grove Arena', 'verdenmere', {
    lightTint: { color: 0x224422, alpha: 0.14 },
    particles: 'none',
    transitions: [
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'ver_old_grove_entrance',
        targetSpawn: { x: 240, y: 440 },
        type: 'path',
        label: 'To Old Grove Entrance',
      },
    ],
  }),
};

// ═══════════════════════════════════════════════════════════════════════════
// GREYVEIL — 11 rooms
// ═══════════════════════════════════════════════════════════════════════════
//
// [Cemetery Gate] -> [Cemetery] -> [Crypt Entrance]
//                       |               |
//                  [Mourner Sq]    [Crypt Halls] -> [Crypt Deep]
//                       |                                |
//                 [Collapsed Bridge]              [Warden Chamber]
//                       |
//                 [Bell Tower]
//
// [Cemetery] -> [Archives]
// [Crypt Deep] -> [Hidden Tomb]

const GREYVEIL_AREAS: Record<string, WorldAreaConfig> = {
  grey_cemetery_gate: placeholder('grey_cemetery_gate', 'Cemetery Gate', 'greyveil', {
    lightTint: LIGHT_CEMETERY,
    particles: 'dust',
    transitions: [
      {
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'grey_cemetery',
        targetSpawn: { x: 30, y: 240 },
        type: 'path',
        label: 'To Cemetery',
      },
    ],
  }),

  grey_cemetery: placeholder('grey_cemetery', 'The Cemetery', 'greyveil', {
    lightTint: LIGHT_CEMETERY,
    particles: 'dust',
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'grey_cemetery_gate',
        targetSpawn: { x: 440, y: 240 },
        type: 'path',
        label: 'To Cemetery Gate',
      },
      {
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'grey_crypt_entrance',
        targetSpawn: { x: 30, y: 240 },
        type: 'stairs',
        label: 'To Crypt Entrance',
      },
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'grey_mourner_square',
        targetSpawn: { x: 240, y: 30 },
        type: 'path',
        label: 'To Mourner Square',
      },
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'grey_archives',
        targetSpawn: { x: 240, y: 440 },
        type: 'door',
        label: 'To Archives',
      },
    ],
  }),

  grey_crypt_entrance: placeholder('grey_crypt_entrance', 'Crypt Entrance', 'greyveil', {
    lightTint: LIGHT_CRYPT,
    particles: 'none',
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'grey_cemetery',
        targetSpawn: { x: 440, y: 240 },
        type: 'stairs',
        label: 'To Cemetery',
      },
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'grey_crypt_halls',
        targetSpawn: { x: 240, y: 30 },
        type: 'cave',
        label: 'To Crypt Halls',
      },
    ],
  }),

  grey_crypt_halls: placeholder('grey_crypt_halls', 'Crypt Halls', 'greyveil', {
    lightTint: LIGHT_CRYPT,
    particles: 'none',
    transitions: [
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'grey_crypt_entrance',
        targetSpawn: { x: 240, y: 440 },
        type: 'cave',
        label: 'To Crypt Entrance',
      },
      {
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'grey_crypt_deep',
        targetSpawn: { x: 30, y: 240 },
        type: 'cave',
        label: 'To Crypt Deep',
      },
    ],
  }),

  grey_crypt_deep: placeholder('grey_crypt_deep', 'Crypt Depths', 'greyveil', {
    lightTint: LIGHT_CRYPT,
    particles: 'none',
    npcs: ['daevan'],
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'grey_crypt_halls',
        targetSpawn: { x: 440, y: 240 },
        type: 'cave',
        label: 'To Crypt Halls',
      },
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'grey_warden_chamber',
        targetSpawn: { x: 240, y: 30 },
        type: 'cave',
        label: 'To Warden Chamber',
      },
      {
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'grey_hidden_tomb',
        targetSpawn: { x: 30, y: 240 },
        type: 'cave',
        label: 'To Hidden Tomb',
      },
    ],
  }),

  grey_warden_chamber: placeholder('grey_warden_chamber', 'Warden Chamber', 'greyveil', {
    lightTint: LIGHT_CRYPT,
    particles: 'none',
    transitions: [
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'grey_crypt_deep',
        targetSpawn: { x: 240, y: 440 },
        type: 'cave',
        label: 'To Crypt Depths',
      },
    ],
  }),

  grey_bell_tower: placeholder('grey_bell_tower', 'Bell Tower', 'greyveil', {
    lightTint: LIGHT_CEMETERY,
    particles: 'dust',
    transitions: [
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'grey_collapsed_bridge',
        targetSpawn: { x: 240, y: 440 },
        type: 'stairs',
        label: 'To Collapsed Bridge',
      },
    ],
  }),

  grey_archives: placeholder('grey_archives', 'The Archives', 'greyveil', {
    lightTint: LIGHT_INDOOR,
    particles: 'dust',
    npcs: ['pale_archivist'],
    transitions: [
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'grey_cemetery',
        targetSpawn: { x: 240, y: 30 },
        type: 'door',
        label: 'To Cemetery',
      },
    ],
  }),

  grey_mourner_square: placeholder('grey_mourner_square', 'Mourner Square', 'greyveil', {
    lightTint: LIGHT_CEMETERY,
    particles: 'dust',
    transitions: [
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'grey_cemetery',
        targetSpawn: { x: 240, y: 440 },
        type: 'path',
        label: 'To Cemetery',
      },
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'grey_collapsed_bridge',
        targetSpawn: { x: 240, y: 30 },
        type: 'path',
        label: 'To Collapsed Bridge',
      },
    ],
  }),

  grey_collapsed_bridge: placeholder('grey_collapsed_bridge', 'Collapsed Bridge', 'greyveil', {
    lightTint: LIGHT_CEMETERY,
    particles: 'dust',
    transitions: [
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'grey_mourner_square',
        targetSpawn: { x: 240, y: 440 },
        type: 'path',
        label: 'To Mourner Square',
      },
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'grey_bell_tower',
        targetSpawn: { x: 240, y: 30 },
        type: 'stairs',
        label: 'To Bell Tower',
      },
    ],
  }),

  grey_hidden_tomb: placeholder('grey_hidden_tomb', 'Hidden Tomb', 'greyveil', {
    lightTint: { color: 0x444466, alpha: 0.14 },
    particles: 'none',
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'grey_crypt_deep',
        targetSpawn: { x: 440, y: 240 },
        type: 'cave',
        label: 'To Crypt Depths',
      },
    ],
  }),
};

// ═══════════════════════════════════════════════════════════════════════════
// GILDSPIRE — 10 rooms
// ═══════════════════════════════════════════════════════════════════════════
//
// [Main Gate] -> [Market District] -> [Guild Quarter] -> [Guild Hall]
//                      |
//                [Noble Quarter]
//                      |
//                [Undercity Entrance]
//                      |
//                [Undercity 1] -> [Undercity 2]
//                      |
//                [Undercity Boss]
// [Guild Hall] -> [Vault]

const GILDSPIRE_AREAS: Record<string, WorldAreaConfig> = {
  gild_main_gate: placeholder('gild_main_gate', 'Main Gate', 'gildspire', {
    lightTint: LIGHT_CITY,
    particles: 'dust',
    transitions: [
      {
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'gild_market_district',
        targetSpawn: { x: 30, y: 240 },
        type: 'path',
        label: 'To Market District',
      },
    ],
  }),

  gild_market_district: placeholder('gild_market_district', 'Market District', 'gildspire', {
    lightTint: LIGHT_CITY,
    particles: 'dust',
    npcs: ['verso'],
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'gild_main_gate',
        targetSpawn: { x: 440, y: 240 },
        type: 'path',
        label: 'To Main Gate',
      },
      {
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'gild_guild_quarter',
        targetSpawn: { x: 30, y: 240 },
        type: 'path',
        label: 'To Guild Quarter',
      },
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'gild_noble_quarter',
        targetSpawn: { x: 240, y: 30 },
        type: 'path',
        label: 'To Noble Quarter',
      },
    ],
  }),

  gild_guild_quarter: placeholder('gild_guild_quarter', 'Guild Quarter', 'gildspire', {
    lightTint: LIGHT_CITY,
    particles: 'dust',
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'gild_market_district',
        targetSpawn: { x: 440, y: 240 },
        type: 'path',
        label: 'To Market District',
      },
      {
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'gild_guild_hall',
        targetSpawn: { x: 30, y: 240 },
        type: 'door',
        label: 'To Guild Hall',
      },
    ],
  }),

  gild_guild_hall: placeholder('gild_guild_hall', 'Guild Hall', 'gildspire', {
    lightTint: LIGHT_INDOOR,
    particles: 'dust',
    npcs: ['guildmaster_solen'],
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'gild_guild_quarter',
        targetSpawn: { x: 440, y: 240 },
        type: 'door',
        label: 'To Guild Quarter',
      },
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'gild_vault',
        targetSpawn: { x: 240, y: 30 },
        type: 'stairs',
        label: 'To Vault',
      },
    ],
  }),

  gild_noble_quarter: placeholder('gild_noble_quarter', 'Noble Quarter', 'gildspire', {
    lightTint: LIGHT_CITY,
    particles: 'dust',
    transitions: [
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'gild_market_district',
        targetSpawn: { x: 240, y: 440 },
        type: 'path',
        label: 'To Market District',
      },
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'gild_undercity_entrance',
        targetSpawn: { x: 240, y: 30 },
        type: 'stairs',
        label: 'To Undercity',
      },
    ],
  }),

  gild_undercity_entrance: placeholder('gild_undercity_entrance', 'Undercity Entrance', 'gildspire', {
    lightTint: LIGHT_UNDERCIT,
    particles: 'none',
    transitions: [
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'gild_noble_quarter',
        targetSpawn: { x: 240, y: 440 },
        type: 'stairs',
        label: 'To Noble Quarter',
      },
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'gild_undercity_1',
        targetSpawn: { x: 240, y: 30 },
        type: 'cave',
        label: 'To Undercity Tunnels',
      },
    ],
  }),

  gild_undercity_1: placeholder('gild_undercity_1', 'Undercity Tunnels', 'gildspire', {
    lightTint: LIGHT_UNDERCIT,
    particles: 'none',
    transitions: [
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'gild_undercity_entrance',
        targetSpawn: { x: 240, y: 440 },
        type: 'cave',
        label: 'To Undercity Entrance',
      },
      {
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'gild_undercity_2',
        targetSpawn: { x: 30, y: 240 },
        type: 'cave',
        label: 'To Undercity Depths',
      },
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'gild_undercity_boss',
        targetSpawn: { x: 240, y: 30 },
        type: 'cave',
        label: 'To Undercity Chamber',
      },
    ],
  }),

  gild_undercity_2: placeholder('gild_undercity_2', 'Undercity Depths', 'gildspire', {
    lightTint: LIGHT_UNDERCIT,
    particles: 'none',
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'gild_undercity_1',
        targetSpawn: { x: 440, y: 240 },
        type: 'cave',
        label: 'To Undercity Tunnels',
      },
    ],
  }),

  gild_undercity_boss: placeholder('gild_undercity_boss', 'Undercity Chamber', 'gildspire', {
    lightTint: LIGHT_UNDERCIT,
    particles: 'none',
    transitions: [
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'gild_undercity_1',
        targetSpawn: { x: 240, y: 440 },
        type: 'cave',
        label: 'To Undercity Tunnels',
      },
    ],
  }),

  gild_vault: placeholder('gild_vault', 'The Vault', 'gildspire', {
    lightTint: { color: 0xddbb44, alpha: 0.08 },
    particles: 'dust',
    transitions: [
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'gild_guild_hall',
        targetSpawn: { x: 240, y: 440 },
        type: 'stairs',
        label: 'To Guild Hall',
      },
    ],
  }),
};

// ═══════════════════════════════════════════════════════════════════════════
// VOIDMARSH — 10 rooms
// ═══════════════════════════════════════════════════════════════════════════
//
// [Edge] -> [Shallow] -> [Deep] -> [Crystal Grove]
//                |                       |
//           [Mother Nest]          [Echo Chamber]
//                                        |
//                                  [Heart Path] -> [Heart]
//                                        |
//                                  [Null Bridge] -> [Null Throne]

const VOIDMARSH_AREAS: Record<string, WorldAreaConfig> = {
  void_edge: placeholder('void_edge', 'Marsh Edge', 'voidmarsh', {
    lightTint: LIGHT_VOID,
    particles: 'fireflies',
    transitions: [
      {
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'void_shallow',
        targetSpawn: { x: 30, y: 240 },
        type: 'path',
        label: 'To Shallow Marsh',
      },
    ],
  }),

  void_shallow: placeholder('void_shallow', 'Shallow Marsh', 'voidmarsh', {
    lightTint: LIGHT_VOID,
    particles: 'fireflies',
    npcs: ['ori'],
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'void_edge',
        targetSpawn: { x: 440, y: 240 },
        type: 'path',
        label: 'To Marsh Edge',
      },
      {
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'void_deep',
        targetSpawn: { x: 30, y: 240 },
        type: 'path',
        label: 'To Deep Marsh',
      },
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'void_mother_nest',
        targetSpawn: { x: 240, y: 30 },
        type: 'cave',
        label: 'To Mother Nest',
      },
    ],
  }),

  void_deep: placeholder('void_deep', 'Deep Marsh', 'voidmarsh', {
    lightTint: LIGHT_VOID,
    particles: 'fireflies',
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'void_shallow',
        targetSpawn: { x: 440, y: 240 },
        type: 'path',
        label: 'To Shallow Marsh',
      },
      {
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'void_crystal_grove',
        targetSpawn: { x: 30, y: 240 },
        type: 'path',
        label: 'To Crystal Grove',
      },
    ],
  }),

  void_crystal_grove: placeholder('void_crystal_grove', 'Crystal Grove', 'voidmarsh', {
    lightTint: { color: 0xaa66ff, alpha: 0.08 },
    particles: 'fireflies',
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'void_deep',
        targetSpawn: { x: 440, y: 240 },
        type: 'path',
        label: 'To Deep Marsh',
      },
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'void_echo_chamber',
        targetSpawn: { x: 240, y: 30 },
        type: 'cave',
        label: 'To Echo Chamber',
      },
    ],
  }),

  void_mother_nest: placeholder('void_mother_nest', 'Void Mother Nest', 'voidmarsh', {
    lightTint: LIGHT_VOID_D,
    particles: 'none',
    transitions: [
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'void_shallow',
        targetSpawn: { x: 240, y: 440 },
        type: 'cave',
        label: 'To Shallow Marsh',
      },
    ],
  }),

  void_echo_chamber: placeholder('void_echo_chamber', 'Echo Chamber', 'voidmarsh', {
    lightTint: LIGHT_VOID_D,
    particles: 'none',
    npcs: ['the_watcher'],
    transitions: [
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'void_crystal_grove',
        targetSpawn: { x: 240, y: 440 },
        type: 'cave',
        label: 'To Crystal Grove',
      },
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'void_heart_path',
        targetSpawn: { x: 240, y: 30 },
        type: 'path',
        label: 'To Heart Path',
      },
    ],
  }),

  void_heart_path: placeholder('void_heart_path', 'Heart Path', 'voidmarsh', {
    lightTint: LIGHT_VOID_D,
    particles: 'none',
    transitions: [
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'void_echo_chamber',
        targetSpawn: { x: 240, y: 440 },
        type: 'path',
        label: 'To Echo Chamber',
      },
      {
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'void_heart',
        targetSpawn: { x: 30, y: 240 },
        type: 'cave',
        label: 'To the Heart',
      },
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'void_null_bridge',
        targetSpawn: { x: 240, y: 30 },
        type: 'path',
        label: 'To Null Bridge',
      },
    ],
  }),

  void_heart: placeholder('void_heart', 'The Heart', 'voidmarsh', {
    lightTint: { color: 0xcc22ff, alpha: 0.16 },
    particles: 'none',
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'void_heart_path',
        targetSpawn: { x: 440, y: 240 },
        type: 'cave',
        label: 'To Heart Path',
      },
    ],
  }),

  void_null_bridge: placeholder('void_null_bridge', 'Null Bridge', 'voidmarsh', {
    lightTint: LIGHT_VOID_D,
    particles: 'none',
    transitions: [
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'void_heart_path',
        targetSpawn: { x: 240, y: 440 },
        type: 'path',
        label: 'To Heart Path',
      },
      {
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'void_null_throne',
        targetSpawn: { x: 30, y: 240 },
        type: 'path',
        label: 'To Null Throne',
      },
    ],
  }),

  void_null_throne: placeholder('void_null_throne', 'Null Throne', 'voidmarsh', {
    lightTint: { color: 0x220044, alpha: 0.18 },
    particles: 'none',
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'void_null_bridge',
        targetSpawn: { x: 440, y: 240 },
        type: 'path',
        label: 'To Null Bridge',
      },
    ],
  }),
};

// ═══════════════════════════════════════════════════════════════════════════
// HOLLOWREACH (Unnamed City) — 8 rooms
// ═══════════════════════════════════════════════════════════════════════════
//
// [Gate] -> [White Plaza] -> [Accord Hall]
//                |
//           [Memory Garden] -> [Edric Study]
//                |
//           [Thessamine Room]
//                |
//           [Chamber Approach] -> [Chamber]

const HOLLOWREACH_AREAS: Record<string, WorldAreaConfig> = {
  hollow_gate: placeholder('hollow_gate', 'Hollowreach Gate', 'hollowreach', {
    lightTint: LIGHT_HOLLOW,
    particles: 'dust',
    transitions: [
      {
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'hollow_white_plaza',
        targetSpawn: { x: 30, y: 240 },
        type: 'path',
        label: 'To White Plaza',
      },
    ],
  }),

  hollow_white_plaza: placeholder('hollow_white_plaza', 'White Plaza', 'hollowreach', {
    lightTint: LIGHT_HOLLOW,
    particles: 'dust',
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'hollow_gate',
        targetSpawn: { x: 440, y: 240 },
        type: 'path',
        label: 'To Gate',
      },
      {
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'hollow_accord_hall',
        targetSpawn: { x: 30, y: 240 },
        type: 'door',
        label: 'To Accord Hall',
      },
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'hollow_memory_garden',
        targetSpawn: { x: 240, y: 30 },
        type: 'path',
        label: 'To Memory Garden',
      },
    ],
  }),

  hollow_accord_hall: placeholder('hollow_accord_hall', 'Accord Hall', 'hollowreach', {
    lightTint: LIGHT_HOLLOW,
    particles: 'dust',
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'hollow_white_plaza',
        targetSpawn: { x: 440, y: 240 },
        type: 'door',
        label: 'To White Plaza',
      },
    ],
  }),

  hollow_memory_garden: placeholder('hollow_memory_garden', 'Memory Garden', 'hollowreach', {
    lightTint: LIGHT_HOLLOW,
    particles: 'dust',
    transitions: [
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'hollow_white_plaza',
        targetSpawn: { x: 240, y: 440 },
        type: 'path',
        label: 'To White Plaza',
      },
      {
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'hollow_edric_study',
        targetSpawn: { x: 30, y: 240 },
        type: 'door',
        label: 'To Edric Study',
      },
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'hollow_thessamine_room',
        targetSpawn: { x: 240, y: 30 },
        type: 'door',
        label: 'To Thessamine Room',
      },
    ],
  }),

  hollow_edric_study: placeholder('hollow_edric_study', 'Edric\'s Study', 'hollowreach', {
    lightTint: LIGHT_INDOOR,
    particles: 'dust',
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'hollow_memory_garden',
        targetSpawn: { x: 440, y: 240 },
        type: 'door',
        label: 'To Memory Garden',
      },
    ],
  }),

  hollow_thessamine_room: placeholder('hollow_thessamine_room', 'Thessamine\'s Room', 'hollowreach', {
    lightTint: LIGHT_HOLLOW,
    particles: 'dust',
    npcs: ['thessamine_echo'],
    transitions: [
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'hollow_memory_garden',
        targetSpawn: { x: 240, y: 440 },
        type: 'door',
        label: 'To Memory Garden',
      },
      {
        x: 200, y: 460, w: 80, h: 20,
        targetArea: 'hollow_chamber_approach',
        targetSpawn: { x: 240, y: 30 },
        type: 'path',
        label: 'To Chamber Approach',
      },
    ],
  }),

  hollow_chamber_approach: placeholder('hollow_chamber_approach', 'Chamber Approach', 'hollowreach', {
    lightTint: { color: 0xF5F0E8, alpha: 0.08 },
    particles: 'none',
    transitions: [
      {
        x: 200, y: 0, w: 80, h: 20,
        targetArea: 'hollow_thessamine_room',
        targetSpawn: { x: 240, y: 440 },
        type: 'path',
        label: 'To Thessamine Room',
      },
      {
        x: 460, y: 200, w: 20, h: 80,
        targetArea: 'hollow_chamber',
        targetSpawn: { x: 30, y: 240 },
        type: 'door',
        label: 'To the Chamber',
      },
    ],
  }),

  hollow_chamber: placeholder('hollow_chamber', 'The Chamber', 'hollowreach', {
    lightTint: { color: 0xF5F0E8, alpha: 0.02 },
    particles: 'none',
    transitions: [
      {
        x: 0, y: 200, w: 20, h: 80,
        targetArea: 'hollow_chamber_approach',
        targetSpawn: { x: 440, y: 240 },
        type: 'door',
        label: 'To Chamber Approach',
      },
    ],
  }),
};

// ═══════════════════════════════════════════════════════════════════════════
// WORLD_MAP — All regions
// ═══════════════════════════════════════════════════════════════════════════

export const WORLD_MAP: Record<string, RegionConfig> = {
  ashfields: {
    id: 'ashfields',
    name: 'Ashfields',
    areas: ASHFIELDS_AREAS,
  },
  verdenmere: {
    id: 'verdenmere',
    name: 'Verdenmere',
    areas: VERDENMERE_AREAS,
  },
  greyveil: {
    id: 'greyveil',
    name: 'Greyveil',
    areas: GREYVEIL_AREAS,
  },
  gildspire: {
    id: 'gildspire',
    name: 'Gildspire',
    areas: GILDSPIRE_AREAS,
  },
  voidmarsh: {
    id: 'voidmarsh',
    name: 'Voidmarsh',
    areas: VOIDMARSH_AREAS,
  },
  hollowreach: {
    id: 'hollowreach',
    name: 'Hollowreach',
    areas: HOLLOWREACH_AREAS,
  },
};

// ── Flat lookup index ──────────────────────────────────────────────────────

const _allAreas: Record<string, WorldAreaConfig> = {};
for (const region of Object.values(WORLD_MAP)) {
  for (const [id, area] of Object.entries(region.areas)) {
    _allAreas[id] = area;
  }
}

/** Look up an area config by ID. Throws if not found. */
export function getWorldArea(areaId: string): WorldAreaConfig {
  const cfg = _allAreas[areaId];
  if (!cfg) throw new Error(`[worldMap] Unknown area: "${areaId}"`);
  return cfg;
}

/** Look up a region config by ID. Throws if not found. */
export function getRegion(regionId: string): RegionConfig {
  const cfg = WORLD_MAP[regionId];
  if (!cfg) throw new Error(`[worldMap] Unknown region: "${regionId}"`);
  return cfg;
}

/** Get the region that contains a given area ID. */
export function getRegionForArea(areaId: string): RegionConfig {
  for (const region of Object.values(WORLD_MAP)) {
    if (areaId in region.areas) return region;
  }
  throw new Error(`[worldMap] Area "${areaId}" not found in any region`);
}
