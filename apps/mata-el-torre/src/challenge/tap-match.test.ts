import { describe, it, expect } from 'vitest';
import { buildTapChallenge, OPTION_COUNT } from './tap-match';
import { loadDeck } from '../content/deck';
import { mulberry32 } from '../engine/rng';
import seedJson from '../content/seed-deck.json';

const deck = loadDeck(seedJson);

describe('buildTapChallenge', () => {
  it('produces 4 unique options including the correct word', () => {
    const ch = buildTapChallenge(deck, 'caber', mulberry32(1));
    expect(ch.options).toHaveLength(OPTION_COUNT);
    expect(new Set(ch.options).size).toBe(OPTION_COUNT);
    expect(ch.options).toContain('caber');
    expect(ch.correctWord).toBe('caber');
    expect(ch.cardId).toBe('caber');
  });

  it('prefers confusableWith words as distractors', () => {
    // caber lists apretar; with 1 confusable and 3 slots it must always appear
    const ch = buildTapChallenge(deck, 'caber', mulberry32(2));
    expect(ch.options).toContain('apretar');
  });

  it('falls back to same part of speech, then anything', () => {
    // faro (noun, no confusableWith): all distractors should be nouns (seed deck has >=3 other nouns)
    const ch = buildTapChallenge(deck, 'faro', mulberry32(3));
    const distractors = ch.options.filter((o) => o !== 'el faro');
    expect(distractors).toHaveLength(3);
    const byWord = new Map(deck.cards.map((c) => [c.word, c]));
    expect(distractors.every((d) => byWord.get(d)?.partOfSpeech === 'noun')).toBe(true);
  });

  it('discards excess confusables beyond the distractor slots', () => {
    // escalofrio lists 2 confusables; synthetic card with 4 ensures clean truncation
    const cards = deck.cards.map((c) =>
      c.id === 'escalofrio'
        ? { ...c, confusableWith: ['hormigueo', 'chubasco', 'bostezo', 'susurro'] }
        : c,
    );
    const bigDeck = loadDeck({ name: 'x', cards });
    const ch = buildTapChallenge(bigDeck, 'escalofrio', mulberry32(5));
    expect(ch.options).toHaveLength(OPTION_COUNT);
    expect(new Set(ch.options).size).toBe(OPTION_COUNT);
  });

  it('shuffles option order across seeds', () => {
    const orders = new Set<string>();
    for (let seed = 0; seed < 10; seed++) {
      orders.add(buildTapChallenge(deck, 'caber', mulberry32(seed)).options.join('|'));
    }
    expect(orders.size).toBeGreaterThan(1);
  });
});
