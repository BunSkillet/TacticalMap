import { state, clearBoardState } from './state.js';
import { resizeCanvas, centerMap, draw, loadMap, updateCursor } from './canvas.js';
import { socket, requestColorChange } from './socketHandlers.js';

const deleteButton = document.getElementById('delete-objects-button');
const sidePanel = document.getElementById('side-panel');
const collapseButton = document.getElementById('collapse-button');
const undoButton = document.getElementById('undo-button');
const redoButton = document.getElementById('redo-button');
const undoMini = document.getElementById('undo-mini');
const redoMini = document.getElementById('redo-mini');

function updateCollapseButton() {
  if (!collapseButton) return;
  if (sidePanel.classList.contains('collapsed')) {
    collapseButton.textContent = '<<';
    collapseButton.title = 'expand';
  } else {
    collapseButton.textContent = '>>';
    collapseButton.title = 'collapse';
  }
}

export function updateCollapsedUI() {
  const colorBox = document.getElementById('current-color');
  const toolBtn = document.getElementById('current-tool');
  if (colorBox) colorBox.style.backgroundColor = state.currentColor || '#ff0000';
  if (toolBtn) {
    const selected = document.querySelector('.tool-button.active');
    toolBtn.textContent = selected ? selected.textContent : '';
  }
}
window.updateCollapsedUI = updateCollapsedUI;

function checkAutoCollapse() {
  if (window.innerWidth < window.screen.width / 2) {
    sidePanel.classList.add('collapsed');
  } else {
    sidePanel.classList.remove('collapsed');
  }
  resizeCanvas();
  updateCollapseButton();
  updateCollapsedUI();
}

function updateDeleteButtonVisibility() {
  if (!deleteButton) return;
  deleteButton.style.display = state.selectedObjectIndices.length > 0 ? 'block' : 'none';
}

function closeTextEditor(save) {
  if (!state.activeTextInput) return;
  const input = state.activeTextInput;
  const index = state.editingObjectIndex;
  const text = input.value.trim();
  const x = (parseFloat(input.style.left) - state.offsetX) / state.scale;
  const y = (parseFloat(input.style.top) - state.offsetY) / state.scale;
  input.remove();
  state.activeTextInput = null;
  state.editingObjectIndex = null;
  if (save && text) {
    if (index !== null) {
      state.placedObjects[index].symbol = text;
      state.placedObjects[index].type = 'text';
      socket.emit('editObject', { index, symbol: text, type: 'text' });
    } else {
      const data = { symbol: text, x, y, type: 'text' };
      state.placedObjects.push(data);
      socket.emit('placeObject', data);
    }
  } else if (index !== null && !text) {
    socket.emit('removeObjects', [index]);
    state.placedObjects.splice(index, 1);
  }
  draw();
  updateDeleteButtonVisibility();
}

function openTextEditor(x, y, index = null) {
  const container = document.getElementById('canvas-container');
  closeTextEditor(false);
  const input = document.createElement('textarea');
  input.className = 'text-editor';
  if (index !== null) input.value = state.placedObjects[index].symbol;
  input.style.left = `${state.offsetX + x * state.scale}px`;
  input.style.top = `${state.offsetY + y * state.scale}px`;
  container.appendChild(input);
  input.focus();
  state.activeTextInput = input;
  state.editingObjectIndex = index;
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      closeTextEditor(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closeTextEditor(false);
    }
  });
  input.addEventListener('blur', () => closeTextEditor(true));
}

function handlePointerDown(e) {
  if (state.draggedSymbol) {
    // When an object icon is selected, ignore tool interactions
    return;
  }
  if (e.pointerType === 'touch') {
    const now = Date.now();
    if (now - state.lastTapTime < 300) {
      const rect = state.canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - state.offsetX) / state.scale;
      const y = (e.clientY - rect.top - state.offsetY) / state.scale;
      const idx = state.placedObjects.findIndex(obj => {
        const dx = x - obj.x;
        const dy = y - obj.y;
        return Math.sqrt(dx * dx + dy * dy) < 20 / state.scale && obj.type === 'text';
      });
      if (idx !== -1) {
        e.preventDefault();
        openTextEditor(state.placedObjects[idx].x, state.placedObjects[idx].y, idx);
        state.lastTapTime = 0;
        return;
      }
    }
    state.lastTapTime = now;
  }
  const rect = state.canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - state.offsetX) / state.scale;
  const y = (e.clientY - rect.top - state.offsetY) / state.scale;

  state.activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });

  if (state.activePointers.size === 2 && e.pointerType === 'touch') {
    const pts = Array.from(state.activePointers.values());
    state.isPinching = true;
    state.initialPinchDistance = Math.hypot(
      pts[1].clientX - pts[0].clientX,
      pts[1].clientY - pts[0].clientY
    );
    state.initialScale = state.scale;
    const midpoint = {
      x: (pts[0].clientX + pts[1].clientX) / 2,
      y: (pts[0].clientY + pts[1].clientY) / 2
    };
    state.initialWorldCenter = {
      x: (midpoint.x - rect.left - state.offsetX) / state.scale,
      y: (midpoint.y - rect.top - state.offsetY) / state.scale
    };
    state.isDragging = false;
    state.isDrawing = false;
    state.isLiveDrawing = false;
    state.selectionRect = null;
    return;
  }

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

  if (state.currentTool === 'text' && e.button === 0) {
    openTextEditor(x, y);
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

function handlePointerUp(e) {
  state.activePointers.delete(e.pointerId);
  if (state.draggedSymbol) {
    return;
  }

  if (state.isPinching) {
    if (state.activePointers.size < 2) {
      state.isPinching = false;
    }
    return;
  }

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
    updateDeleteButtonVisibility();
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
    updateDeleteButtonVisibility();
    return;
  }

  if (e.button === 0) {
    state.isDragging = false;
    updateCursor();
  }
  updateDeleteButtonVisibility();
}

