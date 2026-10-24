const Article = require('../models/Article');
const ArticleView = require('../models/ArticleView');

// Data access only. The batching of views is in back/utils/viewQueue.js.

/**
 * Saves a batch of views in one query: each (article, viewer) pair is inserted if new and left unchanged if it
 * already exists (its first viewedAt is kept). Returns the views that were new.
 */
async function insertNewViews(views) {
  const result = await ArticleView.bulkWrite(
    views.map(({ article, viewer, viewedAt }) => ({
      updateOne: {
        filter: { viewer, article },
        update: { $setOnInsert: { viewedAt } },
        upsert: true,
      },
    })),
    { ordered: false }
  );
  // upsertedIds is keyed by the index of the operation that inserted a document.
  return Object.keys(result.upsertedIds).map((operationIndex) => views[operationIndex]);
}

/** Adds the new view counts to the articles in one query (a Map of article id -> number of new views). */
function incrementViewCounts(newViewCountsByArticle) {
  return Article.bulkWrite(
    [...newViewCountsByArticle].map(([articleId, newViewCount]) => ({
      updateOne: {
        filter: { _id: articleId },
        update: { $inc: { viewCount: newViewCount } },
        timestamps: false, // a view is not a change to the article (the lists sort by updatedAt)
      },
    })),
    { ordered: false }
  );
}

/**
 * The article's unique views per time bucket of binMinutes, oldest first: [{ time, count }]. Buckets without
 * views are left out. Each view counts in the bucket of its first view time.
 */
function findViewTimeline(articleId, binMinutes) {
  return ArticleView.aggregate([
    { $match: { article: articleId } },
    {
      $group: {
        _id: { $dateTrunc: { date: '$viewedAt', unit: 'minute', binSize: binMinutes } },
        count: { $sum: 1 },
      },
    },
    { $sort: { _id: 1 } },
    { $project: { _id: 0, time: '$_id', count: 1 } },
  ]);
}

module.exports = { insertNewViews, incrementViewCounts, findViewTimeline };
