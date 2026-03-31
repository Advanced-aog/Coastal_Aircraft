import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

// ── DOM refs ───────────────────────────────────
const container = document.getElementById('dt-canvas-container');
const overlay = document.getElementById('dt-loading-overlay');
const progressFill = document.getElementById('dt-progress-fill');
const progressText = document.getElementById('dt-progress-text');
const viewNav = document.getElementById('dt-view-nav');
const sliderPanel = document.getElementById('dt-slider-panel');
const sliderTitle = document.getElementById('dt-slider-title');
const visSlider = document.getElementById('dt-vis-slider');
const visValue = document.getElementById('dt-vis-value');
const viewBtns = document.querySelectorAll('.dt-view-btn');

// Dev panel refs
const devToggleBtn = document.getElementById('dt-dev-toggle');
const devPanel = document.getElementById('dt-dev-panel');
const devMeshInfo = document.getElementById('dt-dev-mesh-info');
const devRampList = document.getElementById('dt-dev-ramp-list');
const devOfficeList = document.getElementById('dt-dev-office-list');
const devCamReadout = document.getElementById('dt-dev-cam-readout');
const devSaveBtn = document.getElementById('dt-dev-save');
const devSaveStatus = document.getElementById('dt-dev-save-status');

// Lighting sliders
const devSunSlider = document.getElementById('dt-dev-sun');
const devSunVal = document.getElementById('dt-dev-sun-val');
const devAmbientSlider = document.getElementById('dt-dev-ambient');
const devAmbientVal = document.getElementById('dt-dev-ambient-val');
const devExposureSlider = document.getElementById('dt-dev-exposure');
const devExposureVal = document.getElementById('dt-dev-exposure-val');
const devEnvSlider = document.getElementById('dt-dev-env');
const devEnvVal = document.getElementById('dt-dev-env-val');

// ── Scene wrapper — size source ────────────────
const sceneWrapper = document.querySelector('#digital-twin .scene-wrapper');

function getSize() {
    return {
        width: sceneWrapper.clientWidth,
        height: sceneWrapper.clientHeight,
    };
}

// ── Renderer ───────────────────────────────────
const { width, height } = getSize();
const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance', logarithmicDepthBuffer: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(width, height);
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
container.appendChild(renderer.domElement);

// ── Scene ──────────────────────────────────────
const scene = new THREE.Scene();

// ── Camera ─────────────────────────────────────
const camera = new THREE.PerspectiveCamera(45, width / height, 0.01, 100000);
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

// ── Model & View State ─────────────────────────
let modelBounds = null;
let loadedModel = null;

// Mesh groups — collected by name
const RAMP_MESH_NAMES = ["116085141385031493-16576562079993407252"];
const OFFICE_MESH_NAMES = ["116085089070041702-16989818055633425587", "116085072875867878-1032015644915566309", "116085089070023619-11673872678765672587", "116085072875860585-7673256250713537767", "116085089070052025-17472574139146979990", "116085072875857019-17358957360041866585", "116084984594841889-87845502843927015", "116085081904916745-7434977356608506591", "116085112647856643-9169618984772075193", "116085106399958501-5915972508105602661", "116085085142065417-17134025166688201527"];

// Saved camera presets (written by dev panel — null = use auto-computed)
const CAMERA_PRESETS = { home: null, ramp: null, office: null };

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

