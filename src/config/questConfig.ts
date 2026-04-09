// ── Quest & Lore Registration ───────────────────────────────────────────────
// Called once at game start to populate JournalSystem with all known quests
// and lore fragments. Discovery happens during gameplay via EventBus.

import { Journal } from '../systems/JournalSystem';

// ── Main Quests (3) ─────────────────────────────────────────────────────
const MAIN_QUESTS = [
  { id: 'ACCORD_TRUTH',  name: "The Accord's Silence",  maxStage: 5 },
  { id: 'EDRIC_MEMORY',  name: "Edric's Memory",        maxStage: 3 },
  { id: 'THE_ENDING',    name: 'The Ending',            maxStage: 3 },
] as const;

// ── Side Quests (9 — hitting 12 total with mains) ───────────────────────
const SIDE_QUESTS = [
  { id: 'GRIMDAR_PAST',     name: 'What Grimdar Was',      maxStage: 3 },
  { id: 'LUMA_FREEDOM',     name: 'Let It Go',             maxStage: 2 },
  { id: 'MAREN_CHOICE',     name: "Maren's Choice",        maxStage: 3 },
  { id: 'BROKEN_OATH',      name: 'The Broken Oath',       maxStage: 2 },
  { id: 'GILDED_SECRETS',   name: 'Gilded Secrets',        maxStage: 3 },
  { id: 'VOID_CHILDREN',    name: 'Children of the Void',  maxStage: 2 },
  { id: 'SILENT_VIGIL',     name: 'The Silent Vigil',      maxStage: 2 },
  { id: 'LOST_EXPEDITION',  name: 'The Lost Expedition',   maxStage: 3 },
  { id: 'SONGBIRD_LAMENT',  name: "Songbird's Lament",     maxStage: 2 },
] as const;

