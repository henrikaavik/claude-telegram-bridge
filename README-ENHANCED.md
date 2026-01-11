# 🤖 Telegram Claude Code Bot - Enhanced Security Edition

Complete control of Claude Code via Telegram with **multi-session support**, **enhanced security**, and **bidirectional control**!

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-18+-green.svg" alt="Node.js">
  <img src="https://img.shields.io/badge/Claude_Code-Stream_JSON-blue.svg" alt="Claude Code">
  <img src="https://img.shields.io/badge/Telegram-Bot_API-blue.svg" alt="Telegram">
  <img src="https://img.shields.io/badge/OpenAI-Whisper-orange.svg" alt="Whisper">
  <img src="https://img.shields.io/badge/Security-Enhanced-red.svg" alt="Security">
</p>

## 🆕 What's New in 2.0

### 🔐 Enhanced Security
- ✅ **Removed dangerous permissions** - No more `--dangerously-skip-permissions`
- 🛡️ **Three-tier confirmation system** - Low/Medium/High risk operations
- ⚡ **Rate limiting** - Protection against abuse (20 msg/min, 10 audio/min)
- 📝 **Comprehensive audit logging** - Track all security events
- 🔍 **Destructive operation detection** - 15+ dangerous patterns detected

### 🔄 Multi-Session Support
- 📂 **Multiple parallel sessions** - Work on different projects simultaneously
- 🔀 **Easy session switching** - Switch between sessions instantly
- 💾 **Session persistence** - Sessions survive bot restarts
- 📊 **Session tracking** - Monitor message counts, activity, workspaces

### 🔌 Claude Code Plugin
- 🚀 **Control bot from Claude Code** - Start/stop/status commands
- 📬 **Bidirectional notifications** - Send messages from Claude Code to Telegram
- 🔧 **Bot lifecycle management** - Full control over bot processes

## ✨ Core Features

### 💬 Complete Interaction
- 🔄 **Real-time streaming** - Watch Claude think and respond
- 🧠 **Persistent context** - Sessions maintain full history
- ⚡ **Partial messages** - Progressive updates as Claude processes
- 🛠️ **Tool notifications** - See when Claude executes commands

### 📸 Multimedia Support
- 🖼️ **Image analysis** - Send photos and Claude analyzes with vision
- 🎤 **Audio transcription** - Send voice messages, auto-transcribed via Whisper
- 📁 **Local files** - Claude can read/write in working directory

### 🌍 Multilingual Support
- 🇬🇧 **English** - Default language
- 🇧🇷 **Portuguese** - Full support
- 🇳🇱 **Dutch** - Full support
- 🔄 **Language switching** - Use `/lang` to change languages

### 👥 Group Support
- 🗣️ **Shared sessions** - Use Claude Code in Telegram groups
- 👥 **Collaboration** - All members can interact with Claude

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+
- Claude Code CLI installed
- Telegram Bot Token (from @BotFather)
- OpenAI API Key (optional, for voice transcription)

### Installation

```bash
# Clone the repository
git clone https://github.com/your-fork/claude-telegram-bridge.git
cd claude-telegram-bridge

# Install dependencies
npm install

# Copy and configure environment file
cp .env.example .env
nano .env  # Add your tokens
```

### Configuration

Edit `.env`:

```bash
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_from_botfather
AUTHORIZED_CHAT_ID=your_telegram_chat_id

# Optional
WORKING_DIR=/path/to/your/workspace
CLAUDE_CODE_PATH=claude
OPENAI_API_KEY=your_openai_key  # For audio transcription
DEFAULT_LANGUAGE=en
```

### Start the Bot

```bash
npm start
```

Or use the Claude Code plugin (see below).

---

## 📋 Command Reference

### Basic Commands

| Command | Description |
|---------|-------------|
| `/start` | Start new Claude session |
| `/stop` | Stop current session |
| `/status` | Show session status |
| `/help` | Show available commands |
| `/lang [en\|pt\|nl]` | Change language |

### Multi-Session Commands

| Command | Description |
|---------|-------------|
| `/session` | Show multi-session help |
| `/session new <name> [path]` | Create new session |
| `/sessions` | List all your sessions |
| `/switch <name>` | Switch to different session |
| `/kill <name>` | Terminate a session |

### Examples

```bash
# Create sessions for different projects
/session new api ~/projects/api
/session new frontend ~/projects/frontend
/session new docs ~/projects/docs

# List all sessions
/sessions

# Switch to different session
/switch api

# Work on that session
[Your message goes to 'api' session]

# Switch back
/switch frontend

# Terminate unused session
/kill docs
```

---

## 🔐 Security Features

### Confirmation System

The bot implements a three-tier confirmation system:

