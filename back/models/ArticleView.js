const mongoose = require('mongoose');

// One unique view: a viewer's first visit to an article (CLAUDE.md 7.6).
//  - viewer: the logged-in user's id, else the visitorId cookie. A plain string, not a reference, so deleting
//    a user leaves their views (and the article's viewCount) unchanged.
//  - viewedAt: the exact time of the first view. Time buckets (e.g. 5 minutes) are computed when read.
const articleViewSchema = new mongoose.Schema({
  article: { type: String, ref: 'Article', required: true, immutable: true },
  viewer: { type: String, required: true, immutable: true },
  viewedAt: { type: Date, required: true, immutable: true },
});

// One view per viewer per article. Also serves "which articles did this viewer view" (the viewer prefix).
articleViewSchema.index({ viewer: 1, article: 1 }, { unique: true });

const ArticleView = mongoose.model('ArticleView', articleViewSchema);

module.exports = ArticleView;
