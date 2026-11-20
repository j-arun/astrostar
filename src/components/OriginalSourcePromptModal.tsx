import React, { useEffect, useMemo, useState } from 'react';
import {
  X,
  Copy,
  Check,
  Activity,
  Download,
  Layers,
  Calendar,
  Cpu,
  Sparkles,
  Briefcase,
  Coins,
  Heart,
  Home,
  Compass
} from 'lucide-react';
import { OriginalSourceDomain, VedicHouseContext } from '../services/llm/types';
import {
  buildOriginalSourcePrompt,
  OriginalSourceVariant
} from '../services/llm/originalSourcePrompt';
import { DOMAIN_PROMPT_SPECS } from '../data/vargaAndStrengthData';

interface OriginalSourcePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  buildContextForSelectedMonth: () => VedicHouseContext;
  selectedMonthName: string;
  selectedYear: number;
  initialDomain?: OriginalSourceDomain;
}

type PromptTab = 'full' | 'static' | 'month' | 'subprompt';

const DOMAIN_ORDER: OriginalSourceDomain[] = ['master', 'career', 'finance', 'love', 'family'];

const DOMAIN_ICONS: Record<OriginalSourceDomain, React.ReactNode> = {
  master: <Compass className="w-3.5 h-3.5" />,
  career: <Briefcase className="w-3.5 h-3.5" />,
  finance: <Coins className="w-3.5 h-3.5" />,
  love: <Heart className="w-3.5 h-3.5" />,
  family: <Home className="w-3.5 h-3.5" />
};

