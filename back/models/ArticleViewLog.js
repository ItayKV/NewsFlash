const crypto = require('crypto');
const mongoose = require('mongoose');

// Views of one article in one hour. A view adds 1 to the counter of its hour (an upsert with $inc), so thousands
// of readers at the same time update one small document per article and hour instead of inserting a document
// per view. Impact Analytics reads these buckets.
const articleViewLogSchema = new mongoose.Schema({
  _id: { type: String, default: () => crypto.randomUUID() },
  article: { type: String, ref: 'Article', required: true, immutable: true },
  hour: { type: Date, required: true, immutable: true }, // the start of the hour (minutes, seconds and ms are 0)
  count: { type: Number, required: true, default: 0, min: 0 },
});

// One bucket per article and hour; also serves the time-range query of the analytics.
articleViewLogSchema.index({ article: 1, hour: 1 }, { unique: true });

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
