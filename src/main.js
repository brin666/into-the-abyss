import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { Sky } from 'three/addons/objects/Sky.js';
import { Water } from 'three/addons/objects/Water.js';
import './styles.css';

if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
window.scrollTo(0, 0);

const canvas = document.querySelector('#scene-canvas');
const creatureCanvas = document.querySelector('#creature-canvas');
const sceneFrame = document.querySelector('#scene-frame');
const loadingState = document.querySelector('#loading-state');
const fallbackState = document.querySelector('#fallback-state');
const depthValue = document.querySelector('#depth-value');
const zoneValue = document.querySelector('#zone-value');
const stateChip = document.querySelector('#state-chip');
const sceneHint = document.querySelector('#scene-hint');
const targetCard = document.querySelector('#target-card');
const meterFill = document.querySelector('#meter-fill');
const flatDive = document.querySelector('#flat-dive');
const creatureInfo = document.querySelector('#creature-info');
const creatureInfoScroll = document.querySelector('#creature-info-content');
const creatureInfoKicker = document.querySelector('#creature-info-kicker');
const creatureInfoIndex = document.querySelector('#creature-info-index');
const creatureInfoEnglish = document.querySelector('#creature-info-english');
const creatureInfoName = document.querySelector('#creature-info-name');
const creatureInfoLatin = document.querySelector('#creature-info-latin');
const creatureInfoDepth = document.querySelector('#creature-info-depth');
const creatureInfoSizeLabel = document.querySelector('#creature-info-size-label');
const creatureInfoSize = document.querySelector('#creature-info-size');
const creatureInfoCurrentDepth = document.querySelector('#creature-info-current-depth');
const creatureInfoHabitat = document.querySelector('#creature-info-habitat');
const creatureInfoFact = document.querySelector('#creature-info-fact');
const creatureInfoSource = document.querySelector('#creature-info-source');
const creatureInfoSourceNote = document.querySelector('#creature-info-source-note');
const creatureInfoCloseButtons = document.querySelectorAll('[data-close-observation]');

const SURFACE_SCROLL_BASELINE = 0.20;
const SURFACE_ZOOM_OUT_MAX = 1.5;
const OPENING_HOLD_DURATION = 0.9;
const CREATURE_BANDS = Object.freeze({
  baitfish: [0.035, 0.10],
  turtle: [0.10, 0.21],
  jelly: [0.30, 0.42],
  sunfish: [0.59, 0.73],
  shark: [0.78, 0.94],
});

function currentDepthMeters() {
  const progress = state.descentProgress;
  return Math.round(progress < 0.5 ? 2 + progress * 76 : 40 + (progress - 0.5) * 80);
}

const creatureCatalog = Object.freeze({
  baitfish: {
    index: '01 / 05',
    name: '沿岸饵鱼群',
    english: 'Coastal baitfish school',
    latin: 'Clupeidae · species not specified',
    commonWaterLayer: '近表层沿岸与外海（未定种）',
    sizeLabel: 'INDIVIDUAL LENGTH · 单体示意',
    size: '8–25 cm · illustrative',
    habitat: '这是未定种的群游鱼模型，栖息环境依物种而异；本场景以近表层水域呈现。',
    fact: '这一群是鲱科小型鱼类的泛化示意，并未指定到某个物种。近表层鱼群会紧密聚集、同步变向，像一个整体穿过光束。',
    source: 'NOAA Fisheries · Pacific Sardine ↗',
    sourceUrl: 'https://www.fisheries.noaa.gov/species/pacific-sardine',
    sourceNote: 'NOAA 太平洋沙丁鱼资料仅作为近表层鲱科鱼的相近生态参考；画面模型没有指定具体物种。',
  },
  turtle: {
    index: '02 / 05',
    name: '绿海龟',
    english: 'Green sea turtle',
    latin: 'Chelonia mydas',
    commonWaterLayer: '成体：浅海沿岸；幼体：远洋水域',
    sizeLabel: 'ADULT LENGTH · 成体体长',
    size: '0.9–1.2 m · adult',
    habitat: '成体主要以海草和藻类为食，在沿岸觅食地活动；幼体阶段会利用远洋漂浮生境。',
    fact: '绿海龟是体型最大的硬壳海龟。成体主要吃海草和藻类，并需要定期上浮呼吸；前肢像翅膀一样推动身体滑行。',
    source: 'NOAA Fisheries · Green Turtle ↗',
    sourceUrl: 'https://www.fisheries.noaa.gov/species/green-turtle',
    sourceNote: '绿海龟的栖息区会随生活阶段变化；这里展示的是常见生境类型，不是固定深度边界。',
  },
  jelly: {
    index: '03 / 05',
    name: '月亮水母',
    english: 'Moon jelly',
    latin: 'Aurelia spp. · species varies',
    commonWaterLayer: '开放水域 · 具体水层因种类而异',
    sizeLabel: 'BELL DIAMETER · 伞径',
    size: 'varies · some reach 60 cm',
    habitat: '月亮水母是浮游性的刺胞动物，伞体收缩推动它缓慢穿过水体；分布会受种类和洋流影响。',
    fact: '透明伞体让月亮水母呈现柔和的蓝色轮廓。伞缘的短触手帮助收集浮游动物；不同 Aurelia 种类的体型并不相同。',
    source: 'Monterey Bay Aquarium · Moon Jelly ↗',
    sourceUrl: 'https://www.montereybayaquarium.org/animals-the-ocean/animals-a-to-z/moon-jelly',
    sourceNote: '资料页描述的是 Aurelia labiata；画面为 Aurelia 属泛化示意，伞径与水层会随具体种类变化。',
  },
  sunfish: {
    index: '04 / 05',
    name: '翻车鱼',
    english: 'Ocean sunfish',
    latin: 'Mola mola',
    commonWaterLayer: '外海透光层 · 可下潜至更深水域',
    sizeLabel: 'ADULT LENGTH · 成体体长',
    size: 'up to about 3 m',
    habitat: '生活在外海水域，会在不同深度之间移动。画面中的 40–80 米只是这次下潜遇见它的叙事位置。',
    fact: '高耸的背鳍和臀鳍同步摆动，推动近似圆盘的身体前进；它的尾部并不像大多数鱼那样明显。',
    source: 'NOAA AFSC · Ocean Sunfish ↗',
    sourceUrl: 'https://apps-afsc.fisheries.noaa.gov/ichthyo/LHDataLH.php?GSID=Mola%21mola',
    sourceNote: 'NOAA 记录其为外海表层带物种；本场景不把 40–80 米写成固定栖息边界。模型为原创简化示意。',
  },
  shark: {
    index: '05 / 05',
    name: '大青鲨',
    english: 'Blue shark',
    latin: 'Prionace glauca',
    commonWaterLayer: '外海表层至数百米深',
    sizeLabel: 'BODY LENGTH · 体长',
    size: 'up to about 3.8 m',
    habitat: '大青鲨是外海游泳者，可以在不同深度活动；这里只给它一段远处经过的观察镜头。',
    fact: '修长的身体与长胸鳍使它的轮廓很容易辨认。它从鱼钩后方掠过，不会冲向镜头。',
    source: 'NOAA Fisheries · Blue Shark ↗',
    sourceUrl: 'https://www.fisheries.noaa.gov/new-england-mid-atlantic/atlantic-highly-migratory-species/shark-identification-cooperative-shark',
    sourceNote: 'NOAA 记录的大青鲨活动水层覆盖海面至约 600 米；40–80 米是合理的场景截面，不是专属深度。模型为原创简化示意。',
  },
});

const clock = new THREE.Clock();
const scratchA = new THREE.Vector3();
const scratchB = new THREE.Vector3();
const fisherPointerNdc = new THREE.Vector2();
const fisherRaycaster = new THREE.Raycaster();
const creatureHitBounds = new THREE.Box3();
const creatureHitCorners = Array.from({ length: 8 }, () => new THREE.Vector3());
const creatureHitCorner = new THREE.Vector3();
const creatureHitTargets = new Map();
flatDive?.querySelectorAll('[data-creature]').forEach((target) => {
  const targets = creatureHitTargets.get(target.dataset.creature) ?? [];
  targets.push(target);
  creatureHitTargets.set(target.dataset.creature, targets);
});

const state = {
  scrollTarget: 0,
  scroll: 0,
  mode: 'opening',
  orbitYaw: 0,
  orbitPitch: 0,
  zoom: 1,
  zoomTarget: 1,
  isDragging: false,
  pointerId: null,
  pointerDownX: 0,
  pointerDownY: 0,
  pointerMoved: false,
  openingStartedAt: 0,
  observationTrigger: null,
  lastPointerX: 0,
  lastPointerY: 0,
  entryStartedAt: 0,
  entryProgress: 0,
  entryStartApproach: 0,
  castStartedAt: 0,
  castProgress: 0,
  castComplete: false,
  castAnchorScroll: 0,
  descentProgress: 0,
  observingCreature: null,
};

let renderer;
let scene;
let camera;
let creatureRenderer;
let creatureScene;
let creatureCamera;
let ocean;
let sky;
let boat;
let fisherman;
let fisherClickTarget;
let rodRig;
let rodTip;
let vesselModel;
let pendingVessel;
let vesselMixer;
let vesselClip;
let hookGroup;
let fishingLine;
let hoverHalo;
let wakeRing;
let wakeRingInner;
let wakeFoamLeft;
let wakeFoamRight;
let wakeBubbles = [];
let elapsed = 0;
let surfaceRenderCount = 0;
let creatureRenderCount = 0;
let vesselLoadSettled = false;
let creatureLoadStarted = false;
const creatureModels = new Map();
const gltfLoader = new GLTFLoader();
const modelUrl = (path) => `${import.meta.env.BASE_URL}${path.replace(/^\//, '')}`;

const creatureModelConfig = Object.freeze({
  baitfish: { path: '/models/lux3d-20261002/baitfish_optimized.glb', x: 0.28, y: 0.31, scale: 0.72 },
  turtle: { path: '/models/lux3d-20261002/green_sea_turtle_optimized.glb', x: 0.63, y: 0.48, scale: 0.92 },
  jelly: { path: '/models/lux3d-20261002/moon_jellyfish_optimized.glb', x: 0.35, mobileX: 0.5, y: 0.74, scale: 2.0 },
  sunfish: { path: '/models/surface-40-80/ocean-sunfish-v4.glb', x: 0.66, mobileX: 0.56, y: 0.45, scale: 0.50 },
  shark: { path: '/models/surface-40-80/blue-shark-v2.glb', x: 0.35, mobileX: 0.48, y: 0.63, scale: 0.42 },
});

const baitfishSchoolFormation = Object.freeze([
  { x: -0.52, y: 0.10, z: 0.13, yaw: -0.08, phase: 0.2, scale: 0.96 },
  { x: -0.35, y: -0.09, z: -0.08, yaw: 0.04, phase: 1.1, scale: 0.90 },
  { x: -0.17, y: 0.16, z: 0.02, yaw: -0.02, phase: 2.0, scale: 1.04 },
  { x: 0.00, y: -0.04, z: -0.14, yaw: 0.08, phase: 2.8, scale: 0.92 },
  { x: 0.17, y: 0.14, z: 0.10, yaw: -0.05, phase: 3.7, scale: 1.00 },
  { x: 0.35, y: -0.12, z: -0.02, yaw: 0.02, phase: 4.6, scale: 0.90 },
  { x: 0.52, y: 0.04, z: -0.12, yaw: -0.07, phase: 5.4, scale: 0.98 },
]);

