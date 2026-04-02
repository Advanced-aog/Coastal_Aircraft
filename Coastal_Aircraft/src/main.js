import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// ── DOM refs ───────────────────────────────────
const container = document.getElementById('canvas-container');
const overlay = document.getElementById('loading-overlay');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const viewNav = document.getElementById('view-nav');
const sliderPanel = document.getElementById('slider-panel');
const sliderTitle = document.getElementById('slider-title');
const visSlider = document.getElementById('vis-slider');
const visValue = document.getElementById('vis-value');
const viewBtns = document.querySelectorAll('.view-btn');

// Dev panel refs
const devToggleBtn = document.getElementById('dev-toggle');
const devPanel = document.getElementById('dev-panel');
const devMeshInfo = document.getElementById('dev-mesh-info');
const devRampList = document.getElementById('dev-ramp-list');
const devOfficeList = document.getElementById('dev-office-list');
const devCamReadout = document.getElementById('dev-cam-readout');
const devSaveBtn = document.getElementById('dev-save');
const devSaveStatus = document.getElementById('dev-save-status');

// Lighting sliders
const devSunSlider = document.getElementById('dev-sun');
const devSunVal = document.getElementById('dev-sun-val');
const devAmbientSlider = document.getElementById('dev-ambient');
const devAmbientVal = document.getElementById('dev-ambient-val');
const devExposureSlider = document.getElementById('dev-exposure');
const devExposureVal = document.getElementById('dev-exposure-val');
const devEnvSlider = document.getElementById('dev-env');
const devEnvVal = document.getElementById('dev-env-val');

// ── Renderer ───────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.35;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// ── Scene ──────────────────────────────────────
const scene = new THREE.Scene();

// ── Camera ─────────────────────────────────────
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.01, 100000);
camera.position.set(50, 30, 80);

// ── Controls ───────────────────────────────────
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.06;
controls.minDistance = 0.5;
controls.maxDistance = 50000;
controls.maxPolarAngle = Math.PI / 1.1;  // allow near-level views
controls.target.set(0, 0, 0);

// ── HDRI Sky Environment ───────────────────────
const HDR_URL = 'https://dl.polyhaven.org/file/ph-assets/HDRIs/hdr/1k/kloofendal_48d_partly_cloudy_puresky_1k.hdr';

const pmremGenerator = new THREE.PMREMGenerator(renderer);
pmremGenerator.compileEquirectangularShader();

new RGBELoader().load(
    HDR_URL,
    (hdrTexture) => {
        hdrTexture.mapping = THREE.EquirectangularReflectionMapping;
        const envMap = pmremGenerator.fromEquirectangular(hdrTexture).texture;
        scene.environment = envMap;
        scene.background = hdrTexture;
        scene.backgroundBlurriness = 0;
        scene.backgroundIntensity = 1.0;
        scene.environmentIntensity = 2;
        hdrTexture.dispose();
        pmremGenerator.dispose();
    },
    undefined,
    (err) => {
        console.warn('HDRI load failed, falling back to solid background:', err);
        scene.background = new THREE.Color(0x87CEEB);
    }
);

// ── Lighting ───────────────────────────────────
const hemiLight = new THREE.HemisphereLight(0x87CEEB, 0x3a5f3a, 0.4);
scene.add(hemiLight);

const sunDir = new THREE.Vector3();
const phi = THREE.MathUtils.degToRad(90 - 45);
const theta = THREE.MathUtils.degToRad(200);
sunDir.setFromSphericalCoords(1, phi, theta);

const sunLight = new THREE.DirectionalLight(0xfff4e6, 3.6);
sunLight.position.copy(sunDir).multiplyScalar(500);
sunLight.castShadow = true;
sunLight.shadow.mapSize.set(2048, 2048);
sunLight.shadow.camera.left = -200;
sunLight.shadow.camera.right = 200;
sunLight.shadow.camera.top = 200;
sunLight.shadow.camera.bottom = -200;
sunLight.shadow.camera.near = 1;
sunLight.shadow.camera.far = 2000;
sunLight.shadow.bias = -0.0005;
scene.add(sunLight);

