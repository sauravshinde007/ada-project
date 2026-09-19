import fs from 'fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

// Polyfill for FBXLoader in node
global.window = global;
global.document = { createElement: () => ({ style: {} }) };

const fbxPath = './frontend/public/ada_default_anim/Standing_Idle.fbx';
const buffer = fs.readFileSync(fbxPath);
// FBXLoader needs an ArrayBuffer
const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

// Wait, FBXLoader cannot run trivially in Node.js because it requires DOM/Loader context.