const moonJellyFormation = Object.freeze([
  { x: -0.32, y: -0.09, z: -0.08, phase: 0.1, scale: 0.86 },
  { x: 0.02, y: 0.12, z: 0.04, phase: 1.7, scale: 1.05 },
  { x: 0.32, y: -0.03, z: -0.02, phase: 3.1, scale: 0.92 },
]);

// Camera route: a 100m high diagonal establishing shot easing into a 35m,
// low 20-degree observation angle over the boat.
const cameraStart = new THREE.Vector3(50, 70.7, 50);
const cameraMid = new THREE.Vector3(36, 28, 36);
const cameraEnd = new THREE.Vector3(23.3, 12.9, 23.3);
const cameraPath = new THREE.CatmullRomCurve3([cameraStart, cameraMid, cameraEnd]);
const cameraPathPoint = new THREE.Vector3();
const cameraBasePosition = new THREE.Vector3();
const cameraBaseTarget = new THREE.Vector3();
const cameraOffset = new THREE.Vector3();
const cameraOrbitPosition = new THREE.Vector3();
const descentCameraEnd = new THREE.Vector3(1.0, -3.8, 5.8);
const targetStart = new THREE.Vector3(0, 0.75, 0);
const targetEnd = new THREE.Vector3(-0.05, 0.98, 0);
const hookLandingLocal = new THREE.Vector3(0.92, -0.18, -1.05);
const vesselHookLandingLocal = new THREE.Vector3(-0.72, -0.18, 3.1);
const castCameraPosition = new THREE.Vector3();
const castCameraTarget = new THREE.Vector3();
const wakeBubbleWorld = new THREE.Vector3();
const sunDirection = new THREE.Vector3(-0.24, 0.74, -0.63).normalize();

function clamp(value, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function smoothstep(value) {
  const t = clamp(value);
  return t * t * (3 - 2 * t);
}

function easeOutCubic(value) {
  const t = clamp(value);
  return 1 - ((1 - t) ** 3);
}

function setText(element, value) {
  if (element) element.textContent = value;
}

function createMaterial(color, roughness = 0.62, metalness = 0.02) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness,
    metalness,
  });
}

function createLimb(start, end, radius, material) {
  const direction = new THREE.Vector3().subVectors(end, start);
  const length = direction.length();
  const limb = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.08, length, 8), material);
  limb.position.copy(start).add(end).multiplyScalar(0.5);
  limb.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  limb.castShadow = true;
  limb.receiveShadow = true;
  return limb;
}

function setupRenderer() {
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch (error) {
    fallbackState.hidden = false;
    loadingState.classList.add('is-hidden');
    console.warn('WebGL unavailable', error);
    return false;
  }

  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  return true;
}

function setupCreatureRenderer() {
  if (!creatureCanvas) return false;

  try {
    creatureRenderer = new THREE.WebGLRenderer({
      canvas: creatureCanvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
    });
  } catch (error) {
    console.warn('Creature WebGL layer unavailable; keeping CSS fallbacks.', error);
    return false;
  }

  creatureRenderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.45));
  creatureRenderer.setClearColor(0x000000, 0);
  creatureRenderer.outputColorSpace = THREE.SRGBColorSpace;
  creatureRenderer.toneMapping = THREE.ACESFilmicToneMapping;
  creatureRenderer.toneMappingExposure = 1.28;

  creatureScene = new THREE.Scene();
  creatureCamera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
  creatureCamera.position.set(0, 0, 8);
  creatureCamera.lookAt(0, 0, 0);

  creatureScene.add(new THREE.HemisphereLight('#b9f5f1', '#03223c', 2.25));
  const key = new THREE.DirectionalLight('#d7fff1', 3.2);
  key.position.set(-4, 6, 7);
  creatureScene.add(key);
  const rim = new THREE.DirectionalLight('#3aa9d1', 2.1);
  rim.position.set(5, -2, 4);
  creatureScene.add(rim);
  return true;
}

function prepareFadingMaterials(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    object.frustumCulled = false;
    object.material = Array.isArray(object.material)
      ? object.material.map((material) => material.clone())
      : object.material.clone();
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      material.userData.baseOpacity = material.opacity;
      material.userData.baseTransparent = material.transparent;
      material.userData.baseDepthWrite = material.depthWrite;
    });
  });
}

function setModelOpacity(root, opacity) {
  root.visible = opacity > 0.002;
  root.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      const baseOpacity = material.userData.baseOpacity ?? 1;
      const nextTransparent = Boolean(material.userData.baseTransparent) || opacity < 0.995;
      const transparencyChanged = material.transparent !== nextTransparent;
      material.opacity = baseOpacity * opacity;
      material.transparent = nextTransparent;
      material.depthWrite = Boolean(material.userData.baseDepthWrite) && opacity > 0.96;
      if (transparencyChanged) material.needsUpdate = true;
    });
  });
}

function createBaitfishSchool(source) {
  const school = new THREE.Group();
  school.name = 'lux3d-baitfish-school';
  school.userData.swimmers = [];

  // Reuse one static Lux3D mesh; the runtime adds school spacing and subtle swimming drift.
  baitfishSchoolFormation.forEach((slot, index) => {
    const fish = source.clone(true);
    fish.name = `Lux3D_Baitfish_${String(index + 1).padStart(2, '0')}`;
    fish.position.set(slot.x, slot.y, slot.z);
    fish.rotation.y = slot.yaw;
    fish.scale.setScalar(slot.scale);
    fish.userData.schoolMotion = { ...slot };
    school.userData.swimmers.push(fish);
    school.add(fish);
  });

  return school;
}

function createMoonJellyCluster(source) {
  const cluster = new THREE.Group();
  cluster.name = 'lux3d-moon-jelly-cluster';
  cluster.userData.jellies = [];

  moonJellyFormation.forEach((slot, index) => {
    const jelly = source.clone(true);
    jelly.name = `Lux3D_MoonJelly_${String(index + 1).padStart(2, '0')}`;
    jelly.position.set(slot.x, slot.y, slot.z);
    jelly.scale.setScalar(slot.scale);
    jelly.userData.jellyMotion = { ...slot };
    cluster.userData.jellies.push(jelly);
    cluster.add(jelly);
  });

  return cluster;
}

function prepareMoonJellyMaterials(root) {
  root.traverse((object) => {
    if (!object.isMesh) return;
    const materials = Array.isArray(object.material) ? object.material : [object.material];
    materials.forEach((material) => {
      material.transparent = true;
      material.opacity = 0.82;
      material.depthWrite = false;
      material.side = THREE.DoubleSide;
      if (material.isMeshStandardMaterial) {
        material.color.multiply(new THREE.Color('#a9dcf0'));
        material.roughness = 0.38;
        material.metalness = 0;
        material.emissive.set('#29748c');
        material.emissiveIntensity = 0.18;
      }
    });
  });
}

function loadCreatureModels() {
  if (!creatureScene) return;

  Object.entries(creatureModelConfig).forEach(([id, config]) => {
    gltfLoader.load(
      modelUrl(config.path),
      (gltf) => {
        if (id === 'jelly') prepareMoonJellyMaterials(gltf.scene);
        prepareFadingMaterials(gltf.scene);
        const root = id === 'baitfish'
          ? createBaitfishSchool(gltf.scene)
          : id === 'jelly' ? createMoonJellyCluster(gltf.scene) : gltf.scene;
        root.name = `${id}-web-model`;
        if (id === 'sunfish') {
          root.userData.finRig = {
            dorsal: root.getObjectByName('Sunfish_Dorsal_Fin'),
            anal: root.getObjectByName('Sunfish_Anal_Fin'),
          };
        }
        if (id === 'shark') root.userData.tailPivot = root.getObjectByName('Shark_Tail_Pivot');
        root.scale.setScalar(config.scale);
        if (id === 'turtle') root.rotation.set(0.82, -0.28, -0.08);
        root.position.copy(creaturePositionAt(window.matchMedia('(max-width: 700px)').matches ? config.mobileX ?? config.x : config.x, config.y));
        root.userData.currentScale = config.scale;
        root.userData.lastDepth = state.descentProgress;
        root.userData.opacity = creatureBandOpacity(id, state.descentProgress, state.castComplete && state.descentProgress > 0.003);
        creatureScene.add(root);
        creatureModels.set(id, { root, config });
        document.body.classList.add(`has-${id}-model`);
        setModelOpacity(root, root.userData.opacity);
      },
      undefined,
      (error) => console.warn(`Could not load ${id}; keeping CSS fallback.`, error),
    );
  });
}

function loadFishermanModel() {
  gltfLoader.load(
    modelUrl('/models/fisherman.glb'),
    (gltf) => {
      const model = gltf.scene.getObjectByName('Fisherman_Root') || gltf.scene;
      model.name = 'FishermanTarget_Blender';
      model.position.set(-0.45, 1.12, 0.08);
      model.rotation.y = -0.16;
      model.scale.setScalar(0.96);
      model.userData.fisherTarget = true;
      model.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
      });
      boat.add(model);
      model.updateMatrixWorld(true);

      const castPivot = new THREE.Group();
      castPivot.name = 'Fisherman_CastPivot';
      castPivot.position.set(0.22, 1.25, 0);
      model.add(castPivot);
      model.updateMatrixWorld(true);

      [
        'Fisherman_UpperArm_L', 'Fisherman_Forearm_L', 'Fisherman_Hand_L',
        'Fisherman_UpperArm_R', 'Fisherman_Forearm_R', 'Fisherman_Hand_R',
        'Fisherman_Rod', 'Fisherman_Reel',
      ].forEach((partName) => {
        const part = model.getObjectByName(partName);
        if (part) castPivot.attach(part);
      });

      const importedRodTip = new THREE.Object3D();
      importedRodTip.name = 'Fisherman_RodTip';
      importedRodTip.position.set(0.44, 1.92, 1.36);
      model.add(importedRodTip);
      model.updateMatrixWorld(true);
      castPivot.attach(importedRodTip);
      castPivot.userData.baseRotationZ = 0;

      fisherman.visible = false;
      fisherman = model;
      rodRig = castPivot;
      rodTip = importedRodTip;
      document.body.classList.add('has-fisherman-model');
    },
    undefined,
    (error) => console.warn('Could not load Blender fisherman; keeping procedural fallback.', error),
  );
}

function activateVesselModel() {
  if (!pendingVessel || state.mode === 'entry' || state.mode === 'casting') return;
  const { root, mixer, clip, tip } = pendingVessel;
  for (const child of boat.children) child.visible = false;
  boat.add(root);
  vesselModel = root;
  vesselMixer = mixer;
  vesselClip = clip;
  rodTip = tip;
  mixer.clipAction(clip).setLoop(THREE.LoopOnce).play();
  mixer.setTime(state.castComplete ? clip.duration : 0);
  pendingVessel = null;
  document.body.classList.add('has-vessel-model');
}

function loadVesselModel(onSettled) {
  gltfLoader.load(
    modelUrl('/models/boat-fisherman-cast-v11.glb'),
    (gltf) => {
      const clip = gltf.animations.find((item) => item.name === 'Fisherman_Cast');
      const tip = gltf.scene.getObjectByName('Fisherman_RodTip');
      if (!clip || !tip) {
        console.warn('Vessel asset is missing its cast clip or rod tip; keeping the surface fallback.');
        vesselLoadSettled = true;
        onSettled();
        return;
      }
      gltf.scene.name = 'FishingSkiff_Lux3D';
      gltf.scene.traverse((object) => {
        if (!object.isMesh) return;
        object.castShadow = true;
        object.receiveShadow = true;
      });
      pendingVessel = {
        root: gltf.scene,
        mixer: new THREE.AnimationMixer(gltf.scene),
        clip,
        tip,
      };
      activateVesselModel();
      vesselLoadSettled = true;
      onSettled();
    },
    undefined,
    (error) => {
      console.warn('Could not load the skiff and fisherman; keeping the surface fallback.', error);
      vesselLoadSettled = true;
      onSettled();
    },
  );
}

