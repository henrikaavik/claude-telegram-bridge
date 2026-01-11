# Telegram Bot Control Plugin for Claude Code

This plugin allows you to control the Telegram Claude Code bot directly from within Claude Code CLI.

## Features

- 🚀 Start/Stop the Telegram bot from Claude Code
- 📊 Check bot status and uptime
- 💬 Send notifications to Telegram from Claude Code
- 📋 List active Telegram sessions
- 🔄 Restart the bot after configuration changes

## Installation

### Option 1: Automatic Installation (Copy to Claude Code plugins directory)

```bash
# Find your Claude Code plugins directory
claude --plugins-dir

# Copy this plugin to that directory
cp -r telegram-bot-plugin ~/.config/claude-code/plugins/telegram-bot-control
```

### Option 2: Manual Setup (Symlink for development)

```bash
# Create symlink to your Claude Code plugins directory
ln -s "$(pwd)/telegram-bot-plugin" ~/.config/claude-code/plugins/telegram-bot-control

# Make bot-manager.js executable
chmod +x telegram-bot-plugin/bot-manager.js
```

### Option 3: Use Relative Path

Claude Code can also load plugins from the current working directory. Simply ensure you're in the project root when running Claude Code.

## Usage

Once installed, Claude Code will have access to these tools:

### Start the Bot

```
Hey Claude, can you start the Telegram bot for me?
```

Claude will use the `start_telegram_bot` tool to launch the bot in the background.

### Stop the Bot

```
Stop the Telegram bot please
```

### Check Status

```
What's the status of the Telegram bot?
```

### Send Notification

```
Send me a notification on Telegram saying "Build completed successfully"
```

```
Send an urgent notification: "Server is down!"
```

Claude will use the `notify_telegram` tool with appropriate priority levels.

### List Sessions

```
Show me all active Telegram bot sessions
```

### Restart Bot

```
Restart the Telegram bot
```

Useful after making configuration changes to .env file.

## Tool Reference

### start_telegram_bot

Starts the Telegram bot in the background.

**Parameters:**
- `working_dir` (optional): Working directory for the bot

**Example:**
```javascript
{
  "working_dir": "/path/to/project"
}
```

### stop_telegram_bot

Stops the running Telegram bot gracefully.

**Parameters:** None

### telegram_bot_status

Returns the current status of the bot.

**Returns:**
- Running/Not Running status
- PID (Process ID)
- Uptime
- Log file location

### restart_telegram_bot

Restarts the bot (stop + start).

**Parameters:** None

### notify_telegram

Sends a notification message to your Telegram chat.

**Parameters:**
- `message` (required): The message to send
- `chat_id` (optional): Target chat ID (defaults to authorized chat from .env)
- `priority` (optional): "normal", "high", or "urgent"

**Example:**
```javascript
{
  "message": "Deployment completed successfully!",
  "priority": "high"
}
```

### list_telegram_sessions

Lists all active Claude Code sessions managed by the Telegram bot.

**Returns:**
- Session names
- Chat IDs
- Workspace paths
- Message counts
- Last activity times

## Examples

### Example 1: Start Bot and Get Status

```
User: Start the Telegram bot and let me know when it's ready

Claude: I'll start the Telegram bot for you now.
[Uses start_telegram_bot tool]

✅ The Telegram bot is now running!
📊 PID: 12345
📄 Logs: /path/to/logs/bot.log

The bot is ready to receive messages on Telegram.
```

### Example 2: Notification on Long Task Completion

```
User: Run the tests and notify me on Telegram when they're done

Claude: I'll run the tests and send you a notification.
[Runs tests]
[Uses notify_telegram tool]

✅ Tests completed! I've sent you a notification on Telegram with the results.
```

### Example 3: Check Bot Health

```
User: Is the Telegram bot running?

Claude: Let me check the bot status for you.
[Uses telegram_bot_status tool]

📊 Bot Status: Running ✅
📊 PID: 12345
⏱️ Uptime: 2h 34m
📄 Logs: /path/to/logs/bot.log

The bot is running normally and has been up for 2 hours and 34 minutes.
```

## Configuration

The plugin reads configuration from your `.env` file:

```bash
# Required for notifications
TELEGRAM_BOT_TOKEN=your_bot_token_here
AUTHORIZED_CHAT_ID=your_chat_id_here
```

## Logs

Bot logs are written to `logs/bot.log` in the project directory.

View logs:
```bash
tail -f logs/bot.log
```

## Troubleshooting

### Bot won't start

1. Check if bot is already running: `node bot-manager.js status`
2. Check .env file has correct TELEGRAM_BOT_TOKEN
3. Check logs: `cat logs/bot.log`

### Plugin not found by Claude Code

1. Verify plugin is in correct directory: `claude --plugins-dir`
2. Check .claude-plugin file is valid JSON
3. Restart Claude Code

### Notifications not sending

1. Verify TELEGRAM_BOT_TOKEN in .env
2. Verify AUTHORIZED_CHAT_ID in .env
3. Test with: `node bot-manager.js notify` (pass JSON via stdin)

## Development

To test the plugin tools directly:

```bash
# Start bot
node bot-manager.js start

# Stop bot
node bot-manager.js stop

# Check status
node bot-manager.js status

# Send notification (requires JSON input via stdin)
echo '{"message":"Test notification","priority":"normal"}' | node bot-manager.js notify

# List sessions
node bot-manager.js sessions
```

## Security Notes

- The bot runs as a background process with the same permissions as the user
- PID file prevents multiple instances
- Bot logs may contain sensitive information - ensure proper file permissions
- Notifications use the Telegram Bot API over HTTPS

## License

MIT License - Same as the main project
