# File Docs — What Each File Does

> **Maintenance:** Update this file when files are added, removed, or significantly changed. Keep under 300 lines.

## Root

| File | What it does |
|------|-------------|
| `config.js` | Exports `CONFIG = { API_URL }`. Single source of truth for the backend URL. Import this before any fetch call. |
| `auth-guard.js` | Module that runs immediately on import. Calls `GET /auth/me`, shows loading spinner, redirects to `/login/` on 401/403/banned. Sets `body.style.display = 'block'` on success. Network errors let user through. |
| `global.css` | Dark theme CSS variables (`--bg`, `--card`, `--accent`, `--text`, `--muted`), body reset, `.wrap`, `.card`, button styles, skeleton shimmer animation, fullscreen loader. Loaded on every page. |
| `style.css` (root) | Landing page layout styles. |
| `index.html` (root) | Landing / home page. Includes auth-guard, site-header, comment-widget. |
| `CLAUDE.md` | Original Claude Code instructions (architecture, patterns, API reference). |
| `API.md` | Full backend API documentation. |

## shared/

| File | What it does |
|------|-------------|
| `shared/api.js` | Exports `apiFetch(path, method='GET', body=null)` — wraps `fetch` with `Authorization: Bearer <token>` header. Also exports `token()` and `API_URL`. Use this for all authenticated API calls. |
| `shared/utils.js` | Exports `GRADIENTS` array, `gradientFor(n)` (deterministic card color), `timeAgo(isoString)` (Thai relative time), `formatSize(bytes)`, `fileIcon(mimeType)` (emoji for file type). |
| `shared/latex.js` | Renders LaTeX markup in exercise questions/choices/solutions. Called by exercise pages. |
| `shared/file-preview.js` | Opens a preview modal for files (PDF inline via pdf.js, image display, download fallback). Used by `loadDrive.js`. |

## Template/

| File | What it does |
|------|-------------|
| `Template/component.js` | Imports `site-header.js` and `comment-widget.js`. Its only job is registering the two custom elements. Every page loads this as a module. |
| `Template/site-header.js` | Defines `<site-header page-title page-desc>` custom element. Fetches `header.html`, injects it into shadow/light DOM, handles menu toggle, profile dropdown open/close, avatar load (`GET /users/:id/avatar`), admin link injection, and logout (clears localStorage → redirect `/login/`). |
| `Template/comment-widget.js` | Defines `<comment-widget>` element. Fetches `commentBtn.html`, shows floating 💬 button, opens feedback popup, POSTs to Discord webhook using embed from `/Assest/emb.json`. |
| `Template/header.html` | HTML partial for the navigation bar. Injected by `site-header.js`. Contains logo, nav links, profile dropdown markup. |
| `Template/commentBtn.html` | HTML partial for the floating feedback button and popup form. Injected by `comment-widget.js`. |
| `Template/style.css` | Styles for `<site-header>`: navbar, logo, nav links, hamburger menu, profile dropdown, responsive breakpoints. Loaded on every page with a header. |
| `Template/cmt.js` | Comment script (legacy or supplemental comment functionality). |

## Course/

| File | What it does |
|------|-------------|
| `Course/index.html` | Course listing page. Grid of course cards with search input and tag filters. |
| `Course/loadCourse.js` | Fetches `GET /courses`, renders course cards (with gradient avatars), builds tag filter buttons, handles search filtering. Admin: shows "Create Course" button → modal → `POST /courses`. |
| `Course/style.css` | Course grid layout, card styles, search bar, tag pill styles. |
| `Course/Course.json` | Local course data (may be used as fallback or seed). |

### Course/view/

