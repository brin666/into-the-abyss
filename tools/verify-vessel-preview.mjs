import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import net from 'node:net';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const version = process.env.ABYSS_VESSEL_VERSION || 'v10';
const origin = process.env.ABYSS_REVIEW_ORIGIN || 'http://127.0.0.1:4173';
const route = `${origin}/lux3d-delivery/into-the-abyss-vessel-20261003/assembly/candidate-review.html?asset=boat-fisherman-cast-${version}.glb`;
const outputDir = new URL('../build/vessel-review/', import.meta.url);
await mkdir(outputDir, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), `abyss-vessel-${version}-`));
const port = await new Promise((resolve, reject) => {
  const server = net.createServer();
  server.once('error', reject);
  server.listen(0, '127.0.0.1', () => {
    const address = server.address();
    server.close(() => resolve(address.port));
  });
});
const chrome = spawn(chromePath, [
  '--headless=new', '--enable-unsafe-swiftshader',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--window-size=1280,850', route,
], { stdio: 'ignore', windowsHide: true });
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

try {
  let target;
  for (let attempt = 0; attempt < 100; attempt += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      target = pages.find((page) => page.type === 'page' && page.url.includes('candidate-review.html'));
      if (target) break;
    } catch {}
    await delay(120);
  }
  if (!target) throw new Error('Candidate review tab was not created');

  const socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let nextId = 0;
  const pending = new Map();
  const consoleErrors = [];
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      const { resolve, reject } = pending.get(message.id);
      pending.delete(message.id);
      if (message.error) reject(new Error(message.error.message));
      else resolve(message.result);
    }
    if (message.method === 'Runtime.exceptionThrown') consoleErrors.push(message.params.exceptionDetails.text);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const result = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
    return result.result.value;
  };
  await call('Page.enable');
  await call('Runtime.enable');
  let ready;
  for (let attempt = 0; attempt < 120; attempt += 1) {
    ready = await evaluate('window.__candidateReview?.getState?.()');
    if (ready?.loaded) break;
    await delay(250);
  }
  if (!ready?.loaded) throw new Error('Vessel GLB did not load');
  if (!ready.clipNames?.includes('Fisherman_Cast')) throw new Error('Fisherman_Cast animation is missing');

  for (let step = 0; step < 4; step += 1) {
    await call('Input.dispatchMouseEvent', { type: 'mouseWheel', x: 630, y: 360, deltaX: 0, deltaY: -240 });
  }
  await delay(350);

  for (const [label, time] of [['rest', 0], ['backswing', 1.1], ['release-start', 1.35], ['release-peak', 1.48], ['forward', 1.65], ['release', 2.1]]) {
    await evaluate(`window.__candidateReview.setTime(${time})`);
    await delay(300);
    const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(new URL(`${version}-${label}.png`, outputDir), Buffer.from(screenshot.data, 'base64'));
  }
  await evaluate('window.__candidateReview.setTime(1.1)');
  if (!await evaluate('window.__candidateReview.focusGrip()')) throw new Error('Rigged right hand is missing.');
  await delay(350);
  const gripScreenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(new URL(`${version}-grip.png`, outputDir), Buffer.from(gripScreenshot.data, 'base64'));
  console.log(JSON.stringify({ modelLoaded: ready.loaded, clips: ready.clipNames, meshCount: ready.meshCount, errors: consoleErrors }, null, 2));
  socket.close();
} finally {
  chrome.kill();
}
