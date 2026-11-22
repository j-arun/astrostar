import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Activity,
  AlertCircle,
  ArrowDown,
  BookOpen,
  Briefcase,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Coins,
  Copy,
  Download,
  Eye,
  Heart,
  Home,
  Layers,
  Loader2,
  MessageSquare,
  Play,
  Scale,
  Send,
  ShieldAlert,
  Sparkles,
  Square,
  User
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
  NatalDashaLevelScope,
  NatalDashaPromptResult,
  buildNatalDashaFollowUpPrompt,
  buildNatalDashaMasterPrompt,
  runNatalDashaAISynthesis
} from '../services/natalDashaPromptBuilder';

type ReportLevelKey = 'md' | 'ad' | `pd-${number}`;
type DualProviderId = 'gemini_pro' | 'claude_fable';
type DualViewFilter = 'both' | 'scores_only' | 'reports_only';

interface FollowUpTurn {
  id: string;
  question: string;
  result: NatalDashaAiSynthesisResult;
  createdAt: string;
}

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
  const [viewDisplayMode, setViewDisplayMode] = useState<DualViewFilter>('both');
  const [activeReportLevel, setActiveReportLevel] = useState<ReportLevelKey>('ad');
  const [activeProviderTab, setActiveProviderTab] = useState<DualProviderId>('gemini_pro');
  const [reportsBySlot, setReportsBySlot] = useState<
    Record<string, Partial<Record<DualProviderId, NatalDashaAiSynthesisResult>>>
  >({});
  const [loadingBySlot, setLoadingBySlot] = useState<
    Record<string, Partial<Record<DualProviderId, boolean>>>
  >({});
  const [followUpsBySlot, setFollowUpsBySlot] = useState<
    Record<string, Partial<Record<DualProviderId, FollowUpTurn[]>>>
  >({});
  const [followUpLoadingBySlot, setFollowUpLoadingBySlot] = useState<
    Record<string, Partial<Record<DualProviderId, boolean>>>
  >({});
  const [followUpDrafts, setFollowUpDrafts] = useState<Record<string, string>>({});
  const [compareWithCompanion, setCompareWithCompanion] = useState<boolean>(true);
  const [extraProviderResult, setExtraProviderResult] = useState<NatalDashaAiSynthesisResult | null>(null);
  const [extraProvider, setExtraProvider] = useState<LLMProviderId>(() => {
    try {
      const saved = localStorage.getItem('astro_llm_provider') as LLMProviderId | null;
      return saved && LLM_PROVIDERS[saved] ? saved : defaultProvider;
    } catch {
      return defaultProvider;
    }
  });
  const [isRunningExtraProvider, setIsRunningExtraProvider] = useState<boolean>(false);

  const [inspectedPrompt, setInspectedPrompt] = useState<{
    levelKey: ReportLevelKey;
    promptResult: NatalDashaPromptResult;
  } | null>(null);
  const [expandedPromptByProvider, setExpandedPromptByProvider] = useState<
    Partial<Record<DualProviderId, boolean>>
  >({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [batchProgress, setBatchProgress] = useState<{
    active: boolean;
    currentLabel: string;
    completed: number;
    total: number;
  } | null>(null);
  const batchCancelRef = useRef<boolean>(false);
  const reportsSectionRef = useRef<HTMLDivElement | null>(null);

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
    setExtraProviderResult(null);
    setFocusedPdIndex(null);
    setInspectedPrompt(null);

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

  const rawPlacementsResolved = useMemo(() => {
    return bundle?.placements || ((storedPersonsData as Record<string, any>)[selectedPersonId]?.placements ?? []);
  }, [bundle, selectedPersonId]);

  const makeSlotKey = (levelKey: ReportLevelKey): string => {
    const mdIdx = evaluation.selectedMd.index;
    const adIdx = evaluation.selectedAd.index;
    if (levelKey === 'md') {
      return `${evaluation.personId}|md-${mdIdx}`;
    }
    return `${evaluation.personId}|md-${mdIdx}|ad-${adIdx}|${levelKey}`;
  };

  const buildPromptForLevel = (levelKey: ReportLevelKey, overrideQuestion?: string): NatalDashaPromptResult => {
    let scope: NatalDashaLevelScope = 'ad';
    let pdIndex: number | undefined;
    if (levelKey === 'md') {
      scope = 'md';
    } else if (levelKey === 'ad') {
      scope = 'ad';
    } else if (levelKey.startsWith('pd-')) {
      scope = 'pd';
      pdIndex = Number(levelKey.slice(3)) || 1;
    }

    return buildNatalDashaMasterPrompt({
      evaluation,
      rawPlacements: rawPlacementsResolved,
      focusQuestion: overrideQuestion !== undefined ? overrideQuestion : focusQuestion,
      aspectFilter,
      scope,
      pdIndex
    });
  };

  // Active prompt for the currently selected tab in Delivered Reports section
  const activeLevelPrompt = useMemo(() => {
    return buildPromptForLevel(activeReportLevel);
  }, [evaluation, rawPlacementsResolved, focusQuestion, aspectFilter, activeReportLevel]);

  const visibleAspectIds = aspectFilter === 'all' ? NATAL_ASPECT_ORDER : [aspectFilter];
  const todayIso = useMemo(() => new Date().toISOString().slice(0, 10), []);

  const curatedQuestions = [
    `Do I get married or form a lasting partnership during ${evaluation.selectedMd.cleanMdLord} MD (${evaluation.selectedAd.cleanAdLord} AD)?`,
    `Will I face litigation, court disputes, or legal setbacks in ${evaluation.selectedMd.cleanMdLord} MD > ${evaluation.selectedAd.cleanAdLord} AD?`,
    `What career rise, job shift, or authority changes are promised in ${evaluation.selectedMd.cleanMdLord} MD > ${evaluation.selectedAd.cleanAdLord} AD?`,
    `What wealth accumulation, property, or debt outcomes unfold during this period?`,
    `Which health vulnerabilities or recovery markers appear here?`
  ];

  const relativeImpactFollowUpQuestions = [
    'Rank all 6 life aspects (Career, Finance, Love, Family, Health, Litigations) by relative impact magnitude in your prediction.',
    'Compare the net upside vs downside friction in your prediction — which force dominates and by what margin?',
    'Which specific D1, D9, or Divisional Varga placement is driving the strongest relative impact here?',
    'How does the impact of this window compare relative to adjacent Dasha sub-periods?'
  ];

  const resolveScopeParams = (levelKey: ReportLevelKey): { scope: NatalDashaLevelScope; pdIndex?: number } => {
    if (levelKey === 'md') return { scope: 'md' };
    if (levelKey === 'ad') return { scope: 'ad' };
    if (levelKey.startsWith('pd-')) {
      return { scope: 'pd', pdIndex: Number(levelKey.slice(3)) || 1 };
    }
    return { scope: 'ad' };
  };

  const scrollToDeliveredReports = () => {
    if (viewDisplayMode === 'scores_only') {
      setViewDisplayMode('both');
    }
    setTimeout(() => {
      reportsSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 60);
  };

  const handleInspectLevelPrompt = (levelKey: ReportLevelKey) => {
    const promptResult = buildPromptForLevel(levelKey);
    setActiveReportLevel(levelKey);
    setInspectedPrompt({ levelKey, promptResult });
    scrollToDeliveredReports();
  };

  const handleAskDashaLevel = async (
    levelKey: ReportLevelKey,
    providers: DualProviderId[],
    options?: { overrideQuestion?: string; skipScroll?: boolean }
  ) => {
    const slotKey = makeSlotKey(levelKey);
    const qToAsk = options?.overrideQuestion !== undefined ? options.overrideQuestion : focusQuestion;
    if (options?.overrideQuestion !== undefined) {
      setFocusQuestion(options.overrideQuestion);
    }

    const promptResult = buildPromptForLevel(levelKey, qToAsk);
    setActiveReportLevel(levelKey);
    if (providers.length === 1) {
      setActiveProviderTab(providers[0]);
    }
    setExtraProviderResult(null);

    if (!options?.skipScroll) {
      scrollToDeliveredReports();
    }

    setLoadingBySlot(prev => ({
      ...prev,
      [slotKey]: {
        ...(prev[slotKey] || {}),
        ...Object.fromEntries(providers.map(p => [p, true]))
      }
    }));

    await Promise.all(
      providers.map(async providerId => {
        const res = await runNatalDashaAISynthesis({
          providerId,
          prompt: promptResult.prompt,
          systemInstruction: promptResult.systemInstruction
        });
        setReportsBySlot(prev => ({
          ...prev,
          [slotKey]: {
            ...(prev[slotKey] || {}),
            [providerId]: res
          }
        }));
        setLoadingBySlot(prev => ({
          ...prev,
          [slotKey]: {
            ...(prev[slotKey] || {}),
            [providerId]: false
          }
        }));
      })
    );
  };

  const buildFollowUpPromptForProvider = (
    levelKey: ReportLevelKey,
    providerId: DualProviderId,
    questionText: string
  ): NatalDashaPromptResult | null => {
    const slotKey = makeSlotKey(levelKey);
    const slotReports = reportsBySlot[slotKey] || {};
    const targetReport = slotReports[providerId];
    if (!targetReport?.success) return null;

    const otherProvider: DualProviderId = providerId === 'gemini_pro' ? 'claude_fable' : 'gemini_pro';
    const otherReport = slotReports[otherProvider];
    const priorFollowUps = (followUpsBySlot[slotKey]?.[providerId] || [])
      .filter(t => t.result.success)
      .map(t => ({ question: t.question, answerMarkdown: t.result.answerMarkdown }));

    const { scope, pdIndex } = resolveScopeParams(levelKey);

    return buildNatalDashaFollowUpPrompt({
      evaluation,
      rawPlacements: rawPlacementsResolved,
      followUpQuestion: questionText,
      aspectFilter,
      scope,
      pdIndex,
      followUpContext: {
        targetProviderLabel: providerId === 'gemini_pro' ? 'Google Gemini Pro' : 'Claude Fable 5.1 (Phabble)',
        priorPredictionMarkdown: targetReport.answerMarkdown,
        alternatePrediction:
          compareWithCompanion && otherReport?.success
            ? {
                providerLabel: otherProvider === 'gemini_pro' ? 'Google Gemini Pro' : 'Claude Fable 5.1 (Phabble)',
                markdown: otherReport.answerMarkdown
              }
            : undefined,
        priorFollowUps
      }
    });
  };

  const handleAskFollowUp = async (
    levelKey: ReportLevelKey,
    providers: DualProviderId[],
    questionText: string,
    draftKeyToClear?: string
  ) => {
    const cleanQ = questionText.trim();
    if (!cleanQ) return;

    const slotKey = makeSlotKey(levelKey);
    const eligibleProviders = providers.filter(p => Boolean(reportsBySlot[slotKey]?.[p]?.success));
    if (eligibleProviders.length === 0) return;

    if (draftKeyToClear) {
      setFollowUpDrafts(prev => ({ ...prev, [draftKeyToClear]: '' }));
    }

    setFollowUpLoadingBySlot(prev => ({
      ...prev,
      [slotKey]: {
        ...(prev[slotKey] || {}),
        ...Object.fromEntries(eligibleProviders.map(p => [p, true]))
      }
    }));

    await Promise.all(
      eligibleProviders.map(async providerId => {
        const followUpPrompt = buildFollowUpPromptForProvider(levelKey, providerId, cleanQ);
        if (!followUpPrompt) {
          setFollowUpLoadingBySlot(prev => ({
            ...prev,
            [slotKey]: { ...(prev[slotKey] || {}), [providerId]: false }
          }));
          return;
        }

        const res = await runNatalDashaAISynthesis({
          providerId,
          prompt: followUpPrompt.prompt,
          systemInstruction: followUpPrompt.systemInstruction
        });

        const turn: FollowUpTurn = {
          id: `${Date.now()}-${providerId}-${Math.random().toString(36).slice(2, 6)}`,
          question: cleanQ,
          result: res,
          createdAt: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        };

        setFollowUpsBySlot(prev => ({
          ...prev,
          [slotKey]: {
            ...(prev[slotKey] || {}),
            [providerId]: [...(prev[slotKey]?.[providerId] || []), turn]
          }
        }));
        setFollowUpLoadingBySlot(prev => ({
          ...prev,
          [slotKey]: { ...(prev[slotKey] || {}), [providerId]: false }
        }));
      })
    );
  };

  const handleInspectFollowUpPrompt = (
    levelKey: ReportLevelKey,
    providerId: DualProviderId,
    questionText: string
  ) => {
    const q = questionText.trim() || relativeImpactFollowUpQuestions[0];
    const promptResult = buildFollowUpPromptForProvider(levelKey, providerId, q);
    if (!promptResult) return;
    setInspectedPrompt({ levelKey, promptResult });
  };

  const handleRunAllLevelsBatch = async () => {
    const levels: Array<{ key: ReportLevelKey; label: string }> = [
      { key: 'md', label: `${evaluation.selectedMd.cleanMdLord} MD` },
      { key: 'ad', label: `${evaluation.selectedMd.cleanMdLord}–${evaluation.selectedAd.cleanAdLord} AD` },
      ...evaluation.pdWalkthrough.map(item => ({
        key: `pd-${item.pdOption.index}` as ReportLevelKey,
        label: `PD #${item.pdOption.index} (${item.pdSummary.planet})`
      }))
    ];

    batchCancelRef.current = false;
    const totalCalls = levels.length * 2;
    let completed = 0;
    setBatchProgress({
      active: true,
      currentLabel: `Starting ${levels[0].label} (Gemini + Fable)...`,
      completed: 0,
      total: totalCalls
    });
    scrollToDeliveredReports();

    for (const lvl of levels) {
      if (batchCancelRef.current) break;
      setActiveReportLevel(lvl.key);
      setBatchProgress({
        active: true,
        currentLabel: `${lvl.label} — Gemini Pro & Claude Fable 5.1`,
        completed,
        total: totalCalls
      });
      await handleAskDashaLevel(lvl.key, ['gemini_pro', 'claude_fable'], { skipScroll: true });
      completed += 2;
    }

    setBatchProgress(null);
  };

  const handleStopBatch = () => {
    batchCancelRef.current = true;
    setBatchProgress(prev => (prev ? { ...prev, currentLabel: 'Stopping after current level...' } : null));
  };

  const handleRunExtraProvider = async () => {
    setIsRunningExtraProvider(true);
    setExtraProviderResult(null);
    scrollToDeliveredReports();
    const res = await runNatalDashaAISynthesis({
      providerId: extraProvider,
      prompt: activeLevelPrompt.prompt,
      systemInstruction: activeLevelPrompt.systemInstruction
    });
    setExtraProviderResult(res);
    setIsRunningExtraProvider(false);
  };

  const handleCopyText = (key: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  const handleDownloadAllReportsMarkdown = () => {
    const levels: Array<{ key: ReportLevelKey; title: string }> = [
      {
        key: 'md',
        title: `Mahadasha: ${evaluation.selectedMd.cleanMdLord} (${evaluation.selectedMd.startDate} to ${evaluation.selectedMd.endDate})`
      },
      {
        key: 'ad',
        title: `Antardasha: ${evaluation.selectedMd.cleanMdLord}–${evaluation.selectedAd.cleanAdLord} (${evaluation.selectedAd.startDate} to ${evaluation.selectedAd.endDate})`
      },
      ...evaluation.pdWalkthrough.map(item => ({
        key: `pd-${item.pdOption.index}` as ReportLevelKey,
        title: `PD #${item.pdOption.index}: ${item.pdSummary.planet} (${item.pdOption.startDate} to ${item.pdOption.endDate}, ${item.pdOption.totalDays}d)`
      }))
    ];

    const blocks: string[] = [
      `# Natal Dasha–Bhukti AI Prediction Dossier — ${evaluation.personId}`,
      `- Lagna: ${evaluation.lagnaSign} | Rashi: ${evaluation.moonSign} | Star: ${evaluation.janmaStar}`,
      `- Scope: ${evaluation.selectedMd.cleanMdLord} MD > ${evaluation.selectedAd.cleanAdLord} AD`,
      `- Purely Natal (Zero Gochara Transits)`,
      ''
    ];

    let count = 0;
    for (const lvl of levels) {
      const slotKey = makeSlotKey(lvl.key);
      const slot = reportsBySlot[slotKey];
      const followUps = followUpsBySlot[slotKey];
      if (!slot) continue;
      if (slot.gemini_pro?.success || slot.claude_fable?.success) {
        blocks.push(`---\n## ${lvl.title}\n`);
      }
      if (slot.gemini_pro?.success) {
        count++;
        blocks.push(`### Google Gemini Pro (${slot.gemini_pro.modelUsed})\n\n${slot.gemini_pro.answerMarkdown}\n`);
        for (const t of followUps?.gemini_pro || []) {
          if (t.result.success) {
            blocks.push(`#### Follow-Up Question (Gemini): ${t.question}\n\n${t.result.answerMarkdown}\n`);
          }
        }
      }
      if (slot.claude_fable?.success) {
        count++;
        blocks.push(`### Claude Fable 5.1 (${slot.claude_fable.modelUsed})\n\n${slot.claude_fable.answerMarkdown}\n`);
        for (const t of followUps?.claude_fable || []) {
          if (t.result.success) {
            blocks.push(`#### Follow-Up Question (Fable): ${t.question}\n\n${t.result.answerMarkdown}\n`);
          }
        }
      }
    }

    if (count === 0) return;

    const blob = new Blob([blocks.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${evaluation.personId}_${evaluation.selectedMd.cleanMdLord}_${evaluation.selectedAd.cleanAdLord}_Natal_AI_Reports.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const renderAskCardFooter = (levelKey: ReportLevelKey, shortTitle: string) => {
    const slotKey = makeSlotKey(levelKey);
    const slotReports = reportsBySlot[slotKey] || {};
    const slotLoading = loadingBySlot[slotKey] || {};
    const hasGemini = Boolean(slotReports.gemini_pro?.success);
    const hasFable = Boolean(slotReports.claude_fable?.success);
    const isLoadingGemini = Boolean(slotLoading.gemini_pro);
    const isLoadingFable = Boolean(slotLoading.claude_fable);

    return (
      <div className="pt-2.5 mt-1 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="font-bold text-slate-400">Ask This {shortTitle}:</span>
          {hasGemini && (
            <button
              onClick={() => {
                setActiveReportLevel(levelKey);
                setActiveProviderTab('gemini_pro');
                scrollToDeliveredReports();
              }}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/35 font-semibold hover:bg-emerald-500/25 cursor-pointer"
              title="Jump to Gemini report tab below"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Gemini Ready</span>
            </button>
          )}
          {hasFable && (
            <button
              onClick={() => {
                setActiveReportLevel(levelKey);
                setActiveProviderTab('claude_fable');
                scrollToDeliveredReports();
              }}
              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-purple-500/15 text-purple-300 border border-purple-500/35 font-semibold hover:bg-purple-500/25 cursor-pointer"
              title="Jump to Claude Fable 5.1 report tab below"
            >
              <CheckCircle2 className="w-3 h-3" />
              <span>Fable Ready</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            onClick={() => handleAskDashaLevel(levelKey, ['gemini_pro'])}
            disabled={isLoadingGemini || Boolean(batchProgress?.active)}
            className="px-2.5 py-1 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
          >
            {isLoadingGemini ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            <span>{isLoadingGemini ? 'Gemini...' : 'Ask Gemini'}</span>
          </button>

          <button
            onClick={() => handleAskDashaLevel(levelKey, ['claude_fable'])}
            disabled={isLoadingFable || Boolean(batchProgress?.active)}
            className="px-2.5 py-1 rounded-lg bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-300 text-[11px] font-bold flex items-center gap-1 transition cursor-pointer disabled:opacity-50"
          >
            {isLoadingFable ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            <span>{isLoadingFable ? 'Fable...' : 'Ask Fable'}</span>
          </button>

          <button
            onClick={() => handleAskDashaLevel(levelKey, ['gemini_pro', 'claude_fable'])}
            disabled={isLoadingGemini || isLoadingFable || Boolean(batchProgress?.active)}
            className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 text-[11px] font-extrabold flex items-center gap-1 transition cursor-pointer disabled:opacity-50 shadow-sm"
          >
            <ArrowDown className="w-3 h-3" />
            <span>Both</span>
          </button>

          <button
            onClick={() => handleInspectLevelPrompt(levelKey)}
            className="px-2 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-300 text-[11px] font-semibold flex items-center gap-1 transition cursor-pointer"
            title="Inspect full Natal + Dasha prompt built for this level"
          >
            <Eye className="w-3 h-3 text-slate-400" />
            <span>Prompt</span>
          </button>
        </div>
      </div>
    );
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

        {/* 6-Aspect Filter Pills + Dual View Selector */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
          <div className="flex flex-wrap items-center gap-2">
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

          <div className="flex items-center gap-1 bg-slate-950 border border-slate-800 p-0.5 rounded-lg text-[11px]">
            <button
              onClick={() => setViewDisplayMode('both')}
              className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                viewDisplayMode === 'both' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Both Views (Scores + AI Reports)
            </button>
            <button
              onClick={() => setViewDisplayMode('scores_only')}
              className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                viewDisplayMode === 'scores_only' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              Deterministic Scores
            </button>
            <button
              onClick={() => setViewDisplayMode('reports_only')}
              className={`px-2.5 py-1 rounded-md font-bold transition cursor-pointer ${
                viewDisplayMode === 'reports_only' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              AI Reports View
            </button>
          </div>
        </div>
      </div>

      {/* =================================================================== */}
      {/* VIEW 1: DETERMINISTIC NATAL PROMISE SCORES (MD, AD & ALL 9 PDs)     */}
      {/* =================================================================== */}
      {viewDisplayMode !== 'reports_only' && (
        <>
          {/* SECTION 1: MD + AD SUMMARY & SAMBANDHA ACROSS ALL 6 ASPECTS */}
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
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl p-3.5 flex flex-col justify-between gap-2">
            <div className="space-y-1.5">
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
            {renderAskCardFooter('md', `${evaluation.selectedMd.cleanMdLord} MD`)}
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
          {renderAskCardFooter('ad', `${evaluation.selectedMd.cleanMdLord}–${evaluation.selectedAd.cleanAdLord} Antardasha`)}
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
                  <th className="px-3 py-2.5 font-bold whitespace-nowrap">Ask AI</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80 bg-slate-950/50">
                {evaluation.pdWalkthrough.map(item => {
                  const isNow = item.pdOption.startDate <= todayIso && item.pdOption.endDate >= todayIso;
                  const pdKey: ReportLevelKey = `pd-${item.pdOption.index}`;
                  const slot = reportsBySlot[makeSlotKey(pdKey)] || {};
                  const loadingSlot = loadingBySlot[makeSlotKey(pdKey)] || {};
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
                      <td className="px-3 py-2.5 align-top whitespace-nowrap">
                        <div className="flex flex-col gap-1">
                          <button
                            onClick={() => handleAskDashaLevel(pdKey, ['gemini_pro'])}
                            disabled={Boolean(loadingSlot.gemini_pro) || Boolean(batchProgress?.active)}
                            className="px-2 py-1 rounded bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 text-[10px] font-bold cursor-pointer disabled:opacity-50"
                          >
                            {loadingSlot.gemini_pro ? 'Gemini...' : slot.gemini_pro?.success ? 'Gemini ✓' : 'Gemini'}
                          </button>
                          <button
                            onClick={() => handleAskDashaLevel(pdKey, ['claude_fable'])}
                            disabled={Boolean(loadingSlot.claude_fable) || Boolean(batchProgress?.active)}
                            className="px-2 py-1 rounded bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/40 text-purple-300 text-[10px] font-bold cursor-pointer disabled:opacity-50"
                          >
                            {loadingSlot.claude_fable ? 'Fable...' : slot.claude_fable?.success ? 'Fable ✓' : 'Fable'}
                          </button>
                          <button
                            onClick={() => handleAskDashaLevel(pdKey, ['gemini_pro', 'claude_fable'])}
                            disabled={Boolean(loadingSlot.gemini_pro) || Boolean(loadingSlot.claude_fable) || Boolean(batchProgress?.active)}
                            className="px-2 py-1 rounded bg-amber-500 hover:bg-amber-400 text-slate-950 text-[10px] font-extrabold cursor-pointer disabled:opacity-50"
                          >
                            Both
                          </button>
                        </div>
                      </td>
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

                    {/* End of PD Card: Ask This PD -> Gemini / Fable / Both / Inspect Prompt */}
                    {renderAskCardFooter(
                      `pd-${item.pdOption.index}` as ReportLevelKey,
                      `PD #${item.pdOption.index} (${p.planet})`
                    )}
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
        </>
      )}

      {/* =================================================================== */}
      {/* VIEW 2: AI PREDICTION REPORTS DELIVERED (GEMINI PRO & CLAUDE FABLE) */}
      {/* Same Page Right Below Deterministic Scores                          */}
      {/* =================================================================== */}
      {viewDisplayMode !== 'scores_only' && (
        <div
          ref={reportsSectionRef}
          className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xl space-y-4"
        >
          {/* Header + Batch Runner + Export */}
          <div className="flex flex-wrap items-start justify-between gap-3 border-b border-slate-800/80 pb-4">
            <div className="flex items-start gap-2.5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/15 border border-purple-500/35 flex items-center justify-center text-purple-300 shrink-0">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-base sm:text-lg font-extrabold text-white">
                    AI Prediction Reports Delivered — Gemini Pro &amp; Claude Fable 5.1
                  </h3>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                    {activeLevelPrompt.zeroTransitsVerified ? 'ZERO TRANSITS VERIFIED' : 'NATAL ONLY'}
                  </span>
                </div>
                <p className="text-xs text-slate-400 mt-0.5">
                  Full natal charts ({activeLevelPrompt.sectionSummary.length} Heartbeat sections, ~{activeLevelPrompt.approxTokens.toLocaleString()} tokens) sent per Dasha level to <strong className="text-amber-300">Google Gemini Pro</strong> and <strong className="text-purple-300">Claude Fable 5.1 (Phabble)</strong>.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {batchProgress?.active ? (
                <button
                  onClick={handleStopBatch}
                  className="px-3 py-1.5 rounded-lg bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                >
                  <Square className="w-3.5 h-3.5" />
                  <span>Stop Batch ({batchProgress.completed}/{batchProgress.total})</span>
                </button>
              ) : (
                <button
                  onClick={handleRunAllLevelsBatch}
                  className="px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-amber-500 to-purple-500 hover:from-amber-400 hover:to-purple-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer shadow"
                >
                  <Play className="w-3.5 h-3.5" />
                  <span>Predict All Levels (MD + AD + 9 PDs)</span>
                </button>
              )}

              <button
                onClick={handleDownloadAllReportsMarkdown}
                className="px-3 py-1.5 rounded-lg bg-slate-950 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                title="Download all generated Gemini & Fable reports as Markdown"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Download .MD</span>
              </button>
            </div>
          </div>

          {batchProgress?.active && (
            <div className="bg-slate-950 border border-amber-500/35 rounded-xl p-3 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-amber-300 flex items-center gap-2">
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{batchProgress.currentLabel}</span>
                </span>
                <span className="font-mono text-slate-300">
                  {batchProgress.completed} / {batchProgress.total} reports
                </span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-amber-400 to-purple-400 transition-all duration-300"
                  style={{ width: `${Math.round((batchProgress.completed / batchProgress.total) * 100)}%` }}
                />
              </div>
            </div>
          )}

          {/* Optional Focus Question on Any Dasha Level */}
          <div className="bg-slate-950/75 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
            <div className="flex flex-col lg:flex-row gap-2.5">
              <input
                type="text"
                value={focusQuestion}
                onChange={(e) => setFocusQuestion(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !batchProgress?.active) {
                    handleAskDashaLevel(activeReportLevel, ['gemini_pro', 'claude_fable']);
                  }
                }}
                placeholder={`Optional question for ${activeLevelPrompt.scopeLabel} (e.g., "Do I get married over Surya dasha?" or leave blank for full 6-aspect report)...`}
                className="flex-1 bg-slate-900 border border-slate-700 focus:border-amber-400 rounded-xl px-3.5 py-2 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none"
              />

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  onClick={() => handleAskDashaLevel(activeReportLevel, ['gemini_pro'])}
                  disabled={Boolean(loadingBySlot[makeSlotKey(activeReportLevel)]?.gemini_pro) || Boolean(batchProgress?.active)}
                  className="px-3.5 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/45 text-amber-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ask Gemini</span>
                </button>
                <button
                  onClick={() => handleAskDashaLevel(activeReportLevel, ['claude_fable'])}
                  disabled={Boolean(loadingBySlot[makeSlotKey(activeReportLevel)]?.claude_fable) || Boolean(batchProgress?.active)}
                  className="px-3.5 py-2 rounded-xl bg-purple-500/15 hover:bg-purple-500/25 border border-purple-500/45 text-purple-300 font-bold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ask Fable (Phabble)</span>
                </button>
                <button
                  onClick={() => handleAskDashaLevel(activeReportLevel, ['gemini_pro', 'claude_fable'])}
                  disabled={
                    Boolean(loadingBySlot[makeSlotKey(activeReportLevel)]?.gemini_pro) ||
                    Boolean(loadingBySlot[makeSlotKey(activeReportLevel)]?.claude_fable) ||
                    Boolean(batchProgress?.active)
                  }
                  className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-extrabold text-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>Ask Both</span>
                </button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {curatedQuestions.map((q, idx) => (
                <button
                  key={idx}
                  onClick={() => handleAskDashaLevel(activeReportLevel, ['gemini_pro', 'claude_fable'], { overrideQuestion: q })}
                  disabled={Boolean(batchProgress?.active)}
                  className="text-left px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 hover:text-amber-300 transition cursor-pointer"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>

          {/* Dasha Level Selector Tabs: MD | AD | PD #1..#9 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-[11px] text-slate-400">
              <span className="font-bold uppercase tracking-wider">Select Dasha Level Report to View / Generate</span>
              <span className="font-mono text-amber-300">{activeLevelPrompt.scopeLabel}</span>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { key: 'md' as ReportLevelKey, label: `MD: ${evaluation.selectedMd.cleanMdLord}` },
                { key: 'ad' as ReportLevelKey, label: `AD: ${evaluation.selectedMd.cleanMdLord}–${evaluation.selectedAd.cleanAdLord}` },
                ...evaluation.pdWalkthrough.map(item => ({
                  key: `pd-${item.pdOption.index}` as ReportLevelKey,
                  label: `PD #${item.pdOption.index}: ${item.pdSummary.planet}`
                }))
              ].map(tab => {
                const slot = reportsBySlot[makeSlotKey(tab.key)] || {};
                const loading = loadingBySlot[makeSlotKey(tab.key)] || {};
                const isActive = activeReportLevel === tab.key;
                const gReady = Boolean(slot.gemini_pro?.success);
                const fReady = Boolean(slot.claude_fable?.success);
                const gErr = Boolean(slot.gemini_pro && !slot.gemini_pro.success);
                const fErr = Boolean(slot.claude_fable && !slot.claude_fable.success);

                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveReportLevel(tab.key)}
                    className={`px-2.5 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-2 transition cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 border-amber-400 shadow'
                        : 'bg-slate-950 text-slate-300 border-slate-800 hover:border-slate-600'
                    }`}
                  >
                    <span>{tab.label}</span>
                    <span className="flex items-center gap-1">
                      <span
                        title={gReady ? 'Gemini Ready' : gErr ? 'Gemini Error' : 'Gemini Not Run'}
                        className={`w-2 h-2 rounded-full ${
                          loading.gemini_pro
                            ? 'bg-amber-300 animate-ping'
                            : gReady
                            ? isActive
                              ? 'bg-emerald-900'
                              : 'bg-emerald-400'
                            : gErr
                            ? 'bg-rose-500'
                            : isActive
                            ? 'bg-slate-900/35'
                            : 'bg-slate-700'
                        }`}
                      />
                      <span
                        title={fReady ? 'Fable Ready' : fErr ? 'Fable Error' : 'Fable Not Run'}
                        className={`w-2 h-2 rounded-full ${
                          loading.claude_fable
                            ? 'bg-purple-300 animate-ping'
                            : fReady
                            ? isActive
                              ? 'bg-purple-950'
                              : 'bg-purple-400'
                            : fErr
                            ? 'bg-rose-500'
                            : isActive
                            ? 'bg-slate-900/35'
                            : 'bg-slate-700'
                        }`}
                      />
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Prompt Inspector Drawer (when clicking any card's "Prompt" button or toggle below) */}
          {inspectedPrompt && (
            <div className="bg-slate-950 border border-amber-500/40 rounded-xl p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="font-bold text-amber-300">
                    Inspected Prompt — {inspectedPrompt.promptResult.scopeLabel}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 font-mono text-[10px]">
                    {inspectedPrompt.promptResult.zeroTransitsVerified ? 'ZERO TRANSITS VERIFIED' : 'NATAL ONLY'}
                  </span>
                  <span className="text-slate-400 font-mono text-[11px]">
                    {inspectedPrompt.promptResult.charCount.toLocaleString()} chars &bull; ~{inspectedPrompt.promptResult.approxTokens.toLocaleString()} tokens
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      handleCopyText(
                        'inspected-prompt',
                        `${inspectedPrompt.promptResult.systemInstruction}\n\n${inspectedPrompt.promptResult.prompt}`
                      )
                    }
                    className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer"
                  >
                    {copiedKey === 'inspected-prompt' ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    <span>{copiedKey === 'inspected-prompt' ? 'Copied' : 'Copy Prompt'}</span>
                  </button>
                  <button
                    onClick={() => setInspectedPrompt(null)}
                    className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {inspectedPrompt.promptResult.sectionSummary.map((sec, idx) => (
                  <span key={idx} className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300">
                    {sec.tag} ({sec.lines}L)
                  </span>
                ))}
              </div>
              <pre className="max-h-72 overflow-auto p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                {`${inspectedPrompt.promptResult.systemInstruction}\n\n${inspectedPrompt.promptResult.prompt}`}
              </pre>
            </div>
          )}

          {/* Full-Width Provider Tabs: Google Gemini Pro | Claude Fable 5.1 (Phabble) */}
          {(() => {
            const slotKey = makeSlotKey(activeReportLevel);
            const activeSlotReports = reportsBySlot[slotKey] || {};
            const activeSlotLoading = loadingBySlot[slotKey] || {};

            const providerId = activeProviderTab;
            const report = activeSlotReports[providerId];
            const isLoading = Boolean(activeSlotLoading[providerId]);
            const isGemini = providerId === 'gemini_pro';
            const displayName = isGemini ? 'Google Gemini Pro' : 'Claude Fable 5.1 (Phabble)';
            const modelLabel = report?.modelUsed || LLM_PROVIDERS[providerId].model;
            const isPromptShown = Boolean(expandedPromptByProvider[providerId]);

            const companionProvider: DualProviderId = isGemini ? 'claude_fable' : 'gemini_pro';
            const hasCompanionReport = Boolean(activeSlotReports[companionProvider]?.success);

            const followUpTurns = followUpsBySlot[slotKey]?.[providerId] || [];
            const isFollowUpLoading = Boolean(followUpLoadingBySlot[slotKey]?.[providerId]);
            const isCompanionFollowUpLoading = Boolean(followUpLoadingBySlot[slotKey]?.[companionProvider]);
            const draftKey = `${slotKey}|${providerId}`;
            const draftVal = followUpDrafts[draftKey] || '';

            return (
              <div className="space-y-3">
                {/* Provider Tab Selector Strip */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {(['gemini_pro', 'claude_fable'] as DualProviderId[]).map(tabProvider => {
                    const tabReport = activeSlotReports[tabProvider];
                    const tabLoading = Boolean(activeSlotLoading[tabProvider]);
                    const tabFollowUps = followUpsBySlot[slotKey]?.[tabProvider] || [];
                    const isTabGemini = tabProvider === 'gemini_pro';
                    const isTabSelected = activeProviderTab === tabProvider;
                    const tabName = isTabGemini ? 'Google Gemini Pro' : 'Claude Fable 5.1 (Phabble)';

                    return (
                      <button
                        key={tabProvider}
                        onClick={() => setActiveProviderTab(tabProvider)}
                        className={`text-left px-4 py-3 rounded-xl border transition cursor-pointer flex items-center justify-between gap-3 ${
                          isTabSelected
                            ? isTabGemini
                              ? 'bg-amber-500/15 border-amber-400 ring-1 ring-amber-400/40 shadow-lg'
                              : 'bg-purple-500/15 border-purple-400 ring-1 ring-purple-400/40 shadow-lg'
                            : 'bg-slate-950 border-slate-800 hover:border-slate-600'
                        }`}
                      >
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span
                              className={`text-sm font-extrabold truncate ${
                                isTabGemini ? 'text-amber-300' : 'text-purple-300'
                              }`}
                            >
                              {tabName}
                            </span>
                            <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[10px] font-mono text-slate-300 shrink-0">
                              {tabReport?.modelUsed || LLM_PROVIDERS[tabProvider].model}
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-400 font-mono mt-0.5 truncate">
                            {tabLoading
                              ? 'Generating full natal report...'
                              : tabReport?.success
                              ? `Delivered in ${(tabReport.executionTimeMs / 1000).toFixed(2)}s${
                                  tabFollowUps.length > 0 ? ` • ${tabFollowUps.length} follow-up${tabFollowUps.length > 1 ? 's' : ''}` : ''
                                }`
                              : tabReport
                              ? 'Error — view details'
                              : 'Ready to generate'}
                          </div>
                        </div>

                        <div className="shrink-0">
                          {tabLoading ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold border border-amber-500/40">
                              <Loader2 className="w-3 h-3 animate-spin" />
                              <span>Running</span>
                            </span>
                          ) : tabReport?.success ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold border border-emerald-500/40">
                              <CheckCircle2 className="w-3 h-3" />
                              <span>Ready</span>
                            </span>
                          ) : tabReport ? (
                            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-rose-500/20 text-rose-300 text-[10px] font-bold border border-rose-500/40">
                              <AlertCircle className="w-3 h-3" />
                              <span>Issue</span>
                            </span>
                          ) : (
                            <span className="px-2 py-1 rounded-full bg-slate-900 text-slate-400 text-[10px] font-semibold border border-slate-800">
                              Not Run
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Full-Width Active Provider Report Card */}
                <div
                  className={`bg-slate-950 border rounded-xl p-4 sm:p-5 space-y-4 ${
                    isGemini ? 'border-amber-500/40' : 'border-purple-500/40'
                  }`}
                >
                  {/* Provider Header */}
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`text-base font-extrabold ${isGemini ? 'text-amber-300' : 'text-purple-300'}`}>
                          {displayName}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
                          {modelLabel}
                        </span>
                        <span className="px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-[11px] font-mono text-amber-200">
                          {activeLevelPrompt.scopeLabel}
                        </span>
                      </div>
                      <div className="text-[11px] text-slate-400 mt-1 font-mono">
                        {report
                          ? `Execution: ${(report.executionTimeMs / 1000).toFixed(2)}s${
                              report.tokenTelemetry
                                ? ` • Tokens: ${report.tokenTelemetry.inputTokens.toLocaleString()} in / ${report.tokenTelemetry.outputTokens.toLocaleString()} out`
                                : ''
                            }`
                          : 'Click Generate / Regenerate to run this level with full natal charts'}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {report?.success && (
                        <>
                          <button
                            onClick={() =>
                              handleCopyText(`${slotKey}-${providerId}`, report.answerMarkdown)
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-200 flex items-center gap-1.5 cursor-pointer"
                          >
                            {copiedKey === `${slotKey}-${providerId}` ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedKey === `${slotKey}-${providerId}` ? 'Copied' : 'Copy Report'}</span>
                          </button>
                          <button
                            onClick={() =>
                              setExpandedPromptByProvider(prev => ({
                                ...prev,
                                [providerId]: !prev[providerId]
                              }))
                            }
                            className="px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-xs font-bold text-slate-300 flex items-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 text-amber-400" />
                            <span>{isPromptShown ? 'Hide Prompt' : 'Prompt Sent'}</span>
                          </button>
                        </>
                      )}
                      <button
                        onClick={() => handleAskDashaLevel(activeReportLevel, [providerId], { skipScroll: true })}
                        disabled={isLoading || Boolean(batchProgress?.active)}
                        className={`px-3.5 py-1.5 rounded-lg text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow ${
                          isGemini
                            ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                            : 'bg-purple-500 hover:bg-purple-400 text-white'
                        }`}
                      >
                        {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                        <span>{isLoading ? 'Regenerating...' : report ? 'Regenerate Prediction' : 'Generate Prediction'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Full-Width Prediction Body */}
                  {isLoading ? (
                    <div className="py-12 flex flex-col items-center justify-center text-center gap-2.5 text-xs text-slate-300">
                      <Loader2 className={`w-7 h-7 animate-spin ${isGemini ? 'text-amber-400' : 'text-purple-400'}`} />
                      <div className="text-sm font-bold">Synthesizing {activeLevelPrompt.scopeLabel}</div>
                      <div className="text-slate-400 max-w-xl">
                        Sending full natal charts (D1, D9, Vargas D2–D60, SAV/BAV, Shadbala, Yogas, Jaimini) to {displayName}...
                      </div>
                    </div>
                  ) : report ? (
                    report.success ? (
                      <div className="space-y-6">
                        {isPromptShown && (
                          <pre className="max-h-72 overflow-auto p-3 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300 whitespace-pre-wrap leading-relaxed">
                            {`${report.systemInstruction}\n\n${report.promptSent}`}
                          </pre>
                        )}

                        <div className="w-full">
                          {renderSimpleMarkdown(report.answerMarkdown)}
                        </div>

                        {/* At the End of the Tab: Follow-Up Questions & Relative Impact */}
                        <div className="border-t border-slate-800 pt-5 space-y-4">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div>
                              <div className="text-sm font-extrabold text-emerald-300 flex items-center gap-2">
                                <MessageSquare className="w-4 h-4" />
                                <span>
                                  Ask Follow-Up on This {isGemini ? 'Gemini Pro' : 'Claude Fable 5.1'} Prediction (Relative Impact &amp; Clarifications)
                                </span>
                              </div>
                              <p className="text-xs text-slate-400 mt-0.5">
                                Answers are anchored to this delivered prediction + all natal charts so you can evaluate relative impact across aspects and houses.
                              </p>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {hasCompanionReport && (
                                <label className="flex items-center gap-2 text-[11px] text-slate-300 cursor-pointer select-none bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1">
                                  <input
                                    type="checkbox"
                                    checked={compareWithCompanion}
                                    onChange={(e) => setCompareWithCompanion(e.target.checked)}
                                    className="accent-amber-500 cursor-pointer"
                                  />
                                  <span>Include {isGemini ? 'Fable' : 'Gemini'} prediction context</span>
                                </label>
                              )}
                              <button
                                onClick={() => handleInspectFollowUpPrompt(activeReportLevel, providerId, draftVal)}
                                className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-700 text-[11px] font-bold text-slate-300 flex items-center gap-1 cursor-pointer"
                                title="Inspect prompt sent with prior prediction for follow-up"
                              >
                                <Eye className="w-3.5 h-3.5 text-amber-400" />
                                <span>Inspect Follow-Up Prompt</span>
                              </button>
                            </div>
                          </div>

                          {/* Delivered Follow-Up Answers Shown Right Here */}
                          {followUpTurns.length > 0 && (
                            <div className="space-y-3">
                              {followUpTurns.map((turn, tIdx) => (
                                <div
                                  key={turn.id}
                                  className="bg-slate-900/90 border border-slate-800 rounded-xl p-4 space-y-2.5"
                                >
                                  <div className="flex items-start justify-between gap-2 border-b border-slate-800/80 pb-2">
                                    <div className="text-xs sm:text-sm font-bold text-amber-200">
                                      Follow-Up Q{tIdx + 1}: {turn.question}
                                    </div>
                                    <span className="text-[11px] font-mono text-slate-500 shrink-0">
                                      {turn.createdAt}
                                    </span>
                                  </div>

                                  {turn.result.success ? (
                                    <div className="space-y-2">
                                      <div>{renderSimpleMarkdown(turn.result.answerMarkdown)}</div>
                                      <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 pt-2 border-t border-slate-800/60">
                                        <span>
                                          {turn.result.modelUsed} &bull; {(turn.result.executionTimeMs / 1000).toFixed(2)}s
                                          {turn.result.tokenTelemetry
                                            ? ` • ${turn.result.tokenTelemetry.inputTokens.toLocaleString()} in / ${turn.result.tokenTelemetry.outputTokens.toLocaleString()} out`
                                            : ''}
                                        </span>
                                        <button
                                          onClick={() => handleCopyText(`fu-${turn.id}`, turn.result.answerMarkdown)}
                                          className="text-slate-400 hover:text-white flex items-center gap-1 cursor-pointer"
                                        >
                                          {copiedKey === `fu-${turn.id}` ? (
                                            <Check className="w-3.5 h-3.5 text-emerald-400" />
                                          ) : (
                                            <Copy className="w-3.5 h-3.5" />
                                          )}
                                          <span>{copiedKey === `fu-${turn.id}` ? 'Copied' : 'Copy'}</span>
                                        </button>
                                      </div>
                                    </div>
                                  ) : (
                                    <div className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-2.5">
                                      Follow-up failed: {turn.result.error}
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}

                          {isFollowUpLoading && (
                            <div className="flex items-center gap-2 text-xs text-slate-200 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3">
                              <Loader2 className={`w-4 h-4 animate-spin ${isGemini ? 'text-amber-400' : 'text-purple-400'}`} />
                              <span>Analyzing relative impact on {displayName} prediction...</span>
                            </div>
                          )}

                          {/* Follow-Up Question Input */}
                          <div className="flex flex-col lg:flex-row gap-2">
                            <input
                              type="text"
                              value={draftVal}
                              onChange={(e) =>
                                setFollowUpDrafts(prev => ({ ...prev, [draftKey]: e.target.value }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === 'Enter' && !isFollowUpLoading && draftVal.trim()) {
                                  handleAskFollowUp(activeReportLevel, [providerId], draftVal, draftKey);
                                }
                              }}
                              placeholder={`Ask ${displayName} a follow-up on this prediction to understand relative impact...`}
                              className="flex-1 bg-slate-900 border border-slate-700 focus:border-emerald-400 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm text-white placeholder:text-slate-500 focus:outline-none"
                            />
                            <div className="flex flex-wrap items-center gap-2 shrink-0">
                              <button
                                onClick={() => handleAskFollowUp(activeReportLevel, [providerId], draftVal, draftKey)}
                                disabled={isFollowUpLoading || !draftVal.trim()}
                                className={`px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow ${
                                  isGemini
                                    ? 'bg-amber-500 hover:bg-amber-400 text-slate-950'
                                    : 'bg-purple-500 hover:bg-purple-400 text-white'
                                }`}
                              >
                                <Send className="w-3.5 h-3.5" />
                                <span>Ask {isGemini ? 'Gemini' : 'Fable'} Follow-Up</span>
                              </button>

                              {hasCompanionReport && (
                                <button
                                  onClick={() =>
                                    handleAskFollowUp(
                                      activeReportLevel,
                                      ['gemini_pro', 'claude_fable'],
                                      draftVal,
                                      draftKey
                                    )
                                  }
                                  disabled={isFollowUpLoading || isCompanionFollowUpLoading || !draftVal.trim()}
                                  className="px-3.5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow"
                                >
                                  <Send className="w-3.5 h-3.5" />
                                  <span>Ask Both</span>
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Relative Impact Quick Prompts */}
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 mr-1">
                              Relative Impact Prompts:
                            </span>
                            {relativeImpactFollowUpQuestions.map((q, idx) => (
                              <button
                                key={idx}
                                onClick={() => handleAskFollowUp(activeReportLevel, [providerId], q)}
                                disabled={isFollowUpLoading}
                                className="text-left px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[11px] text-slate-300 hover:text-emerald-300 transition cursor-pointer disabled:opacity-50"
                              >
                                {q}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ) : (
                      <div className="flex items-start gap-2 text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 rounded-lg p-3.5">
                        <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                        <div className="space-y-1">
                          <div className="font-bold">{displayName} Request Issue</div>
                          <div>{report.error}</div>
                        </div>
                      </div>
                    )
                  ) : (
                    <div className="py-12 text-center space-y-3">
                      <div className="text-sm text-slate-300 font-semibold">
                        No {displayName} report generated yet for <span className="text-amber-300">{activeLevelPrompt.scopeLabel}</span>.
                      </div>
                      <p className="text-xs text-slate-400 max-w-lg mx-auto">
                        Click <strong className={isGemini ? 'text-amber-300' : 'text-purple-300'}>Generate Prediction</strong> above or click <strong className="text-slate-200">Ask {isGemini ? 'Gemini' : 'Fable'}</strong> on any MD, AD, or PD card. Once delivered, the full-width report and follow-up Q&amp;A appear here.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            );
          })()}

          {/* Optional Other Model Bar (Sonnet / Haiku / Local Ollama Qwen) */}
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Alternate Engine Runner (Claude Sonnet 5.5 / Haiku 5.5 / Local Qwen 14B) for {activeLevelPrompt.scopeLabel}
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <select
                  value={extraProvider}
                  onChange={(e) => {
                    const next = e.target.value as LLMProviderId;
                    setExtraProvider(next);
                    try {
                      localStorage.setItem('astro_llm_provider', next);
                    } catch {}
                  }}
                  className="bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs font-bold text-slate-200 focus:outline-none focus:border-amber-400 cursor-pointer"
                >
                  <option value="claude_sonnet">{LLM_PROVIDERS.claude_sonnet.name}</option>
                  <option value="claude_haiku">{LLM_PROVIDERS.claude_haiku.name}</option>
                  <option value="local_qwen">{LLM_PROVIDERS.local_qwen.name}</option>
                  <option value="gemini_pro">{LLM_PROVIDERS.gemini_pro.name}</option>
                  <option value="claude_fable">{LLM_PROVIDERS.claude_fable.name}</option>
                </select>
                <button
                  onClick={handleRunExtraProvider}
                  disabled={isRunningExtraProvider || Boolean(batchProgress?.active)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  {isRunningExtraProvider ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-amber-400" />}
                  <span>{isRunningExtraProvider ? 'Synthesizing...' : 'Run Selected Engine'}</span>
                </button>
              </div>
            </div>

            {extraProviderResult && (
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs border-b border-slate-800 pb-2">
                  <span className="font-bold text-amber-300">
                    {extraProviderResult.success ? `Alternate Report — ${extraProviderResult.modelUsed}` : 'Engine Issue'}
                  </span>
                  <span className="text-slate-400 font-mono">
                    {(extraProviderResult.executionTimeMs / 1000).toFixed(2)}s
                  </span>
                </div>
                {extraProviderResult.success ? (
                  renderSimpleMarkdown(extraProviderResult.answerMarkdown)
                ) : (
                  <div className="text-xs text-rose-300">{extraProviderResult.error}</div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
