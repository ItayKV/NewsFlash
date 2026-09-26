const express = require('express');
const controller = require('../controllers/userController');

const router = express.Router();

router.post('/users/add', controller.addUser);
router.post('/users/login', controller.login);
router.delete('/users/:user_id', controller.deleteUser);
router.put('/users/:user_id', controller.updateUser);
router.get('/users', controller.listUsers);
router.get('/users/:user_id', controller.getUser);

module.exports = router;
