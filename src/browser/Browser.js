const fs = require('fs/promises');
const path = require('path');
const cheerio = require('cheerio');

class Browser {
  constructor(options = {}) {
    this.file = path.resolve(options.storage || '.ghost/sessions.json');
    this.sessions = new Map();
    this.ready = this.load();
  }

  async load() {
    try {
      const data = JSON.parse(await fs.readFile(this.file, 'utf8'));

      for (const session of data) {
        session.cookies = new Map(session.cookies || []);
        session.history = session.history || [];
        this.sessions.set(session.id, session);
      }
    } catch {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
    }
  }

  async save() {
    await this.ready;

    const data = [...this.sessions.values()].map(session => ({
      id: session.id,
      url: session.url,
      headers: session.headers,
      cookies: [...session.cookies.entries()],
      history: session.history
    }));

    await fs.writeFile(
      this.file,
      JSON.stringify(data, null, 2),
      'utf8'
    );
  }

  async createSession(id = `session-${Date.now()}`) {
    await this.ready;

    const session = {
      id,
      url: null,
      headers: {
        'User-Agent': 'GhostFX/1.0'
      },
      cookies: new Map(),
      history: []
    };

    this.sessions.set(id, session);
    await this.save();

    return session;
  }

  async getSession(id) {
    await this.ready;

    const session = this.sessions.get(id);

    if (!session) {
      throw new Error(`Session "${id}" not found`);
    }

    return session;
  }

  setHeader(id, name, value) {
    const session = this.sessions.get(id);

    if (!session) {
      throw new Error(`Session "${id}" not found`);
    }

    session.headers[name] = value;
    return this.save();
  }

  setCookie(id, name, value) {
    const session = this.sessions.get(id);

    if (!session) {
      throw new Error(`Session "${id}" not found`);
    }

    session.cookies.set(name, value);
    return this.save();
  }

  getCookies(id) {
    const session = this.sessions.get(id);

    if (!session) {
      throw new Error(`Session "${id}" not found`);
    }

    return Object.fromEntries(session.cookies);
  }

  getHistory(id) {
    const session = this.sessions.get(id);

    if (!session) {
      throw new Error(`Session "${id}" not found`);
    }

    return [...session.history];
  }

  async navigate(id, url, options = {}) {
    const session = await this.getSession(id);

    const maxRedirects = options.maxRedirects ?? 10;
    let currentUrl = url;
    let redirects = 0;

    while (true) {
      const cookieHeader = [...session.cookies]
        .map(([name, value]) => `${name}=${value}`)
        .join('; ');

      const response = await fetch(currentUrl, {
        redirect: 'manual',
        headers: {
          ...session.headers,
          ...(cookieHeader ? { Cookie: cookieHeader } : {})
        }
      });

      let setCookies = [];

      if (typeof response.headers.getSetCookie === 'function') {
        setCookies = response.headers.getSetCookie();
      } else {
        const cookie = response.headers.get('set-cookie');
        if (cookie) setCookies = [cookie];
      }

      for (const cookie of setCookies) {
        const pair = cookie.split(';')[0];
        const index = pair.indexOf('=');

        if (index > 0) {
          session.cookies.set(
            pair.slice(0, index).trim(),
            pair.slice(index + 1).trim()
          );
        }
      }

      const location = response.headers.get('location');

      if (
        location &&
        response.status >= 300 &&
        response.status < 400
      ) {
        redirects++;

        if (redirects > maxRedirects) {
          throw new Error('Maximum redirects exceeded');
        }

        currentUrl = new URL(location, currentUrl).href;
        continue;
      }

      const body = await response.text();
      const $ = cheerio.load(body);

      session.url = currentUrl;

      session.history.push({
        url: currentUrl,
        status: response.status,
        timestamp: new Date().toISOString()
      });

      await this.save();

      return {
        url: currentUrl,
        status: response.status,
        redirects,
        title: $('title').text(),
        links: $('a')
          .map((_, el) => $(el).attr('href'))
          .get(),
        cookies: Object.fromEntries(session.cookies),
        body
      };
    }
  }

  async closeSession(id) {
    await this.ready;

    const deleted = this.sessions.delete(id);
    await this.save();

    return deleted;
  }
}

module.exports = Browser;
