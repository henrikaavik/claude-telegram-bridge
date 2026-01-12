/**
 * Audit Logging System
 * Records all important events for security and debugging
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// CONFIGURATION
// ============================================

const LOG_DIR = process.env.AUDIT_LOG_DIR || path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOG_DIR, 'audit.log');
const MAX_LOG_SIZE = 10 * 1024 * 1024; // 10 MB
const LOG_ROTATION_COUNT = 5; // Keep 5 old log files

// Ensure log directory exists
if (!fs.existsSync(LOG_DIR)) {
  fs.mkdirSync(LOG_DIR, { recursive: true });
}

// ============================================
// LOG LEVELS
// ============================================

const LOG_LEVELS = {
  INFO: 'INFO',
  WARN: 'WARN',
  ERROR: 'ERROR',
  SECURITY: 'SECURITY',
  AUDIT: 'AUDIT'
};

// ============================================
// LOG FORMATTING
// ============================================

/**
 * Format a log entry
 * @param {string} level - Log level
 * @param {string} event - Event type
 * @param {Object} data - Event data
 * @returns {string} - Formatted log line
 */
function formatLogEntry(level, event, data) {
  const timestamp = new Date().toISOString();
  const entry = {
    timestamp,
    level,
    event,
    ...data
  };

  // Remove sensitive data
  if (entry.message && typeof entry.message === 'string') {
    // Redact potential API keys, tokens, passwords
    entry.message = entry.message.replace(/\b(sk-[a-zA-Z0-9]{20,})\b/g, '[REDACTED_API_KEY]');
    entry.message = entry.message.replace(/\b([0-9]{10}:[a-zA-Z0-9_-]{35})\b/g, '[REDACTED_BOT_TOKEN]');
    entry.message = entry.message.replace(/(password|pwd|pass)\s*[:=]\s*\S+/gi, '$1=[REDACTED]');
  }

  return JSON.stringify(entry) + '\n';
}

// ============================================
// LOG ROTATION
// ============================================

/**
 * Rotate log files if needed
 */
function rotateLogsIfNeeded() {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return;
    }

    const stats = fs.statSync(LOG_FILE);
    if (stats.size < MAX_LOG_SIZE) {
      return;
    }

    // Rotate existing logs
    for (let i = LOG_ROTATION_COUNT - 1; i >= 0; i--) {
      const oldFile = i === 0 ? LOG_FILE : `${LOG_FILE}.${i}`;
      const newFile = `${LOG_FILE}.${i + 1}`;

      if (fs.existsSync(oldFile)) {
        if (i === LOG_ROTATION_COUNT - 1) {
          fs.unlinkSync(oldFile); // Delete oldest
        } else {
          fs.renameSync(oldFile, newFile);
        }
      }
    }

    // Create new log file
    fs.writeFileSync(LOG_FILE, '', 'utf8');
  } catch (error) {
    console.error('Error rotating logs:', error);
  }
}

// ============================================
// CORE LOGGING
// ============================================

/**
 * Write to audit log
 * @param {string} level - Log level
 * @param {string} event - Event type
 * @param {Object} data - Event data
 */
function writeLog(level, event, data) {
  try {
    rotateLogsIfNeeded();
    const entry = formatLogEntry(level, event, data);
    fs.appendFileSync(LOG_FILE, entry, 'utf8');
  } catch (error) {
    console.error('Error writing to audit log:', error);
  }
}

// ============================================
// PUBLIC API
// ============================================

/**
 * Log a user action
 * @param {number} chatId - Telegram chat ID
 * @param {string} action - Action performed
 * @param {Object} details - Additional details
 */
export function logUserAction(chatId, action, details = {}) {
  writeLog(LOG_LEVELS.AUDIT, 'user_action', {
    chatId,
    action,
    ...details
  });
}

/**
 * Log a security event
 * @param {number} chatId - Telegram chat ID
 * @param {string} event - Security event type
 * @param {Object} details - Event details
 */
export function logSecurityEvent(chatId, event, details = {}) {
  writeLog(LOG_LEVELS.SECURITY, event, {
    chatId,
    ...details
  });

  // Also log to console for immediate visibility
  console.warn(`🔐 SECURITY: [${chatId}] ${event}`, details);
}

/**
 * Log a destructive operation
 * @param {number} chatId - Telegram chat ID
 * @param {string} operation - Operation description
 * @param {boolean} confirmed - Whether user confirmed
 * @param {Object} details - Additional details
 */
