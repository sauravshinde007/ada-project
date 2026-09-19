#!/usr/bin/env node
/**
 * Parse FBX connections to find which bones have animation tracks
 * and determine the exact track quaternion for the first frame of Hips
 */

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const FBX_FILE = path.resolve(__dirname, '../public/ada_default_anim/Standing_Idle.fbx');
const buf = fs.readFileSync(FBX_FILE);
const version = buf.readUInt32LE(23);
const use64 = version >= 7500;
const FIELD_SIZE = use64 ? 8 : 4;
const RECORD_HEADER = FIELD_SIZE * 3 + 1;

function readUint(buf, offset) { return buf.readUInt32LE(offset); }

function parseNodes(buf, startOffset, endOffset) {
  const nodes = [];
  let offset = startOffset;
  while (offset < endOffset) {
    const nodeEndOffset = readUint(buf, offset);
    if (nodeEndOffset === 0) { offset += RECORD_HEADER; break; }
    const numProperties = readUint(buf, offset + FIELD_SIZE);
    const nameLen = buf.readUInt8(offset + FIELD_SIZE * 3);
    const name = buf.slice(offset + RECORD_HEADER, offset + RECORD_HEADER + nameLen).toString('utf8');
    let propOffset = offset + RECORD_HEADER + nameLen;
    const props = [];
    const arrayDatas = [];
    
    for (let i = 0; i < numProperties; i++) {
      if (propOffset >= buf.length) break;
      const tc = String.fromCharCode(buf[propOffset]); propOffset++;
      switch (tc) {
        case 'I': props.push(buf.readInt32LE(propOffset)); propOffset += 4; break;
        case 'D': props.push(buf.readDoubleLE(propOffset)); propOffset += 8; break;
        case 'F': props.push(buf.readFloatLE(propOffset)); propOffset += 4; break;
        case 'L': { const lo=buf.readUInt32LE(propOffset), hi=buf.readInt32LE(propOffset+4); props.push(hi*4294967296+lo); propOffset+=8; break; }
        case 'S': { const sl=buf.readUInt32LE(propOffset); propOffset+=4; props.push(buf.slice(propOffset,propOffset+sl).toString('utf8')); propOffset+=sl; break; }
        case 'R': { const rl=buf.readUInt32LE(propOffset); propOffset+=4; props.push(`<raw ${rl}>`); propOffset+=rl; break; }
        case 'f': case 'd': case 'l': case 'i': case 'b': {
          const arrCount=buf.readUInt32LE(propOffset), enc=buf.readUInt32LE(propOffset+4), compLen=buf.readUInt32LE(propOffset+8);
          propOffset+=12;
          let data = null;
          if (enc === 0) {
            if (tc==='f') { data = new Float32Array(arrCount); for(let k=0;k<arrCount;k++) data[k]=buf.readFloatLE(propOffset+k*4); }
            else if (tc==='d') { data = new Float64Array(arrCount); for(let k=0;k<arrCount;k++) data[k]=buf.readDoubleLE(propOffset+k*8); }
            else if (tc==='l') { data = []; for(let k=0;k<Math.min(arrCount,20);k++) { const lo=buf.readUInt32LE(propOffset+k*8), hi=buf.readInt32LE(propOffset+k*8+4); data.push(hi*4294967296+lo); } }
          } else if (enc === 1) {
            // zlib compressed
            const compressed = buf.slice(propOffset, propOffset+compLen);
            try {
              const decompressed = zlib.inflateSync(compressed);
              if (tc==='f') { data = new Float32Array(arrCount); for(let k=0;k<arrCount;k++) data[k]=decompressed.readFloatLE(k*4); }
              else if (tc==='d') { data = new Float64Array(arrCount); for(let k=0;k<arrCount;k++) data[k]=decompressed.readDoubleLE(k*8); }
              else if (tc==='l') { data = []; for(let k=0;k<Math.min(arrCount,20);k++) { const lo=decompressed.readUInt32LE(k*8), hi=decompressed.readInt32LE(k*8+4); data.push(hi*4294967296+lo); } }
            } catch(e) { /* ignore decompression errors */ }
          }
          props.push(`<arr[${arrCount}] enc=${enc}>`);
          if (data) arrayDatas.push({type:tc, data});
          propOffset+=compLen; break;
        }
        case 'C': props.push(buf.readUInt8(propOffset)); propOffset+=1; break;
        case 'Y': props.push(buf.readInt16LE(propOffset)); propOffset+=2; break;
        default: propOffset=nodeEndOffset; i=numProperties; break;
      }
    }
    const nullSize = RECORD_HEADER;
    const children = (propOffset < nodeEndOffset - nullSize) ? parseNodes(buf, propOffset, nodeEndOffset - nullSize) : [];
    nodes.push({ name, props, children, arrayDatas });
    offset = nodeEndOffset;
  }
  return nodes;
}

