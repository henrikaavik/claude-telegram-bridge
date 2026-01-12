import crypto from 'crypto';
import fs from 'fs/promises';
import path from 'path';

/**
 * Security utilities for MCP Telegram bridge
 * Provides HMAC signing, secret detection, session authorization, and queue protection
 */

// ============================================
// 1. HMAC Message Signing
// ============================================

/**
 * Sign a message with HMAC-SHA256
 * @param {Object} message - Message object to sign
 * @returns {string} - Hex-encoded HMAC signature
 */
export function signMessage(message) {
  const secret = process.env.QUEUE_HMAC_SECRET;

  if (!secret) {
    throw new Error('QUEUE_HMAC_SECRET environment variable is required for message signing');
  }

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(message));
  return hmac.digest('hex');
}

/**
 * Verify message signature
 * @param {Object} message - Message object (without signature field)
 * @param {string} signature - Signature to verify
 * @returns {boolean} - True if signature is valid
 */
export function verifyMessage(message, signature) {
  try {
    const expectedSignature = signMessage(message);
    return crypto.timingSafeEqual(
      Buffer.from(signature, 'hex'),
      Buffer.from(expectedSignature, 'hex')
    );
  } catch (error) {
    return false;
  }
}

// ============================================
// 2. Secret Detection
// ============================================

/**
 * Patterns for detecting sensitive data
 */
