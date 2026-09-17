(() => {
  'use strict';

  const storageKey = 'lambert_cookie_consent';
  const counterId = 109997768;
  let metrikaStarted = false;

  function startMetrika() {
    if (metrikaStarted) return;
    metrikaStarted = true;
    window.ym = window.ym || function () {
      (window.ym.a = window.ym.a || []).push(arguments);
    };
    window.ym.l = Date.now();
    const script = document.createElement('script');
    script.async = true;
    script.src = 'https://mc.yandex.ru/metrika/tag.js';
    document.head.append(script);
    window.ym(counterId, 'init', {
      clickmap: true,
      trackLinks: true,
      accurateTrackBounce: true,
      webvisor: true
    });
  }

  function readPreference() {
    try { return localStorage.getItem(storageKey); } catch { return null; }
  }

  function savePreference(value) {
    try { localStorage.setItem(storageKey, value); } catch { /* Banner remains dismissed for this visit. */ }
  }

  const english = document.documentElement.lang === 'en';
  const preference = readPreference();
  if (preference === 'all') startMetrika();
  if (preference === 'all' || preference === 'necessary') return;

  document.addEventListener('DOMContentLoaded', () => {
    const banner = document.createElement('aside');
    banner.className = 'cookie-banner';
    banner.setAttribute('aria-labelledby', 'cookie-banner-title');

    const content = document.createElement('div');
    content.className = 'cookie-banner__content';
    const title = document.createElement('strong');
    title.id = 'cookie-banner-title';
    title.textContent = english ? 'We use cookies' : 'Мы используем cookie';
    const text = document.createElement('p');
    text.append(english ? 'This website uses necessary cookies and Yandex Metrica for audience analytics. Read our ' : 'Сайт использует необходимые cookie для работы и Яндекс.Метрику для анализа посещаемости. Подробнее — в ');
    const link = document.createElement('a');
    link.href = english ? '/en/cookies/' : '/cookies/';
    link.textContent = english ? 'Cookie Policy' : 'Политике cookie';
    text.append(link, '.');
    content.append(title, text);

    const actions = document.createElement('div');
    actions.className = 'cookie-banner__actions';
    const accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'button button--small';
    accept.textContent = english ? 'Accept' : 'Принять';
    const necessary = document.createElement('button');
    necessary.type = 'button';
    necessary.className = 'button button--small button--secondary';
    necessary.textContent = english ? 'Necessary only' : 'Только необходимые';
    actions.append(accept, necessary);
    banner.append(content, actions);
    document.body.append(banner);

    const choose = value => {
      savePreference(value);
      banner.remove();
      if (value === 'all') startMetrika();
    };
    accept.addEventListener('click', () => choose('all'));
    necessary.addEventListener('click', () => choose('necessary'));
  });
})();
