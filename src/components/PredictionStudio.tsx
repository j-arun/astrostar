import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Calendar,
  CalendarDays,
  Sparkles,
  Compass,
  Layers,
  Clock,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  RotateCcw,
  Sliders,
  ChevronDown,
  ChevronUp,
  Bot,
  Zap,
  Info,
  Send,
  Eye,
  EyeOff,
  Filter,
  FileText
} from 'lucide-react';
import { LLMProviderId, LLM_PROVIDERS, VedicHouseContext, LLMThreePartNarrative } from '../services/llm/types';
import { getPreferredGeminiModel } from '../services/llm/geminiModels';
import { sampleNatalPlacements } from '../data/horoscopeData';
import { ingestedPersonsRegistry } from '../data/apiService';
import storedPersonsData from '../data/stored_persons.json';
import {
  getGrahaTransitPosition,
  RASHI_LIST_META,
  calculateMultiYearMoonSpans,
  MultiYearMoonSpan,
  buildTransitEphemerisTimeline
} from '../data/transitEphemeris';
import { getDashaIntervalsForDateRange, ActiveDashaIntervalRange } from '../data/dashaCalculator';
import { computeSarvashtakavarga, calculateTaraBala, calculateChandraBala } from '../data/parasharaCalculations';
import { toCleanEnglishSign, toCleanEnglishPlanet } from '../services/llm/adapters';
import { AudioVoiceInspector } from './AudioVoiceInspector';

interface PredictionStudioProps {
  personId: string;
  incomingContext?: VedicHouseContext | null;
  onClearIncomingContext?: () => void;
}

