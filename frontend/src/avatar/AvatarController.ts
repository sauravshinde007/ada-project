import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRM } from '@pixiv/three-vrm';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

export class AvatarController {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private controls: OrbitControls;
  private isInteracting: boolean = false;
  private interactionTimeout: number | null = null;
  private defaultCameraPosition = new THREE.Vector3(0, 1.4, 1.2);
  private defaultCameraTarget = new THREE.Vector3(0, 1.3, 0);
  private currentVrm: VRM | null = null;
  private mixer: THREE.AnimationMixer | null = null;
  private animations: Record<string, THREE.AnimationClip> = {};
  private currentAction: THREE.AnimationAction | null = null;
  private clock: THREE.Clock;
  private animationFrameId: number | null = null;
  private blinkTimeout: number | null = null;
  private targetLookAtX = 0;
  private targetLookAtY = 0;
  private currentLookAtX = 0;
  private currentLookAtY = 0;
  private targetExpressions: Record<string, number> = {};
  private currentExpressions: Record<string, number> = {};
  private isTalking: boolean = false;
  private isThinking: boolean = false;
  private thinkingWeight: number = 0;
  private currentMouthOpen: number = 0;
  private mouthExpression: string = 'aa';

  constructor(private container: HTMLDivElement) {
    this.scene = new THREE.Scene();
    
    // Setup camera
    const width = container.clientWidth;
    const height = container.clientHeight;
    this.camera = new THREE.PerspectiveCamera(30, width / height, 0.1, 20.0);
    this.camera.position.copy(this.defaultCameraPosition);
    // Tilt the camera's up vector slightly to the left to counteract the model's tilt
    this.camera.up.set(-0.08, 0.996, 0).normalize();

    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.container.appendChild(this.renderer.domElement);

    // Setup controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.target.copy(this.defaultCameraTarget);
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.05;
    this.controls.maxPolarAngle = Math.PI / 1.5;
    this.controls.minDistance = 0.5;
    this.controls.maxDistance = 5;

    this.controls.addEventListener('start', () => {
      this.isInteracting = true;
      if (this.interactionTimeout !== null) {
        window.clearTimeout(this.interactionTimeout);
      }
    });

    this.controls.addEventListener('end', () => {
      this.interactionTimeout = window.setTimeout(() => {
        this.isInteracting = false;
      }, 2000);
    });
    
    // Modern Three.js color space configuration
    if ('outputColorSpace' in this.renderer) {
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    }

    // Setup lighting
    const light = new THREE.DirectionalLight(0xffffff, Math.PI);
    light.position.set(1.0, 1.0, 1.0).normalize();
    this.scene.add(light);

    const ambientLight = new THREE.AmbientLight(0xffffff, 0.4);
    this.scene.add(ambientLight);

    this.clock = new THREE.Clock();

    this.animate = this.animate.bind(this);
    this.resize = this.resize.bind(this);

    window.addEventListener('resize', this.resize);
    this.animate();
  }

  public async load(url: string, onProgress?: (progress: number) => void): Promise<string[]> {
    const loader = new GLTFLoader();
    
    loader.crossOrigin = 'anonymous';
    
    loader.register((parser) => {
      return new VRMLoaderPlugin(parser);
    });

    return new Promise((resolve, reject) => {
      loader.load(
        url,
        (gltf) => {
          const vrm = gltf.userData.vrm as VRM;
          if (!vrm) {
             reject(new Error("Not a valid VRM model"));
             return;
          }
          
          if (this.currentVrm) {
            this.scene.remove(this.currentVrm.scene);
          }

          this.currentVrm = vrm;
          console.log(`META VERSION: ${vrm.meta?.metaVersion}`);
          this.scene.add(vrm.scene);
          this.mixer = new THREE.AnimationMixer(vrm.scene);

          // Put into a relaxed idle pose instead of T-pose
          if (vrm.humanoid) {
            const leftUpperArm = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
            const rightUpperArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
            // Rotate arms down (around -1.2/1.2 radians is a natural relaxed drop in VRM normalized space)
            if (leftUpperArm) leftUpperArm.rotation.z = -1.2;
            if (rightUpperArm) rightUpperArm.rotation.z = 1.2;
          }

          // Return available expressions
          let expressionNames: string[] = [];
          if (this.currentVrm.expressionManager) {
             expressionNames = this.currentVrm.expressionManager.expressions.map(e => e.expressionName);
             expressionNames.forEach(name => {
               this.targetExpressions[name] = 0;
               this.currentExpressions[name] = 0;
             });
             if (expressionNames.includes('aa')) {
                 this.mouthExpression = 'aa';
             } else if (expressionNames.includes('a')) {
                 this.mouthExpression = 'a';
             }
          }

          this.startBlinking();

          resolve(expressionNames);
        },
        (progress) => {
          if (onProgress) {
            onProgress(progress.loaded / progress.total);
          }
        },
        (error) => {
          console.error(error);
          reject(error);
        }
      );
    });
  }

