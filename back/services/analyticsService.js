const ArticleViewLog = require('../models/ArticleViewLog');
const articleService = require('./articleService');

const HOUR_IN_MS = 60 * 60 * 1000;
const DAY_IN_MS = 24 * HOUR_IN_MS;

const BucketEnum = Object.freeze({ HOUR: 'hour', DAY: 'day' });

/** The start of the hour (UTC) the date is in. */
const startOfHour = (date) => new Date(Math.floor(date.getTime() / HOUR_IN_MS) * HOUR_IN_MS);

/** The start of the day (UTC) the date is in. */
const startOfDay = (date) => new Date(Math.floor(date.getTime() / DAY_IN_MS) * DAY_IN_MS);

/** Adds one view to the article's bucket of the hour the given time is in. */
function addView(articleId, viewedAt = new Date()) {
  return ArticleViewLog.updateOne(
    { article: articleId, hour: startOfHour(viewedAt) },
    { $inc: { count: 1 } },
    { upsert: true }
  );
}

/** The hourly buckets of the article from `from` (included) to `to` (excluded), oldest first. */
function findHourlyBuckets(articleId, from, to) {
  return ArticleViewLog.find({ article: articleId, hour: { $gte: from, $lt: to } })
    .sort({ hour: 1 })
    .select('hour count -_id')
    .lean();
}

/** Total views of the article in the time range [from, to). */
async function sumViews(articleId, from, to) {
  const [result] = await ArticleViewLog.aggregate([
    { $match: { article: articleId, hour: { $gte: from, $lt: to } } },
    { $group: { _id: null, views: { $sum: '$count' } } },
  ]);
  return result ? result.views : 0;
}

/** Views per time bucket (hour or day), with the empty buckets filled with 0, so the chart has no gaps. */
function toSeries(hourlyBuckets, from, to, bucket) {
  const bucketSize = bucket === BucketEnum.DAY ? DAY_IN_MS : HOUR_IN_MS;
  const first = bucket === BucketEnum.DAY ? startOfDay(from) : startOfHour(from);
  const viewsByStart = new Map();
  for (const { hour, count } of hourlyBuckets) {
    const start = (bucket === BucketEnum.DAY ? startOfDay(hour) : hour).getTime();
    viewsByStart.set(start, (viewsByStart.get(start) || 0) + count);
  }

  const series = [];
  for (let start = first.getTime(); start < to.getTime(); start += bucketSize) {
    series.push({ time: new Date(start), views: viewsByStart.get(start) || 0 });
  }
  return series;
}

/**
 * The data of the Impact Analytics chart: views per bucket over the last `days` days, and every published
 * update with the views in the `windowHours` hours before it and after it (the same length on both sides, so
 * the two numbers can be compared). The window after a recent update is cut at `now`, and then it is not comparable to the window before.
 */
async function getArticleImpact(articleId, { days, bucket, windowHours, now = new Date() }) {
  const to = new Date(startOfHour(now).getTime() + HOUR_IN_MS);
  const from = new Date(to.getTime() - days * DAY_IN_MS);

  const [hourlyBuckets, revisions, totalViews] = await Promise.all([
    findHourlyBuckets(articleId, from, to),
    articleService.findPublishedRevisions(articleId),
    sumViews(articleId, new Date(0), to),
  ]);

  const updates = await Promise.all(
    revisions.map(async ({ publishedAt, approvedBy }) => {
      const windowMs = windowHours * HOUR_IN_MS;
      const after = Math.min(publishedAt.getTime() + windowMs, now.getTime());
      const [viewsBefore, viewsAfter] = await Promise.all([
        sumViews(articleId, new Date(publishedAt.getTime() - windowMs), publishedAt),
        sumViews(articleId, publishedAt, new Date(after)),
      ]);
      return {
        publishedAt,
        approvedBy: approvedBy ? approvedBy.name : null,
        viewsBefore,
        viewsAfter,
        // How many hours the "after" number covers (less than the window for a recent update).
        hoursAfter: Math.max(0, Math.floor((after - publishedAt.getTime()) / HOUR_IN_MS)),
        isAfterWindowComplete: after - publishedAt.getTime() >= windowMs,
      };
    })
  );

  return { from, to, bucket, windowHours, totalViews, series: toSeries(hourlyBuckets, from, to, bucket), updates };
}

module.exports = { BucketEnum, startOfHour, addView, getArticleImpact };
