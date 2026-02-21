import { useState, useEffect, useCallback, useRef } from 'react';

// Type for the beforeinstallprompt event
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

// Extend Window to include the event
declare global {
  interface WindowEventMap {
    beforeinstallprompt: BeforeInstallPromptEvent;
  }
}

const DISMISS_KEY = 'pwa-install-dismissed';
const SHOW_DELAY_MS = 2500;

interface UsePWAInstallPromptReturn {
  showPrompt: boolean;
  isIOS: boolean;
  canUseNativePrompt: boolean;
  dismiss: () => void;
  triggerNativeInstall: () => Promise<void>;
}

export function usePWAInstallPrompt(): UsePWAInstallPromptReturn {
  const [showPrompt, setShowPrompt] = useState(false);
  const [canUseNativePrompt, setCanUseNativePrompt] = useState(false);
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null);

  // Platform detection (computed once)
  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true);

  const isIOS =
    typeof navigator !== 'undefined' &&
    /iPad|iPhone|iPod/.test(navigator.userAgent);

  const isAndroid =
    typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);

  const isMobile = isIOS || isAndroid;

  // Check if previously dismissed
  const isDismissed = useCallback((): boolean => {
    try {
      return localStorage.getItem(DISMISS_KEY) !== null;
    } catch {
      return false;
    }
  }, []);

  // Save dismissal to localStorage
  const dismiss = useCallback(() => {
    try {
      localStorage.setItem(DISMISS_KEY, new Date().toISOString());
    } catch {
      // localStorage not available
    }
    setShowPrompt(false);
  }, []);

  // Trigger native install prompt (Android/Chrome)
  const triggerNativeInstall = useCallback(async () => {
    if (!deferredPromptRef.current) return;

    try {
      await deferredPromptRef.current.prompt();
      const choice = await deferredPromptRef.current.userChoice;

      if (choice.outcome === 'accepted') {
        // User installed, save dismissal
        dismiss();
      }
      // Clear the deferred prompt either way
      deferredPromptRef.current = null;
      setCanUseNativePrompt(false);
    } catch (err) {
      console.error('Failed to show install prompt:', err);
    }
  }, [dismiss]);

  useEffect(() => {
    // Don't show if:
    // - Already in standalone/PWA mode
    // - Not on mobile
    // - Previously dismissed
    if (isStandalone || !isMobile || isDismissed()) {
      return;
    }

    // Listen for beforeinstallprompt (Android Chrome)
    const handleBeforeInstallPrompt = (e: BeforeInstallPromptEvent) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      setCanUseNativePrompt(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Show prompt after delay
    const timeoutId = setTimeout(() => {
      setShowPrompt(true);
    }, SHOW_DELAY_MS);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      clearTimeout(timeoutId);
    };
  }, [isStandalone, isMobile, isDismissed]);

  return {
    showPrompt,
    isIOS,
    canUseNativePrompt,
    dismiss,
    triggerNativeInstall,
  };
}
