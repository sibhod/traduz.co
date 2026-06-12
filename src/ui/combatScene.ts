import { Container, Graphics, Text } from 'pixi.js';
import type { Deck } from '../content/deck';
import type { CombatState, CombatEvent } from '../engine/combat';
import { playCard, resolveChallenge, endTurn } from '../engine/combat';
import type { Rng } from '../engine/rng';
import { CONFIG } from '../engine/config';
import { makeCardView, CARD_W, CARD_H } from './cardView';
import { VW, VH } from './layout';

export interface CombatCallbacks {
  /** Fired for every engine event so juice/sfx/mastery can react (Tasks 10-11). */
  onEvents(events: CombatEvent[]): void;
  onCombatEnd(victory: boolean, playerHp: number): void;
}

const ENEMY_Y = 320;
const BUBBLE_W = 280;
const BUBBLE_H = 64;
const HAND_Y = VH - CARD_H - 40;

export class CombatScene {
  readonly view = new Container();
  /** Exposed so juice can shake it (Task 10). */
  readonly shakeLayer = new Container();

  private bars = new Container();
  private hud = new Container();
  private enemyArt!: Text;
  private bubbleLayer = new Container();
  private handLayer = new Container();
  private levelFor: (cardId: string) => 0 | 1 | 2;
  private dispatching = false;

  constructor(
    private state: CombatState,
    private deck: Deck,
    private rng: Rng,
    private cb: CombatCallbacks,
    levelFor: (cardId: string) => 0 | 1 | 2,
  ) {
    this.levelFor = levelFor;
    this.view.addChild(this.shakeLayer);
    this.shakeLayer.addChild(this.hud, this.bubbleLayer, this.handLayer);
    this.hud.addChild(this.bars);
    this.buildEnemy();
    this.buildEndTurnButton();
    this.render();
  }

  private buildEnemy(): void {
    this.enemyArt = new Text({ text: this.state.enemy.emoji, style: { fontSize: 160 } });
    this.enemyArt.anchor.set(0.5);
    this.enemyArt.x = VW / 2;
    this.enemyArt.y = ENEMY_Y;
    this.hud.addChild(this.enemyArt);

    const name = new Text({
      text: this.state.enemy.name,
      style: { fontSize: 28, fill: 0xddddee, fontWeight: 'bold' },
    });
    name.anchor.set(0.5);
    name.x = VW / 2;
    name.y = ENEMY_Y - 130;
    this.hud.addChild(name);
  }

  private buildEndTurnButton(): void {
    const btn = new Container();
    btn.addChild(
      new Graphics().roundRect(0, 0, 180, 56, 10).fill(0x4a3f6b).stroke({ width: 2, color: 0x9988cc }),
    );
    const label = new Text({ text: 'Fin del turno', style: { fontSize: 22, fill: 0xffffff } });
    label.anchor.set(0.5);
    label.x = 90;
    label.y = 28;
    btn.addChild(label);
    btn.x = VW - 200;
    btn.y = HAND_Y - 80;
    btn.eventMode = 'static';
    btn.cursor = 'pointer';
    btn.on('pointertap', () => {
      if (this.state.phase !== 'awaitCard') return;
      this.dispatch(endTurn(this.state, this.rng));
    });
    this.hud.addChild(btn);
  }

  private dispatch(events: CombatEvent[]): void {
    if (this.dispatching) return;
    this.dispatching = true;
    try {
      this.cb.onEvents(events);
      const terminal = events.find((e) => e.type === 'victory' || e.type === 'defeat');
      if (terminal) {
        this.cb.onCombatEnd(terminal.type === 'victory', this.state.playerHp);
        return; // scene is about to be torn down — skip the dead render
      }
      this.render();
    } finally {
      this.dispatching = false;
    }
  }

  /** Full redraw of dynamic parts. Spartan but correct; tween polish is Task 10. */
  private render(): void {
    this.renderBars();
    this.renderBubbles();
    this.renderHand();
  }

