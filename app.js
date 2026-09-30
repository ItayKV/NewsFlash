const path = require('path');
const express = require('express');
const sessionMiddleware = require('./back/config/session');
const userRoutes = require('./back/routes/userRoutes');
const apiRoutes = require('./back/routes/apiRoutes');
const userService = require('./back/services/userService');
const weatherService = require('./back/services/weatherService');
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
  const weather = weatherService.getCurrentWeather();
  res.render('pages/home', { weather });
});

app.get('/login', (req, res) => {
  res.render('pages/login');
});

// Guards a page route to a single role: sends guests to /login and
// wrong-role users to /, without exposing the page markup to either.
function requirePageRole(role) {
  return (req, res, next) => {
    if (!req.session.userId) return res.redirect('/login');
    if (req.session.role !== role) return res.redirect('/');
    next();
  };
}

app.get('/reporter', requirePageRole(RoleEnum.REPORTER), async (req, res, next) => {
  try {
    const reporter = await userService.findById(req.session.userId);
    res.render('pages/reporter', { reporterName: reporter.name });
  } catch (err) {
    next(err);
  }
});

// TODO: replace with a real lookup of this reporter's articles once the Article model exists.
app.get('/reporter/articles', requirePageRole(RoleEnum.REPORTER), (req, res) => {
  const dummyArticles = [
    { title: 'City Council Approves New Park Budget', status: 'published' },
    { title: 'Local Startup Raises Series A Funding', status: 'pending_approval' },
    { title: 'Weather Patterns Shift Ahead of Fall', status: 'in_progress' },
    { title: 'School District Announces Budget Cuts', status: 'returned_for_revision' },
  ];
  res.render('partials/reporterArticleList', { articles: dummyArticles });
});

app.get('/editor', requirePageRole(RoleEnum.EDITOR), async (req, res, next) => {
  try {
    const editor = await userService.findById(req.session.userId);
    res.render('pages/editor', { editorName: editor.name });
  } catch (err) {
    next(err);
  }
});

// TODO: replace with a real lookup of articles pending review once the Article model exists.
app.get('/editor/articles', requirePageRole(RoleEnum.EDITOR), (req, res) => {
  const dummyArticles = [
    { title: 'Local Startup Raises Series A Funding', status: 'pending_approval', reporterName: 'Dana Cohen' },
    { title: 'Downtown Traffic Study Released', status: 'pending_approval', reporterName: 'Omer Levi' },
    { title: 'School District Announces Budget Cuts', status: 'returned_for_revision', reporterName: 'Maya Ron' },
  ];
  res.render('partials/editorArticleList', { articles: dummyArticles });
});

app.use(userRoutes);
app.use(apiRoutes);

// Minimal JSON error handler (malformed JSON -> 400, otherwise 500).
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Invalid JSON' });
  console.error(err);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
});

module.exports = app;