function creaturePositionAt(x, y, target = new THREE.Vector3()) {
  const distance = creatureCamera.position.z;
  const halfHeight = Math.tan(THREE.MathUtils.degToRad(creatureCamera.fov * 0.5)) * distance;
  const halfWidth = halfHeight * creatureCamera.aspect;
  return target.set((x - 0.5) * halfWidth * 2, (0.5 - y) * halfHeight * 2, 0);
}

function creatureBandOpacity(id, progress, isDescent) {
  if (!isDescent) return 0;
  const range = CREATURE_BANDS[id];
  if (!range) return 0;
  const [start, end] = range;
  const edge = id === 'sunfish' || id === 'shark' ? 0.035 : 0.025;
  return clamp(Math.min((progress - start) / edge, (end - progress) / edge));
}

function updateCreatureHitTargets(id, root) {
  const targets = creatureHitTargets.get(id);
  if (!targets?.length || !creatureCamera) return;

  root.updateMatrixWorld(true);
  creatureCamera.updateMatrixWorld(true);
  creatureHitBounds.setFromObject(root);
  if (creatureHitBounds.isEmpty()) return;

  const { min, max } = creatureHitBounds;
  creatureHitCorners[0].set(min.x, min.y, min.z);
  creatureHitCorners[1].set(min.x, min.y, max.z);
  creatureHitCorners[2].set(min.x, max.y, min.z);
  creatureHitCorners[3].set(min.x, max.y, max.z);
  creatureHitCorners[4].set(max.x, min.y, min.z);
  creatureHitCorners[5].set(max.x, min.y, max.z);
  creatureHitCorners[6].set(max.x, max.y, min.z);
  creatureHitCorners[7].set(max.x, max.y, max.z);

  const frame = sceneFrame.getBoundingClientRect();
  let left = Infinity;
  let right = -Infinity;
  let top = Infinity;
  let bottom = -Infinity;
  let visibleCorner = false;

  for (const corner of creatureHitCorners) {
    creatureHitCorner.copy(corner).project(creatureCamera);
    if (creatureHitCorner.z < -1 || creatureHitCorner.z > 1) continue;
    const x = (creatureHitCorner.x * 0.5 + 0.5) * frame.width;
    const y = (0.5 - creatureHitCorner.y * 0.5) * frame.height;
    left = Math.min(left, x);
    right = Math.max(right, x);
    top = Math.min(top, y);
    bottom = Math.max(bottom, y);
    visibleCorner = true;
  }

  if (!visibleCorner) return;
  const mobile = window.matchMedia('(max-width: 700px)').matches;
  const padding = mobile ? 22 : 14;
  const minSize = mobile ? 64 : 44;
  const width = Math.min(frame.width, Math.max(minSize, right - left + padding * 2));
  const height = Math.min(frame.height, Math.max(minSize, bottom - top + padding * 2));
  const targetLeft = THREE.MathUtils.clamp((left + right - width) * 0.5, 0, frame.width - width);
  const targetTop = THREE.MathUtils.clamp((top + bottom - height) * 0.5, 0, frame.height - height);

  for (const target of targets) {
    target.style.left = `${targetLeft}px`;
    target.style.top = `${targetTop}px`;
    target.style.width = `${width}px`;
    target.style.height = `${height}px`;
    target.style.transform = 'none';
  }
}

function updateCreatureModels(delta) {
  if (!creatureRenderer || !creatureScene || !creatureCamera) return;

  const isDescent = state.castComplete && state.descentProgress > 0.003;
  const selectedId = state.observingCreature;
  const mobile = window.matchMedia('(max-width: 700px)').matches;

  creatureModels.forEach(({ root, config }, id) => {
    const selected = id === selectedId;
    const baseOpacity = creatureBandOpacity(id, state.descentProgress, isDescent);
    const targetOpacity = selectedId ? (selected ? 1 : Math.min(baseOpacity, 0.055)) : baseOpacity;
    const depthJumped = Math.abs(state.descentProgress - (root.userData.lastDepth ?? state.descentProgress)) > 0.12;
    root.userData.lastDepth = state.descentProgress;
    root.userData.opacity = depthJumped
      ? targetOpacity
      : THREE.MathUtils.damp(root.userData.opacity ?? 0, targetOpacity, 8, delta);
    setModelOpacity(root, root.userData.opacity);

    const focusX = mobile ? 0.5 : id === 'shark' ? 0.60 : 0.42;
    const focusY = mobile ? id === 'sunfish' ? 0.23 : 0.24 : 0.48;
    const normalX = mobile ? config.mobileX ?? config.x : config.x;
    const desired = creaturePositionAt(selected ? focusX : normalX, selected ? focusY : config.y, scratchA);
    const driftX = selected ? 0 : Math.sin(elapsed * 0.46 + config.x * 8) * 0.08
      + (id === 'shark' ? Math.sin(elapsed * 0.36) * 0.035 : 0);
    const driftY = selected ? Math.sin(elapsed * 0.55) * 0.025 : Math.sin(elapsed * 0.72 + config.y * 7) * 0.07;
    root.position.x = depthJumped ? desired.x + driftX : THREE.MathUtils.damp(root.position.x, desired.x + driftX, 5.5, delta);
    root.position.y = depthJumped ? desired.y + driftY : THREE.MathUtils.damp(root.position.y, desired.y + driftY, 5.5, delta);
    root.position.z = THREE.MathUtils.damp(root.position.z, selected ? 1.0 : 0, 5.5, delta);

    const desktopSelectedScale = id === 'baitfish' ? 1.52 : id === 'turtle' ? 1.72 : 1.6;
    const mobileSelectedScale = id === 'jelly' ? 1.2 : id === 'sunfish' ? 0.48 : 0.68;
    const selectedScale = mobile ? mobileSelectedScale : desktopSelectedScale;
    const targetScale = config.scale * (selected ? selectedScale : 1);
    root.userData.currentScale = THREE.MathUtils.damp(root.userData.currentScale, targetScale, 5.5, delta);
    root.scale.setScalar(root.userData.currentScale);

    if (id === 'baitfish') {
      root.userData.swimmers?.forEach((fish) => {
        const motion = fish.userData.schoolMotion;
        fish.position.set(
          motion.x + Math.sin(elapsed * 0.62 + motion.phase) * 0.025,
          motion.y + Math.sin(elapsed * 1.08 + motion.phase) * 0.024,
          motion.z + Math.cos(elapsed * 0.74 + motion.phase) * 0.018,
        );
        fish.rotation.y = motion.yaw + Math.sin(elapsed * 0.48 + motion.phase) * 0.055;
        fish.rotation.z = Math.sin(elapsed * 0.82 + motion.phase) * 0.025;
      });
    } else if (id === 'turtle') {
      root.rotation.y = -0.28 + Math.sin(elapsed * 0.38) * 0.035;
      root.rotation.z = -0.08 + Math.sin(elapsed * 0.62) * 0.018;
    } else if (id === 'sunfish') {
      root.rotation.z = Math.sin(elapsed * 0.9) * 0.025;
      root.rotation.y = Math.sin(elapsed * 0.55) * 0.07;
      if (root.userData.finRig?.dorsal && root.userData.finRig?.anal) {
        const finBeat = Math.sin(elapsed * 1.05) * 0.065;
        root.userData.finRig.dorsal.rotation.z = finBeat;
        root.userData.finRig.anal.rotation.z = -finBeat;
      }
    } else if (id === 'shark') {
      root.rotation.y = -0.12 + Math.sin(elapsed * 0.7) * 0.045;
      if (root.userData.tailPivot) root.userData.tailPivot.rotation.y = Math.sin(elapsed * 2.0) * 0.13;
    } else if (id === 'jelly') {
      root.userData.jellies?.forEach((jelly) => {
        const motion = jelly.userData.jellyMotion;
        const pulse = Math.sin(elapsed * 1.75 + motion.phase);
        jelly.scale.set(
          motion.scale * (1 + pulse * 0.055),
          motion.scale * (1 - pulse * 0.06),
          motion.scale * (1 + pulse * 0.055),
        );
        jelly.position.y = motion.y + Math.sin(elapsed * 0.8 + motion.phase) * 0.035;
        jelly.rotation.z = Math.sin(elapsed * 0.55 + motion.phase) * 0.035;
      });
    }

    if (selected || root.userData.opacity > 0.025) updateCreatureHitTargets(id, root);
  });

  if (isDescent || selectedId) {
    creatureRenderer.render(creatureScene, creatureCamera);
    creatureRenderCount += 1;
  }
}

function loadBlenderAssets() {
  const startCreatureLoads = () => {
    if (creatureLoadStarted) return;
    creatureLoadStarted = true;
    loadCreatureModels();
  };
  loadVesselModel(startCreatureLoads);
  window.setTimeout(startCreatureLoads, 8000);
}

function fract(value) {
  return value - Math.floor(value);
}

function noiseHash2D(x, y) {
  return fract(Math.sin(x * 127.1 + y * 311.7) * 43758.5453);
}

function valueNoise2D(x, y) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = fract(x);
  const fy = fract(y);
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const n00 = noiseHash2D(x0, y0);
  const n10 = noiseHash2D(x0 + 1, y0);
  const n01 = noiseHash2D(x0, y0 + 1);
  const n11 = noiseHash2D(x0 + 1, y0 + 1);
  return (n00 + (n10 - n00) * sx) + ((n01 + (n11 - n01) * sx) - (n00 + (n10 - n00) * sx)) * sy;
}

function directionalWave(x, y, time, dirX, dirY, wavelength, amplitude, speed, phase = 0) {
  const k = (Math.PI * 2) / wavelength;
  return Math.sin((x * dirX + y * dirY) * k + time * speed + phase) * amplitude;
}

function waveHeightAt(localX, localY, time) {
  const warpX = (valueNoise2D(localX * 0.028 + time * 0.006, localY * 0.028 - time * 0.004) - 0.5) * 4.0;
  const warpY = (valueNoise2D(localX * 0.031 - time * 0.005, localY * 0.031 + time * 0.006) - 0.5) * 4.0;
  const x = localX + warpX;
  const y = localY + warpY;
  const primary = directionalWave(x, y, time, 0.96, 0.28, 22.0, 0.52, 0.28, 0.35);
  const secondary = directionalWave(x, y, time, 0.92, 0.1, 14.0, 0.2, 0.34, 1.7);
  const longSwell = directionalWave(x, y, time, 0.88, 0.47, 31.0, 0.14, 0.2, -0.8);
  const shortChop = directionalWave(x, y, time, 0.96, 0.28, 6.8, 0.1, 0.65, 2.2);
  const secondaryChop = directionalWave(x, y, time, 0.9, -0.05, 4.6, 0.045, 0.82, 0.4);
  const organic = (
    (valueNoise2D(x * 0.12 + time * 0.012, y * 0.12 - time * 0.009) - 0.5) * 0.21
    + (valueNoise2D(x * 0.26 - time * 0.018, y * 0.24 + time * 0.014) - 0.5) * 0.07
  );
  const shapedCrest = Math.pow(Math.max(0, primary / 0.52), 3) * 0.11;
  return primary + secondary + longSwell + shortChop + secondaryChop + organic + shapedCrest;
}

