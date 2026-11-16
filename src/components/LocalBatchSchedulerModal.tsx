import React, { useEffect, useMemo, useState } from 'react';
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
  AlertTriangle,
  RefreshCw,
  Eye,
  Copy,
  Check,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { VedicHouseContext } from '../services/llm/types';
import { buildVedicPrompt, getActivePromptVersion } from '../services/llm/adapters';
import { KvCachePreflightModal } from './KvCachePreflightModal';
import { isKvCacheEnabledForEngine, loadKvCacheConfig } from '../services/llm/kvCacheManager';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export interface InstalledOllamaModel {
  name: string;
  sizeBytes: number;
  sizeGb: string;
  modifiedAt?: string;
}

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
  const trimmed = String(raw || 'vedic-qwen2.5-14b-GGUF:Q4_K_M').trim();
  const tail = trimmed.split('/').pop() || trimmed;
  const clean = tail
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
      const saved = localStorage.getItem('astro_batch_14b_model');
      if (!saved || saved === 'vedic-qwen2.5-14b-GGUF:Q4_K_M') {
        return 'hf.co/gnanasreekar/vedic-qwen2.5-14b-GGUF:Q4_K_M';
      }
      return saved;
    } catch {
      return 'hf.co/gnanasreekar/vedic-qwen2.5-14b-GGUF:Q4_K_M';
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

  const [installedModels, setInstalledModels] = useState<InstalledOllamaModel[]>([]);
  const [ollamaReachable, setOllamaReachable] = useState<boolean | null>(null);
  const [ollamaModelsError, setOllamaModelsError] = useState<string | null>(null);
  const [loadingModels, setLoadingModels] = useState<boolean>(false);

  const [batchState, setBatchState] = useState<BackendBatchState | null>(null);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [testingNotify, setTestingNotify] = useState<boolean>(false);
  const [notifyTested, setNotifyTested] = useState<boolean>(false);
  const [uiError, setUiError] = useState<string | null>(null);
  const [showPromptPreview, setShowPromptPreview] = useState<boolean>(false);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [showKvPreflight, setShowKvPreflight] = useState<boolean>(false);
  const [kvPrivateEnabled, setKvPrivateEnabled] = useState<boolean>(() => isKvCacheEnabledForEngine('privateOllama'));
  const [savedBatchRuns, setSavedBatchRuns] = useState<Array<{ id: string; label: string; model: string; timestamp?: string; htmlUrl?: string }>>([]);

  const fetchStatus = async () => {
    try {
      const res = await fetch('/api/batch/status');
      if (res.ok) {
        const data = await res.json();
        if (data?.state) setBatchState(data.state);
      }
    } catch {}
  };

  const fetchSavedBatchRuns = async () => {
    try {
      const res = await fetch('/api/prediction-cache/list');
      if (!res.ok) return;
      const data = await res.json();
      if (!Array.isArray(data?.items)) return;
      const monthlyItems = data.items
        .filter((it: any) => it?.scope === 'monthly' || String(it?.cacheId || '').startsWith('doc__'))
        .slice(0, 8)
        .map((it: any) => ({
          id: String(it.cacheId),
          label: String(it.dateRange || it.title || it.cacheId),
          model: String(it.modelUsed || it.providerUsed || 'Local Ollama'),
          timestamp: it.createdAt,
          htmlUrl: it.htmlUrl
        }));
      setSavedBatchRuns(monthlyItems);
    } catch {}
  };

  const fetchOllamaModels = async (endpointOverride?: string) => {
    setLoadingModels(true);
    setOllamaModelsError(null);
    try {
      const target = (endpointOverride ?? ollamaEndpoint).trim() || 'http://localhost:11434/api/generate';
      const res = await fetch(`/api/batch/ollama-models?endpoint=${encodeURIComponent(target)}`);
      const data = await res.json().catch(() => ({}));
      setOllamaReachable(Boolean(data?.reachable));
      if (Array.isArray(data?.models)) {
        setInstalledModels(data.models);
        // Auto-select matching installed vedic/14b model if current tag is absent
        const exactExists = data.models.some(
          (m: InstalledOllamaModel) => m.name.toLowerCase() === modelTag.trim().toLowerCase()
        );
        if (!exactExists && data.models.length > 0) {
          const vedicHit =
            data.models.find((m: InstalledOllamaModel) => m.name.toLowerCase().includes('vedic')) ||
            data.models.find((m: InstalledOllamaModel) => m.name.toLowerCase().includes('14b')) ||
            data.models[0];
          if (vedicHit) {
            setModelTag(vedicHit.name);
          }
        }
      } else {
        setInstalledModels([]);
      }
      if (!data?.reachable && data?.error) {
        setOllamaModelsError(data.error);
      }
    } catch (e: any) {
      setOllamaReachable(false);
      setOllamaModelsError(e?.message || 'Failed to query Ollama /api/tags');
    } finally {
      setLoadingModels(false);
    }
  };

  useEffect(() => {
    if (!isOpen) return;
    setKvPrivateEnabled(isKvCacheEnabledForEngine('privateOllama'));
    fetchStatus();
    fetchOllamaModels();
    fetchSavedBatchRuns();
    const timer = setInterval(fetchStatus, 2000);
    return () => clearInterval(timer);
  }, [isOpen]);

  const activePromptVer = useMemo(() => (isOpen ? getActivePromptVersion() : 'v3'), [isOpen]);

  const unifiedPromptPreview = useMemo(() => {
    if (!isOpen) return '';
    try {
      const ctx = buildContextForSelectedMonth();
      return buildVedicPrompt({ ...ctx, promptVersion: activePromptVer }, modelTag || 'hf.co/gnanasreekar/vedic-qwen2.5-14b-GGUF:Q4_K_M', activePromptVer);
    } catch {
      return '';
    }
  }, [isOpen, selectedMonth, selectedYear, modelTag, activePromptVer]);

  if (!isOpen) return null;

  const monthName = MONTH_NAMES[selectedMonth] || `Month${selectedMonth + 1}`;
  const folderKey = sanitizeFolderPreview(modelTag);
  const isBusy = batchState?.status === 'running' || batchState?.status === 'scheduled';

  const exactModelMatched = installedModels.some(
    m =>
      m.name.toLowerCase() === modelTag.trim().toLowerCase() ||
      (m.name.toLowerCase().split('/').pop() || '') === modelTag.trim().toLowerCase() ||
      m.name.toLowerCase().split(':')[0] === modelTag.trim().toLowerCase().split(':')[0]
  );

  const handleSchedule = async (kvDecision?: 'use_kv' | 'skip_kv') => {
    if (!kvDecision && !isKvCacheEnabledForEngine('privateOllama')) {
      setShowKvPreflight(true);
      return;
    }

    setUiError(null);
    setSubmitting(true);
    try {
      const trimmedModel = modelTag.trim() || 'hf.co/gnanasreekar/vedic-qwen2.5-14b-GGUF:Q4_K_M';
      try {
        localStorage.setItem('astro_batch_14b_model', trimmedModel);
        localStorage.setItem('astro_ollama_endpoint', ollamaEndpoint.trim());
      } catch {}

      const currentKvCfg = loadKvCacheConfig();
      const effectiveKvCfg =
        kvDecision === 'skip_kv'
          ? { ...currentKvCfg, privateOllama: { ...currentKvCfg.privateOllama, enabled: false } }
          : kvDecision === 'use_kv'
            ? { ...currentKvCfg, privateOllama: { ...currentKvCfg.privateOllama, enabled: true } }
            : currentKvCfg;

      const context = {
        ...buildContextForSelectedMonth(),
        promptVersion: activePromptVer,
        useKvCache: effectiveKvCfg.privateOllama.enabled
      };
      const res = await fetch('/api/batch/schedule', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          context,
          modelTag: trimmedModel,
          delaySeconds,
          ollamaEndpoint: ollamaEndpoint.trim() || 'http://localhost:11434/api/generate',
          kvCacheConfig: effectiveKvCfg
        })
      });

      const data = await res.json().catch(() => ({}));
      if (Array.isArray(data?.installedModels)) {
        setInstalledModels(data.installedModels);
      }
      if (!res.ok || !data.success) {
        throw new Error(data.error || `Server error (${res.status})`);
      }
      if (data.state) {
        setBatchState(data.state);
        if (data.state.modelTag && data.state.modelTag !== modelTag) {
          setModelTag(data.state.modelTag);
        }
      }
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

  const handleCopyPrompt = async () => {
    if (!unifiedPromptPreview) return;
    try {
      await navigator.clipboard.writeText(unifiedPromptPreview);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2000);
    } catch {}
  };

  const promptTokensEst = Math.round(unifiedPromptPreview.length / 4);
  const hasSupersetEventsInPrompt = unifiedPromptPreview.includes('EVENT MANUFACTURING SUPERSET');

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
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-sm sm:text-base font-extrabold text-white">
                  Offline Local 14B Batch Scheduler (Single Month)
                </h3>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                    kvPrivateEnabled
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                  }`}
                >
                  {kvPrivateEnabled ? 'KV Cache: ON (D1+D9+Rules Split)' : 'KV Cache: OFF (Preflight Ready)'}
                </span>
              </div>
              <p className="text-[11px] text-slate-400">
                Runs {activePromptVer.toUpperCase()} Unified Prompt (1-Month Prediction + Manifestation Events) inside npm prompt
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

        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* 1. Single Month Selection & Model Tag */}
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
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                  <Cpu className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Exact Ollama Model Tag</span>
                </label>
                <button
                  type="button"
                  onClick={() => fetchOllamaModels()}
                  disabled={loadingModels}
                  className="flex items-center gap-1 text-[10px] font-bold text-cyan-300 hover:text-cyan-200 cursor-pointer"
                  title="Query installed models from local Ollama (/api/tags)"
                >
                  <RefreshCw className={`w-3 h-3 ${loadingModels ? 'animate-spin' : ''}`} />
                  <span>Detect Models</span>
                </button>
              </div>
              <input
                type="text"
                value={modelTag}
                onChange={e => setModelTag(e.target.value)}
                disabled={isBusy}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-mono text-cyan-300 focus:outline-none focus:border-cyan-400"
                placeholder="hf.co/gnanasreekar/vedic-qwen2.5-14b-GGUF:Q4_K_M"
              />
            </div>
          </div>

          {/* 2. Detected Installed Ollama Models */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold text-slate-300 flex items-center gap-1.5">
                <span
                  className={`w-2 h-2 rounded-full ${
                    ollamaReachable === true
                      ? 'bg-emerald-400'
                      : ollamaReachable === false
                      ? 'bg-rose-400'
                      : 'bg-slate-500'
                  }`}
                />
                {ollamaReachable === true
                  ? `Ollama Connected — ${installedModels.length} Installed Model(s)`
                  : ollamaReachable === false
                  ? `Ollama Not Reachable (${ollamaModelsError || 'check if Ollama is running'})`
                  : 'Checking local Ollama models...'}
              </span>
              {ollamaReachable === true && installedModels.length > 0 && (
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                    exactModelMatched
                      ? 'bg-emerald-500/15 text-emerald-300 border border-emerald-500/30'
                      : 'bg-rose-500/15 text-rose-300 border border-rose-500/30'
                  }`}
                >
                  {exactModelMatched ? 'Model Tag Verified' : 'Tag Not Found — Pick Below'}
                </span>
              )}
            </div>

            {installedModels.length > 0 && (
              <div className="flex flex-wrap gap-1.5 pt-0.5">
                {installedModels.map(m => {
                  const selected = m.name.toLowerCase() === modelTag.trim().toLowerCase();
                  return (
                    <button
                      key={m.name}
                      type="button"
                      disabled={isBusy}
                      onClick={() => {
                        setModelTag(m.name);
                        setUiError(null);
                      }}
                      className={`px-2 py-1 rounded-lg text-[11px] font-mono border transition cursor-pointer ${
                        selected
                          ? 'bg-cyan-500/20 border-cyan-400 text-cyan-200 font-bold'
                          : 'bg-slate-900 border-slate-700 text-slate-300 hover:border-slate-500'
                      }`}
                    >
                      {m.name} <span className="text-slate-400">({m.sizeGb}GB)</span>
                    </button>
                  );
                })}
              </div>
            )}

            {ollamaReachable === true && !exactModelMatched && (
              <div className="p-2 rounded-lg bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-200">
                Ollama does not have <code className="font-mono">{modelTag}</code> registered under that exact name. Click one of the installed model chips above, or verify the exact name using <code className="font-mono">ollama list</code> in Command Prompt.
              </div>
            )}
          </div>

          {/* 3. Output Folder Preview & Endpoint */}
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
                onBlur={() => fetchOllamaModels()}
                disabled={isBusy}
                className="flex-1 bg-slate-900 border border-slate-800 rounded px-2 py-1 text-[11px] font-mono text-slate-300 focus:outline-none focus:border-indigo-400"
              />
            </div>
          </div>

          {/* 4. Full Unified Prompt Inspection */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="font-bold text-indigo-300">{activePromptVer.toUpperCase()} Unified Prompt:</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-semibold">
                  1-Month Prediction
                </span>
                <span
                  className={`px-2 py-0.5 rounded font-semibold border ${
                    hasSupersetEventsInPrompt
                      ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                      : 'bg-amber-500/15 text-amber-300 border-amber-500/30'
                  }`}
                >
                  {hasSupersetEventsInPrompt ? 'Manifestation Events + Moon Windows' : 'Baseline Superset'}
                </span>
                <span className="text-slate-400 font-mono">
                  {unifiedPromptPreview.length.toLocaleString()} chars (~{promptTokensEst.toLocaleString()} tok)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[10.5px] font-bold text-slate-200 cursor-pointer"
                >
                  {copiedPrompt ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedPrompt ? 'Copied' : 'Copy'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPromptPreview(v => !v)}
                  className="flex items-center gap-1 px-2 py-1 rounded bg-indigo-500/15 hover:bg-indigo-500/25 border border-indigo-500/30 text-[10.5px] font-bold text-indigo-200 cursor-pointer"
                >
                  <Eye className="w-3 h-3" />
                  <span>{showPromptPreview ? 'Hide Prompt' : 'Inspect Prompt'}</span>
                  {showPromptPreview ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                </button>
              </div>
            </div>

            {showPromptPreview && (
              <pre className="mt-2 max-h-56 overflow-y-auto rounded-lg bg-black/70 border border-slate-800 p-2.5 text-[10.5px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                {unifiedPromptPreview}
              </pre>
            )}
          </div>

          {/* 5. Trigger Delay Options */}
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

          {/* 6. Error Banner */}
          {uiError && (
            <div className="flex items-start gap-2 p-3 rounded-xl bg-rose-950/50 border border-rose-500/40 text-xs text-rose-200">
              <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
              <span>{uiError}</span>
            </div>
          )}

          {/* 7. Live Status & Server Command Prompt Logs */}
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

              {Array.isArray(batchState.recentLogs) && batchState.recentLogs.length > 0 && (
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

          {/* 8. Saved Monthly Batch & Local Runs on Disk */}
          {savedBatchRuns.length > 0 && (
            <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 space-y-2 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span>Saved Monthly Reports on Disk ({savedBatchRuns.length})</span>
                </span>
                <button
                  type="button"
                  onClick={fetchSavedBatchRuns}
                  className="text-[10px] font-mono text-slate-400 hover:text-white cursor-pointer"
                >
                  Refresh
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 max-h-28 overflow-y-auto">
                {savedBatchRuns.map(run => (
                  <div
                    key={run.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800"
                  >
                    <div className="min-w-0">
                      <div className="text-[11px] font-bold text-slate-200 truncate">{run.label}</div>
                      <div className="text-[10px] font-mono text-slate-400 truncate">{run.model}</div>
                    </div>
                    {run.htmlUrl && (
                      <a
                        href={run.htmlUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="px-2 py-0.5 rounded bg-indigo-500/20 hover:bg-indigo-500/30 border border-indigo-500/40 text-indigo-200 text-[10px] font-bold shrink-0"
                      >
                        HTML
                      </a>
                    )}
                  </div>
                ))}
              </div>
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
              onClick={() => handleSchedule()}
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

      <KvCachePreflightModal
        isOpen={showKvPreflight}
        engineSlot="privateOllama"
        context={showKvPreflight ? buildContextForSelectedMonth() : null}
        actionLabel="Start Local 14B Batch"
        onCancel={() => setShowKvPreflight(false)}
        onGoToSettings={() => {
          setShowKvPreflight(false);
          onClose();
          if (typeof window !== 'undefined') {
            window.dispatchEvent(new CustomEvent('astro-navigate-settings', { detail: { focusSlot: 'privateOllama' } }));
          }
        }}
        onProceedWithKvCache={() => {
          setShowKvPreflight(false);
          void handleSchedule('use_kv');
        }}
        onProceedWithoutKvCache={() => {
          setShowKvPreflight(false);
          void handleSchedule('skip_kv');
        }}
      />
    </div>
  );
};
