import { describe, it, expect } from 'vitest';
import { loadDeck } from './deck';
import seedJson from './seed-deck.json';

describe('loadDeck', () => {
  it('loads the seed deck with 15 valid cards', () => {
    const deck = loadDeck(seedJson);
    expect(deck.cards).toHaveLength(15);
    expect(deck.cards.every((c) => c.scene.length > 0 && c.icon.length > 0)).toBe(true);
  });

  // NOTE: these fixtures must pass the size guard (>= 4 cards) so they reach the
  // check under test, and must not depend on seed-deck card ordering.
  it('rejects duplicate card ids', () => {
    const [a, b, c] = seedJson.cards;
    const bad = { name: 'x', cards: [a, b, c, a] };
    expect(() => loadDeck(bad)).toThrow(/duplicate/i);
  });

  it('rejects confusableWith references to unknown ids', () => {
    const [a, b, c, d] = seedJson.cards;
    const bad = {
      name: 'x',
      cards: [
        { ...a, confusableWith: ['nope'] },
        { ...b, confusableWith: [] },
        { ...c, confusableWith: [] },
        { ...d, confusableWith: [] },
      ],
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
    expect(deck.byId('faro').word).toBe('el faro'); // noun: article included
    expect(() => deck.byId('nope')).toThrow(/unknown card/i);
  });

  it('rejects invalid partOfSpeech values', () => {
    const [a, b, c, d] = seedJson.cards;
    const bad = { name: 'x', cards: [{ ...a, partOfSpeech: 'Verb' }, b, c, d] };
    expect(() => loadDeck(bad)).toThrow(/invalid partOfSpeech/i);
  });

  it('rejects self-referencing confusableWith', () => {
    const [a, b, c, d] = seedJson.cards;
    const bad = { name: 'x', cards: [{ ...a, confusableWith: [a.id] }, b, c, d] };
    expect(() => loadDeck(bad)).toThrow(/itself/i);
  });
});
