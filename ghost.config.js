module.exports = {
  requests: {
    timeout: 10000,
    retries: 2,
    maxConcurrent: 5,
    rateLimit: 10
  },

  security: {
    allowHttp: true,
    allowHttps: true,
    allowedHosts: null,
    maxRequestSize: 2 * 1024 * 1024,
    maxResponseSize: 10 * 1024 * 1024
  },

  queue: {
    concurrency: 5
  },

  scraper: {
    respectRobots: true
  },

  process: {
    autoRestart: false,
    maxRestarts: 5
  }
};
