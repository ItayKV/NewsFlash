require('dotenv').config();

const app = require('./app');
const connectDB = require('./back/config/db');

const PORT = process.env.PORT || 3000;

// Fire-and-forget: DB connection attempts run in parallel with the
// HTTP server starting, and never block or crash startup on failure.
connectDB();

app.listen(PORT, () => {
  console.log(`The Daily Web server listening on http://localhost:${PORT}`);
});
