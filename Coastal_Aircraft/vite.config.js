import { defineConfig } from 'vite';
import fs from 'fs';
import path from 'path';

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
              if (config.meshGroups.office) {
                const officeStr = `const OFFICE_MESH_NAMES = ${JSON.stringify(config.meshGroups.office)};`;
                src = src.replace(/const OFFICE_MESH_NAMES\s*=\s*\[.*?\];/, officeStr);
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

export default defineConfig({
  plugins: [devSavePlugin()],
  server: {
    port: 5173,
    open: true
  },
  assetsInclude: ['**/*.glb']
});
