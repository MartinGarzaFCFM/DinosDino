import * as THREE from 'three';
import { AssetLoader, IAssetLoader } from './AssetLoader.ts';
import { LevelTheme } from '../core/GameState.ts';
import { LEVEL_REGISTRY } from '../config/LevelRegistry.ts';

export class SceneManager {
  public readonly scene: THREE.Scene;
  private readonly loader: IAssetLoader;
  private readonly ambientLight: THREE.AmbientLight;
  private readonly hemiLight: THREE.HemisphereLight;
  private readonly sunLight: THREE.DirectionalLight;
  private skyMesh?: THREE.Mesh;
  private terrainMesh?: THREE.Mesh;

  constructor(loader: IAssetLoader = AssetLoader.getInstance()) {
    this.loader = loader;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#1a2634');
    this.scene.fog = new THREE.FogExp2('#1a2634', 0.00075);

    // Ambient Lighting
    this.ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    this.scene.add(this.ambientLight);

    // Hemisphere Lighting for natural sky/ground bounce fill (prevents pitch-black shadow silhouettes)
    this.hemiLight = new THREE.HemisphereLight(0xd8ecff, 0x5a554a, 0.85);
    this.scene.add(this.hemiLight);

    // Directional Sunlight with Shadows
    this.sunLight = new THREE.DirectionalLight(0xfff4e5, 1.6);
    this.sunLight.position.set(300, 500, 300);
    this.sunLight.castShadow = true;
    this.sunLight.shadow.mapSize.width = 2048;
    this.sunLight.shadow.mapSize.height = 2048;
    this.sunLight.shadow.camera.near = 10;
    this.sunLight.shadow.camera.far = 1500;
    const d = 450;
    this.sunLight.shadow.camera.left = -d;
    this.sunLight.shadow.camera.right = d;
    this.sunLight.shadow.camera.top = d;
    this.sunLight.shadow.camera.bottom = -d;
    // Positive bias prevents self-shadow acne on large meshes
    this.sunLight.shadow.bias = 0.0002;
    this.scene.add(this.sunLight);
    this.scene.add(this.sunLight.target);
  }

  public async setupEnvironment(theme: LevelTheme): Promise<void> {
    const levelDef = LEVEL_REGISTRY[theme];

    // Update theme atmosphere
    this.scene.background = new THREE.Color(levelDef.fogColor);
    this.scene.fog = new THREE.FogExp2(levelDef.fogColor, levelDef.fogDensity);

    // Setup SkyDome
    try {
      const skyTexture = await this.loader.loadTexture('/assets/texturas/cielo.jpg');
      skyTexture.mapping = THREE.EquirectangularReflectionMapping;

      if (!this.skyMesh) {
        const skyGeo = new THREE.SphereGeometry(1200, 32, 32);
        const skyMat = new THREE.MeshBasicMaterial({
          map: skyTexture,
          side: THREE.BackSide
        });
        this.skyMesh = new THREE.Mesh(skyGeo, skyMat);
        this.skyMesh.userData.ignoreDebugWireframe = true;
        this.scene.add(this.skyMesh);
      }
    } catch (e) {
      console.warn('Could not load sky texture, using background color', e);
    }

    // Setup Ground Material from declarative LevelRegistry
    try {
      const groundTexture = await this.loader.loadTexture(levelDef.groundTextureUrl);
      groundTexture.wrapS = THREE.RepeatWrapping;
      groundTexture.wrapT = THREE.RepeatWrapping;
      groundTexture.repeat.set(levelDef.groundRepeat, levelDef.groundRepeat);

      if (this.terrainMesh) {
        const mat = this.terrainMesh.material as THREE.MeshStandardMaterial;
        mat.map = groundTexture;
        mat.needsUpdate = true;
      }
    } catch (e) {
      console.warn('Could not load ground texture', e);
    }
  }

  public attachTerrain(terrainRoot: THREE.Object3D, groundMesh: THREE.Mesh): void {
    this.terrainMesh = groundMesh;
    this.scene.add(terrainRoot);
  }

  public updateLightTarget(targetPosition: THREE.Vector3): void {
    this.sunLight.target.position.copy(targetPosition);
    this.sunLight.position.set(
      targetPosition.x + 250,
      targetPosition.y + 400,
      targetPosition.z + 250
    );
  }
}
