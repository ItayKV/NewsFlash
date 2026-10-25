const articleViewService = require('../services/articleViewService');
const { logError } = require('../services/activityLogger');
const { MAX_QUEUED_VIEWS, VIEW_FLUSH_INTERVAL_MS } = require('../config/constants');

// Article page visits wait here in memory and are written in bulk (one query for the views, one for the
// article counters), so many visits per minute do not each cost a database write.
// Trade-off: a crash loses the views still waiting (at most one interval of them).

let queuedViews = new Map(); // "articleId:viewer" -> { article, viewer, viewedAt }; a refresh adds nothing
let runningFlush = null; // the flush being written, so two flushes never overlap

/** Queues a visit of the article by the viewer (user id or visitorId). Never touches the database. */
function addView(articleId, viewer) {
  const viewKey = `${articleId}:${viewer}`;
  if (queuedViews.has(viewKey)) return;

  queuedViews.set(viewKey, { article: articleId, viewer, viewedAt: new Date() });
  if (queuedViews.size >= MAX_QUEUED_VIEWS) flushViews();
}

/** Counts the views per article, as a Map of article id -> number of views. */
function countViewsByArticle(views) {
  const viewCountsByArticle = new Map();
  for (const { article } of views) viewCountsByArticle.set(article, (viewCountsByArticle.get(article) || 0) + 1);
  return viewCountsByArticle;
}

/** Writes a batch: the views first, then +1 per really new view on its article. A failure is only logged. */
async function writeViews(views) {
  try {
    const newViews = await articleViewService.insertNewViews(views);
    if (newViews.length > 0) await articleViewService.incrementViewCounts(countViewsByArticle(newViews));
  } catch (err) {
    console.error(`Failed to save ${views.length} queued views:`, err.message);
    logError(`[ERROR] viewQueue.writeViews: failed to save ${views.length} queued views`, null, err);
  }
}

/**
 * Writes the queued views. While a flush is running, new views keep waiting for the next one,
 * and the running flush is returned.
 */
function flushViews() {
  if (runningFlush) return runningFlush;
  if (queuedViews.size === 0) return Promise.resolve();

  const views = [...queuedViews.values()];
  queuedViews = new Map();
  runningFlush = writeViews(views).finally(() => {
    runningFlush = null;
  });
  return runningFlush;
}

/** Starts the periodic flush. The timer does not keep the process alive on its own. */
function startViewFlushTimer() {
  setInterval(flushViews, VIEW_FLUSH_INTERVAL_MS).unref();
}

/** Writes everything still waiting, including views queued during a running flush (for shutdown). */
async function flushAllViews() {
  await runningFlush;
  await flushViews();
}

module.exports = { addView, flushViews, flushAllViews, startViewFlushTimer };
