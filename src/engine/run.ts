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

export function rewardOptions(run: RunState, rng: Rng): string[] {
  return shuffle(run.reserveIds, rng).slice(0, 3);
}

/** choice: a reserve card id to add to the deck, or 'heal'. Starts the next fight. */
export function applyReward(run: RunState, choice: string | 'heal'): void {
  if (run.phase !== 'reward') throw new Error(`applyReward: wrong phase '${run.phase}'`);
  if (choice === 'heal') {
    run.playerHp = Math.min(CONFIG.playerMaxHp, run.playerHp + CONFIG.rewardHeal);
  } else {
    if (!run.reserveIds.includes(choice)) throw new Error(`applyReward: '${choice}' not in reserve`);
    run.reserveIds.splice(run.reserveIds.indexOf(choice), 1);
    run.deckCardIds.push(choice);
  }
  run.fightIndex += 1;
  run.phase = 'combat';
}

export function markDefeat(run: RunState): void {
  run.phase = 'failed';
}
