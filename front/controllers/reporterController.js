const userService = require('../../back/services/userService');
const articleController = require('../../back/controllers/articleController');
const articleValidators = require('../../back/validators/articleValidators');
const { ARTICLE_CATEGORIES } = require('../../back/models/Article');
const { HTTP_STATUS } = require('../../back/config/constants');

/** The reporter's workspace. Their articles are loaded by the page from GET /reporter/articles. */
async function renderReporterPage(req, res, next) {
  try {
    const reporter = await userService.findById(req.session.userId);
    res.render('pages/reporter', { reporterName: reporter.name });
  } catch (err) {
    next(err);
  }
}

/**
 * The edit screen for a new article (no id in the URL) or an existing one. It is a shell: the article is loaded
 * by the page from the API, whose guards enforce ownership and status.
 */
function renderEditArticlePage(req, res) {
  const articleId = req.params.id || null;
  if (articleId && !articleValidators.isValidArticleId(articleId)) return res.redirect('/reporter');

  res.render('pages/editArticle', {
    articleId,
    formDisabled: Boolean(articleId), // an existing article's form stays disabled until the page has loaded it
    categories: ARTICLE_CATEGORIES,
    limits: {
      title: articleValidators.TITLE_MAX_LENGTH,
      summary: articleValidators.SUMMARY_MAX_LENGTH,
      body: articleValidators.BODY_MAX_LENGTH,
    },
  });
}

/**
 * The reporter's article rows as ready-made HTML, for the reporter page to insert. It runs the API handler
 * listReporterArticles with a stand-in response that turns its JSON into the rendered list (or its error into text).
 * The stand-in only supports the response methods that handler uses: status() and json().
 */
async function renderReporterArticles(req, res, next) {
  const apiResponse = {
    statusCode: HTTP_STATUS.OK,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      if (this.statusCode !== HTTP_STATUS.OK) return res.status(this.statusCode).type('text').send(body.error);
      res.render('partials/reporterArticleList', { articles: body.items });
    },
  };

  await articleController.listReporterArticles(req, apiResponse, next);
}

module.exports = { renderReporterPage, renderEditArticlePage, renderReporterArticles };
