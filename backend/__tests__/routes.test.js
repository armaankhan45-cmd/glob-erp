// Smoke tests: every route file must load. A file that throws on require is
// served by server.js as a 500 "Route failed to load" for the whole section.
const fs = require('fs');
const path = require('path');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const dir = path.join(__dirname, '../src/routes');
const files = fs.readdirSync(dir).filter(f => f.endsWith('.js'));

const endpoints = (router) =>
  router.stack.filter(l => l.route).flatMap(l => Object.keys(l.route.methods).map(m => `${m.toUpperCase()} ${l.route.path}`));

describe('route modules', () => {
  test.each(files)('%s loads and registers routes', (f) => {
    const router = require(path.join(dir, f));
    expect(typeof router).toBe('function');
    expect(endpoints(router).length).toBeGreaterThan(0);
  });
});

describe('AI assistant', () => {
  const router = require('../src/routes/aiAssistantRoutes');
  const list = endpoints(router);

  test('exposes stream, chat, status and test endpoints', () => {
    expect(list).toEqual(expect.arrayContaining(['POST /stream', 'POST /chat', 'GET /status', 'GET /test']));
  });

  test('defaults Groq to a model that exists (not a retired one)', () => {
    const src = fs.readFileSync(path.join(__dirname, '../src/ai/providers.js'), 'utf8') + fs.readFileSync(path.join(dir, 'aiAssistantRoutes.js'), 'utf8');
    const groqDefaults = [...src.matchAll(/GROQ_MODEL \|\| '([^']+)'/g)].map(m => m[1]);
    expect(groqDefaults.length).toBeGreaterThan(0);
    groqDefaults.forEach(m => expect(m).toBe('openai/gpt-oss-20b'));
  });
});

describe('GST routes', () => {
  test('quarterly and monthly-bills endpoints exist', () => {
    const list = endpoints(require('../src/routes/gstRoutes'));
    expect(list).toEqual(expect.arrayContaining(['GET /quarterly', 'GET /summary', 'GET /monthly-bills']));
  });
});

describe('AI modules', () => {
  test.each(['prompts', 'tools', 'providers', 'replies'])('src/ai/%s loads', (m) => {
    expect(Object.keys(require(`../src/ai/${m}`)).length).toBeGreaterThan(0);
  });
  test('rule-based replies still answer without any AI key', () => {
    const { businessIntent } = require('../src/ai/replies');
    expect(() => businessIntent('show sales this month')).not.toThrow();
  });
});
