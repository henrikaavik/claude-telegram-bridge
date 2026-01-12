/**
 * Confirmation System for Destructive Operations
 * Detects and requests user approval for potentially dangerous commands
 */

// ============================================
// UTILITY FUNCTIONS
// ============================================

/**
 * Escape markdown special characters to prevent injection
 * @param {string} text - Text to escape
 * @returns {string} - Escaped text safe for markdown
 */
function escapeMarkdown(text) {
  if (!text) return '';
  return text.replace(/([*_`\[\]()~>#+=|{}.!-])/g, '\\$1');
}

// ============================================
// DESTRUCTIVE OPERATION PATTERNS
// ============================================

const DESTRUCTIVE_PATTERNS = [
  // Git operations (more specific patterns first to avoid false matches)
  { pattern: /git\s+push\s+(-f|--force(-with-lease)?)/i, level: 'high', description: 'Force push to remote' },
  { pattern: /git\s+push/i, level: 'medium', description: 'Git push to remote' },
  { pattern: /git\s+reset\s+--hard/i, level: 'high', description: 'Hard reset git repository' },
  { pattern: /git\s+clean\s+-[dfx]/i, level: 'medium', description: 'Clean untracked files' },

  // File operations
  { pattern: /rm\s+-rf/i, level: 'high', description: 'Recursive force delete' },
  { pattern: /rm\s+.*\*/, level: 'medium', description: 'Delete multiple files with wildcard' },
  { pattern: /delete\s+file/i, level: 'low', description: 'Delete file' },
  { pattern: /unlink/i, level: 'low', description: 'Unlink file' },

  // Database operations
  { pattern: /drop\s+database/i, level: 'high', description: 'Drop database' },
  { pattern: /drop\s+table/i, level: 'high', description: 'Drop table' },
  { pattern: /truncate\s+table/i, level: 'medium', description: 'Truncate table' },
  { pattern: /delete\s+from/i, level: 'medium', description: 'Delete database records' },

  // System operations
  { pattern: /chmod\s+777/i, level: 'medium', description: 'Change permissions to 777' },
  { pattern: /chown/i, level: 'medium', description: 'Change file ownership' },
  { pattern: /sudo/i, level: 'medium', description: 'Execute with sudo' },

  // Package operations
  { pattern: /npm\s+uninstall/i, level: 'low', description: 'Uninstall npm package' },
  { pattern: /yarn\s+remove/i, level: 'low', description: 'Remove yarn package' },
  { pattern: /pip\s+uninstall/i, level: 'low', description: 'Uninstall pip package' },

  // Docker operations
  { pattern: /docker\s+rm/i, level: 'medium', description: 'Remove Docker container' },
  { pattern: /docker\s+rmi/i, level: 'medium', description: 'Remove Docker image' },
  { pattern: /docker\s+system\s+prune/i, level: 'high', description: 'Prune Docker system' },
];

// ============================================
// CONFIRMATION DETECTION
// ============================================

/**
 * Analyze a command/message for destructive operations
 * @param {string} message - The message to analyze
 * @returns {Object|null} - Match info or null if safe
 */
export function detectDestructiveOperation(message) {
  for (const { pattern, level, description } of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(message)) {
      return { level, description, pattern: pattern.source };
    }
  }
  return null;
}

// ============================================
// CONFIRMATION UI
// ============================================

/**
 * Generate confirmation message based on security level
 * @param {Object} detection - Detection result from detectDestructiveOperation
 * @param {string} command - The actual command
 * @returns {Object} - Message configuration for Telegram
 */
export function generateConfirmationMessage(detection, command) {
  const { level, description } = detection;

  const emoji = {
    low: '⚠️',
    medium: '🚨',
    high: '🔴'
  };

  const levelText = {
    low: 'Caution Required',
    medium: 'Warning',
    high: 'DANGER'
  };

  let message = `${emoji[level]} **${levelText[level]}**\n\n`;
  // Escape command to prevent markdown injection
  message += `Claude wants to execute:\n\`\`\`\n${escapeMarkdown(command)}\n\`\`\`\n\n`;
  message += `**Operation**: ${description}\n`;
  message += `**Risk Level**: ${level.toUpperCase()}\n\n`;

  if (level === 'high') {
    message += '⚠️ **This is a destructive operation that cannot be undone!**\n\n';
    message += 'To confirm, type: `I CONFIRM THIS ACTION`';
    return {
      text: message,
      requireExactPhrase: true,
      confirmPhrase: 'I CONFIRM THIS ACTION',
      keyboard: null
    };
  } else {
    message += 'Do you want to proceed?';
    return {
      text: message,
      requireExactPhrase: false,
      keyboard: {
        inline_keyboard: [
          [
            { text: '✅ Yes, proceed', callback_data: 'confirm_yes' },
            { text: '❌ No, cancel', callback_data: 'confirm_no' }
          ]
        ]
      }
    };
  }
}

// ============================================
// PENDING CONFIRMATIONS STORAGE
// ============================================

// Store pending confirmations: chatId -> { command, timestamp, level }
const pendingConfirmations = new Map();

/**
 * Store a pending confirmation
 * @param {number} chatId - Telegram chat ID
 * @param {string} command - Command awaiting confirmation
 * @param {string} level - Risk level (low/medium/high)
 */
export function storePendingConfirmation(chatId, command, level) {
  pendingConfirmations.set(chatId, {
    command,
    level,
    timestamp: Date.now()
  });

  // Auto-expire after 5 minutes
  setTimeout(() => {
    if (pendingConfirmations.has(chatId)) {
      const pending = pendingConfirmations.get(chatId);
      if (pending.timestamp === pendingConfirmations.get(chatId)?.timestamp) {
        pendingConfirmations.delete(chatId);
      }
    }
  }, 5 * 60 * 1000);
}

/**
 * Get a pending confirmation without clearing it
 * @param {number} chatId - Telegram chat ID
 * @returns {Object|null} - Pending confirmation or null
 */
export function peekPendingConfirmation(chatId) {
  return pendingConfirmations.get(chatId) || null;
}

/**
 * Get and clear a pending confirmation
 * @param {number} chatId - Telegram chat ID
 * @returns {Object|null} - Pending confirmation or null
 */
export function getPendingConfirmation(chatId) {
  const pending = pendingConfirmations.get(chatId);
  if (pending) {
    pendingConfirmations.delete(chatId);
    return pending;
  }
  return null;
}

/**
 * Check if there's a pending confirmation
 * @param {number} chatId - Telegram chat ID
 * @returns {boolean}
 */
export function hasPendingConfirmation(chatId) {
  return pendingConfirmations.has(chatId);
}

/**
 * Cancel a pending confirmation
 * @param {number} chatId - Telegram chat ID
 */
export function cancelPendingConfirmation(chatId) {
  pendingConfirmations.delete(chatId);
}

// ============================================
// MAIN CONFIRMATION HANDLER
// ============================================

/**
 * Main confirmation request handler
 * @param {Object} bot - Telegram bot instance
 * @param {number} chatId - Telegram chat ID
 * @param {string} message - Message/command to check
 * @param {Object} translations - Translation object
 * @returns {Promise<boolean>} - true if confirmation is needed (message was sent), false if safe to proceed
 */
export async function requireConfirmation(bot, chatId, message, translations = {}) {
  const t = translations || {};
  const detection = detectDestructiveOperation(message);

  if (!detection) {
    return false; // Safe to proceed
  }

  // Store the pending confirmation
  storePendingConfirmation(chatId, message, detection.level);

  // Generate and send confirmation request
  const confirmMsg = generateConfirmationMessage(detection, message);

  try {
    await bot.sendMessage(chatId, confirmMsg.text, {
      parse_mode: 'Markdown',
      reply_markup: confirmMsg.keyboard
    });

    return true; // Confirmation needed, message sent
  } catch (error) {
    console.error('Error sending confirmation request:', error);
    throw error;
  }
}

// ============================================
// EXPORTS
// ============================================

export default {
  detectDestructiveOperation,
  generateConfirmationMessage,
  requireConfirmation,
  storePendingConfirmation,
  getPendingConfirmation,
  peekPendingConfirmation,
  hasPendingConfirmation,
  cancelPendingConfirmation
};