| File | What it does |
|------|-------------|
| `view/index.html` | Single course page: video player, clips list, notes panel, comments. |
| `view/loadView.js` | Entry point — fetches course metadata, initializes the view page, wires up all sub-modules. |
| `view/player.js` | Controls the `<video>` element: play/pause, seek, fullscreen, quality switching. Sets `src` to clip URL with JWT token in query string. |
| `view/clips.js` | Fetches `GET /courses/:id/clips` (paginated), renders clip list in sidebar, handles clip selection. |
| `view/slides.js` | Fetches lecture slides from SKDrive (if `slides_folder` set on course), renders slide navigation. |
| `view/comments.js` | Fetches and posts comments for the current course/clip. |
| `view/state.js` | Shared module state: current course ID, current clip, user info. Imported by other view modules. |
| `view/style.css` | Two-column layout: video player left, clips/notes sidebar right. |

### Course/exercise/

| File | What it does |
|------|-------------|
| `exercise/index.html` | Exercise/problem-set page. Shows questions one by one or all at once. |
| `exercise/loadExercise.js` | Fetches `GET /courses/:id/problem-sets/:psId`. Renders questions (uses `latex.js` for LaTeX). On answer submit: `POST .../exercises/:exId/submit` → reveals correct answer + solution. |
| `exercise/style.css` | Exercise layout, question cards, choice buttons, answer reveal styles. |
| `exercise/manage/index.html` | Admin interface for creating/editing exercises. |
| `exercise/manage/loadManage.js` | Admin CRUD for problem sets and exercises. |

## Activity/

| File | What it does |
|------|-------------|
| `Activity/index.html` | Roadmap timeline page. |
| `Activity/roadmap.js` | Classic (non-module) script. Loads `roadmap.json`, renders vertical timeline cards. Each card is expandable with tabs: info / duration / roles / tips. Compares dates to mark items as past/current/upcoming. |
| `Activity/roadmap.json` | Local JSON data for the OSK activity timeline. Not fetched from API. |
| `Activity/style.css` | Timeline layout, connector lines, card expand animation, tab styles. |

## Event/

| File | What it does |
|------|-------------|
| `Event/index.html` | Events page. Shows Announcements, Polls, Activities in a feed. |
| `Event/loadEvent.js` | Fetches `GET /events` then each `GET /events/:id`. Renders three types: `renderAnnouncement()`, `renderPoll()`, `renderActivity()`. Poll voting calls `POST /events/:id/vote`, activity join calls `POST /events/:id/join`. Fetches creator avatar. |
| `Event/post-create.js` | Admin event creation: shows modal form, switches form fields based on type (Announcement/Poll/Activity). Submits `POST /events`. |
| `Event/post-config.js` | Configuration data for the event creation form (field definitions, type options). |
| `Event/style.css` | Event feed layout, card types (announcement/poll/activity), vote bar, creator badge. |

## Calculator/

| File | What it does |
|------|-------------|
| `Calculator/index.html` | GPA + admission chance calculator. Grade dropdowns for 11 subjects, department selector, result display, trend chart. |
| `Calculator/calculate.js` | Core logic. Reads grade selections from DOM, calls `POST /calculator`, applies normal distribution (`erf()`, `normalCDF()`, `chanceFromNormal()`) for admission probability. Renders result circle, GPAX, department comparison table. |
| `Calculator/graph.js` | Chart.js integration. Draws the score trend line chart using history data. Updates when user recalculates. |
| `Calculator/historyCache.js` | Caches admission score history locally (`GET /calculator/grades`). Provides `getHistory()` used by `calculate.js`. |
| `Calculator/dropdown.js` | Classic script. Custom-styled dropdown widget (replaces native `<select>`). Handles open/close, keyboard navigation, value selection. |
| `Calculator/dropdown.css` | Styles for the custom dropdown. |
| `Calculator/style.css` | Calculator page layout, grade card grid, result circle, table styles. |

## CourseMaterial/

