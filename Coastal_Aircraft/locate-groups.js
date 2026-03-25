/**
 * GLB Mesh Group Locator — clean ASCII output
 * Writes results to locate-results.json for easy reading
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const GLB_PATH = resolve(import.meta.dirname, '2026-02-17_Untitled_03-14-09_1.glb');
const SEARCHES = ['ramp', 'office', 'vis'];

// Parse GLB
const buffer = readFileSync(GLB_PATH);
let offset = 12;
const jsonChunkLength = buffer.readUInt32LE(offset);
const jsonStr = buffer.toString('utf8', offset + 8, offset + 8 + jsonChunkLength);
const gltf = JSON.parse(jsonStr);
const nodes = gltf.nodes || [];

// Build parent map
const parentMap = {};
for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].children) {
        for (const c of nodes[i].children) {
            parentMap[c] = i;
        }
    }
}

function getPath(idx) {
    const parts = [];
    let cur = idx;
    while (cur !== undefined) {
        parts.unshift(nodes[cur]?.name || `node_${cur}`);
        cur = parentMap[cur];
    }
    return parts.join(' > ');
}

function getChildren(idx) {
    const node = nodes[idx];
    if (!node?.children) return [];
    return node.children.map(c => ({
        index: c,
        name: nodes[c]?.name || '(unnamed)',
        hasMesh: nodes[c]?.mesh !== undefined,
        childCount: nodes[c]?.children?.length || 0
    }));
}

// Search
const matches = [];
for (let i = 0; i < nodes.length; i++) {
    const name = (nodes[i]?.name || '').toLowerCase();
    for (const term of SEARCHES) {
        if (name.includes(term.toLowerCase())) {
            matches.push({
                index: i,
                name: nodes[i].name,
                path: getPath(i),
                hasMesh: nodes[i].mesh !== undefined,
                childCount: nodes[i].children?.length || 0,
                children: getChildren(i)
            });
            break;
        }
    }
}

// Also gather all unique names for reference
const allNames = [...new Set(nodes.filter(n => n?.name).map(n => n.name))].sort();

const result = {
    file: GLB_PATH,
    totalNodes: nodes.length,
    totalMeshes: gltf.meshes?.length || 0,
    searchTerms: SEARCHES,
    matchCount: matches.length,
    matches,
    allUniqueNames: allNames
};

writeFileSync('locate-results.json', JSON.stringify(result, null, 2), 'utf8');
process.stdout.write(`Done. Found ${matches.length} matches across ${nodes.length} nodes. Results in locate-results.json\n`);
