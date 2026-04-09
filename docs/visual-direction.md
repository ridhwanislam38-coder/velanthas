# VELANTHAS — ISOMETRIC VISUAL DIRECTION
## Reference: Tactics Ogre Reborn · Unicorn Overlord
### Status: APPROVED — supersedes all prior side-scroll art decisions

---

## 1. CAMERA & GRID

### Projection
- **Type**: True isometric (2:1 diamond)
- **Tile footprint**: 48px wide × 24px tall (screen space)
- **Tile depth** (elevation step): 16px per level
- **Internal resolution**: 480×270 (upscaled 2× to 960×540)
  - Wider than 320×180 — isometric scenes need more screen real estate
- **Camera**: fixed orthographic, no rotation, slight tilt-down feel

### Coordinate Systems

```
World (tile grid)        Screen (pixels)
────────────────         ──────────────────────────────────────
col, row, elevation  →   sx = (col - row) × 24
                         sy = (col + row) × 12 − elevation × 16
```

> **Critical**: all game logic stays in tile coordinates.
> Screen coords are only computed at render time.

### Grid Visual
```
     ╱╲  ╱╲  ╱╲
    ╱  ╲╱  ╲╱  ╲
    ╲  ╱╲  ╱╲  ╱
     ╲╱  ╲╱  ╲╱
```
- Diamond shape per tile
- Top face: terrain texture
- Left face: shadow-tinted depth color
- Right face: lit depth color
- Corner joins: seamless — no pixel gaps

---

## 2. DEPTH SORTING (PAINTERS ALGORITHM)

All objects are sorted before drawing each frame:

```
sort key = (col + row) × 1000 + elevation × 100 + object_type_priority
```

Object type priority (ascending — drawn first = furthest back):
| Priority | Object |
|----------|--------|
| 0 | Sky / fog layers |
| 1 | Terrain tiles (ground) |
| 2 | Terrain tiles (elevated) |
| 3 | Flat props (rugs, floor markings) |
| 4 | Base props (barrels, crates) |
| 5 | Tall props (statues, ruins, bridges) |
| 6 | Characters (enemies, player, NPCs) |
| 7 | Projectiles / effects |
| 8 | UI (HUD, portraits, panels) |

**Rule**: two objects on same tile — character always in front of prop.

---

## 3. TERRAIN & ELEVATION

### Elevation Levels
- **Level 0**: sea/swamp floor
- **Level 1**: ground plane (default combat grid)
- **Level 2**: raised terrain (+16px)
- **Level 3**: cliff ledge (+32px)
- **Level 4**: high ground (+48px)

Elevation differences affect:
- Ranged attack range bonus (+2 tiles per level above)
- Melee: cannot attack across 2+ levels without stairs/ramp
- Shadow: lower tiles receive cast shadow from elevated tiles above

### Tile Types

| ID | Name | Visual | Notes |
|----|------|--------|-------|
| `grass` | Ashfields turf | grey-green, cracked | base terrain |
| `ash` | Ashfields ash | pale grey dust, footprint marks | |
| `stone` | Ruins floor | dark slate, chipped mortar | |
| `void` | Voidmarsh | dark iridescent, wet shimmer | |
| `gilded` | Gildspire marble | cream/gold vein pattern | |
| `bridge` | Wood plank | warm brown, nail heads | connects elevations |
| `water` | Swamp water | dark teal, slow ripple (animated) | impassable |
| `ramp` | Stone ramp | angled face, same color as adjacent | connects levels |

