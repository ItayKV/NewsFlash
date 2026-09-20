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
│   │   ├── articleController.js
│   │   ├── commentController.js
│   │   ├── editorController.js
│   │   ├── analyticsController.js
│   │   └── weatherController.js
│   ├── middleware/
│   │   ├── auth.js             # Authentication check
│   │   ├── rbac.js             # Role-Based Access Control (Guest, Reporter, Editor)
│   │   ├── rateLimiter.js      # Comment rate limiter (max 3/min per IP/fingerprint)
│   │   └── errorHandler.js     # Global error & logging middleware
│   ├── models/
│   │   ├── User.js
│   │   ├── Article.js
│   │   ├── Comment.js
│   │   └── ArticleViewLog.js   # High-throughput aggregated analytics model
│   ├── routes/
│   │   ├── authRoutes.js
│   │   ├── articleRoutes.js
│   │   ├── commentRoutes.js
│   │   ├── reporterRoutes.js
│   │   ├── editorRoutes.js
│   │   └── apiRoutes.js
│   ├── services/
│   │   ├── weatherService.js   # Server-side caching (max 15-min stale cache)
│   │   └── analyticsService.js
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
  - **Rate Limiting:** Maximum 3 comments per minute per device/IP. Blocked server-side with a user-friendly error message (`HTTP 429`).
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