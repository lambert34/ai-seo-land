(() => {
  'use strict';
  document.addEventListener('click', event => {
    const link = event.target.closest('[data-language]');
    if (!link) return;
    try { localStorage.setItem('lambert_language', link.dataset.language); } catch { /* Navigation remains available without storage. */ }
  });
})();
