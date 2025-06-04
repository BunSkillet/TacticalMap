import { animate } from './canvas.js';
import { setupEvents } from './events.js';
import { initSocket } from './socketHandlers.js';

window.addEventListener('DOMContentLoaded', () => {
  setupEvents();
  initSocket();
  animate();
});
