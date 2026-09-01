const Optimizer = require('../requests/Optimizer');
const GhostEngine = require('../engine/Engine');
const GhostScraper = require('../scraper/Scraper');
const ProcessManager = require('../process/ProcessManager');
const GhostConfig = require('./Config');
const fs = require('fs');
const path = require('path');

class Ghost {
  constructor(options = {}) {
    this.name = 'Ghost FX';
    const configPath = path.resolve(process.cwd(), 'ghost.config.js');
    let externalConfig = {};

    if (fs.existsSync(configPath)) {
      externalConfig = require(configPath);
    }

    const finalOptions = {
      ...externalConfig,
      ...options,
      requests: {
        ...(externalConfig.requests || {}),
        ...(options.requests || {})
      },
      security: {
        ...(externalConfig.security || {}),
        ...(options.security || {})
      },
      queue: {
        ...(externalConfig.queue || {}),
        ...(options.queue || {})
      }
    };

    this.options = finalOptions;
    this.config = new GhostConfig(finalOptions);
    this.version = '1.0.0-beta.5';
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
