import { state } from './state.js';
import { draw, loadMap } from './canvas.js';

export let socket;

// Helper to request a color change from the server
export function requestColorChange(color) {
  if (socket) socket.emit('changeColor', color);
}

function attachHandlers() {
  socket.on('stateUpdate', (serverState) => {
    state.penPaths = serverState.drawings;
    state.pings = serverState.pings;
    state.placedObjects = serverState.objects;
    loadMap(serverState.currentMap);
    draw();
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

  socket.on('userConnected', (data) => {
    console.log(`${data.name || 'Unknown'} joined`);
  });

  socket.on('userDisconnected', (data) => {
    console.log(`${data.name || 'Unknown'} left`);
  });
}

export function initSocket(name, room) {
  const token = localStorage.getItem('authToken') || '';
  socket = io({ auth: { token, name, room } });
  attachHandlers();
}
