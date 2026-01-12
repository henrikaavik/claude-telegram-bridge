import * as security from './security.js';
import * as sessionMapper from './session-mapper.js';
import * as queueManager from './queue-manager.js';

/**
 * MCP Tools - Implementation of 4 Telegram notification tools
 */

// Rate limiting: Track last call time per tool and session
const lastCallTimes = new Map(); // `${tool}_${sessionId}` -> timestamp
const dailyUsage = new Map(); // `${sessionId}_${date}` -> {notifications: N, questions: N}

/**
 * Check rate limit for a tool
 * @param {string} toolName - Name of the tool
 * @param {string} sessionId - Session ID
 * @param {number} cooldownSeconds - Cooldown period in seconds
 * @returns {Object} - { allowed: boolean, waitTime: number }
 */
function checkRateLimit(toolName, sessionId, cooldownSeconds = 0) {
  if (cooldownSeconds === 0) {
    return { allowed: true, waitTime: 0 };
  }

  const key = `${toolName}_${sessionId}`;
  const lastCall = lastCallTimes.get(key) || 0;
  const now = Date.now();
  const elapsed = now - lastCall;
  const cooldownMs = cooldownSeconds * 1000;

  if (elapsed < cooldownMs) {
    return {
      allowed: false,
      waitTime: Math.ceil((cooldownMs - elapsed) / 1000)
    };
  }

  // Update last call time
  lastCallTimes.set(key, now);
  return { allowed: true, waitTime: 0 };
}

/**
 * Check daily usage limits
 * @param {string} sessionId - Session ID
 * @param {string} type - 'notifications' or 'questions'
 * @returns {Object} - { allowed: boolean, used: number, limit: number }
 */
function checkDailyLimit(sessionId, type) {
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
  const key = `${sessionId}_${today}`;

  // Get or initialize usage
  let usage = dailyUsage.get(key);
  if (!usage) {
    usage = { notifications: 0, questions: 0 };
    dailyUsage.set(key, usage);
  }

  const limit = type === 'notifications'
    ? parseInt(process.env.MAX_DAILY_NOTIFICATIONS || '100', 10)
    : parseInt(process.env.MAX_DAILY_QUESTIONS || '50', 10);

  const used = usage[type];
  const allowed = used < limit;

  if (allowed) {
    usage[type]++;
  }

  return { allowed, used, limit };
}

/**
 * Run all security checks before sending message
 * @param {string} toolName - Name of the tool
 * @param {string} message - Message content
 * @param {Object} context - Context object with sessionId, workingDir
 * @returns {Object} - { allowed: boolean, error?: string, warnings?: Array }
 */
async function runSecurityChecks(toolName, message, context = {}) {
  const { sessionId = 'unknown', workingDir = null } = context;
  const warnings = [];

  // 1. Check if MCP is disabled
  if (security.isDisabled()) {
    return {
      allowed: false,
      error: 'MCP Telegram bridge is currently disabled (MCP_TELEGRAM_DISABLED=true)'
    };
  }

  // 2. Check session authorization
  const authResult = security.isAuthorizedSession(sessionId, workingDir);
  if (!authResult.authorized) {
    return {
      allowed: false,
      error: `Unauthorized session: ${authResult.reason}`
    };
  }

  // 3. Check queue size
  const queueCheck = await security.checkQueueSize(process.env.TELEGRAM_QUEUE_DIR || './queue');
  if (queueCheck.exceeded) {
    return {
      allowed: false,
      error: `Queue is full (${queueCheck.size}/${queueCheck.limit} messages). Please wait for messages to be processed.`
    };
  }

  // 4. Check rate limits
  const cooldown = toolName === 'telegram_ask' ? 10 : 0; // 10 second cooldown for questions
  const rateLimit = checkRateLimit(toolName, sessionId, cooldown);
  if (!rateLimit.allowed) {
    return {
      allowed: false,
      error: `Rate limit: Please wait ${rateLimit.waitTime} seconds before calling ${toolName} again`
    };
  }

  // 5. Check daily limits
  const limitType = toolName === 'telegram_notify' ? 'notifications' : 'questions';
  const dailyLimit = checkDailyLimit(sessionId, limitType);
  if (!dailyLimit.allowed) {
    return {
      allowed: false,
      error: `Daily limit reached: ${dailyLimit.used}/${dailyLimit.limit} ${limitType} today`
    };
  }

  // 6. Check for sensitive data
  if (process.env.ENABLE_SECRET_DETECTION !== 'false') {
    const secretCheck = security.containsSensitiveData(message);
    if (secretCheck.detected) {
      warnings.push({
        type: 'sensitive_data_detected',
        message: `Warning: Message may contain sensitive data (${secretCheck.matches.map(m => m.type).join(', ')})`,
        matches: secretCheck.matches
      });
    }
  }

  return { allowed: true, warnings };
}

/**
 * Tool 1: telegram_notify - Fire-and-forget notification
 */