const fillLight = new THREE.DirectionalLight(0xc4d7ff, 0.4);
fillLight.position.set(-100, 60, -80);
scene.add(fillLight);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.2);
scene.add(ambientLight);

// (Ground comes from the GLB model)

// ── Model & View State ─────────────────────────
let modelBounds = null;
let loadedModel = null;

// Mesh groups — collected by name
const RAMP_MESH_NAMES = ["s213595","s212591","s212592","s212630","s212631","s212615","s212606","s212593","s212612","s212594","s212618","s212617","s212624","s212596","s212598","s212619","s212604","s212597","s212625","s212626","s212629","s212607","s212632","s212633","s212621","s212601","s212628","s212605","s212609","s212610","s212599","s212595","s212627","s212622","s212603","s212608","s212600","s212623","s212602","s212614","s212611","s212620","s212616"];
const RAMP_HIDE_MESH_NAMES = ["s212159","s212579","s212710","s212711","s212699","s212160","s212580","s212713","s212712","s212162","s212582","s212732","s212731","s212730","s212832","s212163","s212583","s212733","s212642","s212649","s212258","s212261","s212259","s212260","s212177","s212175","s212707","s212708","s212675","s212676","s212672","s212673","s212714","s212719","s212720","s212161","s212581","s212715","s212717","s212716","s212728","s212679","s212678","s212729","s212164","s212584","s212585","s212165","s212727","s212680","s212367","s212726","s212817","s212816","s212819","s212818","s212725","s212724","s212166","s212586","s212587","s212167","s212168","s212588","s212589","s212169","s212723","s212722","s212681","s212835","s212837","s212840","s212839","s212844","s212846","s212841","s212843","s212709","s212721","s212718","s212674","s212677","s212698","s212158","s212578","s212375","s212414","s212172","s212170","s212173","s212494","s212537","s212470","s212562","s212575","s212471","s212278","s212280","s212288","s212290","s212281","s212283","s212275","s212279","s212276","s212146","s212298","s212478","s212154","s212156","s212153","s212155","s212485","s212148","s212149","s212150","s212151","s212152","s212425","s212429","s212422","s212430","s212426","s212431","s212427","s212296","s212566","s212418","s212424","s212428","s212420","s212417","s212421","s212419","s212297","s212295","s212423","s212285","s212282","s212270","s212265","s212264","s212267","s212262","s212272","s212147","s212299","s212646","s212643","s212647","s212641","s212178","s212845","s212842","s212838","s212836","s212831","s212829","s212834","s212833","s212176","s212648","s212644","s212269","s212274","s212374","s212416","s212415","s212410","s212413","s212411","s212412","s212400","s212401","s212398","s212399","s212394","s212395","s212388","s212390","s212387","s212384","s212381","s212378","s212379","s212380","s212383","s212382","s212386","s212385","s212389","s212391","s212393","s212392","s212402","s212406","s212397","s212408","s212396","s212407","s212403","s212404","s212409","s212405","s212472","s212473","s212474","s212476","s212475","s212477","s212432","s212433","s212434","s212438","s212440","s212442","s212444","s212447","s212448","s212450","s212452","s212454","s212456","s212458","s212460","s212462","s212464","s212466","s212468","s212435","s212436","s212437","s212439","s212441","s212443","s212445","s212446","s212449","s212451","s212453","s212455","s212457","s212459","s212461","s212463","s212465","s212467","s212469","s212171","s212560","s212546","s212544","s212538","s212532","s212534","s212533","s212531","s212549","s212550","s212552","s212555","s212554","s212557","s212556","s212559","s212558","s212551","s212545","s212548","s212535","s212541","s212536","s212540","s212539","s212547","s212543","s212542","s212561","s212266","s212268","s212263","s212645","s212273","s212486","s212564","s212376","s212377","s212487","s212488","s212530","s212528","s212526","s212523","s212522","s212519","s212518","s212516","s212514","s212511","s212509","s212508","s212506","s212503","s212502","s212500","s212501","s212497","s212498","s212492","s212493","s212496","s212271","s212830","s212284","s212286","s212291","s212277","s212529","s212527","s212525","s212524","s212521","s212520","s212517","s212515","s212513","s212512","s212510","s212507","s212505","s212504","s212499","s212495","s212479","s212490","s212491","s212484","s212480","s212483","s212481","s212482","s212553","s212567","s212568","s212287","s212289","s212489","s212563","s212565","s212570","s212571","s212569","s212572","s212573","s212574","s212235","s212234","s212236","s212256","s212257","s212253","s212252","s212254","s212249","s212251","s212293","s212294","s212292","s212231","s212230","s212233","s212228","s212232","s212248","s212237","s212239","s212240","s212242","s212245","s212243","s212247","s212229","s212250","s212255","s212238","s212241","s212244","s212246"];
const OFFICE_MESH_NAMES = ["s214468","s214439","s214469","s214440","s214470","s214441","s214472","s212368"];
const OFFICE_HIDE_MESH_NAMES = [];

