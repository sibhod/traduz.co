import { Application, Container } from 'pixi.js';
import { createViewport } from './ui/layout';
import { CombatScene } from './ui/combatScene';
import { makeRewardScene } from './ui/rewardScene';
import { makeEndScene } from './ui/endScene';
import { shake, floatNumber } from './ui/juice';
import { sfx, speakSpanish } from './ui/sfx';
import { loadDeck } from './content/deck';
import seedJson from './content/seed-deck.json';
import { startCombat, type CombatEvent, type CombatState } from './engine/combat';
import { startRun, advanceAfterVictory, rewardOptions, applyReward, markDefeat, type RunState } from './engine/run';
import { CONFIG } from './engine/config';
import { mulberry32, type Rng } from './engine/rng';
import { loadMastery, saveMastery } from './progress/store';
import { levelOf, masteryFor, recordResult, type MasteryMap } from './progress/mastery';

// Dev/playtest handle: lets automated E2E checks and tuning sessions inspect live state.
const debugHandle: { run?: RunState; combat?: CombatState } = {};
(window as unknown as { __traduzco: typeof debugHandle }).__traduzco = debugHandle;

(async () => {
  const app = new Application();
  await app.init({ background: 0x14101e, resizeTo: window, resolution: window.devicePixelRatio || 1, autoDensity: true });
  document.body.appendChild(app.canvas);
  const root = createViewport(app);

  const deck = loadDeck(seedJson);
  const mastery: MasteryMap = loadMastery(window.localStorage);
  const rng: Rng = mulberry32(Math.floor(performance.now()));

  let current: Container | null = null;
  const show = (view: Container) => {
    current?.destroy({ children: true }); // CombatScene.view included — same teardown
    current = view;
    root.addChild(view);
  };

  const levelFor = (cardId: string): 0 | 1 | 2 => levelOf(masteryFor(mastery, cardId));

  function startFight(run: RunState): void {
    const enemy = CONFIG.fights[run.fightIndex];
    const levels = Object.fromEntries(run.deckCardIds.map((id) => [id, levelFor(id)]));
    const flagged = new Set(run.deckCardIds.filter((id) => masteryFor(mastery, id).flagged));
    const { state, events: initialEvents } = startCombat({
      cardIds: run.deckCardIds,
      levels,
      flagged,
      enemy,
      playerHp: run.playerHp,
      rng,
    });
    debugHandle.combat = state;
    const callbacks = {
      onEvents: (events: CombatEvent[]) => handleEvents(events),
      onCombatEnd: (victory: boolean, playerHp: number) => {
        if (victory) {
          advanceAfterVictory(run, playerHp);
          if (run.phase === 'complete') {
            show(makeEndScene(true, newRun));
          } else {
            show(makeRewardScene(deck, rewardOptions(run, rng), (choice) => {
              applyReward(run, choice);
              startFight(run);
            }));
          }
        } else {
          markDefeat(run);
          show(makeEndScene(false, newRun));
        }
      },
    };
    const scene = new CombatScene(state, deck, rng, callbacks, levelFor);
    show(scene.view);
    callbacks.onEvents(initialEvents);

    function handleEvents(events: CombatEvent[]): void {
      for (const e of events) {
        switch (e.type) {
          case 'challengePassed':
            recordResult(mastery, e.cardId, true);
            saveMastery(window.localStorage, mastery);
            sfx.hit();
            speakSpanish(deck.byId(e.cardId).word);
            shake(scene.shakeLayer, 14, 280);
            floatNumber(scene.view, 360, 320, `-${e.damage}`, 0xffdd44);
            break;
          case 'challengeFailed':
            recordResult(mastery, e.cardId, false);
            saveMastery(window.localStorage, mastery);
            sfx.fizzle();
            speakSpanish(e.correctWord);
            floatNumber(scene.view, 360, 320, e.correctWord, 0xff6666);
            break;
          case 'enemyAttack':
            sfx.enemyAttack();
            shake(scene.shakeLayer, 10, 220);
            floatNumber(scene.view, 170, 1000, `-${e.amount}`, 0xff4444);
            break;
          case 'cardPlayed':
            break; // card raise is rendered by the scene; no juice needed
          case 'cardsDrawn':
            sfx.draw();
            break;
          case 'victory':
            sfx.victory();
            break;
          case 'defeat':
            sfx.defeat();
            break;
          default: {
            const exhaustive: never = e;
            void exhaustive;
          }
        }
      }
    }
  }

  function newRun(): void {
    const run = startRun(deck, rng);
    debugHandle.run = run;
    startFight(run);
  }

  newRun();
})().catch(console.error);
