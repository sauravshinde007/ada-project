#!/usr/bin/env node
/**
 * Detailed FBX analysis focusing on Root and Hips transforms
 * Also examines what FBX "Lcl Rotation" means in terms of quaternions
 */

const fs = require('fs');
const path = require('path');

const FBX_FILE = path.resolve(__dirname, '../public/ada_default_anim/Standing_Idle.fbx');

const buf = fs.readFileSync(FBX_FILE);
const version = buf.readUInt32LE(23);
const use64 = version >= 7500;
const FIELD_SIZE = use64 ? 8 : 4;
const RECORD_HEADER = FIELD_SIZE * 3 + 1;

function readUintField(buf, offset, is64) {
  if (is64) return buf.readUInt32LE(offset);
  return buf.readUInt32LE(offset);
}

function eulerToQuaternion(xDeg, yDeg, zDeg, order = 'ZYX') {
  // Convert Euler XYZ degrees to quaternion
  // FBX uses extrinsic Euler angles by default (ZYX order when read as intrinsic XYZ)
  // Actually FBX uses the rotation order stored in the bone's RotationOrder property
  // Default is XYZ (Euler XYZ intrinsic = Euler ZYX extrinsic)
  const x = xDeg * Math.PI / 180;
  const y = yDeg * Math.PI / 180;
  const z = zDeg * Math.PI / 180;
  
  // Quaternion from Euler XYZ (intrinsic, applied Z then Y then X)
  const cx = Math.cos(x/2), sx = Math.sin(x/2);
  const cy = Math.cos(y/2), sy = Math.sin(y/2);
  const cz = Math.cos(z/2), sz = Math.sin(z/2);
  
  // XYZ order (applied in order: first X, then Y, then Z)
  const qx = sx*cy*cz + cx*sy*sz;
  const qy = cx*sy*cz - sx*cy*sz;
  const qz = cx*cy*sz + sx*sy*cz;
  const qw = cx*cy*cz - sx*sy*sz;
  
  return { x: qx, y: qy, z: qz, w: qw };
}

function quaternionToEuler(q, order = 'XYZ') {
  const { x, y, z, w } = q;
  
  if (order === 'XYZ') {
    const sinX = 2*(w*x - y*z);
    const cosX = 1 - 2*(x*x + y*y);
    const sinY = 2*(w*y + x*z);
    const sinZ = 2*(w*z - x*y);
    const cosZ = 1 - 2*(y*y + z*z);
    
    return {
      x: Math.atan2(2*(w*x + y*z), 1 - 2*(x*x + y*y)) * 180/Math.PI,
      y: Math.asin(Math.max(-1, Math.min(1, 2*(w*y - z*x)))) * 180/Math.PI,
      z: Math.atan2(2*(w*z + x*y), 1 - 2*(y*y + z*z)) * 180/Math.PI,
    };
  }
  
  return { x: 0, y: 0, z: 0 };
}

function qMul(a, b) {
  return {
    x: a.w*b.x + a.x*b.w + a.y*b.z - a.z*b.y,
    y: a.w*b.y - a.x*b.z + a.y*b.w + a.z*b.x,
    z: a.w*b.z + a.x*b.y - a.y*b.x + a.z*b.w,
    w: a.w*b.w - a.x*b.x - a.y*b.y - a.z*b.z,
  };
}

function qInv(q) {
  return { x: -q.x, y: -q.y, z: -q.z, w: q.w };
}

