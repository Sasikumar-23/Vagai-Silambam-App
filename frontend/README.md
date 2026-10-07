# Vagai Silambam — web app (`frontend/`)

HTML5 + CSS3 + vanilla JavaScript (ES modules). No build step, no framework.

- `website/` — the existing GitHub Pages site for Google OAuth verification. Leave it alone.
- `marketing/` — the public site (home, pricing).
- `frontend/` — **this folder**: the signed-in SaaS application.

## Run it locally

Two terminals, from the repository root.

**1. API**
```
cd backend
set DATABASE_URL=sqlite:///./dev.db
set JWT_SECRET=dev-secret-only-for-local-development-32
python scripts/dev_bootstrap.py
python -m uvicorn app.main:app --port 8000 --reload
```

**2. Web app**
```
cd frontend
python -m http.server 5500
```

Open <http://localhost:5500/register.html> and create an academy. API docs are at
<http://localhost:8000/docs>.

Open the pages through the HTTP server, not by double-clicking the files: ES modules
do not load from `file://`.

## Pointing at a different API

`assets/js/api.js` reads `window.VAGAI_API_BASE`, defaulting to `http://localhost:8000`.
In production, set it before the module loads:

```html
<script>window.VAGAI_API_BASE = 'https://api.vagaisilambam.com';</script>
```

## Layout

| Path | Purpose |
|---|---|
| `index.html` | sends you to the dashboard or login |
| `login.html`, `register.html` | authentication; registration starts the 14-day trial |
| `dashboard.html` | usage against plan limits, recent students |
| `students.html` | list, search, add, deactivate |
| `subscription.html` | plan, usage, licence key, plan comparison |
| `assets/js/api.js` | the only place that calls `fetch`; handles tokens, refresh and error envelopes |
| `assets/js/auth.js` | session guards plus the shared shell (sidebar, topbar, toasts) |
| `assets/js/i18n.js`, `translations.js` | one dictionary; markup uses `data-i18n` only |
| `assets/css/style.css` | design tokens shared with the mobile app |
| `assets/css/responsive.css` | drawer sidebar and card-style tables on mobile |

## Still to build

`attendance.html`, `events.html`, `fees.html`, `uniforms.html`, `reports.html`,
`settings.html`, and the `admin/` super-admin pages. The sidebar already links to them.