function createWaterNormalTexture(size = 128) {
  const data = new Uint8Array(size * size * 4);
  const wrap = (value) => ((value % 1) + 1) % 1;
  const normalHeightAt = (u, v) => {
    const x = u * Math.PI * 2;
    const y = v * Math.PI * 2;
    const warp = Math.sin(x * 1.7 + y * 1.25) * 0.18 + Math.sin(y * 2.4 - x * 1.05) * 0.11;
    return (
      Math.sin(x * 2.2 + y * 1.15 + warp) * 0.24
      + Math.sin(x * -1.35 + y * 3.45 - warp) * 0.19
      + Math.sin(x * 4.7 - y * 2.9 + Math.sin(y * 2.0)) * 0.11
      + Math.sin(x * 8.8 + y * 6.2 + Math.sin(x * 2.0) * 0.55) * 0.065
      + Math.sin((x - y) * 16.0 + Math.sin(y * 4.0) * 0.7) * 0.032
      + Math.sin((x + y) * 27.0 + warp * 2.0) * 0.018
    );
  };
  const epsilon = 1 / size;

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const u = x / size;
      const v = y / size;
      const dx = (normalHeightAt(wrap(u + epsilon), v) - normalHeightAt(wrap(u - epsilon), v)) / (2 * epsilon);
      const dy = (normalHeightAt(u, wrap(v + epsilon)) - normalHeightAt(u, wrap(v - epsilon))) / (2 * epsilon);
      const normal = new THREE.Vector3(-dx * 0.013, -dy * 0.013, 1).normalize();
      const index = (y * size + x) * 4;
      data[index] = Math.round((normal.x * 0.5 + 0.5) * 255);
      data[index + 1] = Math.round((normal.y * 0.5 + 0.5) * 255);
      data[index + 2] = Math.round((normal.z * 0.5 + 0.5) * 255);
      data[index + 3] = 255;
    }
  }

  const texture = new THREE.DataTexture(data, size, size, THREE.RGBAFormat);
  texture.name = 'OceanNormalDesigned';
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function addWaterWaveDisplacement(water) {
  water.material.uniforms.waveTime = { value: 0 };
  water.material.vertexShader = water.material.vertexShader
    .replace(
      'void main() {',
      [
        'uniform float waveTime;',
        '',
        'float waveHash(vec2 point) {',
        '  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);',
        '}',
        '',
        'float waveNoise(vec2 point) {',
        '  vec2 cell = floor(point);',
        '  vec2 local = fract(point);',
        '  local = local * local * (3.0 - 2.0 * local);',
        '  float a = waveHash(cell);',
        '  float b = waveHash(cell + vec2(1.0, 0.0));',
        '  float c = waveHash(cell + vec2(0.0, 1.0));',
        '  float d = waveHash(cell + vec2(1.0, 1.0));',
        '  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);',
        '}',
        '',
        'float directionalWave(vec2 point, vec2 direction, float wavelength, float amplitude, float speed, float time, float phase) {',
        '  float k = 6.2831853 / wavelength;',
        '  return sin(dot(point, direction) * k + time * speed + phase) * amplitude;',
        '}',
        '',
        'vec2 waveWarp(vec2 point, float time) {',
        '  return point + (vec2(',
        '    waveNoise(point * 0.028 + vec2(time * 0.006, -time * 0.004)),',
        '    waveNoise(point * 0.031 + vec2(-time * 0.005, time * 0.006))',
        '  ) - 0.5) * 4.0;',
        '}',
        '',
        'float waveHeightAt(vec2 point, float time) {',
        '  vec2 warpedPoint = waveWarp(point, time);',
        '  float primary = directionalWave(warpedPoint, vec2(0.96, 0.28), 22.0, 0.52, 0.28, time, 0.35);',
        '  float secondary = directionalWave(warpedPoint, vec2(0.92, 0.1), 14.0, 0.2, 0.34, time, 1.7);',
        '  float longSwell = directionalWave(warpedPoint, vec2(0.88, 0.47), 31.0, 0.14, 0.2, time, -0.8);',
        '  float shortChop = directionalWave(warpedPoint, vec2(0.96, 0.28), 6.8, 0.1, 0.65, time, 2.2);',
        '  float secondaryChop = directionalWave(warpedPoint, vec2(0.9, -0.05), 4.6, 0.045, 0.82, time, 0.4);',
        '  float organic = (waveNoise(warpedPoint * 0.12 + vec2(time * 0.012, -time * 0.009)) - 0.5) * 0.21;',
        '  organic += (waveNoise(warpedPoint * 0.26 + vec2(-time * 0.018, time * 0.014)) - 0.5) * 0.07;',
        '  float shapedCrest = pow(max(primary / 0.52, 0.0), 3.0) * 0.11;',
        '  return primary + secondary + longSwell + shortChop + secondaryChop + organic + shapedCrest;',
        '}',
        '',
        'vec2 waveDriftAt(vec2 point, float time) {',
        '  vec2 warpedPoint = waveWarp(point, time);',
        '  vec2 primaryDirection = vec2(0.96, 0.28);',
        '  vec2 secondaryDirection = vec2(0.92, 0.1);',
        '  float primaryPhase = dot(warpedPoint, primaryDirection) * (6.2831853 / 22.0) + time * 0.28 + 0.35;',
        '  float secondaryPhase = dot(warpedPoint, secondaryDirection) * (6.2831853 / 14.0) + time * 0.34 + 1.7;',
        '  return primaryDirection * cos(primaryPhase) * 0.1 + secondaryDirection * cos(secondaryPhase) * 0.035;',
        '}',
        '',
        'vec3 displaceSurface(vec3 point) {',
        '  float height = waveHeightAt(point.xy, waveTime);',
        '  point.xy += waveDriftAt(point.xy, waveTime) * 0.55;',
        '  point.z += height;',
        '  return point;',
        '}',
        '',
        'void main() {',
      ].join('\n'),
    )
    .replace(
      'mirrorCoord = modelMatrix * vec4( position, 1.0 );',
      'vec3 displacedPosition = displaceSurface( position );\n\t\t\t\tmirrorCoord = modelMatrix * vec4( displacedPosition, 1.0 );',
    )
    .replace(
      'vec4 mvPosition =  modelViewMatrix * vec4( position, 1.0 );',
      'vec4 mvPosition =  modelViewMatrix * vec4( displacedPosition, 1.0 );',
    );
  water.material.needsUpdate = true;
}

function addOceanFoam(water) {
  water.material.fragmentShader = water.material.fragmentShader
    .replace(
      'void main() {',
      [
        'uniform float waveTime;',
        '',
        'float oceanHash(vec2 point) {',
        '  return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453);',
        '}',
        '',
        'float oceanNoise(vec2 point) {',
        '  vec2 cell = floor(point);',
        '  vec2 local = fract(point);',
        '  local = local * local * (3.0 - 2.0 * local);',
        '  float a = oceanHash(cell);',
        '  float b = oceanHash(cell + vec2(1.0, 0.0));',
        '  float c = oceanHash(cell + vec2(0.0, 1.0));',
        '  float d = oceanHash(cell + vec2(1.0, 1.0));',
        '  return mix(mix(a, b, local.x), mix(c, d, local.x), local.y);',
        '}',
        '',
      'float oceanDirectionalWave(vec2 point, vec2 direction, float wavelength, float amplitude, float speed, float time, float phase) {',
      '  float k = 6.2831853 / wavelength;',
      '  return sin(dot(point, direction) * k + time * speed + phase) * amplitude;',
      '}',
      '',
      'vec2 oceanWaveWarp(vec2 point, float time) {',
      '  return point + (vec2(',
      '    oceanNoise(point * 0.028 + vec2(time * 0.006, -time * 0.004)),',
      '    oceanNoise(point * 0.031 + vec2(-time * 0.005, time * 0.006))',
      '  ) - 0.5) * 4.0;',
      '}',
      '',
      'float oceanWaveHeight(vec2 point, float time) {',
      '  vec2 warpedPoint = oceanWaveWarp(point, time);',
      '  float primary = oceanDirectionalWave(warpedPoint, vec2(0.96, 0.28), 22.0, 0.52, 0.28, time, 0.35);',
      '  float secondary = oceanDirectionalWave(warpedPoint, vec2(0.92, 0.1), 14.0, 0.2, 0.34, time, 1.7);',
      '  float longSwell = oceanDirectionalWave(warpedPoint, vec2(0.88, 0.47), 31.0, 0.14, 0.2, time, -0.8);',
      '  float shortChop = oceanDirectionalWave(warpedPoint, vec2(0.96, 0.28), 6.8, 0.1, 0.65, time, 2.2);',
      '  float secondaryChop = oceanDirectionalWave(warpedPoint, vec2(0.9, -0.05), 4.6, 0.045, 0.82, time, 0.4);',
      '  float organic = (oceanNoise(warpedPoint * 0.12 + vec2(time * 0.012, -time * 0.009)) - 0.5) * 0.21;',
      '  organic += (oceanNoise(warpedPoint * 0.26 + vec2(-time * 0.018, time * 0.014)) - 0.5) * 0.07;',
      '  float shapedCrest = pow(max(primary / 0.52, 0.0), 3.0) * 0.11;',
      '  return primary + secondary + longSwell + shortChop + secondaryChop + organic + shapedCrest;',
      '}',
      '',
      'vec3 oceanWaveNormal(vec2 point, float time) {',
      '  float epsilon = 0.32;',
        '  float left = oceanWaveHeight(point - vec2(epsilon, 0.0), time);',
        '  float right = oceanWaveHeight(point + vec2(epsilon, 0.0), time);',
        '  float down = oceanWaveHeight(point - vec2(0.0, epsilon), time);',
        '  float up = oceanWaveHeight(point + vec2(0.0, epsilon), time);',
        '  float slopeX = (right - left) / (2.0 * epsilon);',
        '  float slopeY = (up - down) / (2.0 * epsilon);',
        '  return normalize(vec3(-slopeX, 1.0, slopeY));',
        '}',
        '',
      'float foamNoise(vec2 point) {',
      '  return oceanNoise(point) * 0.7 + oceanNoise(point * 2.13 + 17.0) * 0.3;',
      '}',
      '',
      'float oceanStreakNoise(vec2 point) {',
      '  float broad = oceanNoise(point * vec2(0.42, 1.55));',
      '  float fine = oceanNoise(point * vec2(1.1, 3.7) + vec2(11.0, 4.0));',
      '  return broad * 0.68 + fine * 0.32;',
      '}',
      '',
      'void main() {',
      ].join('\n'),
    )
    .replace(
      'vec3 surfaceNormal = normalize( noise.xzy * vec3( 1.5, 1.0, 1.5 ) );',
      [
        'vec3 microNormal = normalize( noise.xzy * vec3( 1.35, 1.0, 1.35 ) );',
        'vec2 wavePoint = vec2(worldPosition.x, -worldPosition.z);',
        'vec3 waveNormal = oceanWaveNormal(wavePoint, waveTime);',
        'vec3 surfaceNormal = normalize(mix(waveNormal, microNormal, 0.36));',
      ].join('\n'),
    )
    .replace(
      /float theta = max\( dot\( eyeDirection, surfaceNormal \), 0\.0 \);[\s\S]*?vec3 outgoingLight = albedo;/,
      [
        'float facing = max( dot( eyeDirection, surfaceNormal ), 0.0 );',
        'float fresnel = 0.02 + ( 1.0 - 0.02 ) * pow( 1.0 - facing, 5.0 );',
        'float waveHeight = oceanWaveHeight( wavePoint, waveTime );',
        'float crest = smoothstep( 0.42, 0.78, waveHeight );',
        'float trough = 1.0 - smoothstep( -0.68, -0.14, waveHeight );',
        'float waveSlope = smoothstep( 0.06, 0.24, length( surfaceNormal.xz ) );',
        'float foamField = foamNoise( wavePoint * 0.32 + vec2( waveTime * 0.035, -waveTime * 0.028 ) );',
        'float whitecap = pow( crest, 5.0 ) * waveSlope * smoothstep( 0.84, 0.98, foamField ) * 0.03;',
        'vec3 deepWater = waterColor * ( 0.86 + crest * 0.1 - trough * 0.06 );',
        'deepWater += sunColor * diffuseLight * 0.04;',
        'float reflectedLuma = dot( reflectionSample, vec3( 0.2126, 0.7152, 0.0722 ) );',
        'float skyLight = smoothstep( 0.12, 0.82, reflectedLuma );',
        'vec3 reflectedSky = mix( vec3( 0.008, 0.07, 0.17 ), vec3( 0.05, 0.27, 0.58 ), skyLight );',
        'vec3 reflectedSun = normalize( reflect( -sunDirection, surfaceNormal ) );',
        'float sunAlignment = max( dot( eyeDirection, reflectedSun ), 0.0 );',
        'float broadSunGlint = 0.0;',
        'float sharpSunGlint = pow( sunAlignment, 170.0 );',
        'float glintPattern = smoothstep( 0.76, 0.98, oceanStreakNoise( wavePoint * 0.92 + vec2( waveTime * 0.08, -waveTime * 0.06 ) ) );',
        'vec3 sunGlint = sunColor * ( sharpSunGlint * ( 0.032 + glintPattern * 0.09 ) );',
        'float reflectionAmount = clamp( fresnel * 1.85 + waveSlope * 0.055, 0.0, 0.72 );',
        'vec3 albedo = mix( deepWater, reflectedSky + sunGlint, reflectionAmount );',
        'albedo += sunGlint * 0.28;',
        'float sparkleField = oceanNoise( wavePoint * 0.72 + vec2( waveTime * 0.16, -waveTime * 0.12 ) );',
        'float sunFacing = pow( max( dot( surfaceNormal, sunDirection ), 0.0 ), 7.0 );',
        'float movingSparkle = smoothstep( 0.92, 0.995, sparkleField ) * sunFacing * 0.02;',
        'albedo += sunColor * movingSparkle;',
        'albedo = mix( albedo, vec3( 0.7, 0.9, 0.96 ), whitecap );',
        'vec3 outgoingLight = albedo;',
      ].join('\n'),
    );
  water.material.fragmentShader = water.material.fragmentShader.replace(
    'sunLight( surfaceNormal, eyeDirection, 100.0, 2.0, 0.5, diffuseLight, specularLight );',
    'sunLight( surfaceNormal, eyeDirection, 180.0, 1.7, 0.3, diffuseLight, specularLight );',
  );
  water.material.fragmentShader = water.material.fragmentShader.replace(
    'vec2 distortion = surfaceNormal.xz * ( 0.001 + 1.0 / distance ) * distortionScale;',
    'vec2 distortion = surfaceNormal.xz * ( 0.0004 + 0.42 / distance ) * distortionScale;',
  );
  water.material.needsUpdate = true;
}

