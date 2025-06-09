import { animate } from './canvas.js';
import { setupEvents } from './events.js';
import { initSocket } from './socketHandlers.js';

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    setupEvents();
    initSocket();
    animate();
  });
} else {
  setupEvents();
  initSocket();
  animate();
}
