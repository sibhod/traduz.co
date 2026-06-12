import { Container, Text, Ticker } from 'pixi.js';

type Ease = (t: number) => number;
export const easeOutCubic: Ease = (t) => 1 - Math.pow(1 - t, 3);

/** Minimal tween: animates numeric props on any object over ms using the shared ticker. */
export function tween<T extends Record<string, any>>(
  obj: T,
  to: Partial<Record<keyof T, number>>,
  ms: number,
  ease: Ease = easeOutCubic,
  onDone?: () => void,
): void {
  const from: Record<string, number> = {};
  for (const k of Object.keys(to)) from[k] = obj[k as keyof T] as number;
  let elapsed = 0;
  const tick = (ticker: Ticker) => {
    if ((obj as any).destroyed) { Ticker.shared.remove(tick); return; }
    elapsed += ticker.deltaMS;
    const t = Math.min(1, elapsed / ms);
    const e = ease(t);
    for (const k of Object.keys(to)) {
      (obj as any)[k] = from[k] + ((to as any)[k] - from[k]) * e;
    }
    if (t >= 1) {
      Ticker.shared.remove(tick);
      onDone?.();
    }
  };
  Ticker.shared.add(tick);
}

/** Screen shake: jitters a container for durationMs, decaying, then recenters. */
export function shake(target: Container, intensity = 12, durationMs = 250): void {
  let elapsed = 0;
  const baseX = target.x;
  const baseY = target.y;
  const tick = (ticker: Ticker) => {
    if (target.destroyed) { Ticker.shared.remove(tick); return; }
    elapsed += ticker.deltaMS;
    const decay = 1 - elapsed / durationMs;
    if (decay <= 0) {
      target.x = baseX;
      target.y = baseY;
      Ticker.shared.remove(tick);
      return;
    }
    target.x = baseX + (Math.random() * 2 - 1) * intensity * decay;
    target.y = baseY + (Math.random() * 2 - 1) * intensity * decay;
  };
  Ticker.shared.add(tick);
}

/** Floating damage/heal number that drifts up and fades. */
export function floatNumber(parent: Container, x: number, y: number, text: string, color: number): void {
  const t = new Text({
    text,
    style: { fontSize: 44, fill: color, fontWeight: 'bold', stroke: { color: 0x000000, width: 5 } },
  });
  t.anchor.set(0.5);
  t.x = x;
  t.y = y;
  parent.addChild(t);
  tween(t, { y: y - 90, alpha: 0 }, 700, easeOutCubic, () => t.destroy());
}
