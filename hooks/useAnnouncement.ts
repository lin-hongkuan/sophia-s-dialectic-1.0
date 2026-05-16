import { useCallback, useEffect, useState } from 'react';
import type { Announcement } from '../data/announcement';
import { safeLocalStorageGet, safeLocalStorageSet } from '../services/storage/localStorageGateway';

export const ANNOUNCEMENT_DISMISSED_KEY = 'sophia.announcement.dismissed.v1';

export const useAnnouncement = (announcement: Announcement) => {
  const [announcementOpen, setAnnouncementOpen] = useState(false);

  useEffect(() => {
    const dismissedId = safeLocalStorageGet(ANNOUNCEMENT_DISMISSED_KEY);
    if (announcement.enabled && dismissedId !== announcement.id) {
      setAnnouncementOpen(true);
    }
  }, [announcement.enabled, announcement.id]);

  const openAnnouncement = useCallback(() => setAnnouncementOpen(true), []);

  const dismissAnnouncement = useCallback(() => {
    safeLocalStorageSet(ANNOUNCEMENT_DISMISSED_KEY, announcement.id);
    setAnnouncementOpen(false);
  }, [announcement.id]);

  return {
    announcementOpen,
    showAnnouncement: announcementOpen,
    openAnnouncement,
    dismissAnnouncement,
    setAnnouncementOpen,
  };
};
