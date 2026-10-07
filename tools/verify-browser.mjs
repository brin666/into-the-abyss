import { spawn } from 'node:child_process';
import { mkdtemp, mkdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const chromePath = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const port = 9223;
const targetUrl = process.env.ABYSS_VERIFY_URL || 'http://127.0.0.1:4173/';
const profile = await mkdtemp(join(tmpdir(), 'into-abyss-chrome-'));
const outputDir = new URL('../build/browser/', import.meta.url);
await mkdir(outputDir, { recursive: true });

const chrome = spawn(chromePath, [
  '--headless=new',
  '--enable-unsafe-swiftshader',
  '--hide-scrollbars',
  `--remote-debugging-port=${port}`,
  `--user-data-dir=${profile}`,
  '--window-size=1280,800',
  targetUrl,
], { stdio: 'ignore' });

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let target;
for (let attempt = 0; attempt < 50; attempt += 1) {
  try {
    const pages = await fetch(`http://127.0.0.1:${port}/json/list`).then((response) => response.json());
    target = pages.find((page) => page.type === 'page' && page.url.startsWith(targetUrl));
    if (target) break;
  } catch {}
  await delay(120);
}

if (!target) {
  chrome.kill();
  throw new Error('Chrome DevTools target was not created.');
}

const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener('open', resolve, { once: true });
  socket.addEventListener('error', reject, { once: true });
});

let callId = 0;
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
  if (message.method === 'Runtime.exceptionThrown') {
    consoleErrors.push(message.params.exceptionDetails.text);
  }
  if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') {
    consoleErrors.push(message.params.args.map((arg) => arg.value || arg.description).join(' '));
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

await call('Page.enable');
await call('Runtime.enable');
await delay(250);

let surfaceState;
for (let attempt = 0; attempt < 300; attempt += 1) {
  surfaceState = await evaluate('window.IntoTheAbyss?.inspect?.()');
  if (surfaceState?.mode === 'surface-ready' && surfaceState.vessel.loaded) break;
  await delay(100);
}

if (surfaceState?.mode !== 'surface-ready' || !surfaceState.vessel.loaded || surfaceState.vessel.clipDuration !== 3) {
  const modelRequests = await evaluate(`performance.getEntriesByType('resource').filter((entry) => entry.name.includes('/models/')).map((entry) => ({name: entry.name, duration: entry.duration, transferSize: entry.transferSize, decodedBodySize: entry.decodedBodySize}))`);
  throw new Error(`The surface did not become ready with the rebuilt boat/fisherman: ${JSON.stringify({ state: surfaceState, modelRequests, consoleErrors })}`);
}
if (surfaceState.castComplete || surfaceState.castProgress > 0) {
  throw new Error(`The fisherman cast before the user clicked: ${JSON.stringify(surfaceState)}`);
}

const waitingScreenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await writeFile(new URL('surface-waiting-for-cast.png', outputDir), Buffer.from(waitingScreenshot.data, 'base64'));

const canvasBounds = await evaluate(`(() => {
  const rect = document.querySelector('#scene-canvas').getBoundingClientRect();
  return { left: rect.left, top: rect.top, width: rect.width, height: rect.height };
})()`);
let fishermanPoint = null;
const centerX = canvasBounds.left + canvasBounds.width * 0.5;
const centerY = canvasBounds.top + canvasBounds.height * 0.5;
for (let radius = 0; radius <= 32 && !fishermanPoint; radius += 4) {
  const offsets = radius === 0 ? [[0, 0]] : [
    [-radius, -radius], [0, -radius], [radius, -radius],
    [-radius, 0], [radius, 0],
    [-radius, radius], [0, radius], [radius, radius],
  ];
  for (const [dx, dy] of offsets) {
    const x = Math.round(centerX + dx);
    const y = Math.round(centerY + dy);
    await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y });
    if (await evaluate("document.querySelector('#scene-canvas').style.cursor") === 'pointer') {
      fishermanPoint = { x, y };
      break;
    }
  }
}
if (!fishermanPoint) {
  throw new Error(`Could not find the clickable fisherman near the scene center: ${JSON.stringify({ canvasBounds, surfaceState })}`);
}
await call('Input.dispatchMouseEvent', {
  type: 'mousePressed', x: fishermanPoint.x, y: fishermanPoint.y, button: 'left', clickCount: 1,
});
await call('Input.dispatchMouseEvent', {
  type: 'mouseReleased', x: fishermanPoint.x, y: fishermanPoint.y, button: 'left', clickCount: 1,
});

