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

module.exports = {
  isValidCommentId,
  getCommentTextError,
  getGuestNameError,
  parseCommentSearch,
};
