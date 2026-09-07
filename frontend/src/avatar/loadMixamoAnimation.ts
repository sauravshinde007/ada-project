import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { VRM, VRMHumanBoneName } from '@pixiv/three-vrm';

export async function loadMixamoAnimation(url: string, vrm: VRM): Promise<THREE.AnimationClip> {
  const loader = new FBXLoader();
  return new Promise((resolve, reject) => {
    loader.load(
      url,
      (asset) => {
        if (!asset.animations || asset.animations.length === 0) {
          reject(new Error(`No animations found in ${url}`));
          return;
        }

        asset.updateMatrixWorld(true);

        const animClip = asset.animations[0];
        const tracks: THREE.KeyframeTrack[] = [];
        
        const rawToNormalizedMap = new Map<string, string>();
        if (vrm.humanoid) {
          Object.entries(vrm.humanoid.humanBones).forEach(([boneName, bone]) => {
            if (!bone) return;
            const rawNode = (bone as any).node;
            const normalizedNode = vrm.humanoid?.getNormalizedBoneNode(boneName as VRMHumanBoneName);
            if (rawNode && normalizedNode) {
              rawToNormalizedMap.set(rawNode.name, normalizedNode.name);
            }
          });
        }
        
        const restRotationInverse = new THREE.Quaternion();
        const parentRestWorldRotation = new THREE.Quaternion();
        const _quatA = new THREE.Quaternion();

        animClip.tracks.forEach((track) => {
          const trackNameParts = track.name.split('.');
          const rigNodeName = trackNameParts[0];
          const propertyName = trackNameParts[1];

          if (propertyName !== 'quaternion') {
            return; // ONLY transfer quaternion/rotation tracks
          }

          if (rawToNormalizedMap.has(rigNodeName)) {
            const targetNodeName = rawToNormalizedMap.get(rigNodeName)!;
            const rigNode = asset.getObjectByName(rigNodeName);

            if (rigNode && rigNode.parent) {
              // ─── Rest-pose retargeting correction ──────────────────────────────────────
              // The FBX stores ABSOLUTE local Euler values as the animation track.
              // Three.js FBXLoader converts these Euler values to quaternions per frame.
              //
              // To retarget to VRM normalized bones (which are in T-pose = identity at rest),
              // we compute the DELTA from the FBX rest pose:
              //
              //   Q_out = parentRestWorldQ * Q_track * restWorldQ^-1
              //
              // This formula works identically for ALL bones including Hips:
              //   • At rest   : Q_track ≈ restLocalQ
              //                 restWorldQ = parentWorld * restLocalQ
              //                 => Q_out = parentWorld * restLocalQ * (parentWorld * restLocalQ)^-1 = identity ✓
              //   • Animated  : Q_track = restLocalQ * delta
              //                 => Q_out ≈ delta (only the animation motion, no rest-pose bias) ✓
              //
              // ROOT CAUSE OF THE PREVIOUS GLOBAL SLANT:
              //   The old code incorrectly exempted the Hips bone from the restRotationInverse
              //   step. The FBX hierarchy has:
              //     Root (Lcl Rotation = 90° X) → J_Bip_C_Hips (Lcl Rotation = 7.21° X)
              //   After updateMatrixWorld:
              //     hipsWorldQ ≈ Q(90°) * Q(7.21°) = Q(97.21°)
              //     parentRestWorldQ = Q(90°)   (Root node's world quaternion)
              //   The hips rotation TRACK at rest = Q(7.21°).
              //   With the exemption: Q_out = Q(90°) * Q(7.21°) = Q(97.21°)
              //   This leaked a ~97° forward pitch into the VRM normalized hips → global slant.
              //   Without the exemption (this code):
              //     Q_out = Q(90°) * Q(7.21°) * Q(-97.21°) = identity → upright ✓
              // ───────────────────────────────────────────────────────────────────────────
              rigNode.getWorldQuaternion(restRotationInverse).invert();
              rigNode.parent.getWorldQuaternion(parentRestWorldRotation);

              const newValues = new Float32Array(track.values.length);

              for (let i = 0; i < track.values.length; i += 4) {
                _quatA.fromArray(track.values, i);
                // Apply uniform rest-pose correction to ALL bones (no special-casing):
                _quatA.premultiply(parentRestWorldRotation).multiply(restRotationInverse);

                if (vrm.meta?.metaVersion === '0') {
                  _quatA.x = -_quatA.x;
                  _quatA.z = -_quatA.z;
                }
                _quatA.toArray(newValues, i);
              }

              const newTrackName = `${targetNodeName}.${propertyName}`;
              tracks.push(new THREE.QuaternionKeyframeTrack(newTrackName, track.times, newValues));
            }
          }
        });

        const clip = new THREE.AnimationClip('vrmAnimation', animClip.duration, tracks);
        resolve(clip);
      },
      undefined,
      reject
    );
  });
}
