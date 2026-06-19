const burger = document.querySelector('[data-burger]');
const nav = document.querySelector('[data-nav]');
const toTop = document.querySelector('[data-to-top]');
const slider = document.querySelector('[data-slider]');

function closeMenu() {
  if (!burger || !nav) return;
  burger.classList.remove('is-active');
  nav.classList.remove('is-open');
  burger.setAttribute('aria-expanded', 'false');
  document.body.classList.remove('nav-open');
}

burger?.addEventListener('click', () => {
  const isOpen = nav.classList.toggle('is-open');
  burger.classList.toggle('is-active', isOpen);
  burger.setAttribute('aria-expanded', String(isOpen));
  document.body.classList.toggle('nav-open', isOpen);
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const targetId = link.getAttribute('href');
    const target = targetId && targetId.length > 1 ? document.querySelector(targetId) : null;
    if (!target) return;
    event.preventDefault();
    closeMenu();
    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });
});

window.addEventListener('scroll', () => {
  toTop?.classList.toggle('is-visible', window.scrollY > 520);
}, { passive: true });

toTop?.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));

document.querySelectorAll('img[data-fallback]').forEach((image) => {
  image.addEventListener('error', () => {
    const fallback = image.dataset.fallback;
    if (fallback && image.src.indexOf(fallback) === -1) image.src = fallback;
  }, { once: true });
});

function phoneMaskDraft(input) {
  let digits = input.value.replace(/\D/g, '').slice(0, 11);
  if (digits.startsWith('8')) digits = `7${digits.slice(1)}`;
  if (!digits.startsWith('7')) digits = `7${digits}`;
  const parts = digits.match(/^(7)(\d{0,3})(\d{0,3})(\d{0,2})(\d{0,2})$/);
  if (!parts) return;
  input.value = `+${parts[1]}${parts[2] ? ` ${parts[2]}` : ''}${parts[3] ? ` ${parts[3]}` : ''}${parts[4] ? `-${parts[4]}` : ''}${parts[5] ? `-${parts[5]}` : ''}`;
}

document.querySelectorAll('[data-phone-mask]').forEach((input) => {
  input.addEventListener('input', () => phoneMaskDraft(input));
});

if (slider) {
  const track = slider.querySelector('[data-slider-track]');
  const slides = Array.from(slider.querySelectorAll('.slider__slide'));
  const prev = slider.querySelector('[data-slider-prev]');
  const next = slider.querySelector('[data-slider-next]');
  const dots = slider.querySelector('[data-slider-dots]');
  let index = 0;
  let startX = 0;

  slides.forEach((_, slideIndex) => {
    const dot = document.createElement('button');
    dot.type = 'button';
    dot.setAttribute('aria-label', `Показать слайд ${slideIndex + 1}`);
    dot.addEventListener('click', () => goTo(slideIndex));
    dots.append(dot);
  });

  function goTo(nextIndex) {
    index = (nextIndex + slides.length) % slides.length;
    track.style.transform = `translateX(-${index * 100}%)`;
    dots.querySelectorAll('button').forEach((dot, dotIndex) => {
      dot.classList.toggle('is-active', dotIndex === index);
    });
  }

  prev?.addEventListener('click', () => goTo(index - 1));
  next?.addEventListener('click', () => goTo(index + 1));
  track.addEventListener('touchstart', (event) => { startX = event.touches[0].clientX; }, { passive: true });
  track.addEventListener('touchend', (event) => {
    const diff = startX - event.changedTouches[0].clientX;
    if (Math.abs(diff) > 45) goTo(index + (diff > 0 ? 1 : -1));
  }, { passive: true });
  goTo(0);
}

function initCursorSmoke() {
  const supportsFineHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!supportsFineHover || prefersReducedMotion) return;

  let lastSmokeTime = 0;
  const smokeThrottle = 55;

  window.addEventListener('mousemove', (event) => {
    const now = performance.now();
    if (now - lastSmokeTime < smokeThrottle) return;
    lastSmokeTime = now;

    const smoke = document.createElement('span');
    const size = Math.round(4 + Math.random() * 6);
    const driftX = `${Math.round((Math.random() - 0.5) * 18)}px`;
    const driftY = `${Math.round(-6 - Math.random() * 14)}px`;
    const blur = `${Math.round(4 + Math.random() * 4)}px`;
    const opacity = (0.12 + Math.random() * 0.08).toFixed(2);

    smoke.className = 'cursor-smoke';
    smoke.style.left = `${event.clientX}px`;
    smoke.style.top = `${event.clientY}px`;
    smoke.style.setProperty('--smoke-size', `${size}px`);
    smoke.style.setProperty('--smoke-drift-x', driftX);
    smoke.style.setProperty('--smoke-drift-y', driftY);
    smoke.style.setProperty('--smoke-blur', blur);
    smoke.style.setProperty('--smoke-opacity', opacity);
    smoke.addEventListener('animationend', () => smoke.remove(), { once: true });
    document.body.append(smoke);
  }, { passive: true });
}

initCursorSmoke();
