export {};

declare global {
  interface Window {
    electronAPI?: {
      saveTextFile?: (request: {sourceUrl?: string; suggestedName: string; text: string; saveAs: boolean}) => Promise<{url: string} | null>;
      onDevelopmentUpdate?: (callback: (available: boolean, restartRequired?: boolean) => void) => () => void;
      reloadDevelopment?: () => void;
      showImageInFolder?: (imageUrl: string) => Promise<void>;
      watchSpriteFiles?: (sources: {json?: string; image?: string}, onChange: (kind: 'json' | 'image') => void) => () => void;
    };
  }
}
