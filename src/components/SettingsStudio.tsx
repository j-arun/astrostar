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
  AlertCircle
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
  buildVedicPromptV2
} from '../services/llm/adapters';
import { samplePersonMaster, sampleNatalPlacements } from '../data/horoscopeData';
import storedPersonsData from '../data/stored_persons.json';

interface SettingsStudioProps {
  activePersonId?: string;
  onNavigateToReport?: () => void;
}

export default function SettingsStudio({ activePersonId = '001ME', onNavigateToReport }: SettingsStudioProps) {
  // Current active prompt version loaded from localStorage (default: 'v2')
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

  // Mock context generation to preview the prompt template in read-only mode
  const previewContext: VedicHouseContext = useMemo(() => {
    const rawPerson = (storedPersonsData as any)[activePersonId] || (storedPersonsData as any)['001ME'];
    const profile = rawPerson?.profile || samplePersonMaster;
    const d1 = rawPerson?.d1_placements || sampleNatalPlacements;

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
      flattenedNatalD9: [],
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

  // Read-only prompt text rendered dynamically
  const renderedPromptText = useMemo(() => {
    if (inspectVersion === 'v1') {
      return buildVedicPromptV1(previewContext, 'LLM Provider Engine');
    }
    return buildVedicPromptV2(previewContext, 'LLM Provider Engine');
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {/* Version 2 Card (Default & Recommended) */}
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
                <span>Active Default</span>
              </div>
            )}

            <div className="space-y-3.5">
              <div className="flex items-center gap-2 flex-wrap pr-24">
                <span className="text-base font-extrabold text-white">
                  Prompt v2 (Classical Parashara)
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Recommended
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  Pure Moon Gochara
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
                    <span>Switch to Prompt v2 (Classical Parashara)</span>
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
                onClick={() => setInspectVersion('v2')}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                  inspectVersion === 'v2'
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <span>v2 (Classical)</span>
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
            Architectural Refinement Matrix: v1 vs v2
          </h3>
        </div>
        <p className="text-xs text-slate-400">
          Detailed technical breakdown of why Prompt v2 enforces the classical Vedic standard over the legacy hybrid stance.
        </p>

        <div className="overflow-x-auto rounded-xl border border-slate-800">
          <table className="w-full text-left text-xs text-slate-300 divide-y divide-slate-800">
            <thead className="bg-slate-950 text-slate-400 uppercase tracking-wider font-semibold">
              <tr>
                <th className="py-3 px-4">Dimension</th>
                <th className="py-3 px-4 text-rose-400">Prompt v1 (Legacy Hybrid)</th>
                <th className="py-3 px-4 text-emerald-400">Prompt v2 (Classical Parashara)</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/60 font-sans">
              <tr>
                <td className="py-3 px-4 font-bold text-slate-200">Transit Reference Frame</td>
                <td className="py-3 px-4 text-slate-400">
                  Conflated: Evaluated relative to both Lagna and Moon (e.g. &ldquo;Saturn in 4th from Lagna&rdquo;).
                </td>
                <td className="py-3 px-4 text-emerald-300 font-semibold">
                  Strictly Janma Rashi (Moon Sign). Zero Lagna transit calculation.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-slate-200">Natal Promise Separation</td>
                <td className="py-3 px-4 text-slate-400">
                  Leaked transit conditions into Lagna house strengths and natal capacity.
                </td>
                <td className="py-3 px-4 text-emerald-300 font-semibold">
                  Absolute boundary: D1 &amp; D9 from Lagna define static capacity (chapati batter); Moon Gochara defines timing weather (dosa batter).
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-slate-200">Purpose of Gochara</td>
                <td className="py-3 px-4 text-slate-400">
                  Judged house conditions directly as if transiting planets ruled the Lagna houses.
                </td>
                <td className="py-3 px-4 text-emerald-300 font-semibold">
                  Evaluates whether the cosmic sky is fruitful and applicable for performing karmas.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-slate-200">Planetary Karakatwas in Transit</td>
                <td className="py-3 px-4 text-slate-400">
                  Secondary focus; relied heavily on Western-style house cusps from Ascendant.
                </td>
                <td className="py-3 px-4 text-emerald-300 font-semibold">
                  Primary vehicle: Transiting planets manifest through their natural Karakatwas and house position from the Moon (e.g., Jupiter in 9th from Moon).
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-slate-200">Dasha Lord Bridge</td>
                <td className="py-3 px-4 text-slate-400">
                  Unclear linkage between MD/AD and transit sky.
                </td>
                <td className="py-3 px-4 text-emerald-300 font-semibold">
                  Dasha represents WHO is authorized to release fruits; Gochara from Moon dictates HOW fruitfully they manifest.
                </td>
              </tr>
              <tr>
                <td className="py-3 px-4 font-bold text-slate-200">System Status</td>
                <td className="py-3 px-4">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                    Deprecated (Benchmarking Only)
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
