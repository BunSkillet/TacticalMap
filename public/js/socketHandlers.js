import { state } from './state.js';
import { draw, loadMap } from './canvas.js';

const token = localStorage.getItem('authToken') || '';
export const socket = io({ auth: { token } });

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

  socket.on('colorAssigned', (color) => {
    state.currentColor = color;
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));
    const swatch = document.querySelector(`[data-color="${color}"]`);
    if (swatch) swatch.classList.add('active');
    draw();
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
}
