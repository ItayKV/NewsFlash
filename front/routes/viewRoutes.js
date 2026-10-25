const express = require('express');
const articleControllers = require('../controllers/articleControllers');
const editorController = require('../controllers/editorController');
const { requirePageRole, requireRole } = require('../../back/middleware/rbac');
const { RoleEnum } = require('../../back/models/User');

const router = express.Router();

router.get('/', articleControllers.renderHomePage);
router.get('/feed', articleControllers.renderFeedPage);
router.get('/editor/articles', requireRole(RoleEnum.EDITOR), editorController.renderEditorArticles);
router.get('/editor/articles/:id', requirePageRole(RoleEnum.EDITOR), editorController.renderReviewPage);
router.get('/articles/:id', articleControllers.renderArticlePage);

module.exports = router;
