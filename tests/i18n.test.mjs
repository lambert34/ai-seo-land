import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('.');
async function htmlFiles(dir) {
  const result=[];
  for (const entry of await fs.readdir(dir,{withFileTypes:true})) {
    const target=path.join(dir,entry.name);
    if(entry.isDirectory()) result.push(...await htmlFiles(target));
    else if(entry.name.endsWith('.html')) result.push(target);
  }
  return result;
}

test('English pages use self canonicals, reciprocal hreflang and valid internal links', async()=>{
  const files=await htmlFiles(path.join(root,'en'));
  assert.ok(files.length >= 13);
  for(const file of files){
    const html=await fs.readFile(file,'utf8');
    const route='/'+path.relative(root,path.dirname(file)).split(path.sep).join('/')+'/';
    assert.match(html,/<html lang="en">/);
    assert.match(html,new RegExp(`rel="canonical" href="https://lambert-digital\\.ru${route.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')}"`));
    assert.match(html,/hreflang="ru"/);assert.match(html,/hreflang="en"/);assert.match(html,/hreflang="x-default"/);
    assert.match(html,/class="language-switcher"/);
    for(const [,href] of html.matchAll(/href="(\/en\/[^"?#]*)/g)){
      if(/\.[a-z0-9]+$/i.test(href)) continue;
      const destination=path.join(root,href.slice(1),'index.html');
      await assert.doesNotReject(fs.access(destination),`${route} links to missing ${href}`);
    }
  }
});

test('legal email is scoped to legal documents',async()=>{
  const files=(await htmlFiles(root)).filter(file=>!file.includes(`${path.sep}.git${path.sep}`));
  for(const file of files){
    const html=await fs.readFile(file,'utf8');
    if(html.includes('a.lambert@pr-up.ru')) assert.match(path.relative(root,file),/^(?:en\/)?(?:privacy|personal-data-consent|cookies)\/index\.html$/);
    if(/^(?:en\/)?(?:privacy|personal-data-consent|cookies)\/index\.html$/.test(path.relative(root,file))) assert.doesNotMatch(html,/aleksandrlambert@gmail\.com/);
  }
});
