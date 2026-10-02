# CLAUDE.md – "The Daily Web" Project Guide & Guidelines

## 1. Project Overview & Context
- **Project Name:** The Daily Web (Final Capstone Project – Web Application Development)
- **Architecture:** Monolithic MVC architecture built with Node.js, Express, MongoDB (Mongoose), and EJS + Vanilla JavaScript (AJAX).
- **Goal:** Production-grade news publishing and management platform supporting Guest readers, Reporters, and Editors with strict role-based access control, auto-saving drafts, workflow review states, performance caching, and impact analytics.
- **Development Process & Pace:** This project must be implemented strictly one part after the other, one feature after the other, and not all at once. Implement only what is explicitly requested. Do not implement features, components, or files you are not ordered to implement.

---

## 2. Mandatory Rules & Tech Stack Constraints
- **Strictly Allowed Technologies:**
  - **Backend:** Node.js, Express.js, MongoDB via Mongoose.
  - **Server-side Templating:** EJS.
  - **Frontend:** Semantic HTML5, CSS3 (Modern Flexbox, Responsive), Plain/Vanilla JavaScript (DOM manipulation, Fetch API/AJAX).
  - **Data Visualization:** Chart.js or HTML5 Canvas (explicitly allowed for analytics).
  - **External API:** OpenWeatherMap API (or similar free-tier weather service, strictly no credit card required).
- **Strictly Forbidden:**
  - **NO** modern frontend SPA frameworks: **No React, Angular, Vue, Svelte, etc.**
  - **NO** unauthorized complex third-party abstractions that bypass core learning goals.
  - **NO** hardcoded credentials, secret keys, or `.env` pushed to Git.

---

## 3. Project Directory Structure
```
the-daily-web/
├── data/
│   └── seed.js                 # Database seeder (500+ articles, users, logs, stats)
├── public/
│   ├── css/
│   │   ├── main.css            # Global layout, variables, responsive styling
│   │   ├── feed.css            # Feed, article card styles
│   │   ├── article.css         # SEO content and comments section
│   │   └── dashboard.css       # Reporter & Editor dashboards, charts
│   ├── front/
│   │   ├── feed.js             # Infinite scroll, dynamic filter, search, sort
│   │   ├── article.js          # AJAX comment submission, view trackers
│   │   ├── editor.js           # Auto-save, revision comparison (diff view)
│   │   ├── analytics.js        # Chart.js time-series & update milestone markers
│   │   └── weather.js          # Weather widget client logic
│   └── images/
├── back/
│   ├── config/
│   │   ├── db.js               # Mongoose connection
│   │   └── session.js          # Persistent session store (connect-mongo)
│   ├── controllers/
│   │   ├── authController.js
│   │   ├── userController.js
│   │   ├── articleController.js
│   │   ├── commentController.js
│   │   ├── viewController.js
│   │   ├── editorController.js
│   │   ├── analyticsController.js
│   │   └── weatherController.js
│   ├── middleware/
│   │   ├── auth.js             # Authentication check
│   │   ├── rbac.js             # Role-Based Access Control (Guest, Reporter, Editor)
│   │   ├── rateLimiter.js      # Comment rate limiter (per session/visitor cookie + per IP)
│   │   └── errorHandler.js     # Global error & logging middleware
│   ├── models/
│   │   ├── User.js
│   │   ├── Article.js
│   │   ├── ArticleDraft.js     # Working copy, one per article (see 7.5)
│   │   ├── ArticleRevision.js  # One immutable document per approval (see 7.5)
│   │   ├── Category.js         # Editor-managed categories (see 7.10)
│   │   ├── Comment.js
│   │   └── ArticleViewLog.js   # High-throughput aggregated analytics model
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── userRoutes.js
│   │   ├── articleRoutes.js
│   │   ├── commentRoutes.js
│   │   ├── viewRoutes.js
│   │   ├── reporterRoutes.js
│   │   ├── editorRoutes.js
│   │   └── apiRoutes.js
│   ├── services/
│   │   ├── weatherService.js   # Server-side caching (max 15-min stale cache)
│   │   ├── analyticsService.js
│   │   ├── articleService.js   # Article workflow, drafts and approvals
│   │   └── activityLogger.js   # Server activity log (see 7.9)
│   ├── validators/             # Input validation helpers, one file per domain
│   │   └── articleValidators.js
│   └── views/
│       ├── components/
│       │   ├── header.ejs
│       │   ├── footer.ejs
│       │   └── weatherWidget.ejs
│       ├── pages/
│       │   ├── home.ejs        # News Feed
│       │   ├── article.ejs     # Server-rendered for SEO
│       │   ├── login.ejs
│       │   ├── reporter.ejs    # Reporter workspace & auto-save editor
│       │   ├── editor.ejs      # Review approval queue & diff inspector
│       │   └── stats.ejs       # Impact analytics dashboard
│       └── partials/
│           ├── articleCard.ejs
│           └── commentItem.ejs
├── logs/                       # Activity log files (git-ignored)
├── .env.example
├── .gitignore
├── app.js                      # Express app setup
├── server.js                   # Entry point
├── package.json
└── README.md
```

