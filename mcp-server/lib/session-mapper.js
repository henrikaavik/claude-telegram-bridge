import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

/**
 * Session Mapper - Maps Claude session IDs to Telegram chat IDs
 */

// Get script directory for resolving relative paths
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let config = null;
let configPath = null;

/**
 * Initialize session mapper
 * @param {string} customPath - Optional custom config file path
 */
export async function initialize(customPath = null) {
  // Use absolute path for config file
  configPath = customPath || process.env.MCP_CONFIG_FILE || path.join(__dirname, '../config/mcp-config.json');

  try {
    const configData = await fs.readFile(configPath, 'utf-8');
    config = JSON.parse(configData);
  } catch (error) {
    // Config doesn't exist, create default
    config = {
      version: '1.0',
      defaultChatId: process.env.TELEGRAM_CHAT_ID || null,
      sessions: []
    };

    // Try to save default config
    try {
      await saveConfig();
    } catch (saveError) {
      console.warn('Could not save default config:', saveError.message);
    }
  }

  if (!config.defaultChatId) {
    throw new Error('TELEGRAM_CHAT_ID environment variable is required');
  }
}

/**
 * Save config to file
 */
async function saveConfig() {
  if (!configPath) {
    throw new Error('Session mapper not initialized');
  }

  // Ensure directory exists
  const dir = path.dirname(configPath);
  await fs.mkdir(dir, { recursive: true });

  await fs.writeFile(configPath, JSON.stringify(config, null, 2), 'utf-8');
}

/**
 * Get Telegram chat ID for a Claude session
 * @param {string} sessionId - Claude session ID (optional)
 * @param {string} workingDir - Working directory (optional)
 * @returns {string} - Telegram chat ID
 */
export function getChatId(sessionId = null, workingDir = null) {
  if (!config) {
    throw new Error('Session mapper not initialized. Call initialize() first.');
  }

  // Try to find existing mapping by session ID
  if (sessionId) {
    const session = config.sessions.find(s => s.claudeSessionId === sessionId);
    if (session) {
      return session.telegramChatId;
    }
  }

  // Try to find existing mapping by working directory
  if (workingDir) {
    const normalizedWorkingDir = path.normalize(workingDir);
    const session = config.sessions.find(s =>
      path.normalize(s.workingDir) === normalizedWorkingDir
    );
    if (session) {
      return session.telegramChatId;
    }
  }

  // Return default chat ID
  return config.defaultChatId;
}

/**
 * Register a new session mapping
 * @param {string} sessionId - Claude session ID
 * @param {string} workingDir - Working directory
 * @param {string} chatId - Telegram chat ID (optional, uses default if not provided)
 * @returns {Promise<void>}
 */
export async function registerSession(sessionId, workingDir, chatId = null) {
  if (!config) {
    throw new Error('Session mapper not initialized');
  }

  const telegramChatId = chatId || config.defaultChatId;

  // Check if session already exists
  const existingIndex = config.sessions.findIndex(s =>
    s.claudeSessionId === sessionId
  );

  const sessionData = {
    claudeSessionId: sessionId,
    telegramChatId,
    workingDir: workingDir || 'unknown',
    createdAt: new Date().toISOString(),
    lastActivity: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    // Update existing session
    config.sessions[existingIndex] = {
      ...config.sessions[existingIndex],
      ...sessionData
    };
  } else {
    // Add new session
    config.sessions.push(sessionData);
  }

  // Save config
  await saveConfig();
}

/**
 * Update last activity timestamp for a session
 * @param {string} sessionId - Claude session ID
 * @returns {Promise<void>}
 */
export async function updateActivity(sessionId) {
  if (!config) {
    return;
  }

  const session = config.sessions.find(s => s.claudeSessionId === sessionId);
  if (session) {
    session.lastActivity = new Date().toISOString();
    await saveConfig();
  }
}

/**
 * Clean up old sessions (older than 7 days)
 * @returns {Promise<number>} - Number of sessions removed
 */
export async function cleanupOldSessions() {
  if (!config) {
    return 0;
  }

  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

  const initialCount = config.sessions.length;

  config.sessions = config.sessions.filter(session => {
    const lastActivity = new Date(session.lastActivity);
    return lastActivity > sevenDaysAgo;
  });

  const removed = initialCount - config.sessions.length;

  if (removed > 0) {
    await saveConfig();
  }

  return removed;
}

/**
 * Get all sessions
 * @returns {Array} - Array of session objects
 */
export function getAllSessions() {
  if (!config) {
    return [];
  }

  return [...config.sessions];
}

/**
 * Get default chat ID
 * @returns {string} - Default Telegram chat ID
 */
export function getDefaultChatId() {
  if (!config) {
    throw new Error('Session mapper not initialized');
  }

  return config.defaultChatId;
}

export default {
  initialize,
  getChatId,
  registerSession,
  updateActivity,
  cleanupOldSessions,
  getAllSessions,
  getDefaultChatId
};
