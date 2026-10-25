const { isValidUUID } = require('./sharedValidators');
const { COMMENT_TEXT_MAX_LENGTH, GUEST_NAME_MAX_LENGTH } = require('../models/Comment');

const isString = (value) => typeof value === 'string';

// A string that is not empty after trimming, of up to maxLength characters.
function isNonEmptyTextUpTo(value, maxLength) {
  return isString(value) && value.trim().length > 0 && value.trim().length <= maxLength;
}

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

// A "load more" cursor marks the oldest comment already shown: its creation time and its id, e.g.
// '2026-10-22T10:15:00.000Z_3f2a8c1e-…'. The server makes it (see the comment serializers).
const CURSOR_PATTERN = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z)_(.+)$/;

/**
 * Parses the optional `before` query parameter (a cursor). Returns { before, error }: `before` is
 * { createdAt, id } (null when not given), and `error` is a message when the cursor is invalid (else null).
 */
function parseCommentCursor(query) {
  const { before } = query || {};
  if (!before) return { before: null, error: null };

  const cursorParts = isString(before) ? CURSOR_PATTERN.exec(before) : null;
  const createdAt = cursorParts ? new Date(cursorParts[1]) : null;
  if (!cursorParts || Number.isNaN(createdAt.getTime()) || !isValidUUID(cursorParts[2])) {
    return { before: null, error: 'Invalid cursor' };
  }
  return { before: { createdAt, id: cursorParts[2] }, error: null };
}

module.exports = {
  getCommentTextError,
  getGuestNameError,
  parseCommentCursor,
};
