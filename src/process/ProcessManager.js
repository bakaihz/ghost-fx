const { spawn } = require('child_process');

class ProcessManager {
  constructor() {
    this.processes = new Map();
  }

  start(name, command, args = [], options = {}) {
    if (this.processes.has(name)) {
      throw new Error(`Process "${name}" is already running`);
    }

    const child = spawn(command, args, {
      cwd: options.cwd || process.cwd(),
      env: {
        ...process.env,
        ...(options.env || {})
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    const info = {
      name,
      pid: child.pid,
      command,
      args,
      status: 'online',
      restarts: 0,
      startedAt: new Date().toISOString()
    };

    child.stdout.on('data', data => {
      process.stdout.write(`[${name}] ${data}`);
    });

    child.stderr.on('data', data => {
      process.stderr.write(`[${name}] ${data}`);
    });

    child.on('exit', (code, signal) => {
      const current = this.processes.get(name);

      if (!current) return;

      current.status = 'stopped';
      current.exitCode = code;
      current.signal = signal;
    });

    this.processes.set(name, {
      ...info,
      child
    });

    return this.status(name);
  }

  stop(name) {
    const info = this.processes.get(name);

    if (!info) {
      throw new Error(`Process "${name}" not found`);
    }

    info.child.kill('SIGTERM');
    info.status = 'stopping';

    return this.status(name);
  }

  restart(name) {
    const info = this.processes.get(name);

    if (!info) {
      throw new Error(`Process "${name}" not found`);
    }

    const { command, args } = info;

    this.stop(name);

    return new Promise(resolve => {
      setTimeout(() => {
        this.processes.delete(name);

        const result = this.start(
          name,
          command,
          args
        );

        const current = this.processes.get(name);

        if (current) {
          current.restarts = info.restarts + 1;
        }

        resolve(result);
      }, 300);
    });
  }

  status(name) {
    const info = this.processes.get(name);

    if (!info) return null;

    return {
      name: info.name,
      pid: info.child.pid,
      status: info.status,
      restarts: info.restarts,
      startedAt: info.startedAt,
      exitCode: info.exitCode ?? null
    };
  }

  list() {
    return [...this.processes.keys()]
      .map(name => this.status(name));
  }
}

module.exports = ProcessManager;
