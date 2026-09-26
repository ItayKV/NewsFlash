const crypto = require('crypto');
const mongoose = require('mongoose');
const { RoleEnum } = require('./User');

const ArticleStatusEnum = Object.freeze({
  IN_PROGRESS: 'in_progress',
  PENDING_APPROVAL: 'pending_approval',
  PUBLISHED: 'published',
  RETURNED_FOR_REVISION: 'returned_for_revision',
});

const CategoryEnum = Object.freeze([
  'World',
  'Politics',
  'Business',
  'Technology',
  'Science',
  'Health',
  'Sports',
  'Culture',
]);

// Allowed status changes (CLAUDE.md section 7.1). Any change not listed here is rejected.
// from: null means "a new article" (any reporter may create one; the creator becomes the author).
// ownerOnly: only the reporter who owns the article.
const ALLOWED_TRANSITIONS = Object.freeze([
  Object.freeze({ from: null, to: ArticleStatusEnum.IN_PROGRESS, role: RoleEnum.REPORTER, ownerOnly: false }),
  Object.freeze({ from: ArticleStatusEnum.IN_PROGRESS, to: ArticleStatusEnum.PENDING_APPROVAL, role: RoleEnum.REPORTER, ownerOnly: true }),
  Object.freeze({ from: ArticleStatusEnum.PENDING_APPROVAL, to: ArticleStatusEnum.PUBLISHED, role: RoleEnum.EDITOR, ownerOnly: false }),
  Object.freeze({ from: ArticleStatusEnum.PENDING_APPROVAL, to: ArticleStatusEnum.RETURNED_FOR_REVISION, role: RoleEnum.EDITOR, ownerOnly: false }),
  Object.freeze({ from: ArticleStatusEnum.RETURNED_FOR_REVISION, to: ArticleStatusEnum.PENDING_APPROVAL, role: RoleEnum.REPORTER, ownerOnly: true }),
  Object.freeze({ from: ArticleStatusEnum.PUBLISHED, to: ArticleStatusEnum.IN_PROGRESS, role: RoleEnum.REPORTER, ownerOnly: true }),
]);

// One version of the article's content. Used for both "published" and "draft",
// and for every approved version saved in "revisions".
const contentSchema = new mongoose.Schema(
  {
    title: { type: String, trim: true, default: '' },
    summary: { type: String, trim: true, default: '' },
    body: { type: String, default: '' },
    imageUrl: { type: String, trim: true, default: '' },
    category: { type: String, enum: CategoryEnum },
  },
  { _id: false }
);

const editorNoteSchema = new mongoose.Schema(
  {
    note: { type: String, required: true, trim: true },
    editor: { type: String, ref: 'User', required: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: false }
);

const revisionSchema = new mongoose.Schema(
  {
    content: { type: contentSchema, required: true },
    approvedAt: { type: Date, required: true },
    approvedBy: { type: String, ref: 'User', required: true },
  },
  { _id: false }
);

const articleSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    author: { type: String, ref: 'User', required: true, immutable: true }, // owner never changes
    status: {
      type: String,
      enum: Object.values(ArticleStatusEnum),
      default: ArticleStatusEnum.IN_PROGRESS,
      required: true,
    },
    // Empty (undefined) until the first approval. Public pages show only this version.
    published: { type: contentSchema },
    // The working copy. Auto-save writes only here.
    draft: { type: contentSchema, default: () => ({}) },
    editorNote: { type: String, trim: true, default: '' },
    editorNotesHistory: { type: [editorNoteSchema], default: [] },
    revisions: { type: [revisionSchema], default: [] },
    publishedAt: { type: Date }, // first publication only
    viewCount: { type: Number, default: 0, min: 0 }, // unique views (section 7.6)
  },
  { timestamps: true }
);

// Search over the public version only.
articleSchema.index({ 'published.title': 'text', 'published.summary': 'text' });
// Public feed: articles that have a "published" snapshot (never filtered by status),
// sorted newest first or most popular first.
articleSchema.index({ publishedAt: -1 });
articleSchema.index({ viewCount: -1, publishedAt: -1 });
articleSchema.index({ 'published.category': 1, publishedAt: -1 });
// Editor queue by status, reporter workspace by author.
articleSchema.index({ status: 1, updatedAt: -1 });
articleSchema.index({ author: 1, updatedAt: -1 });

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
module.exports.CategoryEnum = CategoryEnum;
module.exports.ALLOWED_TRANSITIONS = ALLOWED_TRANSITIONS;
