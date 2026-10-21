const express = require('express');
const controller = require('../controllers/articleController');
const { requireRole, requireOwnerOrRole } = require('../middleware/rbac');
const { RoleEnum } = require('../models/User');

const router = express.Router();

router.get('/', controller.listPublicArticles);
router.post('/', requireRole(RoleEnum.REPORTER), controller.createArticle);
router.get('/reporter', requireRole(RoleEnum.REPORTER), controller.listReporterArticles);
router.get('/editor', requireRole(RoleEnum.EDITOR), controller.listEditorArticles);
router.get('/:id', requireRole(RoleEnum.EDITOR), controller.getArticleForReview);
router.get('/:id/stats', requireRole(RoleEnum.EDITOR), controller.getArticleImpact);
router.post('/:id/edit', requireOwnerOrRole(RoleEnum.EDITOR), controller.startEditing);
router.patch('/:id/draft', requireOwnerOrRole(RoleEnum.EDITOR), controller.saveDraft);
router.post('/:id/submit', requireOwnerOrRole(RoleEnum.EDITOR), controller.submitForApproval);
router.post('/:id/approve', requireRole(RoleEnum.EDITOR), controller.approveArticle);
router.post('/:id/return', requireRole(RoleEnum.EDITOR), controller.returnForRevision);
router.delete('/:id', requireRole(RoleEnum.EDITOR), controller.deleteArticle);

module.exports = router;
