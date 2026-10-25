const crypto = require('crypto');
const mongoose = require('mongoose');
const userSnapshotSchema = require('./userSnapshotSchema');
const { ARTICLE_CATEGORIES, contentSchema, CONTENT_FIELDS, isEmpty, getMissingFields } = require('./contentSchema');

const ArticleStatusEnum = Object.freeze({
  IN_PROGRESS: 'in_progress',
  PENDING_APPROVAL: 'pending_approval',
  PUBLISHED: 'published',
  RETURNED_FOR_REVISION: 'returned_for_revision',
});

const articleSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    author: { type: userSnapshotSchema, required: true, immutable: true }, // the owner { id, name }; never changes
    status: {
      type: String,
      enum: Object.values(ArticleStatusEnum),
      default: ArticleStatusEnum.IN_PROGRESS,
      required: true,
    },
    // The live version: a copy of the latest published revision. Empty (undefined) until the first approval.
    // Public pages show only this. The working draft is an ArticleRevision with publishedAt = null.
    content: { type: contentSchema },
    editorNotes: { type: [{ type: String, trim: true }], default: [] }, // the editor's feedback points of the current return
    publishedAt: { type: Date }, // first publication only
    viewCount: { type: Number, default: 0, min: 0 }, // unique views (ArticleView docs), for the popularity sort
    deletedAt: { type: Date, default: null }, // set when a delete starts, just before the article is removed
  },
  { timestamps: { createdAt: false } }
);

// Search over the public version only.
articleSchema.index({ 'content.title': 'text', 'content.summary': 'text' });
// Public feed: articles that have live content (never filtered by status),
// sorted newest first.
articleSchema.index({ publishedAt: -1 });
articleSchema.index({ 'content.category': 1, publishedAt: -1 });
// Public feed sorted by popularity.
articleSchema.index({ viewCount: -1 });
// Editor queue by status, reporter workspace by author.
articleSchema.index({ status: 1, updatedAt: -1 });
articleSchema.index({ 'author.id': 1, updatedAt: -1 });

// Expose _id as id.
articleSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const Article = mongoose.model('Article', articleSchema);

module.exports = Article;
module.exports.ArticleStatusEnum = ArticleStatusEnum;
module.exports.contentSchema = contentSchema;
module.exports.ARTICLE_CATEGORIES = ARTICLE_CATEGORIES;
module.exports.CONTENT_FIELDS = CONTENT_FIELDS;
module.exports.isEmpty = isEmpty;
module.exports.getMissingFields = getMissingFields;
