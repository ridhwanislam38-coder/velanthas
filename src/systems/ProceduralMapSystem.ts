import Phaser from 'phaser';
import { DEPTH } from '../config/visualConfig';

// ── Procedural Map System ──────────────────────────────────────────────────
// Generates tile-based maps per region using sine-combination noise.
// No external libraries — pure math noise approximation.

// ── Interfaces ─────────────────────────────────────────────────────────────

export type TerrainType = 'ground' | 'path' | 'water' | 'wall' | 'prop' | 'destructible';

export interface TileData {
  x: number;
  y: number;
  type: TerrainType;
  color: number;
  occluder: boolean;
}

export interface MapData {
  width: number;
  height: number;
  tileSize: number;
  tiles: TileData[];
  playerSpawn: { x: number; y: number };
  bonfirePos: { x: number; y: number };
  npcPositions: Array<{ x: number; y: number; id: string }>;
  enemySpawns: Array<{ x: number; y: number; type: string }>;
  portalPositions: Array<{ x: number; y: number; id: string }>;
}

// ── Region type ────────────────────────────────────────────────────────────

export type RegionId =
  | 'ASHFIELDS'
  | 'VERDENMERE'
  | 'GREYVEIL'
  | 'GILDSPIRE'
  | 'VOIDMARSH'
  | 'UNNAMED_CITY';

// ── Region generation config ───────────────────────────────────────────────

interface TerrainWeight {
  type: TerrainType;
  color: number;
  /** Noise threshold range [min, max). Tile placed when noise falls in range. */
  range: [number, number];
  occluder: boolean;
}

interface RegionConfig {
  weights: TerrainWeight[];
  noiseScale: number;
  /** Second octave scale multiplier for detail. */
  detailScale: number;
  /** Blend ratio of detail octave (0–1). */
  detailBlend: number;
  /** How many enemies to spawn. */
  enemyCount: number;
  /** Default enemy type string. */
  enemyType: string;
  /** How many NPCs to place. */
  npcCount: number;
  /** How many portals. */
  portalCount: number;
}

// ── Per-region configs ─────────────────────────────────────────────────────

