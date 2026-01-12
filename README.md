[🇬🇧 English](./README.md) | [🇧🇷 Português](./README.pt.md) | [🇳🇱 Nederlands](./README.nl.md)

---

# 🤖 Claude Telegram Bridge

**Complete bidirectional integration between Claude Code and Telegram** with MCP server support, real-time streaming, multimedia support, and enterprise-grade security.

<p align="center">
  <img src="https://img.shields.io/badge/Security-95%2F100_(A)-brightgreen.svg" alt="Security Score">
  <img src="https://img.shields.io/badge/Node.js-18+-green.svg" alt="Node.js">
  <img src="https://img.shields.io/badge/Claude_Code-MCP_Ready-blue.svg" alt="Claude Code">
  <img src="https://img.shields.io/badge/Telegram-Bot_API-blue.svg" alt="Telegram">
  <img src="https://img.shields.io/badge/OpenAI-Whisper-orange.svg" alt="Whisper">
</p>

---

## 🌟 What's New

### Security Improvements (v2.1.0 - 2026-01-12)

**Security Score: 95/100 (A) - Production Ready** ✅

- ✅ **All security vulnerabilities fixed** (HIGH, MEDIUM, LOW)
- ✅ **Admin-only confirmations** for group chats
- ✅ **Markdown injection prevention** with comprehensive escaping
- ✅ **Improved confirmation UX** with retry capability
- ✅ **New `/cancel` command** to abort pending confirmations
- ✅ **Enhanced audit logging** for security events

See [SECURITY_REVIEW_SUMMARY.md](./SECURITY_REVIEW_SUMMARY.md) for details.

---

## ✨ Features

### 🔗 **Dual Architecture**

This project provides **two complementary solutions**:

#### 1. **MCP Server** (`mcp-server/`)
- 🔌 **MCP Plugin** - Integrates as a Claude Code MCP server
- 📤 **Send Notifications** - Claude can send you Telegram messages
- ❓ **Ask Questions** - Claude can request user input via Telegram
- ✅ **Confirmations** - Three-tier confirmation system (Low/Medium/High)
- 🔐 **HMAC Message Signing** - Cryptographic authentication
- 🛡️ **Rate Limiting** - Per-tool and daily limits
- 🔒 **Secret Detection** - Automatic redaction of sensitive data

#### 2. **Telegram Bot** (`existing-solution/`)
- 💬 **Interactive Bot** - Control Claude Code directly from Telegram
- 🔄 **Real-time Streaming** - Watch Claude thinking and responding
- 📸 **Vision Support** - Send images for analysis
- 🎤 **Voice Transcription** - Automatic audio-to-text via Whisper
- 🧠 **Persistent Context** - Sessions maintain complete history
- 👥 **Group Support** - Shared sessions in Telegram groups

### 🔒 **Enterprise Security**

- **Security Score: 95/100 (A)** - Production-ready
- **HMAC-SHA256 Signing** - Cryptographic message authentication
- **Rate Limiting** - Per-tool, daily, and queue limits
- **Secret Detection** - 12+ patterns with auto-redaction
- **Audit Logging** - Comprehensive JSON logs with rotation
- **Admin Controls** - Optional admin-only approvals for groups
- **Input Validation** - Comprehensive type & content checks
- **Markdown Escaping** - Prevents injection attacks

### 🌍 **Multilingual Support**

- 🇬🇧 **English** - Default language
- 🇧🇷 **Portuguese** - Full support
- 🇳🇱 **Dutch** - Full support
- 🔄 **Language Switching** - Use `/lang` to switch languages
- 🎙️ **Transcription in Any Language** - Whisper auto-detects

---

## 🚀 Quick Start

### Prerequisites