// ── Lore Fragments (50 — content target) ────────────────────────────────
const LORE_FRAGMENTS = [
  // Accord history (10)
  { id: 'lore_accord_01', title: 'The First Signing',       text: 'Five powers signed the Accord in the Chamber of Echoes. None spoke of what they gave up.', region: 'ASHFIELDS' },
  { id: 'lore_accord_02', title: 'The Chamber',             text: 'The Chamber exists outside of time. Or so they say. No one has entered since the silence.', region: 'UNNAMED_CITY' },
  { id: 'lore_accord_03', title: 'Year One',                text: 'The first year of the Accord: crops grew, wars ended, children laughed. It seemed perfect.', region: 'VERDENMERE' },
  { id: 'lore_accord_04', title: 'Year Fifty',              text: 'By the fiftieth year, some had forgotten why the Accord existed. That was the point.', region: 'GILDSPIRE' },
  { id: 'lore_accord_05', title: 'The Cost',                text: 'The Accord demanded a price. Each generation paid it unknowingly.', region: 'GREYVEIL' },
  { id: 'lore_accord_06', title: 'The Wardens',             text: 'Three Wardens guarded the Chamber. One remains.', region: 'GREYVEIL' },
  { id: 'lore_accord_07', title: 'The Silence Begins',      text: 'When the Accord broke, there was no sound. No explosion. Just... absence.', region: 'VOIDMARSH' },
  { id: 'lore_accord_08', title: 'After the Silence',       text: 'The sky changed first. Then the water. Then the people.', region: 'ASHFIELDS' },
  { id: 'lore_accord_09', title: 'What Remained',           text: 'White stone appeared in ruins across every region. The same shade. The same wrongness.', region: 'ASHFIELDS' },
  { id: 'lore_accord_10', title: "The Accord's True Name",  text: 'It was never called The Accord by those who made it. They called it The Mercy.', region: 'UNNAMED_CITY' },

  // Edric & Thessamine (8)
  { id: 'lore_edric_01', title: "Edric's Journal, Page 1",    text: 'She is dying. The Accord can save her. I know it can.', region: 'ASHFIELDS' },
  { id: 'lore_edric_02', title: "Edric's Journal, Page 7",    text: 'They said the price was too high. What do they know of love?', region: 'GREYVEIL' },
  { id: 'lore_edric_03', title: "Edric's Journal, Page 14",   text: 'I entered the Chamber alone. The Accord spoke to me. It was not a voice.', region: 'UNNAMED_CITY' },
  { id: 'lore_edric_04', title: "Edric's Journal, Final",     text: 'She died anyway. I broke everything for nothing. Forgive me.', region: 'VOIDMARSH' },
  { id: 'lore_thess_01', title: "Thessamine's Locket",        text: 'Inside: a lock of hair. A child\'s drawing. A name that has been scratched out.', region: 'ASHFIELDS' },
  { id: 'lore_thess_02', title: 'The Healer\'s Record',       text: 'Patient: Thessamine Vael. Condition: Void Blight. Prognosis: terminal.', region: 'VERDENMERE' },
  { id: 'lore_thess_03', title: 'A Letter Never Sent',        text: 'My dearest child — if you ever find this, know that we tried. We tried everything.', region: 'GREYVEIL' },
  { id: 'lore_thess_04', title: 'The Nursery',                text: 'A small room in the Ashfields. Toys on the floor. Covered in ash. Untouched for years.', region: 'ASHFIELDS' },

  // Regions (15)
  { id: 'lore_ash_01', title: 'Ashfields Origin',       text: 'Before the Accord broke, this was farmland. The ash came from below, not above.', region: 'ASHFIELDS' },
  { id: 'lore_ash_02', title: 'The Ember Wells',        text: 'Deep beneath the ash, something still burns. The villagers call it the Accord\'s heartbeat.', region: 'ASHFIELDS' },
  { id: 'lore_ash_03', title: 'Monument to the Fallen', text: 'Names carved in stone. Too many to read. Most of them children.', region: 'ASHFIELDS' },
  { id: 'lore_ver_01', title: 'The Living Canopy',      text: 'Verdenmere\'s trees predate the Accord. They remember what came before.', region: 'VERDENMERE' },
  { id: 'lore_ver_02', title: 'Spore Wisdom',           text: 'The SporeWitch claims the fungus carries memories of the dead. She might not be wrong.', region: 'VERDENMERE' },
  { id: 'lore_ver_03', title: 'The Old Grove',           text: 'A tree older than civilization. It does not want to be found.', region: 'VERDENMERE' },
  { id: 'lore_grey_01', title: 'Greyveil Before',       text: 'Once a center of learning. Now a cemetery that forgot to stop growing.', region: 'GREYVEIL' },
  { id: 'lore_grey_02', title: 'The Bell Tower',        text: 'No one rings the bells. They ring themselves. Always at midnight.', region: 'GREYVEIL' },
  { id: 'lore_grey_03', title: 'Buried Archives',       text: 'Beneath the crypts: shelves of books no one is allowed to read. The pages are blank.', region: 'GREYVEIL' },
  { id: 'lore_gild_01', title: 'Gildspire\'s Founding', text: 'Built on commerce. Sustained by greed. The only region that profited from the Accord.', region: 'GILDSPIRE' },
  { id: 'lore_gild_02', title: 'The Guild Ledger',      text: 'Detailed accounts of every transaction since the Accord. Including one labeled only "Payment."', region: 'GILDSPIRE' },
  { id: 'lore_void_01', title: 'Voidmarsh Formation',   text: 'The marsh appeared overnight when the Accord broke. Where there was dry land, there was void.', region: 'VOIDMARSH' },
  { id: 'lore_void_02', title: 'Echo Phenomenon',       text: 'Travellers report seeing themselves in the marsh. The reflections do not always mirror correctly.', region: 'VOIDMARSH' },
  { id: 'lore_void_03', title: 'The Heart of Void',     text: 'At the center of the marsh: a point where sound stops completely. Even your heartbeat.', region: 'VOIDMARSH' },
  { id: 'lore_city_01', title: 'The Unnamed City',      text: 'It has a name. Everyone who learns it forgets it immediately.', region: 'UNNAMED_CITY' },

  // Factions (7)
  { id: 'lore_iron_01', title: 'Ironveil Doctrine',     text: 'Order through strength. The Accord was order. Without it, we are the new Accord.', region: 'ASHFIELDS' },
  { id: 'lore_wild_01', title: 'The Wild Pact',         text: 'The forest made its own accord. Simpler. More honest. More violent.', region: 'VERDENMERE' },
  { id: 'lore_void_f01',title: 'Voidborn Manifesto',    text: 'We are what the Accord forgot. We are the silence given form.', region: 'VOIDMARSH' },
  { id: 'lore_gild_f01',title: 'Gilded Creed',          text: 'Everything has a price. Even silence. Especially silence.', region: 'GILDSPIRE' },
  { id: 'lore_forg_01', title: 'The Forgotten Oath',    text: 'We swore to protect the Accord. We failed. Now we are nothing.', region: 'GREYVEIL' },
  { id: 'lore_sil_01',  title: 'Silent Ones Inscription', text: '[The stone is covered in text. Every word is the same word, repeated infinitely.]', region: 'VOIDMARSH' },
  { id: 'lore_neut_01', title: 'The Mirror Knight\'s Code', text: 'I serve no faction. I reflect what stands before me. That is enough.', region: 'ASHFIELDS' },

  // Secrets / Easter eggs (10)
  { id: 'lore_secret_01', title: 'Developer\'s Note',      text: 'If you found this, you looked harder than most. Thank you.', region: 'UNNAMED_CITY' },
  { id: 'lore_secret_02', title: 'The Sixth Power',        text: 'Five powers signed the Accord. But the ink shows six signatures.', region: 'UNNAMED_CITY' },
  { id: 'lore_secret_03', title: 'Time Loop Theory',       text: 'A scholar\'s notes, crossed out: "The Accord did not break. It completed."', region: 'GREYVEIL' },
  { id: 'lore_secret_04', title: 'Moth\'s Memory',          text: 'The LumaMoth was human once. She chose transformation over death.', region: 'VERDENMERE' },
  { id: 'lore_secret_05', title: 'The Warden\'s Key',       text: 'Hidden beneath the Warden\'s armour: a key to nothing. Or everything.', region: 'GREYVEIL' },
  { id: 'lore_secret_06', title: 'Sister\'s True Name',     text: 'Sister Silence\'s name before the Accord: [the text dissolves as you read it].', region: 'UNNAMED_CITY' },
  { id: 'lore_secret_07', title: 'The Child Ori',           text: 'Ori is not a child. Ori is what remains when a god forgets itself.', region: 'VOIDMARSH' },
  { id: 'lore_secret_08', title: 'Grimdar\'s Humanity',     text: 'He keeps a flower pressed inside his shield. He waters it with tears he doesn\'t shed.', region: 'ASHFIELDS' },
  { id: 'lore_secret_09', title: 'The True Ending',         text: 'There is a fourth ending. You have to lose to find it.', region: 'UNNAMED_CITY' },
  { id: 'lore_secret_10', title: 'After the Credits',       text: 'If you wait long enough after the credits, you hear a child laugh. Just once.', region: 'UNNAMED_CITY' },
];

// ── Registration function ───────────────────────────────────────────────
export function registerAllContent(): void {
  // Quests
  for (const q of MAIN_QUESTS) {
    Journal.registerQuest(q.id, q.name, q.maxStage);
  }
  for (const q of SIDE_QUESTS) {
    Journal.registerQuest(q.id, q.name, q.maxStage);
  }

  // Lore
  for (const l of LORE_FRAGMENTS) {
    Journal.registerLore(l.id, l.title, l.text, l.region);
  }
}
