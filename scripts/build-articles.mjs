import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SITE = 'https://lambert-digital.ru';
export const CATEGORIES = { 'site-support': 'Сайты и техподдержка', bitrix: '1С-Битрикс', landing: 'Лендинги', seo: 'SEO и аналитика', ai: 'AI и автоматизация' };
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
export function minuteLabel(n) { const m10=n%10,m100=n%100; return `${n} ${m10===1&&m100!==11?'минута':m10>=2&&m10<=4&&(m100<12||m100>14)?'минуты':'минут'}`; }

function validate(article, file, slugs) {
  const required = ['title','slug','description','category','datePublished','status'];
  for (const key of required) if (!String(article[key] || '').trim()) throw new Error(`${file}\nотсутствует обязательное поле: ${key}`);
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(article.slug)) throw new Error(`${file}\ninvalid slug: "${article.slug}"`);
  if (slugs.has(article.slug)) throw new Error(`${file}\nduplicate slug: "${article.slug}"`); slugs.add(article.slug);
  if (!CATEGORIES[article.category]) throw new Error(`${file}\nнеизвестная category: "${article.category}"`);
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

const HEADER = `<header class="site-header" data-header><div class="container header__inner"><a class="logo" href="/" aria-label="Lambert/Digital — на главную страницу"><img class="logo__image" src="/assets/images/new-logo-header.png" alt="Lambert/Digital" decoding="async"></a><nav class="site-nav" data-nav aria-label="Основная навигация"><div class="nav-dropdown"><a class="nav-dropdown__trigger" href="/#services" aria-haspopup="true"><span>Услуги</span><span class="nav-dropdown__chevron" aria-hidden="true">⌄</span></a><div class="nav-dropdown__menu"><a href="/landing/">Разработка лендингов под ключ</a><a href="/bitrix-support/">Поддержка сайтов на 1С-Битрикс</a><a href="/site-help/">Срочная помощь сайту</a></div></div><a href="/#pricing">Прайс</a><a href="/cases/">Кейсы</a><a href="/articles/" aria-current="page">Статьи</a><a href="/#benefits">Преимущества</a><a href="/about/">О компании</a><a href="/#contacts">Контакты</a></nav><button class="burger" type="button" data-burger aria-label="Открыть меню" aria-expanded="false"><span></span><span></span><span></span></button></div></header>`;
const FOOTER = `<footer class="site-footer"><div class="container footer__inner"><div><a class="logo" href="/">Lambert/Digital</a><p>Сайты · SEO · Реклама · Аналитика · AI-боты</p></div><div class="footer__contacts"><a href="/articles/">Статьи</a><a href="/about/">О компании</a><a href="/site-help/">Срочная помощь</a></div><p class="copyright">© 2026 Lambert/Digital. Александр Ламберт.</p></div></footer>`;
const formatDate = iso => new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',year:'numeric',timeZone:'UTC'}).format(new Date(`${iso}T00:00:00Z`)).replace(' г.','');
const jsonLd = value => JSON.stringify(value).replace(/</g,'\\u003c');