// Saved camera presets (written by dev panel save — null = use auto-computed)
const CAMERA_PRESETS = { home: { posX: 0.63, posY: 0.51, posZ: -1.71, targetX: -0.17, targetY: 0.34, targetZ: 0.08 }, ramp: { posX: -2.07, posY: 0.74, posZ: 0.38, targetX: -0.17, targetY: 0.34, targetZ: 0.08 }, office: { posX: 2.36, posY: 1.08, posZ: 0.94, targetX: 0.59, targetY: 0.19, targetZ: 1.15 } };

// Collected mesh references (populated during model load)
let rampMeshes = [];
let rampHideMeshes = [];
let officeMeshes = [];
let officeHideMeshes = [];

// Camera animation state
let cameraAnim = null;

// View camera presets — computed from mesh group bounding boxes
const viewPresets = {
    home: { pos: null, target: null },
    ramp: { pos: null, target: null },
    office: { pos: null, target: null },
};

let activeView = 'home';

// Dev mode flag
let devMode = false;

// ── GLB Loading ────────────────────────────────
const dracoLoader = new DRACOLoader();
dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.5.7/');

const gltfLoader = new GLTFLoader();
gltfLoader.setDRACOLoader(dracoLoader);

const MODEL_PATH = '/model.glb';

gltfLoader.load(
    MODEL_PATH,
    (gltf) => {
        const model = gltf.scene;
        loadedModel = model;

        // ─── Enable shadows on all meshes ───
        model.traverse((child) => {
            if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;
            }
        });

        // ─── Collect meshes by name for ramp/office groups ───
        // Clone materials so slider opacity changes don't bleed to other meshes
        model.traverse((child) => {
            if (child.isMesh) {
                if (RAMP_MESH_NAMES.includes(child.name)) {
                    child.material = child.material.clone();
                    rampMeshes.push(child);
                }
                if (RAMP_HIDE_MESH_NAMES.includes(child.name)) {
                    child.material = child.material.clone();
                    rampHideMeshes.push(child);
                }
                if (OFFICE_MESH_NAMES.includes(child.name)) {
                    child.material = child.material.clone();
                    officeMeshes.push(child);
                }
                if (OFFICE_HIDE_MESH_NAMES.includes(child.name)) {
                    child.material = child.material.clone();
                    officeHideMeshes.push(child);
                }
            }
        });


        console.log('%c Ramp meshes found:', 'color: #58a6ff; font-weight: bold;',
            rampMeshes.length, '/', RAMP_MESH_NAMES.length, rampMeshes.map(m => m.name));
        console.log('%c Ramp (hide) meshes found:', 'color: #f0883e; font-weight: bold;',
            rampHideMeshes.length, '/', RAMP_HIDE_MESH_NAMES.length, rampHideMeshes.map(m => m.name));
        console.log('%c Office meshes found:', 'color: #58a6ff; font-weight: bold;',
            officeMeshes.length, '/', OFFICE_MESH_NAMES.length, officeMeshes.map(m => m.name));
        console.log('%c Office (hide) meshes found:', 'color: #f0883e; font-weight: bold;',
            officeHideMeshes.length, '/', OFFICE_HIDE_MESH_NAMES.length, officeHideMeshes.map(m => m.name));

        // ─── Scale down entire scene by 3× ───
        model.scale.set(1 / 3, 1 / 3, 1 / 3);

        // ─── Centre & position ───
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        model.position.sub(center);
        const yOffset = -box.min.y + center.y;
        model.position.y += yOffset;

        scene.add(model);
        modelBounds = { maxDim, center, size };

        // ─── Camera settings ───
        camera.near = maxDim * 0.0005;
        camera.far = maxDim * 100;
        camera.updateProjectionMatrix();

        const fitDistance = maxDim * 1.8;
        camera.position.set(fitDistance * 0.8, fitDistance * 0.4, fitDistance * 0.8);
        controls.target.set(0, size.y * 0.3, 0);
        controls.minDistance = maxDim * 0.01;
        controls.maxDistance = maxDim * 1.5;
        controls.update();

        // ─── Calculate view presets from mesh group bounding boxes ───
        viewPresets.home.pos = new THREE.Vector3(fitDistance * 0.8, fitDistance * 0.4, fitDistance * 0.8);
        viewPresets.home.target = new THREE.Vector3(0, size.y * 0.3, 0);

        function presetFromMeshes(meshes, viewDist) {
            if (meshes.length === 0) return null;
            const groupBox = new THREE.Box3();
            meshes.forEach(m => groupBox.expandByObject(m));
            const groupCenter = groupBox.getCenter(new THREE.Vector3());
            const groupSize = groupBox.getSize(new THREE.Vector3());
            const dist = Math.max(groupSize.x, groupSize.y, groupSize.z) * viewDist;
            return {
                target: groupCenter.clone(),
                pos: new THREE.Vector3(
                    groupCenter.x + dist * 0.7,
                    groupCenter.y + dist * 0.4,
                    groupCenter.z + dist * 0.7
                ),
            };
        }

        const rampPreset = presetFromMeshes(rampMeshes, 2.5);
        if (rampPreset) viewPresets.ramp = rampPreset;

        const officePreset = presetFromMeshes(officeMeshes, 2.5);
        if (officePreset) viewPresets.office = officePreset;

        // ─── Override with saved presets if available ───
        for (const view of ['home', 'ramp', 'office']) {
            if (CAMERA_PRESETS[view]) {
                const p = CAMERA_PRESETS[view];
                viewPresets[view] = {
                    pos: new THREE.Vector3(p.posX, p.posY, p.posZ),
                    target: new THREE.Vector3(p.targetX, p.targetY, p.targetZ),
                };
            }
        }

        // Apply home preset as initial camera position
        if (viewPresets.home.pos && viewPresets.home.target) {
            camera.position.copy(viewPresets.home.pos);
            controls.target.copy(viewPresets.home.target);
            controls.update();
        }

        // ─── Adjust shadow camera ───
        const shadowPad = maxDim * 1.2;
        sunLight.shadow.camera.left = -shadowPad;
        sunLight.shadow.camera.right = shadowPad;
        sunLight.shadow.camera.top = shadowPad;
        sunLight.shadow.camera.bottom = -shadowPad;
        sunLight.shadow.camera.near = maxDim * 0.01;
        sunLight.shadow.camera.far = maxDim * 8;
        sunLight.shadow.camera.updateProjectionMatrix();


        // ─── Adjust fog ───
        scene.fog = new THREE.FogExp2(0xb8cfe0, 0.4 / maxDim);

        // ─── Log hierarchy ───
        console.group('%c Mesh Hierarchy', 'color: #58a6ff; font-weight: bold;');
        logHierarchy(model, 0);
        console.groupEnd();

        // ─── Done ───
        // Apply initial zero opacity to ramp/office meshes
        [...rampMeshes, ...officeMeshes].forEach(mesh => {
            if (!mesh.material) return;
            const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
            mats.forEach(m => {
                m.transparent = true;
                m.opacity = 0;
                m.depthWrite = false;
                m.needsUpdate = true;
            });
        });

        // Show EXECUTIVE WHITEBOX on initial Home view
        sliderPanel.classList.remove('hidden');
        sliderTitle.textContent = 'EXECUTIVE WHITEBOX';
        visSlider.style.display = 'none';
        visValue.style.display = 'none';
        const sliderLabel = document.querySelector('#slider-panel label');
        if (sliderLabel) sliderLabel.style.display = 'none';

        hideLoader();
    },
    (progress) => {
        if (progress.total > 0) {
            const pct = Math.round((progress.loaded / progress.total) * 100);
            progressFill.style.width = pct + '%';
            progressText.textContent = pct + '%';
        }
    },
    (error) => {
        console.error('GLB load error:', error);
        progressText.textContent = 'Load failed — see console';
        progressFill.style.background = '#f85149';
    }
);

