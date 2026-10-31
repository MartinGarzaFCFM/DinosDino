import { EventBus, IEventBus } from '../core/EventBus.ts';
import { Vehicle } from '../entities/vehicle/Vehicle.ts';
import { Rexy } from '../entities/dinosaur/Rexy.ts';
import { TerrainBody, TerrainSurfaceInfo } from '../physics/TerrainBody.ts';
import { VEHICLE_CONFIG, REXY_CONFIG } from '../config/GameBalance.ts';
import { CameraController } from '../graphics/CameraController.ts';

export interface DevActionLog {
  timeStr: string;
  category: 'PICKUP' | 'REXY' | 'COMBAT' | 'WORLD' | 'VEHICLE';
  text: string;
  color: string;
}

/**
 * Developer Vision / Debug Mode overlay.
 * Gated exclusively by import.meta.env.DEV:
 * in production builds, this class does zero DOM work and incurs zero runtime cost.
 */
export class DevVisionOverlay {
  private readonly bus: IEventBus;
  private readonly root?: HTMLElement;
  private readonly unbindFns: Array<() => void> = [];
  private isVisible: boolean = false;
  private logs: DevActionLog[] = [];

  // Active target entity references for live parameter mutations
  private activePlayer?: Vehicle;
  private activeRexy?: Rexy;
  private activeCamera?: CameraController;
  private isRexyFrozen: boolean = false;

  // Smooth FPS tracking
  private lastTime: number = performance.now();
  private frames: number = 0;
  private fps: number = 60;

  // Cached DOM elements for minimal per-frame layout recalculations
  private fpsEl?: HTMLElement;
  private rexyStateEl?: HTMLElement;
  private rexySpeedEl?: HTMLElement;
  private rexyDistEl?: HTMLElement;
  private rexyTimerEl?: HTMLElement;
  private rexyEnragedEl?: HTMLElement;
  private vehicleSpeedEl?: HTMLElement;
  private vehicleForceEl?: HTMLElement;
  private vehicleTractionEl?: HTMLElement;
  private vehiclePosEl?: HTMLElement;
  private terrainZoneEl?: HTMLElement;
  private terrainElevationEl?: HTMLElement;
  private terrainDampingEl?: HTMLElement;
  private logListEl?: HTMLElement;

  // Live Tuning Slider input references
  private sliders: Record<string, HTMLInputElement> = {};
  private sliderBadges: Record<string, HTMLElement> = {};

  constructor(container: HTMLElement, bus: IEventBus = EventBus.getInstance()) {
    this.bus = bus;

    // Strict Dev-Only Guard
    if (!import.meta.env.DEV) {
      return;
    }

    this.root = document.createElement('div');
    this.root.id = 'dev-vision-panel';
    this.root.className = 'glass-panel dev-vision-panel';
    this.renderInitialStructure();
    container.appendChild(this.root);

    this.setupBusListeners();
    this.setupTabControls();
    this.setupSliderListeners();

    // Start active by default in dev mode
    this.setVisible(true);
  }

