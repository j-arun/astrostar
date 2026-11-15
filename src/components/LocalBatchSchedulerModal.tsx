import React, { useEffect, useState } from 'react';
import {
  Bell,
  Calendar,
  CheckCircle2,
  Clock,
  Cpu,
  FolderOpen,
  Loader2,
  Play,
  Terminal,
  X,
  AlertTriangle
} from 'lucide-react';
import { VedicHouseContext } from '../services/llm/types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export interface BackendBatchState {
  jobId: string;
  status: 'idle' | 'scheduled' | 'running' | 'completed' | 'failed' | 'cancelled';
  modelTag: string;
  engineKey: string;
  monthName: string;
  monthIndex: number;
  year: number;
  ollamaEndpoint: string;
  delaySeconds: number;
  secondsRemaining: number;
  scheduledAtIso?: string;
  startedAtIso?: string;
  completedAtIso?: string;
  elapsedMs: number;
  promptChars: number;
  promptTokensEst: number;
  promptEvalTokens?: number;
  tokensGenerated: number;
  savedFolder?: string;
  savedHtmlUrl?: string;
  savedJsonUrl?: string;
  error?: string;
  recentLogs: string[];
}

interface LocalBatchSchedulerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedMonth: number;
  selectedYear: number;
  onChangeMonthYear: (month: number, year: number) => void;
  buildContextForSelectedMonth: () => VedicHouseContext;
  yearOptions: number[];
}