  public setExpression(name: string, weight: number): void {
    if (this.currentVrm && this.currentVrm.expressionManager) {
      if (this.targetExpressions[name] !== undefined) {
        this.targetExpressions[name] = weight;
      } else {
        this.currentVrm.expressionManager.setValue(name, weight);
      }
    }
  }

  public async loadAnimation(url: string, name: string): Promise<void> {
    if (!this.currentVrm) return;
    try {
      const { loadMixamoAnimation } = await import('./loadMixamoAnimation');
      const clip = await loadMixamoAnimation(url, this.currentVrm);
      clip.name = name;
      this.animations[name] = clip;
    } catch (err) {
      console.error(`Failed to load animation ${name} from ${url}:`, err);
    }
  }

  public playAnimation(name: string): void {
    if (!this.mixer || !this.animations[name]) {
      if (name && name !== 'neutral') {
        console.log(`[AvatarController] Animation requested: ${name} (Not fully implemented yet or not loaded)`);
      }
      return;
    }
    
    const clip = this.animations[name];
    const newAction = this.mixer.clipAction(clip);
    
    if (this.currentAction && this.currentAction !== newAction) {
       this.currentAction.crossFadeTo(newAction, 0.5, true);
       this.currentAction.stop();
    }
    
    newAction.play();
    this.currentAction = newAction;
  }

  public setTalking(talking: boolean): void {
    this.isTalking = talking;
  }

  public setThinking(thinking: boolean): void {
    this.isThinking = thinking;
  }

  public lookAt(x: number, y: number): void {
    this.targetLookAtX = x;
    this.targetLookAtY = y;
  }

  private startBlinking() {
    if (this.blinkTimeout) clearTimeout(this.blinkTimeout);
    
    const blink = () => {
      if (this.currentVrm && this.currentVrm.expressionManager) {
         let t = 0;
         const blinkDuration = 0.2;
         const interval = setInterval(() => {
            t += 0.05;
            let weight = 0;
            if (t < blinkDuration / 2) {
                weight = t / (blinkDuration / 2);
            } else if (t < blinkDuration) {
                weight = 1 - ((t - blinkDuration / 2) / (blinkDuration / 2));
            } else {
                weight = 0;
                clearInterval(interval);
                this.blinkTimeout = window.setTimeout(blink, 2000 + Math.random() * 4000);
            }
            this.currentVrm!.expressionManager!.setValue('blink', weight);
         }, 50);
      }
    };
    
    this.blinkTimeout = window.setTimeout(blink, 2000);
  }

  public resize(): void {
    if (!this.container) return;
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();

    this.renderer.setSize(width, height);
  }

  public resizeTo(width: number, height: number): void {
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }



