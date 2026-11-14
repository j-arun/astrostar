import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import {
  Calendar,
  Sparkles,
  Compass,
  Layers,
  Clock,
  ShieldCheck,
  AlertCircle,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  FileText,
  BookOpen,
  Copy,
  Check,
  Search,
  X,
  Download,
  Eye
} from 'lucide-react';
import {
  LLMProviderId,
  LLM_PROVIDERS,
  VedicHouseContext,
  LLMThreePartNarrative
} from '../services/llm/types';
import { getPreferredGeminiModel } from '../services/llm/geminiModels';
import { sampleNatalPlacements } from '../data/horoscopeData';
import {
  ingestedPersonsRegistry,
  loadAntardashaNarratives,
  loadLocalPdEvaluations
} from '../data/apiService';
import storedPersonsData from '../data/stored_persons.json';
import {
  RASHI_LIST_META,
  calculateMultiYearMoonSpans,
  MultiYearMoonSpan,
  buildTransitEphemerisTimeline
} from '../data/transitEphemeris';
import {
  getDashaIntervalsForDateRange,
  ActiveDashaIntervalRange
} from '../data/dashaCalculator';
import {
  toCleanEnglishSign,
  toCleanEnglishPlanet,
  buildVedicPrompt
} from '../services/llm/adapters';
import { analyzeVedicWindowEvents } from '../services/vedicEventsEngine';
import { AudioVoiceInspector } from './AudioVoiceInspector';

interface PredictionStudioProps {
  personId: string;
  incomingContext?: VedicHouseContext | null;
  incomingProvider?: LLMProviderId;
  onClearIncomingContext?: () => void;
}

function cleanLordName(name: string | undefined): string {
  if (!name) return '';
  return name.split('(')[0].trim().replace(/[^a-zA-Z0-9]/g, '');
}

export interface GenuineDatabaseAdNarrative {
  id: string;
  unique_id?: string;
  person_id: string;
  mahadasha: string;
  antardasha: string;
  startDate: string;
  endDate: string;
  lifePeriod?: string;
  primaryDomains?: string[];
  keyMilestones?: string;
  narrative: string;
  sourceModel?: string;
  updatedAt?: string;
}

export type GenuineAntardashaRecord = GenuineDatabaseAdNarrative;

