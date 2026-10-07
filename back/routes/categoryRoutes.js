const express = require('express');
const controller = require('../controllers/categoryController');
const { requireRole } = require('../middleware/rbac');
const { RoleEnum } = require('../models/User');

// Mounted at /api/categories in app.js.
const router = express.Router();

router.get('/', controller.listCategories); // public: no login needed
router.post('/', requireRole(RoleEnum.EDITOR), controller.createCategory);
router.put('/:id', requireRole(RoleEnum.EDITOR), controller.renameCategory);
router.delete('/:id', requireRole(RoleEnum.EDITOR), controller.deleteCategory);

module.exports = router;