// ── View Navigation ────────────────────────────
const sliderState = { ramp: 0, office: 0 };  // track per-view slider position

function switchView(viewName) {
    // Save current slider state before switching
    if (activeView === 'ramp' || activeView === 'office') {
        sliderState[activeView] = parseInt(visSlider.value, 10);
    }

    if (activeView === viewName) return;
    activeView = viewName;

    viewBtns.forEach(btn => {
        btn.classList.toggle('active', btn.dataset.view === viewName);
    });

    const preset = viewPresets[viewName];
    if (preset?.pos && preset?.target) {
        animateCamera(preset.pos, preset.target, 1.2);
    }

    if (viewName === 'home') {
        sliderPanel.classList.remove('hidden');
        sliderTitle.textContent = 'EXECUTIVE WHITEBOX';
        visSlider.style.display = 'none';
        visValue.style.display = 'none';
        document.querySelector('#slider-panel label')?.style.setProperty('display', 'none');
    } else {
        sliderPanel.classList.remove('hidden');
        sliderTitle.textContent = `${viewName.charAt(0).toUpperCase() + viewName.slice(1)} Visibility`;
        visSlider.style.display = '';
        visValue.style.display = '';
        document.querySelector('#slider-panel label')?.style.setProperty('display', '');

        // Restore slider to saved state for this view
        const saved = sliderState[viewName] || 0;
        visSlider.value = saved;
        visValue.textContent = saved + '%';
        // Fire the slider handler to apply the saved opacity
        visSlider.dispatchEvent(new Event('input'));
    }
}

