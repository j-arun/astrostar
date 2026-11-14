import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Bot,
  Send,
  Lock,
  Cpu,
  RefreshCw,
  Sparkles,
  Database,
  FileCode,
  ExternalLink,
  Copy,
  Check,
  Trash2,
  Download,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  MessageSquare,
  Sliders,
  Compass
} from 'lucide-react';
import { VedicHouseContext, LLMThreePartNarrative } from '../services/llm/types';
import { checkOllamaHealth } from '../services/llm/adapters';
import {
  CachedPredictionSummary,
  CachedPredictionEntry
} from '../services/predictionCacheService';
import {
  buildDynamicQuestionCards,
  buildCompactReportContextPack,
  DynamicQuestionCard
} from '../services/reportCopilotContext';
import { RichFormattedText } from './PrivatePredictionChatbot';

interface CopilotMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: string;
  modelUsed?: string;
  durationMs?: number;
  evalCount?: number;
  promptEvalCount?: number;
  isOfflineFallback?: boolean;
}

export interface PrivateReportCopilotProps {
  activeContext: VedicHouseContext | null;
  activeNarrative: LLMThreePartNarrative | null;
  cachedEntries: CachedPredictionSummary[];
  selectedCacheId: string; // '__live__' or a saved cacheId
  activeCacheEntry?: CachedPredictionEntry | null;
  isLoadingCacheEntry?: boolean;
  onSelectCachedPrediction: (cacheId: string) => void;
  onRefreshCacheList: () => void;
}

const ENDPOINT_STORAGE_KEY = 'astro_copilot_ollama_endpoint';
const MODEL_STORAGE_KEY = 'astro_copilot_ollama_model';
const CTX_STORAGE_KEY = 'astro_copilot_ollama_num_ctx';

function pickPreferredInstalledModel(models: string[], current: string): string {
  if (current && models.includes(current)) return current;
  const preferredOrder = [
    (m: string) => m.toLowerCase().includes('17b'),
    (m: string) => m.toLowerCase().includes('qwen3'),
    (m: string) => m.toLowerCase().includes('14b'),
    (m: string) => m.toLowerCase().includes('qwen2.5'),
    (m: string) => m.toLowerCase().includes('qwen'),
    (m: string) => m.toLowerCase().includes('7b')
  ];
  for (const matcher of preferredOrder) {
    const hit = models.find(matcher);
    if (hit) return hit;
  }
  return models[0] || current || 'qwen3:17b';
}

