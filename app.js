const path = require('path');
const express = require('express');
const userRoutes = require('./back/routes/userRoutes');
const { HTTP_STATUS } = require('./back/config/constants');

const app = express();

app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'back', 'views'));

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
  res.render('pages/home');
});

app.use(userRoutes);

// Minimal JSON error handler (malformed JSON -> 400, otherwise 500).
app.use((err, req, res, next) => {
  if (err.type === 'entity.parse.failed') return res.status(HTTP_STATUS.BAD_REQUEST).json({ error: 'Invalid JSON' });
  console.error(err);
  res.status(HTTP_STATUS.INTERNAL_SERVER_ERROR).json({ error: 'Internal server error' });
});

module.exports = app;