viewBtns.forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// ── Camera Animation ───────────────────────────
function animateCamera(toPos, toTarget, duration = 1.0) {
    cameraAnim = {
        fromPos: camera.position.clone(),
        toPos: toPos.clone(),
        fromTarget: controls.target.clone(),
        toTarget: toTarget.clone(),
        t: 0,
        duration,
    };
}

function updateCameraAnim(dt) {
    if (!cameraAnim) return;
    cameraAnim.t += dt / cameraAnim.duration;
    if (cameraAnim.t >= 1) cameraAnim.t = 1;
    const t = easeInOutCubic(cameraAnim.t);
    camera.position.lerpVectors(cameraAnim.fromPos, cameraAnim.toPos, t);
    controls.target.lerpVectors(cameraAnim.fromTarget, cameraAnim.toTarget, t);
    controls.update();
    if (cameraAnim.t >= 1) cameraAnim = null;
}

function easeInOutCubic(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

// ── Visibility Slider ──────────────────────────
function applyOpacity(meshes, opacity) {
    if (!meshes || meshes.length === 0) return;
    meshes.forEach(mesh => {
        if (!mesh.material) return;
        const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
        mats.forEach(m => {
            if (opacity < 1) {
                m.transparent = true;
                m.depthWrite = opacity > 0.5;
            } else {
                m.transparent = false;
                m.depthWrite = true;
            }
            m.opacity = opacity;
            m.needsUpdate = true;
        });
    });
}

visSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    visValue.textContent = val + '%';
    const opacity = val / 100;

    // Reveal group: fade in (0 → 1)
    let revealMeshes, hideMeshes;
    if (activeView === 'ramp') {
        revealMeshes = rampMeshes;
        hideMeshes = rampHideMeshes;
    } else if (activeView === 'office') {
        revealMeshes = officeMeshes;
        hideMeshes = officeHideMeshes;
    }

    applyOpacity(revealMeshes, opacity);
    // Hide group: fade out inversely (1 → 0)
    applyOpacity(hideMeshes, 1 - opacity);
});

