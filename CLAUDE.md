# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Skintania** is a static frontend for OSK CU Intania — a student platform for engineering prep courses, activities, and tools. It is deployed to GitHub Pages via Jekyll (no build step, no bundler, no package.json). All logic is plain HTML/CSS/ES module JavaScript talking to a Cloudflare Worker API.

## Deployment

Push to `main` → GitHub Actions runs Jekyll Docker build → deploys to GitHub Pages.  
There is no local build command. Test locally by opening HTML files directly in a browser or via a simple static server (e.g. `npx serve .` or `python3 -m http.server`).

## Architecture

### No build step — pure ES modules

Every JS file uses `type="module"` and bare `/`-rooted imports. There is no bundler. Imports must use absolute paths from the site root (e.g. `import { CONFIG } from '/config.js'`).

### API

Backend: `https://skintania-api.skintania143.workers.dev/`  
Always import the base URL from `/config.js`:

```js
import { CONFIG } from '/config.js';
// then: fetch(`${CONFIG.API_URL}/some/path`, ...)
```

All authenticated requests send `Authorization: Bearer <token>` where the token comes from `localStorage.getItem('authToken')`.

### Auth guard

Every protected page includes this in `<head>`:

```html
<style>body{display:none}</style>
<script type="module" src="/auth-guard.js"></script>
```

`auth-guard.js` checks `GET /auth/me`, removes the token and redirects to `/login/` on 401/403, and sets `document.body.style.display = "block"` on success. On network error it allows through to avoid locking users out.

### User roles

`member`, `OSK`, `admin`. Admin-only write operations are enforced server-side. The header component injects an "Admin Panel" link for `admin` and `OSK` roles.

### Custom Web Components (`Template/component.js`)

Two custom elements are defined here:

- **`<site-header page-title="..." page-desc="...">`** — fetches `Template/header.html`, injects it, handles menu toggle, profile dropdown, logout, avatar fetch, and admin link injection.
- **`<comment-widget>`** — fetches `Template/commentBtn.html`, handles a feedback popup that sends to a Discord webhook.

Every page that needs the header/comment widget loads:
```html
<script type="module" src="/Template/component.js" defer></script>
```

### CSS structure

- `global.css` — CSS variables (`--bg`, `--card`, `--accent`, `--muted`, `--text`), body, `.wrap`, `.card` base styles. Loaded on every page.
- `Template/style.css` — styles for the `<site-header>` component. Loaded on every page.
- Per-page `style.css` — page-specific styles, loaded only on that page.

Dark-theme palette: background `#0f1724`, card `#0b1220`, accent `#3b82f6`.

### Page structure

Each feature is a folder with `index.html` + `style.css` + a JS module:

| Folder | Purpose |
|--------|---------|
| `Course/` | Course listing; `view/` for video player; `exercise/` for problem sets |
| `CourseMaterial/` | SKDrive file browser |
| `Activity/` | Roadmap / activity feed |
| `Event/` | Announcements, polls, activities |
| `Calculator/` | GPA / admission-chance calculator |
| `Advice/` | Tips rendered from `tips.json` |
| `login/` | Login, forgot-password, reset-password |
| `register/` | Member and OSK registration + email verify |
| `profile/` | User profile view/edit |
| `settings/` | Password change, account settings |
| `admin/` | Admin panel (users, events, config, logs) |
| `AboutUs/` | Static about page |
| `Template/` | Shared web components and their HTML partials |
| `Assest/` | Static assets (logo, Discord embed JSON) |

### Course types

Courses have `type: "video"` or `type: "exercise"`:

- **Video** — clips streamed from R2 via `GET /courses/:id/clips/*?token=<jwt>` (token in query string for `<video src>`). Optionally uses YouTube playlists (`youtube_url` field, comma-separated playlist IDs). Optionally has lecture slides from SKDrive (`slides_folder` field).
- **Exercise** — problem sets containing exercises. Exercises support `multiple_choice`, `fill_blank`, `free_response`. Question/choices/solution all support LaTeX (rendered via MathJax or KaTeX on the page). Correct `answer` is never returned by GET — only revealed after `POST .../submit`.

### LaTeX in exercises

Exercise `question`, `choices[]`, and `solution` fields use LaTeX syntax (e.g. `$F = ma$`). The frontend is responsible for rendering these.

## API Quick Reference

Base: `https://skintania-api.skintania143.workers.dev/`  
All responses: `{ "success": true|false, ... }`. Auth header: `Authorization: Bearer <token>`.

Key endpoints used by this frontend:
- `POST /auth/login` → returns `token`
- `GET /auth/me` → current user (used by auth-guard and header)
- `GET /users/me` → full profile including `student_id`, `osk_gen`, `osk_id`
- `GET /users/:id/avatar` → raw image stream (resolve `profile_url` this way)
- `GET /courses` / `GET /courses/:id` / `GET /courses/:id/clips`
- `GET /courses/:id/problem-sets/:psId` → problem set with exercises (no answers)
- `POST /courses/:id/exercises/:exId/submit` → reveals answer/solution
- `GET /events`, `POST /events/:id/vote`, `POST /events/:id/join`
- `POST /calculator`, `GET /calculator/grades`
- `GET /skdrive?prefix=`, `POST /skdrive/download` (ZIP), `GET /skdrive/*`
- `GET /admin/stats`, `GET /admin/users`, `PATCH /admin/config` (admin only)

Pagination uses cursor-based `?cursor=<last-id>` (events, users, clips) or offset-based `?offset=` (user search). `nextCursor: null` means no more pages.

Full API documentation is in [API.md](API.md).