  private renderInitialStructure(): void {
    if (!this.root) return;

    this.root.innerHTML = `
      <div class="dev-header">
        <div class="dev-badge"><span class="dev-dot"></span>DEV VISION</div>
        <div class="dev-fps" id="dev-fps">60 FPS</div>
        <span class="dev-keyhint">[~ / V]</span>
      </div>

      <!-- Navigation Tabs -->
      <div class="dev-tabs">
        <button class="dev-tab-btn active" data-tab="telemetry">📊 TELEMETRY</button>
        <button class="dev-tab-btn" data-tab="tuning">🎛️ LIVE TUNING</button>
      </div>

      <!-- Quick Control: Freeze Rexy AI Toggle -->
      <div class="dev-freeze-bar">
        <button id="dev-freeze-rexy-btn" class="dev-freeze-btn" title="Stop/Pause Rexy from chasing, attacking, or roaring">
          <span id="dev-freeze-icon">⏸️</span>
          <span>REXY AI:</span>
          <span id="dev-freeze-status" class="dev-freeze-status">ACTIVE</span>
        </button>
      </div>

      <!-- TAB 1: Real-time Telemetry & Logs -->
      <div id="dev-tab-telemetry" class="dev-tab-content active">
        <!-- Rexy AI Monitor -->
        <div class="dev-section">
          <div class="dev-section-title">🦖 REXY APEX PREDATOR</div>
          <div class="dev-row">
            <span class="dev-label">State:</span>
            <span id="dev-rexy-state" class="dev-state-badge state-chasing">CHASING</span>
          </div>
          <div class="dev-row">
            <span class="dev-label">Speed:</span>
            <span id="dev-rexy-speed" class="dev-value">63 KM/H</span>
          </div>
          <div class="dev-row">
            <span class="dev-label">Target Dist:</span>
            <span id="dev-rexy-dist" class="dev-value">0.0 m</span>
          </div>
          <div class="dev-row">
            <span class="dev-label">Timers:</span>
            <span id="dev-rexy-timer" class="dev-value">Sprint CD: 0.0s</span>
          </div>
          <div class="dev-row">
            <span class="dev-label">Enraged:</span>
            <span id="dev-rexy-enraged" class="dev-value">NO</span>
          </div>
        </div>

        <!-- Vehicle Telemetry -->
        <div class="dev-section">
          <div class="dev-section-title">🏎️ VEHICLE TELEMETRY</div>
          <div class="dev-row">
            <span class="dev-label">Velocity:</span>
            <span id="dev-veh-speed" class="dev-value">0 KM/H (0.0 u/s | 0.0 len/s)</span>
          </div>
          <div class="dev-row">
            <span class="dev-label">Thrust Accel:</span>
            <span id="dev-veh-force" class="dev-value">${VEHICLE_CONFIG.acceleration.toFixed(1)} m/s²</span>
          </div>
          <div class="dev-row">
            <span class="dev-label">Drift Grip:</span>
            <span id="dev-veh-traction" class="dev-value">${VEHICLE_CONFIG.driftGrip.toFixed(1)} (Arcade Grip)</span>
          </div>
          <div class="dev-row">
            <span class="dev-label">Coords:</span>
            <span id="dev-veh-pos" class="dev-value">X: 0 | Y: 0 | Z: 0</span>
          </div>
        </div>

        <!-- Terrain & Hindrance Monitor -->
        <div class="dev-section">
          <div class="dev-section-title">🗺️ TERRAIN & SURFACE</div>
          <div class="dev-row">
            <span class="dev-label">Zone:</span>
            <span id="dev-terrain-zone" class="dev-value">Plains</span>
          </div>
          <div class="dev-row">
            <span class="dev-label">Elevation / Slope:</span>
            <span id="dev-terrain-elev" class="dev-value">0.0m | 0.0°</span>
          </div>
          <div class="dev-row">
            <span class="dev-label">Surface Drag:</span>
            <span id="dev-terrain-damping" class="dev-value">Normal (0.0 m/s²)</span>
          </div>
        </div>

        <!-- Real-time Action Feed -->
        <div class="dev-section dev-feed-section">
          <div class="dev-section-title">⚡ ACTION FEED</div>
          <div id="dev-action-log" class="dev-action-log">
            <div class="dev-log-item"><span class="dev-log-time">--:--:--</span> Ready.</div>
          </div>
        </div>
      </div>

      <!-- TAB 2: Live Physics & AI Tuning Sliders -->
      <div id="dev-tab-tuning" class="dev-tab-content">
        <div class="dev-section">
          <div class="dev-section-title">🏎️ ARCADE DRIVING DYNAMICS</div>
          
          <div class="dev-slider-item">
            <div class="dev-slider-header">
              <span class="dev-label">Top Speed Cap:</span>
              <span id="badge-veh-maxspeed" class="dev-slider-val">${VEHICLE_CONFIG.maxSpeedKmh} km/h</span>
            </div>
            <input type="range" id="tune-veh-maxspeed" class="dev-slider" min="100" max="420" step="5" value="${VEHICLE_CONFIG.maxSpeedKmh}" />
            <div class="dev-slider-desc">Straight-line cruising speed ceiling in km/h. Tune up to 420 km/h for supersonic runs.</div>
          </div>

          <div class="dev-slider-item">
            <div class="dev-slider-header">
              <span class="dev-label">Throttle Acceleration:</span>
              <span id="badge-veh-accel" class="dev-slider-val">${VEHICLE_CONFIG.acceleration.toFixed(1)} m/s²</span>
            </div>
            <input type="range" id="tune-veh-accel" class="dev-slider" min="10.0" max="90.0" step="1.0" value="${VEHICLE_CONFIG.acceleration}" />
            <div class="dev-slider-desc">Forward thrust. Instant arcade response; reaches 100 km/h in < 0.8s. Up to 90 m/s² for blistering rocket thrust.</div>
          </div>

          <div class="dev-slider-item">
            <div class="dev-slider-header">
              <span class="dev-label">Launch Punch Boost:</span>
              <span id="badge-veh-launch" class="dev-slider-val">${VEHICLE_CONFIG.launchBoost.toFixed(1)}x</span>
            </div>
            <input type="range" id="tune-veh-launch" class="dev-slider" min="1.0" max="5.0" step="0.1" value="${VEHICLE_CONFIG.launchBoost}" />
            <div class="dev-slider-desc">Low-speed punch multiplier (0–65% top speed) for explosive breakaway off the line.</div>
          </div>

          <div class="dev-slider-item">
            <div class="dev-slider-header">
              <span class="dev-label">Braking Deceleration:</span>
              <span id="badge-veh-brake" class="dev-slider-val">${VEHICLE_CONFIG.brakeDecel.toFixed(1)} m/s²</span>
            </div>
            <input type="range" id="tune-veh-brake" class="dev-slider" min="10" max="90" step="2" value="${VEHICLE_CONFIG.brakeDecel}" />
            <div class="dev-slider-desc">Active stopping power when pressing Space (handbrake) or S (reverse brake).</div>
          </div>

          <div class="dev-slider-item">
            <div class="dev-slider-header">
              <span class="dev-label">Steering Sensitivity:</span>
              <span id="badge-veh-steer" class="dev-slider-val">${VEHICLE_CONFIG.turnSpeed.toFixed(2)} rad/s</span>
            </div>
            <input type="range" id="tune-veh-steer" class="dev-slider" min="0.8" max="4.0" step="0.05" value="${VEHICLE_CONFIG.turnSpeed}" />
            <div class="dev-slider-desc">Lower angular steering sensitivity for weighted, stable high-speed cornering and heavy power-drifting.</div>
          </div>

          <div class="dev-slider-item">
            <div class="dev-slider-header">
              <span class="dev-label">Drift & Lateral Grip:</span>
              <span id="badge-veh-drift" class="dev-slider-val">${VEHICLE_CONFIG.driftGrip.toFixed(1)}</span>
            </div>
            <input type="range" id="tune-veh-drift" class="dev-slider" min="2.0" max="25.0" step="0.5" value="${VEHICLE_CONFIG.driftGrip}" />
            <div class="dev-slider-desc">Lateral grip speed. Lower = thrilling power-slide drift; Higher = razor rail-car grip.</div>
          </div>

          <div class="dev-slider-item">
            <div class="dev-slider-header">
              <span class="dev-label">Chassis Gravity:</span>
              <span id="badge-world-gravity" class="dev-slider-val">${VEHICLE_CONFIG.gravity} m/s²</span>
            </div>
            <input type="range" id="tune-world-gravity" class="dev-slider" min="15" max="85" step="1" value="${VEHICLE_CONFIG.gravity}" />
            <div class="dev-slider-desc">Downward pull. Plants chassis firmly to slopes and snaps jump landings cleanly.</div>
          </div>

          <div class="dev-slider-item">
            <div class="dev-slider-header">
              <span class="dev-label">Camera Speed FOV:</span>
              <span id="badge-cam-fov" class="dev-slider-val">0.35x</span>
            </div>
            <input type="range" id="tune-cam-fov" class="dev-slider" min="0.00" max="1.50" step="0.05" value="0.35" />
            <div class="dev-slider-desc">Dynamic perspective expansion as speed increases. 0.0 = locked camera; higher = speed tunnel rush.</div>
          </div>

          <div class="dev-slider-item">
            <div class="dev-slider-header">
              <span class="dev-label">Post-Hit I-Frames:</span>
              <span id="badge-veh-iframes" class="dev-slider-val">${VEHICLE_CONFIG.damageGraceDuration.toFixed(1)}s</span>
            </div>
            <input type="range" id="tune-veh-iframes" class="dev-slider" min="0.5" max="5.0" step="0.1" value="${VEHICLE_CONFIG.damageGraceDuration}" />
            <div class="dev-slider-desc">Post-hit invulnerability grace period (seconds) preventing immediate follow-up bite damage.</div>
          </div>

          <div class="dev-slider-item">
            <div class="dev-slider-header">
              <span class="dev-label">Adrenaline Launch Boost:</span>
              <span id="badge-veh-adrenaline" class="dev-slider-val">${VEHICLE_CONFIG.adrenalineTorqueMultiplier.toFixed(1)}x</span>
            </div>
            <input type="range" id="tune-veh-adrenaline" class="dev-slider" min="1.0" max="3.5" step="0.1" value="${VEHICLE_CONFIG.adrenalineTorqueMultiplier}" />
            <div class="dev-slider-desc">Low-end breakaway torque multiplier active for 2.0s after damage to guarantee escape acceleration.</div>
          </div>
        </div>

        <div class="dev-section">
          <div class="dev-section-title">🦖 REXY APEX BEHAVIOR</div>

          <div class="dev-slider-item">
            <div class="dev-slider-header">
              <span class="dev-label">Rexy Base Speed:</span>
              <span id="badge-rexy-speed" class="dev-slider-val">${Math.round(REXY_CONFIG.baseSpeed * 3.6)} km/h</span>
            </div>
            <input type="range" id="tune-rexy-speed" class="dev-slider" min="40" max="360" step="5" value="${Math.round(REXY_CONFIG.baseSpeed * 3.6)}" />
            <div class="dev-slider-desc">Cruising pursuit locomotion velocity across the arena in km/h.</div>
          </div>

          <div class="dev-slider-item">
            <div class="dev-slider-header">
              <span class="dev-label">Sprint Burst Speed:</span>
              <span id="badge-rexy-sprintmult" class="dev-slider-val">${REXY_CONFIG.sprintMultiplier.toFixed(2)}x</span>
            </div>
            <input type="range" id="tune-rexy-sprintmult" class="dev-slider" min="1.0" max="3.0" step="0.05" value="${REXY_CONFIG.sprintMultiplier}" />
            <div class="dev-slider-desc">Apex predator sprint multiplier applied to speed during lunge attacks.</div>
          </div>

          <div class="dev-slider-item">
            <div class="dev-slider-header">
              <span class="dev-label">Sprint Cooldown:</span>
              <span id="badge-rexy-sprintcd" class="dev-slider-val">${REXY_CONFIG.sprintCooldown.toFixed(1)}s</span>
            </div>
            <input type="range" id="tune-rexy-sprintcd" class="dev-slider" min="0.5" max="20.0" step="0.5" value="${REXY_CONFIG.sprintCooldown}" />
            <div class="dev-slider-desc">Minimum recovery rest time in seconds between sprint lunges.</div>
          </div>

          <div class="dev-slider-item">
            <div class="dev-slider-header">
              <span class="dev-label">Sprint Trigger Dist:</span>
              <span id="badge-rexy-sprintdist" class="dev-slider-val">${REXY_CONFIG.sprintTriggerDistance}m</span>
            </div>
            <input type="range" id="tune-rexy-sprintdist" class="dev-slider" min="20" max="300" step="5" value="${REXY_CONFIG.sprintTriggerDistance}" />
            <div class="dev-slider-desc">Distance threshold in meters where Rexy decides to unleash a sprint burst.</div>
          </div>

          <div class="dev-slider-item">
            <div class="dev-slider-header">
              <span class="dev-label">Roar Cooldown:</span>
              <span id="badge-rexy-roarcd" class="dev-slider-val">${REXY_CONFIG.roarCooldown.toFixed(1)}s</span>
            </div>
            <input type="range" id="tune-rexy-roarcd" class="dev-slider" min="3.0" max="30.0" step="1.0" value="${REXY_CONFIG.roarCooldown}" />
            <div class="dev-slider-desc">Time interval in seconds between distant acoustic EMP roar shockwaves.</div>
          </div>

          <div class="dev-slider-item">
            <div class="dev-slider-header">
              <span class="dev-label">Roar Stun Duration:</span>
              <span id="badge-rexy-roarstun" class="dev-slider-val">${REXY_CONFIG.roarStunDuration.toFixed(1)}s</span>
            </div>
            <input type="range" id="tune-rexy-roarstun" class="dev-slider" min="0.0" max="5.0" step="0.1" value="${REXY_CONFIG.roarStunDuration}" />
            <div class="dev-slider-desc">Duration in seconds that the vehicle engine is stalled when hit by a roar shockwave.</div>
          </div>

          <div class="dev-slider-item">
            <div class="dev-slider-header">
              <span class="dev-label">Rexy Post-Hit Pause:</span>
              <span id="badge-rexy-posthit" class="dev-slider-val">${REXY_CONFIG.postAttackRecoveryDuration.toFixed(1)}s</span>
            </div>
            <input type="range" id="tune-rexy-posthit" class="dev-slider" min="0.5" max="6.0" step="0.1" value="${REXY_CONFIG.postAttackRecoveryDuration}" />
            <div class="dev-slider-desc">Predator triumph pause (seconds) after landing an attack before resuming pursuit or physical contact.</div>
          </div>
        </div>

        <div class="dev-actions-row">
          <button id="dev-copy-config-btn" class="dev-action-btn dev-copy-btn">📋 Copy Config JSON</button>
          <button id="dev-reset-defaults-btn" class="dev-action-btn dev-reset-btn">🔄 Reset Defaults</button>
        </div>
      </div>
    `;

    // Cache Telemetry Element References
    this.fpsEl = this.root.querySelector('#dev-fps') as HTMLElement;
    this.rexyStateEl = this.root.querySelector('#dev-rexy-state') as HTMLElement;
    this.rexySpeedEl = this.root.querySelector('#dev-rexy-speed') as HTMLElement;
    this.rexyDistEl = this.root.querySelector('#dev-rexy-dist') as HTMLElement;
    this.rexyTimerEl = this.root.querySelector('#dev-rexy-timer') as HTMLElement;
    this.rexyEnragedEl = this.root.querySelector('#dev-rexy-enraged') as HTMLElement;
    this.vehicleSpeedEl = this.root.querySelector('#dev-veh-speed') as HTMLElement;
    this.vehicleForceEl = this.root.querySelector('#dev-veh-force') as HTMLElement;
    this.vehicleTractionEl = this.root.querySelector('#dev-veh-traction') as HTMLElement;
    this.vehiclePosEl = this.root.querySelector('#dev-veh-pos') as HTMLElement;
    this.terrainZoneEl = this.root.querySelector('#dev-terrain-zone') as HTMLElement;
    this.terrainElevationEl = this.root.querySelector('#dev-terrain-elev') as HTMLElement;
    this.terrainDampingEl = this.root.querySelector('#dev-terrain-damping') as HTMLElement;
    this.logListEl = this.root.querySelector('#dev-action-log') as HTMLElement;

    // Cache Sliders & Badges
    const sliderIds = [
      'veh-maxspeed', 'veh-accel', 'veh-launch', 'veh-brake', 'veh-steer', 'veh-drift', 'veh-iframes', 'veh-adrenaline',
      'world-gravity', 'cam-fov',
      'rexy-speed', 'rexy-sprintmult', 'rexy-sprintcd', 'rexy-sprintdist', 'rexy-roarcd', 'rexy-roarstun', 'rexy-posthit'
    ];
    for (const id of sliderIds) {
      const input = this.root.querySelector(`#tune-${id}`) as HTMLInputElement;
      const badge = this.root.querySelector(`#badge-${id}`) as HTMLElement;
      if (input && badge) {
        this.sliders[id] = input;
        this.sliderBadges[id] = badge;
      }
    }

    // Stop keyboard propagation on tuning controls so game inputs aren't triggered while clicking
    this.root.addEventListener('keydown', (e) => e.stopPropagation());
    this.root.addEventListener('keyup', (e) => e.stopPropagation());
  }

