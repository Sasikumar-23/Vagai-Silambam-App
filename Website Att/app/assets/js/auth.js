/* Session helpers plus the shared app shell (sidebar, topbar, toasts). */

import { api, tokens } from './api.js';
import { applyTranslations, mountLanguageToggle, t } from './i18n.js';

export function requireSession() {
  if (!tokens.access) {
    location.href = 'login.html';
    return false;
  }
  return true;
}

export function redirectIfSignedIn() {
  if (tokens.access) location.href = 'dashboard.html';
}

export async function signOut() {
  try { await api.logout(); } catch { /* the session is going away regardless */ }
  tokens.clear();
  location.href = 'login.html';
}

const NAV = [
  { href: 'dashboard.html', key: 'nav_dashboard', icon: '▦' },
  { href: 'students.html', key: 'nav_students', icon: '👥' },
  { href: 'attendance.html', key: 'nav_attendance', icon: '✓' },
  { href: 'events.html', key: 'nav_events', icon: '★' },
  { href: 'fees.html', key: 'nav_fees', icon: '₹' },
  { href: 'uniforms.html', key: 'nav_uniforms', icon: '👕' },
  { href: 'reports.html', key: 'nav_reports', icon: '📊' },
  { href: 'subscription.html', key: 'nav_subscription', icon: '◆' },
  { href: 'settings.html', key: 'nav_settings', icon: '⚙' },
];

export function mountShell({ titleKey }) {
  const page = location.pathname.split('/').pop() || 'dashboard.html';

  document.body.insertAdjacentHTML('afterbegin', `
    <div class="app">
      <div class="sidebar-scrim" hidden></div>
      <aside class="sidebar">
        <div class="brand"><span class="mark">🥋</span><span data-i18n="app_name"></span></div>
        ${NAV.map((item) => `
          <a href="${item.href}" class="${item.href === page ? 'active' : ''}">
            <span aria-hidden="true">${item.icon}</span><span data-i18n="${item.key}"></span>
          </a>`).join('')}
        <div class="spacer"></div>
        <div class="plan-chip" id="shell-plan"><span class="skeleton" style="display:block"></span></div>
        <a href="#" id="shell-logout"><span aria-hidden="true">⎋</span><span data-i18n="nav_logout"></span></a>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="menu-btn" id="shell-menu" aria-label="Menu">☰</button>
          <h2 data-i18n="${titleKey}"></h2>
          <div class="lang-toggle" id="shell-lang"></div>
        </header>
        <main class="content" id="page"></main>
      </div>
    </div>
    <div class="toast-host" id="toast-host"></div>
  `);

  const sidebar = document.querySelector('.sidebar');
  const scrim = document.querySelector('.sidebar-scrim');
  const closeDrawer = () => { sidebar.classList.remove('open'); scrim.hidden = true; };

  document.getElementById('shell-menu').addEventListener('click', () => {
    sidebar.classList.add('open');
    scrim.hidden = false;
  });
  scrim.addEventListener('click', closeDrawer);

  document.getElementById('shell-logout').addEventListener('click', (event) => {
    event.preventDefault();
    signOut();
  });

  mountLanguageToggle(document.getElementById('shell-lang'));
  applyTranslations();
  loadPlanChip();

  return document.getElementById('page');
}

async function loadPlanChip() {
  const chip = document.getElementById('shell-plan');
  try {
    const subscription = await api.subscription();
    const limit = subscription.limits.students;
    const used = subscription.usage.students;
    chip.innerHTML = `
      <strong>${subscription.plan.name}</strong>
      ${subscription.status} · ${used}/${limit < 0 ? '∞' : limit} ${t('nav_students').toLowerCase()}`;
  } catch {
    chip.remove();
  }
}

export function toast(message, kind = 'success') {
  const host = document.getElementById('toast-host');
  if (!host) return;
  const node = document.createElement('div');
  node.className = `toast ${kind}`;
  node.textContent = message;
  host.appendChild(node);
  setTimeout(() => node.remove(), 3600);
}

export function showError(container, error) {
  container.hidden = false;
  container.textContent = error?.message || 'Something went wrong';
}
