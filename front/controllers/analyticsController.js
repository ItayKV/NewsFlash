const articleService = require('../../back/services/articleService');
const articleValidators = require('../../back/validators/articleValidators');
const { HTTP_STATUS, DEFAULT_VIEW_BIN_MINUTES } = require('../../back/config/constants');

// The editor's Article Analytics pages: a searchable list of the published articles, and one article's
// views over time (the chart loads them from GET /api/articles/:id/views/timeline).

const HAS_MORE_HEADER = 'X-Has-More';

// The bucket sizes the chart offers, in minutes.
const BIN_OPTIONS = Object.freeze([
  { minutes: 5, label: '5 minutes' },
  { minutes: 15, label: '15 minutes' },
  { minutes: 60, label: '1 hour' },
  { minutes: 24 * 60, label: '1 day' },
]);

/** Turns a lean article into an analytics row: id, live title, author, first publication and total views. */
function toAnalyticsArticle(article) {
  return {
    id: article._id,
    title: article.content?.title || 'Untitled',
    authorName: article.author?.name || null,
    publishedAt: article.publishedAt,
    viewCount: article.viewCount || 0,
  };
}

/** The analytics search page. Its article rows are loaded by the page from GET /editor/analytics/articles. */
function renderAnalyticsPage(req, res) {
  res.render('pages/analytics');
}

/**
 * One page of the analytics rows (published articles, most viewed first, optionally a title or summary search)
 * as ready-made HTML. Whether more pages exist is in a header.
 */
async function renderAnalyticsArticles(req, res, next) {
  try {
    const pagination = articleValidators.parsePagination(req.query);
    if (pagination.error) return res.status(HTTP_STATUS.BAD_REQUEST).type('text').send(pagination.error);

    const filters = articleValidators.parseFeedFilters({ search: req.query.search });
    if (filters.error) return res.status(HTTP_STATUS.BAD_REQUEST).type('text').send(filters.error);

    const { articles, total } = await articleService.findAnalyticsArticlePage(pagination, { search: filters.search });
    res.set(HAS_MORE_HEADER, String(pagination.page < Math.ceil(total / pagination.limit)));
    res.render('partials/analyticsArticleList', { articles: articles.map(toAnalyticsArticle) });
  } catch (err) {
    next(err);
  }
}

/** One article's analytics page: its total views and the chart of its views over time. */
async function renderArticleAnalyticsPage(req, res, next) {
  try {
    const { id } = req.params;
    const article = articleValidators.isValidArticleId(id) ? await articleService.findArticleAnalytics(id) : null;
    if (!article) return res.status(HTTP_STATUS.NOT_FOUND).type('text').send('Article not found');

    res.render('pages/articleAnalytics', {
      article: toAnalyticsArticle(article),
      binOptions: BIN_OPTIONS,
      defaultBinMinutes: DEFAULT_VIEW_BIN_MINUTES,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { renderAnalyticsPage, renderAnalyticsArticles, renderArticleAnalyticsPage };
