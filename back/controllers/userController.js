const userService = require('../services/userService');
const { HTTP_STATUS, MONGO_DUPLICATE_KEY_ERROR } = require('../config/constants');
const userValidators = require('../validators/userValidators');

// TODO: replace with real authentication/authorization once the auth task lands.
const isAdmin = () => true;

const invalidResponse = (res, message) => res.status(HTTP_STATUS.BAD_REQUEST).json({ error: message });

async function addUser(req, res, next) {
  try {
    const { role, name, email, password } = req.body || {};
    if (!userValidators.isValidRole(role)) return invalidResponse(res, 'Invalid role');
    if (!userValidators.isValidName(name)) return invalidResponse(res, 'Invalid name');
    if (!userValidators.isValidEmail(email)) return invalidResponse(res, 'Invalid email');
    if (!userValidators.isValidPassword(password)) {
      return invalidResponse(
        res,
        'Password must be at least 8 characters with a number, an english letter and a special mark'
      );
    }
    if (!(await userValidators.isEmailUnique(email))) return invalidResponse(res, 'Email already exists');

    const user = await userService.addUser({ role, name, email, password });
    res.status(HTTP_STATUS.CREATED).json({ id: user.id });
  } catch (err) {
    if (err.code === MONGO_DUPLICATE_KEY_ERROR) return invalidResponse(res, 'Email already exists');
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, password } = req.body || {};
    if (!userValidators.isValidEmail(email)) return invalidResponse(res, 'Invalid email');
    if (!userValidators.isSafePassword(password)) return invalidResponse(res, 'Invalid password');

    const user = await userService.login(email, password);
    if (!user) return res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Wrong email or password' });
    res.status(HTTP_STATUS.OK).json(user);
  } catch (err) {
    next(err);
  }
}

async function deleteUser(req, res, next) {
  try {
    const user = await userService.findById(req.params.user_id);
    if (!user) return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'User not found' });
    // Later: allow only admin or the user deleting their own account.
    if (!isAdmin()) return res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Not permitted' });

    await userService.deleteById(user.id);
    res.status(HTTP_STATUS.OK).json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const { old_password, new_password, name, role } = req.body || {};
    if (!userValidators.isSafePassword(old_password)) return invalidResponse(res, 'Invalid password');

    // Authenticate first; a missing user and a wrong password look the same.
    const user = await userService.findById(req.params.user_id);
    if (!user || !(await userService.verifyPassword(user, old_password))) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Unauthenticated' });
    }

    if (new_password != null && !userValidators.isValidPassword(new_password)) {
      return invalidResponse(res, 'Invalid new password');
    }
    if (name != null && !userValidators.isValidName(name)) return invalidResponse(res, 'Invalid name');
    if (role != null && !userValidators.isValidRole(role)) return invalidResponse(res, 'Invalid role');

    const updated = await userService.update(user, {
      password: new_password,
      name,
      role,
    });
    res.status(HTTP_STATUS.OK).json(updated);
  } catch (err) {
    next(err);
  }
}

async function listUsers(req, res, next) {
  try {
    if (!isAdmin()) return res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Not permitted' });
    res.status(HTTP_STATUS.OK).json(await userService.listAll());
  } catch (err) {
    next(err);
  }
}

async function getUser(req, res, next) {
  try {
    if (!isAdmin()) return res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Not permitted' });
    const user = await userService.findById(req.params.user_id);
    if (!user) return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'User not found' });
    res.status(HTTP_STATUS.OK).json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = { addUser, login, deleteUser, updateUser, listUsers, getUser };
