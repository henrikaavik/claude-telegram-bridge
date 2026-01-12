#!/usr/bin/env node

import 'dotenv/config';
import { MCPHandler } from './lib/mcp-handler.js';
import * as tools from './lib/tools.js';
import * as sessionMapper from './lib/session-mapper.js';
import * as queueManager from './lib/queue-manager.js';

/**
 * MCP Telegram Notify Server
 * Allows Claude Code to send messages and ask questions via Telegram
 */

// Validate required environment variables
function validateEnvironment() {
  if (!process.env.TELEGRAM_CHAT_ID) {
    console.error('Error: TELEGRAM_CHAT_ID environment variable is required');
    process.exit(1);
  }

  if (!process.env.QUEUE_HMAC_SECRET) {
    console.error('Error: QUEUE_HMAC_SECRET environment variable is required');
    console.error('Generate one with: openssl rand -hex 32');
    process.exit(1);
  }
}

// Initialize the MCP server
async function initialize() {
  try {
    // Validate environment
    validateEnvironment();

    // Initialize session mapper
    await sessionMapper.initialize();

    // Initialize queue manager
    await queueManager.initialize();

    // Log to stderr (stdout is reserved for JSON-RPC)
    console.error('MCP Telegram Notify server initialized');
    console.error(`Chat ID: ${process.env.TELEGRAM_CHAT_ID}`);
    console.error(`Queue directory: ${process.env.TELEGRAM_QUEUE_DIR || './queue'}`);

    if (process.env.MCP_TELEGRAM_DISABLED === 'true') {
      console.error('WARNING: MCP bridge is disabled (MCP_TELEGRAM_DISABLED=true)');
    }

  } catch (error) {
    console.error('Initialization error:', error.message);
    process.exit(1);
  }
}

// Register MCP tools
function registerTools(handler) {
  // Tool 1: telegram_notify
  handler.registerTool(
    'telegram_notify',
    tools.telegramNotify,
    {
      description: 'Send a notification to Telegram (fire-and-forget, no response expected)',
      inputSchema: {
        type: 'object',
        properties: {
          message: {
            type: 'string',
            description: 'The message to send to the user'
          },
          priority: {
            type: 'string',
            enum: ['normal', 'high', 'urgent'],
            description: 'Priority level (affects formatting)',
            default: 'normal'
          },
          contextInfo: {
            type: 'string',
            description: 'Optional context about what Claude is working on'
          }
        },
        required: ['message']
      }
    }
  );

  // Tool 2: telegram_ask
  handler.registerTool(
    'telegram_ask',
    tools.telegramAsk,
    {
      description: 'Ask the user a question via Telegram and wait for response (blocking)',
      inputSchema: {
        type: 'object',
        properties: {
          question: {
            type: 'string',
            description: 'The question to ask the user'
          },
          timeout_seconds: {
            type: 'integer',
            description: 'How long to wait for response (30s-1800s)',
            minimum: 30,
            maximum: 1800,
            default: 300
          },
          options: {
            type: 'array',
            items: { type: 'string' },
            maxItems: 4,
            description: 'Optional quick reply buttons (max 4)'
          },
          contextInfo: {
            type: 'string',
            description: 'Additional context about why asking'
          }
        },
        required: ['question']
      }
    }
  );

  // Tool 3: telegram_request_permission
  handler.registerTool(
    'telegram_request_permission',
    tools.telegramRequestPermission,
    {
      description: 'Request user permission/approval for an operation via Telegram',
      inputSchema: {
        type: 'object',
        properties: {
          operation: {
            type: 'string',
            description: 'What operation needs approval'
          },
          details: {
            type: 'object',
            description: 'Structured details about the operation'
          },
          risk_level: {
            type: 'string',
            enum: ['low', 'medium', 'high', 'critical'],
            description: 'Risk assessment of the operation'
          },
          timeout_seconds: {
            type: 'integer',
            description: 'How long to wait for approval (30s-1800s)',
            minimum: 30,
            maximum: 1800,
            default: 300
          }
        },
        required: ['operation', 'risk_level']
      }
    }
  );

  // Tool 4: telegram_get_session_status
  handler.registerTool(
    'telegram_get_session_status',
    tools.telegramGetSessionStatus,
    {
      description: 'Check if Telegram bridge is available and get status information',
      inputSchema: {
        type: 'object',
        properties: {}
      }
    }
  );

  console.error('Registered 4 MCP tools');
}

// Main entry point
async function main() {
  // Initialize
  await initialize();

  // Create MCP handler
  const handler = new MCPHandler();

  // Register tools
  registerTools(handler);

  // Graceful shutdown
  const cleanup = async () => {
    console.error('Shutting down...');
    handler.stop();
    await queueManager.cleanup();
    process.exit(0);
  };

  process.on('SIGINT', cleanup);
  process.on('SIGTERM', cleanup);

  // Start listening
  console.error('MCP server ready. Listening on stdin...');
  handler.start();
}

// Run
main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
