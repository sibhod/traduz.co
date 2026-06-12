import type { CardDef, DeckDef } from './types';

export interface Deck extends DeckDef {
  byId(id: string): CardDef;
}

const MIN_CARDS = 4; // need 1 correct + 3 distractors

/** Validate raw JSON into a Deck. Throws with a descriptive message on invalid data. */
export function loadDeck(raw: unknown): Deck {
  const def = raw as DeckDef;
  if (!def || !Array.isArray(def.cards)) throw new Error('deck: missing cards array');
  // 1. Field presence + duplicate check
  const ids = new Set<string>();
  for (const c of def.cards) {
    if (!c.id || !c.word || !c.scene || !c.icon) {
      throw new Error(`deck: card missing required field: ${JSON.stringify(c)}`);
    }
    if (ids.has(c.id)) throw new Error(`deck: duplicate card id '${c.id}'`);
    ids.add(c.id);
  }
  // 2. Cross-reference validation (before size guard so bad refs surface immediately)
  for (const c of def.cards) {
    for (const ref of c.confusableWith ?? []) {
      if (!ids.has(ref)) throw new Error(`deck: card '${c.id}' references unknown id '${ref}'`);
    }
  }
  // 3. Minimum size guard (game-logic: need 1 correct + 3 distractors)
  if (def.cards.length < MIN_CARDS) {
    throw new Error(`deck: needs at least ${MIN_CARDS} cards, got ${def.cards.length}`);
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
