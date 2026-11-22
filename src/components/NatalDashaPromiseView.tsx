import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertCircle,
  BookOpen,
  Briefcase,
  Check,
  ChevronDown,
  ChevronUp,
  Coins,
  Copy,
  Eye,
  Heart,
  Home,
  Layers,
  MessageSquare,
  Scale,
  ShieldAlert,
  Sparkles,
  User,
  Clock
} from 'lucide-react';
import {
  DashaEvaluationRecord,
  DashaIntervalItem,
  fetchDashaEvaluations
} from '../data/apiService';
import storedPersonsData from '../data/stored_persons.json';
import { LLM_PROVIDERS, LLMProviderId } from '../services/llm/types';
import {
  AspectPeriodEval,
  NATAL_ASPECT_ORDER,
  NATAL_ASPECT_SPECS,
  NatalAspectId,
  NatalPersonProfileInput,
  NatalPlacementRow,
  cleanNatalPlanetName,
  evaluateNatalDashaPromise
} from '../services/natalDashaPromiseEngine';
import {
  NatalDashaAiSynthesisResult,
  buildNatalDashaMasterPrompt,
  runNatalDashaAISynthesis
} from '../services/natalDashaPromptBuilder';

export interface NatalDashaPromiseViewProps {
  personId: string;
  onSelectPerson?: (newPersonId: string) => void;
  defaultProvider?: LLMProviderId;
}

interface LoadedPersonBundle {
  profile: NatalPersonProfileInput;
  placements: NatalPlacementRow[];
  intervals: DashaIntervalItem[];
  savedNotes: DashaEvaluationRecord[];
  restSource: 'live_rest' | 'local_fallback';
  restDurationMs: number;
}

const ASPECT_ICONS: Record<NatalAspectId, React.ReactNode> = {
  career: <Briefcase className="w-4 h-4" />,
  finance: <Coins className="w-4 h-4" />,
  love: <Heart className="w-4 h-4" />,
  family: <Home className="w-4 h-4" />,
  health: <Activity className="w-4 h-4" />,
  litigations: <Scale className="w-4 h-4" />
};

function toneBadgeClasses(tone: AspectPeriodEval['tone']): string {
  switch (tone) {
    case 'High':
      return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40';
    case 'Supportive':
      return 'bg-sky-500/15 text-sky-300 border-sky-500/40';
    case 'Mixed':
      return 'bg-amber-500/15 text-amber-300 border-amber-500/40';
    case 'Caution':
      return 'bg-rose-500/15 text-rose-300 border-rose-500/40';
  }
}

function pdOverallBadgeClasses(tone: string): string {
  if (tone.startsWith('Peak')) return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40';
  if (tone.startsWith('Productive')) return 'bg-sky-500/20 text-sky-300 border-sky-500/40';
  if (tone.startsWith('Mixed')) return 'bg-amber-500/20 text-amber-300 border-amber-500/40';
  return 'bg-rose-500/20 text-rose-300 border-rose-500/40';
}

