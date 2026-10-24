const articleService = require('../../back/services/articleService');
const weatherService = require('../../back/services/weatherService');
const viewQueue = require('../../back/utils/viewQueue');
const articleValidators = require('../../back/validators/articleValidators');
const { HTTP_STATUS } = require('../../back/config/constants');
const { serializeArticlesPage, serializeArticle } =require('../../back/serializers/articleSerializers');

const { ARTICLE_CATEGORIES } = require('../../back/models/Article');

const { ViewedFilterEnum } = articleValidators;

const HAS_MORE_HEADER = 'X-Has-More';

/** Who is viewing, for unique views: the logged-in user's id, else the visitor cookie. */
const getViewerId = (req) => req.session.userId || req.visitorId;

/**
 * One page of the public feed, with whether a later page exists. The viewed filter keeps only (or leaves out)
 * the articles this viewer has viewed. Views still waiting in the queue are not seen yet (up to a minute).
 */
async function findFeedPage(pagination, { viewed = null, ...queryFilters } = {}, viewerId = null) {
  // viewed is 'viewed', 'unviewed', or null for no filter (see parseFeedFilters).
  if (viewed !== null) {
    queryFilters.viewerId = viewerId;
    queryFilters.hasViewed = viewed === ViewedFilterEnum.VIEWED;
  }
  const { articles, total } = await articleService.findPublicArticlePage(pagination, queryFilters);
  return {
    articles: serializeArticlesPage(articles),
    hasMore: pagination.page < Math.ceil(total / pagination.limit),
  };
}

/** The home page, with the first page of the feed already rendered into it. */
async function renderHomePage(req, res, next) {
  try {
    const pagination = articleValidators.parsePagination({});
    const { articles, hasMore } = await findFeedPage(pagination);
    const weather = weatherService.getCurrentWeather();
    res.render('pages/home', { articles, hasMore, categories: ARTICLE_CATEGORIES, weather });
  } catch (err) {
    next(err);
  }
}

/** One page of feed cards as ready-made HTML, for the infinite scroll. Whether more pages exist is in a header. */
async function renderFeedPage(req, res, next) {
  try {
    const pagination = articleValidators.parsePagination(req.query);
    if (pagination.error) return res.status(HTTP_STATUS.BAD_REQUEST).type('text').send(pagination.error);

    const filters = articleValidators.parseFeedFilters(req.query);
    if (filters.error) return res.status(HTTP_STATUS.BAD_REQUEST).type('text').send(filters.error);

    const { articles, hasMore } = await findFeedPage(pagination, filters, getViewerId(req));
    res.set(HAS_MORE_HEADER, String(hasMore));
    res.render('partials/feedPage', { articles });
  } catch (err) {
    next(err);
  }
}

/** The article page, server-rendered with the full live article (body included) for readers and crawlers. */
async function renderArticlePage(req, res, next) {
  try {
    const { id } = req.params;
    const article = articleValidators.isValidArticleId(id) ? await articleService.findPublicArticleById(id) : null;
    if (!article) return res.status(HTTP_STATUS.NOT_FOUND).type('text').send('Article not found');

    // A unique view per viewer. Queued, written later in bulk.
    viewQueue.addView(article._id, getViewerId(req));

    res.render('pages/article', { article: serializeArticle(article) });
  } catch (err) {
    next(err);
  }
}

module.exports = { renderHomePage, renderFeedPage, renderArticlePage };
