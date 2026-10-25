const fs = require('fs');
const path = require('path');
const { RoleEnum } = require('../models/User');

const LOG_DIRECTORY = path.join(__dirname, '..', '..', 'logs');
const LOG_FILE = path.join(LOG_DIRECTORY, 'activity.log');
const ERROR_LOG_FILE = path.join(LOG_DIRECTORY, 'error.log');

const EventEnum = Object.freeze({
  USER_LOGIN: 'USER_LOGIN',
  USER_LOGIN_FAILED: 'USER_LOGIN_FAILED',
  ARTICLE_CREATED: 'ARTICLE_CREATED',
  ARTICLE_STATUS_CHANGED: 'ARTICLE_STATUS_CHANGED',
  ARTICLE_DELETED: 'ARTICLE_DELETED',
});

const ROLE_NAMES = Object.freeze({ [RoleEnum.EDITOR]: 'editor', [RoleEnum.REPORTER]: 'reporter' });

/** The actor as text: "<user id> (<role>)", or "guest" when nobody is logged in. */
function describeActor(session) {
  if (!session || !session.userId) return 'guest';
  return `${session.userId} (${ROLE_NAMES[session.role] || 'unknown'})`;
}

/** The text on one line: each line break (with the spaces around it) becomes one space. */
const toSingleLine = (text) => String(text).replace(/\s*[\r\n]+\s*/g, ' ');

/**
 * Writes one activity line (ISO time, event, actor, target id, details) to the console and to logs/activity.log.
 * A logging failure is reported on the console only: it never fails the request and never throws.
 * Callers must not pass passwords, password hashes, session ids or secrets in the details.
 */
function logActivity(event, session, targetId, details = '') {
  try {
    const line = [new Date().toISOString(), event, describeActor(session), targetId || '-', toSingleLine(details)].join(' | ');
    console.log(line);
    fs.mkdirSync(LOG_DIRECTORY, { recursive: true });
    fs.appendFile(LOG_FILE, `${line}\n`, (err) => {
      if (err) console.error('Could not write the activity log:', err.message);
    });
  } catch (err) {
    console.error('Could not log the activity:', err.message);
  }
}

/**
 * Writes one error line (ISO time, request, actor, error message, stack) to logs/error.log. Called by the error
 * handler in app.js for 500 errors only, which prints the error on the console itself. The source is the request
 * ("POST /api/articles"); the actor is "-" when the request has no session (e.g. the session store is down).
 * A logging failure is reported on the console only: it never fails the request and never throws.
 * Callers must not pass request bodies, passwords, session ids or secrets in the source.
 */
function logError(source, session, err) {
  try {
    const actor = session ? describeActor(session) : '-';
    const message = err?.message ?? String(err);
    const stack = err?.stack ? toSingleLine(err.stack) : '-';
    const line = [new Date().toISOString(), source, actor, toSingleLine(message), stack].join(' | ');
    fs.mkdirSync(LOG_DIRECTORY, { recursive: true });
    fs.appendFile(ERROR_LOG_FILE, `${line}\n`, (writeError) => {
      if (writeError) console.error('Could not write the error log:', writeError.message);
    });
  } catch (loggingError) {
    console.error('Could not write the error log:', loggingError.message);
  }
}

module.exports = { EventEnum, logActivity, logError };
