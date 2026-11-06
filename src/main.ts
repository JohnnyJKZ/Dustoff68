import '@fontsource/stardos-stencil/400.css';
import './ui/styles.css';
import { Game } from './core/Game';

const boot = document.getElementById('boot');
const canvas = document.getElementById('view');
const ui = document.getElementById('ui');

if (!boot || !(canvas instanceof HTMLCanvasElement) || !ui) {
  throw new Error('Missing page nodes');
}

const game = new Game(canvas, ui);

game
  .init((msg) => {
    boot.textContent = msg;
  })
  .then(() => {
    boot.remove();
    game.start();
  })
  .catch((err: unknown) => {
    console.error(err);
    boot.textContent = err instanceof Error ? err.message : 'Failed to start';
  });
