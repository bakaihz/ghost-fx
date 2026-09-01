const cheerio = require('cheerio');
const Optimizer = require('../requests/Optimizer');

class GhostScraper {
  constructor(options = {}) {
    this.http =
      options.http ||
      new Optimizer(options.requests);

    this.options = options;
  }

  async fetch(url, options = {}) {
    const response =
      await this.http.get(url, options);

    const html =
      typeof response.data === 'string'
        ? response.data
        : JSON.stringify(response.data);

    return {
      url,
      status: response.status,
      headers: response.headers,
      html
    };
  }

  async title(url, options = {}) {
    const page =
      await this.fetch(url, options);

    const $ = cheerio.load(page.html);

    return $('title').first().text().trim() || null;
  }

  async text(url, selector, options = {}) {
    if (!selector) {
      throw new Error('CSS selector is required');
    }

    const page =
      await this.fetch(url, options);

    const $ = cheerio.load(page.html);
    const result = [];

    $(selector).each((_, element) => {
      const text = $(element)
        .text()
        .replace(/\s+/g, ' ')
        .trim();

      if (text) result.push(text);
    });

    return result;
  }

  async attribute(
    url,
    selector,
    attribute,
    options = {}
  ) {
    if (!selector) {
      throw new Error('CSS selector is required');
    }

    if (!attribute) {
      throw new Error('Attribute is required');
    }

    const page =
      await this.fetch(url, options);

    const $ = cheerio.load(page.html);
    const result = [];

    $(selector).each((_, element) => {
      const value =
        $(element).attr(attribute);

      if (value !== undefined) {
        result.push(value);
      }
    });

    return result;
  }

  async links(url, options = {}) {
    return this.attribute(
      url,
      'a',
      'href',
      options
    );
  }

  async scrape(url, options = {}) {
    const page =
      await this.fetch(url, options);

    const $ = cheerio.load(page.html);

    return {
      url,
      status: page.status,
      title: $('title').first().text().trim() || null,
      links: this.extractLinks($, url),
      html: page.html
    };
  }

  extractLinks($, baseUrl) {
    const links = [];

    $('a[href]').each((_, element) => {
      try {
        links.push(
          new URL(
            $(element).attr('href'),
            baseUrl
          ).href
        );
      } catch {
        // Ignora links inválidos
      }
    });

    return [...new Set(links)];
  }
}

module.exports = GhostScraper;
