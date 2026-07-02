import { describe, it, expect } from 'vitest';
import { startCombat, playCard, resolveChallenge, endTurn } from './combat';
import type { CombatState } from './combat';
import { CONFIG } from './config';
import { loadDeck } from '../content/deck';
import { mulberry32 } from './rng';
import seedJson from '../content/seed-deck.json';

const deck = loadDeck(seedJson);
const tenIds = deck.cards.slice(0, 10).map((c) => c.id);
const enemy = CONFIG.fights[0];

function freshCombat(seed = 1): CombatState {
  return startCombat({
    cardIds: tenIds,
    levels: {},
    flagged: new Set(),
    enemy,
    playerHp: CONFIG.playerMaxHp,
    rng: mulberry32(seed),
  }).state;
}

describe('combat', () => {
  it('starts in awaitCard with a full hand and full energy', () => {
    const s = freshCombat();
    expect(s.phase).toBe('awaitCard');
    expect(s.hand).toHaveLength(CONFIG.handSize);
    expect(s.energy).toBe(CONFIG.energyPerTurn);
    expect(s.drawPile.length + s.hand.length).toBe(10);
  });

  it('playCard moves to awaitChallenge with a pending challenge for that card', () => {
    const s = freshCombat();
    const cardId = s.hand[0];
    playCard(s, deck, cardId, mulberry32(2));
    expect(s.phase).toBe('awaitChallenge');
    expect(s.pending?.cardId).toBe(cardId);
    expect(s.pending?.options).toHaveLength(4);
  });

  it('correct answer deals level-scaled damage and discards the card', () => {
    const s = freshCombat();
    const cardId = s.hand[0];
    s.levels[cardId] = 1; // mastery level 1 → 4 + 2 = 6
    playCard(s, deck, cardId, mulberry32(2));
    const events = resolveChallenge(s, s.pending!.correctWord);
    expect(s.enemyHp).toBe(enemy.hp - (CONFIG.baseDamage + CONFIG.damagePerLevel));
    expect(s.discard).toContain(cardId);
    expect(s.hand).not.toContain(cardId);
    expect(s.energy).toBe(CONFIG.energyPerTurn - 1);
    expect(s.phase).toBe('awaitCard');
    expect(events.some((e) => e.type === 'challengePassed')).toBe(true);
  });

  it('wrong answer fizzles: no enemy damage, self-hit, card flagged', () => {
    const s = freshCombat();
    const cardId = s.hand[0];
    playCard(s, deck, cardId, mulberry32(2));
    const wrong = s.pending!.options.find((o) => o !== s.pending!.correctWord)!;
    const events = resolveChallenge(s, wrong);
    expect(s.enemyHp).toBe(enemy.hp);
    expect(s.playerHp).toBe(CONFIG.playerMaxHp - CONFIG.fizzleSelfDamage);
    expect(s.flagged.has(cardId)).toBe(true);
    expect(events.some((e) => e.type === 'challengeFailed')).toBe(true);
  });

  it('reaching 0 enemy HP wins', () => {
    const s = freshCombat();
    s.enemyHp = 1;
    const cardId = s.hand[0];
    playCard(s, deck, cardId, mulberry32(2));
    const events = resolveChallenge(s, s.pending!.correctWord);
    expect(s.phase).toBe('victory');
    expect(events.some((e) => e.type === 'victory')).toBe(true);
  });

  it('endTurn: enemy attacks, hand refreshes, energy resets', () => {
    const s = freshCombat();
    const events = endTurn(s, mulberry32(3));
    expect(s.playerHp).toBe(CONFIG.playerMaxHp - enemy.attack);
    expect(s.hand).toHaveLength(CONFIG.handSize);
    expect(s.energy).toBe(CONFIG.energyPerTurn);
    expect(events.some((e) => e.type === 'enemyAttack')).toBe(true);
  });

  it('reaching 0 player HP loses', () => {
    const s = freshCombat();
    s.playerHp = enemy.attack; // exactly lethal
    const events = endTurn(s, mulberry32(3));
    expect(s.phase).toBe('defeat');
    expect(events.some((e) => e.type === 'defeat')).toBe(true);
  });

  it('reshuffles discard into draw pile when draw pile runs dry', () => {
    const s = freshCombat();
    s.enemyHp = 999; // keep combat going long enough to cycle the 10-card deck
    // 10 cards, draw 5/turn + play 3/turn → draw pile is dry by turn 2's redraw
    for (let turn = 0; turn < 4; turn++) {
      while (s.energy > 0 && s.hand.length > 0) {
        const cardId = s.hand[0];
        playCard(s, deck, cardId, mulberry32(turn * 10 + s.energy));
        resolveChallenge(s, s.pending!.correctWord);
      }
      endTurn(s, mulberry32(turn));
    }
    // deck cycled at least once without throwing; hand refilled, state coherent
    expect(s.phase).toBe('awaitCard'); // 4 enemy hits of 4 dmg < 30 HP
    expect(s.hand).toHaveLength(CONFIG.handSize);
    expect(s.drawPile.length + s.hand.length + s.discard.length).toBe(10);
  });

  it('playCard with no energy throws', () => {
    const s = freshCombat();
    s.energy = 0;
    expect(() => playCard(s, deck, s.hand[0], mulberry32(1))).toThrow(/energy/i);
  });

  it('endTurn throws if a challenge is still pending', () => {
    const s = freshCombat();
    const cardId = s.hand[0];
    playCard(s, deck, cardId, mulberry32(2));
    // s.phase is now 'awaitChallenge' and s.pending is set
    expect(() => endTurn(s, mulberry32(3))).toThrow(/pending/i);
  });

  it('a fizzle on last HP loses', () => {
    const s = freshCombat();
    s.playerHp = CONFIG.fizzleSelfDamage; // exactly lethal on a fizzle
    const cardId = s.hand[0];
    playCard(s, deck, cardId, mulberry32(2));
    const wrong = s.pending!.options.find((o) => o !== s.pending!.correctWord)!;
    const events = resolveChallenge(s, wrong);
    expect(s.phase).toBe('defeat');
    expect(events.some((e) => e.type === 'defeat')).toBe(true);
  });

  it('reshuffles immediately at end of turn when all cards were in hand (StS-style)', () => {
    // With a deck no larger than the hand, endTurn discards the hand and the
    // redraw reshuffles those same cards — accepted Slay-the-Spire-style cycling.
    const fiveIds = tenIds.slice(0, 5);
    const { state: s } = startCombat({
      cardIds: fiveIds, levels: {}, flagged: new Set(), enemy,
      playerHp: CONFIG.playerMaxHp, rng: mulberry32(4),
    });
    expect(s.hand).toHaveLength(5);
    endTurn(s, mulberry32(5));
    expect(s.hand).toHaveLength(5); // same five cards, recycled
    expect([...s.hand].sort()).toEqual([...fiveIds].sort());
  });

  it('flagged cards draw with higher weight', () => {
    // statistical: flag one card, count how often it lands in opening hand
    const flaggedId = tenIds[9];
    let appearances = 0;
    const trials = 300;
    for (let seed = 0; seed < trials; seed++) {
      const { state } = startCombat({
        cardIds: tenIds,
        levels: {},
        flagged: new Set([flaggedId]),
        enemy,
        playerHp: 30,
        rng: mulberry32(seed),
      });
      if (state.hand.includes(flaggedId)) appearances++;
    }
    // unweighted baseline would be 50% (5 of 10); 3x weight should push well above
    expect(appearances / trials).toBeGreaterThan(0.6);
  });
});
