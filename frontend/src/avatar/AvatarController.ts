import * as THREE from 'three';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { VRMLoaderPlugin, VRM } from '@pixiv/three-vrm';

export class AvatarController {
  private scene: THREE.Scene;
  private camera: THREE.PerspectiveCamera;
  private renderer: THREE.WebGLRenderer;
  private currentVrm: VRM | null = null;
  private clock: THREE.Clock;
  private animationFrameId: number | null = null;
  private blinkTimeout: number | null = null;
  private targetLookAtX = 0;
  private targetLookAtY = 0;
  private currentLookAtX = 0;
  private currentLookAtY = 0;
  private targetExpressions: Record<string, number> = {};
  private currentExpressions: Record<string, number> = {};

  constructor(private container: HTMLDivElement) {
    this.scene = new THREE.Scene();
    
    // Setup camera
    this.camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 20);
    this.camera.position.set(0, 1.4, 1.2); // Focus on upper body / face, zoomed in

    // Setup renderer
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    
    // Modern Three.js color space configuration
    if ('outputColorSpace' in this.renderer) {
      this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    }

    container.appendChild(this.renderer.domElement);

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

          vrm.scene.position.y = 0;
          vrm.scene.rotation.y = 0;

          // Put into a relaxed idle pose instead of T-pose
          if (vrm.humanoid) {
            const leftUpperArm = vrm.humanoid.getNormalizedBoneNode('leftUpperArm');
            const rightUpperArm = vrm.humanoid.getNormalizedBoneNode('rightUpperArm');
            // Rotate arms down (around -1.2/1.2 radians is a natural relaxed drop in VRM normalized space)
            if (leftUpperArm) leftUpperArm.rotation.z = -1.2;
            if (rightUpperArm) rightUpperArm.rotation.z = 1.2;
          }

          this.currentVrm = vrm;
          this.scene.add(vrm.scene);

          // Return available expressions
          let expressionNames: string[] = [];
          if (this.currentVrm.expressionManager) {
             expressionNames = this.currentVrm.expressionManager.expressions.map(e => e.expressionName);
             expressionNames.forEach(name => {
               this.targetExpressions[name] = 0;
               this.currentExpressions[name] = 0;
             });
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

  public playAnimation(name: string): void {
    // Abstraction for future skeletal animation implementation
    if (name && name !== 'neutral') {
      console.log(`[AvatarController] Animation requested: ${name} (Not fully implemented yet)`);
    }
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

    if (this.currentVrm) {
      const time = this.clock.getElapsedTime();
      
      if (this.currentVrm.humanoid) {
        const hips = this.currentVrm.humanoid.getNormalizedBoneNode('hips');
        const spine = this.currentVrm.humanoid.getNormalizedBoneNode('spine');
        const chest = this.currentVrm.humanoid.getNormalizedBoneNode('chest');
        const neck = this.currentVrm.humanoid.getNormalizedBoneNode('neck');
        const leftShoulder = this.currentVrm.humanoid.getNormalizedBoneNode('leftShoulder');
        const rightShoulder = this.currentVrm.humanoid.getNormalizedBoneNode('rightShoulder');
        const leftUpperArm = this.currentVrm.humanoid.getNormalizedBoneNode('leftUpperArm');
        const rightUpperArm = this.currentVrm.humanoid.getNormalizedBoneNode('rightUpperArm');

        // Complex time variables to avoid perfectly repeating loops
        const t1 = time * 0.5;
        const t2 = time * 0.31;
        const t3 = time * 0.73;
        const breath = Math.sin(time * 1.5);

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

        if (leftUpperArm) {
          // Idle arm movement
          leftUpperArm.rotation.z = -1.2 + Math.sin(time * 0.8) * 0.02;
          leftUpperArm.rotation.x = Math.sin(time * 1.1) * 0.02;
        }

        if (rightUpperArm) {
          // Idle arm movement
          rightUpperArm.rotation.z = 1.2 - Math.sin(time * 0.8) * 0.02;
          rightUpperArm.rotation.x = Math.sin(time * 1.1) * 0.02;
        }
      }

      if (this.currentVrm.expressionManager) {
        for (const [name, targetWeight] of Object.entries(this.targetExpressions)) {
          if (name === 'blink') continue; // Handled separately
          const currentWeight = this.currentExpressions[name] || 0;
          const newWeight = THREE.MathUtils.lerp(currentWeight, targetWeight, delta * 5.0);
          this.currentExpressions[name] = newWeight;
          this.currentVrm.expressionManager.setValue(name, newWeight);
        }
      }

      if (this.currentVrm.lookAt) {
        // Smooth interpolation towards the target lookAt position
        this.currentLookAtX += (this.targetLookAtX - this.currentLookAtX) * delta * 5.0;
        this.currentLookAtY += (this.targetLookAtY - this.currentLookAtY) * delta * 5.0;
        
        // Add subtle idle gaze drift so she feels alive even when staring
        const idleYaw = (Math.sin(time * 0.6) + Math.cos(time * 0.35)) * 2 * THREE.MathUtils.DEG2RAD;
        const idlePitch = Math.sin(time * 0.45) * 2 * THREE.MathUtils.DEG2RAD;
        
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
    window.removeEventListener('resize', this.resize);
    
    if (this.renderer) {
      this.renderer.dispose();
      this.container.removeChild(this.renderer.domElement);
    }
  }
}