let sawCasting = false;
let castState;
for (let attempt = 0; attempt < 300; attempt += 1) {
  castState = await evaluate('window.IntoTheAbyss?.inspect?.()');
  if (castState?.mode === 'casting' && !sawCasting) {
    const castingScreenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
    await writeFile(new URL('fisherman-casting.png', outputDir), Buffer.from(castingScreenshot.data, 'base64'));
    sawCasting = true;
  }
  if (castState?.castComplete) break;
  await delay(100);
}
if (!sawCasting || !castState?.castComplete) {
  throw new Error(`Clicking the fisherman did not complete the cast: ${JSON.stringify({ fishermanPoint, castState })}`);
}
if (castState.vessel.lineStartErrorM === null || castState.vessel.lineStartErrorM > 0.02) {
  throw new Error(`The fishing line no longer follows the animated rod tip: ${JSON.stringify(castState.vessel)}`);
}

const loadedState = await evaluate(`({
  bodyClasses: document.body.className,
  inspect: window.IntoTheAbyss?.inspect?.(),
  creatureCanvas: [document.querySelector('#creature-canvas')?.width, document.querySelector('#creature-canvas')?.height]
})`);
const surfaceScreenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await writeFile(new URL('surface-fisherman.png', outputDir), Buffer.from(surfaceScreenshot.data, 'base64'));

const viewport = await evaluate('({ width: innerWidth, height: innerHeight })');
await call('Input.dispatchMouseEvent', {
  type: 'mouseWheel',
  x: Math.round(viewport.width / 2),
  y: Math.round(viewport.height / 2),
  deltaX: 0,
  deltaY: -160,
});
await delay(800);
const upwardZoomState = await evaluate('window.IntoTheAbyss.inspect()');
if (upwardZoomState.zoom <= 1.01 || upwardZoomState.zoom >= 1.49 || upwardZoomState.descentProgress > 0.003) {
  throw new Error(`Scrolling upward did not zoom out while staying at the surface: ${JSON.stringify(upwardZoomState)}`);
}

await evaluate('window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.20)');
await delay(800);
if (Math.abs((await evaluate('window.IntoTheAbyss.inspect().zoom')) - 1) > 0.02) {
  throw new Error('Returning to the starting scroll position did not restore the surface zoom.');
}

await call('Input.dispatchMouseEvent', {
  type: 'mouseWheel',
  x: Math.round(viewport.width / 2),
  y: Math.round(viewport.height / 2),
  deltaX: 0,
  deltaY: 160,
});
await delay(800);
const firstScrollState = await evaluate('window.IntoTheAbyss.inspect()');
if (firstScrollState.descentProgress <= 0.003 || Math.abs(firstScrollState.zoom - 1) > 0.02) {
  throw new Error(`A normal downward scroll did not start descent cleanly: ${JSON.stringify(firstScrollState)}`);
}

