import { Container, type Application } from 'pixi.js';

export const VW = 720;
export const VH = 1280;

/**
 * Returns the root container for all scenes, fit-scaled into the window and
 * re-centered on resize. Everything in the game positions in 720×1280 coords.
 *
 * Lifecycle: intended to be called exactly once per app lifetime. The resize
 * listener added to `app.renderer` is never removed, so scene swaps must reuse
 * the returned root rather than calling `createViewport` again.
 */
export function createViewport(app: Application): Container {
  const root = new Container();
  app.stage.addChild(root);
  const fit = () => {
    const scale = Math.min(app.screen.width / VW, app.screen.height / VH);
    root.scale.set(scale);
    root.x = (app.screen.width - VW * scale) / 2;
    root.y = (app.screen.height - VH * scale) / 2;
  };
  fit();
  app.renderer.on('resize', fit);
  return root;
}
