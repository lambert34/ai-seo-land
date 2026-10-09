import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'dist');

const PUBLIC_DIRECTORIES = [
  'about',
  'articles',
  'assets',
  'bitrix-support',
  'cases',
  'cookies',
  'css',
  'en',
  'js',
  'landing',
  'personal-data-consent',
  'privacy',
  'site-help'
];

const PUBLIC_FILES = [
  'index.html',
  'robots.txt',
  'sitemap.xml',
  'google3ee5664e5eda5bb5.html',
  'yandex_0ffc78e221a5351f.html'
];

const REQUIRED_OUTPUTS = [
  'index.html',
  'en/index.html',
  'assets/images/new-logo.png',
  'assets/images/A.png',
  'css/main.css',
  'js/cookie-consent.js',
  'robots.txt',
  'sitemap.xml'
];

async function copyRequired(sourcePath, targetPath) {
  await fs.access(sourcePath);
  await fs.cp(sourcePath, targetPath, { recursive: true });
}

await fs.rm(OUT, { recursive: true, force: true });
await fs.mkdir(OUT, { recursive: true });

for (const directory of PUBLIC_DIRECTORIES) {
  await copyRequired(path.join(ROOT, directory), path.join(OUT, directory));
}

for (const file of PUBLIC_FILES) {
  await copyRequired(path.join(ROOT, file), path.join(OUT, file));
}

for (const relativePath of REQUIRED_OUTPUTS) {
  await fs.access(path.join(OUT, relativePath));
}

// GitHub Pages-specific CNAME must not be published into the Cloudflare Pages artifact.
try {
  await fs.access(path.join(OUT, 'CNAME'));
  throw new Error('Cloudflare artifact unexpectedly contains CNAME');
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

console.log(`Cloudflare Pages artifact ready: ${OUT}`);
console.log(`Copied ${PUBLIC_DIRECTORIES.length} public directories and ${PUBLIC_FILES.length} public root files.`);