---

## 4. Core Features & Functional Requirements

### A. Public News Feed (`/`)
- **Rendering:** First 20 published articles pre-rendered on the server via EJS.
- **Infinite Scroll:** Fetch next 20 articles asynchronously via AJAX when user scrolls close to bottom.
- **Search, Filter & Sort:** Instant updates without full-page reloads.
  - Search: Case-insensitive regex/text-index over title and summary.
  - Filter: Category, Viewed vs. Unviewed status (tracked per visitor / cookie).
  - Sort: By publication date (newest first) or popularity (view count).
- **Article Card Elements:** Title, primary image, summary, category badge, reporter name, publication timestamp.

### B. SEO-Compliant Article Page (`/articles/:id`)
- **SSR / SEO First:** Full article body, metadata, author, and timestamp must be in the initial server-delivered HTML (no client-side render dependencies for crawlers).
- **Interactive Comments:**
  - Submit comments via AJAX.
  - Append new comments dynamically to the DOM without reloading the full list.
  - **Rate Limiting:** Maximum 3 comments per minute per session/visitor cookie, plus a higher per-IP limit (see 7.8). Blocked server-side with a user-friendly error message (`HTTP 429`).
- **View Metric Logging:** Every unique visit registers a view event.

### C. Authentication & Session Persistence
- **User Roles:** `Guest` (unauthenticated), `Reporter`, `Editor`.
- **Passwords:** Hashed with `bcrypt` (never plaintext, irreversible).
- **Session Persistence:** Sessions stored in MongoDB (`connect-mongo`). **Server restarts must NOT log users out.**
- **Strict Server Validation:** Never rely on hidden client UI elements for security. All endpoints verify session role on the server.

### D. Reporter Workflow & Auto-Save
- **Article Lifecycle States:**
  1. `in_progress`
  2. `pending_approval`
  3. `published`
  4. `returned_for_revision`
- **Continuous Auto-Save:**
  - Changes debounce and sync automatically to the backend (`/api/articles/:id/draft`).
  - Refreshing, closing tabs, or switching computers never loses work.
- **Publishing Safeguard (Live vs. Draft Separation):**
  - When an already-published article is edited, readers continue seeing the published snapshot.
  - The working draft remains isolated until the editor approves the new revision.

### E. Editor Workspace & Impact Analytics
- **Editorial Review:**
  - Filter articles by status (`pending_approval`, `returned_for_revision`, etc.).
  - Side-by-side or highlight comparison of published version vs. submitted changes.
  - Actions: Edit directly, Approve & Publish, Reject with mandatory feedback note, Delete.
- **Impact Analytics:**
  - View counts over time rendered with Chart.js.
  - Highlight milestones: Visible indicators marking exact timestamps when an editor approved/published an update.
  - Clear visualization of before-and-after traffic trends.
  - High concurrency design: Aggregated time buckets (e.g., hourly view counters) to prevent write-bottlenecks.

