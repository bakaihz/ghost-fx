const { spawn } = require('child_process');

class ProcessManager {
  constructor(options = {}) {
    this.options = {
      autoRestart: options.autoRestart ?? false,
      maxRestarts: options.maxRestarts ?? 5,
      restartDelay: options.restartDelay ?? 1000
    };

    this.processes = new Map();
  }

  log(icon, message) {
    console.log(`[Ghost Process] ${icon} ${message}`);
  }

  start(name, command, args = [], options = {}) {
    if (this.processes.has(name)) {
      throw new Error(`Process "${name}" is already registered`);
    }

    const info = {
      name,
      command,
      args,
      cwd: options.cwd || process.cwd(),
      env: options.env || {},
      autoRestart: options.autoRestart ?? this.options.autoRestart,
      maxRestarts: options.maxRestarts ?? this.options.maxRestarts,
      restartDelay: options.restartDelay ?? this.options.restartDelay,
      restarts: 0,
      status: 'starting',
      pid: null,
      startedAt: null,
      stoppedAt: null,
      exitCode: null,
      signal: null,
      child: null
    };

    this.processes.set(name, info);
    this.spawn(info);

    return this.status(name);
  }

  spawn(info) {
    const child = spawn(info.command, info.args, {
      cwd: info.cwd,
      env: {
        ...process.env,
        ...info.env
      },
      stdio: ['ignore', 'pipe', 'pipe']
    });

    info.child = child;
    info.pid = child.pid;
    info.status = 'online';
    info.startedAt = Date.now();
    info.stoppedAt = null;

    this.log(
      '●',
      `${info.name} started (PID ${info.pid})`
    );

    child.stdout.on('data', data => {
      process.stdout.write(
        `  ${info.name} │ ${data}`
      );
    });

    child.stderr.on('data', data => {
      process.stderr.write(
        `  ${info.name} │ ERROR │ ${data}`
      );
    });

    child.on('error', error => {
      info.status = 'error';
      info.lastError = error.message;

      this.log(
        '✖',
        `${info.name} error: ${error.message}`
      );
    });

    child.on('exit', (code, signal) => {
      if (info.child !== child) return;

      info.pid = null;
      info.exitCode = code;
      info.signal = signal;
      info.stoppedAt = Date.now();

      if (
        info.autoRestart &&
        info.restarts < info.maxRestarts
      ) {
        info.status = 'restarting';
        info.restarts++;

        this.log(
          '↻',
          `${info.name} crashed — restart ${info.restarts}/${info.maxRestarts}`
        );

        setTimeout(() => {
          if (this.processes.get(info.name) === info) {
            this.spawn(info);
          }
        }, info.restartDelay);

        return;
      }

      info.status = 'stopped';

      this.log(
        '■',
        `${info.name} stopped (code ${code ?? 'null'})`
      );
    });
  }

  stop(name) {
    const info = this.get(name);

    info.autoRestart = false;

    if (!info.child) {
      info.status = 'stopped';
      return this.status(name);
    }

    info.status = 'stopping';

    this.log('■', `Stopping ${name}...`);

    info.child.kill('SIGTERM');

    return this.status(name);
  }

  restart(name) {
    const info = this.get(name);

    info.autoRestart = false;

    this.log('↻', `Restarting ${name}...`);

    if (info.child) {
      info.child.kill('SIGTERM');
    }

    info.restarts++;

    setTimeout(() => {
      if (this.processes.get(name) === info) {
        info.autoRestart = this.options.autoRestart;
        this.spawn(info);
      }
    }, info.restartDelay);

    return this.status(name);
  }

  get(name) {
    const info = this.processes.get(name);

    if (!info) {
      throw new Error(
        `Process "${name}" not found`
      );
    }

    return info;
  }

  status(name) {
    const info = this.get(name);

    const uptime =
      info.startedAt &&
      info.status === 'online'
        ? Date.now() - info.startedAt
        : 0;

    return {
      name: info.name,
      pid: info.pid,
      status: info.status,
      restarts: info.restarts,
      uptime,
      startedAt: info.startedAt
        ? new Date(info.startedAt).toISOString()
        : null,
      stoppedAt: info.stoppedAt
        ? new Date(info.stoppedAt).toISOString()
        : null,
      exitCode: info.exitCode,
      signal: info.signal
    };
  }

  list() {
    return [...this.processes.keys()]
      .map(name => this.status(name));
  }

  table() {
    const processes = this.list();

    console.log('');
    console.log('Ghost Process');
    console.log('────────────────────────────────────────────');
    console.log(
      'NAME'.padEnd(18) +
      'PID'.padEnd(10) +
      'STATUS'.padEnd(14) +
      'RESTARTS'
    );
    console.log('────────────────────────────────────────────');

    for (const p of processes) {
      console.log(
        String(p.name).padEnd(18) +
        String(p.pid ?? '-').padEnd(10) +
        String(p.status).padEnd(14) +
        String(p.restarts)
      );
    }

    console.log('────────────────────────────────────────────');
    console.log(`${processes.length} process(es)`);
    console.log('');
  }
}

module.exports = ProcessManager;
