import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import * as fs from 'fs';
import { JSDOM } from 'jsdom';

const dom = new JSDOM();
global.window = dom.window;
global.document = dom.window.document;

const buffer = fs.readFileSync('public/ada_default_anim/Standing_Idle.fbx');
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

const loader = new FBXLoader();
try {
    const asset = loader.parse(arrayBuffer, '');
    const anim = asset.animations[0];
    
    // Get Hips Parent Rest World
    const hipsNode = asset.getObjectByName('J_Bip_C_Hips');
    const parentRestWorld = new THREE.Quaternion();
    hipsNode.parent.getWorldQuaternion(parentRestWorld);
    
    // Evaluate at t=0
    const mixer = new THREE.AnimationMixer(asset);
    mixer.clipAction(anim).play();
    mixer.setTime(0);
    
    const parentAnimWorld = new THREE.Quaternion();
    hipsNode.parent.getWorldQuaternion(parentAnimWorld);
    
    console.log('Parent Rest World:', parentRestWorld.toArray());
    console.log('Parent Anim World (t=0):', parentAnimWorld.toArray());
} catch (e) {
    console.error(e);
}
