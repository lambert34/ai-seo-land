(() => {
  'use strict';

  const close = switcher => {
    switcher.classList.remove('is-open');
    switcher.querySelector('.language-switcher__trigger')?.setAttribute('aria-expanded', 'false');
  };

  document.addEventListener('click', event => {
    const trigger = event.target.closest('.language-switcher__trigger');
    if (trigger) {
      const switcher = trigger.closest('[data-language-switcher]');
      const opening = !switcher.classList.contains('is-open');
      document.querySelectorAll('[data-language-switcher].is-open').forEach(close);
      if (opening) {
        switcher.classList.add('is-open');
        trigger.setAttribute('aria-expanded', 'true');
      }
      return;
    }
    const link = event.target.closest('[data-language]');
    if (link) {
      try { localStorage.setItem('lambert_language', link.dataset.language); } catch { /* Navigation remains available without storage. */ }
      return;
    }
    document.querySelectorAll('[data-language-switcher].is-open').forEach(close);
  });

  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    const open = document.querySelector('[data-language-switcher].is-open');
    if (!open) return;
    close(open);
    open.querySelector('.language-switcher__trigger')?.focus();
  });
})();