function tuneWaterReflection(water) {
  water.material.uniforms.distortionScale.value = 0.52;
  water.material.needsUpdate = true;
}

function createWakeRibbon(offsetX, width) {
  const shape = new THREE.Shape();
  shape.moveTo(offsetX - width * 0.48, 0.08);
  shape.lineTo(offsetX - width * 1.05, -0.48);
  shape.lineTo(offsetX - width * 0.72, -1.25);
  shape.lineTo(offsetX - width * 0.28, -2.05);
  shape.lineTo(offsetX + width * 0.28, -2.05);
  shape.lineTo(offsetX + width * 0.72, -1.25);
  shape.lineTo(offsetX + width * 1.05, -0.48);
  shape.lineTo(offsetX + width * 0.48, 0.08);
  shape.closePath();

  const ribbon = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({
      color: '#c3ece6',
      transparent: true,
      opacity: 0.32,
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    }),
  );
  ribbon.rotation.x = -Math.PI / 2;
  ribbon.position.set(0, 0.2, 0.62);
  ribbon.renderOrder = 2;
  return ribbon;
}

function createOcean() {
  const isMobile = window.matchMedia('(max-width: 700px)').matches;
  const geometry = new THREE.PlaneGeometry(520, 520, isMobile ? 150 : 220, isMobile ? 150 : 220);
  const reflectionResolution = isMobile ? 256 : 512;
  const waterNormals = createWaterNormalTexture();
  waterNormals.anisotropy = Math.min(renderer.capabilities.getMaxAnisotropy(), 4);

  ocean = new Water(geometry, {
    textureWidth: reflectionResolution,
    textureHeight: reflectionResolution,
    waterNormals,
    sunDirection,
    sunColor: 0xfff0c2,
    waterColor: 0x003d78,
    distortionScale: 0.52,
    alpha: 1,
    fog: true,
  });
  ocean.rotation.x = -Math.PI / 2;
  ocean.position.y = 0;
  ocean.name = 'SurfaceOcean';
  ocean.material.uniforms.size.value = 1.72;
  addWaterWaveDisplacement(ocean);
  addOceanFoam(ocean);
  tuneWaterReflection(ocean);
  scene.add(ocean);
}

function createSkyDetails() {
  sky = new Sky();
  sky.scale.setScalar(500);
  sky.renderOrder = -10;
  sky.material.uniforms.turbidity.value = 2.0;
  sky.material.uniforms.rayleigh.value = 1.8;
  sky.material.uniforms.mieCoefficient.value = 0.004;
  sky.material.uniforms.mieDirectionalG.value = 0.78;
  sky.material.uniforms.sunPosition.value.copy(sunDirection).multiplyScalar(100);
  scene.add(sky);

}

function createBoat() {
  const group = new THREE.Group();
  group.name = 'FishingBoat';

  const hullShape = new THREE.Shape();
  hullShape.moveTo(-2.0, 0);
  hullShape.lineTo(-1.54, -0.42);
  hullShape.lineTo(1.42, -0.42);
  hullShape.lineTo(2.02, 0);
  hullShape.lineTo(1.35, 0.35);
  hullShape.lineTo(-1.32, 0.35);
  hullShape.closePath();

  const hull = new THREE.Mesh(
    new THREE.ExtrudeGeometry(hullShape, {
      depth: 0.86,
      bevelEnabled: true,
      bevelSegments: 2,
      bevelSize: 0.08,
      bevelThickness: 0.08,
      curveSegments: 4,
    }),
    createMaterial('#b86f4c', 0.48),
  );
  hull.geometry.rotateX(Math.PI / 2);
  hull.position.y = 0.58;
  hull.castShadow = true;
  hull.receiveShadow = true;
  group.add(hull);

  const deck = new THREE.Mesh(
    new THREE.ShapeGeometry(hullShape),
    createMaterial('#d6a16c', 0.66),
  );
  deck.geometry.rotateX(-Math.PI / 2);
  deck.position.y = 1.01;
  deck.scale.set(0.91, 0.91, 0.91);
  deck.castShadow = true;
  deck.receiveShadow = true;
  group.add(deck);

  const rimMaterial = createMaterial('#f2c58c', 0.52);
  const leftRim = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.1, 0.1), rimMaterial);
  leftRim.position.set(0, 1.09, -0.35);
  leftRim.castShadow = true;
  group.add(leftRim);

  const rightRim = leftRim.clone();
  rightRim.position.z = 0.35;
  group.add(rightRim);

  const seat = new THREE.Mesh(
    new THREE.BoxGeometry(1.25, 0.14, 0.56),
    createMaterial('#5c3b35', 0.72),
  );
  seat.position.set(-0.22, 1.19, 0.08);
  seat.castShadow = true;
  group.add(seat);

  const console = new THREE.Mesh(
    new THREE.BoxGeometry(0.5, 0.48, 0.58),
    createMaterial('#c27e57', 0.62),
  );
  console.position.set(1.04, 1.22, 0.02);
  console.castShadow = true;
  group.add(console);

  const consoleTop = new THREE.Mesh(
    new THREE.BoxGeometry(0.54, 0.06, 0.62),
    createMaterial('#f4c988', 0.42),
  );
  consoleTop.position.set(1.04, 1.48, 0.02);
  consoleTop.castShadow = true;
  group.add(consoleTop);

  const mast = new THREE.Mesh(
    new THREE.CylinderGeometry(0.025, 0.035, 1.8, 8),
    createMaterial('#5a4c3e', 0.75),
  );
  mast.position.set(1.54, 1.74, 0.08);
  mast.castShadow = true;
  group.add(mast);

  const flag = new THREE.Mesh(
    new THREE.PlaneGeometry(0.46, 0.22),
    new THREE.MeshBasicMaterial({ color: '#e99c67', side: THREE.DoubleSide }),
  );
  flag.position.set(1.74, 2.32, 0.08);
  flag.rotation.y = Math.PI / 2;
  group.add(flag);

  group.position.set(0, 0.02, 0);
  scene.add(group);
  return group;
}

function createFisherman() {
  const group = new THREE.Group();
  group.name = 'FishermanTarget';
  group.position.set(-0.45, 0, 0.08);
  group.userData.fisherTarget = true;

  const coatMaterial = createMaterial('#315a62', 0.72);
  const warmMaterial = createMaterial('#edb36e', 0.62);
  const skinMaterial = createMaterial('#c77c59', 0.72);
  const darkMaterial = createMaterial('#203843', 0.78);
  const hatMaterial = createMaterial('#e07d55', 0.68);

  const legs = new THREE.Group();
  legs.position.y = 1.14;
  legs.add(createLimb(new THREE.Vector3(-0.1, 0, 0), new THREE.Vector3(-0.16, 0.42, 0), 0.075, darkMaterial));
  legs.add(createLimb(new THREE.Vector3(0.1, 0, 0), new THREE.Vector3(0.16, 0.42, 0), 0.075, darkMaterial));
  group.add(legs);

  const torso = new THREE.Mesh(
    new THREE.CapsuleGeometry(0.23, 0.48, 5, 8),
    coatMaterial,
  );
  torso.position.y = 1.66;
  torso.scale.z = 0.72;
  torso.castShadow = true;
  group.add(torso);

  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.1, 0.12, 8), skinMaterial);
  neck.position.y = 2.03;
  neck.castShadow = true;
  group.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 16, 12), skinMaterial);
  head.position.y = 2.25;
  head.castShadow = true;
  group.add(head);

  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.12, 12), hatMaterial);
  hat.position.y = 2.45;
  hat.castShadow = true;
  group.add(hat);

  const hatTop = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.18, 0.15, 12), hatMaterial);
  hatTop.position.y = 2.56;
  hatTop.castShadow = true;
  group.add(hatTop);

  const leftArm = createLimb(new THREE.Vector3(-0.18, 1.87, 0), new THREE.Vector3(-0.34, 1.37, -0.02), 0.07, coatMaterial);
  group.add(leftArm);

  rodRig = new THREE.Group();
  rodRig.position.set(0.2, 1.91, -0.02);
  rodRig.rotation.z = -0.34;
  group.add(rodRig);

  const rightArm = createLimb(new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.17, -0.38, -0.02), 0.068, warmMaterial);
  rodRig.add(rightArm);

  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.036, 1.82, 8),
    createMaterial('#2b3e44', 0.7),
  );
  rod.position.set(0.07, 0.88, 0);
  rod.rotation.z = -0.08;
  rod.castShadow = true;
  rodRig.add(rod);

  rodTip = new THREE.Object3D();
  rodTip.position.set(0.18, 1.77, 0);
  rodRig.add(rodTip);

  fisherClickTarget = new THREE.Mesh(
    new THREE.SphereGeometry(1.05, 16, 12),
    new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      colorWrite: false,
    }),
  );
  fisherClickTarget.name = 'FishermanClickTarget';
  fisherClickTarget.position.set(-0.45, 2.02, 0.08);
  fisherClickTarget.userData.fisherTarget = true;
  boat.add(fisherClickTarget);

  fisherman = group;
  boat.add(group);
}

