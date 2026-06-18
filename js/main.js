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