function buildOfflineDeterministicFallback(
  context: VedicHouseContext | null,
  narrative: LLMThreePartNarrative | null,
  question: string,
  errorDetail: string
): string {
  const qLower = question.toLowerCase();
  const lines: string[] = [];
  lines.push(`### Local Ollama Unreachable (${errorDetail})`);
  lines.push(
    `Start Ollama with CORS enabled so this browser session can reach your private model:\n` +
    `\`OLLAMA_ORIGINS="*" ollama serve\``
  );
  lines.push(`---`);
  lines.push(`### Grounded Reference From Cached Prediction JSON`);

  if (narrative?.summarySentence) {
    lines.push(`**Bottom-Line Report Synthesis (${narrative.peakDateRange || 'Active Window'}):** ${narrative.summarySentence}`);
  }

  if (context?.vedicSpecialEvents?.consolidatedOneLiner) {
    lines.push(`**Parivartana / Neecha Bhanga / Retrograde Stations:** ${context.vedicSpecialEvents.consolidatedOneLiner}`);
  }

  const scenarios = narrative?.supplementaryScenarios || [];
  const matchedScenarios = scenarios.filter(sc => {
    if (qLower.includes('job') || qLower.includes('career') || qLower.includes('promot') || qLower.includes('work')) {
      return sc.id === 'career_job';
    }
    if (qLower.includes('love') || qLower.includes('girl') || qLower.includes('boy') || qLower.includes('marri') || qLower.includes('relation') || qLower.includes('crush')) {
      return sc.id === 'love_romance';
    }
    if (qLower.includes('money') || qLower.includes('finan') || qLower.includes('loan') || qLower.includes('invest')) {
      return sc.id === 'finance_wealth';
    }
    if (qLower.includes('health') || qLower.includes('stress') || qLower.includes('sick')) {
      return sc.id === 'health_vitality';
    }
    if (qLower.includes('home') || qLower.includes('house') || qLower.includes('family') || qLower.includes('mother')) {
      return sc.id === 'family_home';
    }
    return false;
  });

  const displayScenarios = matchedScenarios.length > 0 ? matchedScenarios : scenarios.slice(0, 3);
  displayScenarios.forEach(sc => {
    lines.push(`#### ${sc.title} — ${sc.verdict} (${sc.confidenceScore}% | ${sc.timingWindow})`);
    lines.push(`- **Reasoning:** ${sc.astrologicalReasoning}`);
    lines.push(`- **Guidance:** ${sc.practicalGuidance}`);
    if (sc.crushStatusInference?.existingCrushTrajectory) {
      lines.push(`- **Relationship Trajectory:** ${sc.crushStatusInference.existingCrushTrajectory}`);
    }
    if (sc.employmentStatusInference?.inferenceReasoning) {
      lines.push(`- **Career Inference:** ${sc.employmentStatusInference.inferenceReasoning}`);
    }
  });

  if (narrative?.predictedSpecificEvents && narrative.predictedSpecificEvents.length > 0) {
    lines.push(`#### Specific Predicted Events in Cache`);
    narrative.predictedSpecificEvents.slice(0, 4).forEach(ev => {
      lines.push(`- **${ev.eventTitle}** (${ev.projectedWindow} • ${ev.likelihood}): ${ev.concreteImplication}`);
    });
  }

  return lines.join('\n\n');
}