function parseNodes(buf, startOffset, endOffset) {
  const nodes = [];
  let offset = startOffset;
  
  while (offset < endOffset) {
    const nodeEndOffset = readUintField(buf, offset, use64);
    if (nodeEndOffset === 0) { offset += RECORD_HEADER; break; }
    
    const numProperties = readUintField(buf, offset + FIELD_SIZE, use64);
    const nameLen = buf.readUInt8(offset + FIELD_SIZE * 3);
    const name = buf.slice(offset + RECORD_HEADER, offset + RECORD_HEADER + nameLen).toString('utf8');
    
    let propOffset = offset + RECORD_HEADER + nameLen;
    const props = [];
    
    for (let i = 0; i < numProperties; i++) {
      if (propOffset >= buf.length) break;
      const tc = String.fromCharCode(buf[propOffset]);
      propOffset++;
      
      switch (tc) {
        case 'I': props.push(buf.readInt32LE(propOffset)); propOffset += 4; break;
        case 'D': props.push(buf.readDoubleLE(propOffset)); propOffset += 8; break;
        case 'F': props.push(buf.readFloatLE(propOffset)); propOffset += 4; break;
        case 'L': {
          const lo = buf.readUInt32LE(propOffset);
          const hi = buf.readInt32LE(propOffset+4);
          props.push(hi * 4294967296 + lo);
          propOffset += 8; break;
        }
        case 'S': {
          const sl = buf.readUInt32LE(propOffset); propOffset += 4;
          props.push(buf.slice(propOffset, propOffset+sl).toString('utf8'));
          propOffset += sl; break;
        }
        case 'R': {
          const rl = buf.readUInt32LE(propOffset); propOffset += 4;
          props.push(`<raw ${rl}>`); propOffset += rl; break;
        }
        case 'f': case 'd': case 'l': case 'i': case 'b': {
          const arrCount = buf.readUInt32LE(propOffset);
          const enc = buf.readUInt32LE(propOffset+4);
          const compLen = buf.readUInt32LE(propOffset+8);
          propOffset += 12;
          let data = null;
          if (enc === 0) {
            if (tc === 'f') { data = []; for(let k=0;k<Math.min(arrCount,10);k++) data.push(buf.readFloatLE(propOffset+k*4)); }
            else if (tc === 'd') { data = []; for(let k=0;k<Math.min(arrCount,10);k++) data.push(buf.readDoubleLE(propOffset+k*8)); }
          }
          props.push(data ? `<array[${arrCount}] first: [${data.join(',')}]>` : `<array[${arrCount}] compressed>`);
          propOffset += compLen; break;
        }
        case 'C': props.push(buf.readUInt8(propOffset)); propOffset += 1; break;
        case 'Y': props.push(buf.readInt16LE(propOffset)); propOffset += 2; break;
        default: propOffset = nodeEndOffset; i = numProperties; break;
      }
    }
    
    const nullSize = RECORD_HEADER;
    const children = (propOffset < nodeEndOffset - nullSize) ? parseNodes(buf, propOffset, nodeEndOffset - nullSize) : [];
    
    nodes.push({ name, props, children });
    offset = nodeEndOffset;
  }
  
  return nodes;
}

const rootNodes = parseNodes(buf, 27, buf.length);
const objects = rootNodes.find(n => n.name === 'Objects');

function getBoneProps(models, boneName) {
  const m = models.find(m => {
    const raw = String(m.props[1] || '');
    return raw.replace('Model::', '').replace(/\x00.*$/, '') === boneName;
  });
  if (!m) return null;
  
  const props70 = m.children.find(c => c.name === 'Properties70');
  const result = { type: String(m.props[2] || '') };
  if (props70) {
    props70.children.forEach(p => {
      if (p.name === 'P' && p.props.length > 0) {
        result[p.props[0]] = p.props.slice(4);
      }
    });
  }
  return result;
}

const allModels = objects.children.filter(c => c.name === 'Model');
const limbNodes = allModels.filter(m => {
  const type = String(m.props[2] || '');
  return type === 'LimbNode' || type === 'Limb' || type === 'Root';
});

