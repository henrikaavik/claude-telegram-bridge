#!/usr/bin/env node

/**
 * Telegram Bot Manager - Control bot lifecycle from Claude Code
 * This script is called by the Claude Code plugin to start/stop/status the bot
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
const envPath = path.join(__dirname, '../.env');
dotenv.config({ path: envPath });

// ============================================
// CONFIGURATION
// ============================================

const BOT_SCRIPT = path.join(__dirname, '../index.js');
const PID_FILE = path.join(__dirname, '.telegram-bot.pid');
const LOG_FILE = path.join(__dirname, '../logs/bot.log');
const TELEGRAM_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const AUTHORIZED_CHAT_ID = process.env.AUTHORIZED_CHAT_ID;

// Ensure logs directory exists
const logsDir = path.dirname(LOG_FILE);
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// ============================================
// PID MANAGEMENT
// ============================================

function savePid(pid) {
  fs.writeFileSync(PID_FILE, pid.toString(), 'utf8');
}

function loadPid() {
  if (fs.existsSync(PID_FILE)) {
    return parseInt(fs.readFileSync(PID_FILE, 'utf8'), 10);
  }
  return null;
}

function clearPid() {
  if (fs.existsSync(PID_FILE)) {
    fs.unlinkSync(PID_FILE);
  }
}

function isProcessRunning(pid) {
  try {
    // Signal 0 checks if process exists without killing it
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return false;
  }
}

// ============================================
// BOT CONTROL
// ============================================

function startBot(workingDir = null) {
  const existingPid = loadPid();

  if (existingPid && isProcessRunning(existingPid)) {
    console.log('❌ Bot is already running');
    console.log(`📊 PID: ${existingPid}`);
    console.log('💡 Use "stop_telegram_bot" to stop it first');
    return;
  }

  // Clean up stale PID file
  if (existingPid) {
    clearPid();
  }

  console.log('🚀 Starting Telegram bot...');

  const cwd = workingDir || path.dirname(BOT_SCRIPT);

  // Spawn bot process
  const botProcess = spawn('node', [BOT_SCRIPT], {
    cwd,
    detached: true,
    stdio: ['ignore', 'pipe', 'pipe']
  });

  // Save PID
  savePid(botProcess.pid);

  // Stream output to log file
  const logStream = fs.createWriteStream(LOG_FILE, { flags: 'a' });

  botProcess.stdout.pipe(logStream);
  botProcess.stderr.pipe(logStream);

  // Log start event
  logStream.write(`\n\n${'='.repeat(60)}\n`);
  logStream.write(`🚀 Bot started at ${new Date().toISOString()}\n`);
  logStream.write(`📊 PID: ${botProcess.pid}\n`);
  logStream.write(`${'='.repeat(60)}\n\n`);

  // Detach the process so it continues after this script exits
  botProcess.unref();

  console.log('✅ Bot started successfully');
  console.log(`📊 PID: ${botProcess.pid}`);
  console.log(`📄 Logs: ${LOG_FILE}`);
  console.log(`💡 Use "telegram_bot_status" to check status`);
  console.log(`💡 Use "stop_telegram_bot" to stop it`);
}

function stopBot() {
  const pid = loadPid();

  if (!pid) {
    console.log('❌ Bot is not running (no PID file found)');
    return;
  }

  if (!isProcessRunning(pid)) {
    console.log('❌ Bot is not running (process not found)');
    clearPid();
    return;
  }

  console.log(`🛑 Stopping bot (PID: ${pid})...`);

  try {
    // Send SIGTERM for graceful shutdown
    process.kill(pid, 'SIGTERM');

    // Wait a bit and check if it stopped
    setTimeout(() => {
      if (!isProcessRunning(pid)) {
        clearPid();
        console.log('✅ Bot stopped successfully');
      } else {
        // If still running, force kill
        console.log('⚠️ Bot did not stop gracefully, forcing...');
        process.kill(pid, 'SIGKILL');
        clearPid();
        console.log('✅ Bot forcefully stopped');
      }
    }, 2000);
  } catch (error) {
    console.error('❌ Error stopping bot:', error.message);
    clearPid();
  }
}

function getStatus() {
  const pid = loadPid();

  if (!pid) {
    console.log('📊 **Bot Status**: Not Running');
    console.log('💡 Use "start_telegram_bot" to start it');
    return;
  }

  const isRunning = isProcessRunning(pid);

  if (isRunning) {
    console.log('📊 **Bot Status**: Running ✅');
    console.log(`📊 PID: ${pid}`);

    // Get uptime from log file
    if (fs.existsSync(LOG_FILE)) {
      const logContent = fs.readFileSync(LOG_FILE, 'utf8');
      const lines = logContent.split('\n');

      // Find last start time
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].includes('Bot started at')) {
          const match = lines[i].match(/Bot started at (.+)/);
          if (match) {
            const startTime = new Date(match[1]);
            const uptime = Date.now() - startTime.getTime();
            const hours = Math.floor(uptime / (1000 * 60 * 60));
            const minutes = Math.floor((uptime % (1000 * 60 * 60)) / (1000 * 60));

            console.log(`⏱️  Uptime: ${hours}h ${minutes}m`);
            break;
          }
        }
      }
    }

    console.log(`📄 Logs: ${LOG_FILE}`);
    console.log('💡 Use "stop_telegram_bot" to stop it');
  } else {
    console.log('📊 **Bot Status**: Not Running');
    console.log('⚠️ Stale PID file found, cleaning up...');
    clearPid();
    console.log('💡 Use "start_telegram_bot" to start it');
  }
}

function restartBot() {
  console.log('🔄 Restarting bot...');
  stopBot();

  // Wait for stop to complete
  setTimeout(() => {
    startBot();
  }, 3000);
}

// ============================================
// NOTIFICATION SYSTEM
// ============================================

async function sendNotification(message, chatId = null, priority = 'normal') {
  if (!TELEGRAM_TOKEN) {
    console.error('❌ TELEGRAM_BOT_TOKEN not configured in .env');
    return;
  }

  const targetChatId = chatId || AUTHORIZED_CHAT_ID;

  if (!targetChatId) {
    console.error('❌ No chat ID provided and AUTHORIZED_CHAT_ID not configured');
    return;
  }

  // Format message based on priority
  let formattedMessage = message;
  if (priority === 'high') {
    formattedMessage = `⚠️ **HIGH PRIORITY**\n\n${message}`;
  } else if (priority === 'urgent') {
    formattedMessage = `🚨 **URGENT**\n\n${message}`;
  } else {
    formattedMessage = `💬 **Notification**\n\n${message}`;
  }

  formattedMessage += `\n\n_Sent from Claude Code at ${new Date().toLocaleString()}_`;

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${TELEGRAM_TOKEN}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: formattedMessage,
          parse_mode: 'Markdown'
        })
      }
    );

    const result = await response.json();

    if (result.ok) {
      console.log('✅ Notification sent successfully');
    } else {
      console.error('❌ Failed to send notification:', result.description);
    }
  } catch (error) {
    console.error('❌ Error sending notification:', error.message);
  }
}

// ============================================
// SESSION LISTING
// ============================================

function listSessions() {
  // Read session data from SessionManager's persistence file
  const sessionFile = path.join(__dirname, '../data/sessions.json');

  if (!fs.existsSync(sessionFile)) {
    console.log('📋 No sessions found');
    return;
  }

  try {
    const data = JSON.parse(fs.readFileSync(sessionFile, 'utf8'));

    if (!data.sessions || data.sessions.length === 0) {
      console.log('📋 No sessions found');
      return;
    }

    console.log(`📋 **Active Sessions** (${data.sessions.length})\n`);

    for (const session of data.sessions) {
      const status = session.active ? '🟢' : '🔴';
      const isCurrent = data.currentSessions?.find(([_, name]) => name === session.name);
      const currentMarker = isCurrent ? ' ⭐️' : '';

      console.log(`${status} **${session.name}**${currentMarker}`);
      console.log(`   Chat ID: ${session.chatId}`);
      console.log(`   Workspace: ${session.workspacePath}`);
      console.log(`   Messages: ${session.messageCount}`);
      console.log(`   Last Active: ${new Date(session.lastActivity).toLocaleString()}`);
      console.log('');
    }
  } catch (error) {
    console.error('❌ Error reading sessions:', error.message);
  }
}

// ============================================
// CLEANUP
// ============================================

function cleanup() {
  // This is called when Claude Code exits
  // We don't stop the bot here since it should keep running
  console.log('🧹 Plugin cleanup completed');
}

// ============================================
// COMMAND DISPATCHER
// ============================================

const command = process.argv[2];
const args = process.argv.slice(3);

switch (command) {
  case 'start':
    startBot(args[0]);
    break;

  case 'stop':
    stopBot();
    break;

  case 'status':
    getStatus();
    break;

  case 'restart':
    restartBot();
    break;

  case 'notify':
    // Parse JSON input from stdin (passed by Claude Code)
    let notifyInput = '';
    process.stdin.on('data', chunk => {
      notifyInput += chunk;
    });
    process.stdin.on('end', () => {
      try {
        const data = JSON.parse(notifyInput);
        sendNotification(data.message, data.chat_id, data.priority);
      } catch (error) {
        console.error('❌ Invalid input:', error.message);
      }
    });
    break;

  case 'sessions':
    listSessions();
    break;

  case 'cleanup':
    cleanup();
    break;

  default:
    console.log('❌ Unknown command:', command);
    console.log('Available commands: start, stop, status, restart, notify, sessions, cleanup');
    process.exit(1);
}