### F. External Weather Integration (Sidebar Widget)
- Free-tier API (e.g., OpenWeatherMap, WeatherAPI) without credit card requirements.
- **In-Memory / Database Cache:** Server caches responses for up to 15 minutes. High reader traffic must never overload external API quotas.

---

## 5. Seed Data Requirements (`npm run seed`)
Before project defense, the database must contain:
- **At least 500 articles** spanning diverse categories and all 4 workflow states.
- Multiple Reporter accounts and at least one Editor account.
- Realistic comment threads across articles.
- Multiple articles that have undergone 2+ revisions post-publication.
- Sufficient historical view data to produce rich time-series charts with update pins in the Impact Analytics view.

---

## 6. Coding & Implementation Guidelines

- **Assistant Execution Rule:** Strictly follow an incremental, feature-by-feature progression. Never implement unrequested modules or anticipatory code.
- **Architecture:** Keep business logic inside controllers/services, not route handlers.
- **Async Handling:** Use modern `async/await` with comprehensive `try/catch` or an async wrapper.
- **Defensive Engineering:** Handle edge cases (empty search results, DB disconnection, rate-limit triggers) gracefully without crashing.
- **No Unicode Math:** When math notations are needed, strictly use LaTeX format (`$x$` or `$$...$$`).
- **Git Commit Standards:**
  - Small, atomic commits with informative English messages.
  - Feature branches for distinct modules (e.g., `feat/auto-save`, `feat/impact-analytics`).

  ---

## 7. Implementation Decisions (Binding)

These decisions refine the requirements above. When implementing any related feature, follow them exactly.

### 7.1 Article Workflow – Allowed State Transitions
Only the transitions below are allowed. The server must reject any other transition.

| From | To | Who | Notes |
|---|---|---|---|
| (new) | `in_progress` | Reporter only | Article is owned by the reporter who created it. |
| `in_progress` | `pending_approval` | Owning reporter | |
| `pending_approval` | `published` | Editor | The draft content is copied to `published` and a new `ArticleRevision` is created (see 7.5). |
| `pending_approval` | `returned_for_revision` | Editor | A non-empty editor note is required. Without it, the server rejects the request. |
| `returned_for_revision` | `pending_approval` | Owning reporter | The editor note is cleared. There is no notes history. |
| `published` | `in_progress` | Owning reporter | Happens when the reporter starts editing an update. The `published` snapshot stays live. |

- There is **no** transition from `pending_approval` back to `in_progress`, not even by the reporter.
- When an editor returns an update of a published article, the `published` snapshot remains live and unchanged.

### 7.2 Content Editing Permissions
A reporter can never edit an article they do not own, in any state.

| Status | Owning reporter | Editor |
|---|---|---|
| `in_progress` | Can edit | Cannot edit |
| `pending_approval` | Locked | Can edit |
| `returned_for_revision` | Can edit | Cannot edit |
| `published` | Can start editing an update | Cannot edit |

- An editor can edit article content **only while the article is `pending_approval`**.
- Editor edits always go to the draft and never change `status`. An editor changes `status` only by approving or returning the article (7.1).
- Concurrent editing of the same article is not supported (assumed not to occur).

### 7.3 Deletion
- Only an editor can delete an article, in any state.
- Deleting an article also deletes its `ArticleDraft`, all its `ArticleRevision` documents, its comments and its view data.

### 7.4 Server-Side Validation Order
For every status change request, the server checks, in order:
1. The user's role.
2. Article ownership (for reporters).
3. Whether the transition appears in the allowed transitions table (7.1).

If any check fails, return an error with a clear message (403 for permission errors, 400 for invalid transitions or missing note). Never crash.

### 7.5 Article Model Structure
An article is stored in three models.

**`Article`** (`back/models/Article.js`):
- `author`: the owning reporter. Never changes.
- `status`: the workflow state (7.1).
- `published`: the public version. Empty until the first approval.
- `editorNote`: the current editor note only (set on return, cleared on resubmit and on approval).
- `publishedAt`: the time of the **first** publication only.
- Timestamps: `updatedAt` only (no `createdAt`).

