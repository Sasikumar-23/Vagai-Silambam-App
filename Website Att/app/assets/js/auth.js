/* Session helpers plus the shared app shell (sidebar, topbar, toasts).
   Upgraded with clean, modern SVG icons, slim navy sidebar, and polished SaaS aesthetics. */

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

const SVG_ICONS = {
  dashboard: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect></svg>`,
  students: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
  attendance: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 11l3 3L22 4"></path><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"></path></svg>`,
  events: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg>`,
  fees: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>`,
  uniforms: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.38 3.46L16 2a4 4 0 0 1-8 0L3.62 3.46a2 2 0 0 0-1.34 2.23l.58 3.5a2 2 0 0 0 1.63 1.65L7 11.27V21a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1v-9.73l2.53-.43a2 2 0 0 0 1.63-1.65l.58-3.5a2 2 0 0 0-1.36-2.23z"></path></svg>`,
  users: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 2l-2 2m-1.5 1.5L16 7l-1.5-1.5M19 4l-4 4-2-2-4 4 2 2-3 3H4v-4l3-3-2-2 4-4 2 2 4-4z"></path><circle cx="7.5" cy="16.5" r="1.5"></circle></svg>`,
  reports: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>`,
  subscription: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5z"></path><path d="M2 17l10 5 10-5"></path><path d="M2 12l10 5 10-5"></path></svg>`,
  settings: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg>`,
  logout: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`
};

const NAV = [
  { href: 'dashboard.html', key: 'nav_dashboard', icon: SVG_ICONS.dashboard },
  { href: 'students.html', key: 'nav_students', icon: SVG_ICONS.students },
  { href: 'attendance.html', key: 'nav_attendance', icon: SVG_ICONS.attendance },
  { href: 'events.html', key: 'nav_events', icon: SVG_ICONS.events },
  { href: 'fees.html', key: 'nav_fees', icon: SVG_ICONS.fees },
  { href: 'uniforms.html', key: 'nav_uniforms', icon: SVG_ICONS.uniforms },
  { href: 'users.html', key: 'nav_users', icon: SVG_ICONS.users },
  { href: 'reports.html', key: 'nav_reports', icon: SVG_ICONS.reports },
  { href: 'subscription.html', key: 'nav_subscription', icon: SVG_ICONS.subscription },
  { href: 'settings.html', key: 'nav_settings', icon: SVG_ICONS.settings },
];

export function mountShell({ titleKey }) {
  const page = location.pathname.split('/').pop() || 'dashboard.html';

  document.body.insertAdjacentHTML('afterbegin', `
    <div class="app">
      <div class="sidebar-scrim" hidden></div>
      <aside class="sidebar">
        <div class="brand">
          <span class="mark">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="4"/><path d="M6 21v-2a6 6 0 0 1 12 0v2"/></svg>
          </span>
          <div class="brand-text">
            <span class="brand-name" data-i18n="app_name">Vagai Silambam</span>
            <span class="brand-sub">Academy Portal</span>
          </div>
        </div>
        <nav class="sidebar-nav">
          ${NAV.map((item) => `
            <a href="${item.href}" class="${item.href === page ? 'active' : ''}">
              <span class="nav-icon" aria-hidden="true">${item.icon}</span>
              <span class="nav-text" data-i18n="${item.key}"></span>
            </a>`).join('')}
        </nav>
        <div class="spacer"></div>
        <div class="plan-chip" id="shell-plan"><span class="skeleton" style="display:block"></span></div>
        <a href="#" id="shell-logout" class="logout-link">
          <span class="nav-icon" aria-hidden="true">${SVG_ICONS.logout}</span>
          <span data-i18n="nav_logout">Log out</span>
        </a>
      </aside>
      <div class="main">
        <header class="topbar">
          <button class="menu-btn" id="shell-menu" aria-label="Menu">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"></line><line x1="3" y1="6" x2="21" y2="6"></line><line x1="3" y1="18" x2="21" y2="18"></line></svg>
          </button>
          <div class="topbar-title-wrap">
            <h2 data-i18n="${titleKey}"></h2>
          </div>
          <div class="topbar-actions">
            <div class="lang-toggle" id="shell-lang"></div>
          </div>
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
      <div class="plan-chip-head">
        <span class="plan-badge">${subscription.status}</span>
        <strong>${subscription.plan.name}</strong>
      </div>
      <div class="plan-chip-metric">${used} / ${limit < 0 ? '∞' : limit} active students</div>`;
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
