const express = require('express');
const controller = require('../controllers/commentController');
const { limitCommentRate } = require('../middleware/rateLimiter');

const router = express.Router();

// Mounted at /api. Reading, adding, editing and deleting are open to guests too; the controller checks who may
// edit and delete each comment. Adding is rate limited (per client and per IP).
router.get('/articles/:articleId/comments', controller.listArticleComments);
router.post('/articles/:articleId/comments', limitCommentRate, controller.createComment);
router.patch('/comments/:id', controller.updateComment);
router.delete('/comments/:id', controller.deleteComment);

module.exports = router;
