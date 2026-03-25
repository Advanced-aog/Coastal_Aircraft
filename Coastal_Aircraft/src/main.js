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
renderer.toneMappingExposure = 0.2;
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
controls.maxPolarAngle = Math.PI / 2.05;
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

const sunLight = new THREE.DirectionalLight(0xfff4e6, 0.3);
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

const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
scene.add(ambientLight);

// (Ground comes from the GLB model)

// ── Model & View State ─────────────────────────
let modelBounds = null;
let loadedModel = null;

// Mesh groups — collected by name
const RAMP_MESH_NAMES = ["116085141385031493-16576562079993407252"];
const OFFICE_MESH_NAMES = [];

// Saved camera presets (written by dev panel save — null = use auto-computed)
const CAMERA_PRESETS = { home: { posX: 0.2, posY: 0.1, posZ: 0.2, targetX: 0, targetY: 0.01, targetZ: 0 }, ramp: null, office: null };

// Collected mesh references (populated during model load)
let rampMeshes = [];
let officeMeshes = [];

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
                if (OFFICE_MESH_NAMES.includes(child.name)) {
                    child.material = child.material.clone();
                    officeMeshes.push(child);
                }
            }
        });


        console.log('%c Ramp meshes found:', 'color: #58a6ff; font-weight: bold;',
            rampMeshes.length, '/', RAMP_MESH_NAMES.length, rampMeshes.map(m => m.name));
        console.log('%c Office meshes found:', 'color: #58a6ff; font-weight: bold;',
            officeMeshes.length, '/', OFFICE_MESH_NAMES.length, officeMeshes.map(m => m.name));

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
function switchView(viewName) {
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
    }
    visSlider.value = 0;
    visValue.textContent = '0%';
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
visSlider.addEventListener('input', (e) => {
    const val = parseInt(e.target.value, 10);
    visValue.textContent = val + '%';
    const opacity = val / 100;

    let meshes;
    if (activeView === 'ramp') meshes = rampMeshes;
    else if (activeView === 'office') meshes = officeMeshes;
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
    office: [...OFFICE_MESH_NAMES],
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
    buildList(devOfficeList, 'office');
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

// Mesh assignment buttons
document.querySelectorAll('.dev-mesh-btn:not(.dev-cam-btn)').forEach(btn => {
    btn.addEventListener('click', () => {
        const group = btn.dataset.group;
        if (!lastClickedMeshName) {
            devMeshInfo.textContent = '⚠ Click a mesh first!';
            return;
        }
        if (!devMeshGroups[group].includes(lastClickedMeshName)) {
            devMeshGroups[group].push(lastClickedMeshName);
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

// ── Save Environment to main.js (password-gated) ──
const DEV_PASSWORD = 'joshmillard';

devSaveBtn.addEventListener('click', async () => {
    const pw = prompt('Enter dev password:');
    if (pw !== DEV_PASSWORD) {
        devSaveStatus.textContent = '❌ Wrong password';
        setTimeout(() => { devSaveStatus.textContent = ''; }, 3000);
        return;
    }

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
                office: devMeshGroups.office,
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

        // Camera collision — prevent pushing through meshes
        if (loadedModel) {
            const camDir = new THREE.Vector3().subVectors(camera.position, controls.target).normalize();
            const collisionRay = new THREE.Raycaster(controls.target, camDir, 0, dist);
            const hits = collisionRay.intersectObject(loadedModel, true);
            if (hits.length > 0) {
                const hitDist = hits[0].distance;
                const minClearance = 0.5;
                if (hitDist < dist - minClearance) {
                    // Push camera in front of the hit point
                    camera.position.copy(controls.target).addScaledVector(camDir, hitDist - minClearance);
                }
            }
        }
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
