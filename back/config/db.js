const mongoose = require('mongoose');

// After a failed first attempt, the connection is retried this many times, waiting between attempts.
const CONNECT_RETRIES = 3;
const RETRY_DELAY_MS = 5000;

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

/**
 * Connects to MongoDB using MONGODB_URI. A failed attempt is retried up to CONNECT_RETRIES times, RETRY_DELAY_MS
 * apart. Connection is attempted asynchronously and never blocks or crashes the HTTP server — failures are only
 * logged. Returns whether the connection succeeded.
 */
async function connectDB() {
  for (let attempt = 1; attempt <= CONNECT_RETRIES + 1; attempt++) {
    try {
      await mongoose.connect(process.env.MONGODB_URI);
      console.log('MongoDB connected');
      return true;
    } catch (err) {
      console.error(`MongoDB connection error (attempt ${attempt} of ${CONNECT_RETRIES + 1}):`, err.message);
      if (attempt <= CONNECT_RETRIES) await wait(RETRY_DELAY_MS);
    }
  }
  console.error(`MongoDB connection failed after ${CONNECT_RETRIES} retries`);
  return false;
}

module.exports = connectDB;
