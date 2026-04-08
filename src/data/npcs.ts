// NPC configs + dialogue trees — migrated and typed from V2

export interface DialogueNode {
  text: string;
  choices?: Array<{ label: string; next: string }>;
  action?: '__shop__' | '__dungeon__' | '__close__';
}

export interface NpcConfig {
  id: string;
  name: string;
  x: number;
  textureKey: string;
  nameColor: string;
  patrolX?: [number, number];
  speed?: number;
  dialogue?: Record<string, DialogueNode>;
  flavorText?: string;   // for background NPCs
  isSpeaking: boolean;
}

const NPCS: NpcConfig[] = [
  {
    id: 'verso',
    name: 'Verso',
    x: 440,
    textureKey: 'npc_verso',
    nameColor: '#ffd60a',
    isSpeaking: true,
    dialogue: {
      first: {
        text: "Another student who thinks studying is optional. Lovely. I sell things. Don't touch anything.",
        choices: [
          { label: 'Who are you?',         next: 'whoAreYou' },
          { label: 'What do you sell?',    next: 'shop' },
          { label: "I'll be going then.",  next: '__close__' as const },
        ],
      },
      whoAreYou: {
        text: "Verso. Shopkeeper, amateur archivist, and the only person in Umbral Crossing who reads.",
        choices: [
          { label: 'Sounds lonely.',        next: 'lonely' },
          { label: 'What do you sell?',     next: 'shop' },
        ],
      },
      lonely: {
        text: "Deeply. Now are you buying something or just auditing my emotional state?",
        choices: [{ label: 'Show me the shop.', next: 'shop' }],
      },
      shop: {
        text: "Fine. Don't break anything.",
        action: '__shop__',
      },
    },
  },
  {
    id: 'lune',
    name: 'Lune',
    x: 620,
    textureKey: 'npc_lune',
    nameColor: '#4cc9f0',
    patrolX: [550, 700],
    speed: 35,
    isSpeaking: true,
    dialogue: {
      first: {
        text: "The books remember everything. Even what you've forgotten to learn.",
        choices: [
          { label: 'What does that mean?',   next: 'dangerous' },
          { label: 'Who are you?',           next: 'whoAreYou' },
        ],
      },
      whoAreYou: {
        text: "I wander. I watch. The Void Index called to me once. I didn't answer. You might not have a choice.",
        choices: [{ label: 'Keep walking...', next: '__close__' as const }],
      },
      dangerous: {
        text: "The Conceptum aren't just monsters. They're questions that nobody ever answered. Give them an answer — any answer — and they dissolve.",
        choices: [{ label: 'Understood.', next: '__close__' as const }],
      },
    },
  },
  {
    id: 'six',
    name: 'Six',
    x: 200,
    textureKey: 'npc_student',
    nameColor: '#06d6a0',
    patrolX: [140, 280],
    speed: 55,
    isSpeaking: true,
    dialogue: {
      first: {
        text: "You made it! I was starting to think I was the only student left. The name's Six. Long story.",
        choices: [
          { label: 'Nice to meet you, Six.', next: 'okay' },
          { label: 'Six is a weird name.',   next: 'name' },
        ],
      },
      okay: {
        text: "The dungeon to the east — don't go unprepared. I did. Lost three HP bars before I even saw the boss.",
        choices: [{ label: 'Thanks for the warning.', next: '__close__' as const }],
      },
      name: {
        text: "I know, I know. I was the sixth student to enroll this year. The registry just... stuck. Can we move on?",
        choices: [{ label: 'Sure. Stay safe.', next: '__close__' as const }],
      },
    },
  },
  {
    id: 'brant',
    name: 'Captain Brant',
    x: 780,
    textureKey: 'npc_guard',
    nameColor: '#e94560',
    isSpeaking: true,
    dialogue: {
      first: {
        text: "Gate's sealed. Academy orders. No one enters the eastern dungeon without proving their worth.",
        choices: [
          { label: 'Let me through.',         next: 'letThrough' },
          { label: "What's inside?",          next: 'whatInside' },
        ],
      },
      letThrough: {
        text: "Come back when you've reached Level 3. Gate will open itself — the dungeon decides who's ready.",
        choices: [{ label: 'Understood.', next: '__close__' as const }],
      },
      whatInside: {
        text: "The Void Index antechamber. And things that used to be scholars. Don't ask more than that.",
        choices: [{ label: "I won't.", next: '__close__' as const }],
      },
    },
  },
];

export default NPCS;
