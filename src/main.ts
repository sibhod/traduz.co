import { Application } from 'pixi.js';
import { createViewport, VW } from './ui/layout';
import { makeCardView, CARD_W } from './ui/cardView';
import { loadDeck } from './content/deck';
import seedJson from './content/seed-deck.json';

(async () => {
  const app = new Application();
  await app.init({ background: 0x14101e, resizeTo: window, resolution: window.devicePixelRatio || 1, autoDensity: true });
  document.body.appendChild(app.canvas);
  const root = createViewport(app);

  // TEMP showcase (replaced in Task 9): one card at each mastery level
  const deck = loadDeck(seedJson);
  ([0, 1, 2] as const).forEach((level, i) => {
    const v = makeCardView(deck.byId('caber'), level);
    v.x = VW / 2 - CARD_W / 2 + (i - 1) * (CARD_W + 24);
    v.y = 500;
    root.addChild(v);
  });
})().catch(console.error);
