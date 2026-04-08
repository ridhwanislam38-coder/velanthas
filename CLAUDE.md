# VELANTHAS — THE ACCORD'S SILENCE
## CLAUDE.md — Project Bible & Session Rules

> **Active world**: VELANTHAS. The study RPG mechanics run parallel to this narrative.
> Story: `src/story/lore/CoreNarrative.ts` | Palette: `src/config/paletteConfig.ts`

---

## GENRE & VISION

Dark fantasy action RPG — **Hollow Knight** visual standard, **E33** combat philosophy.
- Pixel art at 320×180 internal resolution, scaled 3× to screen
- Every region has a distinct palette, sky, and lighting feel
- Combat: frame-counted parry/dodge, AP system, 7 cinematic specials
- Story: environmental — player pieces together the Accord's silence from ruins
- No tutorial text — world teaches through design

---

## TECH STACK (LOCKED — DO NOT DEVIATE)

| Layer | Tool | Notes |
|-------|------|-------|
| Renderer | **Phaser 3** (latest) | pixelArt: true, roundPixels: true |
| Bundler | **Vite** | Fast HMR, ESBuild under the hood |
| Language | **TypeScript strict** | `strict: true` + `noUncheckedIndexedAccess` + `noImplicitOverride` + `exactOptionalPropertyTypes` |
| Audio | **Howler.js** | All SFX and music through AudioSystem |
| Level Design | **LDtk** or **Tiled** | 32×32 tile grid, exported as JSON |
| Backend | **Supabase** | Auth + save data + leaderboard |
| Deploy | **Vercel** | Auto-deploy from main branch |

---

## ART RULES — HOLLOW KNIGHT STANDARD

