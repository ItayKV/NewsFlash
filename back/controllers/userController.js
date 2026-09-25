const userService = require('../services/userService');
const { HTTP_STATUS, MONGO_DUPLICATE_KEY_ERROR } = require('../config/constants');
const userValidators = require('../validators/userValidators');

const invalidResponse = (res, message) => res.status(HTTP_STATUS.BAD_REQUEST).json({ error: message });

async function signup(req, res, next) {
  try {
    const { role, name, email, hash_password } = req.body || {};
    if (!userValidators.isValidRole(role)) return invalidResponse(res, 'Invalid role');
    if (!userValidators.isValidName(name)) return invalidResponse(res, 'Invalid name');
    if (!userValidators.isValidEmail(email)) return invalidResponse(res, 'Invalid email');
    if (!userValidators.isValidPassword(hash_password)) {
      return invalidResponse(
        res,
        'Password must be at least 8 characters with a number, an english letter and a special mark'
      );
    }
    if (!(await userValidators.isEmailUnique(email))) return invalidResponse(res, 'Email already exists');

    const user = await userService.signup({ role, name, email, hash_password });
    res.status(HTTP_STATUS.CREATED).json({ id: user.id });
  } catch (err) {
    if (err.code === MONGO_DUPLICATE_KEY_ERROR) return invalidResponse(res, 'Email already exists');
    next(err);
  }
}

async function login(req, res, next) {
  try {
    const { email, hash_password } = req.body || {};
    if (!userValidators.isValidEmail(email)) return invalidResponse(res, 'Invalid email');
    if (!userValidators.isSafePassword(hash_password)) return invalidResponse(res, 'Invalid password');

    const user = await userService.login(email, hash_password);
    if (!user) return res.status(HTTP_STATUS.UNAUTHORIZED).json({ error: 'Wrong email or password' });

    // Regenerate the session id on login to prevent session fixation.
    // The stored role is what RBAC middleware checks on later requests.
    req.session.regenerate((err) => {
      if (err) return next(err);
      req.session.userId = user.id;
      req.session.role = user.role;
      res.status(HTTP_STATUS.OK).json(user);
    });
  } catch (err) {
    next(err);
  }
}

function logout(req, res, next) {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie('connect.sid');
    res.status(HTTP_STATUS.OK).json({ message: 'Logged out' });
  });
}

async function deleteUser(req, res, next) {
  try {
    const user = await userService.findById(req.params.user_id);
    if (!user) return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'User not found' });

    await userService.deleteById(user.id);
    res.status(HTTP_STATUS.OK).json({ message: 'User deleted' });
  } catch (err) {
    next(err);
  }
}

async function updateUser(req, res, next) {
  try {
    const { old_hashed_password, new_hashed_password, name, role } = req.body || {};
    if (!userValidators.isSafePassword(old_hashed_password)) return invalidResponse(res, 'Invalid password');

    // Authenticate first; a missing user and a wrong password look the same.
    const user = await userService.findById(req.params.user_id);
    if (!user || !(await userService.verifyPassword(user, old_hashed_password))) {
      return res.status(HTTP_STATUS.FORBIDDEN).json({ error: 'Unauthenticated' });
    }

    if (new_hashed_password != null && !userValidators.isValidPassword(new_hashed_password)) {
      return invalidResponse(res, 'Invalid new password');
    }
    if (name != null && !userValidators.isValidName(name)) return invalidResponse(res, 'Invalid name');
    if (role != null && !userValidators.isValidRole(role)) return invalidResponse(res, 'Invalid role');

    const updated = await userService.update(user, {
      password: new_hashed_password,
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
    res.status(HTTP_STATUS.OK).json(await userService.listAll());
  } catch (err) {
    next(err);
  }
}

async function getUser(req, res, next) {
  try {
    const user = await userService.findById(req.params.user_id);
    if (!user) return res.status(HTTP_STATUS.NOT_FOUND).json({ error: 'User not found' });
    res.status(HTTP_STATUS.OK).json(user);
  } catch (err) {
    next(err);
  }
}

module.exports = { signup, login, logout, deleteUser, updateUser, listUsers, getUser };