**`ArticleDraft`** (`back/models/ArticleDraft.js`):
- The working copy. Exactly one per article (unique `article` reference).
- Auto-save writes only here, with an upsert.
- Readers never see it.

**`ArticleRevision`** (`back/models/ArticleRevision.js`):
- One document per approval, created at the moment of approval (`content`, `approvedAt`, `approvedBy`).
- All fields are immutable.
- Used for the update markers on the Impact Analytics chart.

**Shared content schema:** the content fields (`title`, `summary`, `body`, `imageUrl`, `categoryId`) use one shared schema (`contentSchema`) in `published`, in the draft and in revisions.

**Approval:** one update of the `Article` document (set `published`, set `status`, set `publishedAt` on the first approval only, clear `editorNote`), then create the `ArticleRevision`.

**Public display rule:** The feed and the article page show every article that has a `published` snapshot, **regardless of `status`**, and always render content from `published` (see 7.11).

This structure also supports: the editor's comparison view (`published` vs the draft), articles with multiple post-publication updates, and update markers on the Impact Analytics chart (taken from `ArticleRevision`).

### 7.6 View Counting
- Views are counted as **unique views**: each visitor is counted once per article (identified by a visitor cookie). Page refreshes by the same visitor are ignored.
- Rationale (for the project defense): prevents repeated refreshes from inflating the statistics, so the chart reflects real readers.
- Views are stored in a separate model, not in `Article` (to be implemented in a future task).
- If a popularity counter is kept on `Article`, it is updated in batches, never on every view, and with `{ timestamps: false }` so it does not change `updatedAt`.

### 7.7 CRUD Endpoints
- The server must expose CRUD (Create, Read, Update, Delete) REST endpoints for the **User**, **Article**, **Comment** and **View** (`ArticleViewLog`) models.
- Exact paths, permissions and behavior for each endpoint will be specified when the endpoints are implemented.

### 7.8 Comment Rate Limiting
- Two limits are enforced together; exceeding either one returns 429 with a friendly message:
  1. **Per client:** 3 comments per minute.
  2. **Per IP address:** a higher limit (configurable, default 20 comments per minute). It stops abuse by clearing cookies, while several users behind the same LAN/NAT (one shared IP) are not blocked because of each other.
- Per-client key: the logged-in user's ID from the session; for guests, the visitor cookie (the same signed, `httpOnly` cookie used in 7.6).
- A guest with no visitor cookie gets one before the comment is accepted. An invalid (tampered) cookie is rejected.

### 7.9 Server Activity Logging
- Implemented in `back/services/activityLogger.js`, called from controllers/services.
- Events that must be logged:
  - `USER_SIGNUP`
  - `USER_LOGIN` (and `USER_LOGIN_FAILED`)
  - `ARTICLE_CREATED`
  - `ARTICLE_STATUS_CHANGED` (from → to, including the editor note on return)
  - `ARTICLE_PUBLISHED` (new article or approved update)
  - `ARTICLE_DELETED`
- Each entry is one line: ISO timestamp, event type, actor (user ID + role, or `guest`), target ID, and details.
- Written to the console and appended to `logs/activity.log` (`logs/` is git-ignored).
- Never log passwords, password hashes, session IDs or secrets.
- A logging failure must never fail the request or crash the server.

### 7.10 Categories
- Categories are stored in a separate `Category` model (`back/models/Category.js`).
- Only editors manage categories (full CRUD).
- Category names are unique, ignoring case ("Sports" and "sports" are the same name).
- An article stores one `categoryId`, in the draft and in `published`.
- A category that is used by any published article or any draft cannot be deleted.

### 7.11 Public Reads
- Every public query (feed, article page) returns only public fields: the `published` content, the author's name and `publishedAt`.
- Never send drafts, editor notes or `status` to readers.
- Never filter public content by `status`.

### 7.12 Authentication Contract
- Implemented in `back/middleware/rbac.js`.
- The logged-in user is `req.session.userId` and `req.session.role`.
- Routes use `requireRole(...roles)` and `requireSelfOrRole(paramName, ...roles)`.
- Services never read `req`. Controllers build an actor object `{ id, role }` from the session and pass it to services.
