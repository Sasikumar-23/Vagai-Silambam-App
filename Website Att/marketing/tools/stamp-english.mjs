/**
 * Writes the English copy from assets/js/content.js into index.html.
 *
 * index.html keeps readable English text so the page shows up in search results and on slow
 * phones before JavaScript runs. Run this after you edit English copy or contact details:
 *
 *   node tools/stamp-english.mjs          update index.html
 *   node tools/stamp-english.mjs --check  only check; exit with an error if anything is wrong
 *
 * It also checks that English and Tamil have the same keys and that every key used in the
 * HTML exists.
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const htmlPath = path.join(root, 'index.html');
const checkOnly = process.argv.includes('--check');

const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join(root, 'assets/js/content.js'), 'utf8'), sandbox);
const content = sandbox.window.SITE_CONTENT;

const escapeText = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const escapeAttr = (s) => escapeText(s).replace(/"/g, '&quot;');

const problems = [];
const enKeys = new Set(Object.keys(content.en));
const taKeys = new Set(Object.keys(content.ta));
for (const key of enKeys) if (!taKeys.has(key)) problems.push(`Tamil is missing "${key}"`);
for (const key of taKeys) if (!enKeys.has(key)) problems.push(`English is missing "${key}"`);

const usedKeys = new Set();
const english = (key) => {
  usedKeys.add(key);
  if (!(key in content.en)) { problems.push(`index.html uses unknown key "${key}"`); return null; }
  return content.en[key];
};

let html = fs.readFileSync(htmlPath, 'utf8');
const before = html;

// Text content: <tag data-i18n="key">…</tag>
html = html.replace(/(<(\w+)\b[^>]*\bdata-i18n="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g, (whole, open, tag, key, inner, close) => {
  const text = english(key);
  return text === null ? whole : `${open}${escapeText(text)}${close}`;
});

// Quiet second line: data-i18n-other="key" shows the Tamil text under the English page.
html = html.replace(/(<(\w+)\b[^>]*\bdata-i18n-other="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g, (whole, open, tag, key, inner, close) => {
  usedKeys.add(key);
  if (!(key in content.ta)) { problems.push(`index.html uses unknown key "${key}"`); return whole; }
  return `${open}${escapeText(content.ta[key])}${close}`;
});

// Accessible labels: data-i18n-aria="key" sets aria-label.
html = html.replace(/<(\w+)\b[^>]*\bdata-i18n-aria="([^"]+)"[^>]*>/g, (tag, name, key) => {
  const text = english(key);
  return text === null ? tag : tag.replace(/aria-label="[^"]*"/, `aria-label="${escapeAttr(text)}"`);
});

// Links: data-link="name" sets href.
html = html.replace(/<(\w+)\b[^>]*\bdata-link="([^"]+)"[^>]*>/g, (tag, name, link) => {
  const href = content.link(link, 'en');
  return tag.replace(/href="[^"]*"/, `href="${escapeAttr(href)}"`);
});

// Contact details: data-text="email" shows config.email, and so on.
html = html.replace(/(<(\w+)\b[^>]*\bdata-text="([^"]+)"[^>]*>)([\s\S]*?)(<\/\2>)/g, (whole, open, tag, name, inner, close) => {
  const value = content.config[name];
  if (value === undefined) { problems.push(`index.html uses unknown setting "${name}"`); return whole; }
  return `${open}${escapeText(String(value))}${close}`;
});

// Page title and description.
html = html.replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeText(content.en['meta.title'])}</title>`);
html = html.replace(/(<meta name="description" content=")[^"]*(")/, `$1${escapeAttr(content.en['meta.desc'])}$2`);
usedKeys.add('meta.title');
usedKeys.add('meta.desc');

// Keys that exist but are not used by the HTML are fine if the script builds them (demo, plans).
const builtByScript = /^(demo\.s\d\.|demo\.(present|late|absent|leave|summary)$|plan\.|pricing\.(perMonth|perYear|yearSave|recommended|cta|students|branches|users)$|proof\.count$)/;
for (const key of enKeys) {
  if (!usedKeys.has(key) && !builtByScript.test(key)) problems.push(`"${key}" is not used in index.html`);
}

if (problems.length) {
  console.error(problems.map((p) => `  - ${p}`).join('\n'));
  console.error(`\n${problems.length} problem(s) found.`);
  process.exit(1);
}

if (checkOnly) {
  if (html !== before) {
    console.error('index.html is out of date. Run: node tools/stamp-english.mjs');
    process.exit(1);
  }
  console.log('OK: English and Tamil match, and index.html is up to date.');
} else {
  fs.writeFileSync(htmlPath, html);
  console.log(html === before ? 'index.html already up to date.' : 'index.html updated.');
  console.log(`English and Tamil both have ${enKeys.size} keys.`);
}
