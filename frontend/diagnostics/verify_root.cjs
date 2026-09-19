#!/usr/bin/env node
/**
 * Verify Root rotation impact and full retargeting math
 */

const fs = require('fs');
const path = require('path');

const FBX_FILE = path.resolve(__dirname, '../public/ada_default_anim/Standing_Idle.fbx');
const buf = fs.readFileSync(FBX_FILE);
const version = buf.readUInt32LE(23);
const use64 = version >= 7500;
const FIELD_SIZE = use64 ? 8 : 4;
const RECORD_HEADER = FIELD_SIZE * 3 + 1;

function readUintField(buf, offset) {
  return buf.readUInt32LE(offset);
}

function eulerToQ(xDeg, yDeg, zDeg) {
  const x = xDeg * Math.PI / 180;
  const y = yDeg * Math.PI / 180;
  const z = zDeg * Math.PI / 180;
  const cx = Math.cos(x/2), sx = Math.sin(x/2);
  const cy = Math.cos(y/2), sy = Math.sin(y/2);
  const cz = Math.cos(z/2), sz = Math.sin(z/2);
  return {
    x: sx*cy*cz + cx*sy*sz,
    y: cx*sy*cz - sx*cy*sz,
    z: cx*cy*sz + sx*sy*cz,
    w: cx*cy*cz - sx*sy*sz,
  };
}

function qToEuler(q) {
  return {
    x: Math.atan2(2*(q.w*q.x + q.y*q.z), 1 - 2*(q.x*q.x + q.y*q.y)) * 180/Math.PI,
    y: Math.asin(Math.max(-1, Math.min(1, 2*(q.w*q.y - q.z*q.x)))) * 180/Math.PI,
    z: Math.atan2(2*(q.w*q.z + q.x*q.y), 1 - 2*(q.y*q.y + q.z*q.z)) * 180/Math.PI,
  };
}

function qMul(a, b) {
  return {
    x: a.w*b.x + a.x*b.w + a.y*b.z - a.z*b.y,
    y: a.w*b.y - a.x*b.z + a.y*b.w + a.z*b.x,
    z: a.w*b.z + a.x*b.y - a.y*b.x + a.z*b.w,
    w: a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z,
  };
}

function qInv(q) { return { x: -q.x, y: -q.y, z: -q.z, w: q.w }; }
function qStr(q) { const e = qToEuler(q); return `q(${q.x.toFixed(4)},${q.y.toFixed(4)},${q.z.toFixed(4)},${q.w.toFixed(4)}) euler(${e.x.toFixed(2)}°,${e.y.toFixed(2)}°,${e.z.toFixed(2)}°)`; }

function parseNodes(buf, startOffset, endOffset) {
  const nodes = [];
  let offset = startOffset;
  while (offset < endOffset) {
    const nodeEndOffset = readUintField(buf, offset);
    if (nodeEndOffset === 0) { offset += RECORD_HEADER; break; }
    const numProperties = readUintField(buf, offset + FIELD_SIZE);
    const nameLen = buf.readUInt8(offset + FIELD_SIZE * 3);
    const name = buf.slice(offset + RECORD_HEADER, offset + RECORD_HEADER + nameLen).toString('utf8');
    let propOffset = offset + RECORD_HEADER + nameLen;
    const props = [];
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
        case 'f': case 'd': case 'l': case 'i': case 'b': { const ac=buf.readUInt32LE(propOffset),enc=buf.readUInt32LE(propOffset+4),cl=buf.readUInt32LE(propOffset+8); propOffset+=12; props.push(`<arr[${ac}]>`); propOffset+=cl; break; }
        case 'C': props.push(buf.readUInt8(propOffset)); propOffset+=1; break;
        case 'Y': props.push(buf.readInt16LE(propOffset)); propOffset+=2; break;
        default: propOffset=nodeEndOffset; i=numProperties; break;
      }
    }
    const nullSize = RECORD_HEADER;
    const children = (propOffset < nodeEndOffset - nullSize) ? parseNodes(buf, propOffset, nodeEndOffset - nullSize) : [];
    nodes.push({ name, props, children });
    offset = nodeEndOffset;
  }
  return nodes;
}

