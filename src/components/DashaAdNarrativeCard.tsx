import React, { useState, useMemo } from 'react';
import { Sparkles, Eye, Save, RotateCcw, CheckCircle2, AlertCircle, Info, ChevronDown, ChevronUp, Palette, ListFilter } from 'lucide-react';
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
  const [narrative, setNarrative] = useState<CachedAntardashaNarrative | undefined>(cachedNarrative);
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [showPrompt, setShowPrompt] = useState<boolean>(false);
  const [promptText, setPromptText] = useState<string>(customPromptOverride || '');
  const [promptLoading, setPromptLoading] = useState<boolean>(false);
  const [promptSaved, setPromptSaved] = useState<boolean>(false);
  const [isHighlightEnabled, setIsHighlightEnabled] = useState<boolean>(true);
  const [selectedGrahaFilter, setSelectedGrahaFilter] = useState<GrahaLord | 'ALL'>('ALL');
  const [hoveredSegmentId, setHoveredSegmentId] = useState<string | null>(null);
  const [highlightedFeedKey, setHighlightedFeedKey] = useState<string | null>(null);
  const [showAllFeedsInFooter, setShowAllFeedsInFooter] = useState<boolean>(false);

  const adIdentity: AntardashaNarrativeIdentity = useMemo(() => ({
    mahadasha_lord_md: mahadashaLord,
    antardasha_lord_ad: antardashaLord,
    start_date: startDate,
    end_date: endDate
  }), [mahadashaLord, antardashaLord, startDate, endDate]);

  // Filter PD feeds for this specific Antardasha
  const activeFeedsWithNotes = useMemo(() => {
    return pdFeeds.filter(feed => 
      (feed.notes && feed.notes.trim().length > 0) || feed.evaluation_rating !== null
    );
  }, [pdFeeds]);

  // Parse narrative into segments highlighted with planetary colors
  const parsedSegments: HighlightedSegment[] = useMemo(() => {
    if (!narrative?.narrative) return [];
    return parseNarrativeWithPdHighlights(narrative.narrative, pdFeeds);
  }, [narrative?.narrative, pdFeeds]);

  // Generate or regenerate narrative
  const handleGenerate = async () => {
    setIsGenerating(true);
    setErrorMessage('');
    try {
      const generated = await generateAntardashaNarrative(
        apiBaseUrl,
        personId,
        adIdentity,
        promptText || customPromptOverride,
        pdFeeds
      );
      setNarrative(generated);
      setPromptText(generated.prompt);
      if (onNarrativeGenerated) {
        onNarrativeGenerated(generated);
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Could not generate MD-AD narrative.');
    } finally {
      setIsGenerating(false);
    }
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
    <div className="my-2.5 rounded-lg border border-cyan-500/30 bg-slate-950/70 p-3 sm:p-4 space-y-3 shadow-md">
      {/* 1. Header & Controls */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-5 h-5 rounded-full bg-cyan-500/20 text-cyan-300 text-[11px] font-bold">
              AD
            </span>
            <h5 className="text-xs sm:text-sm font-bold text-white tracking-wide">
              <span className="text-amber-300">{mahadashaLord} MD</span> · <span className="text-cyan-300">{antardashaLord} AD</span> Summary
            </h5>
            {narrative && (
              <span className="hidden sm:inline-flex rounded border border-emerald-500/40 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
                Summary Ready
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-400 mt-0.5">
            {startDate} to {endDate} · {activeFeedsWithNotes.length} of {pdFeeds.length} PD feeds recorded
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={isGenerating}
            onClick={handleGenerate}
            className="inline-flex items-center gap-1.5 rounded-md border border-cyan-500/40 bg-cyan-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-cyan-200 hover:bg-cyan-500/20 transition disabled:opacity-50"
          >
            <Sparkles className={`h-3.5 w-3.5 ${isGenerating ? 'animate-pulse text-cyan-400' : ''}`} />
            {isGenerating ? 'Synthesizing...' : narrative ? 'Regenerate AD Summary' : 'Generate AD Summary'}
          </button>
          
          <button
            type="button"
            onClick={handleTogglePrompt}
            className="inline-flex items-center gap-1.5 rounded-md border border-slate-700 bg-slate-900 px-2.5 py-1.5 text-[11px] font-medium text-slate-300 hover:bg-slate-800 transition"
          >
            <Eye className="h-3.5 w-3.5" />
            {showPrompt ? 'Hide Prompt' : 'Prompt'}
          </button>

          {narrative && (
            <button
              type="button"
              onClick={() => setIsHighlightEnabled(!isHighlightEnabled)}
              className={`inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition ${
                isHighlightEnabled
                  ? 'border-indigo-500/50 bg-indigo-500/15 text-indigo-200'
                  : 'border-slate-800 bg-slate-900 text-slate-400 hover:text-slate-200'
              }`}
              title="Toggle PD Planetary Color Highlighting"
            >
              <Palette className="h-3.5 w-3.5" />
              <span>Highlights: {isHighlightEnabled ? 'ON' : 'OFF'}</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Error Message */}
      {errorMessage && (
        <div className="flex items-center gap-2 p-2.5 rounded-md bg-rose-950/40 border border-rose-500/30 text-rose-300 text-xs">
          <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* 3. Prompt Preview / Edit Drawer */}
      {showPrompt && (
        <div className="rounded-md border border-slate-800 bg-slate-900/90 p-3 space-y-2">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h6 className="text-[11px] font-semibold text-slate-300 flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-cyan-400" />
              Prompt Sent to Local LLM (Qwen 7B / Ollama)
            </h6>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSavePrompt}
                className="inline-flex items-center gap-1 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[10px] font-semibold text-emerald-200 hover:bg-emerald-500/20"
              >
                <Save className="h-3 w-3" />
                {promptSaved ? 'Saved!' : 'Save Custom Prompt'}
              </button>
              <button
                type="button"
                onClick={handleResetPrompt}
                className="inline-flex items-center gap-1 rounded border border-slate-700 bg-slate-800 px-2 py-1 text-[10px] font-semibold text-slate-300 hover:bg-slate-700"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            </div>
          </div>
          {promptLoading ? (
            <p className="text-[11px] text-slate-400 animate-pulse">Building prompt from latest PD notes...</p>
          ) : (
            <textarea
              aria-label="MD-AD Prompt Editor"
              rows={6}
              value={promptText}
              onChange={e => setPromptText(e.target.value)}
              className="w-full resize-y rounded border border-slate-800 bg-slate-950 p-2 font-mono text-[11px] leading-relaxed text-slate-200 focus:border-cyan-500 focus:outline-none"
              placeholder="Prompt for this Antardasha..."
            />
          )}
          <p className="text-[10px] text-slate-400">
            Ground-truth prompt incorporates each PD's start/end dates, ratings (Red 0, Yellow 5, Green 10), and landmark notes.
          </p>
        </div>
      )}

      {/* 4. Planetary Color Legend Bar (Moon: white, Ketu: light brown, Rahu: grey, Sat: black, Mars: red, Mercury: green, Venus: silver, Sun: orange, Jup: yellow) */}
      {narrative && isHighlightEnabled && (
        <div className="rounded-md border border-slate-800/80 bg-slate-900/50 p-2 space-y-1.5">
          <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-slate-400">
            <span className="font-semibold text-slate-300 flex items-center gap-1">
              <Palette className="w-3 h-3 text-cyan-400" />
              PD Color Legend (Click to filter):
            </span>
            {selectedGrahaFilter !== 'ALL' && (
              <button
                type="button"
                onClick={() => setSelectedGrahaFilter('ALL')}
                className="text-cyan-400 hover:underline flex items-center gap-1"
              >
                <ListFilter className="w-3 h-3" /> Show All
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(GRAHA_COLOR_CONFIGS) as GrahaLord[]).map(lord => {
              const cfg = GRAHA_COLOR_CONFIGS[lord];
              const isSelected = selectedGrahaFilter === lord;
              // Check if this lord is present in this AD's feeds
              const hasPdNote = pdFeeds.some(f => f.pratyantardasha_lord.toLowerCase() === lord.toLowerCase() && f.notes);

              return (
                <button
                  key={lord}
                  type="button"
                  onClick={() => setSelectedGrahaFilter(isSelected ? 'ALL' : lord)}
                  className={`inline-flex items-center gap-1.5 rounded border px-2 py-0.5 text-[10px] font-medium transition ${
                    isSelected ? 'ring-2 ring-cyan-400 ring-offset-1 ring-offset-slate-950' : ''
                  } ${cfg.pillClass} ${!hasPdNote ? 'opacity-70' : ''}`}
                  title={`${cfg.displayName}: ${cfg.description}${hasPdNote ? ' (Has recorded notes)' : ''}`}
                >
                  <span className={`w-2 h-2 rounded-full ${cfg.dotClass}`} />
                  <span>{cfg.displayName}</span>
                  {hasPdNote && <span className="text-[9px] opacity-75">★</span>}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 5. Rendered Narrative Text */}
      {narrative ? (
        <div className="rounded-md border border-slate-800/90 bg-slate-900/40 p-3 sm:p-3.5 space-y-2">
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
                    onMouseEnter={() => {
                      setHoveredSegmentId(seg.id);
                      if (seg.matchedFeed) {
                        setHighlightedFeedKey(`${seg.matchedFeed.start_date}-${seg.matchedFeed.pratyantardasha_lord}`);
                      }
                    }}
                    onMouseLeave={() => {
                      setHoveredSegmentId(null);
                      setHighlightedFeedKey(null);
                    }}
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
                      <span className="absolute bottom-full left-0 mb-1 z-30 w-72 rounded-md border border-slate-700 bg-slate-950 p-2 text-[11px] shadow-xl text-left pointer-events-none">
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
              {narrative.narrative}
            </p>
          )}

          {/* Model info & metadata */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800 text-[10px] text-slate-500">
            <span>Model: <code className="text-cyan-300 font-mono">{narrative.model}</code></span>
            <span>Generated: {new Date(narrative.generated_at).toLocaleString()}</span>
          </div>
        </div>
      ) : isGenerating ? (
        <div className="rounded-md border border-cyan-500/30 bg-cyan-950/20 p-4 text-center text-xs text-cyan-200">
          <Sparkles className="inline-block w-4 h-4 animate-spin mr-2 text-cyan-400" />
          Synthesizing {antardashaLord} AD narrative from recorded PD landmark notes...
        </div>
      ) : null}
    </div>
  );
};
