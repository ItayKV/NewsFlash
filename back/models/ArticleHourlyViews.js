const crypto = require('crypto');
const mongoose = require('mongoose');

// The unique views of one article in one hour, as a counter. A new unique view adds 1 to the counter of its hour
// (an upsert with $inc), so the Impact Analytics chart reads a few small documents instead of counting every
// ArticleViewLog document, and thousands of readers at the same time do not each insert a document here.
const articleHourlyViewsSchema = new mongoose.Schema({
  _id: { type: String, default: () => crypto.randomUUID() },
  article: { type: String, ref: 'Article', required: true, immutable: true },
  hour: { type: Date, required: true, immutable: true }, // the start of the hour (minutes, seconds and ms are 0)
  count: { type: Number, required: true, default: 0, min: 0 },
});

// One counter per article and hour; also serves the time-range query of the analytics.
articleHourlyViewsSchema.index({ article: 1, hour: 1 }, { unique: true });

module.exports = mongoose.model('ArticleHourlyViews', articleHourlyViewsSchema);
