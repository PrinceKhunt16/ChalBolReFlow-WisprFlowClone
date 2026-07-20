export type DictationState = 'idle' | 'listening' | 'processing';

export interface DictationActivity {
  id: string;
  text: string;
  durationSeconds: number;
  wordsCount: number;
  appName: 'VS Code' | 'Chrome' | 'Slack' | 'Cursor' | 'System';
  timestamp: string;
  isFavorite: boolean;
}

export type SupportedLanguage = 'English' | 'Hindi' | 'Gujarati';
export type AIProviderName = 'Groq';

export interface AppSettings {
  launchAtStartup: boolean;
  minimizeToTray: boolean;
  notifications: boolean;
  language: SupportedLanguage;
  aiProvider: AIProviderName;
  apiKey: string;
  model: string;
  temperature: number;
  version: string;
}

declare global {
  interface Window {
    electronAPI?: {
      getBackendBaseUrl: () => Promise<string>;
      sendWindowAction: (action: 'minimize' | 'close' | 'hide') => void;
      startDictation: () => void;
      stopDictation: () => void;
      cancelDictation: () => void;
      completeDictation: (data: { text: string; duration: number; app: string }) => void;
      floatingReady: () => void;
      onTrayPauseToggle: (callback: (isPaused: boolean) => void) => () => void;
      onNavigateTo: (callback: (page: string) => void) => () => void;
      onGlobalShortcutStart: (callback: () => void) => () => void;
      onGlobalShortcutStop: (callback: () => void) => () => void;
      onDictationCompleted: (callback: (data: { text: string; duration: number; app: string }) => void) => () => void;
      onDictationCancelled: (callback: () => void) => () => void;
      isElectron: boolean;
    };
  }
}
