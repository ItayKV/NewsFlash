const express = require('express');
const articleControllers = require('../controllers/articleControllers');

const router = express.Router();

router.get('/', articleControllers.renderHomePage);
router.get('/feed', articleControllers.renderFeedPage);
router.get('/articles/:id', articleControllers.renderArticlePage);

module.exports = router;
