/* Centralised translation. Pages mark text with data-i18n; no Tamil strings live in markup. */

import { TRANSLATIONS } from './translations.js';

const LANG_KEY = 'vagai_language';

export function currentLanguage() {
  return localStorage.getItem(LANG_KEY) === 'ta' ? 'ta' : 'en';
}

export function t(key) {
  const entry = TRANSLATIONS[key];
  if (!entry) return key;
  return entry[currentLanguage()] || entry.en || key;
}

export function applyTranslations(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = t(el.dataset.i18n);
  });
  root.querySelectorAll('[data-i18n-placeholder]').forEach((el) => {
    el.setAttribute('placeholder', t(el.dataset.i18nPlaceholder));
  });
  document.documentElement.lang = currentLanguage();
}

export function setLanguage(lang) {
  localStorage.setItem(LANG_KEY, lang === 'ta' ? 'ta' : 'en');
  applyTranslations();
  document.querySelectorAll('.lang-toggle button').forEach((button) => {
    button.classList.toggle('active', button.dataset.lang === currentLanguage());
  });
}

export function mountLanguageToggle(container) {
  if (!container) return;
  container.innerHTML = `
    <button type="button" data-lang="en">English</button>
    <button type="button" data-lang="ta">தமிழ்</button>`;
  container.querySelectorAll('button').forEach((button) => {
    button.addEventListener('click', () => setLanguage(button.dataset.lang));
  });
  setLanguage(currentLanguage());
}
