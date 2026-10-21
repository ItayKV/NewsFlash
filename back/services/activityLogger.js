const fs = require('fs');
const path = require('path');
const { RoleEnum } = require('../models/User');

const LOG_DIRECTORY = path.join(__dirname, '..', '..', 'logs');
const LOG_FILE = path.join(LOG_DIRECTORY, 'activity.log');

const EventEnum = Object.freeze({
  USER_SIGNUP: 'USER_SIGNUP',
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGIN_FAILED: 'USER_LOGIN_FAILED',
  ARTICLE_CREATED: 'ARTICLE_CREATED',
  ARTICLE_STATUS_CHANGED: 'ARTICLE_STATUS_CHANGED',
  ARTICLE_PUBLISHED: 'ARTICLE_PUBLISHED',
  ARTICLE_DELETED: 'ARTICLE_DELETED',
});

const ROLE_NAMES = Object.freeze({ [RoleEnum.EDITOR]: 'editor', [RoleEnum.REPORTER]: 'reporter' });

/** The actor as text: "<user id> (<role>)", or "guest" when nobody is logged in. */
function describeActor(session) {
  if (!session || !session.userId) return 'guest';
  return `${session.userId} (${ROLE_NAMES[session.role] || 'unknown'})`;
}

/**
 * Writes one activity line (ISO time, event, actor, target id, details) to the console and to logs/activity.log.
 * A logging failure is reported on the console only: it never fails the request and never throws.
 * Callers must not pass passwords, password hashes, session ids or secrets in the details.
 */
function logActivity(event, session, targetId, details = '') {
  try {
    const singleLineDetails = String(details).replace(/\s*[\r\n]+\s*/g, ' ');
    const line = [new Date().toISOString(), event, describeActor(session), targetId || '-', singleLineDetails].join(' | ');
    console.log(line);
    fs.mkdirSync(LOG_DIRECTORY, { recursive: true });
    fs.appendFile(LOG_FILE, `${line}\n`, (err) => {
      if (err) console.error('Could not write the activity log:', err.message);
    });
  } catch (err) {
    console.error('Could not log the activity:', err.message);
  }
}

module.exports = { EventEnum, logActivity };
