import type { DialogueTree } from '../systems/DialogueSystem';

// ── Dialogue Trees for Quest NPCs ───────────────────────────────────────────
// Each tree is keyed by NPC dialogueTreeId from npcConfig.ts.
// Lines with voiceSrc play ElevenLabs audio when the dialogue advances.

export const DIALOGUE_TREES: Record<string, DialogueTree> = {
  // ── Captain Rhoe (Ashfields — Ironveil faction) ───────────────────────
  captain_rhoe: {
    intro: {
      lines: [
        { speaker: 'Captain Rhoe', text: 'The Ironveil holds this gate. State your business.' },
        { speaker: 'Captain Rhoe', text: 'Most wanderers don\'t survive the Ashfields. You look... intact.' },
      ],
      choices: [
        { label: 'What happened here?', next: 'ashfields_history' },
        { label: 'I\'m looking for answers.', next: 'answers' },
        { label: 'I\'ll be going.', next: 'dismiss' },
      ],
    },
    ashfields_history: {
      lines: [
        { speaker: 'Captain Rhoe', text: 'The ash came when the Accord broke. Everything burned from below.' },
        { speaker: 'Captain Rhoe', text: 'Grimdar was stationed here. Before he... changed.' },
      ],
      choices: [
        { label: 'Who is Grimdar?', next: 'grimdar_info' },
        { label: 'Thank you, Captain.', next: 'dismiss' },
      ],
    },
    grimdar_info: {
      lines: [
        { speaker: 'Captain Rhoe', text: 'Commander Grimdar. Best soldier the Ironveil ever had.' },
        { speaker: 'Captain Rhoe', text: 'Now he guards the eastern ruins. Won\'t let anyone pass. Won\'t explain why.' },
      ],
      choices: [
        { label: 'I\'ll talk to him.', next: 'dismiss' },
      ],
    },
    answers: {
      lines: [
        { speaker: 'Captain Rhoe', text: 'Answers. Everyone wants those. The Accord had answers. Look where that got us.' },
      ],
      choices: [
        { label: 'Fair point.', next: 'dismiss' },
      ],
    },
    dismiss: {
      lines: [
        { speaker: 'Captain Rhoe', text: 'Watch yourself out there.' },
      ],
    },
  },

  // ── Maren (Ashfields — no faction) ────────────────────────────────────
  maren: {
    intro: {
      lines: [
        { speaker: 'Maren', text: 'You\'re new. I can tell — you still look up at the sky like you expect it to be different.' },
        { speaker: 'Maren', text: 'I\'ve been here since the Accord broke. My home burned. Then froze. Then turned to ash.' },
      ],
      choices: [
        { label: 'How do you survive?', next: 'survival' },
        { label: 'Can I help?', next: 'help' },
        { label: 'I\'m sorry.', next: 'sorry' },
      ],
    },
    survival: {
      lines: [
        { speaker: 'Maren', text: 'You learn which ash is safe to breathe and which isn\'t. You learn fast or you don\'t learn at all.' },
      ],
      choices: [
        { label: 'Can I help?', next: 'help' },
        { label: 'Stay safe.', next: 'dismiss' },
      ],
    },
    help: {
      lines: [
        { speaker: 'Maren', text: 'Help? There\'s a fox den east of here. The mother hasn\'t come back. The kits are alone.' },
        { speaker: 'Maren', text: 'If you could bring them food... I know it\'s small. But small things matter now.' },
      ],
      choices: [
        { label: 'I\'ll do it.', next: 'quest_accept' },
        { label: 'I have other priorities.', next: 'dismiss' },
      ],
    },
    quest_accept: {
      lines: [
        { speaker: 'Maren', text: 'Thank you. They\'re just east, near the collapsed wall. Be gentle.' },
      ],
    },
    sorry: {
      lines: [
        { speaker: 'Maren', text: 'Don\'t be sorry. Be useful.' },
      ],
      choices: [
        { label: 'Can I help?', next: 'help' },
      ],
    },
    dismiss: {
      lines: [
        { speaker: 'Maren', text: 'The wind\'s picking up. Be careful.' },
      ],
    },
  },

  // ── Verso (Gildspire — merchant) ──────────────────────────────────────
  verso: {
    intro: {
      lines: [
        {
          speaker: 'Verso', text: 'Another wanderer who thinks they can save the world. Lovely. I sell things. Don\'t touch anything.',
          voiceSrc: 'assets/generated/audio/dialogue/verso_01.mp3',
        },
      ],
      choices: [
        { label: 'What do you sell?', next: 'shop' },
        { label: 'Any news?', next: 'news' },
        { label: 'Goodbye.', next: 'dismiss' },
      ],
    },
    shop: {
      lines: [
        {
          speaker: 'Verso', text: 'The Accord broke and suddenly everyone\'s a hero. I just want to sell my wares in peace.',
          voiceSrc: 'assets/generated/audio/dialogue/verso_02.mp3',
        },
      ],
    },
    news: {
      lines: [
        { speaker: 'Verso', text: 'News? The void is spreading. The Ironveil is recruiting. And my prices are going up.' },
      ],
      choices: [
        { label: 'Show me your wares.', next: 'shop' },
        { label: 'Thanks.', next: 'dismiss' },
      ],
    },
    dismiss: {
      lines: [
        { speaker: 'Verso', text: 'Come back when you have lumens.' },
      ],
    },
  },

  // ── Elder Moss (Verdenmere — Wild faction) ────────────────────────────
  elder_moss: {
    intro: {
      lines: [
        { speaker: 'Elder Moss', text: 'The forest speaks to those who listen. What does it say to you?' },
        { speaker: 'Elder Moss', text: 'The LumaMoth suffers. She did not choose her transformation.' },
      ],
      choices: [
        { label: 'What is the LumaMoth?', next: 'luma_info' },
        { label: 'How can I help?', next: 'help' },
        { label: 'I should go.', next: 'dismiss' },
      ],
    },
    luma_info: {
      lines: [
        { speaker: 'Elder Moss', text: 'She was one of us. A keeper of the grove. When the Accord broke, the forest consumed her.' },
        { speaker: 'Elder Moss', text: 'Now she protects the deep woods. But the protection has become a prison.' },
      ],
      choices: [
        { label: 'Can she be freed?', next: 'help' },
      ],
    },
    help: {
      lines: [
        { speaker: 'Elder Moss', text: 'Free her? Perhaps. But freeing and killing look the same from the outside.' },
        { speaker: 'Elder Moss', text: 'Go to the deep grove. Face her. And when the moment comes — choose wisely.' },
      ],
    },
    dismiss: {
      lines: [
        { speaker: 'Elder Moss', text: 'The roots remember your footsteps. Walk carefully.' },
      ],
    },
  },

  // ── Daevan (Greyveil — Forgotten faction) ─────────────────────────────
  daevan: {
    intro: {
      lines: [
        { speaker: 'Daevan', text: 'You seek Edric\'s memory. I can see it in the way you move — searching.' },
        { speaker: 'Daevan', text: 'I knew him. Before. He was my friend.' },
      ],
      choices: [
        { label: 'What was Edric like?', next: 'edric_memory' },
        { label: 'Where did he go?', next: 'where' },
        { label: 'I\'m sorry for your loss.', next: 'dismiss' },
      ],
    },
    edric_memory: {
      lines: [
        { speaker: 'Daevan', text: 'Kind. Stubborn. The kind of man who would break the world to save one person.' },
        { speaker: 'Daevan', text: 'And he did.' },
      ],
      choices: [
        { label: 'Where did he go?', next: 'where' },
      ],
    },
    where: {
      lines: [
        { speaker: 'Daevan', text: 'The Interstitial. Where all broken things gather.' },
        { speaker: 'Daevan', text: 'Take this. His sword. It will show you the way.' },
      ],
    },
    dismiss: {
      lines: [
        { speaker: 'Daevan', text: 'Loss is not something you apologise for. It\'s something you carry.' },
      ],
    },
  },

  // ── Ori (Voidmarsh — mysterious child) ────────────────────────────────
  ori: {
    intro: {
      lines: [
        { speaker: 'Ori', text: '...' },
        { speaker: 'Ori', text: 'You can see me?' },
      ],
      choices: [
        { label: 'Of course. Who are you?', next: 'who' },
        { label: 'Are you lost?', next: 'lost' },
      ],
    },
    who: {
      lines: [
        { speaker: 'Ori', text: 'I don\'t remember. I think I was here before the silence. Or after. It\'s hard to tell.' },
        { speaker: 'Ori', text: 'The void doesn\'t care about before and after.' },
      ],
      choices: [
        { label: 'Come with me. I\'ll keep you safe.', next: 'come_along' },
        { label: 'What do you know about the Accord?', next: 'accord' },
      ],
    },
    lost: {
      lines: [
        { speaker: 'Ori', text: 'Lost? No. I\'m exactly where I\'m supposed to be. I think.' },
      ],
      choices: [
        { label: 'Who are you?', next: 'who' },
      ],
    },
    accord: {
      lines: [
        { speaker: 'Ori', text: 'The Accord was a promise. Promises break. That\'s what makes them promises.' },
      ],
    },
    come_along: {
      lines: [
        { speaker: 'Ori', text: 'Okay. But I should warn you — things follow me. Things from the void.' },
        { speaker: 'Ori', text: 'They\'re not angry. They\'re just... sad.' },
      ],
    },
  },

  // ── Thessamine Echo (Unnamed City — ghost) ────────────────────────────
  thessamine_echo: {
    intro: {
      lines: [
        { speaker: '???', text: '...' },
        { speaker: '???', text: 'You have his eyes.' },
      ],
      choices: [
        { label: 'Whose eyes?', next: 'whose' },
        { label: 'Who are you?', next: 'who' },
      ],
    },
    whose: {
      lines: [
        { speaker: '???', text: 'Edric\'s. But softer. Less desperate.' },
        { speaker: '???', text: 'He came here too. Looking for the same thing you\'re looking for.' },
      ],
      choices: [
        { label: 'Who are you?', next: 'who' },
      ],
    },
    who: {
      lines: [
        { speaker: '???', text: 'I was someone who was loved too much. And it cost everything.' },
        { speaker: '???', text: 'My name is — was — does it matter? The Accord took my name along with everything else.' },
      ],
    },
  },

  // ── Stub trees for NPCs that need expansion ───────────────────────────
  songweaver: {
    intro: {
      lines: [
        { speaker: 'The Songweaver', text: 'The forest has a song. Not music — never music. Just rhythm. Breath. Pulse.' },
      ],
    },
  },
  pale_archivist: {
    intro: {
      lines: [
        { speaker: 'The Pale Archivist', text: 'You want to read the archives? They are blank. All of them. Since the silence.' },
      ],
    },
  },
  solen: {
    intro: {
      lines: [
        { speaker: 'Guildmaster Solen', text: 'Gildspire thrives on trade. Even in silence, there is commerce.' },
      ],
    },
  },
  the_watcher: {
    intro: {
      lines: [
        { speaker: 'The Watcher', text: 'I watch. That is all. Do not ask me what I see.' },
      ],
    },
  },
};
