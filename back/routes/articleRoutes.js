const express = require('express');
const controller = require('../controllers/articleController');
const { requireRole } = require('../middleware/rbac');
const { RoleEnum } = require('../models/User');

// Mounted at /api/articles in app.js.
const router = express.Router();

router.post('/', requireRole(RoleEnum.REPORTER), controller.createArticle);
// Defined before the /:id routes so "mine" is never read as an article id.
router.get('/mine', requireRole(RoleEnum.REPORTER), controller.listReporterArticles);
router.get('/', requireRole(RoleEnum.EDITOR), controller.listEditorArticles);
router.get('/:id/edit', requireRole(RoleEnum.REPORTER, RoleEnum.EDITOR), controller.getArticleForEditing);
router.patch('/:id/draft', requireRole(RoleEnum.REPORTER, RoleEnum.EDITOR), controller.saveDraft);
router.post('/:id/submit', requireRole(RoleEnum.REPORTER), controller.submitForApproval);
router.post('/:id/approve', requireRole(RoleEnum.EDITOR), controller.approveArticle);
router.post('/:id/return', requireRole(RoleEnum.EDITOR), controller.returnForRevision);
router.delete('/:id', requireRole(RoleEnum.EDITOR), controller.deleteArticle);

module.exports = router;
