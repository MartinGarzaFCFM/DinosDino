import { EventBus, IEventBus } from '../core/EventBus.ts';
import { GameState, Difficulty, LevelTheme } from '../core/GameState.ts';
import { LEVEL_REGISTRY } from '../config/LevelRegistry.ts';
import { VEHICLE_CONFIG } from '../config/GameBalance.ts';

export class UIManager {
  private readonly bus: IEventBus;
  private readonly overlay: HTMLElement;
  private readonly unbindFns: Array<() => void> = [];

  private hudElement!: HTMLElement;
  private menuScreen!: HTMLElement;
  private loadingScreen!: HTMLElement;
  private pauseScreen!: HTMLElement;
  private victoryScreen!: HTMLElement;
  private gameOverScreen!: HTMLElement;

  // HUD elements
  private speedVal!: HTMLElement;
  private speedBarFill!: HTMLElement;
  private healthContainer!: HTMLElement;
  private eggsCountElement!: HTMLElement;
  private bonusSpeedBadge!: HTMLElement;
  private wireframeBtn!: HTMLButtonElement;
  private devVisionBtn?: HTMLButtonElement;
  private loadingBarFill!: HTMLElement;
  private loadingPercent!: HTMLElement;

  // Rexy Boss Cast Bar elements
  private rexyCastContainer!: HTMLElement;
  private rexyCastCountdown!: HTMLElement;
  private rexyCastFill!: HTMLElement;
  private rexyCastStatus!: HTMLElement;
  private rexyCastHint!: HTMLElement;
  private castDismissTimer?: number;

  private selectedDifficulty: Difficulty = 'Medium';
  private selectedLevel: LevelTheme = 'Park';
  private musicEnabled: boolean = true;
  private sfxEnabled: boolean = true;

  constructor(container: HTMLElement, bus: IEventBus = EventBus.getInstance()) {
    this.bus = bus;
    this.overlay = document.createElement('div');
    this.overlay.id = 'ui-overlay';
    container.appendChild(this.overlay);

    this.renderDOM();
    this.bindEvents();
    this.setupBusListeners();
  }

