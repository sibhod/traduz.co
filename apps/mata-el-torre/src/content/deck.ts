import type { CardDef, DeckDef } from './types';

export interface Deck extends DeckDef {
  byId(id: string): CardDef;
}

const MIN_CARDS = 4; // need 1 correct + 3 distractors

const VALID_POS = new Set(['verb', 'noun', 'adj', 'phrase']);

/** Validate raw JSON into a Deck. Throws with a descriptive message on invalid data. */
export function loadDeck(raw: unknown): Deck {
  const def = raw as DeckDef;
  if (!def || !Array.isArray(def.cards)) throw new Error('deck: missing cards array');
  if (def.cards.length < MIN_CARDS) {
    throw new Error(`deck: needs at least ${MIN_CARDS} cards, got ${def.cards.length}`);
  }
  const ids = new Set<string>();
  const words = new Set<string>();
  for (const c of def.cards) {
    if (!c.id || !c.word || !c.scene || !c.icon) {
      throw new Error(`deck: card missing required field: ${JSON.stringify(c)}`);
    }
    if (!VALID_POS.has(c.partOfSpeech)) {
      throw new Error(
        `deck: card '${c.id}' has invalid partOfSpeech '${c.partOfSpeech}' (expected: verb, noun, adj, phrase)`,
      );
    }
    if (ids.has(c.id)) throw new Error(`deck: duplicate card id '${c.id}'`);
    ids.add(c.id);
    if (words.has(c.word)) throw new Error(`deck: duplicate display word '${c.word}'`);
    words.add(c.word);
  }
  for (const c of def.cards) {
    for (const ref of c.confusableWith ?? []) {
      if (ref === c.id) throw new Error(`deck: card '${c.id}' lists itself in confusableWith`);
      if (!ids.has(ref)) throw new Error(`deck: card '${c.id}' references unknown id '${ref}'`);
    }
  }
  const index = new Map(def.cards.map((c) => [c.id, c]));
  return {
    name: def.name,
    cards: def.cards,
    byId(id: string): CardDef {
      const card = index.get(id);
      if (!card) throw new Error(`deck: unknown card id '${id}'`);
      return card;
    },
  };
}
