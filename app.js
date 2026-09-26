const path = require('path');
const express = require('express');
const sessionMiddleware = require('./back/config/session');
const userRoutes = require('./back/routes/userRoutes');
const { HTTP_STATUS } = require('./back/config/constants');
const { RoleEnum } = require('./back/models/User');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(sessionMiddleware);

// Makes the logged-in user's identity/role, and the role enum, available to
// every EJS view (e.g. the header) without every render() call passing it.
app.use((req, res, next) => {
  res.locals.currentUser = req.session.userId ? { id: req.session.userId, role: req.session.role } : null;
  res.locals.RoleEnum = RoleEnum;
  next();
});

app.get('/', (req, res) => {
  res.render('pages/home');
});

app.get('/login', (req, res) => {
  res.render('pages/login');
});

app.use(userRoutes);

// Minimal JSON error handler (malformed JSON -> 400, otherwise 500).
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Invalid JSON' });
  console.error(err);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
});

module.exports = app;
