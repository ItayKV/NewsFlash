const express = require('express');
const controller = require('../controllers/userController');
const { requireRole, requireSelfOrRole, RoleEnum } = require('../middleware/rbac');

const router = express.Router();

router.post('/user/signup', controller.signup);
router.post('/user/login', controller.login);
router.post('/user/logout', controller.logout);
router.delete('/user/:user_id', requireRole(RoleEnum.EDITOR), controller.deleteUser);
router.put('/user/:user_id', controller.updateUser);
router.get('/users', requireRole(RoleEnum.EDITOR), controller.listUsers);
router.get('/users/:user_id', requireSelfOrRole('user_id', RoleEnum.EDITOR), controller.getUser);

module.exports = router;
