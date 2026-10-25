const mongoose = require('mongoose');

// The fixed list of article categories. Used for validation, the feed filter and the seed.
const ARTICLE_CATEGORIES = Object.freeze([
  'Politics',
  'Economy',
  'Military',
  'World',
  'Technology',
  'Sports',
  'Culture',
  'Health',
]);

// One version of the article's content. Used by Article.content (the live version) and by
// ArticleRevision.content (every version, draft or published).
const contentSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    summary: { type: String, trim: true, default: '' },
    body: { type: String, default: '' },
    imageUrl: { type: String, trim: true, default: '' },
    category: { type: String, enum: ARTICLE_CATEGORIES },
  },
  { _id: false }
);

// The content fields a reporter or editor may write. Anything else in the input is ignored.
const CONTENT_FIELDS = Object.freeze(['title', 'summary', 'body', 'imageUrl', 'category']);

// The content fields that must be filled before an article is submitted or approved. The image is optional.
// The edit form marks these same fields as required, so the form and the server always agree.
const REQUIRED_FIELDS = Object.freeze(['title', 'summary', 'body', 'category']);

// The readable name of each content field, used in the form and in every error message about a field.
const FIELD_LABELS = Object.freeze({
  title: 'Title',
  summary: 'Summary',
  body: 'Body',
  imageUrl: 'Image URL',
  category: 'Category',
});

// True when the value is missing (undefined / null) or an empty / whitespace-only string.
const isEmpty = (value) => value == null || (typeof value === 'string' && value.trim() === '');

/** Returns the names of the required fields that are empty (an empty list = the content is complete). */
function getMissingFields(content) {
  return REQUIRED_FIELDS.filter((field) => isEmpty(content ? content[field] : undefined));
}

module.exports = {
  ARTICLE_CATEGORIES,
  contentSchema,
  CONTENT_FIELDS,
  REQUIRED_FIELDS,
  FIELD_LABELS,
  isEmpty,
  getMissingFields,
};
