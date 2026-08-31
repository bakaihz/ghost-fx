class GhostShield {
  constructor(options = {}) {
    this.allowedHosts = options.allowedHosts ?? null;
    this.allowedProtocols = options.allowedProtocols ?? [
      'http:',
      'https:'
    ];

    this.blockedPorts = new Set(
      options.blockedPorts ?? [
        22,
        23,
        25,
        110,
        135,
        139,
        445,
        1433,
        3306,
        5432,
        6379,
        9200
      ]
    );

    this.maxRequestSize =
      options.maxRequestSize ?? 2 * 1024 * 1024;

    this.maxResponseSize =
      options.maxResponseSize ?? 10 * 1024 * 1024;
  }

  validateUrl(value) {
    let url;

    try {
      url = new URL(value);
    } catch {
      throw new Error('Ghost Shield: invalid URL');
    }

    if (!this.allowedProtocols.includes(url.protocol)) {
      throw new Error(
        `Ghost Shield: protocol "${url.protocol}" is blocked`
      );
    }

    if (
      this.allowedHosts &&
      !this.allowedHosts.includes(url.hostname)
    ) {
      throw new Error(
        `Ghost Shield: host "${url.hostname}" is not allowed`
      );
    }

    const port = url.port
      ? Number(url.port)
      : url.protocol === 'https:'
        ? 443
        : 80;

    if (this.blockedPorts.has(port)) {
      throw new Error(
        `Ghost Shield: port ${port} is blocked`
      );
    }

    return url;
  }

  validateSize(size, limit, type = 'data') {
    if (!Number.isFinite(size) || size < 0) {
      throw new Error(
        `Ghost Shield: invalid ${type} size`
      );
    }

    if (size > limit) {
      throw new Error(
        `Ghost Shield: ${type} exceeds ${limit} bytes`
      );
    }

    return true;
  }

  sanitizeHeaders(headers = {}) {
    const sensitive = [
      'authorization',
      'proxy-authorization',
      'cookie',
      'set-cookie',
      'x-api-key'
    ];

    const result = {};

    for (const [key, value] of Object.entries(headers)) {
      result[key] = sensitive.includes(
        key.toLowerCase()
      )
        ? '[REDACTED]'
        : value;
    }

    return result;
  }

  validateOptions(options = {}) {
    if (
      options.timeout !== undefined &&
      (!Number.isFinite(options.timeout) ||
        options.timeout <= 0)
    ) {
      throw new Error(
        'Ghost Shield: timeout must be positive'
      );
    }

    if (
      options.maxResponseSize !== undefined
    ) {
      this.validateSize(
        options.maxResponseSize,
        1024 * 1024 * 1024,
        'maxResponseSize'
      );
    }

    if (
      options.maxRequestSize !== undefined
    ) {
      this.validateSize(
        options.maxRequestSize,
        1024 * 1024 * 1024,
        'maxRequestSize'
      );
    }

    return true;
  }
}

module.exports = GhostShield;