// ── Hierarchy Logger ───────────────────────────
function logHierarchy(obj, depth) {
    const indent = '  '.repeat(depth);
    const type = obj.isMesh ? '🟩 Mesh' : obj.isGroup ? '📁 Group' : '⬜ Object3D';
    const name = obj.name || '(unnamed)';
    const childCount = obj.children.length;
    const extra = obj.isMesh
        ? ` | verts: ${obj.geometry?.attributes?.position?.count ?? '?'}`
        : '';
    console.log(`${indent}${type}  ${name}  [children: ${childCount}]${extra}`);
    for (const child of obj.children) {
        logHierarchy(child, depth + 1);
    }
}

// ── Loader UI ──────────────────────────────────
function hideLoader() {
    overlay.classList.add('hidden');
    viewNav.classList.add('visible');
}

// ── Dev Mode ───────────────────────────────────
const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let highlightedMesh = null;
let originalMaterial = null;
let lastClickedMeshName = null;

// Dev mesh groups (built interactively)
const devMeshGroups = {
    ramp: [...RAMP_MESH_NAMES],
    ramp_hide: [...RAMP_HIDE_MESH_NAMES],
    office: [...OFFICE_MESH_NAMES],
    office_hide: [...OFFICE_HIDE_MESH_NAMES],
};

function updateMeshListUI() {
    // Build clickable spans for each mesh name
    function buildList(container, group) {
        container.innerHTML = '';
        if (devMeshGroups[group].length === 0) {
            container.textContent = '—';
            return;
        }
        devMeshGroups[group].forEach((name, i) => {
            const span = document.createElement('span');
            span.textContent = name;
            span.style.cursor = 'pointer';
            span.style.borderBottom = '1px dashed rgba(255,255,255,0.3)';
            span.title = 'Click to remove';
            span.addEventListener('click', () => {
                devMeshGroups[group].splice(i, 1);
                updateMeshListUI();
                console.log(`%c 🗑 Removed "${name}" from ${group}`, 'color: #f85149;');
            });
            container.appendChild(span);
            if (i < devMeshGroups[group].length - 1) {
                container.appendChild(document.createTextNode(', '));
            }
        });
    }
    buildList(devRampList, 'ramp');
    buildList(document.getElementById('dev-ramp-hide-list'), 'ramp_hide');
    buildList(devOfficeList, 'office');
    buildList(document.getElementById('dev-office-hide-list'), 'office_hide');
}
updateMeshListUI();

// Toggle button
devToggleBtn.addEventListener('click', () => {
    devMode = !devMode;
    devToggleBtn.classList.toggle('active', devMode);
    devPanel.classList.toggle('hidden', !devMode);

    if (!devMode && highlightedMesh && originalMaterial) {
        highlightedMesh.material = originalMaterial;
        highlightedMesh = null;
        originalMaterial = null;
    }
    console.log(`%c 🔧 Dev mode: ${devMode ? 'ON' : 'OFF'}`, `color: ${devMode ? '#3fb950' : '#f85149'}; font-weight: bold;`);
});

