# The Daily Web

A news publishing and management platform for **guest readers**, **reporters** and **editors**. Reporters write
articles in an auto-saving editor, editors review, approve or return them, and readers get a fast, searchable,
server-rendered news feed. Built as a monolithic MVC app with Node.js, Express, MongoDB (Mongoose) and EJS, with
plain JavaScript (Fetch API) in the browser.

---

## 1. Installation and Running

### Requirements

- **Node.js 18 or newer** (the server uses the built-in `fetch`) and npm.
- **A MongoDB replica set**, for example a free **MongoDB Atlas** cluster. Creating, approving and starting an update
  of an article use multi-document transactions, which a standalone local `mongod` does not support.
- **An OpenWeatherMap API key** (free tier, no credit card): <https://openweathermap.org/api>. Without it the site
  works, and only the weather widget shows that the weather is unavailable.

### Steps

1. **Install the dependencies:**

   ```bash
   npm install
   ```

2. **Create the environment file** by copying the example:

   ```bash
   cp .env.example .env
   ```

   Then fill in the values in `.env` (it is git-ignored and must never be committed):

   | Variable | Description |
   |---|---|
   | `PORT` | The HTTP port (default `3000`). |
   | `MONGODB_URI` | The MongoDB connection string, including the database name (e.g. `.../the-daily-web?...`). |
   | `SESSION_SECRET` | A long random string that signs the login session cookie. |
   | `COOKIE_SECRET` | A different long random string that signs the anonymous visitor cookie. |
   | `OPENWEATHER_API_KEY` | Your OpenWeatherMap API key. |
   | `WEATHER_DEFAULT_LOCATION` | The default city of the weather widget, as `City,CountryCode` (e.g. `Tel Aviv,IL`). |

3. **Fill the database with demo data** (optional, recommended for a first run):

   ```bash
   npm run seed
   ```

   > **Warning:** the seed **deletes all existing articles, revisions, comments and views** before creating new
   > ones. Existing users are kept; demo users are only added if their email does not exist yet.

4. **Start the server:**

   ```bash
   npm start
   ```

   Or, for development, with automatic restart on file changes (nodemon):

   ```bash
   npm run dev
   ```

5. **Open** <http://localhost:3000> in the browser.

### Demo Accounts (created by the seed)

The password of every demo account is the account's email address.

| Role | Email |
|---|---|
| Editor | `test.editor@dailyweb.test` (also `dana.levi@dailyweb.test`, `ron.cohen@dailyweb.test`) |
| Reporter | `test.reporter@dailyweb.test` (also `maya.katz@dailyweb.test`, `omer.peretz@dailyweb.test`, `noa.shapira@dailyweb.test`) |

Guests do not need an account: they can read, filter and comment without logging in.

### npm Scripts

| Script | What it does |
|---|---|
| `npm start` | Runs the server (`node server.js`). |
| `npm run dev` | Runs the server with nodemon (restarts on changes). |
| `npm run seed` | Fills the database with demo data (`data/seed.js`). |

---

## 2. Project Structure

```
NewsFlash/
├── server.js                  # Entry point: loads .env, connects to MongoDB, starts the server and the view-flush timer
├── app.js                     # Express app: middleware (JSON, static files, session, cookies), routes, error handler
├── package.json
├── .env.example               # Template of the required environment variables
├── data/
│   ├── seed.js                # `npm run seed`: users, 500+ articles, revisions, comments and view history
│   ├── seedArticles.js        # Sample article texts, by category
│   └── seedComments.js        # Sample comments, author replies and editor notes
├── back/                      # Server side: REST API, business logic and data access
│   ├── config/                # constants.js, db.js (Mongoose connection), session.js (MongoDB session store)
│   ├── controllers/           # API controllers: input validation and business rules
│   │                          #   (articleController, commentController, userController, viewController, weatherController)
│   ├── middleware/            # rbac.js (role and ownership guards), rateLimiter.js (comment limits),
│   │                          #   visitorAuthentication.js (anonymous visitor cookie)
│   ├── models/                # Mongoose models: User, Article, ArticleRevision, Comment, ArticleView,
│   │                          #   CommentRateLimitHit, and the shared contentSchema / userSnapshotSchema
│   ├── routes/                # API routes: articleRoutes, commentRoutes, userRoutes, weatherRoutes
│   ├── serializers/           # Shape articles and comments for the responses
│   ├── services/              # Database queries and transactions, weather cache (weatherService),
│   │                          #   activity and error logging (activityLogger)
│   ├── utils/                 # viewQueue.js (batched view writes) and small helpers
│   └── validators/            # Request input validation, one file per domain
├── front/                     # Server-rendered pages
│   ├── controllers/           # Render the EJS pages: feed and article, reporter, editor, analytics
│   └── routes/viewRoutes.js   # The page routes
├── views/                     # EJS templates
│   ├── pages/                 # home, article, login, reporter, editArticle, editor, editorReview,
│   │                          #   analytics, articleAnalytics
│   ├── components/            # header, feed, weatherWidget
│   └── partials/              # article card, comment item, list rows, compare field, ...
├── public/                    # Static files served to the browser
│   ├── css/                   # main.css, feed.css, article.css, editor.css, dashboard.css
│   └── front/                 # Browser scripts (vanilla JS): feed.js, article.js, editArticle.js, reporter.js,
│                              #   editor.js, editorReview.js, analytics.js, analyticsList.js, weather.js, ...
└── logs/                      # activity.log and error.log (created at runtime, git-ignored)
```

