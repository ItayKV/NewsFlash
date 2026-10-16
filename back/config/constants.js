const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  INTERNAL_SERVER_ERROR: 500,
});

// MongoDB duplicate key error code.
const MONGO_DUPLICATE_KEY_ERROR = 11000;

// Anonymous visitor identity cookie (see CLAUDE.md 7.6).
const VISITOR_COOKIE_NAME = 'visitorId';
const VISITOR_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;  // 1 week

module.exports = { HTTP_STATUS, MONGO_DUPLICATE_KEY_ERROR, VISITOR_COOKIE_NAME, VISITOR_COOKIE_MAX_AGE_MS };
