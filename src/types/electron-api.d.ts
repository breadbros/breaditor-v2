export {};

declare global {
  interface Window {
    electronAPI?: {
      onDevelopmentUpdate?: (callback: (available: boolean, restartRequired?: boolean) => void) => () => void;
      reloadDevelopment?: () => void;
      showImageInFolder?: (imageUrl: string) => Promise<void>;
      watchSpriteFiles?: (sources: {json?: string; image?: string}, onChange: (kind: 'json' | 'image') => void) => () => void;
    };
  }
}