function getBoneProps(models, boneName) {
  const m = models.find(m => String(m.props[1]||'').replace('Model::','').replace(/\x00.*$/,'') === boneName);
  if (!m) return null;
  const props70 = m.children.find(c => c.name === 'Properties70');
  const result = { type: String(m.props[2]||'') };
  if (props70) props70.children.forEach(p => { if (p.name==='P'&&p.props.length>0) result[p.props[0]] = p.props.slice(4); });
  return result;
}

const rootNodes = parseNodes(buf, 27, buf.length);
const objects = rootNodes.find(n => n.name === 'Objects');
const allModels = objects.children.filter(c => c.name === 'Model');
const limbNodes = allModels.filter(m => ['LimbNode','Limb','Root'].includes(String(m.props[2]||'')));

// =====================
// The Root node has Lcl Rotation = [90, 0, 0]
// Three.js FBXLoader handles this specially!
// 
// Looking at Three.js FBXLoader source code behavior:
// - If FBX UpAxis == 1 (Y-up), no special coordinate flip is applied
// - The Root node's rotation IS included in the scene graph
// - BUT Three.js FBXLoader applies a global -90° X rotation to the root Group
//   ONLY when converting from Z-up to Y-up (UpAxis == 2)
// - For Y-up FBX, no such rotation is applied
// - So the Root's 90° X rotation IS in the scene graph as-is
// =====================

console.log('=== ROOT NODE ANALYSIS ===');
const rootInfo = getBoneProps(limbNodes, 'Root');
console.log('Root props:', JSON.stringify(rootInfo));

// Root Lcl Rotation = [90, 0, 0]
// => Q_root = eulerToQ(90, 0, 0) = (0.7071, 0, 0, 0.7071)
const rootQ = eulerToQ(90, 0, 0);
console.log('\nRoot world quaternion:', qStr(rootQ));

// J_Bip_C_Hips Lcl Rotation = [7.2124, 0, 0]
// J_Bip_C_Hips is a CHILD of Root
// So Hips world Q = Q_root * Q_hips_local
const hipsLocalQ = eulerToQ(7.2124, 0, 0);
const hipsWorldQ = qMul(rootQ, hipsLocalQ);
console.log('\nHips local quaternion:', qStr(hipsLocalQ));
console.log('Hips world quaternion (root * hips_local):', qStr(hipsWorldQ));

// Now: rigNode.getWorldQuaternion(restRotationInverse) = hipsWorldQ = 90° + 7.2° ≈ 97.2°
// rigNode.parent.getWorldQuaternion(parentRestWorldRotation) = rootQ = Q(90°, 0, 0)

console.log('\n=== CURRENT CODE SIMULATION ===');
console.log('restRotationInverse = hipsWorldQ:', qStr(hipsWorldQ));
console.log('Inverted:', qStr(qInv(hipsWorldQ)));
console.log('parentRestWorldRotation = rootQ:', qStr(rootQ));

// Track Q for Hips at t=0 (from animation):
// The FBX AnimationCurve for hips stores ABSOLUTE local Euler values
// At rest, the hips would have Lcl Rotation = [7.2124, 0, 0] in the animation
// But Three.js FBXLoader converts Euler to quaternion
// The track Q = Q from FBX animation curve data

// IMPORTANT: Three.js FBXLoader processes animation curves as EULER values
// and converts them to quaternion tracks. The ABSOLUTE Euler values are stored.
// So at t=0 (idle position), track Q ≈ Q_from_Euler([7.2124, 0, 0]) = hipsLocalQ

const trackQ0 = hipsLocalQ; // Assuming t=0 = rest pose
console.log('\nTrack Q at t=0 (≈ rest pose):', qStr(trackQ0));

