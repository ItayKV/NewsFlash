const ArticleViewLog = require('../models/ArticleViewLog');
const ArticleHourlyViews = require('../models/ArticleHourlyViews');
const { MONGO_DUPLICATE_KEY_ERROR } = require('../config/constants');

const HOUR_IN_MS = 60 * 60 * 1000;

/** The start of the hour (UTC) the date is in. */
const startOfHour = (date) => new Date(Math.floor(date.getTime() / HOUR_IN_MS) * HOUR_IN_MS);

/**
 * Registers that the viewer opened the article. A viewer is counted once per article: the first view is saved in
 * ArticleViewLog and added to the counter of its hour; later views by the same viewer change nothing.
 * Returns true when this was the viewer's first view of the article, false otherwise.
 * The two writes are not one transaction (it would make every reader wait for the same counter): if the second
 * one fails, the view is still in ArticleViewLog and only missing from the chart.
 */
async function recordView(articleId, viewerId, viewedAt = new Date()) {
  let saved;
  try {
    saved = await ArticleViewLog.updateOne(
      { viewerId, article: articleId },
      { $setOnInsert: { viewedAt } },
      { upsert: true }
    );
  } catch (err) {
    // The same viewer's first two requests arrived together: the other one is counting this view.
    if (err.code === MONGO_DUPLICATE_KEY_ERROR) return false;
    throw err;
  }
  if (saved.upsertedCount === 0) return false;

  await ArticleHourlyViews.updateOne(
    { article: articleId, hour: startOfHour(viewedAt) },
    { $inc: { count: 1 } },
    { upsert: true }
  );
  return true;
}

module.exports = { HOUR_IN_MS, startOfHour, recordView };
