import { Container, Graphics, Text } from 'pixi.js';
import { VW, VH } from './layout';

export function makeEndScene(victory: boolean, onNewRun: () => void): Container {
  const c = new Container();

  const title = new Text({
    text: victory ? '🏆 ¡Corrida completa!' : '💀 Derrota…',
    style: { fontSize: 52, fill: victory ? 0xffd700 : 0xcc4455, fontWeight: 'bold' },
  });
  title.anchor.set(0.5);
  title.x = VW / 2;
  title.y = VH / 2 - 120;
  c.addChild(title);

  const sub = new Text({
    text: victory ? 'Tus palabras se hacen más fuertes.' : 'Las palabras falladas volverán…',
    style: { fontSize: 24, fill: 0xccc4e0 },
  });
  sub.anchor.set(0.5);
  sub.x = VW / 2;
  sub.y = VH / 2 - 50;
  c.addChild(sub);

  const btn = new Container();
  btn.addChild(
    new Graphics().roundRect(0, 0, 280, 70, 14).fill(0x4a3f6b).stroke({ width: 3, color: 0x9988cc }),
  );
  const label = new Text({ text: 'Nueva corrida', style: { fontSize: 28, fill: 0xffffff } });
  label.anchor.set(0.5);
  label.x = 140;
  label.y = 35;
  btn.addChild(label);
  btn.x = VW / 2 - 140;
  btn.y = VH / 2 + 40;
  btn.eventMode = 'static';
  btn.cursor = 'pointer';
  btn.on('pointertap', onNewRun);
  c.addChild(btn);

  return c;
}
