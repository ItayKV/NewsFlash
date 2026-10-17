const express = require('express');
const feedViewController = require('../controllers/feedViewController');

const router = express.Router();

router.get('/', feedViewController.renderHomePage);
router.get('/feed', feedViewController.renderFeedPage);

module.exports = router;