const rootNodes = parseNodes(buf, 27, buf.length);
const objects = rootNodes.find(n => n.name === 'Objects');
const connections = rootNodes.find(n => n.name === 'Connections');

// Build connections map
const connMap = new Map(); // childID -> [{parentID, attr}]
const connMapParents = new Map(); // parentID -> [{childID, attr}]

connections.children.forEach(c => {
  if (c.name === 'C') {
    const type = c.props[0]; // "OO" or "OP"
    const childId = c.props[1];
    const parentId = c.props[2];
    const attr = c.props[3];
    
    if (!connMap.has(childId)) connMap.set(childId, []);
    connMap.get(childId).push({parentId, attr, type});
    
    if (!connMapParents.has(parentId)) connMapParents.set(parentId, []);
    connMapParents.get(parentId).push({childId, attr, type});
  }
});

// Build ID -> object map
const idMap = new Map();
objects.children.forEach(obj => {
  const id = obj.props[0];
  idMap.set(id, obj);
});

// Find hips model
const allModels = objects.children.filter(c => c.name === 'Model');
const hipsModel = allModels.find(m => String(m.props[1]||'').replace('Model::','').replace(/\x00.*$/,'') === 'J_Bip_C_Hips');
const rootModel = allModels.find(m => String(m.props[1]||'').replace('Model::','').replace(/\x00.*$/,'') === 'Root');

console.log('Hips model ID:', hipsModel?.props[0]);
console.log('Root model ID:', rootModel?.props[0]);

// Find AnimationCurveNode connected to Hips (via OP connections)
console.log('\n=== Connections FROM Hips ===');
const hipsId = hipsModel?.props[0];
if (hipsId && connMap.has(hipsId)) {
  connMap.get(hipsId).forEach(c => {
    const parent = idMap.get(c.parentId);
    const parentName = parent ? `${parent.name}[${String(parent.props[1]||'').replace(/\x00.*$/,'').slice(0,30)}]` : 'unknown';
    console.log(`  Hips -> ${parentName} (attr: ${c.attr || 'OO'})`);
  });
}

// Find what's connected TO Hips (children, i.e., CurveNodes)
console.log('\n=== Connections TO Hips (children) ===');
if (hipsId && connMapParents.has(hipsId)) {
  connMapParents.get(hipsId).forEach(c => {
    const child = idMap.get(c.childId);
    const childName = child ? `${child.name}[${String(child.props[1]||'').replace(/\x00.*$/,'').slice(0,30)}]` : 'unknown';
    console.log(`  ${childName} -> Hips (attr: ${c.attr || 'OO'})`);
  });
}

// Find AnimationCurveNodes connected to Hips
const animCurveNodes = objects.children.filter(c => c.name === 'AnimationCurveNode');

// Find by connection: AnimCurveNode OP-> Hips model via "Lcl Rotation"
let hipsRotCurveNodeId = null;
let hipsPosCurveNodeId = null;

if (hipsId && connMapParents.has(hipsId)) {
  connMapParents.get(hipsId).forEach(c => {
    const child = idMap.get(c.childId);
    if (child && child.name === 'AnimationCurveNode') {
      const nodeName = String(child.props[1]||'').replace('AnimCurveNode::','');
      console.log(`\nFound AnimCurveNode connected to Hips: "${nodeName}" attr="${c.attr}"`);
      if (c.attr === 'Lcl Rotation') hipsRotCurveNodeId = c.childId;
      if (c.attr === 'Lcl Translation') hipsPosCurveNodeId = c.childId;
    }
  });
}

