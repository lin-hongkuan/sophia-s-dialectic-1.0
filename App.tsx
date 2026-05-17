import React, { useState } from 'react';
import type { AnalysisResult } from './types/domain';
import type { ContinuationContext } from './types/pipeline';
import type { HistoryEntry } from './types/storage';
import { View, type SelectedSource, historyItemRoute, pushRoute } from './utils/routing';
import HistoryPage from './components/HistoryPage';
import ManifestoPage from './components/ManifestoPage';
import SettingsPage from './components/SettingsPage';
import ConceptRoute from './components/ConceptRoute';
import AppShell from './components/AppShell';
import HomePage from './components/HomePage';
import ResultPage from './components/ResultPage';
import { ANNOUNCEMENT } from './data/announcement';
import { useOnlineStatus } from './hooks/useOnlineStatus';
import { useAnnouncement } from './hooks/useAnnouncement';
import { useBootSplashCleanup } from './hooks/useBootSplashCleanup';
import { useMainFocus } from './hooks/useMainFocus';
import { useSpaRouting } from './hooks/useSpaRouting';
import { useAnalysisRun } from './hooks/useAnalysisRun';
import { useHistoryLibrary } from './hooks/useHistoryLibrary';
import { useAppRouting } from './hooks/useAppRouting';
import { useResultMutations } from './hooks/useResultMutations';
import { useMagazineImageGeneration } from './hooks/useMagazineImageGeneration';
import { useApiConfigured } from './hooks/useApiConfigured';
import { useQuestionComposer } from './hooks/useQuestionComposer';
import { useSelectedResult } from './hooks/useSelectedResult';

const PRESET_TOPIC = '女性主义有道理吗？';

const makeRunId = () => {
  const uuid = globalThis.crypto?.randomUUID?.();
  const suffix = uuid ? uuid.replace(/-/g, '').slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `run-${Date.now()}-${suffix}`;
};

