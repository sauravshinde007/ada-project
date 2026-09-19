#!/usr/bin/env node
/**
 * FBX Binary v7.x Parser
 * Properly handles FBX 7.x binary format with 8-byte offsets
 */

const fs = require('fs');
const path = require('path');

const FBX_FILE = path.resolve(__dirname, '../public/ada_default_anim/Standing_Idle.fbx');

const buf = fs.readFileSync(FBX_FILE);

// FBX binary format v7.x uses:
// - 8-byte endOffset (uint64 treated as uint32 for files < 4GB)
// - 8-byte numProperties 
// - 8-byte propertyListLen
// - 1-byte nameLen
// - nameLen bytes name
// 
// But FBX 7.5+ can also use 4-byte fields...
// Let's check the version first

const version = buf.readUInt32LE(23);
console.log(`FBX Version: ${version} (${(version/1000).toFixed(1)})`);

// FBX 7.5+ uses 8-byte record offsets; earlier versions use 4-byte
const use64 = version >= 7500;
console.log(`Using ${use64 ? '64' : '32'}-bit node records`);
console.log('');

function readUintField(buf, offset, is64) {
  if (is64) {
    // Read as two 32-bit values (lo, hi), treat hi as 0 for files <4GB
    const lo = buf.readUInt32LE(offset);
    const hi = buf.readUInt32LE(offset + 4);
    return lo; // ignore hi, files won't be >4GB
  }
  return buf.readUInt32LE(offset);
}

const FIELD_SIZE = use64 ? 8 : 4;
const RECORD_HEADER = FIELD_SIZE * 3 + 1; // endOffset + numProps + propListLen + nameLen

function parseNodes(buf, startOffset, endOffset) {
  const nodes = [];
  let offset = startOffset;
  
  while (offset < endOffset) {
    const nodeEndOffset = readUintField(buf, offset, use64);
    if (nodeEndOffset === 0) {
      // NULL record marker, end of node list
      offset += RECORD_HEADER;
      break;
    }
    
    const numProperties = readUintField(buf, offset + FIELD_SIZE, use64);
    // const propListLen = readUintField(buf, offset + FIELD_SIZE*2, use64);
    const nameLen = buf.readUInt8(offset + FIELD_SIZE * 3);
    
    const name = buf.slice(offset + RECORD_HEADER, offset + RECORD_HEADER + nameLen).toString('utf8');
    
    let propOffset = offset + RECORD_HEADER + nameLen;
    
    // Parse properties
    const props = [];
    const arrayDatas = [];
    
    for (let i = 0; i < numProperties; i++) {
      if (propOffset >= buf.length) break;
      const typeCode = String.fromCharCode(buf[propOffset]);
      propOffset++;
      
      switch (typeCode) {
        case 'C':
          props.push(buf.readUInt8(propOffset));
          propOffset += 1;
          break;
        case 'Y':
          props.push(buf.readInt16LE(propOffset));
          propOffset += 2;
          break;
        case 'I':
          props.push(buf.readInt32LE(propOffset));
          propOffset += 4;
          break;
        case 'F':
          props.push(buf.readFloatLE(propOffset));
          propOffset += 4;
          break;
        case 'D':
          props.push(buf.readDoubleLE(propOffset));
          propOffset += 8;
          break;
        case 'L': {
          const lo = buf.readUInt32LE(propOffset);
          const hi = buf.readInt32LE(propOffset + 4);
          props.push(hi * 4294967296 + lo);
          propOffset += 8;
          break;
        }
        case 'S': {
          const slen = buf.readUInt32LE(propOffset);
          propOffset += 4;
          const s = buf.slice(propOffset, propOffset + slen).toString('utf8');
          props.push(s);
          propOffset += slen;
          break;
        }
        case 'R': {
          const rlen = buf.readUInt32LE(propOffset);
          propOffset += 4;
          props.push(`<raw ${rlen} bytes>`);
          propOffset += rlen;
          break;
        }
        case 'f': case 'd': case 'l': case 'i': case 'b': {
          const arrCount = buf.readUInt32LE(propOffset);
          const encoding = buf.readUInt32LE(propOffset + 4);
          const compressedLen = buf.readUInt32LE(propOffset + 8);
          propOffset += 12;
          
          let data = null;
          if (encoding === 0) {
            // Raw
            if (typeCode === 'f') {
              data = new Float32Array(arrCount);
              for (let k = 0; k < arrCount; k++) data[k] = buf.readFloatLE(propOffset + k * 4);
            } else if (typeCode === 'd') {
              data = new Float64Array(arrCount);
              for (let k = 0; k < arrCount; k++) data[k] = buf.readDoubleLE(propOffset + k * 8);
            } else if (typeCode === 'i') {
              data = new Int32Array(arrCount);
              for (let k = 0; k < arrCount; k++) data[k] = buf.readInt32LE(propOffset + k * 4);
            } else if (typeCode === 'l') {
              // 64-bit ints, store as JS numbers
              data = new Float64Array(arrCount);
              for (let k = 0; k < arrCount; k++) {
                const lo = buf.readUInt32LE(propOffset + k * 8);
                const hi = buf.readInt32LE(propOffset + k * 8 + 4);
                data[k] = hi * 4294967296 + lo;
              }
            }
          } else if (encoding === 1) {
            // zlib compressed — skip, we don't need to decompress for our purpose
            data = { compressed: true, count: arrCount };
          }
          
          props.push(`<array[${arrCount}] enc=${encoding}>`);
          if (data) arrayDatas.push({ type: typeCode, data });
          propOffset += compressedLen;
          break;
        }
        default:
          // Unknown type code
          props.push(`<unknown type ${typeCode}>`);
          propOffset = nodeEndOffset; // skip rest
          i = numProperties; // break loop
          break;
      }
    }
    
    // Parse children between propOffset and nodeEndOffset - NULL_RECORD_SIZE
    const nullSize = RECORD_HEADER;
    const children = [];
    if (propOffset < nodeEndOffset - nullSize) {
      const childNodes = parseNodes(buf, propOffset, nodeEndOffset - nullSize);
      children.push(...childNodes);
    }
    
    nodes.push({ name, props, children, arrayDatas });
    offset = nodeEndOffset;
  }
  
  return nodes;
}

