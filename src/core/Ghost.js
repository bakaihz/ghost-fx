const Optimizer = require('../requests/Optimizer');
const GhostEngine = require('../engine/Engine');
const GhostScraper = require('../scraper/Scraper');
const ProcessManager = require('../process/ProcessManager');
const GhostConfig = require('./Config');

class Ghost {
  constructor(options = {}) {
    this.name = 'Ghost FX';
    this.config = new GhostConfig(options);
    this.version = '1.0.0-beta.3';
    this.options = options;

    this.engine = new GhostEngine(options);

    this.http = new Optimizer({
      ...(options.requests ?? {}),
      security: options.security
    });

    this.queue = this.engine.queue;
    this.security = this.engine.shield;
    this.scraper = new GhostScraper({ http: this.http });
    this.process = new ProcessManager();
  }

  info() {
    return {
      name: this.name,
      version: this.version,
      status: 'online'
    };
  }

  request(url, options = {}) {
    this.security.validateUrl(url);

    return this.engine.add(
      () => this.http.request(url, options),
      {
        priority: options.priority ?? 0
      }
    );
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

  metrics() {
    return {
      engine: this.engine.getStats(),
      requests: this.http.getMetrics()
    };
  }
}

module.exports = Ghost;