await evaluate('window.scrollTo(0, document.documentElement.scrollHeight)');
await delay(900);
const desktopDescentCoverage = await evaluate(`(() => {
  const rect = document.querySelector('.flat-dive__water').getBoundingClientRect();
  return { top: rect.top, bottom: rect.bottom, viewportHeight: innerHeight, progress: window.IntoTheAbyss.inspect().descentProgress };
})()`);
if (desktopDescentCoverage.top > 0.5 || desktopDescentCoverage.bottom < desktopDescentCoverage.viewportHeight - 0.5) {
  throw new Error(`The translated water background leaves a desktop viewport gap: ${JSON.stringify(desktopDescentCoverage)}`);
}
const desktopDescentScreenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await writeFile(new URL('descent-water-coverage-desktop.png', outputDir), Buffer.from(desktopDescentScreenshot.data, 'base64'));
await evaluate('window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.20)');
await delay(1300);
await call('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await evaluate('window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.20)');
await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
await call('Input.dispatchTouchEvent', {
  type: 'touchStart',
  touchPoints: [{ id: 1, x: 195, y: 730, radiusX: 4, radiusY: 4, force: 1 }],
});
await call('Input.dispatchTouchEvent', {
  type: 'touchMove',
  touchPoints: [{ id: 1, x: 195, y: 565, radiusX: 4, radiusY: 4, force: 1 }],
});
await call('Input.dispatchTouchEvent', {
  type: 'touchMove',
  touchPoints: [{ id: 1, x: 195, y: 385, radiusX: 4, radiusY: 4, force: 1 }],
});
await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await delay(1000);
const mobileScrollState = await evaluate('window.IntoTheAbyss.inspect()');
if (mobileScrollState.descentProgress <= 0.003) {
  throw new Error(`A mobile swipe after the cast did not start descent: ${JSON.stringify(mobileScrollState)}`);
}
await evaluate('window.scrollTo(0, document.documentElement.scrollHeight)');
await delay(900);
const descentCoverage = await evaluate(`(() => {
  const rect = document.querySelector('.flat-dive__water').getBoundingClientRect();
  const caption = document.querySelector('.flat-dive__caption').getBoundingClientRect();
  const meter = document.querySelector('.scroll-meter').getBoundingClientRect();
  return {
    top: rect.top,
    bottom: rect.bottom,
    viewportHeight: innerHeight,
    progress: window.IntoTheAbyss.inspect().descentProgress,
    caption: { top: caption.top, bottom: caption.bottom, left: caption.left, right: caption.right },
    meter: { top: meter.top, bottom: meter.bottom, left: meter.left, right: meter.right },
    captionOverlapsMeter: caption.left < meter.right && caption.right > meter.left && caption.top < meter.bottom && caption.bottom > meter.top,
  };
})()`);
if (descentCoverage.top > 0.5 || descentCoverage.bottom < descentCoverage.viewportHeight - 0.5) {
  throw new Error(`The translated water background no longer covers the viewport: ${JSON.stringify(descentCoverage)}`);
}
if (descentCoverage.captionOverlapsMeter) {
  throw new Error(`The descent caption overlaps the scroll meter: ${JSON.stringify(descentCoverage)}`);
}
const descentCoverageScreenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await writeFile(new URL('descent-water-coverage.png', outputDir), Buffer.from(descentCoverageScreenshot.data, 'base64'));
await evaluate('window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.20)');
await delay(1300);
await call('Emulation.setTouchEmulationEnabled', { enabled: false });
await call('Emulation.clearDeviceMetricsOverride');

await evaluate('window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.33)');
await delay(2200);
const turtleHitTest = await evaluate(`(() => {
  const target = document.querySelector('[data-creature="turtle"]');
  const rect = target.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const hit = document.elementFromPoint(x, y);
  return {
    x, y,
    width: rect.width,
    height: rect.height,
    disabled: target.disabled,
    hitTag: hit?.tagName ?? null,
    hitCreature: hit?.closest?.('[data-creature]')?.dataset.creature ?? null,
  };
})()`);
if (turtleHitTest.disabled || turtleHitTest.hitCreature !== 'turtle') {
  throw new Error(`The visible turtle is not receiving pointer hits: ${JSON.stringify(turtleHitTest)}`);
}
await call('Input.dispatchMouseEvent', { type: 'mouseMoved', x: turtleHitTest.x, y: turtleHitTest.y });
await call('Input.dispatchMouseEvent', {
  type: 'mousePressed', x: turtleHitTest.x, y: turtleHitTest.y, button: 'left', clickCount: 1,
});
await call('Input.dispatchMouseEvent', {
  type: 'mouseReleased', x: turtleHitTest.x, y: turtleHitTest.y, button: 'left', clickCount: 1,
});
await delay(1200);

