/**
 * Vagai Silambam marketing page behaviour.
 * Language toggle, attendance demo, pricing toggle, FAQ, mobile menu and the stats strip.
 * All copy comes from content.js (window.SITE_CONTENT); animation helpers come from motion.js.
 */
(function () {
  'use strict';

  const C = window.SITE_CONTENT;
  const M = window.VSMotion || { enabled: false, tween: (a, b, ms, cb) => cb(b), counters() {}, splitWords() {}, parallax() {}, initReveal() {}, reveal() {}, format: (n) => String(n) };
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
  let rippleTimers = [];
  let titleSplit = false;

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

    // A quieter line in the other language, so the headline reads in both Tamil and English.
    const other = lang === 'ta' ? 'en' : 'ta';
    $$('[data-i18n-other]').forEach((el) => {
      el.textContent = C[other][el.dataset.i18nOther];
      el.lang = other;
    });

    // The headline words arrive one by one on first load; after a language switch they just fade.
    $$('[data-split]').forEach((el) => { M.splitWords(el, !titleSplit); });
    titleSplit = true;

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

  // Fades the text out, swaps the language while it is invisible, fades back in, and keeps the
  // reader's place on the page so nothing appears to jump.
  function setLanguage(next) {
    lang = next;
    try { localStorage.setItem(LANG_KEY, lang); } catch (e) { /* ignore */ }
    if (!M.enabled) { applyLanguage(); return; }

    // Remember something just below the sticky header so it can be put back where it was.
    const headerH = $('.site-header').offsetHeight;
    const probe = document.elementFromPoint(window.innerWidth / 2, headerH + 40);
    const anchor = probe && probe.closest('section, details, li, footer');
    const before = anchor ? anchor.getBoundingClientRect().top : 0;

    document.body.classList.add('is-swapping');
    setTimeout(() => {
      applyLanguage();
      if (anchor && document.contains(anchor)) {
        const shift = anchor.getBoundingClientRect().top - before;
        if (Math.abs(shift) > 1) window.scrollBy({ top: shift, behavior: 'instant' });
      }
      requestAnimationFrame(() => document.body.classList.remove('is-swapping'));
    }, 190);
  }

  /* ───────────── Attendance demo ───────────── */

  function renderDemo() {
    const list = $('#demoList');
    if (!list) return;
    rippleTimers.forEach(clearTimeout);
    rippleTimers = [];
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

  // A quick pop on the chosen button; the colour change itself is a CSS transition.
  function pop(input) {
    if (!M.enabled) return;
    const label = input.closest('.seg-opt');
    label.classList.remove('pop');
    void label.offsetWidth;
    label.classList.add('pop');
    label.addEventListener('animationend', () => label.classList.remove('pop'), { once: true });
  }

  function initDemo() {
    const list = $('#demoList');
    list.addEventListener('change', (event) => {
      const student = event.target.closest('.student');
      if (!student) return;
      demoState[Number(student.dataset.index)] = event.target.value;
      pop(event.target);
      updateDemoSummary();
    });
    // "Mark everyone present" ripples down the rows, one after another.
    $('#demoMarkAll').addEventListener('click', () => {
      rippleTimers.forEach(clearTimeout);
      rippleTimers = $$('.student', list).map((row, i) => setTimeout(() => {
        const input = $('input[value="present"]', row);
        demoState[i] = 'present';
        if (!input.checked) { input.checked = true; pop(input); }
        updateDemoSummary();
      }, M.enabled ? i * 110 : 0));
    });
    $('#demoReset').addEventListener('click', () => {
      demoState = DEMO_START.slice();
      renderDemo();
    });
  }

  /* ───────────── Pricing ───────────── */

  const shownPrice = {};

  function renderPricing() {
    const grid = $('#pricingGrid');
    if (!grid) return;
    grid.innerHTML = C.config.plans.map((plan) => `
        <article class="plan${plan.recommended ? ' is-recommended' : ''}" data-plan="${plan.code}">
          ${plan.recommended ? `<span class="plan-badge">${t('pricing.recommended')}</span>` : ''}
          <h3>${t('plan.' + plan.code)}</h3>
          <p class="plan-price"><span class="plan-amount"></span></p>
          <p class="plan-period"></p>
          <p class="plan-save"></p>
          <ul>
            <li>${icon('i-check')}<span>${t('pricing.students', { n: plan.students })}</span></li>
            <li>${icon('i-check')}<span>${t('pricing.branches', { n: plan.branches })}</span></li>
            <li>${icon('i-check')}<span>${t('pricing.users', { n: plan.users })}</span></li>
          </ul>
          <a class="btn ${plan.recommended ? 'btn-primary' : 'btn-outline'}" data-link="trial" href="${C.link('trial', lang)}">${t('pricing.cta')}</a>
        </article>`).join('');
    applyBilling(false);
  }

  // Sets each plan's price, period and saving. When the toggle moves, the numbers roll to the new price.
  function applyBilling(animate) {
    const yearly = billing === 'yearly';
    $$('#pricingGrid .plan').forEach((card) => {
      const plan = C.config.plans.find((p) => p.code === card.dataset.plan);
      const target = yearly ? plan.yearly : plan.monthly;
      const saving = plan.monthly * 12 - plan.yearly;
      const amount = $('.plan-amount', card);
      const from = animate && shownPrice[plan.code] != null ? shownPrice[plan.code] : target;
      M.tween(from, target, 550, (n) => { amount.textContent = rupees(n); });
      shownPrice[plan.code] = target;
      $('.plan-period', card).textContent = t(yearly ? 'pricing.perYear' : 'pricing.perMonth');
      $('.plan-save', card).textContent = yearly && saving > 0 ? t('pricing.yearSave', { n: new Intl.NumberFormat('en-IN').format(saving) }) : '';
    });
  }

  function initPricingToggle() {
    const toggle = $('#billToggle');
    const monthly = $('#billMonthly');
    const yearly = $('#billYearly');
    const choose = (next) => {
      if (billing === next) return;
      billing = next;
      toggle.dataset.billing = next;
      monthly.setAttribute('aria-pressed', String(next === 'monthly'));
      yearly.setAttribute('aria-pressed', String(next === 'yearly'));
      applyBilling(true);
    };
    monthly.addEventListener('click', () => choose('monthly'));
    yearly.addEventListener('click', () => choose('yearly'));
  }

  /* ───────────── FAQ: one open at a time, height eases open and closed ───────────── */

  function initFaq() {
    const items = $$('#faqList details');

    const animate = (item, opening) => {
      const body = $('p', item);
      body.getAnimations().forEach((a) => a.cancel());
      if (!M.enabled) { item.open = opening; return; }
      item.open = true; // keep it rendered while it animates
      const pad = getComputedStyle(body).paddingBottom;
      const full = body.scrollHeight;
      const shut = { height: '0px', paddingBottom: '0px', opacity: 0 };
      const wide = { height: `${full}px`, paddingBottom: pad, opacity: 1 };
      body.style.overflow = 'hidden';
      const run = body.animate(opening ? [shut, wide] : [wide, shut], { duration: 380, easing: 'cubic-bezier(0.22, 1, 0.36, 1)' });
      run.onfinish = () => { body.style.overflow = ''; if (!opening) item.open = false; };
      run.oncancel = () => { body.style.overflow = ''; };
    };

    const close = (item) => { item.removeAttribute('data-open'); animate(item, false); };
    const open = (item) => { item.setAttribute('data-open', ''); animate(item, true); };

    items.forEach((item) => {
      $('summary', item).addEventListener('click', (event) => {
        event.preventDefault();
        if (item.hasAttribute('data-open')) { close(item); return; }
        items.forEach((other) => { if (other !== item && other.hasAttribute('data-open')) close(other); });
        open(item);
      });
    });
  }

  /* ───────────── Mobile menu ───────────── */

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

  /* ───────────── Stats strip: shown only for numbers that have been filled in ───────────── */

  function initStats() {
    const section = $('#stats');
    if (!section) return;
    const stats = C.config.stats || {};
    let any = false;
    $$('[data-stat]', section).forEach((item) => {
      const value = stats[item.dataset.stat];
      const real = Number.isFinite(value) && value > 0;
      item.hidden = !real;
      if (!real) return;
      any = true;
      const number = $('.count', item);
      number.dataset.target = String(value);
      number.textContent = M.enabled ? '0' : M.format(value) + '+';
    });
    section.hidden = !any;
    if (any) M.counters(section);
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
    applyLanguage();
    initStats();
    M.initReveal();
    M.parallax();

    if (/^91?0+$/.test(C.config.whatsapp)) {
      console.warn('Vagai Silambam: replace the placeholder WhatsApp number in assets/js/content.js.');
    }
  });
})();
