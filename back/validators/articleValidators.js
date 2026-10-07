const Category = require('../models/Category');

const TITLE_MAX_LENGTH = 120;
const SUMMARY_MAX_LENGTH = 500;
const BODY_MAX_LENGTH = 50000;
const EDITOR_NOTE_MAX_LENGTH = 1000;

// The content fields a reporter or editor may write. Anything else in the input is ignored.
const CONTENT_FIELDS = Object.freeze(['title', 'summary', 'body', 'imageUrl', 'categoryId']);

const isString = (value) => typeof value === 'string';

// True when the value is missing (undefined / null) or an empty / whitespace-only string.
const isEmpty = (value) => value == null || (isString(value) && value.trim() === '');

function isValidTitle(title) {
  return isString(title) && title.length <= TITLE_MAX_LENGTH;
}

function isValidSummary(summary) {
  return isString(summary) && summary.length <= SUMMARY_MAX_LENGTH;
}

function isValidBody(body) {
  return isString(body) && body.length <= BODY_MAX_LENGTH;
}

// Empty, or a full https:// address (http is not allowed).
function isValidImageUrl(imageUrl) {
  if (!isString(imageUrl)) return false;
  if (imageUrl.trim() === '') return true;
  try {
    return new URL(imageUrl.trim()).protocol === 'https:';
  } catch {
    return false; // not a URL at all
  }
}

// Async: needs a DB lookup. Only strings are looked up, so an object can't be used as a query.
async function categoryExists(categoryId) {
  return isString(categoryId) && Boolean(await Category.exists({ _id: categoryId }));
}

/**
 * Checks every content field that was sent (fields that are undefined were not sent).
 * Returns an error message, or null when everything is valid.
 */
async function getContentError(content) {
  if (content == null || typeof content !== 'object' || Array.isArray(content)) return 'Invalid content';
  const { title, summary, body, imageUrl, categoryId } = content;

  if (title !== undefined && !isValidTitle(title)) {
    return `Title must be text of up to ${TITLE_MAX_LENGTH} characters`;
  }
  if (summary !== undefined && !isValidSummary(summary)) {
    return `Summary must be text of up to ${SUMMARY_MAX_LENGTH} characters`;
  }
  if (body !== undefined && !isValidBody(body)) {
    return `Body must be text of up to ${BODY_MAX_LENGTH} characters`;
  }
  if (imageUrl !== undefined && !isValidImageUrl(imageUrl)) {
    return 'Image URL must be empty or a valid https:// address';
  }
  // An empty categoryId means "no category"; any other value must be an existing category.
  if (!isEmpty(categoryId) && !(await categoryExists(categoryId))) return 'Category not found';
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
  isValidTitle,
  isValidSummary,
  isValidBody,
  isValidImageUrl,
  categoryExists,
  getContentError,
  getMissingFields,
  isValidEditorNote,
};
