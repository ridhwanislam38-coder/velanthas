import type { Question, SubjectKey } from '../types/game';

// Step 5: AI question generation (Claude) + online fetch (OTDB) + fallback banks
export class QuestionSystem {
  private detectedTopic = '';
  private detectedCategory = 0;

  // TODO (Step 5): Implement all methods below

  async generateFromLesson(_lessonText: string, _apiKey: string): Promise<Question[]> {
    throw new Error('QuestionSystem.generateFromLesson() not yet implemented');
  }

  async fetchMoreOnline(): Promise<Question[]> {
    throw new Error('QuestionSystem.fetchMoreOnline() not yet implemented');
  }

  async generateMoreOnTopic(_apiKey: string): Promise<Question[]> {
    throw new Error('QuestionSystem.generateMoreOnTopic() not yet implemented');
  }

  getPool(_subject: SubjectKey): Question[] {
    throw new Error('QuestionSystem.getPool() not yet implemented');
  }

  getDetectedTopic(): string { return this.detectedTopic; }
}

export const QS = new QuestionSystem();