// Use GitHub LFS media URL on GitHub Pages (LFS pointer files aren't served as binaries,
// and Release asset URLs lack CORS headers — media.githubusercontent.com serves with CORS)
const isGitHubPages = location.hostname.endsWith('.github.io');
const MODEL_PATH = isGitHubPages
    ? 'https://media.githubusercontent.com/media/Advanced-aog/Coastal_Aircraft/main/COASTAL_AIRCRAFT.glb'
    : 'COASTAL_AIRCRAFT.glb';

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

        // ─── Centre & position ───
        const box = new THREE.Box3().setFromObject(model);
        const center = box.getCenter(new THREE.Vector3());
        const size = box.getSize(new THREE.Vector3());
        const maxDim = Math.max(size.x, size.y, size.z);

        // ─── Collect meshes by name or geometry for ramp/office groups ───
        model.traverse((child) => {
            if (child.isMesh) {
                let isRamp = RAMP_MESH_NAMES.includes(child.name);
                let isOffice = OFFICE_MESH_NAMES.includes(child.name);

                // Auto-fallback mapping for unlabelled models (e.g. s.XXXX parts)
                if (!isRamp && !isOffice && child.name.startsWith('s.')) {
                    const cBox = new THREE.Box3().setFromObject(child);
                    const cCenter = cBox.getCenter(new THREE.Vector3());
                    const cSize = cBox.getSize(new THREE.Vector3());
                    
                    // Exclude massive structural items (floor, main skin) so they don't fade out
                    if (cSize.x < size.x * 0.9 && cSize.y < size.y * 0.9 && cSize.z < size.z * 0.9) {
                        if (cCenter.x < center.x - size.x * 0.05) isOffice = true;
                        else if (cCenter.x > center.x + size.x * 0.05) isRamp = true;
                    }
                }

                if (isRamp) {
                    child.material = child.material.clone();
                    rampMeshes.push(child);
                }
                if (isOffice) {
                    child.material = child.material.clone();
                    officeMeshes.push(child);
                }
            }
        });

        console.log('%c Ramp meshes dynamically assigned:', 'color: #58a6ff; font-weight: bold;', rampMeshes.length);
        console.log('%c Office meshes dynamically assigned:', 'color: #58a6ff; font-weight: bold;', officeMeshes.length);

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

        // ─── Add dynamic fallbacks if no meshes or presets were found ───
        if (!viewPresets.ramp.pos) {
            viewPresets.ramp = {
                target: new THREE.Vector3(center.x + size.x * 0.25, center.y, center.z + size.z * 0.25),
                pos: new THREE.Vector3(center.x + fitDistance * 0.3, center.y + fitDistance * 0.15, center.z + fitDistance * 0.3)
            };
        }
        if (!viewPresets.office.pos) {
            viewPresets.office = {
                target: new THREE.Vector3(center.x - size.x * 0.25, center.y, center.z - size.z * 0.25),
                pos: new THREE.Vector3(center.x - fitDistance * 0.3, center.y + fitDistance * 0.15, center.z - fitDistance * 0.1)
            };
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

        // ─── Apply initial zero opacity to ramp/office meshes ───
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
        sliderPanel.classList.remove('dt-hidden');
        sliderTitle.textContent = 'EXECUTIVE WHITEBOX';
        visSlider.style.display = 'none';
        visValue.style.display = 'none';
        const sliderLabel = document.querySelector('#dt-slider-panel label');
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
        sliderPanel.classList.remove('dt-hidden');
        sliderTitle.textContent = 'EXECUTIVE WHITEBOX';
        visSlider.style.display = 'none';
        visValue.style.display = 'none';
        document.querySelector('#dt-slider-panel label')?.style.setProperty('display', 'none');
    } else {
        sliderPanel.classList.remove('dt-hidden');
        sliderTitle.textContent = `${viewName.charAt(0).toUpperCase() + viewName.slice(1)} Visibility`;
        visSlider.style.display = '';
        visValue.style.display = '';
        document.querySelector('#dt-slider-panel label')?.style.setProperty('display', '');
    }
    visSlider.value = 0;
    visValue.textContent = '0%';
}

viewBtns.forEach(btn => {
    btn.addEventListener('click', () => switchView(btn.dataset.view));
});

// Expose for inline onclick (backward compat)
window.setCameraView = switchView;

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

// ── Loader UI ──────────────────────────────────
function hideLoader() {
    overlay.classList.add('dt-hidden');
    viewNav.classList.add('dt-visible');
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
    devPanel.classList.toggle('dt-hidden', !devMode);

    if (!devMode && highlightedMesh && originalMaterial) {
        highlightedMesh.material = originalMaterial;
        highlightedMesh = null;
        originalMaterial = null;
    }
    console.log(`%c 🔧 Dev mode: ${devMode ? 'ON' : 'OFF'}`, `color: ${devMode ? '#3fb950' : '#f85149'}; font-weight: bold;`);
});

// Mesh assignment buttons
document.querySelectorAll('.dt-dev-mesh-btn:not(.dt-dev-cam-btn)').forEach(btn => {
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
document.querySelectorAll('.dt-dev-cam-btn').forEach(btn => {
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

// ── Save Config (POST to dev server → writes to scene.js) ──
devSaveBtn.addEventListener('click', async () => {
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

    const json = JSON.stringify(config, null, 2);
    console.log('%c 💾 Saving config…', 'color: #58a6ff; font-weight: bold;', json);

    try {
        const res = await fetch('/__dev/save', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: json,
        });
        const result = await res.json();
        if (result.ok) {
            devSaveStatus.textContent = '✅ Saved to scene.js — refresh to apply';
            console.log('%c ✅ Config written to scene.js', 'color: #3fb950; font-weight: bold;');
        } else {
            throw new Error(result.error || 'Unknown error');
        }
    } catch (err) {
        // Fallback: copy to clipboard if server is unavailable (e.g. GitHub Pages)
        console.warn('Save endpoint unavailable, copying to clipboard instead:', err.message);
        try {
            await navigator.clipboard.writeText(json);
            devSaveStatus.textContent = '📋 Copied to clipboard (no dev server)';
        } catch (e2) {
            const ta = document.createElement('textarea');
            ta.value = json;
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            devSaveStatus.textContent = '📋 Copied to clipboard (fallback)';
        }
    }
    setTimeout(() => { devSaveStatus.textContent = ''; }, 5000);
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

    const rect = renderer.domElement.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

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
    const { width, height } = getSize();
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height);
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
                    camera.position.copy(controls.target).addScaledVector(camDir, hitDist - minClearance);
                }
            }
        }
    }

    // Update dev camera readout (every frame when dev mode on)
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
