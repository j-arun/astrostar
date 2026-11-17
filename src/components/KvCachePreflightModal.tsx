import React, { useState } from 'react';
import { Database, ShieldAlert, Settings, Play, Zap, Loader2, X, CheckCircle2 } from 'lucide-react';
import {
  KvCacheEngineSlot,
  getEngineSlotDisplayName,
  loadKvCacheConfig,
  saveKvCacheConfig,
  syncKvCacheConfigToServer,
  buildKvCacheSystemPrefix,
  resolveEngineProfile
} from '../services/llm/kvCacheManager';
import { VedicHouseContext } from '../services/llm/types';

export interface KvCachePreflightModalProps {
  isOpen: boolean;
  engineSlot: KvCacheEngineSlot;
  context?: VedicHouseContext | null;
  actionLabel?: string;
  onCancel: () => void;
  onProceedWithKvCache: () => void;
  onProceedWithoutKvCache: () => void;
  onGoToSettings?: () => void;
}

export const KvCachePreflightModal: React.FC<KvCachePreflightModalProps> = ({
  isOpen,
  engineSlot,
  context,
  actionLabel = 'Send Request',
  onCancel,
  onProceedWithKvCache,
  onProceedWithoutKvCache,
  onGoToSettings
}) => {
  const [priming, setPriming] = useState(false);
  const [primeError, setPrimeError] = useState<string | null>(null);

  if (!isOpen) return null;

  const engineDisplay = getEngineSlotDisplayName(engineSlot);

  const handleGoToSettings = () => {
    onCancel();
    if (onGoToSettings) {
      onGoToSettings();
    } else if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('astro-navigate-settings', { detail: { focusSlot: engineSlot } }));
    }
  };

  const handleEnableAndPrimeThenSend = async () => {
    setPriming(true);
    setPrimeError(null);
    try {
      const cfg = loadKvCacheConfig();
      const updated = saveKvCacheConfig({
        ...cfg,
        [engineSlot]: {
          ...cfg[engineSlot],
          enabled: true,
          primedAt: new Date().toISOString()
        }
      });
      await syncKvCacheConfigToServer(updated);

      if (context) {
        try {
          const { systemPrompt, systemHash } = buildKvCacheSystemPrefix(
            context,
            context.promptVersion === 'v2' ? 'v2' : 'v3',
            updated.overrides,
            'json_report',
            resolveEngineProfile(engineSlot)
          );
          const warmRes = await fetch('/api/llm/kv-cache/warm', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              slot: engineSlot,
              systemPrompt,
              systemHash,
              config: updated,
              apiKey:
                engineSlot === 'geminiPro'
                  ? localStorage.getItem('astro_gemini_api_key') || undefined
                  : engineSlot === 'claudeSonnet' || engineSlot === 'claudeFable'
                    ? localStorage.getItem('astro_anthropic_api_key') || undefined
                    : undefined,
              ollamaEndpoint:
                typeof window !== 'undefined'
                  ? localStorage.getItem('astro_ollama_endpoint') || 'http://localhost:11434/api/generate'
                  : 'http://localhost:11434/api/generate',
              model:
                engineSlot === 'privateOllama'
                  ? (typeof window !== 'undefined' ? localStorage.getItem('astro_ollama_model') : '') ||
                    updated.privateOllama.model ||
                    'hf.co/gnanasreekar/vedic-qwen2.5-14b-GGUF:Q4_K_M'
                  : (updated[engineSlot] as any)?.model
            })
          });
          const warmData = await warmRes.json().catch(() => ({}));
          if (warmRes.ok && warmData?.success) {
            const withStats = saveKvCacheConfig({
              ...updated,
              [engineSlot]: {
                ...updated[engineSlot],
                enabled: true,
                primedAt: new Date().toISOString(),
                primedHash: systemHash,
                ...(typeof warmData.promptEvalCount === 'number' ? { promptEvalCount: warmData.promptEvalCount } : {}),
                ...(typeof warmData.cacheCreationTokens === 'number' ? { cacheCreationTokens: warmData.cacheCreationTokens } : {}),
                ...(typeof warmData.cacheReadTokens === 'number' ? { cacheReadTokens: warmData.cacheReadTokens } : {}),
                ...(typeof warmData.cachedContentTokens === 'number' ? { cachedContentTokens: warmData.cachedContentTokens } : {})
              }
            });
            await syncKvCacheConfigToServer(withStats);
          }
        } catch {
          // Enabling KV cache still works on the live request even if pre-warm ping skipped
        }
      }

      onProceedWithKvCache();
    } catch (err: any) {
      setPrimeError(err?.message || 'Could not enable KV cache');
    } finally {
      setPriming(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        className="w-full max-w-lg rounded-2xl border border-amber-500/40 bg-slate-900 shadow-2xl text-slate-100 overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 bg-slate-950 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-extrabold text-white">
                KV Cache Is Not Enabled Yet
              </h3>
              <p className="text-[11px] text-amber-300/90 font-medium">
                {engineDisplay}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800"
            title="Cancel"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div className="rounded-xl border border-slate-800 bg-slate-950/80 p-3.5 text-xs text-slate-300 leading-relaxed space-y-2">
            <p>
              KV Cache is currently <span className="font-bold text-rose-400">OFF</span> for{' '}
              <span className="font-bold text-white">{engineDisplay}</span>.
            </p>
            <p className="text-slate-400">
              Enabling KV Cache loads static <strong className="text-slate-200">D1 Chart, D9 Chart, V3 Rules &amp; Delivery Schema</strong>{' '}
              into persistent <code className="text-amber-300">system</code> cache once, and sends ONLY dynamic{' '}
              <strong className="text-emerald-300">Ephemeris + Question (&le; 2,000 tokens)</strong> in the prompt — preventing large prefill stalls and lowering token latency.
            </p>
          </div>

          {primeError && (
            <div className="rounded-lg border border-rose-500/40 bg-rose-950/40 px-3 py-2 text-xs text-rose-300">
              {primeError}
            </div>
          )}

          <div className="space-y-2.5 pt-1">
            <button
              type="button"
              disabled={priming}
              onClick={handleEnableAndPrimeThenSend}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white font-bold text-xs shadow-lg transition-all cursor-pointer"
            >
              {priming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              <span>{priming ? 'Priming System KV Cache...' : `Enable & Prime KV Cache Now, Then ${actionLabel}`}</span>
            </button>

            <button
              type="button"
              disabled={priming}
              onClick={handleGoToSettings}
              className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 font-bold text-xs transition-all cursor-pointer"
            >
              <Settings className="w-4 h-4" />
              <span>Open Settings Panel to Enable &amp; Configure KV Cache First</span>
            </button>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={priming}
                onClick={onProceedWithoutKvCache}
                className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 font-semibold text-[11px] transition-all cursor-pointer"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Send Once Without KV Cache</span>
              </button>
              <button
                type="button"
                disabled={priming}
                onClick={onCancel}
                className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-slate-400 font-semibold text-[11px] transition-all cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default KvCachePreflightModal;