// Get the AnimationCurves connected to HipsRotCurveNode
console.log('\n=== Hips Rotation Animation Curves ===');
if (hipsRotCurveNodeId) {
  const curveNode = idMap.get(hipsRotCurveNodeId);
  console.log('CurveNode props:', curveNode?.props[1]);
  
  // Find curves connected to this curve node
  if (connMapParents.has(hipsRotCurveNodeId)) {
    connMapParents.get(hipsRotCurveNodeId).forEach(c => {
      const child = idMap.get(c.childId);
      if (child && child.name === 'AnimationCurve') {
        const keyTimeNode = child.children.find(n => n.name === 'KeyTime');
        const keyValueNode = child.children.find(n => n.name === 'KeyValueFloat');
        
        const times = keyTimeNode?.arrayDatas?.[0]?.data;
        const values = keyValueNode?.arrayDatas?.[0]?.data;
        
        console.log(`\n  Curve attr="${c.attr}":`);
        if (times && values) {
          console.log(`    Key count: ${values.length}`);
          // First 5 keyframe values (in degrees)
          const firstVals = Array.from(values.slice(0, 5));
          console.log(`    First 5 values (degrees): ${firstVals.map(v => v.toFixed(4)).join(', ')}`);
          // Also FBX KeyTime is in FBX time units (46186158000 per second)
          const FBX_TIME_UNIT = 46186158000;
          const firstTimes = Array.from(times.slice ? times.slice(0, 5) : []);
          console.log(`    First 5 times (seconds): ${firstTimes.map(t => (t/FBX_TIME_UNIT).toFixed(4)).join(', ')}`);
        } else {
          console.log(`    No uncompressed data available`);
        }
      }
    });
  }
}

// Check Root model's animation curves
console.log('\n\n=== Root Node Animation Curves ===');
const rootId = rootModel?.props[0];
if (rootId && connMapParents.has(rootId)) {
  connMapParents.get(rootId).forEach(c => {
    const child = idMap.get(c.childId);
    if (child && child.name === 'AnimationCurveNode') {
      const nodeName = String(child.props[1]||'').replace('AnimCurveNode::','');
      console.log(`\n  CurveNode: "${nodeName}" attr="${c.attr}"`);
    }
  });
}

// Check if Root itself has a quaternion track in the final THREE.js AnimationClip
// The animation clip will have "Root.quaternion" if Root is animated
// But if Root has no rotation animation curves, FBXLoader still captures the rest pose
// via generateTransform, and doesn't create a rotation track for Root
console.log('\n\n=== IMPORTANT: Does FBXLoader bake Root rotation into scene? ===');
console.log('Three.js FBXLoader applies generateTransform() to each node,');
console.log('which includes: Translation + PreRotation + LclRotation + PostRotation');
console.log('Root node has LclRotation=[90,0,0], no PreRotation -> node.quaternion=(90°,0,0)');
console.log('Root IS in the scene graph as a Bone/Object3D with 90° X rotation.');
console.log('So hips world quaternion = Root_world(90°) * Hips_local(7.2124°)');
console.log('');
console.log('UNLESS: FBXLoader has a -90° correction for Y-up FBX files');
console.log('Let\'s check FBXLoader for any Y-up correction...');

// Check if Three.js FBXLoader does coordinate system adjustment
const fbxLoaderSource = fs.readFileSync(
  path.resolve(__dirname, '../node_modules/three/examples/jsm/loaders/FBXLoader.js'),
  'utf8'
);
const lines = fbxLoaderSource.split('\n');
const upAxisLines = lines.filter((l, i) => l.includes('UpAxis') || l.includes('upAxis') || l.includes('90') && l.includes('global') || l.includes('coordSystem'));
console.log('\nFBXLoader lines mentioning UpAxis or coord system:');
upAxisLines.slice(0, 20).forEach(l => console.log(' ', l.trim()));

