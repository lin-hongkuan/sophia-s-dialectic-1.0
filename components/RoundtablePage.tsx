import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  Archive,
  Copy,
  Download,
  Loader2,
  RefreshCw,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { HangingLabel, PageHero } from './PageHero';
import RoundtableRoom from './RoundtableRoom';
import RoundtableTranscript from './RoundtableTranscript';
import RoundtableModeratorBar from './RoundtableModeratorBar';
import RoundtableArchive from './RoundtableArchive';
import { useRoundtableSession } from '../hooks/useRoundtableSession';
import {
  buildRoundtableBackupFilename,
  buildRoundtableExport,
  deleteRoundtableSession,
  hydrateRoundtableSessions,
  importRoundtableSessions,
  loadRoundtableSessions,
} from '../services/roundtableStore';
import {
  buildRoundtableMarkdown,
  buildRoundtableMarkdownFilename,
  copyRoundtableMarkdown,
  downloadRoundtableMarkdown,
} from '../utils/exportRoundtable';
import { validateUserPrompt } from '../utils/inputValidation';
import { roundtableFocus } from '../utils/roundtableFlow';
import type { RoundtableSession } from '../types';

interface RoundtablePageProps {
  /** When present, hook loads this session on mount. */
  initialSessionId?: string | null;
  /** API key / model configured — guards the "召开圆桌" button. */
  apiConfigured: boolean;
  isOffline: boolean;
  onBack: () => void;
  /** Called when the user opens an archived session — lets App update the URL. */
  onOpenSession: (sessionId: string) => void;
  /** Called when the user clears the current session to go back to /roundtable. */
  onClearSession: () => void;
}

const DEFAULT_TOPIC_CHIPS = [
  '我们应该生孩子吗？',
  '如何克服虚无主义？',
  '自由与孤独是什么关系？',
  '效率是唯一正当的价值吗？',
];

