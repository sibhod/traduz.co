/** A single vocabulary card. The association art is emoji-composed in v0:
 *  `scene` (2-3 emoji, mastery L0) → `icon` (1 emoji, L1) → generated glyph (L2). */
export interface CardDef {
  id: string; // accent-free slug, e.g. 'escalofrio'
  word: string; // display Spanish, article included for nouns, e.g. 'el escalofrío'
  partOfSpeech: 'verb' | 'noun' | 'adj' | 'phrase';
  scene: string; // emoji string, e.g. '🥶❄️😨'
  icon: string; // single emoji, e.g. '🥶'
  /** Card ids this word is personally/deviously confusable with (preferred distractors). */
  confusableWith?: string[];
}

export interface DeckDef {
  name: string;
  cards: CardDef[];
}