function renderSimpleMarkdown(md: string): React.ReactNode {
  const lines = md.split('\n');
  const elements: React.ReactNode[] = [];
  let i = 0;

  const renderInline = (text: string): React.ReactNode[] => {
    const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx} className="text-white font-semibold">{part.slice(2, -2)}</strong>;
      }
      if (part.startsWith('`') && part.endsWith('`')) {
        return <code key={idx} className="px-1.5 py-0.5 rounded bg-slate-800 text-amber-300 text-xs font-mono">{part.slice(1, -1)}</code>;
      }
      return <React.Fragment key={idx}>{part}</React.Fragment>;
    });
  };

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    // Markdown table block
    if (trimmed.startsWith('|') && i + 1 < lines.length && lines[i + 1].trim().startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      const rows = tableLines
        .filter(r => !/^\|[\s:|-]+\|$/.test(r))
        .map(r => r.slice(1, -1).split('|').map(c => c.trim()));
      const header = rows[0] || [];
      const body = rows.slice(1);
      elements.push(
        <div key={`tbl-${i}`} className="overflow-x-auto my-3 rounded-xl border border-slate-800">
          <table className="w-full text-xs text-left border-collapse">
            <thead className="bg-slate-900 text-amber-300 border-b border-slate-800">
              <tr>
                {header.map((h, cIdx) => (
                  <th key={cIdx} className="px-3 py-2 font-bold whitespace-nowrap">{renderInline(h)}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 bg-slate-950/60">
              {body.map((row, rIdx) => (
                <tr key={rIdx} className="hover:bg-slate-900/50">
                  {row.map((cell, cIdx) => (
                    <td key={cIdx} className="px-3 py-2 text-slate-300 align-top">{renderInline(cell)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
      continue;
    }

    if (trimmed.startsWith('### ')) {
      elements.push(
        <h4 key={`h3-${i}`} className="text-sm sm:text-base font-bold text-amber-300 mt-5 mb-2 border-b border-slate-800 pb-1">
          {renderInline(trimmed.slice(4))}
        </h4>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('## ')) {
      elements.push(
        <h3 key={`h2-${i}`} className="text-base font-bold text-white mt-5 mb-2">
          {renderInline(trimmed.slice(3))}
        </h3>
      );
      i++;
      continue;
    }
    if (trimmed.startsWith('# ')) {
      elements.push(
        <h2 key={`h1-${i}`} className="text-lg font-extrabold text-amber-300 mt-4 mb-2">
          {renderInline(trimmed.slice(2))}
        </h2>
      );
      i++;
      continue;
    }
    if (/^[-*]\s+/.test(trimmed)) {
      const items: string[] = [];
      while (i < lines.length && /^[-*]\s+/.test(lines[i].trim())) {
        items.push(lines[i].trim().replace(/^[-*]\s+/, ''));
        i++;
      }
      elements.push(
        <ul key={`ul-${i}`} className="list-disc pl-5 space-y-1.5 my-2 text-xs sm:text-sm text-slate-300">
          {items.map((it, idx) => (
            <li key={idx} className="leading-relaxed">{renderInline(it)}</li>
          ))}
        </ul>
      );
      continue;
    }

    elements.push(
      <p key={`p-${i}`} className="text-xs sm:text-sm text-slate-300 leading-relaxed my-2">
        {renderInline(trimmed)}
      </p>
    );
    i++;
  }

  return <div className="space-y-1">{elements}</div>;
}

export const NatalDashaPromiseView: React.FC<NatalDashaPromiseViewProps> = ({
  personId,
  onSelectPerson,
  defaultProvider = 'gemini_pro'
}) => {
  const [selectedPersonId, setSelectedPersonId] = useState<string>(personId || '001ME');
  const [personsList, setPersonsList] = useState<NatalPersonProfileInput[]>(() => {
    const localObj = storedPersonsData as Record<string, { profile: NatalPersonProfileInput }>;
    return Object.values(localObj).map(x => x.profile);
  });

  const [bundle, setBundle] = useState<LoadedPersonBundle | null>(null);
  const [isLoadingPerson, setIsLoadingPerson] = useState<boolean>(false);
  const [personLoadError, setPersonLoadError] = useState<string | null>(null);

  const [selectedMdIndex, setSelectedMdIndex] = useState<number | undefined>(undefined);
  const [selectedAdIndex, setSelectedAdIndex] = useState<number | undefined>(undefined);
  const [aspectFilter, setAspectFilter] = useState<NatalAspectId | 'all'>('all');
  const [pdDisplayMode, setPdDisplayMode] = useState<'cards' | 'matrix'>('cards');
  const [focusedPdIndex, setFocusedPdIndex] = useState<number | null>(null);

  const [showBaselineSection, setShowBaselineSection] = useState<boolean>(false);
  const [activeVargaTab, setActiveVargaTab] = useState<string>('D10');

  const [focusQuestion, setFocusQuestion] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<LLMProviderId>(() => {
    try {
      const saved = localStorage.getItem('astro_llm_provider') as LLMProviderId | null;
      return saved && LLM_PROVIDERS[saved] ? saved : defaultProvider;
    } catch {
      return defaultProvider;
    }
  });
  const [showPromptInspector, setShowPromptInspector] = useState<boolean>(false);
  const [copiedPrompt, setCopiedPrompt] = useState<boolean>(false);
  const [isSynthesizingAi, setIsSynthesizingAi] = useState<boolean>(false);
  const [aiResult, setAiResult] = useState<NatalDashaAiSynthesisResult | null>(null);

  // Sync incoming personId prop
  useEffect(() => {
    if (personId && personId !== selectedPersonId) {
      setSelectedPersonId(personId);
    }
  }, [personId]);

  // 1. Fetch all available Person IDs from live REST API
  useEffect(() => {
    let active = true;
    fetch('/api/persons')
      .then(r => (r.ok ? r.json() : null))
      .then(json => {
        if (!active || !json?.persons?.length) return;
        setPersonsList(json.persons);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  // 2. Whenever selectedPersonId changes, execute live REST calls:
  //    GET /api/persons/:id + POST /api/horoscope/query + GET /api/dasha/notes
  useEffect(() => {
    let cancelled = false;
    const pid = selectedPersonId || '001ME';
    setIsLoadingPerson(true);
    setPersonLoadError(null);
    setAiResult(null);
    setFocusedPdIndex(null);

    const loadPersonViaRest = async () => {
      const t0 = performance.now();
      const localRecord = (storedPersonsData as Record<string, any>)[pid] || (storedPersonsData as Record<string, any>)['001ME'];

      let profile: NatalPersonProfileInput = localRecord?.profile;
      let placements: NatalPlacementRow[] = localRecord?.placements || [];
      let intervals: DashaIntervalItem[] = [];
      let restSource: 'live_rest' | 'local_fallback' = 'local_fallback';

      try {
        const personRes = await fetch(`/api/persons/${encodeURIComponent(pid)}`);
        if (personRes.ok) {
          const personJson = await personRes.json();
          if (personJson?.success && personJson?.person?.profile) {
            profile = personJson.person.profile;
            placements = personJson.person.placements || [];
            restSource = 'live_rest';
          }
        }

        const dobYear = parseInt((profile?.date_of_birth || '1976-01-26').slice(0, 4), 10) || 1976;
        const startIso = profile?.date_of_birth || `${dobYear}-01-01`;
        const endIso = `${dobYear + 112}-12-31`;

        const queryRes = await fetch('/api/horoscope/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            person_id: pid,
            start_date: startIso,
            end_date: endIso,
            format: 'full'
          })
        });

        if (queryRes.ok) {
          const queryJson = await queryRes.json();
          if (queryJson?.person_profile) profile = queryJson.person_profile;
          const d1 = queryJson?.natal_placements?.D1_rashi_chart?.bodies || [];
          const d9 = queryJson?.natal_placements?.D9_navamsha_chart?.bodies || [];
          if (d1.length > 0 || d9.length > 0) {
            placements = [
              ...d1.map((b: any) => ({ ...b, chart_type: 'D1' })),
              ...d9.map((b: any) => ({ ...b, chart_type: 'D9' }))
            ];
          }
          if (Array.isArray(queryJson?.vimshottari_dasha_intervals?.intervals)) {
            intervals = queryJson.vimshottari_dasha_intervals.intervals;
          }
          restSource = 'live_rest';
        }
      } catch (err: any) {
        if (!cancelled) {
          setPersonLoadError(err?.message || 'REST query failed; using local person fallback.');
        }
      }

      const savedNotes = await fetchDashaEvaluations('', pid).catch(() => []);
      if (cancelled) return;

      const elapsed = Math.round(performance.now() - t0);
      setSelectedMdIndex(undefined);
      setSelectedAdIndex(undefined);
      setBundle({
        profile,
        placements,
        intervals,
        savedNotes,
        restSource,
        restDurationMs: elapsed
      });
      setIsLoadingPerson(false);
    };

    loadPersonViaRest();
    return () => {
      cancelled = true;
    };
  }, [selectedPersonId]);

  const handlePersonDropdownChange = (newPid: string) => {
    setSelectedPersonId(newPid);
    if (onSelectPerson) {
      onSelectPerson(newPid);
    }
  };

  // Compute deterministic purely-natal evaluation
  const { dashaTree, evaluation } = useMemo(() => {
    const fallbackRecord = (storedPersonsData as Record<string, any>)[selectedPersonId] || (storedPersonsData as Record<string, any>)['001ME'];
    const profile = bundle?.profile || fallbackRecord.profile;
    const placements = bundle?.placements || fallbackRecord.placements;
    return evaluateNatalDashaPromise({
      personId: profile.person_id || selectedPersonId,
      profile,
      placements,
      apiIntervals: bundle?.intervals,
      savedNotes: bundle?.savedNotes || [],
      selectedMdIndex,
      selectedAdIndex
    });
  }, [bundle, selectedPersonId, selectedMdIndex, selectedAdIndex]);

  // Build Transit-Free Heartbeat Master Prompt
  const masterPrompt = useMemo(() => {
    return buildNatalDashaMasterPrompt({
      evaluation,
      rawPlacements: bundle?.placements || ((storedPersonsData as Record<string, any>)[selectedPersonId]?.placements ?? []),
      focusQuestion,
      aspectFilter
    });
  }, [evaluation, bundle, selectedPersonId, focusQuestion, aspectFilter]);

  const visibleAspectIds = aspectFilter === 'all' ? NATAL_ASPECT_ORDER : [aspectFilter];
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const curatedQuestions = [
    `Do I get married or form a lasting partnership during ${evaluation.selectedMd.cleanMdLord} MD (${evaluation.selectedAd.cleanAdLord} AD)?`,
    `Will I face litigation, court disputes, or legal setbacks in ${evaluation.selectedMd.cleanMdLord} MD > ${evaluation.selectedAd.cleanAdLord} AD?`,
    `What career rise, job shift, or authority changes are promised in ${evaluation.selectedMd.cleanMdLord} MD > ${evaluation.selectedAd.cleanAdLord} AD?`,
    `What wealth accumulation, property, or debt outcomes unfold across all 9 PDs of ${evaluation.selectedMd.cleanMdLord}-${evaluation.selectedAd.cleanAdLord}?`,
    `Which PD windows inside ${evaluation.selectedMd.cleanMdLord}-${evaluation.selectedAd.cleanAdLord} need health vigilance?`
  ];

  const handleRunAiQuestion = async (overrideQuestion?: string) => {
    const qToAsk = overrideQuestion !== undefined ? overrideQuestion : focusQuestion;
    if (overrideQuestion !== undefined) {
      setFocusQuestion(overrideQuestion);
    }

    const promptToSend = overrideQuestion !== undefined
      ? buildNatalDashaMasterPrompt({
          evaluation,
          rawPlacements: bundle?.placements || [],
          focusQuestion: qToAsk,
          aspectFilter
        })
      : masterPrompt;

    setIsSynthesizingAi(true);
    setAiResult(null);

    const res = await runNatalDashaAISynthesis({
      providerId: selectedProvider,
      prompt: promptToSend.prompt,
      systemInstruction: promptToSend.systemInstruction
    });

    setAiResult(res);
    setIsSynthesizingAi(false);
  };

  const handleCopyPrompt = () => {
    navigator.clipboard?.writeText(`${masterPrompt.systemInstruction}\n\n${masterPrompt.prompt}`);
    setCopiedPrompt(true);
    setTimeout(() => setCopiedPrompt(false), 1800);
  };

  return (
    <div className="space-y-5 animate-fadeIn">
      {/* =================================================================== */}
      {/* TOP CONTROLS: PERSON PICKER (LIVE REST) + MD/AD + ZERO TRANSIT NOTE */}
      {/* =================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-800/80 pb-4">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 shrink-0">
              <BookOpen className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                  Natal Dasha–Bhukti Promise Studio
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30">
                  Purely Natal &bull; Zero Transits
                </span>
                {bundle && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-300 border border-emerald-500/25">
                    {bundle.restSource === 'live_rest' ? `REST Synced (${bundle.restDurationMs}ms)` : 'Local Cache'}
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-1 max-w-3xl leading-relaxed">
                Evaluates structural natal promise using <strong className="text-slate-200">D1, D9, Divisional Vargas (D2–D30), SAV/BAV, Shadbala, Yogas &amp; Jaimini</strong> across <strong className="text-amber-300">Mahadasha &rarr; Antardasha &rarr; all 9 PDs</strong>. External Gochara delivery timing is intentionally excluded here.
              </p>
            </div>
          </div>

          <div className="text-right text-xs text-slate-400 font-mono">
            <div>Lagna: <span className="text-amber-300 font-bold">{evaluation.lagnaSign}</span> (L1)</div>
            <div>Rashi: <span className="text-sky-300 font-bold">{evaluation.moonSign}</span> &bull; {evaluation.janmaStar}</div>
          </div>
        </div>

        {personLoadError && (
          <div className="flex items-center gap-2 text-xs text-amber-300 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{personLoadError}</span>
          </div>
        )}

        {/* 3-Column Selector Row: Person ID (REST), Mahadasha (MD), Antardasha (AD) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Person ID Dropdown */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
            <label className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              <span className="flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-amber-400" />
                <span>Person ID (Live REST Query)</span>
              </span>
              {isLoadingPerson && <span className="text-amber-400 font-mono animate-pulse">Fetching...</span>}
            </label>
            <select
              value={selectedPersonId}
              onChange={(e) => handlePersonDropdownChange(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 hover:border-amber-500/50 rounded-lg px-3 py-2 text-xs sm:text-sm text-white font-semibold focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              {personsList.map(p => (
                <option key={p.person_id} value={p.person_id}>
                  {p.person_id} — {p.person_name || p.person_id} ({p.birth_lagna.split(' ')[0]} / {p.birth_rashi.split(' ')[0]})
                </option>
              ))}
            </select>
          </div>

          {/* Mahadasha (MD) Picker */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
            <label className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-amber-400" />
                <span>Mahadasha (MD)</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">9 Cycles</span>
            </label>
            <select
              value={evaluation.selectedMd.index - 1}
              onChange={(e) => {
                setSelectedMdIndex(Number(e.target.value));
                setSelectedAdIndex(0);
                setFocusedPdIndex(null);
              }}
              className="w-full bg-slate-900 border border-slate-700 hover:border-amber-500/50 rounded-lg px-3 py-2 text-xs sm:text-sm text-white font-semibold focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              {dashaTree.map((md, idx) => {
                const isNow = md.startDate <= todayIso && md.endDate >= todayIso;
                return (
                  <option key={`${md.cleanMdLord}-${idx}`} value={idx}>
                    {md.cleanMdLord} MD ({md.startDate} to {md.endDate}){isNow ? ' ★ Active' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Antardasha (AD) Picker */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3">
            <label className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-cyan-400" />
                <span>Antardasha (AD) inside {evaluation.selectedMd.cleanMdLord}</span>
              </span>
              <span className="text-[10px] font-mono text-slate-500">{evaluation.selectedMd.antardashas.length} ADs</span>
            </label>
            <select
              value={evaluation.selectedAd.index - 1}
              onChange={(e) => {
                setSelectedAdIndex(Number(e.target.value));
                setFocusedPdIndex(null);
              }}
              className="w-full bg-slate-900 border border-slate-700 hover:border-cyan-500/50 rounded-lg px-3 py-2 text-xs sm:text-sm text-white font-semibold focus:outline-none focus:border-cyan-400 cursor-pointer"
            >
              {evaluation.selectedMd.antardashas.map((ad, idx) => {
                const isNow = ad.startDate <= todayIso && ad.endDate >= todayIso;
                return (
                  <option key={`${ad.cleanAdLord}-${idx}`} value={idx}>
                    {evaluation.selectedMd.cleanMdLord}–{ad.cleanAdLord} AD ({ad.startDate} to {ad.endDate}){isNow ? ' ★ Active' : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        {/* 6-Aspect Filter Pills */}
        <div className="flex flex-wrap items-center gap-2 pt-1">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mr-1">Life Aspects:</span>
          <button
            onClick={() => setAspectFilter('all')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              aspectFilter === 'all'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-600'
            }`}
          >
            All 6 Aspects
          </button>
          {NATAL_ASPECT_ORDER.map(id => (
            <button
              key={id}
              onClick={() => setAspectFilter(id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1.5 ${
                aspectFilter === id
                  ? 'bg-amber-500 text-slate-950 shadow'
                  : 'bg-slate-950 text-slate-300 border border-slate-800 hover:border-slate-600'
              }`}
            >
              {ASPECT_ICONS[id]}
              <span>{NATAL_ASPECT_SPECS[id].shortLabel}</span>
            </button>
          ))}
        </div>
      </div>

      {/* =================================================================== */}
      {/* SECTION 1: MD + AD SUMMARY & SAMBANDHA ACROSS ALL 6 ASPECTS         */}
      {/* =================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-400" />
              <span>
                {evaluation.selectedMd.cleanMdLord} Mahadasha &rarr; {evaluation.selectedAd.cleanAdLord} Antardasha Promise
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5 font-mono">
              MD: {evaluation.selectedMd.startDate} to {evaluation.selectedMd.endDate} &bull; AD: {evaluation.selectedAd.startDate} to {evaluation.selectedAd.endDate} ({evaluation.selectedAd.totalDays} days)
            </p>
          </div>
          <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${
            evaluation.mdAdSambandha.patternTone === 'Testing-6/8' || evaluation.mdAdSambandha.patternTone === 'Friction-2/12'
              ? 'bg-amber-500/15 text-amber-300 border-amber-500/40'
              : 'bg-emerald-500/15 text-emerald-300 border-emerald-500/40'
          }`}>
            MD–AD Axis: {evaluation.mdAdSambandha.patternLabel}
          </span>
        </div>

        {/* MD Lord, MD-AD Sambandha, AD Lord Cards */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          {/* MD Dossier */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-400">Mahadasha Lord (MD)</span>
              <span className="text-[11px] font-mono text-slate-400">{evaluation.mdSummary.functionalNature}</span>
            </div>
            <div className="text-sm font-extrabold text-white">
              {evaluation.mdSummary.planet} in {evaluation.mdSummary.signName} (L{evaluation.mdSummary.hLagna} / M{evaluation.mdSummary.hMoon})
            </div>
            <div className="text-xs text-slate-300 space-y-0.5">
              <div>
                Owns: <strong className="text-slate-100">{evaluation.mdSummary.ownedHousesL.length ? `L${evaluation.mdSummary.ownedHousesL.join(' & L')}` : 'Nodal Axis'}</strong>
                {' '}&bull; Dignity: <strong className="text-amber-300">{evaluation.mdSummary.dignity || 'Neutral'}{evaluation.mdSummary.hasNeechaBhanga ? ' (Neecha Bhanga)' : ''}{evaluation.mdSummary.isCombust ? ' (Combust)' : ''}{evaluation.mdSummary.isRetro ? ' [R]' : ''}</strong>
              </div>
              <div>
                D9 Navamsa: <strong className="text-sky-300">H{evaluation.mdSummary.d9House} {evaluation.mdSummary.d9Sign}</strong>
                {evaluation.mdSummary.isVargottama && <span className="ml-1 text-emerald-300 font-bold">(Vargottama)</span>}
                {' '}&bull; SAV Seat: <strong className="text-slate-100">{evaluation.mdSummary.savAtSeat}</strong>
                {evaluation.mdSummary.shadbalaStatus && <span> &bull; Shadbala: <strong className="text-emerald-300">{evaluation.mdSummary.shadbalaStatus}</strong></span>}
              </div>
            </div>
          </div>

          {/* MD-AD Sambandha Bridge */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-300">MD–AD Mutual Sambandha</span>
              <span className="text-[11px] font-mono text-slate-400">{evaluation.mdAdSambandha.friendshipLabel}</span>
            </div>
            <div className="text-sm font-bold text-white">
              {evaluation.mdSummary.planet} &harr; {evaluation.adSummary.planet} ({evaluation.mdAdSambandha.houseDistanceD1}th House Axis)
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              {evaluation.mdAdSambandha.mutualConnection}. {evaluation.adExecutiveSummary}
            </p>
          </div>

          {/* AD Dossier */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-400">Antardasha Lord (AD)</span>
              <span className="text-[11px] font-mono text-slate-400">{evaluation.adSummary.functionalNature}</span>
            </div>
            <div className="text-sm font-extrabold text-white">
              {evaluation.adSummary.planet} in {evaluation.adSummary.signName} (L{evaluation.adSummary.hLagna} / M{evaluation.adSummary.hMoon})
            </div>
            <div className="text-xs text-slate-300 space-y-0.5">
              <div>
                Owns: <strong className="text-slate-100">{evaluation.adSummary.ownedHousesL.length ? `L${evaluation.adSummary.ownedHousesL.join(' & L')}` : 'Nodal Axis'}</strong>
                {' '}&bull; Dignity: <strong className="text-cyan-300">{evaluation.adSummary.dignity || 'Neutral'}{evaluation.adSummary.hasNeechaBhanga ? ' (Neecha Bhanga)' : ''}{evaluation.adSummary.isCombust ? ' (Combust)' : ''}{evaluation.adSummary.isRetro ? ' [R]' : ''}</strong>
              </div>
              <div>
                D9 Navamsa: <strong className="text-sky-300">H{evaluation.adSummary.d9House} {evaluation.adSummary.d9Sign}</strong>
                {evaluation.adSummary.isVargottama && <span className="ml-1 text-emerald-300 font-bold">(Vargottama)</span>}
                {' '}&bull; SAV Seat: <strong className="text-slate-100">{evaluation.adSummary.savAtSeat}</strong>
                {evaluation.adSummary.shadbalaStatus && <span> &bull; Shadbala: <strong className="text-emerald-300">{evaluation.adSummary.shadbalaStatus}</strong></span>}
              </div>
            </div>
          </div>
        </div>

        {/* AD Summary Grid Across All 6 Aspects */}
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2.5">
            Antardasha Summary Across All {visibleAspectIds.length} Life Aspect{visibleAspectIds.length > 1 ? 's' : ''} (MD Baseline &rarr; AD Output)
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visibleAspectIds.map(id => {
              const adEval = evaluation.adAspects[id];
              const mdEval = evaluation.mdAspects[id];
              const baseEval = evaluation.baselineAspects[id];
              return (
                <div key={id} className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-2">
                  <div>
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <span className="flex items-center gap-1.5 text-sm font-bold text-white">
                        <span className="text-amber-400">{ASPECT_ICONS[id]}</span>
                        <span>{NATAL_ASPECT_SPECS[id].label}</span>
                      </span>
                      <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${toneBadgeClasses(adEval.tone)}`}>
                        {adEval.score}% &bull; {adEval.tone}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-amber-200 mb-1">{adEval.verdict}</div>
                    <p className="text-xs text-slate-300 leading-relaxed">{adEval.rationale}</p>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-mono text-slate-400 border-t border-slate-800/80 pt-2">
                    <span>Natal Base: {baseEval.score}%</span>
                    <span>{evaluation.selectedMd.cleanMdLord} MD: {mdEval.score}%</span>
                    <span className="text-cyan-300">{evaluation.selectedAd.cleanAdLord} AD: {adEval.score}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* SECTION 2: ALL 9 PRATYANTARDASHAS (PD 1-9) SEQUENTIAL WALKTHROUGH   */}
      {/* =================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-base font-bold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-cyan-400" />
              <span>
                All {evaluation.pdWalkthrough.length} Pratyantardashas (PD) Sequential Walkthrough — {evaluation.selectedMd.cleanMdLord}–{evaluation.selectedAd.cleanAdLord}
              </span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              Chronological step-by-step natal progression showing how each PD steers Career, Finance, Love, Family, Health, and Litigations.
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-0.5 rounded-lg text-xs">
            <button
              onClick={() => setPdDisplayMode('cards')}
              className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                pdDisplayMode === 'cards' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Sequential Cards
            </button>
            <button
              onClick={() => setPdDisplayMode('matrix')}
              className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                pdDisplayMode === 'matrix' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              6-Aspect Matrix
            </button>
          </div>
        </div>

        {/* Clickable PD Stepper Ribbon */}
        <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2">
          {evaluation.pdWalkthrough.map(item => {
            const isNow = item.pdOption.startDate <= todayIso && item.pdOption.endDate >= todayIso;
            const isSelected = focusedPdIndex === item.pdOption.index;
            return (
              <button
                key={item.pdOption.index}
                onClick={() => setFocusedPdIndex(isSelected ? null : item.pdOption.index)}
                className={`text-left p-2 rounded-xl border transition cursor-pointer ${
                  isSelected
                    ? 'bg-amber-500/20 border-amber-400 ring-1 ring-amber-400/50'
                    : isNow
                    ? 'bg-emerald-500/10 border-emerald-500/40 hover:border-emerald-400'
                    : 'bg-slate-950/90 border-slate-800 hover:border-slate-600'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-mono text-slate-400">
                  <span>PD #{item.pdOption.index}</span>
                  <span className="font-bold text-slate-200">{item.overallScore}%</span>
                </div>
                <div className="text-xs font-extrabold text-white truncate mt-0.5">{item.pdSummary.planet}</div>
                <div className="text-[10px] font-mono text-slate-400 truncate">{item.pdOption.startDate}</div>
                <div className="text-[10px] font-mono text-slate-500">{item.pdOption.totalDays}d{isNow ? ' • NOW' : ''}</div>
              </button>
            );
          })}
        </div>

        {pdDisplayMode === 'matrix' ? (
          <div className="overflow-x-auto rounded-xl border border-slate-800">
            <table className="w-full text-xs text-left border-collapse">
              <thead className="bg-slate-950 text-slate-300 border-b border-slate-800">
                <tr>
                  <th className="px-3 py-2.5 font-bold">PD # / Lord</th>
                  <th className="px-3 py-2.5 font-bold whitespace-nowrap">Date Span</th>
                  <th className="px-3 py-2.5 font-bold">D1 / D9 &amp; Link</th>
                  {visibleAspectIds.map(id => (
                    <th key={id} className="px-3 py-2.5 font-bold whitespace-nowrap">{NATAL_ASPECT_SPECS[id].shortLabel}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-950/50">
                {evaluation.pdWalkthrough.map(item => {
                  const isNow = item.pdOption.startDate <= todayIso && item.pdOption.endDate >= todayIso;
                  return (
                    <tr key={item.pdOption.index} className={isNow ? 'bg-emerald-500/5' : 'hover:bg-slate-900/50'}>
                      <td className="px-3 py-2.5 font-bold text-white whitespace-nowrap">
                        #{item.pdOption.index} {item.pdSummary.planet}
                        <div className="text-[10px] font-mono text-slate-400">{item.pdOption.totalDays} days {isNow ? '• ACTIVE' : ''}</div>
                      </td>
                      <td className="px-3 py-2.5 font-mono text-slate-300 whitespace-nowrap">
                        <div>{item.pdOption.startDate}</div>
                        <div className="text-slate-500">to {item.pdOption.endDate}</div>
                      </td>
                      <td className="px-3 py-2.5 text-slate-300 min-w-[200px]">
                        <div>L{item.pdSummary.hLagna}/M{item.pdSummary.hMoon} ({item.pdSummary.dignity || 'Neutral'}), D9 H{item.pdSummary.d9House}</div>
                        <div className="text-[11px] text-slate-400">AD Link: {item.linkToAd.patternLabel}</div>
                      </td>
                      {visibleAspectIds.map(id => {
                        const ev = item.aspectEvaluations[id];
                        return (
                          <td key={id} className="px-3 py-2.5 align-top min-w-[140px]">
                            <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] font-bold border mb-1 ${toneBadgeClasses(ev.tone)}`}>
                              {ev.score}% {ev.tone}
                            </span>
                            <div className="text-[11px] text-slate-300 leading-snug">{ev.verdict}</div>
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="space-y-3">
            {evaluation.pdWalkthrough
              .filter(item => focusedPdIndex === null || item.pdOption.index === focusedPdIndex)
              .map(item => {
                const isNow = item.pdOption.startDate <= todayIso && item.pdOption.endDate >= todayIso;
                const p = item.pdSummary;
                return (
                  <div
                    key={item.pdOption.index}
                    className={`bg-slate-950/85 border rounded-xl p-4 space-y-3 ${
                      isNow ? 'border-emerald-500/45' : 'border-slate-800'
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2 border-b border-slate-800/80 pb-2.5">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 text-xs font-mono font-bold">
                            PD #{item.pdOption.index}
                          </span>
                          <span className="text-sm sm:text-base font-extrabold text-white">
                            {p.planet} Pratyantardasha
                          </span>
                          <span className="text-xs font-mono text-slate-400">
                            {item.pdOption.startDate} &rarr; {item.pdOption.endDate} ({item.pdOption.totalDays} days)
                          </span>
                          {isNow && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40">
                              Active Now
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-300 mt-1 leading-relaxed">{item.headlineSummary}</p>
                      </div>
                      <span className={`px-2.5 py-1 rounded-lg text-xs font-bold border ${pdOverallBadgeClasses(item.overallTone)}`}>
                        {item.overallScore}% &bull; {item.overallTone}
                      </span>
                    </div>

                    {/* PD D1/D9/Varga + Sambandha Bar */}
                    <div className="flex flex-wrap gap-2 text-[11px] text-slate-300">
                      <span className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800">
                        D1 Seat: <strong className="text-white">L{p.hLagna}/M{p.hMoon} {p.signName}</strong> ({p.dignity || 'Neutral'}{p.hasNeechaBhanga ? '+NB' : ''}{p.isCombust ? ', Combust' : ''})
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800">
                        Link to AD ({evaluation.adSummary.planet}): <strong className="text-cyan-300">{item.linkToAd.patternLabel}</strong>
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800">
                        Link to MD ({evaluation.mdSummary.planet}): <strong className="text-amber-300">{item.linkToMd.patternLabel}</strong>
                      </span>
                      <span className="px-2 py-1 rounded-lg bg-slate-900 border border-slate-800">
                        Vargas: <strong className="text-slate-100">{item.vargaHighlights.slice(0, 4).join(' • ')}</strong>
                      </span>
                    </div>

                    {item.pdOption.savedNote && (
                      <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg px-3 py-2 text-xs text-amber-200">
                        <strong>Recorded PD Note{item.pdOption.savedRating !== null ? ` (Rating ${item.pdOption.savedRating}/10)` : ''}:</strong>{' '}
                        {item.pdOption.savedNote}
                      </div>
                    )}

                    {/* 6 Aspects inside this PD */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                      {visibleAspectIds.map(id => {
                        const ev = item.aspectEvaluations[id];
                        return (
                          <div key={id} className="bg-slate-900/70 border border-slate-800/80 rounded-lg p-2.5">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                                <span className="text-amber-400">{ASPECT_ICONS[id]}</span>
                                <span>{NATAL_ASPECT_SPECS[id].shortLabel}</span>
                              </span>
                              <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold border ${toneBadgeClasses(ev.tone)}`}>
                                {ev.score}% {ev.tone}
                              </span>
                            </div>
                            <div className="text-[11px] font-semibold text-slate-200">{ev.verdict}</div>
                            <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{ev.rationale}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* SECTION 3: INHERENT NATAL BASELINE & ALL DIVISIONAL VARGAS (COLLAPSIBLE) */}
      {/* =================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl">
        <button
          onClick={() => setShowBaselineSection(!showBaselineSection)}
          className="w-full p-4 flex items-center justify-between gap-3 text-left hover:bg-slate-800/40 transition cursor-pointer"
        >
          <div className="flex items-center gap-2.5">
            <ShieldAlert className="w-4 h-4 text-amber-400" />
            <div>
              <div className="text-sm font-bold text-white">
                Fixed Natal Baseline Promise (6 Aspects) &amp; Divisional Vargas (D2–D30)
              </div>
              <div className="text-xs text-slate-400">
                Inspect {evaluation.personId}&apos;s permanent D1/D9/Vargas, SAV (337), Yogas/Doshas &amp; Jaimini 7-Karaka backbone
              </div>
            </div>
          </div>
          {showBaselineSection ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
        </button>

        {showBaselineSection && (
          <div className="p-4 pt-0 space-y-4 border-t border-slate-800/80">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3 pt-4">
              {visibleAspectIds.map(id => {
                const base = evaluation.baselineAspects[id];
                return (
                  <div key={id} className="bg-slate-950 border border-slate-800 rounded-xl p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 text-xs font-bold text-white">
                        <span className="text-amber-400">{ASPECT_ICONS[id]}</span>
                        <span>{base.label}</span>
                      </span>
                      <span className="text-xs font-mono font-bold text-amber-300">{base.score}% &bull; {base.band}</span>
                    </div>
                    <div className="text-xs font-semibold text-slate-200">{base.verdict}</div>
                    <div className="text-[11px] text-slate-400">{base.focusHousesSummary}</div>
                    <div className="text-[11px] text-sky-300/90 font-mono">{base.vargaSummary}</div>
                    {base.keyFactors.length > 0 && (
                      <div className="text-[11px] text-slate-400 pt-1 border-t border-slate-800/70">
                        {base.keyFactors.join(' • ')}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Divisional Varga Browser */}
            <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                  Divisional Varga Charts ({Object.keys(evaluation.vargas).length} Charts Loaded)
                </span>
                <div className="flex flex-wrap gap-1">
                  {['D2', 'D3', 'D4', 'D6', 'D7', 'D8', 'D10', 'D11', 'D12', 'D16', 'D27', 'D30']
                    .filter(code => Boolean(evaluation.vargas[code]))
                    .map(code => (
                      <button
                        key={code}
                        onClick={() => setActiveVargaTab(code)}
                        className={`px-2 py-1 rounded text-[11px] font-mono font-bold cursor-pointer transition ${
                          activeVargaTab === code
                            ? 'bg-amber-500 text-slate-950'
                            : 'bg-slate-900 text-slate-300 border border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        {code}
                      </button>
                    ))}
                </div>
              </div>

              {evaluation.vargas[activeVargaTab] && (
                <div>
                  <div className="text-xs text-amber-300 font-semibold mb-2">
                    {evaluation.vargas[activeVargaTab].code} ({evaluation.vargas[activeVargaTab].name}) &mdash; Lagna: {evaluation.vargas[activeVargaTab].lagnaSign} {evaluation.vargas[activeVargaTab].lagnaDeg}
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                    {evaluation.vargas[activeVargaTab].houses.map(h => (
                      <div key={h.house} className="bg-slate-900/80 border border-slate-800 rounded-lg p-2 text-xs">
                        <div className="flex items-center justify-between text-[11px] font-mono text-slate-400">
                          <span className="font-bold text-amber-300">H{h.house}</span>
                          <span>{h.sign}</span>
                        </div>
                        <div className="mt-1 text-slate-200 font-medium">
                          {h.planets.length > 0 ? h.planets.map(p => cleanNatalPlanetName(p)).join(', ') : <span className="text-slate-600">&mdash;</span>}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* =================================================================== */}
      {/* SECTION 4: ASK A QUESTION ON THIS DASHA + MASTER PROMPT & AI ANSWER */}
      {/* =================================================================== */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-purple-500/15 border border-purple-500/35 flex items-center justify-center text-purple-300">
              <MessageSquare className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Ask a Question on {evaluation.selectedMd.cleanMdLord} Dasha ({evaluation.selectedAd.cleanAdLord} AD)
              </h3>
              <p className="text-xs text-slate-400">
                Uses the transit-free Original Heartbeat Natal Master Prompt ({masterPrompt.sectionSummary.length} complete natal sections, {masterPrompt.approxTokens.toLocaleString()} est. tokens).
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowPromptInspector(!showPromptInspector)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-950 border border-slate-700 hover:border-amber-500/50 text-slate-200 flex items-center gap-1.5 cursor-pointer"
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>{showPromptInspector ? 'Hide Master Prompt' : 'Inspect Heartbeat Prompt'}</span>
            </button>
          </div>
        </div>

        {/* Question Input + AI Provider + Submit */}
        <div className="space-y-2.5">
          <div className="flex flex-col lg:flex-row gap-2.5">
            <input
              type="text"
              value={focusQuestion}
              onChange={(e) => setFocusQuestion(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isSynthesizingAi) handleRunAiQuestion();
              }}
              placeholder={`Ask about ${evaluation.selectedMd.cleanMdLord} MD / ${evaluation.selectedAd.cleanAdLord} AD (e.g., "Do I get married over Surya dasha?" or leave blank for full 6-aspect AD+PD walkthrough)...`}
              className="flex-1 bg-slate-950 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none"
            />
            <select
              value={selectedProvider}
              onChange={(e) => {
                const next = e.target.value as LLMProviderId;
                setSelectedProvider(next);
                try {
                  localStorage.setItem('astro_llm_provider', next);
                } catch {}
              }}
              className="bg-slate-950 border border-slate-700 rounded-xl px-3 py-2.5 text-xs font-bold text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
            >
              <option value="gemini_pro">{LLM_PROVIDERS.gemini_pro.name}</option>
              <option value="claude_sonnet">{LLM_PROVIDERS.claude_sonnet.name}</option>
              <option value="claude_haiku">{LLM_PROVIDERS.claude_haiku.name}</option>
              <option value="claude_fable">{LLM_PROVIDERS.claude_fable.name}</option>
              <option value="local_qwen">{LLM_PROVIDERS.local_qwen.name}</option>
            </select>
            <button
              onClick={() => handleRunAiQuestion()}
              disabled={isSynthesizingAi}
              className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 transition cursor-pointer shrink-0 shadow"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isSynthesizingAi ? 'Synthesizing...' : 'Ask & Synthesize'}</span>
            </button>
          </div>

          {/* Quick Suggested Question Pills */}
          <div className="flex flex-wrap gap-1.5">
            {curatedQuestions.map((q, idx) => (
              <button
                key={idx}
                onClick={() => handleRunAiQuestion(q)}
                disabled={isSynthesizingAi}
                className="text-left px-2.5 py-1 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 hover:text-amber-300 transition cursor-pointer"
              >
                {q}
              </button>
            ))}
          </div>
        </div>

        {/* Master Prompt Inspector */}
        {showPromptInspector && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2 text-xs">
                <span className="font-bold text-amber-300">Transit-Free Original Heartbeat Master Prompt</span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-[10px]">
                  {masterPrompt.zeroTransitsVerified ? 'ZERO TRANSITS VERIFIED' : 'NATAL ONLY'}
                </span>
                <span className="text-slate-400 font-mono text-[11px]">
                  {masterPrompt.charCount.toLocaleString()} chars &bull; ~{masterPrompt.approxTokens.toLocaleString()} tokens
                </span>
              </div>
              <button
                onClick={handleCopyPrompt}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
              >
                {copiedPrompt ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedPrompt ? 'Copied' : 'Copy Full Prompt'}</span>
              </button>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {masterPrompt.sectionSummary.map((sec, idx) => (
                <span key={idx} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300">
                  {sec.tag} ({sec.lines}L)
                </span>
              ))}
            </div>

            <pre className="max-h-72 overflow-auto p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
              {`${masterPrompt.systemInstruction}\n\n${masterPrompt.prompt}`}
            </pre>
          </div>
        )}

        {/* AI Response Area */}
        {aiResult && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2">
              <div className="flex items-center gap-2 text-xs">
                <span className="font-bold text-amber-300">
                  {aiResult.success ? 'AI Natal Dasha Synthesis' : 'AI Request Issue'}
                </span>
                <span className="text-slate-400 font-mono">
                  Model: {aiResult.modelUsed} &bull; {(aiResult.executionTimeMs / 1000).toFixed(2)}s
                </span>
              </div>
              {aiResult.tokenTelemetry && (
                <span className="text-[11px] font-mono text-slate-400">
                  Tokens: {aiResult.tokenTelemetry.inputTokens.toLocaleString()} in / {aiResult.tokenTelemetry.outputTokens.toLocaleString()} out
                </span>
              )}
            </div>

            {aiResult.success ? (
              renderSimpleMarkdown(aiResult.answerMarkdown)
            ) : (
              <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold">Synthesis Error</div>
                  <div className="mt-0.5">{aiResult.error}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};
