const crypto = require('crypto');
const mongoose = require('mongoose');
const { contentSchema } = require('./contentSchema');
const userSnapshotSchema = require('./userSnapshotSchema');

// One version of an article's content.
//  - publishedAt = null: the DRAFT, the version being worked on. Auto-save and editor edits write only here.
//  - publishedAt set: a PUBLISHED version. Immutable from then on; publishedAt is the approval time.
// An article has at most one draft, and has a draft if and only if its status is not "published".
// Every write to a draft must filter on { publishedAt: null }, so a published revision is never changed
// (findOneAndUpdate skips document-level "immutable", so the filter is the guard).
const articleRevisionSchema = new mongoose.Schema({
  _id: { type: String, default: () => crypto.randomUUID() },
  article: { type: String, ref: 'Article', required: true, immutable: true },
  content: { type: contentSchema, default: () => ({}) },
  publishedAt: { type: Date, default: null },
  approvedBy: { type: userSnapshotSchema, default: null }, // the approving editor { id, name }; null while it is a draft
});

// All versions of one article in time order (Impact Analytics update markers use the published ones).
articleRevisionSchema.index({ article: 1, publishedAt: 1 });
// At most one draft per article, even if two "start update" requests arrive at the same moment.
articleRevisionSchema.index(
  { article: 1 },
  { unique: true, partialFilterExpression: { publishedAt: { $type: 'null' } } }
);

// Expose _id as id.
articleRevisionSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const ArticleRevision = mongoose.model('ArticleRevision', articleRevisionSchema);

module.exports = ArticleRevision;