export const PrivateReportCopilot: React.FC<PrivateReportCopilotProps> = ({
  activeContext,
  activeNarrative,
  cachedEntries,
  selectedCacheId,
  activeCacheEntry,
  isLoadingCacheEntry = false,
  onSelectCachedPrediction,
  onRefreshCacheList
}) => {
  const [ollamaEndpoint, setOllamaEndpoint] = useState<string>(() => {
    if (typeof window === 'undefined') return 'http://localhost:11434';
    return localStorage.getItem(ENDPOINT_STORAGE_KEY) || localStorage.getItem('astro_ollama_endpoint') || 'http://localhost:11434';
  });

  const [selectedModel, setSelectedModel] = useState<string>(() => {
    if (typeof window === 'undefined') return 'qwen3:17b';
    return localStorage.getItem(MODEL_STORAGE_KEY) || localStorage.getItem('astro_ollama_model') || 'qwen3:17b';
  });

  const [customModelOverride, setCustomModelOverride] = useState<string>('');
  const [numCtx, setNumCtx] = useState<number>(() => {
    if (typeof window === 'undefined') return 16384;
    const saved = parseInt(localStorage.getItem(CTX_STORAGE_KEY) || '16384', 10);
    return Number.isFinite(saved) && saved >= 4096 ? saved : 16384;
  });
  const [temperature, setTemperature] = useState<number>(0.3);

  const [ollamaHealth, setOllamaHealth] = useState<{
    checking: boolean;
    isOnline: boolean;
    models: string[];
    error?: string;
  }>({ checking: false, isOnline: false, models: [] });

  const [showCacheInspector, setShowCacheInspector] = useState<boolean>(false);
  const [showSettingsDrawer, setShowSettingsDrawer] = useState<boolean>(false);
  const [questionInput, setQuestionInput] = useState<string>('');
  const [messages, setMessages] = useState<CopilotMessage[]>([]);
  const [isAsking, setIsAsking] = useState<boolean>(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const threadEndRef = useRef<HTMLDivElement>(null);

  const dynamicCards = useMemo<DynamicQuestionCard[]>(() => {
    return buildDynamicQuestionCards(activeContext, activeNarrative);
  }, [activeContext, activeNarrative]);

  const effectiveModel = (customModelOverride.trim() || selectedModel.trim() || 'qwen3:17b');

  const scanOllama = async (endpointOverride?: string) => {
    const ep = (endpointOverride || ollamaEndpoint).trim().replace(/\/+$/, '');
    setOllamaHealth(prev => ({ ...prev, checking: true }));
    const res = await checkOllamaHealth(ep);
    setOllamaHealth({
      checking: false,
      isOnline: res.isOnline,
      models: res.models || [],
      error: res.error
    });
    if (res.isOnline && res.models.length > 0) {
      const savedExplicit = typeof window !== 'undefined' ? localStorage.getItem(MODEL_STORAGE_KEY) : null;
      if (!savedExplicit || !res.models.includes(savedExplicit)) {
        const picked = pickPreferredInstalledModel(res.models, selectedModel);
        setSelectedModel(picked);
        try {
          localStorage.setItem(MODEL_STORAGE_KEY, picked);
        } catch {}
      }
    }
  };

  useEffect(() => {
    scanOllama();
  }, []);

  // Scroll to newest reply inside chat box
  useEffect(() => {
    if (messages.length > 0) {
      threadEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [messages.length, isAsking]);

  const handleSelectSuggestionCard = (card: DynamicQuestionCard) => {
    setQuestionInput(card.promptTemplate);
    requestAnimationFrame(() => {
      const el = textareaRef.current;
      if (el) {
        el.focus();
        const len = card.promptTemplate.length;
        el.setSelectionRange(len, len);
      }
    });
  };

  const handleAskPrivateLLM = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const trimmed = questionInput.trim();
    if (!trimmed || isAsking) return;

    const userMsg: CopilotMessage = {
      id: `u_${Date.now()}`,
      role: 'user',
      text: trimmed,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };
    const nextHistory = [...messages, userMsg];
    setMessages(nextHistory);
    setQuestionInput('');
    setIsAsking(true);

    const startMs = performance.now();
    const cleanEndpoint = ollamaEndpoint.trim().replace(/\/+$/, '');

    try {
      const compactContextPack = buildCompactReportContextPack(
        activeContext,
        activeNarrative,
        trimmed,
        {
          promptSent: activeCacheEntry?.promptSent || activeNarrative?.promptSent,
          cacheTitle: activeCacheEntry?.title,
          providerLabel: activeCacheEntry?.providerUsed
        }
      );

      const priorTurns = nextHistory
        .slice(-7, -1)
        .map(m => `${m.role === 'user' ? 'USER QUESTION' : 'PRIVATE ASTROLOGER'}: ${m.text}`)
        .join('\n\n');

      const systemPrompt = [
        `You are a private, on-premise Classical Parashara Vedic Astrologer & Personal Decision Advisor.`,
        `You are answering directly from a cached Vedic Prediction Synthesis Report (JSON + Prompt + Ephemeris Transits).`,
        `CRITICAL RULES:`,
        `1. Stay strictly grounded in the provided REPORT DATA, DASHA TRIAD, SPECIAL VEDIC EVENTS (Parivartana, Neecha Bhanga, Retrograde↔Direct stations), and GOCHARA TRANSITS. Never invent dates, planetary signs, or yogas not present in the context.`,
        `2. Address the user's specific personal life scenario (such as unresolved past relationships, reconciliation vs closure, career promotions, visa/financial steps) honestly and compassionately—if transits show clearing up, say when and why; if mixed or requiring closure/caution, explain clearly without false flattery.`,
        `3. Explicitly cite exact planetary placements, houses, Dasha lords, date ranges, and any Parivartana/Neecha Bhanga/Direct station backing your verdict.`,
        `4. Structure your reply cleanly with scannable headings (###), bullet points, concrete timing windows, and actionable takeaways.`
      ].join('\n');

      const fullPrompt = [
        `[SYSTEM INSTRUCTIONS]\n${systemPrompt}`,
        `\n[CACHED VEDIC REPORT & TRANSIT CONTEXT]\n${compactContextPack}`,
        priorTurns ? `\n[PRIOR FOLLOW-UP CONVERSATION]\n${priorTurns}` : '',
        `\n[USER'S SPECIFIC PRIVATE QUESTION]\n${trimmed}\n\nRespond clearly in structured Markdown:`
      ].filter(Boolean).join('\n');

      const res = await fetch(`${cleanEndpoint}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          model: effectiveModel,
          prompt: fullPrompt,
          stream: false,
          options: {
            num_ctx: numCtx,
            temperature,
            num_predict: 1400
          }
        })
      });

      if (!res.ok) {
        const errBody = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} (${effectiveModel}): ${errBody || res.statusText}`);
      }

      const data = await res.json();
      const elapsed = Math.round(performance.now() - startMs);
      const replyText = (data?.response || '').trim();

      if (!replyText) {
        throw new Error('Ollama returned an empty response.');
      }

      setMessages(prev => [
        ...prev,
        {
          id: `a_${Date.now()}`,
          role: 'assistant',
          text: replyText,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: data?.model || effectiveModel,
          durationMs: elapsed,
          evalCount: data?.eval_count,
          promptEvalCount: data?.prompt_eval_count
        }
      ]);
    } catch (err: any) {
      const elapsed = Math.round(performance.now() - startMs);
      const errMsg = err?.message || 'Connection failed';
      setMessages(prev => [
        ...prev,
        {
          id: `a_err_${Date.now()}`,
          role: 'assistant',
          text: buildOfflineDeterministicFallback(activeContext, activeNarrative, trimmed, errMsg),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          modelUsed: 'Offline Cached Report Reader',
          durationMs: elapsed,
          isOfflineFallback: true
        }
      ]);
    } finally {
      setIsAsking(false);
    }
  };

  const handleCopyMessage = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  const handleDownloadTranscript = () => {
    if (messages.length === 0) return;
    const header = [
      `# Private Local LLM Q&A Session`,
      `- Active Report: ${activeCacheEntry?.title || (activeContext?.isMultiYearPrediction ? 'Multi-Year Prediction' : 'Monthly Prediction')}`,
      `- Local Model: ${effectiveModel} (${ollamaEndpoint})`,
      `- Exported: ${new Date().toISOString()}`,
      `---\n`
    ].join('\n');

    const body = messages
      .map(m => `## ${m.role === 'user' ? 'Question' : `Answer (${m.modelUsed || effectiveModel})`} [${m.timestamp}]\n\n${m.text}`)
      .join('\n\n---\n\n');

    const blob = new Blob([header + body], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Vedic_Private_Copilot_QA_${new Date().toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const cachePromptPreview = activeCacheEntry?.promptSent || activeNarrative?.promptSent || '';
  const cacheHtmlUrl = activeCacheEntry?.htmlUrl;

  return (
    <div className="rounded-2xl bg-gradient-to-br from-slate-950 via-purple-950/25 to-slate-950 border border-purple-500/40 shadow-2xl overflow-hidden text-xs">
      {/* COPILOT HEADER */}
      <div className="px-4 py-3 bg-slate-950/90 border-b border-purple-500/30 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-400/40 flex items-center justify-center text-purple-300 shadow-inner">
            <Lock className="w-4 h-4" />
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h4 className="text-sm font-extrabold text-white tracking-tight">
                Private Local LLM Report Copilot (On-Premise Q&amp;A)
              </h4>
              <span
                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold border ${
                  ollamaHealth.isOnline
                    ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
                    : 'bg-amber-500/15 text-amber-300 border-amber-500/40'
                }`}
              >
                {ollamaHealth.checking
                  ? 'Scanning Ollama...'
                  : ollamaHealth.isOnline
                  ? `Ollama Online (${ollamaHealth.models.length} models)`
                  : 'Ollama Offline'}
              </span>
            </div>
            <p className="text-[11px] text-slate-400 mt-0.5">
              Reads the cached prediction JSON, HTML dossier &amp; original prompt locally so personal life questions never leave your machine.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => scanOllama()}
            disabled={ollamaHealth.checking}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 font-semibold transition cursor-pointer"
            title="Rescan local Ollama models on port 11434"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-purple-300 ${ollamaHealth.checking ? 'animate-spin' : ''}`} />
            <span>Scan Models</span>
          </button>

          <button
            type="button"
            onClick={() => setShowSettingsDrawer(prev => !prev)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold transition cursor-pointer ${
              showSettingsDrawer
                ? 'bg-purple-500/20 text-purple-200 border-purple-500/50'
                : 'bg-slate-900 hover:bg-slate-800 text-slate-300 border-slate-700'
            }`}
            title="Configure Ollama URL, Context Length (num_ctx), and Custom Model Tag"
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Engine Config</span>
          </button>

          <button
            type="button"
            onClick={() => setShowCacheInspector(prev => !prev)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border font-semibold transition cursor-pointer ${
              showCacheInspector
                ? 'bg-amber-500/20 text-amber-200 border-amber-500/50'
                : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-slate-700'
            }`}
            title="Inspect the cached JSON + HTML + Prompt backing this local Q&A"
          >
            <Database className="w-3.5 h-3.5" />
            <span>Inspect Cache</span>
            {showCacheInspector ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* MODEL + UNIFIED CACHE SWITCHER BAR */}
      <div className="px-4 py-2.5 bg-slate-900/70 border-b border-slate-800/90 flex flex-wrap items-center justify-between gap-3">
        {/* Local Model Selector */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-purple-300 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5" />
            <span>Local Model:</span>
          </span>
          {ollamaHealth.models.length > 0 ? (
            <select
              value={selectedModel}
              onChange={e => {
                const val = e.target.value;
                setSelectedModel(val);
                setCustomModelOverride('');
                try {
                  localStorage.setItem(MODEL_STORAGE_KEY, val);
                } catch {}
              }}
              className="bg-slate-950 border border-purple-500/40 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-amber-300 focus:outline-none cursor-pointer"
            >
              {ollamaHealth.models.map(m => (
                <option key={m} value={m} className="bg-slate-950 text-white">
                  {m}
                </option>
              ))}
              {!ollamaHealth.models.includes(selectedModel) && (
                <option value={selectedModel} className="bg-slate-950 text-amber-300">
                  {selectedModel} (configured)
                </option>
              )}
            </select>
          ) : (
            <input
              type="text"
              value={selectedModel}
              onChange={e => {
                setSelectedModel(e.target.value);
                try {
                  localStorage.setItem(MODEL_STORAGE_KEY, e.target.value);
                } catch {}
              }}
              placeholder="e.g. qwen3:17b"
              className="bg-slate-950 border border-purple-500/40 rounded-lg px-2.5 py-1 text-xs font-mono font-bold text-amber-300 w-44 focus:outline-none"
            />
          )}

          <span className="px-2 py-0.5 rounded bg-slate-950 border border-slate-800 text-[10px] font-mono text-slate-400">
            ctx: {numCtx.toLocaleString()}
          </span>
        </div>

        {/* Cached Prediction Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
            <Database className="w-3.5 h-3.5" />
            <span>Prediction Cache:</span>
          </span>
          <select
            value={selectedCacheId}
            onChange={e => onSelectCachedPrediction(e.target.value)}
            disabled={isLoadingCacheEntry}
            className="bg-slate-950 border border-amber-500/40 rounded-lg px-2.5 py-1 text-xs text-slate-200 max-w-xs sm:max-w-sm truncate focus:outline-none cursor-pointer"
          >
            {activeNarrative && (
              <option value="__live__">
                Active Screen Report ({activeContext?.isMultiYearPrediction ? 'Multi-Year' : activeContext?.isComprehensiveMonthly ? 'Monthly' : 'House'})
              </option>
            )}
            {cachedEntries.map(entry => (
              <option key={entry.cacheId} value={entry.cacheId}>
                [{entry.scope === 'multi_year' ? 'Yearly' : entry.scope === 'monthly' ? 'Month' : 'House'}] {entry.title} — {entry.modelUsed}
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={onRefreshCacheList}
            className="px-2 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] cursor-pointer"
            title="Refresh cached prediction JSON list from disk"
          >
            ↻
          </button>

          {cacheHtmlUrl && (
            <a
              href={cacheHtmlUrl}
              target="_blank"
              rel="noreferrer"
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-cyan-950/60 hover:bg-cyan-900/60 text-cyan-300 border border-cyan-500/40 font-semibold text-[11px]"
              title="Open cached HTML report saved alongside JSON"
            >
              <FileCode className="w-3 h-3" />
              <span>Cached HTML</span>
              <ExternalLink className="w-2.5 h-2.5" />
            </a>
          )}
        </div>
      </div>

      {/* OPTIONAL SETTINGS DRAWER */}
      {showSettingsDrawer && (
        <div className="px-4 py-3 bg-slate-950 border-b border-slate-800 grid grid-cols-1 sm:grid-cols-4 gap-3 text-[11px]">
          <div>
            <label className="block text-slate-400 font-bold mb-1">Ollama Endpoint URL</label>
            <input
              type="text"
              value={ollamaEndpoint}
              onChange={e => {
                setOllamaEndpoint(e.target.value);
                try {
                  localStorage.setItem(ENDPOINT_STORAGE_KEY, e.target.value);
                } catch {}
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-amber-200 focus:outline-none focus:border-purple-400"
              placeholder="http://localhost:11434"
            />
          </div>
          <div>
            <label className="block text-slate-400 font-bold mb-1">Custom Tag Override (e.g. qwen3:17b)</label>
            <input
              type="text"
              value={customModelOverride}
              onChange={e => setCustomModelOverride(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-white focus:outline-none focus:border-purple-400"
              placeholder={selectedModel}
            />
          </div>
          <div>
            <label className="block text-slate-400 font-bold mb-1">Context Window (num_ctx)</label>
            <select
              value={numCtx}
              onChange={e => {
                const v = parseInt(e.target.value, 10);
                setNumCtx(v);
                try {
                  localStorage.setItem(CTX_STORAGE_KEY, String(v));
                } catch {}
              }}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-emerald-300 focus:outline-none cursor-pointer"
            >
              <option value={8192}>8,192 tokens (Faster)</option>
              <option value={16384}>16,384 tokens (Recommended Q14B/Q17B)</option>
              <option value={32768}>32,768 tokens (Deep Multi-Year)</option>
            </select>
          </div>
          <div>
            <label className="block text-slate-400 font-bold mb-1">Reasoning Temperature</label>
            <select
              value={temperature}
              onChange={e => setTemperature(parseFloat(e.target.value))}
              className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 font-mono text-cyan-300 focus:outline-none cursor-pointer"
            >
              <option value={0.2}>0.20 — Strict Astrological Precision</option>
              <option value={0.3}>0.30 — Balanced Advisory (Default)</option>
              <option value={0.45}>0.45 — Nuanced Reflective Synthesis</option>
            </select>
          </div>
        </div>
      )}

      {/* OPTIONAL CACHE INSPECTOR DRAWER */}
      {showCacheInspector && (
        <div className="px-4 py-3 bg-slate-950/95 border-b border-amber-500/30 space-y-2.5 text-[11px]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="font-bold text-amber-300">
              Cached Context Payload Fed to {effectiveModel}
            </span>
            <span className="text-slate-400 font-mono">
              {activeCacheEntry?.cacheId ? `ID: ${activeCacheEntry.cacheId}` : 'Live In-Memory Report'}
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Original Prompt Sent to Cloud/Report Engine ({cachePromptPreview.length} chars)
              </span>
              <pre className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 font-mono text-[10.5px] text-slate-300 max-h-48 overflow-y-auto whitespace-pre-wrap">
                {cachePromptPreview || 'Prompt reference unavailable for heuristic fallback report.'}
              </pre>
            </div>
            <div>
              <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">
                Compact Cached JSON + Transit Pack Preview
              </span>
              <pre className="bg-slate-900 border border-slate-800 rounded-lg p-2.5 font-mono text-[10.5px] text-emerald-200/90 max-h-48 overflow-y-auto whitespace-pre-wrap">
                {buildCompactReportContextPack(activeContext, activeNarrative, questionInput || 'general overview', {
                  promptSent: cachePromptPreview,
                  cacheTitle: activeCacheEntry?.title
                })}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* BODY: DYNAMIC PREDICTION-DRIVEN CARDS + FREE-FORM QUESTION BOX + CHAT THREAD */}
      <div className="p-4 space-y-4">
        {!activeNarrative ? (
          <div className="p-4 rounded-xl bg-slate-900/80 border border-slate-800 text-slate-300 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold text-amber-300">Select a Cached Prediction JSON Above or Generate a Report First</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Once a Monthly or Yearly report is generated or loaded from the cache dropdown, contextual question cards tailored to that prediction will appear here automatically.
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* PREDICTION-DRIVEN DYNAMIC SUGGESTION CARDS */}
            {dynamicCards.length > 0 && (
              <div className="space-y-2">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[10.5px] font-extrabold uppercase tracking-wider text-purple-300 flex items-center gap-1.5">
                    <Compass className="w-3.5 h-3.5 text-amber-400" />
                    <span>Relevant Follow-Up Questions From This Prediction (Click to Pre-Fill &amp; Personalize)</span>
                  </span>
                  <span className="text-[10px] text-slate-500">
                    Clicking fills the box below so you can add your real backstory before sending
                  </span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
                  {dynamicCards.map(card => (
                    <button
                      key={card.id}
                      type="button"
                      onClick={() => handleSelectSuggestionCard(card)}
                      className="text-left p-2.5 rounded-xl bg-slate-900/90 hover:bg-slate-800/90 border border-slate-700/80 hover:border-purple-400/60 transition group cursor-pointer space-y-1 shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-[10px] font-bold text-amber-300 truncate">
                          {card.badge}
                        </span>
                        <Sparkles className="w-3 h-3 text-purple-400 opacity-60 group-hover:opacity-100 shrink-0" />
                      </div>
                      <div className="text-[11.5px] font-bold text-white leading-snug group-hover:text-purple-200">
                        {card.title}
                      </div>
                      <p className="text-[10px] text-slate-400 leading-snug line-clamp-2">
                        {card.reasoningTag}
                      </p>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* CONVERSATION THREAD */}
            {messages.length > 0 && (
              <div className="space-y-3 max-h-[460px] overflow-y-auto pr-1 rounded-xl bg-slate-950/70 border border-slate-800/90 p-3">
                {messages.map(msg => (
                  <div
                    key={msg.id}
                    className={`rounded-xl p-3 border ${
                      msg.role === 'user'
                        ? 'bg-purple-950/35 border-purple-500/40 ml-4 sm:ml-10'
                        : msg.isOfflineFallback
                        ? 'bg-amber-950/20 border-amber-500/40 mr-2 sm:mr-6'
                        : 'bg-slate-900/95 border-slate-700/80 mr-2 sm:mr-6'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 text-[10.5px] font-bold">
                        {msg.role === 'user' ? (
                          <span className="text-purple-300 flex items-center gap-1">
                            <MessageSquare className="w-3 h-3" />
                            <span>Your Specific Question</span>
                          </span>
                        ) : (
                          <span className="text-emerald-300 flex items-center gap-1">
                            <Bot className="w-3.5 h-3.5" />
                            <span>{msg.modelUsed || effectiveModel}</span>
                          </span>
                        )}
                        <span className="text-slate-500 font-mono font-normal">{msg.timestamp}</span>
                        {msg.durationMs !== undefined && (
                          <span className="text-slate-500 font-mono font-normal">
                            • {(msg.durationMs / 1000).toFixed(1)}s
                          </span>
                        )}
                        {msg.evalCount !== undefined && (
                          <span className="text-slate-500 font-mono font-normal">
                            • {msg.evalCount} tok
                          </span>
                        )}
                      </div>

                      {msg.role === 'assistant' && (
                        <button
                          type="button"
                          onClick={() => handleCopyMessage(msg.id, msg.text)}
                          className="flex items-center gap-1 text-[10px] text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-800/80 cursor-pointer"
                        >
                          {copiedId === msg.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                          <span>{copiedId === msg.id ? 'Copied' : 'Copy'}</span>
                        </button>
                      )}
                    </div>

                    {msg.role === 'user' ? (
                      <p className="text-xs sm:text-[13px] text-white whitespace-pre-wrap leading-relaxed">
                        {msg.text}
                      </p>
                    ) : (
                      <RichFormattedText text={msg.text} />
                    )}
                  </div>
                ))}

                {isAsking && (
                  <div className="rounded-xl p-3 bg-slate-900/90 border border-purple-500/40 flex items-center gap-2.5 text-purple-200 animate-pulse mr-6">
                    <RefreshCw className="w-4 h-4 text-purple-400 animate-spin" />
                    <span className="text-xs font-mono">
                      Consulting local model <strong>{effectiveModel}</strong> against cached prediction JSON &amp; ephemeris windows...
                    </span>
                  </div>
                )}
                <div ref={threadEndRef} />
              </div>
            )}

            {/* FREE-FORM QUESTION COMPOSER */}
            <form onSubmit={handleAskPrivateLLM} className="space-y-2">
              <div className="flex items-center justify-between text-[11px]">
                <label className="font-bold text-white flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Ask Your Specific Personal Question Privately (stays 100% on your machine):</span>
                </label>
                {messages.length > 0 && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDownloadTranscript}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[10.5px] cursor-pointer"
                    >
                      <Download className="w-3 h-3 text-amber-400" />
                      <span>Save Q&amp;A (.md)</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setMessages([])}
                      className="flex items-center gap-1 px-2 py-0.5 rounded bg-slate-900 hover:bg-slate-800 border border-slate-700 text-rose-300 text-[10.5px] cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      <span>Clear</span>
                    </button>
                  </div>
                )}
              </div>

              <textarea
                ref={textareaRef}
                rows={3}
                value={questionInput}
                onChange={e => setQuestionInput(e.target.value)}
                onKeyDown={e => {
                  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                    e.preventDefault();
                    handleAskPrivateLLM();
                  }
                }}
                placeholder="Type anything specific — e.g., During [past period] I met someone and [what happened] — based on Venus Direct, Neecha Bhanga, and the relationship predictions above, will things clear up here or should I move on?"
                className="w-full rounded-xl bg-slate-900 border border-purple-500/40 focus:border-amber-400 p-3 text-xs sm:text-[13px] text-white placeholder:text-slate-500 focus:outline-none resize-y leading-relaxed shadow-inner"
              />

              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-[10.5px] text-slate-400">
                  Engine: <strong className="text-amber-300 font-mono">{effectiveModel}</strong> &bull; Endpoint: <code className="text-slate-300">{ollamaEndpoint}</code> &bull; Press <kbd className="px-1 py-0.5 rounded bg-slate-800 border border-slate-700 text-[10px]">Ctrl+Enter</kbd> to send
                </span>
                <button
                  type="submit"
                  disabled={!questionInput.trim() || isAsking}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg disabled:opacity-40 cursor-pointer transition active:scale-95"
                >
                  {isAsking ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                  <span>{isAsking ? 'Thinking Locally...' : 'Ask Private LLM'}</span>
                </button>
              </div>
            </form>
          </>
        )}
      </div>
    </div>
  );
};