const REGION_CONFIGS: Record<RegionId, RegionConfig> = {
  ASHFIELDS: {
    noiseScale: 0.12,
    detailScale: 3.0,
    detailBlend: 0.25,
    enemyCount: 6,
    enemyType: 'ashfields_hollow',
    npcCount: 2,
    portalCount: 2,
    weights: [
      { type: 'ground',       color: 0x2a1a0e, range: [0.0,  0.52], occluder: false },
      { type: 'path',         color: 0x3a2a1a, range: [0.52, 0.68], occluder: false },
      { type: 'wall',         color: 0x4a3a2a, range: [0.68, 0.78], occluder: true  },
      { type: 'destructible', color: 0x5a4a3a, range: [0.78, 0.86], occluder: false },
      { type: 'prop',         color: 0x3a3020, range: [0.86, 0.93], occluder: true  },
      { type: 'ground',       color: 0x1e1208, range: [0.93, 1.0],  occluder: false },
    ],
  },

  VERDENMERE: {
    noiseScale: 0.10,
    detailScale: 2.5,
    detailBlend: 0.30,
    enemyCount: 5,
    enemyType: 'verdenmere_wisp',
    npcCount: 2,
    portalCount: 2,
    weights: [
      { type: 'ground', color: 0x1a3a1a, range: [0.0,  0.40], occluder: false },
      { type: 'path',   color: 0x2a4a1a, range: [0.40, 0.52], occluder: false },
      { type: 'water',  color: 0x1a2a4a, range: [0.52, 0.65], occluder: false },
      { type: 'wall',   color: 0x0e2a0e, range: [0.65, 0.80], occluder: true  },
      { type: 'prop',   color: 0x2a3a10, range: [0.80, 0.90], occluder: true  },
      { type: 'ground', color: 0x153015, range: [0.90, 1.0],  occluder: false },
    ],
  },

  GREYVEIL: {
    noiseScale: 0.14,
    detailScale: 2.8,
    detailBlend: 0.35,
    enemyCount: 8,
    enemyType: 'greyveil_wraith',
    npcCount: 1,
    portalCount: 2,
    weights: [
      { type: 'ground', color: 0x1a1a1e, range: [0.0,  0.25], occluder: false },
      { type: 'path',   color: 0x2a2a30, range: [0.25, 0.40], occluder: false },
      { type: 'wall',   color: 0x3a3a40, range: [0.40, 0.65], occluder: true  },
      { type: 'water',  color: 0x0e0e2a, range: [0.65, 0.75], occluder: false },
      { type: 'prop',   color: 0x2a2a3a, range: [0.75, 0.85], occluder: true  },
      { type: 'ground', color: 0x121218, range: [0.85, 1.0],  occluder: false },
    ],
  },

  GILDSPIRE: {
    noiseScale: 0.18,
    detailScale: 4.0,
    detailBlend: 0.20,
    enemyCount: 4,
    enemyType: 'gildspire_guard',
    npcCount: 4,
    portalCount: 2,
    weights: [
      { type: 'path',   color: 0x6a5a3a, range: [0.0,  0.50], occluder: false },
      { type: 'ground', color: 0x5a4a2a, range: [0.50, 0.62], occluder: false },
      { type: 'wall',   color: 0x8a7a5a, range: [0.62, 0.80], occluder: true  },
      { type: 'prop',   color: 0x7a6a4a, range: [0.80, 0.92], occluder: true  },
      { type: 'path',   color: 0x5a5030, range: [0.92, 1.0],  occluder: false },
    ],
  },

  VOIDMARSH: {
    noiseScale: 0.09,
    detailScale: 2.2,
    detailBlend: 0.40,
    enemyCount: 7,
    enemyType: 'voidmarsh_lurker',
    npcCount: 1,
    portalCount: 2,
    weights: [
      { type: 'water',  color: 0x1a0e2a, range: [0.0,  0.45], occluder: false },
      { type: 'ground', color: 0x2a1e3a, range: [0.45, 0.62], occluder: false },
      { type: 'water',  color: 0x0e0820, range: [0.62, 0.72], occluder: false },
      { type: 'prop',   color: 0x5a2aaa, range: [0.72, 0.82], occluder: true  },
      { type: 'wall',   color: 0x3a2a4a, range: [0.82, 0.90], occluder: true  },
      { type: 'ground', color: 0x201530, range: [0.90, 1.0],  occluder: false },
    ],
  },

  UNNAMED_CITY: {
    noiseScale: 0.08,
    detailScale: 2.0,
    detailBlend: 0.15,
    enemyCount: 3,
    enemyType: 'unnamed_shade',
    npcCount: 1,
    portalCount: 1,
    weights: [
      { type: 'ground', color: 0x1a1a1a, range: [0.0,  0.70], occluder: false },
      { type: 'path',   color: 0x2a2a2a, range: [0.70, 0.82], occluder: false },
      { type: 'wall',   color: 0x3a3a3a, range: [0.82, 0.92], occluder: true  },
      { type: 'prop',   color: 0x2a2a30, range: [0.92, 0.97], occluder: true  },
      { type: 'ground', color: 0x121212, range: [0.97, 1.0],  occluder: false },
    ],
  },
};

// ── Noise functions (sine-combination Perlin-like, no external lib) ────────

/** Deterministic hash for seed-based generation. */
function hashSeed(seed: number): number {
  let h = seed | 0;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = ((h >> 16) ^ h) * 0x45d9f3b;
  h = (h >> 16) ^ h;
  return (h & 0x7fffffff) / 0x7fffffff;
}

/** Simple 2D noise using sine combinations — cheap Perlin approximation. */
function noise2D(x: number, y: number, seed: number): number {
  const s = hashSeed(seed);
  const a = Math.sin(x * 12.9898 + y * 78.233 + s * 43758.5453) * 43758.5453;
  const b = Math.sin(x * 63.7264 + y * 10.873 + s * 23421.631) * 23421.631;
  const c = Math.sin(x * 36.2345 + y * 43.124 + s * 65432.987) * 65432.987;
  return ((a - Math.floor(a)) + (b - Math.floor(b)) + (c - Math.floor(c))) / 3.0;
}

