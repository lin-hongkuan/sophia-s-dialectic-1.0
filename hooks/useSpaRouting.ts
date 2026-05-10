import { useEffect, useRef } from 'react';
import type { AppRoute } from '../utils/routing';
import { normalizeRoute } from '../utils/routing';

export type OpenRouteHandler = (route: AppRoute, replace?: boolean) => void;

/**
 * Owns browser-level SPA routing effects: initial path hydration and popstate.
 * The route resolver itself stays in App.tsx for now because it needs app state,
 * but the imperative browser wiring is isolated here.
 */
export const useSpaRouting = (openRoute: OpenRouteHandler) => {
  const openRouteRef = useRef(openRoute);

  useEffect(() => {
    openRouteRef.current = openRoute;
  }, [openRoute]);

  useEffect(() => {
    openRouteRef.current(normalizeRoute(window.location.pathname), true);
    const handlePopState = () => openRouteRef.current(normalizeRoute(window.location.pathname), true);
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);
};