**Layers:** routes only connect a URL to a handler and its guards. Controllers validate the input (with
`back/validators/`) and apply the business rules (permissions, ownership, allowed status transitions). Services
only talk to the database. Models hold the rules about their own data.

---

## 3. Core Functionality and Features

### Public News Feed (`/`)
- The first 20 published articles are rendered on the server; the next pages load with **infinite scroll** (AJAX).
- **Search** over title and summary (case-insensitive), **filter** by category and by viewed / not viewed (per
  visitor), and **sort** by newest or most popular (unique views). All update instantly, without a page reload.
- Each card shows the image, title, summary, category, reporter name and publication time.

### Article Page (`/articles/:id`)
- Fully **server-rendered for SEO**: the body, metadata, author and time are in the first HTML response.
- **Comments with AJAX:** guests (with a name) and logged-in users can post; new comments are added to the page
  without reloading, and older ones load with "Load more". Writers can edit and delete their own comments; editors
  can delete any comment. User text is always shown as plain text (no HTML injection).
- **Comment rate limiting:** at most 3 comments per minute per user / visitor, plus 20 per minute per IP address.
  Going over returns `429` with a friendly message. The counts are stored in MongoDB, so they survive a restart.

### Authentication and Roles
- Three roles: **Guest**, **Reporter**, **Editor**. Passwords are hashed with **bcrypt**.
- **Sessions are stored in MongoDB** (`connect-mongo`), so a server restart does not log anyone out. A login lasts
  12 hours.
- Every API route checks the role (and article ownership where needed) **on the server**; hidden buttons are never
  the only protection.
- Editors manage users through the user API (add, list, update, delete).

### Reporter Workspace (`/reporter`)
- A list of the reporter's own articles and their status, and a **New article** button.
- **Auto-save:** changes are saved to the draft automatically (text after a short pause), and pending changes are
  also sent when the tab is hidden or closed, so no work is lost.
- **Article workflow:** `in_progress` → `pending_approval` → `published`, or `returned_for_revision` with the
  editor's notes and back to `pending_approval`. The server rejects any other transition.
- **Live vs. draft:** editing a published article creates a new draft revision; readers keep seeing the live
  version until an editor approves the update.

### Editor Workspace (`/editor`)
- A **review queue** filtered by status.
- A **side-by-side comparison** of the published version and the submitted draft, with changed fields marked.
- Actions: **edit directly**, **approve and publish**, **return for revision** (at least one note is required), and
  **delete** (also removes the article's revisions, comments and views).

### Impact Analytics (`/editor/analytics`)
- A searchable list of published articles, most viewed first.
- Per article, a **Chart.js** chart of unique views over time, with a selectable time bucket (5 minutes to 1 day)
  and **markers at every published version** (first publication and each approved update), to compare traffic
  before and after an update.
- **Unique views:** each visitor is counted once per article (by user id or a signed visitor cookie). Views are
  queued in memory and written in bulk once a minute, so heavy traffic does not cause a write per visit.

### Weather Widget
- A sidebar widget with the current weather from **OpenWeatherMap**: the default city, or the visitor's own area if
  they allow location access.
- Responses are **cached on the server for 15 minutes** (the default city is refreshed in the background, nearby
  visitor locations share one cache entry), so reader traffic never exhausts the API quota.

### Activity and Error Logging
- Important events (login, failed login, article created, status changes, deletion) are written as one line each to
  the console and to `logs/activity.log`: time, event, actor, target and details. Passwords and secrets are never
  logged.
- Unexpected server errors are written to `logs/error.log`. A logging failure never fails a request.

### Seed Data
`npm run seed` creates 7 demo users (3 editors, 4 reporters), **500 published articles** across 8 categories,
55 more articles in the other workflow states (in progress, pending approval, returned for revision), 5 published
articles with an update waiting for approval, articles with **2 updates after publication**, thousands of comments,
and enough view history for rich analytics charts.

### Main API Endpoints

| Area | Endpoints |
|---|---|
| Articles | `GET /api/articles` (public list), `POST /api/articles` (create), `GET /api/articles/reporter`, `GET /api/articles/editor`, `GET /api/articles/:id`, `POST /api/articles/:id/edit` (start an update), `PATCH /api/articles/:id/draft` (auto-save), `POST /api/articles/:id/submit`, `POST /api/articles/:id/approve`, `POST /api/articles/:id/return`, `DELETE /api/articles/:id` |
| Comments | `GET /api/articles/:articleId/comments`, `POST /api/articles/:articleId/comments`, `PATCH /api/comments/:id`, `DELETE /api/comments/:id` |
| Users | `POST /users/login`, `POST /users/logout`, `POST /users/add`, `GET /users`, `GET /users/:user_id`, `PUT /users/:user_id`, `DELETE /users/:user_id` |
| Views | `GET /api/articles/:id/views/timeline` (views per time bucket) |
| Weather | `GET /weather` (optionally `?lat=&lon=`) |

### Technologies
Node.js, Express, MongoDB with Mongoose, EJS, `express-session` with `connect-mongo`, bcrypt, cookie-parser,
Chart.js, OpenWeatherMap API, and plain HTML5, CSS3 and JavaScript in the browser (no frontend framework).