const RoundtablePage: React.FC<RoundtablePageProps> = ({
  initialSessionId,
  apiConfigured,
  isOffline,
  onBack,
  onOpenSession,
  onClearSession,
}) => {
  const hook = useRoundtableSession();
  const [topic, setTopic] = useState('');
  const [topicHint, setTopicHint] = useState<string | null>(null);
  const [archive, setArchive] = useState<RoundtableSession[]>(() => loadRoundtableSessions());
  const [exportMessage, setExportMessage] = useState('');
  const [archiveMessage, setArchiveMessage] = useState('');
  const [isCopyingExport, setIsCopyingExport] = useState(false);
  const [isArchiveBusy, setIsArchiveBusy] = useState(false);
  const [regenAvatarId, setRegenAvatarId] = useState<string | null>(null);
  const hydratedRef = useRef<string | null>(null);
  const archiveInputRef = useRef<HTMLInputElement | null>(null);

  const refreshArchive = useCallback(async () => {
    const next = loadRoundtableSessions();
    setArchive(next);
    const hydrated = await hydrateRoundtableSessions(next);
    setArchive(hydrated);
  }, []);

  // Hydrate archive avatars from IDB once on mount.
  useEffect(() => {
    let cancelled = false;
    void hydrateRoundtableSessions(archive).then((hydrated) => {
      if (!cancelled) setArchive(hydrated);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Load requested session when the URL supplies /roundtable/<id>.
  useEffect(() => {
    if (!initialSessionId) return;
    if (hydratedRef.current === initialSessionId) return;
    hydratedRef.current = initialSessionId;
    void hook.load(initialSessionId);
  }, [initialSessionId, hook]);

  // Refresh archive whenever a run transitions to completed / cancelled.
  useEffect(() => {
    if (!hook.session) return;
    if (hook.session.status === 'completed' || hook.session.status === 'cancelled' || hook.session.status === 'error') {
      setArchive(loadRoundtableSessions());
    }
  }, [hook.session?.status, hook.session]);

  const session = hook.session;
  const focus = useMemo(
    () => roundtableFocus(session, hook.currentTurnId),
    [hook.currentTurnId, session],
  );

  const isRunning = hook.isBusy
    || session?.status === 'planning'
    || session?.status === 'seating'
    || session?.status === 'running'
    || session?.status === 'closing';
  const isCompleted = session?.status === 'completed';

  const handleStart = async (event?: React.FormEvent) => {
    event?.preventDefault();
    const validation = validateUserPrompt(topic, { mode: 'topic' });
    if (!validation.ok) {
      setTopicHint(validation.hint || null);
      return;
    }
    setTopicHint(null);
    await hook.start(topic.trim());
  };

  const handleCopyMarkdown = async () => {
    if (!session || !isCompleted || isCopyingExport) return;
    setIsCopyingExport(true);
    const ok = await copyRoundtableMarkdown(buildRoundtableMarkdown(session));
    setExportMessage(ok ? '已复制 Markdown。' : '复制失败，请改用下载。');
    setIsCopyingExport(false);
  };

  const handleDownloadMarkdown = () => {
    if (!session || !isCompleted) return;
    const ok = downloadRoundtableMarkdown(
      buildRoundtableMarkdownFilename(session),
      buildRoundtableMarkdown(session),
    );
    setExportMessage(ok ? '已开始下载 Markdown。' : '当前浏览器不支持下载。');
  };

  const handleDeleteArchive = async (target: RoundtableSession) => {
    await deleteRoundtableSession(target.id);
    await refreshArchive();
    setArchiveMessage(`已删除「${target.title || target.topic}」。`);
  };

  const handleDownloadArchive = async () => {
    if (isArchiveBusy || archive.length === 0) return;
    setIsArchiveBusy(true);
    try {
      const payload = await buildRoundtableExport(loadRoundtableSessions(), { includeAvatars: true });
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = buildRoundtableBackupFilename();
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
      setArchiveMessage('已开始下载圆桌 JSON 备份。');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setArchiveMessage(`下载失败：${message}`);
    } finally {
      setIsArchiveBusy(false);
    }
  };

  const handleImportArchive = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || isArchiveBusy) return;
    setIsArchiveBusy(true);
    try {
      const payload = JSON.parse(await file.text());
      const result = await importRoundtableSessions(payload);
      await refreshArchive();
      setArchiveMessage(result.imported > 0
        ? `已导入 ${result.imported} 场圆桌。最多保留最近 ${result.limit} 场。`
        : result.scanned > 0 ? '没有发现新的圆桌记录，可能已经导入过。' : '这个文件里没有可导入的圆桌记录。');
    } catch {
      setArchiveMessage('导入失败：请选择有效的 Sophia 圆桌 JSON 文件。');
    } finally {
      setIsArchiveBusy(false);
    }
  };

  const handleRegenerateAvatar = async (participantId: string) => {
    if (!session) return;
    setRegenAvatarId(participantId);
    try {
      await hook.regenerateAvatar(participantId);
    } finally {
      setRegenAvatarId(null);
    }
  };

  const handleClear = () => {
    hook.reset();
    onClearSession();
  };

  const handleBack = () => {
    if (isRunning) hook.cancel();
    onBack();
  };

  /* ----------- Render helpers ----------- */

  const renderIdle = () => (
    <>
      <PageHero
        eyebrow="Roundtable · 实时圆桌会谈"
        accent="Roundtable"
        icon={<Users className="h-3.5 w-3.5" />}
        description={(
          <>
            输入一个主题，Sophia 会召集 4 位混合席位进行实时辩论。你以主持人身份插话、点名、要求反驳或收束。
            <span className="mt-2 block text-[13px] text-museum-500">本地保存最多 10 场；头像与 transcript 完全离线可读。</span>
          </>
        )}
      />

      <form onSubmit={handleStart} className="relative mx-auto mt-8 w-full max-w-2xl">
        <input
          type="text"
          value={topic}
          onChange={(event) => {
            setTopic(event.target.value);
            if (topicHint) setTopicHint(null);
          }}
          placeholder={isOffline ? '当前离线 · 暂时无法召开圆桌' : '例如：自由与孤独是什么关系？'}
          className="w-full rounded-full border-2 border-museum-100 bg-white/90 px-5 py-4 pr-16 text-base shadow-[0_8px_30px_rgb(0,0,0,0.04)] backdrop-blur-md transition-all duration-300 placeholder:text-museum-300 focus:border-museum-300 focus:outline-none md:px-8 md:py-6 md:pr-20 md:text-xl"
          disabled={isOffline || hook.isBusy}
        />
        <button
          type="submit"
          disabled={isOffline || !topic.trim() || hook.isBusy || !apiConfigured}
          className="absolute right-1.5 top-1.5 flex aspect-square h-[calc(100%-12px)] items-center justify-center rounded-full bg-museum-900 text-museum-50 transition-all hover:scale-105 hover:bg-black disabled:cursor-not-allowed disabled:opacity-50 md:right-2 md:top-2 md:h-[calc(100%-16px)]"
          title="召开圆桌"
        >
          {hook.isBusy ? <Loader2 className="h-5 w-5 animate-spin" /> : <ArrowRight className="h-5 w-5 md:h-6 md:w-6" />}
        </button>
      </form>

      {topicHint && (
        <p className="mx-auto mt-3 max-w-2xl rounded-2xl border border-amber-200/80 bg-amber-50/85 px-4 py-3 text-sm leading-relaxed text-amber-900 shadow-sm">
          {topicHint}
        </p>
      )}

      <div className="mx-auto mt-5 flex w-full max-w-2xl flex-wrap justify-center gap-2 md:gap-3">
        {DEFAULT_TOPIC_CHIPS.map((chip) => (
          <button
            key={chip}
            type="button"
            onClick={() => setTopic(chip)}
            className="rounded-full border border-museum-200 border-l-2 border-l-museum-400/60 bg-white/70 px-4 py-2 text-[11px] text-museum-700 transition-all duration-300 hover:-translate-y-0.5 hover:border-museum-400 hover:bg-white hover:shadow-[0_8px_24px_-8px_rgba(44,42,38,0.12)] md:px-5 md:py-2.5 md:text-sm"
            disabled={hook.isBusy}
          >
            {chip}
          </button>
        ))}
      </div>

      {!apiConfigured && (
        <div className="mx-auto mt-8 inline-flex items-center gap-2 rounded-full border border-red-100 bg-red-50 px-6 py-3 text-xs font-medium text-red-800 shadow-sm">
          <AlertCircle className="h-3 w-3" />
          未配置 API key：请到设置页填入自定义 LLM，或在部署环境补上 SOPHIA_API_KEY 后重新部署。
        </div>
      )}

      <div className="mx-auto mt-14 w-full max-w-5xl">
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <p className="notranslate shrink-0 font-mono text-[10px] uppercase tracking-[0.24em] text-museum-500" translate="no">
              Local Archive · 近期圆桌
            </p>
            <span className="h-px flex-1 bg-gradient-to-r from-museum-300/80 via-museum-300/40 to-transparent" />
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleDownloadArchive}
              disabled={isArchiveBusy || archive.length === 0}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 border border-museum-300 bg-white/80 px-4 py-2 text-xs font-mono uppercase tracking-widest text-museum-700 shadow-sm transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-museum-400/60 disabled:cursor-not-allowed disabled:opacity-45"
            >
              {isArchiveBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Archive className="h-3.5 w-3.5" />}
              备份 JSON
            </button>
            <button
              type="button"
              onClick={() => archiveInputRef.current?.click()}
              disabled={isArchiveBusy}
              className="inline-flex min-h-[44px] items-center justify-center gap-2 border border-museum-300 bg-white/80 px-4 py-2 text-xs font-mono uppercase tracking-widest text-museum-700 shadow-sm transition-colors hover:bg-white focus:outline-none focus-visible:ring-2 focus-visible:ring-museum-400/60 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Upload className="h-3.5 w-3.5" />
              导入 JSON
            </button>
          </div>
        </div>
        <input
          ref={archiveInputRef}
          type="file"
          accept="application/json,.json"
          onChange={handleImportArchive}
          className="hidden"
        />
        {archiveMessage && (
          <p className="mb-4 text-left text-xs leading-relaxed text-museum-500">
            {archiveMessage}
          </p>
        )}
        <RoundtableArchive
          sessions={archive}
          hrefFor={(s) => `/roundtable/${encodeURIComponent(s.id)}`}
          onOpen={(s) => onOpenSession(s.id)}
          onDelete={handleDeleteArchive}
        />
      </div>
    </>
  );

  const renderLive = () => {
    if (!session) return null;
    return (
      <div className="mx-auto w-full max-w-6xl">
        <div className="mb-6 flex flex-col gap-3 md:mb-8 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0">
            <HangingLabel icon={<Users className="h-3.5 w-3.5" />} ariaLabel="Roundtable">
              Roundtable · 实时圆桌
            </HangingLabel>
            <h1 className="mt-6 font-serif text-3xl leading-tight text-museum-900 md:text-5xl">
              {session.title}
            </h1>
            <p className="mt-3 max-w-2xl text-sm leading-relaxed text-museum-600 md:text-base">
              {session.coreQuestion}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {isCompleted && (
              <>
                <button
                  type="button"
                  onClick={handleCopyMarkdown}
                  disabled={isCopyingExport}
                  className="inline-flex items-center justify-center gap-2 border border-museum-300 bg-white/75 px-4 py-2 text-xs font-mono uppercase tracking-widest text-museum-700 shadow-sm transition-colors hover:bg-white disabled:cursor-not-allowed disabled:opacity-45"
                >
                  <Copy className="h-3.5 w-3.5" /> {isCopyingExport ? '复制中...' : '复制 Markdown'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadMarkdown}
                  className="inline-flex items-center justify-center gap-2 border border-museum-300 bg-white/75 px-4 py-2 text-xs font-mono uppercase tracking-widest text-museum-700 shadow-sm transition-colors hover:bg-white"
                >
                  <Download className="h-3.5 w-3.5" /> 下载 Markdown
                </button>
              </>
            )}
            {isRunning && (
              <button
                type="button"
                onClick={hook.cancel}
                className="inline-flex items-center justify-center gap-2 border border-red-300 bg-red-50/80 px-4 py-2 text-xs font-mono uppercase tracking-widest text-red-700 shadow-sm transition-colors hover:bg-red-100/80"
              >
                <X className="h-3.5 w-3.5" /> 取消圆桌
              </button>
            )}
            <button
              type="button"
              onClick={handleClear}
              className="inline-flex items-center justify-center gap-2 border border-museum-300 bg-white/75 px-4 py-2 text-xs font-mono uppercase tracking-widest text-museum-700 shadow-sm transition-colors hover:bg-white"
            >
              <RefreshCw className="h-3.5 w-3.5" /> 召开新圆桌
            </button>
          </div>
        </div>

        {hook.error && (
          <div className="mb-6 border border-red-200 bg-red-50/80 p-4 text-sm leading-relaxed text-red-800 shadow-sm">
            <div className="flex items-start gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="min-w-0">
                <p className="font-medium">刚刚出现错误</p>
                <p className="mt-1 text-xs">{hook.error}</p>
              </div>
            </div>
          </div>
        )}

        {exportMessage && (
          <p className="mb-4 text-xs text-museum-500">{exportMessage}</p>
        )}

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
          <RoundtableRoom
            session={session}
            currentSpeakerId={focus.speakerId}
            replyToId={focus.replyToId}
            regeneratingAvatarId={regenAvatarId}
            onRegenerateAvatar={handleRegenerateAvatar}
          />
          <RoundtableTranscript
            session={session}
            currentTurnId={hook.currentTurnId}
            isBusy={isRunning}
          />
        </div>

        {session.minutes && (
          <section className="mt-10 grid grid-cols-1 gap-6 border border-museum-200 bg-white/85 p-5 shadow-sm backdrop-blur-sm md:grid-cols-2 md:p-8">
            <div>
              <p className="notranslate font-mono text-[10px] uppercase tracking-[0.24em] text-museum-500" translate="no">
                Closing Minutes · 主持人纪要
              </p>
              <h3 className="mt-2 font-serif text-2xl text-museum-900 md:text-3xl">共识与分歧</h3>
              {session.minutes.consensus && (
                <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-museum-800 md:text-base">{session.minutes.consensus}</p>
              )}
              {session.minutes.disagreements?.length > 0 && (
                <ul className="mt-4 space-y-2 border-t border-museum-200/70 pt-4 text-sm text-museum-700">
                  {session.minutes.disagreements.filter(Boolean).map((item, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="font-mono text-museum-400">{String(index + 1).padStart(2, '0')}</span>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              )}
              {session.minutes.realLifeReturn && (
                <p className="mt-5 border-l-2 border-museum-400 bg-museum-50/60 px-3 py-2 text-sm italic leading-relaxed text-museum-700">
                  回到现实：{session.minutes.realLifeReturn}
                </p>
              )}
            </div>
            <div>
              {session.minutes.unresolvedQuestions?.length > 0 && (
                <>
                  <p className="notranslate font-mono text-[10px] uppercase tracking-[0.24em] text-museum-500" translate="no">
                    Open Questions · 未解决的问题
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-museum-700">
                    {session.minutes.unresolvedQuestions.filter(Boolean).map((item, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="font-mono text-museum-400">?</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
              {session.minutes.nextQuestions?.length > 0 && (
                <>
                  <p className="notranslate mt-6 font-mono text-[10px] uppercase tracking-[0.24em] text-museum-500" translate="no">
                    Continue · 可以继续追问
                  </p>
                  <ul className="mt-3 space-y-2 text-sm text-museum-800">
                    {session.minutes.nextQuestions.filter(Boolean).map((item, index) => (
                      <li key={index} className="flex gap-2">
                        <span className="font-mono text-museum-500">{String(index + 1).padStart(2, '0')}</span>
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </section>
        )}

        {!isCompleted && (
          <RoundtableModeratorBar
            participants={session.participants}
            disabled={!hook.canInterject}
            isBusy={hook.isBusy}
            pendingInterjection={hook.pendingInterjection}
            onInterject={hook.submitInterjection}
          />
        )}
      </div>
    );
  };

  return (
    <div className="w-full max-w-7xl mx-auto px-4 pb-24 md:pb-32 animate-fade-in -mt-4 md:-mt-8">
      {session ? renderLive() : renderIdle()}

      <div className="mt-12 text-center">
        <button
          type="button"
          onClick={handleBack}
          className="text-[11px] font-mono uppercase tracking-[0.22em] text-museum-500 transition-colors hover:text-museum-900"
        >
          ← 回到首页
        </button>
      </div>
    </div>
  );
};

export default RoundtablePage;
