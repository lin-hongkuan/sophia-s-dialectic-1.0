import React from 'react';
import { Home, Megaphone } from 'lucide-react';
import type { Announcement } from '../data/announcement';
import type { ReframeCandidate } from '../services/topicReframe';
import DynamicBackground from './DynamicBackground';
import AnnouncementModal from './AnnouncementModal';
import TopicReframeDialog from './TopicReframeDialog';
import AppErrorBoundary from './AppErrorBoundary';

interface AppShellProps {
  children: React.ReactNode;
  showHome: boolean;
  currentPage: 'home' | 'history' | 'manifesto' | 'settings' | null;
  isOffline: boolean;
  mainRef: React.RefObject<HTMLElement | null>;
  errorBoundaryResetKey: string;
  announcement: Announcement;
  showAnnouncement: boolean;
  reframeOpen: boolean;
  reframeOriginalTopic: string;
  reframeCandidates: ReframeCandidate[];
  onHome: () => void;
  onHistory: () => void;
  onManifesto: () => void;
  onSettings: () => void;
  onOpenAnnouncement: () => void;
  onDismissAnnouncement: () => void;
  onAnnouncementCta?: () => void;
  onReframePick: (title: string) => void;
  onReframeKeepOriginal: () => void;
  onReframeCancel: () => void;
}

const navButtonClass = (isActive: boolean) =>
  `inline-flex min-h-[36px] shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1.5 text-[9px] uppercase tracking-widest font-bold transition-colors sm:px-3.5 sm:text-[10px] md:relative md:min-h-0 md:px-0 md:py-0 md:text-xs ${
    isActive
      ? 'bg-museum-900 text-museum-50 hover:text-museum-50 md:bg-transparent md:text-museum-900 md:after:absolute md:after:-bottom-1.5 md:after:left-1/2 md:after:-translate-x-1/2 md:after:h-px md:after:w-5 md:after:bg-museum-800'
      : 'text-museum-600 hover:text-museum-900'
  }`;

