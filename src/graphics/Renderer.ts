import * as THREE from 'three';

export class Renderer {
  public readonly instance: THREE.WebGLRenderer;
  private readonly container: HTMLElement;
  private readonly onResizeBound: () => void;

  constructor(container: HTMLElement) {
    this.container = container;
    this.instance = new THREE.WebGLRenderer({
      antialias: true,
      powerPreference: 'high-performance'
    });

    this.instance.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.instance.setSize(container.clientWidth, container.clientHeight);
    this.instance.shadowMap.enabled = true;
    this.instance.shadowMap.type = THREE.PCFShadowMap;
    this.instance.toneMapping = THREE.ACESFilmicToneMapping;
    this.instance.toneMappingExposure = 1.1;

    container.appendChild(this.instance.domElement);

    this.onResizeBound = this.onResize.bind(this);
    window.addEventListener('resize', this.onResizeBound);
  }

  public onResize(): void {
    const width = this.container.clientWidth;
    const height = this.container.clientHeight;
    this.instance.setSize(width, height);
  }

  public render(scene: THREE.Scene, camera: THREE.Camera): void {
    this.instance.render(scene, camera);
  }

  public dispose(): void {
    window.removeEventListener('resize', this.onResizeBound);
    this.instance.dispose();
  }
}
