import { useEffect, useState } from 'react';

export const useOnlineStatus = () => {
  const [isOffline, setIsOffline] = useState(() =>
    typeof navigator !== 'undefined' && navigator.onLine === false
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onOnline = () => setIsOffline(false);
    const onOffline = () => setIsOffline(true);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  return isOffline;
};
