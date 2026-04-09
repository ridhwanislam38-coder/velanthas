// ── Accessibility Configuration ─────────────────────────────────────────────
// Player-adjustable settings for visual and gameplay accessibility.
// Persisted per save via SaveSystem settings JSON.

export interface AccessibilitySettings {
  // Visual
  screenShakeIntensity: number;    // 0.0–1.0 (0 = disabled)
  flashIntensity:       number;    // 0.0–1.0 (0 = no flashes)
  highContrastMode:     boolean;   // boosts outlines, reduces background complexity
  colorBlindMode:       'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  uiScale:              number;    // 1.0–2.0 (enlarges HUD text/elements)
  subtitlesEnabled:     boolean;   // show text for all voice lines
  subtitleSize:         'small' | 'medium' | 'large';

  // Gameplay
  parryWindowBonus:     number;    // 0–4 extra frames added to parry window
  dodgeWindowBonus:     number;    // 0–4 extra frames added to dodge window
  autoParryEnabled:     boolean;   // auto-parry on hit (reduces to normal parry, never perfect)
  invincibilityMode:    boolean;   // for exploration / story-only players
  combatSpeedMult:      number;    // 0.5–1.0 (slow down combat for learning)
}

export const DEFAULT_ACCESSIBILITY: AccessibilitySettings = {
  screenShakeIntensity: 1.0,
  flashIntensity:       1.0,
  highContrastMode:     false,
  colorBlindMode:       'none',
  uiScale:              1.0,
  subtitlesEnabled:     true,
  subtitleSize:         'medium',
  parryWindowBonus:     0,
  dodgeWindowBonus:     0,
  autoParryEnabled:     false,
  invincibilityMode:    false,
  combatSpeedMult:      1.0,
};

/** Merge partial settings into defaults. */
export function mergeAccessibility(
  partial: Partial<AccessibilitySettings>,
): AccessibilitySettings {
  return { ...DEFAULT_ACCESSIBILITY, ...partial };
}