const observationState = await evaluate(`({
  bodyClasses: document.body.className,
  inspect: window.IntoTheAbyss?.inspect?.(),
  noteVisible: document.querySelector('#creature-info')?.classList.contains('is-visible'),
  turtleFallbackHidden: getComputedStyle(document.querySelector('[data-creature="turtle"]')).backgroundColor
})`);
if (!observationState.noteVisible || observationState.inspect.observingCreature !== 'turtle') {
  throw new Error(`A real mouse click on the turtle did not open its encyclopedia: ${JSON.stringify({ turtleHitTest, observationState })}`);
}
const screenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await writeFile(new URL('turtle-observation.png', outputDir), Buffer.from(screenshot.data, 'base64'));
await call('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await delay(600);
await evaluate('document.querySelector("#creature-info-close")?.click()');
await evaluate('window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.33)');
await delay(1600);
const mobileTurtleHitTest = await evaluate(`(() => {
  const target = document.querySelector('[data-creature="turtle"]');
  const rect = target.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  const hit = document.elementFromPoint(x, y);
  return {
    x, y,
    width: rect.width,
    height: rect.height,
    disabled: target.disabled,
    hitCreature: hit?.closest?.('[data-creature]')?.dataset.creature ?? null,
  };
})()`);
if (mobileTurtleHitTest.disabled || mobileTurtleHitTest.hitCreature !== 'turtle') {
  throw new Error(`The mobile turtle is not receiving touch hits: ${JSON.stringify(mobileTurtleHitTest)}`);
}
await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
await call('Input.dispatchTouchEvent', {
  type: 'touchStart',
  touchPoints: [{ id: 1, x: mobileTurtleHitTest.x, y: mobileTurtleHitTest.y, radiusX: 4, radiusY: 4, force: 1 }],
});
await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await delay(900);
const mobileObservationState = await evaluate(`({
  inspect: window.IntoTheAbyss.inspect(),
  noteVisible: document.querySelector('#creature-info')?.classList.contains('is-visible'),
})`);
if (!mobileObservationState.noteVisible || mobileObservationState.inspect.observingCreature !== 'turtle') {
  throw new Error(`A real touch on the turtle did not open its encyclopedia: ${JSON.stringify({ mobileTurtleHitTest, mobileObservationState })}`);
}
const mobileScreenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await writeFile(new URL('turtle-observation-mobile.png', outputDir), Buffer.from(mobileScreenshot.data, 'base64'));
await call('Emulation.setTouchEmulationEnabled', { enabled: false });

await call('Emulation.clearDeviceMetricsOverride');
await delay(350);
await evaluate('document.querySelector("#creature-info-close")?.click()');
await evaluate('window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.26)');
await delay(1200);
await evaluate(`document.querySelector('[data-creature="baitfish"]')?.click()`);
await delay(750);
const fishScreenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await writeFile(new URL('baitfish-observation.png', outputDir), Buffer.from(fishScreenshot.data, 'base64'));

await evaluate('document.querySelector("#creature-info-close")?.click()');
await evaluate('window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.49)');
await delay(1200);
await evaluate(`document.querySelector('[data-creature="jelly"]')?.click()`);
await delay(750);
const jellyScreenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await writeFile(new URL('jelly-observation.png', outputDir), Buffer.from(jellyScreenshot.data, 'base64'));
await evaluate('document.querySelector("#creature-info-close")?.click()');
for (const [id, scrollPosition] of [['sunfish', 0.72], ['shark', 0.88]]) {
  await evaluate(`window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * ${scrollPosition})`);
  await delay(1250);
  const encounter = await evaluate(`({ depth: window.IntoTheAbyss.inspect().depthMeters, disabled: document.querySelector('[data-creature="${id}"]').disabled })`);
  if (encounter.disabled) throw new Error(`${id} is not interactive at its 40–80m encounter: ${JSON.stringify(encounter)}`);
  await evaluate(`document.querySelector('[data-creature="${id}"]')?.click()`);
  await delay(700);
  const observation = await evaluate('window.IntoTheAbyss.inspect().observingCreature');
  if (observation !== id) throw new Error(`${id} encyclopedia did not open: ${observation}`);
  const capture = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
  await writeFile(new URL(`${id}-observation.png`, outputDir), Buffer.from(capture.data, 'base64'));
  await evaluate('document.querySelector("#creature-info-close")?.click()');
}
await call('Emulation.setDeviceMetricsOverride', {
  width: 390,
  height: 844,
  deviceScaleFactor: 1,
  mobile: true,
});
await evaluate('window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.72)');
await delay(1000);
const mobileSunfishHit = await evaluate(`(() => {
  const target = document.querySelector('[data-creature="sunfish"]');
  const rect = target.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  return { x, y, disabled: target.disabled, hit: document.elementFromPoint(x, y)?.closest?.('[data-creature]')?.dataset.creature };
})()`);
if (mobileSunfishHit.disabled || mobileSunfishHit.hit !== 'sunfish') {
  throw new Error(`The new 40–80m sunfish is not touchable on mobile: ${JSON.stringify(mobileSunfishHit)}`);
}
await call('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 2, x: mobileSunfishHit.x, y: mobileSunfishHit.y, radiusX: 4, radiusY: 4, force: 1 }] });
await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await delay(850);
if (await evaluate('window.IntoTheAbyss.inspect().observingCreature') !== 'sunfish') {
  throw new Error('Mobile sunfish touch did not open its encyclopedia.');
}
const mobileSunfishScreenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await writeFile(new URL('sunfish-observation-mobile.png', outputDir), Buffer.from(mobileSunfishScreenshot.data, 'base64'));
await evaluate('document.querySelector("#creature-info-close")?.click()');
await evaluate('window.scrollTo(0, (document.documentElement.scrollHeight - innerHeight) * 0.88)');
await delay(1100);
const mobileSharkHit = await evaluate(`(() => {
  const target = document.querySelector('[data-creature="shark"]');
  const rect = target.getBoundingClientRect();
  const x = rect.left + rect.width / 2;
  const y = rect.top + rect.height / 2;
  return { x, y, disabled: target.disabled, hit: document.elementFromPoint(x, y)?.closest?.('[data-creature]')?.dataset.creature };
})()`);
if (mobileSharkHit.disabled || mobileSharkHit.hit !== 'shark') {
  throw new Error(`The 40–80m shark is not touchable on mobile: ${JSON.stringify(mobileSharkHit)}`);
}
await call('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ id: 3, x: mobileSharkHit.x, y: mobileSharkHit.y, radiusX: 4, radiusY: 4, force: 1 }] });
await call('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
await delay(850);
if (await evaluate('window.IntoTheAbyss.inspect().observingCreature') !== 'shark') {
  throw new Error('Mobile shark touch did not open its encyclopedia.');
}
const mobileSharkModel = await evaluate('window.IntoTheAbyss.inspect().creatureModels.find((item) => item.id === "shark")');
if (!mobileSharkModel?.loaded || Math.abs(mobileSharkModel.x) > 0.35) {
  throw new Error(`Mobile shark drifted away from the observation focus: ${JSON.stringify(mobileSharkModel)}`);
}
const mobileSharkScreenshot = await call('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false });
await writeFile(new URL('shark-observation-mobile.png', outputDir), Buffer.from(mobileSharkScreenshot.data, 'base64'));
await evaluate('document.querySelector("#creature-info-close")?.click()');
await call('Emulation.setTouchEmulationEnabled', { enabled: false });
await call('Emulation.clearDeviceMetricsOverride');
const finalState = await evaluate('window.IntoTheAbyss.inspect()');
if (finalState.depthMeters < 40 || finalState.depthMeters > 80) throw new Error(`The extended depth timeline is wrong: ${finalState.depthMeters}`);

console.log(JSON.stringify({ surfaceState, fishermanPoint, castState, loadedState, upwardZoomState, firstScrollState, desktopDescentCoverage, mobileScrollState, descentCoverage, turtleHitTest, observationState, mobileTurtleHitTest, mobileObservationState, finalState, consoleErrors }, null, 2));
socket.close();
chrome.kill();
