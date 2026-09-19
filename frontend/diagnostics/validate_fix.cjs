#!/usr/bin/env node
/**
 * Full mathematical validation of the fix for all key bones
 * Uses actual FBX rest pose data extracted from the binary parser
 */

// Simple quaternion math library
function eulerToQ(xDeg, yDeg, zDeg, order = 'ZYX') {
  const x = xDeg * Math.PI / 180;
  const y = yDeg * Math.PI / 180;
  const z = zDeg * Math.PI / 180;
  const cx = Math.cos(x/2), sx = Math.sin(x/2);
  const cy = Math.cos(y/2), sy = Math.sin(y/2);
  const cz = Math.cos(z/2), sz = Math.sin(z/2);
  
  // ZYX order (default FBX euler order - intrinsic ZYX = extrinsic XYZ)
  // In Three.js this is stored as 'ZYX'
  if (order === 'ZYX') {
    return {
      x: sx*cy*cz - cx*sy*sz,
      y: cx*sy*cz + sx*cy*sz,
      z: cx*cy*sz - sx*sy*cz,
      w: cx*cy*cz + sx*sy*sz,
    };
  }
  // XYZ (intrinsic)
  return {
    x: sx*cy*cz + cx*sy*sz,
    y: cx*sy*cz - sx*cy*sz,
    z: cx*cy*sz + sx*sy*cz,
    w: cx*cy*cz - sx*sy*sz,
  };
}

