#!/usr/bin/env node

const { Ghost } = require('../index');

const ghost = new Ghost();

const [, , command, ...args] = process.argv;

function help() {
  console.log(`
Ghost FX CLI

Comandos:

  ghost info
  ghost get <url>
  ghost scrape <url>
  ghost title <url>
  ghost links <url>
  ghost metrics
  ghost queue
  ghost config
  ghost process list

Exemplos:

  ghost get https://example.com
  ghost scrape https://example.com
  ghost title https://example.com
`);
}

async function main() {
  switch (command) {
    case 'info':
      console.log(ghost.info());
      break;

    case 'get': {
      if (!args[0]) {
        throw new Error('URL is required');
      }

      const result = await ghost.get(args[0]);

      console.log({
        status: result.status,
        headers: result.headers,
        data: result.data
      });

      break;
    }

    case 'scrape': {
      if (!args[0]) {
        throw new Error('URL is required');
      }

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
      if (!args[0]) {
        throw new Error('URL is required');
      }

      console.log(
        await ghost.scraper.title(args[0])
      );

      break;
    }

    case 'links': {
      if (!args[0]) {
        throw new Error('URL is required');
      }

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

    case 'process':
      if (args[0] === 'list') {
        console.log(ghost.process.list());
      } else {
        console.log('Usage: ghost process list');
      }
      break;

    default:
      help();
  }
}

main().catch(error => {
  console.error(`Ghost FX Error: ${error.message}`);
  process.exitCode = 1;
});
