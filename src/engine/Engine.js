const Queue = require('../queue/Queue');
const Shield = require('../security/Shield');

class GhostEngine {
  constructor(options = {}) {
    this.shield = new Shield(options.security);

    this.queue = new Queue({
      concurrency: options.concurrency ?? 5
    });

    this.stats = {
      requests: 0,
      successful: 0,
      failed: 0,
      blocked: 0
    };
  }

  add(task, options = {}) {
    return this.queue.add(async () => {
      this.stats.requests++;

      try {
        const result = await task();
        this.stats.successful++;
        return result;
      } catch (error) {
        this.stats.failed++;
        throw error;
      }
    }, options);
  }

  validateUrl(url) {
    try {
      return this.shield.validateUrl(url);
    } catch (error) {
      this.stats.blocked++;
      throw error;
    }
  }

  getStats() {
    return {
      ...this.stats,
      queue: this.queue.stats()
    };
  }
}

module.exports = GhostEngine;
