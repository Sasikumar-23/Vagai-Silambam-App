/* auth.js — Shell layout with role-aware sidebar (SuperAdmin / Admin) */

import { api, tokens } from './api.js';

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
  try { await api.logout(); } catch { /* session going away regardless */ }
  tokens.clear();
  localStorage.removeItem('vagai_role');
  localStorage.removeItem('vagai_user');
  location.href = 'login.html';
}

export function showError(el, err) {
  el.textContent = err?.message || 'Something went wrong.';
  el.hidden = false;
}

export function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('vagai_user') || '{}'); } catch { return {}; }
}

export function isSuperAdmin() {
  return getCurrentUser().role === 'SUPER_ADMIN';
}

const SVG = {
  dashboard: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7"></rect><rect x="14" y="3" width="7" height="7"></rect><rect x="3" y="14" width="7" height="7"></rect><rect x="14" y="14" width="7" height="7"></rect></svg>`,
  customers: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>`,
  subscription: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"></rect><line x1="1" y1="10" x2="23" y2="10"></line></svg>`,
  licenses: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
  logout: `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>`,
  star: `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>`
};

const NAV_ALL = [
  { href: 'dashboard.html',     label: 'Dashboard',             icon: SVG.dashboard,      superAdminOnly: false },
  { href: 'customers.html',     label: 'Customers & Users',     icon: SVG.customers,      superAdminOnly: false },
  { href: 'subscription.html',  label: 'Subscriptions',         icon: SVG.subscription,   superAdminOnly: false },
  { href: 'licenses.html',      label: 'Users & Licenses',      icon: SVG.licenses,       superAdminOnly: false },
  { href: 'activity.html',      label: 'Activity & API Logs',   icon: SVG.customers,      superAdminOnly: true  },
];

export function mountShell({ titleKey, title }) {
  const page = location.pathname.split('/').pop() || 'dashboard.html';
  const user = getCurrentUser();
  const role = user.role || '';
  const isSA = role === 'SUPER_ADMIN';
  const displayName = user.full_name_en || user.username || 'Admin';

  // Filter nav items by role
  const NAV = NAV_ALL.filter(item => !item.superAdminOnly || isSA);

  // Redirect non-super-admins away from super-admin-only pages
  const currentItem = NAV_ALL.find(item => item.href === page);
  if (currentItem && currentItem.superAdminOnly && !isSA) {
    location.href = 'dashboard.html';
    return;
  }

  document.body.insertAdjacentHTML('afterbegin', `
    <div class="app">
      <div class="sidebar-scrim" id="sb-scrim" hidden></div>
      <aside class="sidebar" id="sidebar">
        <div class="brand">
          <img class="brand-icon" src="assets/img/logo.svg" alt="" width="40" height="40">
          <div class="brand-text">
            <span class="brand-name">Vagai Silambam</span>
            <span class="brand-sub">Management Portal</span>
          </div>
        </div>

        ${isSA ? `<div class="role-chip superadmin">${SVG.star} Super Admin</div>` : `<div class="role-chip admin">Admin</div>`}

        <nav class="sidebar-nav">
          ${NAV.map(item => `
            <a href="${item.href}" class="nav-link ${item.href === page ? 'active' : ''}">
              <span class="nav-icon">${item.icon}</span>
              <span class="nav-text">${item.label}</span>
            </a>`).join('')}
        </nav>

        <div class="sidebar-footer">
          <div class="user-chip">
            <div class="user-avatar">${displayName.charAt(0).toUpperCase()}</div>
            <div class="user-info">
              <span class="user-name">${displayName}</span>
              <span class="user-role">${role.replace('_', ' ')}</span>
            </div>
          </div>
          <a href="#" id="shell-logout" class="logout-link" title="Sign out">
            ${SVG.logout}
          </a>
        </div>
      </aside>

      <div class="main">
        <header class="topbar">
          <button class="menu-btn" id="shell-menu" aria-label="Toggle sidebar">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>
          </button>
          <div class="topbar-title">
            <h2 id="page-title">${title || ''}</h2>
          </div>
          <div class="topbar-right">
            <div class="topbar-user">
              <div class="topbar-avatar">${displayName.charAt(0).toUpperCase()}</div>
              <span class="topbar-name">${displayName}</span>
            </div>
          </div>
        </header>
        <main class="content" id="page"></main>
      </div>
    </div>
    <div class="toast-host" id="toast-host"></div>
  `);

  // Mobile toggle
  const sidebar = document.getElementById('sidebar');
  const scrim = document.getElementById('sb-scrim');
  document.getElementById('shell-menu').addEventListener('click', () => {
    const open = sidebar.classList.toggle('open');
    scrim.hidden = !open;
  });
  scrim.addEventListener('click', () => {
    sidebar.classList.remove('open');
    scrim.hidden = true;
  });

  document.getElementById('shell-logout').addEventListener('click', async (e) => {
    e.preventDefault();
    await signOut();
  });
}

export function toast(message, type = 'success', duration = 3500) {
  const host = document.getElementById('toast-host');
  if (!host) return;
  const colors = {
    success: { bg: '#ECFDF5', border: '#A7F3D0', text: '#065F46' },
    error:   { bg: '#FEF2F2', border: '#FECACA', text: '#991B1B' },
    info:    { bg: '#EFF6FF', border: '#BFDBFE', text: '#1E40AF' },
  };
  const c = colors[type] || colors.info;
  const el = document.createElement('div');
  el.style.cssText = `
    background:${c.bg}; border:1px solid ${c.border}; color:${c.text};
    padding:12px 18px; border-radius:12px; font-size:13.5px; font-weight:600;
    box-shadow:0 4px 16px rgba(0,0,0,0.1); animation:toastIn 0.3s ease;
    max-width:360px; line-height:1.4;
  `;
  el.textContent = message;
  host.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.3s'; setTimeout(() => el.remove(), 300); }, duration);
}
