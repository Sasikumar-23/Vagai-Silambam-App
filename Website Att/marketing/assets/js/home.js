/**
 * Vagai Silambam marketing page behaviour.
 * Language toggle, attendance demo, pricing toggle, FAQ and mobile menu.
 * All copy comes from content.js (window.SITE_CONTENT).
 */
(function () {
  'use strict';

  const C = window.SITE_CONTENT;
  const LANG_KEY = 'vs_lang';
  const DEMO_START = ['present', 'present', 'late', 'absent'];
  const DEMO_STATUSES = [
    { value: 'present', icon: 'i-check' },
    { value: 'late', icon: 'i-clock' },
    { value: 'absent', icon: 'i-x' },
    { value: 'leave', icon: 'i-minus' },
  ];

  let lang = pickLanguage();
  let billing = 'monthly';
  let demoState = DEMO_START.slice();

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  function t(key, vars) {
    let text = (C[lang] && C[lang][key]) || C.en[key] || key;
    if (vars) {
      text = text.replace(/\{(\w+)\}/g, (match, name) => (name in vars ? vars[name] : match));
    }
    return text;
  }

  function pickLanguage() {
    const fromUrl = new URLSearchParams(location.search).get('lang');
    if (fromUrl === 'ta' || fromUrl === 'en') return fromUrl;
    try {
      const saved = localStorage.getItem(LANG_KEY);
      if (saved === 'ta' || saved === 'en') return saved;
    } catch (e) { /* storage can be blocked; fall through */ }
    const preferred = (navigator.languages && navigator.languages[0]) || navigator.language || 'en';
    return preferred.toLowerCase().startsWith('ta') ? 'ta' : 'en';
  }

  const icon = (name) => `<svg class="icon" aria-hidden="true"><use href="#${name}"/></svg>`;
  const rupees = (amount) => '₹' + new Intl.NumberFormat('en-IN').format(amount);

  /* ───────────── Language ───────────── */

  function applyLanguage() {
    document.documentElement.lang = lang;
    document.title = t('meta.title');
    const description = $('meta[name="description"]');
    if (description) description.setAttribute('content', t('meta.desc'));

    $$('[data-i18n]').forEach((el) => { el.textContent = t(el.dataset.i18n); });
    $$('[data-i18n-aria]').forEach((el) => { el.setAttribute('aria-label', t(el.dataset.i18nAria)); });
    $$('[data-link]').forEach((el) => { el.setAttribute('href', C.link(el.dataset.link, lang)); });

    // Contact details that still hold placeholder values are outlined so they are not missed.
    $$('[data-text]').forEach((el) => {
      const value = C.config[el.dataset.text];
      el.textContent = value;
      el.classList.toggle('is-placeholder', /your-domain|00000/.test(value));
    });

    const count = $('#proofCount');
    if (count) {
      const hasCount = Number.isFinite(C.config.academyCount) && C.config.academyCount > 0;
      count.hidden = !hasCount;
      if (hasCount) count.textContent = t('proof.count', { n: C.config.academyCount });
    }

    renderDemo();
    renderPricing();
  }

  function setLanguage(next) {
    lang = next;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignore */ }
    applyLanguage();
  }

  /* ───────────── Attendance demo ───────────── */

  function renderDemo() {
    const list = $('#demoList');
    if (!list) return;
    list.innerHTML = demoState.map((status, i) => {
      const n = i + 1;
      const options = DEMO_STATUSES.map((s) => `
        <label class="seg-opt seg-${s.value}">
          <input type="radio" name="student-${n}" value="${s.value}"${status === s.value ? ' checked' : ''}>
          <span>${icon(s.icon)}${t('demo.' + s.value)}</span>
        </label>`).join('');
      return `
        <fieldset class="student" data-index="${i}">
          <legend>${t('demo.s' + n + '.name')}<small>${t('demo.s' + n + '.sash')}</small></legend>
          <div class="seg">${options}</div>
        </fieldset>`;
    }).join('');
    updateDemoSummary();
  }

  function updateDemoSummary() {
    const counts = { present: 0, late: 0, absent: 0, leave: 0 };
    demoState.forEach((status) => { counts[status] += 1; });
    const summary = $('#demoSummary');
    if (summary) summary.textContent = t('demo.summary', counts);
  }

  function initDemo() {
    const list = $('#demoList');
    list.addEventListener('change', (event) => {
      const student = event.target.closest('.student');
      if (!student) return;
      demoState[Number(student.dataset.index)] = event.target.value;
      updateDemoSummary();
    });
    $('#demoMarkAll').addEventListener('click', () => {
      demoState = demoState.map(() => 'present');
      renderDemo();
    });
    $('#demoReset').addEventListener('click', () => {
      demoState = DEMO_START.slice();
      renderDemo();
    });
  }

  /* ───────────── Pricing ───────────── */

  function renderPricing() {
    const grid = $('#pricingGrid');
    if (!grid) return;
    const yearly = billing === 'yearly';
    grid.innerHTML = C.config.plans.map((plan) => {
      const price = yearly ? plan.yearly : plan.monthly;
      const saving = plan.monthly * 12 - plan.yearly;
      return `
        <article class="plan${plan.recommended ? ' is-recommended' : ''}">
          ${plan.recommended ? `<span class="plan-badge">${t('pricing.recommended')}</span>` : ''}
          <h3>${t('plan.' + plan.code)}</h3>
          <p class="plan-price">${rupees(price)}</p>
          <p class="plan-period">${t(yearly ? 'pricing.perYear' : 'pricing.perMonth')}</p>
          <p class="plan-save">${yearly && saving > 0 ? t('pricing.yearSave', { n: new Intl.NumberFormat('en-IN').format(saving) }) : ''}</p>
          <ul>
            <li>${icon('i-check')}<span>${t('pricing.students', { n: plan.students })}</span></li>
            <li>${icon('i-check')}<span>${t('pricing.branches', { n: plan.branches })}</span></li>
            <li>${icon('i-check')}<span>${t('pricing.users', { n: plan.users })}</span></li>
          </ul>
          <a class="btn ${plan.recommended ? 'btn-primary' : 'btn-outline'}" data-link="trial" href="${C.link('trial', lang)}">${t('pricing.cta')}</a>
        </article>`;
    }).join('');
  }

  function initPricingToggle() {
    const monthly = $('#billMonthly');
    const yearly = $('#billYearly');
    const choose = (next) => {
      billing = next;
      monthly.setAttribute('aria-pressed', String(next === 'monthly'));
      yearly.setAttribute('aria-pressed', String(next === 'yearly'));
      renderPricing();
    };
    monthly.addEventListener('click', () => choose('monthly'));
    yearly.addEventListener('click', () => choose('yearly'));
  }

  /* ───────────── FAQ, menu, reveal ───────────── */

  function initFaq() {
    const items = $$('#faqList details');
    items.forEach((item) => {
      item.addEventListener('toggle', () => {
        if (!item.open) return;
        items.forEach((other) => { if (other !== item) other.open = false; });
      });
    });
  }

  function initMenu() {
    const button = $('#menuBtn');
    const nav = $('#siteNav');
    const setOpen = (open) => {
      nav.classList.toggle('open', open);
      button.setAttribute('aria-expanded', String(open));
    };
    button.addEventListener('click', () => setOpen(!nav.classList.contains('open')));
    nav.addEventListener('click', (event) => { if (event.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); button.focus(); }
    });
  }

  function initReveal() {
    const items = $$('.reveal');
    if (!('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -40px 0px', threshold: 0.1 });
    items.forEach((el) => observer.observe(el));
  }

  /* ───────────── Start ───────────── */

  document.addEventListener('DOMContentLoaded', () => {
    $$('[data-lang-toggle]').forEach((button) => {
      button.addEventListener('click', () => setLanguage(lang === 'en' ? 'ta' : 'en'));
    });
    initDemo();
    initPricingToggle();
    initFaq();
    initMenu();
    initReveal();
    applyLanguage();

    if (/^91?0+$/.test(C.config.whatsapp)) {
      console.warn('Vagai Silambam: replace the placeholder WhatsApp number in assets/js/content.js.');
    }
  });
})();