  private renderDOM(): void {
    const levelButtonsHtml = Object.values(LEVEL_REGISTRY)
      .map(
        (lvl) =>
          `<button class="btn-segmented ${lvl.id === this.selectedLevel ? 'active' : ''}" data-level="${lvl.id}">${lvl.label}</button>`
      )
      .join('');

    const devVisionPillHtml = import.meta.env.DEV
      ? `<button id="btn-dev-vision" class="glass-panel hud-pill dev-vision-pill interactive" style="color: #00f0ff;">[~] DEV VISION: ON</button>`
      : '';

    const devControlsHintHtml = import.meta.env.DEV
      ? `<span class="key-badge">~</span> Dev Vision |`
      : '';

    this.overlay.innerHTML = `
      <!-- HUD -->
      <div id="hud" class="hidden">
        <div class="hud-top">
          <div class="glass-panel hud-pill health-pill">
            <span>HP</span>
            <div id="health-hearts" class="health-hearts"></div>
          </div>

          <div style="display: flex; gap: 8px;">
            <button id="btn-camera-mode" class="glass-panel hud-pill camera-pill interactive">[C] CAM: CHASE</button>
            <button id="btn-wireframe-debug" class="glass-panel hud-pill wireframe-pill interactive">[F] WIREFRAME: OFF</button>
            ${devVisionPillHtml}
          </div>

          <div class="glass-panel hud-pill eggs-pill">
            <span>EGGS</span>
            <span id="eggs-count">0 / 0</span>
          </div>
        </div>

        <!-- FFXIV / WoW Style Boss Cast Bar (Rexy Roar Telegraph) -->
        <div id="rexy-cast-container" class="rexy-cast-container hidden">
          <div class="rexy-cast-card glass-panel">
            <div class="rexy-cast-header">
              <div class="rexy-cast-badge-icon">🦖</div>
              <div class="rexy-cast-text-group">
                <span class="rexy-cast-boss-name">REXY APEX PREDATOR</span>
                <span class="rexy-cast-spell-name">ACOUSTIC EMP ROAR</span>
              </div>
              <div id="rexy-cast-countdown" class="rexy-cast-countdown">2.8s</div>
            </div>
            <div class="rexy-cast-track">
              <div id="rexy-cast-fill" class="rexy-cast-fill">
                <div class="rexy-cast-spark"></div>
              </div>
            </div>
            <div class="rexy-cast-footer">
              <span id="rexy-cast-status" class="rexy-cast-status in-danger">⚠️ IN BLAST RADIUS: 180m / 480m</span>
              <span id="rexy-cast-hint" class="rexy-cast-hint">FLOOR IT TO ESCAPE!</span>
            </div>
          </div>
        </div>

        <div class="hud-bottom">
          <div class="glass-panel speedometer-card">
            <div style="display: flex; justify-content: space-between; align-items: baseline;">
              <span id="speed-val" class="speed-val">00</span>
              <span class="speed-unit">KM/H</span>
            </div>
            <div class="speed-bar-container">
              <div id="speed-bar-fill" class="speed-bar-fill"></div>
            </div>
            <span id="bonus-speed-badge" class="bonus-speed-badge" style="display: none;">+0 BOOST</span>
            <span id="rexy-cam-badge" class="bonus-speed-badge rexy-cam-badge" style="display: none; background: rgba(0, 240, 255, 0.25); border-color: #00f0ff; color: #00f0ff;">🎯 REXY CAM: ACTIVE</span>
            <span id="stun-warning-badge" class="bonus-speed-badge" style="display: none; background: rgba(255, 0, 85, 0.35); border-color: #ff0055; color: #ff3366; animation: pulse-danger 0.5s infinite alternate;">⚠️ ENGINE STALLED</span>
            <span id="hazard-warning-badge" class="bonus-speed-badge" style="display: none; background: rgba(180, 85, 0, 0.45); border-color: #ff8800; color: #ffaa00; animation: pulse-danger 0.6s infinite alternate;">⚠️ MUD HAZARD: VISCOUS DRAG</span>
          </div>

          <div class="controls-hint glass-panel">
            <span class="key-badge">W</span><span class="key-badge">A</span><span class="key-badge">S</span><span class="key-badge">D</span> Drive |
            <span class="key-badge">SPACE</span> Handbrake |
            <span class="key-badge">C</span> Rexy Cam |
            <span class="key-badge">F</span> Wireframe |
            ${devControlsHintHtml}
            <span class="key-badge">R</span> Flip / Reset |
            <span class="key-badge">P</span> Pause
          </div>
        </div>
      </div>

      <!-- Loading Screen -->
      <div id="loading-screen" class="modal-screen interactive">
        <div class="glass-panel menu-card">
          <h1 class="game-title">DINOS DINO</h1>
          <p class="game-subtitle">Preparing Jurassic Arena & 3D Assets...</p>
          <div class="loading-bar-container">
            <div id="loading-bar-fill" class="loading-bar-fill"></div>
          </div>
          <span id="loading-percent" style="font-size: 0.9rem; color: var(--text-muted);">0%</span>
        </div>
      </div>

      <!-- Main Menu -->
      <div id="menu-screen" class="modal-screen interactive hidden">
        <div class="glass-panel menu-card">
          <div>
            <h1 class="game-title">DINOS DINO</h1>
            <p class="game-subtitle">Outrun the T-Rex. Collect the Eggs. Survive.</p>
          </div>

          <!-- Difficulty selection -->
          <div class="option-row">
            <span class="option-label">Difficulty</span>
            <div class="btn-group">
              <button class="btn-segmented" data-diff="Easy">Easy</button>
              <button class="btn-segmented active" data-diff="Medium">Medium</button>
              <button class="btn-segmented" data-diff="Hard">Hard</button>
            </div>
          </div>

          <!-- Level selection (Data-driven from LevelRegistry) -->
          <div class="option-row">
            <span class="option-label">Arena Level</span>
            <div class="btn-group">
              ${levelButtonsHtml}
            </div>
          </div>

          <!-- Audio Options -->
          <div class="option-row">
            <span class="option-label">Audio</span>
            <div class="btn-group">
              <button id="btn-toggle-music" class="btn-segmented active">Music: ON</button>
              <button id="btn-toggle-sfx" class="btn-segmented active">SFX: ON</button>
            </div>
          </div>

          <button id="btn-start" class="btn btn-primary" style="margin-top: 8px;">
            START EXPEDITION
          </button>
        </div>
      </div>

      <!-- Pause Menu -->
      <div id="pause-screen" class="modal-screen interactive hidden">
        <div class="glass-panel menu-card" style="max-width: 400px;">
          <h2 style="font-size: 2.2rem; font-weight: 800; color: var(--primary);">GAME PAUSED</h2>
          <button id="btn-resume" class="btn btn-primary">RESUME</button>
          <button id="btn-pause-menu" class="btn btn-secondary">MAIN MENU</button>
        </div>
      </div>

      <!-- Victory Screen -->
      <div id="victory-screen" class="modal-screen interactive hidden">
        <div class="glass-panel menu-card">
          <h2 style="font-size: 2.6rem; font-weight: 900; color: var(--accent);">EXPEDITION COMPLETE!</h2>
          <p style="color: var(--text-muted); font-size: 1.1rem;">You gathered all eggs and outsmarted Rexy!</p>
          <button id="btn-victory-replay" class="btn btn-primary" style="margin-top: 12px;">PLAY AGAIN</button>
          <button id="btn-victory-menu" class="btn btn-secondary">MAIN MENU</button>
        </div>
      </div>

      <!-- Game Over Screen -->
      <div id="gameover-screen" class="modal-screen interactive hidden">
        <div class="glass-panel menu-card">
          <h2 style="font-size: 2.6rem; font-weight: 900; color: var(--danger);">VEHICLE DESTROYED!</h2>
          <p style="color: var(--text-muted); font-size: 1.1rem;">Rexy caught you. Keep your distance next time!</p>
          <button id="btn-gameover-retry" class="btn btn-primary" style="margin-top: 12px;">TRY AGAIN</button>
          <button id="btn-gameover-menu" class="btn btn-secondary">MAIN MENU</button>
        </div>
      </div>
    `;

    this.hudElement = document.getElementById('hud')!;
    this.menuScreen = document.getElementById('menu-screen')!;
    this.loadingScreen = document.getElementById('loading-screen')!;
    this.pauseScreen = document.getElementById('pause-screen')!;
    this.victoryScreen = document.getElementById('victory-screen')!;
    this.gameOverScreen = document.getElementById('gameover-screen')!;

    this.speedVal = document.getElementById('speed-val')!;
    this.speedBarFill = document.getElementById('speed-bar-fill')!;
    this.healthContainer = document.getElementById('health-hearts')!;
    this.eggsCountElement = document.getElementById('eggs-count')!;
    this.bonusSpeedBadge = document.getElementById('bonus-speed-badge')!;
    this.wireframeBtn = document.getElementById('btn-wireframe-debug') as HTMLButtonElement;
    if (import.meta.env.DEV) {
      this.devVisionBtn = document.getElementById('btn-dev-vision') as HTMLButtonElement | undefined;
    }
    this.loadingBarFill = document.getElementById('loading-bar-fill')!;
    this.loadingPercent = document.getElementById('loading-percent')!;

    this.rexyCastContainer = document.getElementById('rexy-cast-container')!;
    this.rexyCastCountdown = document.getElementById('rexy-cast-countdown')!;
    this.rexyCastFill = document.getElementById('rexy-cast-fill')!;
    this.rexyCastStatus = document.getElementById('rexy-cast-status')!;
    this.rexyCastHint = document.getElementById('rexy-cast-hint')!;

    this.updateHearts(VEHICLE_CONFIG.maxHealth, VEHICLE_CONFIG.maxHealth);
  }

