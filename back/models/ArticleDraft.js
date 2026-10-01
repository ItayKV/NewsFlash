const crypto = require('crypto');
const mongoose = require('mongoose');
const { contentSchema } = require('./Article');

// The working copy of an article. Exactly one per article; readers never see it.
const articleDraftSchema = new mongoose.Schema(
  {
    _id: { type: String, default: () => crypto.randomUUID() },
    // unique: one draft per article
    article: { type: String, ref: 'Article', required: true, immutable: true, unique: true },
    // Auto-save writes only here.
    content: { type: contentSchema, default: () => ({}) },
  },
  { timestamps: { createdAt: false } } // updatedAt = last auto-save time
);

// Expose _id as id.
articleDraftSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

const ArticleDraft = mongoose.model('ArticleDraft', articleDraftSchema);

module.exports = ArticleDraft;