  private setupTabControls(): void {
    if (!this.root) return;

    const tabs = this.root.querySelectorAll<HTMLButtonElement>('.dev-tab-btn');
    const contents = this.root.querySelectorAll<HTMLElement>('.dev-tab-content');

    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        const targetTab = tab.dataset.tab;
        tabs.forEach((t) => t.classList.remove('active'));
        contents.forEach((c) => c.classList.remove('active'));

        tab.classList.add('active');
        const activeContent = this.root?.querySelector(`#dev-tab-${targetTab}`);
        if (activeContent) {
          activeContent.classList.add('active');
        }
        tab.blur();
      });
    });
  }

  private setupSliderListeners(): void {
    if (!this.root) return;

    const bindSlider = (
      id: string,
      formatValue: (v: number) => string,
      onApply: (v: number) => void
    ) => {
      const input = this.sliders[id];
      const badge = this.sliderBadges[id];
      if (!input || !badge) return;

      const updateVal = () => {
        const val = parseFloat(input.value);
        badge.textContent = formatValue(val);
        onApply(val);
      };

      input.addEventListener('input', updateVal);
      // Immediately blur input on release so WASD controls aren't intercepted by focus
      input.addEventListener('change', () => input.blur());
      input.addEventListener('pointerup', () => input.blur());
    };

    // 1. Vehicle Top Speed Cap
    bindSlider(
      'veh-maxspeed',
      (v) => `${Math.round(v)} km/h`,
      (v) => {
        if (this.activePlayer) this.activePlayer.maxSpeedKmh = v;
      }
    );

    // 2. Vehicle Throttle Acceleration
    bindSlider(
      'veh-accel',
      (v) => `${v.toFixed(1)} m/s²`,
      (v) => {
        if (this.activePlayer) this.activePlayer.acceleration = v;
      }
    );

    // 3. Vehicle Launch Punch Boost
    bindSlider(
      'veh-launch',
      (v) => `${v.toFixed(1)}x`,
      (v) => {
        if (this.activePlayer) this.activePlayer.launchBoost = v;
      }
    );

    // 4. Vehicle Braking Deceleration
    bindSlider(
      'veh-brake',
      (v) => `${v.toFixed(1)} m/s²`,
      (v) => {
        if (this.activePlayer) this.activePlayer.brakeDecel = v;
      }
    );

    // 5. Vehicle Steering Sensitivity
    bindSlider(
      'veh-steer',
      (v) => `${v.toFixed(2)} rad/s`,
      (v) => {
        if (this.activePlayer) this.activePlayer.turnSpeed = v;
      }
    );

    // 6. Vehicle Drift & Lateral Grip
    bindSlider(
      'veh-drift',
      (v) => `${v.toFixed(1)}`,
      (v) => {
        if (this.activePlayer) this.activePlayer.driftGrip = v;
      }
    );

    // 7. Vehicle Post-Hit I-Frames
    bindSlider(
      'veh-iframes',
      (v) => `${v.toFixed(1)}s`,
      (v) => {
        if (this.activePlayer) this.activePlayer.damageGraceDuration = v;
      }
    );

    // 8. Vehicle Adrenaline Launch Boost
    bindSlider(
      'veh-adrenaline',
      (v) => `${v.toFixed(1)}x`,
      (v) => {
        if (this.activePlayer) this.activePlayer.adrenalineTorqueMultiplier = v;
      }
    );

    // 9. World Gravity
    bindSlider(
      'world-gravity',
      (v) => `${Math.round(v)} m/s²`,
      (v) => {
        if (this.activePlayer) this.activePlayer.gravity = v;
      }
    );

    // 10. Camera Speed FOV Effect
    bindSlider(
      'cam-fov',
      (v) => `${v.toFixed(2)}x`,
      (v) => {
        if (this.activeCamera) this.activeCamera.speedFovMultiplier = v;
      }
    );

    // 11. Rexy Base Speed (KM/H)
    bindSlider(
      'rexy-speed',
      (kmh) => `${Math.round(kmh)} km/h`,
      (kmh) => {
        if (this.activeRexy) this.activeRexy.setBaseSpeed(kmh / 3.6);
      }
    );

    // 12. Rexy Sprint Multiplier
    bindSlider(
      'rexy-sprintmult',
      (v) => `${v.toFixed(2)}x`,
      (v) => {
        if (this.activeRexy) this.activeRexy.sprintMultiplier = v;
      }
    );

    // 13. Rexy Sprint Cooldown
    bindSlider(
      'rexy-sprintcd',
      (v) => `${v.toFixed(1)}s`,
      (v) => {
        if (this.activeRexy) this.activeRexy.sprintCooldown = v;
      }
    );

    // 14. Rexy Sprint Trigger Distance
    bindSlider(
      'rexy-sprintdist',
      (v) => `${Math.round(v)}m`,
      (v) => {
        if (this.activeRexy) this.activeRexy.sprintTriggerDistance = v;
      }
    );

    // 15. Rexy Roar Cooldown
    bindSlider(
      'rexy-roarcd',
      (v) => `${v.toFixed(1)}s`,
      (v) => {
        if (this.activeRexy) this.activeRexy.roarCooldown = v;
      }
    );

    // 16. Rexy Roar Stun Duration
    bindSlider(
      'rexy-roarstun',
      (v) => `${v.toFixed(1)}s`,
      (v) => {
        if (this.activeRexy) this.activeRexy.roarStunDuration = v;
      }
    );

    // 17. Rexy Post-Hit Recovery
    bindSlider(
      'rexy-posthit',
      (v) => `${v.toFixed(1)}s`,
      (v) => {
        if (this.activeRexy) this.activeRexy.postAttackRecoveryDuration = v;
      }
    );

    // Copy JSON Config button
    const copyBtn = this.root.querySelector('#dev-copy-config-btn') as HTMLButtonElement;
    if (copyBtn) {
      copyBtn.addEventListener('click', () => {
        const configSnapshot = {
          vehicle: {
            maxSpeedKmh: this.activePlayer ? this.activePlayer.maxSpeedKmh : VEHICLE_CONFIG.maxSpeedKmh,
            acceleration: this.activePlayer ? this.activePlayer.acceleration : VEHICLE_CONFIG.acceleration,
            launchBoost: this.activePlayer ? this.activePlayer.launchBoost : VEHICLE_CONFIG.launchBoost,
            brakeDecel: this.activePlayer ? this.activePlayer.brakeDecel : VEHICLE_CONFIG.brakeDecel,
            turnSpeed: this.activePlayer ? this.activePlayer.turnSpeed : VEHICLE_CONFIG.turnSpeed,
            driftGrip: this.activePlayer ? this.activePlayer.driftGrip : VEHICLE_CONFIG.driftGrip,
            gravity: this.activePlayer ? this.activePlayer.gravity : VEHICLE_CONFIG.gravity,
            damageGraceDuration: this.activePlayer ? this.activePlayer.damageGraceDuration : VEHICLE_CONFIG.damageGraceDuration,
            adrenalineTorqueMultiplier: this.activePlayer ? this.activePlayer.adrenalineTorqueMultiplier : VEHICLE_CONFIG.adrenalineTorqueMultiplier,
          },
          camera: {
            speedFovMultiplier: this.activeCamera ? this.activeCamera.speedFovMultiplier : 0.35
          },
          rexy: {
            baseSpeed: this.activeRexy ? this.activeRexy.baseSpeed : REXY_CONFIG.baseSpeed,
            sprintMultiplier: this.activeRexy ? this.activeRexy.sprintMultiplier : REXY_CONFIG.sprintMultiplier,
            sprintCooldown: this.activeRexy ? this.activeRexy.sprintCooldown : REXY_CONFIG.sprintCooldown,
            sprintTriggerDistance: this.activeRexy ? this.activeRexy.sprintTriggerDistance : REXY_CONFIG.sprintTriggerDistance,
            roarCooldown: this.activeRexy ? this.activeRexy.roarCooldown : REXY_CONFIG.roarCooldown,
            roarStunDuration: this.activeRexy ? this.activeRexy.roarStunDuration : REXY_CONFIG.roarStunDuration,
            postAttackRecoveryDuration: this.activeRexy ? this.activeRexy.postAttackRecoveryDuration : REXY_CONFIG.postAttackRecoveryDuration,
          }
        };

        const jsonStr = JSON.stringify(configSnapshot, null, 2);
        navigator.clipboard.writeText(jsonStr).then(() => {
          const originalText = copyBtn.textContent;
          copyBtn.textContent = '✅ Copied to Clipboard!';
          copyBtn.style.background = 'rgba(0, 255, 136, 0.3)';
          setTimeout(() => {
            copyBtn.textContent = originalText;
            copyBtn.style.background = '';
          }, 2000);
        });
        copyBtn.blur();
      });
    }

    // Reset Defaults button
    const resetBtn = this.root.querySelector('#dev-reset-defaults-btn') as HTMLButtonElement;
    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        this.resetAllTuningDefaults();
        const originalText = resetBtn.textContent;
        resetBtn.textContent = '🔄 Defaults Restored!';
        resetBtn.style.background = 'rgba(255, 170, 0, 0.3)';
        setTimeout(() => {
          resetBtn.textContent = originalText;
          resetBtn.style.background = '';
        }, 1500);
        resetBtn.blur();
      });
    }

    // Freeze Rexy AI Toggle button
    const freezeBtn = this.root.querySelector('#dev-freeze-rexy-btn') as HTMLButtonElement;
    const freezeIcon = this.root.querySelector('#dev-freeze-icon') as HTMLElement;
    const freezeStatus = this.root.querySelector('#dev-freeze-status') as HTMLElement;
    if (freezeBtn) {
      freezeBtn.addEventListener('click', () => {
        this.isRexyFrozen = !this.isRexyFrozen;
        if (this.activeRexy) {
          this.activeRexy.setAIFrozen(this.isRexyFrozen);
        }
        if (this.isRexyFrozen) {
          freezeBtn.classList.add('frozen');
          if (freezeIcon) freezeIcon.textContent = '❄️';
          if (freezeStatus) freezeStatus.textContent = 'FROZEN';
        } else {
          freezeBtn.classList.remove('frozen');
          if (freezeIcon) freezeIcon.textContent = '⏸️';
          if (freezeStatus) freezeStatus.textContent = 'ACTIVE';
        }
        freezeBtn.blur();
      });
    }
  }

  public resetAllTuningDefaults(): void {
    const defaults: Record<string, { val: number; fmt: string }> = {
      'veh-maxspeed': { val: VEHICLE_CONFIG.maxSpeedKmh, fmt: `${VEHICLE_CONFIG.maxSpeedKmh} km/h` },
      'veh-accel': { val: VEHICLE_CONFIG.acceleration, fmt: `${VEHICLE_CONFIG.acceleration.toFixed(1)} m/s²` },
      'veh-launch': { val: VEHICLE_CONFIG.launchBoost, fmt: `${VEHICLE_CONFIG.launchBoost.toFixed(1)}x` },
      'veh-brake': { val: VEHICLE_CONFIG.brakeDecel, fmt: `${VEHICLE_CONFIG.brakeDecel.toFixed(1)} m/s²` },
      'veh-steer': { val: VEHICLE_CONFIG.turnSpeed, fmt: `${VEHICLE_CONFIG.turnSpeed.toFixed(2)} rad/s` },
      'veh-drift': { val: VEHICLE_CONFIG.driftGrip, fmt: `${VEHICLE_CONFIG.driftGrip.toFixed(1)}` },
      'veh-iframes': { val: VEHICLE_CONFIG.damageGraceDuration, fmt: `${VEHICLE_CONFIG.damageGraceDuration.toFixed(1)}s` },
      'veh-adrenaline': { val: VEHICLE_CONFIG.adrenalineTorqueMultiplier, fmt: `${VEHICLE_CONFIG.adrenalineTorqueMultiplier.toFixed(1)}x` },
      'world-gravity': { val: VEHICLE_CONFIG.gravity, fmt: `${VEHICLE_CONFIG.gravity} m/s²` },
      'cam-fov': { val: 0.35, fmt: `0.35x` },
      'rexy-speed': { val: Math.round(REXY_CONFIG.baseSpeed * 3.6), fmt: `${Math.round(REXY_CONFIG.baseSpeed * 3.6)} km/h` },
      'rexy-sprintmult': { val: REXY_CONFIG.sprintMultiplier, fmt: `${REXY_CONFIG.sprintMultiplier.toFixed(2)}x` },
      'rexy-sprintcd': { val: REXY_CONFIG.sprintCooldown, fmt: `${REXY_CONFIG.sprintCooldown.toFixed(1)}s` },
      'rexy-sprintdist': { val: REXY_CONFIG.sprintTriggerDistance, fmt: `${REXY_CONFIG.sprintTriggerDistance}m` },
      'rexy-roarcd': { val: REXY_CONFIG.roarCooldown, fmt: `${REXY_CONFIG.roarCooldown.toFixed(1)}s` },
      'rexy-roarstun': { val: REXY_CONFIG.roarStunDuration, fmt: `${REXY_CONFIG.roarStunDuration.toFixed(1)}s` },
      'rexy-posthit': { val: REXY_CONFIG.postAttackRecoveryDuration, fmt: `${REXY_CONFIG.postAttackRecoveryDuration.toFixed(1)}s` },
    };

    for (const [id, def] of Object.entries(defaults)) {
      if (this.sliders[id] && this.sliderBadges[id]) {
        this.sliders[id].value = String(def.val);
        this.sliderBadges[id].textContent = def.fmt;
      }
    }

    if (this.activePlayer) {
      this.activePlayer.maxSpeedKmh = VEHICLE_CONFIG.maxSpeedKmh;
      this.activePlayer.acceleration = VEHICLE_CONFIG.acceleration;
      this.activePlayer.launchBoost = VEHICLE_CONFIG.launchBoost;
      this.activePlayer.brakeDecel = VEHICLE_CONFIG.brakeDecel;
      this.activePlayer.turnSpeed = VEHICLE_CONFIG.turnSpeed;
      this.activePlayer.driftGrip = VEHICLE_CONFIG.driftGrip;
      this.activePlayer.gravity = VEHICLE_CONFIG.gravity;
      this.activePlayer.damageGraceDuration = VEHICLE_CONFIG.damageGraceDuration;
      this.activePlayer.adrenalineTorqueMultiplier = VEHICLE_CONFIG.adrenalineTorqueMultiplier;
    }

    if (this.activeCamera) {
      this.activeCamera.speedFovMultiplier = 0.35;
    }

    if (this.activeRexy) {
      this.activeRexy.setBaseSpeed(REXY_CONFIG.baseSpeed);
      this.activeRexy.sprintMultiplier = REXY_CONFIG.sprintMultiplier;
      this.activeRexy.sprintCooldown = REXY_CONFIG.sprintCooldown;
      this.activeRexy.sprintTriggerDistance = REXY_CONFIG.sprintTriggerDistance;
      this.activeRexy.roarCooldown = REXY_CONFIG.roarCooldown;
      this.activeRexy.roarStunDuration = REXY_CONFIG.roarStunDuration;
      this.activeRexy.postAttackRecoveryDuration = REXY_CONFIG.postAttackRecoveryDuration;
    }
  }

  private setupBusListeners(): void {
    const pushLog = (category: DevActionLog['category'], text: string, color: string) => {
      const now = new Date();
      const timeStr = now.toTimeString().split(' ')[0];
      this.logs.unshift({ timeStr, category, text, color });
      if (this.logs.length > 5) {
        this.logs.pop();
      }
      this.renderLogs();
    };

    this.unbindFns.push(
      this.bus.on('pickup_collected', ({ type }) => {
        let effectDesc = '';
        if (type.startsWith('SpeedTire')) effectDesc = '+15 km/h Permanent Top Speed Boost';
        else if (type.startsWith('Spray')) effectDesc = 'Rexy Speed Slowed by 4.0 m/s';
        else if (type.startsWith('Heart')) effectDesc = '+1 Health Restored';
        else if (type.startsWith('Egg')) effectDesc = 'Objective Progress +1';
        pushLog('PICKUP', `Picked up ${type}: ${effectDesc}`, '#00f0ff');
      }),

      this.bus.on('rexy_state_changed', ({ state }) => {
        const color = state === 'SPRINTING' ? '#ff3366' : state === 'RECOVERING' ? '#94a3b8' : '#ffaa00';
        pushLog('REXY', `Rexy State -> ${state}`, color);
      }),

      this.bus.on('rexy_roar', () => {
        pushLog('REXY', `Rexy DISTANT ROAR: Acoustic EMP shockwave!`, '#ff0055');
      }),

      this.bus.on('player_stunned', ({ duration }) => {
        pushLog('COMBAT', `⚠️ ENGINE STALLED! Roar disabled vehicle for ${duration}s!`, '#ff0033');
      }),

      this.bus.on('player_recovered', () => {
        pushLog('VEHICLE', `Engine restarted! Full power restored.`, '#00ff88');
      }),

      this.bus.on('rexy_attack', () => {
        pushLog('COMBAT', `Rexy Lunge Hit! Vehicle launched!`, '#ff2222');
      }),

      this.bus.on('rexy_slowed', ({ speed }) => {
        pushLog('REXY', `Rexy slowed to ${Math.round(speed * 3.6)} km/h`, '#bb66ff');
      }),

      this.bus.on('player_damaged', ({ health }) => {
        pushLog('COMBAT', `Vehicle took damage! HP: ${health}`, '#ff4444');
      }),

      this.bus.on('player_healed', ({ health }) => {
        pushLog('PICKUP', `Vehicle repaired! HP: ${health}`, '#00ff88');
      }),

      this.bus.on('egg_collected', () => {
        pushLog('WORLD', `Dinosaur Egg collected!`, '#ffd700');
      }),

      this.bus.on('hazard_state_changed', ({ inHazard, name }) => {
        if (inHazard) {
          pushLog('WORLD', `⚠️ Entered ${name}: Hydrodynamic drag active!`, '#ffaa00');
        } else {
          pushLog('WORLD', `Cleared hazard zone. Traction restored.`, '#00ff88');
        }
      }),

      this.bus.on('rexy_roar_cast_started', ({ duration }) => {
        pushLog('REXY', `⚠️ INCOMING ROAR! Telegraph: ${duration.toFixed(1)}s!`, '#ff3366');
      }),

      this.bus.on('rexy_roar_escaped', ({ distance, radius }) => {
        pushLog('COMBAT', `⚡ Roar blast evaded! (${Math.round(distance)}m >= ${radius}m)`, '#00ff88');
      }),

      this.bus.on('rexy_roar_hit', ({ distance }) => {
        pushLog('COMBAT', `💥 EMP Roar Hit at ${Math.round(distance)}m! Engine stalled!`, '#ff0033');
      }),

      this.bus.on('camera_mode_changed', ({ mode }) => {
        const modeLabel = mode === 'REXY_FOCUS' ? '🎯 REXY FOCUS (Ball Cam)' : 'CHASE (Follow)';
        pushLog('WORLD', `Camera -> ${modeLabel}`, '#00f0ff');
      })
    );
  }

  private renderLogs(): void {
    if (!this.logListEl) return;
    this.logListEl.innerHTML = this.logs
      .map(
        (l) => `
        <div class="dev-log-item">
          <span class="dev-log-time">${l.timeStr}</span>
          <span class="dev-log-tag" style="color: ${l.color}">[${l.category}]</span>
          <span class="dev-log-msg">${l.text}</span>
        </div>`
      )
      .join('');
  }

  public toggle(): void {
    this.setVisible(!this.isVisible);
  }

  public setVisible(visible: boolean): void {
    this.isVisible = visible;
    if (this.root) {
      if (visible) {
        this.root.classList.remove('hidden');
      } else {
        this.root.classList.add('hidden');
      }
    }
    this.bus.emit('dev_vision_toggled', { enabled: visible });
  }

  public get visible(): boolean {
    return this.isVisible;
  }

  public attachEntities(
    player?: Vehicle,
    rexy?: Rexy,
    camera?: CameraController
  ): void {
    if (player) {
      this.activePlayer = player;
      this.applyCurrentTuningToPlayer();
    }
    if (rexy) {
      this.activeRexy = rexy;
      if (this.isRexyFrozen) {
        this.activeRexy.setAIFrozen(true);
      }
      this.applyCurrentTuningToRexy();
    }
    if (camera) {
      this.activeCamera = camera;
      this.applyCurrentTuningToCamera();
    }
  }

  public applyCurrentTuningToPlayer(): void {
    if (!this.activePlayer) return;
    if (this.sliders['veh-maxspeed']) this.activePlayer.maxSpeedKmh = parseFloat(this.sliders['veh-maxspeed'].value);
    if (this.sliders['veh-accel']) this.activePlayer.acceleration = parseFloat(this.sliders['veh-accel'].value);
    if (this.sliders['veh-launch']) this.activePlayer.launchBoost = parseFloat(this.sliders['veh-launch'].value);
    if (this.sliders['veh-brake']) this.activePlayer.brakeDecel = parseFloat(this.sliders['veh-brake'].value);
    if (this.sliders['veh-steer']) this.activePlayer.turnSpeed = parseFloat(this.sliders['veh-steer'].value);
    if (this.sliders['veh-drift']) this.activePlayer.driftGrip = parseFloat(this.sliders['veh-drift'].value);
    if (this.sliders['world-gravity']) this.activePlayer.gravity = parseFloat(this.sliders['world-gravity'].value);
    if (this.sliders['veh-iframes']) this.activePlayer.damageGraceDuration = parseFloat(this.sliders['veh-iframes'].value);
    if (this.sliders['veh-adrenaline']) this.activePlayer.adrenalineTorqueMultiplier = parseFloat(this.sliders['veh-adrenaline'].value);
  }

  public applyCurrentTuningToCamera(): void {
    if (!this.activeCamera) return;
    if (this.sliders['cam-fov']) this.activeCamera.speedFovMultiplier = parseFloat(this.sliders['cam-fov'].value);
  }

  public applyCurrentTuningToRexy(): void {
    if (!this.activeRexy) return;
    if (this.sliders['rexy-speed']) this.activeRexy.setBaseSpeed(parseFloat(this.sliders['rexy-speed'].value) / 3.6);
    if (this.sliders['rexy-sprintmult']) this.activeRexy.sprintMultiplier = parseFloat(this.sliders['rexy-sprintmult'].value);
    if (this.sliders['rexy-sprintcd']) this.activeRexy.sprintCooldown = parseFloat(this.sliders['rexy-sprintcd'].value);
    if (this.sliders['rexy-sprintdist']) this.activeRexy.sprintTriggerDistance = parseFloat(this.sliders['rexy-sprintdist'].value);
    if (this.sliders['rexy-roarcd']) this.activeRexy.roarCooldown = parseFloat(this.sliders['rexy-roarcd'].value);
    if (this.sliders['rexy-roarstun']) this.activeRexy.roarStunDuration = parseFloat(this.sliders['rexy-roarstun'].value);
    if (this.sliders['rexy-posthit']) this.activeRexy.postAttackRecoveryDuration = parseFloat(this.sliders['rexy-posthit'].value);
    if (this.isRexyFrozen) this.activeRexy.setAIFrozen(true);
  }

  public update(
    player?: Vehicle,
    rexy?: Rexy,
    terrain?: TerrainBody,
    camera?: CameraController
  ): void {
    if (!import.meta.env.DEV) return;

    // Retain and sync active references across match lifecycles even if overlay is temporarily hidden
    if (player && this.activePlayer !== player) {
      this.activePlayer = player;
      this.applyCurrentTuningToPlayer();
    }
    if (rexy && this.activeRexy !== rexy) {
      this.activeRexy = rexy;
      if (this.isRexyFrozen) {
        this.activeRexy.setAIFrozen(true);
      }
      this.applyCurrentTuningToRexy();
    }
    if (camera && this.activeCamera !== camera) {
      this.activeCamera = camera;
      this.applyCurrentTuningToCamera();
    }

    if (!this.isVisible) return;

    // 1. FPS Calculation
    this.frames++;
    const now = performance.now();
    if (now - this.lastTime >= 500) {
      this.fps = Math.round((this.frames * 1000) / (now - this.lastTime));
      this.frames = 0;
      this.lastTime = now;
      if (this.fpsEl) this.fpsEl.textContent = `${this.fps} FPS`;
    }

    // 2. Rexy Telemetry
    if (rexy) {
      if (this.rexyStateEl) {
        if (rexy.isAIFrozen) {
          this.rexyStateEl.textContent = 'FROZEN';
          this.rexyStateEl.className = 'dev-state-badge state-frozen';
        } else {
          this.rexyStateEl.textContent = rexy.aiState;
          this.rexyStateEl.className = `dev-state-badge state-${rexy.aiState.toLowerCase()}`;
        }
      }
      if (this.rexySpeedEl) {
        const mps = rexy.effectiveSpeed;
        const kmh = Math.round(mps * 3.6);
        const baseKmh = Math.round(rexy.baseSpeed * 3.6);
        this.rexySpeedEl.textContent = `${kmh} KM/H [Base: ${baseKmh} km/h] (${mps.toFixed(1)} m/s)`;
      }
      if (this.rexyDistEl) {
        this.rexyDistEl.textContent = `${rexy.distanceToTarget.toFixed(1)} m`;
      }
      if (this.rexyTimerEl) {
        if (rexy.postAttackRemaining > 0) {
          this.rexyTimerEl.textContent = `Post-Hit Pause: ${rexy.postAttackRemaining.toFixed(1)}s`;
        } else if (rexy.aiState === 'SPRINTING') {
          this.rexyTimerEl.textContent = `Sprint: ${rexy.sprintRemaining.toFixed(1)}s`;
        } else if (rexy.aiState === 'RECOVERING') {
          this.rexyTimerEl.textContent = `Exhausted: ${rexy.recoveryRemaining.toFixed(1)}s`;
        } else {
          this.rexyTimerEl.textContent = `Sprint: ${rexy.cooldownRemaining.toFixed(1)}s | Roar: ${rexy.roarRemaining.toFixed(1)}s`;
        }
      }
      if (this.rexyEnragedEl) {
        this.rexyEnragedEl.textContent = rexy.isEnraged ? 'YES (+25% Speed, Fast Roar)' : 'NO';
        this.rexyEnragedEl.style.color = rexy.isEnraged ? '#ff0055' : '#94a3b8';
      }
    }

    // 3. Vehicle Telemetry
    if (player) {
      if (this.vehicleSpeedEl) {
        const uPerSec = player.currentSpeedKmh / 3.6;
        const carLengthsPerSec = (uPerSec / 12).toFixed(1);
        const iframesBadge = player.isInvulnerable ? ` [🛡️ I-FRAMES: ${player.invulnerabilityRemaining.toFixed(1)}s]` : '';
        this.vehicleSpeedEl.textContent = `${player.currentSpeedKmh} KM/H (${uPerSec.toFixed(1)} u/s | ${carLengthsPerSec} len/s)${iframesBadge}`;
      }
      if (this.vehicleForceEl) {
        if (player.isStunned) {
          this.vehicleForceEl.textContent = `0.0 m/s² [STALLED: ${player.stunRemaining.toFixed(1)}s]`;
          this.vehicleForceEl.style.color = '#ff0055';
        } else {
          const effective = player.effectiveAcceleration;
          const base = player.acceleration;
          const adrenalineBadge = player.isAdrenalineActive ? ` [⚡ ADRENALINE: ${player.adrenalineRemaining.toFixed(1)}s]` : '';
          const isLaunchActive = player.forwardSpeed < player.topSpeedMs * 0.65 && player.forwardSpeed > 0.5;
          const launchBadge = isLaunchActive ? ' [🚀 PUNCH]' : '';
          this.vehicleForceEl.textContent = `Thrust: ${effective.toFixed(1)} m/s² (Base: ${base.toFixed(1)})${launchBadge}${adrenalineBadge}`;
          this.vehicleForceEl.style.color = player.isAdrenalineActive ? '#00f0ff' : '#f8fafc';
        }
      }
      if (this.vehicleTractionEl) {
        if (player.isTractionDisrupted) {
          this.vehicleTractionEl.textContent = `Grip: ${(player.driftGrip * 0.35).toFixed(1)} [SLIP: ${player.tractionDisruptRemaining}s]`;
          this.vehicleTractionEl.style.color = '#ff3366';
        } else {
          this.vehicleTractionEl.textContent = `Grip: ${player.driftGrip.toFixed(1)} (Arcade Grip)`;
          this.vehicleTractionEl.style.color = '#f8fafc';
        }
      }
      if (this.vehiclePosEl) {
        const p = player.position;
        this.vehiclePosEl.textContent = `X: ${p.x.toFixed(1)} | Y: ${p.y.toFixed(1)} | Z: ${p.z.toFixed(1)}`;
      }
    }

    // 4. Terrain & Surface Telemetry
    if (terrain && player) {
      const surface: TerrainSurfaceInfo = terrain.getSurfaceAt(player.position.x, player.position.z);
      if (this.terrainZoneEl) {
        this.terrainZoneEl.textContent = surface.isHazard
          ? `⚠️ ${surface.zoneName} (HAZARD)`
          : surface.zoneName;
        this.terrainZoneEl.style.color = surface.isHazard ? '#ffd700' : '#f8fafc';
      }
      if (this.terrainElevationEl) {
        const sign = surface.elevation >= 0 ? '+' : '';
        this.terrainElevationEl.textContent = `${sign}${surface.elevation.toFixed(1)}m | Incline: ${surface.slopeDegrees.toFixed(1)}°`;
      }
      if (this.terrainDampingEl) {
        const isMud = surface.isHazard || surface.linearDamping > 0.2;
        if (isMud) {
          const mudSeverity = Math.min(1.0, Math.max(0.2, (surface.linearDamping - 0.15) / 0.5));
          const speedMs = Math.abs(player.forwardSpeed);
          const dragPenalty = ((18.0 + speedMs * 0.65) * mudSeverity).toFixed(1);
          this.terrainDampingEl.textContent = `Drag: +${dragPenalty} m/s² (Viscous Mud) | Grip: 0.35x`;
          this.terrainDampingEl.style.color = '#ffd700';
        } else {
          this.terrainDampingEl.textContent = `Drag: Normal | Grip: 1.00x`;
          this.terrainDampingEl.style.color = '#f8fafc';
        }
      }
    }
  }

  public destroy(): void {
    this.unbindFns.forEach((fn) => fn());
    this.unbindFns.length = 0;
    if (this.root && this.root.parentElement) {
      this.root.parentElement.removeChild(this.root);
    }
  }
}
