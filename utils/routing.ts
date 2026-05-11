import type { HistoryEntry } from '../types';

export type View = 'home' | 'history' | 'manifesto' | 'settings' | 'result' | 'concept' | 'roundtable';
export type AppRoute =
  | '/'
  | '/active'
  | '/history'
  | '/history/sample'
  | '/manifesto'
  | '/settings'
  | '/roundtable'
  | `/history/${string}`
  | `/concept/${string}/${string}`
  | `/roundtable/${string}`;

const ROUTES: Record<string, AppRoute> = {
  '/': '/',
  '/active': '/active',
  '/history': '/history',
  '/history/': '/history',
  '/history/sample': '/history/sample',
  '/history/sample/': '/history/sample',
  '/manifesto': '/manifesto',
  '/manifesto/': '/manifesto',
  '/settings': '/settings',
  '/settings/': '/settings',
  '/roundtable': '/roundtable',
  '/roundtable/': '/roundtable',
};

export const normalizeRoute = (pathname: string): AppRoute => {
  if (ROUTES[pathname]) return ROUTES[pathname];
  if (/^\/concept\/[^/]+\/[^/]+\/?$/.test(pathname)) return pathname.replace(/\/$/, '') as AppRoute;
  if (/^\/history\/[^/]+\/?$/.test(pathname)) return pathname.replace(/\/$/, '') as AppRoute;
  if (/^\/roundtable\/[^/]+\/?$/.test(pathname)) return pathname.replace(/\/$/, '') as AppRoute;
  return '/';
};

export const pushRoute = (route: AppRoute) => {
  if (window.location.pathname !== route) {
    window.history.pushState(null, '', route);
  }
};

export const historyItemRoute = (entry: HistoryEntry): AppRoute => {
  if (entry.isPreset || entry.generatedByChain) return '/history/sample';
  return `/history/${encodeURIComponent(entry.id)}`;
};

const safeDecodeURIComponent = (value: string): string | null => {
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
};

export const routeHistoryId = (route: AppRoute) => {
  if (!route.startsWith('/history/')) return '';
  return safeDecodeURIComponent(route.slice('/history/'.length)) || '';
};

export const parseConceptRoute = (route: AppRoute): { analysisId: string; keywordId: string } | null => {
  if (!route.startsWith('/concept/')) return null;
  const [analysisRaw, keywordRaw] = route.slice('/concept/'.length).split('/');
  if (!analysisRaw || !keywordRaw) return null;
  const analysisId = safeDecodeURIComponent(analysisRaw);
  const keywordId = safeDecodeURIComponent(keywordRaw);
  return analysisId && keywordId ? { analysisId, keywordId } : null;
};

export const conceptRoute = (analysisId: string, keywordId: string): AppRoute =>
  `/concept/${encodeURIComponent(analysisId)}/${encodeURIComponent(keywordId)}` as AppRoute;

/**
 * Extract the session id from `/roundtable/<sessionId>`. Returns empty string
 * for the `/roundtable` index or unrecognized inputs, matching `routeHistoryId`.
 */
export const routeRoundtableId = (route: AppRoute): string => {
  if (!route.startsWith('/roundtable/')) return '';
  const tail = route.slice('/roundtable/'.length);
  if (!tail) return '';
  return safeDecodeURIComponent(tail) || '';
};

export const roundtableSessionRoute = (sessionId: string): AppRoute =>
  `/roundtable/${encodeURIComponent(sessionId)}` as AppRoute;