- **Node.js 18+** ([Download](https://nodejs.org))
- **Claude Code CLI** ([Install Guide](https://docs.claude.com/en/docs/claude-code))
- **Telegram Account**

### Installation

```bash
# Clone the repository
git clone https://github.com/henrikaavik/claude-telegram-bridge.git
cd claude-telegram-bridge

# Install MCP Server (for Claude notifications)
cd mcp-server
npm install
cp .env.example .env
# Edit .env with your settings

# Install Telegram Bot (for interactive control)
cd ../existing-solution
npm install
cp .env.example .env
# Edit .env with your settings
```

### Configuration

#### 1. **Get Telegram Bot Token**

1. Open [@BotFather](https://t.me/botfather) on Telegram
2. Send `/newbot` and follow instructions
3. Copy the bot token

#### 2. **Get Your Chat ID**

1. Start the bot without `AUTHORIZED_CHAT_ID` configured
2. Send `/start` to your bot
3. Check console output: `📱 Your Chat ID: 123456789`
4. Add it to `.env`

#### 3. **Configure MCP Server** (`mcp-server/.env`)

```env
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_here
TELEGRAM_CHAT_ID=your_chat_id_here

# Security (Recommended)
MCP_TELEGRAM_HMAC_SECRET=generate_random_secret_here
GROUP_ADMIN_ONLY_CONFIRMATIONS=true  # For group chats

# Optional - Session Control
MCP_SESSION_ALLOWLIST=session-id-1,session-id-2
```

#### 4. **Configure Telegram Bot** (`existing-solution/.env`)

```env
# Required
TELEGRAM_BOT_TOKEN=your_bot_token_here
AUTHORIZED_CHAT_ID=your_chat_id_here

# Recommended
WORKING_DIR=/path/to/your/project
CLAUDE_CODE_PATH=claude

# Optional - Audio Transcription
OPENAI_API_KEY=sk-proj-your_key_here

# Optional - Language
DEFAULT_LANGUAGE=en

# Optional - Security
GROUP_ADMIN_ONLY_CONFIRMATIONS=true
```

#### 5. **Register MCP Server with Claude Code**

Add to your Claude Code configuration (`.mcp.json` or global settings):

```json
{
  "mcpServers": {
    "telegram-notify": {
      "command": "node",
      "args": ["/path/to/claude-telegram-bridge/mcp-server/index.js"],
      "cwd": "/path/to/claude-telegram-bridge/mcp-server",
      "env": {
        "MCP_TELEGRAM_HMAC_SECRET": "your_secret_here"
      }
    }
  }
}
```

### Running

#### MCP Server (runs automatically with Claude Code)

The MCP server starts automatically when Claude Code launches. No manual start needed.

#### Telegram Bot

```bash
cd existing-solution
npm start

# Or with auto-reload for development
npm run dev
```

---

## 📱 Usage

### MCP Server Tools

When the MCP server is registered, Claude Code has access to:

#### `telegram_notify` - Send Notifications

```javascript
// Claude can send you messages
await telegram_notify({
  message: "Task completed successfully!",
  priority: "high"  // normal, high, urgent
});
```

#### `telegram_ask` - Request User Input

```javascript
// Claude can ask questions
const answer = await telegram_ask({
  question: "Should I proceed with deployment?",
  options: ["Yes", "No", "Later"],
  timeout_seconds: 300
});
```

#### `telegram_request_permission` - Get Approval

```javascript
// Claude can request permission for operations
const approved = await telegram_request_permission({
  operation: "Delete production database",
  risk_level: "critical",  // low, medium, high, critical
  details: {
    database: "prod_db",
    records: 1000000
  }
});
```

### Telegram Bot Commands

| Command | Description |
|---------|-------------|
| `/start` | Start a new Claude Code session |
| `/stop` | End the current session |
| `/status` | Show session status (PID, Session ID) |
| `/help` | Display help and features |
| `/lang` | Change interface language (en, pt, nl) |
| `/cancel` | Cancel pending confirmation |

### Telegram Bot Interactions

#### Text Messages

Simply type to interact with Claude:

```
You: List files in the current directory

Claude: 🤖 I'll use the Bash command...
        [streaming response...]
        📁 Files found:
        - index.js
        - package.json
        - README.md
```

#### Image Analysis

Send a photo directly:

```
[You send a code screenshot]

Claude: 🤖 I see JavaScript code that...
        - Defines an async function
        - Uses fetch for API calls
        - Has error handling with try/catch
```

#### Voice Messages

Record and send audio:

```
[You send audio: "Create an Express server"]

Bot: 🎤 Audio transcribed:
     "Create an Express server"

Claude: 🤖 I'll create an Express server...
        [creates the code]
```

---

## 🏗️ Architecture

### System Overview

```
┌─────────────────────┐
│   Claude Code CLI   │
│                     │
│  ┌───────────────┐  │     ┌──────────────────┐
│  │  MCP Server   │◄─┼────▶│  Telegram API    │
│  │  (Outbound)   │  │     │  (Bot Messages)  │
│  └───────────────┘  │     └──────────────────┘
│                     │              ▲
│  ┌───────────────┐  │              │
│  │  Stream JSON  │  │              │
│  │  (Interactive)│  │              │
│  └───────────────┘  │              │
└─────────────────────┘              │
         ▲                            │
         │                            │
         ▼                            ▼
┌─────────────────────┐     ┌──────────────────┐
│  Telegram Bot       │────▶│  Telegram User   │
│  (existing-solution)│◄────│  (You)           │
└─────────────────────┘     └──────────────────┘
         │
         ▼
┌─────────────────────┐
│  OpenAI Whisper API │
│  (Transcription)    │
└─────────────────────┘
```

### Project Structure

```
claude-telegram-bridge/
├── mcp-server/                    # MCP Server for Claude notifications
│   ├── index.js                   # MCP server entry point
│   ├── lib/
│   │   ├── mcp-handler.js         # MCP protocol handler
│   │   ├── queue-manager.js       # Message queue management
│   │   ├── session-mapper.js      # Session ID mapping
│   │   └── tools.js               # MCP tool definitions
│   ├── config/
│   │   └── mcp-config.json        # MCP server configuration
│   ├── queue/                     # Message queue storage
│   ├── .env                       # MCP server environment config
│   └── package.json
│
├── existing-solution/             # Interactive Telegram Bot
│   ├── index.js                   # Bot entry point
│   ├── src/
│   │   ├── security/
│   │   │   ├── confirmations.js   # Destructive operation confirmations
│   │   │   ├── auditLog.js        # Security audit logging
│   │   │   └── rateLimit.js       # Rate limiting system
│   │   └── session/
│   │       └── SessionManager.js  # Claude Code session management
│   ├── lib/
│   │   └── i18n.js                # Internationalization (en/pt/nl)
│   ├── data/                      # User preferences storage
│   ├── temp/                      # Temporary audio files
│   ├── .env                       # Bot environment config
│   └── package.json
│
├── docs/                          # Documentation
│   ├── SECURITY_REVIEW_2026-01-12.md   # Full security review (45 pages)
│   ├── SECURITY_FIXES_2026-01-12.md    # Detailed fix documentation
│   ├── SECURITY_REVIEW_SUMMARY.md      # Quick reference
│   └── FIXES_COMPLETE.md               # Deployment guide
│
├── README.md                      # This file (English)
├── README.pt.md                   # Portuguese README
├── README.nl.md                   # Dutch README
└── .gitignore
```

---

## 🔒 Security

### Security Score: 95/100 (A)

The system has undergone comprehensive security review and achieved production-ready status.

### Security Features

| Feature | Score | Status |
|---------|-------|--------|
| Authentication | 9/10 | ✅ Strong |
| Authorization | 10/10 | ✅ Excellent |
| Input Validation | 10/10 | ✅ Excellent |
| Cryptography | 8/10 | ✅ Good |
| Rate Limiting | 9/10 | ✅ Strong |
| Audit Logging | 9/10 | ✅ Excellent |
| Error Handling | 8/10 | ✅ Good |
| Secrets Management | 8/10 | ✅ Good |
| User Experience | 9/10 | ✅ Excellent |

### Key Security Controls

#### 1. **HMAC Message Signing**
- All MCP messages cryptographically signed with SHA-256
- Prevents message tampering and replay attacks
- Timing-safe comparison prevents timing attacks

#### 2. **Three-Tier Confirmations**
- **Low Risk**: Button approval (file reads, safe operations)
- **Medium Risk**: Button approval (git push, package removal)
- **High Risk**: Typed confirmation required (destructive operations)
- **Admin-Only Mode**: Optional admin validation for group chats

#### 3. **Rate Limiting**
- Per-tool rate limits (e.g., 10 notifications/minute)
- Daily limits (100 operations/day)
- Queue size limits (50 pending messages)
- Automatic throttling on limit exceeded

#### 4. **Secret Detection & Redaction**
- 12+ patterns for API keys, tokens, passwords
- Automatic redaction in logs and confirmations
- Prevents accidental secret exposure

#### 5. **Audit Logging**
- JSON-formatted structured logs
- Automatic log rotation (10MB, 30 days retention)
- Tracks all security events, confirmations, and denials
- Queryable for security analysis

#### 6. **Admin Controls** (New in v2.1.0)
- Optional admin-only confirmations in groups
- Permission denied for non-admin approvals
- All attempts logged for audit

#### 7. **Markdown Injection Prevention** (New in v2.1.0)
- Comprehensive escaping of user input
- Prevents UI spoofing and formatting attacks
- Safe display of all user-generated content

### Security Best Practices

#### ✅ **Recommended**

- Set `AUTHORIZED_CHAT_ID` to restrict bot access
- Use `GROUP_ADMIN_ONLY_CONFIRMATIONS=true` for production groups
- Generate strong `MCP_TELEGRAM_HMAC_SECRET` (32+ characters)
- Set `.env` file permissions to 600: `chmod 600 .env`
- Review audit logs regularly: `logs/audit.log`
- Use session allowlists in production
- Never commit `.env` files to version control

#### ⚠️ **Warnings**

- Claude can execute commands on your system
- Claude can read/write files in `WORKING_DIR`
- Audio transcriptions are sent to OpenAI API
- Images are sent to Anthropic API
- Group chats share session context with all members

### Emergency Procedures

If security incident detected:

```bash
# 1. Immediately disable MCP server
echo "MCP_TELEGRAM_DISABLED=true" >> mcp-server/.env

# 2. Revoke Telegram bot token
# Visit @BotFather and use /revoke

# 3. Review audit logs
grep "$(date +%Y-%m-%d)" existing-solution/logs/audit.log

# 4. Check for suspicious activity
grep "permission_denied\|admin_check_failed" existing-solution/logs/audit.log
```

See [SECURITY_REVIEW_SUMMARY.md](./SECURITY_REVIEW_SUMMARY.md) for complete security documentation.

---

## 👥 Group Support

Both the MCP server and Telegram bot support Telegram group chats:

### Features

- 🗣️ **Shared Sessions** - All group members share one Claude context
- 👥 **Collaborative Work** - Multiple users can interact with Claude
- 🔐 **Admin Controls** - Optional admin-only confirmations
- 📝 **Single History** - One conversation per group
- 🔒 **Security** - Same security controls as private chats

### Setup for Groups

1. Add your bot to a Telegram group
2. Get the group Chat ID (negative number)
3. Add group ID to `AUTHORIZED_CHAT_ID` in `.env`:
   ```env
   AUTHORIZED_CHAT_ID=123456789,-987654321,-555555555
   ```
4. Enable admin-only confirmations (recommended):
   ```env
   GROUP_ADMIN_ONLY_CONFIRMATIONS=true
   ```

**Important**: Only group admins can approve destructive operations when `GROUP_ADMIN_ONLY_CONFIRMATIONS=true`.

---

## 🌐 Language Support

The Telegram bot supports 3 languages for all interface messages:

### Available Languages

- 🇬🇧 **English** (en) - Default
- 🇧🇷 **Portuguese** (pt)
- 🇳🇱 **Dutch** (nl)

### Switching Languages

```
/lang              # Show current language and options
/lang en           # Switch to English
/lang pt           # Switch to Portuguese
/lang nl           # Switch to Dutch
```

Language preferences are automatically saved and persist across sessions.

### Translated Elements

- All bot messages and responses
- Error messages and warnings
- Status information
- Help text and command descriptions
- Audio transcription results
- Confirmation dialogs

---

## 🐛 Troubleshooting

### MCP Server Issues

#### MCP Server Not Responding

**Check:**
```bash
# Verify MCP server is registered
cat ~/.claude/settings.json | grep telegram-notify

# Check MCP server logs
tail -f mcp-server/logs/mcp-server.log

# Test manually
node mcp-server/index.js
```

**Common causes:**
- Incorrect path in `.mcp.json`
- Missing `.env` configuration
- Invalid bot token
- Network firewall blocking Telegram API

#### Messages Not Delivered

**Check:**
```bash
# Verify queue directory exists
ls -la mcp-server/queue/

# Check queue files
cat mcp-server/queue/*.json

# Verify HMAC secret matches
grep HMAC_SECRET mcp-server/.env
```

### Telegram Bot Issues

#### Bot Doesn't Respond

**Check:**
```bash
# Verify Claude Code is installed
claude --version

# Test Claude Code manually
claude --print --output-format text "Hello"

# Check bot logs
tail -f existing-solution/logs/bot.log
```

**Common causes:**
- Incorrect Telegram token
- Claude Code not installed
- Firewall blocking connections
- Missing `AUTHORIZED_CHAT_ID`

#### "Unauthorized Access" Error

**Solution:**
1. Temporarily remove `AUTHORIZED_CHAT_ID` from `.env`
2. Restart the bot
3. Send `/start` to the bot
4. Check console: `📱 Your Chat ID: 123456789`
5. Add Chat ID to `.env` and restart

#### Audio Transcription Fails

**Check:**
```bash
# Verify OpenAI API key
grep OPENAI_API_KEY existing-solution/.env

# Check audio file
ls -lh existing-solution/temp/
```

**Common causes:**
- Missing `OPENAI_API_KEY`
- Invalid API key
- Audio format not supported
- File too large (>25MB)

#### Images Don't Work

**Supported formats:**
- `.jpg` / `.jpeg`
- `.png`
- `.gif`
- `.webp`

**Maximum size:** 10MB per image

### Permission Issues

#### Confirmations Not Working

**Check:**
```bash
# Verify confirmation system
grep "hasPendingConfirmation" existing-solution/src/security/confirmations.js

# Check for stuck confirmations
# Send /cancel in Telegram

# Review audit logs
tail -f existing-solution/logs/audit.log | grep confirmation
```

#### Admin Checks Failing

**Verify admin status:**
```bash
# In Telegram, check if user is admin
# Group settings → Administrators

# Check environment variable
grep GROUP_ADMIN_ONLY existing-solution/.env

# Review admin check logs
grep "admin_check" existing-solution/logs/audit.log
```

---

## 📖 Documentation

### Complete Documentation

- **[SECURITY_REVIEW_2026-01-12.md](./SECURITY_REVIEW_2026-01-12.md)** - Full 45-page security analysis
- **[SECURITY_FIXES_2026-01-12.md](./SECURITY_FIXES_2026-01-12.md)** - Detailed fix documentation
- **[SECURITY_REVIEW_SUMMARY.md](./SECURITY_REVIEW_SUMMARY.md)** - Quick security reference
- **[FIXES_COMPLETE.md](./FIXES_COMPLETE.md)** - Deployment guide

### Configuration Files

- **`mcp-server/.env.example`** - MCP server configuration template
- **`existing-solution/.env.example`** - Telegram bot configuration template
- **`.mcp.json`** - MCP server registration example

---

## 🔄 Updates and Contributions

### Recent Changes

See [CHANGELOG.md](./CHANGELOG.md) for detailed version history.

**v2.1.0 (2026-01-12)** - Security & UX Improvements
- ✅ Fixed all remaining security vulnerabilities (95/100 score)
- ✅ Added admin-only confirmations for groups
- ✅ Implemented `/cancel` command
- ✅ Fixed Markdown injection vulnerability
- ✅ Improved confirmation retry capability
- ✅ Enhanced audit logging

**v2.0.0 (2026-01-11)** - Major Release
- ✅ Added MCP server for Claude notifications
- ✅ Implemented HMAC message signing
- ✅ Added three-tier confirmation system
- ✅ Implemented rate limiting
- ✅ Added secret detection and redaction

### Roadmap

- [ ] Web dashboard for monitoring
- [ ] Multi-user session management
- [ ] Document support (PDF, DOCX)
- [ ] Custom MCP tool definitions
- [ ] Workflow automation
- [ ] Persistent conversation history

### Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

Please read [CONTRIBUTING.md](./CONTRIBUTING.md) for contribution guidelines.

---

## 💡 FAQ

### General Questions

**Q: How much does it cost to use?**
- Telegram Bot: **Free**
- Claude Code: Requires **Claude Pro subscription** ($20/month)
- OpenAI Whisper: **~$0.006 per minute** of audio
- Total: ~$20-30/month depending on usage

**Q: Can I use it in production?**

Yes! The system has achieved a security score of 95/100 (A) and is production-ready. Recommended additions:
- Monitoring and alerting
- Automated backups
- Health checks
- Deploy on VPS (not localhost)

**Q: What systems does it work on?**
- ✅ Windows 10/11
- ✅ macOS (Intel and Apple Silicon)
- ✅ Linux (Ubuntu, Debian, Fedora, etc.)

**Q: Do I need to keep my computer on?**

For 24/7 operation, deploy on a VPS:
- AWS EC2, DigitalOcean, Linode, etc.
- Use PM2 for process management: `pm2 start index.js`
- Configure systemd for auto-start on Linux

### Security Questions

**Q: Is it safe to use?**

Yes, with proper configuration:
- Security score: 95/100 (A) - Production ready
- HMAC message signing prevents tampering
- Comprehensive audit logging
- Rate limiting prevents abuse
- Secret detection prevents data leaks
- Admin controls for group chats

**Q: Can others access my Claude?**

No, if properly configured:
- Set `AUTHORIZED_CHAT_ID` to your Chat ID only
- Keep bot token secret
- Use admin-only confirmations in groups
- Review audit logs regularly

**Q: What data is sent to external APIs?**
- **Anthropic API**: Text messages and images you send
- **OpenAI API**: Voice messages (for transcription)
- **Telegram API**: All bot messages and media
- **Local system**: All commands execute locally

**Q: How do I secure a production deployment?**
```bash
# 1. Set file permissions
chmod 600 mcp-server/.env
chmod 600 existing-solution/.env

# 2. Enable admin controls
echo "GROUP_ADMIN_ONLY_CONFIRMATIONS=true" >> .env

# 3. Set strong HMAC secret (32+ characters)
openssl rand -hex 32

# 4. Use session allowlists
echo "MCP_SESSION_ALLOWLIST=session-1,session-2" >> mcp-server/.env

# 5. Monitor audit logs
tail -f existing-solution/logs/audit.log
```

### Technical Questions

**Q: How does the MCP server work?**

The MCP server implements the [Model Context Protocol](https://modelcontextprotocol.io/) and provides three tools:
1. `telegram_notify` - Send messages
2. `telegram_ask` - Request input
3. `telegram_request_permission` - Get approval

Messages are queued in JSON files and processed via Telegram Bot API.

**Q: Can I run multiple instances?**

Yes, but:
- Each instance needs a unique Telegram bot
- MCP server can handle multiple Claude sessions
- Shared queue ensures message ordering
- Use session allowlists for access control

**Q: How do I debug issues?**

```bash
# Enable debug logging
export DEBUG=telegram:*

# MCP server logs
tail -f mcp-server/logs/mcp-server.log

# Bot logs
tail -f existing-solution/logs/bot.log

# Audit logs (security events)
tail -f existing-solution/logs/audit.log

# Test MCP server manually
echo '{"method":"telegram_notify","params":{"message":"test"}}' | node mcp-server/index.js
```

**Q: Can I customize the confirmation system?**

Yes! Edit `existing-solution/src/security/confirmations.js`:
```javascript
// Add custom patterns
const DESTRUCTIVE_PATTERNS = [
  { pattern: /your-pattern/i, level: 'high', description: 'Your operation' },
  // ... existing patterns
];
```

---

## 📄 License

MIT License - see [LICENSE](./LICENSE) for details.

This project is free and open-source. You can:
- ✅ Use commercially
- ✅ Modify and distribute
- ✅ Use privately
- ✅ Patent use allowed

Requirements:
- Include copyright notice
- Include license text

---

## 🙏 Credits

Built with:
- **[Claude Code](https://www.anthropic.com)** - AI-powered coding assistant by Anthropic
- **[Telegram Bot API](https://core.telegram.org/bots)** - Messaging platform
- **[OpenAI Whisper](https://openai.com/research/whisper)** - Speech-to-text
- **[Model Context Protocol](https://modelcontextprotocol.io/)** - MCP standard

Special thanks to:
- Claude Sonnet 4.5 for security review and implementation assistance
- Open source community for feedback and contributions

---

## 📞 Support

### Get Help

- **Issues**: [GitHub Issues](https://github.com/henrikaavik/claude-telegram-bridge/issues)
- **Discussions**: [GitHub Discussions](https://github.com/henrikaavik/claude-telegram-bridge/discussions)
- **Security**: See [SECURITY.md](./SECURITY.md) for responsible disclosure

### Useful Links

- [Claude Code Documentation](https://docs.claude.com/en/docs/claude-code)
- [Telegram Bot API Docs](https://core.telegram.org/bots/api)
- [MCP Protocol Specification](https://modelcontextprotocol.io/docs)
- [Security Review Report](./SECURITY_REVIEW_2026-01-12.md)

---

<p align="center">
  Made with ❤️ using Claude Code and the Model Context Protocol
</p>

<p align="center">
  <sub>Contributions welcome! See <a href="./CONTRIBUTING.md">CONTRIBUTING.md</a> for guidelines.</sub>
</p>
