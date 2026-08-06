(function initCursorSmoke() {
  const pointerQuery = window.matchMedia('(hover: hover) and (pointer: fine)');
  const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  const maxParticles = 72;
  let destroyEffect = null;

  function isEligible() {
    return pointerQuery.matches && !motionQuery.matches && navigator.maxTouchPoints === 0;
  }

  function createEffect() {
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { alpha: true });
    if (!context) return function () {};

    canvas.className = 'cursor-smoke-canvas';
    canvas.setAttribute('aria-hidden', 'true');
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
      if (particles.length >= maxParticles) particles.shift();
      const lifetime = 850 + Math.random() * 500;
      particles.push({
        x: x + (Math.random() - 0.5) * 2.5,
        y: y + (Math.random() - 0.5) * 2.5,
        velocityX: (Math.random() - 0.5) * 4 - speed * 0.012,
        velocityY: -7 - Math.random() * 8,
        age: 0,
        lifetime,
        radius: 2.2 + Math.random() * 2.3,
        growth: 5 + Math.random() * 5,
        alpha: 0.045 + Math.random() * 0.035,
        wobble: Math.random() * Math.PI * 2,
        wobbleSpeed: 1.2 + Math.random() * 1.4
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
          const steps = Math.min(3, Math.max(1, Math.floor(distance / 14)));
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
        particle.x += (particle.velocityX + Math.sin(particle.wobble) * 4) * seconds;
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

    function onPointerMove(event) {
      if (event.pointerType && event.pointerType !== 'mouse') return;
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
    window.addEventListener('pointermove', onPointerMove, { passive: true });
    document.documentElement.addEventListener('mouseleave', onPointerLeave);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return function destroy() {
      if (frameId) cancelAnimationFrame(frameId);
      window.removeEventListener('resize', resizeCanvas);
      window.removeEventListener('pointermove', onPointerMove);
      document.documentElement.removeEventListener('mouseleave', onPointerLeave);
      document.removeEventListener('visibilitychange', onVisibilityChange);
      canvas.remove();
    };
  }

  function syncEffect() {
    if (destroyEffect) {
      destroyEffect();
      destroyEffect = null;
    }
    if (isEligible()) destroyEffect = createEffect();
  }

  pointerQuery.addEventListener('change', syncEffect);
  motionQuery.addEventListener('change', syncEffect);
  syncEffect();
}());