async function renderArticle(a, template, file) {
  a.blocks = assignAnchors(a.blocks,file); const canonical=`${SITE}/articles/${a.slug}/`; const minutes=readingMinutes(a); const robots=a.seo.robots||'index, follow';
  const toc=a.blocks.filter(b=>b.type==='h2').map(b=>`<li><a href="#${b.anchor}">${escapeHtml(b.heading)}</a></li>`).join('');
  let body=''; let sectionOpen=false; for(const b of a.blocks){ if(b.type==='h2'){if(sectionOpen)body+='</section>';sectionOpen=true;} body+=renderBlock(b,file); } if(sectionOpen)body+='</section>';
  const faq=a.blocks.filter(b=>b.type==='faq').flatMap(b=>b.items);
  const graph=[{'@type':'BlogPosting',headline:a.title,description:a.seo.description,image:`${SITE}${a.seo.ogImage||'/assets/images/A.png'}`,datePublished:a.datePublished,dateModified:a.dateModified||a.datePublished,mainEntityOfPage:canonical,author:{'@type':'Person','@id':`${SITE}/#person`,name:'Александр Ламберт',url:`${SITE}/about/`},publisher:{'@id':`${SITE}/#business`}},{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Главная',item:`${SITE}/`},{'@type':'ListItem',position:2,name:'Статьи',item:`${SITE}/articles/`},{'@type':'ListItem',position:3,name:CATEGORIES[a.category]},{'@type':'ListItem',position:4,name:a.title}]}];
  if(faq.length)graph.push({'@type':'FAQPage',mainEntity:faq.map(x=>({'@type':'Question',name:x.question,acceptedAnswer:{'@type':'Answer',text:x.answer}}))});
  const head=`<title>${escapeHtml(a.seo.title||`${a.title} | Lambert/Digital`)}</title><meta name="description" content="${escapeHtml(a.seo.description)}"><meta name="robots" content="${robots}"><link rel="canonical" href="${canonical}"><meta property="og:type" content="article"><meta property="og:title" content="${escapeHtml(a.title)}"><meta property="og:description" content="${escapeHtml(a.seo.description)}"><meta property="og:url" content="${canonical}"><meta property="og:image" content="${SITE}${a.seo.ogImage||'/assets/images/A.png'}"><meta name="twitter:card" content="summary_large_image"><link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/css/main.css"><link rel="stylesheet" href="/css/header.css"><link rel="stylesheet" href="/css/contacts.css"><link rel="stylesheet" href="/css/responsive.css"><link rel="stylesheet" href="/css/articles.css"><link rel="stylesheet" href="/css/article.css"><script type="application/ld+json">${jsonLd({'@context':'https://schema.org','@graph':graph})}</script>`;
  const heroCta=a.heroCta?`<div class="article-referral-cta"><a class="button article-referral-button" href="${escapeHtml(normalizeInternalUrl(safeUrl(a.heroCta.url,file),a.heroCta.linkType))}"${linkAttrs(a.heroCta.linkType,a.heroCta.tracking)}>${escapeHtml(a.heroCta.label)}</a></div>`:'';
  const article=`<header class="article-hero"><nav class="breadcrumbs" aria-label="Хлебные крошки"><a href="/">Главная</a><span aria-hidden="true">→</span><a href="/articles/">Статьи</a><span aria-hidden="true">→</span><span>${CATEGORIES[a.category]}</span><span aria-hidden="true">→</span><span aria-current="page">${escapeHtml(a.title)}</span></nav><p class="article-hero__category">${CATEGORIES[a.category]}</p><h1>${escapeHtml(a.title)}</h1><div class="article-meta"><span>Автор: <a href="/about/" rel="author">Александр Ламберт</a></span><span>Опубликовано: <time datetime="${a.datePublished}">${formatDate(a.datePublished)}</time></span><span>Обновлено: <time datetime="${a.dateModified||a.datePublished}">${formatDate(a.dateModified||a.datePublished)}</time></span><span>Время чтения: ${minuteLabel(minutes)}</span></div><div class="article-lead">${sanitizeRich(a.lead,file)}</div>${heroCta}</header>${toc?`<nav class="article-toc" aria-label="Содержание статьи"><h2>Содержание</h2><ol>${toc}</ol></nav>`:''}<div class="article-body">${body}</div><aside class="author-card"><div><h2>Об авторе</h2><h3>Александр Ламберт</h3><p>Digital Project / Account Manager, основатель Lambert/Digital. Работаю с разработкой, поддержкой, SEO, рекламой и аналитикой сайтов.</p>${a.authorExtra?`<p>${escapeHtml(a.authorExtra)}</p>`:''}<a href="/about/" rel="author">Подробнее об Александре Ламберте →</a></div></aside>`;
  return template.replace('{{HEAD}}',head).replace('{{HEADER}}',HEADER).replace('{{ARTICLE}}',article).replace('{{FOOTER}}',FOOTER);
}

export async function buildArticles({ root=ROOT, contentDir=path.join(root,'content/articles'), outputDir=path.join(root,'articles'), sitemapPath=path.join(root,'sitemap.xml') }={}) {
  const names=(await fs.readdir(contentDir)).filter(x=>/\.ya?ml$/.test(x)).sort(), articles=[], slugs=new Set();
  for(const name of names){const file=path.join(contentDir,name);let a;try{a=parseSource(await fs.readFile(file,'utf8'));}catch(e){throw new Error(`${file}\nневалидный YAML/JSON: ${e.message}`);}a.blocks=(a.blocks||[]).map(block=>({...block,type:block.type||block._block}));validate(a,file,slugs);a.__file=file;articles.push(a);}
  const published=articles.filter(a=>a.status==='published').sort((a,b)=>b.datePublished.localeCompare(a.datePublished)||b.slug.localeCompare(a.slug));
  const articleTemplate=await fs.readFile(path.join(root,'templates/article.html'),'utf8'), cardTemplate=await fs.readFile(path.join(root,'templates/article-card.html'),'utf8');
  const live=new Set(published.map(a=>a.slug)); for(const entry of await fs.readdir(outputDir,{withFileTypes:true})){if(entry.isDirectory()&&entry.name!=='demo-article'&&!live.has(entry.name))await fs.rm(path.join(outputDir,entry.name),{recursive:true,force:true});}
  for(const a of published){const dir=path.join(outputDir,a.slug);await fs.mkdir(dir,{recursive:true});await fs.writeFile(path.join(dir,'index.html'),await renderArticle(a,articleTemplate,a.__file));}
  const cards=published.map(a=>{const m=readingMinutes(a);return cardTemplate.replaceAll('{{CATEGORY_ID}}',a.category).replaceAll('{{URL}}',`/articles/${a.slug}/`).replaceAll('{{TITLE}}',escapeHtml(a.title)).replaceAll('{{COVER_CLASS}}',escapeHtml(a.cover?.className||'')).replaceAll('{{COVER_ALT}}',escapeHtml(a.cover?.alt||`Обложка статьи «${a.title}»`)).replaceAll('{{COVER_DECORATION}}',a.cover?.className?.includes('zarub')?'<span aria-hidden="true">↗</span>':'').replaceAll('{{CATEGORY}}',CATEGORIES[a.category]).replaceAll('{{DESCRIPTION}}',escapeHtml(a.description)).replaceAll('{{DATE_ISO}}',a.datePublished).replaceAll('{{DATE}}',formatDate(a.datePublished)).replaceAll('{{READING_TIME}}',minuteLabel(m));}).join('');
  const active=new Set(published.map(a=>a.category)); const filters=`<button class="article-filter" type="button" aria-pressed="true" data-filter="all">Все</button>`+Object.entries(CATEGORIES).map(([id,label])=>`<button class="article-filter" type="button" aria-pressed="false"${active.has(id)?` data-filter="${id}"`:' disabled'}>${label}</button>`).join('');
  const collectionLd=jsonLd({'@context':'https://schema.org','@graph':[{'@type':'CollectionPage',name:'Статьи и разборы о сайтах, SEO и digital',url:`${SITE}/articles/`,isPartOf:{'@id':`${SITE}/#website`},publisher:{'@id':`${SITE}/#business`}},{'@type':'BreadcrumbList',itemListElement:[{'@type':'ListItem',position:1,name:'Главная',item:`${SITE}/`},{'@type':'ListItem',position:2,name:'Статьи',item:`${SITE}/articles/`}]}]});
  const catalog=`<!doctype html>\n${GENERATED}\n<html lang="ru"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Статьи о сайтах, SEO, 1С-Битрикс и digital | Lambert/Digital</title><meta name="description" content="Практические статьи Александра Ламберта о разработке и поддержке сайтов, 1С-Битрикс, SEO, Яндекс.Директе, аналитике и автоматизации бизнеса."><meta name="robots" content="index, follow"><link rel="canonical" href="${SITE}/articles/"><link rel="icon" href="/assets/icons/favicon.svg" type="image/svg+xml"><link rel="stylesheet" href="/css/main.css"><link rel="stylesheet" href="/css/header.css"><link rel="stylesheet" href="/css/contacts.css"><link rel="stylesheet" href="/css/responsive.css"><link rel="stylesheet" href="/css/articles.css"><script type="application/ld+json">${collectionLd}</script></head><body class="articles-page">${HEADER}<main class="articles-main"><div class="container"><nav class="breadcrumbs" aria-label="Хлебные крошки"><a href="/">Главная</a><span aria-hidden="true">→</span><span aria-current="page">Статьи</span></nav><header class="articles-intro"><p class="eyebrow">Материалы</p><h1>Статьи и разборы о сайтах, SEO и digital</h1><p class="articles-intro__lead">Практические материалы о разработке, поддержке и продвижении сайтов. Разбираю реальные технические проблемы, инструменты и задачи, с которыми сталкиваюсь в работе.</p></header><div class="article-filters" aria-label="Категории статей">${filters}</div><div class="articles-grid">${cards}</div></div></main>${FOOTER}<button class="to-top" type="button" data-to-top aria-label="Наверх">↑</button><script src="/js/main.js"></script><script src="/js/articles.js"></script></body></html>\n`; await fs.writeFile(path.join(outputDir,'index.html'),catalog);
  let sitemap=await fs.readFile(sitemapPath,'utf8'); sitemap=sitemap.replace(/\s*<url>\s*<loc>https:\/\/lambert-digital\.ru\/articles(?:\/[^<]*)?<\/loc>[\s\S]*?<\/url>/g,''); const last=published.map(a=>a.dateModified||a.datePublished).sort().at(-1)||''; const entries=[`  <url>\n    <loc>${SITE}/articles/</loc>\n    <lastmod>${last}</lastmod>\n    <changefreq>weekly</changefreq>\n    <priority>0.7</priority>\n  </url>`,...published.filter(a=>(a.seo.robots||'index, follow')==='index, follow').map(a=>`  <url>\n    <loc>${SITE}/articles/${a.slug}/</loc>\n    <lastmod>${a.dateModified||a.datePublished}</lastmod>\n    <changefreq>monthly</changefreq>\n    <priority>0.7</priority>\n  </url>`)].join('\n'); sitemap=sitemap.replace('</urlset>',`${entries}\n</urlset>`); await fs.writeFile(sitemapPath,sitemap);
  return {articles,published};
}

if(process.argv[1]===fileURLToPath(import.meta.url))buildArticles().then(({published})=>console.log(`Articles built: ${published.length}`)).catch(e=>{console.error(`ERROR: ${e.message}`);process.exitCode=1;});