// Mesh assignment buttons — with auto-dedup between show/hide counterparts
const COUNTERPART = { ramp: 'ramp_hide', ramp_hide: 'ramp', office: 'office_hide', office_hide: 'office' };

document.querySelectorAll('.dev-mesh-btn:not(.dev-cam-btn)').forEach(btn => {
    btn.addEventListener('click', () => {
        const group = btn.dataset.group;
        if (!lastClickedMeshName) {
            devMeshInfo.textContent = '⚠ Click a mesh first!';
            return;
        }
        if (!devMeshGroups[group].includes(lastClickedMeshName)) {
            devMeshGroups[group].push(lastClickedMeshName);

            // Auto-remove from counterpart group
            const counter = COUNTERPART[group];
            if (counter && devMeshGroups[counter]) {
                const idx = devMeshGroups[counter].indexOf(lastClickedMeshName);
                if (idx !== -1) {
                    devMeshGroups[counter].splice(idx, 1);
                    console.log(`%c ↔ Auto-removed "${lastClickedMeshName}" from ${counter}`, 'color: #f0883e;');
                }
            }

            updateMeshListUI();
            console.log(`%c ✅ "${lastClickedMeshName}" added to ${group}`, 'color: #3fb950;');
        } else {
            console.log(`%c ⚠ "${lastClickedMeshName}" already in ${group}`, 'color: #d29922;');
        }
    });
});

// ── Lighting Controls ──────────────────────────
devSunSlider.addEventListener('input', () => {
    const v = parseInt(devSunSlider.value, 10) / 100;
    sunLight.intensity = v;
    devSunVal.textContent = v.toFixed(1);
});

devAmbientSlider.addEventListener('input', () => {
    const v = parseInt(devAmbientSlider.value, 10) / 100;
    ambientLight.intensity = v;
    devAmbientVal.textContent = v.toFixed(2);
});

devExposureSlider.addEventListener('input', () => {
    const v = parseInt(devExposureSlider.value, 10) / 100;
    renderer.toneMappingExposure = v;
    devExposureVal.textContent = v.toFixed(1);
});

devEnvSlider.addEventListener('input', () => {
    const v = parseInt(devEnvSlider.value, 10) / 100;
    scene.environmentIntensity = v;
    devEnvVal.textContent = v.toFixed(1);
});

// ── Camera Preset Capture ──────────────────────
document.querySelectorAll('.dev-cam-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        viewPresets[preset] = {
            pos: camera.position.clone(),
            target: controls.target.clone(),
        };
        btn.textContent = `✓ ${preset.charAt(0).toUpperCase() + preset.slice(1)}`;
        setTimeout(() => {
            btn.textContent = `Set ${preset.charAt(0).toUpperCase() + preset.slice(1)}`;
        }, 2000);
        console.log(`%c 📷 ${preset} preset captured`, 'color: #3fb950; font-weight: bold;',
            `pos: ${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)}`,
            `target: ${controls.target.x.toFixed(1)}, ${controls.target.y.toFixed(1)}, ${controls.target.z.toFixed(1)}`);
    });
});

