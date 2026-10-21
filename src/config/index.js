import { DEFAULT_CONFIG, validateAndSanitizeConfig } from './schema.js';
import { logger } from '../utils/logger.js';

class ConfigManager {
  constructor() {
    this.config = { ...DEFAULT_CONFIG };
    logger.getDebug = () => this.config.debug;
  }

  init(userConfig = {}) {
    // If window.ELYSIUM_CONFIG exists in browser runtime, merge it first
    let globalWindowConfig = {};
    if (typeof window !== 'undefined' && window.ELYSIUM_CONFIG) {
      globalWindowConfig = window.ELYSIUM_CONFIG;
    }

    this.config = validateAndSanitizeConfig({
      ...globalWindowConfig,
      ...userConfig,
    });

    logger.debug('Configuration initialized:', {
      ...this.config,
      apiKey: this.config.apiKey ? `${this.config.apiKey.slice(0, 7)}...` : '(empty)',
    });

    return this.config;
  }

  get() {
    return this.config;
  }

  set(updates = {}) {
    this.config = validateAndSanitizeConfig({
      ...this.config,
      ...updates,
    });
    return this.config;
  }
}

export const configManager = new ConfigManager();
export const getConfig = () => configManager.get();
export const setConfig = (cfg) => configManager.set(cfg);
