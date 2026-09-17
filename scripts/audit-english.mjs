import fs from 'node:fs/promises';
import path from 'node:path';

const root = path.resolve('en');
const cyrillic = /[А-Яа-яЁё]/;
const allowed = /RU — Russian/;

async function htmlFiles(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const target = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await htmlFiles(target));
    else if (entry.name.endsWith('.html')) files.push(target);
  }
  return files;
}

const failures = [];
const files = await htmlFiles(root);
for (const file of files) {
  const lines = (await fs.readFile(file, 'utf8')).split('\n');
  lines.forEach((line, index) => {
    const withoutLanguageOption = line.replaceAll('RU — Russian', '');
    if (cyrillic.test(withoutLanguageOption)) failures.push(`${path.relative('.', file)}:${index + 1}: ${line.trim()}`);
  });
}
if (failures.length) {
  console.error(`Unexpected Cyrillic found in English HTML:\n${failures.join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`English localization audit passed: ${files.length} pages; only the intentional “${allowed.source}” language option is allowed.`);
}