#### Low Risk (⚠️)
Simple operations like deleting a single file.
- **Confirmation**: Yes/No buttons

#### Medium Risk (🚨)
Operations like `git push` or deleting multiple files.
- **Confirmation**: Inline buttons with command preview
- **Examples**: `git push`, `rm *.log`, `DROP TABLE users`

#### High Risk (🔴)
Destructive operations that cannot be undone.
- **Confirmation**: Must type exact phrase "I CONFIRM THIS ACTION"
- **Examples**: `git push --force`, `rm -rf /`, `docker system prune`

### Rate Limiting

Protection against abuse:

| Type | Limit | Window |
|------|-------|--------|
| Messages | 20 | 1 minute |
| Audio | 10 | 1 minute |
| Sessions | 5 | 1 minute |

When you hit a rate limit, you'll see:
```
🚨 Rate Limit Exceeded

You've sent too many messages requests.

Limit: 20 per 60 seconds
Current: 21 requests
Reset in: 45 seconds
```

### Audit Logging

All security events are logged to `logs/audit.log`:

```json
{
  "timestamp": "2026-01-11T10:30:45.123Z",
  "level": "SECURITY",
  "event": "destructive_operation",
  "chatId": 1524051553,
  "operation": "git push --force",
  "confirmed": true
}
```

View logs:
```bash
tail -f logs/audit.log
grep "SECURITY" logs/audit.log
```

---

## 🔌 Claude Code Plugin

Control the Telegram bot from within Claude Code!

### Installation

```bash
# Copy plugin to Claude Code plugins directory
cp -r telegram-bot-plugin ~/.config/claude-code/plugins/telegram-bot-control
```

Or create a symlink for development:
```bash
ln -s "$(pwd)/telegram-bot-plugin" ~/.config/claude-code/plugins/telegram-bot-control
```

### Usage

Once installed, you can use natural language:

```
User: Start the Telegram bot
Claude: [Uses start_telegram_bot tool]
✅ Bot started successfully!

User: What's the bot status?
Claude: [Uses telegram_bot_status tool]
📊 Bot Status: Running ✅
⏱️ Uptime: 2h 34m

User: Send me a notification saying "Deployment complete"
Claude: [Uses notify_telegram tool]
✅ Notification sent to Telegram

User: Stop the bot
Claude: [Uses stop_telegram_bot tool]
✅ Bot stopped successfully
```

### Plugin Tools

- `start_telegram_bot` - Start bot in background
- `stop_telegram_bot` - Stop bot gracefully
- `telegram_bot_status` - Check status, uptime, PID
- `restart_telegram_bot` - Restart bot
- `notify_telegram` - Send messages from Claude Code to Telegram
- `list_telegram_sessions` - View all active sessions

See [telegram-bot-plugin/README.md](telegram-bot-plugin/README.md) for detailed documentation.

---

## 📁 Project Structure

```
existing-solution/
├── index.js                    # Main bot script
├── package.json
├── .env                        # Configuration (git-ignored)
│
├── src/
│   ├── security/
│   │   ├── confirmations.js   # Confirmation system
│   │   ├── rateLimit.js       # Rate limiting
│   │   └── auditLog.js        # Audit logging
│   └── session/
│       └── SessionManager.js  # Multi-session management
│
├── telegram-bot-plugin/       # Claude Code plugin
│   ├── .claude-plugin         # Plugin definition
│   ├── bot-manager.js         # Bot lifecycle manager
│   └── README.md              # Plugin docs
│
├── lib/
│   └── i18n.js                # Internationalization
│
├── locales/                   # Translation files
│   ├── en.json
│   ├── pt.json
│   └── nl.json
│
├── logs/                      # Log files
│   ├── audit.log             # Security audit log
│   └── bot.log               # Bot process log
│
├── data/                      # Persistent data
│   └── sessions.json         # Session state
│
├── temp/                      # Temporary files
│   └── voice_*.ogg           # Audio files (auto-deleted)
│
└── docs/
    ├── CHANGELOG.md          # Version history
    ├── SECURITY.md           # Security documentation
    ├── MULTI-SESSION-DESIGN.md
    └── IMPLEMENTATION-PLAN.md
```

---

## 🔧 Advanced Configuration

### Custom Rate Limits

Edit `src/security/rateLimit.js`:

```javascript
const RATE_LIMITS = {
  messages: {
    window: 60 * 1000,      // 1 minute
    maxRequests: 30,         // Change to 30 messages
  },
  audio: {
    window: 60 * 1000,
    maxRequests: 15,         // Change to 15 audio
  }
};
```

### Custom Destructive Patterns

Edit `src/security/confirmations.js`:

