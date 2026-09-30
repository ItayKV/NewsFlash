# The Daily Web

A news publishing and management platform (Node.js, Express, MongoDB/Mongoose, EJS). See `CLAUDE.md` for the full project guide and planned feature set.

This is currently the minimal boilerplate: a single landing page and a single default endpoint, with an empty database connection.

## Getting Started

1. Install dependencies:
   ```
   npm install
   ```
2. Copy the environment example and adjust as needed:
   ```
   cp .env.example .env
   ```
3. Run the dev server (auto-reloads on change):
   ```
   npm run dev
   ```
   or run it plainly:
   ```
   npm start
   ```
4. Visit [http://localhost:3000](http://localhost:3000).

MongoDB is optional at this stage — the server starts and serves the landing page even if no MongoDB instance is reachable; a connection error is simply logged to the console.
