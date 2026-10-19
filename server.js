require('dotenv').config();

const app = require('./app');
const connectDB = require('./back/config/db');

const PORT = process.env.PORT || 3000;

// connect-mongo (the session store) chains internal promises off its DB
// connection without catching them, so a down database surfaces as an
// unhandled rejection here rather than inside our own code. Log it instead
// of crashing, matching connectDB()'s "never block or crash" behavior.
process.on('unhandledRejection', (err) => {
  console.error('Unhandled rejection:', err.message || err);
});

// Fire-and-forget: DB connection attempts run in parallel with the
// HTTP server starting, and never block or crash startup on failure.
connectDB();

app.listen(PORT, () => {
  console.log(`The Daily Web server listening on http://localhost:${PORT}`);
});
