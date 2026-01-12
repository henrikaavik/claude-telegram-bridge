/**
 * Session Manager for Multi-Session Support
 * Manages multiple parallel Claude Code sessions per user
 */

import { spawn } from 'child_process';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================
// SESSION STORAGE
// ============================================

const SESSION_FILE = path.join(__dirname, '../../data/sessions.json');

// Ensure data directory exists
const dataDir = path.dirname(SESSION_FILE);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// ============================================
// SESSION MANAGER CLASS
// ============================================

export class SessionManager {
  constructor() {
    // Map: sessionKey (chatId:name) -> Session object
    this.sessions = new Map();

    // Map: chatId -> currentSessionName
    this.currentSessions = new Map();

    // Load persisted sessions
    this.loadSessions();
  }

  // ==========================================
  // SESSION KEY GENERATION
  // ==========================================

  /**
   * Generate session key
   * @param {number} chatId - Telegram chat ID
   * @param {string} name - Session name
   * @returns {string} - Session key
   */
  getSessionKey(chatId, name) {
    return `${chatId}:${name}`;
  }

  // ==========================================
  // SESSION CREATION
  // ==========================================

  /**
   * Create a new session
   * @param {number} chatId - Telegram chat ID
   * @param {string} name - Session name
   * @param {string} workspacePath - Workspace directory path
   * @param {Object} config - Claude Code configuration
   * @returns {Object} - Created session
   */
  createSession(chatId, name, workspacePath, config = {}) {
    const sessionKey = this.getSessionKey(chatId, name);

    // Check if session already exists
    if (this.sessions.has(sessionKey)) {
      throw new Error(`Session "${name}" already exists. Use /switch to switch to it or /kill to remove it.`);
    }

    // Validate workspace path
    if (!fs.existsSync(workspacePath)) {
      throw new Error(`Workspace path does not exist: ${workspacePath}`);
    }

    // Generate session ID
    const sessionId = crypto.randomUUID();

    // Create Claude Code process
    const claudeCmd = process.platform === 'win32' && !config.claudeCodePath?.endsWith('.cmd')
      ? (config.claudeCodePath || 'claude') + '.cmd'
      : (config.claudeCodePath || 'claude');

    const args = [
      '--print',
      '--verbose',
      '--input-format', 'stream-json',
      '--output-format', 'stream-json',
      '--include-partial-messages',
      '--replay-user-messages',
      '--session-id', sessionId
      // Note: --dangerously-skip-permissions removed for security
    ];

    const claudeProcess = spawn(claudeCmd, args, {
      cwd: workspacePath,
      shell: true,
      windowsHide: true
    });

    // Create session object
    const session = {
      name,
      sessionId,
      chatId,
      workspacePath,
      process: claudeProcess,
      buffer: '',
      active: true,
      messageBuffer: new Map(),
      createdAt: new Date().toISOString(),
      lastActivity: new Date().toISOString(),
      messageCount: 0
    };

    // Store session
    this.sessions.set(sessionKey, session);

    // Set as current if it's the first session for this user
    if (!this.currentSessions.has(chatId)) {
      this.currentSessions.set(chatId, name);
    }

    // Persist sessions
    this.saveSessions();

    return session;
  }

  // ==========================================
  // SESSION RETRIEVAL
  // ==========================================

  /**
   * Get current session for a user
   * @param {number} chatId - Telegram chat ID
   * @returns {Object|null} - Current session or null
   */
  getCurrentSession(chatId) {
    const sessionName = this.currentSessions.get(chatId);
    if (!sessionName) {
      return null;
    }

    const sessionKey = this.getSessionKey(chatId, sessionName);
    return this.sessions.get(sessionKey) || null;
  }

  /**
   * Get a specific session by name
   * @param {number} chatId - Telegram chat ID
   * @param {string} name - Session name
   * @returns {Object|null} - Session or null
   */
  getSession(chatId, name) {
    const sessionKey = this.getSessionKey(chatId, name);
    return this.sessions.get(sessionKey) || null;
  }

  /**
   * Get all sessions for a user
   * @param {number} chatId - Telegram chat ID
   * @returns {Array} - Array of sessions
   */
  getAllSessions(chatId) {
    const userSessions = [];

    for (const [key, session] of this.sessions.entries()) {
      if (session.chatId === chatId) {
        userSessions.push(session);
      }
    }

    return userSessions;
  }

  // ==========================================
  // SESSION SWITCHING
  // ==========================================

  /**
   * Switch to a different session
   * @param {number} chatId - Telegram chat ID
   * @param {string} name - Session name to switch to
   * @returns {Object} - The session switched to
   */
  switchSession(chatId, name) {
    const sessionKey = this.getSessionKey(chatId, name);

    if (!this.sessions.has(sessionKey)) {
      throw new Error(`Session "${name}" not found. Use /sessions to see available sessions.`);
    }

    const session = this.sessions.get(sessionKey);

    if (!session.active) {
      throw new Error(`Session "${name}" is not active. It may have crashed or been terminated.`);
    }

    this.currentSessions.set(chatId, name);
    session.lastActivity = new Date().toISOString();

    this.saveSessions();

    return session;
  }

