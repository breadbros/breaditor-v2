export {};

declare global {
  interface Window {
    electronAPI?: {
      isDevelopment?: boolean;
      saveTextFile?: (request: {sourceUrl?: string; suggestedName: string; text: string; saveAs: boolean}) => Promise<{url: string} | null>;
      onDevelopmentUpdate?: (callback: (available: boolean, restartRequired?: boolean) => void) => () => void;
      reloadDevelopment?: () => void;
      showImageInFolder?: (imageUrl: string) => Promise<void>;
      watchSpriteFiles?: (sources: {json?: string; image?: string}, onChange: (kind: 'json' | 'image') => void) => () => void;
      watchMapFiles?: (urls: string[], onChange: (urls: string[]) => void) => () => void;
      mapFileHashes?: (urls: string[]) => Promise<Record<string, string | null>>;
      saveMapFiles?: (request: {sourceUrl?: string; suggestedName: string; map: string; data: string; saveAs: boolean; contentRootUrl: string; dependencies: string[]; expectedHashes: Record<string, string | null>; exportProject?: boolean}) => Promise<{url: string; dataUrl: string; map: string; contentRootUrl: string; hashes: Record<string, string | null>; journal: string} | null>;
      saveMapImage?: (request: {suggestedName: string; dataUrl: string}) => Promise<{url: string} | null>;
    };
  }
}
