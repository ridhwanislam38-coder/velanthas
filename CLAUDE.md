# VELANTHAS — THE ACCORD'S SILENCE
## CLAUDE.md — Project Bible & Session Rules

> **Active world**: VELANTHAS. Pure narrative HD-2D action-RPG.
> Story: `src/story/lore/CoreNarrative.ts` | Palette: `src/config/paletteConfig.ts`
> Last updated: 2026-04-09 | **Direction pivot**: HD-2D birds-eye (was side-scroller)

---

## GENRE & VISION

**HD-2D narrative action-RPG** — visual standard of **Triangle Strategy / Octopath Traveler**, combat philosophy of **Clair Obscur: Expedition 33**.

- Dense, detailed pixel art (16×16 or 32×32 tiles) on **3D-lit environments** with depth-of-field, volumetric lighting, bloom, particle fog
- **Camera**: angled birds-eye / diorama — NOT side-scroller, NOT third-person. Sub-pixel camera correction for smooth movement.
- **Platforming**: not a platformer, but some platform sections are allowed
- Combat: frame-counted parry/dodge, AP system, 7 cinematic specials
- Story: environmental — player pieces together the Accord's silence from ruins
- No tutorial text — world teaches through design
- Every region has a distinct palette, sky, lighting feel, and ambient soundscape

### Content Volume Targets (non-negotiable minimums)

| Content | Target |
|---------|--------|
| Main story | 8–10 hours |
| Side quests | 4–6 hours |
| Secrets | 2–3 hours |
| NG+ | +6–8 hours |
| Total first playthrough | **20+ hours** |
| Main boss fights | 4 |
| Mini-bosses | 4 |
| Enemy types | **40** (31 files already exist — build the rest) |
| NPCs with quests | 12 |
| Ambient NPCs | 20 |
| Regions | 5 + 1 secret |
| Secrets | 15 |
| Lore items | 50 |
| Equipment pieces | 30 |
| Pictos | 25 |
| Combo routes | 20 |
| Cinematics (via Remotion) | 15 |

### NG+ Progression
- First clear → new difficulty + enemy remixes
- Find all lore → new area unlocks
- Find all secrets → new NPC appears, comments on every secret found

---

## CONTENT RULES (FAITH-BASED, NON-NEGOTIABLE)

Nawfi is Muslim. The game must respect these rules everywhere:

- **ZERO music**. No background music, no menu music, no boss music, no area themes. Atmosphere is carried entirely by ambient soundscapes (wind, water, footsteps, crowd murmur, fire crackle, rain, wildlife).
- **No revealing clothing** on any character. Outfit designs must be modest by default.
- **No romance** storylines, flirtation, or suggestive content.
- **No alcohol glamorisation**, no gambling mechanics framed as entertainment, no idol worship framed positively.
- Any art generation prompt (RetroDiffusion etc.) must include modesty constraints.

---

## TECH STACK (LOCKED)

| Layer | Tool | Notes |
|-------|------|-------|
| Renderer | **Phaser 3** (latest) | `pixelArt: true`, `roundPixels: true` |
| Bundler | **Vite** | Fast HMR, ESBuild under the hood |
| Language | **TypeScript strict** | `strict: true` + `noUncheckedIndexedAccess` + `noImplicitOverride` + `exactOptionalPropertyTypes` |
| Audio | **Howler.js** | ALL sound via `AudioSystem` — ambient layers + SFX only, no music channel |
| Level Design | **LDtk** or **Tiled** | 32×32 tile grid, exported as JSON. Never hardcode levels. |
| Cinematics | **Remotion** | All 15 cutscenes as React components → rendered video → `assets/cinematics/` |
| Voice | **ElevenLabs** | NPC voice, narrator, cinematic lines → `assets/audio/voice/` |
| SFX Library | **FreeSound** (CC0 preferred, attribute CC-BY) | `assets/audio/sfx/` |
| Sprite Gen | **RetroDiffusion** | Batch-gen + Aseprite hand-refine → `assets/sprites/` |
| Backend | **Supabase** | Auth + save data + leaderboard |
| Deploy | **Vercel** | Auto-deploy from main branch |
| Input | **Gamepad API** via Phaser | Keyboard + mouse + Bluetooth/wired controller, all bindings rebindable |