/** Multi-octave noise for richer terrain. */
function fbmNoise(x: number, y: number, seed: number, scale: number, detailScale: number, detailBlend: number): number {
  const base = noise2D(x * scale, y * scale, seed);
  const detail = noise2D(x * scale * detailScale, y * scale * detailScale, seed + 1);
  return base * (1 - detailBlend) + detail * detailBlend;
}

// ── Seeded RNG (for deterministic placement) ───────────────────────────────

class SeededRNG {
  private _state: number;
  constructor(seed: number) {
    this._state = seed;
  }
  /** Returns [0, 1). */
  next(): number {
    this._state = (this._state * 1664525 + 1013904223) & 0x7fffffff;
    return this._state / 0x7fffffff;
  }
  /** Returns integer in [min, max). */
  intRange(min: number, max: number): number {
    return Math.floor(this.next() * (max - min)) + min;
  }
}

// ── Tile lookup ────────────────────────────────────────────────────────────

function tileFromNoise(value: number, weights: readonly TerrainWeight[]): TerrainWeight {
  for (const w of weights) {
    if (value >= w.range[0] && value < w.range[1]) return w;
  }
  // Fallback — should never happen if ranges cover [0,1)
  return weights[0]!;
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Generate a procedural tile map for a region.
 * @param region  Region identifier.
 * @param cols    Number of tile columns.
 * @param rows    Number of tile rows.
 * @param tileSize  Pixel size of each tile (default 32).
 * @param seed    Optional seed for deterministic generation.
 */
export function generateMap(
  region: RegionId,
  cols: number,
  rows: number,
  tileSize: number = 32,
  seed: number = Date.now(),
): MapData {
  const cfg = REGION_CONFIGS[region];
  const rng = new SeededRNG(seed);
  const tiles: TileData[] = [];

  // ── Generate tile grid ──────────────────────────────────────────────────
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const n = fbmNoise(col, row, seed, cfg.noiseScale, cfg.detailScale, cfg.detailBlend);
      const tw = tileFromNoise(n, cfg.weights);
      tiles.push({
        x: col * tileSize + tileSize / 2,
        y: row * tileSize + tileSize / 2,
        type: tw.type,
        color: tw.color,
        occluder: tw.occluder,
      });
    }
  }

  // ── Force a walkable clearing in the centre (player spawn area) ─────────
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  const clearRadius = 3;
  const groundWeight = cfg.weights.find(w => w.type === 'ground') ?? cfg.weights[0]!;

  for (let dy = -clearRadius; dy <= clearRadius; dy++) {
    for (let dx = -clearRadius; dx <= clearRadius; dx++) {
      const tx = cx + dx;
      const ty = cy + dy;
      if (tx < 0 || tx >= cols || ty < 0 || ty >= rows) continue;
      const idx = ty * cols + tx;
      const tile = tiles[idx];
      if (tile) {
        tile.type = 'ground';
        tile.color = groundWeight.color;
        tile.occluder = false;
      }
    }
  }

  // ── Player spawn (centre of clearing) ───────────────────────────────────
  const playerSpawn = {
    x: cx * tileSize + tileSize / 2,
    y: cy * tileSize + tileSize / 2,
  };

  // ── Bonfire — slightly offset from player spawn ─────────────────────────
  const bonfirePos = {
    x: (cx + 2) * tileSize + tileSize / 2,
    y: cy * tileSize + tileSize / 2,
  };

  // ── NPC positions — random walkable tiles ───────────────────────────────
  const npcPositions = placeOnWalkable(tiles, cols, rows, tileSize, cfg.npcCount, rng).map((pos, i) => ({
    ...pos,
    id: `${region.toLowerCase()}_npc_${i}`,
  }));

  // ── Enemy spawns — random walkable tiles away from centre ───────────────
  const enemySpawns = placeOnWalkable(tiles, cols, rows, tileSize, cfg.enemyCount, rng, 5).map(pos => ({
    ...pos,
    type: cfg.enemyType,
  }));

  // ── Portals — edge-adjacent walkable tiles ──────────────────────────────
  const portalPositions = placeOnEdge(tiles, cols, rows, tileSize, cfg.portalCount, rng).map((pos, i) => ({
    ...pos,
    id: `${region.toLowerCase()}_portal_${i}`,
  }));

  return {
    width: cols * tileSize,
    height: rows * tileSize,
    tileSize,
    tiles,
    playerSpawn,
    bonfirePos,
    npcPositions,
    enemySpawns,
    portalPositions,
  };
}

