const canvas = document.getElementById('mapCanvas');
    const ctx = canvas.getContext('2d');
    const mapSelect = document.getElementById('map-select');
    const resetViewButton = document.getElementById('reset-view-button');

    const mapImage = new Image();
    let selectionRect = null;
    let scale = 1;
    let offsetX = 0;
    let offsetY = 0;
    let isDragging = false;
    let lastX = 0;
    let lastY = 0;
    let currentTool = null;
    let currentColor = null;
    currentColor = '#ff0000'; // default starting color
    const placedObjects = [];
    let selectedObjectIndices = [];
    let penPath = [];
    let penPaths = [];
    let isDrawing = false;
    let isLiveDrawing = false;

    const pings = [];

    function resizeCanvas() {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      centerMap();
    }

    function centerMap() {
      if (mapImage.complete && mapImage.naturalWidth !== 0) {
        const scaleX = canvas.width / mapImage.width;
        const scaleY = canvas.height / mapImage.height;
        scale = Math.min(scaleX, scaleY) * 0.9;
        offsetX = (canvas.width - mapImage.width * scale) / 2;
        offsetY = (canvas.height - mapImage.height * scale) / 2;
        draw();
      }
    }

    function draw() {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.setTransform(scale, 0, 0, scale, offsetX, offsetY);
      if (mapImage.complete && mapImage.naturalWidth !== 0) {
        ctx.drawImage(mapImage, 0, 0);
      const now = Date.now();
      penPaths.forEach(({ path, color, timestamp }) => {

        ctx.beginPath();
        ctx.strokeStyle = color;
        ctx.lineWidth = 2 / scale;
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        path.forEach((point, index) => {
          if (index === 0) {
            ctx.moveTo(point.x, point.y);
          } else {
            ctx.lineTo(point.x, point.y);
          }
        });
        ctx.stroke(); // this belongs here
      });

      }
      placedObjects.forEach(obj => {
        const screenX = obj.x * scale + offsetX;
        const screenY = obj.y * scale + offsetY;
        ctx.font = `${48 / scale}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
      if (selectedObjectIndices.includes(placedObjects.indexOf(obj))) {          ctx.beginPath();
          ctx.arc(obj.x, obj.y, 28 / scale, 0, 2 * Math.PI);
          ctx.fillStyle = '#00ffff';
          ctx.fill();
        }
        ctx.fillStyle = 'black';
        ctx.fillText(obj.symbol, obj.x, obj.y);
      });
        const now = Date.now();
          pings.forEach(ping => {
            const elapsed = now - ping.start;

            if (elapsed <= 5000) {
              const screenX = ping.x * scale + offsetX;
              const screenY = ping.y * scale + offsetY;

              if (elapsed <= 3000) {
                for (let i = 0; i < ping.ripples; i++) {
                  const rippleTime = 3000 / ping.ripples;
                  const rippleAge = elapsed - i * rippleTime;
                  if (rippleAge >= 0 && rippleAge <= rippleTime) {
                    const progress = rippleAge / rippleTime;
                    const radius = 20 + progress * 60;
                    const alpha = 1 - progress;
                    ctx.beginPath();
                    ctx.arc(ping.x, ping.y, radius, 0, 2 * Math.PI);
                    ctx.strokeStyle = `${ping.color}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
                    ctx.lineWidth = 2 / scale;
                    ctx.stroke();
                  }
                }
              }

              if (elapsed <= 5000) {
                const fadeProgress = Math.min((5000 - elapsed) / 1000, 1); // fade over last second
                const alpha = Math.max(fadeProgress, 0);
                ctx.beginPath();
                ctx.arc(ping.x, ping.y, 6 / scale, 0, 2 * Math.PI);
                ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
                ctx.fill();
              }
            }
          });
      if (isDrawing && penPath.length > 1) {
            ctx.beginPath();
            ctx.strokeStyle = currentColor;
            ctx.lineWidth = 2 / scale;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            penPath.forEach((point, index) => {
              if (index === 0) {
                ctx.moveTo(point.x, point.y);
              } else {
                ctx.lineTo(point.x, point.y);
              }
            });
            ctx.stroke();
}
      if (currentTool === 'select' && selectionRect) {
  const x = Math.min(selectionRect.startX, selectionRect.endX);
  const y = Math.min(selectionRect.startY, selectionRect.endY);
  const w = Math.abs(selectionRect.endX - selectionRect.startX);
  const h = Math.abs(selectionRect.endY - selectionRect.startY);

  ctx.beginPath();
  ctx.setLineDash([5, 5]);
  ctx.strokeStyle = '#00ffff';
  ctx.lineWidth = 1 / scale;
  ctx.strokeRect(x, y, w, h);
  ctx.setLineDash([]);
}
    }

    // Ensure the map image path is correct
    function loadMap(name) {
      mapImage.src = `maps/${name}.jpg`; // Ensure this path matches your folder structure
    }

    mapImage.onload = () => {
  centerMap();
  draw(); // force draw immediately after image is ready

};

 mapSelect.addEventListener('change', () => {
  placedObjects.length = 0;
  penPaths.length = 0;
  loadMap(mapSelect.value);
});
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('load', () => {
      resizeCanvas();
      loadMap(mapSelect.value);

      // Ensure proper linking to CSS and HTML elements
      const redSwatch = document.querySelector('[data-color="#ff0000"]');
      if (redSwatch) {
        redSwatch.classList.add('active');
        currentColor = '#ff0000';
      }

      const penTool = document.querySelector('[data-tool="pen"]');
      if (penTool) {
        penTool.classList.add('active');
        currentTool = 'pen';
      }

      updateCursor();

      draw(); // ✅ Safety net: force canvas render even before user input
    });

    document.addEventListener('keydown', (e) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedObjectIndices.length > 0) {
        e.preventDefault();
        // Sort indices in descending order to avoid shifting issues during deletion
        selectedObjectIndices.sort((a, b) => b - a).forEach(index => placedObjects.splice(index, 1));
        selectedObjectIndices = []; // Clear selection after deletion
        draw();
      }
      if (e.key === 'Control' && !isDragging) {
        canvas.style.cursor = 'grab';
      }
    });

    document.addEventListener('keyup', (e) => {
      if (e.key === 'Control' && !isDragging) {
        updateCursor();
      }
    });

    canvas.addEventListener('wheel', (e) => {
      e.preventDefault();
      const rect = canvas.getBoundingClientRect();
      const mouseX = (e.clientX - rect.left - offsetX) / scale;
      const mouseY = (e.clientY - rect.top - offsetY) / scale;
      const delta = -e.deltaY * 0.001;
      const zoom = Math.exp(delta);
      scale *= zoom;
      offsetX -= mouseX * (zoom - 1) * scale;
      offsetY -= mouseY * (zoom - 1) * scale;
      draw();
    });

    resetViewButton.addEventListener('click', () => {
      centerMap();
    });

