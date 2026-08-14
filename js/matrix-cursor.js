(() => {
  'use strict';

  const MIN_WIDTH = 901;
  const SCALE = 0.8;
  const WIDTH = 34;
  const HEIGHT = 37;
  const HOTSPOT = 1 * SCALE;
  const GLYPHS = '01AXZM/<>+-:#*';
  const INTERACTIVE_SELECTOR = [
    'a', 'button', 'summary', 'select', 'label[for]',
    'input[type="button"]', 'input[type="submit"]',
    'input[type="checkbox"]', 'input[type="radio"]',
    '[role="button"]', '[role="link"]', '[data-lightbox-image]',
    '.article-card__clickable'
  ].join(',');
  const TEXT_SELECTOR = [
    'input[type="text"]', 'input[type="email"]', 'input[type="tel"]',
    'input[type="url"]', 'input[type="search"]', 'input[type="password"]',
    'input:not([type])', 'textarea', '[contenteditable="true"]'
  ].join(',');
  const DISABLED_SELECTOR = 'button:disabled,input:disabled,select:disabled,[aria-disabled="true"]';

  let canvas = null;
  let context = null;
  let arrow = null;
  let columns = null;
  let animationFrame = 0;
  let lastRainFrame = 0;
  let visible = false;
  let pointerMode = false;
  let suppressed = false;
  let pressedUntil = 0;
  let x = 0;
  let y = 0;
  let reducedMotion = false;

  const randomGlyph = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];

  function createColumns() {
    const result = [];
    const positions = [5, 12, 19, 26].map((position) => position * SCALE);
    for (let columnIndex = 0; columnIndex < positions.length; columnIndex += 1) {
      const glyphs = [];
      for (let row = 0; row < 5; row += 1) glyphs.push(randomGlyph());
      result.push({ x: positions[columnIndex], offset: Math.random() * 8 * SCALE, glyphs });
    }
    return result;
  }

  function updateRain() {
    for (let i = 0; i < columns.length; i += 1) {
      const column = columns[i];
      column.offset = (column.offset + (pointerMode ? 2.1 : 1.35) * SCALE) % (8 * SCALE);
      for (let row = column.glyphs.length - 1; row > 0; row -= 1) {
        column.glyphs[row] = column.glyphs[row - 1];
      }
      column.glyphs[0] = randomGlyph();
    }
  }

  function draw(now) {
    if (!context || !canvas) return;
    const pressed = !reducedMotion && now < pressedUntil;
    context.clearRect(0, 0, WIDTH, HEIGHT);
    context.save();
    if (pressed) {
      context.translate(2.1 * SCALE, 2.3 * SCALE);
      context.scale(0.9, 0.9);
    } else if (pointerMode) {
      context.scale(1.08, 1.08);
    }
    if (!reducedMotion) {
      context.shadowColor = 'rgba(55,255,100,.15)';
      context.shadowBlur = (pointerMode ? 5 : 3) * SCALE;
    }
    context.fillStyle = 'rgba(0,5,2,.88)';
    context.fill(arrow);
    context.shadowBlur = 0;
    context.save();
    context.clip(arrow);
    context.font = `700 ${7 * SCALE}px monospace`;
    context.textAlign = 'center';
    context.textBaseline = 'top';
    const colors = pressed
      ? ['#D8FFD8', '#D8FFD8', '#7CFF7A', '#39FF14', '#18B842']
      : ['#D8FFD8', '#7CFF7A', '#39FF14', '#18B842', 'rgba(20,150,55,.25)'];
    for (let i = 0; i < columns.length; i += 1) {
      const column = columns[i];
      for (let row = 0; row < column.glyphs.length; row += 1) {
        context.fillStyle = colors[row];
        context.fillText(column.glyphs[row], column.x, row * 8 * SCALE + column.offset - 7 * SCALE);
      }
    }
    if (pointerMode) {
      context.fillStyle = pressed ? '#D8FFD8' : '#7CFF7A';
      context.font = `700 ${9 * SCALE}px monospace`;
      context.fillText('>', 22 * SCALE, 27 * SCALE);
    }
    context.restore();
    context.strokeStyle = pointerMode ? 'rgba(105,255,140,.82)' : 'rgba(80,255,120,.55)';
    context.lineWidth = 1 * SCALE;
    context.stroke(arrow);
    context.restore();
  }

  function tick(now) {
    animationFrame = 0;
    if (!canvas || document.hidden) return;
    const baseInterval = reducedMotion ? 125 : 72;
    const interval = pointerMode ? baseInterval * 0.82 : baseInterval;
    if (now - lastRainFrame >= interval) {
      updateRain();
      draw(now);
      lastRainFrame = now;
    } else if (now < pressedUntil) {
      draw(now);
    }
    animationFrame = requestAnimationFrame(tick);
  }

  function startLoop() {
    if (!animationFrame && canvas && !document.hidden) animationFrame = requestAnimationFrame(tick);
  }

  function setCanvasVisible(nextVisible) {
    visible = nextVisible;
    if (canvas) canvas.classList.toggle('is-visible', visible && !suppressed);
  }

  function updateTarget(target) {
    if (!canvas) return;
    const element = target instanceof Element ? target : null;
    const disabled = Boolean(element && element.closest(DISABLED_SELECTOR));
    const text = Boolean(element && element.closest(TEXT_SELECTOR));
    suppressed = disabled || text;
    document.documentElement.classList.toggle('matrix-cursor-text', text);
    document.documentElement.classList.toggle('matrix-cursor-disabled', disabled);
    pointerMode = Boolean(!suppressed && element && element.closest(INTERACTIVE_SELECTOR));
    canvas.classList.toggle('is-pointer', pointerMode);
    canvas.classList.toggle('is-visible', visible && !suppressed);
  }

  function initialise(event) {
    if (canvas || window.innerWidth < MIN_WIDTH) return;
    try {
      if (typeof Path2D !== 'function') return;
      const nextCanvas = document.createElement('canvas');
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      nextCanvas.className = 'matrix-cursor';
      nextCanvas.setAttribute('aria-hidden', 'true');
      nextCanvas.width = WIDTH * dpr;
      nextCanvas.height = HEIGHT * dpr;
      const nextContext = nextCanvas.getContext('2d');
      if (!nextContext) return;
      nextContext.setTransform(dpr, 0, 0, dpr, 0, 0);
      const nextArrow = new Path2D();
      nextArrow.moveTo(1 * SCALE, 1 * SCALE);
      nextArrow.lineTo(32 * SCALE, 28 * SCALE);
      nextArrow.lineTo(20 * SCALE, 30 * SCALE);
      nextArrow.lineTo(27 * SCALE, 42 * SCALE);
      nextArrow.lineTo(20 * SCALE, 45 * SCALE);
      nextArrow.lineTo(13 * SCALE, 32 * SCALE);
      nextArrow.lineTo(5 * SCALE, 40 * SCALE);
      nextArrow.closePath();
      document.body.appendChild(nextCanvas);
      canvas = nextCanvas;
      context = nextContext;
      arrow = nextArrow;
      columns = createColumns();
      x = event.clientX;
      y = event.clientY;
      canvas.style.transform = `translate3d(${x - HOTSPOT}px,${y - HOTSPOT}px,0)`;
      document.documentElement.classList.add('matrix-cursor-active');
      updateTarget(event.target);
      setCanvasVisible(true);
      draw(performance.now());
      startLoop();
    } catch (error) {
      destroy();
    }
  }

  function destroy() {
    if (animationFrame) cancelAnimationFrame(animationFrame);
    animationFrame = 0;
    if (canvas) canvas.remove();
    canvas = null;
    context = null;
    arrow = null;
    columns = null;
    visible = false;
    suppressed = false;
    document.documentElement.classList.remove('matrix-cursor-active', 'matrix-cursor-text', 'matrix-cursor-disabled');
  }

  function onPointerMove(event) {
    if (event.pointerType !== 'mouse' || window.innerWidth < MIN_WIDTH) return;
    if (!canvas) initialise(event);
    if (!canvas) return;
    x = event.clientX;
    y = event.clientY;
    canvas.style.transform = `translate3d(${x - HOTSPOT}px,${y - HOTSPOT}px,0)`;
    updateTarget(event.target);
    setCanvasVisible(true);
  }

  function onPointerDown(event) {
    if (!canvas || event.pointerType !== 'mouse' || suppressed || reducedMotion) return;
    pressedUntil = performance.now() + 150;
    draw(performance.now());
  }

  function onResize() {
    if (window.innerWidth < MIN_WIDTH) destroy();
  }

  function onVisibilityChange() {
    if (document.hidden) {
      if (animationFrame) cancelAnimationFrame(animationFrame);
      animationFrame = 0;
    } else {
      startLoop();
    }
  }

  reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.addEventListener('pointermove', onPointerMove, { passive: true });
  window.addEventListener('pointerdown', onPointerDown, { passive: true });
  window.addEventListener('pointerout', (event) => {
    if (!event.relatedTarget) setCanvasVisible(false);
  }, { passive: true });
  window.addEventListener('blur', () => setCanvasVisible(false));
  window.addEventListener('resize', onResize, { passive: true });
  document.addEventListener('visibilitychange', onVisibilityChange);
})();
