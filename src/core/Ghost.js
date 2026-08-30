class Ghost {
  constructor(options = {}) {
    this.name = 'Ghost FX';
    this.version = '1.0.0-beta.2';
    this.options = options;
  }

  info() {
    return {
      name: this.name,
      version: this.version,
      status: 'online'
    };
  }
}

module.exports = Ghost;