  // ==========================================
  // SESSION TERMINATION
  // ==========================================

  /**
   * Kill a session
   * @param {number} chatId - Telegram chat ID
   * @param {string} name - Session name
   * @returns {boolean} - Success
   */
  killSession(chatId, name) {
    const sessionKey = this.getSessionKey(chatId, name);

    if (!this.sessions.has(sessionKey)) {
      throw new Error(`Session "${name}" not found.`);
    }

    const session = this.sessions.get(sessionKey);

    // Kill the Claude Code process
    try {
      session.process.kill('SIGTERM');
      session.active = false;
    } catch (error) {
      console.error(`Error killing session ${name}:`, error);
    }

    // Remove from sessions
    this.sessions.delete(sessionKey);

    // If this was the current session, clear it
    if (this.currentSessions.get(chatId) === name) {
      this.currentSessions.delete(chatId);

      // Switch to another session if available
      const remainingSessions = this.getAllSessions(chatId);
      if (remainingSessions.length > 0) {
        this.currentSessions.set(chatId, remainingSessions[0].name);
      }
    }

    this.saveSessions();

    return true;
  }

  /**
   * Kill all sessions for a user
   * @param {number} chatId - Telegram chat ID
   * @returns {number} - Number of sessions killed
   */
  killAllSessions(chatId) {
    const userSessions = this.getAllSessions(chatId);
    let count = 0;

    for (const session of userSessions) {
      try {
        this.killSession(chatId, session.name);
        count++;
      } catch (error) {
        console.error(`Error killing session ${session.name}:`, error);
      }
    }

    return count;
  }

  // ==========================================
  // SESSION STATUS
  // ==========================================

  /**
   * Check if a session is active
   * @param {number} chatId - Telegram chat ID
   * @param {string} name - Session name
   * @returns {boolean} - Active status
   */
  isSessionActive(chatId, name) {
    const session = this.getSession(chatId, name);
    return session ? session.active : false;
  }

  /**
   * Get current session name
   * @param {number} chatId - Telegram chat ID
   * @returns {string|null} - Current session name or null
   */
  getCurrentSessionName(chatId) {
    return this.currentSessions.get(chatId) || null;
  }

  /**
   * Update session activity
   * @param {number} chatId - Telegram chat ID
   * @param {string} name - Session name
   */
  updateActivity(chatId, name = null) {
    const sessionName = name || this.getCurrentSessionName(chatId);
    if (!sessionName) return;

    const session = this.getSession(chatId, sessionName);
    if (session) {
      session.lastActivity = new Date().toISOString();
      session.messageCount++;
      this.saveSessions();
    }
  }

  // ==========================================
  // PERSISTENCE
  // ==========================================

  /**
   * Save sessions to disk
   */
  saveSessions() {
    try {
      const data = {
        sessions: Array.from(this.sessions.entries()).map(([key, session]) => ({
          key,
          name: session.name,
          sessionId: session.sessionId,
          chatId: session.chatId,
          workspacePath: session.workspacePath,
          createdAt: session.createdAt,
          lastActivity: session.lastActivity,
          messageCount: session.messageCount,
          active: session.active
        })),
        currentSessions: Array.from(this.currentSessions.entries())
      };

      fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2), 'utf8');
    } catch (error) {
      console.error('Error saving sessions:', error);
    }
  }

  /**
   * Load sessions from disk
   */
  loadSessions() {
    try {
      if (!fs.existsSync(SESSION_FILE)) {
        return;
      }

      const data = JSON.parse(fs.readFileSync(SESSION_FILE, 'utf8'));

      // Load current sessions map
      if (data.currentSessions) {
        this.currentSessions = new Map(data.currentSessions);
      }

      // Note: We don't restore the actual Claude Code processes on load
      // They need to be recreated when the user sends a new message
      // We just load the metadata
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  }

  // ==========================================
  // UTILITIES
  // ==========================================

  /**
   * Get session count for a user
   * @param {number} chatId - Telegram chat ID
   * @returns {number} - Number of sessions
   */
  getSessionCount(chatId) {
    return this.getAllSessions(chatId).length;
  }

  /**
   * Check if user has any sessions
   * @param {number} chatId - Telegram chat ID
   * @returns {boolean}
   */
  hasSessions(chatId) {
    return this.getSessionCount(chatId) > 0;
  }

  /**
   * Get session statistics
   * @returns {Object} - Statistics
   */
  getStats() {
    return {
      totalSessions: this.sessions.size,
      activeUsers: new Set(Array.from(this.sessions.values()).map(s => s.chatId)).size,
      sessionsPerUser: {}
    };
  }
}

// ============================================
// SINGLETON EXPORT
// ============================================

const sessionManager = new SessionManager();

export default sessionManager;