// ── Save Environment to main.js ──
devSaveBtn.addEventListener('click', async () => {
    devSaveStatus.textContent = '⏳ Saving…';
    try {
        // Build per-view camera presets
        const cameraPresets = {};
        for (const view of ['home', 'ramp', 'office']) {
            if (viewPresets[view]?.pos && viewPresets[view]?.target) {
                cameraPresets[view] = {
                    posX: parseFloat(viewPresets[view].pos.x.toFixed(2)),
                    posY: parseFloat(viewPresets[view].pos.y.toFixed(2)),
                    posZ: parseFloat(viewPresets[view].pos.z.toFixed(2)),
                    targetX: parseFloat(viewPresets[view].target.x.toFixed(2)),
                    targetY: parseFloat(viewPresets[view].target.y.toFixed(2)),
                    targetZ: parseFloat(viewPresets[view].target.z.toFixed(2)),
                };
            }
        }

        const config = {
            cameraPresets,
            meshGroups: {
                ramp: devMeshGroups.ramp,
                ramp_hide: devMeshGroups.ramp_hide,
                office: devMeshGroups.office,
                office_hide: devMeshGroups.office_hide,
            },
            lighting: {
                sunIntensity: sunLight.intensity,
                ambientIntensity: ambientLight.intensity,
                exposure: renderer.toneMappingExposure,
                envIntensity: scene.environmentIntensity,
            },
        };
        const res = await fetch('/__dev/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config),
        });
        const result = await res.json();
        if (result.ok) {
            devSaveStatus.textContent = '✅ Environment saved to main.js';
        } else {
            devSaveStatus.textContent = '❌ ' + (result.error || 'Unknown error');
        }
    } catch (err) {
        devSaveStatus.textContent = '❌ ' + err.message;
    }
    setTimeout(() => { devSaveStatus.textContent = ''; }, 4000);
});

// ── Raycaster (dev mode only) ──────────────────
function getParentPath(obj) {
    const parts = [];
    let cur = obj;
    while (cur && cur !== scene) {
        parts.unshift(cur.name || '(unnamed)');
        cur = cur.parent;
    }
    return parts.join(' › ');
}

renderer.domElement.addEventListener('click', (e) => {
    if (!devMode || !loadedModel) return;

    pointer.x = (e.clientX / window.innerWidth) * 2 - 1;
    pointer.y = -(e.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(pointer, camera);
    const hits = raycaster.intersectObject(loadedModel, true);

    if (highlightedMesh && originalMaterial) {
        highlightedMesh.material = originalMaterial;
        highlightedMesh = null;
        originalMaterial = null;
    }

    if (hits.length > 0) {
        const mesh = hits[0].object;
        const name = mesh.name || '(unnamed)';
        const verts = mesh.geometry?.attributes?.position?.count ?? '?';
        const path = getParentPath(mesh);

        originalMaterial = mesh.material;
        highlightedMesh = mesh;
        const hlMat = originalMaterial.clone();
        hlMat.emissive = new THREE.Color(0x00ffff);
        hlMat.emissiveIntensity = 0.3;
        mesh.material = hlMat;

        lastClickedMeshName = name;
        devMeshInfo.textContent = `${name} | ${verts}v | ${path}`;

        console.log('%c 📍 Clicked:', 'color: #00ffff; font-weight: bold;', name, `(${verts}v)`, path);
    }
});

// ── Resize ─────────────────────────────────────
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ── Render Loop ────────────────────────────────
const clock = new THREE.Clock();

function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();
    updateCameraAnim(dt);
    controls.update();

    if (modelBounds) {
        const dist = camera.position.distanceTo(controls.target);
        const newNear = Math.max(dist * 0.01, modelBounds.maxDim * 0.001);
        const newFar = Math.max(dist * 20, modelBounds.maxDim * 10);
        if (Math.abs(camera.near - newNear) / camera.near > 0.05 ||
            Math.abs(camera.far - newFar) / camera.far > 0.05) {
            camera.near = newNear;
            camera.far = newFar;
            camera.updateProjectionMatrix();
        }

        // Camera collision removed — was preventing straight-on views of the office
    }


    // Update dev camera readout (throttled)
    if (devMode && devCamReadout) {
        const p = camera.position;
        const t = controls.target;
        const dist = p.distanceTo(t);
        devCamReadout.innerHTML =
            `pos: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}<br>` +
            `target: ${t.x.toFixed(1)}, ${t.y.toFixed(1)}, ${t.z.toFixed(1)}<br>` +
            `dist: ${dist.toFixed(1)} | fov: ${camera.fov}`;
    }

    renderer.render(scene, camera);
}

animate();
