import fs from 'fs/promises';
import path from 'path';
import chokidar from 'chokidar';
import { v4 as uuidv4 } from 'uuid';
import { signMessage, verifyMessage } from './security.js';

/**
 * Queue Manager - Handles message queue operations
 */

let queueDir = null;
let watcher = null;
let pendingRequests = new Map(); // correlationId -> { resolve, reject, timer }

/**
 * Initialize queue manager
 * @param {string} customQueueDir - Optional custom queue directory
 */
export async function initialize(customQueueDir = null) {
  queueDir = customQueueDir || process.env.TELEGRAM_QUEUE_DIR || './queue';

  // Ensure directories exist
  await fs.mkdir(path.join(queueDir, 'outbound'), { recursive: true });
  await fs.mkdir(path.join(queueDir, 'inbound'), { recursive: true });

  // Start watching inbound directory
  startWatching();
}

/**
 * Start watching inbound directory for responses
 */
function startWatching() {
  if (watcher) {
    return; // Already watching
  }

  const inboundDir = path.join(queueDir, 'inbound');

  watcher = chokidar.watch(path.join(inboundDir, '*.json'), {
    ignoreInitial: false,
    persistent: true,
    awaitWriteFinish: {
      stabilityThreshold: 100,
      pollInterval: 50
    }
  });

  watcher.on('add', handleInboundMessage);
  watcher.on('error', error => {
    console.error('Inbound queue watcher error:', error);
  });
}

/**
 * Handle incoming response from bot
 * @param {string} filePath - Path to response file
 */
async function handleInboundMessage(filePath) {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    const response = JSON.parse(data);

    // Verify signature
    const { signature, ...messageWithoutSig } = response;
    if (!verifyMessage(messageWithoutSig, signature)) {
      console.error('Invalid signature on inbound message:', filePath);
      await fs.unlink(filePath); // Delete invalid message
      return;
    }

    const { correlationId } = response;

    // Find pending request
    const pending = pendingRequests.get(correlationId);
    if (pending) {
      // Clear timeout
      if (pending.timer) {
        clearTimeout(pending.timer);
      }

      // Resolve promise
      pending.resolve(response);

      // Clean up
      pendingRequests.delete(correlationId);
    }

    // Delete processed response file
    await fs.unlink(filePath);
  } catch (error) {
    console.error('Error processing inbound message:', filePath, error);
    // Try to delete malformed file
    try {
      await fs.unlink(filePath);
    } catch (unlinkError) {
      // Ignore unlink errors
    }
  }
}

/**
 * Write a message to the outbound queue
 * @param {Object} message - Message object
 * @returns {Promise<string>} - Message ID
 */
export async function sendMessage(message) {
  if (!queueDir) {
    throw new Error('Queue manager not initialized');
  }

  const messageId = message.messageId || `msg_${uuidv4()}`;
  const messageWithId = {
    ...message,
    messageId,
    timestamp: message.timestamp || new Date().toISOString()
  };

  // Sign the message
  const signature = signMessage(messageWithId);
  const signedMessage = {
    ...messageWithId,
    signature
  };

  // Write to outbound directory
  const outboundDir = path.join(queueDir, 'outbound');
  const filePath = path.join(outboundDir, `${messageId}.json`);

  await fs.writeFile(filePath, JSON.stringify(signedMessage, null, 2), 'utf-8');

  return messageId;
}

/**
 * Send a message and wait for response
 * @param {Object} message - Message object
 * @param {number} timeoutMs - Timeout in milliseconds
 * @returns {Promise<Object>} - Response object
 */
export async function sendAndWaitForResponse(message, timeoutMs = 300000) {
  if (!queueDir) {
    throw new Error('Queue manager not initialized');
  }

  const correlationId = message.correlationId || `req_${uuidv4()}`;
  const messageWithCorrelation = {
    ...message,
    correlationId,
    expectsResponse: true
  };

  // Create promise for response
  const responsePromise = new Promise((resolve, reject) => {
    // Set timeout
    const timer = setTimeout(() => {
      pendingRequests.delete(correlationId);
      resolve({
        success: false,
        timedOut: true,
        error: `No response received within ${timeoutMs / 1000} seconds`
      });
    }, timeoutMs);

    // Store pending request
    pendingRequests.set(correlationId, { resolve, reject, timer });
  });

  // Send message
  await sendMessage(messageWithCorrelation);

  // Wait for response
  return responsePromise;
}

/**
 * Get count of pending messages in outbound queue
 * @returns {Promise<number>} - Number of pending messages
 */
export async function getPendingMessageCount() {
  if (!queueDir) {
    return 0;
  }

  try {
    const outboundDir = path.join(queueDir, 'outbound');
    const files = await fs.readdir(outboundDir);
    return files.filter(f => f.endsWith('.json')).length;
  } catch (error) {
    return 0;
  }
}

/**
 * Get count of pending requests waiting for response
 * @returns {number} - Number of pending requests
 */
export function getPendingRequestCount() {
  return pendingRequests.size;
}

/**
 * Cleanup: Stop watching and clear pending requests
 */
export async function cleanup() {
  if (watcher) {
    await watcher.close();
    watcher = null;
  }

  // Clear all pending requests with error
  for (const [correlationId, pending] of pendingRequests.entries()) {
    if (pending.timer) {
      clearTimeout(pending.timer);
    }
    pending.reject(new Error('Queue manager shutting down'));
  }

  pendingRequests.clear();
}

export default {
  initialize,
  sendMessage,
  sendAndWaitForResponse,
  getPendingMessageCount,
  getPendingRequestCount,
  cleanup
};
