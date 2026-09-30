require('dotenv').config();

const app = require('./app');
const connectDB = require('./back/config/db');
const weatherService = require('./back/services/weatherService');

const PORT = process.env.PORT || 3000;

// connect-mongo (the session store) chains internal promises off its DB
// connection without catching them, so a down database surfaces as an
// unhandled rejection here rather than inside our own code. Log it instead
// of crashing, matching connectDB()'s "never block or crash" behavior.
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err.message || err);
});

// Stops the weather refresh timer so the process can exit cleanly on shutdown
// instead of waiting on a pending background refresh.
function shutdown(exitCode = 0) {
  weatherService.stopRefreshLoop();
  process.exit(exitCode);
}
process.on('SIGTERM', () => shutdown());
process.on('SIGINT', () => shutdown());

// An uncaught exception would otherwise crash the process immediately,
// skipping the cleanup above. Run it here too, with a non-zero exit code
// so the crash is still reported as a failure.
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  shutdown(1);
});

// Fire-and-forget: DB connection attempts run in parallel with the
// HTTP server starting, and never block or crash startup on failure.
connectDB();

app.listen(PORT, () => {
  console.log(`The Daily Web server listening on http://localhost:${PORT}`);
});
