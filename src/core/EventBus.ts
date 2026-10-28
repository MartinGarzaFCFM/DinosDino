import * as THREE from 'three';
import { Difficulty, LevelTheme } from './GameState.ts';

/**
 * Strongly-typed registry of all domain events in the application.
 * Adding a new feature event here provides full compile-time safety across subscribers & emitters.
 */
export interface GameEventMap {
  // Asset & Boot Lifecycle
  asset_progress: { url?: string; ratio: number };

  // UI & Menu Flow
  ui_click: void;
  toggle_music: boolean;
  toggle_sfx: boolean;
  toggle_wireframe_debug: void;
  wireframe_debug_toggled: { enabled: boolean };
  start_game_request: { difficulty: Difficulty; level: LevelTheme };
  resume_game: void;
  return_to_menu: void;

  // Player & Vehicle Events
  player_health_changed: { health: number; max: number };
  player_damaged: { amount: number; health: number };
  player_healed: { amount: number; health: number };
  player_speed_bonus: { bonus: number };
  player_died: void;

  // Pickups & Objectives
  egg_collected: { id: string };
  eggs_updated: { collected: number; total: number };
  pickup_collected: { id: string; type: string };

  // Dinosaur AI Events
  rexy_attack: { position: THREE.Vector3; direction: THREE.Vector3 };
  rexy_slow_requested: { amount: number };
  rexy_slowed: { speed: number };
}

export type EventKey = keyof GameEventMap;
export type EventCallback<K extends EventKey> = GameEventMap[K] extends void
  ? () => void
  : (data: GameEventMap[K]) => void;

/**
 * Dependency Inversion abstraction for event publishing/subscribing.
 */
export interface IEventBus {
  on<K extends EventKey>(event: K, callback: EventCallback<K>): () => void;
  off<K extends EventKey>(event: K, callback: EventCallback<K>): void;
  emit<K extends EventKey>(
    ...args: GameEventMap[K] extends void ? [event: K] : [event: K, data: GameEventMap[K]]
  ): void;
  clear(): void;
}

/**
 * Decoupled EventBus implementing Observer pattern for system communication.
 * Enables zero direct coupling between Physics, Audio, UI, and Entities.
 */
export class EventBus implements IEventBus {
  private static instance: EventBus;
  private listeners: Map<EventKey, Set<(...args: any[]) => void>> = new Map();

  public constructor() {}

  public static getInstance(): EventBus {
    if (!EventBus.instance) {
      EventBus.instance = new EventBus();
    }
    return EventBus.instance;
  }

  public on<K extends EventKey>(event: K, callback: EventCallback<K>): () => void {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set());
    }
    this.listeners.get(event)!.add(callback as (...args: any[]) => void);

    return () => this.off(event, callback);
  }

  public off<K extends EventKey>(event: K, callback: EventCallback<K>): void {
    const set = this.listeners.get(event);
    if (set) {
      set.delete(callback as (...args: any[]) => void);
      if (set.size === 0) {
        this.listeners.delete(event);
      }
    }
  }

  public emit<K extends EventKey>(
    ...args: GameEventMap[K] extends void ? [event: K] : [event: K, data: GameEventMap[K]]
  ): void {
    const [event, data] = args;
    const callbacks = this.listeners.get(event);
    if (callbacks) {
      callbacks.forEach((cb) => {
        try {
          cb(data);
        } catch (err) {
          console.error(`[EventBus] Error in handler for event "${String(event)}":`, err);
        }
      });
    }
  }

  public clear(): void {
    this.listeners.clear();
  }
}
