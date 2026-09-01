#!/usr/bin/env node

const { Ghost } = require('../index');

const ghost = new Ghost();
const [, , command, ...args] = process.argv;

function help() {
  console.log(`
Ghost FX CLI

HTTP:
  ghost info
  ghost get <url>

Scraper:
  ghost scrape <url>
  ghost title <url>
  ghost links <url>

Process Manager:
  ghost process list
  ghost process start <name> <command> [args...]
  ghost process stop <name>
  ghost process restart <name>

System:
  ghost metrics
  ghost queue
  ghost config
`);
}

async function main() {
  switch (command) {
    case 'info':
      console.log(ghost.info());
      break;

    case 'get': {
      if (!args[0]) throw new Error('URL is required');

      const result = await ghost.get(args[0]);

      console.log({
        status: result.status,
        headers: result.headers,
        data: result.data
      });

      break;
    }

    case 'scrape': {
      if (!args[0]) throw new Error('URL is required');

      const result =
        await ghost.scraper.scrape(args[0]);

      console.log({
        url: result.url,
        status: result.status,
        title: result.title,
        links: result.links
      });

      break;
    }

    case 'title': {
      if (!args[0]) throw new Error('URL is required');

      console.log(
        await ghost.scraper.title(args[0])
      );

      break;
    }

    case 'links': {
      if (!args[0]) throw new Error('URL is required');

      console.log(
        await ghost.scraper.links(args[0])
      );

      break;
    }

    case 'metrics':
      console.log(ghost.metrics());
      break;

    case 'queue':
      console.log(ghost.queue.stats());
      break;

    case 'config':
      console.log(ghost.config.get());
      break;

    case 'process': {
      const action = args[0];
      const name = args[1];

      if (action === 'list') {
        ghost.process.table();
        break;
      }

      if (action === 'start') {
        if (!name) {
          throw new Error('Process name is required');
        }

        const command = args[2];

        if (!command) {
          throw new Error('Command is required');
        }

        const commandArgs = args.slice(3);

        ghost.process.start(
          name,
          command,
          commandArgs
        );

        ghost.process.table();
        break;
      }

      if (action === 'stop') {
        if (!name) {
          throw new Error('Process name is required');
        }

        ghost.process.stop(name);
        ghost.process.table();
        break;
      }

      if (action === 'restart') {
        if (!name) {
          throw new Error('Process name is required');
        }

        await ghost.process.restart(name);
        ghost.process.table();
        break;
      }

      throw new Error(
        'Usage: ghost process <list|start|stop|restart>'
      );
    }

    default:
      help();
  }
}

main().catch(error => {
  console.error(`Ghost FX Error: ${error.message}`);
  process.exitCode = 1;
});
