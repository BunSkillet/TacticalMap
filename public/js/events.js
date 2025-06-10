import { state, resetState } from './state.js';
import { resizeCanvas, centerMap, draw, loadMap, updateCursor } from './canvas.js';
import { socket, requestColorChange } from './socketHandlers.js';

function handleMouseDown(e) {
  const rect = state.canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - state.offsetX) / state.scale;
  const y = (e.clientY - rect.top - state.offsetY) / state.scale;

  if (e.button === 0 && (e.ctrlKey || state.currentTool === 'pan')) {
    state.isDragging = true;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    state.canvas.style.cursor = 'grabbing';
    return;
  }

  if (state.currentTool === 'select' && e.button === 0) {
    state.selectionRect = { startX: x, startY: y, endX: x, endY: y };
    const clickedIndex = state.placedObjects.findIndex(obj => {
      const dx = x - obj.x;
      const dy = y - obj.y;
      return Math.sqrt(dx * dx + dy * dy) < 20 / state.scale;
    });
    if (clickedIndex !== -1 && !state.selectedObjectIndices.includes(clickedIndex)) {
      state.selectedObjectIndices.push(clickedIndex);
    }
    draw();
    return;
  }

  if (state.currentTool === 'pen' && state.currentColor && e.button === 0) {
    state.isDrawing = true;
    state.isLiveDrawing = true;
    state.penPath = [{ x, y }];
    return;
  }

  if (state.currentTool === 'ping' && e.button === 0) {
    const ping = { x, y, start: Date.now(), ripples: 5, color: state.currentColor || '#ff0000', solid: true };
    state.pings.push(ping);
    socket.emit('ping', ping);
    draw();
    return;
  }
}

function handleMouseUp(e) {
  if (state.currentTool === 'select' && state.selectionRect) {
    const x1 = Math.min(state.selectionRect.startX, state.selectionRect.endX);
    const x2 = Math.max(state.selectionRect.startX, state.selectionRect.endX);
    const y1 = Math.min(state.selectionRect.startY, state.selectionRect.endY);
    const y2 = Math.max(state.selectionRect.startY, state.selectionRect.endY);

    state.selectedObjectIndices = state.placedObjects
      .map((obj, index) => ({ obj, index }))
      .filter(({ obj }) => obj.x >= x1 && obj.x <= x2 && obj.y >= y1 && obj.y <= y2)
      .map(({ index }) => index);

    state.selectionRect = null;
    draw();
    return;
  }

  if (state.isDrawing && state.currentTool === 'pen') {
    state.isDrawing = false;
    state.isLiveDrawing = false;
    if (state.penPath.length > 1 && state.currentColor) {
      const data = { path: state.penPath, color: state.currentColor, timestamp: Date.now() };
      socket.emit('draw', data);
      state.penPaths.push(data);
    }
    state.penPath = [];
    draw();
    return;
  }

  if (e.button === 0) {
    state.isDragging = false;
    updateCursor();
  }
}

function handleMouseMove(e) {
  const rect = state.canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - state.offsetX) / state.scale;
  const y = (e.clientY - rect.top - state.offsetY) / state.scale;

  if (state.selectedObjectIndices.length > 0 && e.buttons === 1) {
    state.selectedObjectIndices.forEach(i => {
      state.placedObjects[i].x += e.movementX / state.scale;
      state.placedObjects[i].y += e.movementY / state.scale;
    });
    draw();
    return;
  }

  if (state.currentTool === 'select' && state.selectionRect && e.buttons === 1) {
    state.selectionRect.endX = x;
    state.selectionRect.endY = y;
    draw();
    return;
  }

  if (state.isDrawing && state.currentTool === 'pen' && e.buttons === 1) {
    state.penPath.push({ x, y });
    draw();
    return;
  }

  if (state.isDragging) {
    const dx = e.clientX - state.lastX;
    const dy = e.clientY - state.lastY;
    state.offsetX += dx;
    state.offsetY += dy;
    state.lastX = e.clientX;
    state.lastY = e.clientY;
    draw();
    return;
  }

  updateCursor();
}

function handleWheel(e) {
  e.preventDefault();
  const rect = state.canvas.getBoundingClientRect();
  const mouseX = (e.clientX - rect.left - state.offsetX) / state.scale;
  const mouseY = (e.clientY - rect.top - state.offsetY) / state.scale;
  const delta = -e.deltaY * 0.001;
  const zoom = Math.exp(delta);
  const oldScale = state.scale;
  state.scale *= zoom;
  state.offsetX -= mouseX * (zoom - 1) * oldScale;
  state.offsetY -= mouseY * (zoom - 1) * oldScale;
  draw();
}


function placeDraggedObject(e) {
  if (!state.draggedSymbol) return;
  const rect = state.canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - state.offsetX) / state.scale;
  const y = (e.clientY - rect.top - state.offsetY) / state.scale;
  const data = { symbol: state.draggedSymbol, x, y };
  state.placedObjects.push(data);
  socket.emit('placeObject', data);
  state.draggedSymbol = null;
  draw();
}

