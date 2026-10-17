const express = require('express');
const controller = require('../controllers/articleController');
const { requireRole, requireOwnerOrRole } = require('../middleware/rbac');
const { RoleEnum } = require('../models/User');

// Mounted at /api/articles in app.js.
const router = express.Router();

router.post('/', requireRole(RoleEnum.REPORTER), controller.createArticle);
// Before the /:id routes, so "my-articles" is not read as an id.
router.get('/my-articles', requireRole(RoleEnum.REPORTER), controller.listReporterArticles);
router.get('/', requireRole(RoleEnum.EDITOR), controller.listEditorArticles);
// An editor, or the reporter who created the article.
router.post('/:id/edit', requireOwnerOrRole(RoleEnum.EDITOR), controller.startEditing);
router.patch('/:id/draft', requireOwnerOrRole(RoleEnum.EDITOR), controller.saveDraft);
router.post('/:id/submit', requireOwnerOrRole(RoleEnum.EDITOR), controller.submitForApproval);
router.post('/:id/approve', requireRole(RoleEnum.EDITOR), controller.approveArticle);
router.post('/:id/return', requireRole(RoleEnum.EDITOR), controller.returnForRevision);
router.delete('/:id', requireRole(RoleEnum.EDITOR), controller.deleteArticle);

module.exports = router;
