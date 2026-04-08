// ── Core Narrative — The Accord's Silence ─────────────────────────────────
// This file is documentation for writers and developers.
// It is NOT imported by game systems — keep it human-readable.
// The truth about the Accord is seeded through environment + fragments.
// No NPC ever states it plainly.

export const THE_WORLD = `
VELANTHAS — a continent held together for 400 years by THE ACCORD.
Not a treaty. A living metaphysical contract.
It bound every soul, every stone, every season to a shared rhythm.

When it broke: not an explosion — a silence.
Like a song stopping mid-note.
Everything since has been the world trying to remember the melody.
` as const;

export const THE_TRUTH = `
The Accord didn't break — it was released.
By a man named EDRIC VAEL — the player character's father.

He released it to save one person — the player's mother, THESSAMINE.
The Accord required her death — she was its anchor.
He chose her over the world.
She died anyway — the Accord broke for nothing.

The player grew up in the aftermath. They don't know any of this yet.
` as const;

export const THE_ENDING_GOAL = `
Reach the Chamber of First Accord beneath The Unnamed City.
Make a choice.

RESTORE: Sacrifice yourself (as your mother was meant to be sacrificed).
         World heals. You dissolve into the Accord. The melody resumes.

RELEASE: Destroy the Chamber.
         The world learns to live without the Accord permanently.
         Harder, slower, human — but free.

REMEMBER: Find a third option.
          Requirements: all quests complete, Ori awake, Maren in Interstitial,
          Daevan's sword.
          Call your mother's soul out of the Accord.
          She was always the anchor. Give her the choice.
          This is the only ending where everyone lives.
          The Accord becomes something new — chosen, not imposed.
` as const;

export const HOW_PLAYER_GETS_THERE = `
Entirely their choice.

Can fight every enemy — or avoid most.
Can befriend every NPC — or ignore all of them.
Can rush to The Unnamed City in 4 hours — or spend 30 exploring.

The story judges nothing. It only remembers.
` as const;

// ── Key story beats (environmental, never stated) ─────────────────────────

export const ENVIRONMENTAL_STORYTELLING = {
  EDRICS_CROSSING: `
    A bridge Edric built across the Greyveil river.
    Locals named it after him — he asked them not to.
    The plaque reads: "For those who must cross alone."
    Player reads it. Doesn't understand yet.
    Player reads it again after learning the truth. Understands.
  `,

  THESSAMINES_GARDEN: `
    Hidden in Verdenmere — off a path behind a broken Accord arch.
    Overgrown — flowers still bloom — the Accord kept them.
    Only fully visible at dusk — flowers glow (#C87DB0).
    No sign. No marker. Player finds it by exploring.
    If player finds it before the ending: Edric fragment 5 unlocks.
    Garden has a stone bench. One side is worn smooth — sat on often.
    The other side is pristine.
  `,

  THE_SUNDERGATE: `
    A cracked arch — still standing — between the Ashfields and the Interstitial.
    Every faction has a different name for what happened here.
    Ironveil: "The Day of Silence" — a military failure they won't explain.
    Thewild: "When the Song Left" — they mourn it annually.
    Gilded: "The Market Disruption of Year 401" — they have records.
    Forgotten: "The Release" — they say it with reverence, not grief.
    SilentOnes: they stand here sometimes. That's all.
    Player can stand here too. At night, they hear 4 notes from the ground.
  `,

  THE_UNNAMED_CITY_BEFORE: `
    Every NPC who's been there says: it's clean. Too clean.
    The streets are white. The stones are white. The sky feels white.
    Nothing grows there. Nothing rots.
    No birds. No insects. No wind through leaves — no leaves.
    Players who have found Thessamine's Garden will recognise the stillness:
    it's the same. A preserved place. Something loved it too much to let it change.
  `,

  MYSTERIOUS_DOG: `
    Appears in every region. Different breed each time. Always watching.
    Never hostile. Cannot be interacted with beyond "..." dialogue.
    Present in every city — different dog, same look.
    Present at the Sundergate — sitting facing the arch.
    Present in the Chamber of First Accord — sitting in the centre.
    Never explained.
    In the REMEMBER ending credits: brief shot of the dog, then cut.
    Still unexplained.
  `,
} as const;

// ── Character truth summaries (for writers) ───────────────────────────────

export const CHARACTER_TRUTHS = {
  EDRIC_VAEL: `
    Not a villain. Not a hero. A man who made an impossible choice wrong.
    He thought he was saving her. He wasn't.
    He has spent every year since trying to fix things quietly.
    Edric's Crossing was an apology — to the world, not to Thessamine.
    He's been watching the player from a distance the whole game.
    He never intervenes. He doesn't think he deserves to.
  `,

  THESSAMINE: `
    Not dead — her soul is in the Accord.
    She can be sensed in Accord ruins — warmth in cold stone.
    In Thessamine's Garden: if player stands still 10s at dusk,
    flowers bloom slightly more. That's her.
    She knew she was the anchor. She knew what Edric chose.
    She's not angry. She's been waiting for someone to ask her.
    In the REMEMBER ending: she says one word — "yes" — and it's enough.
  `,

  ORI: `
    Sleeping in a room in Verdenmere. Has been sleeping since the Accord broke.
    The Wild faction protects him — they don't know why, exactly.
    He's the only person who was in the Chamber when Edric released the Accord.
    Waking him requires: all 4 Wild faction quests complete + Maren's trust.
    When awake, he tells the player about the 4 notes.
    He doesn't know about Thessamine. He just knows what he heard.
  `,

  MAREN: `
    A cartographer. Making a map of the Interstitial — the space the Accord left behind.
    The Interstitial doesn't hold still — it shifts between regional palettes.
    She's been there 3 years. Her maps are always wrong by the next day.
    She's still trying.
    For the REMEMBER ending: she needs to be in the Interstitial when player arrives.
    She's always there. She never left.
    When player finds her: "Finally. I was wondering when you'd look for the third door."
    She was waiting. She doesn't explain how she knew.
  `,

  DAEVAN: `
    A soldier from the Ironveil who defected after the Accord broke.
    Carries a sword he's had re-forged 7 times. Won't say why.
    Dry humour. Tired. Has been tired for 30 years.
    His main quest: find out what the sword was for.
    It was a ceremonial sword used in the original Accord binding.
    For the REMEMBER ending: the sword acts as a key to the Chamber's third door.
    He doesn't come with you. He gives it to you and says: "Good luck."
    Then walks away. He's smiling. Player can't see his face.
  `,
} as const;
