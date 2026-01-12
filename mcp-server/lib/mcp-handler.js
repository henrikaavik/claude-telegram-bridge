import readline from 'readline';

/**
 * MCP Handler - JSON-RPC 2.0 protocol handler for stdio communication
 */

export class MCPHandler {
  constructor() {
    this.tools = new Map();
    this.rl = null;
  }

  /**
   * Register a tool
   * @param {string} name - Tool name
   * @param {Function} handler - Tool handler function
   * @param {Object} schema - Tool input schema
   */
  registerTool(name, handler, schema) {
    this.tools.set(name, { handler, schema });
  }

  /**
   * Start listening on stdin
   */
  start() {
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      terminal: false
    });

    this.rl.on('line', async (line) => {
      try {
        const request = JSON.parse(line);
        const response = await this.handleRequest(request);
        this.sendResponse(response);
      } catch (error) {
        this.sendError(null, -32700, 'Parse error', error.message);
      }
    });

    this.rl.on('close', () => {
      process.exit(0);
    });
  }

  /**
   * Handle JSON-RPC request
   * @param {Object} request - JSON-RPC request object
   * @returns {Promise<Object>} - JSON-RPC response object
   */
  async handleRequest(request) {
    const { jsonrpc, id, method, params } = request;

    // Validate JSON-RPC version
    if (jsonrpc !== '2.0') {
      return this.createErrorResponse(id, -32600, 'Invalid Request', 'jsonrpc must be "2.0"');
    }

    // Handle different methods
    switch (method) {
      case 'initialize':
        return this.handleInitialize(id, params);

      case 'tools/list':
        return this.handleToolsList(id);

      case 'tools/call':
        return await this.handleToolsCall(id, params);

      case 'ping':
        return this.createSuccessResponse(id, { status: 'ok' });

      default:
        return this.createErrorResponse(id, -32601, 'Method not found', `Unknown method: ${method}`);
    }
  }

  /**
   * Handle initialize request
   */
  handleInitialize(id, params) {
    return this.createSuccessResponse(id, {
      protocolVersion: '2024-11-05',
      serverInfo: {
        name: 'mcp-telegram-notify',
        version: '1.0.0'
      },
      capabilities: {
        tools: {}
      }
    });
  }

  /**
   * Handle tools/list request
   */
  handleToolsList(id) {
    const tools = [];

    for (const [name, { schema }] of this.tools.entries()) {
      tools.push({
        name,
        description: schema.description || '',
        inputSchema: schema.inputSchema || {
          type: 'object',
          properties: {},
          required: []
        }
      });
    }

    return this.createSuccessResponse(id, { tools });
  }

  /**
   * Handle tools/call request
   */
  async handleToolsCall(id, params) {
    const { name, arguments: args } = params;

    const tool = this.tools.get(name);
    if (!tool) {
      return this.createErrorResponse(id, -32602, 'Invalid params', `Tool not found: ${name}`);
    }

    try {
      // Extract context from args if available
      const context = {
        sessionId: args._sessionId || 'unknown',
        workingDir: args._workingDir || null
      };

      // Remove internal context fields from args
      const { _sessionId, _workingDir, ...toolArgs } = args;

      // Call tool handler
      const result = await tool.handler(toolArgs, context);

      // Return result
      return this.createSuccessResponse(id, {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2)
          }
        ]
      });
    } catch (error) {
      return this.createErrorResponse(id, -32603, 'Internal error', error.message);
    }
  }

  /**
   * Create success response
   */
  createSuccessResponse(id, result) {
    return {
      jsonrpc: '2.0',
      id,
      result
    };
  }

  /**
   * Create error response
   */
  createErrorResponse(id, code, message, data = null) {
    const response = {
      jsonrpc: '2.0',
      id,
      error: {
        code,
        message
      }
    };

    if (data) {
      response.error.data = data;
    }

    return response;
  }

  /**
   * Send response to stdout
   */
  sendResponse(response) {
    console.log(JSON.stringify(response));
  }

  /**
   * Send error response
   */
  sendError(id, code, message, data = null) {
    const response = this.createErrorResponse(id, code, message, data);
    this.sendResponse(response);
  }

  /**
   * Stop the handler
   */
  stop() {
    if (this.rl) {
      this.rl.close();
    }
  }
}

export default MCPHandler;
