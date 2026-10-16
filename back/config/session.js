const session = require('express-session');
const { MongoClient } = require('mongodb');
const { MongoStore } = require('connect-mongo');

// Absolute lifetime: the expiry is fixed at login and does not move on later requests.
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000;  // 12 hours
const SESSION_COLLECTION = 'sessions';

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
  store: MongoStore.create({
    clientPromise: mongoClientPromise,
    collectionName: SESSION_COLLECTION,
    // Store sessions as documents rather than JSON strings, so they can be
    // queried by user id (see sessionService).
    stringify: false,
  }),
  cookie: {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    maxAge: SESSION_MAX_AGE_MS,
  },
});

module.exports = { sessionMiddleware, mongoClientPromise, SESSION_COLLECTION };
