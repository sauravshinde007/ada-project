const fs = require('fs');
let code = fs.readFileSync('src/avatar/loadMixamoAnimation.ts', 'utf8');

// 1. Add hipsPositionScale calculation
const hipsScaleCode = `
        const mixamoHipsNode = asset.getObjectByName('J_Bip_C_Hips');
        let hipsPositionScale = 1;
        if (mixamoHipsNode && vrm.humanoid) {
            const motionHipsHeight = mixamoHipsNode.position.y;
            const vrmHipsHeight = vrm.humanoid.normalizedRestPose.hips?.position?.[1] ?? 1;
            if (motionHipsHeight > 0.001) {
                hipsPositionScale = vrmHipsHeight / motionHipsHeight;
            }
        }
        
        let positionTrackName = null;
        animClip.tracks.forEach(t => {
            if (t.name.endsWith('.position')) {
                positionTrackName = t.name;
            }
        });
`;

code = code.replace('const _quatA = new THREE.Quaternion();', 'const _quatA = new THREE.Quaternion();\n' + hipsScaleCode);

// 2. Map position track
const posTrackCode = `
          if (propertyName === 'position' && track.name === positionTrackName) {
            const normalizedHips = vrm.humanoid?.getNormalizedBoneNode('hips');
            if (normalizedHips && track instanceof THREE.VectorKeyframeTrack) {
                const value = track.values.map( ( v, i ) => ( vrm.meta?.metaVersion === '0' && i % 3 !== 1 ? - v : v ) * hipsPositionScale );
                tracks.push(new THREE.VectorKeyframeTrack(`${normalizedHips.name}.position`, track.times, value));
                mappedCount++;
            }
            return;
          }
`;

code = code.replace(`          if (propertyName !== 'quaternion') {\n            skippedPosScaleCount++;\n            return; // ONLY transfer quaternion/rotation tracks\n          }`, posTrackCode + `\n          if (propertyName !== 'quaternion') {\n            skippedPosScaleCount++;\n            return;\n          }`);


// 3. Skip restRotationInverse for Hips
const hipsLogic = `
                // For the Hips (root), preserving the absolute world rotation prevents a global slant
                // because the animation's leg/spine IK is baked relative to the Mixamo Hips rest orientation.
                const isHips = targetNodeName.toLowerCase().includes('hips');
                _quatA.premultiply(parentRestWorldRotation);
                if (!isHips) {
                  _quatA.multiply(restRotationInverse);
                }
`;

code = code.replace(`                _quatA\n                  .premultiply(parentRestWorldRotation)\n                  .multiply(restRotationInverse);`, hipsLogic);

fs.writeFileSync('src/avatar/loadMixamoAnimation.ts', code);