function qToEuler(q, order = 'XYZ') {
  if (order === 'XYZ') {
    return {
      x: Math.atan2(2*(q.w*q.x + q.y*q.z), 1 - 2*(q.x*q.x + q.y*q.y)) * 180/Math.PI,
      y: Math.asin(Math.max(-1, Math.min(1, 2*(q.w*q.y - q.z*q.x)))) * 180/Math.PI,
      z: Math.atan2(2*(q.w*q.z + q.x*q.y), 1 - 2*(q.y*q.y + q.z*q.z)) * 180/Math.PI,
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

function qInv(q) { return { x: -q.x, y: -q.y, z: -q.z, w: q.w }; }

function qStr(q) {
  const e = qToEuler(q);
  return `euler(${e.x.toFixed(2)}°, ${e.y.toFixed(2)}°, ${e.z.toFixed(2)}°)`;
}

function isNearIdentity(q, tol = 0.01) {
  return Math.abs(q.x) < tol && Math.abs(q.y) < tol && Math.abs(q.z) < tol && Math.abs(q.w - 1) < tol;
}

// ===========================
// Data from FBX binary parser
// ===========================
// Note: Three.js FBXLoader uses 'ZYX' euler order by default for bones without explicit RotationOrder
// However, for pure single-axis rotations, XYZ and ZYX give the same result.

// Root node: Lcl Rotation = [90, 0, 0] in FBX, no PreRotation
// Three.js FBXLoader: euler order ZYX, but [90°, 0, 0] = same for any order with pure X rotation
const Q_Root = eulerToQ(90, 0, 0, 'ZYX');

// J_Bip_C_Hips: Lcl Rotation = [7.2124, 0, 0], no PreRotation  
const Q_Hips_local = eulerToQ(7.2124, 0, 0, 'ZYX');

// J_Bip_C_Spine: Lcl Rotation = [1.4664, 0, 0]
const Q_Spine_local = eulerToQ(1.4664, 0, 0, 'ZYX');

// J_Bip_C_Neck: Lcl Rotation = [26.2257, 0, 0]  
const Q_Neck_local = eulerToQ(26.2257, 0, 0, 'ZYX');

// J_Bip_L_UpperLeg: Lcl Rotation = [6.0136, 0, 180]
const Q_LUpperLeg_local = eulerToQ(6.0136, 0, 180, 'ZYX');

// Animation track quaternions at rest (t=0)
// These are: PreRotation * Q_from_Euler(curve_values) 
// Since none of these bones have PreRotation, track Q = Q_from_Euler(curve_values)
// Hips track at t=0: X=7.2124, Y=0, Z=0
const Q_track_Hips = eulerToQ(7.2124, 0, 0, 'ZYX');
// Spine track at t=0: X=2.694, Y=0.883, Z=1.493  
const Q_track_Spine = eulerToQ(2.694, 0.883, 1.493, 'ZYX');
// UpperLeg track at t=0: X=21.9257, Y=-4.824, Z=-172.518
const Q_track_LUpperLeg = eulerToQ(21.9257, -4.824, -172.518, 'ZYX');

// ==========================
// World quaternion computation
// ==========================
// Root world = Q_Root (no parent above it in our scene)
const Q_Root_world = Q_Root;

// Hips: parent is Root
// hips_world = Root_world * hips_local
const Q_Hips_world = qMul(Q_Root_world, Q_Hips_local);

// Spine: parent is Hips (in FBX scene)
// spine_world = hips_world * spine_local
const Q_Spine_world = qMul(Q_Hips_world, Q_Spine_local);

// Neck: parent is UpperChest (for simplicity, approximate as hips_world * spine * etc.)
// For our test, we focus on Hips and Spine.

// For UpperLeg: parent is Hips
const Q_LUpperLeg_world = qMul(Q_Hips_world, Q_LUpperLeg_local);

console.log('=== MATHEMATICAL VALIDATION OF THE FIX ===\n');

function testBone(boneName, Q_bone_world, Q_parent_world, Q_track_restPose, Q_track_animated_extra) {
  console.log(`\n--- ${boneName} ---`);
  console.log(`  Bone world rest Q: ${qStr(Q_bone_world)}`);
  console.log(`  Parent world rest Q: ${qStr(Q_parent_world)}`);
  console.log(`  Track Q at rest (t=0): ${qStr(Q_track_restPose)}`);
  
  // restRotationInverse = Q_bone_world.inverse()
  const restRotInv = qInv(Q_bone_world);
  
  // === FIXED formula: Q_out = parentRestWorld * Q_track * restWorldInv ===
  // At rest (t=0):
  const Q_out_rest = qMul(qMul(Q_parent_world, Q_track_restPose), restRotInv);
  const isIdent = isNearIdentity(Q_out_rest);
  console.log(`  FIXED formula at rest: ${qStr(Q_out_rest)} ${isIdent ? '✓ (identity = upright)' : '✗ (NOT identity!)'}`);
  
  // During animation:
  if (Q_track_animated_extra) {
    const Q_track_animated = qMul(Q_track_restPose, Q_track_animated_extra);
    const Q_out_animated = qMul(qMul(Q_parent_world, Q_track_animated), restRotInv);
    const expectedEuler = qToEuler(Q_track_animated_extra);
    const actualEuler = qToEuler(Q_out_animated);
    console.log(`  FIXED formula animated (extra ${qStr(Q_track_animated_extra)}):`);
    console.log(`    Expected delta: ${qStr(Q_track_animated_extra)}`);
    console.log(`    Got: ${qStr(Q_out_animated)}`);
    const pitchMatch = Math.abs(actualEuler.x - expectedEuler.x) < 1;
    const yawMatch = Math.abs(actualEuler.y - expectedEuler.y) < 1;
    console.log(`    Match: ${pitchMatch && yawMatch ? '✓' : '✗'}`);
  }
  
  // === OLD (broken) formula: Q_out = parentRestWorld * Q_track (NO restWorldInv for hips) ===
  const Q_out_broken_hips = qMul(Q_parent_world, Q_track_restPose);
  console.log(`  BROKEN exemption at rest: ${qStr(Q_out_broken_hips)} ${isNearIdentity(Q_out_broken_hips) ? '✓ (identity)' : '✗ (NOT identity - SLANT!)'}`);
  
  return isIdent;
}

let allPass = true;

// Test Hips bone
allPass &= testBone(
  'J_Bip_C_Hips',
  Q_Hips_world,   // bone's world Q
  Q_Root_world,   // parent (Root) world Q
  Q_track_Hips,   // track at rest = Q(7.2124°)
  eulerToQ(5, 0, 0, 'ZYX')  // animated: 5° extra forward tilt
);

// Test Spine bone
// Spine parent is Hips, but in the FBX scene, spine parent world = Q_Hips_world
// Spine track at rest: Q_track_Spine ≠ Q_Spine_local because Q_Spine_world ≠ Q_Spine_local
// Actually Q_Spine_world = Q_Hips_world * Q_Spine_local
// The restRotationInverse = Q_Spine_world.invert()
// parentRestWorldRotation = Q_Hips_world
allPass &= testBone(
  'J_Bip_C_Spine',
  Q_Spine_world,
  Q_Hips_world,
  Q_track_Spine,  // Absolute local Euler at rest: [2.694, 0.883, 1.493]
  null
);

// Test UpperLeg
allPass &= testBone(
  'J_Bip_L_UpperLeg',
  Q_LUpperLeg_world,
  Q_Hips_world,
  Q_track_LUpperLeg,  // Absolute local at rest: [21.9, -4.8, -172.5]
  null
);

console.log('\n=== SUMMARY ===');
console.log(`All bones produce identity at rest: ${allPass ? '✓ YES - character will be upright' : '✗ NO - still has slant'}`);

// Additional: verify Spine track at rest is close to Spine local Q
console.log('\n=== Verification: Are track values == local rest quaternions? ===');
const spine_track_euler = qToEuler(Q_track_Spine);
const spine_local_euler = qToEuler(Q_Spine_local);
console.log(`Spine track (ZYX euler): ${qStr(Q_track_Spine)}`);
console.log(`Spine local Q (ZYX euler): ${qStr(Q_Spine_local)}`);
// Note: The track Euler [2.694, 0.883, 1.493] does NOT equal the static [1.4664, 0, 0]
// because the animation starts at a slightly different pose than the FBX static rest
// This is normal - FBX static rest pose ≠ animation frame 0 exactly
console.log('(Difference expected: FBX static ≠ animation frame 0 for animated bones)');

