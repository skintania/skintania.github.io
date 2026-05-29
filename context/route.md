# Route Map — File Call Graph

> **Maintenance:** Update this file after any major change (new script on a page, new import, new API call, new page added). Keep under 300 lines.

## Import Chains (who imports what)

```
config.js
  └── exported CONFIG.API_URL → used by almost every JS file

shared/api.js
  imports: CONFIG from /config.js
  exports: apiFetch(), token(), API_URL
  used by: loadCourse.js, loadEvent.js, loadDrive.js, profile.js,
           admin.js, settings.js, changepassword.js, calculate.js

shared/utils.js
  exports: gradientFor(), timeAgo(), formatSize(), fileIcon(), GRADIENTS
  used by: loadCourse.js, loadEvent.js, loadDrive.js

shared/latex.js
  used by: Course/exercise/ JS files

shared/file-preview.js
  used by: CourseMaterial/loadDrive.js

Template/component.js
  imports: ./site-header.js, ./comment-widget.js
  side-effect: registers <site-header> and <comment-widget> custom elements
  loaded by: every page that has a header (via <script type="module" src="/Template/component.js">)

Template/site-header.js
  fetches: /Template/header.html (innerHTML injection)
  calls: GET /auth/me, GET /users/:id/avatar
  events: menu toggle, profile dropdown, logout

Template/comment-widget.js
  fetches: /Template/commentBtn.html
  reads: /Assest/emb.json (Discord embed template)
  calls: POST to Discord webhook URL
```

## Page → Scripts Loaded

### `/index.html` (landing)
```
global.css, Template/style.css, style.css
/Template/component.js  → site-header.js, comment-widget.js
/auth-guard.js
```

### `Course/index.html`
```
global.css, Template/style.css, Course/style.css
/auth-guard.js
/Template/component.js
/Course/loadCourse.js  → imports apiFetch, gradientFor, timeAgo
  API: GET /courses, GET /auth/me, POST /courses
```

### `Course/view/index.html`
```
/auth-guard.js
/Template/component.js
/Course/view/loadView.js   → imports apiFetch, state.js
/Course/view/player.js     → controls <video> element
/Course/view/clips.js      → API: GET /courses/:id/clips
/Course/view/slides.js     → fetches SKDrive slides
/Course/view/comments.js   → API: GET/POST course comments
/Course/view/state.js      → shared state (currentClip, courseId, etc.)
```

### `Course/exercise/index.html`
```
/auth-guard.js
/Template/component.js
/Course/exercise/loadExercise.js → imports apiFetch, latex.js
  API: GET /courses/:id/problem-sets/:psId
       POST /courses/:id/exercises/:exId/submit
```

### `Course/exercise/manage/index.html`
```
/auth-guard.js
/Template/component.js
/Course/exercise/manage/loadManage.js → admin exercise CRUD
  API: admin exercise endpoints
```

### `Activity/index.html`
```
global.css, Template/style.css, Activity/style.css
/Template/component.js
Activity/roadmap.js (classic script, NOT module)
  reads: Activity/roadmap.json (local file, no API)
```

### `Event/index.html`
```
/auth-guard.js
/Template/component.js
/Event/loadEvent.js   → imports apiFetch, gradientFor, timeAgo
  API: GET /events, GET /events/:id
       POST /events/:id/vote, POST /events/:id/join
       GET /users/:id, GET /users/:id/avatar
/Event/post-create.js → imports apiFetch
  API: POST /events (admin only)
/Event/post-config.js → configuration for the post creation form
```

### `Calculator/index.html`
```
/auth-guard.js
/Template/component.js
external: Chart.js CDN
Calculator/calculate.js → imports CONFIG, historyCache.js
  API: POST /calculator, GET /calculator/grades
Calculator/graph.js     → imports Chart.js, reads DOM result
Calculator/historyCache.js → caches grade history locally
Calculator/dropdown.js  → classic script, custom dropdown UI
```

### `CourseMaterial/index.html`
```
/auth-guard.js
/Template/component.js
external: pdf.js CDN, Font Awesome CDN
/CourseMaterial/loadDrive.js → imports apiFetch, utils, file-preview
  API: GET /skdrive?prefix=<path>
       POST /skdrive/download
       DELETE /skdrive/* (admin)
       GET /skdrive/* (file stream)
```

