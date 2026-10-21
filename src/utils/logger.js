/**
 * Safe logger for ElysiumSDK
 */
export class Logger {
  constructor(getDebug = () => false) {
    this.getDebug = getDebug;
    this.prefix = '[ElysiumSDK]';
  }

  debug(...args) {
    if (this.getDebug()) {
      console.debug(this.prefix, ...args);
    }
  }

  info(...args) {
    if (this.getDebug()) {
      console.info(this.prefix, ...args);
    }
  }

  warn(...args) {
    console.warn(this.prefix, ...args);
  }

  error(...args) {
    console.error(this.prefix, ...args);
  }
}

export const logger = new Logger();
