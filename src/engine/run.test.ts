import { describe, it, expect } from 'vitest';
import { startRun, rewardOptions, applyReward, advanceAfterVictory, markDefeat } from './run';
import { CONFIG } from './config';
import { loadDeck } from '../content/deck';
import { mulberry32 } from './rng';
import seedJson from '../content/seed-deck.json';

const deck = loadDeck(seedJson);

describe('run', () => {
  it('starts at fight 0 with startingDeckSize cards and the rest in reserve', () => {
    const run = startRun(deck, mulberry32(1));
    expect(run.phase).toBe('combat');
    expect(run.fightIndex).toBe(0);
    expect(run.deckCardIds).toHaveLength(CONFIG.startingDeckSize);
    expect(run.reserveIds).toHaveLength(deck.cards.length - CONFIG.startingDeckSize);
    expect(run.playerHp).toBe(CONFIG.playerMaxHp);
  });

  it('victory on a non-final fight moves to reward phase', () => {
    const run = startRun(deck, mulberry32(1));
    advanceAfterVictory(run, 12); // hp after combat
    expect(run.phase).toBe('reward');
    expect(run.playerHp).toBe(12);
  });

  it('rewardOptions offers up to 3 reserve cards', () => {
    const run = startRun(deck, mulberry32(1));
    advanceAfterVictory(run, 20);
    const opts = rewardOptions(run, mulberry32(2));
    expect(opts.length).toBeLessThanOrEqual(3);
    expect(opts.every((id) => run.reserveIds.includes(id))).toBe(true);
  });

  it('applyReward(cardId) moves card from reserve to deck and starts next fight', () => {
    const run = startRun(deck, mulberry32(1));
    advanceAfterVictory(run, 20);
    const [choice] = rewardOptions(run, mulberry32(2));
    applyReward(run, choice);
    expect(run.deckCardIds).toContain(choice);
    expect(run.reserveIds).not.toContain(choice);
    expect(run.phase).toBe('combat');
    expect(run.fightIndex).toBe(1);
  });

  it("applyReward('heal') heals up to max and starts next fight", () => {
    const run = startRun(deck, mulberry32(1));
    advanceAfterVictory(run, CONFIG.playerMaxHp - 2); // heal should clamp
    applyReward(run, 'heal');
    expect(run.playerHp).toBe(CONFIG.playerMaxHp);
    expect(run.fightIndex).toBe(1);
  });

  it('victory on the final fight completes the run', () => {
    const run = startRun(deck, mulberry32(1));
    run.fightIndex = CONFIG.fights.length - 1;
    advanceAfterVictory(run, 5);
    expect(run.phase).toBe('complete');
  });

  it('markDefeat fails the run', () => {
    const run = startRun(deck, mulberry32(1));
    markDefeat(run);
    expect(run.phase).toBe('failed');
  });
});
