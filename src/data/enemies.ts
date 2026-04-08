// Re-exports MONSTERS from Balance with additional display metadata
export { MONSTERS } from '../config/Balance';

export interface EnemyDef {
  textureKey: string;
  subject: string;
  floor: number; // 0-indexed
}
