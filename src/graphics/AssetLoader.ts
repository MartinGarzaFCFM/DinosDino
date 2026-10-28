import * as THREE from 'three';
import { GLTF, GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js';
import { EventBus, IEventBus } from '../core/EventBus.ts';

/**
 * Dependency Inversion contract for asynchronous asset loading.
 */
export interface IAssetLoader {
  loadGLTF(url: string): Promise<GLTF>;
  loadFBX(url: string): Promise<THREE.Group>;
  loadTexture(url: string): Promise<THREE.Texture>;
  loadAudio(url: string): Promise<AudioBuffer>;
  preloadGameAssets(): Promise<void>;
}

export class AssetLoader implements IAssetLoader {
  private static instance: AssetLoader;
  private readonly bus: IEventBus;
  private readonly gltfLoader: GLTFLoader;
  private readonly fbxLoader: FBXLoader;
  private readonly textureLoader: THREE.TextureLoader;
  private readonly audioLoader: THREE.AudioLoader;

  // Storing Promises prevents duplicate concurrent network fetches and main-thread parsing
  private readonly gltfPromises: Map<string, Promise<GLTF>> = new Map();
  private readonly fbxPromises: Map<string, Promise<THREE.Group>> = new Map();
  private readonly texturePromises: Map<string, Promise<THREE.Texture>> = new Map();
  private readonly audioPromises: Map<string, Promise<AudioBuffer>> = new Map();

  public constructor(bus: IEventBus = EventBus.getInstance()) {
    this.bus = bus;
    this.gltfLoader = new GLTFLoader();
    this.fbxLoader = new FBXLoader();
    this.textureLoader = new THREE.TextureLoader();
    this.audioLoader = new THREE.AudioLoader();
  }

  public static getInstance(): AssetLoader {
    if (!AssetLoader.instance) {
      AssetLoader.instance = new AssetLoader();
    }
    return AssetLoader.instance;
  }

  /**
   * Resolves root-relative '/assets/...' paths against Vite's configured BASE_URL
   * so assets load identically on localhost ('/') and GitHub Pages ('/DinosDino/').
   */
  private resolveUrl(url: string): string {
    const base = import.meta.env.BASE_URL || '/';
    if (url.startsWith('/') && base !== '/') {
      return `${base.replace(/\/$/, '')}${url}`;
    }
    return url;
  }

  public loadGLTF(url: string): Promise<GLTF> {
    const resolvedUrl = this.resolveUrl(url);
    if (this.gltfPromises.has(resolvedUrl)) {
      return this.gltfPromises.get(resolvedUrl)!;
    }

    const promise = new Promise<GLTF>((resolve, reject) => {
      this.gltfLoader.load(
        resolvedUrl,
        (gltf) => resolve(gltf),
        (xhr) => {
          if (xhr.total > 0) {
            this.bus.emit('asset_progress', { url: resolvedUrl, ratio: xhr.loaded / xhr.total });
          }
        },
        (error) => {
          this.gltfPromises.delete(resolvedUrl);
          reject(error);
        }
      );
    });

    this.gltfPromises.set(resolvedUrl, promise);
    return promise;
  }

  public loadFBX(url: string): Promise<THREE.Group> {
    const resolvedUrl = this.resolveUrl(url);
    if (this.fbxPromises.has(resolvedUrl)) {
      return this.fbxPromises.get(resolvedUrl)!;
    }

    const promise = new Promise<THREE.Group>((resolve, reject) => {
      this.fbxLoader.load(
        resolvedUrl,
        (fbx) => resolve(fbx),
        (xhr) => {
          if (xhr.total > 0) {
            this.bus.emit('asset_progress', { url: resolvedUrl, ratio: xhr.loaded / xhr.total });
          }
        },
        (error) => {
          this.fbxPromises.delete(resolvedUrl);
          reject(error);
        }
      );
    });

    this.fbxPromises.set(resolvedUrl, promise);
    return promise;
  }

  public loadTexture(url: string): Promise<THREE.Texture> {
    const resolvedUrl = this.resolveUrl(url);
    if (this.texturePromises.has(resolvedUrl)) {
      return this.texturePromises.get(resolvedUrl)!;
    }

    const promise = new Promise<THREE.Texture>((resolve, reject) => {
      this.textureLoader.load(
        resolvedUrl,
        (texture) => resolve(texture),
        undefined,
        (error) => {
          this.texturePromises.delete(resolvedUrl);
          reject(error);
        }
      );
    });

    this.texturePromises.set(resolvedUrl, promise);
    return promise;
  }

  public loadAudio(url: string): Promise<AudioBuffer> {
    const resolvedUrl = this.resolveUrl(url);
    if (this.audioPromises.has(resolvedUrl)) {
      return this.audioPromises.get(resolvedUrl)!;
    }

    const promise = new Promise<AudioBuffer>((resolve, reject) => {
      this.audioLoader.load(
        resolvedUrl,
        (buffer) => resolve(buffer),
        undefined,
        (error) => {
          this.audioPromises.delete(resolvedUrl);
          reject(error);
        }
      );
    });

    this.audioPromises.set(resolvedUrl, promise);
    return promise;
  }

  /**
   * Preload critical 3D assets & textures during the boot loading screen.
   */
  public async preloadGameAssets(): Promise<void> {
    const assets: Array<() => Promise<unknown>> = [
      () => this.loadGLTF('/assets/modelos/Carro/carro.gltf'),
      () => this.loadGLTF('/assets/modelos/Rexy/Rexy.gltf'),
      () => this.loadFBX('/assets/modelos/Huevo.fbx'),
      () => this.loadFBX('/assets/modelos/tire.fbx'),
      () => this.loadFBX('/assets/modelos/Spray.fbx'),
      () => this.loadFBX('/assets/modelos/Heart.fbx'),
      () => this.loadFBX('/assets/modelos/Edificios/Lab.fbx'),
      () => this.loadFBX('/assets/modelos/Edificios/Museo.fbx'),
      () => this.loadFBX('/assets/modelos/Cabin.fbx'),
      () => this.loadTexture('/assets/texturas/suelo.jpg'),
      () => this.loadTexture('/assets/texturas/cielo.jpg')
    ];

    let loaded = 0;
    for (const loadFn of assets) {
      try {
        await loadFn();
      } catch (err) {
        console.warn('Asset preload warning:', err);
      }
      loaded++;
      this.bus.emit('asset_progress', { ratio: loaded / assets.length });
    }
  }
}
