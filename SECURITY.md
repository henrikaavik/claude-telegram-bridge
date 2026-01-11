# Security Documentation

This document describes the security features, best practices, and considerations for the Telegram Claude Code Bridge.

## 🔐 Security Features

### 1. Removed Dangerous Permissions Flag

**What Changed:**
- Removed `--dangerously-skip-permissions` flag from Claude Code invocation
- Previously, this flag allowed Claude Code to execute ANY command without confirmation

**Why This Matters:**
- Prevents accidental destructive operations
- Adds human-in-the-loop for critical commands
- Protects against compromised Telegram accounts
- Follows principle of least privilege

**Impact:**
- Claude Code will now prompt for confirmation via Telegram before executing dangerous operations
- Users maintain control over what actually gets executed

### 2. Three-Tier Confirmation System

The bot implements a graduated confirmation system based on operation risk level.

#### Low Risk (⚠️ Warning)
**Examples:**
- Deleting a single file
- Uninstalling a package
- Basic file operations

**Confirmation:**
- Simple yes/no inline buttons
- Click "✅ Yes, proceed" or "❌ No, cancel"

#### Medium Risk (🚨 Alert)
**Examples:**
- Git push operations
- Deleting multiple files with wildcards
- Database modifications
- Changing file permissions
- Docker operations

**Confirmation:**
- Inline button confirmation
- Shows exact command that will be executed
- Displays risk level
- Audit logged

#### High Risk (🔴 DANGER)
**Examples:**
- Force git push (`git push --force`)
- Hard git reset (`git reset --hard`)
- Recursive force delete (`rm -rf`)
- Drop database/table operations
- Docker system prune

**Confirmation:**
- Requires exact phrase: `I CONFIRM THIS ACTION`
- Shows clear warning about irreversibility
- No shortcut buttons (prevents accidental clicks)
- Heavily audit logged

### 3. Destructive Operation Detection

The system detects potentially dangerous commands using regex patterns:

```javascript
// Examples of detected patterns:
/git\s+push\s+--force/i        // Force push
/rm\s+-rf/i                     // Recursive force delete
/drop\s+database/i              // Drop database
/chmod\s+777/i                  // Overly permissive permissions
/docker\s+system\s+prune/i      // Docker cleanup
```

**Full Pattern List:**
See `src/security/confirmations.js` for the complete list of 15+ patterns.

**How It Works:**
1. User sends message to bot
2. Message is analyzed for dangerous patterns
3. If match found, confirmation request sent to Telegram
4. User confirms or cancels
5. Operation executed only if confirmed
6. Result logged to audit log

### 4. Rate Limiting

Protects against abuse and prevents API quota exhaustion.

#### Rate Limit Configuration

| Type | Limit | Window | Purpose |
|------|-------|--------|---------|
| Messages | 20 | 1 minute | Prevent spam, API overuse |
| Audio | 10 | 1 minute | Protect Whisper API quota |
| Sessions | 5 | 1 minute | Prevent resource exhaustion |

#### How Rate Limiting Works

```
User sends 21st message within 1 minute
↓
Bot checks rate limit
↓
Limit exceeded
↓
Warning sent to user: "🚨 Rate Limit Exceeded"
↓
Message blocked
↓
Event logged to audit log
↓
User must wait until window resets
```

#### Adjusting Rate Limits

Edit `src/security/rateLimit.js`:

```javascript
const RATE_LIMITS = {
  messages: {
    window: 60 * 1000,    // 1 minute
    maxRequests: 20,       // 20 messages
  },
  // ... adjust as needed
};
```

### 5. Audit Logging

Comprehensive security event logging for forensics and monitoring.

#### What Gets Logged

**Security Events:**
- Destructive operation confirmations (accepted/rejected)
- Rate limit violations
- Authentication failures
- Suspicious activity

**User Actions:**
- Message sends
- Audio transcriptions
- Session creates/switches/kills
- Command executions

**System Events:**
- Session lifecycle events
- Errors and exceptions
- Rate limit warnings

#### Log Format

Logs are stored in JSON format for easy parsing:

```json
{
  "timestamp": "2026-01-11T10:30:45.123Z",
  "level": "SECURITY",
  "event": "destructive_operation",
  "chatId": 1524051553,
  "operation": "git push --force origin main",
  "confirmed": true,
  "level": "high"
}
```

#### Sensitive Data Redaction

The audit logger automatically redacts sensitive information:

- API keys (`sk-...` → `[REDACTED_API_KEY]`)
- Bot tokens (`1234:ABC...` → `[REDACTED_BOT_TOKEN]`)
- Passwords (`password=xxx` → `password=[REDACTED]`)

#### Log Rotation

- Logs automatically rotate at 10 MB
- Keeps last 5 rotated files
- Oldest files automatically deleted

#### Viewing Audit Logs

```bash
# View recent logs
tail -f logs/audit.log

# Search for specific events
grep "destructive_operation" logs/audit.log

# View security events only
grep "SECURITY" logs/audit.log | jq .

# Count rate limit violations
grep "rate_limit_violation" logs/audit.log | wc -l
```

## 🛡️ Security Best Practices

### 1. Environment Variables

