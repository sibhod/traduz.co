import type { Deck } from '../content/deck';
import type { Rng } from './rng';
import { shuffle } from './rng';
import { CONFIG } from './config';

export type RunPhase = 'combat' | 'reward' | 'complete' | 'failed';

export interface RunState {
  phase: RunPhase;
  fightIndex: number; // index into CONFIG.fights
  playerHp: number; // persists across fights
  deckCardIds: string[];
  reserveIds: string[]; // unplayed seed cards offered as rewards
}

export function startRun(deck: Deck, rng: Rng): RunState {
  const ids = shuffle(deck.cards.map((c) => c.id), rng);
  return {
    phase: 'combat',
    fightIndex: 0,
    playerHp: CONFIG.playerMaxHp,
    deckCardIds: ids.slice(0, CONFIG.startingDeckSize),
    reserveIds: ids.slice(CONFIG.startingDeckSize),
  };
}

/** Call after a combat victory with the player's remaining HP. */
export function advanceAfterVictory(run: RunState, playerHp: number): void {
  run.playerHp = playerHp;
  if (run.fightIndex >= CONFIG.fights.length - 1) {
    run.phase = 'complete';
  } else {
    run.phase = 'reward';
  }
}

/** Up to CONFIG.rewardOfferCount reserve cards to offer. May return [] when the
 *  reserve is exhausted — the UI must ALWAYS offer 'heal' as a separate option. */
export function rewardOptions(run: RunState, rng: Rng): string[] {
  if (run.phase !== 'reward') throw new Error(`rewardOptions: wrong phase '${run.phase}'`);
  return shuffle(run.reserveIds, rng).slice(0, CONFIG.rewardOfferCount);
}

/** choice: a reserve card id to add to the deck, or 'heal'. Starts the next fight. */
export function applyReward(run: RunState, choice: string | 'heal'): void {
  if (run.phase !== 'reward') throw new Error(`applyReward: wrong phase '${run.phase}'`);
  if (choice === 'heal') {
    run.playerHp = Math.min(CONFIG.playerMaxHp, run.playerHp + CONFIG.rewardHeal);
  } else {
    const idx = run.reserveIds.indexOf(choice);
    if (idx === -1) throw new Error(`applyReward: '${choice}' not in reserve`);
    run.reserveIds.splice(idx, 1);
    run.deckCardIds.push(choice);
  }
  run.fightIndex += 1;
  run.phase = 'combat';
}

export function markDefeat(run: RunState): void {
  run.phase = 'failed';
}
