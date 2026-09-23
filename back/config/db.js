const mongoose = require('mongoose');

/**
 * Connects to MongoDB using MONGODB_URI. Connection is attempted
 * asynchronously and never blocks or crashes the HTTP server —
 * failures are only logged.
 */
async function connectDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('MongoDB connected');
  } catch (err) {
    console.error('MongoDB connection error:', err.message);
  }
}

module.exports = connectDB;
