class GhostQueue {
  constructor(options = {}) {
    this.concurrency = options.concurrency ?? 5;
    this.active = 0;
    this.queue = [];
    this.completed = 0;
    this.failed = 0;
  }

  add(task, options = {}) {
    if (typeof task !== 'function') {
      throw new TypeError('Queue task must be a function');
    }

    return new Promise((resolve, reject) => {
      this.queue.push({
        task,
        priority: options.priority ?? 0,
        resolve,
        reject
      });

      this.queue.sort((a, b) => b.priority - a.priority);
      this.process();
    });
  }

  async process() {
    while (
      this.active < this.concurrency &&
      this.queue.length > 0
    ) {
      const job = this.queue.shift();

      this.active++;

      Promise.resolve()
        .then(() => job.task())
        .then(result => {
          this.completed++;
          job.resolve(result);
        })
        .catch(error => {
          this.failed++;
          job.reject(error);
        })
        .finally(() => {
          this.active--;
          this.process();
        });
    }
  }

  clear() {
    const pending = this.queue.splice(0);

    for (const job of pending) {
      job.reject(new Error('Queue cleared'));
    }
  }

  size() {
    return this.queue.length;
  }

  stats() {
    return {
      queued: this.queue.length,
      active: this.active,
      completed: this.completed,
      failed: this.failed,
      concurrency: this.concurrency
    };
  }
}

module.exports = GhostQueue;
