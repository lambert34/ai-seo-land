(function initCursorSmoke() {
  const desktopQuery = window.matchMedia('(min-width: 901px)');
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  let destroyEffect = null;

  function canStartEffect() {
    return desktopQuery.matches;
  }

  function createEffect() {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return function () {};

    canvas.className = 'cursor-smoke-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    canvas.dataset.smokeActive = 'true';
    Object.assign(canvas.style, {
      position: 'fixed',
      inset: '0',
      zIndex: '90',
      width: '100%',
      height: '100%',
      pointerEvents: 'none'
    });
    document.body.append(canvas);

    const particles = [];
    const cursor = { x: 0, y: 0, smoothX: 0, smoothY: 0, previousX: 0, previousY: 0 };
    let cursorReady = false;
    let pointerInside = false;
    let movementPending = false;
    let frameId = 0;
    let previousFrame = performance.now();
    let dpr = 1;

    function resizeCanvas() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(window.innerWidth * dpr);
      canvas.height = Math.round(window.innerHeight * dpr);
      context.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function addParticle(x, y, speed) {
      const reducedMotion = motionQuery.matches;
      const maxParticles = reducedMotion ? 35 : 90;
      if (particles.length >= maxParticles) particles.shift();
      const lifetime = reducedMotion
        ? 700 + Math.random() * 300
        : 1100 + Math.random() * 700;
      particles.push({
        x: x + (Math.random() - 0.5) * 2.5,
        y: y + (Math.random() - 0.5) * 2.5,
        velocityX: (Math.random() - 0.5) * 4 - speed * 0.012,
        velocityY: -7 - Math.random() * 8,
        age: 0,
        lifetime,
        radius: 4 + Math.random() * 3.5,
        growth: 10 + Math.random() * 8,
        alpha: (0.14 + Math.random() * 0.09) * (reducedMotion ? 0.75 : 1),
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: reducedMotion ? 0 : 1.2 + Math.random() * 1.4,
        wobbleAmount: reducedMotion ? 0 : 4
      });
    }

    function drawParticle(particle) {
      const progress = particle.age / particle.lifetime;
      const radius = particle.radius + particle.growth * progress;
      const fadeIn = Math.min(progress / 0.12, 1);
      const opacity = particle.alpha * fadeIn * Math.pow(1 - progress, 1.7);
      const gradient = context.createRadialGradient(
        particle.x, particle.y, radius * 0.08,
        particle.x, particle.y, radius
      );
      gradient.addColorStop(0, `rgba(230, 232, 235, ${opacity})`);
      gradient.addColorStop(0.42, `rgba(205, 208, 213, ${opacity * 0.62})`);
      gradient.addColorStop(1, 'rgba(190, 194, 200, 0)');
      context.fillStyle = gradient;
      context.beginPath();
      context.arc(particle.x, particle.y, radius, 0, Math.PI * 2);
      context.fill();
    }

    function animate(now) {
      frameId = 0;
      if (dpr !== Math.min(window.devicePixelRatio || 1, 2)) resizeCanvas();
      const elapsed = Math.min(now - previousFrame, 34);
      const seconds = elapsed / 1000;
      previousFrame = now;
      context.clearRect(0, 0, window.innerWidth, window.innerHeight);

      if (movementPending && pointerInside) {
        cursor.smoothX += (cursor.x - cursor.smoothX) * 0.24;
        cursor.smoothY += (cursor.y - cursor.smoothY) * 0.24;
        const distance = Math.hypot(cursor.smoothX - cursor.previousX, cursor.smoothY - cursor.previousY);
        if (distance > 1.5) {
          const reducedMotion = motionQuery.matches;
          const steps = Math.min(
            reducedMotion ? 2 : 5,
            Math.max(1, Math.floor(distance / 8))
          );
          for (let step = 1; step <= steps; step += 1) {
            const ratio = step / steps;
            addParticle(
              cursor.previousX + (cursor.smoothX - cursor.previousX) * ratio,
              cursor.previousY + (cursor.smoothY - cursor.previousY) * ratio,
              distance
            );
          }
          cursor.previousX = cursor.smoothX;
          cursor.previousY = cursor.smoothY;
        }
        if (Math.hypot(cursor.x - cursor.smoothX, cursor.y - cursor.smoothY) < 0.8) {
          movementPending = false;
        }
      }

      for (let index = particles.length - 1; index >= 0; index -= 1) {
        const particle = particles[index];
        particle.age += elapsed;
        if (particle.age >= particle.lifetime) {
          particles.splice(index, 1);
          continue;
        }
        particle.wobble += particle.wobbleSpeed * seconds;
        particle.x += (particle.velocityX + Math.sin(particle.wobble) * particle.wobbleAmount) * seconds;
        particle.y += particle.velocityY * seconds;
        drawParticle(particle);
      }

      if (particles.length || movementPending) frameId = requestAnimationFrame(animate);
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
        cursor.smoothX = cursor.previousX = cursor.x;
        cursor.smoothY = cursor.previousY = cursor.y;
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
        particles.length = 0;
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
    if (!canStartEffect()) return;
    if (destroyEffect) return;

    destroyEffect = createEffect();

    if (typeof destroyEffect.handleMouseMove === 'function') {
      destroyEffect.handleMouseMove(event);
    }
  }

  function disableEffectWhenNeeded() {
    if (canStartEffect() || !destroyEffect) return;

    destroyEffect();
    destroyEffect = null;
  }

  window.addEventListener('mousemove', handleMouseDetection, { passive: true });
  desktopQuery.addEventListener('change', disableEffectWhenNeeded);
}());
