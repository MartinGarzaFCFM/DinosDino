import * as THREE from 'three';
import { IDebuggable } from '../entities/Entity.ts';
import { EventBus, IEventBus } from '../core/EventBus.ts';

type WireframeMaterial = THREE.Material & { wireframe?: boolean };

/**
 * Single-responsibility manager for scene-wide mesh wireframe rendering
 * and physics collider outline visibility.
 */
export class DebugVisualsManager {
  private enabled: boolean = false;
  private readonly scene: THREE.Scene;
  private readonly bus: IEventBus;
  private readonly debuggables: Set<IDebuggable> = new Set();

  constructor(scene: THREE.Scene, bus: IEventBus = EventBus.getInstance()) {
    this.scene = scene;
    this.bus = bus;
  }

  public get isEnabled(): boolean {
    return this.enabled;
  }

  public register(target: IDebuggable): void {
    this.debuggables.add(target);
    target.setWireframeDebug(this.enabled);
  }

  public unregister(target: IDebuggable): void {
    this.debuggables.delete(target);
  }

  public toggle(): void {
    this.setEnabled(!this.enabled);
  }

  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    this.syncAll();
    this.bus.emit('wireframe_debug_toggled', { enabled: this.enabled });
  }

  /**
   * Synchronizes wireframe state across the entire scene and all registered debuggable entities.
   * Safe to call after spawning new level geometry or restarting an expedition.
   */
  public syncAll(): void {
    this.scene.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (!mesh.isMesh || !mesh.material) return;

      // Skip additive beacon beams/rings whose materials shouldn't turn into wireframes
      if (mesh.userData.ignoreDebugWireframe) return;

      if (Array.isArray(mesh.material)) {
        mesh.material.forEach((mat) => this.applyMaterialWireframe(mat));
      } else {
        this.applyMaterialWireframe(mesh.material);
      }
    });

    this.debuggables.forEach((d) => d.setWireframeDebug(this.enabled));
  }

  private applyMaterialWireframe(material: THREE.Material): void {
    const wireMat = material as WireframeMaterial;
    if ('wireframe' in wireMat) {
      wireMat.wireframe = this.enabled;
    }
  }
}

