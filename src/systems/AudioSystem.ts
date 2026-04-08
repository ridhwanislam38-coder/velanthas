// Step 6: Howler.js wrapper for all SFX and music

export type SfxKey =
  | 'hit_light' | 'hit_crit' | 'hit_break'
  | 'correct' | 'wrong' | 'level_up'
  | 'menu_select' | 'menu_back'
  | 'boss_roar';

export type MusicKey =
  | 'town_theme' | 'battle_normal' | 'battle_boss'
  | 'title_theme' | 'prologue_ambient';

// Step 6: Implement using Howler.Howl instances per sound
export class AudioSystem {
  private musicVolume = 0.6;
  private sfxVolume   = 0.8;

  // TODO (Step 6): Load sounds, implement play/stop/fade

  playSfx(_key: SfxKey): void {
    // No-op until audio assets exist
  }

  playMusic(_key: MusicKey, _loop = true): void {
    // No-op until audio assets exist
  }

  stopMusic(_fadeMs = 800): void {
    // No-op until audio assets exist
  }

  setMusicVolume(v: number): void { this.musicVolume = v; }
  setSfxVolume(v: number):   void { this.sfxVolume = v; }
}

export const Audio = new AudioSystem();
