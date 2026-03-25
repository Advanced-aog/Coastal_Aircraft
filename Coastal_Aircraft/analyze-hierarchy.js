/**
 * Deep hierarchy analysis — shows the full tree structure from root
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const GLB_PATH = resolve(import.meta.dirname, '2026-02-17_Untitled_03-14-09_1.glb');
const buffer = readFileSync(GLB_PATH);
let offset = 12;
const jsonChunkLength = buffer.readUInt32LE(offset);
const jsonStr = buffer.toString('utf8', offset + 8, offset + 8 + jsonChunkLength);
const gltf = JSON.parse(jsonStr);
const nodes = gltf.nodes || [];

// Build full tree from root scene
const scene = gltf.scenes[gltf.scene || 0];
const rootNodes = scene.nodes || [];

const lines = [];
lines.push(`Total nodes: ${nodes.length}`);
lines.push(`Total meshes: ${gltf.meshes?.length || 0}`);
lines.push(`Root scene nodes: ${rootNodes.join(', ')}`);
lines.push('');

function printTree(idx, depth, maxChildDetail = 5) {
    const node = nodes[idx];
    const name = node?.name || `(unnamed_${idx})`;
    const indent = '  '.repeat(depth);
    const hasMesh = node?.mesh !== undefined;
    const childCount = node?.children?.length || 0;
    const type = hasMesh ? '[MESH]' : '[GROUP]';

    lines.push(`${indent}${type} #${idx} "${name}" children:${childCount}`);

    if (node?.children) {
        // If many children, show first/last few
        if (childCount > maxChildDetail * 2 && depth > 1) {
            for (let i = 0; i < maxChildDetail; i++) {
                printTree(node.children[i], depth + 1, maxChildDetail);
            }
            lines.push(`${indent}  ... (${childCount - maxChildDetail * 2} more) ...`);
            for (let i = childCount - maxChildDetail; i < childCount; i++) {
                printTree(node.children[i], depth + 1, maxChildDetail);
            }
        } else {
            for (const c of node.children) {
                printTree(c, depth + 1, maxChildDetail);
            }
        }
    }
}

lines.push('=== FULL HIERARCHY (from root) ===');
lines.push('');
for (const rootIdx of rootNodes) {
    printTree(rootIdx, 0, 10);
}

writeFileSync('hierarchy-deep.txt', lines.join('\n'), 'utf8');
process.stdout.write(`Done. ${lines.length} lines written to hierarchy-deep.txt\n`);
