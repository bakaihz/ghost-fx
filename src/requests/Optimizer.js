class RequestOptimizer {
  constructor(options = {}) {
    this.timeout = options.timeout ?? 10000;
    this.retries = options.retries ?? 2;
    this.maxConcurrent = options.maxConcurrent ?? 5;
    this.rateLimit = options.rateLimit ?? 0;

    this.active = 0;
    this.queue = [];
    this.cache = new Map();
    this.metrics = {
      total: 0,
      success: 0,
      failed: 0,
      cached: 0,
      totalTime: 0
    };
  }

  async request(url, options = {}) {
    return new Promise((resolve, reject) => {
      this.queue.push({ url, options, resolve, reject });
      this.processQueue();
    });
  }

  async processQueue() {
    if (this.active >= this.maxConcurrent || !this.queue.length) return;

    const job = this.queue.shift();
    this.active++;

    try {
      const result = await this.execute(job.url, job.options);
      job.resolve(result);
    } catch (error) {
      job.reject(error);
    } finally {
      this.active--;
      this.processQueue();
    }
  }

  async execute(url, options = {}) {
    const method = (options.method ?? 'GET').toUpperCase();
    const cacheTTL = options.cacheTTL ?? 0;
    const cacheKey = `${method}:${url}:${JSON.stringify(options.body ?? '')}`;

    this.metrics.total++;
    const start = Date.now();

    if (method === 'GET' && cacheTTL > 0) {
      const cached = this.cache.get(cacheKey);

      if (cached && Date.now() - cached.time < cached.ttl) {
        this.metrics.cached++;
        return cached.data;
      }

      this.cache.delete(cacheKey);
    }

    let lastError;

    for (let attempt = 0; attempt <= this.retries; attempt++) {
      try {
        if (this.rateLimit > 0) {
          await new Promise(resolve =>
            setTimeout(resolve, 1000 / this.rateLimit)
          );
        }

        const controller = new AbortController();
        const timer = setTimeout(
          () => controller.abort(),
          this.timeout
        );

        const headers = {
          ...(options.body !== undefined
            ? { 'Content-Type': 'application/json' }
            : {}),
          ...(options.headers ?? {})
        };

        let body = options.body;

        if (
          body !== undefined &&
          typeof body === 'object' &&
          !(body instanceof ArrayBuffer)
        ) {
          body = JSON.stringify(body);
        }

        const response = await fetch(url, {
          ...options,
          method,
          headers,
          body,
          signal: options.signal ?? controller.signal
        });

        clearTimeout(timer);

        const text = await response.text();

        let data;

        try {
          data = text ? JSON.parse(text) : null;
        } catch {
          data = text;
        }

        if (!response.ok) {
          const error = new Error(`HTTP ${response.status}`);
          error.status = response.status;
          error.data = data;
          throw error;
        }

        const result = {
          status: response.status,
          headers: Object.fromEntries(response.headers),
          data,
          time: Date.now() - start
        };

        if (method === 'GET' && cacheTTL > 0) {
          this.cache.set(cacheKey, {
            data: result,
            time: Date.now(),
            ttl: cacheTTL
          });
        }

        this.metrics.success++;
        this.metrics.totalTime += result.time;

        return result;
      } catch (error) {
        lastError = error;

        if (attempt < this.retries) {
          await new Promise(resolve =>
            setTimeout(resolve, 500 * (attempt + 1))
          );
        }
      }
    }

    this.metrics.failed++;
    this.metrics.totalTime += Date.now() - start;

    throw lastError;
  }

  get(url, options = {}) {
    return this.request(url, {
      ...options,
      method: 'GET'
    });
  }

  post(url, body, options = {}) {
    return this.request(url, {
      ...options,
      method: 'POST',
      body
    });
  }

  put(url, body, options = {}) {
    return this.request(url, {
      ...options,
      method: 'PUT',
      body
    });
  }

  patch(url, body, options = {}) {
    return this.request(url, {
      ...options,
      method: 'PATCH',
      body
    });
  }

  delete(url, options = {}) {
    return this.request(url, {
      ...options,
      method: 'DELETE'
    });
  }

  clearCache() {
    this.cache.clear();
  }

  getMetrics() {
    return {
      ...this.metrics,
      averageTime: this.metrics.total
        ? this.metrics.totalTime / this.metrics.total
        : 0,
      queueSize: this.queue.length,
      active: this.active
    };
  }
}

module.exports = RequestOptimizer;
