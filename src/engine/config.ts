/** All tuning numbers live here. Every value is a starting guess to playtest. */
export const CONFIG = {
  playerMaxHp: 30,
  handSize: 5,
  energyPerTurn: 3,
  baseDamage: 4,
  damagePerLevel: 2, // L0=4, L1=6, L2=8
  fizzleSelfDamage: 2, // the counter-hit on a failed recall
  flaggedDrawWeight: 3, // flagged words 3x more likely to be drawn
  rewardHeal: 5,
  rewardOfferCount: 3, // reserve cards offered per reward screen
  startingDeckSize: 10, // remaining seed cards form the reward reserve
  fights: [
    { name: 'Duendecillo', emoji: '👹', hp: 18, attack: 4 },
    { name: 'Lechuza', emoji: '🦉', hp: 24, attack: 5 },
    { name: 'La Catrina', emoji: '💀', hp: 30, attack: 6 },
  ],
} as const;

export type EnemyDef = (typeof CONFIG.fights)[number];