// ── Placement helpers ──────────────────────────────────────────────────────

function isWalkable(type: TerrainType): boolean {
  return type === 'ground' || type === 'path';
}

function placeOnWalkable(
  tiles: TileData[],
  cols: number,
  rows: number,
  tileSize: number,
  count: number,
  rng: SeededRNG,
  minDistFromCentre: number = 0,
): Array<{ x: number; y: number }> {
  const cx = Math.floor(cols / 2);
  const cy = Math.floor(rows / 2);
  const result: Array<{ x: number; y: number }> = [];
  let attempts = 0;
  while (result.length < count && attempts < count * 30) {
    attempts++;
    const col = rng.intRange(1, cols - 1);
    const row = rng.intRange(1, rows - 1);
    const tile = tiles[row * cols + col];
    if (!tile || !isWalkable(tile.type)) continue;
    if (Math.abs(col - cx) + Math.abs(row - cy) < minDistFromCentre) continue;
    // Check no duplicate positions
    const px = col * tileSize + tileSize / 2;
    const py = row * tileSize + tileSize / 2;
    if (result.some(p => p.x === px && p.y === py)) continue;
    result.push({ x: px, y: py });
  }
  return result;
}

function placeOnEdge(
  tiles: TileData[],
  cols: number,
  rows: number,
  tileSize: number,
  count: number,
  rng: SeededRNG,
): Array<{ x: number; y: number }> {
  const result: Array<{ x: number; y: number }> = [];
  const edgeTiles: Array<{ col: number; row: number }> = [];

  for (let col = 0; col < cols; col++) {
    for (const row of [0, 1, rows - 2, rows - 1]) {
      const tile = tiles[row * cols + col];
      if (tile && isWalkable(tile.type)) edgeTiles.push({ col, row });
    }
  }
  for (let row = 2; row < rows - 2; row++) {
    for (const col of [0, 1, cols - 2, cols - 1]) {
      const tile = tiles[row * cols + col];
      if (tile && isWalkable(tile.type)) edgeTiles.push({ col, row });
    }
  }

  // Shuffle edge tiles deterministically
  for (let i = edgeTiles.length - 1; i > 0; i--) {
    const j = rng.intRange(0, i + 1);
    const tmp = edgeTiles[i]!;
    edgeTiles[i] = edgeTiles[j]!;
    edgeTiles[j] = tmp;
  }

  for (const et of edgeTiles) {
    if (result.length >= count) break;
    result.push({
      x: et.col * tileSize + tileSize / 2,
      y: et.row * tileSize + tileSize / 2,
    });
  }

  return result;
}

// ── Render helper ──────────────────────────────────────────────────────────

/**
 * Renders a MapData into the scene using Phaser rectangles.
 * Returns an array of occluder game objects for the OccluderSystem.
 */
export function renderMap(
  scene: Phaser.Scene,
  mapData: MapData,
): Array<Phaser.GameObjects.Image | Phaser.GameObjects.Sprite> {
  const occluders: Array<Phaser.GameObjects.Image | Phaser.GameObjects.Sprite> = [];

  for (const tile of mapData.tiles) {
    const rect = scene.add.rectangle(
      tile.x,
      tile.y,
      mapData.tileSize,
      mapData.tileSize,
      tile.color,
    );

    if (tile.occluder) {
      // Walls / props sit above game layer
      rect.setDepth(DEPTH.OCCLUDERS);
      rect.setOrigin(0.5, 1.0); // bottom-anchored for y-sort correctness
      occluders.push(rect as unknown as Phaser.GameObjects.Image);
    } else {
      // Ground-level tiles
      rect.setDepth(DEPTH.SKY + 1);
    }
  }

  return occluders;
}
