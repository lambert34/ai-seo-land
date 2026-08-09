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
  const isZarubReferral = trackingType === 'zarub-referral';
  const isBitrixPage = document.body.classList.contains('bitrix-support-page');
  const isSiteHelpPage = document.body.classList.contains('site-help-page');

  if (isBitrixPage && trackingType === 'bitrix-estimate') goals.add('bitrix_click_estimate');
  if (isBitrixPage && trackingType === 'bitrix-telegram') goals.add('bitrix_click_telegram');
  if (isBitrixPage && trackingType === 'bitrix-whatsapp') goals.add('bitrix_click_whatsapp');
  if (isBitrixPage && trackingType === 'bitrix-phone') goals.add('bitrix_click_phone');
  if (isSiteHelpPage && trackingType === 'site-help-diagnose') goals.add('site_help_click_diagnose');
  if (isSiteHelpPage && trackingType === 'site-help-telegram') goals.add('site_help_click_telegram');
  if (isSiteHelpPage && trackingType === 'site-help-whatsapp') goals.add('site_help_click_whatsapp');
  if (isSiteHelpPage && trackingType === 'site-help-phone') goals.add('site_help_click_phone');
  if (isSiteHelpPage && trackingType === 'site-help-bitrix-support') goals.add('site_help_click_bitrix_support');
  const isLandingPage = document.body.classList.contains('landing-page');
  if (isLandingPage && trackingType === 'landing-discuss') goals.add('landing_click_discuss');
  if (isLandingPage && trackingType === 'landing-examples') goals.add('landing_click_examples');
  if (isLandingPage && trackingType === 'landing-telegram') goals.add('landing_click_telegram');
  if (isLandingPage && trackingType === 'landing-whatsapp') goals.add('landing_click_whatsapp');
  if (isLandingPage && trackingType === 'landing-phone') goals.add('landing_click_phone');

  if (href.startsWith('tel:')) goals.add('click_phone');
  if (isZarubReferral) goals.add('zarub_referral_click');
  if (target.matches('a') && isTelegramLink(target) && !isZarubReferral) goals.add('click_telegram');
  if (target.matches('a') && isWhatsAppLink(target)) goals.add('click_whatsapp');
  if (href.startsWith('mailto:')) goals.add('click_email');

  if (trackingType === 'nav-pricing' || href === '#pricing') goals.add('click_nav_pricing');
  if (trackingType === 'discuss-project') goals.add('click_discuss_project');
  if (trackingType === 'view-services') goals.add('click_view_services');
  if (trackingType === 'discuss-service' || target.closest('.services')) goals.add('click_discuss_service');

  const isLandingServiceLink = trackingType === 'view-landing-service';
  const isSiteHelpServiceLink = trackingType === 'view-site-help-service';
  if (isLandingServiceLink) goals.add('click_view_landing_service');
  if (isSiteHelpServiceLink) goals.add('click_view_site_help_service');
  if (
    !isLandingServiceLink
    && !isSiteHelpServiceLink
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
    || goals.has('site_help_click_diagnose')
    || goals.has('site_help_click_telegram')
    || goals.has('site_help_click_whatsapp')
    || goals.has('site_help_click_phone')
  ) {
    goals.add(LEAD_GOAL_ID);
  }

  goals.forEach(sendMetrikaGoal);
}

document.addEventListener('click', trackMetrikaClick);

function initWeb3Forms() {
  const forms = document.querySelectorAll('form[data-web3forms]');

  forms.forEach((form) => {
    if (form.dataset.web3formsInitialized === 'true') return;

    form.dataset.web3formsInitialized = 'true';

    form.addEventListener('submit', async (event) => {
      event.preventDefault();

      if (!form.checkValidity()) {
        form.reportValidity();
        return;
      }

      if (form.dataset.submitting === 'true') return;

      const status = form.querySelector('[data-form-status]');
      const submitButton = form.querySelector('[type="submit"]');
      const originalButtonText = submitButton ? submitButton.textContent : '';

      form.dataset.submitting = 'true';
      form.setAttribute('aria-busy', 'true');

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.textContent = 'Отправляю…';
      }

      if (status) {
        status.textContent = 'Отправляю заявку…';
        status.classList.remove('is-success', 'is-error');
        status.classList.add('is-pending');
      }

      try {
        const formData = new FormData(form);

        formData.set('page_url', window.location.href);
        formData.set('page_title', document.title);
        formData.set('submitted_at', new Date().toLocaleString('ru-RU'));

        const response = await fetch('https://api.web3forms.com/submit', {
          method: 'POST',
          body: formData,
          headers: {
            Accept: 'application/json'
          }
        });

        let result = null;

        try {
          result = await response.json();
        } catch (parseError) {
          console.error('Не удалось прочитать ответ Web3Forms:', parseError);
        }

        if (!response.ok || result?.success !== true) {
          throw new Error(
            result?.message
            || result?.body?.message
            || `HTTP ${response.status}`
          );
        }

        if (status) {
          status.textContent = form.dataset.successMessage || 'Заявка успешно отправлена.';
          status.classList.remove('is-pending', 'is-error');
          status.classList.add('is-success');
        }

        const formGoal = form.dataset.formGoal;

        if (formGoal) {
          sendMetrikaGoal(formGoal);
        }

        sendMetrikaGoal(LEAD_GOAL_ID);
        form.reset();
      } catch (error) {
        console.error('Ошибка отправки формы Web3Forms:', error);

        if (status) {
          status.textContent = 'Не удалось отправить заявку. Введённые данные сохранены — попробуйте ещё раз или напишите мне в Telegram.';
          status.classList.remove('is-pending', 'is-success');
          status.classList.add('is-error');
        }
      } finally {
        form.dataset.submitting = 'false';
        form.removeAttribute('aria-busy');

        if (submitButton) {
          submitButton.disabled = false;
          submitButton.textContent = originalButtonText;
        }
      }
    });
  });
}

initWeb3Forms();

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
