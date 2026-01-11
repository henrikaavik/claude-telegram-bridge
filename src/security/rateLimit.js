/**
 * Rate Limiting System
 * Prevents abuse by limiting message frequency per user
 */

// ============================================
// RATE LIMIT CONFIGURATION
// ============================================

const RATE_LIMITS = {
  messages: {
    window: 60 * 1000, // 1 minute in milliseconds
    maxRequests: 20,    // 20 messages per minute
    description: 'message rate limit'
  },
  audio: {
    window: 60 * 1000, // 1 minute
    maxRequests: 10,    // 10 audio messages per minute
    description: 'audio transcription rate limit'
  },
  sessions: {
    window: 60 * 1000, // 1 minute
    maxRequests: 5,     // 5 session creations per minute
    description: 'session creation rate limit'
  }
};

// ============================================
// STORAGE
// ============================================

// Store request timestamps: chatId -> { type -> [timestamps] }
const requestHistory = new Map();

// Store warnings sent: chatId -> { count, lastWarning }
const warningHistory = new Map();

// ============================================
// CLEANUP
// ============================================

// Clean up old data every 5 minutes
setInterval(() => {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes

  // Clean request history
  for (const [chatId, types] of requestHistory.entries()) {
    for (const [type, timestamps] of Object.entries(types)) {
      types[type] = timestamps.filter(ts => now - ts < maxAge);
    }
    // Remove empty entries
    if (Object.values(types).every(arr => arr.length === 0)) {
      requestHistory.delete(chatId);
    }
  }

  // Clean warning history
  for (const [chatId, warning] of warningHistory.entries()) {
    if (now - warning.lastWarning > maxAge) {
      warningHistory.delete(chatId);
    }
  }
}, 5 * 60 * 1000);

// ============================================
// CORE FUNCTIONALITY
// ============================================

/**
 * Record a request
 * @param {number} chatId - Telegram chat ID
 * @param {string} type - Request type (messages, audio, sessions)
 */
function recordRequest(chatId, type) {
  if (!requestHistory.has(chatId)) {
    requestHistory.set(chatId, {});
  }

  const userHistory = requestHistory.get(chatId);
  if (!userHistory[type]) {
    userHistory[type] = [];
  }

  userHistory[type].push(Date.now());
}

/**
 * Get request count in current window
 * @param {number} chatId - Telegram chat ID
 * @param {string} type - Request type
 * @returns {number} - Number of requests in window
 */
function getRequestCount(chatId, type) {
  if (!requestHistory.has(chatId)) {
    return 0;
  }

  const userHistory = requestHistory.get(chatId);
  if (!userHistory[type]) {
    return 0;
  }

  const now = Date.now();
  const window = RATE_LIMITS[type].window;

  // Filter to only requests within the window
  const recentRequests = userHistory[type].filter(ts => now - ts < window);
  userHistory[type] = recentRequests; // Clean up old entries

  return recentRequests.length;
}

/**
 * Check if request should be rate limited
 * @param {number} chatId - Telegram chat ID
 * @param {string} type - Request type (messages, audio, sessions)
 * @returns {Object} - { limited: boolean, remaining: number, resetIn: number }
 */
export function checkRateLimit(chatId, type = 'messages') {
  const config = RATE_LIMITS[type];
  if (!config) {
    console.warn(`Unknown rate limit type: ${type}, using default 'messages'`);
    type = 'messages';
  }

  const count = getRequestCount(chatId, type);
  const limit = config.maxRequests;
  const limited = count >= limit;

  if (!limited) {
    recordRequest(chatId, type);
  }

  // Calculate when the limit resets
  const userHistory = requestHistory.get(chatId)?.[type] || [];
  const oldestRequest = userHistory[0] || Date.now();
  const resetIn = limited ? config.window - (Date.now() - oldestRequest) : config.window;

  return {
    limited,
    remaining: Math.max(0, limit - count - (limited ? 0 : 1)),
    resetIn: Math.ceil(resetIn / 1000), // Convert to seconds
    current: count,
    limit
  };
}

/**
 * Send rate limit warning to user
 * @param {Object} bot - Telegram bot instance
 * @param {number} chatId - Telegram chat ID
 * @param {Object} limitInfo - Info from checkRateLimit
 * @param {string} type - Request type
 * @param {Object} translations - Translation object
 */
export async function sendRateLimitWarning(bot, chatId, limitInfo, type, translations = {}) {
  const t = translations || {};
  const config = RATE_LIMITS[type];

  // Track warnings to avoid spam
  if (!warningHistory.has(chatId)) {
    warningHistory.set(chatId, { count: 0, lastWarning: 0 });
  }

  const warning = warningHistory.get(chatId);
  const now = Date.now();

  // Only send warning once per minute
  if (now - warning.lastWarning < 60 * 1000) {
    return;
  }

  warning.count++;
  warning.lastWarning = now;

  const message = `🚨 **Rate Limit Exceeded**

You've sent too many ${type} requests.

**Limit**: ${config.maxRequests} per ${config.window / 1000} seconds
**Current**: ${limitInfo.current} requests
**Reset in**: ${limitInfo.resetIn} seconds

Please wait before sending more requests.`;

  try {
    await bot.sendMessage(chatId, message, { parse_mode: 'Markdown' });
  } catch (error) {
    console.error('Error sending rate limit warning:', error);
  }

  // Escalate if user is persistently hitting limits
  if (warning.count > 5) {
    console.warn(`⚠️ User ${chatId} has hit rate limits ${warning.count} times`);
  }
}

/**
 * Get rate limit status for a user
 * @param {number} chatId - Telegram chat ID
 * @returns {Object} - Status for all limit types
 */
export function getRateLimitStatus(chatId) {
  const status = {};

  for (const type of Object.keys(RATE_LIMITS)) {
    const count = getRequestCount(chatId, type);
    const config = RATE_LIMITS[type];

    status[type] = {
      current: count,
      limit: config.maxRequests,
      remaining: Math.max(0, config.maxRequests - count),
      window: config.window / 1000
    };
  }

  return status;
}

/**
 * Reset rate limits for a user (admin function)
 * @param {number} chatId - Telegram chat ID
 * @param {string} type - Optional specific type to reset
 */
export function resetRateLimit(chatId, type = null) {
  if (type) {
    // Reset specific type
    const userHistory = requestHistory.get(chatId);
    if (userHistory) {
      delete userHistory[type];
    }
  } else {
    // Reset all
    requestHistory.delete(chatId);
  }

  warningHistory.delete(chatId);
}

// ============================================
// EXPORTS
// ============================================

export default {
  checkRateLimit,
  sendRateLimitWarning,
  getRateLimitStatus,
  resetRateLimit
};
