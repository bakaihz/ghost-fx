class RequestOptimizer {
  constructor(options = {}) {
    this.timeout = options.timeout ?? 10000;
    this.retries = options.retries ?? 2;
    this.maxConcurrent = options.maxConcurrent ?? 5;
    this.rateLimit = options.rateLimit ?? 0;

    this.security = {
      allowHttp: options.allowHttp ?? true,
      allowHttps: options.allowHttps ?? true,
      maxResponseSize: options.maxResponseSize ?? 10 * 1024 * 1024,
      maxRequestSize: options.maxRequestSize ?? 2 * 1024 * 1024,
      allowedHosts: options.allowedHosts ?? null
    };

    this.active = 0;
    this.queue = [];
    this.cache = new Map();

    this.metrics = {
      total: 0,
      success: 0,
      failed: 0,
      cached: 0,
      blocked: 0,
      cancelled: 0,
      totalTime: 0
    };
  }

  validateUrl(url) {
    let parsed;

    try {
      parsed = new URL(url);
    } catch {
      throw new Error('Invalid URL');
    }

    if (!['http:', 'https:'].includes(parsed.protocol)) {
      throw new Error(`Protocol "${parsed.protocol}" is not allowed`);
    }

    if (parsed.protocol === 'http:' && !this.security.allowHttp) {
      throw new Error('HTTP requests are disabled');
    }

    if (parsed.protocol === 'https:' && !this.security.allowHttps) {
      throw new Error('HTTPS requests are disabled');
    }

    if (
      this.security.allowedHosts &&
      !this.security.allowedHosts.includes(parsed.hostname)
    ) {
      throw new Error(`Host "${parsed.hostname}" is not allowed`);
    }

    return parsed;
  }

  validateOptions(options) {
    if (
      options.maxResponseSize !== undefined &&
      (!Number.isInteger(options.maxResponseSize) ||
        options.maxResponseSize <= 0)
    ) {
      throw new Error('maxResponseSize must be a positive integer');
    }

    if (
      options.maxRequestSize !== undefined &&
      (!Number.isInteger(options.maxRequestSize) ||
        options.maxRequestSize <= 0)
    ) {
      throw new Error('maxRequestSize must be a positive integer');
    }
  }

  createRequest(url, options = {}) {
    const controller = new AbortController();

    const promise = this.request(url, {
      ...options,
      signal: controller.signal
    });

    return {
      promise,
      cancel: () => controller.abort()
    };
  }

  async request(url, options = {}) {
    this.validateUrl(url);
    this.validateOptions(options);

    return new Promise((resolve, reject) => {
      this.queue.push({
        url,
        options,
        resolve,
        reject
      });

      this.processQueue();
    });
  }

  async processQueue() {
    while (
      this.active < this.maxConcurrent &&
      this.queue.length
    ) {
      const job = this.queue.shift();

      this.active++;

      this.execute(job.url, job.options)
        .then(job.resolve)
        .catch(job.reject)
        .finally(() => {
          this.active--;
          this.processQueue();
        });
    }
  }

  async execute(url, options = {}) {
    const parsedUrl = this.validateUrl(url);
    const method = (options.method ?? 'GET').toUpperCase();

    const cacheTTL = options.cacheTTL ?? 0;

    const cacheKey =
      `${method}:${parsedUrl.href}:` +
      JSON.stringify(options.body ?? '');

    this.metrics.total++;

    const start = Date.now();

    if (method === 'GET' && cacheTTL > 0) {
      const cached = this.cache.get(cacheKey);

      if (
        cached &&
        Date.now() - cached.time < cached.ttl
      ) {
        this.metrics.cached++;
        return cached.data;
      }

      this.cache.delete(cacheKey);
    }

    let body = options.body;

    if (
      body !== undefined &&
      typeof body === 'object' &&
      !(body instanceof ArrayBuffer) &&
      !(body instanceof Uint8Array)
    ) {
      body = JSON.stringify(body);
    }

    const maxRequestSize =
      options.maxRequestSize ??
      this.security.maxRequestSize;

    if (body !== undefined) {
      const size = Buffer.byteLength(
        typeof body === 'string'
          ? body
          : String(body)
      );

      if (size > maxRequestSize) {
        this.metrics.blocked++;

        throw new Error(
          `Request body exceeds ${maxRequestSize} bytes`
        );
      }
    }

    const retries =
      options.retries ?? this.retries;

    let lastError;

    for (let attempt = 0; attempt <= retries; attempt++) {
      let timer;

      try {
        if (this.rateLimit > 0) {
          await new Promise(resolve =>
            setTimeout(
              resolve,
              1000 / this.rateLimit
            )
          );
        }

        const controller = new AbortController();

        const externalSignal = options.signal;

        const abortHandler = () => {
          controller.abort();
        };

        if (externalSignal) {
          if (externalSignal.aborted) {
            controller.abort();
          } else {
            externalSignal.addEventListener(
              'abort',
              abortHandler,
              { once: true }
            );
          }
        }

        timer = setTimeout(
          () => controller.abort(),
          options.timeout ?? this.timeout
        );

        const headers = {
          ...(body !== undefined
            ? {
                'Content-Type':
                  'application/json'
              }
            : {}),
          ...(options.headers ?? {})
        };

        const response = await fetch(
          parsedUrl,
          {
            ...options,
            method,
            headers,
            body,
            signal: controller.signal,
            redirect: 'manual'
          }
        );

        clearTimeout(timer);

        if (externalSignal) {
          externalSignal.removeEventListener(
            'abort',
            abortHandler
          );
        }

        if (
          response.status >= 300 &&
          response.status < 400
        ) {
          const location =
            response.headers.get('location');

          if (!location) {
            throw new Error(
              'Redirect without location'
            );
          }

          const redirectUrl =
            new URL(
              location,
              parsedUrl.href
            );

          this.validateUrl(
            redirectUrl.href
          );

          throw new Error(
            `Redirect blocked: ${redirectUrl.href}`
          );
        }

        const contentLength =
          response.headers.get(
            'content-length'
          );

        const maxResponseSize =
          options.maxResponseSize ??
          this.security.maxResponseSize;

        if (
          contentLength &&
          Number(contentLength) >
            maxResponseSize
        ) {
          this.metrics.blocked++;

          throw new Error(
            `Response exceeds ${maxResponseSize} bytes`
          );
        }

        const text =
          await response.text();

        if (
          Buffer.byteLength(
            text,
            'utf8'
          ) > maxResponseSize
        ) {
          this.metrics.blocked++;

          throw new Error(
            `Response exceeds ${maxResponseSize} bytes`
          );
        }

        let data;

        try {
          data = text
            ? JSON.parse(text)
            : null;
        } catch {
          data = text;
        }

        if (!response.ok) {
          const error = new Error(
            `HTTP ${response.status}`
          );

          error.status =
            response.status;

          error.data = data;

          throw error;
        }

        const result = {
          status: response.status,
          headers:
            Object.fromEntries(
              response.headers
            ),
          data,
          time:
            Date.now() - start
        };

        if (
          method === 'GET' &&
          cacheTTL > 0
        ) {
          this.cache.set(
            cacheKey,
            {
              data: result,
              time: Date.now(),
              ttl: cacheTTL
            }
          );
        }

        this.metrics.success++;
        this.metrics.totalTime +=
          result.time;

        return result;
      } catch (error) {
        lastError = error;

        if (
          error?.name ===
          'AbortError'
        ) {
          this.metrics.cancelled++;
          break;
        }

        if (attempt < retries) {
          await new Promise(
            resolve =>
              setTimeout(
                resolve,
                500 *
                  (attempt + 1)
              )
          );
        }
      }
    }

    this.metrics.failed++;
    this.metrics.totalTime +=
      Date.now() - start;

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

  deleteCache(url, method = 'GET') {
    const parsed = this.validateUrl(url);

    for (const key of this.cache.keys()) {
      if (
        key.startsWith(
          `${method.toUpperCase()}:${parsed.href}:`
        )
      ) {
        this.cache.delete(key);
      }
    }
  }

  getMetrics() {
    return {
      ...this.metrics,
      averageTime:
        this.metrics.total
          ? this.metrics.totalTime /
            this.metrics.total
          : 0,
      queueSize:
        this.queue.length,
      active: this.active
    };
  }
}

module.exports = RequestOptimizer;