function sanitizeFolderPreview(raw: string): string {
  const clean = String(raw || 'vedic-qwen2.5-14b-GGUF:Q4_K_M')
    .trim()
    .replace(/[:/\\?*|"<>]/g, '_')
    .replace(/\s+/g, '_');
  return clean || 'vedic_local_batch';
}

function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const rem = s % 60;
  if (hrs > 0) return `${hrs}h ${String(mins).padStart(2, '0')}m ${String(rem).padStart(2, '0')}s`;
  return `${mins}m ${String(rem).padStart(2, '0')}s`;
}

export const LocalBatchSchedulerModal: React.FC<LocalBatchSchedulerModalProps> = ({
  isOpen,
  onClose,
  selectedMonth,
  selectedYear,
  onChangeMonthYear,
  buildContextForSelectedMonth,
  yearOptions
}) => {
  const [modelTag, setModelTag] = useState<string>(() => {
    try {
      return localStorage.getItem('astro_batch_14b_model') || 'vedic-qwen2.5-14b-GGUF:Q4_K_M';
    } catch {
      return 'vedic-qwen2.5-14b-GGUF:Q4_K_M';
    }
  });
  const [delaySeconds, setDelaySeconds] = useState<number>(120);
  const [ollamaEndpoint, setOllamaEndpoint] = useState<string>(() => {
    try {
      return localStorage.getItem('astro_ollama_endpoint') || 'http://localhost:11434/api/generate';
    } catch {
      return 'http://localhost:11434/api/generate';
    }
  });

  const [batchState, setBatchState] = useState<BackendBatchState | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [testingNotify, setTestingNotify] = useState<boolean>(false);
  const [notifyTested, setNotifyTested] = useState<boolean>(false);
  const [uiError, setUiError] = useState<string | null>(null);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/batch/status');
      if (res.ok) {
        const data = await res.json();
        if (data?.state) setBatchState(data.state);
      }
    } catch {}
  };

  useEffect(() => {
    if (!isOpen) return;
    fetchStatus();
    const timer = setInterval(fetchStatus, 2000);
    return () => clearInterval(timer);
  }, [isOpen]);

  if (!isOpen) return null;

  const monthName = MONTH_NAMES[selectedMonth] || `Month${selectedMonth + 1}`;
  const folderKey = sanitizeFolderPreview(modelTag);
  const isBusy = batchState?.status === 'running' || batchState?.status === 'scheduled';

  const handleSchedule = async () => {
    setUiError(null);
    setSubmitting(true);
    try {
      try {
        localStorage.setItem('astro_batch_14b_model', modelTag.trim());
      } catch {}

      const context = buildContextForSelectedMonth();
      const res = await fetch('/api/batch/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          modelTag: modelTag.trim() || 'vedic-qwen2.5-14b-GGUF:Q4_K_M',
          delaySeconds,
          ollamaEndpoint: ollamaEndpoint.trim() || 'http://localhost:11434/api/generate'
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Server error (${res.status})`);
      }
      if (data.state) setBatchState(data.state);
    } catch (err: any) {
      setUiError(err?.message || 'Failed to schedule local 14B batch.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async () => {
    try {
      const res = await fetch('/api/batch/cancel', { method: 'POST' });
      const data = await res.json().catch(() => ({}));
      if (data?.state) setBatchState(data.state);
    } catch {}
  };

  const handleTestNotify = async () => {
    setTestingNotify(true);
    setNotifyTested(false);
    try {
      await fetch('/api/batch/test-notify', { method: 'POST' });
      setNotifyTested(true);
      setTimeout(() => setNotifyTested(false), 4000);
    } finally {
      setTestingNotify(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl bg-slate-900 border border-indigo-500/40 rounded-2xl shadow-2xl overflow-hidden text-slate-100"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-indigo-500/15 border border-indigo-500/40 flex items-center justify-center text-indigo-300">
              <Cpu className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white">
                Offline Local 14B Batch Scheduler (Single Month)
              </h3>
              <p className="text-[11px] text-slate-400">
                Runs inside the npm server command prompt &bull; Safe to close browser &amp; background apps after scheduling
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-800 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[82vh] overflow-y-auto">
          {/* 1. Single Month Selection */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-400" />
                <span>Target Month (Single Month Only)</span>
              </label>
              <div className="flex gap-2">
                <select
                  value={selectedMonth}
                  onChange={e => onChangeMonthYear(Number(e.target.value), selectedYear)}
                  disabled={isBusy}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-amber-300 focus:outline-none focus:border-amber-400"
                >
                  {MONTH_NAMES.map((m, idx) => (
                    <option key={m} value={idx}>
                      {m}
                    </option>
                  ))}
                </select>
                <select
                  value={selectedYear}
                  onChange={e => onChangeMonthYear(selectedMonth, Number(e.target.value))}
                  disabled={isBusy}
                  className="w-24 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-white focus:outline-none focus:border-amber-400"
                >
                  {yearOptions.map(y => (
                    <option key={y} value={y}>
                      {y}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3 space-y-1.5">
              <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                <span>Local Ollama 14B Model Tag</span>
              </label>
              <input
                type="text"
                value={modelTag}
                onChange={e => setModelTag(e.target.value)}
                disabled={isBusy}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
                placeholder="vedic-qwen2.5-14b-GGUF:Q4_K_M"
              />
            </div>
          </div>

          {/* 2. Output Folder Preview & Endpoint */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-slate-300">
                <FolderOpen className="w-4 h-4 text-emerald-400 shrink-0" />
                <span className="font-semibold">Destination Folder in /docs:</span>
              </div>
              <code className="text-[11px] font-mono text-emerald-300 bg-emerald-950/50 border border-emerald-500/30 px-2 py-0.5 rounded">
                docs/{selectedYear}/{monthName}/{folderKey}/
              </code>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <span className="text-[11px] text-slate-400 font-semibold">Ollama API:</span>
              <input
                type="text"
                value={ollamaEndpoint}
                onChange={e => setOllamaEndpoint(e.target.value)}
                disabled={isBusy}
                className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          {/* 3. Trigger Delay Radio Options */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>When Should Execution Start?</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {[
                { sec: 0, title: 'Trigger Immediately', sub: 'Starts right now (0s delay)' },
                { sec: 60, title: 'Trigger in 1 Minute', sub: '60s buffer to close apps' },
                { sec: 120, title: 'Trigger in 2 Minutes', sub: 'Recommended: free full RAM/VRAM' }
              ].map(opt => {
                const active = delaySeconds === opt.sec;
                return (
                  <button
                    key={opt.sec}
                    type="button"
                    disabled={isBusy}
                    onClick={() => setDelaySeconds(opt.sec)}
                    className={`text-left p-2.5 rounded-xl border transition cursor-pointer ${
                      active
                        ? 'bg-indigo-500/15 border-indigo-400 text-white shadow'
                        : 'bg-slate-900 border-slate-800 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <div className="text-xs font-bold">{opt.title}</div>
                    <div className="text-[10.5px] text-slate-400 mt-0.5">{opt.sub}</div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 4. Error Banner */}
          {uiError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{uiError}</span>
            </div>
          )}

          {/* 5. Live Status & Server Command Prompt Logs */}
          {batchState && batchState.status !== 'idle' && (
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2 text-xs font-bold">
                  {batchState.status === 'scheduled' && (
                    <span className="px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Starts in {formatClock(batchState.secondsRemaining)}
                    </span>
                  )}
                  {batchState.status === 'running' && (
                    <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/40 flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      Running ({batchState.tokensGenerated} tokens | {formatClock(batchState.elapsedMs / 1000)})
                    </span>
                  )}
                  {batchState.status === 'completed' && (
                    <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 flex items-center gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Complete ({formatClock(batchState.elapsedMs / 1000)})
                    </span>
                  )}
                  {(batchState.status === 'failed' || batchState.status === 'cancelled') && (
                    <span className="px-2 py-0.5 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                      {batchState.status === 'failed' ? 'Failed' : 'Cancelled'}
                    </span>
                  )}
                  <span className="text-slate-300">
                    {batchState.monthName} {batchState.year}
                  </span>
                </div>
                <span className="text-[10.5px] font-mono text-slate-500">{batchState.modelTag}</span>
              </div>

              {(batchState.status === 'scheduled' || batchState.status === 'running') && (
                <div className="p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-[11px] text-emerald-200">
                  Safe to close Chrome, database &amp; other apps now. Live progress is printing inside your <strong>npm server command prompt</strong>, and a <strong>Windows Notification Tray popup + chime</strong> will fire when {batchState.monthName} finishes.
                </div>
              )}

              {batchState.status === 'completed' && batchState.savedFolder && (
                <div className="p-2.5 rounded-lg bg-emerald-950/40 border border-emerald-500/30 text-[11px] text-emerald-200 space-y-1">
                  <div>Saved to <code className="font-mono text-emerald-300">{batchState.savedFolder}</code> and added to Saved Reports Catalog.</div>
                  {batchState.savedHtmlUrl && (
                    <a
                      href={batchState.savedHtmlUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-block underline font-bold text-amber-300 hover:text-amber-200"
                    >
                      Open Generated HTML Report
                    </a>
                  )}
                </div>
              )}

              {batchState.error && (
                <div className="text-[11px] font-mono text-rose-300 bg-rose-950/30 p-2 rounded border border-rose-500/30">
                  {batchState.error}
                </div>
              )}

              {batchState.recentLogs.length > 0 && (
                <div className="bg-black/60 border border-slate-800 rounded-lg p-2.5 font-mono text-[10.5px] text-slate-300 max-h-36 overflow-y-auto space-y-0.5">
                  <div className="flex items-center gap-1.5 text-slate-500 pb-1 border-b border-slate-800 mb-1">
                    <Terminal className="w-3 h-3" />
                    <span>npm Server Command Prompt Mirror</span>
                  </div>
                  {batchState.recentLogs.slice(-10).map((line, i) => (
                    <div key={i} className="truncate" title={line}>
                      {line}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            onClick={handleTestNotify}
            disabled={testingNotify}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 cursor-pointer transition"
            title="Test OS Notification Tray balloon + sound chime on your laptop"
          >
            <Bell className="w-3.5 h-3.5 text-amber-400" />
            <span>{notifyTested ? 'Tray Alert Fired!' : testingNotify ? 'Sending...' : 'Test Notification Tray'}</span>
          </button>

          <div className="flex items-center gap-2">
            {isBusy && (
              <button
                type="button"
                onClick={handleCancel}
                className="px-3.5 py-1.5 rounded-xl bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-xs font-bold text-rose-200 cursor-pointer transition"
              >
                Cancel Scheduled Batch
              </button>
            )}
            <button
              type="button"
              onClick={handleSchedule}
              disabled={submitting || batchState?.status === 'running'}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-indigo-500 to-purple-500 hover:from-indigo-400 hover:to-purple-400 text-white text-xs font-extrabold shadow-lg shadow-indigo-500/20 disabled:opacity-50 cursor-pointer transition"
            >
              {submitting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Play className="w-3.5 h-3.5 fill-current" />}
              <span>
                {delaySeconds === 0
                  ? `Run ${monthName} ${selectedYear} Now`
                  : `Schedule ${monthName} ${selectedYear} (${delaySeconds / 60}m Delay)`}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