### Hand-Painted Tile Style
- Every tile has **edge wear** — brighter pixels on upper edges, darker on lower
- **Variation tiles**: 4 variants per base tile, randomly assigned at map gen
- **Accord white** (#F5F0E8) appears as ruin markings on stone tiles in every region
- **No flat fills** — every top face has 3+ color values for depth

---

## 4. STRUCTURAL PROPS

All props are drawn as isometric objects with proper faces.

### Prop Catalog (Priority — build in this order)

**Tier 1 (required for first map):**
- `ruin_wall_ns` — north-south wall segment, 1 tile wide, 3 levels tall
- `ruin_wall_ew` — east-west wall segment
- `ruin_arch` — archway, 2 tiles wide, clearance for characters
- `bonfire` — 1×1 tile, 2 levels tall, animated flame (orange glow source)
- `statue_accord` — 1×1 tile, 3 levels tall, Accord sigil, Accord white highlight
- `barrel_stack` — 1×1 tile, 1 level tall

**Tier 2 (second pass):**
- `bridge_plank_ns` — 3 tile span, connects level 1 → level 1 over gap
- `bridge_plank_ew`
- `scaffold_tower` — 2×2 tile base, 4 levels, climbable via ramp
- `rubble_small` — 1×1, impassable debris
- `torch_wall` — attached to wall, light source

**Tier 3 (atmosphere):**
- `fog_emitter` — invisible tile marker, spawns fog particle column
- `god_ray_source` — invisible marker, god ray effect at position
- `banner_ironveil` — tall cloth prop, faction visual territory marker

---

## 5. CHARACTER SPRITES

### Spec
- **Base size**: 24×40 px (screen space, standing)
- **4 directions**: N, S, E, W (isometric — NE/NW/SE/SW)
- Actually 4 facing directions map to isometric angles:
  - `face_ne` = character faces top-right
  - `face_nw` = character faces top-left  
  - `face_se` = character faces bottom-right (default, most visible)
  - `face_sw` = character faces bottom-left

### Animation Frames Per Direction
| Animation | Frames | FPS |
|-----------|--------|-----|
| `idle` | 4 | 6 |
| `walk` | 6 | 12 |
| `attack_light` | 4 | 16 |
| `attack_heavy` | 6 | 12 |
| `hurt` | 2 | 8 |
| `death` | 6 | 8 |
| `cast` | 4 | 10 |

### Equipment Visibility
Each character sprite has **equipment layers** composited at runtime:
1. Body (base skin/armor)
2. Weapon (right hand — visible per direction)
3. Shield / off-hand (left hand — visible per direction)
4. Helmet/hat (head slot)
5. Cape/cloak (back — visible from behind)

Layer compositing: draw to offscreen canvas at load time → single merged texture per equipment loadout. No per-frame compositing in `update()`.

### Faction Color Coding (armor tint layer)
| Faction | Primary | Accent |
|---------|---------|--------|
| Ironveil | #2a3a4a | #4a6a7a |
| The Wild | #1a2a12 | #4a7a2a |
| Voidborn | #240046 | #5a189a |
| Gilded | #3a2800 | #ffd60a |
| Forgotten | #1a1a1a | #6a6a6a |
| Silent Ones | #0a0a14 | #c8c8e8 |
| Player | #1a1a2e | #4cc9f0 |

---

## 6. LIGHTING

### Shadow System (Isometric)
- **Ambient**: per-region dark overlay (multiply blend, depth 300)
- **Cast shadows**: elevated tiles cast a diamond-shaped shadow 1 tile offset
  - Shadow offset direction: always SE (isometric light from NW)
  - Shadow intensity: 40% black, feathered edge
- **Light sources**: radial, masked to isometric diamond shape
  - Bonfire: 0xff8800, radius 3 tiles, flicker
  - Torch: 0xff6600, radius 2 tiles, subtle flicker
  - God ray: directional cone, white/gold, depth-sorted above environment
  - Accord ruin: 0xF5F0E8 cold glow, radius 1 tile, slow pulse

### Fog Layers
- **Ground fog**: depth 50, scrolls at 0.2× camera, 60% opacity
  - Voidmarsh: dense, dark teal
  - Ashfields: thin, grey
  - Greyveil: medium, blue-grey
- **Atmosphere fog**: depth 15, far-distance haze, 30% opacity
- **Both**: particle systems, not shader-based (Phaser compatibility)

### God Rays
- Sprite-based: tall thin gradient rectangle, additive blend
- Placed on specific world objects (Accord statues, broken towers)
- Rotate/scale: slow tween ±5° over 8 seconds
- Tint matches region palette light color

---

## 7. UI STYLE

### Design Reference: Tactics Ogre Reborn panels
- **No floating text labels** above characters — all info in panels
- **Dark bordered panels**: #0a0a1a fill, 2px #2a2a4a border, 1px #ffd60a inner highlight
- **Gold trim**: #ffd60a, 1px lines on panel edges and portrait frames
- **Corner ornaments**: small diamond shapes at panel corners (3×3 px)

### Layout (480×270)
```
┌─────────────────────────────────────────────────┐  ← game world (full screen)
│                                                 │
│                  ISOMETRIC MAP                  │
│                                                 │
├──────────┬──────────────────────┬───────────────┤
│ PORTRAIT │   NAME + CLASS       │  HP ████░░    │  ← selected unit panel
│ FRAME    │   LV 4 · IRONVEIL    │  AP ██░░░     │
└──────────┴──────────────────────┴───────────────┘
```

### Portrait Frames
- **Size**: 48×48 px visible, 52×52 with border
- **Border**: 2px #2a2a4a, 1px inner #ffd60a
- **Corner diamonds**: 4×4 px solid #ffd60a at each corner
- **Background**: region-tinted dark gradient
- **Character art**: bust portrait, not full body — shows face + upper chest

### Action Menu (turn-based)
```
╔═══════════════╗
║  ◆ ATTACK     ║
║    SKILLS     ║
║    ITEMS      ║
║    WAIT       ║
╚═══════════════╝
```
- Active item: #ffd60a ◆ marker, slightly brighter row
- Inactive: #6a6a8a text
- Border: gold trim style
- No rounded corners — hard pixel edges throughout

### Damage Numbers
- Float up from target, not labels — brief tween (0.8s, rise 12px, fade)
- Style: `Press Start 2P`, 8px, white with 1px black shadow
- Critical: gold, larger (10px)
- Miss: grey, italic simulation (offset 1px)

---

## 8. RENDERING PIPELINE (BUILD ORDER)

```
Phase 1 — Foundation
  [ ] IsoGrid.ts              — tile coord ↔ screen coord transforms
  [ ] IsoMap.ts               — tile data, elevation map, prop placement
  [ ] IsoRenderer.ts          — depth-sorted draw loop
  [ ] BootScene updates       — generate isometric tile textures (canvas)

Phase 2 — Environment
  [ ] TileTextures.ts         — hand-painted tile variants (canvas gen)
  [ ] PropSprites.ts          — prop canvas generation (walls, statues, bonfire)
  [ ] FogSystem.ts            — ground fog + atmosphere layers
  [ ] ShadowSystem.ts         — cast shadows from elevation

Phase 3 — Characters
  [ ] IsoCharacter.ts         — base class, 4-direction sprite, depth key
  [ ] EquipmentCompositor.ts  — layer merge at load time
  [ ] IsoPlayer.ts            — player-specific: input → tile movement
  [ ] IsoEnemy.ts             — enemy base: pathfinding on grid

Phase 4 — Lighting
  [ ] IsoLightingSystem.ts    — replaces LightingSystem, isometric masks
  [ ] GodRaySystem.ts         — additive sprite god rays

Phase 5 — UI
  [ ] IsoHUD.ts               — dark panels, portrait frames, gold trim
  [ ] ActionMenu.ts           — turn-based action selection
  [ ] DamageNumbers.ts        — float-up damage display

Phase 6 — Combat Loop
  [ ] TurnSystem.ts           — initiative order, AP per turn
  [ ] MoveRangeDisplay.ts     — blue diamond overlay for reachable tiles
  [ ] AttackRangeDisplay.ts   — red overlay for attack range
  [ ] IsoCamera.ts            — smooth follow, edge scroll
```

---

## 9. WHAT GETS KEPT FROM CURRENT BUILD

| System | Keep? | Notes |
|--------|-------|-------|
| EventBus.ts | ✅ Keep | Architecture is sound |
| CombatSystem.ts | ✅ Keep | Rework for turn-based, keep damage formula |
| FactionSystem.ts | ✅ Keep | Unchanged |
| DialogueSystem.ts | ✅ Keep | Panels need reskin to new UI style |
| SaveSystem.ts | ✅ Keep | Schema unchanged |
| BossSystem.ts | ✅ Keep | Adapt phases to isometric |
| APSystem.ts | ⚠️ Rework | AP now per-turn budget, not real-time decay |
| ParrySystem.ts | ⚠️ Rework | Turn-based — parry becomes reaction skill |
| DodgeSystem.ts | ⚠️ Rework | Becomes evasion stat, not real-time |
| JuiceSystem.ts | ✅ Keep | Hit-stop/flash still needed |
| LightingSystem.ts | 🔄 Replace | IsoLightingSystem replaces it |
| SkySystem.ts | ✅ Keep | Sky renders behind isometric scene |
| WeatherSystem.ts | ✅ Keep | Particle weather still valid |
| TownScene.ts | 🗑️ Replace | Becomes IsoMapScene |
| Player.ts | 🔄 Replace | IsoPlayer.ts |
| GuardEnemy.ts | 🔄 Replace | IsoEnemy subclasses |

---

## 10. INPUT / KEYBINDINGS (REVISED)

Current keybindings were ad-hoc. Isometric tactical needs:

| Key | Action |
|-----|--------|
| Arrow keys / WASD | Move cursor / pan camera |
| Z / Enter | Confirm / select |
| X / Escape | Cancel / back |
| Space | End turn |
| Tab | Cycle units |
| 1–7 | Quick-select skill slots |
| Shift + Arrow | Fast camera pan |
| F | Toggle fog of war |
| M | Toggle minimap |

**Controller mapping** (for reference):
- D-pad: cursor move
- A: confirm, B: cancel, Y: end turn, X: skill menu
- LB/RB: cycle units
- Start: pause/menu

---

*Document created: 2026-04-08*
*Approved by: Nawfi*
*Supersedes: all side-scroll visual decisions in CLAUDE.md*
