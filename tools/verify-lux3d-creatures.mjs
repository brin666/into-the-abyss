import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9224;
const profile = join(tmpdir(), `into-abyss-lux3d-${process.pid}`);
const outputDir = new URL('../build/browser/lux3d-integration-20261002/', import.meta.url);
await mkdir(outputDir, { recursive: true });

const chrome = spawn(chromePath, [
  '--headless=new',
  '--enable-unsafe-swiftshader',
  '--hide-scrollbars',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--window-size=1280,800',
  'http://127.0.0.1:4173/',
], { stdio: 'ignore' });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket;

try {
  let target;
  for (let attempt = 0; attempt < 50; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      target = pages.find((page) => page.type === 'page' && page.url.includes('127.0.0.1:4173'));
      if (target) break;
    } catch {}
    await delay(120);
  }
  if (!target) throw new Error('Chrome DevTools target was not created.');

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });

  let callId = 0;
  const pending = new Map();
  const consoleErrors = [];
  const modelResponses = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') {
      consoleErrors.push(message.params.exceptionDetails.text);
    }
    if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
      consoleErrors.push(message.params.args.map((arg) => arg.value || arg.description).join(' '));
    }
    if (message.method === 'Network.responseReceived' && message.params.response.url.includes('/models/lux3d-20261002/')) {
      modelResponses.push({ url: message.params.response.url, status: message.params.response.status });
    }
  });

  function call(method, params = {}) {
    const id = ++callId;
    socket.send(JSON.stringify({ id, method, params }));
    return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
  }

  async function evaluate(expression) {
    const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  }

  async function screenshot(name) {
    const result = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(new URL(name, outputDir), Buffer.from(result.data, 'base64'));
  }

  await call('Page.enable');
  await call('Runtime.enable');
  await call('Network.enable');
  await call('Page.navigate', { url: 'http://127.0.0.1:4173/' });
  await delay(2200);

  const loadedState = await evaluate('window.IntoTheAbyss?.inspect?.()');
  await screenshot('surface.png');

  await evaluate('window.IntoTheAbyss.triggerCast()');
  await delay(5200);
  await evaluate('window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.50)');
  await evaluate('window.dispatchEvent(new Event("scroll"))');
  await delay(1400);
  await screenshot('baitfish-school.png');
  await evaluate('document.querySelector(\'[data-creature="baitfish"]\')?.click()');
  await delay(700);
  const fishObservation = await evaluate(`({
    inspect: window.IntoTheAbyss.inspect(),
    noteVisible: document.querySelector('#creature-info')?.classList.contains('is-visible'),
    scrollRatio: Number((window.scrollY / Math.max(1, document.documentElement.scrollHeight - innerHeight)).toFixed(3))
  })`);
  await screenshot('baitfish-observation.png');

  await evaluate('document.querySelector("#creature-info-close")?.click()');
  await evaluate('window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.60)');
  await delay(1400);
  await evaluate('document.querySelector(\'[data-creature="turtle"]\')?.click()');
  await delay(700);
  const turtleObservation = await evaluate(`({
    inspect: window.IntoTheAbyss.inspect(),
    noteVisible: document.querySelector('#creature-info')?.classList.contains('is-visible')
  })`);
  await screenshot('turtle-observation.png');

  await call('Emulation.setDeviceMetricsOverride', {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await delay(500);
  await screenshot('turtle-observation-mobile.png');
  await call('Emulation.clearDeviceMetricsOverride');

  const result = {
    loadedState,
    fishObservation,
    turtleObservation,
    modelResponses,
    consoleErrors,
  };
  console.log(JSON.stringify(result, null, 2));

  const loadedModels = loadedState?.creatureModels ?? [];
  const fish = loadedModels.find((model) => model.id === 'baitfish');
  const turtle = loadedModels.find((model) => model.id === 'turtle');
  const responseOk = modelResponses.length === 2 && modelResponses.every((response) => response.status === 200);
  if (
    loadedModels.length !== 3
    || fish?.instances !== 7
    || !turtle
    || !responseOk
    || !fishObservation.noteVisible
    || fishObservation.inspect?.observingCreature !== 'baitfish'
    || !turtleObservation.noteVisible
    || turtleObservation.inspect?.observingCreature !== 'turtle'
    || consoleErrors.length > 0
  ) {
    process.exitCode = 1;
  }
} finally {
  socket?.close();
  chrome.kill();
}
