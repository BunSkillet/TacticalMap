import { state } from './state.js';
import { draw, loadMap } from './canvas.js';

function renderUserList(users) {
  const container = document.getElementById('user-list');
  if (!container) return;
  const ul = container.querySelector('ul');
  if (!ul) return;
  ul.innerHTML = '';
  users.forEach(u => {
    const li = document.createElement('li');
    const dot = document.createElement('div');
    dot.className = 'active-user';
    dot.style.backgroundColor = u.color || '#ff0000';
    const span = document.createElement('span');
    span.textContent = u.name || 'Anon';
    li.appendChild(dot);
    li.appendChild(span);
    ul.appendChild(li);
  });
}

const token = localStorage.getItem('authToken') || '';
const params = new URLSearchParams(window.location.search);
const room = params.get('room') || '';
let name = params.get('name') || '';
while (!name.trim()) {
  name = prompt('Enter your name:') || '';
  name = name.trim();
}
export const socket = io({ auth: { token }, query: { room, name } });

// Helper to request a color change from the server
export function requestColorChange(color) {
  socket.emit('changeColor', color);
}

export function initSocket() {
  socket.on('stateUpdate', (serverState) => {
    state.penPaths = serverState.drawings;
    state.pings = serverState.pings;
    state.placedObjects = serverState.objects;
    loadMap(serverState.currentMap);
    draw();
  });

  socket.on('userList', (users) => {
    state.activeUsers = users;
    renderUserList(users);
  });

  socket.on('draw', (data) => {
    state.penPaths.push(data);
    draw();
  });

  socket.on('ping', (data) => {
    state.pings.push(data);
    draw();
  });

  socket.on('placeObject', (data) => {
    state.placedObjects.push(data);
    draw();
  });

  socket.on('moveObjects', (updates) => {
    updates.forEach(u => {
      if (state.placedObjects[u.index]) {
        state.placedObjects[u.index].x = u.x;
        state.placedObjects[u.index].y = u.y;
      }
    });
    draw();
  });

  socket.on('removeObjects', (indices) => {
    indices.slice().sort((a,b) => b - a).forEach(i => {
      if (i >= 0 && i < state.placedObjects.length) {
        state.placedObjects.splice(i, 1);
      }
    });
    draw();
  });

  socket.on('editObject', (data) => {
    if (state.placedObjects[data.index]) {
      state.placedObjects[data.index].symbol = data.symbol;
      if (data.type) state.placedObjects[data.index].type = data.type;
      draw();
    }
  });

  socket.on('colorAssigned', (color) => {
    state.currentColor = color;
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    const swatch = document.querySelector(`[data-color="${color}"]`);
    if (swatch) swatch.classList.add('active');
    draw();
    if (window.updateCollapsedUI) window.updateCollapsedUI();
  });

  socket.on('colorUnavailable', (color) => {
    alert(`Color ${color} is already in use`);
  });

  socket.on('mapChanged', (mapName) => {
    state.placedObjects = [];
    state.penPaths = [];
    state.pings = [];
    loadMap(mapName);
    draw();
  });

  socket.on('mapCleared', () => {
    state.placedObjects = [];
    state.penPaths = [];
    state.pings = [];
    draw();
  });

  socket.on('userConnected', (u) => {
    if (u && u.name) console.log(`${u.name} joined`);
  });

  socket.on('userDisconnected', (u) => {
    if (u && u.name) console.log(`${u.name} left`);
  });

  socket.on('invalidRoom', () => {
    alert('Invalid room code');
    window.location.href = '/?invalidRoom=1';
  });
}
