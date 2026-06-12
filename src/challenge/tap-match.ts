import type { Deck } from '../content/deck';
import type { Rng } from '../engine/rng';
import { shuffle } from '../engine/rng';
import type { TapChallenge } from './types';

export const OPTION_COUNT = 4;

/** Build a 4-option word challenge for a card. Distractor preference:
 *  confusableWith (devious, hand-tuned) → same partOfSpeech → any other card. */
export function buildTapChallenge(deck: Deck, cardId: string, rng: Rng): TapChallenge {
  const target = deck.byId(cardId);
  const others = deck.cards.filter((c) => c.id !== cardId);

  const confusable = others.filter((c) => target.confusableWith?.includes(c.id));
  const samePos = others.filter(
    (c) => !confusable.includes(c) && c.partOfSpeech === target.partOfSpeech,
  );
  const rest = others.filter((c) => !confusable.includes(c) && !samePos.includes(c));

  const pool = [...shuffle(confusable, rng), ...shuffle(samePos, rng), ...shuffle(rest, rng)];
  const distractors = pool.slice(0, OPTION_COUNT - 1).map((c) => c.word);

  return {
    cardId,
    options: shuffle([target.word, ...distractors], rng),
    correctWord: target.word,
  };
}
