const articleService = require('../../back/services/articleService');
const weatherService = require('../../back/services/weatherService');
const articleValidators = require('../../back/validators/articleValidators');
const { HTTP_STATUS } = require('../../back/config/constants');
const { serializeArticlesPage, serializeArticle } =require('../../back/serializers/articleSerializers');

const HAS_MORE_HEADER = 'X-Has-More';

/** One page of the public feed, with whether a later page exists. */
async function findFeedPage(pagination) {
  const { articles, total } = await articleService.findPublicArticlePage(pagination);
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
    res.render('pages/home', { articles, hasMore, weather });
  } catch (err) {
    next(err);
  }
}

/** One page of feed cards as ready-made HTML, for the infinite scroll. Whether more pages exist is in a header. */
async function renderFeedPage(req, res, next) {
  try {
    const pagination = articleValidators.parsePagination(req.query);
    if (pagination.error) return res.status(HTTP_STATUS.BAD_REQUEST).type('text').send(pagination.error);

    const { articles, hasMore } = await findFeedPage(pagination);
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

    res.render('pages/article', { article: serializeArticle(article) });
  } catch (err) {
    next(err);
  }
}

module.exports = { renderHomePage, renderFeedPage, renderArticlePage };
