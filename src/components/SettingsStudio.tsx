import React, { useState, useMemo, useEffect } from 'react';
import {
  Settings,
  ShieldCheck,
  Check,
  Copy,
  Layers,
  Lock,
  Sparkles,
  BookOpen,
  Compass,
  Cpu,
  Info,
  Clock,
  ArrowRight,
  Database,
  CheckCircle2,
  AlertCircle,
  Zap,
  RotateCcw,
  Loader2,
  Power,
  Sliders
} from 'lucide-react';
import {
  AstroPromptVersion,
  PromptVersionDefinition,
  VedicHouseContext
} from '../services/llm/types';
import {
  PROMPT_VERSIONS,
  getActivePromptVersion,
  setActivePromptVersion,
  buildVedicPromptV1,
  buildVedicPromptV2,
  buildVedicPromptV3
} from '../services/llm/adapters';
import { samplePersonMaster, sampleNatalPlacements } from '../data/horoscopeData';
import storedPersonsData from '../data/stored_persons.json';
import {
  KvCacheConfig,
  KvCacheEngineSlot,
  KvCacheBlockOverrides,
  loadKvCacheConfig,
  saveKvCacheConfig,
  syncKvCacheConfigToServer,
  buildKvCacheSystemPrefix,
  buildEphemeralsOnlyPrompt,
  buildDefaultD1Block,
  buildDefaultD9Block,
  buildDefaultRulesBlock,
  buildDefaultDeliveryBlock,
  isStalePlaceholderD9Override
} from '../services/llm/kvCacheManager';

interface SettingsStudioProps {
  activePersonId?: string;
  onNavigateToReport?: () => void;
}