// Parse from offset 27 (after magic + version bytes)
const rootNodes = parseNodes(buf, 27, buf.length);

// --- Print top-level structure ---
console.log('=== Top-Level Nodes ===');
rootNodes.forEach(n => {
  console.log(`  [${n.name}] (${n.children.length} children, ${n.props.length} props)`);
});

// --- GlobalSettings ---
console.log('\n=== GlobalSettings ===');
const globalSettings = rootNodes.find(n => n.name === 'GlobalSettings');
if (globalSettings) {
  const props70 = globalSettings.children.find(c => c.name === 'Properties70');
  if (props70) {
    props70.children.forEach(p => {
      if (p.name === 'P' && p.props.length > 0) {
        const pname = p.props[0];
        const relevant = ['UpAxis','UpAxisSign','FrontAxis','FrontAxisSign','CoordAxis','CoordAxisSign',
                          'UnitScaleFactor','OriginalUnitScaleFactor','OriginalUpAxis'];
        if (relevant.includes(pname)) {
          console.log(`  ${pname}: ${JSON.stringify(p.props.slice(1))}`);
        }
      }
    });
  }
}

// --- Objects ---
const objects = rootNodes.find(n => n.name === 'Objects');
if (!objects) {
  console.log('No Objects node found!');
  process.exit(1);
}

const allModels = objects.children.filter(c => c.name === 'Model');
const limbNodes = allModels.filter(m => {
  const type = m.props[2] || '';
  return type === 'LimbNode' || type === 'Limb' || type === 'Root';
});

console.log(`\n=== Models ===`);
console.log(`Total Models: ${allModels.length}`);
console.log(`Limb/LimbNode/Root: ${limbNodes.length}`);

// Print all limb names
console.log('\n--- All Limb Names ---');
limbNodes.forEach(m => {
  const rawName = String(m.props[1] || '');
  const name = rawName.replace('Model::', '').replace(/\x00.*$/, '');
  console.log(`  ${name}`);
});

// --- Key bone transforms ---
console.log('\n=== Key Bone Local Transforms (from FBX Properties70) ===');
const KEY_BONES = [
  'J_Bip_C_Hips', 'J_Bip_C_Spine', 'J_Bip_C_Spine1', 'J_Bip_C_Spine2',
  'J_Bip_C_Neck', 'J_Bip_C_Head',
  'J_Bip_L_UpperLeg', 'J_Bip_R_UpperLeg',
  'J_Bip_L_LowerLeg', 'J_Bip_R_LowerLeg',
  'J_Bip_L_Foot', 'J_Bip_R_Foot',
  'J_Bip_L_UpperArm', 'J_Bip_R_UpperArm',
];

limbNodes.forEach(m => {
  const rawName = String(m.props[1] || '');
  const name = rawName.replace('Model::', '').replace(/\x00.*$/, '');
  
  if (!KEY_BONES.includes(name)) return;
  
  console.log(`\n  Bone: "${name}"`);
  const props70 = m.children.find(c => c.name === 'Properties70');
  if (props70) {
    props70.children.forEach(p => {
      if (p.name === 'P' && p.props.length > 0) {
        const pname = p.props[0];
        const interesting = ['Lcl Translation', 'Lcl Rotation', 'Lcl Scaling', 'PreRotation', 'PostRotation', 'RotationActive', 'InheritType'];
        if (interesting.includes(pname)) {
          console.log(`    ${pname}: [${p.props.slice(4).join(', ')}]`);
        }
      }
    });
  }
});

// --- Animation Curve Nodes ---
const animCurveNodes = objects.children.filter(c => c.name === 'AnimationCurveNode');
const animCurves = objects.children.filter(c => c.name === 'AnimationCurve');
const animLayers = objects.children.filter(c => c.name === 'AnimationLayer');
const animStacks = objects.children.filter(c => c.name === 'AnimationStack');

console.log('\n=== Animation Info ===');
console.log(`AnimationStacks: ${animStacks.length}`);
console.log(`AnimationLayers: ${animLayers.length}`);
console.log(`AnimationCurveNodes: ${animCurveNodes.length}`);
console.log(`AnimationCurves: ${animCurves.length}`);

// First few curve node names
console.log('\n--- AnimationCurveNode names (first 20) ---');
animCurveNodes.slice(0, 20).forEach(cn => {
  const rawName = String(cn.props[1] || '');
  const name = rawName.replace('AnimCurveNode::', '').replace(/\x00.*$/, '');
  console.log(`  "${name}"`);
});

// Check if hips curve node exists
const hipsCurve = animCurveNodes.find(cn => {
  const rawName = String(cn.props[1] || '');
  return rawName.includes('Hips') || rawName.includes('hips');
});
if (hipsCurve) {
  console.log(`\nFound Hips curve node: "${hipsCurve.props[1]}"`);
}

// --- Connections ---
const connections = rootNodes.find(n => n.name === 'Connections');
console.log('\n=== Connections (first 30) ===');
if (connections) {
  connections.children.slice(0, 30).forEach(c => {
    if (c.name === 'C') {
      console.log(`  ${c.props.join(' | ')}`);
    }
  });
}

console.log('\n=== Done ===');

