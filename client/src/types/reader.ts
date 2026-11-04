export type ReaderTheme = 'dark' | 'light' | 'sepia' | 'nord';

export type ReaderLayoutMode = 'single' | 'dual' | 'continuous';

export interface ReaderSettings {
  invertColors: boolean;
  isDualPage: boolean;
  dualCoverStandalone: boolean;
  showBottomProgress: boolean;
  showChapterProgress?: boolean;
  trackpadSwipe: boolean;
  floatingButtons: boolean;
  upDownFlip: boolean;
  bookTexture: boolean;
  continuousScroll: boolean;
  continuousPageSpacing: boolean;
  centerVertically: boolean;
  headerPinned: boolean;
}

export interface TtsPlaybackState {
  isPlaying: boolean;
  isPaused: boolean;
  currentParagraph: number;
  totalParagraphs: number;
  speed: number;
  voice: string;
  autoAdvance: boolean;
}

export interface PageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}
