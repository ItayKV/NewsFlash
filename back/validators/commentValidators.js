const { isValidArticleId } = require('./articleValidators');
const { COMMENT_TEXT_MAX_LENGTH, GUEST_NAME_MAX_LENGTH } = require('../models/Comment');

const COMMENT_SEARCH_MAX_LENGTH = 100;

const isString = (value) => typeof value === 'string';

// A string that is not empty after trimming, of up to maxLength characters.
function isNonEmptyTextUpTo(value, maxLength) {
  return isString(value) && value.trim().length > 0 && value.trim().length <= maxLength;
}

// Comment ids are UUIDs, like article ids (see Comment._id), so they are checked the same way.
const isValidCommentId = (commentId) => isValidArticleId(commentId);

/** Checks the comment text. Returns an error message, or null when it is valid. */
function getCommentTextError(text) {
  if (!isNonEmptyTextUpTo(text, COMMENT_TEXT_MAX_LENGTH)) {
    return `Comment must be text of 1 to ${COMMENT_TEXT_MAX_LENGTH} characters`;
  }
  return null;
}

/** Checks the name a guest typed. Returns an error message, or null when it is valid. */
function getGuestNameError(guestName) {
  if (!isNonEmptyTextUpTo(guestName, GUEST_NAME_MAX_LENGTH)) {
    return `Name must be text of 1 to ${GUEST_NAME_MAX_LENGTH} characters`;
  }
  return null;
}

/**
 * Parses the comment search's `search` and `articleId` query parameters. Both are optional; empty means
 * "no filter". Returns { search, articleId } (null when not given) or { error } with a message.
 */
function parseCommentSearch(query) {
  const { search, articleId } = query || {};

  if (search && (!isString(search) || search.trim().length > COMMENT_SEARCH_MAX_LENGTH)) {
    return { error: `Search must be text of up to ${COMMENT_SEARCH_MAX_LENGTH} characters` };
  }
  if (articleId && !isValidArticleId(articleId)) return { error: 'Invalid article id' };

  return { search: search ? search.trim() || null : null, articleId: articleId || null };
}

// A "load more" cursor marks the oldest comment already shown: its creation time and its id, e.g.
// '2026-10-22T10:15:00.000Z_3f2a8c1e-…'. The server makes it (see the comment serializers).
const CURSOR_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)_(.+)$/;

/**
 * Parses the optional `before` query parameter (a cursor). Returns { before } with { createdAt, id }
 * (null when not given), or { error } with a message.
 */
function parseCommentCursor(query) {
  const { before } = query || {};
  if (!before) return { before: null };

  const cursorParts = isString(before) ? CURSOR_PATTERN.exec(before) : null;
  const createdAt = cursorParts ? new Date(cursorParts[1]) : null;
  if (!cursorParts || Number.isNaN(createdAt.getTime()) || !isValidCommentId(cursorParts[2])) {
    return { error: 'Invalid cursor' };
  }
  return { before: { createdAt, id: cursorParts[2] } };
}

module.exports = {
  isValidCommentId,
  getCommentTextError,
  getGuestNameError,
  parseCommentSearch,
  parseCommentCursor,
};
