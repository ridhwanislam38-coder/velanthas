import { Bus, GameEvent } from './EventBus';

// ── JournalSystem ───────────────────────────────────────────────────────────
// Persistent tracker for quests, lore fragments, and major choices.
// Player presses TAB (via InputSystem JOURNAL action) → overlay opens.
//
// Data shape:
//   quests:  { id, name, stage, maxStage, entries[] }
//   lore:    { id, title, text, region, found: boolean }
//   choices: { id, description, timestamp }
//
// All mutations via EventBus. Persisted to SaveSystem as JSON.

// ── Types ───────────────────────────────────────────────────────────────

export interface QuestEntry {
  questId:     string;
  stageIndex:  number;
  description: string;
  timestamp:   number; // Date.now() when recorded
}

export interface QuestRecord {
  id:        string;
  name:      string;
  stage:     number;
  maxStage:  number;
  entries:   QuestEntry[];
  completed: boolean;
}

export interface LoreRecord {
  id:      string;
  title:   string;
  text:    string;
  region:  string;
  found:   boolean;
}

export interface ChoiceRecord {
  id:          string;
  description: string;
  questId:     string;
  timestamp:   number;
}

export interface JournalData {
  quests:  QuestRecord[];
  lore:    LoreRecord[];
  choices: ChoiceRecord[];
}

// ── System ──────────────────────────────────────────────────────────────

export class JournalSystem {
  private _quests  = new Map<string, QuestRecord>();
  private _lore    = new Map<string, LoreRecord>();
  private _choices: ChoiceRecord[] = [];
  private _isOpen  = false;

  constructor() {
    this._wireEvents();
  }

  // ── Queries ───────────────────────────────────────────────────────────
  get isOpen(): boolean { return this._isOpen; }

  getQuests(): QuestRecord[] { return [...this._quests.values()]; }
  getActiveQuests(): QuestRecord[] { return this.getQuests().filter(q => !q.completed); }
  getCompletedQuests(): QuestRecord[] { return this.getQuests().filter(q => q.completed); }

  getQuest(id: string): QuestRecord | undefined { return this._quests.get(id); }

  getLore(): LoreRecord[] { return [...this._lore.values()]; }
  getFoundLore(): LoreRecord[] { return this.getLore().filter(l => l.found); }
  getLoreCount(): { found: number; total: number } {
    const all = this.getLore();
    return { found: all.filter(l => l.found).length, total: all.length };
  }

  getChoices(): ChoiceRecord[] { return [...this._choices]; }

  // ── Mutations ─────────────────────────────────────────────────────────

  /** Register a quest in the journal (e.g. on first encounter). */
  registerQuest(id: string, name: string, maxStage: number): void {
    if (this._quests.has(id)) return;
    this._quests.set(id, {
      id, name, stage: 0, maxStage,
      entries: [], completed: false,
    });
  }

  /** Register a lore collectible (known to exist but not yet found). */
  registerLore(id: string, title: string, text: string, region: string): void {
    if (this._lore.has(id)) return;
    this._lore.set(id, { id, title, text, region, found: false });
  }

  /** Toggle journal open/closed. */
  toggle(): void {
    this._isOpen = !this._isOpen;
    Bus.emit(this._isOpen ? GameEvent.JOURNAL_OPEN : GameEvent.JOURNAL_CLOSE, {});
  }

  // ── Serialisation ─────────────────────────────────────────────────────

  serialise(): JournalData {
    return {
      quests:  [...this._quests.values()],
      lore:    [...this._lore.values()],
      choices: [...this._choices],
    };
  }

  deserialise(data: JournalData): void {
    this._quests.clear();
    for (const q of data.quests) this._quests.set(q.id, q);

    this._lore.clear();
    for (const l of data.lore) this._lore.set(l.id, l);

    this._choices = [...data.choices];
  }

  // ── Event wiring ──────────────────────────────────────────────────────
  private _wireEvents(): void {
    Bus.on(GameEvent.QUEST_ADVANCE, (data: unknown) => {
      const d = data as { questId: string; stage: number; description: string };
      const quest = this._quests.get(d.questId);
      if (!quest) return;

      quest.stage = d.stage;
      quest.entries.push({
        questId: d.questId,
        stageIndex: d.stage,
        description: d.description,
        timestamp: Date.now(),
      });

      if (d.stage >= quest.maxStage) {
        quest.completed = true;
      }
    });

    Bus.on(GameEvent.LORE_FOUND, (data: unknown) => {
      const d = data as { loreId: string };
      const lore = this._lore.get(d.loreId);
      if (lore) lore.found = true;
    });

    Bus.on(GameEvent.CHOICE_MADE, (data: unknown) => {
      const d = data as { choiceId: string; description: string; questId: string };
      this._choices.push({
        id: d.choiceId,
        description: d.description,
        questId: d.questId,
        timestamp: Date.now(),
      });
    });
  }
}

/** Singleton — one journal for the entire game. */
export const Journal = new JournalSystem();
