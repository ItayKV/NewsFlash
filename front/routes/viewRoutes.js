const express = require('express');
const articleControllers = require('../controllers/articleControllers');
const reporterController = require('../controllers/reporterController');
const editorController = require('../controllers/editorController');
const analyticsController = require('../controllers/analyticsController');
const { requirePageRole, requireRole } = require('../../back/middleware/rbac');
const { RoleEnum } = require('../../back/models/User');

const router = express.Router();

router.get('/', articleControllers.renderHomePage);
router.get('/feed', articleControllers.renderFeedPage);
router.get('/reporter', requirePageRole(RoleEnum.REPORTER), reporterController.renderReporterPage);
router.get('/reporter/articles', requireRole(RoleEnum.REPORTER), reporterController.renderReporterArticles);
router.get('/reporter/articles/new', requirePageRole(RoleEnum.REPORTER), reporterController.renderEditArticlePage);
// Editors reach the same edit screen from the review page; the API guards enforce who may edit what.
router.get('/reporter/articles/:id/edit', requirePageRole(RoleEnum.REPORTER, RoleEnum.EDITOR), reporterController.renderEditArticlePage);
router.get('/reporter/articles/:id/view', requirePageRole(RoleEnum.REPORTER), reporterController.renderDraftPage);
router.get('/editor/articles', requireRole(RoleEnum.EDITOR), editorController.renderEditorArticles);
router.get('/editor/articles/:id', requirePageRole(RoleEnum.EDITOR), editorController.renderReviewPage);
router.get('/editor/analytics', requirePageRole(RoleEnum.EDITOR), analyticsController.renderAnalyticsPage);
router.get('/editor/analytics/articles', requireRole(RoleEnum.EDITOR), analyticsController.renderAnalyticsArticles);
router.get('/editor/analytics/:id', requirePageRole(RoleEnum.EDITOR), analyticsController.renderArticleAnalyticsPage);
router.get('/articles/:id', articleControllers.renderArticlePage);

module.exports = router;
