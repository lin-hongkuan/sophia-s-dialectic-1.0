import React, { useEffect, useState } from 'react';
import { generateQuestionSuggestions } from './services/sophiaService';
import { isActiveConfigReady, subscribe } from './services/sophiaConfig';
import { AnalysisResult, ContinuationContext, HistoryEntry } from './types';
import { View, historyItemRoute, pushRoute } from './utils/routing';
import HistoryPage from './components/HistoryPage';
import ManifestoPage from './components/ManifestoPage';
import SettingsPage from './components/SettingsPage';
import ConceptDetailPage from './components/ConceptDetailPage';
import AppShell from './components/AppShell';
import HomePage from './components/HomePage';
import ResultPage from './components/ResultPage';
import { ANNOUNCEMENT } from './data/announcement';
import { validateUserPrompt } from './utils/inputValidation';
import { reframeUserTopic, type ReframeCandidate } from './services/topicReframe';
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

type SelectedSource = 'active' | 'history' | null;

const PRESET_TOPIC = '女性主义有道理吗？';
const DEFAULT_QUESTION_SUGGESTIONS = ['女性主义有道理吗？', '如何克服虚无主义？', '如何证明你不是缸中之脑？', '我们应该生孩子吗？', '为什么有性别不止有两个？'];
const BUILD_API_CONFIGURED = process.env.SOPHIA_API_CONFIGURED === 'true';

const DIRECT_QUESTION_MARKERS = [
  '?',
  '？',
  '吗',
  '呢',
  '什么',
  '为什么',
  '为何',
  '如何',
  '怎么',
  '怎样',
  '是否',
  '能不能',
  '有没有',
  '该不该',
  '应不应该',
];

const looksLikeDirectQuestion = (value: string): boolean => {
  const trimmed = value.trim();
  if (!trimmed) return false;
  return DIRECT_QUESTION_MARKERS.some((marker) => trimmed.includes(marker));
};

const makeRunId = () => {
  const uuid = globalThis.crypto?.randomUUID?.();
  const suffix = uuid ? uuid.replace(/-/g, '').slice(0, 8) : Math.random().toString(36).slice(2, 10);
  return `run-${Date.now()}-${suffix}`;
};