const SECRET_PATTERNS = [
  { name: 'OpenAI API Key', regex: /sk-[a-zA-Z0-9]{48}/g },
  { name: 'OpenAI Project Key', regex: /sk-proj-[a-zA-Z0-9_-]{48,}/g },
  { name: 'GitHub Personal Access Token', regex: /ghp_[a-zA-Z0-9]{36}/g },
  { name: 'GitHub OAuth Token', regex: /gho_[a-zA-Z0-9]{36}/g },
  { name: 'GitHub App Token', regex: /ghs_[a-zA-Z0-9]{36}/g },
  { name: 'AWS Access Key', regex: /AKIA[0-9A-Z]{16}/g },
  { name: 'Anthropic API Key', regex: /sk-ant-[a-zA-Z0-9_-]{48,}/g },
  { name: 'Slack Token', regex: /xox[baprs]-[0-9]{10,13}-[0-9]{10,13}-[a-zA-Z0-9]{24,}/g },
  { name: 'Generic Password', regex: /password\s*[:=]\s*['"]?[^\s'"]{6,}/gi },
  { name: 'Generic API Key', regex: /api[_-]?key\s*[:=]\s*['"]?[^\s'"]{10,}/gi },
  { name: 'Generic Token', regex: /\btoken\s*[:=]\s*['"]?[^\s'"]{16,}/gi },
  { name: 'Generic Secret', regex: /\bsecret\s*[:=]\s*['"]?[^\s'"]{10,}/gi },
];

/**
 * Check if text contains sensitive data
 * @param {string} text - Text to check
 * @returns {Object} - { detected: boolean, matches: Array<{type, preview}> }
 */
export function containsSensitiveData(text) {
  if (!text || typeof text !== 'string') {
    return { detected: false, matches: [] };
  }

  const matches = [];

  for (const pattern of SECRET_PATTERNS) {
    const found = text.match(pattern.regex);
    if (found) {
      for (const match of found) {
        matches.push({
          type: pattern.name,
          preview: `${match.substring(0, 8)}...${match.substring(match.length - 4)}`,
          length: match.length
        });
      }
    }
  }

  return {
    detected: matches.length > 0,
    matches
  };
}

/**
 * Redact sensitive data from text for logging
 * @param {string} text - Text to redact
 * @returns {string} - Text with secrets redacted
 */
export function redactSecrets(text) {
  if (!text || typeof text !== 'string') {
    return text;
  }

  let redacted = text;

  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern.regex, (match) => {
      return `[REDACTED:${pattern.name}]`;
    });
  }

  return redacted;
}

// ============================================
// 3. Session Authorization
// ============================================

/**
 * Check if a Claude session is authorized to use MCP tools
 * @param {string} sessionId - Claude session ID (if available)
 * @param {string} workingDir - Working directory of Claude session (if available)
 * @returns {Object} - { authorized: boolean, reason: string }
 */
export function isAuthorizedSession(sessionId, workingDir) {
  // If allowlists are not configured, allow all
  const allowedSessionIds = process.env.ALLOWED_SESSION_IDS?.split(',').map(s => s.trim()).filter(Boolean) || [];
  const allowedWorkingDirs = process.env.ALLOWED_WORKING_DIRS?.split(',').map(s => s.trim()).filter(Boolean) || [];

  // If no restrictions configured, allow all
  if (allowedSessionIds.length === 0 && allowedWorkingDirs.length === 0) {
    return { authorized: true, reason: 'No restrictions configured' };
  }

  // Check session ID allowlist
  if (allowedSessionIds.length > 0) {
    if (!sessionId) {
      return {
        authorized: false,
        reason: 'Session ID required but not provided'
      };
    }

    if (allowedSessionIds.includes(sessionId)) {
      return { authorized: true, reason: 'Session ID in allowlist' };
    }
  }

  // Check working directory allowlist
  if (allowedWorkingDirs.length > 0) {
    if (!workingDir) {
      return {
        authorized: false,
        reason: 'Working directory required but not provided'
      };
    }

    // Check if workingDir is within any allowed directory
    const normalizedWorkingDir = path.normalize(workingDir);
    for (const allowedDir of allowedWorkingDirs) {
      const normalizedAllowedDir = path.normalize(allowedDir);
      if (normalizedWorkingDir === normalizedAllowedDir ||
          normalizedWorkingDir.startsWith(normalizedAllowedDir + path.sep)) {
        return { authorized: true, reason: 'Working directory in allowlist' };
      }
    }
  }

  // If we get here, session/directory not in any allowlist
  return {
    authorized: false,
    reason: `Session '${sessionId || 'unknown'}' or directory '${workingDir || 'unknown'}' not in allowlist`
  };
}

// ============================================
// 4. Queue Size Limits
// ============================================

/**
 * Check current queue size
 * @param {string} queueDir - Path to queue directory
 * @returns {Promise<Object>} - { size: number, limit: number, exceeded: boolean }
 */
export async function checkQueueSize(queueDir) {
  const limit = parseInt(process.env.MAX_QUEUE_SIZE || '100', 10);

  try {
    const outboundDir = path.join(queueDir, 'outbound');
    const files = await fs.readdir(outboundDir);

    // Count only .json files (ignore .gitkeep, .processing, etc.)
    const jsonFiles = files.filter(f => f.endsWith('.json'));
    const size = jsonFiles.length;

    return {
      size,
      limit,
      exceeded: size >= limit
    };
  } catch (error) {
    // If directory doesn't exist or can't be read, assume empty
    return {
      size: 0,
      limit,
      exceeded: false
    };
  }
}

// ============================================
// 5. Timeout Validation
// ============================================

/**
 * Validate and cap timeout value
 * @param {number} requestedTimeout - Requested timeout in seconds
 * @returns {number} - Validated timeout (capped at MAX_TIMEOUT_SECONDS)
 */
export function validateTimeout(requestedTimeout) {
  const maxTimeout = parseInt(process.env.MAX_TIMEOUT_SECONDS || '1800', 10); // 30 minutes default
  const defaultTimeout = 300; // 5 minutes

  if (!requestedTimeout || requestedTimeout <= 0) {
    return defaultTimeout;
  }

  return Math.min(requestedTimeout, maxTimeout);
}

// ============================================
// 6. Emergency Kill Switch
// ============================================

/**
 * Check if MCP bridge is disabled
 * @returns {boolean} - True if disabled
 */
export function isDisabled() {
  return process.env.MCP_TELEGRAM_DISABLED === 'true';
}

// ============================================
// 7. Export All Functions
// ============================================

export default {
  signMessage,
  verifyMessage,
  containsSensitiveData,
  redactSecrets,
  isAuthorizedSession,
  checkQueueSize,
  validateTimeout,
  isDisabled
};