const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [view, setView] = useState<View>('home');
  const [selectedSource, setSelectedSource] = useState<SelectedSource>(null);
  const [selectedHistoryResult, setSelectedHistoryResult] = useState<AnalysisResult | null>(null);
  const [conceptTarget, setConceptTarget] = useState<{ analysisId: string; keywordId: string } | null>(null);
  const apiConfigured = useApiConfigured();
  const isOffline = useOnlineStatus();
  const { announcementOpen, openAnnouncement, dismissAnnouncement } = useAnnouncement(ANNOUNCEMENT);
  const {
    historyEntries,
    presetEntry,
    allHistoryEntries,
    pendingResumeSnap,
    setPendingResumeSnap,
    persistResult,
    persistGeneratedPreset,
    hydratePresetForCurrentRoute,
    hydrateHistoryForCurrentRoute,
    findStoredEntry,
    importHistory,
    downloadHistory,
    deleteHistoryEntry,
    dismissResumePrompt,
  } = useHistoryLibrary();

  const {
    activeRun,
    setActiveRun,
    activeRunIsRunning,
    canRegenerateFromContext,
    startAnalysis,
    resumeRun,
    cancelActiveRun,
    skipActiveVoice,
    insertActiveVoice,
    regenerateAll,
  } = useAnalysisRun({
    createRunId: makeRunId,
    onRunOpen: (runTopic) => {
      setTopic(runTopic);
      setSelectedHistoryResult(null);
      pushRoute('/active');
      setSelectedSource('active');
      setView('result');
    },
    onRunComplete: (result, isPresetRegeneration) => {
      if (isPresetRegeneration) {
        persistGeneratedPreset(result);
      } else {
        persistResult(result);
      }
    },
    onResumeAccepted: () => setPendingResumeSnap(null),
  });

  const {
    openRoute,
    openActiveRun,
    openHistoryEntry,
    goHome,
    goHistory,
    goManifesto,
    goSettings,
    goToConcept,
    goConceptBack,
    findAnalysisResultById,
  } = useAppRouting({
    activeRun,
    historyEntries,
    presetEntry,
    selectedHistoryResult,
    setTopic,
    setView,
    setSelectedSource,
    setSelectedHistoryResult,
    setConceptTarget,
    hydratePresetForCurrentRoute,
    hydrateHistoryForCurrentRoute,
    findStoredEntry,
  });

  const {
    topicHint,
    questionSuggestions,
    isGeneratingSuggestions,
    suggestionError,
    reframeState,
    isReframing,
    setTopicAndClearHint,
    handleAnalyze,
    handleReframePick,
    handleReframeKeepOriginal,
    handleReframeCancel,
    handleGenerateQuestionSuggestions,
  } = useQuestionComposer({
    topic,
    setTopic,
    activeRunIsRunning,
    startAnalysis,
  });

  useBootSplashCleanup();
  useSpaRouting(openRoute);

  const { displayedResult, displayedProgress, displayedError } = useSelectedResult({
    selectedSource,
    activeRun,
    selectedHistoryResult,
  });
  const {
    isAppendingVoice,
    retryingVoiceId,
    regeneratingAvatarVoiceId,
    handleKeywordEnriched,
    handleAppendThoughtVoice,
    handleRetryVoice,
    handleRegenerateAvatar,
  } = useResultMutations({
    activeRun,
    activeRunIsRunning,
    displayedResult,
    selectedSource,
    presetEntry,
    historyEntries,
    setActiveRun,
    setSelectedHistoryResult,
    setSelectedSource,
    setView,
    setTopic,
    persistResult,
    persistGeneratedPreset,
    createRunId: makeRunId,
  });
  useMagazineImageGeneration({
    displayedResult,
    selectedSource,
    activeRun,
    activeRunIsRunning,
    presetEntry,
    historyEntries,
    setActiveRun,
    setSelectedHistoryResult,
    persistResult,
    persistGeneratedPreset,
  });
  const mainRef = useMainFocus(!!reframeState?.open || announcementOpen, [announcementOpen, reframeState?.open, selectedSource, view]);
  const showHome = view === 'home';
  const showHistory = view === 'history';
  const showManifesto = view === 'manifesto';
  const showSettings = view === 'settings';
  const showResult = view === 'result';
  const showConcept = view === 'concept';
  const currentPage = showHome ? 'home' : showHistory ? 'history' : showManifesto ? 'manifesto' : showSettings ? 'settings' : null;
  const isViewingActiveRun = showResult && selectedSource === 'active';
  const showActiveBanner = showHome && !!activeRun && !isViewingActiveRun;
  const showAnnouncement = announcementOpen && !reframeState?.open;
  const handleDismissAnnouncement = dismissAnnouncement;

  const handleOpenHistory = openHistoryEntry;

  const handleFollowUp = (question: string) => {
    const sourceResult = displayedResult;
    const selectedFollowUp = sourceResult?.followUps.find((item) => item.question === question);
    const continuationContext: ContinuationContext | undefined = sourceResult ? {
      parentTitle: sourceResult.philosophical_title,
      parentTopic: sourceResult.topic,
      parentQuestion: sourceResult.questionFrame.bigQuestion,
      parentSummary: sourceResult.conclusion.summary,
      parentTensions: sourceResult.tensions.map((item) => `${item.title}: ${item.content}`),
      selectedFollowUpReason: selectedFollowUp?.reason,
    } : undefined;

    startAnalysis(question, continuationContext);
  };

  const handleRegenerateAll = () => {
    if (isAppendingVoice) return;
    regenerateAll(topic);
  };

  const handleDownloadHistory = downloadHistory;

  const handleImportHistory = importHistory;

  const handleDeleteHistoryEntry = (entry: HistoryEntry) => {
    if (entry.isPreset) return;
    deleteHistoryEntry(entry);
    if (selectedHistoryResult?.id === entry.id) {
      setSelectedHistoryResult(null);
      setSelectedSource(null);
      setView('history');
      pushRoute('/history');
    }
  };

  const handleRegeneratePreset = () => {
    startAnalysis(PRESET_TOPIC, undefined, true);
  };

  const handleDismissResumePrompt = dismissResumePrompt;

  return (
    <AppShell
      showHome={showHome}
      currentPage={currentPage}
      isOffline={isOffline}
      mainRef={mainRef}
      errorBoundaryResetKey={`${view}-${selectedSource || 'none'}-${displayedResult?.id || 'empty'}`}
      announcement={ANNOUNCEMENT}
      showAnnouncement={showAnnouncement}
      reframeOpen={!!reframeState?.open}
      reframeOriginalTopic={reframeState?.originalTopic || ''}
      reframeCandidates={reframeState?.candidates || []}
      onHome={goHome}
      onHistory={goHistory}
      onManifesto={goManifesto}
      onSettings={goSettings}
      onOpenAnnouncement={openAnnouncement}
      onDismissAnnouncement={handleDismissAnnouncement}
      onAnnouncementCta={
        ANNOUNCEMENT.cta?.href === '/manifesto'
          ? () => {
              handleDismissAnnouncement();
              goManifesto();
            }
          : undefined
      }
      onReframePick={handleReframePick}
      onReframeKeepOriginal={handleReframeKeepOriginal}
      onReframeCancel={handleReframeCancel}
    >
      {showHome && (
        <HomePage
          topic={topic}
          topicHint={topicHint}
          activeRun={activeRun}
          pendingResumeSnap={pendingResumeSnap}
          isOffline={isOffline}
          activeRunIsRunning={activeRunIsRunning}
          isReframing={isReframing}
          isGeneratingSuggestions={isGeneratingSuggestions}
          questionSuggestions={questionSuggestions}
          suggestionError={suggestionError}
          apiConfigured={apiConfigured}
          showActiveBanner={showActiveBanner}
          onAnalyze={handleAnalyze}
          onTopicChange={setTopicAndClearHint}
          onTopicSuggestionPick={setTopicAndClearHint}
          onOpenActiveRun={openActiveRun}
          onOpenSample={() => openRoute('/history/sample')}
          onGenerateQuestionSuggestions={handleGenerateQuestionSuggestions}
          onDismissResumePrompt={handleDismissResumePrompt}
          onResumeRun={resumeRun}
        />
      )}

      {showHistory && (
        <HistoryPage
          entries={allHistoryEntries}
          activeRun={activeRun}
          entryHref={(entry) => historyItemRoute(entry)}
          onOpen={handleOpenHistory}
          onOpenActive={openActiveRun}
          onBack={goHome}
          onRegeneratePreset={handleRegeneratePreset}
          canRegeneratePreset={apiConfigured && !activeRunIsRunning}
          onDownloadHistory={handleDownloadHistory}
          onImportHistory={handleImportHistory}
          onDeleteEntry={handleDeleteHistoryEntry}
        />
      )}

      {showManifesto && <ManifestoPage onBack={goHome} />}

      {showSettings && <SettingsPage />}

      {showResult && (
        <ResultPage
          selectedSource={selectedSource}
          activeRun={activeRun}
          activeRunIsRunning={activeRunIsRunning}
          displayedResult={displayedResult}
          displayedProgress={displayedProgress}
          displayedError={displayedError}
          log={activeRun?.log}
          canRegenerateFromContext={canRegenerateFromContext}
          isAppendingVoice={isAppendingVoice}
          retryingVoiceId={retryingVoiceId}
          regeneratingAvatarVoiceId={regeneratingAvatarVoiceId}
          onCancelActiveRun={cancelActiveRun}
          onSkipActiveVoice={skipActiveVoice}
          onInsertActiveVoice={insertActiveVoice}
          onRegenerateAll={handleRegenerateAll}
          onReset={goHome}
          onFollowUp={handleFollowUp}
          onAppendThoughtVoice={handleAppendThoughtVoice}
          onRetryVoice={handleRetryVoice}
          onOpenConcept={(keywordId) => displayedResult && goToConcept(displayedResult.id, keywordId)}
          onRegenerateAvatar={handleRegenerateAvatar}
        />
      )}

      {showConcept && conceptTarget && (
        <ConceptRoute
          target={conceptTarget}
          apiConfigured={apiConfigured}
          isOffline={isOffline}
          findAnalysisResultById={findAnalysisResultById}
          onEnriched={handleKeywordEnriched}
          onBack={goConceptBack}
          onHistory={goHistory}
          onHome={goHome}
        />
      )}
    </AppShell>
  );
};

export default App;