### `Advice/index.html`
```
/Template/component.js (no auth-guard — public page)
Advice/render.js (classic script)
  reads: Advice/tips.json (local file, no API)
```

### `login/index.html`
```
global.css, login/style.css  (NO Template/style.css, NO components)
login/login.js (module)
  API: POST /auth/login
  stores: authToken, userId, username, role → localStorage
  redirects: / on success, /register/verify-email.html on 403
```

### `login/forgot-password.html`
```
login/login.js (or separate module)
  API: POST /auth/forgot-password
```

### `login/reset-password.html`
```
  API: POST /auth/reset-password (with token from URL params)
```

### `register/index.html`
```
global.css, register/style.css  (NO components)
register/checkpassword.js (module)
  API: POST /auth/register
  tabs: OSK form / Member form
```

### `register/verify-email.html`
```
  API: POST /auth/verify-email (OTP code)
```

### `profile/index.html`
```
/auth-guard.js
/Template/component.js
profile/profile.js (module) → imports apiFetch
  API: POST /users/search?q=&limit=12
       GET /users/:id
       GET /users/:id/avatar
       PATCH /users/:id (admin: ban, role change)
```

### `settings/index.html`
```
/auth-guard.js
/Template/component.js
settings/settings.js (module) → imports apiFetch
  API: GET /auth/me, GET /users/me, PATCH /users/me, POST /users/me/avatar
settings/changepassword.js (module) → imports apiFetch
  API: POST /auth/change-password
```

### `admin/index.html`
```
/auth-guard.js (redirects non-admins)
/Template/component.js
admin/admin.js (module) → imports apiFetch
  API: GET /admin/stats, GET /admin/config, PATCH /admin/config
       GET /admin/audit, GET /admin/logs
       GET /admin/workers/stats
```

## API Endpoint → JS File Map

| Endpoint | Called In |
|----------|-----------|
| `GET /auth/me` | auth-guard.js, site-header.js, settings.js |
| `GET /users/me` | settings.js |
| `GET /users/:id` | profile.js, loadEvent.js |
| `GET /users/:id/avatar` | site-header.js, profile.js, loadEvent.js |
| `GET /courses` | loadCourse.js |
| `POST /courses` | loadCourse.js (admin) |
| `GET /courses/:id/clips` | Course/view/clips.js |
| `GET /courses/:id/problem-sets/:psId` | loadExercise.js |
| `POST .../exercises/:exId/submit` | loadExercise.js |
| `GET /events` | loadEvent.js |
| `POST /events/:id/vote` | loadEvent.js |
| `POST /events/:id/join` | loadEvent.js |
| `POST /events` | post-create.js |
| `POST /calculator` | calculate.js |
| `GET /calculator/grades` | calculate.js, historyCache.js |
| `GET /skdrive?prefix=` | loadDrive.js |
| `POST /skdrive/download` | loadDrive.js |
| `GET /skdrive/*` | loadDrive.js |
| `GET /admin/stats` | admin.js |
| `PATCH /admin/config` | admin.js |
| `GET /admin/audit` | admin.js |
| `GET /admin/logs` | admin.js |

## Data Flow Summaries

**Course Load:**
`index.html` → auth-guard ✓ → component.js registers elements → `loadCourse.js` runs → `apiFetch('/courses')` → render cards → search/tag filter on user input

**Exercise Submit:**
`loadExercise.js` renders questions via `latex.js` → user picks answer → `apiFetch('/courses/:id/exercises/:exId/submit', 'POST', {answer})` → server returns correct answer + solution → reveal UI

**Video Playback:**
`clips.js` → `apiFetch('/courses/:id/clips')` → token in response → `player.js` sets `<video src="...?token=<jwt>">` (token in query string, required for R2 auth)

**File Browser:**
`loadDrive.js` → `apiFetch('/skdrive?prefix=<folder>')` → render grid/list → click file → preview modal → `apiFetch('/skdrive/download')` for ZIP

**Calculator:**
DOM inputs → `calculate.js.getGradesFromDOM()` → `apiFetch('/calculator', 'POST', grades)` → `normalCDF()` → render circle + table → `graph.js` updates Chart.js canvas
