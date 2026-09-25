const session = require('express-session');
const { MongoClient } = require('mongodb');
const { MongoStore } = require('connect-mongo');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

// Connect ourselves (rather than passing mongoUrl to MongoStore) so we can
// attach a rejection handler here. Without one, a down database turns the
// connection failure into an unhandled rejection that crashes the server.
const mongoClientPromise = MongoClient.connect(process.env.MONGODB_URI);
mongoClientPromise.catch((err) => {
  console.error('Session store MongoDB connection error:', err.message);
});

/**
 * Session middleware backed by MongoDB (connect-mongo), so sessions
 * survive server restarts instead of living only in process memory.
 * RBAC middleware reads the role stored here to enforce permissions.
 */
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ clientPromise: mongoClientPromise }),
  cookie: {
    httpOnly: true,
    maxAge: ONE_DAY_MS,
  },
});

module.exports = sessionMiddleware;