console.log('=== Root Node Info ===');
const rootInfo = getBoneProps(limbNodes, 'Root');
if (rootInfo) {
  console.log('Root node:');
  console.log('  Type:', rootInfo.type);
  console.log('  Lcl Translation:', rootInfo['Lcl Translation']);
  console.log('  Lcl Rotation:', rootInfo['Lcl Rotation']);
  console.log('  Lcl Scaling:', rootInfo['Lcl Scaling']);
  console.log('  PreRotation:', rootInfo['PreRotation']);
  console.log('  RotationActive:', rootInfo['RotationActive']);
  console.log('  RotationOrder:', rootInfo['RotationOrder']);
  console.log('  InheritType:', rootInfo['InheritType']);
  console.log('  ScalingActive:', rootInfo['ScalingActive']);
} else {
  console.log('Root node not found!');
}

console.log('\n=== J_Bip_C_Hips Node Info ===');
const hipsInfo = getBoneProps(limbNodes, 'J_Bip_C_Hips');
if (hipsInfo) {
  console.log('Hips:');
  Object.entries(hipsInfo).forEach(([k, v]) => console.log(`  ${k}: ${JSON.stringify(v)}`));
}

console.log('\n=== J_Bip_L_UpperLeg Node Info ===');
const upperLegInfo = getBoneProps(limbNodes, 'J_Bip_L_UpperLeg');
if (upperLegInfo) {
  console.log('UpperLeg:');
  Object.entries(upperLegInfo).forEach(([k, v]) => console.log(`  ${k}: ${JSON.stringify(v)}`));
}

console.log('\n=== J_Bip_R_UpperLeg Node Info ===');
const rUpperLegInfo = getBoneProps(limbNodes, 'J_Bip_R_UpperLeg');
if (rUpperLegInfo) {
  console.log('R UpperLeg:');
  Object.entries(rUpperLegInfo).forEach(([k, v]) => console.log(`  ${k}: ${JSON.stringify(v)}`));
}

// Now simulate the math
console.log('\n\n=== Mathematical Analysis ===');

// FBX Euler convention: FBXLoader reads "Lcl Rotation" + PreRotation and converts to quaternion
// PreRotation is applied FIRST, then Lcl Rotation
// Three.js FBXLoader: node.quaternion = PreRotationQ * LclRotationQ * PostRotationQ
// For most cases: node.quaternion = PreRotationQ * LclRotationQ

// Root node: assume Lcl Rotation = [0,0,0] and no PreRotation = identity quaternion
// J_Bip_C_Hips: Lcl Rotation = [7.2124°, 0, 0], no PreRotation

// After FBXLoader, for the SCENE (which has coordinate space transforms applied):
// FBXLoader converts from FBX coord space to Three.js coord space
// FBX: Y-up, Z-front => Three.js: Y-up, Z-towards-camera (same!)
// So no coordinate flip needed.

// BUT: FBXLoader applies a -90° X rotation to the root Group to convert from
// Z-up FBX to Y-up Three.js space... ONLY if the FBX is Z-up!
// Our FBX has UpAxis=1 (Y-up), so FBXLoader should NOT apply this rotation.

// Let's check: what quaternion does FBXLoader put on the Hips node?
// FBX Euler XYZ (Lcl Rotation = [7.2124, 0, 0]):
const hipsLclEulerQ = eulerToQuaternion(7.2124, 0, 0, 'XYZ');
console.log('Hips Lcl Rotation as quaternion (XYZ euler):', hipsLclEulerQ);
console.log('  => Euler XYZ:', quaternionToEuler(hipsLclEulerQ));

// After FBXLoader processes, the FBX quaternion tracks are stored relative to the
// FBX rest pose. The track values represent the DELTA from the rest pose.
// So Q_track[t=0] should be identity (or very close to it).

console.log('\n--- Rest Pose Computation ---');
// In the current code:
// rigNode.getWorldQuaternion(restRotationInverse) => gives world quaternion of hips AT REST
// rigNode.parent.getWorldQuaternion(parentRestWorldRotation) => gives world quaternion of hips' parent

// If Hips parent is Root with identity quaternion:
// - parentRestWorld = identity
// - restWorldQ(hips) = LclRotQ(hips) = Q(7.2124°, 0, 0)

