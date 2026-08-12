import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { buildArticles, assignAnchors, minuteLabel, readingMinutes } from '../scripts/build-articles.mjs';

const root = path.resolve('.');
const valid = (overrides = {}) => ({
  title: 'Тестовая статья', slug: 'test-article', description: 'Описание карточки', category: 'ai',
  datePublished: '2026-08-11', dateModified: '2026-08-11', status: 'published',
  seo: { description: 'SEO описание', robots: 'index, follow' }, lead: '<p>Вступление.</p>',
  blocks: [{ type: 'h2', heading: 'Раздел' }, { type: 'text', content: '<p>Безопасный текст.</p>' }], ...overrides
});
async function fixture(articles) {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'articles-'));
  await fs.mkdir(path.join(dir, 'content/articles'), { recursive:true }); await fs.mkdir(path.join(dir, 'articles/demo-article'), { recursive:true }); await fs.mkdir(path.join(dir, 'templates'));
  await fs.copyFile(path.join(root,'templates/article.html'),path.join(dir,'templates/article.html')); await fs.copyFile(path.join(root,'templates/article-card.html'),path.join(dir,'templates/article-card.html'));
  await fs.writeFile(path.join(dir,'articles/demo-article/index.html'),'<meta name="robots" content="noindex, follow">');
  await fs.writeFile(path.join(dir,'sitemap.xml'),'<?xml version="1.0"?><urlset><url><loc>https://lambert-digital.ru/about/</loc></url></urlset>');
  for (const [name,data] of Object.entries(articles)) await fs.writeFile(path.join(dir,`content/articles/${name}.yml`),typeof data==='string'?data:JSON.stringify(data));
  return dir;
}
async function expectError(article, pattern, extra={}) { const dir=await fixture({a:article,...extra}); await assert.rejects(()=>buildArticles({root:dir}),pattern); }

