import { state } from './state.js';
import { draw, loadMap } from './canvas.js';

export const socket = io();

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

  socket.on('mapChanged', (mapName) => {
    state.placedObjects = [];
    state.penPaths = [];
    state.pings = [];
    loadMap(mapName);
    draw();
  });
}
