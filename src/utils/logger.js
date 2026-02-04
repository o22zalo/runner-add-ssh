/**
 * Logger Utility
 * 
 * Provides logging to console and file with timestamp, version tracking,
 * and sensitive data masking.
 */

const path = require('path');
const fs = require('fs').promises;
const { getVNTimestamp, getVNDate } = require('../adapters/time');
const { maskSensitive } = require('./mask');

class Logger {
  constructor(options = {}) {
    this.cwd = options.cwd || process.cwd();
    this.verbose = options.verbose || false;
    this.quiet = options.quiet || false;
    
    // Package info
    const packageJson = require('../../package.json');
    this.packageName = packageJson.name;
    this.packageVersion = packageJson.version;
    
    // Log file path
    const logDir = path.join(this.cwd, '.runner-data', 'logs');
    const logDate = getVNDate();
    this.logFilePath = path.join(logDir, `ssh-setup-${logDate}.log`);
    
    // Ensure log directory exists
    this._ensureLogDir();
    
    // Write header
    this._writeHeader();
  }

  async _ensureLogDir() {
    try {
      const logDir = path.dirname(this.logFilePath);
      await fs.mkdir(logDir, { recursive: true });
    } catch (error) {
      // Ignore error, logging is not critical
    }
  }

  _writeHeader() {
    const header = `
═══════════════════════════════════════════════════════════
${this.packageName} v${this.packageVersion}
Started at: ${getVNTimestamp()}
Working directory: ${this.cwd}
═══════════════════════════════════════════════════════════
`;
    this._writeToFile(header);
  }

  _formatMessage(level, message, data = null) {
    const timestamp = getVNTimestamp();
    let formatted = `[${timestamp}] [${level}] ${message}`;
    
    if (data) {
      // Mask sensitive data
      const maskedData = this._maskData(data);
      formatted += `\n${JSON.stringify(maskedData, null, 2)}`;
    }
    
    return formatted;
  }

  _maskData(data) {
    if (typeof data !== 'object' || data === null) {
      return data;
    }

    const masked = Array.isArray(data) ? [] : {};

    for (const key in data) {
      const value = data[key];
      const lowerKey = key.toLowerCase();

      // Check if key contains sensitive words
      if (lowerKey.includes('key') || 
          lowerKey.includes('token') || 
          lowerKey.includes('secret') || 
          lowerKey.includes('password') ||
          lowerKey.includes('auth')) {
        masked[key] = maskSensitive(String(value));
      } else if (typeof value === 'object') {
        masked[key] = this._maskData(value);
      } else {
        masked[key] = value;
      }
    }

    return masked;
  }

  async _writeToFile(message) {
    try {
      await fs.appendFile(this.logFilePath, message + '\n', 'utf8');
    } catch (error) {
      // Silently fail, logging is not critical
    }
  }

  _log(level, message, data = null) {
    const formatted = this._formatMessage(level, message, data);
    this._writeToFile(formatted);
  }

  info(message, data = null) {
    if (!this.quiet) {
      console.log(message);
    }
    this._log('INFO', message, data);
  }

  warn(message, data = null) {
    if (!this.quiet) {
      console.warn(`⚠️  ${message}`);
    }
    this._log('WARN', message, data);
  }

  error(message, data = null) {
    console.error(`❌ ${message}`);
    if (data) {
      const maskedData = this._maskData(data);
      console.error(JSON.stringify(maskedData, null, 2));
    }
    this._log('ERROR', message, data);
  }

  debug(message, data = null) {
    if (this.verbose && !this.quiet) {
      console.log(`[DEBUG] ${message}`);
    }
    this._log('DEBUG', message, data);
  }

  success(message, data = null) {
    if (!this.quiet) {
      console.log(`✅ ${message}`);
    }
    this._log('SUCCESS', message, data);
  }
}

module.exports = Logger;