| File | What it does |
|------|-------------|
| `CourseMaterial/index.html` | SKDrive file browser. Breadcrumb nav, grid/list toggle, select/download/delete toolbar. |
| `CourseMaterial/loadDrive.js` | Full file browser logic. Fetches `GET /skdrive?prefix=<path>` to list contents. Grid and list render modes. Breadcrumb navigation. File selection state. Opens `file-preview.js` modal on click. Bulk ZIP download via `POST /skdrive/download`. Admin file deletion. |
| `CourseMaterial/icons.json` | Maps folder/subject names to emoji icons for display. |
| `CourseMaterial/style.css` | File browser grid/list layouts, breadcrumb bar, toolbar, file card styles. |

## Advice/

| File | What it does |
|------|-------------|
| `Advice/index.html` | Advice/tips page. Grid of tip cards. |
| `Advice/render.js` | Classic script. Loads `tips.json`, renders advice cards grouped by subject/category. |
| `Advice/tips.json` | Local data: tips and recommendations for each subject. |
| `Advice/style.css` | Tip card grid layout, category badge styles. |

## login/

| File | What it does |
|------|-------------|
| `login/index.html` | Login form. No auth-guard, no site-header. |
| `login/login.js` | Posts `{ identifier, password }` to `POST /auth/login`. Stores `authToken`, `userId`, `username`, `role` in `localStorage`. Redirects to `/` on success, to `/register/verify-email.html` on 403 (unverified). |
| `login/forgot-password.html` | Form to request password reset email. |
| `login/reset-password.html` | Form to submit new password using token from URL params. |
| `login/style.css` | Login page layout: centered card, form inputs. |

## register/

| File | What it does |
|------|-------------|
| `register/index.html` | Registration page. Two tabs: OSK / Member. Different fields per tab. |
| `register/checkpassword.js` | Handles tab switching (OSK/Member), password strength validation, confirmation match, form submit to `POST /auth/register`. |
| `register/verify-email.html` | OTP input page. User enters code from email. Calls `POST /auth/verify-email`. |
| `register/style.css` | Registration form layout, tab styles. |

## profile/

| File | What it does |
|------|-------------|
| `profile/index.html` | Two states: search view and profile detail view. |
| `profile/profile.js` | Search: debounced `POST /users/search`. Profile: `GET /users/:id` + avatar + badge render. Admin section: ban toggle, role dropdown via `PATCH /users/:id`. |
| `profile/style.css` | Search bar, results grid, profile card, info grid, admin zone. |

## settings/

| File | What it does |
|------|-------------|
| `settings/index.html` | Four sections: Profile, Security, Notifications, Delete Account. Sidebar navigation. |
| `settings/settings.js` | Loads user data from `GET /auth/me` + `GET /users/me`. Edit mode toggle (read-only → inputs). Avatar upload with FileReader preview. Saves via `PATCH /users/me`. |
| `settings/changepassword.js` | Change password form. Validates old/new/confirm, posts `POST /auth/change-password`. |

## admin/

| File | What it does |
|------|-------------|
| `admin/index.html` | Admin dashboard. Sidebar: Overview, Server Config, Audit Log, Server Log. |
| `admin/admin.js` | `checkAdminAccess()` verifies admin role on load. Loads stats (`GET /admin/stats`), worker metrics, editable config cards (`GET/PATCH /admin/config`), audit log table with pagination (`GET /admin/audit`), server log viewer with level filter (`GET /admin/logs`). |
| `admin/style.css` | Admin two-column layout (sidebar + content), stats grid, config card toggles, log table, audit detail modal. |

## AboutUs/

| File | What it does |
|------|-------------|
| `AboutUs/index.html` | Static about page. Team info, project description. |
| `AboutUs/style.css` | About page layout. |

## Assest/

| File | What it does |
|------|-------------|
| `Assest/sk-cu.png` | Site logo (SKintania / CU Intania logo). |
| `Assest/emb.json` | Discord embed JSON template used by `comment-widget.js` to format feedback messages. |

## GitHub / Config

| File | What it does |
|------|-------------|
| `.github/workflows/jekyll-docker.yml` | CI: on push to `main`, runs Jekyll Docker build and deploys to GitHub Pages. |
| `.vscode/settings.json` | Editor settings for this project. |