function handlePointerMove(e) {
  if (state.draggedSymbol) {
    return;
  }
  const rect = state.canvas.getBoundingClientRect();

  if (state.isPinching && state.activePointers.has(e.pointerId)) {
    state.activePointers.set(e.pointerId, { clientX: e.clientX, clientY: e.clientY });
    const pts = Array.from(state.activePointers.values());
    if (pts.length >= 2) {
      const newDistance = Math.hypot(
        pts[1].clientX - pts[0].clientX,
        pts[1].clientY - pts[0].clientY
      );
      const ratio = newDistance / state.initialPinchDistance;
      const midpoint = {
        x: (pts[0].clientX + pts[1].clientX) / 2,
        y: (pts[0].clientY + pts[1].clientY) / 2
      };
      const newScale = state.initialScale * ratio;
      state.scale = newScale;
      state.offsetX = midpoint.x - rect.left - state.initialWorldCenter.x * newScale;
      state.offsetY = midpoint.y - rect.top - state.initialWorldCenter.y * newScale;
      draw();
    }
    return;
  }

  const x = (e.clientX - rect.left - state.offsetX) / state.scale;
  const y = (e.clientY - rect.top - state.offsetY) / state.scale;

  if (state.selectedObjectIndices.length > 0 && e.buttons === 1) {
    state.selectedObjectIndices.forEach(i => {
      state.placedObjects[i].x += e.movementX / state.scale;
      state.placedObjects[i].y += e.movementY / state.scale;
    });
    const updates = state.selectedObjectIndices.map(i => ({
      index: i,
      x: state.placedObjects[i].x,
      y: state.placedObjects[i].y
    }));
    socket.emit('moveObjects', updates);
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

function handleCanvasClick(e) {
  if (state.currentTool !== 'text' || state.activeTextInput) return;
  const rect = state.canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - state.offsetX) / state.scale;
  const y = (e.clientY - rect.top - state.offsetY) / state.scale;
  openTextEditor(x, y);
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

function handleDoubleClick(e) {
  const rect = state.canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - state.offsetX) / state.scale;
  const y = (e.clientY - rect.top - state.offsetY) / state.scale;
  const idx = state.placedObjects.findIndex(obj => {
    const dx = x - obj.x;
    const dy = y - obj.y;
    return Math.sqrt(dx * dx + dy * dy) < 20 / state.scale && obj.type === 'text';
  });
  if (idx !== -1) {
    openTextEditor(state.placedObjects[idx].x, state.placedObjects[idx].y, idx);
    return;
  }
  const ping = {
    x,
    y,
    start: Date.now(),
    ripples: 5,
    color: state.currentColor || '#ff0000',
    solid: true
  };
  state.pings.push(ping);
  socket.emit('ping', ping);
  draw();
}


function placeDraggedObject(e) {
  if (!state.draggedSymbol) return;
  const rect = state.canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - state.offsetX) / state.scale;
  const y = (e.clientY - rect.top - state.offsetY) / state.scale;
  const data = { symbol: state.draggedSymbol, x, y, type: 'symbol' };
  state.placedObjects.push(data);
  socket.emit('placeObject', data);
  state.draggedSymbol = null;
  updateCursor();
  updateCollapsedUI();
  draw();
}

function saveCanvasImage() {
  const link = document.createElement('a');
  link.download = 'tactical-board.png';
  link.href = state.canvas.toDataURL('image/png');
  link.click();
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
    updateCollapsedUI();
    customMenu.style.display = 'none';
  });

  document.getElementById('menu-pan-tool').addEventListener('click', () => {
    document.querySelectorAll('.tool-button').forEach(b => b.classList.remove('active'));
    const panToolButton = document.querySelector('[data-tool="pan"]');
    if (panToolButton) panToolButton.classList.add('active');
    state.currentTool = 'pan';
    updateCursor();
    updateCollapsedUI();
    customMenu.style.display = 'none';
  });

  document.getElementById('menu-pen-tool').addEventListener('click', () => {
    document.querySelectorAll('.tool-button').forEach(b => b.classList.remove('active'));
    const penToolButton = document.querySelector('[data-tool="pen"]');
    if (penToolButton) penToolButton.classList.add('active');
    state.currentTool = 'pen';
    updateCursor();
    updateCollapsedUI();
    customMenu.style.display = 'none';
  });
}

