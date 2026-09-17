import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://lambert-digital.ru';
export const CATEGORIES = { ru: { 'site-support': 'Сайты и техподдержка', bitrix: '1С-Битрикс', landing: 'Лендинги', seo: 'SEO и аналитика', ai: 'AI и автоматизация' }, en: { 'site-support': 'Websites and support', bitrix: '1C-Bitrix', landing: 'Landing pages', seo: 'SEO and analytics', ai: 'AI and automation' } };
const LANGUAGES = new Set(['ru', 'en']);
const ALLOWED_STATUS = new Set(['draft', 'published']);
const ALLOWED_ROBOTS = new Set(['index, follow', 'noindex, follow']);
const GENERATED = '<!-- Generated from CMS content. Do not edit manually. -->';

// Pages CMS writes YAML (and identifies block variants with `_block`). Keep the
// JSON reader for the previously migrated sources, which are valid YAML too.
function parseSource(source) {
  try { return JSON.parse(source); } catch {}
  const physical=source.replace(/\r/g,'').split('\n'),lines=[];
  for(let i=0;i<physical.length;i++){let line=physical[i];const value=line.match(/^\s*[^:]+:\s*(".*)$/)?.[1];if(value&&(value.match(/(?<!\\)"/g)||[]).length%2){while(++i<physical.length){line+=` ${physical[i].trim()}`;if((physical[i].match(/(?<!\\)"/g)||[]).length%2)break;}}lines.push(line);}
  const scalar=value=>{const v=value.trim();if(!v)return null;if(v==='true'||v==='false')return v==='true';if(v==='null'||v==='~')return null;if(/^[-+]?\d+(?:\.\d+)?$/.test(v))return Number(v);if(v.startsWith('"'))return JSON.parse(v);if(v.startsWith("'")&&v.endsWith("'"))return v.slice(1,-1).replaceAll("''", "'");if(/^[\[{]/.test(v))throw new Error(`неподдерживаемое значение: ${v}`);return v;};
  const indent=line=>(line.match(/^ */)||[''])[0].length;
  function read(start,level) {
    let i=start, result;
    while(i<lines.length){const raw=lines[i];if(!raw.trim()||raw.trimStart().startsWith('#')){i++;continue;}const n=indent(raw);if(n<level)break;if(n>level)throw new Error(`неожиданный отступ в строке ${i+1}`);
      const text=raw.slice(level), list=text.startsWith('- ');
      if(result===undefined)result=list?[]:{};if(list!==Array.isArray(result))throw new Error(`смешаны список и объект в строке ${i+1}`);
      const item=list?text.slice(2):text;const match=item.match(/^([^:]+):(.*)$/);
      if(list&&!match){result.push(scalar(item));i++;continue;}if(!match)throw new Error(`ожидалось поле в строке ${i+1}`);
      const key=match[1].trim(), rest=match[2].trim();let value;
      if(rest==='>-'||rest==='>+'||rest==='|'||rest==='|-'){const chunks=[];i++;while(i<lines.length&&(!lines[i].trim()||indent(lines[i])>level)){chunks.push(lines[i].slice(Math.min(lines[i].length,level+2)));i++;}value=chunks.join('\n').replace(/\n+$/,'');}
      else if(rest){value=scalar(rest);i++;}
      else {i++;const child=read(i,level+2);value=child.value;i=child.next;}
      if(list){const object={[key]:value};while(i<lines.length&&lines[i].trim()&&indent(lines[i])===level+2&&!lines[i].slice(level+2).startsWith('- ')){const childLine=lines[i].slice(level+2).match(/^([^:]+):(.*)$/);if(!childLine)break;const k=childLine[1].trim(),r=childLine[2].trim();if(r==='>-'||r==='>+'||r==='|'||r==='|-'){const chunks=[];i++;while(i<lines.length&&(!lines[i].trim()||indent(lines[i])>level+2)){chunks.push(lines[i].slice(Math.min(lines[i].length,level+4)));i++;}object[k]=chunks.join('\n').replace(/\n+$/,'');}else if(r){object[k]=scalar(r);i++;}else{i++;const child=read(i,level+4);object[k]=child.value;i=child.next;}}result.push(object);}else result[key]=value;
    } return {value:result,next:i};
  }
  return read(0,0).value;
}

const escapeHtml = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const plain = (value = '') => String(value).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
const safeUrl = (url, file) => {
  const value = String(url || '').trim();
  if (!value || /^(?:javascript|data\s*:\s*text\/html|vbscript):/i.test(value)) throw new Error(`${file}\nнедопустимый URL: "${value}"`);
  return value;
};
const linkAttrs = (kind, tracking = '') => `${kind === 'internal' ? '' : ' target="_blank"'}${kind === 'affiliate' ? ' rel="sponsored noopener noreferrer"' : kind === 'external' ? ' rel="noopener noreferrer"' : ''}${tracking ? ` data-metrika-click="${escapeHtml(tracking)}"` : ''}`;

// Rich text may be stored as restricted HTML or Markdown. Scripts, event handlers and unsafe URLs are rejected.
function sanitizeRich(value, file) {
  let html = String(value || '');
  // Pages CMS currently serializes rich-text as Markdown. Existing HTML remains
  // untouched; Markdown is converted before the same security checks run.
  if (!/<[a-z][\s\S]*>/i.test(html)) html = markdownToHtml(html);
  if (/<script\b|\son\w+\s*=|(?:javascript|vbscript):|data\s*:\s*text\/html/i.test(html)) throw new Error(`${file}\nопасный HTML в текстовом блоке`);
  html = html.replace(/<!--([\s\S]*?)-->/g, '').replace(/<(iframe|object|embed|style)[^>]*>[\s\S]*?<\/\1>/gi, '');
  for (const match of html.matchAll(/href="([^"]+)"/g)) safeUrl(match[1], file);
  return html;
}

function markdownToHtml(markdown) {
  const inline=value=>escapeHtml(value).replace(/`([^`]+)`/g,'<code>$1</code>').replace(/\*\*([^*]+)\*\*/g,'<strong>$1</strong>').replace(/\[([^\]]+)\]\(([^)]+)\)/g,'<a href="$2">$1</a>');
  const out=[];let paragraph=[],list=[],listTag='ul';const flush=()=>{if(paragraph.length){out.push(`<p>${inline(paragraph.join(' '))}</p>`);paragraph=[];}if(list.length){out.push(`<${listTag}>${list.map(x=>`<li>${inline(x)}</li>`).join('')}</${listTag}>`);list=[];}};
  for(const raw of String(markdown).split(/\n/)){const line=raw.trim();if(!line){flush();continue;}const heading=line.match(/^(#{2,3})\s+(.+)$/);if(heading){flush();const tag=`h${heading[1].length}`;out.push(`<${tag}>${inline(heading[2])}</${tag}>`);continue;}const bullet=line.match(/^([-*]|\d+\.)\s+(.+)$/);if(bullet){const tag=/\d/.test(bullet[1])?'ol':'ul';if(paragraph.length||(list.length&&tag!==listTag))flush();listTag=tag;list.push(bullet[2]);continue;}if(list.length)flush();paragraph.push(line);}flush();return out.join('\n');
}

function normalizeInternalUrl(url, linkType) {
  if(linkType!=='internal')return url;
  try { const parsed=new URL(url,SITE); return parsed.origin===SITE ? `${parsed.pathname}${parsed.search}${parsed.hash}` : url; } catch { return url; }
}

export function slugify(value) {
  const map = {а:'a',б:'b',в:'v',г:'g',д:'d',е:'e',ё:'e',ж:'zh',з:'z',и:'i',й:'y',к:'k',л:'l',м:'m',н:'n',о:'o',п:'p',р:'r',с:'s',т:'t',у:'u',ф:'f',х:'h',ц:'c',ч:'ch',ш:'sh',щ:'sch',ы:'y',э:'e',ю:'yu',я:'ya'};
  return String(value).toLowerCase().split('').map(c => map[c] ?? c).join('').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'section';
}
export function assignAnchors(blocks, file = 'article') {
  const used = new Set();
  return blocks.map(block => {
    if (!['h2', 'h3'].includes(block.type)) return block;
    const base = block.anchor || slugify(block.heading);
    if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(base)) throw new Error(`${file}\nневалидный anchor: "${base}"`);
    let anchor = base, n = 2; while (used.has(anchor)) anchor = `${base}-${n++}`; used.add(anchor);
    return { ...block, anchor };
  });
}
export function readingMinutes(article) {
  const values = [article.lead];
  for (const b of article.blocks) {
    if (b.type === 'code' || b.type === 'image' || b.type === 'divider' || b.type === 'table') continue;
    if (b.type === 'list') values.push(...(b.items || []));
    else if (b.type === 'faq') for (const x of b.items || []) values.push(x.question, x.answer);
    else values.push(b.heading, b.content, b.text, b.description, b.source);
  }
  const words = plain(values.filter(Boolean).join(' ')).split(/\s+/u).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 190));
}
export function minuteLabel(n, language='ru') { if(language==='en') return `${n} min read`; const m10=n%10,m100=n%100; return `${n} ${m10===1&&m100!==11?'минута':m10>=2&&m10<=4&&(m100<12||m100>14)?'минуты':'минут'}`; }

function validate(article, file, slugs) {
  article.language ||= 'ru';
  if (!LANGUAGES.has(article.language)) throw new Error(`${file}\ninvalid language: "${article.language}"`);
  if (!String(article.translation_key || '').trim()) article.translation_key = article.slug;
  const required = ['title','slug','description','category','datePublished','status'];
  for (const key of required) if (!String(article[key] || '').trim()) throw new Error(`${file}\nотсутствует обязательное поле: ${key}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) throw new Error(`${file}\ninvalid slug: "${article.slug}"`);
  const routeKey=`${article.language}:${article.slug}`; if (slugs.has(routeKey)) throw new Error(`${file}\nduplicate slug: "${article.slug}"`); slugs.add(routeKey);
  if (!CATEGORIES[article.language][article.category]) throw new Error(`${file}\nнеизвестная category: "${article.category}"`);
  if (!ALLOWED_STATUS.has(article.status)) throw new Error(`${file}\nнеизвестный status: "${article.status}"`);
  if (!article.seo?.description?.trim()) throw new Error(`${file}\nотсутствует обязательное поле: seo.description`);
  if (article.seo.robots && !ALLOWED_ROBOTS.has(article.seo.robots)) throw new Error(`${file}\nнеизвестное значение robots`);
  if (!Array.isArray(article.blocks)) throw new Error(`${file}\nblocks должен быть списком`);
  const known = new Set(['text','h2','h3','list','image','callout','cta','code','quote','table','divider','faq']);
  for (const [i,b] of article.blocks.entries()) {
    if (!known.has(b.type)) throw new Error(`${file}\nнеизвестный тип блока #${i+1}: "${b.type}"`);
    if ((b.type === 'h2'||b.type === 'h3') && !b.heading) throw new Error(`${file}\nблок #${i+1}: отсутствует heading`);
    if (b.type === 'image' && (!b.file || !b.alt)) throw new Error(`${file}\nimage #${i+1}: обязательны file и alt`);
    if (b.type === 'cta') { if (!b.heading||!b.description||!b.label||!b.url||!['internal','external','affiliate'].includes(b.linkType)) throw new Error(`${file}\ncta #${i+1}: неправильная структура`); safeUrl(b.url,file); }
    if (b.type === 'faq' && (!Array.isArray(b.items)||b.items.some(x=>!x.question||!x.answer))) throw new Error(`${file}\nfaq #${i+1}: обязательны вопрос и ответ`);
    if (b.type === 'text') sanitizeRich(b.content,file);
  }
  for (const url of JSON.stringify(article).match(/https?:[^"\s]+/g) || []) if (/chatgpt\.com/i.test(url)) console.warn(`WARNING: ${article.title}: ${url}`);
}

function renderBlock(b, file) {
  switch (b.type) {
    case 'text': return sanitizeRich(b.content,file);
    case 'h2': return `<section id="${b.anchor}"><h2>${escapeHtml(b.heading)}</h2>`;
    case 'h3': return `<h3 id="${b.anchor}">${escapeHtml(b.heading)}</h3>`;
    case 'list': return `<${b.ordered?'ol':'ul'}>${b.items.map(x=>`<li>${escapeHtml(x)}</li>`).join('')}</${b.ordered?'ol':'ul'}>`;
    case 'image': return `<figure><img src="${escapeHtml(safeUrl(b.file,file))}" alt="${escapeHtml(b.alt)}" loading="lazy"${b.width?` width="${Number(b.width)}"`:''}${b.height?` height="${Number(b.height)}"`:''}>${b.caption?`<figcaption>${escapeHtml(b.caption)}</figcaption>`:''}</figure>`;
    case 'callout': return `<aside class="article-callout">${b.heading?`<strong>${escapeHtml(b.heading)}</strong>`:''}${b.text?`<p>${escapeHtml(b.text)}</p>`:''}</aside>`;
    case 'cta': return `<aside class="article-cta"><h2>${escapeHtml(b.heading)}</h2><p>${escapeHtml(b.description)}</p><a href="${escapeHtml(normalizeInternalUrl(safeUrl(b.url,file),b.linkType))}"${linkAttrs(b.linkType,b.tracking)}>${escapeHtml(b.label)}</a></aside>`;
    case 'code': return `<pre><code${b.language?` class="language-${escapeHtml(b.language)}"`:''}>${escapeHtml(b.code)}</code></pre>`;
    case 'quote': return `<blockquote><p>${escapeHtml(b.text)}</p>${b.source?`<cite>${escapeHtml(b.source)}</cite>`:''}</blockquote>`;
    case 'table': return `<div class="article-table-wrap"><table class="article-table"><thead><tr>${b.headers.map(x=>`<th>${escapeHtml(x)}</th>`).join('')}</tr></thead><tbody>${b.rows.map(r=>`<tr>${r.cells.map(x=>`<td>${escapeHtml(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
    case 'divider': return '<hr>';
    case 'faq': return b.items.map(x=>`<div class="article-faq__item"><h3>${escapeHtml(x.question)}</h3><p>${escapeHtml(x.answer)}</p></div>`).join('');
  }
}

const labels={
  ru:{home:'Главная',articles:'Статьи',services:'Услуги',pricing:'Прайс',cases:'Кейсы',benefits:'Преимущества',about:'О компании',contacts:'Контакты',landing:'Разработка лендингов под ключ',bitrix:'Поддержка сайтов на 1С-Битрикс',help:'Срочная помощь сайту',nav:'Основная навигация',language:'Выбор языка',menu:'Открыть меню',published:'Опубликовано',updated:'Обновлено',reading:'Время чтения',author:'Автор',contents:'Содержание',aboutAuthor:'Об авторе',more:'Подробнее об Александре Ламберте →',materials:'Материалы',catalogTitle:'Статьи и разборы о сайтах, SEO и digital',catalogLead:'Практические материалы о разработке, поддержке и продвижении сайтов.',all:'Все',legal:'Юридическая информация',privacy:'Политика конфиденциальности',consent:'Согласие на обработку ПД',cookies:'Cookie',tagline:'Сайты · SEO · Реклама · Аналитика · AI-боты'},
  en:{home:'Home',articles:'Articles',services:'Services',pricing:'Pricing',cases:'Cases',benefits:'Benefits',about:'About',contacts:'Contact',landing:'Turnkey landing page development',bitrix:'1C-Bitrix website support',help:'Urgent website support',nav:'Main navigation',language:'Language',menu:'Open menu',published:'Published',updated:'Updated',reading:'Reading time',author:'Author',contents:'Contents',aboutAuthor:'About the author',more:'More about Alexander Lambert →',materials:'Insights',catalogTitle:'Articles and insights on websites, SEO and digital',catalogLead:'Practical guidance on website development, support and promotion.',all:'All',legal:'Legal information',privacy:'Privacy Policy',consent:'Personal Data Processing Consent',cookies:'Cookie Policy',tagline:'Websites · SEO · Advertising · Analytics · AI bots'}
};
const prefix=language=>language==='en'?'/en':'';
const articlePath=a=>`${prefix(a.language)}/articles/${a.slug}/`;
const switcher=(language,ruPath,enPath)=>{const current=language==='en'?'EN':'RU';return `<div class="language-switcher" data-language-switcher><button class="language-switcher__trigger" type="button" aria-label="${language==='en'?'Choose language':'Выбрать язык'}" aria-haspopup="true" aria-expanded="false">${current}<span aria-hidden="true">⌄</span></button><div class="language-switcher__menu" role="menu"><a href="${ruPath}" data-language="ru" lang="ru" role="menuitem"${language==='ru'?' aria-current="true"':''}>RU — ${language==='en'?'Russian':'Русский'}${language==='ru'?' <span aria-hidden="true">✓</span>':''}</a><a href="${enPath}" data-language="en" lang="en" role="menuitem"${language==='en'?' aria-current="true"':''}>EN — English${language==='en'?' <span aria-hidden="true">✓</span>':''}</a></div></div>`};
function header(language,ruPath,enPath){const l=labels[language],p=prefix(language);return `<header class="site-header" data-header><div class="container header__inner"><a class="logo" href="${p}/" aria-label="Lambert/Digital — ${l.home}"><img class="logo__image" src="/assets/images/new-logo.png" alt="Lambert/Digital" decoding="async"></a><nav class="site-nav" data-nav aria-label="${l.nav}"><div class="nav-dropdown"><a class="nav-dropdown__trigger" href="${p}/#services" aria-haspopup="true"><span>${l.services}</span><span class="nav-dropdown__chevron" aria-hidden="true">⌄</span></a><div class="nav-dropdown__menu"><a href="${p}/landing/">${l.landing}</a><a href="${p}/bitrix-support/">${l.bitrix}</a><a href="${p}/site-help/">${l.help}</a></div></div><a href="${p}/#pricing">${l.pricing}</a><a href="${p}/cases/">${l.cases}</a><a href="${p}/articles/" aria-current="page">${l.articles}</a><a href="${p}/#benefits">${l.benefits}</a><a href="${p}/about/">${l.about}</a><a href="${p}/#contacts">${l.contacts}</a></nav>${switcher(language,ruPath,enPath)}<button class="burger" type="button" data-burger aria-label="${l.menu}" aria-expanded="false"><span></span><span></span><span></span></button></div></header>`}
function footer(language){const l=labels[language],p=prefix(language);return `<footer class="site-footer"><div class="container footer__inner"><div><a class="logo" href="${p}/">Lambert/Digital</a><p>${l.tagline}</p></div><div class="footer__contacts"><a href="${p}/articles/">${l.articles}</a><a href="${p}/about/">${l.about}</a><a href="${p}/site-help/">${l.help}</a></div><nav class="legal-links" aria-label="${l.legal}"><a href="${p}/privacy/">${l.privacy}</a><a href="${p}/personal-data-consent/">${l.consent}</a><a href="${p}/cookies/">${l.cookies}</a></nav><p class="copyright">© 2026 Lambert/Digital. ${language==='en'?'Alexander Lambert':'Александр Ламберт'}.</p></div></footer>`}
const formatDate=(iso,language)=>new Intl.DateTimeFormat(language==='en'?'en-GB':'ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${iso}T00:00:00Z`)).replace(' г.','');
const jsonLd=value=>JSON.stringify(value).replace(/</g,'\\u003c');
const alternateLinks=(ru,en)=>`<link rel="alternate" hreflang="ru" href="${SITE}${ru}"><link rel="alternate" hreflang="en" href="${SITE}${en}"><link rel="alternate" hreflang="x-default" href="${SITE}${ru}">`;
async function renderArticle(a,template,file,translations){
 const language=a.language,l=labels[language],p=prefix(language),match=translations.get(a.translation_key)||{}; const ru=match.ru?articlePath(match.ru):'/articles/';const en=match.en?articlePath(match.en):'/en/articles/'; const canonical=`${SITE}${articlePath(a)}`;a.blocks=assignAnchors(a.blocks,file);const minutes=readingMinutes(a),robots=a.seo.robots||'index, follow',category=CATEGORIES[language][a.category];
 const toc=a.blocks.filter(b=>b.type==='h2').map(b=>`<li><a href="#${b.anchor}">${escapeHtml(b.heading)}</a></li>`).join('');let body='',sectionOpen=false;for(const b of a.blocks){if(b.type==='h2'){if(sectionOpen)body+='</section>';sectionOpen=true;}body+=renderBlock(b,file);}if(sectionOpen)body+='</section>';const faq=a.blocks.filter(b=>b.type==='faq').flatMap(b=>b.items);const author=language==='en'?'Alexander Lambert':'Александр Ламберт';
 const graph=[{'@type':'BlogPosting',headline:a.title,description:a.seo.description,image:`${SITE}${a.seo.ogImage||'/assets/images/A.png'}`,datePublished:a.datePublished,dateModified:a.dateModified||a.datePublished,mainEntityOfPage:canonical,inLanguage:language,author:{'@type':'Person','@id':`${SITE}/#person`,name:author,url:`${SITE}${p}/about/`},publisher:{'@id':`${SITE}/#business`}},{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:l.home,item:`${SITE}${p}/`},{'@type':'ListItem',position:2,name:l.articles,item:`${SITE}${p}/articles/`},{'@type':'ListItem',position:3,name:category},{'@type':'ListItem',position:4,name:a.title}]}];if(faq.length)graph.push({'@type':'FAQPage',mainEntity:faq.map(x=>({'@type':'Question',name:x.question,acceptedAnswer:{'@type':'Answer',text:x.answer}}))});
 const head=`<title>${escapeHtml(a.seo.title||`${a.title} | Lambert/Digital`)}</title><meta name="description" content="${escapeHtml(a.seo.description)}"><meta name="robots" content="${robots}"><link rel="canonical" href="${canonical}">${alternateLinks(ru,en)}<meta property="og:type" content="article"><meta property="og:locale" content="${language==='en'?'en_US':'ru_RU'}"><meta property="og:title" content="${escapeHtml(a.title)}"><meta property="og:description" content="${escapeHtml(a.seo.description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE}${a.seo.ogImage||'/assets/images/A.png'}"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/css/main.css"><link rel="stylesheet" href="/css/header.css"><link rel="stylesheet" href="/css/contacts.css"><link rel="stylesheet" href="/css/responsive.css"><link rel="stylesheet" href="/css/articles.css"><link rel="stylesheet" href="/css/article.css"><script type="application/ld+json">${jsonLd({'@context':'https://schema.org','@graph':graph})}</script>`;
 const heroCta=a.heroCta?`<div class="article-referral-cta"><a class="button article-referral-button" href="${escapeHtml(normalizeInternalUrl(safeUrl(a.heroCta.url,file),a.heroCta.linkType))}"${linkAttrs(a.heroCta.linkType,a.heroCta.tracking)}>${escapeHtml(a.heroCta.label)}</a></div>`:'';
 const article=`<header class="article-hero"><nav class="breadcrumbs" aria-label="Breadcrumbs"><a href="${p}/">${l.home}</a><span aria-hidden="true">→</span><a href="${p}/articles/">${l.articles}</a><span aria-hidden="true">→</span><span>${category}</span><span aria-hidden="true">→</span><span aria-current="page">${escapeHtml(a.title)}</span></nav><p class="article-hero__category">${category}</p><h1>${escapeHtml(a.title)}</h1><div class="article-meta"><span>${l.author}: <a href="${p}/about/" rel="author">${author}</a></span><span>${l.published}: <time datetime="${a.datePublished}">${formatDate(a.datePublished,language)}</time></span><span>${l.updated}: <time datetime="${a.dateModified||a.datePublished}">${formatDate(a.dateModified||a.datePublished,language)}</time></span><span>${l.reading}: ${minuteLabel(minutes,language)}</span></div><div class="article-lead">${sanitizeRich(a.lead,file)}</div>${heroCta}</header>${toc?`<nav class="article-toc" aria-label="${l.contents}"><h2>${l.contents}</h2><ol>${toc}</ol></nav>`:''}<div class="article-body">${body}</div><aside class="author-card"><div><h2>${l.aboutAuthor}</h2><h3>${author}</h3><p>${language==='en'?'Digital Project / Account Manager and founder of Lambert/Digital. I work with website development, support, SEO, advertising and analytics.':'Digital Project / Account Manager, основатель Lambert/Digital. Работаю с разработкой, поддержкой, SEO, рекламой и аналитикой сайтов.'}</p><a href="${p}/about/" rel="author">${l.more}</a></div></aside>`;
 return template.replace('<html lang="ru">',`<html lang="${language}">`).replace('{{HEAD}}',head).replace('{{HEADER}}',header(language,ru,en)).replace('{{ARTICLE}}',article).replace('{{FOOTER}}',footer(language)).replace('{{TO_TOP}}',language==='en'?'Back to top':'Наверх').replace('<script src="/js/main.js"></script>','<script src="/js/language-switcher.js"></script><script src="/js/main.js"></script>');
}
function catalog(language,published,cardTemplate){const l=labels[language],p=prefix(language),ru='/articles/',en='/en/articles/';const cards=published.map(a=>{const m=readingMinutes(a);return cardTemplate.replaceAll('{{CATEGORY_ID}}',a.category).replaceAll('{{URL}}',articlePath(a)).replaceAll('{{TITLE}}',escapeHtml(a.title)).replaceAll('{{COVER_CLASS}}',escapeHtml(a.cover?.className||'')).replaceAll('{{COVER_ALT}}',escapeHtml(a.cover?.alt||a.title)).replaceAll('{{COVER_DECORATION}}',a.cover?.className?.includes('zarub')?'<span aria-hidden="true">↗</span>':'').replaceAll('{{CATEGORY}}',CATEGORIES[language][a.category]).replaceAll('{{DESCRIPTION}}',escapeHtml(a.description)).replaceAll('{{DATE_ISO}}',a.datePublished).replaceAll('{{DATE}}',formatDate(a.datePublished,language)).replaceAll('{{READING_TIME}}',minuteLabel(m,language)).replaceAll('{{READ_ARTICLE}}',language==='en'?'Read article':'Читать статью').replaceAll('{{READ}}',language==='en'?'Read':'Читать');}).join('');const active=new Set(published.map(a=>a.category));const filters=`<button class="article-filter" type="button" aria-pressed="true" data-filter="all">${l.all}</button>`+Object.entries(CATEGORIES[language]).map(([id,label])=>`<button class="article-filter" type="button" aria-pressed="false"${active.has(id)?` data-filter="${id}"`:' disabled'}>${label}</button>`).join('');return `<!doctype html>\n${GENERATED}\n<html lang="${language}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${l.catalogTitle} | Lambert/Digital</title><meta name="description" content="${l.catalogLead}"><meta name="robots" content="index, follow"><link rel="canonical" href="${SITE}${p}/articles/">${alternateLinks(ru,en)}<meta property="og:locale" content="${language==='en'?'en_US':'ru_RU'}"><link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/css/main.css"><link rel="stylesheet" href="/css/header.css"><link rel="stylesheet" href="/css/contacts.css"><link rel="stylesheet" href="/css/responsive.css"><link rel="stylesheet" href="/css/articles.css"></head><body class="articles-page">${header(language,ru,en)}<main class="articles-main"><div class="container"><nav class="breadcrumbs" aria-label="Breadcrumbs"><a href="${p}/">${l.home}</a><span aria-hidden="true">→</span><span aria-current="page">${l.articles}</span></nav><header class="articles-intro"><p class="eyebrow">${l.materials}</p><h1>${l.catalogTitle}</h1><p class="articles-intro__lead">${l.catalogLead}</p></header><div class="article-filters" aria-label="Categories">${filters}</div><div class="articles-grid">${cards}</div></div></main>${footer(language)}<button class="to-top" type="button" data-to-top aria-label="Back to top">↑</button><script src="/js/cookie-consent.js"></script><script src="/js/language-switcher.js"></script><script src="/js/main.js"></script><script src="/js/articles.js"></script></body></html>\n`}
export async function buildArticles({root=ROOT,contentDir=path.join(root,'content/articles'),outputDir=path.join(root,'articles'),sitemapPath=path.join(root,'sitemap.xml')}={}){const names=(await fs.readdir(contentDir)).filter(x=>/\.ya?ml$/.test(x)).sort(),articles=[],slugs=new Set();for(const name of names){const file=path.join(contentDir,name);let a;try{a=parseSource(await fs.readFile(file,'utf8'));}catch(e){throw new Error(`${file}\nневалидный YAML/JSON: ${e.message}`);}a.blocks=(a.blocks||[]).map(block=>({...block,type:block.type||block._block}));validate(a,file,slugs);a.__file=file;articles.push(a);}const published=articles.filter(a=>a.status==='published').sort((a,b)=>b.datePublished.localeCompare(a.datePublished)||b.slug.localeCompare(a.slug));const translations=new Map();for(const a of published){const pair=translations.get(a.translation_key)||{};if(pair[a.language])throw new Error(`${a.__file}\nduplicate translation: ${a.translation_key}/${a.language}`);pair[a.language]=a;translations.set(a.translation_key,pair);}const articleTemplate=await fs.readFile(path.join(root,'templates/article.html'),'utf8'),cardTemplate=await fs.readFile(path.join(root,'templates/article-card.html'),'utf8');for(const language of LANGUAGES){const base=language==='ru'?outputDir:path.join(root,'en/articles');await fs.mkdir(base,{recursive:true});const langPublished=published.filter(a=>a.language===language),live=new Set(langPublished.map(a=>a.slug));for(const entry of await fs.readdir(base,{withFileTypes:true})){if(entry.isDirectory()&&entry.name!=='demo-article'&&!live.has(entry.name))await fs.rm(path.join(base,entry.name),{recursive:true,force:true});}for(const a of langPublished){const dir=path.join(base,a.slug);await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'index.html'),await renderArticle(a,articleTemplate,a.__file,translations));}await fs.writeFile(path.join(base,'index.html'),catalog(language,langPublished,cardTemplate));}let sitemap=await fs.readFile(sitemapPath,'utf8');sitemap=sitemap.replace(/\s*<url>\s*<loc>https:\/\/lambert-digital\.ru\/(?:en\/)?articles(?:\/[^<]*)?<\/loc>[\s\S]*?<\/url>/g,'');const entries=['/articles/','/en/articles/',...published.filter(a=>(a.seo.robots||'index, follow')==='index, follow').map(articlePath)].map(url=>`  <url>\n    <loc>${SITE}${url}</loc>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`).join('\n');sitemap=sitemap.replace('</urlset>',`${entries}\n</urlset>`);await fs.writeFile(sitemapPath,sitemap);return{articles,published};}
if(process.argv[1]===fileURLToPath(import.meta.url))buildArticles().then(({published})=>console.log(`Articles built: ${published.length}`)).catch(e=>{console.error(`ERROR: ${e.message}`);process.exitCode=1;});
