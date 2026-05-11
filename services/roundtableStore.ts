/**
 * Local persistence for roundtable sessions.
 *
 * Mirrors the split used by `historyStore`:
 *  - localStorage (sophia.roundtables.v1) holds the "lean" sessions — every
 *    field except base64 avatar URLs.
 *  - IndexedDB (sophia-images-v1 → avatars) stores the heavy base64 data,
 *    keyed by `buildRoundtableAvatarKey(sessionId, participantId)`.
 *
 * This keeps the 5 MB localStorage budget for the lean metadata while
 * allowing the IDB store to absorb arbitrarily many portrait PNGs.
 */

import type { RoundtableSession } from '../types';
import { createLocalJsonStore } from './localStorageGateway';
import {
  buildRoundtableAvatarKey,
  getAvatarImages,
  putAvatarImage,
  deleteAvatarImages,
} from './imageStore';

export const ROUNDTABLE_STORAGE_KEY = 'sophia.roundtables.v1';
export const ROUNDTABLE_HISTORY_LIMIT = 10;
export const ROUNDTABLE_EXPORT_VERSION = 1;

interface RoundtableArchiveShape {
  schemaVersion: 1;
  sessions: RoundtableSession[];
}

const archiveStore = createLocalJsonStore<RoundtableArchiveShape | RoundtableSession[]>(ROUNDTABLE_STORAGE_KEY);

const isPresumedSession = (value: unknown): value is RoundtableSession => {
  if (!value || typeof value !== 'object') return false;
  const candidate = value as Partial<RoundtableSession>;
  return typeof candidate.id === 'string'
    && typeof candidate.topic === 'string'
    && typeof candidate.title === 'string'
    && typeof candidate.createdAt === 'string'
    && Array.isArray(candidate.participants)
    && Array.isArray(candidate.turns);
};

const sortByUpdatedAtDesc = (a: RoundtableSession, b: RoundtableSession) => {
  const aMs = Date.parse(a.updatedAt || a.createdAt);
  const bMs = Date.parse(b.updatedAt || b.createdAt);
  return (Number.isFinite(bMs) ? bMs : 0) - (Number.isFinite(aMs) ? aMs : 0);
};

const readRaw = (): RoundtableSession[] => {
  const parsed = archiveStore.get();
  if (!parsed) return [];
  if (Array.isArray(parsed)) return parsed.filter(isPresumedSession);
  if (Array.isArray(parsed.sessions)) return parsed.sessions.filter(isPresumedSession);
  return [];
};

/* ---------- avatar splitting / merging ---------- */

const stripAvatarUrl = (session: RoundtableSession): {
  lean: RoundtableSession;
  images: Array<{ key: string; imageUrl: string }>;
} => {
  const images: Array<{ key: string; imageUrl: string }> = [];
  const lean: RoundtableSession = {
    ...session,
    participants: session.participants.map((participant) => {
      if (!participant.avatar?.imageUrl) return participant;
      if (!participant.avatar.imageUrl.startsWith('data:')) return participant;
      images.push({
        key: buildRoundtableAvatarKey(session.id, participant.id),
        imageUrl: participant.avatar.imageUrl,
      });
      return {
        ...participant,
        avatar: { ...participant.avatar, imageUrl: '' },
      };
    }),
  };
  return { lean, images };
};

const mergeAvatarUrls = (session: RoundtableSession, imageMap: Record<string, string>): RoundtableSession => ({
  ...session,
  participants: session.participants.map((participant) => {
    if (!participant.avatar) return participant;
    if (participant.avatar.imageUrl) return participant;
    const url = imageMap[buildRoundtableAvatarKey(session.id, participant.id)];
    if (!url) return participant;
    return { ...participant, avatar: { ...participant.avatar, imageUrl: url } };
  }),
});

/* ---------- public API ---------- */

/**
 * Read every stored session (lean — avatars not yet loaded from IDB).
 * Sorted newest first.
 */
export const loadRoundtableSessions = (): RoundtableSession[] =>
  readRaw().slice().sort(sortByUpdatedAtDesc);

/**
 * Find a single session by id. Lean — call `hydrateRoundtableSession`
 * afterwards if you need the avatar base64 back.
 */
export const findRoundtableSession = (sessionId: string): RoundtableSession | null =>
  readRaw().find((session) => session.id === sessionId) || null;

/**
 * Persist (insert or update) a session. Base64 avatars are split out to IDB;
 * only a lean copy lives in localStorage. Oldest sessions beyond the limit
 * are dropped (their IDB images are garbage-collected).
 */
