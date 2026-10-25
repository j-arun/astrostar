import React, { useState, useMemo, useEffect, useCallback } from 'react';
import {
  Sparkles,
  Eye,
  Save,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Info,
  Palette,
  ListFilter,
  Edit3,
  Clock,
  Tag,
  Database,
  Layers,
  FileText
} from 'lucide-react';
import {
  AntardashaNarrativeIdentity,
  CachedAntardashaNarrative,
  generateAntardashaNarrative,
  previewAntardashaNarrativePrompt,
  storeAntardashaNarrative,
  storeAntardashaPromptOverride,
  removeAntardashaPromptOverride
} from '../data/apiService';
import {
  GrahaLord,
  GRAHA_COLOR_CONFIGS,
  parseNarrativeWithPdHighlights,
  PdFeedItem,
  HighlightedSegment
} from '../utils/dashaNarrativeStyler';

export const LIFE_PERIOD_OPTIONS = [
  'Infancy (0–3)',
  'Early Childhood (4–7)',
  'School Age (8–14)',
  'Adolescence (15–19)',
  'Early Youth (20–25)',
  'Prime Adulthood (26–35)',
  'Mid Adulthood (36–48)',
  'Mature Adulthood (49–60)',
  'Senior Elder (61–72)',
  'Twilight (73+)'
] as const;

export type LifePeriodType = typeof LIFE_PERIOD_OPTIONS[number];

export const PRIMARY_DOMAIN_OPTIONS = [
  'Career',
  'Finance',
  'Health',
  'Marriage',
  'Children',
  'Education',
  'Relocation',
  'Spiritual',
  'Property',
  'Legal'
];

export interface AdNarrativeDbRecord {
  unique_id: string;
  person_id: string;
  md: string;
  ad: string;
  start_date: string;
  end_date: string;
  life_period: string;
  primary_domains: string[];
  key_milestones: string;
  narrative: string;
  source_model: string;
  updated_at: string;
}

const AD_NARRATIVES_TABLE_KEY = 'astro_ad_narratives_table_store_v2';

function loadStoredAdNarrativeRecord(uniqueId: string): AdNarrativeDbRecord | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(AD_NARRATIVES_TABLE_KEY);
    if (!raw) return null;
    const records: Record<string, AdNarrativeDbRecord> = JSON.parse(raw);
    return records[uniqueId] || null;
  } catch {
    return null;
  }
}

function persistAdNarrativeRecord(record: AdNarrativeDbRecord): void {
  if (typeof window === 'undefined') return;
  try {
    const raw = localStorage.getItem(AD_NARRATIVES_TABLE_KEY);
    const records: Record<string, AdNarrativeDbRecord> = raw ? JSON.parse(raw) : {};
    records[record.unique_id] = record;
    localStorage.setItem(AD_NARRATIVES_TABLE_KEY, JSON.stringify(records));
    sessionStorage.setItem(AD_NARRATIVES_TABLE_KEY, JSON.stringify(records));
  } catch {
    // ignore
  }
}

function cleanLordName(name: string): string {
  if (!name) return '';
  return name.split('(')[0].trim().replace(/[^a-zA-Z0-9]/g, '');
}

/**
 * Estimate life period from native birth year (defaulting to 1976 for 001ME) and AD start date
 */
function inferLifePeriodFromDate(startDateStr: string, birthYear = 1976): LifePeriodType {
  try {
    const match = startDateStr.match(/^(\d{4})/);
    if (match) {
      const year = parseInt(match[1], 10);
      const age = Math.max(0, year - birthYear);
      if (age <= 3) return 'Infancy (0–3)';
      if (age <= 7) return 'Early Childhood (4–7)';
      if (age <= 14) return 'School Age (8–14)';
      if (age <= 19) return 'Adolescence (15–19)';
      if (age <= 25) return 'Early Youth (20–25)';
      if (age <= 35) return 'Prime Adulthood (26–35)';
      if (age <= 48) return 'Mid Adulthood (36–48)';
      if (age <= 60) return 'Mature Adulthood (49–60)';
      if (age <= 72) return 'Senior Elder (61–72)';
      return 'Twilight (73+)';
    }
  } catch {
    // ignore
  }
  return 'Prime Adulthood (26–35)';
}

