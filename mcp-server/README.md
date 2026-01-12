# MCP Telegram Notify Server

An MCP (Model Context Protocol) server that allows Claude Code to send messages and ask questions via Telegram when you're away from your computer.

## Features

- 🔔 **telegram_notify** - Send fire-and-forget notifications
- ❓ **telegram_ask** - Ask questions and wait for responses (blocking)
- 🔐 **telegram_request_permission** - Request approval for risky operations
- 📊 **telegram_get_session_status** - Check bridge availability

## Security Features

- ✅ HMAC-SHA256 message signing
- ✅ Session authorization (optional allowlists)
- ✅ Secret detection (API keys, passwords, tokens)
- ✅ Rate limiting and daily usage limits
- ✅ Queue size limits
- ✅ Audit logging with secret redaction
- ✅ Emergency kill switch

## Installation

### 1. Install Dependencies

```bash
cd mcp-server
npm install
```

### 2. Configure Environment

```bash
cp .env.example .env
```

Edit `.env` and set:

**Required:**
- `TELEGRAM_CHAT_ID` - Your Telegram chat ID (get from bot with `/start`)
- `QUEUE_HMAC_SECRET` - Shared secret (generate with: `openssl rand -hex 32`)

**Optional Security:**
- `ALLOWED_SESSION_IDS` - Restrict which Claude sessions can use tools
- `ALLOWED_WORKING_DIRS` - Restrict by working directory
- `ENABLE_SECRET_DETECTION=true` - Warn about secrets in messages

### 3. Configure Bot

In `existing-solution/.env`:

```bash
MCP_ENABLED=true
MCP_QUEUE_DIR=../mcp-server/queue
QUEUE_HMAC_SECRET=<same_secret_as_mcp_server>
```

**Important:** `QUEUE_HMAC_SECRET` must match in both `.env` files!

### 4. Register with Claude Code

Add to `~/.claude/settings.json`:

```json
{
  "mcpServers": {
    "telegram-notify": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-server/index.js"],
      "env": {
        "TELEGRAM_CHAT_ID": "123456789",
        "TELEGRAM_QUEUE_DIR": "/absolute/path/to/mcp-server/queue"
      }
    }
  }
}
```

Replace `/absolute/path/to/` with actual paths on your system.

### 5. Set Permissions (Recommended)

```bash
chmod 700 queue/ config/ logs/
chmod 600 .env
```

## Usage

### Start the Telegram Bot

```bash
cd ../existing-solution
npm start
```

### Use from Claude

Once registered, Claude can use the tools:

**Send notification:**
```
Please notify me via Telegram that the build is complete
```

**Ask question:**
```
Ask me via Telegram which database to use for this project
```

**Request permission:**
```
I need to delete old log files. Request permission via Telegram
```

**Check status:**
```
Check if the Telegram bridge is available
```

## Tool Reference

### telegram_notify

Fire-and-forget notification (no response).

**Parameters:**
- `message` (string, required) - Message to send
- `priority` (string, optional) - "normal", "high", or "urgent"
- `contextInfo` (string, optional) - Additional context

**Returns:**
```json
{
  "success": true,
  "messageId": "msg_abc123",
  "timestamp": "2026-01-12T16:00:00Z"
}
```

### telegram_ask

Ask question and wait for response (blocking).

**Parameters:**
- `question` (string, required) - Question to ask
- `timeout_seconds` (integer, optional) - Wait time (30-1800), default 300
- `options` (array, optional) - Quick reply buttons (max 4)
- `contextInfo` (string, optional) - Why asking

**Returns:**
```json
{
  "success": true,
  "response": "PostgreSQL",
  "responseTime": "2026-01-12T16:02:00Z",
  "timedOut": false
}
```

### telegram_request_permission

Request approval for operation.

**Parameters:**
- `operation` (string, required) - What needs approval
- `risk_level` (string, required) - "low", "medium", "high", or "critical"
- `details` (object, optional) - Structured details
- `timeout_seconds` (integer, optional) - Wait time (30-1800), default 300

**Returns:**
```json
{
  "success": true,
  "approved": true,
  "response": "Approved",
  "timestamp": "2026-01-12T16:05:00Z"
}
```

### telegram_get_session_status

Check if bridge is available.

**Returns:**
```json
{
  "available": true,
  "botRunning": true,
  "chatId": "123456789",
  "pendingMessages": 0,
  "pendingRequests": 0
}
```

## Security

### Message Signing

All messages between MCP server and bot are signed with HMAC-SHA256 to prevent tampering.

### Session Authorization

Restrict which Claude sessions can use tools:

```bash
# Option 1: Allow specific session IDs
ALLOWED_SESSION_IDS=session-abc-123,session-xyz-789

# Option 2: Allow specific directories
ALLOWED_WORKING_DIRS=/Users/you/trusted-project

# Option 3: Allow all (default)
# Leave both empty
```

### Secret Detection

Automatically detects and warns about:
- OpenAI API keys
- GitHub tokens
- AWS keys
- Generic passwords/secrets

Sends warning to Telegram before exposing sensitive data.

### Rate Limits

- 30 notifications per minute per session
- 10-second cooldown between questions
- Max 3 concurrent pending questions
- 100 notifications per day per session
- 50 questions per day per session

### Emergency Controls

Disable all tools immediately:

```bash
MCP_TELEGRAM_DISABLED=true
```

## Troubleshooting

### "QUEUE_HMAC_SECRET environment variable is required"

Generate a secret:
```bash
openssl rand -hex 32
```

Add it to both `.env` files (MCP server AND bot).

### "Invalid signature on MCP message"

The `QUEUE_HMAC_SECRET` doesn't match between MCP server and bot. They must be identical.

### "Unauthorized session"

Your Claude session isn't in the allowlist. Either:
1. Add session ID to `ALLOWED_SESSION_IDS`
2. Add working directory to `ALLOWED_WORKING_DIRS`
3. Leave both empty to allow all sessions

### "Queue is full"

Too many pending messages. Wait for bot to process them, or increase `MAX_QUEUE_SIZE`.

### Messages not delivering

1. Check bot is running: `cd existing-solution && npm start`
2. Check queue directory exists and is shared
3. Check `MCP_ENABLED=true` in bot's `.env`
4. Check logs: `tail -f logs/mcp-audit.log`

## Architecture

```
Claude Code → MCP Server → File Queue → Telegram Bot → Telegram API → You
            ←             ←           ←            ←              ←
```

**Components:**
- **MCP Server** - Exposes tools to Claude via JSON-RPC stdio
- **File Queue** - Signed JSON messages in `queue/outbound/` and `queue/inbound/`
- **Bot Integration** - Watches queue, sends to Telegram, writes responses

## Files

```
mcp-server/
├── index.js              # Main entry point
├── lib/
│   ├── mcp-handler.js    # JSON-RPC protocol handler
│   ├── tools.js          # Tool implementations
│   ├── queue-manager.js  # File queue operations
│   ├── security.js       # HMAC, secret detection, auth
│   └── session-mapper.js # Session → chat ID mapping
├── queue/                # Shared with bot
│   ├── outbound/         # MCP → Bot
│   └── inbound/          # Bot → MCP
├── config/
│   └── mcp-config.json   # Session mappings (auto-created)
└── logs/
    └── mcp-audit.log     # Audit trail (auto-created)
```

## License

MIT
