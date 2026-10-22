const express = require('express');
const controller = require('../controllers/commentController');
const { requireRole } = require('../middleware/rbac');
const { limitCommentRate } = require('../middleware/rateLimiter');
const { RoleEnum } = require('../models/User');

const router = express.Router();

// Mounted at /api. Reading, adding and deleting are open to guests too; the controller checks who may delete
// each comment. Editing needs a login (a guest can never edit), and the controller checks it is the writer.
// Adding is rate limited (per client and per IP).
router.get('/articles/:articleId/comments', controller.listArticleComments);
router.post('/articles/:articleId/comments', limitCommentRate, controller.createComment);
router.get('/comments', controller.searchComments);
router.get('/comments/:id', controller.getComment);
router.patch('/comments/:id', requireRole(RoleEnum.EDITOR, RoleEnum.REPORTER), controller.updateComment);
router.delete('/comments/:id', controller.deleteComment);

module.exports = router;
