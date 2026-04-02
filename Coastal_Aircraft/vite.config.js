import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PARENT_DIR = path.resolve(__dirname, '..');
const GLB_FILE = path.join(PARENT_DIR, 'COASTAL_AIRCRAFT.glb');

// Dev-only plugin: exposes /__dev/save endpoint to write environmental config to main.js
function devSavePlugin() {
  return {
    name: 'dev-save-config',
    configureServer(server) {
      server.middlewares.use('/__dev/save', (req, res) => {
        if (req.method !== 'POST') {
          res.statusCode = 405;
          res.end('Method not allowed');
          return;
        }

        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
          try {
            const config = JSON.parse(body);
            const mainPath = path.resolve(__dirname, 'src/main.js');
            let src = fs.readFileSync(mainPath, 'utf-8');

            // ── Mesh groups ──
            if (config.meshGroups) {
              if (config.meshGroups.ramp) {
                const rampStr = `const RAMP_MESH_NAMES = ${JSON.stringify(config.meshGroups.ramp)};`;
                src = src.replace(/const RAMP_MESH_NAMES\s*=\s*\[.*?\];/, rampStr);
              }
              if (config.meshGroups.ramp_hide) {
                const rampHideStr = `const RAMP_HIDE_MESH_NAMES = ${JSON.stringify(config.meshGroups.ramp_hide)};`;
                src = src.replace(/const RAMP_HIDE_MESH_NAMES\s*=\s*\[.*?\];/, rampHideStr);
              }
              if (config.meshGroups.office) {
                const officeStr = `const OFFICE_MESH_NAMES = ${JSON.stringify(config.meshGroups.office)};`;
                src = src.replace(/const OFFICE_MESH_NAMES\s*=\s*\[.*?\];/, officeStr);
              }
              if (config.meshGroups.office_hide) {
                const officeHideStr = `const OFFICE_HIDE_MESH_NAMES = ${JSON.stringify(config.meshGroups.office_hide)};`;
                src = src.replace(/const OFFICE_HIDE_MESH_NAMES\s*=\s*\[.*?\];/, officeHideStr);
              }
            }

            // ── Camera presets ──
            if (config.cameraPresets) {
              // Build the new CAMERA_PRESETS object literal
              const entries = [];
              for (const [view, data] of Object.entries(config.cameraPresets)) {
                if (data) {
                  entries.push(`${view}: { posX: ${data.posX}, posY: ${data.posY}, posZ: ${data.posZ}, targetX: ${data.targetX}, targetY: ${data.targetY}, targetZ: ${data.targetZ} }`);
                } else {
                  entries.push(`${view}: null`);
                }
              }
              // Ensure all three views exist in the output
              for (const view of ['home', 'ramp', 'office']) {
                if (!config.cameraPresets[view]) {
                  entries.push(`${view}: null`);
                }
              }
              const presetsStr = `const CAMERA_PRESETS = { ${entries.join(', ')} };`;
              src = src.replace(
                /const CAMERA_PRESETS\s*=\s*\{[^}]*(?:\{[^}]*\}[^}]*)*\};/,
                presetsStr
              );
            }

            // ── Lighting ──
            if (config.lighting) {
              const { sunIntensity, ambientIntensity, exposure, envIntensity } = config.lighting;

              if (sunIntensity !== undefined) {
                src = src.replace(
                  /const sunLight\s*=\s*new THREE\.DirectionalLight\(0xfff4e6,\s*[\d.]+\)/,
                  `const sunLight = new THREE.DirectionalLight(0xfff4e6, ${sunIntensity})`
                );
              }

              if (ambientIntensity !== undefined) {
                src = src.replace(
                  /const ambientLight\s*=\s*new THREE\.AmbientLight\(0xffffff,\s*[\d.]+\)/,
                  `const ambientLight = new THREE.AmbientLight(0xffffff, ${ambientIntensity})`
                );
              }

              if (exposure !== undefined) {
                src = src.replace(
                  /renderer\.toneMappingExposure\s*=\s*[\d.]+;/,
                  `renderer.toneMappingExposure = ${exposure};`
                );
              }

              if (envIntensity !== undefined) {
                src = src.replace(
                  /scene\.environmentIntensity\s*=\s*[\d.]+;/,
                  `scene.environmentIntensity = ${envIntensity};`
                );
              }
            }

            fs.writeFileSync(mainPath, src, 'utf-8');
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ ok: true }));
          } catch (err) {
            res.statusCode = 500;
            res.end(JSON.stringify({ error: err.message }));
          }
        });
      });
    }
  };
}

// Serve the parent directory's GLB as /model.glb
function serveParentGlbPlugin() {
  return {
    name: 'serve-parent-glb',
    configureServer(server) {
      server.middlewares.use('/model.glb', (req, res) => {
        if (!fs.existsSync(GLB_FILE)) {
          res.statusCode = 404;
          res.end('GLB not found at ' + GLB_FILE);
          return;
        }
        const stat = fs.statSync(GLB_FILE);
        res.setHeader('Content-Type', 'model/gltf-binary');
        res.setHeader('Content-Length', stat.size);
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        fs.createReadStream(GLB_FILE).pipe(res);
      });
    }
  };
}

export default defineConfig({
  plugins: [devSavePlugin(), serveParentGlbPlugin()],
  server: {
    port: 5173,
    open: true,
    fs: {
      allow: ['.', PARENT_DIR]
    }
  },
  assetsInclude: ['**/*.glb']
});
