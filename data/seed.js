require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../back/config/db');
const { RoleEnum } = require('../back/models/User');
const userService = require('../back/services/userService');
const userValidators = require('../back/validators/userValidators');

const SEED_USERS = [
  { role: RoleEnum.EDITOR, name: 'Dana Levi', email: 'dana.levi@dailyweb.test' },
  { role: RoleEnum.EDITOR, name: 'Ron Cohen', email: 'ron.cohen@dailyweb.test' },
  { role: RoleEnum.REPORTER, name: 'Maya Katz', email: 'maya.katz@dailyweb.test' },
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

async function main() {
  await connectDB();
  if (mongoose.connection.readyState !== 1) throw new Error('Database is not connected');
  await seedUsers();
}

main()
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exitCode = 1;
  })
  .finally(() => mongoose.disconnect());
