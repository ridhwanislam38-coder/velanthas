// ── NPC Configuration — Quest + Ambient NPCs ───────────────────────────────
// 12 quest NPCs (with dialogue trees, quests, story involvement)
// 20+ ambient NPCs (flavour text, patrol, no quests — just world liveliness)
//
// Quest NPCs reference their dialogue tree IDs (defined in entity files).
// Ambient NPCs are spawned by region scenes with random patrol paths.

export interface QuestNPCConfig {
  id:          string;
  name:        string;
  region:      string;
  x:           number;
  y:           number;
  textureKey:  string;
  dialogueTreeId: string;
  questId?:    string;     // links to JournalSystem quest
  faction?:    string;
  voiceId?:    string;     // ElevenLabs voice for future line generation
}

export interface AmbientNPCConfig {
  id:          string;
  name:        string;
  region:      string;
  x:           number;
  y:           number;
  textureKey:  string;
  flavorText:  string;
  patrolX?:    [number, number];
  patrolY?:    [number, number];
  speed?:      number;
}

// ── 12 Quest NPCs ──────────────────────────────────────────────────────

export const QUEST_NPCS: QuestNPCConfig[] = [
  // Ashfields (3)
  {
    id: 'magistra_eon', name: 'Magistra Eon', region: 'ASHFIELDS',
    x: 180, y: 240, textureKey: 'npc_scholar',
    dialogueTreeId: 'magistra_eon', questId: 'ACCORD_TRUTH',
    voiceId: 'EXAVITQu4vr4xnSDxMaL', // Sarah
  },
  {
    id: 'captain_rhoe', name: 'Captain Rhoe', region: 'ASHFIELDS',
    x: 350, y: 200, textureKey: 'npc_guard',
    dialogueTreeId: 'captain_rhoe', questId: 'GRIMDAR_PAST', faction: 'ironveil',
  },
  {
    id: 'maren', name: 'Maren', region: 'ASHFIELDS',
    x: 500, y: 280, textureKey: 'npc_villager',
    dialogueTreeId: 'maren', questId: 'MAREN_CHOICE',
  },

  // Verdenmere (2)
  {
    id: 'elder_moss', name: 'Elder Moss', region: 'VERDENMERE',
    x: 200, y: 350, textureKey: 'npc_elder',
    dialogueTreeId: 'elder_moss', questId: 'LUMA_FREEDOM', faction: 'thewild',
  },
  {
    id: 'songweaver', name: 'The Songweaver', region: 'VERDENMERE',
    x: 450, y: 180, textureKey: 'npc_bard',
    dialogueTreeId: 'songweaver',
  },

  // Greyveil (2)
  {
    id: 'daevan', name: 'Daevan', region: 'GREYVEIL',
    x: 300, y: 250, textureKey: 'npc_knight',
    dialogueTreeId: 'daevan', questId: 'EDRIC_MEMORY', faction: 'forgotten',
  },
  {
    id: 'pale_archivist', name: 'The Pale Archivist', region: 'GREYVEIL',
    x: 150, y: 400, textureKey: 'npc_scholar',
    dialogueTreeId: 'pale_archivist',
  },

  // Gildspire (2)
  {
    id: 'verso', name: 'Verso', region: 'GILDSPIRE',
    x: 440, y: 300, textureKey: 'npc_merchant',
    dialogueTreeId: 'verso', faction: 'gilded',
    voiceId: 'N2lVS1w4EtoT3dr4eOWO', // Callum
  },
  {
    id: 'guildmaster_solen', name: 'Guildmaster Solen', region: 'GILDSPIRE',
    x: 600, y: 200, textureKey: 'npc_noble',
    dialogueTreeId: 'solen',
  },

  // Voidmarsh (2)
  {
    id: 'ori', name: 'Ori', region: 'VOIDMARSH',
    x: 250, y: 300, textureKey: 'npc_child',
    dialogueTreeId: 'ori', questId: 'THE_ENDING',
  },
  {
    id: 'the_watcher', name: 'The Watcher', region: 'VOIDMARSH',
    x: 400, y: 150, textureKey: 'npc_hooded',
    dialogueTreeId: 'the_watcher', faction: 'silentones',
  },

  // Unnamed City (1)
  {
    id: 'thessamine_echo', name: '???', region: 'UNNAMED_CITY',
    x: 240, y: 240, textureKey: 'npc_ghost',
    dialogueTreeId: 'thessamine_echo', questId: 'THE_ENDING',
  },
];

// ── 20+ Ambient NPCs ───────────────────────────────────────────────────

