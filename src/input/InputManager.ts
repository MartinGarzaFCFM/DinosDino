/**
 * InputManager decouples raw DOM keyboard/touch events from gameplay code.
 * Exposes a normalized, immutable-snapshot input state vector per frame.
 */
export interface InputState {
  throttle: number; // -1 (reverse) to 1 (forward)
  steering: number; // -1 (left) to 1 (right)
  brake: boolean;
  handbrake: boolean;
  toggleCamera: boolean;
  toggleWireframe: boolean;
  toggleDevVision: boolean;
  resetVehicle: boolean;
  pause: boolean;
}

export class InputManager {
  private readonly state: InputState = {
    throttle: 0,
    steering: 0,
    brake: false,
    handbrake: false,
    toggleCamera: false,
    toggleWireframe: false,
    toggleDevVision: false,
    resetVehicle: false,
    pause: false
  };

  // Reusable snapshot object to avoid per-frame object spread allocations
  private readonly snapshot: InputState = {
    throttle: 0,
    steering: 0,
    brake: false,
    handbrake: false,
    toggleCamera: false,
    toggleWireframe: false,
    toggleDevVision: false,
    resetVehicle: false,
    pause: false
  };

  private readonly keysDown: Set<string> = new Set();
  private touchSteer: number = 0;
  private touchThrottle: number = 0;
  private touchBrake: boolean = false;

  private readonly onKeyDownBound: (e: KeyboardEvent) => void;
  private readonly onKeyUpBound: (e: KeyboardEvent) => void;
  private readonly onBlurBound: () => void;

  constructor() {
    this.onKeyDownBound = this.handleKeyDown.bind(this);
    this.onKeyUpBound = this.handleKeyUp.bind(this);
    this.onBlurBound = () => this.keysDown.clear();

    window.addEventListener('keydown', this.onKeyDownBound);
    window.addEventListener('keyup', this.onKeyUpBound);
    window.addEventListener('blur', this.onBlurBound);
  }

  private handleKeyDown(e: KeyboardEvent): void {
    // Ignore hotkeys if user is typing in a form field (e.g., future leaderboard/lobby input)
    const target = e.target as HTMLElement | null;
    if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
      return;
    }

    const key = e.key.toLowerCase();
    this.keysDown.add(key);
    this.keysDown.add(e.code.toLowerCase());

    if (e.repeat) return;

    if (key === 'p' || e.key === 'Escape') {
      this.state.pause = true;
    }
    if (key === 'c' || key === 'g') {
      this.state.toggleCamera = true;
    }
    if (key === 'f') {
      this.state.toggleWireframe = true;
    }
    if (key === '`' || key === '~' || key === 'v') {
      this.state.toggleDevVision = true;
    }
    if (key === 'r') {
      this.state.resetVehicle = true;
    }
  }

  private handleKeyUp(e: KeyboardEvent): void {
    this.keysDown.delete(e.key.toLowerCase());
    this.keysDown.delete(e.code.toLowerCase());
  }

  public setTouchInputs(throttle: number, steer: number, brake: boolean): void {
    this.touchThrottle = throttle;
    this.touchSteer = steer;
    this.touchBrake = brake;
  }

  public update(): Readonly<InputState> {
    let forward = 0;
    if (this.keysDown.has('w') || this.keysDown.has('arrowup')) forward += 1;
    if (this.keysDown.has('s') || this.keysDown.has('arrowdown')) forward -= 1;

    let steer = 0;
    if (this.keysDown.has('a') || this.keysDown.has('arrowleft')) steer -= 1;
    if (this.keysDown.has('d') || this.keysDown.has('arrowright')) steer += 1;

    const brake = this.keysDown.has(' ') || this.keysDown.has('b') || this.touchBrake;

    this.state.throttle = this.touchThrottle !== 0 ? this.touchThrottle : forward;
    this.state.steering = this.touchSteer !== 0 ? this.touchSteer : steer;
    this.state.brake = brake;
    this.state.handbrake = this.keysDown.has('shift') || brake;

    this.snapshot.throttle = this.state.throttle;
    this.snapshot.steering = this.state.steering;
    this.snapshot.brake = this.state.brake;
    this.snapshot.handbrake = this.state.handbrake;
    this.snapshot.toggleCamera = this.state.toggleCamera;
    this.snapshot.toggleWireframe = this.state.toggleWireframe;
    this.snapshot.toggleDevVision = this.state.toggleDevVision;
    this.snapshot.resetVehicle = this.state.resetVehicle;
    this.snapshot.pause = this.state.pause;

    // Reset one-shot edge triggers after consuming
    this.state.toggleCamera = false;
    this.state.toggleWireframe = false;
    this.state.toggleDevVision = false;
    this.state.resetVehicle = false;
    this.state.pause = false;

    return this.snapshot;
  }

  public dispose(): void {
    window.removeEventListener('keydown', this.onKeyDownBound);
    window.removeEventListener('keyup', this.onKeyUpBound);
    window.removeEventListener('blur', this.onBlurBound);
    this.keysDown.clear();
  }
}
