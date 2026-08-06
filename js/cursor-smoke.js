(function initCursorSmoke() {
  const desktopQuery = window.matchMedia('(min-width: 901px)');
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let destroyEffect = null;

  function createEffect() {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return function () {};

    canvas.className = 'cursor-smoke-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    Object.assign(canvas.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '90',
      width: '100%',
      height: '100%',
      pointerEvents: 'none'
    });
    document.body.append(canvas);

    const points = [];
    const cursor = { x: 0, y: 0, smoothX: 0, smoothY: 0, lastX: 0, lastY: 0 };
    let cursorReady = false;
    let pointerInside = false;
    let movementPending = false;
    let frameId = 0;
    let previousFrame = performance.now();
    let dpr = 1;

    function settings() {
      return motionQuery.matches
        ? { lifetime: 850, maxPoints: 58, spacing: 5, wobble: 0.7, layers: 2 }
        : { lifetime: 1550, maxPoints: 115, spacing: 3.5, wobble: 1.5, layers: 3 };
    }

    function resizeCanvas() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.lineCap = 'round';
      context.lineJoin = 'round';
    }

    function addPoint(x, y) {
      const options = settings();
      points.push({
        x,
        y,
        age: 0,
        lifetime: options.lifetime * (0.9 + Math.random() * 0.2),
        phase: Math.random() * Math.PI * 2,
        drift: (Math.random() - 0.5) * 0.7
      });
      if (points.length > options.maxPoints) points.splice(0, points.length - options.maxPoints);
    }

    function extendTrail(x, y) {
      const options = settings();
      const dx = x - cursor.lastX;
      const dy = y - cursor.lastY;
      const distance = Math.hypot(dx, dy);
      if (distance < 0.5) return;

      const steps = Math.min(24, Math.max(1, Math.ceil(distance / options.spacing)));
      for (let step = 1; step <= steps; step += 1) {
        const ratio = step / steps;
        addPoint(cursor.lastX + dx * ratio, cursor.lastY + dy * ratio);
      }
      cursor.lastX = x;
      cursor.lastY = y;
    }

    function pointPosition(point, now) {
      const progress = point.age / point.lifetime;
      const options = settings();
      const lift = 13 * progress + 12 * progress * progress;
      const curl = Math.sin(now * 0.00115 + point.phase + progress * 2.4)
        * options.wobble * (0.25 + progress);
      return { x: point.x + point.drift * progress * 5 + curl, y: point.y - lift };
    }

    function drawSegment(start, control, end, progress, layer) {
      const fade = Math.pow(1 - progress, 1.45);
      const widths = [1.05, 2.25, 4.5];
      const alphas = [0.2, 0.1, 0.045];
      const blurs = [1.5, 3.5, 7];
      const expansion = 1 + progress * 1.45;

      context.lineWidth = widths[layer] * expansion;
      context.strokeStyle = `rgba(220, 225, 235, ${alphas[layer] * fade})`;
      context.shadowColor = `rgba(205, 214, 226, ${alphas[layer] * fade * 0.7})`;
      context.shadowBlur = blurs[layer];
      context.beginPath();
      context.moveTo(start.x, start.y);
      context.quadraticCurveTo(control.x, control.y, end.x, end.y);
      context.stroke();
    }

    function drawTrail(now) {
      if (points.length < 2) return;
      const positions = points.map((point) => pointPosition(point, now));
      const layerCount = settings().layers;

      context.save();
      context.globalCompositeOperation = 'source-over';
      for (let layer = layerCount - 1; layer >= 0; layer -= 1) {
        for (let index = 1; index < positions.length; index += 1) {
          const previous = positions[index - 1];
          const current = positions[index];
          const next = positions[Math.min(index + 1, positions.length - 1)];
          const start = {
            x: (previous.x + current.x) * 0.5,
            y: (previous.y + current.y) * 0.5
          };
          const end = {
            x: (current.x + next.x) * 0.5,
            y: (current.y + next.y) * 0.5
          };
          drawSegment(start, current, end, points[index].age / points[index].lifetime, layer);
        }
      }
      context.restore();
    }

    function animate(now) {
      frameId = 0;
      if (dpr !== Math.min(window.devicePixelRatio || 1, 2)) resizeCanvas();
      const elapsed = Math.min(now - previousFrame, 34);
      previousFrame = now;
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);

      if (movementPending && pointerInside) {
        cursor.smoothX += (cursor.x - cursor.smoothX) * 0.32;
        cursor.smoothY += (cursor.y - cursor.smoothY) * 0.32;
        extendTrail(cursor.smoothX, cursor.smoothY);
        if (Math.hypot(cursor.x - cursor.smoothX, cursor.y - cursor.smoothY) < 0.35) {
          movementPending = false;
        }
      }

      for (let index = points.length - 1; index >= 0; index -= 1) {
        points[index].age += elapsed;
        if (points[index].age >= points[index].lifetime) points.splice(index, 1);
      }
      drawTrail(now);

      if (points.length || movementPending) frameId = requestAnimationFrame(animate);
    }

    function requestFrame() {
      if (document.hidden || frameId) return;
      previousFrame = performance.now();
      frameId = requestAnimationFrame(animate);
    }

    function onMouseMove(event) {
      cursor.x = event.clientX;
      cursor.y = event.clientY;
      pointerInside = true;
      movementPending = true;
      if (!cursorReady) {
        cursor.smoothX = cursor.lastX = cursor.x;
        cursor.smoothY = cursor.lastY = cursor.y;
        addPoint(cursor.x, cursor.y + 0.5);
        addPoint(cursor.x, cursor.y);
        cursorReady = true;
      }
      requestFrame();
    }

    function onPointerLeave() {
      pointerInside = false;
      movementPending = false;
      requestFrame();
    }

    function onVisibilityChange() {
      if (document.hidden) {
        if (frameId) cancelAnimationFrame(frameId);
        frameId = 0;
        points.length = 0;
        cursorReady = false;
        pointerInside = false;
        movementPending = false;
        context.clearRect(0, 0, window.innerWidth, window.innerHeight);
      }
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas, { passive: true });
    window.addEventListener('mousemove', onMouseMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibilityChange);

    function destroy() {
      if (frameId) cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('mousemove', onMouseMove);
      document.documentElement.removeEventListener('mouseleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      canvas.remove();
    }

    destroy.handleMouseMove = onMouseMove;
    return destroy;
  }

  function handleMouseDetection(event) {
    if (!desktopQuery.matches || destroyEffect) return;
    destroyEffect = createEffect();
    if (typeof destroyEffect.handleMouseMove === 'function') destroyEffect.handleMouseMove(event);
  }

  function disableEffectWhenNeeded() {
    if (desktopQuery.matches || !destroyEffect) return;
    destroyEffect();
    destroyEffect = null;
  }

  window.addEventListener('mousemove', handleMouseDetection, { passive: true });
  desktopQuery.addEventListener('change', disableEffectWhenNeeded);
}());
