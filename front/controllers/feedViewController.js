const articleService = require('../../back/services/articleService');
const articleValidators = require('../../back/validators/articleValidators');
const { HTTP_STATUS } = require('../../back/config/constants');
const { serializeArticles } = require('../../back/serializers/articleSerializers');

const HAS_MORE_HEADER = 'X-Has-More';

/** One page of the public feed, with whether a later page exists. */
async function findFeedPage(pagination) {
  const { articles, total } = await articleService.findPublicArticlePage(pagination);
  return {
    articles: serializeArticles(articles),
    hasMore: pagination.page < Math.ceil(total / pagination.limit),
  };
}

/** The home page, with the first page of the feed already rendered into it. */
async function renderHomePage(req, res, next) {
  try {
    const pagination = articleValidators.parsePagination({});
    const { articles, hasMore } = await findFeedPage(pagination);
    res.render('pages/home', { articles, hasMore });
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

module.exports = { renderHomePage, renderFeedPage };
