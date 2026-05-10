import { useEffect } from 'react';

/**
 * Removes the static pre-React boot splash once React has mounted and cancels
 * its slow-network timer. Keeping this outside App.tsx makes the application
 * shell easier to reason about and keeps boot concerns isolated from routing.
 */
export const useBootSplashCleanup = () => {
  useEffect(() => {
    const splash = document.getElementById('boot-splash');
    if (splash) splash.remove();
    const w = window as Window & { __bootSlowTimer?: ReturnType<typeof setTimeout> };
    if (w.__bootSlowTimer) {
      clearTimeout(w.__bootSlowTimer);
      w.__bootSlowTimer = undefined;
    }
  }, []);
};