export function logDestructiveOperation(chatId, operation, confirmed, details = {}) {
  writeLog(LOG_LEVELS.SECURITY, 'destructive_operation', {
    chatId,
    operation,
    confirmed,
    ...details
  });
}

/**
 * Log a rate limit violation
 * @param {number} chatId - Telegram chat ID
 * @param {string} limitType - Type of limit hit
 * @param {Object} limitInfo - Rate limit info
 */
export function logRateLimitViolation(chatId, limitType, limitInfo) {
  writeLog(LOG_LEVELS.WARN, 'rate_limit_violation', {
    chatId,
    limitType,
    ...limitInfo
  });
}

/**
 * Log session creation
 * @param {number} chatId - Telegram chat ID
 * @param {string} sessionId - Session ID
 * @param {string} sessionName - Session name (for multi-session)
 * @param {string} workspacePath - Workspace path
 */
export function logSessionCreated(chatId, sessionId, sessionName = 'default', workspacePath) {
  writeLog(LOG_LEVELS.INFO, 'session_created', {
    chatId,
    sessionId,
    sessionName,
    workspacePath
  });
}

/**
 * Log session termination
 * @param {number} chatId - Telegram chat ID
 * @param {string} sessionId - Session ID
 * @param {string} sessionName - Session name
 * @param {string} reason - Termination reason
 */
export function logSessionTerminated(chatId, sessionId, sessionName, reason) {
  writeLog(LOG_LEVELS.INFO, 'session_terminated', {
    chatId,
    sessionId,
    sessionName,
    reason
  });
}

/**
 * Log an error
 * @param {number} chatId - Telegram chat ID
 * @param {string} errorType - Error type
 * @param {Error} error - Error object
 * @param {Object} context - Additional context
 */
export function logError(chatId, errorType, error, context = {}) {
  writeLog(LOG_LEVELS.ERROR, errorType, {
    chatId,
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name
    },
    ...context
  });
}

/**
 * Log authentication event
 * @param {number} chatId - Telegram chat ID
 * @param {boolean} success - Whether auth succeeded
 * @param {Object} details - Additional details
 */
export function logAuthEvent(chatId, success, details = {}) {
  writeLog(success ? LOG_LEVELS.INFO : LOG_LEVELS.SECURITY, 'authentication', {
    chatId,
    success,
    ...details
  });
}

/**
 * Read recent audit logs
 * @param {number} lines - Number of lines to read (default 100)
 * @param {string} filter - Optional filter string
 * @returns {Array} - Array of log entries
 */
export function readAuditLog(lines = 100, filter = null) {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return [];
    }

    const content = fs.readFileSync(LOG_FILE, 'utf8');
    const allLines = content.split('\n').filter(line => line.trim());

    // Apply filter if provided
    let filteredLines = allLines;
    if (filter) {
      filteredLines = allLines.filter(line => line.includes(filter));
    }

    // Get last N lines
    const recentLines = filteredLines.slice(-lines);

    // Parse JSON
    return recentLines.map(line => {
      try {
        return JSON.parse(line);
      } catch {
        return { raw: line };
      }
    });
  } catch (error) {
    console.error('Error reading audit log:', error);
    return [];
  }
}

/**
 * Get log statistics
 * @returns {Object} - Statistics about logs
 */
export function getLogStats() {
  try {
    if (!fs.existsSync(LOG_FILE)) {
      return { exists: false };
    }

    const stats = fs.statSync(LOG_FILE);
    const content = fs.readFileSync(LOG_FILE, 'utf8');
    const lines = content.split('\n').filter(line => line.trim());

    return {
      exists: true,
      sizeBytes: stats.size,
      sizeKB: (stats.size / 1024).toFixed(2),
      totalEntries: lines.length,
      lastModified: stats.mtime,
      path: LOG_FILE
    };
  } catch (error) {
    console.error('Error getting log stats:', error);
    return { error: error.message };
  }
}

// ============================================
// EXPORTS
// ============================================

export default {
  logUserAction,
  logSecurityEvent,
  logDestructiveOperation,
  logRateLimitViolation,
  logSessionCreated,
  logSessionTerminated,
  logError,
  logAuthEvent,
  readAuditLog,
  getLogStats,
  LOG_LEVELS
};