  private animate(): void {
    this.animationFrameId = requestAnimationFrame(this.animate);
    
    const delta = this.clock.getDelta();

    if (!this.isInteracting && this.controls) {
      this.camera.position.lerp(this.defaultCameraPosition, delta * 3.0);
      this.controls.target.lerp(this.defaultCameraTarget, delta * 3.0);
    }
    if (this.controls) {
      this.controls.update();
    }

    if (this.currentVrm) {
      this.mixer?.update(delta);
      const time = this.clock.getElapsedTime();
      
      if (this.currentVrm.humanoid) {
        const hips = this.currentVrm.humanoid.getNormalizedBoneNode('hips');
        const spine = this.currentVrm.humanoid.getNormalizedBoneNode('spine');
        const chest = this.currentVrm.humanoid.getNormalizedBoneNode('chest');
        const neck = this.currentVrm.humanoid.getNormalizedBoneNode('neck');
        
        const leftShoulder = this.currentVrm.humanoid.getNormalizedBoneNode('leftShoulder');
        const rightShoulder = this.currentVrm.humanoid.getNormalizedBoneNode('rightShoulder');
        
        const leftUpperArm = this.currentVrm.humanoid.getNormalizedBoneNode('leftUpperArm');
        const leftLowerArm = this.currentVrm.humanoid.getNormalizedBoneNode('leftLowerArm');
        const leftHand = this.currentVrm.humanoid.getNormalizedBoneNode('leftHand');
        
        const rightUpperArm = this.currentVrm.humanoid.getNormalizedBoneNode('rightUpperArm');
        const rightLowerArm = this.currentVrm.humanoid.getNormalizedBoneNode('rightLowerArm');
        const rightHand = this.currentVrm.humanoid.getNormalizedBoneNode('rightHand');

        // Thinking state uses standard idle body but looks away slightly (handled in gaze tracking)
        // More active states could speed up breathing or change posture
        let breathRate = 1.0;
        if (this.isThinking || this.isTalking) {
            breathRate = 1.5;
        }
        
        // Procedural breathing / subtle body sway
        const t1 = time * breathRate;
        const t2 = time * 0.8 * breathRate;
        const t3 = time * 0.6 * breathRate;
        
        // Smoothly interpolate breath weight
        this.thinkingWeight = THREE.MathUtils.lerp(
          this.thinkingWeight,
          (this.isThinking && !this.isTalking) ? 1.0 : 0.0,
          delta * 4.0
        );

        const breath = Math.sin(t1) * 0.5 + 0.5;

        if (!this.currentAction) {
          if (hips) {
            // Small natural body/weight shifts
            hips.rotation.z = Math.cos(time * 0.25) * 0.01;
            hips.rotation.y = Math.sin(time * 0.15) * 0.02;
          }

          if (spine) {
            // Subtle body movement and breathing pitch
            spine.rotation.x = breath * 0.015 + Math.sin(t2) * 0.01;
            spine.rotation.y = Math.sin(t1) * 0.015;
            spine.rotation.z = Math.cos(t3) * 0.01;
          }

          if (chest) {
            // Chest expansion for breathing
            chest.scale.set(
              1 + breath * 0.01,
              1 + breath * 0.01,
              1 + breath * 0.02
            );
          }

          if (neck) {
            // Slight neck/head idle motion
            neck.rotation.x = Math.sin(t1 * 1.2) * 0.01;
            neck.rotation.y = Math.cos(t2 * 1.1) * 0.01;
            neck.rotation.z = Math.sin(t3 * 0.9) * 0.01;
          }

          if (leftShoulder) {
            // Subtle shoulder breathing shrug
            leftShoulder.rotation.z = breath * 0.01 + 0.02;
          }
          
          if (rightShoulder) {
            rightShoulder.rotation.z = -breath * 0.01 - 0.02;
          }

          if (leftUpperArm && leftLowerArm && leftHand && rightUpperArm && rightLowerArm && rightHand) {
            // --- IDLE POSE ---
            const idlePose = {
              leftUpperArm: { x: Math.sin(time * 1.1) * 0.02, y: 0, z: -1.2 + Math.sin(time * 0.8) * 0.02 },
              leftLowerArm: { x: 0, y: 0, z: 0 },
              leftHand: { x: 0, y: 0, z: 0 },
              rightUpperArm: { x: Math.sin(time * 1.1) * 0.02, y: 0, z: 1.2 - Math.sin(time * 0.8) * 0.02 },
              rightLowerArm: { x: 0, y: 0, z: 0 },
              rightHand: { x: 0, y: 0, z: 0 }
            };

            leftUpperArm.rotation.set(idlePose.leftUpperArm.x, idlePose.leftUpperArm.y, idlePose.leftUpperArm.z);
            leftLowerArm.rotation.set(idlePose.leftLowerArm.x, idlePose.leftLowerArm.y, idlePose.leftLowerArm.z);
            leftHand.rotation.set(idlePose.leftHand.x, idlePose.leftHand.y, idlePose.leftHand.z);
            
            rightUpperArm.rotation.set(idlePose.rightUpperArm.x, idlePose.rightUpperArm.y, idlePose.rightUpperArm.z);
            rightLowerArm.rotation.set(idlePose.rightLowerArm.x, idlePose.rightLowerArm.y, idlePose.rightLowerArm.z);
            rightHand.rotation.set(idlePose.rightHand.x, idlePose.rightHand.y, idlePose.rightHand.z);
          }
        }
      }

      if (this.currentVrm.expressionManager) {
        for (const [name, targetWeight] of Object.entries(this.targetExpressions)) {
          if (name === 'blink') continue; // Handled separately
          if (name === this.mouthExpression) continue; // Handled separately for lip sync

          const currentWeight = this.currentExpressions[name] || 0;
          const newWeight = THREE.MathUtils.lerp(currentWeight, targetWeight, delta * 5.0);
          this.currentExpressions[name] = newWeight;
          this.currentVrm.expressionManager.setValue(name, newWeight);
        }

        // Procedural Lip Sync
        if (this.isTalking) {
           const t = time * 15;
           // Mix sine waves to look like natural talking rather than a steady pulse
           let talkVal = (Math.sin(t) + Math.sin(t * 1.3) + Math.sin(t * 0.7)) / 3;
           talkVal = Math.abs(talkVal) * 0.7 + 0.1; // keep mouth slightly open
           this.currentMouthOpen = THREE.MathUtils.lerp(this.currentMouthOpen, talkVal, delta * 15);
        } else {
           this.currentMouthOpen = THREE.MathUtils.lerp(this.currentMouthOpen, 0, delta * 15);
        }
        
        this.currentVrm.expressionManager.setValue(this.mouthExpression, this.currentMouthOpen);
      }

      if (this.currentVrm.lookAt) {
        // Smooth interpolation towards the target lookAt position
        this.currentLookAtX += (this.targetLookAtX - this.currentLookAtX) * delta * 5.0;
        this.currentLookAtY += (this.targetLookAtY - this.currentLookAtY) * delta * 5.0;
        
        // Add subtle idle gaze drift so she feels alive even when staring
        let idleYaw = (Math.sin(time * 0.6) + Math.cos(time * 0.35)) * 2 * THREE.MathUtils.DEG2RAD;
        let idlePitch = Math.sin(time * 0.45) * 2 * THREE.MathUtils.DEG2RAD;
        
        // During thinking, drift gaze upwards/away
        idleYaw += this.thinkingWeight * (15 * THREE.MathUtils.DEG2RAD);
        idlePitch += this.thinkingWeight * (-12 * THREE.MathUtils.DEG2RAD); 
        
        const maxYaw = 40 * THREE.MathUtils.DEG2RAD;
        const maxPitch = 30 * THREE.MathUtils.DEG2RAD;
        
        const baseYaw = this.currentLookAtX * maxYaw;
        const basePitch = this.currentLookAtY * -maxPitch;
        
        const finalYaw = THREE.MathUtils.clamp(baseYaw + idleYaw, -maxYaw, maxYaw);
        const finalPitch = THREE.MathUtils.clamp(basePitch + idlePitch, -maxPitch, maxPitch);
        
        this.currentVrm.lookAt.applier.applyYawPitch(finalYaw, finalPitch);
      }

      this.currentVrm.update(delta);
    }

    this.renderer.render(this.scene, this.camera);
  }

  public dispose(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
    }
    if (this.blinkTimeout !== null) {
      clearTimeout(this.blinkTimeout);
    }
    if (this.interactionTimeout !== null) {
      window.clearTimeout(this.interactionTimeout);
    }
    window.removeEventListener('resize', this.resize);
    
    if (this.controls) {
      this.controls.dispose();
    }
    
    if (this.renderer) {
      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
