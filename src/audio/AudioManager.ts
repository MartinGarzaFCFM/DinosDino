import { AssetLoader, IAssetLoader } from '../graphics/AssetLoader.ts';
import { EventBus, IEventBus } from '../core/EventBus.ts';

export class AudioManager {
  private static instance: AudioManager;
  private readonly bus: IEventBus;
  private readonly loader: IAssetLoader;

  private ctx?: AudioContext;
  private bgmBuffer?: AudioBuffer;
  private bgmSource?: AudioBufferSourceNode;
  private clickBuffer?: AudioBuffer;
  private engineBuffer?: AudioBuffer;

  private isMusicEnabled: boolean = true;
  private isSfxEnabled: boolean = true;
  private bgmGain?: GainNode;
  private sfxGain?: GainNode;

  public constructor(
    bus: IEventBus = EventBus.getInstance(),
    loader: IAssetLoader = AssetLoader.getInstance()
  ) {
    this.bus = bus;
    this.loader = loader;
    this.setupListeners();
  }

  public static getInstance(): AudioManager {
    if (!AudioManager.instance) {
      AudioManager.instance = new AudioManager();
    }
    return AudioManager.instance;
  }

  private initContext(): void {
    if (!this.ctx) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new AudioCtx();

      this.bgmGain = this.ctx.createGain();
      this.bgmGain.gain.value = 0.25;
      this.bgmGain.connect(this.ctx.destination);

      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = 0.4;
      this.sfxGain.connect(this.ctx.destination);
    }

    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public async preload(): Promise<void> {
    try {
      this.bgmBuffer = await this.loader.loadAudio('/assets/musica/jungleTribal.mp3');
    } catch (e) {
      console.warn('Could not load BGM audio', e);
    }

    try {
      this.clickBuffer = await this.loader.loadAudio('/assets/sonidos/click.wav');
      this.engineBuffer = await this.loader.loadAudio('/assets/sonidos/car-engine-start.wav');
    } catch (e) {
      console.warn('Could not load SFX audio', e);
    }
  }

  public playBGM(): void {
    if (!this.isMusicEnabled || !this.bgmBuffer) return;
    this.initContext();

    this.stopBGM();

    this.bgmSource = this.ctx!.createBufferSource();
    this.bgmSource.buffer = this.bgmBuffer;
    this.bgmSource.loop = true;
    this.bgmSource.connect(this.bgmGain!);
    this.bgmSource.start(0);
  }

  public stopBGM(): void {
    if (this.bgmSource) {
      try {
        this.bgmSource.stop();
      } catch {
        // Ignore if source already stopped
      }
      this.bgmSource.disconnect();
      this.bgmSource = undefined;
    }
  }

  public playClick(): void {
    if (!this.isSfxEnabled || !this.clickBuffer) return;
    this.initContext();
    const source = this.ctx!.createBufferSource();
    source.buffer = this.clickBuffer;
    source.connect(this.sfxGain!);
    source.start(0);
  }

  public playEngineStart(): void {
    if (!this.isSfxEnabled || !this.engineBuffer) return;
    this.initContext();
    const source = this.ctx!.createBufferSource();
    source.buffer = this.engineBuffer;
    source.connect(this.sfxGain!);
    source.start(0);
  }

  public playChime(freq: number = 880): void {
    if (!this.isSfxEnabled) return;
    this.initContext();

    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'triangle';
    osc.frequency.setValueAtTime(freq, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(freq * 1.5, this.ctx!.currentTime + 0.15);

    gain.gain.setValueAtTime(0.3, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, this.ctx!.currentTime + 0.35);

    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.35);
  }

  public playImpact(): void {
    if (!this.isSfxEnabled) return;
    this.initContext();

    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(120, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(30, this.ctx!.currentTime + 0.25);

    gain.gain.setValueAtTime(0.6, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.3);

    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.3);
  }

  public playRoar(): void {
    if (!this.isSfxEnabled) return;
    this.initContext();

    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    // Deep predatory ground-trembling rumble
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(65, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(115, this.ctx!.currentTime + 0.3);
    osc.frequency.exponentialRampToValueAtTime(32, this.ctx!.currentTime + 0.85);

    gain.gain.setValueAtTime(0.75, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.9);

    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.9);
  }

  public playEngineStall(): void {
    if (!this.isSfxEnabled) return;
    this.initContext();

    const osc = this.ctx!.createOscillator();
    const gain = this.ctx!.createGain();

    // Sputtering engine stall audio
    osc.type = 'square';
    osc.frequency.setValueAtTime(95, this.ctx!.currentTime);
    osc.frequency.exponentialRampToValueAtTime(22, this.ctx!.currentTime + 0.45);

    gain.gain.setValueAtTime(0.45, this.ctx!.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, this.ctx!.currentTime + 0.5);

    osc.connect(gain);
    gain.connect(this.sfxGain!);
    osc.start();
    osc.stop(this.ctx!.currentTime + 0.5);
  }

  public setMusicEnabled(enabled: boolean): void {
    this.isMusicEnabled = enabled;
    if (enabled) {
      this.playBGM();
    } else {
      this.stopBGM();
    }
  }

  public setSfxEnabled(enabled: boolean): void {
    this.isSfxEnabled = enabled;
  }

  private setupListeners(): void {
    this.bus.on('start_game_request', () => this.playEngineStart());
    this.bus.on('egg_collected', () => this.playChime(660));
    this.bus.on('pickup_collected', () => this.playChime(880));
    this.bus.on('player_healed', () => this.playChime(1046));
    this.bus.on('player_damaged', () => this.playImpact());
    this.bus.on('player_stunned', () => this.playEngineStall());
    this.bus.on('player_recovered', () => this.playEngineStart());
    this.bus.on('rexy_roar', () => this.playRoar());
  }
}
