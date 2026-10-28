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
  private loadingBarFill!: HTMLElement;
  private loadingPercent!: HTMLElement;

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

    this.overlay.innerHTML = `
      <!-- HUD -->
      <div id="hud" class="hidden">
        <div class="hud-top">
          <div class="glass-panel hud-pill health-pill">
            <span>HP</span>
            <div id="health-hearts" class="health-hearts"></div>
          </div>

          <button id="btn-wireframe-debug" class="glass-panel hud-pill wireframe-pill interactive">[F] WIREFRAME: OFF</button>

          <div class="glass-panel hud-pill eggs-pill">
            <span>EGGS</span>
            <span id="eggs-count">0 / 0</span>
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
          </div>

          <div class="controls-hint glass-panel">
            <span class="key-badge">W</span><span class="key-badge">A</span><span class="key-badge">S</span><span class="key-badge">D</span> Drive |
            <span class="key-badge">SPACE</span> Handbrake |
            <span class="key-badge">C</span> Camera |
            <span class="key-badge">F</span> Wireframe |
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
          <h2 style="font-size: 2.6rem; font-weight: 900; color: var(--danger);">YOU WERE HUNTED!</h2>
          <p style="color: var(--text-muted); font-size: 1.1rem;">Rexy destroyed your vehicle. Don't stop moving next time!</p>
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
    this.loadingBarFill = document.getElementById('loading-bar-fill')!;
    this.loadingPercent = document.getElementById('loading-percent')!;

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

    this.wireframeBtn.addEventListener('click', () => {
      this.bus.emit('toggle_wireframe_debug');
      this.bus.emit('ui_click');
    });
  }

  private setupBusListeners(): void {
    this.unbindFns.push(
      this.bus.on('wireframe_debug_toggled', ({ enabled }) => {
        this.wireframeBtn.textContent = `[F] WIREFRAME: ${enabled ? 'ON' : 'OFF'}`;
        this.wireframeBtn.classList.toggle('active', enabled);
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
          this.bonusSpeedBadge.textContent = `+${bonus} BOOST`;
        } else {
          this.bonusSpeedBadge.style.display = 'none';
        }
      })
    );
  }

  public updateSpeed(speedKmh: number): void {
    this.speedVal.textContent = speedKmh.toString().padStart(2, '0');
    const pct = Math.min(100, (speedKmh / 140) * 100);
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
        this.loadingScreen.classList.remove('hidden');
        this.hudElement.classList.add('hidden');
        break;
      case GameState.MAIN_MENU:
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
