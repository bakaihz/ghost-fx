const fs = require('fs/promises');
const path = require('path');

class ProjectManager {
  constructor(root = process.cwd()) {
    this.root = path.resolve(root);
  }

  resolve(target) {
    const resolved = path.resolve(this.root, target);

    if (
      resolved !== this.root &&
      !resolved.startsWith(this.root + path.sep)
    ) {
      throw new Error('Access denied: path outside project');
    }

    return resolved;
  }

  async exists(target) {
    try {
      await fs.access(this.resolve(target));
      return true;
    } catch {
      return false;
    }
  }

  async read(target, encoding = 'utf8') {
    return fs.readFile(this.resolve(target), encoding);
  }

  async write(target, content) {
    const file = this.resolve(target);
    await fs.mkdir(path.dirname(file), { recursive: true });
    await fs.writeFile(file, content, 'utf8');
  }

  async append(target, content) {
    await fs.appendFile(this.resolve(target), content, 'utf8');
  }

  async mkdir(target) {
    await fs.mkdir(this.resolve(target), { recursive: true });
  }

  async list(target = '.') {
    return fs.readdir(this.resolve(target), {
      withFileTypes: true
    });
  }

  async remove(target) {
    return fs.rm(this.resolve(target), {
      recursive: true,
      force: false
    });
  }

  async rename(from, to) {
    await fs.rename(
      this.resolve(from),
      this.resolve(to)
    );
  }
}

module.exports = ProjectManager;
