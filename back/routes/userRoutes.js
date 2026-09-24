const express = require('express');
const controller = require('../controllers/userController');

const router = express.Router();

router.post('/user/signup', controller.signup);
router.post('/user/login', controller.login);
router.delete('/user/:user_id', controller.deleteUser);
router.put('/user/:user_id', controller.updateUser);
router.get('/users', controller.listUsers);
router.get('/users/:user_id', controller.getUser);

module.exports = router;