export const OriginalSourcePromptModal: React.FC<OriginalSourcePromptModalProps> = ({
  isOpen,
  onClose,
  buildContextForSelectedMonth,
  selectedMonthName,
  selectedYear,
  initialDomain = 'master'
}) => {
  const [selectedDomain, setSelectedDomain] = useState<OriginalSourceDomain>(initialDomain);
  const [variant, setVariant] = useState<OriginalSourceVariant>('compact');
  const [activeTab, setActiveTab] = useState<PromptTab>('full');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedDomain(initialDomain);
      setCopiedKey(null);
      if (initialDomain === 'master' && activeTab === 'subprompt') {
        setActiveTab('full');
      }
    }
  }, [isOpen, initialDomain]);

  const handleDomainSelect = (domain: OriginalSourceDomain) => {
    setSelectedDomain(domain);
    setCopiedKey(null);
    if (domain === 'master' && activeTab === 'subprompt') {
      setActiveTab('full');
    }
  };

  const generatedPair = useMemo(() => {
    if (!isOpen) return null;
    const ctx = buildContextForSelectedMonth();
    return {
      baseline: buildOriginalSourcePrompt(ctx, 'baseline', selectedDomain),
      compact: buildOriginalSourcePrompt(ctx, 'compact', selectedDomain)
    };
  }, [isOpen, buildContextForSelectedMonth, selectedMonthName, selectedYear, selectedDomain]);

  if (!isOpen || !generatedPair) return null;

  const domainSpec = DOMAIN_PROMPT_SPECS[selectedDomain];
  const generated = variant === 'compact' ? generatedPair.compact : generatedPair.baseline;
  const savedTokens = Math.max(
    0,
    generatedPair.baseline.meta.estTokens - generatedPair.compact.meta.estTokens
  );

  const displayedText =
    activeTab === 'static'
      ? generated.staticBlock
      : activeTab === 'month'
      ? generated.monthSlice
      : activeTab === 'subprompt'
      ? generated.subPromptBlock || 'Select Career, Finance, Love, or Family to view its attached Domain Sub-Prompt & Varga charts.'
      : generated.fullPrompt;

  const handleCopy = async (textToCopy: string, key: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2200);
    } catch {
      const ta = document.createElement('textarea');
      ta.value = textToCopy;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2200);
    }
  };

  const handleDownloadTxt = () => {
    const slug = `${selectedYear}_${selectedMonthName.toLowerCase()}_original_source_${selectedDomain}_${variant}.txt`;
    const blob = new Blob([generated.fullPrompt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = slug;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-3 sm:p-6"
      onClick={onClose}
    >
      <div
        className="w-full max-w-6xl max-h-[92vh] flex flex-col bg-slate-900 border border-slate-800 rounded-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-3.5 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-base font-bold text-white tracking-tight">
                  Original Source Prompt Builder
                </h3>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold tabular-nums bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {selectedMonthName} {selectedYear}
                </span>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-semibold bg-slate-800 text-slate-200 border border-slate-700">
                  {selectedDomain === 'master'
                    ? 'Master (D1 + D9)'
                    : `${domainSpec.shortLabel} (+ ${domainSpec.vargaCharts.join(', ')})`}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                {domainSpec.description}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTxt}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
              title="Download active Original Source prompt as .txt"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>.txt</span>
            </button>
            <button
              type="button"
              onClick={() => handleCopy(generated.fullPrompt, 'full')}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs transition cursor-pointer active:scale-95"
            >
              {copiedKey === 'full' ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied {domainSpec.shortLabel}!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy {selectedDomain === 'master' ? 'Master' : `${domainSpec.shortLabel} Prompt`}</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Prompt Type Selector: Master + 4 Domain Sub-Prompts */}
        <div className="px-5 py-2.5 bg-slate-900 border-b border-slate-800 flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {DOMAIN_ORDER.map((dom) => {
              const spec = DOMAIN_PROMPT_SPECS[dom];
              const isActive = selectedDomain === dom;
              return (
                <button
                  key={dom}
                  type="button"
                  onClick={() => handleDomainSelect(dom)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold border transition cursor-pointer ${
                    isActive
                      ? dom === 'master'
                        ? 'bg-sky-500/20 text-sky-200 border-sky-400/60'
                        : 'bg-emerald-500/20 text-emerald-200 border-emerald-400/60'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:text-slate-200 hover:border-slate-700'
                  }`}
                >
                  <span className={isActive ? (dom === 'master' ? 'text-sky-300' : 'text-emerald-300') : 'text-slate-500'}>
                    {DOMAIN_ICONS[dom]}
                  </span>
                  <span>{spec.shortLabel}</span>
                  <span className="font-mono text-[10px] opacity-75">
                    {dom === 'master' ? 'D1,D9' : `+${spec.vargaCharts.join(',')}`}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="text-[11px] font-mono text-slate-400">
            Focus: <span className="text-slate-200">{domainSpec.focusHouses.map(h => `H${h}`).join(', ')}</span>
            {' | '}Karakas: <span className="text-slate-200">{domainSpec.primaryKarakas.slice(0, 4).join(', ')}</span>
          </div>
        </div>

        {/* Format Variant & Section Tabs */}
        <div className="px-5 py-2 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => { setVariant('compact'); setCopiedKey(null); }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                variant === 'compact'
                  ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/50'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
              <span>Compact (LLM Readable)</span>
              <span className="ml-1 font-mono tabular-nums text-[10px] opacity-85">
                ~{generatedPair.compact.meta.estTokens.toLocaleString()} tok
              </span>
              {savedTokens > 0 && (
                <span className="ml-1 px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 font-mono tabular-nums text-[10px]">
                  -{savedTokens.toLocaleString()}
                </span>
              )}
            </button>

            <button
              type="button"
              onClick={() => { setVariant('baseline'); setCopiedKey(null); }}
              className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition cursor-pointer ${
                variant === 'baseline'
                  ? 'bg-sky-500/20 text-sky-200 border-sky-400/50'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-slate-200'
              }`}
            >
              <Cpu className="w-3.5 h-3.5 text-sky-400" />
              <span>Baseline (14B Private)</span>
              <span className="ml-1 font-mono tabular-nums text-[10px] opacity-85">
                ~{generatedPair.baseline.meta.estTokens.toLocaleString()} tok
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 bg-slate-900 p-0.5 rounded-lg border border-slate-800">
              <button
                type="button"
                onClick={() => setActiveTab('full')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'full'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Activity className="w-3 h-3" />
                <span>Full Prompt</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('static')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'static'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Layers className="w-3 h-3" />
                <span>Master Static</span>
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('month')}
                className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                  activeTab === 'month'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Calendar className="w-3 h-3" />
                <span>Month Slice</span>
              </button>
              {selectedDomain !== 'master' && (
                <button
                  type="button"
                  onClick={() => setActiveTab('subprompt')}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-semibold transition cursor-pointer ${
                    activeTab === 'subprompt'
                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {DOMAIN_ICONS[selectedDomain]}
                  <span>{domainSpec.shortLabel} Sub-Prompt</span>
                </button>
              )}
            </div>

            <div className="flex items-center gap-3 text-[11px] font-mono tabular-nums text-slate-400">
              <span>L:<strong className="text-slate-200">{displayedText.split('\n').length}</strong></span>
              <span>C:<strong className="text-slate-200">{displayedText.length.toLocaleString()}</strong></span>
              <span>~Tok:<strong className="text-emerald-300">{Math.ceil(displayedText.length / 4).toLocaleString()}</strong></span>
              {activeTab !== 'full' && (
                <button
                  type="button"
                  onClick={() => handleCopy(displayedText, activeTab)}
                  className="flex items-center gap-1 px-2 py-1 rounded-md bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-sans font-bold text-[11px] cursor-pointer"
                >
                  {copiedKey === activeTab ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedKey === activeTab ? 'Copied!' : 'Copy View'}</span>
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Prompt Content Viewer */}
        <div className="flex-1 overflow-auto p-4 sm:p-5 bg-slate-950 font-mono text-xs text-slate-200 select-text">
          <pre className="whitespace-pre-wrap leading-relaxed">{displayedText}</pre>
        </div>

        {/* Footer */}
        <div className="px-5 py-2.5 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>
            Rules loaded from{' '}
            <code className="text-emerald-300">
              {variant === 'baseline'
                ? 'src/services/llm/originalSourceRulesBaseline.txt'
                : 'src/services/llm/originalSourceRules.txt'}
            </code>
            {' '}| Same unified engine powers UI &amp; <code className="text-emerald-300">GET /api/content?domain={selectedDomain}&amp;variant={variant}</code>
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
