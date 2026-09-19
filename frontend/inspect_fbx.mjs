import fs from 'fs';
import * as THREE from 'three';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';

const fbxPath = './public/ada_default_anim/Standing_Idle.fbx';
const buffer = fs.readFileSync(fbxPath);
console.log("File size:", buffer.length);