export const PredictionStudio: React.FC<PredictionStudioProps> = ({
  personId,
  incomingContext,
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

  // 2. Continuous Timeline Controls (1 Year to 2 Years max)
  const [startDate, setStartDate] = useState<string>('2026-01-01');
  const [endDate, setEndDate] = useState<string>('2028-01-01'); // 2 Years default
  const [timelineError, setTimelineError] = useState<string | null>(null);

  // Quick Preset Helper
  const applyPreset = (months: number) => {
    try {
      const dStart = new Date(startDate);
      if (isNaN(dStart.getTime())) {
        const fallbackStart = new Date('2026-01-01');
        const dEnd = new Date(fallbackStart);
        dEnd.setMonth(dEnd.getMonth() + months);
        setStartDate('2026-01-01');
        setEndDate(dEnd.toISOString().slice(0, 10));
        return;
      }
      const dEnd = new Date(dStart);
      dEnd.setMonth(dEnd.getMonth() + months);
      setEndDate(dEnd.toISOString().slice(0, 10));
      setTimelineError(null);
    } catch {
      // ignore
    }
  };

  // Validate Timeline Span (between 360 days and 731 days = 1 to 2 continuous years)
  const timelineSpanDays = useMemo(() => {
    const s = new Date(startDate).getTime();
    const e = new Date(endDate).getTime();
    if (isNaN(s) || isNaN(e) || s >= e) return 0;
    return Math.round((e - s) / (1000 * 60 * 60 * 24));
  }, [startDate, endDate]);

  useEffect(() => {
    if (timelineSpanDays < 360) {
      setTimelineError('Timeline window must span at least 1 year (min 365 days).');
    } else if (timelineSpanDays > 735) {
      setTimelineError('Timeline window is capped at a continuous stretch of 2 years (max 731 days).');
    } else {
      setTimelineError(null);
    }
  }, [timelineSpanDays]);

  // 3. User Lived Experience Narratives (The LLM Test Framework)
  const [livedExperienceNarrative, setLivedExperienceNarrative] = useState<string>('');
  const [currentEventsNarrative, setCurrentEventsNarrative] = useState<string>('');
  const [specificQuery, setSpecificQuery] = useState<string>('');
  const [selectedProvider, setSelectedProvider] = useState<LLMProviderId>('local_qwen');

  // Collapsible cards state
  const [showDashaIntervals, setShowDashaIntervals] = useState<boolean>(true);
  const [showMajorTransits, setShowMajorTransits] = useState<boolean>(true);

  // 4. Astrological Multi-Year Calculations
  // Active Dasha intervals overlapping the selected 1-2 year window
  const activeDashaIntervals: ActiveDashaIntervalRange[] = useMemo(() => {
    return getDashaIntervalsForDateRange(startDate, endDate, activeProfile);
  }, [startDate, endDate, activeProfile]);

  // Moon Transits: Calculate ALL ~312 ingresses across the continuous window (Packed into LLM prompt)
  const multiYearMoonTransits: MultiYearMoonSpan[] = useMemo(() => {
    return calculateMultiYearMoonSpans(startDate, endDate, natalLagnaIdx, natalRashiIdx);
  }, [startDate, endDate, natalLagnaIdx, natalRashiIdx]);

  // Major Planetary Transits: Sun, Mars, Mercury, Jupiter, Venus, Saturn, Rahu, Ketu across 1-2 years
  const majorTransitsData = useMemo(() => {
    return buildTransitEphemerisTimeline(startDate, endDate, natalLagnaIdx, natalRashiIdx);
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

  // 5. Active Execution Context (Multi-Year Prediction Context)
  const [activeExecutionContext, setActiveExecutionContext] = useState<VedicHouseContext | null>(null);
  const [autoRunTriggerTimestamp, setAutoRunTriggerTimestamp] = useState<number | undefined>(undefined);
  const bottomReportRef = useRef<HTMLDivElement>(null);

  // If an incoming context arrives from Monthly View ("Send Prompt to LLM"), display it at bottom
  useEffect(() => {
    if (incomingContext) {
      setActiveExecutionContext(incomingContext);
      setAutoRunTriggerTimestamp(Date.now());
      setTimeout(() => {
        bottomReportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 250);
    }
  }, [incomingContext]);

  // Synthesize Trigger: Bundles the 1-2 year timeline, lived narratives, ~312 Moon transits, and major transits
  const handleSynthesizeMultiYear = () => {
    if (timelineError) return;

    const primaryDasha = activeDashaIntervals[0] || {
      mahadasha: 'Venus (Sukra)',
      antardasha: 'Saturn (Sani)',
      pratyantardasha: 'Mercury (Budha)',
      startDate,
      endDate
    };

    const dStart = new Date(startDate);
    const selectedMonth = isNaN(dStart.getMonth()) ? 0 : dStart.getMonth();
    const selectedYear = isNaN(dStart.getFullYear()) ? 2026 : dStart.getFullYear();

    const ctx: VedicHouseContext = {
      isMultiYearPrediction: true,
      timelineStartDate: startDate,
      timelineEndDate: endDate,
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
      natalJanmaStar: {
        nakshatra_name: activeProfile.birth_star || 'Anuradha',
        pada: activeProfile.birth_star_pada || 2,
        rashi_name: toCleanEnglishSign(activeProfile.birth_rashi || 'Scorpio'),
        rashi_index: natalRashiIdx
      },
      geminiApiKey: (typeof window !== 'undefined' ? localStorage.getItem('astro_gemini_api_key') : '') || undefined,
      geminiModel: getPreferredGeminiModel(),
      anthropicApiKey: (typeof window !== 'undefined' ? localStorage.getItem('astro_anthropic_api_key') : '') || undefined,
      anthropicModel: (typeof window !== 'undefined' ? localStorage.getItem('astro_anthropic_model') : '') || 'claude-sonnet-5-5'
    };

    setActiveExecutionContext(ctx);
    setAutoRunTriggerTimestamp(Date.now());

    setTimeout(() => {
      bottomReportRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 250);
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
                Multi-period continuous Vedic engine (1 to 2 years) testing LLM reasoning with ground-truth lived experience.
              </p>
            </div>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="px-3 py-1 rounded-full text-xs font-mono font-bold bg-slate-950 border border-slate-800 text-amber-300">
            Native: {activeProfile.person_name} ({activeProfile.person_id})
          </span>
          <span className="px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 flex items-center gap-1.5">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>Strict Zero-Synthetic PD Notes Enforced</span>
          </span>
        </div>
      </div>

      {/* SECTION 1: TIMELINE CONTROLS (1 to 2 Years Continuous Stretch) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4 shadow-lg">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
          <div className="flex items-center gap-2 text-sm font-bold text-white">
            <Calendar className="w-4 h-4 text-amber-400" />
            <span>Continuous Timeline Horizon (1 to 2 Years)</span>
          </div>

          {/* Quick Presets */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 uppercase font-semibold mr-1">Presets:</span>
            <button
              onClick={() => applyPreset(12)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              1 Year (12m)
            </button>
            <button
              onClick={() => applyPreset(18)}
              className="px-2.5 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
            >
              1.5 Years (18m)
            </button>
            <button
              onClick={() => applyPreset(24)}
              className="px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 hover:bg-amber-500/30 transition cursor-pointer"
            >
              2 Years (Max 24m)
            </button>
          </div>
        </div>

        {/* Date Inputs Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Start Date
            </label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400 transition"
            />
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              End Date (Max 2 Years from Start)
            </label>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-amber-400 transition"
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

      {/* SECTION 2: ACTIVE PERIODS & MAJOR TRANSITS (NO MOON IN UI, FULL MOON IN PAYLOAD) */}
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

        {/* Card B: Major Planetary Transits in Window (Clean UI: Moon hidden from UI, packed in payload) */}
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

          {/* Provider Selector */}
          <div className="flex items-center gap-2">
            <span className="text-[11px] text-slate-400 font-semibold">Model Engine:</span>
            <select
              value={selectedProvider}
              onChange={e => setSelectedProvider(e.target.value as LLMProviderId)}
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

        {/* Narrative Inputs Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Narrative 1: Past Lived Experience */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>1. Lived Experience of Past Period (Past Samples / Footprint)</span>
              <span className="text-[10px] text-slate-500 font-normal">e.g. Ketu MD or Mercury MD / Saturn AD</span>
            </label>
            <textarea
              rows={4}
              value={livedExperienceNarrative}
              onChange={e => setLivedExperienceNarrative(e.target.value)}
              placeholder="Type or paste your past lived experience for equivalent Dasha/AD periods (e.g. Saturn AD under Mercury MD or Ketu MD: career hurdles, visa status, relocation, institutional clearances)..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
            />
          </div>

          {/* Narrative 2: Current Reality & Transpired Events */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-300 flex items-center justify-between">
              <span>2. Past Period Events &amp; What You Are Facing Right Now</span>
              <span className="text-[10px] text-slate-500 font-normal">Active Ground Truth</span>
            </label>
            <textarea
              rows={4}
              value={currentEventsNarrative}
              onChange={e => setCurrentEventsNarrative(e.target.value)}
              placeholder="Describe events that have already happened in the recent past and your active life reality right now (e.g. current job status, visa expiry date, upcoming milestones)..."
              className="w-full bg-slate-950 border border-slate-700 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
            />
          </div>
        </div>

        {/* Specific Query / Test Directives */}
        <div className="space-y-1.5">
          <label className="block text-xs font-bold text-slate-300">
            3. Specific Query &amp; Event Probability Testing Focus
          </label>
          <input
            type="text"
            value={specificQuery}
            onChange={e => setSpecificQuery(e.target.value)}
            placeholder="e.g. Evaluate the exact probability of visa stamping, passport renewal, institutional approvals, and career transition during this 2-year window..."
            className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400 transition"
          />
        </div>

        {/* SYNTHESIZE ACTION BUTTON */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-400 font-mono">
            Prompt Payload: Bundling 2 Narratives + {activeDashaIntervals.length} Dashas + {multiYearMoonTransits.length} Moon Ingresses + Major Planets.
          </div>

          <button
            onClick={handleSynthesizeMultiYear}
            disabled={!!timelineError}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400 hover:from-amber-400 hover:to-yellow-300 text-slate-950 font-extrabold text-sm transition shadow-lg shadow-amber-500/20 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            <Sparkles className="w-4 h-4 fill-current" />
            <span>Synthesize (Test LLM Engine)</span>
          </button>
        </div>
      </div>

      {/* SECTION 4: PREDICTION REPORT CONTAINER (BOTTOM OF THE SCREEN) */}
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
            onChangeProvider={setSelectedProvider}
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
    </div>
  );
};

export default PredictionStudio;
