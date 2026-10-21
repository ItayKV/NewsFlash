const userService = require('../../back/services/userService');
const articleService = require('../../back/services/articleService');
const articleController = require('../../back/controllers/articleController');
const articleValidators = require('../../back/validators/articleValidators');
const { diffTexts } = require('../../back/utils/textDiff');
const { HTTP_STATUS } = require('../../back/config/constants');
const { ArticleStatusEnum, ARTICLE_CATEGORIES, CONTENT_FIELDS } = require('../../back/models/Article');

const HAS_MORE_HEADER = 'X-Has-More';

// The content fields in the order the review page shows them, with their labels.
const REVIEW_FIELDS = Object.freeze([
  { name: 'title', label: 'Title' },
  { name: 'summary', label: 'Summary' },
  { name: 'category', label: 'Category' },
  { name: 'imageUrl', label: 'Image URL' },
  { name: 'body', label: 'Body' },
]);

/** The editor's review queue. Its article rows are loaded by the page from GET /editor/articles. */
async function renderEditorPage(req, res, next) {
  try {
    const editor = await userService.findById(req.session.userId);
    res.render('pages/editor', { editorName: editor.name });
  } catch (err) {
    next(err);
  }
}

/**
 * One page of the editor's article rows (optionally one status, or a title search) as ready-made HTML, for the
 * editor pages to insert. Like the reporter's list, it runs the API handler listEditorArticles with a stand-in
 * response that turns its JSON into the rendered list (or its error into text). Whether more pages exist is in
 * a header. The stand-in only supports the response methods that handler uses: status() and json().
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

const notFound = (res) => res.status(HTTP_STATUS.NOT_FOUND).type('text').send('Article not found');

/** One content field of the live version and of the draft, compared (the text is '' when the field is empty). */
function compareField({ name, label }, publishedContent, draftContent) {
  const publishedText = publishedContent?.[name] || '';
  const draftText = draftContent?.[name] || '';
  return { label, isChanged: publishedText !== draftText, ...diffTexts(publishedText, draftText) };
}

/**
 * The review page of one article: its status and editor notes, the live version next to the draft with the
 * differences marked, the history of published versions, and the editor's actions.
 */
async function renderReviewPage(req, res, next) {
  try {
    const article = articleValidators.isValidArticleId(req.params.id)
      ? await articleService.findArticleById(req.params.id)
      : null;
    if (!article) return notFound(res);

    const [draftRevision, revisions] = await Promise.all([
      articleService.findDraftRevision(article.id),
      articleService.findPublishedRevisions(article.id),
    ]);
    const publishedContent = article.content ? article.content.toObject() : null;
    const draftContent = draftRevision ? draftRevision.content.toObject() : null;
    const isNew = !publishedContent;

    res.render('pages/editorReview', {
      article: article.toJSON(),
      title: draftContent?.title || publishedContent?.title || 'Untitled',
      isNew,
      hasDraft: Boolean(draftContent),
      fields: draftContent ? REVIEW_FIELDS.map((field) => compareField(field, publishedContent, draftContent)) : [],
      publishedFields: draftContent ? [] : REVIEW_FIELDS.map((field) => ({ label: field.label, text: publishedContent?.[field.name] || '' })),
      revisions,
      ArticleStatusEnum,
      canEdit: article.status !== ArticleStatusEnum.PUBLISHED,
    });
  } catch (err) {
    next(err);
  }
}

/** The page where an editor edits the draft of an article. The page loads and auto-saves the draft by itself. */
async function renderEditPage(req, res, next) {
  try {
    const article = articleValidators.isValidArticleId(req.params.id)
      ? await articleService.findArticleById(req.params.id)
      : null;
    if (!article) return notFound(res);

    // A published article has no draft. Starting an update would change its status, so it is not done from here.
    if (article.status === ArticleStatusEnum.PUBLISHED) return res.redirect(`/editor/articles/${article.id}`);

    res.render('pages/editorEdit', { articleId: article.id, categories: ARTICLE_CATEGORIES, CONTENT_FIELDS });
  } catch (err) {
    next(err);
  }
}

module.exports = { renderEditorPage, renderEditorArticles, renderReviewPage, renderEditPage };