// The current fix (exempting hips from restRotationInverse):
// Q_output = parentRestWorld * Q_track = identity * Q_track = Q_track

// This means the OUTPUT quaternion = Q_track (raw from animation).
// At t=0, Q_track ≈ identity (represents "no change from rest position").
// But the VRM's hips bone IS at its rest pose (identity in normalized space).
// So identity track quaternion on hips normalized bone = T-pose = correct!

// WAIT - but the FBX track quaternion at t=0 might NOT be identity.
// Let's check by looking at the animation curve data.

console.log('\n--- What is the animation track quaternion for Hips at t=0? ---');
console.log('');
console.log('If FBX animation tracks store ABSOLUTE quaternions (in local space):');
console.log('  Q_track[0] = Q representing the pose at t=0 in local space');
console.log('  At t=0, for Standing_Idle, hips should be approximately at rest pose');
console.log('  Rest pose = LclRotQ = Q(7.2124°, 0, 0)');
console.log('');
console.log('If FBX animation tracks store RELATIVE to rest quaternions:');
console.log('  Q_track[0] = identity = Q(0, 0, 0, 1)');
console.log('');

// Three.js FBXLoader uses "AnimCurve" data which stores ABSOLUTE local quaternions
// (i.e., the actual value of the rotation, not a delta from rest)
// See: three.js source FBXLoader.js - it reads the Euler values directly and converts

console.log('CONCLUSION: Three.js FBXLoader reads ABSOLUTE local Euler values from animation curves');
console.log('and stores them as quaternions. The track quaternions are ABSOLUTE local rotations.');
console.log('');
console.log('This means:');
console.log('  For Hips, Q_track[0] ≈ Q(7.2124°, 0, 0) (the rest pose rotation)');

// VRM normalized bone space:
console.log('\n--- VRM Normalized Space ---');
console.log('In VRM2 normalized bones:');
console.log('  All bones are in T-pose (identity rotation) in the normalized bone space');
console.log('  The normalizer handles the T-pose to normalized space transform');
console.log('  So when we write to getNormalizedBoneNode().quaternion, we write DELTA from T-pose');
console.log('');

console.log('--- The Algorithm Analysis ---');
console.log('');
console.log('CORRECT retargeting needs to:');
console.log('  1. Take Q_track (absolute local rotation of FBX bone at time t)');
console.log('  2. Compute DELTA from FBX rest pose: Q_delta = Q_rest_local^-1 * Q_track');
console.log('  3. Apply this delta to VRM normalized bone (which starts at identity = T-pose)');
console.log('');
console.log('But WAIT - parent bones matter:');
console.log('  Q_world = Q_parent_world * Q_local');
console.log('  So Q_delta_world = Q_parent_world_rest^-1 * Q_track_world');
console.log('             = Q_parent_world_rest^-1 * Q_parent_world_rest * Q_track_local');
console.log('             = Q_track_local');
console.log('  ... actually for local bones this simplifies');

console.log('\n--- What the current code does ---');
console.log('');
console.log('For non-Hips bones:');
console.log('  Q_output = parentRestWorldQ * Q_track * restWorldQ^-1');
console.log('');
console.log('This converts: "FBX absolute local Q" -> "delta rotation expressed in parent world space"');
console.log('Which then gets applied to VRM normalized bone (which is in VRM world space)');
console.log('');
console.log('Problem: VRM normalized bones already account for the VRM-vs-FBX rest pose difference!');
console.log('Actually no - we are still dealing with the coordinate space of the bones.');

// Let me work through the math step by step for hips
console.log('\n=== STEP-BY-STEP MATH FOR HIPS ===');
console.log('');

// FBX situation:
// - Root node: identity (no rotation)
// - Hips: Lcl Rotation = Q(7.2124°, 0, 0) at rest
// - At animation frame 0: Hips Lcl Rotation from track = Q(7.2124°, 0, 0) (approximately)
// - getWorldQuaternion(hips) = identity(Root) * Q(7.2124°) = Q(7.2124°)

