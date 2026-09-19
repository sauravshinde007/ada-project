/**
 * FBX + VRM Diagnostic Script (CommonJS)
 * Runs under Node.js using three.js and @pixiv/three-vrm
 * 
 * Inspects:
 * 1. FBX bone hierarchy and rest transforms for J_Bip_C_Hips and key bones
 * 2. FBX animation tracks: names, property types, first keyframe quaternion values
 * 3. FBX global coordinate info (if available)
 */

// We need to use jsdom to create a fake DOM for three.js
const { JSDOM } = require('jsdom');
const dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.XMLHttpRequest = dom.window.XMLHttpRequest;

// Polyfill fetch for the file loader
global.fetch = async (url) => {
  const fs = require('fs');
  const path = require('path');
  // Convert URL to local path
  const filePath = path.resolve(__dirname, url.replace(/^\//, ''));
  const data = fs.readFileSync(filePath);
  return {
    ok: true,
    arrayBuffer: async () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength),
    text: async () => data.toString(),
    json: async () => JSON.parse(data.toString()),
  };
};

const path = require('path');
const fs = require('fs');

// Set up paths
const THREE_PATH = path.resolve(__dirname, '../node_modules/three');
const FBX_FILE = path.resolve(__dirname, '../public/ada_default_anim/Standing_Idle.fbx');
const VRM_FILE = path.resolve(__dirname, '../public/models/ada-vrm-1.0.vrm');

async function main() {
  console.log('=== FBX/VRM Diagnostic ===\n');
  
  // Import THREE dynamically (ESM in CJS context)
  let THREE, FBXLoader, GLTFLoader, VRMLoaderPlugin;
  
  try {
    // three.js is ESM, but we can import it
    const threeModule = await import(path.join(THREE_PATH, 'build/three.module.js'));
    THREE = threeModule;
    console.log('THREE version:', THREE.REVISION);
  } catch(e) {
    console.error('Cannot import THREE:', e.message);
    process.exit(1);
  }

  // Load FBX file as binary
  const fbxData = fs.readFileSync(FBX_FILE);
  console.log(`FBX file size: ${(fbxData.length / 1024 / 1024).toFixed(2)} MB`);
  
  // Try to parse the FBX binary header to get coordinate system info
  // FBX binary starts with "Kaydara FBX Binary  \x00\x1a\x00"
  const header = fbxData.slice(0, 27).toString('ascii');
  const isBinary = header.startsWith('Kaydara FBX Binary');
  console.log(`FBX format: ${isBinary ? 'Binary' : 'ASCII'}`);
  
  // Search for coordinate system metadata in binary FBX
  // Look for "CoordAxis", "UpAxis", "FrontAxis" strings
  const fbxStr = fbxData.toString('latin1');
  
  const searchStrings = ['CoordAxis', 'UpAxis', 'UpAxisSign', 'FrontAxis', 'FrontAxisSign', 
                          'CoordAxisSign', 'OriginalUpAxis', 'UnitScaleFactor', 'OriginalUnitScaleFactor'];
  
  console.log('\n--- FBX Global Settings (raw search) ---');
  for (const s of searchStrings) {
    const idx = fbxStr.indexOf(s);
    if (idx !== -1) {
      // Read a few bytes after the string
      const nearby = fbxData.slice(idx, idx + s.length + 20);
      // Try to find integer values (4-byte little-endian int32 at various offsets)
      const vals = [];
      for (let offset = s.length; offset < nearby.length - 3; offset++) {
        const v = nearby.readInt32LE(offset);
        if (v >= -10 && v <= 10) vals.push(`@${offset}=${v}`);
      }
      console.log(`  ${s}: found at offset ${idx}, nearby ints: ${vals.join(', ')}`);
    } else {
      console.log(`  ${s}: NOT FOUND`);
    }
  }
  
  console.log('\n=== Done with raw FBX inspection ===');
  console.log('Now loading with Three.js FBXLoader...\n');
}

main().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});