### RULE: Before writing custom code for any asset pipeline, check if one of these tools already handles it.

---

## AI TOOLS — MANDATORY USE

These tools exist to accelerate solo development. **DO NOT manually build what they handle.** You are a solo-dev operation — these tools ARE your team. Every session should leverage them to move faster, not slower.

### The Rule (non-negotiable)

Before writing ANY code, ask in this exact order:
1. Does an **MCP server** already do this? (Obsidian, Context7, Chrome DevTools, Supabase, Figma, Playwright, Sentry, etc.)
2. Does an **installed agent skill** already do this? (`frontend-design`, `agent-architecture`, `worker-benchmarks`, `superpowers:*`, etc.)
3. Does one of the four **content-generation AI tools** already do this? (ElevenLabs / Remotion / RetroDiffusion / FreeSound)
4. Does an **installed library** already do this? (Howler for audio, Phaser for rendering, Zod for validation, LDtk for levels)

**If the answer to 1–4 is "yes" — use the tool. Do not write custom code.**

### Forbidden shortcuts

- ❌ Hand-drawing sprites → use RetroDiffusion, then Aseprite refine
- ❌ Writing cinematics as Phaser tween sequences → use Remotion React components → rendered MP4
- ❌ Placeholder text for voice lines → use ElevenLabs TTS, commit the generated .wav/.mp3
- ❌ Custom audio scheduler / mixer / crossfade code → use Howler.js (already installed)
- ❌ Skipping a cinematic because "it's complex" → Remotion handles complexity declaratively, build it
- ❌ Manually authoring tilemaps in code → use LDtk, parse the `.ldtk` JSON
- ❌ Guessing at library APIs → call Context7 MCP to fetch current docs
- ❌ Manually profiling with console.time → use Chrome DevTools MCP Lighthouse audit
- ❌ Writing a review checklist inline → invoke the `frontend-design` or `agent-architecture` skill
- ❌ Asking the user to decide between approaches without first checking if `superpowers:brainstorm` or `agent-architecture` would resolve it


### ElevenLabs (Voice & SFX generation)
- Purpose: voice acting for cinematics, NPC dialogue, narrator
- Text-to-Speech API → distinct voice per character
- Also: SFX generation via their SFX model
- Docs: https://elevenlabs.io/docs

### Remotion (Cinematics)
- Purpose: programmatic video generation for all 15 cutscenes
- Source: `src/cinematics/` (React components)
- Output: `assets/cinematics/*.mp4`
- Docs: https://www.remotion.dev/docs

### RetroDiffusion (Pixel art generation)
- Purpose: AI-generated sprites, tilesets, portraits, environment tiles
- Workflow: batch-generate → Aseprite hand-refine → commit
- Output: `assets/sprites/` organised by category
- Docs: https://retrodiffusion.ai
- **Modesty constraint must be in every prompt.**

### FreeSound (Ambient + SFX library)
- **CRITICAL**: no music means ambient sound carries 100% of atmosphere
- Per-region: build layered ambient soundscapes (wind bed + distance layer + foreground events)
- Use for footsteps, combat impacts, weather, crowd murmur, wildlife, UI
- Always check license; CC0 preferred, attribute CC-BY in `docs/ATTRIBUTIONS.md`
- API: https://freesound.org/docs/api/

### Supporting tools
- **Aseprite** — manual sprite refinement after RetroDiffusion
- **LDtk / Tiled** — level data, parse `.ldtk` format directly

---

## MCP SERVERS & AGENT SKILLS

### MCP
- **Obsidian MCP** — vault read/write (docs, session log, blocked)
- **Context7** — live documentation fetching for any library API
- **Unreal MCP Bridge** (ref `github.com/Natfii/UnrealClaude.git`) — for reference materials only; this project does not use Unreal
- **Chrome DevTools MCP** — perf profiling, Lighthouse audits
- **Figma MCP** — UI reference ingestion
- **Supabase MCP** — schema/auth

