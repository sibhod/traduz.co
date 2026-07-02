import { Container, Graphics, Text } from 'pixi.js';
import type { CardDef } from '../content/types';
import { damageFor } from '../engine/combat';

export const CARD_W = 128;
export const CARD_H = 176;

/** Deterministic sigil parameters from a card id — pure abstraction, no letter hints. */
function sigilFor(id: string): { color: number; sides: number } {
  let h = 0;
  for (const ch of id) h = (h * 31 + ch.codePointAt(0)!) >>> 0;
  const hue = h % 360;
  // crude HSL→RGB at fixed s/l for vivid distinct colors
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    return Math.round(255 * (0.55 - 0.35 * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  const color = (f(0) << 16) | (f(8) << 8) | f(4);
  return { color, sides: 3 + ((h >>> 9) % 4) }; // triangle..hexagon
}

function drawSigil(g: Graphics, id: string, cx: number, cy: number, r: number): void {
  const { color, sides } = sigilFor(id);
  const pts: number[] = [];
  for (let i = 0; i < sides; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / sides;
    pts.push(cx + r * Math.cos(a), cy + r * Math.sin(a));
  }
  g.poly(pts).fill(color).stroke({ width: 3, color: 0xffffff, alpha: 0.6 });
}

/** Render a card face for a mastery level: 0 = scene (full scaffolding),
 *  1 = icon, 2 = sigil (scaffolding gone — pure recall). */
export function makeCardView(card: CardDef, level: 0 | 1 | 2): Container {
  const c = new Container();
  const bg = new Graphics()
    .roundRect(0, 0, CARD_W, CARD_H, 12)
    .fill(0x2a2440)
    .stroke({ width: 3, color: [0x8a7f5c, 0xc0c0c0, 0xffd700][level] });
  c.addChild(bg);

  if (level === 2) {
    const g = new Graphics();
    drawSigil(g, card.id, CARD_W / 2, CARD_H / 2 - 10, 42);
    c.addChild(g);
  } else {
    const art = new Text({
      text: level === 0 ? card.scene : card.icon,
      style: { fontSize: level === 0 ? 36 : 64 },
    });
    art.anchor.set(0.5);
    art.x = CARD_W / 2;
    art.y = CARD_H / 2 - 10;
    // Wide emoji clusters (ZWJ families, flags) can exceed the card face — clamp.
    if (art.width > CARD_W - 12) art.scale.set((CARD_W - 12) / art.width);
    c.addChild(art);
  }

  const dmg = new Text({
    text: `⚔ ${damageFor(level)}`,
    style: { fontSize: 20, fill: 0xffffff, fontWeight: 'bold' },
  });
  dmg.anchor.set(0.5);
  dmg.x = CARD_W / 2;
  dmg.y = CARD_H - 22;
  c.addChild(dmg);
  return c;
}
