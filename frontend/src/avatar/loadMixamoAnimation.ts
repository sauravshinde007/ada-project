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
        
        const mixamoVRMRigMap: Record<string, string> = {
          mixamorigHips: 'hips', mixamorigSpine: 'spine', mixamorigSpine1: 'chest', mixamorigSpine2: 'upperChest',
          mixamorigNeck: 'neck', mixamorigHead: 'head',
          mixamorigLeftShoulder: 'leftShoulder', mixamorigLeftArm: 'leftUpperArm', mixamorigLeftForeArm: 'leftLowerArm', mixamorigLeftHand: 'leftHand',
          mixamorigRightShoulder: 'rightShoulder', mixamorigRightArm: 'rightUpperArm', mixamorigRightForeArm: 'rightLowerArm', mixamorigRightHand: 'rightHand',
          mixamorigLeftUpLeg: 'leftUpperLeg', mixamorigLeftLeg: 'leftLowerLeg', mixamorigLeftFoot: 'leftFoot', mixamorigLeftToeBase: 'leftToes',
          mixamorigRightUpLeg: 'rightUpperLeg', mixamorigRightLeg: 'rightLowerLeg', mixamorigRightFoot: 'rightFoot', mixamorigRightToeBase: 'rightToes',
        };

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

          if (propertyName !== 'quaternion') return;

          let targetNodeName = mixamoVRMRigMap[rigNodeName];
          if (!targetNodeName && rawToNormalizedMap.has(rigNodeName)) {
            targetNodeName = rawToNormalizedMap.get(rigNodeName)!;
          }

          if (targetNodeName) {
            const rigNode = asset.getObjectByName(rigNodeName);
            if (rigNode && rigNode.parent) {
              rigNode.getWorldQuaternion(restRotationInverse).invert();
              rigNode.parent.getWorldQuaternion(parentRestWorldRotation);

              const newValues = new Float32Array(track.values.length);
              for (let i = 0; i < track.values.length; i += 4) {
                _quatA.fromArray(track.values, i);
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
