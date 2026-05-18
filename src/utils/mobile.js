// Mobile-specific utilities and hooks
import { useState, useEffect } from 'react';
import { sendOfflineAlert, sendOnlineAlert } from './notifications';

// Hook for online/offline status
export const useOnlineStatus = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      sendOnlineAlert();
    };

    const handleOffline = () => {
      setIsOnline(false);
      sendOfflineAlert();
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
};

// Hook for PWA install prompt
export const useInstallPrompt = () => {
  const [deferredPrompt, setDeferredPrompt] = useState(null);
  const [showPrompt, setShowPrompt] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e) => {
      // Prevent the mini-infobar from appearing on mobile
      e.preventDefault();
      // Stash the event so it can be triggered later
      setDeferredPrompt(e);
      // Show custom install prompt after a delay
      setTimeout(() => setShowPrompt(true), 3000);
    };

    const handleAppInstalled = () => {
      // Hide the install prompt
      setShowPrompt(false);
      setDeferredPrompt(null);
      console.log('[PWA] App was installed');
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const installApp = async () => {
    if (!deferredPrompt) return;

    // Show the install prompt
    deferredPrompt.prompt();

    // Wait for the user to respond to the prompt
    const { outcome } = await deferredPrompt.userChoice;

    // Reset the deferred prompt
    setDeferredPrompt(null);
    setShowPrompt(false);

    console.log(`[PWA] User ${outcome === 'accepted' ? 'accepted' : 'dismissed'} the install prompt`);
  };

  const dismissPrompt = () => {
    setShowPrompt(false);
  };

  return {
    canInstall: !!deferredPrompt,
    showPrompt,
    installApp,
    dismissPrompt
  };
};

// Hook for device orientation (useful for mobile UX)
export const useDeviceOrientation = () => {
  const [orientation, setOrientation] = useState('portrait');

  useEffect(() => {
    const updateOrientation = () => {
      const isPortrait = window.innerHeight > window.innerWidth;
      setOrientation(isPortrait ? 'portrait' : 'landscape');
    };

    updateOrientation();
    window.addEventListener('resize', updateOrientation);
    window.addEventListener('orientationchange', updateOrientation);

    return () => {
      window.removeEventListener('resize', updateOrientation);
      window.removeEventListener('orientationchange', updateOrientation);
    };
  }, []);

  return orientation;
};

// Hook for viewport height (fixes mobile browser issues)
export const useViewportHeight = () => {
  useEffect(() => {
    const setVH = () => {
      const vh = window.innerHeight * 0.01;
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    setVH();
    window.addEventListener('resize', setVH);
    window.addEventListener('orientationchange', setVH);

    return () => {
      window.removeEventListener('resize', setVH);
      window.removeEventListener('orientationchange', setVH);
    };
  }, []);
};

// Utility to detect if running in standalone mode (PWA)
export const isPWA = () => {
  return window.matchMedia('(display-mode: standalone)').matches ||
         window.navigator.standalone === true ||
         document.referrer.includes('android-app://');
};

// Utility to detect mobile device
export const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
         (window.innerWidth <= 768 && window.innerHeight <= 1024);
};

// Utility to detect touch device
export const isTouchDevice = () => {
  return 'ontouchstart' in window || navigator.maxTouchPoints > 0;
};

export const getDeviceLocation = async () => {
  if (window.Capacitor?.isNativePlatform?.()) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation');
      const coordinates = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 });
      return {
        latitude: coordinates.coords.latitude,
        longitude: coordinates.coords.longitude
      };
    } catch (err) {
      console.error('[GEO] Capacitor geolocation error:', err);
      return null;
    }
  }

  if ('geolocation' in navigator) {
    return new Promise((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.error('[GEO] Web geolocation error:', error);
          reject(null);
        },
        { enableHighAccuracy: true, timeout: 10000 }
      );
    }).catch(() => null);
  }

  return null;
};

export const getCameraPhoto = async () => {
  if (window.Capacitor?.isNativePlatform?.()) {
    try {
      const { Camera, CameraResultType, CameraSource } = await import('@capacitor/camera');
      const photo = await Camera.getPhoto({
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Prompt,
        quality: 70,
        width: 1024
      });

      return {
        dataUrl: photo.dataUrl,
        fileName: `photo-${Date.now()}.jpeg`
      };
    } catch (err) {
      console.error('[CAMERA] Capacitor camera error:', err);
      return null;
    }
  }

  return null;
};

// Vibration API utility (mobile haptic feedback)
export const vibrate = (pattern = [50]) => {
  if ('vibrate' in navigator) {
    navigator.vibrate(pattern);
  }
};

// Wake lock utility (keep screen awake)
export const useWakeLock = () => {
  const [wakeLock, setWakeLock] = useState(null);

  const requestWakeLock = async () => {
    try {
      if ('wakeLock' in navigator) {
        const lock = await navigator.wakeLock.request('screen');
        setWakeLock(lock);

        lock.addEventListener('release', () => {
          setWakeLock(null);
        });

        console.log('[WAKE] Screen wake lock acquired');
      }
    } catch (err) {
      console.error('[WAKE] Failed to acquire wake lock:', err);
    }
  };

  const releaseWakeLock = async () => {
    if (wakeLock) {
      await wakeLock.release();
      setWakeLock(null);
      console.log('[WAKE] Screen wake lock released');
    }
  };

  useEffect(() => {
    return () => {
      if (wakeLock) {
        wakeLock.release();
      }
    };
  }, [wakeLock]);

  return {
    isSupported: 'wakeLock' in navigator,
    isActive: !!wakeLock,
    requestWakeLock,
    releaseWakeLock
  };
};