require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../back/config/db');
const { RoleEnum } = require('../back/models/User');
const userService = require('../back/services/userService');
const userValidators = require('../back/validators/userValidators');
const Article = require('../back/models/Article');
const ArticleRevision = require('../back/models/ArticleRevision');
const User = require('../back/models/User');
const SEED_ARTICLES = require('./seedArticles');

const SEED_USERS = [
  { role: RoleEnum.EDITOR, name: 'Dana Levi', email: 'dana.levi@dailyweb.test' },
  { role: RoleEnum.EDITOR, name: 'Test Editor', email: 'test.editor@dailyweb.test' },
  { role: RoleEnum.EDITOR, name: 'Ron Cohen', email: 'ron.cohen@dailyweb.test' },
  { role: RoleEnum.REPORTER, name: 'Maya Katz', email: 'maya.katz@dailyweb.test' },
  { role: RoleEnum.REPORTER, name: 'Test Reporter', email: 'test.reporter@dailyweb.test' },
  { role: RoleEnum.REPORTER, name: 'Omer Peretz', email: 'omer.peretz@dailyweb.test' },
  { role: RoleEnum.REPORTER, name: 'Noa Shapira', email: 'noa.shapira@dailyweb.test' },
];

// Demo accounts only: each password equals the user's email. Goes straight through
// the service, so it intentionally skips the addUser password-strength rules.
async function seedUsers() {
  for (const seedUser of SEED_USERS) {
    if (!(await userValidators.isEmailUnique(seedUser.email))) {
      console.log(`Skipped existing user ${seedUser.email}`);
      continue;
    }
    await userService.addUser({ ...seedUser, password: seedUser.email });
    console.log(`Created user ${seedUser.email}`);
  }
}

const DAY_IN_MS = 24 * 60 * 60 * 1000;

// Deletes every article and every revision (the users are kept), then makes the indexes of both collections
// match the schemas: indexes of an older schema are dropped and missing ones are created.
async function clearArticles() {
  const { deletedCount: deletedRevisions } = await ArticleRevision.deleteMany({});
  const { deletedCount: deletedArticles } = await Article.deleteMany({});
  await Promise.all([Article.syncIndexes(), ArticleRevision.syncIndexes()]);
  console.log(`Deleted ${deletedArticles} articles and ${deletedRevisions} revisions`);
}

// Every sample article is published: its live content (Article.content), plus one published revision with the
// same content, approved by an editor. Authors take turns among the reporters.
async function seedArticles() {
  const reporters = await User.find({ role: RoleEnum.REPORTER }).sort({ email: 1 });
  const editor = await User.findOne({ role: RoleEnum.EDITOR }).sort({ email: 1 });
  if (reporters.length === 0 || !editor) throw new Error('Seed users are missing');
  const approvedBy = { id: editor.id, name: editor.name };

  let index = 0;
  for (const [category, articles] of Object.entries(SEED_ARTICLES)) {
    for (const [title, summary, body] of articles) {
      index += 1;
      const reporter = reporters[index % reporters.length];
      const publishedAt = new Date(Date.now() - index * DAY_IN_MS);
      const content = { title, summary, body, imageUrl: `https://picsum.photos/seed/daily-web-${index}/800/450`, category };

      const article = await Article.create({
        author: { id: reporter.id, name: reporter.name },
        status: Article.ArticleStatusEnum.PUBLISHED,
        content,
        publishedAt,
      });
      await ArticleRevision.create({ article: article.id, content, publishedAt, approvedBy });
      console.log(`Created article "${title}" (${category})`);
    }
  }
}

async function main() {
  await connectDB();
  if (mongoose.connection.readyState !== 1) throw new Error('Database is not connected');
  await seedUsers();
  await clearArticles();
  await seedArticles();
}

main()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