// Current code for hips (exemption - no restRotInverse):
const hipsExemptResult = qMul(rootQ, trackQ0);
console.log('\nCurrent code (with hips exemption):');
console.log('  parentRestWorld * track = rootQ * trackQ0:', qStr(hipsExemptResult));
console.log('  => This applies 90° + 7.2° = ~97.2° to VRM hips normalized bone!');
console.log('  => But VRM normalized hips is in T-pose (identity), so 97.2° would look terrible!');

// Wait - but the architecture says it's been "working" just with a slant...
// Let me reconsider. Maybe the Root node is NOT the parent of Hips in Three.js.
// FBXLoader might handle the Root node specially - collapse it or not include it.

console.log('\n=== RECONSIDERING: ROOT NODE IN THREE.JS SCENE ===');
console.log('Three.js FBXLoader creates a Group for the FBX scene.');
console.log('The "Root" node in FBX might be the skeleton root, which FBXLoader');
console.log('processes differently. It may or may not include Root in the scene graph.');
console.log('');
console.log('Key question: Does Three.js include the Root node as a visible scene object,');
console.log('or does it treat it as just the skeleton root?');
console.log('');
console.log('From the FBX diagnostic: allModels shows "Root" as a LimbNode type.');
console.log('FBXLoader DOES include LimbNodes in the scene graph.');
console.log('');
console.log('BUT: FBXLoader also applies a coordinate system conversion:');
console.log('When FBX is Y-up (UpAxis=1), no axis flip is applied to the root Group.');
console.log('So the Root node with 90° X rotation would be in the graph as-is.');

console.log('\n=== ALTERNATIVE HYPOTHESIS ===');
console.log('');
console.log('What if Three.js FBXLoader DOES apply a -90° correction to Y-up FBX?');
console.log('If the root Group gets -90° X, and Root bone has +90° X,');
console.log('they cancel out and Root effectively has 0° rotation in world space.');
console.log('Then Hips world Q = rootWorldQ(0°) * hipsLocalQ(7.2124°) = 7.2124°');
console.log('');
console.log('In this case:');
const rootWorldAfterFlip = { x: 0, y: 0, z: 0, w: 1 }; // if cancelled
const hipsWorldAfterFlip = qMul(rootWorldAfterFlip, hipsLocalQ);
console.log('  hipsWorldQ = 7.2124°:', qStr(hipsWorldAfterFlip));

const parentWorldAfterFlip = rootWorldAfterFlip;
console.log('  parentRestWorld = identity');

const exemptResult2 = qMul(parentWorldAfterFlip, trackQ0);
console.log('\n  Hips exemption: identity * trackQ0 = trackQ0:', qStr(exemptResult2));
console.log('  => Applies 7.2124° to VRM hips! THIS explains the observed slant!');

const fullResult2 = qMul(qMul(parentWorldAfterFlip, trackQ0), qInv(hipsWorldAfterFlip));
console.log('\n  Full correction: identity * trackQ0 * hipsWorldInv:', qStr(fullResult2));
console.log('  => This gives identity (correct for rest pose)!');

console.log('\n=== FINAL CONCLUSION ===');
console.log('');
console.log('Whether Root is cancelled by FBXLoader or not, the math confirms:');
console.log('');
console.log('CURRENT BUG: The hips exemption (skipping restRotInverse) causes');
console.log('the FBX hips rest pose rotation to leak into the VRM output.');
console.log('');
console.log('THE FIX: Remove the special hips case. Apply the SAME formula to ALL bones:');
console.log('  Q_output = parentRestWorldQ * Q_track * restWorldQ.inverse()');
console.log('');
console.log('This works because:');
console.log('  - At rest: Q_track ≈ hipsLocalQ, restWorldQ = parentWorld * hipsLocalQ');
console.log('  - Q_output = parentWorld * hipsLocalQ * (parentWorld * hipsLocalQ)^-1 = identity ✓');
console.log('  - During animation: Q_output = delta rotation from rest = correct motion ✓');
console.log('');
console.log('VRM normalized bones expect LOCAL deltas from T-pose,');
console.log('so the formula correctly maps FBX absolute-local to VRM delta-from-T-pose.');

