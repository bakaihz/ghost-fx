#!/usr/bin/env node

const {
  ProjectManager,
  RequestOptimizer,
  Browser
} = require('../');

const command = process.argv[2];
const project = new ProjectManager();
const client = new RequestOptimizer();
const browser = new Browser();

async function request() {
  const method = (process.argv[3] || '').toUpperCase();
  const url = process.argv[4];

  if (!method || !url) throw new Error('Uso: ghost request <METHOD> <URL>');

  const response = await client.request(url, { method });

  console.log(`Status: ${response.status}`);
  console.log(`Tempo: ${response.time} ms\n`);
  console.log(JSON.stringify(response.data, null, 2));
}

async function browserCommand() {
  const action = process.argv[3];

  if (action === 'open') {
    const session = await browser.createSession();
    console.log(`Session: ${session.id}`);
    return;
  }

  if (action === 'visit') {
    const id = process.argv[4];
    const url = process.argv[5];

    if (!id || !url) {
      throw new Error('Uso: ghost browser visit <session> <url>');
    }

    const page = await browser.navigate(id, url);

    console.log(`Status: ${page.status}`);
    console.log(`URL: ${page.url}`);
    console.log(`Title: ${page.title}`);
    console.log(`Links: ${page.links.length}`);
    return;
  }

  if (action === 'close') {
    const id = process.argv[4];

    if (!id) throw new Error('Informe a sessão.');

    console.log(
      browser.closeSession(id)
        ? 'Session closed'
        : 'Session not found'
    );
    return;
  }

  console.log(`
Browser:
  ghost browser open
  ghost browser visit <session> <url>
  ghost browser close <session>
`);
}

async function main() {
  switch (command) {
    case 'request':
      await request();
      break;

    case 'browser':
      await browserCommand();
      break;

    case 'ls':
      console.log(
        (await project.list(process.argv[3] || '.'))
          .map(x => x.name)
          .join('\n')
      );
      break;

    case 'read':
      console.log(await project.read(process.argv[3]));
      break;

    case 'mkdir':
      await project.mkdir(process.argv[3]);
      break;

    case 'exists':
      console.log(await project.exists(process.argv[3]));
      break;

    default:
      console.log(`
Ghost FX

  ghost request <METHOD> <URL>
  ghost browser open
  ghost browser visit <session> <url>
  ghost browser close <session>
  ghost ls
  ghost read <file>
  ghost mkdir <directory>
  ghost exists <path>
`);
  }
}

main().catch(error => {
  console.error(`Ghost FX Error: ${error.message}`);
  process.exit(1);
});
