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
│   │   ├── contentSchema.js    # The content structure shared by Article.content and ArticleRevision.content
│   │   ├── userSnapshotSchema.js # { id, name } copy of a user (Article.author, ArticleRevision.approvedBy)
│   │   ├── Article.js
│   │   ├── ArticleRevision.js  # Every version of an article: published ones (immutable) and at most one draft
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
│   │   └── activityLogger.js   # Server activity log (see 7.9)
│   ├── utils/
│   │   └── articleUtils.js     # Small article helpers (e.g. presentableStatus)
│   ├── validators/             # Request input validation used by controllers, one file per domain (e.g. userValidators.js)
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
  - When an already-published article is edited, readers continue seeing the live content (`Article.content`).
  - The working draft (the article's unpublished revision, see 7.5) remains isolated until the editor approves it.

### E. Editor Workspace & Impact Analytics
- **Editorial Review:**
  - Filter articles by status (`pending_approval`, `returned_for_revision`, etc.).
  - Side-by-side or highlight comparison of published version vs. submitted changes.
  - Actions: Edit directly, Approve & Publish, Reject with mandatory feedback notes, Delete.
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
- **Layer Responsibilities:**
  - **Controllers** validate the request input (body, params, query) with `back/validators/` and return 400 before doing anything else. They contain the logic: the business rules (permissions, ownership, allowed transitions, completeness), building the response, and turning every error into an HTTP response with a status code. Expected failures are returned as `{ status, message }`, not thrown.
  - **Services** only access the database: queries, updates and transactions (`back/services/`). They contain no validation and no business rules, know nothing about HTTP (they never read `req`/`res` and never use status codes), and return data. A guarded update that matched nothing returns `null`.
  - **Models** hold the rules about their own data (e.g. `CONTENT_FIELDS` and `getMissingFields` in `contentSchema.js`, re-exported by `Article.js`), so controllers and validators import them from there.
- **Readable Code:** Write code that is easy to read. Variables, functions, files and constants have meaningful names that say what they hold or do (see Naming below); a function does one clear thing.
- **No Throw for Expected Behavior:** Do not use `throw` for logical, expected outcomes (a missing item, a forbidden action, an invalid transition, incomplete input). Return a result that carries an error (a status and a message in the controller, `null` in a service) instead, and let the caller decide what to do with it. Reserve `throw` for genuinely unexpected failures (a database error), which go to the global error handler.
- **Avoid HTTP 500:** Never answer with `500` for anything that can be anticipated: missing data, a broken invariant (e.g. an unpublished article without a draft), a race between two requests, a duplicate key. Return the fitting 4xx (400, 403, 404, 409) with a clear message, and log the broken ones. `500` is only for a genuine exception such as a lost database connection or something fatal, which the global error handler answers.
- **Logic vs. Data Access:** Controllers contain the validation and the logic (business rules). Services contain only the calls to the database and the transactions.
- **Transactions Only When Needed:** Use a database transaction only for an operation that makes more than one update or creation that depend on each other (all of them must happen, or none). Do not wrap a single write, and never wrap reading or searching data, in a transaction. See 7.10.
- **Async Handling:** Use modern `async/await` with comprehensive `try/catch` or an async wrapper.
- **Defensive Engineering:** Handle edge cases (empty search results, DB disconnection, rate-limit triggers) gracefully without crashing.
- **No Unicode Math:** When math notations are needed, strictly use LaTeX format (`$x$` or `$$...$$`).
- **Git Commit Standards:**
  - Small, atomic commits with informative English messages.
  - Feature branches for distinct modules (e.g., `feat/auto-save`, `feat/impact-analytics`).
  - **Naming:** Never use meaningless or cryptic variable names (e.g. `v`, `x`, `tmp`, `d`). Names must clearly describe what they hold (e.g. `userValidators`, not `v`). Conventional short names like `req`, `res`, `err` are fine.


  ---

## 7. Implementation Decisions (Binding)

These decisions refine the requirements above. When implementing any related feature, follow them exactly.

### 7.1 Article Workflow – Allowed State Transitions
Only the transitions below are allowed. The server must reject any other transition.

| From | To | Who | Notes |
|---|---|---|---|
| (new) | `in_progress` | Reporter only | Article is owned by the reporter who created it. |
| `in_progress` | `pending_approval` | Owning reporter | |
| `pending_approval` | `published` | Editor | The draft revision is published (it gets `publishedAt` and `approvedBy` and becomes immutable) and its content is copied to `Article.content`. |
| `pending_approval` | `returned_for_revision` | Editor | A list of 1 or more non-empty editor notes is required. Without it, the server rejects the request. |
| `returned_for_revision` | `pending_approval` | Owning reporter | The current editor notes are cleared (no history of editor notes is kept). |
| `published` | `in_progress` | Owning reporter or Editor | Happens when the reporter (or an editor, who is admin-like) starts editing an update. A new draft revision is created as a copy of `Article.content`, by the explicit `POST /api/articles/:id/edit` (start editing). `Article.content` stays live. |

- There is **no** transition from `pending_approval` back to `in_progress`, not even by the reporter.
- When an editor returns an update of a published article, `Article.content` remains live and unchanged.

### 7.2 Content Editing Permissions
A reporter can never edit an article they do not own, in any state.

| Status | Owning reporter | Editor |
|---|---|---|
| `in_progress` | Can edit | Can edit |
| `pending_approval` | Locked | Can edit |
| `returned_for_revision` | Can edit | Can edit |
| `published` | Can start editing an update | Can start editing an update, then edit |

- Editors are admin-like: they can edit any article in any state, whoever owns it.
- Editor edits always go to the draft revision and never change `status`, except that an editor editing a `published` article first starts an update exactly like the reporter does (`POST /api/articles/:id/edit`: a new draft is created and `status` becomes `in_progress`), because an article has a draft if and only if it is not published (7.5). To publish, the editor goes through the normal approve action.
- Concurrent editing of the same article is not supported (assumed not to occur).

### 7.3 Deletion
- Only an editor can delete an article, in any state.
- Deleting an article also deletes its revisions (including the draft), comments and view data.

### 7.4 Server-Side Validation Order
For every status change request, the server checks, in order:
1. The user's role.
2. Article ownership (for reporters).
3. Whether the transition appears in the allowed transitions table (7.1).

The login and the allowed roles of each route are enforced earlier by the route guards (`requireRole`; `requireOwnerOrRole(EDITOR)` for starting to edit, saving a draft and submitting: an editor or the reporter who created the article), so the controller does not repeat them; it checks ownership and the transitions table (which names the role allowed for each transition).

If any check fails, return an error with a clear message (403 for permission errors, 400 for invalid transitions or missing notes). Never crash.

- These checks run in the controller, which returns the error response with its status (403, 400, ...) before calling the service.
- Request input (content fields, the editor notes, query parameters) is validated first, in the controller, before the business rules are checked and the service is called.

### 7.5 Article Model Structure
There is no separate draft model and no `draft` field in the Article. The draft is simply the article's unpublished revision.

**`Article`** (the article and its live version):
- `content`: the live version shown to the public (title, summary, body, imageUrl, category; the structure of `contentSchema`). Empty until the first approval. It is a copy of the content of the latest published revision, kept here so the feed, search, category filter and article page read one document.
- `status`: the workflow state of the draft.
- `editorNotes`: a list of strings, the editor's feedback points when the article is returned for revision (the return request body is `{ notes: [...] }`). Each return replaces the list; it is cleared on resubmit and on approval. No history of editor notes is kept.
- `author`: the owning reporter as a `{ id, name }` snapshot (`userSnapshotSchema`), never changes. `publishedAt` (first publication only, used to sort the feed), `updatedAt`.

**`ArticleRevision`** (every version of the content, in a separate collection):
- `article`, `content` (the structure of `contentSchema`), `publishedAt`, `approvedBy` (the approving editor as a `{ id, name }` snapshot).
- `publishedAt = null` means the revision is the **draft**: the version being worked on. All auto-saves and editor edits write only to it. `approvedBy` is also empty while it is a draft.
- `publishedAt` set means the revision is **published**: it is immutable. Its `publishedAt` is the approval time and `approvedBy` is the approving editor.

**User snapshots:** `Article.author` and `ArticleRevision.approvedBy` store a copy of the user's `id` and `name` (not a reference), taken when the article is created or approved. Lists and history read the name without a User lookup, and it survives the user being deleted or renamed (it shows the name they had then). The service reads the name from the User collection, never from the client or the session. Query the owner by `author.id`.

**Invariants:**
- An article has **at most one** draft revision (a partial unique index on `article` where `publishedAt` is `null`).
- An article has a draft revision **if and only if** its `status` is not `published`. Creating an article creates its first draft. Approving turns the draft into a published revision, so none is left. Starting an update on a published article creates a new draft as a copy of `Article.content`.
- `Article.content` always equals the content of the article's latest published revision.
- Every write to a draft filters on `publishedAt: null`, so a published revision can never be changed (also in `findOneAndUpdate`, which skips document-level `immutable`).
- Auto-saving a draft also touches `Article.updatedAt`, because the lists sort by it.

**Public display rule:** The feed and the article page show every article that has `content` (a first approval happened), **regardless of `status`**, and always render `Article.content`. Never filter public content by `status`.

This structure also supports: the editor's comparison view (`Article.content` vs the draft revision), articles with multiple post-publication updates, and update markers on the Impact Analytics chart (the published revisions: `publishedAt != null`, never the draft).

### 7.6 View Counting
- Views are counted as **unique views**: each visitor is counted once per article (identified by a visitor cookie). Page refreshes by the same visitor are ignored.
- Rationale (for the project defense): prevents repeated refreshes from inflating the statistics, so the chart reflects real readers.
- The visitor cookie (`visitorId`) is signed, `httpOnly`, `sameSite=lax`, with a 7-day `maxAge` refreshed on each visit. Login session: 12 hours (absolute).

### 7.7 CRUD Endpoints
- The server must expose CRUD (Create, Read, Update, Delete) REST endpoints for the **User**, **Article**, **Comment** and **View** (`ArticleViewLog`) models.
- Exact paths, permissions and behavior for each endpoint will be specified when the endpoints are implemented.

### 7.8 Comment Rate Limiting
- Two limits are enforced together; exceeding either one returns 429 with a friendly message:
  1. **Per client:** 3 comments per minute.
  2. **Per IP address:** a higher limit (configurable, default 20 comments per minute). It stops abuse by clearing cookies, while several users behind the same LAN/NAT (one shared IP) are not blocked because of each other.
- Per-client key: the logged-in user's ID from the session; for guests, the visitor cookie (the same signed, `httpOnly` cookie used in 7.6).
- A guest with no visitor cookie gets one before the comment is accepted. An invalid (tampered) cookie is treated like a missing one: the visitor gets a new ID.

### 7.9 Server Activity Logging
- Implemented in `back/services/activityLogger.js`, called from controllers/services.
- Events that must be logged:
  - `USER_SIGNUP`
  - `USER_LOGIN` (and `USER_LOGIN_FAILED`)
  - `ARTICLE_CREATED`
  - `ARTICLE_STATUS_CHANGED` (from → to, including the editor notes on return)
  - `ARTICLE_PUBLISHED` (new article or approved update)
  - `ARTICLE_DELETED`
- Each entry is one line: ISO timestamp, event type, actor (user ID + role, or `guest`), target ID, and details.
- Written to the console and appended to `logs/activity.log` (`logs/` is git-ignored).
- Never log passwords, password hashes, session IDs or secrets.
- A logging failure must never fail the request or crash the server.

### 7.10 Atomic Writes (MongoDB Transactions)
- The database is MongoDB Atlas (a replica set), so multi-document transactions are available.
- Use a transaction **only** for an operation with more than one write (update, creation or deletion) that depend on each other, so that all of its writes happen or none does. The operations that need one (they write both the `Article` and an `ArticleRevision`) run inside one transaction (`session.withTransaction()`):
  - creating an article (the Article and its first draft),
  - starting an update on a published article (the new draft and `status = in_progress`),
  - approving (the draft is published, `Article.content` and `status` are updated),
- Operations that do not need a transaction run without one: reading and searching (opening an article, the lists, the public feed), operations with a single write (submit for approval, return for revision), deleting an article (its revisions are deleted first and the Article last, so a failed delete can simply be repeated), and the regular auto-save of an existing draft (it runs on every debounce: the Article is touched first with the status guard, then the draft is written).
- The race guard (update the Article only if its `status` is still the one checked) runs inside the same transaction when the operation has one, and as the filter of the single update otherwise.
- Transactions live in the service (it is the code that talks to the database), never in the controller. The controller decides whether an operation is allowed; the service performs its writes.
- A transaction whose guarded update matched nothing (the service returns `null`) is aborted, so nothing it wrote stays (the service's `runInTransaction` does this).