document.getElementById('reset-all-button').addEventListener('click', () => {
  placedObjects.length = 0;
  penPaths.length = 0;
  pings.length = 0;
  penPath = [];
  selectedObjectIndices = [];
  selectionRect = null;
  isDrawing = false;
  isLiveDrawing = false;
  centerMap(); // recenter
  draw();      // force redraw
});

canvas.addEventListener('mousedown', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - offsetX) / scale;
  const y = (e.clientY - rect.top - offsetY) / scale;

  // Pan Tool (no Ctrl needed)
  if (e.button === 0 && (e.ctrlKey || currentTool === 'pan')) {
    isDragging = true;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.style.cursor = 'grabbing';
    return;
  }

  // Select Tool — select object
  if (currentTool === 'select' && e.button === 0) {
    // Begin selection rectangle
    selectionRect = {
      startX: x,
      startY: y,
      endX: x,
      endY: y
    };

    // Check for single object click
    const clickedIndex = placedObjects.findIndex(obj => {
      const dx = x - obj.x;
      const dy = y - obj.y;
      return Math.sqrt(dx * dx + dy * dy) < 20 / scale;
    });

    if (clickedIndex !== -1) {
      const alreadySelected = selectedObjectIndices.includes(clickedIndex);
      if (!alreadySelected) {
        // Add to selection if not already selected
        selectedObjectIndices.push(clickedIndex);
      }
    }

    draw();
    return;
  }

  // Pen Tool
  if (currentTool === 'pen' && currentColor && e.button === 0) {
    isDrawing = true;
    isLiveDrawing = true;
    penPath = [{ x, y }];
    return;
  }

  // Ping Tool
  if (currentTool === 'ping' && e.button === 0) {
    pings.push({
      x,
      y,
      start: Date.now(),
      ripples: 5,
      color: currentColor || '#ff0000',
      solid: true
    });
    return;
  }
});