function setupContextMenu() {
  const customMenu = document.createElement('div');
  customMenu.id = 'custom-context-menu';
  customMenu.style.position = 'absolute';
  customMenu.style.display = 'none';
  customMenu.style.backgroundColor = '#333';
  customMenu.style.color = '#fff';
  customMenu.style.padding = '10px';
  customMenu.style.borderRadius = '5px';
  customMenu.style.boxShadow = '0 2px 5px rgba(0, 0, 0, 0.5)';
  customMenu.innerHTML = `
    <button id="menu-select-tool" style="display: block; margin-bottom: 5px;">Select Tool</button>
    <button id="menu-pan-tool" style="display: block; margin-bottom: 5px;">Pan Tool</button>
    <button id="menu-pen-tool" style="display: block;">Pen Tool</button>
  `;
  document.body.appendChild(customMenu);

  document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
  });

  state.canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    const menuWidth = customMenu.offsetWidth;
    const menuHeight = customMenu.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    let menuX = e.pageX;
    let menuY = e.pageY;
    if (menuX + menuWidth > viewportWidth) menuX = viewportWidth - menuWidth - 10;
    if (menuY + menuHeight > viewportHeight) menuY = viewportHeight - menuHeight - 10;
    customMenu.style.left = `${menuX}px`;
    customMenu.style.top = `${menuY}px`;
    customMenu.style.display = 'block';
  });

  document.addEventListener('click', (e) => {
    if (!customMenu.contains(e.target)) {
      customMenu.style.display = 'none';
    }
  });

  document.getElementById('menu-select-tool').addEventListener('click', () => {
    document.querySelectorAll('.tool-button').forEach(b => b.classList.remove('active'));
    const selectToolButton = document.querySelector('[data-tool="select"]');
    if (selectToolButton) selectToolButton.classList.add('active');
    state.currentTool = 'select';
    updateCursor();
    customMenu.style.display = 'none';
  });

  document.getElementById('menu-pan-tool').addEventListener('click', () => {
    document.querySelectorAll('.tool-button').forEach(b => b.classList.remove('active'));
    const panToolButton = document.querySelector('[data-tool="pan"]');
    if (panToolButton) panToolButton.classList.add('active');
    state.currentTool = 'pan';
    updateCursor();
    customMenu.style.display = 'none';
  });

  document.getElementById('menu-pen-tool').addEventListener('click', () => {
    document.querySelectorAll('.tool-button').forEach(b => b.classList.remove('active'));
    const penToolButton = document.querySelector('[data-tool="pen"]');
    if (penToolButton) penToolButton.classList.add('active');
    state.currentTool = 'pen';
    updateCursor();
    customMenu.style.display = 'none';
  });
}

export function setupEvents() {
  window.addEventListener('resize', resizeCanvas);

  window.addEventListener('load', () => {
    resizeCanvas();
    loadMap(state.mapSelect.value);
    const redSwatch = document.querySelector('[data-color="#ff0000"]');
    if (redSwatch) {
      redSwatch.classList.add('active');
      state.currentColor = '#ff0000';
    }
    const penTool = document.querySelector('[data-tool="pen"]');
    if (penTool) {
      penTool.classList.add('active');
      state.currentTool = 'pen';
    }
    updateCursor();
    draw();
  });

  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedObjectIndices.length > 0) {
      e.preventDefault();
      state.selectedObjectIndices.sort((a, b) => b - a).forEach(i => state.placedObjects.splice(i, 1));
      state.selectedObjectIndices = [];
      draw();
    }
    if (e.key === 'Control' && !state.isDragging) {
      state.canvas.style.cursor = 'grab';
    }
  });

  document.addEventListener('keyup', (e) => {
    if (e.key === 'Control' && !state.isDragging) {
      updateCursor();
    }
  });

  state.canvas.addEventListener('wheel', handleWheel);

  state.canvas.addEventListener('mousedown', handleMouseDown);
  state.canvas.addEventListener('mouseup', handleMouseUp);
  state.canvas.addEventListener('mousemove', handleMouseMove);
  state.canvas.addEventListener('pointerup', placeDraggedObject);


  state.resetViewButton.addEventListener('click', centerMap);

  document.getElementById('reset-all-button').addEventListener('click', () => {
    resetState();
    centerMap();
    draw();
  });

  document.querySelectorAll('.draggable-button').forEach(button => {
    button.addEventListener('pointerdown', () => {
      state.draggedSymbol = button.dataset.symbol;
    });
  });

  document.addEventListener('pointerup', () => {
    state.draggedSymbol = null;
  });

  document.querySelectorAll('.tool-button').forEach(btn => {
    btn.addEventListener('click', () => {
      const alreadySelected = btn.classList.contains('active');
      document.querySelectorAll('.tool-button').forEach(b => b.classList.remove('active'));
      if (!alreadySelected) {
        btn.classList.add('active');
        state.currentTool = btn.dataset.tool;
      } else {
        state.currentTool = null;
      }
      updateCursor();
    });
  });

  document.querySelectorAll('.color-swatch').forEach(swatch => {
    swatch.addEventListener('click', () => {
      const color = swatch.dataset.color;
      requestColorChange(color);
    });
  });

  state.mapSelect.addEventListener('change', () => {
    state.placedObjects.length = 0;
    state.penPaths.length = 0;
    socket.emit('changeMap', state.mapSelect.value);
    loadMap(state.mapSelect.value);
  });

  setupContextMenu();
}
