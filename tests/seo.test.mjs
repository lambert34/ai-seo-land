import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import vm from 'node:vm';

const page = await fs.readFile('seo-prodvizhenie/index.html', 'utf8');
const source = await fs.readFile('js/main.js', 'utf8');

test('SEO landing is indexable and references the existing business entity', () => {
  assert.match(page, /<title>SEO-продвижение сайтов в Яндексе и Google \| Lambert\/Digital<\/title>/);
  assert.match(page, /rel="canonical" href="https:\/\/lambert-digital.ru\/seo-prodvizhenie\/"/);
  assert.match(page, /name="robots" content="index, follow"/);
  assert.doesNotMatch(page, /noindex|hreflang="en"/);
  const graph = JSON.parse(page.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1])['@graph'];
  assert.equal(graph.find(x => x['@type'] === 'Service').provider['@id'], 'https://lambert-digital.ru/#business');
  assert.equal(graph.find(x => x['@type'] === 'BreadcrumbList').itemListElement[1].item, 'https://lambert-digital.ru/seo-prodvizhenie/');
  assert.equal((page.match(/<h1\b/g) || []).length, 1);
  assert.equal((page.match(/<section\b/g) || []).length, 10);
});

test('approved offers, confirmed case summaries and contact-only workflow', async () => {
  const pricing = page.split('id="pricing"')[1].split('</section>')[0];
  assert.equal((pricing.match(/class="card price-card"/g) || []).length, 2);
  assert.match(pricing, /от 10 000 ₽<\/strong><p class="seo-period">разово/);
  assert.match(pricing, /от 35 000 ₽<\/strong><p class="seo-period">в месяц/);
  const cases = await fs.readFile('cases/index.html', 'utf8');
  for (const [, summary] of cases.matchAll(/<p class="case-card__summary">([^<]+)<\/p>/g)) {
    if (/видимост/.test(summary)) assert.ok(page.includes(summary), summary);
  }
  assert.doesNotMatch(page, /Первый клиент через месяц|<form\b|web3forms|access_key|seo_form_submit/);
  assert.match(page, /href="https:\/\/t.me\/Lamfred"/);
  assert.match(page, /href="tel:\+79965013246"/);
  assert.match(page, /href="mailto:aleksandrlambert@gmail.com/);
  assert.doesNotMatch(page, /href="\/articles\/pochemu-sayt-ne-viden-v-poiske\//);
});

test('page links and sitemap have real destinations', async () => {
  const ids = new Set([...page.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));
  for (const [, href] of page.matchAll(/href="([^"]+)"/g)) {
    if (href.startsWith('#')) assert.ok(ids.has(href.slice(1)), href);
    if (href.startsWith('/')) {
      const path = href.split('#')[0];
      await fs.access('.' + path + (path.endsWith('/') ? 'index.html' : ''));
    }
  }
  assert.match(await fs.readFile('sitemap.xml', 'utf8'), /<loc>https:\/\/lambert-digital.ru\/seo-prodvizhenie\/<\/loc>/);
});

function analytics(allowed, seo = true) {
  const calls = [];
  const document = {
    body: { classList: { contains: name => seo && name === 'seo-page' } },
    addEventListener() {}, querySelector: () => null, querySelectorAll: () => []
  };
  const context = vm.createContext({
    document, window: { lambertAnalyticsAllowed: () => allowed, addEventListener() {} },
    console: { log() {}, warn() {} }, setTimeout() {},
    ym: (counter, method, goal, params, callback) => { calls.push({ counter, method, goal }); callback?.(); }
  });
  vm.runInContext(source, context);
  return { context, calls };
}
function click(state, { href, tracking, pricing = false, service = false }) {
  const link = {
    textContent: 'Связаться', dataset: { metrikaClick: tracking },
    getAttribute: key => key === 'href' ? href : null,
    matches: selector => selector === 'a',
    closest: selector => selector === '.pricing' && pricing || selector === '.services' && service ? {} : null
  };
  state.context.event = { target: { closest: () => link } };
  vm.runInContext('trackMetrikaClick(event)', state.context);
  return state.calls.map(x => x.goal);
}

test('SEO consultation and Telegram emit each goal once and preserve lead_click', () => {
  let state = analytics(true);
  assert.deepEqual(click(state, { href: '#contact-form', tracking: 'seo-consultation' }), ['seo_click_consultation', 'lead_click']);
  state = analytics(true);
  const goals = click(state, { href: 'https://t.me/Lamfred', tracking: 'seo-telegram' });
  assert.equal(goals.filter(x => x === 'seo_click_telegram').length, 1);
  assert.equal(goals.filter(x => x === 'lead_click').length, 1);
  assert.ok(goals.includes('click_telegram'));
  assert.ok(!goals.includes('seo_form_submit'));
  assert.ok(state.calls.every(x => x.counter === 109997768));
});

test('declined consent blocks goals even if ym is present; browsing a service is not a lead', () => {
  const state = analytics(false);
  assert.deepEqual(click(state, { href: 'https://t.me/Lamfred', tracking: 'seo-telegram' }), []);
  const accepted = analytics(true, false);
  assert.deepEqual(click(accepted, { href: '/seo-prodvizhenie/#pricing', tracking: 'view-seo-service', pricing: true }), []);
  const otherPage = analytics(true, false);
  const goals = click(otherPage, { href: 'https://t.me/Lamfred' });
  assert.ok(goals.includes('lead_click'));
  assert.ok(!goals.includes('seo_click_telegram'));
});