const AppShell: React.FC<AppShellProps> = ({
  children,
  showHome,
  currentPage,
  isOffline,
  mainRef,
  errorBoundaryResetKey,
  announcement,
  showAnnouncement,
  reframeOpen,
  reframeOriginalTopic,
  reframeCandidates,
  onHome,
  onHistory,
  onManifesto,
  onSettings,
  onOpenAnnouncement,
  onDismissAnnouncement,
  onAnnouncementCta,
  onReframePick,
  onReframeKeepOriginal,
  onReframeCancel,
}) => (
  <div className="min-h-screen flex flex-col font-sans text-museum-900 overflow-x-hidden relative">
    <DynamicBackground showFrontOcclusion={showHome} />

    <nav className="fixed w-full top-0 z-50 bg-museum-50/60 backdrop-blur-sm border-b border-museum-200/50 transition-all duration-300">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-14 md:h-16 flex items-center justify-between">
        <button
          type="button"
          onClick={onHome}
          aria-label="返回 Sophia's Dialectic 首页"
          className="group -ml-2 flex items-center gap-3 rounded-full px-2 py-1 text-left transition-all duration-300 hover:bg-white/35 focus:outline-none focus-visible:ring-2 focus-visible:ring-museum-400/50"
        >
          <div className="relative h-10 w-10 shrink-0 md:h-11 md:w-11">
            <div className="absolute inset-0 rounded-[1.05rem] border border-museum-300/80 bg-gradient-to-br from-white/95 via-museum-50/80 to-museum-200/65 shadow-[0_10px_28px_rgba(44,42,38,0.10)] backdrop-blur-md transition-all duration-300 group-hover:-rotate-3 group-hover:shadow-[0_14px_34px_rgba(44,42,38,0.14)]" />
            <div className="absolute inset-1 rounded-[0.82rem] border border-white/70 bg-museum-50/45" />
            <svg className="absolute inset-0 h-full w-full p-2.5 text-museum-900" viewBox="0 0 40 40" fill="none" aria-hidden="true">
              <path d="M12 26C12 18 28 22 28 14C28 10.8 24.9 8.8 20.7 8.8C17.8 8.8 15.1 9.8 13.1 11.5" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              <path d="M28 14C28 22 12 18 12 26C12 29.3 15.3 31.2 19.6 31.2C22.8 31.2 25.7 30.1 27.8 28.2" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
              <circle cx="13" cy="12" r="1.7" fill="currentColor" />
              <circle cx="27" cy="28" r="1.7" fill="currentColor" />
            </svg>
            <span className="absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border border-white/80 bg-[#C5A059] shadow-[0_0_0_3px_rgba(197,160,89,0.18)] transition-transform duration-300 group-hover:scale-110" />
          </div>
          <div className="hidden leading-none sm:block">
            <p className="font-serif text-base tracking-[0.04em] text-museum-900 md:text-lg">Sophia's</p>
            <p className="mt-1 hidden text-[9px] font-mono uppercase tracking-[0.24em] text-museum-500 sm:block md:text-[10px]">Dialectic Engine</p>
          </div>
        </button>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-2 overflow-x-auto pl-2 md:flex-none md:gap-3 md:overflow-visible md:pl-0">
          {announcement.enabled && (
            <button
              type="button"
              onClick={onOpenAnnouncement}
              aria-label="查看公告"
              title="查看公告"
              className="inline-flex min-h-[36px] shrink-0 items-center justify-center rounded-full border border-museum-200/80 bg-white/55 px-2.5 py-2 text-museum-600 hover:text-museum-900 transition-colors backdrop-blur-sm sm:px-3 md:min-h-0 md:border-0 md:bg-transparent md:px-0 md:py-0 md:backdrop-blur-none"
            >
              <Megaphone className="h-3.5 w-3.5 md:h-4 md:w-4" aria-hidden="true" />
              <span className="sr-only">查看公告</span>
            </button>
          )}
          <div className="inline-flex items-center gap-1 rounded-full border border-museum-200/80 bg-white/55 p-0.5 backdrop-blur-sm md:gap-6 md:border-0 md:bg-transparent md:p-0 md:backdrop-blur-none">
            <button
              type="button"
              onClick={onHome}
              aria-label="回到首页"
              aria-current={currentPage === 'home' ? 'page' : undefined}
              title="回到首页"
              className={navButtonClass(currentPage === 'home')}
            >
              <Home className="h-3.5 w-3.5 md:h-4 md:w-4" aria-hidden="true" />
              <span className="hidden md:inline">Home</span>
            </button>
            <button
              type="button"
              onClick={onHistory}
              aria-current={currentPage === 'history' ? 'page' : undefined}
              className={navButtonClass(currentPage === 'history')}
            >
              History
            </button>
            <button
              type="button"
              onClick={onManifesto}
              aria-current={currentPage === 'manifesto' ? 'page' : undefined}
              className={navButtonClass(currentPage === 'manifesto')}
            >
              Manifesto
            </button>
            <button
              type="button"
              onClick={onSettings}
              aria-current={currentPage === 'settings' ? 'page' : undefined}
              className={navButtonClass(currentPage === 'settings')}
            >
              Settings
            </button>
          </div>
        </div>
      </div>
    </nav>

    {isOffline && (
      <div className="fixed top-14 md:top-16 inset-x-0 z-40 border-b border-amber-300/70 bg-amber-50/95 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-center gap-2 text-[12px] text-amber-900">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-amber-700" aria-hidden="true" />
          <span>当前处于离线只读模式 · 历史记录与样本分析仍可正常阅读，新生成需要网络恢复后才能开始。</span>
        </div>
      </div>
    )}

    <main
      ref={mainRef}
      tabIndex={-1}
      aria-label="Sophia's Dialectic 主内容"
      className={`flex-grow ${isOffline ? 'pt-28 md:pt-32' : 'pt-20 md:pt-24'} px-4 relative flex flex-col focus:outline-none`}
    >
      <AppErrorBoundary resetKey={errorBoundaryResetKey}>
        {children}
      </AppErrorBoundary>
    </main>

    <footer className="py-6 md:py-8 text-center text-museum-400 text-[10px] md:text-xs font-mono uppercase tracking-widest relative z-30 opacity-60 hover:opacity-100 transition-opacity">
      <p>© 2026 Sophia's Dialectic. Powered by Sophia & The Ancients.</p>
    </footer>

    <TopicReframeDialog
      open={reframeOpen}
      originalTopic={reframeOriginalTopic}
      candidates={reframeCandidates}
      onPick={onReframePick}
      onKeepOriginal={onReframeKeepOriginal}
      onCancel={onReframeCancel}
    />

    <AnnouncementModal
      open={showAnnouncement}
      announcement={announcement}
      onDismiss={onDismissAnnouncement}
      onCta={onAnnouncementCta}
    />
  </div>
);

export default AppShell;