function createSurfaceDetails() {
  hookGroup = new THREE.Group();
  hookGroup.name = 'FishingHook';

  const hook = new THREE.Mesh(
    new THREE.TorusGeometry(0.075, 0.018, 8, 16, Math.PI * 1.55),
    new THREE.MeshStandardMaterial({ color: '#f2d58a', roughness: 0.38, metalness: 0.72 }),
  );
  hook.rotation.z = Math.PI * 0.5;
  hook.position.y = -0.06;
  hook.castShadow = true;
  hookGroup.add(hook);

  const sinker = new THREE.Mesh(
    new THREE.SphereGeometry(0.055, 10, 8),
    new THREE.MeshStandardMaterial({ color: '#c6d5d0', roughness: 0.24, metalness: 0.72 }),
  );
  sinker.position.y = 0.1;
  hookGroup.add(sinker);

  hookGroup.visible = false;
  scene.add(hookGroup);

  const lineGeometry = new THREE.BufferGeometry();
  lineGeometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(6), 3));
  fishingLine = new THREE.Line(
    lineGeometry,
    new THREE.LineBasicMaterial({ color: '#e8f1e5', transparent: true, opacity: 0.84 }),
  );
  fishingLine.visible = false;
  scene.add(fishingLine);

  hoverHalo = new THREE.Mesh(
    new THREE.RingGeometry(0.27, 0.31, 40),
    new THREE.MeshBasicMaterial({
      color: '#f7d89a',
      transparent: true,
      opacity: 0.78,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  hoverHalo.rotation.x = -Math.PI / 2;
  hoverHalo.position.set(-0.45, 1.12, 0.08);
  hoverHalo.visible = false;
  scene.add(hoverHalo);

  wakeRing = new THREE.Mesh(
    new THREE.RingGeometry(0.55, 0.72, 64),
    new THREE.MeshBasicMaterial({
      color: '#d8f1e6',
      transparent: true,
      opacity: 0.28,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  wakeRing.rotation.x = -Math.PI / 2;
  wakeRing.position.set(0, 0.2, 0.52);
  wakeRing.scale.set(1.8, 0.7, 1);
  scene.add(wakeRing);

  wakeRingInner = wakeRing.clone();
  wakeRingInner.material = wakeRing.material.clone();
  wakeRingInner.material.opacity = 0.18;
  wakeRingInner.scale.set(1.15, 0.48, 1);
  scene.add(wakeRingInner);

  wakeFoamLeft = createWakeRibbon(-0.34, 0.18);
  wakeFoamRight = createWakeRibbon(0.34, 0.18);
  scene.add(wakeFoamLeft, wakeFoamRight);

  const wakeBubbleGeometry = new THREE.CircleGeometry(0.11, 12);
  wakeBubbles = [];
  for (let index = 0; index < 12; index += 1) {
    const bubble = new THREE.Mesh(
      wakeBubbleGeometry,
      new THREE.MeshBasicMaterial({
        color: '#d8f1e6',
        transparent: true,
        opacity: 0,
        side: THREE.DoubleSide,
        depthTest: false,
        depthWrite: false,
      }),
    );
    bubble.rotation.x = -Math.PI / 2;
    bubble.renderOrder = 3;
    bubble.userData.phase = index / 12;
    bubble.userData.offsetX = (index % 2 === 0 ? -1 : 1) * (0.12 + (index % 4) * 0.045);
    bubble.userData.size = 0.62 + (index % 3) * 0.16;
    scene.add(bubble);
    wakeBubbles.push(bubble);
  }
}

function addLights() {
  scene.add(new THREE.HemisphereLight('#d8f4ff', '#153f50', 1.2));

  const sun = new THREE.DirectionalLight('#fff0c2', 3.0);
  sun.position.copy(sunDirection).multiplyScalar(30);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = -12;
  sun.shadow.camera.right = 12;
  sun.shadow.camera.top = 12;
  sun.shadow.camera.bottom = -8;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  scene.add(sun);

  const fill = new THREE.DirectionalLight('#8ed0e4', 1.05);
  fill.position.set(8, 5, -12);
  scene.add(fill);
}

function createScene() {
  scene = new THREE.Scene();
  scene.background = new THREE.Color('#8fb8c8');
  scene.fog = new THREE.Fog('#145479', 100, 460);

  camera = new THREE.PerspectiveCamera(43, 1, 0.1, 600);
  camera.position.copy(cameraStart);

  addLights();
  createSkyDetails();
  createOcean();
  boat = createBoat();
  createFisherman();
  createSurfaceDetails();
  loadBlenderAssets();
  camera.lookAt(targetStart);
}

function updateScrollTarget() {
  if (state.observingCreature) return;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const surfaceBoundary = maxScroll * SURFACE_SCROLL_BASELINE;
  let scrollY = window.scrollY;
  if (!state.castComplete && scrollY > surfaceBoundary) {
    window.scrollTo(0, surfaceBoundary);
    scrollY = surfaceBoundary;
  }
  state.scrollTarget = clamp(scrollY / maxScroll);
  const zoomOutProgress = clamp((SURFACE_SCROLL_BASELINE - state.scrollTarget) / SURFACE_SCROLL_BASELINE);
  state.zoomTarget = THREE.MathUtils.lerp(1, SURFACE_ZOOM_OUT_MAX, zoomOutProgress);
}

function updateOpening() {
  if (state.mode !== 'opening' || elapsed - state.openingStartedAt < OPENING_HOLD_DURATION) return;
  startBoatEntry();
}

function updateEntry() {
  if (!state.entryStartedAt) return;

  const duration = 2.4;
  const raw = clamp((elapsed - state.entryStartedAt) / duration);
  state.entryProgress = raw;

  if (raw >= 1) {
    if (!vesselLoadSettled && elapsed - state.entryStartedAt < 10) return;
    state.entryStartedAt = 0;
    state.entryProgress = 1;
    cameraPath.getPointAt(1, castCameraPosition);
    castCameraTarget.copy(targetEnd);
    state.mode = 'surface-ready';
    hoverHalo.visible = false;
  }
}

function updateCamera(delta) {
  state.scroll = THREE.MathUtils.damp(state.scroll, state.scrollTarget, 4.6, delta);
  state.zoom = THREE.MathUtils.damp(state.zoom, state.zoomTarget, 9, delta);

  if (state.castComplete) {
    updateDescentState();
    cameraBasePosition.copy(castCameraPosition);
    cameraBaseTarget.copy(castCameraTarget);
  } else if (state.mode === 'opening') {
    cameraBasePosition.copy(cameraStart);
    cameraBaseTarget.copy(targetStart);
  } else if (state.mode === 'entry') {
    const entryProgress = smoothstep(state.entryProgress);
    const approach = THREE.MathUtils.lerp(state.entryStartApproach, 1, entryProgress);
    cameraPath.getPointAt(approach, cameraPathPoint);
    cameraBasePosition.copy(cameraPathPoint);
    cameraBaseTarget.lerpVectors(targetStart, targetEnd, approach);
  } else if (state.mode === 'casting' || state.mode === 'surface-ready') {
    cameraBasePosition.copy(castCameraPosition);
    cameraBaseTarget.copy(castCameraTarget);
  } else {
    const approach = smoothstep(state.scroll);
    cameraPath.getPointAt(approach, cameraPathPoint);
    cameraBasePosition.copy(cameraPathPoint);
    cameraBaseTarget.lerpVectors(targetStart, targetEnd, approach);
  }

  cameraOffset.subVectors(cameraBasePosition, cameraBaseTarget);
  const radius = Math.max(0.001, cameraOffset.length());
  const azimuth = Math.atan2(cameraOffset.x, cameraOffset.z) + state.orbitYaw;
  const baseElevation = Math.asin(THREE.MathUtils.clamp(cameraOffset.y / radius, -1, 1));
  const elevation = THREE.MathUtils.clamp(baseElevation + state.orbitPitch, -0.6, 1.2);
  const zoomedRadius = radius * state.zoom;
  const horizontalRadius = Math.cos(elevation) * zoomedRadius;

  cameraOrbitPosition.set(
    Math.sin(azimuth) * horizontalRadius,
    Math.sin(elevation) * zoomedRadius,
    Math.cos(azimuth) * horizontalRadius,
  ).add(cameraBaseTarget);
  camera.position.copy(cameraOrbitPosition);
  camera.lookAt(cameraBaseTarget);
  meterFill.style.width = String(Math.round(state.castComplete ? state.descentProgress * 100 : 0)) + '%';
}

function getHookLandingWorld() {
  scratchB.copy(vesselModel ? vesselHookLandingLocal : hookLandingLocal);
  boat.localToWorld(scratchB);
  return scratchB;
}

function updateFishingLine(start, end) {
  const position = fishingLine.geometry.attributes.position;
  position.setXYZ(0, start.x, start.y, start.z);
  position.setXYZ(1, end.x, end.y, end.z);
  position.needsUpdate = true;
  fishingLine.geometry.computeBoundingSphere();
}

function updateDescentState() {
  const scrollRange = Math.max(0.12, 1 - state.castAnchorScroll);
  state.descentProgress = clamp((state.scroll - state.castAnchorScroll) / scrollRange);

  if (state.observingCreature) {
    state.mode = 'observation';
  } else if (state.descentProgress > 0.015) {
    state.mode = 'descent';
  } else if (state.mode !== 'casting') {
    state.mode = 'surface-ready';
  }

  const landing = getHookLandingWorld();
  hookGroup.position.copy(landing);
  hookGroup.position.y -= state.descentProgress * 7.2;
  hookGroup.visible = true;
  fishingLine.visible = true;
  rodTip.getWorldPosition(scratchA);
  updateFishingLine(scratchA, hookGroup.position);
}

function updateCreatureInfo(creatureId) {
  const creature = creatureCatalog[creatureId];
  const isVisible = Boolean(creature);

  creatureInfo?.classList.toggle('is-visible', isVisible);
  creatureInfo?.setAttribute('aria-hidden', String(!isVisible));
  if (!creature) return;

  setText(creatureInfoKicker, creatureId === 'sunfish' || creatureId === 'shark'
    ? 'FIELD GUIDE / OPEN WATER' : 'FIELD GUIDE / SUNLIGHT ZONE');
  setText(creatureInfoIndex, creature.index);
  setText(creatureInfoEnglish, creature.english);
  setText(creatureInfoName, creature.name);
  setText(creatureInfoLatin, creature.latin);
  setText(creatureInfoDepth, creature.commonWaterLayer);
  setText(creatureInfoSizeLabel, creature.sizeLabel);
  setText(creatureInfoSize, creature.size);
  setText(creatureInfoHabitat, creature.habitat);
  setText(creatureInfoFact, creature.fact);
  setText(creatureInfoSource, creature.source);
  if (creatureInfoSource) creatureInfoSource.href = creature.sourceUrl;
  setText(creatureInfoSourceNote, creature.sourceNote);
  setText(creatureInfo?.querySelector('.creature-info__footer > span'),
    creatureId === 'sunfish' || creatureId === 'shark' ? '40–80 M · OPEN WATER' : '0–40 M · SUNLIT WATER');
}

function openCreatureObservation(creatureId, trigger = null) {
  if (!creatureCatalog[creatureId] || !state.castComplete || state.descentProgress <= 0.003) return;

  state.observationTrigger = trigger ?? state.observationTrigger;
  state.observingCreature = creatureId;
  state.mode = 'observation';
  document.body.classList.add('is-observing');
  if (creatureInfoScroll) creatureInfoScroll.scrollTop = 0;
  updateCreatureInfo(creatureId);
  updateFlatDive();
  updateHud();
  requestAnimationFrame(() => creatureInfoCloseButtons[0]?.focus({ preventScroll: true }));
}

function closeCreatureObservation() {
  if (!state.observingCreature) return;

  const resumeProgress = state.scroll;
  state.observingCreature = null;
  state.mode = state.descentProgress > 0.015 ? 'descent' : 'surface-ready';
  document.body.classList.remove('is-observing');
  updateCreatureInfo(null);
  updateFlatDive();
  updateHud();
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  state.scrollTarget = resumeProgress;
  window.scrollTo(0, resumeProgress * maxScroll);
  updateScrollTarget();
  state.observationTrigger?.focus({ preventScroll: true });
  state.observationTrigger = null;
}

function bindCreatureInteractions() {
  if (!flatDive) return;

  flatDive.addEventListener('click', (event) => {
    const creature = event.target.closest?.('[data-creature]');
    if (!creature) return;
    event.preventDefault();
    openCreatureObservation(creature.dataset.creature, creature);
  });

  creatureInfoCloseButtons.forEach((button) => {
    button.addEventListener('click', closeCreatureObservation);
  });
  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeCreatureObservation();
  });
}

function updateFlatDive() {
  if (!flatDive) return;

  const isDescent = state.castComplete && state.descentProgress > 0.003;
  const isActive = isDescent;
  const progress = state.descentProgress;
  const encounterOpacity = Object.fromEntries(
    Object.keys(CREATURE_BANDS).map((id) => [id, creatureBandOpacity(id, progress, isDescent)]),
  );

  flatDive.classList.toggle('is-active', isActive);
  flatDive.classList.remove('is-entry');
  flatDive.classList.toggle('is-descent', isDescent);
  flatDive.classList.toggle('is-observing', Boolean(state.observingCreature));
  flatDive.setAttribute('aria-hidden', String(!isActive));
  flatDive.querySelectorAll('[data-creature]').forEach((creature) => {
    const selected = creature.dataset.creature === state.observingCreature;
    const visible = selected || encounterOpacity[creature.dataset.creature] > 0.025;
    creature.classList.toggle('is-selected', selected);
    creature.disabled = !visible || (Boolean(state.observingCreature) && !selected);
    creature.tabIndex = visible ? 0 : -1;
    creature.setAttribute('aria-hidden', String(!visible));
  });
  flatDive.style.setProperty('--dive-progress', progress.toFixed(3));
  flatDive.style.setProperty('--line-height', `${18 + progress * 68}%`);
  flatDive.style.setProperty('--hook-y', `${18 + progress * 68}%`);
  const surfaceOpacity = Math.max(0.08, 1 - progress * 2.36);
  flatDive.style.setProperty('--surface-opacity', String(surfaceOpacity));
  flatDive.style.setProperty('--surface-opacity-secondary', String(surfaceOpacity * 0.62));
  const surfaceSceneOpacity = Math.max(0, 1 - progress * 4.3);
  flatDive.style.setProperty('--surface-scene-opacity', String(surfaceSceneOpacity));
  flatDive.style.setProperty('--surface-scene-y', `${isDescent ? -progress * 62 : 0}px`);
  flatDive.style.setProperty('--water-y', `${progress * 70}px`);
  flatDive.style.setProperty('--particles-y', `${progress * 120}px`);
  flatDive.style.setProperty('--shaft-y', `${progress * 38}px`);
  flatDive.style.setProperty('--fish-opacity', String(encounterOpacity.baitfish));
  flatDive.style.setProperty('--turtle-opacity', String(encounterOpacity.turtle));
  flatDive.style.setProperty('--jelly-opacity', String(encounterOpacity.jelly));
  flatDive.style.setProperty('--sunfish-opacity', String(encounterOpacity.sunfish));
  flatDive.style.setProperty('--shark-opacity', String(encounterOpacity.shark));
  flatDive.style.setProperty('--deep-opacity', String(clamp((progress - 0.45) / 0.42) * 0.48));
  const caption = flatDive.querySelector('.flat-dive__caption');
  if (caption) caption.textContent = progress >= 0.5 ? 'FLAT DESCENT / 40–80M' : 'FLAT DESCENT / 0–40M';
}

function updateCast() {
  if (!state.castStartedAt) return;

  const duration = vesselClip?.duration ?? 1.85;
  const raw = clamp((elapsed - state.castStartedAt) / duration);
  state.castProgress = raw;

  if (vesselMixer) {
    vesselMixer.setTime(raw * duration);
  } else {
    const rodSwing = Math.sin(Math.min(raw / 0.48, 1) * Math.PI);
    const rodBaseRotationZ = rodRig.userData.baseRotationZ ?? -0.34;
    rodRig.rotation.z = rodBaseRotationZ - rodSwing * 0.84;
    rodRig.rotation.x = -rodSwing * 0.15;
  }

  rodTip.getWorldPosition(scratchA);
  const landing = getHookLandingWorld();
  const lineProgress = easeOutCubic(clamp((raw - 0.13) / 0.7));
  hookGroup.visible = raw > 0.12;
  fishingLine.visible = raw > 0.12;

  if (hookGroup.visible) {
    hookGroup.position.lerpVectors(scratchA, landing, lineProgress);
    hookGroup.position.y += Math.sin(raw * Math.PI) * 0.16;
    updateFishingLine(scratchA, hookGroup.position);
  }

  if (raw >= 1) {
    state.castComplete = true;
    state.mode = 'surface-ready';
    state.castStartedAt = 0;
    state.descentProgress = 0;
    if (!vesselMixer) {
      rodRig.rotation.z = rodRig.userData.baseRotationZ ?? -0.34;
      rodRig.rotation.x = 0;
    }
  }
}

function startBoatEntry() {
  if (state.mode !== 'opening' || state.entryStartedAt || state.castComplete) return;

  state.mode = 'entry';
  state.entryStartedAt = elapsed;
  state.entryProgress = 0;
  state.entryStartApproach = 0;
  targetCard.classList.add('is-cast');
  updateHud();
}

function startCast() {
  if (state.mode !== 'surface-ready' || state.castStartedAt || state.castComplete) return;

  cameraPath.getPointAt(1, cameraBasePosition);
  cameraBaseTarget.copy(targetEnd);
  castCameraPosition.copy(cameraBasePosition);
  castCameraTarget.copy(cameraBaseTarget);
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const surfaceScrollY = maxScroll * SURFACE_SCROLL_BASELINE;
  window.scrollTo(0, surfaceScrollY);
  state.scroll = SURFACE_SCROLL_BASELINE;
  state.scrollTarget = SURFACE_SCROLL_BASELINE;
  state.zoomTarget = 1;
  state.mode = 'casting';
  state.castStartedAt = elapsed;
  state.castAnchorScroll = SURFACE_SCROLL_BASELINE;
  hoverHalo.visible = false;
  targetCard.classList.add('is-cast');
  updateHud();
}

function triggerCast() {
  if (state.mode !== 'surface-ready') return false;
  startCast();
  return state.mode === 'casting';
}

function isFishermanAtPointer(event) {
  if (!fisherClickTarget || !canvas || !camera || state.mode !== 'surface-ready') return false;
  const rect = canvas.getBoundingClientRect();
  if (!rect.width || !rect.height) return false;

  fisherPointerNdc.set(
    ((event.clientX - rect.left) / rect.width) * 2 - 1,
    1 - ((event.clientY - rect.top) / rect.height) * 2,
  );
  scene.updateMatrixWorld(true);
  camera.updateMatrixWorld(true);
  fisherRaycaster.setFromCamera(fisherPointerNdc, camera);
  return fisherRaycaster.intersectObject(fisherClickTarget, false).length > 0;
}

function updateFisherHover(event) {
  const isHovering = isFishermanAtPointer(event);
  hoverHalo.visible = isHovering;
  canvas.style.cursor = isHovering ? 'pointer' : 'grab';
}

function bindPointer() {
  canvas.addEventListener('pointermove', (event) => {
    if (!state.isDragging) {
      if (state.mode === 'surface-ready') updateFisherHover(event);
      return;
    }
    if (event.pointerId !== state.pointerId) return;
    const deltaX = event.clientX - state.lastPointerX;
    const deltaY = event.clientY - state.lastPointerY;
    if (Math.hypot(event.clientX - state.pointerDownX, event.clientY - state.pointerDownY) > 7) {
      state.pointerMoved = true;
    }
    state.lastPointerX = event.clientX;
    state.lastPointerY = event.clientY;
    state.orbitYaw -= deltaX * 0.005;
    state.orbitPitch = THREE.MathUtils.clamp(state.orbitPitch - deltaY * 0.004, -0.62, 0.62);
    hoverHalo.visible = false;
    canvas.style.cursor = 'grabbing';
  });

  canvas.addEventListener('pointerleave', () => {
    if (!state.isDragging) {
      hoverHalo.visible = false;
      canvas.style.cursor = 'grab';
    }
  });

  canvas.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    state.isDragging = true;
    state.pointerId = event.pointerId;
    state.lastPointerX = event.clientX;
    state.lastPointerY = event.clientY;
    state.pointerDownX = event.clientX;
    state.pointerDownY = event.clientY;
    state.pointerMoved = false;
    canvas.setPointerCapture?.(event.pointerId);
    canvas.style.cursor = 'grabbing';
  });

  const finishPointer = (event) => {
    if (!state.isDragging || event.pointerId !== state.pointerId) return;

    const shouldCast = event.type === 'pointerup'
      && !state.pointerMoved
      && state.mode === 'surface-ready'
      && isFishermanAtPointer(event);
    state.isDragging = false;
    state.pointerId = null;
    if (canvas.hasPointerCapture?.(event.pointerId)) {
      canvas.releasePointerCapture(event.pointerId);
    }
    canvas.style.cursor = 'grab';
    if (shouldCast) {
      triggerCast();
    } else if (state.mode === 'surface-ready' && event.type === 'pointerup') {
      updateFisherHover(event);
    }
  };

  canvas.addEventListener('pointerup', finishPointer);
  canvas.addEventListener('pointercancel', finishPointer);

}

function updateHud() {
  const cardVisible = !state.observingCreature
    && (state.castComplete || state.mode === 'entry' || state.mode === 'surface-ready' || state.mode === 'casting');
  targetCard.classList.toggle('is-visible', cardVisible);
  targetCard.setAttribute('aria-hidden', String(!cardVisible));
  sceneFrame.classList.toggle('is-descent', state.mode === 'descent' || state.mode === 'observation');
  if (state.mode !== 'surface-ready') hoverHalo.visible = false;

  if (state.mode === 'observation') {
    const depth = currentDepthMeters();
    setText(creatureInfoCurrentDepth, String(depth).padStart(2, '0') + ' m');
    setText(stateChip, 'OBSERVATION / FIELD NOTE');
    setText(sceneHint, 'OBSERVATION MODE · CLOSE THE NOTE TO RESUME');
    setText(zoneValue, depth >= 40 ? 'OPEN WATER / 40–80M' : 'SUNLIGHT ZONE / 0–40M');
    setText(depthValue, String(depth).padStart(3, '0') + 'm');
  } else if (state.mode === 'opening') {
    setText(stateChip, 'SURFACE / OPENING');
    setText(sceneHint, 'A FISHERMAN WAITS ABOVE THE WATER');
    setText(zoneValue, 'SURFACE LAYER');
    setText(depthValue, '000m');
  } else if (state.mode === 'entry') {
    setText(stateChip, 'SURFACE / APPROACH');
    setText(sceneHint, 'MOVING CLOSER TO THE ANGLER');
    setText(zoneValue, 'SURFACE LAYER');
    setText(depthValue, '000m');
    setText(targetCard.querySelector('p'), 'The camera is moving closer. The fisherman has not cast yet.');
    setText(targetCard.querySelector('.target-action'), 'APPROACHING THE BOAT');
  } else if (state.mode === 'surface-ready') {
    setText(stateChip, 'SURFACE / CAST READY');
    setText(sceneHint, 'CLICK THE FISHERMAN TO CAST · SCROLL UP TO ZOOM OUT');
    setText(zoneValue, 'SURFACE LAYER');
    setText(depthValue, '000m');
    setText(targetCard.querySelector('p'), 'The fisherman is waiting. Click him to send the hook below.');
    setText(targetCard.querySelector('.target-action'), 'CLICK THE ANGLER TO CAST');
  } else if (state.mode === 'casting') {
    setText(stateChip, 'SURFACE / CASTING');
    setText(sceneHint, 'THE LINE IS ENTERING THE WATER · SCROLL TO DIVE AFTER THE CAST');
    setText(zoneValue, 'SURFACE LAYER');
    setText(depthValue, '001m');
    setText(targetCard.querySelector('p'), 'A first line has crossed the surface.');
    setText(targetCard.querySelector('.target-action'), 'CAST IN PROGRESS');
  } else if (state.mode === 'descent') {
    const depth = currentDepthMeters();
    setText(stateChip, 'DESCENT / FLAT HOOK');
    setText(sceneHint, depth >= 40 ? 'SCROLL TO FOLLOW THE HOOK · FLAT 40–80M' : 'SCROLL TO FOLLOW THE HOOK · FLAT 0–40M');
    setText(zoneValue, depth >= 40 ? 'OPEN WATER / 40–80M' : 'UPPER WATER / 0–40M');
    setText(depthValue, String(depth).padStart(3, '0') + 'm');
    setText(targetCard.querySelector('p'), 'The surface is moving above you. Keep scrolling.');
    setText(targetCard.querySelector('.target-action'), 'HOOK DESCENT ACTIVE  ↘');
  } else {
    setText(stateChip, 'SURFACE / LINE SET');
    setText(sceneHint, 'SCROLL TO FOLLOW THE HOOK · DRAG TO LOOK');
    setText(zoneValue, 'SURFACE LAYER');
    setText(depthValue, '002m');
    setText(targetCard.querySelector('p'), 'The hook is waiting below the boat.');
    setText(targetCard.querySelector('.target-action'), 'SCROLL DOWN TO DESCEND  ↘');
  }
}

function updateLivingSurface(delta) {
  const waveTime = elapsed * 1.15;
  const bob = Math.sin(elapsed * 0.92) * 0.065;
  const surfaceY = waveHeightAt(0, 0, waveTime);
  const portY = waveHeightAt(-0.62, 0, waveTime);
  const starboardY = waveHeightAt(0.62, 0, waveTime);
  const bowY = waveHeightAt(0, -0.72, waveTime);
  const sternY = waveHeightAt(0, 0.72, waveTime);
  boat.position.y = 0.02 + surfaceY * 0.9 + bob;
  boat.rotation.z = Math.sin(elapsed * 0.66) * 0.014 + (portY - starboardY) * 0.12;
  boat.rotation.x = Math.cos(elapsed * 0.52) * 0.009 + (bowY - sternY) * 0.1;

  hoverHalo.material.opacity = 0.58 + Math.sin(elapsed * 3.5) * 0.18;
  hoverHalo.position.y = 1.12 + surfaceY * 0.86 + bob;
  wakeRing.position.y = 0.2 + surfaceY * 0.86;
  wakeRingInner.position.y = wakeRing.position.y;

  const wakePulse = 1 + Math.sin(elapsed * 1.15) * 0.06;
  wakeRing.scale.x = 1.8 * wakePulse;
  wakeRing.scale.y = 0.7 + Math.cos(elapsed * 0.86) * 0.04;
  wakeRing.position.z = 0.52 + Math.sin(elapsed * 0.48) * 0.05;
  wakeRing.material.opacity = 0.2 + Math.sin(elapsed * 1.3) * 0.035;
  wakeRingInner.scale.x = 1.15 * (1 + Math.cos(elapsed * 1.25) * 0.05);
  wakeRingInner.scale.y = 0.48 + Math.sin(elapsed * 0.9) * 0.025;
  wakeRingInner.position.z = wakeRing.position.z + 0.12;
  wakeRingInner.material.opacity = 0.13 + Math.cos(elapsed * 1.05) * 0.025;

  const foamPulse = 1 + Math.sin(elapsed * 1.4) * 0.045;
  wakeFoamLeft.scale.set(foamPulse, foamPulse, foamPulse);
  wakeFoamRight.scale.set(foamPulse, foamPulse, foamPulse);
  wakeFoamLeft.rotation.z = -0.08 + Math.sin(elapsed * 0.72) * 0.012;
  wakeFoamRight.rotation.z = 0.08 - Math.sin(elapsed * 0.72) * 0.012;
  wakeFoamLeft.position.z = 0.62 + Math.sin(elapsed * 0.54) * 0.06;
  wakeFoamRight.position.z = 0.62 + Math.sin(elapsed * 0.54 + 0.8) * 0.06;
  wakeFoamLeft.position.y = 0.2 + surfaceY * 0.86;
  wakeFoamRight.position.y = 0.2 + surfaceY * 0.86;
  wakeFoamLeft.material.opacity = 0.28 + Math.sin(elapsed * 1.2) * 0.04;
  wakeFoamRight.material.opacity = 0.28 + Math.cos(elapsed * 1.1) * 0.04;

  for (const bubble of wakeBubbles) {
    const flow = (elapsed * 0.34 + bubble.userData.phase) % 1;
    const localX = bubble.userData.offsetX * (1 - flow * 0.35) + Math.sin(elapsed * 1.35 + bubble.userData.phase * 7.0) * 0.035;
    const localZ = 0.72 + flow * 2.8;
    wakeBubbleWorld.set(localX, 0, localZ);
    boat.localToWorld(wakeBubbleWorld);
    const bubbleSurfaceY = waveHeightAt(wakeBubbleWorld.x, -wakeBubbleWorld.z, waveTime);
    bubble.position.set(wakeBubbleWorld.x, bubbleSurfaceY + 0.07, wakeBubbleWorld.z);
    bubble.scale.setScalar(bubble.userData.size * (0.58 + flow * 1.85));
    bubble.rotation.z = elapsed * 0.28 + bubble.userData.phase * Math.PI * 2;
    bubble.material.opacity = (1 - flow) ** 2 * (0.12 + Math.sin(elapsed * 1.8 + bubble.userData.phase * 5.0) * 0.025);
  }

  if (ocean?.material?.uniforms?.time) {
    ocean.material.uniforms.time.value = elapsed * 1.35;
  }

  if (ocean?.material?.uniforms?.waveTime) {
    ocean.material.uniforms.waveTime.value = waveTime;
  }

  if (state.mode !== 'casting' && !vesselMixer) {
    rodRig.rotation.z = THREE.MathUtils.damp(rodRig.rotation.z, rodRig.userData.baseRotationZ ?? -0.34, 5, delta);
    rodRig.rotation.x = THREE.MathUtils.damp(rodRig.rotation.x, 0, 5, delta);
  }

  if (state.castComplete && hookGroup.visible) {
    rodTip.getWorldPosition(scratchA);
    updateFishingLine(scratchA, hookGroup.position);
  }
}

function resize() {
  const rect = sceneFrame.getBoundingClientRect();
  const width = Math.max(1, rect.width);
  const height = Math.max(1, rect.height);
  renderer.setSize(width, height, false);
  camera.aspect = width / height;
  camera.updateProjectionMatrix();
  if (creatureRenderer && creatureCamera) {
    creatureRenderer.setSize(width, height, false);
    creatureCamera.aspect = width / height;
    creatureCamera.updateProjectionMatrix();
  }
}

function render() {
  requestAnimationFrame(render);
  const delta = Math.min(0.05, clock.getDelta());
  elapsed += delta;

  activateVesselModel();
  updateOpening();
  updateEntry();
  updateCamera(delta);
  const flatWaterCoversSurface = state.castComplete && state.descentProgress > 0.003;
  if (!flatWaterCoversSurface) updateLivingSurface(delta);
  updateCast();
  updateFlatDive();
  updateCreatureModels(delta);
  updateHud();
  if (!flatWaterCoversSurface) {
    renderer.render(scene, camera);
    surfaceRenderCount += 1;
  }
}

window.IntoTheAbyss = {
  inspect: () => ({
    mode: state.mode,
    scrollProgress: Number(state.scroll.toFixed(3)),
    entryProgress: Number(state.entryProgress.toFixed(3)),
    castProgress: Number(state.castProgress.toFixed(3)),
    descentProgress: Number(state.descentProgress.toFixed(3)),
    depthMeters: currentDepthMeters(),
    zoom: Number(state.zoom.toFixed(3)),
    castComplete: state.castComplete,
    renderCounts: { surface: surfaceRenderCount, creatures: creatureRenderCount },
    vessel: {
      loaded: Boolean(vesselModel),
      clipDuration: vesselClip ? Number(vesselClip.duration.toFixed(2)) : null,
      rodTip: rodTip?.name ?? null,
      lineStartErrorM: fishingLine?.visible && rodTip
        ? Number(new THREE.Vector3().fromBufferAttribute(fishingLine.geometry.attributes.position, 0)
          .distanceTo(rodTip.getWorldPosition(new THREE.Vector3())).toFixed(4)) : null,
    },
    observingCreature: state.observingCreature,
    creatureModels: [...creatureModels].map(([id, { root }]) => ({
      id,
      loaded: true,
      instances: root.userData.swimmers?.length ?? root.userData.jellies?.length ?? 1,
      opacity: Number((root.userData.opacity ?? 0).toFixed(3)),
      x: Number(root.position.x.toFixed(3)),
      y: Number(root.position.y.toFixed(3)),
      scale: Number((root.userData.currentScale ?? 0).toFixed(3)),
    })),
  }),
  triggerCast,
};

function startSurfaceExperience() {
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  window.scrollTo(0, maxScroll * SURFACE_SCROLL_BASELINE);
  state.scrollTarget = SURFACE_SCROLL_BASELINE;
  state.scroll = SURFACE_SCROLL_BASELINE;
  state.zoom = 1;
  state.zoomTarget = 1;

  if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) {
    cameraPath.getPointAt(1, castCameraPosition);
    castCameraTarget.copy(targetEnd);
    state.mode = 'surface-ready';
    state.entryProgress = 1;
    updateHud();
    return;
  }

  state.mode = 'opening';
  state.openingStartedAt = elapsed;
}

window.addEventListener('scroll', updateScrollTarget, { passive: true });
window.addEventListener('wheel', (event) => {
  if (state.castComplete || state.observingCreature || event.deltaY <= 0) return;
  const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
  const surfaceBoundary = maxScroll * SURFACE_SCROLL_BASELINE;
  if (window.scrollY >= surfaceBoundary - 1) event.preventDefault();
}, { passive: false });
window.addEventListener('resize', resize);

if (setupRenderer()) {
  setupCreatureRenderer();
  createScene();
  bindPointer();
  bindCreatureInteractions();
  updateScrollTarget();
  resize();
  loadingState.classList.add('is-hidden');
  updateHud();
  render();
  requestAnimationFrame(startSurfaceExperience);
}