export async function telegramNotify(params, context = {}) {
  const { message, priority = 'normal', contextInfo = null } = params;

  // Validate input
  if (!message || typeof message !== 'string') {
    return {
      success: false,
      error: 'Message parameter is required and must be a string'
    };
  }

  // Run security checks
  const securityCheck = await runSecurityChecks('telegram_notify', message, context);
  if (!securityCheck.allowed) {
    return {
      success: false,
      error: securityCheck.error
    };
  }

  try {
    // Get chat ID
    const chatId = sessionMapper.getChatId(context.sessionId, context.workingDir);

    // Send message to queue
    const messageId = await queueManager.sendMessage({
      type: 'notify',
      chatId,
      payload: {
        message,
        priority,
        context: contextInfo
      },
      expectsResponse: false
    });

    return {
      success: true,
      messageId,
      timestamp: new Date().toISOString(),
      warnings: securityCheck.warnings || []
    };
  } catch (error) {
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Tool 2: telegram_ask - Blocking question with response
 */
export async function telegramAsk(params, context = {}) {
  const {
    question,
    timeout_seconds = 300,
    options = null,
    contextInfo = null
  } = params;

  // Validate input
  if (!question || typeof question !== 'string') {
    return {
      success: false,
      error: 'Question parameter is required and must be a string'
    };
  }

  if (options && (!Array.isArray(options) || options.length > 4)) {
    return {
      success: false,
      error: 'Options must be an array with maximum 4 items'
    };
  }

  // Validate and cap timeout
  const validatedTimeout = security.validateTimeout(timeout_seconds);

  // Run security checks
  const securityCheck = await runSecurityChecks('telegram_ask', question, context);
  if (!securityCheck.allowed) {
    return {
      success: false,
      error: securityCheck.error,
      timedOut: false
    };
  }

  // Check max concurrent pending questions
  const pendingCount = queueManager.getPendingRequestCount();
  if (pendingCount >= 3) {
    return {
      success: false,
      error: `Too many pending questions (${pendingCount}/3). Please wait for responses before asking more questions.`,
      timedOut: false
    };
  }

  try {
    // Get chat ID
    const chatId = sessionMapper.getChatId(context.sessionId, context.workingDir);

    // Send message and wait for response
    const response = await queueManager.sendAndWaitForResponse({
      type: 'ask',
      chatId,
      payload: {
        message: question,
        timeout: validatedTimeout,
        options,
        context: contextInfo
      }
    }, validatedTimeout * 1000);

    // Check if response is a timeout
    if (response.timedOut) {
      return {
        success: false,
        timedOut: true,
        error: response.error
      };
    }

    // Extract response text
    return {
      success: true,
      response: response.response?.text || response.response?.buttonClicked || '',
      responseTime: response.timestamp,
      timedOut: false,
      warnings: securityCheck.warnings || []
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      timedOut: false
    };
  }
}

/**
 * Tool 3: telegram_request_permission - Approval flow
 */
export async function telegramRequestPermission(params, context = {}) {
  const {
    operation,
    details = null,
    risk_level,
    timeout_seconds = 300
  } = params;

  // Validate input
  if (!operation || typeof operation !== 'string') {
    return {
      success: false,
      approved: false,
      error: 'Operation parameter is required and must be a string'
    };
  }

  if (!['low', 'medium', 'high', 'critical'].includes(risk_level)) {
    return {
      success: false,
      approved: false,
      error: 'risk_level must be one of: low, medium, high, critical'
    };
  }

  // Validate and cap timeout
  const validatedTimeout = security.validateTimeout(timeout_seconds);

  // Run security checks
  const securityCheck = await runSecurityChecks('telegram_request_permission', operation, context);
  if (!securityCheck.allowed) {
    return {
      success: false,
      approved: false,
      error: securityCheck.error
    };
  }

  try {
    // Get chat ID
    const chatId = sessionMapper.getChatId(context.sessionId, context.workingDir);

    // Send permission request and wait for response
    const response = await queueManager.sendAndWaitForResponse({
      type: 'permission',
      chatId,
      payload: {
        operation,
        details,
        risk_level,
        timeout: validatedTimeout
      }
    }, validatedTimeout * 1000);

    // Check if response is a timeout
    if (response.timedOut) {
      return {
        success: false,
        approved: false,
        error: response.error
      };
    }

    // Check if approved
    const approved = response.response?.approved === true ||
                     response.response?.buttonClicked === 'approve';

    return {
      success: true,
      approved,
      response: response.response?.text || '',
      timestamp: response.timestamp,
      warnings: securityCheck.warnings || []
    };
  } catch (error) {
    return {
      success: false,
      approved: false,
      error: error.message
    };
  }
}

/**
 * Tool 4: telegram_get_session_status - Health check
 */
export async function telegramGetSessionStatus(params, context = {}) {
  try {
    const chatId = sessionMapper.getChatId(context.sessionId, context.workingDir);
    const pendingMessages = await queueManager.getPendingMessageCount();
    const pendingRequests = queueManager.getPendingRequestCount();

    // Check if bot is running by looking for recent activity
    // (This is a simple check - bot could implement heartbeat for better detection)
    const botRunning = true; // Assume running if queue directory exists

    return {
      available: !security.isDisabled(),
      botRunning,
      chatId,
      pendingMessages,
      pendingRequests,
      queueDir: process.env.TELEGRAM_QUEUE_DIR || './queue'
    };
  } catch (error) {
    return {
      available: false,
      error: error.message
    };
  }
}

export default {
  telegramNotify,
  telegramAsk,
  telegramRequestPermission,
  telegramGetSessionStatus
};