```javascript
const DESTRUCTIVE_PATTERNS = [
  // Add your own patterns
  {
    pattern: /terraform\s+destroy/i,
    level: 'high',
    description: 'Terraform destroy'
  },
  // ... more patterns
];
```

### Multiple Authorized Users

```bash
# In .env
AUTHORIZED_CHAT_ID=1524051553,9876543210,1122334455
```

---

## 🐛 Troubleshooting

### Bot won't start

```bash
# Check if already running
ps aux | grep "node index.js"

# Check logs
tail -f logs/bot.log

# Verify .env configuration
cat .env
```

### Rate limit too restrictive

Edit `src/security/rateLimit.js` and restart bot.

### Sessions not persisting

Check `data/sessions.json` exists and is writable:
```bash
ls -la data/sessions.json
```

### Audio transcription not working

1. Verify `OPENAI_API_KEY` in `.env`
2. Check you have Whisper API access
3. Review logs for API errors

### Plugin not found

```bash
# Check plugin directory
ls ~/.config/claude-code/plugins/

# Verify plugin file
cat ~/.config/claude-code/plugins/telegram-bot-control/.claude-plugin
```

---

## 📊 Statistics & Monitoring

### View Audit Logs

```bash
# All events
cat logs/audit.log | jq .

# Security events only
grep "SECURITY" logs/audit.log | jq .

# Rate limit violations
grep "rate_limit" logs/audit.log | wc -l

# Today's activity
grep "$(date +%Y-%m-%d)" logs/audit.log | jq .
```

### Session Statistics

```bash
# View session data
cat data/sessions.json | jq .

# Count sessions
cat data/sessions.json | jq '.sessions | length'
```

---

## 🤝 Contributing

Contributions welcome! Please:

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

---

## 📄 License

MIT License - See [LICENSE](LICENSE) file

Original bot by [viniciustodesco/claude-telegram-bridge](https://github.com/viniciustodesco/claude-telegram-bridge)

Enhanced security and multi-session features by Henrik Aavik

---

## 🙏 Credits

- **Original Bot**: viniciustodesco/claude-telegram-bridge
- **Claude Code**: Anthropic
- **Telegram Bot API**: Telegram
- **Whisper API**: OpenAI
- **Enhanced Version**: Community contributors

---

## 📚 Documentation

- [CHANGELOG.md](CHANGELOG.md) - Version history and changes
- [SECURITY.md](SECURITY.md) - Security features and best practices
- [Plugin README](telegram-bot-plugin/README.md) - Claude Code plugin documentation
- [Multi-Session Design](MULTI-SESSION-DESIGN.md) - Architecture details
- [Implementation Plan](IMPLEMENTATION-PLAN.md) - Development roadmap

---

## 🔮 Roadmap

### Planned Features

- [ ] Quick routing syntax (`@session message`)
- [ ] Session groups/workspaces
- [ ] Configurable rate limits via .env
- [ ] Web dashboard for monitoring
- [ ] Session templates
- [ ] Backup/restore functionality
- [ ] Metrics and analytics

### Completed (v2.0)

- [x] Removed dangerous permissions flag
- [x] Three-tier confirmation system
- [x] Rate limiting
- [x] Audit logging
- [x] Multi-session support
- [x] Claude Code plugin
- [x] Bidirectional notifications

---

## 💬 Support

- **Issues**: [GitHub Issues](https://github.com/your-fork/claude-telegram-bridge/issues)
- **Discussions**: [GitHub Discussions](https://github.com/your-fork/claude-telegram-bridge/discussions)
- **Security**: See [SECURITY.md](SECURITY.md) for reporting vulnerabilities

---

## ⚠️ Important Notes

### Security

This bot provides powerful access to your system via Telegram. Please:

- **Secure your bot token** - Never commit to version control
- **Restrict access** - Use `AUTHORIZED_CHAT_ID` whitelist
- **Review confirmations** - Always check what operations you're confirming
- **Monitor logs** - Regularly review `logs/audit.log`
- **Keep updated** - Update Claude Code and dependencies regularly

### Limitations

- Telegram message size limit: 4096 characters
- Audio file size limit: 20 MB
- Whisper API costs: ~$0.006 per minute
- Rate limits apply (see configuration)

### Best Practices

1. **Use descriptive session names**: `api`, `frontend`, `docs` instead of `s1`, `s2`, `s3`
2. **Set specific workspaces**: Different projects in different directories
3. **Review confirmations carefully**: Especially for HIGH risk operations
4. **Monitor rate limits**: Avoid hitting limits by spacing messages
5. **Regular cleanup**: Kill unused sessions with `/kill <name>`
6. **Check logs**: Review `logs/audit.log` weekly

---

**Made with ❤️ for the Claude Code community**

**Version**: 2.0.0
**Last Updated**: 2026-01-11
