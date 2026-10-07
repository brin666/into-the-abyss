import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9235;
const origin = process.env.ABYSS_VERIFY_URL || 'http://127.0.0.1:4173/';
const outputDir = new URL('../build/browser/', import.meta.url);
await mkdir(outputDir, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), 'abyss-turtle-cold-'));
const chrome = spawn(chromePath, [
  '--headless=new', '--enable-unsafe-swiftshader', '--hide-scrollbars',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--window-size=1280,800', 'about:blank',
], { stdio: 'ignore' });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket;
try {
  let target;
  for (let attempt = 0; attempt < 60; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      target = pages.find((page) => page.type === 'page');
      if (target) break;
    } catch {}
    await delay(120);
  }
  if (!target) throw new Error('Could not create a Chrome DevTools page.');

  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let id = 0;
  const pending = new Map();
  let turtleRequestId = null;
  let interceptMode = 'hold';
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
    if (message.method !== 'Fetch.requestPaused') return;
    if (interceptMode === 'hold') turtleRequestId = message.params.requestId;
    if (interceptMode === 'fail') {
      call('Fetch.failRequest', { requestId: message.params.requestId, errorReason: 'Failed' }).catch(() => {});
    }
  });
  function call(method, params = {}) {
    const callId = ++id;
    socket.send(JSON.stringify({ id: callId, method, params }));
    return new Promise((resolve, reject) => pending.set(callId, { resolve, reject }));
  }
  async function evaluate(expression) {
    const response = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  }
  async function until(description, condition, timeoutMs = 13000) {
    const started = Date.now();
    while (Date.now() - started < timeoutMs) {
      const value = await condition();
      if (value) return value;
      await delay(100);
    }
    throw new Error(`Timed out waiting for ${description}`);
  }
  async function screenshot(name) {
    const capture = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(new URL(name, outputDir), Buffer.from(capture.data, 'base64'));
  }
  async function scrollToTurtle() {
    await until('automatic cast', async () => (await evaluate('window.IntoTheAbyss?.inspect?.()?.castComplete')) === true);
    await evaluate('window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.33)');
    await until('turtle depth', async () => {
      const depth = await evaluate('window.IntoTheAbyss.inspect().depthMeters');
      return depth >= 13 && depth <= 16;
    });
  }
  async function turtleState() {
    return evaluate(`(() => {
      const button = document.querySelector('[data-creature="turtle"]');
      const rect = button.getBoundingClientRect();
      const model = window.IntoTheAbyss.inspect().creatureModels.find((item) => item.id === 'turtle');
      return {
        depth: window.IntoTheAbyss.inspect().depthMeters,
        loaded: !!model,
        model,
        fallbackColor: getComputedStyle(button).backgroundColor,
        targetDisabled: button.disabled,
        center: { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 },
      };
    })()`);
  }

  await call('Page.enable');
  await call('Runtime.enable');
  await call('Network.enable');
  await call('Network.setCacheDisabled', { cacheDisabled: true });
  await call('Fetch.enable', { patterns: [{ urlPattern: '*green_sea_turtle_optimized.glb*', requestStage: 'Request' }] });
  await call('Page.navigate', { url: origin });
  await until('intercepted turtle model request', async () => turtleRequestId);
  await scrollToTurtle();
  const before = await turtleState();
  if (before.loaded || before.targetDisabled || before.fallbackColor === 'rgba(0, 0, 0, 0)') {
    throw new Error(`The delayed turtle fallback failed: ${JSON.stringify(before)}`);
  }
  await screenshot('turtle-cold-fallback.png');

  interceptMode = 'continue';
  await call('Fetch.continueRequest', { requestId: turtleRequestId });
  await until('loaded turtle model at current depth', async () => (await turtleState()).loaded);
  await delay(100);
  const after = await turtleState();
  if (after.model.opacity < 0.7 || Math.abs(after.model.x - 1.2) > 0.3 || after.targetDisabled) {
    throw new Error(`The late turtle model appeared in the wrong place or opacity: ${JSON.stringify(after)}`);
  }
  await screenshot('turtle-cold-loaded.png');
  await evaluate('window.scrollTo(0, document.documentElement.scrollHeight)');
  await until('turtle hidden at 80m', async () => {
    const item = (await turtleState()).model;
    return item.opacity < 0.05;
  });
  await evaluate('window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.33)');
  await until('turtle visible after reverse scroll', async () => {
    const item = (await turtleState()).model;
    return item.opacity > 0.8;
  });
  const returned = await turtleState();
  await screenshot('turtle-cold-returned.png');

  interceptMode = 'fail';
  await call('Page.navigate', { url: origin + '?test=turtle-failure' });
  await scrollToTurtle();
  const failed = await turtleState();
  if (failed.loaded || failed.targetDisabled || failed.fallbackColor === 'rgba(0, 0, 0, 0)') {
    throw new Error(`The failed-model fallback is not usable: ${JSON.stringify(failed)}`);
  }
  await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: failed.center.x, y: failed.center.y });
  await call('Input.dispatchMouseEvent', { type: 'mousePressed', x: failed.center.x, y: failed.center.y, button: 'left', clickCount: 1 });
  await call('Input.dispatchMouseEvent', { type: 'mouseReleased', x: failed.center.x, y: failed.center.y, button: 'left', clickCount: 1 });
  await until('fallback encyclopedia', async () => (await evaluate('window.IntoTheAbyss.inspect().observingCreature')) === 'turtle');
  await delay(550);
  await screenshot('turtle-failed-model-observation.png');
  console.log(JSON.stringify({ before, after, returned, failed, failedFallbackOpensEncyclopedia: true }, null, 2));
} finally {
  socket?.close();
  chrome.kill();
}