const App: React.FC = () => {
  const [topic, setTopic] = useState('');
  const [topicHint, setTopicHint] = useState<{ message: string; suggestions?: string[] } | null>(null);
  const [view, setView] = useState<View>('home');
  const [selectedSource, setSelectedSource] = useState<SelectedSource>(null);
  const [selectedHistoryResult, setSelectedHistoryResult] = useState<AnalysisResult | null>(null);
  const [questionSuggestions, setQuestionSuggestions] = useState<string[]>(DEFAULT_QUESTION_SUGGESTIONS);
  const [isGeneratingSuggestions, setIsGeneratingSuggestions] = useState(false);
  const [suggestionError, setSuggestionError] = useState('');
  const [reframeState, setReframeState] = useState<{
    open: boolean;
    originalTopic: string;
    candidates: ReframeCandidate[];
    continuationContext?: ContinuationContext;
  } | null>(null);
  const [isReframing, setIsReframing] = useState(false);
  const [conceptTarget, setConceptTarget] = useState<{ analysisId: string; keywordId: string } | null>(null);
  const [apiConfigured, setApiConfigured] = useState(() => BUILD_API_CONFIGURED || isActiveConfigReady());
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

  useEffect(() => subscribe(() => {
    setApiConfigured(BUILD_API_CONFIGURED || isActiveConfigReady());
  }), []);

  useBootSplashCleanup();
  useSpaRouting(openRoute);

  const displayedResult = selectedSource === 'active' ? activeRun?.result || null : selectedHistoryResult;
  const displayedProgress = selectedSource === 'active' ? activeRun?.progress || null : null;
  const displayedError = selectedSource === 'active' ? activeRun?.error || null : null;
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
  const isViewingActiveRun = showResult && selectedSource === 'active';
  const showActiveBanner = showHome && !!activeRun && !isViewingActiveRun;
  const showAnnouncement = announcementOpen && !reframeState?.open;
  const handleDismissAnnouncement = dismissAnnouncement;

  const handleAnalyze = async (e?: React.FormEvent, explicitTopic?: string, continuationContext?: ContinuationContext) => {
    e?.preventDefault();
    const candidate = (explicitTopic || topic).trim();
    const validation = validateUserPrompt(candidate, { mode: 'topic' });
    if (!validation.ok) {
      setTopicHint({ message: validation.hint || '', suggestions: validation.suggestions });
      return;
    }
    setTopicHint(null);

    // Continuation flows are already a philosophical question (followUp / append branch
    // sourced from a prior analysis), so skip the reframe round-trip.
    if (continuationContext || looksLikeDirectQuestion(candidate)) {
      startAnalysis(candidate, continuationContext);
      return;
    }

    if (isReframing) return;
    setIsReframing(true);
    try {
      const reframe = await reframeUserTopic(candidate);
      if (reframe.shouldReframe && reframe.candidates.length > 0) {
        setReframeState({
          open: true,
          originalTopic: candidate,
          candidates: reframe.candidates,
        });
        return;
      }
      startAnalysis(candidate);
    } finally {
      setIsReframing(false);
    }
  };

  const handleReframePick = (title: string) => {
    const trimmed = title.trim();
    if (!trimmed) return;
    setTopic(trimmed);
    setReframeState(null);
    startAnalysis(trimmed);
  };

  const handleReframeKeepOriginal = () => {
    if (!reframeState) {
      return;
    }
    const original = reframeState.originalTopic;
    setReframeState(null);
    startAnalysis(original, reframeState.continuationContext);
  };

  const handleReframeCancel = () => {
    setReframeState(null);
  };

  const handleGenerateQuestionSuggestions = async () => {
    if (activeRunIsRunning || isGeneratingSuggestions) return;

    setIsGeneratingSuggestions(true);
    setSuggestionError('');
    try {
      const generatedQuestions = await generateQuestionSuggestions(topic);
      if (generatedQuestions.length > 0) {
        setQuestionSuggestions(generatedQuestions);
      } else {
        setSuggestionError('这次没有生成出新问题，请稍后再试。');
      }
    } catch (error) {
      console.error('[Sophia] question suggestion generation failed:', error);
      setSuggestionError(error instanceof Error ? error.message : 'AI 暂时没有生成出问题。');
    } finally {
      setIsGeneratingSuggestions(false);
    }
  };

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
          onTopicChange={(value) => {
            setTopic(value);
            if (topicHint) setTopicHint(null);
          }}
          onTopicSuggestionPick={(suggestion) => {
            setTopic(suggestion);
            if (topicHint) setTopicHint(null);
          }}
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

      {showSettings && <SettingsPage onBack={goHome} />}

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

      {showConcept && conceptTarget && (() => {
        const sourceResult = findAnalysisResultById(conceptTarget.analysisId);
        if (!sourceResult) {
          return (
            <div className="max-w-2xl mx-auto mt-16 bg-white/90 border border-museum-200 rounded-xl p-8 text-center shadow-sm">
              <h2 className="font-serif text-3xl text-museum-900 mb-3">这个概念已经离线</h2>
              <p className="text-museum-600 leading-relaxed mb-6">来源分析不在当前历史中。可能是已被删除，或链接来自另一台设备的本地存储。</p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <button type="button" onClick={goHistory} className="px-6 py-3 bg-museum-900 text-museum-50 rounded-full font-serif hover:bg-black transition-colors">
                  去历史里查找
                </button>
                <button type="button" onClick={goHome} className="px-6 py-3 border border-museum-300 bg-white/75 rounded-full font-serif text-museum-800 hover:bg-white transition-colors">
                  回到首页
                </button>
              </div>
            </div>
          );
        }
        return (
          <ConceptDetailPage
            result={sourceResult}
            keywordId={conceptTarget.keywordId}
            canEnrich={apiConfigured && !isOffline}
            onEnriched={handleKeywordEnriched}
            onBack={goConceptBack}
          />
        );
      })()}
    </AppShell>
  );
};

export default App;
