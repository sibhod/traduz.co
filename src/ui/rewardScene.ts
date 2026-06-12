import { Container, Graphics, Text } from 'pixi.js';
import type { Deck } from '../content/deck';
import { makeCardView, CARD_W, CARD_H } from './cardView';
import { CONFIG } from '../engine/config';
import { VW } from './layout';

/** Between-fight reward: pick one reserve card to add to the deck, or heal. */
export function makeRewardScene(
  deck: Deck,
  optionIds: string[],
  onChoose: (choice: string | 'heal') => void,
): Container {
  const c = new Container();

  const title = new Text({
    text: '¡Victoria! Elige tu recompensa',
    style: { fontSize: 34, fill: 0xffffff, fontWeight: 'bold' },
  });
  title.anchor.set(0.5);
  title.x = VW / 2;
  title.y = 220;
  c.addChild(title);

  const totalW = optionIds.length * CARD_W + Math.max(0, optionIds.length - 1) * 28;
  optionIds.forEach((id, i) => {
    const v = makeCardView(deck.byId(id), 0); // new words always start at scene level
    v.x = VW / 2 - totalW / 2 + i * (CARD_W + 28);
    v.y = 360;
    v.eventMode = 'static';
    v.cursor = 'pointer';
    v.on('pointertap', () => onChoose(id));
    c.addChild(v);
    const word = new Text({ text: deck.byId(id).word, style: { fontSize: 20, fill: 0xccc4e0 } });
    word.anchor.set(0.5);
    word.x = v.x + CARD_W / 2;
    word.y = v.y + CARD_H + 24; // reward screen shows the word — a learning moment, not a test
    c.addChild(word);
  });

  const heal = new Container();
  heal.addChild(
    new Graphics().roundRect(0, 0, 300, 64, 12).fill(0x2d5a3a).stroke({ width: 2, color: 0x55aa77 }),
  );
  const healLabel = new Text({
    text: `🩹 Curarse +${CONFIG.rewardHeal}`,
    style: { fontSize: 24, fill: 0xffffff },
  });
  healLabel.anchor.set(0.5);
  healLabel.x = 150;
  healLabel.y = 32;
  heal.addChild(healLabel);
  heal.x = VW / 2 - 150;
  heal.y = 680;
  heal.eventMode = 'static';
  heal.cursor = 'pointer';
  heal.on('pointertap', () => onChoose('heal'));
  c.addChild(heal);

  return c;
}
