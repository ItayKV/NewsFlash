const { ARTICLE_CATEGORIES, ArticleStatusEnum, isEmpty } = require('../models/Article');
const { isValidUUID } = require('./sharedValidators');

const { DEFAULT_PAGE, MAX_PAGE, DEFAULT_PAGE_SIZE, MAX_PAGE_SIZE } = require('../config/constants');

const TITLE_MAX_LENGTH = 120;
const SUMMARY_MAX_LENGTH = 500;
const BODY_MAX_LENGTH = 50000;
const SEARCH_MAX_LENGTH = 100;
const EDITOR_NOTE_MAX_LENGTH = 1000;
const EDITOR_NOTES_MAX_COUNT = 20;

// The feed's sort orders, and its filter by whether the current viewer already viewed the article.
const FeedSortEnum = Object.freeze({ NEWEST: 'newest', POPULAR: 'popular' });
const ViewedFilterEnum = Object.freeze({ VIEWED: 'viewed', UNVIEWED: 'unviewed' });

const isString = (value) => typeof value === 'string';

// A string of up to maxLength characters.
function isTextUpTo(value, maxLength) {
  return isString(value) && value.length <= maxLength;
}

// No image (null, undefined or ''), or a full https:// address (http is not allowed).
function isValidImageUrl(imageUrl) {
  if (imageUrl == null) return true;     // null or undefined: no image
  if (!isString(imageUrl)) return false;
  const url = imageUrl.trim();
  if (url === '') return true;           // empty: no image
  return URL.canParse(url) && new URL(url).protocol === 'https:';
}

// One of the fixed ARTICLE_CATEGORIES, matched exactly (case-sensitive).
function isValidCategory(category) {
  return isString(category) && ARTICLE_CATEGORIES.includes(category);
}

// One of the ArticleStatusEnum values.
function isValidStatus(status) {
  return Object.values(ArticleStatusEnum).includes(status);
}

/**
 * Checks every content field that was sent (fields that are undefined were not sent).
 * Returns an error message, or null when everything is valid.
 */
function getContentError(content) {
  if (content == null || typeof content !== 'object' || Array.isArray(content)) return 'Invalid content';
  const { title, summary, body, imageUrl, category } = content;

  if (title !== undefined && !isTextUpTo(title, TITLE_MAX_LENGTH)) {
    return `Title must be text of up to ${TITLE_MAX_LENGTH} characters`;
  }
  if (summary !== undefined && !isTextUpTo(summary, SUMMARY_MAX_LENGTH)) {
    return `Summary must be text of up to ${SUMMARY_MAX_LENGTH} characters`;
  }
  if (body !== undefined && !isTextUpTo(body, BODY_MAX_LENGTH)) {
    return `Body must be text of up to ${BODY_MAX_LENGTH} characters`;
  }
  if (imageUrl !== undefined && !isValidImageUrl(imageUrl)) {
    return 'Image URL must be empty or a valid https:// address';
  }
  // An empty category means "no category"; any other value must be one of ARTICLE_CATEGORIES.
  if (!isEmpty(category) && !isValidCategory(category)) {
    return `Category must be one of: ${ARTICLE_CATEGORIES.join(', ')}`;
  }
  return null;
}

// A well-formed article id (a UUID, see Article._id).
const isValidArticleId = (articleId) => isValidUUID(articleId);

// A positive whole number given as a query string value (e.g. '3').
const isPositiveIntegerString = (value) => isString(value) && /^[1-9]\d*$/.test(value);

/**
 * Parses the `page` and `limit` query parameters. Missing or empty values get the defaults.
 * Returns { page, limit } or { error } with a message.
 */
function parsePagination(query) {
  const { page, limit } = query || {};

  if (page && !isPositiveIntegerString(page)) return { error: 'Page must be a positive whole number' };
  if (limit && !isPositiveIntegerString(limit)) return { error: 'Limit must be a positive whole number' };
  // A huge page would make the database reject the skip, so it is refused here.
  if (page && Number(page) > MAX_PAGE) return { error: `Page must be at most ${MAX_PAGE}` };

  const parsedLimit = limit ? Number(limit) : DEFAULT_PAGE_SIZE;
  if (parsedLimit > MAX_PAGE_SIZE) return { error: `Limit must be at most ${MAX_PAGE_SIZE}` };

  return { page: page ? Number(page) : DEFAULT_PAGE, limit: parsedLimit };
}

/**
 * Parses the feed's `search`, `category`, `sort` and `viewed` query parameters. All are optional; empty means
 * "no filter" (and the newest-first sort). Returns { search, category, sort, viewed } (null when not given)
 * or { error } with a message.
 */
function parseFeedFilters(query) {
  const { search, category, sort, viewed } = query || {};

  if (search && (!isString(search) || search.trim().length > SEARCH_MAX_LENGTH)) {
    return { error: `Search must be text of up to ${SEARCH_MAX_LENGTH} characters` };
  }
  if (category && !isValidCategory(category)) {
    return { error: `Category must be one of: ${ARTICLE_CATEGORIES.join(', ')}` };
  }
  if (sort && !Object.values(FeedSortEnum).includes(sort)) {
    return { error: `Sort must be one of: ${Object.values(FeedSortEnum).join(', ')}` };
  }
  if (viewed && !Object.values(ViewedFilterEnum).includes(viewed)) {
    return { error: `Viewed must be one of: ${Object.values(ViewedFilterEnum).join(', ')}` };
  }

  return {
    search: search ? search.trim() || null : null,
    category: category || null,
    sort: sort || FeedSortEnum.NEWEST,
    viewed: viewed || null,
  };
}

/**
 * Checks the editor's notes of a return: a list of 1 to EDITOR_NOTES_MAX_COUNT notes, each a non-empty text
 * of up to EDITOR_NOTE_MAX_LENGTH characters. Returns an error message, or null when the notes are valid.
 */
function getEditorNotesError(notes) {
  if (!Array.isArray(notes) || notes.length === 0 || notes.length > EDITOR_NOTES_MAX_COUNT) {
    return `Notes must be a list of 1 to ${EDITOR_NOTES_MAX_COUNT} notes`;
  }
  const allNotesValid = notes.every(
    (note) => isString(note) && note.trim().length > 0 && note.trim().length <= EDITOR_NOTE_MAX_LENGTH
  );
  if (!allNotesValid) return `Each note must be text of 1 to ${EDITOR_NOTE_MAX_LENGTH} characters`;
  return null;
}

module.exports = {
  TITLE_MAX_LENGTH,
  SUMMARY_MAX_LENGTH,
  BODY_MAX_LENGTH,
  EDITOR_NOTE_MAX_LENGTH,
  EDITOR_NOTES_MAX_COUNT,
  FeedSortEnum,
  ViewedFilterEnum,
  isValidImageUrl,
  isValidCategory,
  isValidStatus,
  isValidArticleId,
  getContentError,
  parsePagination,
  parseFeedFilters,
  getEditorNotesError,
};
