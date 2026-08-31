class GhostConfig {
  constructor(options = {}) {
    this.config = {
      requests: {
        timeout: 10000,
        retries: 2,
        maxConcurrent: 5,
        rateLimit: 0,
        ...options.requests
      },

      security: {
        allowHttp: true,
        allowHttps: true,
        allowedHosts: null,
        maxRequestSize: 2 * 1024 * 1024,
        maxResponseSize: 10 * 1024 * 1024,
        ...options.security
      },

      queue: {
        concurrency: 5,
        ...options.queue
      },

      scraper: {
        respectRobots: true,
        ...options.scraper
      },

      process: {
        autoRestart: false,
        maxRestarts: 5,
        ...options.process
      }
    };
  }

  get(section) {
    return section
      ? this.config[section]
      : { ...this.config };
  }

  set(section, values = {}) {
    if (!this.config[section]) {
      throw new Error(`Unknown config section: ${section}`);
    }

    this.config[section] = {
      ...this.config[section],
      ...values
    };

    return this.config[section];
  }

  reset() {
    this.config = new GhostConfig().get();
    return this.get();
  }
}

module.exports = GhostConfig;
