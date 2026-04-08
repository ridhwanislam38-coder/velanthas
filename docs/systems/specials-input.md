# Special Attack Input — All 7 Selectable

## Key Bindings (TownScene)

| Key | Special | AP Cost |
|-----|---------|---------|
| U | JUDGMENT_MARK | 1 AP |
| O | PHANTOM_STEP | 1 AP |
| P | VOID_CRUCIBLE | 2 AP |
| Q | THORNWALL_REQUIEM | 2 AP |
| I | THE_RECKONING | 3 AP |
| E | SISTERS_ECHO | 3 AP |
| R | WORLDS_WEIGHT | 3 AP |

## Region Switcher (SkySystem Playtest)

| Key | Region |
|-----|--------|
| 1 | ASHFIELDS |
| 2 | VERDENMERE |
| 3 | GREYVEIL |
| 4 | GILDSPIRE |
| 5 | VOIDMARSH |
| 6 | UNNAMED_CITY |

## Architecture

- `Player._readAttackInput()` iterates a typed binding tuple — O(7) loop, no allocations
- All specials route through `SpecialAttackSystem.use()` → EventBus → enemy routing
- Region keys use `input.keyboard.on('keydown')` → `_sky.setRegion()` + `Bus.emit(REGION_ENTER)`
- SISTERS_ECHO and WORLDS_WEIGHT remain locked until story conditions met (see `_unlocked` set in SpecialAttackSystem)

## Files Changed

- `src/entities/Player.ts` — `_readAttackInput`: 2 hardcoded specials → 7-entry binding loop
- `src/scenes/TownScene.ts` — key registration, region switcher, 3-line hint display
