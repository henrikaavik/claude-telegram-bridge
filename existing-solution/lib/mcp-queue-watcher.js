import fs from 'fs/promises';
import path from 'path';
import chokidar from 'chokidar';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * MCP Queue Watcher - Bot-side processor for MCP messages
 * Watches outbound queue, sends to Telegram, writes responses to inbound queue
 */

export class MCPQueueWatcher {
  constructor(bot, i18n) {
    this.bot = bot;
    this.i18n = i18n;
    this.queueDir = null;
    this.watcher = null;
    this.pendingQuestions = new Map(); // correlationId -> { chatId, messageId }
    this.hmacSecret = null;
  }

  /**
   * Start watching the queue
   * @param {string} customQueueDir - Optional custom queue directory
   */
  async start(customQueueDir = null) {
    this.queueDir = customQueueDir || process.env.MCP_QUEUE_DIR;
    this.hmacSecret = process.env.QUEUE_HMAC_SECRET;

    if (!this.queueDir) {
      console.error('MCP_ENABLED but MCP_QUEUE_DIR not set, skipping MCP queue watcher');
      return;
    }

    if (!this.hmacSecret) {
      console.error('MCP_ENABLED but QUEUE_HMAC_SECRET not set, skipping MCP queue watcher');
      return;
    }

    // Ensure directories exist
    const outboundDir = path.join(this.queueDir, 'outbound');
    const inboundDir = path.join(this.queueDir, 'inbound');

    try {
      await fs.mkdir(outboundDir, { recursive: true });
      await fs.mkdir(inboundDir, { recursive: true });
    } catch (error) {
      console.error('Failed to create queue directories:', error);
      return;
    }

    // Start watching outbound directory
    this.watcher = chokidar.watch(path.join(outboundDir, '*.json'), {
      ignoreInitial: false,
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: 100,
        pollInterval: 50
      }
    });

    this.watcher.on('add', (filePath) => this.handleOutboundMessage(filePath));
    this.watcher.on('error', (error) => {
      console.error('MCP queue watcher error:', error);
    });

