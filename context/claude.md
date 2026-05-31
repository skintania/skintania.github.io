# Skintania — Claude Context

> **Maintenance:** Update this file after any major change (new page, new API endpoint, changed auth flow, new component). Keep under 300 lines.

## What is this project?

**Skintania** is a student platform for **OSK CU Intania** — engineering prep courses, activities, and campus tools. Deployed as a static site on GitHub Pages.

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Plain HTML + CSS + ES Modules (no bundler, no npm, no build step) |
| Backend | Cloudflare Worker at `https://skintania-api.skintania143.workers.dev/` |
| Deployment | Push `main` → GitHub Actions → Jekyll Docker build → GitHub Pages |
| Storage | Cloudflare R2 (files, avatars, videos) |
| Auth | JWT token stored in `localStorage` as `authToken` |

## Deployment

Push to `main` is all it takes. Test locally: `npx serve .` or `python3 -m http.server`. Do NOT run `npm install`, `npm build`, etc. — there is none.

## Architecture Overview

### No bundler — pure ES modules
All JS uses `type="module"`. Imports must be absolute from site root:
```js
import { CONFIG } from '/config.js';        // always use this for API_URL
import { apiFetch } from '/shared/api.js';  // authenticated fetch wrapper
```

### Auth Guard
Every protected page starts its `<head>` with:
```html
<style>body{display:none}</style>
<script type="module" src="/auth-guard.js"></script>
```
`auth-guard.js` calls `GET /auth/me`, redirects to `/login/` on 401/403/banned, and unhides body on success. Network errors let the user through (fail open).

### User Roles
Three roles: `member`, `OSK`, `admin`. Enforced server-side. The site-header injects an Admin Panel link for `admin` only.

### Custom Web Components
Defined in `Template/component.js` (which imports site-header.js and comment-widget.js):

- `<site-header page-title="..." page-desc="...">` — header, nav, profile dropdown, avatar, logout, admin link
- `<comment-widget>` — floating 💬 button that posts Discord webhook feedback

Every page that needs them loads:
```html
<script type="module" src="/Template/component.js" defer></script>
```

### Shared Utilities
- `config.js` — exports `CONFIG.API_URL`
- `shared/api.js` — exports `apiFetch(path, method, body)` (adds Bearer token automatically)
- `shared/utils.js` — exports `gradientFor(n)`, `timeAgo(iso)`, `formatSize(bytes)`, `fileIcon(type)`
- `shared/latex.js` — LaTeX rendering helper (used in exercises)
- `shared/file-preview.js` — file preview modal logic

## Pages Summary

| Folder | Purpose |
|--------|---------|
| `/` | Landing page (index.html) |
| `Course/` | Course grid; `view/` = video player; `exercise/` = problem sets |
| `CourseMaterial/` | File browser for Cloudflare R2 (SKDrive) |
| `Activity/` | Timeline/roadmap rendered from local `roadmap.json` |
| `Event/` | Announcements, polls (vote), activities (join) |
| `Calculator/` | GPA + admission-chance calculator with Chart.js |
| `Advice/` | Tips rendered from local `tips.json` |
| `login/` | Login, forgot-password, reset-password |
| `register/` | Member and OSK registration + email verify |
| `profile/` | User search + profile view + admin ban/role controls |
| `settings/` | Edit profile, change password, delete account |
| `admin/` | Admin dashboard: stats, config, audit log, server logs |
| `AboutUs/` | Static about page |
| `Template/` | Shared header/comment web components + HTML partials |
| `Assest/` | Logo, Discord embed JSON |

## CSS Structure

| File | Scope |
|------|-------|
| `global.css` | Dark theme variables, body, `.wrap`, `.card`, skeletons, loader. Every page. |
| `Template/style.css` | Header, navbar, dropdown. Every page. |
| `<Folder>/style.css` | Page-specific layout. |

Dark palette: `--bg: #0f1724` · `--card: #0b1220` · `--accent: #3b82f6` · `--text: #e6eef8`

## API Patterns

**Base URL:** `https://skintania-api.skintania143.workers.dev/`

Always import it:
```js
import { CONFIG } from '/config.js';
fetch(`${CONFIG.API_URL}/some/path`, { headers: { Authorization: `Bearer ${localStorage.getItem('authToken')}` }});
// or easier:
import { apiFetch } from '/shared/api.js';
const data = await apiFetch('/some/path', 'POST', { key: 'value' });
```

All responses: `{ "success": true|false, ...data }` or `{ "success": false, "error": "message" }`

Pagination: cursor-based `?cursor=<last-id>` for events/users/clips. `nextCursor: null` = end.

## Key API Endpoints

```
POST /auth/login          → { token }
GET  /auth/me             → current user (roles, banned, id)
GET  /users/me            → full profile (student_id, osk_gen, osk_id)
GET  /users/:id/avatar    → raw image stream
GET  /courses             → course list
GET  /courses/:id         → course detail
GET  /courses/:id/clips   → video clips (paginated)
GET  /courses/:id/problem-sets/:psId  → exercises (no answers)
POST /courses/:id/exercises/:exId/submit → reveals answer + solution
GET  /events              → event list (paginated)
POST /events/:id/vote     → vote on poll
POST /events/:id/join     → join activity
POST /calculator          → calculate admission chance
GET  /calculator/grades   → grade history
GET  /skdrive?prefix=     → list files/folders in R2
POST /skdrive/download    → bulk ZIP download
GET  /skdrive/*           → raw file stream
GET  /admin/stats         → platform statistics (admin)
PATCH /admin/config       → update server config (admin)
GET  /admin/audit         → audit log (admin)
GET  /admin/logs          → server logs (admin)
```

## LaTeX in Exercises

Exercise `question`, `choices[]`, and `solution` fields use LaTeX syntax (`$F = ma$`). The frontend renders them — see `shared/latex.js`.

## Course Types

- `type: "video"` — video player + optional YouTube playlist (`youtube_url`) + optional slides (`slides_folder` from SKDrive)
- `type: "exercise"` — problem sets with exercises (`multiple_choice`, `fill_blank`, `free_response`)

## Language

UI text is in **Thai (th)**. Technical labels (API field names, roles, types) are in English.
