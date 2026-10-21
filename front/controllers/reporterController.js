const userService = require('../../back/services/userService');
const articleController = require('../../back/controllers/articleController');
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

module.exports = { renderReporterPage, renderReporterArticles };
