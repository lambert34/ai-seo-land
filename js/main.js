const METRIKA_COUNTER_ID = 109997768;
const LEAD_GOAL_ID = 'lead_click';

function sendMetrikaGoal(goalId) {
  if (typeof ym !== 'function') {
    console.warn('Метрика недоступна:', goalId);
    return;
  }

  let callbackReceived = false;

  ym(METRIKA_COUNTER_ID, 'reachGoal', goalId, {}, function () {
    callbackReceived = true;
    console.log('✅ Цель отправлена:', goalId);
  });

  setTimeout(function () {
    if (!callbackReceived) {
      console.warn('⚠️ Цель вызвана, но callback не получен:', goalId);
    }
  }, 5000);
}

function getLinkText(link) {
  return (link.textContent || '').trim().toLowerCase();
}

function isTelegramLink(link) {
  const href = (link.getAttribute('href') || '').toLowerCase();
  const text = getLinkText(link);
  return href.includes('t.me') || href.includes('telegram') || text.includes('telegram');
}

function isWhatsAppLink(link) {
  const href = (link.getAttribute('href') || '').toLowerCase();
  const text = getLinkText(link);
  return href.includes('wa.me') || href.includes('whatsapp') || text.includes('whatsapp');
}

function trackMetrikaClick(event) {
  const target = event.target.closest('a, button');
  if (!target) return;

  const goals = new Set();
  const href = (target.getAttribute('href') || '').toLowerCase();
  const trackingType = target.dataset.metrikaClick;
  const isBitrixPage = document.body.classList.contains('bitrix-support-page');

  if (isBitrixPage && trackingType === 'bitrix-estimate') goals.add('bitrix_click_estimate');
  if (isBitrixPage && trackingType === 'bitrix-telegram') goals.add('bitrix_click_telegram');
  if (isBitrixPage && trackingType === 'bitrix-whatsapp') goals.add('bitrix_click_whatsapp');
  if (isBitrixPage && trackingType === 'bitrix-phone') goals.add('bitrix_click_phone');
  const isLandingPage = document.body.classList.contains('landing-page');
  if (isLandingPage && trackingType === 'landing-discuss') goals.add('landing_click_discuss');
  if (isLandingPage && trackingType === 'landing-examples') goals.add('landing_click_examples');
  if (isLandingPage && trackingType === 'landing-telegram') goals.add('landing_click_telegram');
  if (isLandingPage && trackingType === 'landing-whatsapp') goals.add('landing_click_whatsapp');
  if (isLandingPage && trackingType === 'landing-phone') goals.add('landing_click_phone');

  if (href.startsWith('tel:')) goals.add('click_phone');
  if (target.matches('a') && isTelegramLink(target)) goals.add('click_telegram');
  if (target.matches('a') && isWhatsAppLink(target)) goals.add('click_whatsapp');
  if (href.startsWith('mailto:')) goals.add('click_email');

  if (trackingType === 'nav-pricing' || href === '#pricing') goals.add('click_nav_pricing');
  if (trackingType === 'discuss-project') goals.add('click_discuss_project');
  if (trackingType === 'view-services') goals.add('click_view_services');
  if (trackingType === 'discuss-service' || target.closest('.services')) goals.add('click_discuss_service');

  const isLandingServiceLink = trackingType === 'view-landing-service';
  if (isLandingServiceLink) goals.add('click_view_landing_service');
  if (
    !isLandingServiceLink
    && (trackingType === 'discuss-price' || target.closest('.pricing'))
  ) {
    goals.add('click_discuss_price');
  }

  if (
    goals.has('click_phone')
    || goals.has('click_telegram')
    || goals.has('click_whatsapp')
    || goals.has('click_email')
    || goals.has('click_discuss_project')
    || goals.has('click_discuss_service')
    || goals.has('click_discuss_price')
    || Array.from(goals).some((goal) => goal.startsWith('bitrix_click_'))
    || goals.has('landing_click_discuss')
    || goals.has('landing_click_telegram')
    || goals.has('landing_click_whatsapp')
    || goals.has('landing_click_phone')
  ) {
    goals.add(LEAD_GOAL_ID);
  }

  goals.forEach(sendMetrikaGoal);
}

document.addEventListener('click', trackMetrikaClick);

document.querySelectorAll('[data-bitrix-form]').forEach((form) => {
  form.addEventListener('submit', (event) => {
    if (!form.checkValidity()) return;

    // TODO: replace FORM_ENDPOINT in HTML with the real server-side form handler.
    if (form.action.endsWith('/FORM_ENDPOINT') || form.getAttribute('action') === 'FORM_ENDPOINT') {
      event.preventDefault();
      const status = form.querySelector('[data-form-status]');
      if (status) status.textContent = 'Форма пока не подключена. Отправьте задачу через Telegram, WhatsApp, телефон или email.';
      return;
    }

    sendMetrikaGoal('bitrix_form_submit');
    sendMetrikaGoal(LEAD_GOAL_ID);
  });
});

document.querySelectorAll('[data-landing-form]').forEach((form) => {
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!form.checkValidity()) {
      form.reportValidity();
      return;
    }

    const status = form.querySelector('[data-form-status]');
    // TODO: replace FORM_ENDPOINT in HTML with the real server-side form handler.
    if (form.action.endsWith('/FORM_ENDPOINT') || form.getAttribute('action') === 'FORM_ENDPOINT') {
      if (status) status.textContent = 'Форма пока не подключена. Отправьте задачу через Telegram, WhatsApp, телефон или email.';
      return;
    }

    if (status) status.textContent = 'Отправляю…';
    try {
      const response = await fetch(form.action, { method: form.method, body: new FormData(form), headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      if (status) status.textContent = 'Заявка отправлена. Я свяжусь с вами по указанному контакту.';
      sendMetrikaGoal('landing_form_submit');
      sendMetrikaGoal(LEAD_GOAL_ID);
      form.reset();
    } catch (error) {
      if (status) status.textContent = 'Не удалось отправить заявку. Данные сохранены — попробуйте ещё раз или напишите мне напрямую.';
      console.error('Ошибка отправки формы:', error);
    }
  });
});

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


function initImageLightbox() {
  const lightbox = document.querySelector('[data-image-lightbox]');
  if (!lightbox) return;

  const image = lightbox.querySelector('[data-lightbox-target-image]');
  const caption = lightbox.querySelector('[data-lightbox-caption]');
  const triggers = document.querySelectorAll('[data-lightbox-image]');
  const closeButtons = lightbox.querySelectorAll('[data-lightbox-close]');

  if (!image || !caption || !triggers.length) return;

  function openLightbox(src, title) {
    image.src = src;
    image.alt = title || 'Изображение кейса';
    caption.textContent = title || '';
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
    document.body.classList.add('lightbox-open');
  }

  function closeLightbox() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    document.body.classList.remove('lightbox-open');
    image.src = '';
    image.alt = '';
    caption.textContent = '';
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      openLightbox(trigger.dataset.lightboxImage, trigger.dataset.lightboxTitle);
    });
  });

  closeButtons.forEach((button) => {
    button.addEventListener('click', closeLightbox);
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && lightbox.classList.contains('is-open')) {
      closeLightbox();
    }
  });
}

initImageLightbox();

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
