const Optimizer = require('../requests/Optimizer');

class GhostScraper {
  constructor(options = {}) {
    this.http = options.http || new Optimizer(options.requests);
  }

  async fetch(url, options = {}) {
    const response = await this.http.get(url, options);

    return {
      url,
      status: response.status,
      headers: response.headers,
      html: typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data)
    };
  }

  async title(url, options = {}) {
    const page = await this.fetch(url, options);

    const match = page.html.match(
      /<title[^>]*>([\s\S]*?)<\/title>/i
    );

    return match
      ? match[1].replace(/\s+/g, ' ').trim()
      : null;
  }

  async links(url, options = {}) {
    const page = await this.fetch(url, options);
    const links = [];

    const regex =
      /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;

    let match;

    while ((match = regex.exec(page.html))) {
      try {
        links.push(
          new URL(match[1], url).href
        );
      } catch {
        // Ignora links inválidos
      }
    }

    return [...new Set(links)];
  }

  async scrape(url, options = {}) {
    const page = await this.fetch(url, options);

    return {
      url,
      status: page.status,
      title: this.extractTitle(page.html),
      links: this.extractLinks(page.html, url),
      html: page.html
    };
  }

  extractTitle(html) {
    const match = html.match(
      /<title[^>]*>([\s\S]*?)<\/title>/i
    );

    return match
      ? match[1].replace(/\s+/g, ' ').trim()
      : null;
  }

  extractLinks(html, baseUrl) {
    const links = [];
    const regex =
      /<a\b[^>]*href\s*=\s*["']([^"']+)["'][^>]*>/gi;

    let match;

    while ((match = regex.exec(html))) {
      try {
        links.push(
          new URL(match[1], baseUrl).href
        );
      } catch {
        // Ignora links inválidos
      }
    }

    return [...new Set(links)];
  }
}

module.exports = GhostScraper;