export default function SettingsStudio({ activePersonId = '001ME', onNavigateToReport }: SettingsStudioProps) {
  // Current active prompt version loaded from localStorage (default: 'v3')
  const [selectedVersion, setSelectedVersion] = useState<AstroPromptVersion>(() => getActivePromptVersion());
  const [inspectVersion, setInspectVersion] = useState<AstroPromptVersion>(() => getActivePromptVersion());
  const [copied, setCopied] = useState<boolean>(false);
  const [saveBanner, setSaveBanner] = useState<string | null>(null);

  // Ollama Timeout settings from localStorage
  const [ollamaTimeoutEnabled, setOllamaTimeoutEnabled] = useState<boolean>(() => {
    try {
      return localStorage.getItem('astro_ollama_enable_timeout') === 'true';
    } catch {
      return false;
    }
  });

  const [ollamaTimeoutSec, setOllamaTimeoutSec] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('astro_ollama_timeout_seconds');
      return saved ? parseInt(saved, 10) : 300;
    } catch {
      return 300;
    }
  });

  // Switch active prompt version
  const handleSelectVersion = (version: AstroPromptVersion) => {
    setSelectedVersion(version);
    setInspectVersion(version);
    setActivePromptVersion(version);
    setSaveBanner(`Active prompt switched to ${PROMPT_VERSIONS[version].name}. All subsequent LLM inferences will use this version.`);
    setTimeout(() => {
      setSaveBanner(null);
    }, 4000);
  };

  const handleToggleOllamaTimeout = (enabled: boolean) => {
    setOllamaTimeoutEnabled(enabled);
    try {
      localStorage.setItem('astro_ollama_enable_timeout', enabled ? 'true' : 'false');
    } catch {
      // ignore
    }
  };

  const handleUpdateTimeoutSec = (sec: number) => {
    setOllamaTimeoutSec(sec);
    try {
      localStorage.setItem('astro_ollama_timeout_seconds', sec.toString());
    } catch {
      // ignore
    }
  };

  // KV Cache Studio state (Private Ollama + Public Claude Sonnet, Claude Fable, Gemini Pro)
  const [kvConfig, setKvConfig] = useState<KvCacheConfig>(() => loadKvCacheConfig());
  const [activeKvBlockTab, setActiveKvBlockTab] = useState<'d1Chart' | 'd9Chart' | 'rules' | 'delivery'>('d1Chart');
  const [primingSlot, setPrimingSlot] = useState<KvCacheEngineSlot | null>(null);
  const [slotStatusMsg, setSlotStatusMsg] = useState<Record<string, { ok: boolean; text: string }>>({});
  const [applyingOllamaEnv, setApplyingOllamaEnv] = useState<boolean>(false);
  const [ollamaEnvMsg, setOllamaEnvMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [unloadingOllama, setUnloadingOllama] = useState<boolean>(false);

  useEffect(() => {
    fetch('/api/llm/kv-cache/config')
      .then(r => (r.ok ? r.json() : null))
      .then(data => {
        if (data?.success && data?.config) {
          const local = loadKvCacheConfig();
          const mergedOverrides = { ...(data.config.overrides || {}), ...(local.overrides || {}) };
          if (isStalePlaceholderD9Override(mergedOverrides.d9Chart)) {
            delete mergedOverrides.d9Chart;
          }
          const merged: KvCacheConfig = {
            privateOllama: { ...local.privateOllama, ...(data.config.privateOllama || {}), enabled: local.privateOllama.enabled || Boolean(data.config.privateOllama?.enabled) },
            claudeSonnet: { ...local.claudeSonnet, ...(data.config.claudeSonnet || {}), enabled: local.claudeSonnet.enabled || Boolean(data.config.claudeSonnet?.enabled) },
            claudeFable: { ...local.claudeFable, ...(data.config.claudeFable || {}), enabled: local.claudeFable.enabled || Boolean(data.config.claudeFable?.enabled) },
            geminiPro: { ...local.geminiPro, ...(data.config.geminiPro || {}), enabled: local.geminiPro.enabled || Boolean(data.config.geminiPro?.enabled) },
            overrides: mergedOverrides
          };
          setKvConfig(saveKvCacheConfig(merged));
        }
      })
      .catch(() => {});
  }, []);

  const persistKvUpdate = (nextCfg: KvCacheConfig) => {
    const saved = saveKvCacheConfig(nextCfg);
    setKvConfig(saved);
    void syncKvCacheConfigToServer(saved);
  };

  const toggleSlotEnabled = (slot: KvCacheEngineSlot, nextVal?: boolean) => {
    const enabled = nextVal !== undefined ? nextVal : !kvConfig[slot].enabled;
    persistKvUpdate({
      ...kvConfig,
      [slot]: { ...kvConfig[slot], enabled }
    });
  };

  const handleUpdateBlockOverride = (key: keyof KvCacheBlockOverrides, val: string) => {
    persistKvUpdate({
      ...kvConfig,
      overrides: {
        ...kvConfig.overrides,
        [key]: val
      }
    });
  };

  const handleResetBlockOverride = (key: keyof KvCacheBlockOverrides) => {
    const nextOverrides = { ...kvConfig.overrides };
    delete nextOverrides[key];
    persistKvUpdate({ ...kvConfig, overrides: nextOverrides });
  };

  const handleApplyOllamaEnv = async () => {
    setApplyingOllamaEnv(true);
    setOllamaEnvMsg(null);
    try {
      const res = await fetch('/api/llm/kv-cache/configure-ollama-env', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          flashAttention: kvConfig.privateOllama.flashAttention,
          kvCacheType: kvConfig.privateOllama.kvCacheType
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }
      setOllamaEnvMsg({ ok: true, text: data.message });
    } catch (err: any) {
      setOllamaEnvMsg({ ok: false, text: err?.message || 'Failed to apply Ollama Flash Attention / KV Cache flags.' });
    } finally {
      setApplyingOllamaEnv(false);
    }
  };

  const handleUnloadOllama = async () => {
    setUnloadingOllama(true);
    try {
      const endpoint = (typeof window !== 'undefined' ? localStorage.getItem('astro_ollama_endpoint') : '') || 'http://localhost:11434/api/generate';
      const model = (typeof window !== 'undefined' ? localStorage.getItem('astro_ollama_model') : '') || kvConfig.privateOllama.model || 'hf.co/gnanasreekar/vedic-qwen2.5-14b-GGUF:Q4_K_M';
      const res = await fetch('/api/llm/kv-cache/unload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ollamaEndpoint: endpoint, model })
      });
      const data = await res.json().catch(() => ({}));
      setSlotStatusMsg(prev => ({
        ...prev,
        privateOllama: { ok: res.ok, text: data?.message || 'Model unloaded from RAM/VRAM.' }
      }));
    } catch (err: any) {
      setSlotStatusMsg(prev => ({
        ...prev,
        privateOllama: { ok: false, text: err?.message || 'Unload request failed' }
      }));
    } finally {
      setUnloadingOllama(false);
    }
  };

  // Context generation to preview both standard prompts and KV Cache blocks using the active person's real D1 + D9
  const previewContext: VedicHouseContext = useMemo(() => {
    const rawPerson = (storedPersonsData as any)[activePersonId] || (storedPersonsData as any)['001ME'];
    const profile = rawPerson?.profile || samplePersonMaster;
    const allPlacements: any[] = rawPerson?.placements || sampleNatalPlacements;
    const d1 = rawPerson?.d1_placements || allPlacements.filter((p: any) => !p.chart_type || p.chart_type === 'D1');
    const d9 = rawPerson?.d9_placements || allPlacements.filter((p: any) => p.chart_type === 'D9');

    return {
      houseNumber: 10,
      rashiIndex: 5,
      rashiName: 'Simham',
      isLagna: false,
      activationScore: 0.92,
      isEventActive: true,
      matchedRules: [
        {
          ruleId: 'PARASHARA_RULE_10_TRANSIT',
          ruleName: '10th House Karma & Career Activation',
          weight: 0.92,
          reason: 'Double transit sanction of Saturn & Jupiter energizes 10th house executive sphere.'
        }
      ],
      natalOccupants: [
        {
          body_name: 'Sun',
          degree_sputa: '14°28\'',
          nakshatra_name: 'Purva Phalguni (P1)'
        }
      ],
      transitOccupants: [],
      allTransitPlacements: [
        {
          graha_key: 'Jupiter',
          transit_rashi_index: 4,
          transit_rashi_name: 'Cancer',
          house_from_lagna: 9,
          house_from_moon: 9,
          degree_sputa: '08°14\'',
          nakshatra_name: 'Pushya',
          pada: 2,
          is_retrograde: false,
          motion_type: 'Normal',
          sav_points: 32
        },
        {
          graha_key: 'Saturn',
          transit_rashi_index: 12,
          transit_rashi_name: 'Pisces',
          house_from_lagna: 5,
          house_from_moon: 5,
          degree_sputa: '24°50\'',
          nakshatra_name: 'Revati',
          pada: 3,
          is_retrograde: true,
          motion_type: 'Vakra',
          motion_description: 'Unconventional karmic settling',
          sav_points: 29
        },
        {
          graha_key: 'Mars',
          transit_rashi_index: 4,
          transit_rashi_name: 'Cancer',
          house_from_lagna: 9,
          house_from_moon: 9,
          degree_sputa: '12°04\'',
          nakshatra_name: 'Pushya',
          pada: 3,
          is_retrograde: false,
          motion_type: 'Normal',
          sav_points: 27
        }
      ],
      natalLagnaSignName: profile.birth_lagna || 'Scorpio',
      natalMoonSignName: profile.birth_rashi || 'Scorpio',
      activeDasha: {
        mahadasha: 'Jupiter',
        antardasha: 'Saturn',
        pratyantardasha: 'Mercury',
        startDate: '2026-10-01',
        endDate: '2027-02-15'
      },
      selectedMonth: 9,
      selectedYear: 2026,
      userQuery: 'Provide an astrological timing and executive career evaluation for October 2026.',
      flattenedNatalD1: d1.map((p: any) => ({
        body_name: p.body_name,
        rashi_name: p.rashi_name,
        degree_sputa: p.degree_sputa,
        nakshatra_name: p.nakshatra_name,
        pada: p.pada,
        house_number: p.house_number,
        is_retrograde: p.is_retrograde
      })),
      flattenedNatalD9: d9.map((p: any) => ({
        body_name: p.body_name,
        rashi_name: p.rashi_name,
        degree_sputa: p.degree_sputa,
        house_number: p.house_number,
        is_retrograde: p.is_retrograde
      })),
      natalJanmaStar: {
        nakshatra_name: profile.birth_star || 'Anuradha',
        pada: profile.birth_star_pada || 2,
        rashi_name: profile.birth_rashi || 'Scorpio',
        rashi_index: 8
      },
      dashaDeliveryReport: {
        overallIndex: 0.88,
        status: 'High Karmic Fruition Window',
        mdScore: 0.90,
        mdDignity: 'Exalted / Strong Kendra Lord',
        adScore: 0.85,
        adDignity: 'Vakra Karmic Arbitrator',
        pdScore: 0.82,
        pdDignity: 'Direct Commercial Scribe'
      }
    };
  }, [activePersonId]);

  const kvMode: 'v2' | 'v3' = selectedVersion === 'v2' ? 'v2' : 'v3';

  const kvPrefixPreview = useMemo(() => {
    return buildKvCacheSystemPrefix(previewContext, kvMode, kvConfig.overrides, 'json_report');
  }, [previewContext, kvMode, kvConfig.overrides]);

  const kvEphemerisPreview = useMemo(() => {
    return buildEphemeralsOnlyPrompt(previewContext, selectedVersion, 2000);
  }, [previewContext, selectedVersion]);

  const handlePrimeEngineKvCache = async (slot: KvCacheEngineSlot) => {
    setPrimingSlot(slot);
    try {
      const nextCfg: KvCacheConfig = {
        ...kvConfig,
        [slot]: { ...kvConfig[slot], enabled: true }
      };
      persistKvUpdate(nextCfg);

      const res = await fetch('/api/llm/kv-cache/warm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slot,
          systemPrompt: kvPrefixPreview.systemPrompt,
          systemHash: kvPrefixPreview.systemHash,
          config: nextCfg,
          apiKey:
            slot === 'geminiPro'
              ? localStorage.getItem('astro_gemini_api_key') || undefined
              : slot === 'claudeSonnet' || slot === 'claudeFable'
                ? localStorage.getItem('astro_anthropic_api_key') || undefined
                : undefined,
          ollamaEndpoint:
            (typeof window !== 'undefined' ? localStorage.getItem('astro_ollama_endpoint') : '') ||
            'http://localhost:11434/api/generate',
          model:
            slot === 'privateOllama'
              ? (typeof window !== 'undefined' ? localStorage.getItem('astro_ollama_model') : '') ||
                nextCfg.privateOllama.model ||
                'hf.co/gnanasreekar/vedic-qwen2.5-14b-GGUF:Q4_K_M'
              : (nextCfg[slot] as any)?.model
        })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data?.success) {
        throw new Error(data?.error || `HTTP ${res.status}`);
      }

      persistKvUpdate({
        ...nextCfg,
        [slot]: {
          ...nextCfg[slot],
          enabled: true,
          primedAt: new Date().toISOString(),
          primedHash: kvPrefixPreview.systemHash,
          ...(typeof data.promptEvalCount === 'number' ? { promptEvalCount: data.promptEvalCount } : {}),
          ...(typeof data.cacheCreationTokens === 'number' ? { cacheCreationTokens: data.cacheCreationTokens } : {}),
          ...(typeof data.cacheReadTokens === 'number' ? { cacheReadTokens: data.cacheReadTokens } : {}),
          ...(typeof data.cachedContentTokens === 'number' ? { cachedContentTokens: data.cachedContentTokens } : {})
        }
      });

      setSlotStatusMsg(prev => ({
        ...prev,
        [slot]: { ok: true, text: data.message || 'KV Cache primed cleanly!' }
      }));
    } catch (err: any) {
      setSlotStatusMsg(prev => ({
        ...prev,
        [slot]: { ok: false, text: err?.message || 'Priming failed' }
      }));
    } finally {
      setPrimingSlot(null);
    }
  };

  const defaultBlockTexts = useMemo(
    () => ({
      d1Chart: buildDefaultD1Block(previewContext),
      d9Chart: buildDefaultD9Block(previewContext),
      rules: buildDefaultRulesBlock(kvMode),
      delivery: buildDefaultDeliveryBlock(kvMode, 'json_report')
    }),
    [previewContext, kvMode]
  );

  // Read-only prompt text rendered dynamically
  const renderedPromptText = useMemo(() => {
    if (inspectVersion === 'v1') {
      return buildVedicPromptV1(previewContext, 'LLM Provider Engine');
    }
    if (inspectVersion === 'v2') {
      return buildVedicPromptV2(previewContext, 'LLM Provider Engine');
    }
    return buildVedicPromptV3(previewContext, 'LLM Provider Engine');
  }, [inspectVersion, previewContext]);

  const handleCopyPrompt = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(renderedPromptText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const lineCount = useMemo(() => renderedPromptText.split('\n').length, [renderedPromptText]);
  const charCount = useMemo(() => renderedPromptText.length, [renderedPromptText]);

  return (
    <div className="space-y-8 max-w-7xl mx-auto pb-16">
      {/* Top Banner / Breadcrumb */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl backdrop-blur-sm">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Settings className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
                System &amp; Prompt Engine Settings
                <span className="text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  Active: {PROMPT_VERSIONS[selectedVersion].shortTitle}
                </span>
              </h2>
              <p className="text-xs text-slate-400 mt-0.5">
                Manage prompt architecture versions, Vedic reasoning stances, and inference parameters.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-mono text-slate-400 bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-400" />
              <span>Classical Parashara Compliant</span>
            </span>
          </div>
        </div>

        {saveBanner && (
          <div className="mt-4 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs flex items-center gap-2 animate-fade-in">
            <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
            <span>{saveBanner}</span>
          </div>
        )}
      </div>

      {/* SECTION 0: KV CACHE & PROMPT PREFIX STUDIO (PRIVATE + PUBLIC LLMS) */}
      <div className="bg-slate-900/95 border border-emerald-500/30 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <Database className="w-5 h-5 text-emerald-400" />
              <h3 className="text-base sm:text-lg font-bold text-white">
                KV Cache &amp; System Prefix Studio (Private &amp; Public LLMs)
              </h3>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono">
                hash:{kvPrefixPreview.systemHash}
              </span>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Load static D1, D9, V3/V2 Rules &amp; Generic Delivery once into the cached{' '}
              <code className="text-amber-300">system</code> slot. Monthly runs &amp; Q&amp;A then dispatch{' '}
              <strong className="text-emerald-300">ONLY dynamic Ephemeris + Question (&le; 2,000 tokens)</strong>{' '}
              in the user prompt. Trigger any engine here first before running monthly predictions.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
            <div className="px-3 py-1.5 rounded-xl bg-slate-950 border border-amber-500/30 text-amber-300">
              System KV Prefix: <strong>~{kvPrefixPreview.systemTokensEst.toLocaleString()}</strong> tok
            </div>
            <div
              className={`px-3 py-1.5 rounded-xl bg-slate-950 border ${
                kvEphemerisPreview.withinBudget
                  ? 'border-emerald-500/40 text-emerald-300'
                  : 'border-rose-500/40 text-rose-300'
              }`}
            >
              Dynamic Ephemeris: <strong>~{kvEphemerisPreview.tokensEst.toLocaleString()}</strong> / 2,000 tok
            </div>
          </div>
        </div>

        {/* 4 Independent Engine Enable + Prime Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {/* Card 1: Private Local Ollama */}
          <div
            className={`rounded-xl border p-4 space-y-3 transition-all ${
              kvConfig.privateOllama.enabled
                ? 'bg-emerald-950/20 border-emerald-500/50'
                : 'bg-slate-950/70 border-slate-800'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-extrabold text-white flex items-center gap-1.5">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span>Private Local LLM</span>
                </div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-mono truncate max-w-[175px]">
                  Ollama 14B / Qwen (FlashAttn + {kvConfig.privateOllama.kvCacheType})
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleSlotEnabled('privateOllama')}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  kvConfig.privateOllama.enabled ? 'bg-emerald-500' : 'bg-slate-700'
                }`}
                title="Toggle KV Cache for Private Ollama"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    kvConfig.privateOllama.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <div className="flex items-center justify-between gap-2 text-[11px] bg-slate-900/90 px-2.5 py-1.5 rounded-lg border border-slate-800">
              <label className="flex items-center gap-1.5 text-slate-300 cursor-pointer">
                <input
                  type="checkbox"
                  checked={kvConfig.privateOllama.flashAttention}
                  onChange={e =>
                    persistKvUpdate({
                      ...kvConfig,
                      privateOllama: { ...kvConfig.privateOllama, flashAttention: e.target.checked }
                    })
                  }
                  className="rounded border-slate-600 text-emerald-500"
                />
                <span>Flash Attn</span>
              </label>
              <select
                value={kvConfig.privateOllama.kvCacheType}
                onChange={e =>
                  persistKvUpdate({
                    ...kvConfig,
                    privateOllama: { ...kvConfig.privateOllama, kvCacheType: e.target.value as 'q8_0' | 'f16' }
                  })
                }
                className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-amber-300"
              >
                <option value="q8_0">q8_0 KV</option>
                <option value="f16">f16 KV</option>
              </select>
              <select
                value={kvConfig.privateOllama.keepAlive}
                onChange={e =>
                  persistKvUpdate({
                    ...kvConfig,
                    privateOllama: { ...kvConfig.privateOllama, keepAlive: e.target.value }
                  })
                }
                className="bg-slate-950 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] font-mono text-cyan-300"
              >
                <option value="15m">15m</option>
                <option value="30m">30m</option>
                <option value="60m">60m</option>
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                disabled={primingSlot !== null}
                onClick={() => handlePrimeEngineKvCache('privateOllama')}
                className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
              >
                {primingSlot === 'privateOllama' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                <span>Prime Private Ollama KV</span>
              </button>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={applyingOllamaEnv}
                  onClick={handleApplyOllamaEnv}
                  className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-[10px] font-bold text-amber-300 border border-slate-700 cursor-pointer"
                  title="Sets OLLAMA_FLASH_ATTENTION & OLLAMA_KV_CACHE_TYPE"
                >
                  {applyingOllamaEnv ? 'Applying...' : 'Apply Env Flags'}
                </button>
                <button
                  type="button"
                  disabled={unloadingOllama}
                  onClick={handleUnloadOllama}
                  className="px-2 py-1.5 rounded-lg bg-slate-800 hover:bg-rose-950/60 text-[10px] font-bold text-rose-300 border border-slate-700 cursor-pointer"
                >
                  {unloadingOllama ? 'Unloading...' : 'Unload RAM'}
                </button>
              </div>
            </div>

            {ollamaEnvMsg && (
              <div className={`text-[10px] leading-snug p-2 rounded-lg border ${ollamaEnvMsg.ok ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' : 'bg-rose-950/40 border-rose-500/30 text-rose-300'}`}>
                {ollamaEnvMsg.text}
              </div>
            )}
            {slotStatusMsg.privateOllama && (
              <div className={`text-[10px] leading-snug p-2 rounded-lg border ${slotStatusMsg.privateOllama.ok ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' : 'bg-rose-950/40 border-rose-500/30 text-rose-300'}`}>
                {slotStatusMsg.privateOllama.text}
              </div>
            )}
          </div>

          {/* Card 2: Claude Sonnet */}
          <div
            className={`rounded-xl border p-4 space-y-3 transition-all ${
              kvConfig.claudeSonnet.enabled
                ? 'bg-amber-950/20 border-amber-500/50'
                : 'bg-slate-950/70 border-slate-800'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-extrabold text-white">Claude Sonnet</div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                  {kvConfig.claudeSonnet.model} (ephemeral cache)
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleSlotEnabled('claudeSonnet')}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  kvConfig.claudeSonnet.enabled ? 'bg-amber-500' : 'bg-slate-700'
                }`}
                title="Toggle KV Cache for Claude Sonnet"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    kvConfig.claudeSonnet.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Pins D1 + D9 + Rules via Anthropic <code className="text-amber-300">cache_control: ephemeral</code>. Only &le; 2K ephemeris bills at full input rate.
            </p>
            <button
              type="button"
              disabled={primingSlot !== null}
              onClick={() => handlePrimeEngineKvCache('claudeSonnet')}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-amber-600 hover:bg-amber-500 disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
            >
              {primingSlot === 'claudeSonnet' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              <span>Prime Claude Sonnet KV</span>
            </button>
            {slotStatusMsg.claudeSonnet && (
              <div className={`text-[10px] leading-snug p-2 rounded-lg border ${slotStatusMsg.claudeSonnet.ok ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' : 'bg-rose-950/40 border-rose-500/30 text-rose-300'}`}>
                {slotStatusMsg.claudeSonnet.text}
              </div>
            )}
          </div>

          {/* Card 3: Claude Fable 5.1 */}
          <div
            className={`rounded-xl border p-4 space-y-3 transition-all ${
              kvConfig.claudeFable.enabled
                ? 'bg-purple-950/20 border-purple-500/50'
                : 'bg-slate-950/70 border-slate-800'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-extrabold text-white">Claude Fable 5.1</div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                  {kvConfig.claudeFable.model} (ephemeral cache)
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleSlotEnabled('claudeFable')}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  kvConfig.claudeFable.enabled ? 'bg-purple-500' : 'bg-slate-700'
                }`}
                title="Toggle KV Cache for Claude Fable"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    kvConfig.claudeFable.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Pre-warms Anthropic KV prefix for deep adaptive synthesis on <code className="text-purple-300">claude-fable-5-1</code> across sequential months.
            </p>
            <button
              type="button"
              disabled={primingSlot !== null}
              onClick={() => handlePrimeEngineKvCache('claudeFable')}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-purple-600 hover:bg-purple-500 disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
            >
              {primingSlot === 'claudeFable' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              <span>Prime Claude Fable KV</span>
            </button>
            {slotStatusMsg.claudeFable && (
              <div className={`text-[10px] leading-snug p-2 rounded-lg border ${slotStatusMsg.claudeFable.ok ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' : 'bg-rose-950/40 border-rose-500/30 text-rose-300'}`}>
                {slotStatusMsg.claudeFable.text}
              </div>
            )}
          </div>

          {/* Card 4: Google Gemini Pro */}
          <div
            className={`rounded-xl border p-4 space-y-3 transition-all ${
              kvConfig.geminiPro.enabled
                ? 'bg-cyan-950/20 border-cyan-500/50'
                : 'bg-slate-950/70 border-slate-800'
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-xs font-extrabold text-white">Google Gemini Pro</div>
                <div className="text-[10px] text-slate-400 mt-0.5 font-mono">
                  {kvConfig.geminiPro.model} (systemInstruction)
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleSlotEnabled('geminiPro')}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  kvConfig.geminiPro.enabled ? 'bg-cyan-500' : 'bg-slate-700'
                }`}
                title="Toggle KV Cache for Google Gemini Pro"
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${
                    kvConfig.geminiPro.enabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Routes static D1/D9/Rules/JSON schema into Gemini <code className="text-cyan-300">systemInstruction</code> so implicit prefix KV cache hits cleanly.
            </p>
            <button
              type="button"
              disabled={primingSlot !== null}
              onClick={() => handlePrimeEngineKvCache('geminiPro')}
              className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-600 hover:bg-cyan-500 disabled:opacity-60 text-white text-xs font-bold cursor-pointer"
            >
              {primingSlot === 'geminiPro' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
              <span>Prime Gemini Pro KV</span>
            </button>
            {slotStatusMsg.geminiPro && (
              <div className={`text-[10px] leading-snug p-2 rounded-lg border ${slotStatusMsg.geminiPro.ok ? 'bg-emerald-950/40 border-emerald-500/30 text-emerald-300' : 'bg-rose-950/40 border-rose-500/30 text-rose-300'}`}>
                {slotStatusMsg.geminiPro.text}
              </div>
            )}
          </div>
        </div>

        {/* Modular 4-Section System Cache Editor (Edit any single section independently) */}
        <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  { id: 'd1Chart', label: '1. D1 Chart' },
                  { id: 'd9Chart', label: '2. D9 Chart' },
                  { id: 'rules', label: `3. Rules (${kvMode.toUpperCase()})` },
                  { id: 'delivery', label: '4. Delivery Contract' }
                ] as const
              ).map(tab => {
                const hasCustom = Boolean(kvConfig.overrides[tab.id]?.trim());
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveKvBlockTab(tab.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                      activeKvBlockTab === tab.id
                        ? 'bg-emerald-600 text-white'
                        : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
                    }`}
                  >
                    <span>{tab.label}</span>
                    {hasCustom && (
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Custom edited" />
                    )}
                  </button>
                );
              })}
            </div>

            {kvConfig.overrides[activeKvBlockTab] && (
              <button
                type="button"
                onClick={() => handleResetBlockOverride(activeKvBlockTab)}
                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-semibold text-amber-300 flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Reset Block to Default</span>
              </button>
            )}
          </div>

          <textarea
            value={
              activeKvBlockTab === 'd9Chart' && isStalePlaceholderD9Override(kvConfig.overrides.d9Chart)
                ? defaultBlockTexts.d9Chart
                : (kvConfig.overrides[activeKvBlockTab] ?? defaultBlockTexts[activeKvBlockTab])
            }
            onChange={e => handleUpdateBlockOverride(activeKvBlockTab, e.target.value)}
            rows={7}
            spellCheck={false}
            className="w-full rounded-lg bg-slate-900 border border-slate-800 focus:border-emerald-500/60 focus:outline-none p-3 font-mono text-[11px] text-slate-200 leading-relaxed"
          />
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>
              Edit any single KV section above independently; untouched blocks automatically reflect your active person chart &amp; rules.
            </span>
            <span className="font-mono text-slate-400">
              Section ~{Math.round((kvConfig.overrides[activeKvBlockTab] ?? defaultBlockTexts[activeKvBlockTab]).length / 4)} tok
            </span>
          </div>
        </div>
      </div>

      {/* SECTION 1: PROMPT VERSION SELECTOR */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-6">
        <div className="flex items-start justify-between flex-wrap gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-400" />
              <h3 className="text-base sm:text-lg font-bold text-white">
                Vedic Prompt Architecture &amp; Versioning
              </h3>
            </div>
            <p className="text-xs text-slate-400 mt-1 max-w-3xl">
              Choose the astrological reasoning prompt format dispatched to all reasoning engines (Gemini, Claude, local Ollama Qwen).
              The selected version governs all monthly forecasts, Dasha narratives, and audio scripts.
            </p>
          </div>

          <div className="text-right">
            <div className="text-[11px] uppercase tracking-wider text-slate-500 font-bold">Currently Active</div>
            <div className="text-sm font-bold text-amber-400 font-mono">
              {PROMPT_VERSIONS[selectedVersion].name}
            </div>
          </div>
        </div>

        {/* Version Selection Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Version 3 Card (Default & Recommended) */}
          <div
            onClick={() => handleSelectVersion('v3')}
            className={`rounded-2xl p-5 border-2 transition-all cursor-pointer relative ${
              selectedVersion === 'v3'
                ? 'bg-amber-500/5 border-amber-500 shadow-lg shadow-amber-500/10'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950/90'
            }`}
          >
            {selectedVersion === 'v3' && (
              <div className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[11px]">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Active Default</span>
              </div>
            )}

            <div className="space-y-3.5">
              <div className="flex items-center gap-2 flex-wrap pr-24">
                <span className="text-base font-extrabold text-white">
                  Prompt v3 (Dual-Fold Lagna + Moon)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Recommended
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Tag: V3
                </span>
              </div>

              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">
                  <span className="text-amber-400 font-bold">Astrological Stance: </span>
                  {PROMPT_VERSIONS.v3.astrologicalStance}
                </div>
                <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 leading-relaxed font-sans">
                  <span className="font-bold text-amber-300 block mb-1">Refinement Remark:</span>
                  {PROMPT_VERSIONS.v3.refinementRemark}
                </div>
              </div>

              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Dual-Fold Rules Enforced:
                </div>
                <ul className="space-y-1 text-xs text-slate-300">
                  {PROMPT_VERSIONS.v3.keyPrinciples.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span className="leading-tight">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="pt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectVersion('v3');
                  }}
                  className={`w-full py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    selectedVersion === 'v3'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                  }`}
                >
                  {selectedVersion === 'v3' ? (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Active Engine Prompt</span>
                    </>
                  ) : (
                    <span>Switch to Prompt v3 (Dual-Fold)</span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Version 2 Card */}
          <div
            onClick={() => handleSelectVersion('v2')}
            className={`rounded-2xl p-5 border-2 transition-all cursor-pointer relative ${
              selectedVersion === 'v2'
                ? 'bg-amber-500/5 border-amber-500 shadow-lg shadow-amber-500/10'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950/90'
            }`}
          >
            {selectedVersion === 'v2' && (
              <div className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[11px]">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Active</span>
              </div>
            )}

            <div className="space-y-3.5">
              <div className="flex items-center gap-2 flex-wrap pr-24">
                <span className="text-base font-extrabold text-white">
                  Prompt v2 (Moon-Only Gochara)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                  Pure Moon Gochara
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700">
                  Tag: V2
                </span>
              </div>

              {/* Astrological Stance & Refinement Remark */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">
                  <span className="text-amber-400 font-bold">Astrological Stance: </span>
                  {PROMPT_VERSIONS.v2.astrologicalStance}
                </div>
                <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 leading-relaxed font-sans">
                  <span className="font-bold text-amber-300 block mb-1">Refinement Remark:</span>
                  {PROMPT_VERSIONS.v2.refinementRemark}
                </div>
              </div>

              {/* Key Principles List */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Core Parashara Rules Enforced:
                </div>
                <ul className="space-y-1 text-xs text-slate-300">
                  {PROMPT_VERSIONS.v2.keyPrinciples.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-emerald-400 font-bold">✓</span>
                      <span className="leading-tight">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Selection button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectVersion('v2');
                  }}
                  className={`w-full py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    selectedVersion === 'v2'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-800 hover:bg-slate-700 text-white'
                  }`}
                >
                  {selectedVersion === 'v2' ? (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Active Engine Prompt</span>
                    </>
                  ) : (
                    <span>Switch to Prompt v2 (Moon-Only)</span>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Version 1 Card (Legacy Hybrid - Deprecated) */}
          <div
            onClick={() => handleSelectVersion('v1')}
            className={`rounded-2xl p-5 border-2 transition-all cursor-pointer relative ${
              selectedVersion === 'v1'
                ? 'bg-amber-500/5 border-amber-500 shadow-lg shadow-amber-500/10'
                : 'bg-slate-950/60 border-slate-800 hover:border-slate-700 hover:bg-slate-950/90 opacity-90'
            }`}
          >
            {selectedVersion === 'v1' ? (
              <div className="absolute top-4 right-4 flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500 text-slate-950 font-bold text-[11px]">
                <Check className="w-3.5 h-3.5 stroke-[3]" />
                <span>Active</span>
              </div>
            ) : (
              <div className="absolute top-4 right-4 flex items-center gap-1 px-2 py-0.5 rounded-full bg-slate-800 text-slate-400 font-medium text-[10px]">
                <span>Deprecated</span>
              </div>
            )}

            <div className="space-y-3.5">
              <div className="flex items-center gap-2 flex-wrap pr-20">
                <span className="text-base font-extrabold text-white">
                  Prompt v1 (Legacy Hybrid)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                  Legacy / Westernized
                </span>
              </div>

              {/* Astrological Stance & Refinement Remark */}
              <div className="space-y-2">
                <div className="text-xs font-semibold text-slate-300">
                  <span className="text-slate-400 font-bold">Astrological Stance: </span>
                  {PROMPT_VERSIONS.v1.astrologicalStance}
                </div>
                <div className="bg-slate-900/90 border border-slate-800/80 rounded-xl p-3 text-xs text-slate-300 leading-relaxed font-sans">
                  <span className="font-bold text-rose-300 block mb-1">Refinement Remark:</span>
                  {PROMPT_VERSIONS.v1.refinementRemark}
                </div>
              </div>

              {/* Key Principles / Limitations */}
              <div className="space-y-1.5 pt-1">
                <div className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">
                  Legacy Architecture Characteristics:
                </div>
                <ul className="space-y-1 text-xs text-slate-400">
                  {PROMPT_VERSIONS.v1.keyPrinciples.map((item, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-slate-500 font-bold">•</span>
                      <span className="leading-tight">{item}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Selection button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleSelectVersion('v1');
                  }}
                  className={`w-full py-2 px-4 rounded-xl text-xs font-bold transition flex items-center justify-center gap-2 cursor-pointer ${
                    selectedVersion === 'v1'
                      ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20'
                      : 'bg-slate-800 hover:bg-slate-700 text-slate-300'
                  }`}
                >
                  {selectedVersion === 'v1' ? (
                    <>
                      <Check className="w-4 h-4 stroke-[2.5]" />
                      <span>Active Engine Prompt (Legacy)</span>
                    </>
                  ) : (
                    <span>Switch to Prompt v1 (Rollback / Compare)</span>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: READ-ONLY PROMPT STRUCTURE PREVIEW PANE */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        {/* Header with Read-Only Lock & Version Switcher Tabs */}
        <div className="p-4 sm:p-5 bg-slate-950/80 border-b border-slate-800 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-sm sm:text-base font-bold text-white">
                  Read-Only Prompt Template Inspector
                </h4>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-slate-800 text-slate-300 border border-slate-700 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-amber-400" />
                  <span>Protected Read-Only</span>
                </span>
                {inspectVersion === selectedVersion && (
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Currently Dispatched
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Exact formatted payload structure dispatched to LLMs (Previewing Native ID: {activePersonId}).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Version preview switcher tabs */}
            <div className="flex items-center rounded-xl bg-slate-900 border border-slate-800 p-1">
              <button
                onClick={() => setInspectVersion('v3')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  inspectVersion === 'v3'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>v3 (Dual-Fold)</span>
                {selectedVersion === 'v3' && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
              </button>
              <button
                onClick={() => setInspectVersion('v2')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  inspectVersion === 'v2'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>v2 (Moon-Only)</span>
                {selectedVersion === 'v2' && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
              </button>
              <button
                onClick={() => setInspectVersion('v1')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  inspectVersion === 'v1'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>v1 (Legacy)</span>
                {selectedVersion === 'v1' && <span className="w-1.5 h-1.5 rounded-full bg-slate-950" />}
              </button>
            </div>

            {/* Copy Button */}
            <button
              onClick={handleCopyPrompt}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition cursor-pointer shadow-sm"
              title="Copy prompt text to clipboard"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-300">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 text-amber-400" />
                  <span>Copy Prompt</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Read-Only Notice Bar */}
        <div className="px-5 py-2.5 bg-amber-500/5 border-b border-amber-500/20 text-xs text-amber-300/90 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <Info className="w-4 h-4 text-amber-400 shrink-0" />
            <span>
              <strong>Note:</strong> Prompt editing is disabled in this settings console. System prompts follow strict canonical scripture formulas.
            </span>
          </div>
          <div className="flex items-center gap-4 text-[11px] font-mono text-slate-400">
            <span>{lineCount} lines</span>
            <span>{charCount.toLocaleString()} chars</span>
          </div>
        </div>

        {/* Read-Only Code Block / Pane */}
        <div className="relative bg-slate-950 p-4 sm:p-6 overflow-x-auto max-h-[520px] overflow-y-auto font-mono text-xs text-slate-300 leading-relaxed border-b border-slate-800 select-text">
          <pre className="whitespace-pre-wrap font-mono break-words">
            {renderedPromptText}
          </pre>
        </div>

        {/* Bottom Inspector Footer */}
        <div className="p-4 bg-slate-950/60 flex items-center justify-between flex-wrap gap-3 text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <span>Ready for dispatch via Gemini 2.5 Flash, Claude Sonnet 5.5, or Local Ollama Qwen.</span>
          </div>
          {onNavigateToReport && (
            <button
              onClick={onNavigateToReport}
              className="flex items-center gap-1.5 text-amber-400 hover:text-amber-300 font-bold transition cursor-pointer"
            >
              <span>Test in Prediction Studio</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* SECTION 3: ARCHITECTURAL DIFFERENCE MATRIX */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-4">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-amber-400" />
          <h3 className="text-base sm:text-lg font-bold text-white">
            Architectural Refinement Matrix: v1 vs v2 vs v3
          </h3>
        </div>
        <p className="text-xs text-slate-400">
          Comparison of how transit events, Lagna D1 house strength, Moon mental synthesis, and compact payload tags operate across prompt versions.
        </p>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Dimension</th>
                <th className="py-3 px-4 text-rose-400">Prompt v1 (Legacy Hybrid)</th>
                <th className="py-3 px-4 text-cyan-400">Prompt v2 (Moon-Only)</th>
                <th className="py-3 px-4 text-emerald-400">Prompt v3 (Dual-Fold)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 font-sans">
              <tr>
                <td className="py-3 px-4 font-bold text-slate-200">Transit Reference Frame</td>
                <td className="py-3 px-4 text-slate-400">
                  Mixed Lagna and Moon houses without clear event vs psychological distinction.
                </td>
                <td className="py-3 px-4 text-cyan-300">
                  Strictly Janma Rashi (Moon Sign). Zero Lagna transit calculation.
                </td>
                <td className="py-3 px-4 text-emerald-300 font-semibold">
                  Dual-Fold: BOTH Lagna (L#) and Janma Rashi Moon (M#) evaluated simultaneously.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-slate-200">Lived Event vs Mental Synthesis</td>
                <td className="py-3 px-4 text-slate-400">
                  Conflated real-world house effects with internal reaction.
                </td>
                <td className="py-3 px-4 text-cyan-300">
                  Moon-centric timing only; forbade estimating Lagna D1 house strength from transits.
                </td>
                <td className="py-3 px-4 text-emerald-300 font-semibold">
                  Lagna (L#) gives objective lived event &amp; modulates D1 house strength; Moon (M#) gives mental synthesis &amp; feeling (e.g. Saturn Pisces = L4 event felt via M5 mind).
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-slate-200">Payload Jargon &amp; Compactness</td>
                <td className="py-3 px-4 text-slate-400">
                  Verbose headers &amp; explicit internal version banner inside prompt text.
                </td>
                <td className="py-3 px-4 text-cyan-300">
                  Compact pipe/line payload with Moon Gochara focus.
                </td>
                <td className="py-3 px-4 text-emerald-300 font-semibold">
                  Compacted D1/D9/Gochara + manifestation superset with ZERO internal version names or decorative text sent to LLMs.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-slate-200">Response Differentiator Tag</td>
                <td className="py-3 px-4 font-mono text-rose-300">V1</td>
                <td className="py-3 px-4 font-mono text-cyan-300">V2</td>
                <td className="py-3 px-4 font-mono text-emerald-300 font-bold">V3</td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-slate-200">System Status</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    Deprecated (Benchmarking Only)
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-cyan-500/10 text-cyan-300 border border-cyan-500/20">
                    Available (Comparison)
                  </span>
                </td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Active System Default
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      {/* SECTION 4: LOCAL & CLOUD LLM ENGINE INFERENCE PREFERENCES */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl space-y-5">
        <div className="flex items-center gap-2">
          <Cpu className="w-5 h-5 text-amber-400" />
          <h3 className="text-base sm:text-lg font-bold text-white">
            Reasoning Engine Runtime &amp; Timeout Controls
          </h3>
        </div>
        <p className="text-xs text-slate-400">
          Configure how local on-premise models (Ollama) and cloud APIs execute background synthesis without artificial time constraints.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-2">
          {/* Timeout Card */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-amber-400" />
                <span>Ollama Execution Timeout Constraint</span>
              </span>
              <button
                type="button"
                onClick={() => handleToggleOllamaTimeout(!ollamaTimeoutEnabled)}
                className={`relative inline-flex h-5 w-10 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  ollamaTimeoutEnabled ? 'bg-rose-500' : 'bg-emerald-500'
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                    ollamaTimeoutEnabled ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>

            <p className="text-[11px] text-slate-400 leading-relaxed">
              {ollamaTimeoutEnabled ? (
                <span className="text-amber-300">
                  Enforcing timeout constraint at {ollamaTimeoutSec} seconds. If the model takes longer, it reverts to analytical Parashara synthesis.
                </span>
              ) : (
                <span className="text-emerald-300 font-semibold">
                  ⚡ Full Throttle / No Timeout Constraint (Recommended): Local models run fully to completion in the background without being cut short.
                </span>
              )}
            </p>

            {ollamaTimeoutEnabled && (
              <div className="pt-2 flex items-center gap-2">
                <span className="text-xs text-slate-400">Timeout limit:</span>
                <input
                  type="number"
                  min="30"
                  max="1200"
                  value={ollamaTimeoutSec}
                  onChange={(e) => handleUpdateTimeoutSec(parseInt(e.target.value, 10) || 300)}
                  className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-amber-300 font-mono w-24"
                />
                <span className="text-xs text-slate-500">seconds</span>
              </div>
            )}
          </div>

          {/* Database Narrative Persistence Card */}
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-white flex items-center gap-1.5">
                <Database className="w-4 h-4 text-amber-400" />
                <span>Database Narrative Caching</span>
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Automatic Persistent
              </span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Generated narratives (Dasha AD narratives and monthly synthesis) are persisted into the database.
              Once generated, they load directly from the DB on subsequent visits without re-incurring inference overhead.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
