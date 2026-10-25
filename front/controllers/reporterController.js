const userService = require('../../back/services/userService');
const articleService = require('../../back/services/articleService');
const articleController = require('../../back/controllers/articleController');
const articleValidators = require('../../back/validators/articleValidators');
const { serializeDraft } = require('../../back/serializers/articleSerializers');
const { presentableStatus } = require('../../back/utils/articleUtils');
const { ARTICLE_CATEGORIES, ArticleStatusEnum, REQUIRED_FIELDS, FIELD_LABELS } = require('../../back/models/Article');
const { HTTP_STATUS } = require('../../back/config/constants');
const { renderErrorPage } = require('./errorController');

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
 * by the page from the API, whose guards enforce ownership and status. The reporter's own article that is
 * pending approval is locked, so they are sent to the read-only view of its draft instead.
 */
async function renderEditArticlePage(req, res, next) {
  try {
    const articleId = req.params.id || null;
    if (articleId && !articleValidators.isValidArticleId(articleId)) return res.redirect('/reporter');

    if (articleId) {
      const article = await articleService.findArticleById(articleId);
      const isOwnPending = article?.author.id === req.session.userId && article.status === ArticleStatusEnum.PENDING_APPROVAL;
      if (isOwnPending) return res.redirect(`/reporter/articles/${articleId}/view`);
    }

    res.render('pages/editArticle', {
      articleId,
      formDisabled: Boolean(articleId), // an existing article's form stays disabled until the page has loaded it
      categories: ARTICLE_CATEGORIES,
      requiredFields: REQUIRED_FIELDS, // the same list the server checks on submit, so the form marks exactly these
      fieldLabels: FIELD_LABELS,
      limits: {
        title: articleValidators.TITLE_MAX_LENGTH,
        summary: articleValidators.SUMMARY_MAX_LENGTH,
        body: articleValidators.BODY_MAX_LENGTH,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * The read-only view of the reporter's own article draft: the same article page as the public one, filled with
 * the draft instead of the live content.
 */
async function renderDraftPage(req, res, next) {
  try {
    const { id } = req.params;
    const article = articleValidators.isValidArticleId(id) ? await articleService.findArticleById(id) : null;
    if (!article || article.author.id !== req.session.userId) {
      return renderErrorPage(res, HTTP_STATUS.NOT_FOUND, 'Article not found');
    }

    const draftRevision = await articleService.findDraftRevision(article.id);
    if (!draftRevision) return renderErrorPage(res, HTTP_STATUS.NOT_FOUND, 'Draft not found');

    res.render('pages/article', {
      article: serializeDraft(article, draftRevision),
      backHref: '/reporter',
      backLabel: 'Back to my articles',
      notice: `This is your draft. The article is ${presentableStatus(article.status)}.`,
    });
  } catch (err) {
    next(err);
  }
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

module.exports = { renderReporterPage, renderEditArticlePage, renderDraftPage, renderReporterArticles };
