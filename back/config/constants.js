const HTTP_STATUS = Object.freeze({
  OK: 200,
  CREATED: 201,
  NO_CONTENT: 204,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_SERVER_ERROR: 500,
  SERVICE_UNAVAILABLE: 503,
});

// MongoDB duplicate key error code.
const MONGO_DUPLICATE_KEY_ERROR = 11000;

// Anonymous visitor identity cookie (see CLAUDE.md 7.6).
const VISITOR_COOKIE_NAME = 'visitorId';
const VISITOR_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;  // 1 week

// Pagination of list endpoints.
const DEFAULT_PAGE = 1;
const MAX_PAGE = 100000;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

// View queue: views are written in bulk when this many are waiting, or at the interval, whichever comes first.
const MAX_QUEUED_VIEWS = 500;
const VIEW_FLUSH_INTERVAL_MS = 60 * 1000; // 1 minute

module.exports = {
  HTTP_STATUS,
  MONGO_DUPLICATE_KEY_ERROR,
  VISITOR_COOKIE_NAME,
  VISITOR_COOKIE_MAX_AGE_MS,
  DEFAULT_PAGE,
  MAX_PAGE,
  DEFAULT_PAGE_SIZE,
  MAX_PAGE_SIZE,
  MAX_QUEUED_VIEWS,
  VIEW_FLUSH_INTERVAL_MS,
};