test('valid published article completes source → HTML → card → sitemap → schema', async () => {
  const dir=await fixture({published:valid({blocks:[{type:'h2',heading:'Одинаковый'},{type:'text',content:'<p>Текст.</p>'},{type:'h2',heading:'Одинаковый'},{type:'faq',items:[{question:'Вопрос?',answer:'Ответ.'}]},{type:'cta',heading:'CTA',description:'Описание',label:'Внешняя',url:'https://example.com',linkType:'external'},{type:'cta',heading:'Партнёр',description:'Описание',label:'Zarub',url:'https://t.me/zarub_robot?start=ref_test',linkType:'affiliate',tracking:'zarub-referral'},{type:'cta',heading:'Внутренняя',description:'Описание',label:'О нас',url:'/about/',linkType:'internal'}]})});
  await buildArticles({root:dir}); const html=await fs.readFile(path.join(dir,'articles/test-article/index.html'),'utf8'); const catalog=await fs.readFile(path.join(dir,'articles/index.html'),'utf8'); const sitemap=await fs.readFile(path.join(dir,'sitemap.xml'),'utf8');
  assert.equal((html.match(/<h1>/g)||[]).length,1); assert.match(html,/rel="canonical" href="https:\/\/lambert-digital.ru\/articles\/test-article\/"/); assert.match(html,/BlogPosting/); assert.match(html,/BreadcrumbList/); assert.match(html,/FAQPage/); assert.match(html,/href="#odinakovyy-2"/); assert.match(html,/id="odinakovyy-2"/); assert.match(html,/target="_blank" rel="noopener noreferrer"/); assert.match(html,/rel="sponsored noopener noreferrer" data-metrika-click="zarub-referral"/); assert.match(html,/href="\/about\/">О нас/); assert.doesNotMatch(html,/href="\/about\/" target/); assert.match(catalog,/article-card__clickable/); assert.match(sitemap,/test-article/); assert.match(sitemap,/\/about\//);
});
test('real Pages CMS _block and Markdown output validates and renders completely', async()=>{
  const words='слово '.repeat(191);
  const dir=await fixture({cms:valid({lead:'Вступление с **акцентом**.',heroCta:{label:'Помощь',url:'https://lambert-digital.ru/site-help/',linkType:'internal'},blocks:[{_block:'h2',heading:'Тест'},{_block:'text',content:`Текст с **выделением** и [ссылкой](/about/). ${words}\n\n## Подраздел\n\n1. Первый пункт`},{_block:'cta',heading:'CTA',description:'Описание',label:'Подробнее',url:'/site-help/',linkType:'internal'}]})});
  const {published}=await buildArticles({root:dir});
  const html=await fs.readFile(path.join(dir,'articles/test-article/index.html'),'utf8');
  assert.equal(published.length,1);assert.match(html,/href="#test">Тест/);assert.match(html,/<p>Текст с <strong>выделением<\/strong>/);assert.match(html,/<h2>Подраздел<\/h2>/);assert.match(html,/<ol><li>Первый пункт<\/li><\/ol>/);assert.match(html,/href="\/site-help\/">Подробнее/);assert.match(html,/href="\/site-help\/">Помощь/);assert.doesNotMatch(html,/site-help\/" target=/);assert.match(html,/Время чтения: 2 минуты/);assert.doesNotMatch(html,/\*\*|\[ссылкой\]\(|##/);
});
test('unknown Pages CMS _block fails with a clear error',()=>expectError(valid({blocks:[{_block:'mystery'}]}),/неизвестный тип блока #1: "mystery"/));
test('draft validates but produces no URL, card or sitemap entry', async()=>{const dir=await fixture({draft:valid({slug:'draft-article',status:'draft'})});await buildArticles({root:dir});await assert.rejects(fs.access(path.join(dir,'articles/draft-article/index.html')));assert.doesNotMatch(await fs.readFile(path.join(dir,'articles/index.html'),'utf8'),/draft-article/);assert.doesNotMatch(await fs.readFile(path.join(dir,'sitemap.xml'),'utf8'),/draft-article/);});
test('acceptance: changing draft to published creates every public artifact',async()=>{const dir=await fixture({acceptance:valid({slug:'acceptance-article',status:'draft'})});await buildArticles({root:dir});const p=path.join(dir,'content/articles/acceptance.yml');const a=JSON.parse(await fs.readFile(p));a.status='published';await fs.writeFile(p,JSON.stringify(a));await buildArticles({root:dir});const html=await fs.readFile(path.join(dir,'articles/acceptance-article/index.html'),'utf8');assert.match(html,/canonical/);assert.match(html,/article-toc/);assert.match(html,/BlogPosting/);assert.match(await fs.readFile(path.join(dir,'articles/index.html'),'utf8'),/acceptance-article/);assert.match(await fs.readFile(path.join(dir,'sitemap.xml'),'utf8'),/acceptance-article/);});
test('duplicate slug',()=>expectError(valid(),/duplicate slug/,{b:valid()}));
test('invalid slug',()=>expectError(valid({slug:'Плохой slug'}),/invalid slug/));
test('missing title',()=>expectError(valid({title:''}),/title/));
test('missing card description',()=>expectError(valid({description:''}),/description/));
test('missing SEO description',()=>expectError(valid({seo:{description:''}}),/seo.description/));
test('unknown category',()=>expectError(valid({category:'other'}),/category/));
test('unknown status',()=>expectError(valid({status:'scheduled'}),/status/));
test('image without alt',()=>expectError(valid({blocks:[{type:'image',file:'/a.webp'}]}),/file и alt/));
test('unsafe URL and invalid YAML fail clearly',async()=>{await expectError(valid({blocks:[{type:'cta',heading:'x',description:'x',label:'x',url:'javascript:alert(1)',linkType:'external'}]}),/недопустимый URL/);const dir=await fixture({bad:'not: [valid'});await assert.rejects(()=>buildArticles({root:dir}),/невалидный YAML\/JSON/);});
test('automatic and duplicate anchors are stable',()=>assert.deepEqual(assignAnchors([{type:'h2',heading:'Тест раздел'},{type:'h2',heading:'Тест раздел'}]).map(x=>x.anchor),['test-razdel','test-razdel-2']));
test('reading time and Russian forms',()=>{assert.equal(readingMinutes(valid({lead:'слово '.repeat(191),blocks:[]})),2);assert.equal(minuteLabel(1),'1 минута');assert.equal(minuteLabel(2),'2 минуты');assert.equal(minuteLabel(5),'5 минут');assert.equal(minuteLabel(11),'11 минут');assert.equal(minuteLabel(21),'21 минута');});
test('production pages keep required SEO, TOC targets and draft/demo exclusions',async()=>{const {articles,published}=await buildArticles();const files=['pochemu-sayt-na-bitrix-rabotaet-medlenno','kak-oplatit-chatgpt-iz-rossii'];assert.equal(published.length,2);assert.equal(articles.find(a=>a.slug==='sayt-ne-rabotaet-chto-delat')?.status,'draft');for(const slug of files){const html=await fs.readFile(path.join(root,`articles/${slug}/index.html`),'utf8');assert.equal((html.match(/<h1>/g)||[]).length,1);assert.match(html,/BlogPosting/);assert.match(html,/BreadcrumbList/);for(const id of [...html.matchAll(/<a href="#([^"]+)"/g)].map(x=>x[1]))assert.match(html,new RegExp(`id="${id}"`));}await assert.rejects(fs.access(path.join(root,'articles/sayt-ne-rabotaet-chto-delat/index.html')));await fs.access(path.join(root,'assets/images/articles/404.png'));const catalog=await fs.readFile(path.join(root,'articles/index.html'),'utf8');assert.doesNotMatch(catalog,/sayt-ne-rabotaet-chto-delat/);assert.equal((catalog.match(/article-card__clickable/g)||[]).length,2);const bitrix=await fs.readFile(path.join(root,'articles/pochemu-sayt-na-bitrix-rabotaet-medlenno/index.html'),'utf8');const zarub=await fs.readFile(path.join(root,'articles/kak-oplatit-chatgpt-iz-rossii/index.html'),'utf8');assert.match(bitrix,/FAQPage/);assert.doesNotMatch(zarub,/FAQPage/);assert.match(zarub,/ref_iSQcKm/);assert.match(zarub,/zarub-referral/);const map=await fs.readFile(path.join(root,'sitemap.xml'),'utf8');assert.doesNotMatch(map,/demo-article|sayt-ne-rabotaet-chto-delat/);assert.match(map,/pochemu-sayt/);assert.match(map,/kak-oplatit/);assert.match(map,/\/site-help\//);assert.match(map,/\/bitrix-support\//);});