    console.log('✅ MCP queue watcher started');
  }

  /**
   * Verify HMAC signature
   */
  verifySignature(message, signature) {
    try {
      const hmac = crypto.createHmac('sha256', this.hmacSecret);
      hmac.update(JSON.stringify(message));
      const expectedSignature = hmac.digest('hex');

      return crypto.timingSafeEqual(
        Buffer.from(signature, 'hex'),
        Buffer.from(expectedSignature, 'hex')
      );
    } catch (error) {
      return false;
    }
  }

  /**
   * Sign a response message
   */
  signMessage(message) {
    const hmac = crypto.createHmac('sha256', this.hmacSecret);
    hmac.update(JSON.stringify(message));
    return hmac.digest('hex');
  }

  /**
   * Handle outbound message from MCP server
   */
  async handleOutboundMessage(filePath) {
    try {
      // Read message
      const data = await fs.readFile(filePath, 'utf-8');
      const signedMessage = JSON.parse(data);

      // Verify signature
      const { signature, ...message } = signedMessage;
      if (!this.verifySignature(message, signature)) {
        console.error('❌ Invalid signature on MCP message:', filePath);
        await fs.unlink(filePath);
        return;
      }

      const { type, chatId, payload, expectsResponse, correlationId } = message;

      // Process based on message type
      switch (type) {
        case 'notify':
          await this.handleNotify(chatId, payload);
          break;

        case 'ask':
          await this.handleAsk(chatId, payload, correlationId);
          break;

        case 'permission':
          await this.handlePermission(chatId, payload, correlationId);
          break;

        default:
          console.error('Unknown MCP message type:', type);
      }

      // Delete processed message
      await fs.unlink(filePath);

    } catch (error) {
      console.error('Error processing MCP message:', filePath, error);
      // Try to delete malformed file
      try {
        await fs.unlink(filePath);
      } catch (unlinkError) {
        // Ignore
      }
    }
  }

  /**
   * Handle notification message
   */
  async handleNotify(chatId, payload) {
    const { message, priority } = payload;

    // Format message based on priority
    let prefix = '';
    switch (priority) {
      case 'high':
        prefix = '⚠️ ';
        break;
      case 'urgent':
        prefix = '🚨 ';
        break;
      default:
        prefix = '🤖 ';
    }

    await this.bot.sendMessage(chatId, `${prefix}${message}`);
  }

  /**
   * Handle question message
   */
  async handleAsk(chatId, payload, correlationId) {
    const { message, options } = payload;

    // Send question
    const opts = {};

    if (options && Array.isArray(options)) {
      // Create inline keyboard with options
      opts.reply_markup = {
        inline_keyboard: [
          options.map(option => ({
            text: option,
            callback_data: `mcp_response:${correlationId}:${option}`
          }))
        ]
      };
    }

    const sentMessage = await this.bot.sendMessage(chatId, `❓ ${message}`, opts);

    // Store pending question
    this.pendingQuestions.set(correlationId, {
      chatId,
      messageId: sentMessage.message_id
    });
  }

  /**
   * Handle permission request message
   */
  async handlePermission(chatId, payload, correlationId) {
    const { operation, details, risk_level } = payload;

    // Format message based on risk level
    let emoji = '';
    switch (risk_level) {
      case 'critical':
        emoji = '🔴';
        break;
      case 'high':
        emoji = '⚠️';
        break;
      case 'medium':
        emoji = '🟡';
        break;
      default:
        emoji = '🟢';
    }

    let text = `${emoji} **Permission Request**\n\n`;
    text += `**Operation:** ${operation}\n`;
    text += `**Risk Level:** ${risk_level}\n`;

    if (details) {
      text += `\n**Details:**\n${JSON.stringify(details, null, 2)}`;
    }

    // Create approval buttons
    const opts = {
      reply_markup: {
        inline_keyboard: [[
          {
            text: '✅ Approve',
            callback_data: `mcp_response:${correlationId}:approve`
          },
          {
            text: '❌ Deny',
            callback_data: `mcp_response:${correlationId}:deny`
          }
        ]]
      },
      parse_mode: 'Markdown'
    };

    const sentMessage = await this.bot.sendMessage(chatId, text, opts);

    // Store pending question
    this.pendingQuestions.set(correlationId, {
      chatId,
      messageId: sentMessage.message_id
    });
  }

  /**
   * Handle user response to MCP question
   * Call this from the bot's callback_query handler
   */
  async handleUserResponse(callbackQuery) {
    const { data, message, from } = callbackQuery;

    // Check if this is an MCP response
    if (!data.startsWith('mcp_response:')) {
      return false; // Not an MCP response
    }

    // Parse callback data
    const parts = data.split(':');
    if (parts.length !== 3) {
      return false;
    }

    const correlationId = parts[1];
    const buttonClicked = parts[2];

    // Check if we have this pending question
    if (!this.pendingQuestions.has(correlationId)) {
      await this.bot.answerCallbackQuery(callbackQuery.id, {
        text: 'This question has expired or been answered already'
      });
      return true;
    }

    // Get pending question info
    const pending = this.pendingQuestions.get(correlationId);
    this.pendingQuestions.delete(correlationId);

    // Create response
    const response = {
      responseId: `resp_${Date.now()}`,
      correlationId,
      timestamp: new Date().toISOString(),
      chatId: message.chat.id.toString(),
      response: {
        text: buttonClicked,
        buttonClicked,
        approved: buttonClicked === 'approve',
        timedOut: false
      }
    };

    // Sign response
    const signature = this.signMessage(response);
    const signedResponse = {
      ...response,
      signature
    };

    // Write response to inbound queue
    const inboundDir = path.join(this.queueDir, 'inbound');
    const responseFile = path.join(inboundDir, `${response.responseId}.json`);
    await fs.writeFile(responseFile, JSON.stringify(signedResponse, null, 2), 'utf-8');

    // Answer callback query
    await this.bot.answerCallbackQuery(callbackQuery.id, {
      text: `Response sent: ${buttonClicked}`
    });

    // Edit original message to show it's been answered
    await this.bot.editMessageText(
      `${message.text}\n\n✅ **Answered:** ${buttonClicked}`,
      {
        chat_id: message.chat.id,
        message_id: message.message_id,
        parse_mode: 'Markdown'
      }
    );

    return true; // Handled
  }

  /**
   * Handle text response to pending question (no buttons)
   * Call this from the bot's message handler
   */
  async handleTextResponse(msg) {
    // Check if user has pending questions
    const chatId = msg.chat.id.toString();

    // Find any pending question for this chat
    for (const [correlationId, pending] of this.pendingQuestions.entries()) {
      if (pending.chatId.toString() === chatId) {
        // This text is likely a response to the pending question
        this.pendingQuestions.delete(correlationId);

        // Create response
        const response = {
          responseId: `resp_${Date.now()}`,
          correlationId,
          timestamp: new Date().toISOString(),
          chatId,
          response: {
            text: msg.text,
            timedOut: false
          }
        };

        // Sign response
        const signature = this.signMessage(response);
        const signedResponse = {
          ...response,
          signature
        };

        // Write response to inbound queue
        const inboundDir = path.join(this.queueDir, 'inbound');
        const responseFile = path.join(inboundDir, `${response.responseId}.json`);
        await fs.writeFile(responseFile, JSON.stringify(signedResponse, null, 2), 'utf-8');

        return true; // Handled
      }
    }

    return false; // Not a response to MCP question
  }

  /**
   * Stop watching
   */
  async stop() {
    if (this.watcher) {
      await this.watcher.close();
      this.watcher = null;
    }

    console.log('MCP queue watcher stopped');
  }
}

export default MCPQueueWatcher;