interface DashaAdNarrativeCardProps {
  personId: string;
  mahadashaLord: string;
  antardashaLord: string;
  startDate: string;
  endDate: string;
  apiBaseUrl: string;
  pdFeeds: PdFeedItem[];
  cachedNarrative?: CachedAntardashaNarrative;
  customPromptOverride?: string;
  onNarrativeGenerated?: (narrative: CachedAntardashaNarrative) => void;
}

export const DashaAdNarrativeCard: React.FC<DashaAdNarrativeCardProps> = ({
  personId,
  mahadashaLord,
  antardashaLord,
  startDate,
  endDate,
  apiBaseUrl,
  pdFeeds,
  cachedNarrative,
  customPromptOverride,
  onNarrativeGenerated
}) => {
  const cleanMd = useMemo(() => cleanLordName(mahadashaLord), [mahadashaLord]);
  const cleanAd = useMemo(() => cleanLordName(antardashaLord), [antardashaLord]);
  
  // UniqueID column for AD_Narratives table e.g. "001ME_Venus_Ketu"
  const uniqueId = useMemo(() => {
    return `${personId}_${cleanMd}_${cleanAd}`;
  }, [personId, cleanMd, cleanAd]);

  const [narrative, setNarrative] = useState<CachedAntardashaNarrative | undefined>(cachedNarrative);
  const [editableNarrative, setEditableNarrative] = useState<string>(cachedNarrative?.narrative || '');
  const [isEditingNarrative, setIsEditingNarrative] = useState<boolean>(false);

  // Table Columns
  const [lifePeriod, setLifePeriod] = useState<string>(() => {
    const existing = loadStoredAdNarrativeRecord(uniqueId);
    return existing?.life_period || inferLifePeriodFromDate(startDate);
  });

  const [primaryDomains, setPrimaryDomains] = useState<string[]>(() => {
    const existing = loadStoredAdNarrativeRecord(uniqueId);
    return existing?.primary_domains || [];
  });

  const [keyMilestones, setKeyMilestones] = useState<string>(() => {
    const existing = loadStoredAdNarrativeRecord(uniqueId);
    return existing?.key_milestones || '';
  });

  const [sourceModel, setSourceModel] = useState<string>(() => {
    const existing = loadStoredAdNarrativeRecord(uniqueId);
    return existing?.source_model || cachedNarrative?.model || 'local_qwen';
  });

  const [dbSaveState, setDbSaveState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(() => {
    const existing = loadStoredAdNarrativeRecord(uniqueId);
    return existing?.updated_at || null;
  });

  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showPrompt, setShowPrompt] = useState<boolean>(false);
  const [promptText, setPromptText] = useState<string>(customPromptOverride || '');
  const [promptLoading, setPromptLoading] = useState<boolean>(false);
  const [promptSaved, setPromptSaved] = useState<boolean>(false);
  const [isHighlightEnabled, setIsHighlightEnabled] = useState<boolean>(true);
  const [selectedGrahaFilter, setSelectedGrahaFilter] = useState<GrahaLord | 'ALL'>('ALL');
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);

  // Synchronize on props or uniqueId change
  useEffect(() => {
    const existing = loadStoredAdNarrativeRecord(uniqueId);
    if (existing) {
      if (existing.narrative) {
        setEditableNarrative(existing.narrative);
        setNarrative({
          narrative: existing.narrative,
          prompt: promptText || '',
          model: existing.source_model || 'local_qwen',
          generated_at: existing.updated_at
        });
      }
      if (existing.life_period) setLifePeriod(existing.life_period);
      if (existing.primary_domains) setPrimaryDomains(existing.primary_domains);
      if (existing.key_milestones) setKeyMilestones(existing.key_milestones);
      if (existing.source_model) setSourceModel(existing.source_model);
      if (existing.updated_at) setLastSavedAt(existing.updated_at);
    } else if (cachedNarrative) {
      setNarrative(cachedNarrative);
      setEditableNarrative(cachedNarrative.narrative || '');
    } else {
      // Query server if not yet in browser storage
      fetch(`/api/ad-narratives?person_id=${personId}`)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data?.records && Array.isArray(data.records)) {
            const match = data.records.find((r: any) => r.unique_id === uniqueId);
            if (match) {
              persistAdNarrativeRecord(match);
              if (match.narrative) {
                setEditableNarrative(match.narrative);
                setNarrative({
                  narrative: match.narrative,
                  prompt: promptText || '',
                  model: match.source_model || 'local_qwen',
                  generated_at: match.updated_at
                });
              }
              if (match.life_period) setLifePeriod(match.life_period);
              if (match.primary_domains) {
                setPrimaryDomains(Array.isArray(match.primary_domains) ? match.primary_domains : match.primary_domains.split(',').map((s: string) => s.trim()));
              }
              if (match.key_milestones) setKeyMilestones(match.key_milestones);
              if (match.source_model) setSourceModel(match.source_model);
              if (match.updated_at) setLastSavedAt(match.updated_at);
            }
          }
        })
        .catch(() => {});
    }
  }, [uniqueId, cachedNarrative, personId]);

  useEffect(() => {
    setPromptText(customPromptOverride || '');
  }, [customPromptOverride]);

  const adIdentity: AntardashaNarrativeIdentity = useMemo(() => ({
    mahadasha_lord_md: mahadashaLord,
    antardasha_lord_ad: antardashaLord,
    start_date: startDate,
    end_date: endDate
  }), [mahadashaLord, antardashaLord, startDate, endDate]);

  const activeFeedsWithNotes = useMemo(() => {
    return pdFeeds.filter(feed => 
      (feed.notes && feed.notes.trim().length > 0) || feed.evaluation_rating !== null
    );
  }, [pdFeeds]);

  // Parse narrative into segments highlighted with planetary colors
  const activeNarrativeText = isEditingNarrative ? editableNarrative : (narrative?.narrative || editableNarrative);
  const parsedSegments: HighlightedSegment[] = useMemo(() => {
    if (!activeNarrativeText) return [];
    return parseNarrativeWithPdHighlights(activeNarrativeText, pdFeeds);
  }, [activeNarrativeText, pdFeeds]);

  // Persist record to AD_Narratives table (Local persistence + REST API backend sync)
  const commitToDatabase = useCallback(async (
    targetNarrative: string,
    modelUsed: string,
    overrideDomains?: string[],
    overridePeriod?: string,
    overrideMilestones?: string
  ) => {
    setDbSaveState('saving');
    const nowIso = new Date().toISOString();
    const record: AdNarrativeDbRecord = {
      unique_id: uniqueId,
      person_id: personId,
      md: mahadashaLord,
      ad: antardashaLord,
      start_date: startDate,
      end_date: endDate,
      life_period: overridePeriod || lifePeriod,
      primary_domains: overrideDomains || primaryDomains,
      key_milestones: overrideMilestones !== undefined ? overrideMilestones : keyMilestones,
      narrative: targetNarrative,
      source_model: modelUsed || sourceModel || 'local_qwen',
      updated_at: nowIso
    };

    // 1. Immediately persist to client storage table
    persistAdNarrativeRecord(record);
    setLastSavedAt(nowIso);

    // 2. Sync to backend API (Prioritize Python backend apiBaseUrl for direct PostgreSQL insertion, plus local dev server)
    try {
      const endpointsToTry: string[] = [];
      if (apiBaseUrl && apiBaseUrl.trim() !== '') {
        const cleanBase = apiBaseUrl.replace(/\/+$/, '');
        endpointsToTry.push(`${cleanBase}/api/ad-narratives`);
      }
      if (!endpointsToTry.includes('/api/ad-narratives')) {
        endpointsToTry.push('/api/ad-narratives');
      }

      for (const endpoint of endpointsToTry) {
        try {
          const response = await fetch(endpoint, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(record)
          });
          if (response.ok) {
            const resJson = await response.json();
            console.log(`[AD_Narratives DB] Saved via ${endpoint}:`, resJson);
          }
        } catch (fetchErr) {
          console.warn(`[AD_Narratives DB] Endpoint ${endpoint} unreachable:`, fetchErr);
        }
      }
    } catch {
      // Offline fallback: Client-side authoritative table record remains intact
    }

    setDbSaveState('saved');
    setTimeout(() => {
      setDbSaveState('idle');
    }, 3000);
  }, [uniqueId, personId, mahadashaLord, antardashaLord, startDate, endDate, lifePeriod, primaryDomains, keyMilestones, sourceModel, apiBaseUrl]);

  // USER ACTION FLOW:
  // 1. Call local LLM to generate narrative
  // 2. Show on screen immediately
  // 3. Once generated, automatically update the AD_Narratives table
  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMessage('');
    try {
      // Step 1: Call Local LLM
      const generated = await generateAntardashaNarrative(
        apiBaseUrl,
        personId,
        adIdentity,
        promptText || customPromptOverride,
        pdFeeds
      );

      // Step 2: Show in screen immediately
      setNarrative(generated);
      setEditableNarrative(generated.narrative);
      setPromptText(generated.prompt);
      setSourceModel(generated.model || 'local_qwen');
      setIsEditingNarrative(false);

      if (onNarrativeGenerated) {
        onNarrativeGenerated(generated);
      }

      // Step 3: Automatically update AD_Narratives table in DB
      await commitToDatabase(generated.narrative, generated.model || 'local_qwen');

    } catch (err: any) {
      setErrorMessage(err.message || 'Could not generate MD-AD narrative.');
    } finally {
      setIsGenerating(false);
    }
  };

  // Toggle domain pill tag
  const handleToggleDomain = (domain: string) => {
    const updated = primaryDomains.includes(domain)
      ? primaryDomains.filter(d => d !== domain)
      : [...primaryDomains, domain];
    setPrimaryDomains(updated);
  };

  // Manual save action
  const handleManualSave = async () => {
    await commitToDatabase(editableNarrative, sourceModel);
  };

  // Toggle prompt editor
  const handleTogglePrompt = async () => {
    if (showPrompt) {
      setShowPrompt(false);
      return;
    }
    setShowPrompt(true);
    if (!promptText) {
      setPromptLoading(true);
      try {
        const preview = await previewAntardashaNarrativePrompt(
          apiBaseUrl,
          personId,
          adIdentity,
          pdFeeds
        );
        setPromptText(preview);
      } catch (err: any) {
        setErrorMessage(err.message || 'Could not preview the MD-AD prompt.');
      } finally {
        setPromptLoading(false);
      }
    }
  };

  const handleSavePrompt = () => {
    if (!promptText.trim()) return;
    const key = JSON.stringify([personId, mahadashaLord, antardashaLord, startDate, endDate]);
    storeAntardashaPromptOverride(key, promptText.trim());
    setPromptSaved(true);
    setTimeout(() => setPromptSaved(false), 2500);
  };

  const handleResetPrompt = async () => {
    const key = JSON.stringify([personId, mahadashaLord, antardashaLord, startDate, endDate]);
    removeAntardashaPromptOverride(key);
    setPromptLoading(true);
    try {
      const preview = await previewAntardashaNarrativePrompt(
        apiBaseUrl,
        personId,
        adIdentity,
        pdFeeds
      );
      setPromptText(preview);
      setPromptSaved(false);
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not reset prompt.');
    } finally {
      setPromptLoading(false);
    }
  };

  return (
    <div className="my-2.5 rounded-xl border border-cyan-500/30 bg-slate-950/80 p-3.5 sm:p-5 space-y-4 shadow-md transition-all">
      {/* 1. Header & Quick Controls */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-slate-800/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>{cleanMd} MD &rsaquo; {cleanAd} AD Narrative</span>
            </span>
            <span className="font-mono text-[11px] text-cyan-300 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50" title="AD_Narratives UniqueID">
              ID: {uniqueId}
            </span>
            {lastSavedAt && (
              <span className="inline-flex items-center gap-1 rounded bg-emerald-500/10 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                Table Synced
              </span>
            )}
          </div>
          <p className="text-xs text-slate-400">
            {startDate} to {endDate} &bull; {activeFeedsWithNotes.length} of {pdFeeds.length} PD feeds recorded
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isGenerating}
            onClick={handleGenerate}
            className="inline-flex items-center gap-1.5 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/25 transition cursor-pointer disabled:opacity-50 shadow-sm"
          >
            <Sparkles className={`h-3.5 w-3.5 ${isGenerating ? 'animate-spin text-cyan-400' : 'text-cyan-400'}`} />
            <span>{isGenerating ? 'Synthesizing...' : narrative ? 'Regenerate Narrative' : 'Generate Narrative'}</span>
          </button>

          <button
            type="button"
            onClick={handleManualSave}
            disabled={dbSaveState === 'saving'}
            className="inline-flex items-center gap-1.5 rounded-lg border border-emerald-600/50 bg-emerald-600/20 px-3 py-1.5 text-xs font-semibold text-emerald-200 hover:bg-emerald-600/30 transition cursor-pointer disabled:opacity-50"
          >
            {dbSaveState === 'saving' ? (
              <Sparkles className="w-3.5 h-3.5 animate-spin text-emerald-400" />
            ) : dbSaveState === 'saved' ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
            ) : (
              <Save className="w-3.5 h-3.5 text-emerald-400" />
            )}
            <span>{dbSaveState === 'saving' ? 'Updating DB...' : dbSaveState === 'saved' ? 'Saved to DB!' : 'Update DB'}</span>
          </button>
          
          <button
            type="button"
            onClick={handleTogglePrompt}
            className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-800 transition cursor-pointer"
          >
            <Eye className="h-3.5 w-3.5 text-slate-400" />
            <span>{showPrompt ? 'Hide Prompt' : 'Prompt'}</span>
          </button>

          {activeNarrativeText && (
            <button
              type="button"
              onClick={() => setIsEditingNarrative(!isEditingNarrative)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                isEditingNarrative
                  ? 'border-amber-500/60 bg-amber-500/20 text-amber-200'
                  : 'border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800'
              }`}
              title="Toggle direct text edit mode"
            >
              <Edit3 className="h-3.5 w-3.5 text-amber-400" />
              <span>{isEditingNarrative ? 'Done Editing' : 'Edit Text'}</span>
            </button>
          )}

          {activeNarrativeText && !isEditingNarrative && (
            <button
              type="button"
              onClick={() => setIsHighlightEnabled(!isHighlightEnabled)}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition cursor-pointer ${
                isHighlightEnabled
                  ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-200'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle PD Planetary Color Highlighting"
            >
              <Palette className="h-3.5 w-3.5 text-indigo-400" />
              <span>Highlights: {isHighlightEnabled ? 'ON' : 'OFF'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. AD_NARRATIVES TABLE ATTRIBUTES: Life Period (10 Stages) & Primary Domains & Key Milestones */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-3.5 bg-slate-900/60 border border-slate-800/80 p-3 rounded-xl">
        {/* Column A: Life Period (10 Stages Dropdown) */}
        <div className="md:col-span-4 space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Clock className="w-3.5 h-3.5 text-amber-400" />
              <span>Life Period (10 Stages)</span>
            </span>
            <span className="text-[10px] text-amber-300 font-mono">LLM Tag</span>
          </label>
          <select
            value={lifePeriod}
            onChange={(e) => setLifePeriod(e.target.value)}
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-amber-400 cursor-pointer font-medium"
          >
            {LIFE_PERIOD_OPTIONS.map((stage) => (
              <option key={stage} value={stage}>
                {stage}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-slate-500">
            Native stage during {startDate.slice(0, 4)} &ndash; {endDate.slice(0, 4)}
          </p>
        </div>

        {/* Column B: Primary Domains (Multi-Select Tags) */}
        <div className="md:col-span-8 space-y-1.5">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-cyan-400" />
              <span>Primary Domains (Select All That Apply)</span>
            </span>
            <span className="text-[10px] text-cyan-300 font-mono">
              {primaryDomains.length} selected
            </span>
          </label>
          <div className="flex flex-wrap gap-1.5">
            {PRIMARY_DOMAIN_OPTIONS.map((domain) => {
              const isSelected = primaryDomains.includes(domain);
              return (
                <button
                  key={domain}
                  type="button"
                  onClick={() => handleToggleDomain(domain)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition cursor-pointer border ${
                    isSelected
                      ? 'bg-cyan-500/20 text-cyan-200 border-cyan-400/70 shadow-sm'
                      : 'bg-slate-950/70 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  {domain}
                </button>
              );
            })}
          </div>
        </div>

        {/* Row 2: Key Milestones (Summary Input) */}
        <div className="md:col-span-12 space-y-1.5 pt-1 border-t border-slate-800/60">
          <label className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span className="flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-emerald-400" />
              <span>Key Milestones & Landmark Summary</span>
            </span>
            <span className="text-[10px] text-slate-400">Brief highlights for rapid model recall</span>
          </label>
          <input
            type="text"
            value={keyMilestones}
            onChange={(e) => setKeyMilestones(e.target.value)}
            placeholder="e.g. Higher education graduation, relocation abroad, first major software promotion..."
            className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-400"
          />
        </div>
      </div>

      {/* 3. Error Alert */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-950/50 border border-rose-500/40 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 4. Prompt Preview / Edit Drawer */}
      {showPrompt && (
        <div className="rounded-xl border border-slate-800 bg-slate-900/95 p-3.5 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h6 className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              Prompt Sent to Local LLM ({sourceModel} / Ollama)
            </h6>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSavePrompt}
                className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] font-semibold text-emerald-200 hover:bg-emerald-500/20 cursor-pointer"
              >
                <Save className="h-3 w-3" />
                {promptSaved ? 'Saved!' : 'Save Custom Prompt'}
              </button>
              <button
                type="button"
                onClick={handleResetPrompt}
                className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[11px] font-semibold text-slate-300 hover:bg-slate-700 cursor-pointer"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>
          </div>
          {promptLoading ? (
            <p className="text-xs text-slate-400 animate-pulse">Building prompt from latest PD notes...</p>
          ) : (
            <textarea
              aria-label="MD-AD Prompt Editor"
              rows={6}
              value={promptText}
              onChange={e => setPromptText(e.target.value)}
              className="w-full resize-y rounded-lg border border-slate-800 bg-slate-950 p-2.5 font-mono text-xs leading-relaxed text-slate-200 focus:border-cyan-500 focus:outline-none"
              placeholder="Prompt for this Antardasha..."
            />
          )}
          <p className="text-[11px] text-slate-400">
            Ground-truth prompt incorporates each PD's start/end dates, ratings (Red 0, Yellow 5, Green 10), and landmark notes.
          </p>
        </div>
      )}

      {/* 5. Planetary Color Legend Bar */}
      {activeNarrativeText && isHighlightEnabled && !isEditingNarrative && (
        <div className="rounded-lg border border-slate-800/80 bg-slate-900/60 p-2 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-400">
            <span className="font-semibold text-slate-300 flex items-center gap-1">
              <Palette className="w-3 h-3 text-cyan-400" />
              PD Color Legend (Click to filter):
            </span>
            {selectedGrahaFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedGrahaFilter('ALL')}
                className="text-cyan-400 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <ListFilter className="w-3 h-3" /> Show All
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(GRAHA_COLOR_CONFIGS) as GrahaLord[]).map(lord => {
              const cfg = GRAHA_COLOR_CONFIGS[lord];
              const isSelected = selectedGrahaFilter === lord;
              const hasPdNote = pdFeeds.some(f => f.pratyantardasha_lord.toLowerCase() === lord.toLowerCase() && f.notes);

              return (
                <button
                  key={lord}
                  type="button"
                  onClick={() => setSelectedGrahaFilter(isSelected ? 'ALL' : lord)}
                  className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-medium transition cursor-pointer ${
                    isSelected ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-slate-950' : ''
                  } ${cfg.pillClass} ${!hasPdNote ? 'opacity-70' : ''}`}
                  title={`${cfg.displayName}: ${cfg.description}${hasPdNote ? ' (Has recorded notes)' : ''}`}
                >
                  <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
                  <span>{cfg.displayName}</span>
                  {hasPdNote && <span className="text-[9px] opacity-75">&starf;</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 6. Rendered Narrative Text / Direct Editor */}
      {isEditingNarrative ? (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5" />
              <span>Direct Narrative Editor (AD_Narratives CLOB Column)</span>
            </label>
            <span className="text-[11px] text-slate-400">Unlimited text</span>
          </div>
          <textarea
            rows={8}
            value={editableNarrative}
            onChange={(e) => setEditableNarrative(e.target.value)}
            placeholder="Write or refine the full narrative for this Antardasha period..."
            className="w-full resize-y rounded-xl border border-amber-500/40 bg-slate-950 p-3 text-xs leading-relaxed text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
          />
          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={handleManualSave}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold transition cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>Save Text to DB</span>
            </button>
          </div>
        </div>
      ) : activeNarrativeText ? (
        <div className="rounded-xl border border-slate-800/90 bg-slate-900/50 p-3.5 sm:p-4 space-y-2.5">
          {isHighlightEnabled ? (
            <div className="text-xs sm:text-[13px] leading-relaxed space-y-2 text-slate-200">
              {parsedSegments.map(seg => {
                const isFilteredOut = selectedGrahaFilter !== 'ALL' && seg.attributedLord !== selectedGrahaFilter;
                const isHovered = hoveredSegmentId === seg.id;
                const lordConfig = seg.attributedLord ? GRAHA_COLOR_CONFIGS[seg.attributedLord] : null;

                if (!lordConfig || isFilteredOut) {
                  return (
                    <span
                      key={seg.id}
                      className={`transition-opacity ${isFilteredOut ? 'opacity-30' : 'text-slate-300'}`}
                    >
                      {seg.text}{' '}
                    </span>
                  );
                }

                return (
                  <span
                    key={seg.id}
                    onMouseEnter={() => setHoveredSegmentId(seg.id)}
                    onMouseLeave={() => setHoveredSegmentId(null)}
                    className={`inline cursor-pointer rounded px-1.5 py-0.5 my-0.5 transition-all relative group ${
                      lordConfig.highlightClass
                    } ${isHovered ? 'ring-1 ring-cyan-400' : ''}`}
                  >
                    <span className="font-semibold mr-1 inline-flex items-center gap-1">
                      <span className={`inline-block w-2 h-2 rounded-full ${lordConfig.dotClass}`} />
                      {seg.attributedLord}:
                    </span>
                    <span>{seg.text}</span>{' '}

                    {/* Interactive Tooltip on hover */}
                    {seg.matchedFeed && isHovered && (
                      <span className="absolute bottom-full left-0 mb-1 z-30 w-72 rounded-md border border-slate-700 bg-slate-950 p-2.5 text-[11px] shadow-xl text-left pointer-events-none">
                        <span className="block font-bold text-white flex items-center justify-between">
                          <span className="flex items-center gap-1.5">
                            <span className={`w-2 h-2 rounded-full ${lordConfig.dotClass}`} />
                            {seg.attributedLord} PD Ground-Truth Feed
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {seg.matchedFeed.start_date}
                          </span>
                        </span>
                        <span className="block text-slate-300 mt-1 italic">
                          "{seg.matchedFeed.notes || 'No landmark note text'}"
                        </span>
                        <span className="block text-[10px] text-slate-400 mt-1">
                          Rating: {seg.matchedFeed.evaluation_rating === 10 ? 'Green 10 (Good)' : seg.matchedFeed.evaluation_rating === 0 ? 'Red 0 (Bad)' : seg.matchedFeed.evaluation_rating === 5 ? 'Yellow 5 (Average)' : 'Unrated'}
                        </span>
                      </span>
                    )}
                  </span>
                );
              })}
            </div>
          ) : (
            <p className="whitespace-pre-line text-xs sm:text-[13px] leading-relaxed text-slate-200">
              {activeNarrativeText}
            </p>
          )}

          {/* Model info & metadata bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[11px] text-slate-400 font-mono">
            <span className="flex items-center gap-1.5">
              <span>Model:</span>
              <span className="text-cyan-300 font-bold">{sourceModel}</span>
            </span>
            {lastSavedAt && (
              <span className="flex items-center gap-1 text-slate-500">
                <Database className="w-3 h-3 text-emerald-400" />
                <span>DB Synced: {new Date(lastSavedAt).toLocaleString()}</span>
              </span>
            )}
          </div>
        </div>
      ) : isGenerating ? (
        <div className="rounded-xl border border-cyan-500/30 bg-cyan-950/20 p-5 text-center text-xs text-cyan-200 space-y-2">
          <Sparkles className="inline-block w-5 h-5 animate-spin text-cyan-400" />
          <p className="font-semibold text-white">Synthesizing narrative from recorded PD landmark notes...</p>
          <p className="text-[11px] text-cyan-300/80">Once generated, it will immediately display on screen and auto-commit to the AD_Narratives table.</p>
        </div>
      ) : null}
    </div>
  );
};
