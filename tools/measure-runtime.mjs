// Frame-pacing smoke measurement in desktop Chrome and a mobile-sized viewport.
// Mobile emulation is not a real-phone FPS claim; use it to compare revisions.
import { spawn } from 'node:child_process';
import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const url = process.env.ABYSS_VERIFY_URL || 'http://127.0.0.1:4173/';
const port = 9247;
const profile = await mkdtemp(join(tmpdir(), 'abyss-perf-'));
const chrome = spawn('C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe', [
  '--headless=new', '--enable-unsafe-swiftshader', '--disable-background-timer-throttling',
  `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`,
  '--window-size=1280,800', url,
], { stdio: 'ignore' });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let socket;
try {
  let target;
  for (let i = 0; i < 60; i += 1) {
    try {
      const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
      target = pages.find((page) => page.type === 'page' && page.url.startsWith(url));
      if (target) break;
    } catch {}
    await delay(100);
  }
  if (!target) throw new Error('No Chrome DevTools page target.');
  socket = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    socket.addEventListener('open', resolve, { once: true });
    socket.addEventListener('error', reject, { once: true });
  });
  let callId = 0;
  const pending = new Map();
  socket.addEventListener('message', (event) => {
    const message = JSON.parse(event.data);
    if (!pending.has(message.id)) return;
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    if (message.error) reject(new Error(message.error.message));
    else resolve(message.result);
  });
  const call = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++callId;
    pending.set(id, { resolve, reject });
    socket.send(JSON.stringify({ id, method, params }));
  });
  const evaluate = async (expression) => {
    const response = await call('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
    if (response.exceptionDetails) throw new Error(response.exceptionDetails.text);
    return response.result.value;
  };
  await call('Page.enable');
  await call('Runtime.enable');
  let state;
  for (let i = 0; i < 400; i += 1) {
    state = await evaluate('window.IntoTheAbyss?.inspect?.()');
    if (state?.castComplete && state.vessel.loaded) break;
    await delay(100);
  }
  if (!state?.castComplete) throw new Error('The automatic cast did not complete.');
  const measure = async (label, scrollFraction) => {
    await evaluate(`window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * ${scrollFraction})`);
    await delay(800);
    return await evaluate(`new Promise((resolve) => {
      const intervals = [];
      let last;
      const begin = performance.now();
      function tick(now) {
        if (last !== undefined) intervals.push(now - last);
        last = now;
        if (now - begin < 3500) requestAnimationFrame(tick);
        else {
          intervals.sort((a, b) => a - b);
          const p = (fraction) => intervals[Math.min(intervals.length - 1, Math.floor(intervals.length * fraction))];
          resolve({ label: ${JSON.stringify(label)}, depthMeters: window.IntoTheAbyss.inspect().depthMeters,
            frames: intervals.length, meanFps: Math.round(intervals.length * 1000 / (now - begin)),
            medianFrameMs: Number(p(0.5).toFixed(1)), p95FrameMs: Number(p(0.95).toFixed(1)),
            slowFramesOver33ms: intervals.filter((value) => value > 33.3).length });
        }
      }
      requestAnimationFrame(tick);
    })`);
  };
  const results = [await measure('desktop-surface', 0.2), await measure('desktop-60m', 0.79)];
  await call('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await delay(350);
  results.push(await measure('mobile-sized-60m', 0.79));
  const resources = await evaluate(`performance.getEntriesByType('resource')
    .filter((entry) => /\\.(glb|js|css)(\\?|$)/.test(entry.name))
    .map((entry) => ({name: entry.name.split('/').pop(), transferBytes: entry.transferSize,
      decodedBytes: entry.decodedBodySize, durationMs: Math.round(entry.duration)}))`);
  console.log(JSON.stringify({ url, renderer: 'headless Chrome / SwiftShader; not real-device FPS', results, resources }, null, 2));
} finally {
  socket?.close();
  chrome.kill();
}
