const assert = require('assert');
const { Ghost, RequestOptimizer, ProjectManager, Browser } = require('../src');

async function run() {
  const ghost = new Ghost();
  assert.strictEqual(ghost.info().name, 'Ghost FX');

  const client = new RequestOptimizer();
  assert.strictEqual(client.getMetrics().total, 0);

  const project = new ProjectManager();
  assert.strictEqual(await project.exists('package.json'), true);

  const browser = new Browser();
  const session = await browser.createSession('test-session');

  assert.strictEqual(session.id, 'test-session');

  browser.setHeader(
    'test-session',
    'X-Ghost-Test',
    'true'
  );

  browser.setCookie(
    'test-session',
    'ghost',
    'active'
  );

  assert.strictEqual(
    browser.getCookies('test-session').ghost,
    'active'
  );

  console.log('Ghost FX tests: OK');
}

run().catch(error => {
  console.error('Ghost FX tests: FAILED');
  console.error(error);
  process.exit(1);
});
