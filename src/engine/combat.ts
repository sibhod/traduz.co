import type { Deck } from '../content/deck';
import type { TapChallenge } from '../challenge/types';
import { buildTapChallenge } from '../challenge/tap-match';
import type { Rng } from './rng';
import { shuffle, weightedPick } from './rng';
import { CONFIG, type EnemyDef } from './config';

export type CombatPhase = 'awaitCard' | 'awaitChallenge' | 'victory' | 'defeat';

export interface CombatState {
  phase: CombatPhase;
  playerHp: number;
  enemyHp: number;
  enemy: EnemyDef;
  energy: number;
  drawPile: string[];
  hand: string[];
  discard: string[];
  pending: TapChallenge | null;
  /** Mastery level snapshot taken at combat start (levels change between fights). */
  levels: Record<string, number>;
  /** Failed-recall cards — drawn with CONFIG.flaggedDrawWeight. Mutated during combat. */
  flagged: Set<string>;
}

export type CombatEvent =
  | { type: 'cardsDrawn'; cardIds: string[] }
  | { type: 'cardPlayed'; cardId: string }
  | { type: 'challengePassed'; cardId: string; damage: number }
  | { type: 'challengeFailed'; cardId: string; correctWord: string }
  | { type: 'enemyAttack'; amount: number }
  | { type: 'victory' }
  | { type: 'defeat' };

export interface StartCombatArgs {
  cardIds: string[];
  levels: Record<string, number>;
  flagged: Set<string>;
  enemy: EnemyDef;
  playerHp: number;
  rng: Rng;
}

export function damageFor(level: number): number {
  return CONFIG.baseDamage + CONFIG.damagePerLevel * level;
}

function drawOne(s: CombatState, rng: Rng): string | null {
  if (s.drawPile.length === 0) {
    if (s.discard.length === 0) return null;
    s.drawPile = shuffle(s.discard, rng);
    s.discard = [];
  }
  const id = weightedPick(s.drawPile, (c) => (s.flagged.has(c) ? CONFIG.flaggedDrawWeight : 1), rng);
  s.drawPile.splice(s.drawPile.indexOf(id), 1);
  return id;
}

function drawToHandSize(s: CombatState, rng: Rng): string[] {
  const drawn: string[] = [];
  while (s.hand.length < CONFIG.handSize) {
    const id = drawOne(s, rng);
    if (id === null) break; // deck smaller than hand — fine
    s.hand.push(id);
    drawn.push(id);
  }
  return drawn;
}

export function startCombat(args: StartCombatArgs): { state: CombatState; events: CombatEvent[] } {
  const state: CombatState = {
    phase: 'awaitCard',
    playerHp: args.playerHp,
    enemyHp: args.enemy.hp,
    enemy: args.enemy,
    energy: CONFIG.energyPerTurn,
    drawPile: shuffle(args.cardIds, args.rng),
    hand: [],
    discard: [],
    pending: null,
    levels: args.levels,
    flagged: args.flagged,
  };
  const drawn = drawToHandSize(state, args.rng);
  return { state, events: [{ type: 'cardsDrawn', cardIds: drawn }] };
}

export function playCard(s: CombatState, deck: Deck, cardId: string, rng: Rng): CombatEvent[] {
  if (s.phase !== 'awaitCard') throw new Error(`playCard: wrong phase '${s.phase}'`);
  if (s.energy <= 0) throw new Error('playCard: no energy left');
  if (!s.hand.includes(cardId)) throw new Error(`playCard: '${cardId}' not in hand`);
  s.pending = buildTapChallenge(deck, cardId, rng);
  s.phase = 'awaitChallenge';
  return [{ type: 'cardPlayed', cardId }];
}

export function resolveChallenge(s: CombatState, chosenWord: string): CombatEvent[] {
  if (s.phase !== 'awaitChallenge' || !s.pending) {
    throw new Error(`resolveChallenge: wrong phase '${s.phase}'`);
  }
  const { cardId, correctWord } = s.pending;
  const events: CombatEvent[] = [];

  s.hand.splice(s.hand.indexOf(cardId), 1);
  s.discard.push(cardId);
  s.energy -= 1;
  s.pending = null;

  if (chosenWord === correctWord) {
    const dmg = damageFor(s.levels[cardId] ?? 0);
    s.enemyHp = Math.max(0, s.enemyHp - dmg);
    events.push({ type: 'challengePassed', cardId, damage: dmg });
  } else {
    s.playerHp = Math.max(0, s.playerHp - CONFIG.fizzleSelfDamage);
    s.flagged.add(cardId);
    events.push({ type: 'challengeFailed', cardId, correctWord });
  }

  if (s.enemyHp <= 0) {
    s.phase = 'victory';
    events.push({ type: 'victory' });
  } else if (s.playerHp <= 0) {
    s.phase = 'defeat';
    events.push({ type: 'defeat' });
  } else {
    s.phase = 'awaitCard';
  }
  return events;
}

export function endTurn(s: CombatState, rng: Rng): CombatEvent[] {
  if (s.phase !== 'awaitCard') throw new Error(`endTurn: wrong phase '${s.phase}'`);
  const events: CombatEvent[] = [];

  s.playerHp = Math.max(0, s.playerHp - s.enemy.attack);
  events.push({ type: 'enemyAttack', amount: s.enemy.attack });

  if (s.playerHp <= 0) {
    s.phase = 'defeat';
    events.push({ type: 'defeat' });
    return events;
  }

  s.discard.push(...s.hand);
  s.hand = [];
  const drawn = drawToHandSize(s, rng);
  s.energy = CONFIG.energyPerTurn;
  events.push({ type: 'cardsDrawn', cardIds: drawn });
  return events;
}