- **Resolution**: 320×180 internal, 3× display scale via Phaser `Scale.FIT`
- **Tile size**: 32×32 game px
- **Player sprite**: 16×24 game px
- **Enemy sprite**: 24×32 game px
- **`imageSmoothingEnabled = false`** on every canvas — always — non-negotiable
- **`roundPixels: true`** in Phaser config — always
- **Background**: 3-4 parallax layers minimum — nothing is flat
- **Foreground silhouette**: dark shape layer in front of player (65% opacity)
- **Characters**: dark outlines, bright details — NOT flat color fills
- **Light**: from sources only — never ambient flat lighting
- **Shadows**: everything casts one — never black, always region shadow colour
- **Idle**: nothing static — backgrounds breathe, lights flicker, particles drift
- **Palette**: per-region — see `src/config/paletteConfig.ts`
- **Accord white** (#F5F0E8): appears in ruins in every region — always feels slightly wrong

---

## VISUAL LAYER ORDER (Phaser depth)

| Depth | Layer | Notes |
|-------|-------|-------|
| 0 | Sky | gradient background |
| 10 | BG_FAR | mountains / distant (parallax 0.15) |
| 20 | BG_MID | trees / buildings (parallax 0.35) |
| 30 | BG_PROPS | barrels / pillars (parallax 0.65) |
| 100 | GAME | player, enemies, tiles |
| 200 | FG_SILHOUETTE | foreground shapes in front of player |
| 250 | PARTICLES | effects |
| 300 | LIGHTING | multiply blend over 0-250 |
| 400 | UI | HUD, dialogue — unaffected by lighting |
| 500 | CUTSCENE | overlays |
| 600 | LETTERBOX | cinematic bars |

---

## PERFORMANCE RULES (NON-NEGOTIABLE)

| Rule | Value |
|------|-------|
| Max particles | 500 — never allocate new inside update |
| Max lights per screen | 12 (8 in Gildspire interiors) |
| Light math tick | every 3 frames — NOT every frame |
| Sky redraw | on camera move or weather/region change only |
| No `new` inside `update()` | ever |
| No `forEach` inside `update()` | use `for...of` loops |
| Frame budget | 16ms — alert if exceeded |

---

## COMBAT FEEL RULES

| Mechanic | Value |
|----------|-------|
| Coyote time | 8 frames |
| Jump buffer | 6 frames |
| Parry window | 6 frames total — first 2f = perfect |
| Dodge window | 10 frames total — first 3f = perfect |
| I-frames (dodge) | 8 frames |
| Hit-stop (light) | 3 frames |
| Hit-stop (heavy) | 6 frames |
| Hit-stop (special) | 10 frames |
| Perfect parry slow-mo | 0.15× speed for 400ms |
| Kill slow-mo | 0.5× speed for 500ms |
| AP max | 3 — decays -1/8s out of combat |

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

All events are typed as `const enum GameEvent` in EventBus.ts.

---

## TYPE RULES

All code must use these — no string literals or magic numbers:
- `SceneKey` — all scene names (`src/types/game.ts`)
- `AssetKey` — all texture/audio keys (`src/types/game.ts`)
- `GameEvent` — all event bus events (`src/systems/EventBus.ts`)
- `FactionId` — all faction names (`src/config/enemyConfig.ts`)
- `WeatherType`, `Season`, `TimeOfDay` — world state (`src/config/worldConfig.ts`)
- `ElevationLevel` — 0-4 (`src/config/worldConfig.ts`)

---

## STORY — THE ACCORD'S SILENCE

See full lore: `src/story/lore/CoreNarrative.ts`

**World**: VELANTHAS — held for 400 years by THE ACCORD. When it broke: silence.
**Truth** (never stated by NPCs, pieced from environment):
  - The Accord was released by EDRIC VAEL to save THESSAMINE (player's mother)
  - She died anyway. The Accord broke for nothing.
  - Player is their child. Doesn't know yet.

**Endings**:
  - RESTORE: sacrifice yourself — world heals
  - RELEASE: destroy the Chamber — world lives without the Accord
  - REMEMBER: call Thessamine's soul — she chooses — everyone lives (hardest)

**Key rule**: show — never tell. The Accord is never explained by an NPC.

---

## STUDY RPG MECHANICS (ORIGINAL SCOPE)

**World**: Lumenveil — knowledge = power. Damage in billions (E33 scaling).
**Question System**: Claude AI + Open Trivia DB + fallback banks
**Hub Town**: Umbral Crossing | **Mentor**: Magistra Eon

Damage formula:
```
damage = baseAtk × 1.9^(level-1) × (1 + timerPct×3) × comboMult × breakMult × buffMult × critMult
```

---

## CURRENT BUILD ORDER

Build one item at a time. Benchmarks + feel test before moving to next.

```
[DONE] EventBus.ts                    — all cross-system communication
[DONE] src/config/visualConfig.ts     — renderer layer order, perf caps
[DONE] src/config/narrativeConfig.ts  — world lexicon, endings, fragments
[DONE] src/config/paletteConfig.ts    — all region palettes
[DONE] src/config/worldConfig.ts      — day/night, seasons, weather, elevation
[DONE] src/config/enemyConfig.ts      — all enemy stats, phase thresholds
[DONE] src/config/factionConfig.ts    — rep costs, faction effects
[DONE] src/config/difficultyConfig.ts — hint/skip thresholds, death tracker
[DONE] src/systems/APSystem.ts
[DONE] src/systems/ParrySystem.ts
[DONE] src/systems/DodgeSystem.ts
[DONE] src/systems/CombatSystem.ts
[DONE] src/systems/JuiceSystem.ts
[DONE] src/systems/FactionSystem.ts
[DONE] src/systems/BossSystem.ts
[DONE] src/systems/DialogueSystem.ts
[DONE] src/systems/CutsceneSystem.ts
[DONE] src/systems/WeatherSystem.ts
[DONE] src/systems/SeasonSystem.ts
[DONE] src/systems/ElevationSystem.ts
[DONE] src/systems/ReflectionSystem.ts
[DONE] src/systems/LightingSystem.ts
[DONE] src/systems/SightSystem.ts
[DONE] src/systems/SkySystem.ts
[DONE] src/systems/CinematicSystem.ts
[DONE] src/systems/SpecialAttackSystem.ts
[DONE] src/story/lore/CoreNarrative.ts
[DONE] src/entities/enemies/GuardEnemy.ts

[DONE] 01. LightingSystem — integrated into TownScene (shadow casters, SURFACE darkness, player pos sync)
[DONE] 02. SkySystem — wired to TownScene, ASHFIELDS region on start
[DONE] 03. SkySystem — Verdenmere/Greyveil/Gildspire/Voidmarsh/Unnamed City playtest
[DONE] 06. SightSystem — wired to GuardEnemy (CONE_SIGHT 100°, yellow→red escalation)
[DONE] 07. SpecialAttack — JUDGMENT_MARK + THE_RECKONING end-to-end (U/I keys → SpecialAttackSystem → Bus HIT_SPECIAL → enemy routed via sprite map)
[DONE] 08. SpecialAttack — remaining 5 specials selectable via input (U/O/P/Q/I/E/R = all 7)
[DONE] 09. Enemy roster — all 31 files, 0 TS errors (ironveil/6, thewild/5, voidborn/4, gilded/4, forgotten/4, silentones/3, neutral/3, minibosses/2)
[DONE] 10. DialogueSystem — wired to NPC entity, Magistra Eon starter tree, advance() + Bus events
[DONE] 11. Supabase — schema migration (20260407_initial_schema.sql), SaveSystem wired to queries.ts + Bus events (BONFIRE_REST/BOSS_KILLED/REGION_ENTER auto-save)
[DONE] 12. Vercel deploy

AFTER EACH ITEM:
  → TypeScript check (tsc --noEmit)
  → Code Review skill
  → benchmarks check (perf rules above)
  → emilkowalski visual audit (any UI change)
  → commit: feat/fix/feel/art/perf(system): description
```

---

## ENEMY ROSTER — STILL TO BUILD

Faction entity files to create in `src/entities/enemies/`:

```
ironveil/     IronveilFootsoldier.ts, IronveilArcher.ts, IronveilShieldwall.ts
              IronveilBerserker.ts, IronveilInquisitor.ts, IronveilWarbeast.ts
thewild/      MossWalker.ts, SporeWitch.ts, BriarHound.ts, SongbirdArcher.ts
              TheOldGrove.ts (mini-boss)
voidborn/     VoidShard.ts, EchoSelf.ts, VoidMother.ts, NullKnight.ts
gilded/       GildedMerchant.ts, GildedEnforcer.ts, GildedSniper.ts, GildedGolem.ts
forgotten/    ForsakenSoldier.ts, WailingWraith.ts, BoneColossus.ts, Revenant.ts
silentones/   SilentWatcher.ts, SilentChaser.ts, SilentMirror.ts
neutral/      MirrorKnight.ts, BrambleEnemy.ts, WraithEnemy.ts
minibosses/   ThornQueenMini.ts, TheSleepwalker.ts
bosses/       GrimdarTheForsaken.ts, LumaMoth.ts, TheWarden.ts, SisterSilence.ts
```

---

## SUPABASE SCHEMA (EXTENDED)

```sql
-- player_saves
create table player_saves (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  region text,
  position_x float, position_y float,
  hp int, max_hp int, ap int,
  attributes jsonb,
  pictos text[],
  equipment jsonb,
  updated_at timestamptz default now()
);

-- quest_states
create table quest_states (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references player_saves,
  quest_id text,
  stage int,
  choices_made jsonb
);

-- faction_rep
create table faction_rep (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references player_saves,
  faction_id text,
  rep_value int
);

-- boss_deaths
create table boss_deaths (
  id uuid primary key default gen_random_uuid(),
  player_id uuid references player_saves,
  boss_id text,
  death_count int default 0
);

-- leaderboard
create table leaderboard (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users,
  player_name text,
  total_damage bigint,
  max_combo int,
  boss_kills int,
  time_played_s int,
  created_at timestamptz default now()
);
```

**RLS**: players read/write own data only. Leaderboard: read-all, write-own.
**Save triggers**: bonfire rest, boss kill, region transition.
**Realtime**: leaderboard table only.

---

## ENVIRONMENT VARIABLES

```
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
VITE_CLAUDE_API_KEY=
VITE_OTDB_BASE_URL=https://opentdb.com/api.php
```

---

## SKILL/AGENT WORKFLOW

Every build step:
```
1. PRE-CODE    → agent-architecture (any new system)
2. PRE-UI      → emil-design-eng (any UI/animation)
3. BUILD       → write code
4. POST-BUILD  → worker-benchmarks + verification-quality-assurance
5. POST-SESSION→ agent-adaptive-coordinator
```

Never begin item N+1 before item N passes feel test.

---

## SESSION START CHECKLIST

Every session, in order:
1. Read CLAUDE.md
2. Scan codebase: what changed since last session
3. Check current build order item — confirm still correct
4. Report status before touching any file

## SESSION END CHECKLIST

1. Update CLAUDE.md build order (check off completed items)
2. Commit all changes (correct convention)
3. Confirm no TypeScript errors
4. Note any new blockers or reprioritizations

---

## COMMIT CONVENTION

```
feat(lighting): radial light sources with multiply blend
feat(sky): Ashfields procedural ash cloud generation
perf(particles): pool capped at 500, eliminated loop allocation
fix(specials): RECKONING white frame held correct duration
feel(juice): VOID CRUCIBLE screen shake tuned to 5px
art(sky): Verdenmere bioluminescent spore particles
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
- Write issue to `docs/blocked.md` with timestamp
- Write attempted solution to `docs/blocked.md`
- Try 2 alternative approaches automatically
- Continue with everything else
- NEVER stop and wait

### When A Command Fails
- Log failure to `docs/blocked.md`
- Try 3 alternative approaches
- Continue with next task
- NEVER stop and wait

### Session Behavior
- Start every session: read CLAUDE.md + scan codebase
- End every session: run obsidian sync + git commit + session log
- Mid session: commit after every completed system
- Overnight: work through full build queue until empty

### Obsidian Sync Rules
- Vault: `C:\Users\nawfi\OneDrive\Documents\My remote vault`
- Sync after every completed system
- Sync after every CLAUDE.md update
- Sync after every commit
- Sync at session end always
- Only `.md` files — never code or assets
- Snapshots: keep last 5 only

### Git Rules
- Commit after every system: feat/fix/perf convention
- Never commit broken code (tsc --noEmit must pass)
- Push after every 3 commits if remote is configured

---

## AUTO SCRIPTS — RUN THESE AUTOMATICALLY

| Trigger | Script |
|---------|--------|
| Session start | `scripts\session-start.ps1` |
| Session end | `scripts\session-end.ps1` |
| After any system | `scripts\obsidian-sync.bat` |
| Before sleep | `scripts\overnight.ps1` (via Desktop shortcut) |
| On wake | `scripts\wake-up-report.ps1` (via Desktop shortcut) |

## What Nawfi Has To Do
- Before sleep: double-click **SLEEP - Claude Overnight** (Desktop)
- On wake: double-click **WAKE - Morning Report** (Desktop)
- Everything else: Claude Code handles automatically

## What Nawfi Never Has To Do
- Confirm anything
- Approve anything
- Run any sync manually
- Commit manually
- Update Obsidian manually
- Check logs manually (morning report does it)

---

## OBSIDIAN VAULT RULES

Vault path: `C:\Users\nawfi\OneDrive\Documents\My remote vault\Game\`
Limit: **10 GB total**. Warn at 8 GB, halt at 9 GB.

**Sync script**: `scripts/obsidian-sync.ps1` (run via `scripts/obsidian-sync.bat`)
**Size check**: `scripts/obsidian-check-size.ps1`

Rules:
- ONLY sync: `CLAUDE.md`, `docs/**/*.md`, `snapshots/**/*.md`
- NEVER sync: code files, assets, images, audio, `.env`, node_modules
- Snapshots: CLAUDE.md only — keep last 5, delete older automatically
- Session log: `Game\docs\sessions\session-log.md` — append only
- Run sync script after every session

---

## NEVER

- Write code without first checking if it conflicts with existing systems
- Import directly between systems (EventBus only)
- Use `any` in TypeScript
- Put a number in a game file that belongs in config
- Allocate objects inside `update()` loops
- Let `imageSmoothingEnabled` be anything but `false`
- Skip the build order without explicit user approval
- Build a UI component without emilkowalski agent review first
- Deploy without a playtest confirming the feel is correct

---

*Last updated: 2026-04-07 | Build queue complete — all 12 items done*
