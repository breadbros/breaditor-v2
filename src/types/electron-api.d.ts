export {};

declare global {
  interface Window {
    electronAPI?: {
      onDevelopmentUpdate?: (callback: (available: boolean, restartRequired?: boolean) => void) => () => void;
      reloadDevelopment?: () => void;
      showImageInFolder?: (imageUrl: string) => Promise<void>;
    };
  }
}
