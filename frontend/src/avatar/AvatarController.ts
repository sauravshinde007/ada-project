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

  constructor(private container: HTMLDivElement) {
    this.scene = new THREE.Scene();
    
    // Setup camera
    this.camera = new THREE.PerspectiveCamera(35, container.clientWidth / container.clientHeight, 0.1, 20);
    this.camera.position.set(0, 1.4, 3.0); // Focus on upper body / face

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

          this.currentVrm = vrm;
          this.scene.add(vrm.scene);

          // Return available expressions
          let expressionNames: string[] = [];
          if (this.currentVrm.expressionManager) {
             expressionNames = this.currentVrm.expressionManager.expressions.map(e => e.expressionName);
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
      this.currentVrm.expressionManager.setValue(name, weight);
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
        const spine = this.currentVrm.humanoid.getNormalizedBoneNode('spine');
        if (spine) {
          // Subtle breathing (pitch oscillation)
          spine.rotation.x = Math.sin(time * 2) * 0.02;
        }
      }

      if (this.currentVrm.lookAt) {
        // Smooth interpolation towards the target lookAt position
        this.currentLookAtX += (this.targetLookAtX - this.currentLookAtX) * delta * 5.0;
        this.currentLookAtY += (this.targetLookAtY - this.currentLookAtY) * delta * 5.0;
        const yaw = this.currentLookAtX * 30 * THREE.MathUtils.DEG2RAD;
        const pitch = this.currentLookAtY * -30 * THREE.MathUtils.DEG2RAD;
        this.currentVrm.lookAt.applier.applyYawPitch(yaw, pitch);
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