export const AMBIENT_NPCS: AmbientNPCConfig[] = [
  // Ashfields (5)
  { id: 'ash_villager_1', name: 'Villager', region: 'ASHFIELDS', x: 100, y: 200, textureKey: 'npc_villager', flavorText: 'The ash never stops falling.', patrolX: [80, 150], speed: 20 },
  { id: 'ash_villager_2', name: 'Farmer', region: 'ASHFIELDS', x: 250, y: 320, textureKey: 'npc_villager', flavorText: 'Nothing grows here anymore.', patrolX: [220, 300] },
  { id: 'ash_guard_1', name: 'Guard', region: 'ASHFIELDS', x: 400, y: 150, textureKey: 'npc_guard', flavorText: 'Move along.', patrolX: [380, 450] },
  { id: 'ash_child_1', name: 'Child', region: 'ASHFIELDS', x: 150, y: 350, textureKey: 'npc_child', flavorText: 'Have you seen any fireflies?', patrolX: [120, 200], speed: 35 },
  { id: 'ash_elder_1', name: 'Old Woman', region: 'ASHFIELDS', x: 500, y: 250, textureKey: 'npc_elder', flavorText: 'I remember when the sky was blue.' },

  // Verdenmere (4)
  { id: 'ver_hunter_1', name: 'Hunter', region: 'VERDENMERE', x: 300, y: 200, textureKey: 'npc_hunter', flavorText: 'The forest provides.', patrolX: [250, 400] },
  { id: 'ver_gatherer_1', name: 'Gatherer', region: 'VERDENMERE', x: 150, y: 400, textureKey: 'npc_villager', flavorText: 'These herbs keep the sickness at bay.' },
  { id: 'ver_child_1', name: 'Child', region: 'VERDENMERE', x: 500, y: 300, textureKey: 'npc_child', flavorText: 'The fireflies talk to me!', patrolX: [450, 550], speed: 40 },
  { id: 'ver_hermit_1', name: 'Hermit', region: 'VERDENMERE', x: 100, y: 500, textureKey: 'npc_hooded', flavorText: 'Leave me be.' },

  // Greyveil (3)
  { id: 'grey_mourner_1', name: 'Mourner', region: 'GREYVEIL', x: 200, y: 300, textureKey: 'npc_villager', flavorText: 'They are not at rest.' },
  { id: 'grey_mourner_2', name: 'Mourner', region: 'GREYVEIL', x: 400, y: 200, textureKey: 'npc_villager', flavorText: 'Do you hear the bells? I hear them every night.' },
  { id: 'grey_knight_1', name: 'Broken Knight', region: 'GREYVEIL', x: 600, y: 350, textureKey: 'npc_knight', flavorText: 'My oath died with the Accord.' },

  // Gildspire (5 — busy city)
  { id: 'gild_merchant_1', name: 'Merchant', region: 'GILDSPIRE', x: 300, y: 250, textureKey: 'npc_merchant', flavorText: 'Finest wares! Reasonable prices!', patrolX: [250, 400] },
  { id: 'gild_merchant_2', name: 'Jeweler', region: 'GILDSPIRE', x: 500, y: 300, textureKey: 'npc_merchant', flavorText: 'Genuine void crystals. Mostly.' },
  { id: 'gild_noble_1', name: 'Noble', region: 'GILDSPIRE', x: 700, y: 200, textureKey: 'npc_noble', flavorText: 'The Accord breaking was bad for business.', patrolX: [650, 800] },
  { id: 'gild_guard_1', name: 'City Guard', region: 'GILDSPIRE', x: 200, y: 400, textureKey: 'npc_guard', flavorText: 'No trouble in Gildspire.', patrolX: [150, 300] },
  { id: 'gild_beggar_1', name: 'Beggar', region: 'GILDSPIRE', x: 450, y: 500, textureKey: 'npc_villager', flavorText: 'Spare a lumen?' },

  // Voidmarsh (3)
  { id: 'void_wanderer_1', name: 'Lost Wanderer', region: 'VOIDMARSH', x: 200, y: 250, textureKey: 'npc_hooded', flavorText: 'Which way is out? I have been walking for days.' },
  { id: 'void_cultist_1', name: 'Hooded Figure', region: 'VOIDMARSH', x: 350, y: 400, textureKey: 'npc_hooded', flavorText: 'The void is not empty. It is full of things we forgot.' },
  { id: 'void_child_1', name: 'Child', region: 'VOIDMARSH', x: 100, y: 350, textureKey: 'npc_child', flavorText: 'The jellyfish are pretty. But they make me sad.' },
];

// ── Helpers ─────────────────────────────────────────────────────────────

export function getQuestNPCsForRegion(region: string): QuestNPCConfig[] {
  return QUEST_NPCS.filter(n => n.region === region);
}

export function getAmbientNPCsForRegion(region: string): AmbientNPCConfig[] {
  return AMBIENT_NPCS.filter(n => n.region === region);
}
