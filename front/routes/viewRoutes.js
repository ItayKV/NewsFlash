const express = require('express');
const articleControllers = require('../controllers/articleControllers');
const reporterController = require('../controllers/reporterController');
const editorController = require('../controllers/editorController');
const { requirePageRole, requireRole } = require('../../back/middleware/rbac');
const { RoleEnum } = require('../../back/models/User');

const router = express.Router();

router.get('/', articleControllers.renderHomePage);
router.get('/feed', articleControllers.renderFeedPage);
router.get('/reporter', requirePageRole(RoleEnum.REPORTER), reporterController.renderReporterPage);
router.get('/reporter/articles', requireRole(RoleEnum.REPORTER), reporterController.renderReporterArticles);
router.get('/editor', requirePageRole(RoleEnum.EDITOR), editorController.renderEditorPage);
router.get('/editor/articles', requireRole(RoleEnum.EDITOR), editorController.renderEditorArticles);
router.get('/editor/stats', requirePageRole(RoleEnum.EDITOR), editorController.renderStatsPage);
router.get('/editor/articles/:id', requirePageRole(RoleEnum.EDITOR), editorController.renderReviewPage);
router.get('/editor/articles/:id/edit', requirePageRole(RoleEnum.EDITOR), editorController.renderEditPage);
router.get('/articles/:id', articleControllers.renderArticlePage);

module.exports = router;
