import { Application } from 'pixi.js';
import { createViewport } from './ui/layout';
import { CombatScene } from './ui/combatScene';
import { loadDeck } from './content/deck';
import seedJson from './content/seed-deck.json';
import { startCombat } from './engine/combat';
import { startRun } from './engine/run';
import { CONFIG } from './engine/config';
import { mulberry32 } from './engine/rng';
import { loadMastery } from './progress/store';
import { levelOf, masteryFor } from './progress/mastery';

(async () => {
  const app = new Application();
  await app.init({ background: 0x14101e, resizeTo: window, resolution: window.devicePixelRatio || 1, autoDensity: true });
  document.body.appendChild(app.canvas);
  const root = createViewport(app);

  const deck = loadDeck(seedJson);
  const mastery = loadMastery(window.localStorage);
  const rng = mulberry32(Math.floor(performance.now())); // seed per session

  // TEMP: single fight only — full run flow lands in Task 11
  const run = startRun(deck, rng);
  const levels = Object.fromEntries(
    run.deckCardIds.map((id) => [id, levelOf(masteryFor(mastery, id))]),
  );
  const { state } = startCombat({
    cardIds: run.deckCardIds,
    levels,
    flagged: new Set(),
    enemy: CONFIG.fights[0],
    playerHp: run.playerHp,
    rng,
  });
  const scene = new CombatScene(state, deck, rng, {
    onEvents: (events) => console.log(events),
    onCombatEnd: (victory) => alert(victory ? '¡Victoria!' : 'Derrota...'),
  }, (cardId) => levelOf(masteryFor(mastery, cardId)));
  root.addChild(scene.view);
})().catch(console.error);
