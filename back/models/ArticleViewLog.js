const crypto = require('crypto');
const mongoose = require('mongoose');

// Who viewed which article: one document per viewer and article, written the first time the viewer opens it
// (a unique view, CLAUDE.md 7.6; a refresh by the same viewer adds nothing).
// It answers "has this viewer seen this article?" (for the feed's viewed / unviewed filter) and counts the
// unique views of an article. The views over time for the analytics chart are kept apart in ArticleHourlyViews.
const articleViewLogSchema = new mongoose.Schema({
  _id: { type: String, default: () => crypto.randomUUID() },
  article: { type: String, ref: 'Article', required: true, immutable: true },
  viewerId: { type: String, required: true, immutable: true }, // the visitor cookie id (req.visitorId)
  viewedAt: { type: Date, required: true, immutable: true }, // the first view
});

// One document per viewer and article. Also serves "which of these articles did this viewer see".
articleViewLogSchema.index({ viewerId: 1, article: 1 }, { unique: true });
// The views of one article in a time range.
articleViewLogSchema.index({ article: 1, viewedAt: 1 });

// Expose _id as id.
articleViewLogSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
    return ret;
  },
});

module.exports = mongoose.model('ArticleViewLog', articleViewLogSchema);
