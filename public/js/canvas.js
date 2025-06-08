import { state } from './state.js';

export function resizeCanvas() {
  state.canvas.width = state.canvas.clientWidth;
  state.canvas.height = state.canvas.clientHeight;
  centerMap();
}

export function centerMap() {
  if (state.mapImage.complete && state.mapImage.naturalWidth !== 0) {
    const scaleX = state.canvas.width / state.mapImage.width;
    const scaleY = state.canvas.height / state.mapImage.height;
    state.scale = Math.min(scaleX, scaleY) * 0.9;
    state.offsetX = (state.canvas.width - state.mapImage.width * state.scale) / 2;
    state.offsetY = (state.canvas.height - state.mapImage.height * state.scale) / 2;
    draw();
  }
}

export function loadMap(name) {
  state.mapImage.src = `../maps/${name}.jpg`;
}

export function draw() {
  const ctx = state.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, state.canvas.width, state.canvas.height);
  ctx.setTransform(state.scale, 0, 0, state.scale, state.offsetX, state.offsetY);

  if (state.mapImage.complete && state.mapImage.naturalWidth !== 0) {
    ctx.drawImage(state.mapImage, 0, 0);
    state.penPaths.forEach(({ path, color }) => {
      ctx.beginPath();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2 / state.scale;
      ctx.lineJoin = 'round';
      ctx.lineCap = 'round';
      path.forEach((pt, idx) => {
        if (idx === 0) ctx.moveTo(pt.x, pt.y);
        else ctx.lineTo(pt.x, pt.y);
      });
      ctx.stroke();
    });
  }

  state.placedObjects.forEach(obj => {
    ctx.font = `${48 / state.scale}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    if (state.selectedObjectIndices.includes(state.placedObjects.indexOf(obj))) {
      ctx.beginPath();
      ctx.arc(obj.x, obj.y, 28 / state.scale, 0, 2 * Math.PI);
      ctx.fillStyle = '#00ffff';
      ctx.fill();
    }
    ctx.fillStyle = 'black';
    ctx.fillText(obj.symbol, obj.x, obj.y);
  });

  const now = Date.now();
  state.pings.forEach(ping => {
    const elapsed = now - ping.start;
    if (elapsed <= 5000) {
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
            ctx.lineWidth = 2 / state.scale;
            ctx.stroke();
          }
        }
      }
      const fadeProgress = Math.min((5000 - elapsed) / 1000, 1);
      const alpha = Math.max(fadeProgress, 0);
      ctx.beginPath();
      ctx.arc(ping.x, ping.y, 6 / state.scale, 0, 2 * Math.PI);
      ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
      ctx.fill();
    }
  });

  if (state.isDrawing && state.penPath.length > 1) {
    ctx.beginPath();
    ctx.strokeStyle = state.currentColor;
    ctx.lineWidth = 2 / state.scale;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    state.penPath.forEach((pt, idx) => {
      if (idx === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.stroke();
  }

  if (state.currentTool === 'select' && state.selectionRect) {
    const x = Math.min(state.selectionRect.startX, state.selectionRect.endX);
    const y = Math.min(state.selectionRect.startY, state.selectionRect.endY);
    const w = Math.abs(state.selectionRect.endX - state.selectionRect.startX);
    const h = Math.abs(state.selectionRect.endY - state.selectionRect.startY);
    ctx.beginPath();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = '#00ffff';
    ctx.lineWidth = 1 / state.scale;
    ctx.strokeRect(x, y, w, h);
    ctx.setLineDash([]);
  }
}

export function updateCursor() {
  if (state.currentTool === 'pan') {
    state.canvas.style.cursor = 'grab';
  } else if (state.currentTool === 'select') {
    state.canvas.style.cursor = 'default';
  } else if (state.currentTool && state.currentColor) {
    const svgCursor = `data:image/svg+xml;base64,${btoa(
      `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24'><circle cx='12' cy='12' r='6' fill='${state.currentColor}'/></svg>`
    )}`;
    state.canvas.style.cursor = `url('${svgCursor}') 12 12, auto`;
  } else {
    state.canvas.style.cursor = 'default';
  }
}

export function animate() {
  const now = Date.now();
  state.pings.forEach(p => (p.age = now - p.start));
  for (let i = state.pings.length - 1; i >= 0; i--) {
    if (state.pings[i].age > 5000) state.pings.splice(i, 1);
  }
  for (let i = state.penPaths.length - 1; i >= 0; i--) {
    const p = state.penPaths[i];
    if (p.color === '#ff0000' && p.timestamp && now - p.timestamp > 3000) {
      state.penPaths.splice(i, 1);
    }
  }
  draw();
  requestAnimationFrame(animate);
}