### Agent skills to prefer
- `frontend-design` — HUDs, menus, dialogue boxes
- `agent-architecture` — pre-code review for any new system
- `worker-benchmarks` — post-build perf check
- `verification-quality-assurance` — post-build correctness check
- `superpowers:test-driven-development` — for new pure-logic systems
- `superpowers:systematic-debugging` — when any bug recurs

**RULE**: always check if a skill/plugin handles a task before writing custom code for it.

---

## ART RULES — HD-2D STANDARD

- **Internal resolution**: 320×180, 3× display scale via Phaser `Scale.FIT` (will be reviewed on camera pivot — may increase to 480×270 for birds-eye depth)
- **Tile size**: 32×32 game px
- **Player sprite**: 24×32 game px (revised up for birds-eye readability)
- **Enemy sprite**: 24×32 game px (minibosses/bosses up to 64×96)
- **`imageSmoothingEnabled = false`** on every canvas — always — non-negotiable
- **`roundPixels: true`** in Phaser config — always
- **CSS `image-rendering: pixelated`** on the canvas element
- **Lighting**: multiply-blend layers on top of GAME depth — NEVER flat ambient fill
- **Depth of field / bokeh**: fake via two blurred layers (far, near) + bloom pass on bright lights
- **Volumetric fog**: per-region particle drift, tinted by palette
- **Characters**: dark outlines, bright details — NOT flat color fills
- **Shadows**: everything casts one — never pure black, always region shadow colour
- **Idle motion**: nothing static — grass sways, water shimmers, torches flicker, dust drifts, idle breathing on characters
- **Screen shake, sprite flash, hit-stop** on EVERY impact
- **Palette**: per-region — see `src/config/paletteConfig.ts`
- **Accord white** (#F5F0E8): appears in ruins in every region — always feels slightly wrong
- **Motion blur** + **chromatic aberration** on heavy impacts and specials (post-process shader)
- **See-through occlusion**: tall terrain (mountains, some trees, upper river banks) fades to 50% alpha when it covers the player. NOT every prop — only ones flagged `occludesPlayer: true`.
- **Destructible environments** gated by player strength stat — rocks, crates, weak walls, ice sheets

---

## AUDIO RULES — AMBIENT-ONLY

`AudioSystem` exposes three channels:

| Channel | Purpose |
|---------|---------|
| `ambientBed` | Constant regional wind/water/cave-hum loop — crossfades on region change |
| `ambientLayer` | Mid-range environmental events — distant bells, bird calls, distant crowd |
| `sfx` | Foreground events — footsteps, combat, UI, destruction |

- NO `music` channel. Ever. Deleting any existing music-channel stub is valid cleanup.
- Every action must have a sound: footstep variants per surface, cloth rustle on interact, breath on heavy attack, item-drop thud, destructible crack→crumble
- Crossfade duration on region change: 2.0s
- Volume mixers per channel, persisted to save file

---

## VISUAL LAYER ORDER (Phaser depth)

| Depth | Layer | Notes |
|-------|-------|-------|
| 0 | SKY | gradient / distant horizon |
| 10 | BG_FAR | mountains, distant silhouettes (parallax 0.15) |
| 20 | BG_MID | trees, buildings (parallax 0.35) |
| 30 | BG_PROPS | barrels, pillars (parallax 0.65) |
| 100 | GAME | player, enemies, tile sprites, NPCs |
| 150 | OCCLUDERS | terrain/props that fade when covering player |
| 200 | FG_NEAR | foreground diorama pieces between camera and game |
| 250 | PARTICLES | ambient + combat effects |
| 300 | LIGHTING | multiply blend over 0–250 |
| 350 | POSTFX | bloom, DoF, motion blur, chromatic aberration |
| 400 | UI | HUD, dialogue, journal — unaffected by lighting |
| 500 | CUTSCENE | Remotion playback overlays |
| 600 | LETTERBOX | cinematic bars |

---

## CAMERA — BIRDS-EYE DIORAMA

- Angle: Triangle-Strategy-style 3/4 view (z-depth faked via y-sort on GAME layer)
- Follow: smooth-lerp with deadzone, sub-pixel corrected
- Region-specific zoom levels set in `paletteConfig.ts`
- Cinematic camera moves during specials (dolly, pan, brief zoom)
- No auto-rotation — this is a pixel game

---

## PERFORMANCE RULES (NON-NEGOTIABLE)

| Rule | Value |
|------|-------|
| Target FPS | 60 min, 120 if hardware allows |
| Max particles | 500 — never allocate new inside update |
| Max lights per screen | 12 (8 in interiors) |
| Light math tick | every 3 frames — NOT every frame |
| Sky redraw | on camera move or weather/region change only |
| No `new` inside `update()` | ever |
| No `forEach` inside `update()` | use `for...of` |
| Frame budget | 16ms — alert if exceeded |
| Asset load budget | <3s between regions |

---

## COMBAT FEEL RULES

| Mechanic | Value |
|----------|-------|
| Parry window | 6 frames total — first 2f = perfect |
| Dodge window | 10 frames total — first 3f = perfect |
| I-frames (dodge) | 8 frames |
| Hit-stop (light) | 3 frames |
| Hit-stop (heavy) | 6 frames |
| Hit-stop (special) | 10 frames |
| Perfect parry slow-mo | 0.15× speed for 400ms |
| Kill slow-mo | 0.5× speed for 500ms |
| AP max | 3 — decays -1/8s out of combat |

**Camera-pivot note**: coyote-time/jump-buffer values are retired — no jumping in birds-eye. Platform sections will define their own values locally.

---

## PLAYER PROGRESSION SYSTEMS

- **Classes / paths**: Warrior, Mage, Rogue, Hybrid — unlock weapon families, specials, movement abilities
- **Weapons**: 30 equipment pieces minimum across sword, bow, staff, dagger, hammer, focus
- **Pictos**: 25 equippable modifiers
- **Currency**: `lumens` — earned from enemies, quests, destructibles. Merchant economy. No real-money integration, ever.
- **Character customization**: outfits (modest), hair, face, colours. Cosmetic-only, no stat locks behind appearance.
- **Home base**: furnishable hub building, upgrades via quests and materials
- **Pets**: bondable, combat support, **flying unlock late game** enables aerial traversal of mapped regions
- **Farming**: material nodes respawn on long rest; crafting + cooking from harvest
- **Veils & Barriers**: narrative-gated walls (lore-unlocked, quest-unlocked, strength-gated) that create intrigue about later content
- **Fast travel**: void-cut portals — per-class visual effect (warrior cuts reality, mage opens rift, rogue slips shadow)
- **Quest journal**: persistent UI section tracking chosen paths, completed quests, lore fragments, and major choices so the player never forgets what they've done

---

## INPUT

- Keyboard + mouse
- Bluetooth/wired controller (Gamepad API via Phaser)
- All bindings rebindable, persisted per save
- Rumble support on controllers that advertise it
- Input source auto-detected; HUD prompts switch glyphs on the fly

---

## SAVE SYSTEM

- **Autosave**: on region enter, boss kill, bonfire rest, quest step complete
- **Manual save points**: bonfires
- **Save presets**: up to 5 per user, labelled, quick-load from title screen
- **Save settings**: audio mixers, input bindings, graphics, accessibility — persisted to Supabase
- **Offline fallback**: local save mirrors remote; merge on reconnect

---

## CROSS-SYSTEM COMMUNICATION — EVENT BUS

**CRITICAL**: Systems NEVER import each other directly.
All communication via `Bus.emit()` / `Bus.on()` from `src/systems/EventBus.ts`.

```typescript
// WRONG — creates circular deps
import { JuiceSystem } from './JuiceSystem';

// RIGHT — decoupled
import { Bus, GameEvent } from './EventBus';
Bus.emit(GameEvent.HIT_LIGHT, { target, damage });
```

All events typed as `const enum GameEvent` in `EventBus.ts`.

---

## TYPE RULES

All code must use these — no string literals or magic numbers:
- `SceneKey` — all scene names (`src/types/game.ts`)
- `AssetKey` — all texture/audio keys (`src/types/game.ts`)
- `GameEvent` — all event bus events (`src/systems/EventBus.ts`)
- `FactionId` — all faction names (`src/config/enemyConfig.ts`)
- `WeatherType`, `Season`, `TimeOfDay` — world state (`src/config/worldConfig.ts`)
- `ElevationLevel` — 0–4 (`src/config/worldConfig.ts`)
- `CharacterClass`, `WeaponFamily`, `CurrencyType` — new, to be added in camera-pivot phase

**NEVER use `any`.**

---

## STORY — THE ACCORD'S SILENCE

See full lore: `src/story/lore/CoreNarrative.ts`

**World**: VELANTHAS — held for 400 years by THE ACCORD. When it broke: silence.
**Truth** (never stated by NPCs — pieced from environment):
  - The Accord was released by EDRIC VAEL to save THESSAMINE (player's mother)
  - She died anyway. The Accord broke for nothing.
  - Player is their child. Doesn't know yet.

**Endings**:
  - RESTORE: sacrifice yourself — world heals
  - RELEASE: destroy the Chamber — world lives without the Accord
  - REMEMBER: call Thessamine's soul — she chooses — everyone lives (hardest)

**Key rule**: show — never tell. The Accord is never explained by an NPC.

---

## BUILD STATUS — SYSTEMS PHASE COMPLETE

All foundational systems shipped. Code is camera-agnostic except the scene layer, which is currently side-scroller and needs pivoting.

```
[DONE] EventBus, visualConfig, narrativeConfig, paletteConfig, worldConfig
[DONE] enemyConfig, factionConfig, difficultyConfig
[DONE] AP/Parry/Dodge/Combat/Juice/Faction/Boss/Dialogue/Cutscene/Weather
[DONE] Season/Elevation/Reflection/Lighting/Sight/Sky/Cinematic/SpecialAttack
[DONE] Story lore / CoreNarrative
[DONE] 31 enemy entity files (ironveil/6, thewild/5, voidborn/4, gilded/4,
       forgotten/4, silentones/3, neutral/3, minibosses/2) + GuardEnemy
[DONE] DialogueSystem wired to NPC, Magistra Eon starter tree
[DONE] Supabase schema + SaveSystem wiring
[DONE] Vercel auto-deploy
[WIP]  TownScene bonfire + NPC + weather + save init (uncommitted)
```

---

## NEXT BUILD PHASE — CAMERA PIVOT + CONTENT ENGINE

Build in this order, one item at a time, each passing TS + feel test before the next.

```
[DONE] 00. Commit WIP (bonfire/NPC/weather/save init) as feat(town):
[DONE] 01. BaseWorldScene abstract class — birds-eye camera, y-sort, deadzone follow
[DONE] 02. Retire side-scroller assumptions — Player refactored to birds-eye,
              InputSystem replaces raw keys in TownScene
[DONE] 03. AudioSystem refactor — 3 channels (ambientBed/Layer/sfx), NO music
[DONE] 04. InputSystem — keyboard + Gamepad API, rebindable, persisted
[DONE] 05. OccluderSystem — tall props/terrain fade when covering player
[DONE] 06. PostFXSystem — bloom, DoF, motion blur, chromatic aberration
[DONE] 07a. Ashfields scene scaffold (code-only, awaiting AI tool assets)
[ ]    07b. Ashfields assets — LDtk map + RetroDiffusion sprites + FreeSound ambient
[DONE] 08. CurrencySystem + loot tables for all 31 enemies + 6 destructibles
[DONE] 09. JournalSystem — quest + lore + choices tracking, serialisable
[DONE] 10. CustomizationSystem — outfit/hair swap, save-backed (6 outfits, 5 hairs, 3 faces)
[DONE] 11. FastTravelSystem — 12 portals, discovery-based, per-class void-cut FX
[DONE] 12. FarmingSystem — 5 material types, harvest + respawn + 3 crafting recipes
[ ]    13. Remotion cinematic pipeline — first cutscene (Prologue) rendered end-to-end
[ ]    14. ElevenLabs voice pipeline — Magistra Eon lines rendered, hooked to DialogueSystem
[ ]    15. RetroDiffusion sprite pipeline — first batch (Ashfields tileset), Aseprite pass
[ ]    16. Second region: Verdenmere, copying Ashfields pattern
```

After each item:
  → `tsc --noEmit`
  → Code Review skill
  → Benchmarks check (perf rules above)
  → `frontend-design` agent audit on any UI change
  → Commit: `feat/fix/feel/art/perf(system): description`

---

## ENEMY ROSTER — REMAINING TO BUILD (target 40)

Already built (31):
```
ironveil/     IronveilFootsoldier, IronveilArcher, IronveilShieldwall,
              IronveilBerserker, IronveilInquisitor, IronveilWarbeast
thewild/      MossWalker, SporeWitch, BriarHound, SongbirdArcher, TheOldGrove
voidborn/     VoidShard, EchoSelf, VoidMother, NullKnight
gilded/       GildedMerchant, GildedEnforcer, GildedSniper, GildedGolem
forgotten/    ForsakenSoldier, WailingWraith, BoneColossus, Revenant
silentones/   SilentWatcher, SilentChaser, SilentMirror
neutral/      MirrorKnight, BrambleEnemy, WraithEnemy
minibosses/   ThornQueenMini, TheSleepwalker
```

Still to build (9 to hit 40 + the 4 main bosses):
```
bosses/       GrimdarTheForsaken, LumaMoth, TheWarden, SisterSilence
ambient/      5 non-combat wildlife / herd creatures for region liveliness
```

---

## SUPABASE SCHEMA (EXTENDED)

```sql
create table player_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  region text, position_x float, position_y float,
  hp int, max_hp int, ap int,
  class text, attributes jsonb,
  pictos text[], equipment jsonb,
  currency bigint default 0,
  outfit jsonb, hair jsonb,
  settings jsonb,
  updated_at timestamptz default now()
);

create table quest_states (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references player_saves,
  quest_id text, stage int, choices_made jsonb
);

create table faction_rep (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references player_saves,
  faction_id text, rep_value int
);

create table boss_deaths (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references player_saves,
  boss_id text, death_count int default 0
);

create table leaderboard (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  player_name text,
  total_damage bigint, max_combo int,
  boss_kills int, time_played_s int,
  created_at timestamptz default now()
);
```

**RLS**: players read/write own data only. Leaderboard: read-all, write-own.
**Save triggers**: bonfire, boss kill, region transition, quest step.
**Realtime**: leaderboard only.

---

## ENVIRONMENT VARIABLES

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_ELEVENLABS_API_KEY=
VITE_FREESOUND_API_KEY=
VITE_RETRODIFFUSION_API_KEY=
```

Note: `VITE_CLAUDE_API_KEY` and `VITE_OTDB_BASE_URL` are retired with the trivia system.

---

## SKILL / AGENT WORKFLOW

```
1. PRE-CODE    → agent-architecture (any new system)
2. PRE-UI      → frontend-design  (any HUD/menu/dialogue)
3. BUILD       → write code
4. POST-BUILD  → worker-benchmarks + verification-quality-assurance
5. POST-SESSION→ agent-adaptive-coordinator
```

Never begin item N+1 before item N passes feel test.

---

## SESSION RULES

### Session Start
1. Read `CLAUDE.md`
2. Read `docs/blocked.md` if it exists
3. Read last entry in `docs/sessions/session-log.md`
4. Scan codebase for uncommitted changes
5. **Tool inventory check**: list available MCP servers + installed skills + AI tools so the session has them top-of-mind
6. Report what's next in build queue
7. Start building — don't wait for confirmation

### Before writing any code (every time)
Run the 4-step "Does a tool already do this?" check from the AI TOOLS section. If yes → use the tool. If no → write the minimum code.

### Session End
1. Update `CLAUDE.md` build queue (check off completed items)
2. Create/update doc file for every system touched
3. Run `scripts\obsidian-sync.bat`
4. `git add -A`
5. `git commit -m "session: [what was built]"`
6. `git push` if remote configured
7. Append summary to `docs/sessions/session-log.md`
8. Append blockers to `docs/blocked.md`
9. Final vault sync
10. Report: what was built, what's next, anything blocked

---

## COMMIT CONVENTION

```
feat(lighting):  radial light sources with multiply blend
feat(sky):       Ashfields procedural ash cloud generation
perf(particles): pool capped at 500, eliminated loop allocation
fix(specials):   RECKONING white frame held correct duration
feel(juice):     VOID CRUCIBLE screen shake tuned to 5px
art(sky):        Verdenmere bioluminescent spore particles
audio(ambient):  Ashfields wind bed + distant bell layer
refactor(systems): all cross-system calls moved to EventBus
```

---

## AUTONOMOUS OPERATION — PERMANENT RULES

### Never Stop For
- File overwrite confirmations
- Install confirmations
- Script execution confirmations
- Yes/no/always prompts
- Permission requests
- Any confirmation of any kind

### When Blocked
- Write issue + attempted solution to `docs/blocked.md` with timestamp
- Try 2 alternative approaches automatically
- Continue with everything else — NEVER stop and wait

### When A Command Fails
- Log failure to `docs/blocked.md`
- Try 3 alternative approaches
- Continue with next task

### Session Behavior
- Start every session: read CLAUDE.md + scan codebase
- End every session: obsidian sync + git commit + session log
- Mid session: commit after every completed system
- Overnight: work through full build queue until empty

### Git Rules
- Commit after every system
- Never commit broken code (`tsc --noEmit` must pass)
- Push after every 3 commits if remote configured

---

## AUTO SCRIPTS

| Trigger | Script |
|---------|--------|
| Session start | `scripts\session-start.ps1` |
| Session end | `scripts\session-end.ps1` |
| After any system | `scripts\obsidian-sync.bat` |
| Before sleep | `scripts\overnight.ps1` (via Desktop shortcut) |
| On wake | `scripts\wake-up-report.ps1` (via Desktop shortcut) |
| Free mode | `scripts\free-mode.bat` |
| Paid mode | `scripts\paid-mode.bat` |

### What Nawfi Has To Do
- Before sleep: double-click **SLEEP — Claude Overnight** (Desktop)
- On wake: double-click **WAKE — Morning Report** (Desktop)
- Everything else: Claude Code handles automatically

### What Nawfi Never Has To Do
- Confirm anything, approve anything, run syncs manually, commit manually, update Obsidian manually, check logs manually

---

## OBSIDIAN VAULT RULES

Vault path: `C:\Users\nawfi\OneDrive\Documents\My remote vault\Game\`
Limit: **10 GB total**. Warn at 8 GB, halt at 9 GB.

**Sync script**: `scripts/obsidian-sync.ps1` (run via `scripts/obsidian-sync.bat`)
**Size check**: `scripts/obsidian-check-size.ps1`

Rules:
- ONLY sync: `CLAUDE.md`, `docs/**/*.md`, `snapshots/**/*.md`
- NEVER sync: code files, assets, images, audio, `.env`, `node_modules`
- Snapshots: `CLAUDE.md` only — keep last 5, delete older automatically
- Session log: `Game\docs\sessions\session-log.md` — append only
- Run sync script after every session

---

## NEVER

- Write code without checking conflicts with existing systems
- Import directly between systems (EventBus only)
- Use `any` in TypeScript
- Put a number in a game file that belongs in config
- Allocate objects inside `update()` loops
- Let `imageSmoothingEnabled` be anything but `false`
- Skip the build order without explicit user approval
- Build a UI component without `frontend-design` agent review first
- Deploy without a playtest confirming the feel
- Add music. Ever. No exceptions.
- Add revealing clothing, romance, or other content that conflicts with Islamic values
- Manually build what an AI tool (ElevenLabs / Remotion / RetroDiffusion / FreeSound) already handles
- Hand-draw a sprite when RetroDiffusion can generate a draft
- Write a cinematic as Phaser tweens when Remotion can render it as video
- Ship placeholder voice-line text when ElevenLabs can synthesise the real line
- Write custom audio playback code when Howler.js is already a dependency
- Skip an MCP server / installed skill check before writing a system from scratch
- Guess at a library's current API when Context7 MCP can fetch the live docs

---

*Last updated: 2026-04-09 | Pivoted to HD-2D birds-eye, dropped trivia mechanics, added AI-tool pipeline + content targets + halal content rules.*