export function setupEvents() {
  window.addEventListener('resize', () => {
    resizeCanvas();
    checkAutoCollapse();
  });

  resizeCanvas();
  checkAutoCollapse();
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
  updateDeleteButtonVisibility();

  document.addEventListener('keydown', (e) => {
    if ((e.key === 'Delete' || e.key === 'Backspace') && state.selectedObjectIndices.length > 0) {
      e.preventDefault();
      const indices = state.selectedObjectIndices.slice();
      socket.emit('removeObjects', indices);
      indices.sort((a, b) => b - a).forEach(i => state.placedObjects.splice(i, 1));
      state.selectedObjectIndices = [];
      draw();
      updateDeleteButtonVisibility();
    }
    if (e.ctrlKey && !e.shiftKey && e.key.toLowerCase() === 'z') {
      e.preventDefault();
      socket.emit('undo');
    } else if (e.ctrlKey && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
      e.preventDefault();
      socket.emit('redo');
    }
    if (e.key === 'Control' && !state.isDragging) {
      state.canvas.style.cursor = 'grab';
    }
  });

  if (deleteButton) {
    deleteButton.addEventListener('click', () => {
      if (state.selectedObjectIndices.length === 0) return;
      const indices = state.selectedObjectIndices.slice();
      socket.emit('removeObjects', indices);
      indices.sort((a, b) => b - a).forEach(i => state.placedObjects.splice(i, 1));
      state.selectedObjectIndices = [];
      draw();
      updateDeleteButtonVisibility();
    });
  }

  document.addEventListener('keyup', (e) => {
    if (e.key === 'Control' && !state.isDragging) {
      updateCursor();
    }
  });

  state.canvas.addEventListener('wheel', handleWheel);

  state.canvas.addEventListener('pointerdown', handlePointerDown);
  state.canvas.addEventListener('pointerup', handlePointerUp);
  state.canvas.addEventListener('pointercancel', handlePointerUp);
  state.canvas.addEventListener('pointermove', handlePointerMove);
  state.canvas.addEventListener('pointerup', placeDraggedObject);
  state.canvas.addEventListener('click', handleCanvasClick);
  state.canvas.addEventListener('dblclick', handleDoubleClick);

  if (collapseButton) {
    collapseButton.addEventListener('click', () => {
      sidePanel.classList.toggle('collapsed');
      updateCollapseButton();
      resizeCanvas();
      updateCollapsedUI();
    });
  }


  state.resetViewButton.addEventListener('click', centerMap);
  const miniCenter = document.getElementById('reset-view-mini');
  if (miniCenter) miniCenter.addEventListener('click', centerMap);

  if (undoButton) undoButton.addEventListener('click', () => socket.emit('undo'));
  if (redoButton) redoButton.addEventListener('click', () => socket.emit('redo'));
  if (undoMini) undoMini.addEventListener('click', () => socket.emit('undo'));
  if (redoMini) redoMini.addEventListener('click', () => socket.emit('redo'));

  document.getElementById('reset-all-button').addEventListener('click', () => {
    socket.emit('clearMap');
    clearBoardState();
    centerMap();
    draw();
    updateDeleteButtonVisibility();
  });
  const miniClear = document.getElementById('reset-all-mini');
  if (miniClear) {
    miniClear.addEventListener('click', () => {
      socket.emit('clearMap');
      clearBoardState();
      centerMap();
      draw();
      updateDeleteButtonVisibility();
    });
  }

  document.getElementById('save-image-button').addEventListener('click', saveCanvasImage);
  const miniSave = document.getElementById('save-image-mini');
  if (miniSave) miniSave.addEventListener('click', saveCanvasImage);

  document.querySelectorAll('.draggable-button').forEach(button => {
    button.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      state.draggedSymbol = button.dataset.symbol;
      updateCursor();
    });
    button.addEventListener('click', (e) => {
      e.preventDefault();
      state.draggedSymbol = button.dataset.symbol;
      updateCursor();
      updateCollapsedUI();
    });
  });

  document.addEventListener('pointerup', (e) => {
    if (
      state.draggedSymbol &&
      e.target !== state.canvas &&
      !e.target.classList.contains('draggable-button')
    ) {
      state.draggedSymbol = null;
      updateCursor();
    }
  });
  document.addEventListener('pointercancel', () => {
    state.activePointers.clear();
    state.isPinching = false;
    if (state.draggedSymbol) {
      state.draggedSymbol = null;
      updateCursor();
    }
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
      updateCollapsedUI();
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
    updateDeleteButtonVisibility();
  });

  const helpButton = document.getElementById('help-button');
  const helpModal = document.getElementById('help-modal');

  if (helpButton && helpModal) {
    helpButton.addEventListener('click', () => {
      helpModal.style.display = 'flex';
    });
    helpModal.addEventListener('click', (e) => {
      if (e.target === helpModal) helpModal.style.display = 'none';
    });
  }

  setupContextMenu();
}
