const crypto = require('crypto');
const mongoose = require('mongoose');
const { contentSchema } = require('./Article');

// One approved version of an article. Created at the moment of approval and never changed afterwards.
const articleRevisionSchema = new mongoose.Schema({
  _id: { type: String, default: () => crypto.randomUUID() },
  article: { type: String, ref: 'Article', required: true, immutable: true },
  content: { type: contentSchema, required: true, immutable: true },
  approvedAt: { type: Date, required: true, immutable: true }, // also the creation time, so no timestamps
  approvedBy: { type: String, ref: 'User', required: true, immutable: true },
});

// All approvals of one article in time order (Impact Analytics update markers).
articleRevisionSchema.index({ article: 1, approvedAt: 1 });

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