**DO:**
- Keep `.env` file in `.gitignore`
- Use strong, unique bot tokens
- Rotate tokens periodically
- Restrict `AUTHORIZED_CHAT_ID` to trusted users

**DON'T:**
- Commit `.env` to version control
- Share bot tokens in public channels
- Use the same token across multiple bots
- Leave authorization disabled in production

### 2. File Permissions

```bash
# Secure your configuration
chmod 600 .env

# Secure logs directory
chmod 700 logs/

# Secure session data
chmod 600 data/sessions.json
```

### 3. Network Security

**Considerations:**
- Telegram Bot API uses HTTPS (encrypted)
- Claude Code communicates over localhost only
- No ports need to be opened
- Bot doesn't expose web servers

**Recommendations:**
- Run bot on trusted infrastructure
- Use firewall rules to block unauthorized access
- Monitor network traffic for anomalies
- Consider VPN for remote bot management

### 4. Access Control

**Chat ID Authorization:**
```bash
# Single user
AUTHORIZED_CHAT_ID=1524051553

# Multiple users (comma-separated)
AUTHORIZED_CHAT_ID=1524051553,9876543210,1122334455
```

**Group Chat Security:**
- Be cautious with group chats
- All group members share same Claude session
- Group messages are visible to all members
- Consider separate bots for different teams

### 5. Monitoring

**What to Monitor:**
- Audit log for suspicious patterns
- Rate limit violations (sudden spikes)
- Failed authentication attempts
- Destructive operation denials
- Unusual session creation patterns

**Alerting:**
- Use `notify_telegram` tool to send critical alerts
- Set up log monitoring tools (e.g., Grafana, ELK)
- Review audit logs weekly

### 6. Session Security

**Best Practices:**
- Use descriptive session names
- Don't share session data between users
- Kill unused sessions regularly
- Set different workspaces for different projects
- Review session list periodically with `/sessions`

**Workspace Isolation:**
```bash
# Good: Separate workspaces
/session new clientA ~/projects/clientA
/session new clientB ~/projects/clientB

# Bad: Shared workspace
/session new all ~/projects  # Risk of file conflicts
```

## 🚨 Threat Model

### Threats We Protect Against

1. **Accidental Destructive Operations**
   - **Threat**: User accidentally requests dangerous operation
   - **Mitigation**: Confirmation system with 3 risk levels

2. **Compromised Telegram Account**
   - **Threat**: Attacker gains access to authorized Telegram account
   - **Mitigation**: Confirmation system, audit logging, rate limiting

3. **API Quota Exhaustion**
   - **Threat**: Malicious or accidental API overuse
   - **Mitigation**: Rate limiting (20 msg/min, 10 audio/min)

4. **Unauthorized Access**
   - **Threat**: Random Telegram users trying to use bot
   - **Mitigation**: `AUTHORIZED_CHAT_ID` whitelist

5. **Session Hijacking**
   - **Threat**: Attacker tries to access another user's session
   - **Mitigation**: Session isolation by chat ID

### Threats We DON'T Fully Protect Against

1. **Compromised Server**
   - If the server running the bot is compromised, attacker has full access
   - **Recommendation**: Use secure hosting, regular updates, monitoring

2. **Social Engineering**
   - Attacker tricks authorized user into confirming dangerous operations
   - **Recommendation**: User education, careful review of confirmations

3. **Claude Code Exploits**
   - Vulnerabilities in Claude Code itself
   - **Recommendation**: Keep Claude Code updated to latest version

4. **Telegram API Vulnerabilities**
   - Issues with Telegram's Bot API
   - **Recommendation**: Monitor Telegram security announcements

## 🔍 Security Checklist

Use this checklist when deploying:

### Initial Setup
- [ ] Strong bot token generated
- [ ] `AUTHORIZED_CHAT_ID` configured
- [ ] `.env` file secured (chmod 600)
- [ ] `.env` added to `.gitignore`
- [ ] Logs directory created with proper permissions

### Configuration
- [ ] Rate limits reviewed and adjusted if needed
- [ ] Audit logging enabled
- [ ] Workspace paths configured correctly
- [ ] OpenAI API key secured (if using Whisper)

### Deployment
- [ ] Bot running on secure server
- [ ] Firewall rules configured
- [ ] Log rotation working
- [ ] Monitoring set up
- [ ] Backup plan for session data

### Ongoing
- [ ] Review audit logs weekly
- [ ] Monitor rate limit violations
- [ ] Update Claude Code regularly
- [ ] Rotate bot token quarterly
- [ ] Clean up unused sessions monthly

## 📞 Reporting Security Issues

If you discover a security vulnerability, please:

1. **DO NOT** open a public issue
2. Email the maintainer privately
3. Include detailed steps to reproduce
4. Allow reasonable time for fix before disclosure

## 📚 Additional Resources

- [Telegram Bot API Security](https://core.telegram.org/bots/faq#security)
- [Claude Code Documentation](https://docs.anthropic.com/claude-code)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)

## 📝 Security Updates

| Date | Version | Update |
|------|---------|--------|
| 2026-01-11 | 2.0.0 | Initial security enhancements: confirmations, rate limiting, audit logging |

---

**Remember**: Security is a continuous process. Stay vigilant, monitor logs, and keep software updated.
