import { animate } from './canvas.js';
import { setupEvents } from './events.js';
import { initSocket } from './socketHandlers.js';

function startBoard(name, room) {
  setupEvents();
  initSocket(name, room);
  animate();
}

function start() {
  const joinBtn = document.getElementById('join-button');
  if (joinBtn) {
    joinBtn.addEventListener('click', () => {
      const name = document.getElementById('name-input').value.trim();
      if (!name) return alert('Please enter a name');
      const room = document.getElementById('room-input').value.trim();
      startBoard(name, room);
      const joinScreen = document.getElementById('join-screen');
      if (joinScreen) joinScreen.style.display = 'none';
    });
  } else {
    // Fallback if join screen is missing
    startBoard('', '');
  }
}

if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', start);
} else {
  start();
}
