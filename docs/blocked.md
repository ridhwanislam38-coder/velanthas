# Blocked Items

## 2026-04-07 22:51
- **Taskbar pin**: Windows 11 programmatically blocks taskbar pinning via Shell.Application verbs (policy restriction since Win11 22H2). Tried: Shell.Application ParseName + Verbs() loop. Alternative: shortcuts placed on Desktop instead. Manual workaround: right-click shortcut on Desktop -> 'Pin to taskbar'.

## 2026-04-09 — DIRECTION PIVOT (HD-2D birds-eye)
- **Side-scroller assumptions baked into existing code.** TownScene, Player, BootScene, and the BG_FAR/BG_MID/BG_PROPS parallax stack all assume a side-view platformer (GROUND_Y constant, gravity, coyote-time/jump-buffer, parallax 0.15/0.35/0.65). The new vision (Triangle Strategy HD-2D, angled birds-eye, no platformer) requires these to be refactored, not extended.
  - **Action**: next build phase introduces `BaseWorldScene` with a birds-eye camera + y-sort and retires GROUND_Y/gravity. Existing systems (EventBus, combat, lighting, save, dialogue, specials) are camera-agnostic and carry over unchanged.
  - **Not a blocker for building systems** — only a blocker for building new region content on the *wrong* camera. Do not author new regions in side-scroller until pivot item 01/02 lands.
- **Music channel must be deleted.** If `AudioSystem` exposes a music channel, it must be removed (not gated) per Islamic content rules. Ambient-only from now on.
- **Uncommitted TownScene WIP** (bonfire, Magistra Eon NPC, weather, save init) needs to be committed before the pivot so it's not lost during BaseWorldScene extraction.
