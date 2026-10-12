const { ARTICLE_CATEGORIES } = require('../models/Article');

const TITLE_MAX_LENGTH = 120;
const SUMMARY_MAX_LENGTH = 500;
const BODY_MAX_LENGTH = 50000;
const EDITOR_NOTE_MAX_LENGTH = 1000;

// The content fields a reporter or editor may write. Anything else in the input is ignored.
const CONTENT_FIELDS = Object.freeze(['title', 'summary', 'body', 'imageUrl', 'category']);

const isString = (value) => typeof value === 'string';

// True when the value is missing (undefined / null) or an empty / whitespace-only string.
const isEmpty = (value) => value == null || (isString(value) && value.trim() === '');

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

/** Returns the names of the required fields that are empty (an empty list = the content is complete). */
function getMissingFields(content) {
  return CONTENT_FIELDS.filter((field) => isEmpty(content ? content[field] : undefined));
}

function isValidEditorNote(note) {
  return isString(note) && note.trim().length > 0 && note.trim().length <= EDITOR_NOTE_MAX_LENGTH;
}

module.exports = {
  CONTENT_FIELDS,
  EDITOR_NOTE_MAX_LENGTH,
  isEmpty,
  isValidImageUrl,
  isValidCategory,
  getContentError,
  getMissingFields,
  isValidEditorNote,
};
