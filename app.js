const path = require('path');
const express = require('express');
const cookieParser = require('cookie-parser');
const { visitorAuthenticationMiddleware } = require('./back/middleware/visitorAuthentication');
const { sessionMiddleware } = require('./back/config/session');
const viewRoutes = require('./front/routes/viewRoutes');
const userRoutes = require('./back/routes/userRoutes');
const articleRoutes = require('./back/routes/articleRoutes');
const commentRoutes = require('./back/routes/commentRoutes');
const weatherRoutes = require('./back/routes/weatherRoutes');
const userService = require('./back/services/userService');
const { HTTP_STATUS } = require('./back/config/constants');
const { RoleEnum } = require('./back/models/User');
const { ArticleStatusEnum } = require('./back/models/Article');
const { requirePageRole } = require('./back/middleware/rbac');
const { logError } = require('./back/services/activityLogger');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));
app.use(sessionMiddleware);
app.use(cookieParser(process.env.COOKIE_SECRET));
app.use(visitorAuthenticationMiddleware);

// Makes the logged-in user's identity/role, and the role enum, available to
// every EJS view (e.g. the header) without every render() call passing it.
app.use((req, res, next) => {
  res.locals.currentUser = req.session.userId ? { id: req.session.userId, role: req.session.role } : null;
  res.locals.RoleEnum = RoleEnum;
  res.locals.ArticleStatusEnum = ArticleStatusEnum;
  next();
});

app.get('/login', (req, res) => {
  res.render('pages/login');
});

// TODO: replace with a real lookup of articles pending review once the Article model exists.
function findReviewQueueArticles() {
  return [
    { title: 'Local Startup Raises Series A Funding', status: 'pending_approval', reporterName: 'Dana Cohen' },
    { title: 'Downtown Traffic Study Released', status: 'pending_approval', reporterName: 'Omer Levi' },
    { title: 'School District Announces Budget Cuts', status: 'returned_for_revision', reporterName: 'Maya Ron' },
  ];
}

// The editor's list is rendered into the page itself, so the first response already contains it.
app.get('/editor', requirePageRole(RoleEnum.EDITOR), async (req, res, next) => {
  try {
    const editor = await userService.findById(req.session.userId);
    res.render('pages/editor', { editorName: editor.name, articles: findReviewQueueArticles() });
  } catch (err) {
    next(err);
  }
});

app.use(viewRoutes);
app.use(userRoutes);
app.use('/api/articles', articleRoutes);
app.use('/api', commentRoutes);
app.use(weatherRoutes);

// Minimal JSON error handler. Malformed JSON -> 400. Other request errors raised by Express and its middleware
// (a bad URL, a too large body, an unsupported charset or encoding) already carry their own 4xx status: it is
// kept (CLAUDE.md section 6, avoid 500). Anything else is a real failure -> 500, also written to logs/error.log.
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Invalid JSON' });
  if (err.status >= 400 && err.status < 500) return res.status(err.status).json({ error: err.message });
  console.error(err);
  logError(`${req.method} ${req.originalUrl}`, req.session, err);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
});

module.exports = app;
