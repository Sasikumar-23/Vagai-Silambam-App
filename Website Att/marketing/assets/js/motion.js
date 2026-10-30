/**
 * Vagai Silambam motion helpers. No libraries. Load before home.js.
 *
 *   VSMotion.enabled                      true unless the visitor asked for reduced motion
 *   VSMotion.reveal(elements, options)    fade and slide up when scrolled into view, once
 *   VSMotion.splitWords(element, animate) wrap each word so CSS can stagger them (80 ms apart)
 *   VSMotion.tween(from, to, ms, onStep)  eased number animation (counters, rolling prices)
 *   VSMotion.counters(root)               count up every [data-count][data-target] when visible
 *   VSMotion.parallax()                   nudge [data-parallax="px"] elements by at most 20 px
 *
 * Only transform and opacity are animated here, apart from the number text itself.
 */
(function () {
  'use strict';

  const root = document.documentElement;
  const enabled = root.classList.contains('motion');
  const $$ = (selector, scope = document) => Array.from(scope.querySelectorAll(selector));
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);

  /* ───────────── Scroll reveal: add class="reveal" (and optionally --d for a delay) ───────────── */

  let observer = null;
  function reveal(elements, options = {}) {
    const items = Array.from(elements);
    if (!enabled || !('IntersectionObserver' in window)) {
      items.forEach((el) => el.classList.add('is-visible'));
      return;
    }
    if (!observer) {
      observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target); // once only
        });
      }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    }
    const step = options.stagger ?? 0;
    items.forEach((el, i) => {
      el.classList.add('reveal');
      if (step) el.style.setProperty('--d', `${Math.min(i * step, 420)}ms`);
      observer.observe(el);
    });
  }

  // Groups whose children should arrive one after another, and blocks that arrive on their own.
  function initReveal() {
    ['.cards', '.terms', '.steps', '.quotes'].forEach((group) => {
      $$(group).forEach((list) => reveal(list.children, { stagger: 70 }));
    });
    reveal($$('.section-head, .olai, .demo, .toggle, #pricingGrid, .plans-note, .enterprise, .faq, .stats-row, .kolam'));
  }

  /* ───────────── Headline words ───────────── */

  function splitWords(el, animate = true) {
    const words = el.textContent.trim().split(/\s+/);
    el.innerHTML = words
      .map((word, i) => `<span class="w${animate ? '' : ' w-static'}" style="--i:${i}">${word.replace(/&/g, '&amp;').replace(/</g, '&lt;')}</span>`)
      .join(' ');
  }

  /* ───────────── Numbers ───────────── */

  function tween(from, to, ms, onStep) {
    if (!enabled || from === to) { onStep(to); return; }
    const start = performance.now();
    const frame = (now) => {
      const t = Math.min(1, (now - start) / ms);
      onStep(Math.round(from + (to - from) * easeOut(t)));
      if (t < 1) requestAnimationFrame(frame);
    };
    requestAnimationFrame(frame);
  }

  const format = (n) => new Intl.NumberFormat('en-IN').format(n);

  function counters(scope = document) {
    const targets = $$('[data-count][data-target]', scope);
    const run = (el) => {
      const target = Number(el.dataset.target);
      tween(0, target, 1400, (n) => { el.textContent = format(n) + (n === target ? '+' : ''); });
    };
    if (!enabled || !('IntersectionObserver' in window)) {
      targets.forEach((el) => { el.textContent = format(Number(el.dataset.target)) + '+'; });
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        io.unobserve(entry.target);
        run(entry.target);
      });
    }, { threshold: 0.4 });
    targets.forEach((el) => io.observe(el));
  }

  /* ───────────── Parallax: at most 20 px, only while the element's section is on screen ───────────── */

  function parallax() {
    if (!enabled) return;
    const items = $$('[data-parallax]').map((el) => ({
      el,
      max: Math.max(-20, Math.min(20, Number(el.dataset.parallax) || 0)),
      host: el.closest('section') || el.parentElement,
    }));
    if (!items.length) return;
    let queued = false;
    const update = () => {
      queued = false;
      const vh = window.innerHeight;
      items.forEach(({ el, max, host }) => {
        const box = host.getBoundingClientRect();
        if (box.bottom < 0 || box.top > vh) return;
        const progress = ((box.top + box.height / 2) - vh / 2) / (vh / 2 + box.height / 2);
        el.style.setProperty('--py', `${(Math.max(-1, Math.min(1, progress)) * max).toFixed(1)}px`);
      });
    };
    window.addEventListener('scroll', () => { if (!queued) { queued = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener('resize', update);
    update();
  }

  window.VSMotion = { enabled, reveal, initReveal, splitWords, tween, counters, parallax, format };
  window.__vsReady = true;
})();