  private renderBars(): void {
    this.bars.removeChildren().forEach((c) => c.destroy({ children: true }));

    const bar = (x: number, y: number, w: number, frac: number, color: number, text: string) => {
      const g = new Graphics()
        .roundRect(x, y, w, 26, 6).fill(0x221c33)
        .roundRect(x, y, Math.max(0, w * frac), 26, 6).fill(color);
      this.bars.addChild(g);
      const t = new Text({ text, style: { fontSize: 18, fill: 0xffffff, fontWeight: 'bold' } });
      t.anchor.set(0.5);
      t.x = x + w / 2;
      t.y = y + 13;
      this.bars.addChild(t);
    };
    bar(VW / 2 - 150, ENEMY_Y + 110, 300, this.state.enemyHp / this.state.enemy.hp, 0xcc3344,
      `${this.state.enemyHp}/${this.state.enemy.hp}`);
    bar(40, HAND_Y - 80, 260, this.state.playerHp / CONFIG.playerMaxHp, 0x33aa55,
      `❤ ${this.state.playerHp}/${CONFIG.playerMaxHp}`);

    const pips = new Text({
      text: '⚡'.repeat(this.state.energy) + '·'.repeat(CONFIG.energyPerTurn - this.state.energy),
      style: { fontSize: 30, fill: 0xffdd44 },
    });
    pips.x = 40;
    pips.y = HAND_Y - 130;
    this.bars.addChild(pips);
  }

  private renderBubbles(): void {
    this.bubbleLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    const pending = this.state.pending;
    if (!pending) return;
    // 2×2 thought-bubble grid around the enemy
    pending.options.forEach((word, i) => {
      const bub = new Container();
      bub.addChild(
        new Graphics()
          .roundRect(0, 0, BUBBLE_W, BUBBLE_H, 28)
          .fill(0xf4f0e8)
          .stroke({ width: 3, color: 0xbbb29e }),
      );
      const t = new Text({ text: word, style: { fontSize: 26, fill: 0x221c33, fontWeight: 'bold', wordWrap: true, wordWrapWidth: BUBBLE_W - 16, align: 'center' } });
      t.anchor.set(0.5);
      t.x = BUBBLE_W / 2;
      t.y = BUBBLE_H / 2;
      bub.addChild(t);
      bub.x = i % 2 === 0 ? VW / 2 - BUBBLE_W - 20 : VW / 2 + 20;
      bub.y = ENEMY_Y + 170 + Math.floor(i / 2) * (BUBBLE_H + 18);
      bub.eventMode = 'static';
      bub.cursor = 'pointer';
      bub.on('pointertap', () => {
        if (this.state.phase !== 'awaitChallenge') return;
        this.dispatch(resolveChallenge(this.state, word));
      });
      this.bubbleLayer.addChild(bub);
    });
  }

  private renderHand(): void {
    this.handLayer.removeChildren().forEach((c) => c.destroy({ children: true }));
    const n = this.state.hand.length;
    const totalW = n * CARD_W + Math.max(0, n - 1) * 12;
    this.state.hand.forEach((cardId, i) => {
      const v = makeCardView(this.deck.byId(cardId), this.levelFor(cardId));
      v.x = VW / 2 - totalW / 2 + i * (CARD_W + 12);
      v.y = HAND_Y;
      const playable = this.state.phase === 'awaitCard' && this.state.energy > 0;
      v.alpha = playable ? 1 : 0.5;
      if (playable) {
        v.eventMode = 'static';
        v.cursor = 'pointer';
        v.on('pointertap', () => {
          if (this.state.phase !== 'awaitCard' || this.state.energy <= 0) return;
          this.dispatch(playCard(this.state, this.deck, cardId, this.rng));
        });
      }
      // highlight the card awaiting its challenge
      if (this.state.pending?.cardId === cardId) v.y -= 24;
      this.handLayer.addChild(v);
    });
  }

  destroy(): void {
    this.view.destroy({ children: true });
  }
}