canvas.addEventListener('mouseup', (e) => {
  if (currentTool === 'select' && selectionRect) {
    const x1 = Math.min(selectionRect.startX, selectionRect.endX);
    const x2 = Math.max(selectionRect.startX, selectionRect.endX);
    const y1 = Math.min(selectionRect.startY, selectionRect.endY);
    const y2 = Math.max(selectionRect.startY, selectionRect.endY);

  selectedObjectIndices = placedObjects
    .map((obj, index) => ({ obj, index }))
    .filter(({ obj }) => obj.x >= x1 && obj.x <= x2 && obj.y >= y1 && obj.y <= y2)
    .map(({ index }) => index);

    selectionRect = null;
    draw();
    return;
  }

  if (isDrawing && currentTool === 'pen') {
    isDrawing = false;
    isLiveDrawing = false;
    if (penPath.length > 1 && currentColor) {
      const isRed = currentColor.trim().toLowerCase() === '#ff0000';
      penPaths.push({
        path: penPath,
        color: currentColor,
        timestamp: isRed ? Date.now() : null
      });
    }
    penPath = [];
    draw();
    return;
  }

  if (e.button === 0) {
    isDragging = false;
    updateCursor();
  }
});

// Emit drawing events to the server
canvas.addEventListener('mouseup', (e) => {
    if (isDrawing && currentTool === 'pen') {
        isDrawing = false;
        isLiveDrawing = false;
        if (penPath.length > 1 && currentColor) {
            const data = {
                path: penPath,
                color: currentColor,
                timestamp: Date.now(),
            };
            socket.emit('draw', data);
        }
        penPath = [];
        draw();
    }
});

canvas.addEventListener('dblclick', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - offsetX) / scale;
  const y = (e.clientY - rect.top - offsetY) / scale;
  pings.push({
    x,
    y,
    start: Date.now(),
    ripples: 5,
    color: currentColor || '#ff0000',
    solid: true
  });
});

// Emit ping events to the server
canvas.addEventListener('dblclick', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offsetX) / scale;
    const y = (e.clientY - rect.top - offsetY) / scale;
    const data = {
        x, y, start: Date.now(), ripples: 5, color: currentColor || '#ff0000',
    };
    socket.emit('ping', data);
});

canvas.addEventListener('mousemove', (e) => {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left - offsetX) / scale;
  const y = (e.clientY - rect.top - offsetY) / scale;

  if (selectedObjectIndices.length > 0 && e.buttons === 1) {
    // Drag all selected objects
    selectedObjectIndices.forEach(i => {
      placedObjects[i].x += (e.movementX / scale);
      placedObjects[i].y += (e.movementY / scale);
    });
    draw();
    return;
  }

  if (currentTool === 'select' && selectionRect && e.buttons === 1) {
    selectionRect.endX = x;
    selectionRect.endY = y;
    draw();
    return;
  }

  if (isDrawing && currentTool === 'pen' && e.buttons === 1) {
    penPath.push({ x, y });
    draw();
    return;
  }

  if (isDragging) {
    const dx = e.clientX - lastX;
    const dy = e.clientY - lastY;
    offsetX += dx;
    offsetY += dy;
    lastX = e.clientX;
    lastY = e.clientY;
    draw();
    return;
  }

  updateCursor();
});

