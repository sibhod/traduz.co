import { describe, it, expect } from 'vitest';
import { loadDeck } from './deck';
import seedJson from './seed-deck.json';

describe('loadDeck', () => {
  it('loads the seed deck with 15 valid cards', () => {
    const deck = loadDeck(seedJson);
    expect(deck.cards).toHaveLength(15);
    expect(deck.cards.every((c) => c.scene.length > 0 && c.icon.length > 0)).toBe(true);
  });

  it('rejects duplicate card ids', () => {
    const bad = { name: 'x', cards: [seedJson.cards[0], seedJson.cards[0]] };
    expect(() => loadDeck(bad)).toThrow(/duplicate/i);
  });

  it('rejects confusableWith references to unknown ids', () => {
    const bad = {
      name: 'x',
      cards: [{ ...seedJson.cards[0], confusableWith: ['nope'] }],
    };
    expect(() => loadDeck(bad)).toThrow(/unknown/i);
  });

  it('rejects decks too small to build 4-option challenges', () => {
    const bad = { name: 'x', cards: seedJson.cards.slice(0, 3) };
    expect(() => loadDeck(bad)).toThrow(/at least/i);
  });

  it('looks up cards by id', () => {
    const deck = loadDeck(seedJson);
    expect(deck.byId('caber').word).toBe('caber');
    expect(() => deck.byId('nope')).toThrow(/unknown card/i);
  });
});
