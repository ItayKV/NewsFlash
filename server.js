require('dotenv').config();

const app = require('./app');
const connectDB = require('./back/config/db');
const viewQueue = require('./back/utils/viewQueue');

const PORT = process.env.PORT || 3000;

// connect-mongo (the session store) chains internal promises off its DB
// connection without catching them, so a down database surfaces as an
// unhandled rejection here rather than inside our own code. Log it instead
// of crashing, matching connectDB()'s "never block or crash" behavior.
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err.message || err);
});

// Log an uncaught exception, then exit with a non-zero code so the crash
// is still reported as a failure.
process.on('uncaughtException', (err) => {
  console.error('Uncaught exception:', err);
  process.exit(1);
});

// Fire-and-forget: DB connection attempts run in parallel with the
// HTTP server starting, and never block or crash startup on failure.
connectDB();
viewQueue.startViewFlushTimer();

app.listen(PORT, '0.0.0.0', () => {
  console.log(`The Daily Web server listening on http://localhost:${PORT}`);
});

// On a normal stop (Ctrl+C, a hosting shutdown), write the queued article views before exiting.
for (const signal of ['SIGINT', 'SIGTERM']) {
  process.once(signal, async () => {
    await viewQueue.flushAllViews();
    process.exit(0);
  });
}
