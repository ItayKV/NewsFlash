const articleService = require('../../back/services/articleService');
const articleController = require('../../back/controllers/articleController');
const articleValidators = require('../../back/validators/articleValidators');
const { HTTP_STATUS } = require('../../back/config/constants');
const { ArticleStatusEnum } = require('../../back/models/Article');

const HAS_MORE_HEADER = 'X-Has-More';

// The content fields in the order the review page shows them, with their labels.
const REVIEW_FIELDS = Object.freeze([
  { name: 'title', label: 'Title' },
  { name: 'summary', label: 'Summary' },
  { name: 'category', label: 'Category' },
  { name: 'imageUrl', label: 'Image URL' },
  { name: 'body', label: 'Body' },
]);

/**
 * One page of the editor's article rows (optionally one status) as ready-made HTML, for the editor page to
 * insert. Like the reporter's list, it runs the API handler listEditorArticles with a stand-in response that
 * turns its JSON into the rendered list (or its error into text). Whether more pages exist is in a header.
 * The stand-in only supports the response methods that handler uses: status() and json().
 */
async function renderEditorArticles(req, res, next) {
  const apiResponse = {
    statusCode: HTTP_STATUS.OK,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      if (this.statusCode !== HTTP_STATUS.OK) return res.status(this.statusCode).type('text').send(body.error);
      res.set(HAS_MORE_HEADER, String(body.page < body.totalPages));
      res.render('partials/editorArticleList', { articles: body.items });
    },
  };

  await articleController.listEditorArticles(req, apiResponse, next);
}

/** One content field of the live version next to the same field of the draft. */
function compareField({ name, label }, liveContent, draftContent) {
  const liveText = liveContent?.[name] || '';
  const draftText = draftContent?.[name] || '';
  return { label, liveText, draftText, isChanged: liveText !== draftText };
}

/**
 * The review page of one article: its status and editor notes, the live version next to the draft (the
 * changed fields are marked), the history of published versions, and the editor's actions.
 */
async function renderReviewPage(req, res, next) {
  try {
    const article = articleValidators.isValidArticleId(req.params.id)
      ? await articleService.findArticleById(req.params.id)
      : null;
    if (!article) return res.status(HTTP_STATUS.NOT_FOUND).type('text').send('Article not found');

    const [draftRevision, revisions] = await Promise.all([
      articleService.findDraftRevision(article.id),
      articleService.findPublishedRevisions(article.id),
    ]);
    const liveContent = article.content ? article.content.toObject() : null;
    const draftContent = draftRevision ? draftRevision.content.toObject() : null;

    res.render('pages/editorReview', {
      article: article.toJSON(),
      title: draftContent?.title || liveContent?.title || 'Untitled',
      isNew: !liveContent,
      hasDraft: Boolean(draftContent),
      // A published article has no draft: its live version is shown on both sides, so nothing is marked.
      fields: REVIEW_FIELDS.map((field) => compareField(field, liveContent, draftContent || liveContent)),
      revisions,
      ArticleStatusEnum,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { renderEditorArticles, renderReviewPage };
