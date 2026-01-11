# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2026-01-11 - Enhanced Security & Multi-Session Update

### 🔐 Major Security Enhancements

#### Removed Dangerous Flag
- **BREAKING**: Removed `--dangerously-skip-permissions` flag from Claude Code invocation
- Claude Code will now ask for user confirmation for potentially destructive operations
- This prevents automatic execution of dangerous commands without user oversight

#### Confirmation System
- Added comprehensive confirmation system for destructive operations
- Three security levels:
  - **Low** (⚠️): Simple yes/no confirmation
  - **Medium** (🚨): Inline button confirmation
  - **High** (🔴): Requires exact phrase "I CONFIRM THIS ACTION"
- Detects dangerous patterns:
  - Git operations (`git push --force`, `git reset --hard`)
  - File deletions (`rm -rf`, file wildcards)
  - Database operations (`DROP TABLE`, `TRUNCATE`)
  - System commands (`chmod 777`, `sudo`)
  - Docker operations (`docker system prune`)

#### Rate Limiting
- Protects against abuse and API quota exhaustion
- Three separate rate limit types:
  - **Messages**: 20 per minute
  - **Audio**: 10 per minute
  - **Sessions**: 5 per minute
- Automatic warnings sent to users when limits are hit
- Audit logging for rate limit violations

#### Audit Logging
- Comprehensive structured logging system
- Logs all security-relevant events:
  - User actions (messages, commands)
  - Security events (confirmations, rejections)
  - Destructive operations (confirmed/rejected)
  - Rate limit violations
  - Session lifecycle events
  - Authentication attempts
- Logs stored in `logs/audit.log` (JSON format)
- Automatic log rotation at 10 MB
- Sensitive data redaction (API keys, tokens, passwords)

### 🔄 Multi-Session Support

#### Session Manager
- New `SessionManager` class for managing multiple parallel Claude Code instances
- Each user can have multiple named sessions with different workspaces
- Session persistence - survives bot restarts
- Session state tracking (creation time, message count, last activity)

#### New Commands
- `/session` - Show multi-session management help
- `/session new <name> [path]` - Create new session in specified workspace
- `/sessions` - List all your sessions with status indicators
- `/switch <name>` - Switch to a different session
- `/kill <name>` - Terminate a specific session
- Quick routing: `@<name> message` - Send message to specific session (planned)

#### Session Features
- 🟢 Active / 🔴 Inactive status indicators
- ⭐️ Current session marker
- Workspace path display
- Message count tracking
- Last activity timestamps
- Automatic cleanup on termination

### 🔌 Claude Code Plugin

#### Bot Control Plugin
- New plugin for controlling bot from within Claude Code CLI
- Plugin location: `telegram-bot-plugin/`
- Bidirectional control - manage bot from both sides

#### Plugin Tools
- `start_telegram_bot` - Start bot in background
- `stop_telegram_bot` - Stop bot gracefully
- `telegram_bot_status` - Check bot status, uptime, PID
- `restart_telegram_bot` - Restart bot (useful after config changes)
- `notify_telegram` - Send notifications from Claude Code to Telegram
- `list_telegram_sessions` - View all active sessions

#### Notification System
- Send messages from Claude Code to Telegram
- Priority levels: normal, high, urgent
- Formatted with emojis and timestamps
- Useful for long-running task notifications

### 📁 New File Structure

```
existing-solution/
├── src/
│   ├── security/
│   │   ├── confirmations.js    # Confirmation system
│   │   ├── rateLimit.js        # Rate limiting
│   │   └── auditLog.js         # Audit logging
│   └── session/
│       └── SessionManager.js   # Multi-session management
├── telegram-bot-plugin/
│   ├── .claude-plugin          # Plugin definition
│   ├── bot-manager.js          # Bot lifecycle manager
│   └── README.md               # Plugin documentation
├── logs/
│   ├── audit.log               # Security audit log
│   └── bot.log                 # Bot process log
├── data/
│   └── sessions.json           # Session persistence
└── temp/                       # Temporary audio files
```

### 🛠️ Technical Improvements

#### Code Organization
- Modular architecture with separate security and session modules
- ES6 modules throughout
- Clear separation of concerns
- Comprehensive inline documentation

#### Security Patterns
- Destructive operation detection via regex patterns
- Confirmation state management with auto-expiration
- Sensitive data redaction in logs
- Process isolation for bot control

#### Performance
- Efficient rate limiting with automatic cleanup
- Log file rotation to prevent disk space issues
- Session state persistence for quick restarts
- Detached background processes

### 📝 Documentation

- **CHANGELOG.md** - This file
- **SECURITY.md** - Security features and best practices
- **telegram-bot-plugin/README.md** - Plugin installation and usage
- **MULTI-SESSION-DESIGN.md** - Multi-session architecture
- **IMPLEMENTATION-PLAN.md** - Original implementation plan

### ⚠️ Breaking Changes

1. **Removed `--dangerously-skip-permissions`**: Claude Code will now ask for confirmations. This is a BREAKING change for automated workflows that relied on zero-confirmation execution.

2. **New Dependencies**: Added security and session modules that must be present.

3. **Session Management**: Old single-session logic replaced with multi-session manager. Session data structure changed.

### 🔄 Migration Guide

#### From 1.x to 2.0

1. **Update your expectations**: Claude Code will now ask for confirmation before executing destructive operations. This is intentional and improves security.

2. **Multiple sessions**: If you were using multiple bots for different projects, you can now use one bot with multiple sessions:
   ```
   /session new main ~/project1
   /session new api ~/project2
   /switch api
   ```

3. **Rate limits**: If you're hitting rate limits, consider:
   - Spacing out your messages
   - Using multiple sessions instead of rapid-fire messages
   - Adjusting rate limits in `src/security/rateLimit.js` if needed

4. **Audit logs**: Check `logs/audit.log` periodically to review security events.

### 🐛 Bug Fixes

- Fixed session cleanup on bot restart
- Fixed memory leaks in streaming message buffers
- Improved error handling in audio transcription

### 📊 Statistics

- **Code Added**: ~2,500 lines
- **New Modules**: 4 (confirmations, rateLimit, auditLog, SessionManager)
- **New Commands**: 5 (/session, /sessions, /switch, /kill, plus subcommands)
- **New Plugin Tools**: 6 (start, stop, status, restart, notify, sessions)
- **Security Patterns**: 15+ dangerous operation patterns detected
- **Rate Limits**: 3 separate limiters

### 🙏 Credits

- Original bot by viniciustodesco/claude-telegram-bridge (MIT License)
- Security enhancements and multi-session support by Henrik Aavik
- Based on comprehensive planning and analysis session

### 🔮 Future Enhancements (Planned)

- [ ] Quick routing syntax (`@session message`)
- [ ] Session groups/workspaces
- [ ] Configurable rate limits via .env
- [ ] Web dashboard for session monitoring
- [ ] Metrics and analytics
- [ ] Session templates
- [ ] Backup/restore for sessions
- [ ] Integration with other Claude Code features

## [1.0.0] - 2025-01-XX - Original Release

Original features from viniciustodesco/claude-telegram-bridge:
- Real-time streaming of Claude responses
- Audio transcription via OpenAI Whisper
- Multi-language support (EN, PT, NL)
- Group chat support
- Photo/vision support
- Session management
- Telegram bot integration
