(function () {
  const lightbox = document.getElementById('lightbox');
  if (!lightbox) return;

  const img = document.getElementById('lightbox-img');
  const closeBtn = lightbox.querySelector('.lightbox-close');

  const MIN_SCALE = 1;
  const MAX_SCALE = 4;
  const TAP_ZOOM_SCALE = 2.5;

  let scale = 1;
  let panX = 0;
  let panY = 0;
  const pointers = new Map();
  let gesture = null; // 'pan' | 'pinch'
  let panStart = null;
  let lastPinchDist = null;
  let dragged = false;
  let lastTap = { time: 0, x: 0, y: 0 };

  function applyTransform(withTransition) {
    img.style.transition = withTransition ? 'transform 0.2s ease' : 'none';
    img.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
    img.classList.toggle('zoomed', scale > MIN_SCALE);
  }

  function resetTransform() {
    scale = 1;
    panX = 0;
    panY = 0;
    applyTransform(false);
  }

  // The image's own center in screen coords stays constant under scale
  // (only translate moves it), so it can be recovered from the current
  // (already-transformed) bounding rect at any time.
  function getCenter() {
    const rect = img.getBoundingClientRect();
    return { x: rect.left + rect.width / 2 - panX, y: rect.top + rect.height / 2 - panY };
  }

  // Keeps the scaled image edge-to-edge with the viewport rather than
  // letting it be dragged past its own border into empty space.
  function clampPan(targetScale, x, y) {
    const rect = img.getBoundingClientRect();
    const unscaledW = rect.width / scale;
    const unscaledH = rect.height / scale;
    const maxX = Math.max(0, (unscaledW * targetScale - window.innerWidth) / 2);
    const maxY = Math.max(0, (unscaledH * targetScale - window.innerHeight) / 2);
    return {
      x: Math.min(maxX, Math.max(-maxX, x)),
      y: Math.min(maxY, Math.max(-maxY, y)),
    };
  }

  function zoomAt(point, newScale) {
    newScale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, newScale));
    const c = getCenter();
    const ratio = newScale / scale;
    const nx = point.x - c.x - ratio * (point.x - c.x - panX);
    const ny = point.y - c.y - ratio * (point.y - c.y - panY);
    const clamped = clampPan(newScale, nx, ny);
    scale = newScale;
    panX = clamped.x;
    panY = clamped.y;
    if (scale === MIN_SCALE) {
      panX = 0;
      panY = 0;
    }
  }

  function toggleZoom(point) {
    if (scale > MIN_SCALE) {
      scale = MIN_SCALE;
      panX = 0;
      panY = 0;
    } else {
      zoomAt(point, TAP_ZOOM_SCALE);
    }
    applyTransform(true);
  }

  function distance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
  }

  function midpoint(a, b) {
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
  }

  function open(src, alt) {
    img.src = src;
    img.alt = alt || '';
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    resetTransform();
  }

  function close() {
    lightbox.hidden = true;
    img.src = '';
    document.body.style.overflow = '';
    pointers.clear();
    gesture = null;
  }

  document.querySelectorAll('.lightbox-trigger').forEach((btn) => {
    btn.addEventListener('click', () => open(btn.dataset.full, btn.dataset.name));
  });

  closeBtn.addEventListener('click', close);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !lightbox.hidden) close();
  });

  img.addEventListener('pointerdown', (e) => {
    img.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    dragged = false;

    if (pointers.size === 1) {
      gesture = 'pan';
      panStart = { x: e.clientX, y: e.clientY, panX, panY };
    } else if (pointers.size === 2) {
      gesture = 'pinch';
      const pts = [...pointers.values()];
      lastPinchDist = distance(pts[0], pts[1]);
    }
  });

  img.addEventListener('pointermove', (e) => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (gesture === 'pan' && pointers.size === 1) {
      const dx = e.clientX - panStart.x;
      const dy = e.clientY - panStart.y;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) dragged = true;
      if (scale > MIN_SCALE) {
        const clamped = clampPan(scale, panStart.panX + dx, panStart.panY + dy);
        panX = clamped.x;
        panY = clamped.y;
        applyTransform(false);
      }
    } else if (gesture === 'pinch' && pointers.size === 2) {
      dragged = true;
      const pts = [...pointers.values()];
      const dist = distance(pts[0], pts[1]);
      const newScale = scale * (dist / lastPinchDist);
      zoomAt(midpoint(pts[0], pts[1]), newScale);
      lastPinchDist = dist;
      applyTransform(false);
    }
  });

  function endPointer(e) {
    if (!pointers.has(e.pointerId)) return;
    const point = { x: e.clientX, y: e.clientY };
    pointers.delete(e.pointerId);

    if (pointers.size === 1) {
      const [remaining] = pointers.values();
      gesture = 'pan';
      panStart = { x: remaining.x, y: remaining.y, panX, panY };
    } else if (pointers.size === 0) {
      if (e.pointerType === 'touch' && !dragged) {
        const now = Date.now();
        const sinceLastTap = now - lastTap.time;
        if (sinceLastTap < 300 && distance(lastTap, point) < 30) {
          toggleZoom(point);
          lastTap.time = 0;
        } else {
          lastTap = { time: now, x: point.x, y: point.y };
        }
      }
      gesture = null;
    }
  }

  img.addEventListener('pointerup', endPointer);
  img.addEventListener('pointercancel', endPointer);
  img.addEventListener('dragstart', (e) => e.preventDefault());

  img.addEventListener('dblclick', (e) => {
    e.preventDefault();
    toggleZoom({ x: e.clientX, y: e.clientY });
  });

  img.addEventListener(
    'wheel',
    (e) => {
      e.preventDefault();
      const newScale = scale * (1 - e.deltaY * 0.01);
      zoomAt({ x: e.clientX, y: e.clientY }, newScale);
      applyTransform(false);
    },
    { passive: false }
  );
})();