export const saveRoundtableSession = async (session: RoundtableSession): Promise<void> => {
  const existing = readRaw();
  const filtered = existing.filter((entry) => entry.id !== session.id);

  const { lean, images } = stripAvatarUrl(session);

  const merged = [lean, ...filtered].sort(sortByUpdatedAtDesc);
  const trimmed = merged.slice(0, ROUNDTABLE_HISTORY_LIMIT);

  const dropped = merged.slice(ROUNDTABLE_HISTORY_LIMIT);
  if (dropped.length > 0) {
    const droppedKeys: string[] = [];
    for (const droppedSession of dropped) {
      for (const participant of droppedSession.participants) {
        droppedKeys.push(buildRoundtableAvatarKey(droppedSession.id, participant.id));
      }
    }
    if (droppedKeys.length > 0) void deleteAvatarImages(droppedKeys);
  }

  archiveStore.set({ schemaVersion: 1, sessions: trimmed });

  if (images.length > 0) {
    await Promise.all(images.map(({ key, imageUrl }) => putAvatarImage(key, imageUrl)));
  }
};

/**
 * Remove one session and its associated IDB avatars.
 */
export const deleteRoundtableSession = async (sessionId: string): Promise<void> => {
  const existing = readRaw();
  const target = existing.find((entry) => entry.id === sessionId);
  const remaining = existing.filter((entry) => entry.id !== sessionId);
  archiveStore.set({ schemaVersion: 1, sessions: remaining });
  if (target) {
    const keys = target.participants.map((participant) =>
      buildRoundtableAvatarKey(target.id, participant.id),
    );
    if (keys.length > 0) await deleteAvatarImages(keys);
  }
};

/**
 * Populate avatar base64 URLs from IDB for the given sessions. Sessions
 * without stored images are returned unchanged.
 */
export const hydrateRoundtableSessions = async (
  sessions: RoundtableSession[],
): Promise<RoundtableSession[]> => {
  if (sessions.length === 0) return sessions;
  const keys: string[] = [];
  sessions.forEach((session) => {
    session.participants.forEach((participant) => {
      if (participant.avatar && !participant.avatar.imageUrl) {
        keys.push(buildRoundtableAvatarKey(session.id, participant.id));
      }
    });
  });
  if (keys.length === 0) return sessions;
  const imageMap = await getAvatarImages(keys);
  if (Object.keys(imageMap).length === 0) return sessions;
  return sessions.map((session) => mergeAvatarUrls(session, imageMap));
};

export const hydrateRoundtableSession = async (
  session: RoundtableSession,
): Promise<RoundtableSession> => {
  const [hydrated] = await hydrateRoundtableSessions([session]);
  return hydrated || session;
};

/* ---------- import / export ---------- */

interface ExportedRoundtableArchive {
  schemaVersion: 1;
  exportedAt: string;
  sessions: RoundtableSession[];
}

/**
 * Build the JSON payload for "下载 Roundtable 存档". By default base64
 * avatars are stripped so the file stays small; pass `includeAvatars: true`
 * to embed them.
 */
export const buildRoundtableExport = async (
  sessions: RoundtableSession[] = loadRoundtableSessions(),
  options: { includeAvatars?: boolean } = {},
): Promise<ExportedRoundtableArchive> => {
  const base = options.includeAvatars ? await hydrateRoundtableSessions(sessions) : sessions;
  return {
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    sessions: base.map((session) => ({
      ...session,
      participants: session.participants.map((participant) => {
        if (!participant.avatar) return participant;
        if (options.includeAvatars) return participant;
        return { ...participant, avatar: { ...participant.avatar, imageUrl: '' } };
      }),
    })),
  };
};

export const extractImportedRoundtable = (value: unknown): RoundtableSession[] => {
  if (Array.isArray(value)) return value.filter(isPresumedSession);
  const maybe = (value as { sessions?: unknown })?.sessions;
  if (Array.isArray(maybe)) return maybe.filter(isPresumedSession);
  return [];
};

export const importRoundtableSessions = async (
  payload: unknown,
): Promise<{ imported: number; scanned: number; limit: number }> => {
  const incoming = extractImportedRoundtable(payload);
  const scanned = Array.isArray(payload)
    ? payload.length
    : Array.isArray((payload as { sessions?: unknown[] })?.sessions)
      ? (payload as { sessions: unknown[] }).sessions.length
      : 0;
  if (incoming.length === 0) return { imported: 0, scanned, limit: ROUNDTABLE_HISTORY_LIMIT };

  const existing = readRaw();
  const byId = new Map(existing.map((session) => [session.id, session]));
  incoming.forEach((session) => byId.set(session.id, session));
  const merged = Array.from(byId.values()).sort(sortByUpdatedAtDesc);
  const trimmed = merged.slice(0, ROUNDTABLE_HISTORY_LIMIT);
  archiveStore.set({ schemaVersion: 1, sessions: trimmed });

  await Promise.all(
    incoming.map(async (session) => {
      const { images } = stripAvatarUrl(session);
      if (images.length > 0) {
        await Promise.all(images.map(({ key, imageUrl }) => putAvatarImage(key, imageUrl)));
      }
    }),
  );

  return { imported: incoming.length, scanned, limit: ROUNDTABLE_HISTORY_LIMIT };
};

export const buildRoundtableBackupFilename = () =>
  `sophia-roundtables-${new Date().toISOString().slice(0, 10)}.json`;
