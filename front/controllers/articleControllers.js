const articleService = require('../../back/services/articleService');
const commentService = require('../../back/services/commentService');
const weatherService = require('../../back/services/weatherService');
const articleValidators = require('../../back/validators/articleValidators');
const { isValidUUID } = require('../../back/validators/sharedValidators');
const { HTTP_STATUS, DEFAULT_PAGE_SIZE } = require('../../back/config/constants');
const { serializeArticlesPage, serializeArticle } =require('../../back/serializers/articleSerializers');
const { serializeArticleComments } = require('../../back/serializers/commentSerializers');
const { getCommentViewer } = require('../../back/utils/commentUtils');

const { ARTICLE_CATEGORIES } = require('../../back/models/Article');
const { COMMENT_TEXT_MAX_LENGTH, GUEST_NAME_MAX_LENGTH } = require('../../back/models/Comment');

const HAS_MORE_HEADER = 'X-Has-More';

/** One page of the public feed, with whether a later page exists. */
async function findFeedPage(pagination, filters) {
  const { articles, total } = await articleService.findPublicArticlePage(pagination, filters);
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

    const { articles, hasMore } = await findFeedPage(pagination, filters);
    res.set(HAS_MORE_HEADER, String(hasMore));
    res.render('partials/feedPage', { articles });
  } catch (err) {
    next(err);
  }
}

/**
 * The article page, server-rendered with the full live article (body included) and its newest comments, for
 * readers and crawlers. Each comment says what this viewer may do with it; older comments load with "load more".
 */
async function renderArticlePage(req, res, next) {
  try {
    const { id } = req.params;
    const article = isValidUUID(id) ? await articleService.findPublicArticleById(id) : null;
    if (!article) return res.status(HTTP_STATUS.NOT_FOUND).type('text').send('Article not found');

    const [commentBatch, commentCount] = await Promise.all([
      commentService.findArticleComments(id, { limit: DEFAULT_PAGE_SIZE }),
      commentService.countArticleComments(id),
    ]);
    const viewer = getCommentViewer(req);
    const { items: comments, nextCursor } = serializeArticleComments(commentBatch, viewer, article.author.id);

    res.render('pages/article', {
      article: serializeArticle(article),
      comments,
      commentCount,
      nextCommentCursor: nextCursor,
      isGuest: viewer.userId === null,
      COMMENT_TEXT_MAX_LENGTH,
      GUEST_NAME_MAX_LENGTH,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { renderHomePage, renderFeedPage, renderArticlePage };
