// Re-exports SHOP from Balance with type definitions
export { SHOP, ACTIVITIES } from '../config/Balance';

export type ItemKey   = 'hint' | 'shield' | 'surge' | 'elixir';
export type ActivityKey = 'review' | 'practice' | 'deepStudy' | 'rest' | 'cram' | 'meditation';
