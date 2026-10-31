/**
 * Inner pages (About, Contact, FAQ, Features, Pricing, Privacy, Terms, Refunds):
 * the mobile menu, scroll reveals, the FAQ accordion and the pricing toggle.
 * Animation helpers come from motion.js.
 */
(function () {
  'use strict';

  var M = window.VSMotion;
  var $ = function (selector, scope) { return (scope || document).querySelector(selector); };
  var $$ = function (selector, scope) { return Array.prototype.slice.call((scope || document).querySelectorAll(selector)); };

  /* ───────────── Mobile menu ───────────── */

  var button = $('#menuBtn');
  var nav = $('#siteNav');

  function setOpen(open) {
    nav.classList.toggle('open', open);
    button.setAttribute('aria-expanded', String(open));
  }

  button.addEventListener('click', function () { setOpen(!nav.classList.contains('open')); });
  nav.addEventListener('click', function (event) { if (event.target.closest('a')) setOpen(false); });
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && nav.classList.contains('open')) { setOpen(false); button.focus(); }
  });

  if (!M) return;

  /* ───────────── Scroll reveal ───────────── */

  ['.cards', '.plans'].forEach(function (group) {
    $$(group).forEach(function (list) { M.reveal(list.children, { stagger: 70 }); });
  });
  M.reveal($$('.legal-card, .section-head, .toggle, .plan-note, .enterprise, .faq, .kolam'));

  /* ───────────── FAQ accordion ───────────── */

  M.accordion($$('#faqList details'));

  /* ───────────── Pricing: monthly and yearly, with the prices rolling ───────────── */

  var toggle = $('#billToggle');
  if (toggle) {
    var monthly = $('#billMonthly');
    var yearly = $('#billYearly');
    var rupees = function (n) { return '₹' + M.format(n); };

    // Start from the monthly price each card was written with.
    $$('.plan-amount[data-monthly]').forEach(function (el) { el.dataset.shown = el.dataset.monthly; });

    var choose = function (next) {
      if (toggle.dataset.billing === next) return;
      toggle.dataset.billing = next;
      monthly.setAttribute('aria-pressed', String(next === 'monthly'));
      yearly.setAttribute('aria-pressed', String(next === 'yearly'));
      $$('.plan-amount[data-monthly]').forEach(function (el) {
        var target = Number(next === 'yearly' ? el.dataset.yearly : el.dataset.monthly);
        var card = el.closest('.plan');
        var saving = Number(el.dataset.monthly) * 12 - Number(el.dataset.yearly);
        M.tween(Number(el.dataset.shown), target, 550, function (n) { el.textContent = rupees(n); });
        el.dataset.shown = String(target);
        $('.plan-period', card).textContent = next === 'yearly' ? 'per year' : 'per month';
        $('.plan-save', card).textContent = next === 'yearly' && saving > 0 ? 'Save about ₹' + M.format(saving) : '';
      });
    };
    monthly.addEventListener('click', function () { choose('monthly'); });
    yearly.addEventListener('click', function () { choose('yearly'); });
  }

  M.parallax();
})();