const restHipsWorld = eulerToQuaternion(7.2124, 0, 0);
const restHipsWorldInv = qInv(restHipsWorld);
const identityParentWorld = { x: 0, y: 0, z: 0, w: 1 }; // Root has no rotation
const trackQ0 = eulerToQuaternion(7.2124, 0, 0); // At t=0, track Q = rest pose

console.log(`Hips rest world Q = ${JSON.stringify(restHipsWorld)}`);
console.log(`Parent (Root) world Q = ${JSON.stringify(identityParentWorld)}`);
console.log(`Track Q at t=0 = ${JSON.stringify(trackQ0)}`);

// Current code for non-hips would produce:
const nonHipsResult = qMul(qMul(identityParentWorld, trackQ0), restHipsWorldInv);
console.log(`\nIf we used the non-hips formula for hips:`);
console.log(`  parentRestWorld * track * restWorldInv`);
console.log(`  = identity * Q(7.2124°) * Q(-7.2124°) = identity`);
console.log(`  Result: ${JSON.stringify(nonHipsResult)}`);
console.log(`  Euler: ${JSON.stringify(quaternionToEuler(nonHipsResult))}`);
console.log(`  => This gives identity/T-pose! Which is CORRECT for idle at rest!`);

// Current code for hips (exemption):
const hipsExemptResult = qMul(identityParentWorld, trackQ0);
console.log(`\nCurrent hips exemption formula:`);
console.log(`  parentRestWorld * track (NO restWorldInv)`);
console.log(`  = identity * Q(7.2124°) = Q(7.2124°)`);
console.log(`  Result: ${JSON.stringify(hipsExemptResult)}`);
console.log(`  Euler: ${JSON.stringify(quaternionToEuler(hipsExemptResult))}`);
console.log(`  => This gives Q(7.2124°)! Which APPLIES the 7.2° pitch to VRM hips!`);
console.log(`  => THIS IS THE BUG! The hips exemption is WRONG!`);

console.log('');
console.log('=== ROOT CAUSE ===');
console.log('The current "exemption" for hips skips the rest-pose correction,');
console.log('causing the FBX rest pose rotation (7.2124° pitch) to be applied to');
console.log('the VRM normalized hips bone, which creates the global slant!');
console.log('');
console.log('FIX: Remove the hips exemption. Apply the same formula to ALL bones:');
console.log('  Q_output = parentRestWorldQ * Q_track * restWorldQ^-1');
console.log('');
console.log('This correctly computes the DELTA rotation from the FBX rest pose,');
console.log('which maps correctly to the VRM T-pose normalized space.');

// Verify: during actual animation (t > 0), the formula should still work
// Suppose at some frame, hips tilts forward by 5° (absolute):
const animHipsQ = eulerToQuaternion(7.2124 + 5, 0, 0); // 12.2124°
console.log('\n=== VERIFICATION: During Animation (hips tilted +5° from rest) ===');
const correctedResult = qMul(qMul(identityParentWorld, animHipsQ), restHipsWorldInv);
console.log(`Track Q at some frame (rest + 5°): ${JSON.stringify(animHipsQ)}`);
console.log(`Corrected formula result: ${JSON.stringify(correctedResult)}`);
console.log(`Euler: ${JSON.stringify(quaternionToEuler(correctedResult))}`);
console.log(`=> Should show ~5° forward tilt. Correct!`);

// What the current broken formula would give:
const brokenResult = qMul(identityParentWorld, animHipsQ);
console.log(`\nBroken formula result: ${JSON.stringify(brokenResult)}`);
console.log(`Euler: ${JSON.stringify(quaternionToEuler(brokenResult))}`);
console.log(`=> Shows 12.2124° forward tilt (rest + animation) = WRONG, too much!`);

