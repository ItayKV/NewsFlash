const express = require('express');
const articleControllers = require('../controllers/articleControllers');
const reporterController = require('../controllers/reporterController');
const { requirePageRole, requireRole } = require('../../back/middleware/rbac');
const { RoleEnum } = require('../../back/models/User');

const router = express.Router();

router.get('/', articleControllers.renderHomePage);
router.get('/feed', articleControllers.renderFeedPage);
router.get('/reporter', requirePageRole(RoleEnum.REPORTER), reporterController.renderReporterPage);
router.get('/reporter/articles', requireRole(RoleEnum.REPORTER), reporterController.renderReporterArticles);
router.get('/reporter/articles/new', requirePageRole(RoleEnum.REPORTER), reporterController.renderEditArticlePage);
router.get('/reporter/articles/:id/edit', requirePageRole(RoleEnum.REPORTER), reporterController.renderEditArticlePage);
router.get('/articles/:id', articleControllers.renderArticlePage);

module.exports = router;