document.addEventListener('DOMContentLoaded', () => {
  // Ensure proper linking to CSS for custom context menu
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

  // Prevent default context menu globally
  document.addEventListener('contextmenu', (e) => {
    e.preventDefault(); // Disable default context menu for all browsers, including Firefox
  });

  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();

    // Position the custom menu
    const menuWidth = customMenu.offsetWidth;
    const menuHeight = customMenu.offsetHeight;
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;

    let menuX = e.pageX;
    let menuY = e.pageY;

    // Adjust position to prevent overflow
    if (menuX + menuWidth > viewportWidth) {
      menuX = viewportWidth - menuWidth - 10; // Add some padding
    }
    if (menuY + menuHeight > viewportHeight) {
      menuY = viewportHeight - menuHeight - 10; // Add some padding
    }

    customMenu.style.left = `${menuX}px`;
    customMenu.style.top = `${menuY}px`;
    customMenu.style.display = 'block';
  });

  document.addEventListener('click', (e) => {
    // Hide the custom menu if clicking outside of it
    if (!customMenu.contains(e.target)) {
      customMenu.style.display = 'none';
    }
  });

  document.getElementById('menu-select-tool').addEventListener('click', () => {
    // Activate Select Tool
    document.querySelectorAll('.tool-button').forEach(b => b.classList.remove('active'));
    const selectToolButton = document.querySelector('[data-tool="select"]');
    if (selectToolButton) {
      selectToolButton.classList.add('active');
    }
    currentTool = 'select';
    updateCursor();
    customMenu.style.display = 'none'; // Hide menu after action
  });

  document.getElementById('menu-pan-tool').addEventListener('click', () => {
    // Activate Pan Tool
    document.querySelectorAll('.tool-button').forEach(b => b.classList.remove('active'));
    const panToolButton = document.querySelector('[data-tool="pan"]');
    if (panToolButton) {
      panToolButton.classList.add('active');
    }
    currentTool = 'pan';
    updateCursor();
    customMenu.style.display = 'none'; // Hide menu after action
  });

  document.getElementById('menu-pen-tool').addEventListener('click', () => {
    // Activate Pen Tool
    document.querySelectorAll('.tool-button').forEach(b => b.classList.remove('active'));
    const penToolButton = document.querySelector('[data-tool="pen"]');
    if (penToolButton) {
      penToolButton.classList.add('active');
    }
    currentTool = 'pen';
    updateCursor();
    customMenu.style.display = 'none'; // Hide menu after action
  });
});

    document.querySelectorAll('.tool-button').forEach(btn => {
      btn.addEventListener('click', () => {
      const alreadySelected = btn.classList.contains('active');
      document.querySelectorAll('.tool-button').forEach(b => b.classList.remove('active'));
      if (!alreadySelected) {
        btn.classList.add('active');
        currentTool = btn.dataset.tool;
      } else {
        currentTool = null; // deselect tool
      }
      updateCursor();
    });
    });

