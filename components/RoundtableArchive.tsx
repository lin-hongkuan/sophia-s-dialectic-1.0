import React from 'react';
import { ArrowUpRight, Clock, Trash2, Users } from 'lucide-react';
import type { RoundtableSession } from '../types';

interface RoundtableArchiveProps {
  sessions: RoundtableSession[];
  /** Href builder for each session row — enables middle-click / right-click / new tab. */
  hrefFor: (session: RoundtableSession) => string;
  onOpen: (session: RoundtableSession) => void;
  onDelete?: (session: RoundtableSession) => void;
}

const statusCopy: Record<RoundtableSession['status'], { label: string; tone: string }> = {
  idle:       { label: '草稿',       tone: 'bg-museum-100 text-museum-600 border-museum-200' },
  planning:   { label: '正在规划',   tone: 'bg-museum-50 text-museum-700 border-museum-300' },
  seating:    { label: '参会者入席', tone: 'bg-museum-50 text-museum-700 border-museum-300' },
  running:    { label: '正在讨论',   tone: 'bg-museum-900 text-museum-50 border-museum-900' },
  closing:    { label: '主持人收束', tone: 'bg-museum-900 text-museum-50 border-museum-900' },
  completed:  { label: '已结束',     tone: 'bg-white text-museum-800 border-museum-300' },
  error:      { label: '出错',       tone: 'bg-red-50 text-red-700 border-red-200' },
  cancelled:  { label: '已取消',     tone: 'bg-museum-50 text-museum-500 border-museum-200' },
};

const RoundtableArchive: React.FC<RoundtableArchiveProps> = ({ sessions, hrefFor, onOpen, onDelete }) => {
  if (sessions.length === 0) {
    return (
      <div className="mx-auto max-w-2xl border border-museum-200 bg-white/75 p-8 text-center shadow-sm backdrop-blur-sm">
        <p className="notranslate font-mono text-[10px] uppercase tracking-[0.24em] text-museum-500" translate="no">
          Local Archive
        </p>
        <h3 className="mt-3 font-serif text-2xl text-museum-900 md:text-3xl">还没有保存的圆桌</h3>
        <p className="mt-3 text-sm leading-relaxed text-museum-600">
          你召开的每一场圆桌都会自动保存在当前浏览器里（最多 10 场）。先输入一个主题、点击「召开圆桌」即可。
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {sessions.map((session, index) => {
        const catalogNo = String(sessions.length - index).padStart(3, '0');
        const status = statusCopy[session.status];
        const participantsLine = session.participants
          .map((p) => p.name)
          .filter(Boolean)
          .slice(0, 4)
          .join(' · ');
        return (
          <article
            key={session.id}
            className="group relative isolate overflow-hidden border border-museum-200/80 bg-white/85 shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_1px_2px_rgba(44,42,38,0.04)] backdrop-blur-sm transition-all duration-500 ease-out hover:-translate-y-1 hover:border-museum-300 hover:shadow-[0_1px_0_rgba(255,255,255,0.7)_inset,0_18px_36px_-18px_rgba(44,42,38,0.28)]"
          >
            <span aria-hidden="true" className="pointer-events-none absolute inset-y-0 left-0 w-px bg-museum-200/80 transition-colors duration-500 group-hover:bg-museum-800/70" />
            <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-museum-200/70 to-transparent" />

            <a
              href={hrefFor(session)}
              onClick={(event) => {
                event.preventDefault();
                onOpen(session);
              }}
              className="block p-5 md:p-6"
            >
              <div className="flex items-start justify-between gap-3">
                <span className="notranslate font-mono text-[10px] uppercase leading-none tracking-[0.22em] text-museum-400" translate="no">
                  NO. {catalogNo}
                </span>
                <ArrowUpRight className="h-4 w-4 text-museum-300 transition-all duration-500 ease-out group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-museum-900" />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <span className={`inline-flex items-center rounded-sm border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest ${status.tone}`}>
                  {status.label}
                </span>
                <span className="inline-flex items-center gap-1 rounded-sm border border-museum-200 bg-museum-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-widest text-museum-700">
                  <Users className="h-3 w-3" /> {session.participants.length} 席
                </span>
              </div>

              <h3 className="mt-5 font-serif text-xl leading-tight text-museum-900 decoration-museum-300/80 underline-offset-[6px] transition-all duration-500 group-hover:underline group-hover:decoration-museum-800 md:text-2xl">
                {session.title || session.topic}
              </h3>
              <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-museum-600 md:text-[15px]">
                {session.coreQuestion || session.topic}
              </p>
              {participantsLine && (
                <p className="mt-4 text-[11px] font-mono uppercase tracking-[0.18em] text-museum-500 line-clamp-1">
                  {participantsLine}
                </p>
              )}

              <div className="mt-5 flex items-center gap-3 border-t border-museum-200/70 pt-4 text-[10px] font-mono uppercase tracking-[0.18em] text-museum-400">
                <span className="inline-flex items-center gap-1.5">
                  <Clock className="h-3 w-3" />
                  {new Date(session.createdAt).toLocaleDateString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit' })}
                </span>
                <span className="text-museum-300">·</span>
                <span>{session.turns.filter((t) => t.kind === 'participant').length} 段发言</span>
              </div>
            </a>

            {onDelete && (
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  const ok = window.confirm(`删除这条圆桌？\n\n${session.title || session.topic}`);
                  if (!ok) return;
                  onDelete(session);
                }}
                title="删除这条圆桌"
                aria-label={`删除「${session.title || session.topic}」`}
                className="group/del absolute bottom-3 right-3 inline-flex h-11 min-w-11 items-center justify-center rounded-full border border-museum-200/70 bg-white/85 px-3 text-museum-500 opacity-100 shadow-sm backdrop-blur-sm transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-red-200/80 hover:bg-red-50/95 hover:text-red-700 hover:shadow hover:opacity-100 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-300/70 md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            )}
          </article>
        );
      })}
    </div>
  );
};

export default RoundtableArchive;
