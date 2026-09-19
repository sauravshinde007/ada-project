#!/usr/bin/env node
/**
 * Read the Root bone's animation curves
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
            const compressed = buf.slice(propOffset, propOffset+compLen);
            try {
              const decompressed = zlib.inflateSync(compressed);
              if (tc==='f') { data = new Float32Array(arrCount); for(let k=0;k<arrCount;k++) data[k]=decompressed.readFloatLE(k*4); }
              else if (tc==='d') { data = new Float64Array(arrCount); for(let k=0;k<arrCount;k++) data[k]=decompressed.readDoubleLE(k*8); }
              else if (tc==='l') { data = []; for(let k=0;k<Math.min(arrCount,20);k++) { const lo=decompressed.readUInt32LE(k*8), hi=decompressed.readInt32LE(k*8+4); data.push(hi*4294967296+lo); } }
            } catch(e) {}
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

const connMap = new Map();
const connMapParents = new Map();
connections.children.forEach(c => {
  if (c.name === 'C') {
    const type = c.props[0];
    const childId = c.props[1];
    const parentId = c.props[2];
    const attr = c.props[3];
    if (!connMap.has(childId)) connMap.set(childId, []);
    connMap.get(childId).push({parentId, attr, type});
    if (!connMapParents.has(parentId)) connMapParents.set(parentId, []);
    connMapParents.get(parentId).push({childId, attr, type});
  }
});

const idMap = new Map();
objects.children.forEach(obj => { idMap.set(obj.props[0], obj); });

const allModels = objects.children.filter(c => c.name === 'Model');

function getAnimCurvesForModel(modelName) {
  const m = allModels.find(m => String(m.props[1]||'').replace('Model::','').replace(/\x00.*$/,'') === modelName);
  if (!m) { console.log(`Model "${modelName}" not found`); return; }
  const modelId = m.props[0];
  
  console.log(`\n=== Animation Curves for "${modelName}" (ID: ${modelId}) ===`);
  
  if (!connMapParents.has(modelId)) { console.log('  No children connected'); return; }
  
  connMapParents.get(modelId).forEach(c => {
    const child = idMap.get(c.childId);
    if (!child) return;
    if (child.name === 'AnimationCurveNode') {
      const nodeName = String(child.props[1]||'').replace('AnimCurveNode::','').replace(/\x00.*$/,'');
      console.log(`\n  CurveNode: "${nodeName}" attr="${c.attr}" id=${c.childId}`);
      
      // Find curves connected to this curve node
      if (connMapParents.has(c.childId)) {
        connMapParents.get(c.childId).forEach(cc => {
          const curve = idMap.get(cc.childId);
          if (curve && curve.name === 'AnimationCurve') {
            const keyValueNode = curve.children.find(n => n.name === 'KeyValueFloat');
            const keyTimeNode = curve.children.find(n => n.name === 'KeyTime');
            
            const values = keyValueNode?.arrayDatas?.[0]?.data;
            const times = keyTimeNode?.arrayDatas?.[0]?.data;
            const FBX_TIME_UNIT = 46186158000;
            
            console.log(`    Curve attr="${cc.attr}":`);
            if (values) {
              console.log(`      Key count: ${values.length}`);
              const slice = Array.from(values.slice ? values.slice(0, Math.min(values.length, 8)) : []);
              console.log(`      First values: ${slice.map(v => v.toFixed(6)).join(', ')}`);
            }
            if (times) {
              const slice = Array.from(times.slice ? times.slice(0, Math.min(times.length, 5)) : times);
              console.log(`      First times (s): ${slice.map(t => (t/FBX_TIME_UNIT).toFixed(4)).join(', ')}`);
            }
          }
        });
      }
    }
  });
}

getAnimCurvesForModel('Root');
getAnimCurvesForModel('J_Bip_C_Hips');
getAnimCurvesForModel('J_Bip_C_Spine');
getAnimCurvesForModel('J_Bip_L_UpperLeg');

// Final summary
console.log('\n\n=== KEY FINDING SUMMARY ===');
console.log('');
console.log('The Root node has Lcl Rotation = [90, 0, 0] in the FBX static data.');
console.log('It also has an AnimationCurveNode - check if this overrides the static rotation.');
console.log('');
console.log('Three.js FBXLoader processes bones as follows:');
console.log('1. generateTransform() applies static Lcl Rotation to node.quaternion');
console.log('2. Animation curves are stored as tracks (curves override static rotation during playback)');
console.log('');
console.log('The critical question is: what does THREE.js report as the Root\'s quaternion');
console.log('when the animation is NOT playing (rest pose) vs. when it IS playing?');
console.log('');
console.log('Since we call asset.updateMatrixWorld(true) BEFORE animation plays,');
console.log('we get the STATIC rest pose of each bone, which includes Root\'s 90° rotation.');

