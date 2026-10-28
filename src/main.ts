import './ui/styles.css';
import { Game } from './core/Game.ts';

window.addEventListener('DOMContentLoaded', async () => {
  const canvasContainer = document.getElementById('canvas-container');
  if (!canvasContainer) {
    console.error('Canvas container element not found!');
    return;
  }

  const game = new Game(canvasContainer);
  try {
    await game.init();
  } catch (err) {
    console.error('Failed to initialize DinosDino:', err);
  }
});