document.querySelectorAll('.color-swatch').forEach(swatch => {
  swatch.addEventListener('click', () => {
    const color = swatch.dataset.color;
    const isRed = color === '#ff0000';
    const alreadySelected = swatch.classList.contains('active');

    // Always clear all active swatches first
    document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('active'));

    if (!alreadySelected) {
      // Select the clicked swatch
      swatch.classList.add('active');
      currentColor = color;
    } else {
      // Fallback to red if deselecting
      const redSwatch = document.querySelector('[data-color="#ff0000"]');
      redSwatch.classList.add('active');
      currentColor = '#ff0000';
    }

    updateCursor();
  });
});

  function updateCursor() {
    if (currentTool === 'pan') {
      canvas.style.cursor = 'grab';
    } else if (currentTool === 'select') {
      canvas.style.cursor = 'default';
    } else if (currentTool && currentColor) {
      const svgCursor = `data:image/svg+xml;base64,${btoa(
        `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='12' cy='12' r='6' fill='${currentColor}'/></svg>`
      )}`;
      canvas.style.cursor = `url('${svgCursor}') 12 12, auto`;
    } else {
      canvas.style.cursor = 'default';
    }
  }
    document.querySelectorAll('.draggable-button').forEach(button => {
      button.addEventListener('dragstart', (e) => {
        e.dataTransfer.setData('text/plain', button.dataset.symbol);
      });
    });

    canvas.addEventListener('dragover', (e) => {
      e.preventDefault();
    });

    canvas.addEventListener('drop', (e) => {
      e.preventDefault();
      const symbol = e.dataTransfer.getData('text/plain');
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left - offsetX) / scale;
      const y = (e.clientY - rect.top - offsetY) / scale;
      placedObjects.push({ symbol, x, y });
      draw();
    });

// Emit object placement events to the server
canvas.addEventListener('drop', (e) => {
    e.preventDefault();
    const symbol = e.dataTransfer.getData('text/plain');
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left - offsetX) / scale;
    const y = (e.clientY - rect.top - offsetY) / scale;
    const data = { symbol, x, y };
    socket.emit('placeObject', data);
});

function animate() {
  const now = Date.now();

  // Cleanup expired pings
  pings.forEach(ping => ping.age = now - ping.start);
  for (let i = pings.length - 1; i >= 0; i--) {
    if (pings[i].age > 5000) pings.splice(i, 1);
  }

  // Cleanup expired red pen paths
  for (let i = penPaths.length - 1; i >= 0; i--) {
    const p = penPaths[i];
    if (p.color === '#ff0000' && p.timestamp && now - p.timestamp > 3000) {
      penPaths.splice(i, 1); // Remove red pen path after 3 seconds
    }
  }

  draw(); // Redraw the canvas after cleanup
  requestAnimationFrame(animate); // Continue the animation loop
}
animate(); // starts the continuous redraw loop

// Listen for 'draw' events from the server
socket.on('draw', (data) => {
    penPaths.push(data);
    draw();
});

// Listen for 'ping' events from the server
socket.on('ping', (data) => {
    pings.push(data);
    draw();
});

// Listen for 'placeObject' events from the server
socket.on('placeObject', (data) => {
    placedObjects.push(data);
    draw();
});

// Listen for 'mapChanged' events from the server
socket.on('mapChanged', (mapName) => {
    placedObjects = [];
    penPaths = [];
    pings = [];
    loadMap(mapName);
    draw();
});

// Listen for 'stateUpdate' events from the server
socket.on('stateUpdate', (state) => {
    penPaths = state.drawings;
    pings = state.pings;
    placedObjects = state.objects;
    loadMap(state.currentMap);
    draw();
});

// Emit map change events to the server
mapSelect.addEventListener('change', () => {
    const mapName = mapSelect.value;
    socket.emit('changeMap', mapName);
});

// Listen for state updates from the server
socket.on('stateUpdate', (state) => {
    penPaths = state.drawings;
    pings = state.pings;
    placedObjects = state.objects;
    loadMap(state.currentMap);
    draw();
});

// Listen for drawing updates from the server
socket.on('draw', (data) => {
    penPaths.push(data);
    draw();
});

// Listen for ping updates from the server
socket.on('ping', (data) => {
    pings.push(data);
    draw();
});

// Listen for object placement updates from the server
socket.on('placeObject', (data) => {
    placedObjects.push(data);
    draw();
});

// Listen for map change updates from the server
socket.on('mapChanged', (mapName) => {
    placedObjects = [];
    penPaths = [];
    pings = [];
    loadMap(mapName);
    draw();
});