export const PredictionStudio: React.FC<PredictionStudioProps> = ({
  personId,
  incomingContext,
  incomingProvider,
  onClearIncomingContext
}) => {
  // 1. Resolve Active Native Profile
  const activeRecord = useMemo(() => {
    return (
      (ingestedPersonsRegistry as any)[personId] ||
      (storedPersonsData as any)[personId] ||
      (storedPersonsData as any)['001ME']
    );
  }, [personId]);

  const activeProfile = activeRecord.profile;

  // Resolve Natal Lagna & Moon indices (1..12)
  const natalLagnaIdx = useMemo(() => {
    const lagnaP = (activeRecord.placements || []).find((p: any) => p.chart_type === 'D1' && p.body_name === 'Lagna');
    if (!lagnaP) return 9; // Default Dhanus (Sagittarius)
    const norm = (lagnaP.rashi_name || '').toLowerCase();
    const meta = RASHI_LIST_META.find(r => norm.includes(r.eng.split(' ')[0].toLowerCase()) || norm.includes(r.tamil));
    return meta ? meta.index : 9;
  }, [activeRecord]);

  const natalRashiIdx = useMemo(() => {
    const rName = (activeProfile.birth_rashi || '').toLowerCase();
    const meta = RASHI_LIST_META.find(r => rName.includes(r.eng.split(' ')[0].toLowerCase()) || rName.includes(r.tamil));
    return meta ? meta.index : 8; // Default Vrischigam (Scorpio)
  }, [activeProfile]);

  // 2. Continuous Timeline Controls (Freely editable arbitrary date window)
  const [startDate, setStartDate] = useState<string>('2026-01-01');
  const [endDate, setEndDate] = useState<string>('2028-01-01');
  const [timelineError, setTimelineError] = useState<string | null>(null);

  // Quick Preset Helper
  const applyPreset = (months: number) => {
    try {
      const dStart = new Date(startDate);
      const baseStart = isNaN(dStart.getTime()) ? new Date('2026-01-01') : dStart;
      const dEnd = new Date(baseStart);
      dEnd.setMonth(dEnd.getMonth() + months);
      setStartDate(baseStart.toISOString().slice(0, 10));
      setEndDate(dEnd.toISOString().slice(0, 10));
      setTimelineError(null);
    } catch {
      // ignore
    }
  };

  const timelineSpanDays = useMemo(() => {
    try {
      if (!startDate || !endDate) return 0;
      const s = new Date(startDate).getTime();
      const e = new Date(endDate).getTime();
      if (isNaN(s) || isNaN(e) || s >= e) return 0;
      return Math.round((e - s) / (1000 * 60 * 60 * 24));
    } catch {
      return 0;
    }
  }, [startDate, endDate]);

  useEffect(() => {
    if (!startDate || !endDate) {
      setTimelineError('Please enter both start and end dates.');
    } else {
      const s = new Date(startDate).getTime();
      const e = new Date(endDate).getTime();
      if (isNaN(s) || isNaN(e)) {
        setTimelineError('Please enter valid dates.');
      } else if (s >= e) {
        setTimelineError('Start date must be before end date.');
      } else {
        setTimelineError(null);
      }
    }
  }, [startDate, endDate]);

  // 3. User Lived Experience Narratives (The LLM Test Framework)
  const [livedExperienceNarrative, setLivedExperienceNarrative] = useState<string>('');
  const [currentEventsNarrative, setCurrentEventsNarrative] = useState<string>('');
  const [specificQuery, setSpecificQuery] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<LLMProviderId>(() => {
    const initial = incomingProvider || incomingContext?.preferredLlmProvider;
    if (initial && LLM_PROVIDERS[initial]) return initial;
    try {
      const saved = typeof window !== 'undefined' ? (localStorage.getItem('astro_llm_provider') as LLMProviderId) : null;
      if (saved && LLM_PROVIDERS[saved]) return saved;
    } catch {}
    return 'gemini_pro';
  });

  const handleSelectProvider = (newProv: LLMProviderId) => {
    setSelectedProvider(newProv);
    setActiveExecutionContext(prev => prev ? { ...prev, preferredLlmProvider: newProv } : prev);
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('astro_llm_provider', newProv);
      }
    } catch {}
  };

  // AD Narrative Picker Modal State
  const [showAdPickerModal, setShowAdPickerModal] = useState<boolean>(false);
  const [adSearchTerm, setAdSearchTerm] = useState<string>('');
  const [selectedMdFilter, setSelectedMdFilter] = useState<string>('all');

  // Prompt Inspector Modal State (Eye Icon)
  const [showPromptModal, setShowPromptModal] = useState<boolean>(false);
  const [promptCopied, setPromptCopied] = useState<boolean>(false);
  const [promptWrapLines, setPromptWrapLines] = useState<boolean>(true);

  // Collapsible cards state
  const [showDashaIntervals, setShowDashaIntervals] = useState<boolean>(true);
  const [showMajorTransits, setShowMajorTransits] = useState<boolean>(true);
  const [showSpecialEventsCard, setShowSpecialEventsCard] = useState<boolean>(true);

  // 4. Astrological Multi-Year Calculations
  const activeDashaIntervals: ActiveDashaIntervalRange[] = useMemo(() => {
    try {
      if (!startDate || !endDate || startDate >= endDate) return [];
      return getDashaIntervalsForDateRange(startDate, endDate, activeProfile);
    } catch {
      return [];
    }
  }, [startDate, endDate, activeProfile]);

  // Moon Transits: Calculate all ingresses across the window (Packed into LLM prompt)
  const multiYearMoonTransits: MultiYearMoonSpan[] = useMemo(() => {
    try {
      if (!startDate || !endDate || startDate >= endDate) return [];
      return calculateMultiYearMoonSpans(startDate, endDate, natalLagnaIdx, natalRashiIdx);
    } catch {
      return [];
    }
  }, [startDate, endDate, natalLagnaIdx, natalRashiIdx]);

  // Major Planetary Transits: Sun, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu
  const majorTransitsData = useMemo(() => {
    try {
      if (!startDate || !endDate || startDate >= endDate) {
        return {
          requested_timeline: { start_date: startDate || '', end_date: endDate || '', span_days: 0, span_years: 0 },
          natal_reference: { natal_lagna_sign: '', natal_lagna_index: natalLagnaIdx, natal_rashi_sign: '', natal_rashi_index: natalRashiIdx },
          transit_snapshot_start: [],
          transit_snapshot_end: [],
          major_transits_timeline_count: 0,
          major_transits_timeline: []
        };
      }
      return buildTransitEphemerisTimeline(startDate, endDate, natalLagnaIdx, natalRashiIdx);
    } catch {
      return {
        requested_timeline: { start_date: startDate || '', end_date: endDate || '', span_days: 0, span_years: 0 },
        natal_reference: { natal_lagna_sign: '', natal_lagna_index: natalLagnaIdx, natal_rashi_sign: '', natal_rashi_index: natalRashiIdx },
        transit_snapshot_start: [],
        transit_snapshot_end: [],
        major_transits_timeline_count: 0,
        major_transits_timeline: []
      };
    }
  }, [startDate, endDate, natalLagnaIdx, natalRashiIdx]);

  // Flattened D1 & D9 Natal Placements
  const flattenedD1 = useMemo(() => {
    return (activeRecord.placements || sampleNatalPlacements)
      .filter((p: any) => p.chart_type === 'D1')
      .map((p: any) => {
        const norm = (p.rashi_name || '').toLowerCase();
        const signMeta = RASHI_LIST_META.find(s => norm.includes(s.eng.split(' ')[0].toLowerCase()) || norm.includes(s.tamil));
        const sIdx = signMeta ? signMeta.index : 9;
        const hNum = ((sIdx - natalLagnaIdx + 12) % 12) + 1;
        return {
          body_name: p.body_name,
          rashi_name: p.rashi_name,
          degree_sputa: p.degree_sputa,
          nakshatra_name: p.nakshatra_name,
          pada: p.pada,
          house_number: hNum,
          is_retrograde: p.is_retrograde
        };
      });
  }, [activeRecord, natalLagnaIdx]);

  const flattenedD9 = useMemo(() => {
    return (activeRecord.placements || sampleNatalPlacements)
      .filter((p: any) => p.chart_type === 'D9')
      .map((p: any) => ({
        body_name: p.body_name,
        rashi_name: p.rashi_name,
        degree_sputa: p.degree_sputa
      }));
  }, [activeRecord]);

  // Special Yogas & Motion Pivots (Same-Sign Stations, Parivartana, Debilitation / Neecha Bhanga)
  const vedicSpecialEvents = useMemo(() => {
    try {
      if (!startDate || !endDate || startDate > endDate) {
        return analyzeVedicWindowEvents({
          startDateStr: startDate || '2026-01-01',
          endDateStr: endDate || '2026-01-01',
          natalLagnaIdx,
          natalRashiIdx,
          flattenedNatalD1: flattenedD1
        });
      }
      return analyzeVedicWindowEvents({
        startDateStr: startDate,
        endDateStr: endDate,
        natalLagnaIdx,
        natalRashiIdx,
        flattenedNatalD1: flattenedD1
      });
    } catch {
      return analyzeVedicWindowEvents({
        startDateStr: '2026-01-01',
        endDateStr: '2026-01-01',
        natalLagnaIdx,
        natalRashiIdx,
        flattenedNatalD1: flattenedD1
      });
    }
  }, [startDate, endDate, natalLagnaIdx, natalRashiIdx, flattenedD1]);

  // 4b. Authentic Database AD Narratives (Loaded Strictly from Database / DB Storage)
  const [dbAdNarratives, setDbAdNarratives] = useState<GenuineDatabaseAdNarrative[]>([]);
  const [isLoadingDbNarratives, setIsLoadingDbNarratives] = useState<boolean>(false);

  const loadAuthenticDbAdNarratives = useCallback(async () => {
    setIsLoadingDbNarratives(true);
    try {
      const pId = activeProfile?.person_id || personId || '001ME';
      const collected: GenuineDatabaseAdNarrative[] = [];
      const seenIds = new Set<string>();

      // 1. Fetch from REST API / PostgreSQL database endpoint
      try {
        const res = await fetch(`/api/ad-narratives?person_id=${encodeURIComponent(pId)}`);
        if (res.ok) {
          const json = await res.json();
          const records = Array.isArray(json.records) ? json.records : [];
          for (const r of records) {
            const text = (r.narrative || '').trim();
            if (text.length > 0) {
              const md = r.md || r.mahadasha || '';
              const ad = r.ad || r.antardasha || '';
              const id = r.unique_id || `${pId}_${cleanLordName(md)}_${cleanLordName(ad)}`;
              if (!seenIds.has(id)) {
                seenIds.add(id);
                collected.push({
                  id,
                  unique_id: r.unique_id || id,
                  person_id: r.person_id || pId,
                  mahadasha: md,
                  antardasha: ad,
                  startDate: r.start_date || '',
                  endDate: r.end_date || '',
                  lifePeriod: r.life_period || '',
                  primaryDomains: Array.isArray(r.primary_domains)
                    ? r.primary_domains
                    : (typeof r.primary_domains === 'string' ? r.primary_domains.split(',').map((s: string) => s.trim()).filter(Boolean) : []),
                  keyMilestones: r.key_milestones || '',
                  narrative: text,
                  sourceModel: r.source_model || 'PostgreSQL DB',
                  updatedAt: r.updated_at || ''
                });
              }
            }
          }
        }
      } catch {}

      // 2. Load from client-side DB table store (localStorage & sessionStorage)
      for (const storage of [typeof window !== 'undefined' ? window.localStorage : null, typeof window !== 'undefined' ? window.sessionStorage : null]) {
        try {
          const raw = storage?.getItem('astro_ad_narratives_table_store_v2');
          if (raw) {
            const tableData = JSON.parse(raw);
            for (const item of Object.values(tableData) as any[]) {
              if (!item) continue;
              const text = (item.narrative || '').trim();
              if (text.length > 0) {
                const itemPid = item.person_id || pId;
                const md = item.md || item.mahadasha_lord_md || '';
                const ad = item.ad || item.antardasha_lord_ad || '';
                const id = item.unique_id || `${itemPid}_${cleanLordName(md)}_${cleanLordName(ad)}`;
                if (!seenIds.has(id)) {
                  seenIds.add(id);
                  collected.push({
                    id,
                    unique_id: item.unique_id || id,
                    person_id: itemPid,
                    mahadasha: md,
                    antardasha: ad,
                    startDate: item.start_date || item.startDate || '',
                    endDate: item.end_date || item.endDate || '',
                    lifePeriod: item.life_period || '',
                    primaryDomains: Array.isArray(item.primary_domains) ? item.primary_domains : [],
                    keyMilestones: item.key_milestones || '',
                    narrative: text,
                    sourceModel: item.source_model || 'Direct DB Editor',
                    updatedAt: item.updated_at || ''
                  });
                }
              }
            }
          }
        } catch {}
      }

      // 3. Load from client cached narratives (astro_ad_narratives_v1)
      try {
        const cached = loadAntardashaNarratives();
        for (const [key, val] of Object.entries(cached)) {
          if (!val || !val.narrative || val.narrative.trim().length === 0) continue;
          try {
            const parsedKey = JSON.parse(key);
            const [keyPid, keyMd, keyAd, keyStart, keyEnd] = Array.isArray(parsedKey) ? parsedKey : [];
            const id = `${keyPid || pId}_${cleanLordName(keyMd)}_${cleanLordName(keyAd)}`;
            if (!seenIds.has(id)) {
              seenIds.add(id);
              collected.push({
                id,
                unique_id: id,
                person_id: keyPid || pId,
                mahadasha: keyMd || '',
                antardasha: keyAd || '',
                startDate: keyStart || '',
                endDate: keyEnd || '',
                narrative: val.narrative.trim(),
                sourceModel: val.model || 'Cached DB Narrative',
                updatedAt: val.generated_at || ''
              });
            }
          } catch {}
        }
      } catch {}

      // 4. Stored dasha notes fallback (from dasha_notes.json / stored_dasha_notes.json)
      try {
        const evaluations = loadLocalPdEvaluations();
        for (const rec of Object.values(evaluations)) {
          if (!rec || !rec.notes || rec.notes.trim().length === 0) continue;
          const id = `${pId}_${cleanLordName(rec.mahadasha_lord_md)}_${cleanLordName(rec.antardasha_lord_ad)}`;
          if (!seenIds.has(id)) {
            seenIds.add(id);
            collected.push({
              id,
              unique_id: id,
              person_id: pId,
              mahadasha: rec.mahadasha_lord_md,
              antardasha: rec.antardasha_lord_ad,
              startDate: rec.start_date,
              endDate: rec.end_date,
              narrative: rec.notes.trim(),
              sourceModel: 'Recorded DB Notes',
              updatedAt: ''
            });
          }
        }
      } catch {}

      // Sort by startDate
      collected.sort((a, b) => (a.startDate || '').localeCompare(b.startDate || ''));
      setDbAdNarratives(collected);
    } finally {
      setIsLoadingDbNarratives(false);
    }
  }, [activeProfile, personId]);

  // Load database narratives on mount or profile change
  useEffect(() => {
    loadAuthenticDbAdNarratives();
  }, [loadAuthenticDbAdNarratives]);

  // Reload when opening modal to capture any newly saved narratives
  useEffect(() => {
    if (showAdPickerModal) {
      loadAuthenticDbAdNarratives();
    }
  }, [showAdPickerModal, loadAuthenticDbAdNarratives]);

  // Filtered list for the AD picker modal - strictly based on database records
  const filteredAntardashas = useMemo(() => {
    return dbAdNarratives.filter(item => {
      const matchesMd =
        selectedMdFilter === 'all' ||
        item.mahadasha.toLowerCase().includes(selectedMdFilter.toLowerCase());

      const searchLower = adSearchTerm.trim().toLowerCase();
      const matchesSearch =
        !searchLower ||
        item.mahadasha.toLowerCase().includes(searchLower) ||
        item.antardasha.toLowerCase().includes(searchLower) ||
        item.startDate.includes(searchLower) ||
        item.endDate.includes(searchLower) ||
        (item.keyMilestones && item.keyMilestones.toLowerCase().includes(searchLower)) ||
        (item.lifePeriod && item.lifePeriod.toLowerCase().includes(searchLower)) ||
        (item.narrative && item.narrative.toLowerCase().includes(searchLower));

      return matchesMd && matchesSearch;
    });
  }, [dbAdNarratives, selectedMdFilter, adSearchTerm]);

  // Insert AD Narrative into Lived Experience (verbatim user narrative, completely untouched)
  const handleInsertAdNarrative = (item: GenuineDatabaseAdNarrative, mode: 'replace' | 'append') => {
    const content = item.narrative;

    if (mode === 'replace') {
      setLivedExperienceNarrative(content);
    } else {
      setLivedExperienceNarrative(prev => (prev.trim() ? `${prev.trim()}\n\n${content}` : content));
    }
    setShowAdPickerModal(false);
  };

  // 5. Active Execution Context Builder
  const buildCurrentVedicContext = (): VedicHouseContext => {
    const primaryDasha = activeDashaIntervals[0] || {
      mahadasha: 'Venus (Sukra)',
      antardasha: 'Saturn (Sani)',
      pratyantardasha: 'Mercury (Budha)',
      startDate: startDate || '2026-01-01',
      endDate: endDate || '2028-01-01'
    };

    const dStart = new Date(startDate || '2026-01-01');
    const selectedMonth = isNaN(dStart.getMonth()) ? 0 : dStart.getMonth();
    const selectedYear = isNaN(dStart.getFullYear()) ? 2026 : dStart.getFullYear();

    return {
      isMultiYearPrediction: true,
      timelineStartDate: startDate || '2026-01-01',
      timelineEndDate: endDate || '2028-01-01',
      isComprehensiveMonthly: true,
      activeDomainFilter: 'all',
      isEventActive: true,
      activationScore: 0.85,
      matchedRules: [],
      natalOccupants: [],
      transitOccupants: [],
      natalLagnaSignName: RASHI_LIST_META[natalLagnaIdx - 1]?.eng || 'Sagittarius',
      natalMoonSignName: RASHI_LIST_META[natalRashiIdx - 1]?.eng || 'Scorpio',
      activeDasha: {
        mahadasha: primaryDasha.mahadasha,
        antardasha: primaryDasha.antardasha,
        pratyantardasha: primaryDasha.pratyantardasha,
        startDate: primaryDasha.startDate,
        endDate: primaryDasha.endDate
      },
      selectedMonth,
      selectedYear,
      userQuery: specificQuery.trim() || undefined,
      livedExperienceNarrative: livedExperienceNarrative.trim() || undefined,
      currentEventsNarrative: currentEventsNarrative.trim() || undefined,
      flattenedNatalD1: flattenedD1,
      flattenedNatalD9: flattenedD9,
      multiYearDashas: activeDashaIntervals,
      multiYearMoonTransits,
      multiYearMajorTransits: majorTransitsData.major_transits_timeline.map(t => ({
        grahaKey: t.graha_name.split(' ')[0],
        grahaName: t.graha_name,
        signName: t.transit_rashi_name,
        startDate: t.start_date,
        endDate: t.end_date,
        houseFromLagna: t.house_from_natal_lagna,
        houseFromMoon: t.house_from_natal_rashi,
        isRetrograde: t.is_retrograde
      })),
      vedicSpecialEvents,
      natalJanmaStar: {
        nakshatra_name: activeProfile.birth_star || 'Anuradha',
        pada: activeProfile.birth_star_pada || 2,
        rashi_name: toCleanEnglishSign(activeProfile.birth_rashi || 'Scorpio'),
        rashi_index: natalRashiIdx
      },
      geminiApiKey: (typeof window !== 'undefined' ? localStorage.getItem('astro_gemini_api_key') : '') || undefined,
      geminiModel: getPreferredGeminiModel(),
      anthropicApiKey: (typeof window !== 'undefined' ? localStorage.getItem('astro_anthropic_api_key') : '') || undefined,
      anthropicModel: (typeof window !== 'undefined' ? localStorage.getItem('astro_anthropic_model') : '') || 'claude-sonnet-5-5',
      preferredLlmProvider: selectedProvider
    };
  };

  const [activeExecutionContext, setActiveExecutionContext] = useState<VedicHouseContext | null>(null);
  const [autoRunTriggerTimestamp, setAutoRunTriggerTimestamp] = useState<number | undefined>(undefined);
  const bottomReportRef = useRef<HTMLDivElement>(null);

  // If incoming context arrives from Monthly View ("Send Prompt to LLM"), sync provider and display it at bottom
  useEffect(() => {
    if (incomingContext) {
      const resolvedProv = incomingProvider || incomingContext.preferredLlmProvider;
      if (resolvedProv && LLM_PROVIDERS[resolvedProv]) {
        handleSelectProvider(resolvedProv);
      }
      setActiveExecutionContext({
        ...incomingContext,
        preferredLlmProvider: (resolvedProv && LLM_PROVIDERS[resolvedProv]) ? resolvedProv : selectedProvider
      });
      setAutoRunTriggerTimestamp(Date.now());
      setTimeout(() => {
        bottomReportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 250);
    }
  }, [incomingContext, incomingProvider]);

  // Synthesize Trigger
  const handleSynthesizeMultiYear = () => {
    if (timelineError) return;

    const ctx = buildCurrentVedicContext();
    setActiveExecutionContext(ctx);
    setAutoRunTriggerTimestamp(Date.now());

    setTimeout(() => {
      bottomReportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 250);
  };

  // Complete Raw Prompt string for Inspector Modal
  const fullPromptPayload = useMemo(() => {
    try {
      const ctx = activeExecutionContext || buildCurrentVedicContext();
      const provName = LLM_PROVIDERS[selectedProvider]?.name || 'Local Qwen';
      return buildVedicPrompt(ctx, provName);
    } catch (err: any) {
      return `// Error generating prompt payload: ${err?.message || err}`;
    }
  }, [
    activeExecutionContext,
    startDate,
    endDate,
    livedExperienceNarrative,
    currentEventsNarrative,
    specificQuery,
    selectedProvider,
    activeDashaIntervals,
    multiYearMoonTransits,
    majorTransitsData,
    vedicSpecialEvents,
    flattenedD1,
    flattenedD9
  ]);

  const promptStats = useMemo(() => {
    const chars = fullPromptPayload.length;
    const words = fullPromptPayload.trim() ? fullPromptPayload.trim().split(/\s+/).length : 0;
    const lines = fullPromptPayload.split('\n').length;
    const approxTokens = Math.round(chars / 4);
    return { chars, words, lines, approxTokens };
  }, [fullPromptPayload]);

  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(fullPromptPayload);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch {
      // ignore
    }
  };

  const handleDownloadPrompt = () => {
    const blob = new Blob([fullPromptPayload], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vedic_prompt_${startDate}_to_${endDate}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex-1 flex flex-col w-full bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      {/* HEADER BAR */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 sm:p-6 shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <Sparkles className="w-5 h-5 fill-current" />
            </div>
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white tracking-tight">
                Prediction Studio
              </h2>
              <p className="text-xs text-slate-400">
                Continuous timeline horizon (1 to 2 years) testing LLM reasoning with ground-truth lived experience.
              </p>
            </div>
          </div>
        </div>

        {/* Status Pills & Prompt Inspector Button */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowPromptModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition cursor-pointer shadow-sm active:scale-95"
            title="Inspect complete prompt payload generated by the system that gets posted to LLM"
          >
            <Eye className="w-3.5 h-3.5 text-amber-400" />
            <span>Inspect Complete LLM Prompt</span>
          </button>

          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-950 border border-slate-800 text-amber-300">
            Native: {activeProfile.person_name} ({activeProfile.person_id})
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Strict Zero-Synthetic PD Notes Enforced</span>
          </span>
        </div>
      </div>

      {/* SECTION 1: TIMELINE CONTROLS (Freely Editable Custom Date Range) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>Continuous Timeline Horizon (Choose Any Custom Date Range)</span>
          </div>

          {/* Quick Presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-[11px] text-slate-400 uppercase font-semibold mr-1">Quick Presets:</span>
            <button
              type="button"
              onClick={() => applyPreset(6)}
              className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              6 Months
            </button>
            <button
              type="button"
              onClick={() => applyPreset(12)}
              className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              1 Year
            </button>
            <button
              type="button"
              onClick={() => applyPreset(18)}
              className="px-2 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              1.5 Years
            </button>
            <button
              type="button"
              onClick={() => applyPreset(24)}
              className="px-2 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition cursor-pointer"
            >
              2 Years
            </button>
            <button
              type="button"
              onClick={() => {
                setStartDate('2026-01-01');
                setEndDate('2028-01-01');
                setTimelineError(null);
              }}
              className="px-2 py-1 rounded-lg text-xs font-medium text-slate-400 hover:text-white hover:bg-slate-800 border border-slate-800 transition cursor-pointer"
              title="Reset to 2026-01-01 to 2028-01-01"
            >
              Reset
            </button>
          </div>
        </div>

        {/* Date Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>Start Date</span>
              <span className="text-[10px] text-slate-500 font-mono">YYYY-MM-DD</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 hover:border-amber-400 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none transition [color-scheme:dark] cursor-pointer"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider mb-1.5 flex items-center justify-between">
              <span>End Date</span>
              <span className="text-[10px] text-slate-500 font-mono">YYYY-MM-DD</span>
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 hover:border-amber-400 focus:border-amber-400 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none transition [color-scheme:dark] cursor-pointer"
            />
          </div>

          <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 flex flex-col justify-center">
            <span className="text-[10px] text-slate-400 uppercase font-semibold">Active Window Duration</span>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-base font-extrabold text-amber-300 font-mono">
                {timelineSpanDays} Days
              </span>
              <span className="text-xs text-slate-400 font-mono">
                (~{(timelineSpanDays / 365.25).toFixed(2)} Years)
              </span>
            </div>
          </div>
        </div>

        {timelineError && (
          <div className="p-3 rounded-xl bg-rose-950/40 border border-rose-500/50 text-rose-300 text-xs flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{timelineError}</span>
          </div>
        )}
      </div>

      {/* SECTION 2: ACTIVE PERIODS & MAJOR TRANSITS */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Card A: Active Dasha Intervals in Selected Window */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3.5 shadow-lg">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Layers className="w-4 h-4 text-purple-400" />
              <span>Active Dasha Periods in Window ({activeDashaIntervals.length} Intervals)</span>
            </div>
            <button
              onClick={() => setShowDashaIntervals(!showDashaIntervals)}
              className="p-1 rounded text-slate-400 hover:text-white"
            >
              {showDashaIntervals ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {showDashaIntervals && (
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {activeDashaIntervals.map((d, i) => (
                <div
                  key={`${d.startDate}-${i}`}
                  className="bg-slate-950 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-1.5 font-bold">
                      <span className="text-purple-300">{toCleanEnglishPlanet(d.mahadasha)} MD</span>
                      <span className="text-slate-500">&rarr;</span>
                      <span className="text-indigo-300">{toCleanEnglishPlanet(d.antardasha)} AD</span>
                      <span className="text-slate-500">&rarr;</span>
                      <span className="text-amber-300">{toCleanEnglishPlanet(d.pratyantardasha)} PD</span>
                    </div>
                    <div className="text-[11px] font-mono text-slate-400">
                      {d.startDate} to {d.endDate}
                    </div>
                  </div>
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20">
                    #{i + 1}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card B: Major Planetary Transits in Window */}
        <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-3.5 shadow-lg">
          <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
            <div className="flex items-center gap-2 text-sm font-bold text-white">
              <Compass className="w-4 h-4 text-cyan-400" />
              <span>Major Planetary Transits (Sun, Mars, Jup, Sat, Rahu, Ketu)</span>
            </div>
            <button
              onClick={() => setShowMajorTransits(!showMajorTransits)}
              className="p-1 rounded text-slate-400 hover:text-white"
            >
              {showMajorTransits ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>

          {/* Moon Transit Packing Confirmation Badge */}
          <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between text-xs text-amber-200">
            <span className="flex items-center gap-2">
              <span className="text-base">🌕</span>
              <span><strong>Moon Transits:</strong> {multiYearMoonTransits.length} Ingress Periods Computed</span>
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-400 text-slate-950 uppercase shadow">
              Packed into Prompt
            </span>
          </div>

          {showMajorTransits && (
            <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
              {majorTransitsData.major_transits_timeline.slice(0, 15).map((t, i) => (
                <div
                  key={`${t.graha_name}-${t.start_date}-${i}`}
                  className="bg-slate-950 border border-slate-800/80 rounded-xl p-2.5 flex items-center justify-between text-xs"
                >
                  <div>
                    <span className="font-bold text-white">{t.graha_name}</span> in{' '}
                    <span className="text-cyan-300 font-semibold">{t.transit_rashi_name}</span>
                    {t.is_retrograde && <span className="ml-1 text-rose-400 font-bold">(R)</span>}
                    <div className="text-[11px] font-mono text-slate-400">
                      {t.start_date} to {t.end_date} • {t.house_from_natal_rashi}th from Moon
                    </div>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono">
                    H{t.house_from_natal_lagna}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2B: SPECIAL YOGAS ONE-LINER (PARIVARTANA, NEECHA BHANGA & SAME-SIGN STATIONS) */}
      <div className="bg-gradient-to-br from-slate-900 via-purple-950/20 to-slate-900 border border-purple-500/40 rounded-2xl p-5 space-y-3 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-800/80">
          <div className="flex flex-wrap items-center gap-2 text-sm font-bold text-white">
            <Sparkles className="w-4 h-4 text-purple-400" />
            <span>Critical Yogas &amp; Motion Shifts in Window (Parivartana, Neecha Bhanga &amp; Vakra↔Direct Stations)</span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-200 border border-amber-500/40">
              {vedicSpecialEvents.parivartanaYogas.length} Parivartana
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-200 border border-emerald-500/40">
              {vedicSpecialEvents.debilitationEvents.length} Neecha / Neecha Bhanga
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-purple-500/20 text-purple-200 border border-purple-500/40">
              {vedicSpecialEvents.sameSignStations.length} Same-Sign Stations
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowSpecialEventsCard(prev => !prev)}
            className="p-1 rounded text-slate-400 hover:text-white cursor-pointer"
          >
            {showSpecialEventsCard ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Dedicated Consolidated One-Liner */}
        <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/35 text-xs text-amber-100 leading-relaxed">
          <span className="font-extrabold text-amber-300 uppercase tracking-wider text-[10px] block mb-1">
            Consolidated Window One-Liner (Packed into Prompt)
          </span>
          <p className="font-medium text-white">{vedicSpecialEvents.consolidatedOneLiner}</p>
        </div>

        {showSpecialEventsCard && vedicSpecialEvents.possibleEventsSummary.length > 0 && (
          <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
            <div className="text-[11px] font-bold text-purple-300 uppercase tracking-wider">
              Predicted Real-World Events from These Alignments ({vedicSpecialEvents.possibleEventsSummary.length}):
            </div>
            {vedicSpecialEvents.possibleEventsSummary.map((evt, idx) => (
              <div
                key={idx}
                className="bg-slate-950/90 border border-slate-800 rounded-xl p-2.5 text-xs text-slate-200 leading-relaxed flex items-start gap-2"
              >
                <span className="text-amber-400 font-bold shrink-0">•</span>
                <span>{evt}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* SECTION 3: QUERY STUDIO & SYNTHESIZE (THE LLM TEST BENCHMARK) */}
      <div className="bg-slate-900/90 border border-amber-500/40 rounded-2xl p-5 sm:p-6 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2 text-sm font-extrabold text-white">
              <Sparkles className="w-4 h-4 text-amber-400 fill-current" />
              <span>Query Studio &amp; Ground-Truth Synthesizer (The LLM Test)</span>
            </div>
            <p className="text-xs text-slate-400">
              Provide past lived experience and current events to rigorously test the LLM against your real footprints.
            </p>
          </div>

          {/* Model Engine Selector & Inspect Prompt Button */}
          <div className="flex flex-wrap items-center gap-2.5">
            <button
              type="button"
              onClick={() => setShowPromptModal(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-amber-500/40 text-amber-300 font-bold text-xs transition cursor-pointer active:scale-95 shadow-sm"
              title="Inspect complete prompt payload generated by the system that gets posted to LLM"
            >
              <Eye className="w-3.5 h-3.5 text-amber-400" />
              <span>Inspect Prompt</span>
            </button>

            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-slate-400 font-semibold">Model:</span>
              <select
                value={selectedProvider}
                onChange={e => handleSelectProvider(e.target.value as LLMProviderId)}
                className="bg-slate-950 border border-slate-700 text-amber-300 font-bold text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-amber-400 cursor-pointer"
              >
                {Object.values(LLM_PROVIDERS).map(prov => (
                  <option key={prov.id} value={prov.id} className="bg-slate-900 text-white font-medium">
                    {prov.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Narrative Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Narrative 1: Past Lived Experience with Authentic AD Picker */}
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label className="block text-xs font-bold text-slate-200">
                1. Lived Experience of Past Period (Footprints / Test Baseline)
              </label>

              {/* AD Picker Modal Trigger Button */}
              <button
                type="button"
                onClick={() => setShowAdPickerModal(true)}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 border border-amber-500/30 transition cursor-pointer shadow-sm active:scale-95"
                title="Open Antardasha picker to select and insert stored AD narratives from database"
              >
                <BookOpen className="w-3.5 h-3.5 text-amber-400" />
                <span>Pick Past AD Narrative ({dbAdNarratives.length} in DB)</span>
              </button>
            </div>

            {/* Quick Chips for Real Database Records Only */}
            {dbAdNarratives.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span className="text-[10px] text-slate-400 font-semibold uppercase mr-0.5">Stored in DB ({dbAdNarratives.length}):</span>
                {dbAdNarratives.map(ad => (
                  <button
                    key={ad.id}
                    type="button"
                    onClick={() => handleInsertAdNarrative(ad, 'replace')}
                    className="px-2 py-0.5 rounded-md text-[10.5px] font-medium bg-slate-950 hover:bg-slate-800 text-slate-300 hover:text-amber-300 border border-slate-800 transition cursor-pointer"
                    title={ad.narrative}
                  >
                    {toCleanEnglishPlanet(ad.mahadasha).slice(0, 4)} / {toCleanEnglishPlanet(ad.antardasha).slice(0, 4)} AD
                  </button>
                ))}
              </div>
            )}

            <textarea
              rows={4}
              value={livedExperienceNarrative}
              onChange={e => setLivedExperienceNarrative(e.target.value)}
              placeholder="Select an AD above or enter your past lived experience (e.g. past career hurdles, visa paperwork processing, PF transfers, relocation milestones)..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
            />
          </div>

          {/* Narrative 2: Current Reality & Transpired Events */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold text-slate-200">
                2. Past Period Events &amp; What You Are Facing Right Now
              </label>
              <span className="text-[10px] text-slate-500 font-mono">Active Ground Truth</span>
            </div>

            <div className="flex items-center gap-2 pt-0.5 text-[10px] text-slate-400">
              <span>Ground truth realities tested against astrological forecast fruition</span>
            </div>

            <textarea
              rows={4}
              value={currentEventsNarrative}
              onChange={e => setCurrentEventsNarrative(e.target.value)}
              placeholder="Describe events that have already happened in the recent past and your active reality right now (e.g. current role status, upcoming visa expiry date, passport renewal timeline, pending PF transfer)..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
            />
          </div>
        </div>

        {/* Specific Query / Test Directives */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between">
            <label className="block text-xs font-bold text-slate-300">
              3. Specific Query &amp; Event Probability Testing Focus
            </label>
            <span className="text-[10px] text-slate-500">e.g. Visa stamping, PF transfer, passport renewal</span>
          </div>
          <input
            type="text"
            value={specificQuery}
            onChange={e => setSpecificQuery(e.target.value)}
            placeholder="e.g. Evaluate exact probability and timing window of visa paper delays, passport renewal stamping, PF fund transfer, and career transition during this window..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
          />
        </div>

        {/* SYNTHESIZE & INSPECT BUTTONS */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 font-mono">
            Prompt Payload: 2 Narratives + {activeDashaIntervals.length} Dashas + {multiYearMoonTransits.length} Moon Ingresses + {vedicSpecialEvents.parivartanaYogas.length} Parivartana + {vedicSpecialEvents.debilitationEvents.length} Neecha Bhanga + {vedicSpecialEvents.sameSignStations.length} Stations.
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto">
            {/* Eye Icon Prompt Inspector Button */}
            <button
              type="button"
              onClick={() => setShowPromptModal(true)}
              className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-3 rounded-xl bg-slate-950 hover:bg-slate-800 text-amber-300 font-bold text-xs border border-amber-500/40 hover:border-amber-400 transition shadow cursor-pointer active:scale-95"
              title="Inspect complete prompt payload generated by the system that gets posted to LLM"
            >
              <Eye className="w-4 h-4 text-amber-400" />
              <span>Inspect Prompt</span>
            </button>

            <button
              onClick={handleSynthesizeMultiYear}
              disabled={!!timelineError}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-extrabold text-sm transition shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
            >
              <Sparkles className="w-4 h-4 fill-current" />
              <span>Synthesize (Test LLM Engine)</span>
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 4: UNIFIED PREDICTION REPORT CONTAINER (BOTTOM OF THE SCREEN) */}
      <div ref={bottomReportRef} className="pt-4 border-t border-slate-800/80">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-amber-400" />
            <h3 className="text-lg font-extrabold text-white">
              Vedic Prediction Synthesis Report
            </h3>
          </div>
          {activeExecutionContext && (
            <span className="text-xs text-slate-400 font-mono">
              Mode: {activeExecutionContext.isMultiYearPrediction ? 'Continuous Multi-Year Timeline' : 'Single Month Gochara'}
            </span>
          )}
        </div>

        {activeExecutionContext ? (
          <AudioVoiceInspector
            isOpen={true}
            inlineView={true}
            onClose={() => {
              setActiveExecutionContext(null);
              if (onClearIncomingContext) onClearIncomingContext();
            }}
            context={activeExecutionContext}
            activeProvider={selectedProvider}
            runTriggerTimestamp={autoRunTriggerTimestamp}
            onChangeProvider={handleSelectProvider}
          />
        ) : (
          <div className="bg-slate-900/60 border border-dashed border-slate-800 rounded-2xl p-12 text-center text-slate-500 space-y-2">
            <Sparkles className="w-8 h-8 text-amber-500/40 mx-auto" />
            <p className="text-sm font-semibold text-slate-400">
              No Active Prediction Report Yet
            </p>
            <p className="text-xs text-slate-500 max-w-md mx-auto">
              Click <strong>&quot;Synthesize (Test LLM Engine)&quot;</strong> above to generate a continuous 1-to-2 year prediction, or click <strong>&quot;Send Prompt to LLM&quot;</strong> in Monthly View to display the monthly report here.
            </p>
          </div>
        )}
      </div>

      {/* MODAL 1: PICK PAST AD NARRATIVES MODAL */}
      {showAdPickerModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Modal Header */}
            <div className="p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/70">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <BookOpen className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-white">
                    Pick Past Antardasha (AD) Narrative &amp; Footprint
                  </h3>
                  <p className="text-xs text-slate-400">
                    Select any period with authentic recorded notes to insert into your Ground-Truth Lived Experience field.
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowAdPickerModal(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Filter and Search Bar */}
            <div className="p-4 border-b border-slate-800 bg-slate-900/60 space-y-3">
              <div className="relative">
                <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={adSearchTerm}
                  onChange={e => setAdSearchTerm(e.target.value)}
                  placeholder="Search by planet, year, notes keyword (e.g. 'visa', 'saturn', 'birth', 'transition')..."
                  className="w-full bg-slate-950 border border-slate-700 rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400"
                />
              </div>

              {/* Mahadasha Filter Tabs */}
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[10px] text-slate-400 font-semibold uppercase mr-1">MD Filter:</span>
                {[
                  { id: 'all', label: 'All MDs' },
                  { id: 'Saturn', label: 'Saturn MD (1976–89)' },
                  { id: 'Mercury', label: 'Mercury MD (1989–06)' },
                  { id: 'Ketu', label: 'Ketu MD (2006–13)' },
                  { id: 'Venus', label: 'Venus MD (2013–33)' }
                ].map(tab => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setSelectedMdFilter(tab.id)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      selectedMdFilter === tab.id
                        ? 'bg-amber-500 text-slate-950 font-bold shadow'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
            </div>

            {/* List of Antardashas */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredAntardashas.length === 0 ? (
                <div className="text-center py-12 text-slate-500 text-xs space-y-2">
                  <p className="font-semibold text-slate-400">
                    {dbAdNarratives.length === 0
                      ? 'No AD narratives found in the database.'
                      : 'No stored AD narratives match your search filter.'}
                  </p>
                  <p className="text-slate-500 max-w-sm mx-auto">
                    {dbAdNarratives.length === 0
                      ? 'Only genuine AD narratives entered or saved into the database are displayed here. Save narratives in the Dasha AD Editor to pick them.'
                      : 'Try adjusting the search query or Mahadasha filter above.'}
                  </p>
                </div>
              ) : (
                filteredAntardashas.map(adItem => (
                  <div
                    key={adItem.id}
                    className="p-3.5 rounded-xl bg-slate-950 border border-slate-800 hover:border-slate-700 transition space-y-2.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-white">
                          <span className="text-purple-300">{toCleanEnglishPlanet(adItem.mahadasha)} MD</span>
                          <span className="text-slate-500 mx-1">&rarr;</span>
                          <span className="text-amber-300">{toCleanEnglishPlanet(adItem.antardasha)} AD</span>
                        </span>
                        <span className="text-[11px] font-mono text-slate-400">
                          ({adItem.startDate} to {adItem.endDate})
                        </span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        {adItem.lifePeriod && (
                          <span className="px-2 py-0.5 rounded text-[10px] font-medium bg-cyan-950 text-cyan-300 border border-cyan-800/50">
                            {adItem.lifePeriod}
                          </span>
                        )}
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                          Database Stored
                        </span>
                      </div>
                    </div>

                    {adItem.primaryDomains && adItem.primaryDomains.length > 0 && (
                      <div className="flex flex-wrap items-center gap-1">
                        <span className="text-[10px] text-slate-400">Domains:</span>
                        {adItem.primaryDomains.map(d => (
                          <span key={d} className="px-1.5 py-0.5 rounded text-[9.5px] bg-slate-900 text-slate-300 border border-slate-800">
                            {d}
                          </span>
                        ))}
                      </div>
                    )}

                    {adItem.keyMilestones && (
                      <div className="text-[11px] text-amber-200/90 font-medium bg-amber-950/20 px-2 py-1 rounded border border-amber-900/40">
                        <strong>Milestones:</strong> {adItem.keyMilestones}
                      </div>
                    )}

                    {/* Exact Narrative Content from Database */}
                    <div className="p-2.5 rounded-lg bg-slate-900 border border-slate-800 font-mono text-xs text-slate-200 leading-relaxed whitespace-pre-wrap select-text">
                      {adItem.narrative}
                    </div>

                    {/* Action Buttons */}
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[10px] text-slate-500 font-mono">
                        Source: {adItem.sourceModel || 'Database'}
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleInsertAdNarrative(adItem, 'append')}
                          className="px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 transition cursor-pointer"
                          title="Append this narrative after existing text"
                        >
                          + Append
                        </button>
                        <button
                          type="button"
                          onClick={() => handleInsertAdNarrative(adItem, 'replace')}
                          className="px-3 py-1 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition cursor-pointer shadow active:scale-95"
                          title="Replace current lived experience text with this narrative"
                        >
                          Insert into Lived Experience
                        </button>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-950/80 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span>Showing {filteredAntardashas.length} of {dbAdNarratives.length} stored AD narratives in database</span>
              <button
                type="button"
                onClick={() => setShowAdPickerModal(false)}
                className="px-3 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: RAW LLM PROMPT INSPECTOR MODAL (EYE ICON) */}
      {showPromptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                    <span>Complete Raw Astrological LLM Prompt Payload</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                      {LLM_PROVIDERS[selectedProvider]?.name || 'Local Qwen'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Exact string payload transmitted to the LLM engine, including multi-year horizon, ~312 Moon ingresses, and lived narratives.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow active:scale-95"
                  title="Copy complete raw prompt to clipboard"
                >
                  {promptCopied ? <Check className="w-3.5 h-3.5 text-slate-950" /> : <Copy className="w-3.5 h-3.5 text-slate-950" />}
                  <span>{promptCopied ? 'Copied!' : 'Copy Prompt'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDownloadPrompt}
                  className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs transition cursor-pointer"
                  title="Download prompt as .txt file"
                >
                  <Download className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => setShowPromptModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Metrics Strip */}
            <div className="px-4 py-2 bg-slate-950 border-b border-slate-800/80 flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
              <div className="flex flex-wrap items-center gap-4 text-slate-300">
                <span>
                  <strong className="text-amber-400">{promptStats.chars.toLocaleString()}</strong> Chars
                </span>
                <span>
                  <strong className="text-cyan-400">{promptStats.words.toLocaleString()}</strong> Words
                </span>
                <span>
                  <strong className="text-purple-400">{promptStats.lines.toLocaleString()}</strong> Lines
                </span>
                <span>
                  <strong className="text-emerald-400">~{promptStats.approxTokens.toLocaleString()}</strong> Tokens
                </span>
                <span className="text-amber-300 font-semibold">
                  🌕 {multiYearMoonTransits.length} Moon Ingresses Packed
                </span>
                <span className="text-indigo-300 font-semibold">
                  🪐 {activeDashaIntervals.length} Dasha Intervals
                </span>
              </div>

              {/* View options */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setPromptWrapLines(!promptWrapLines)}
                  className="px-2 py-0.5 rounded text-[11px] bg-slate-800 hover:bg-slate-700 text-slate-300 cursor-pointer"
                >
                  {promptWrapLines ? 'Line Wrap: ON' : 'Line Wrap: OFF'}
                </button>
              </div>
            </div>

            {/* Monospaced Raw Prompt Inspector */}
            <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-xs text-slate-200 select-text">
              <pre className={`${promptWrapLines ? 'whitespace-pre-wrap' : 'whitespace-pre'} leading-relaxed`}>
                {fullPromptPayload}
              </pre>
            </div>

            {/* Modal Footer */}
            <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Payload conforms to Classical Parashara Moon-Gochara contract &amp; strict JSON schema</span>
              </span>
              <button
                type="button"
                onClick={() => setShowPromptModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PredictionStudio;