  private bindEvents(): void {
    document.querySelectorAll('[data-diff]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('[data-diff]').forEach((b) => b.classList.remove('active'));
        const el = e.currentTarget as HTMLElement;
        el.classList.add('active');
        this.selectedDifficulty = el.getAttribute('data-diff') as Difficulty;
        this.bus.emit('ui_click');
      });
    });

    document.querySelectorAll('[data-level]').forEach((btn) => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('[data-level]').forEach((b) => b.classList.remove('active'));
        const el = e.currentTarget as HTMLElement;
        el.classList.add('active');
        this.selectedLevel = el.getAttribute('data-level') as LevelTheme;
        this.bus.emit('ui_click');
      });
    });

    const btnMusic = document.getElementById('btn-toggle-music')!;
    btnMusic.addEventListener('click', () => {
      this.musicEnabled = !this.musicEnabled;
      btnMusic.classList.toggle('active', this.musicEnabled);
      btnMusic.textContent = `Music: ${this.musicEnabled ? 'ON' : 'OFF'}`;
      this.bus.emit('toggle_music', this.musicEnabled);
      this.bus.emit('ui_click');
    });

    const btnSfx = document.getElementById('btn-toggle-sfx')!;
    btnSfx.addEventListener('click', () => {
      this.sfxEnabled = !this.sfxEnabled;
      btnSfx.classList.toggle('active', this.sfxEnabled);
      btnSfx.textContent = `SFX: ${this.sfxEnabled ? 'ON' : 'OFF'}`;
      this.bus.emit('toggle_sfx', this.sfxEnabled);
      this.bus.emit('ui_click');
    });

    const emitStart = () => {
      this.bus.emit('ui_click');
      this.bus.emit('start_game_request', {
        difficulty: this.selectedDifficulty,
        level: this.selectedLevel
      });
    };

    const emitReturnMenu = () => {
      this.bus.emit('ui_click');
      this.bus.emit('return_to_menu');
    };

    document.getElementById('btn-start')!.addEventListener('click', emitStart);
    document.getElementById('btn-victory-replay')!.addEventListener('click', emitStart);
    document.getElementById('btn-gameover-retry')!.addEventListener('click', emitStart);

    document.getElementById('btn-pause-menu')!.addEventListener('click', emitReturnMenu);
    document.getElementById('btn-victory-menu')!.addEventListener('click', emitReturnMenu);
    document.getElementById('btn-gameover-menu')!.addEventListener('click', emitReturnMenu);

    document.getElementById('btn-resume')!.addEventListener('click', () => {
      this.bus.emit('ui_click');
      this.bus.emit('resume_game');
    });

    const btnCamera = document.getElementById('btn-camera-mode');
    if (btnCamera) {
      btnCamera.addEventListener('click', () => {
        this.bus.emit('toggle_camera_mode');
        this.bus.emit('ui_click');
      });
    }

    this.wireframeBtn.addEventListener('click', () => {
      this.bus.emit('toggle_wireframe_debug');
      this.bus.emit('ui_click');
    });

    if (this.devVisionBtn) {
      this.devVisionBtn.addEventListener('click', () => {
        this.bus.emit('toggle_dev_vision');
        this.bus.emit('ui_click');
      });
    }
  }

  private setupBusListeners(): void {
    this.unbindFns.push(
      this.bus.on('camera_mode_changed', ({ mode }) => {
        const btnCamera = document.getElementById('btn-camera-mode');
        const rexyBadge = document.getElementById('rexy-cam-badge');
        const isRexyFocus = mode === 'REXY_FOCUS';

        if (btnCamera) {
          btnCamera.textContent = isRexyFocus ? '[C] CAM: REXY FOCUS' : '[C] CAM: CHASE';
          btnCamera.classList.toggle('active', isRexyFocus);
          btnCamera.style.borderColor = isRexyFocus ? '#00f0ff' : '';
          btnCamera.style.color = isRexyFocus ? '#00f0ff' : '';
        }

        if (rexyBadge) {
          rexyBadge.style.display = isRexyFocus ? 'block' : 'none';
        }
      }),
      this.bus.on('wireframe_debug_toggled', ({ enabled }) => {
        this.wireframeBtn.textContent = `[F] WIREFRAME: ${enabled ? 'ON' : 'OFF'}`;
        this.wireframeBtn.classList.toggle('active', enabled);
      }),
      this.bus.on('dev_vision_toggled', ({ enabled }) => {
        if (this.devVisionBtn) {
          this.devVisionBtn.textContent = `[~] DEV VISION: ${enabled ? 'ON' : 'OFF'}`;
          this.devVisionBtn.style.color = enabled ? '#00f0ff' : '#94a3b8';
        }
      }),
      this.bus.on('asset_progress', ({ ratio }) => {
        const pct = Math.round(ratio * 100);
        this.loadingBarFill.style.width = `${pct}%`;
        this.loadingPercent.textContent = `${pct}%`;
      }),
      this.bus.on('player_health_changed', ({ health, max }) => {
        this.updateHearts(health, max);
      }),
      this.bus.on('eggs_updated', ({ collected, total }) => {
        this.eggsCountElement.textContent = `${collected} / ${total}`;
      }),
      this.bus.on('player_speed_bonus', ({ bonus }) => {
        if (bonus > 0) {
          this.bonusSpeedBadge.style.display = 'block';
          this.bonusSpeedBadge.textContent = `+${bonus} KM/H BOOST`;
        } else {
          this.bonusSpeedBadge.style.display = 'none';
        }
      }),
      this.bus.on('player_stunned', () => {
        const badge = document.getElementById('stun-warning-badge');
        if (badge) badge.style.display = 'block';
      }),
      this.bus.on('player_recovered', () => {
        const badge = document.getElementById('stun-warning-badge');
        if (badge) badge.style.display = 'none';
      }),
      this.bus.on('hazard_state_changed', ({ inHazard, name }) => {
        const badge = document.getElementById('hazard-warning-badge');
        if (badge) {
          badge.style.display = inHazard ? 'block' : 'none';
          if (inHazard) badge.textContent = `⚠️ ${name.toUpperCase()}: VISCOUS DRAG (-60% SPEED)`;
        }
      }),
      // FFXIV / WoW Style Boss Cast Bar Listeners
      this.bus.on('rexy_roar_cast_started', ({ duration }) => {
        if (this.castDismissTimer) clearTimeout(this.castDismissTimer);
        this.rexyCastContainer.classList.remove('hidden', 'fade-out', 'cast-success', 'cast-failed');
        this.rexyCastCountdown.textContent = `${duration.toFixed(1)}s`;
        this.rexyCastFill.style.width = '0%';
        this.rexyCastStatus.className = 'rexy-cast-status in-danger';
        this.rexyCastStatus.textContent = '⚠️ PREPARING ACOUSTIC EMP!';
        this.rexyCastHint.textContent = 'FLOOR IT TO ESCAPE RADIUS!';
      }),
      this.bus.on('rexy_roar_cast_progress', ({ elapsed, duration, progress, shockwaveRadius, distToPlayer }) => {
        const remaining = Math.max(0, duration - elapsed);
        this.rexyCastCountdown.textContent = `${remaining.toFixed(1)}s`;
        this.rexyCastFill.style.width = `${progress * 100}%`;
        const inRadius = distToPlayer < shockwaveRadius;
        if (inRadius) {
          this.rexyCastStatus.className = 'rexy-cast-status in-danger';
          this.rexyCastStatus.textContent = `⚠️ IN BLAST RADIUS: ${Math.round(distToPlayer)}m / ${shockwaveRadius}m`;
          this.rexyCastHint.textContent = `ESCAPE ${Math.round(shockwaveRadius - distToPlayer)}m FURTHER!`;
        } else {
          this.rexyCastStatus.className = 'rexy-cast-status safe';
          this.rexyCastStatus.textContent = `🛡️ OUT OF RANGE: ${Math.round(distToPlayer)}m / ${shockwaveRadius}m`;
          this.rexyCastHint.textContent = `SAFE! HOLD DISTANCE!`;
        }
      }),
      this.bus.on('rexy_roar_escaped', ({ distance, radius }) => {
        this.rexyCastFill.style.width = '100%';
        this.rexyCastContainer.classList.add('cast-success');
        this.rexyCastStatus.className = 'rexy-cast-status safe';
        this.rexyCastStatus.textContent = `⚡ BLAST EVADED! (${Math.round(distance)}m >= ${radius}m)`;
        this.rexyCastHint.textContent = `ENGINE SAFE!`;
        this.castDismissTimer = window.setTimeout(() => {
          this.rexyCastContainer.classList.add('fade-out');
          setTimeout(() => this.rexyCastContainer.classList.add('hidden'), 400);
        }, 1400);
      }),
      this.bus.on('rexy_roar_hit', ({ distance }) => {
        this.rexyCastFill.style.width = '100%';
        this.rexyCastContainer.classList.add('cast-failed');
        this.rexyCastStatus.className = 'rexy-cast-status in-danger';
        this.rexyCastStatus.textContent = `💥 EMP SHOCKWAVE HIT! (${Math.round(distance)}m)`;
        this.rexyCastHint.textContent = `ENGINE DISABLED!`;
        this.castDismissTimer = window.setTimeout(() => {
          this.rexyCastContainer.classList.add('fade-out');
          setTimeout(() => this.rexyCastContainer.classList.add('hidden'), 400);
        }, 1400);
      })
    );
  }

  public updateSpeed(speedKmh: number): void {
    this.speedVal.textContent = speedKmh.toString().padStart(2, '0');
    // Speedometer bar scaled to 360 km/h for full visual range
    const pct = Math.min(100, (speedKmh / 360) * 100);
    this.speedBarFill.style.width = `${pct}%`;
  }

  public updateHearts(health: number, max: number): void {
    this.healthContainer.innerHTML = '';
    for (let i = 0; i < max; i++) {
      const heart = document.createElement('span');
      heart.className = `heart-icon ${i < health ? '' : 'lost'}`;
      heart.innerHTML = '&#9829;';
      this.healthContainer.appendChild(heart);
    }
  }

  public setScreen(state: GameState): void {
    this.loadingScreen.classList.add('hidden');
    this.menuScreen.classList.add('hidden');
    this.pauseScreen.classList.add('hidden');
    this.victoryScreen.classList.add('hidden');
    this.gameOverScreen.classList.add('hidden');

    switch (state) {
      case GameState.LOADING:
        if (this.castDismissTimer) clearTimeout(this.castDismissTimer);
        this.rexyCastContainer.classList.add('hidden');
        this.loadingScreen.classList.remove('hidden');
        this.hudElement.classList.add('hidden');
        break;
      case GameState.MAIN_MENU:
        if (this.castDismissTimer) clearTimeout(this.castDismissTimer);
        this.rexyCastContainer.classList.add('hidden');
        this.menuScreen.classList.remove('hidden');
        this.hudElement.classList.add('hidden');
        break;
      case GameState.PLAYING:
        this.hudElement.classList.remove('hidden');
        break;
      case GameState.PAUSED:
        this.pauseScreen.classList.remove('hidden');
        break;
      case GameState.VICTORY:
        this.victoryScreen.classList.remove('hidden');
        break;
      case GameState.GAME_OVER:
        this.gameOverScreen.classList.remove('hidden');
        break;
      case GameState.BOOT:
        break;
    }
  }

  public dispose(): void {
    this.unbindFns.forEach((fn) => fn());
    this.unbindFns.length = 0;
    this.overlay.remove();
  }
}
