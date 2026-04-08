// Prologue + chapter story data — migrated from V2 Phaser project

export interface StoryScreen {
  lines: string[];
  portrait?: 'hero' | 'eon' | 'void' | null;
}

export interface StoryData {
  prologue: StoryScreen[];
  chapters: Record<string, StoryScreen[]>;
}

const STORY: StoryData = {
  prologue: [
    {
      portrait: null,
      lines: [
        'In the realm of Lumenveil,',
        'knowledge was not merely power —',
        'it was existence itself.',
      ],
    },
    {
      portrait: null,
      lines: [
        'The Great Archive held every truth',
        'ever discovered. Its light kept',
        'the Conceptum at bay.',
      ],
    },
    {
      portrait: null,
      lines: [
        'Then came THE FORGETTING.',
        '',
        'The Archive shattered.',
        'Monsters of corrupted knowledge',
        'poured through the cracks.',
      ],
    },
    {
      portrait: 'hero',
      lines: [
        'You are the last student of',
        'Redoubt Academy.',
        '',
        'Your mentor, Magistra Eon,',
        'is lost in the Void Index.',
      ],
    },
    {
      portrait: 'hero',
      lines: [
        'Study. Grow strong.',
        'Answer every question they throw',
        'at you with perfect precision.',
        '',
        'Knowledge is your weapon.',
      ],
    },
  ],
  chapters: {
    'chapter-1': [
      {
        portrait: null,
        lines: ['Chapter I', '', 'UMBRAL CROSSING'],
      },
    ],
    'chapter-2': [
      {
        portrait: null,
        lines: ['Chapter II', '', 'THE VOID INDEX'],
      },
    ],
    'chapter-3': [
      {
        portrait: null,
        lines: ['Chapter III', '', 'THE FINAL THEOREM'],
      },
    ],
  },
};

export default STORY;
