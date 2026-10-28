export enum GameState {
  BOOT = 'BOOT',
  LOADING = 'LOADING',
  MAIN_MENU = 'MAIN_MENU',
  PLAYING = 'PLAYING',
  PAUSED = 'PAUSED',
  VICTORY = 'VICTORY',
  GAME_OVER = 'GAME_OVER'
}

export type Difficulty = 'Easy' | 'Medium' | 'Hard';
export type LevelTheme = 'Park' | 'Steel' | 'Woods';

export interface GameSessionConfig {
  difficulty: Difficulty;
  level: LevelTheme;
}
