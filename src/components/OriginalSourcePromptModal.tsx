import React, { useMemo, useState } from 'react';
import { X, Copy, Check, Activity, Download, Layers, Calendar } from 'lucide-react';
import { VedicHouseContext } from '../services/llm/types';
import { buildOriginalSourcePrompt } from '../services/llm/originalSourcePrompt';

interface OriginalSourcePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  buildContextForSelectedMonth: () => VedicHouseContext;
  selectedMonthName: string;
  selectedYear: number;
}

type PromptTab = 'full' | 'static' | 'month';

export const OriginalSourcePromptModal: React.FC<OriginalSourcePromptModalProps> = ({
  isOpen,
  onClose,
  buildContextForSelectedMonth,
  selectedMonthName,
  selectedYear
}) => {
  const [activeTab, setActiveTab] = useState<PromptTab>('full');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const generated = useMemo(() => {
    if (!isOpen) return null;
    const ctx = buildContextForSelectedMonth();
    return buildOriginalSourcePrompt(ctx);
  }, [isOpen, buildContextForSelectedMonth, selectedMonthName, selectedYear]);

  if (!isOpen || !generated) return null;

  const displayedText =
    activeTab === 'static'
      ? generated.staticBlock
      : activeTab === 'month'
      ? generated.monthSlice
      : generated.fullPrompt;

  const handleCopy = async (textToCopy: string, key: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2200);
    } catch {
      // Fallback copy via temporary textarea
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
    const slug = `${selectedYear}_${selectedMonthName.toLowerCase()}_original_source.txt`;
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
        className="w-full max-w-5xl max-h-[90vh] flex flex-col bg-slate-900 border border-emerald-500/40 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/40 flex items-center justify-center text-emerald-400">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
                  Original Source (Original Heartbeat)
                </h3>
                <span className="px-2 py-0.5 rounded-md text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30">
                  {selectedMonthName} {selectedYear}
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Pure factual Vedic chart &amp; ephemeris prompt (S1–S6 Static + C1–C9 Month Slice) &bull; Ready to copy &amp; paste externally
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleDownloadTxt}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 text-xs font-semibold transition cursor-pointer"
              title="Download Original Source prompt as .txt"
            >
              <Download className="w-3.5 h-3.5 text-emerald-400" />
              <span>.txt</span>
            </button>
            <button
              type="button"
              onClick={() => handleCopy(generated.fullPrompt, 'full')}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold text-xs transition shadow-md shadow-emerald-500/20 cursor-pointer active:scale-95"
            >
              {copiedKey === 'full' ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Copied Full Prompt!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Full Prompt</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-toolbar: View Tabs & Telemetry */}
        <div className="px-5 py-2.5 bg-slate-900/90 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 bg-slate-950 p-1 rounded-xl border border-slate-800">
            <button
              type="button"
              onClick={() => setActiveTab('full')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'full'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Activity className="w-3.5 h-3.5" />
              <span>Full Prompt</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('static')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'static'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Static Block (S1–S6)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('month')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
                activeTab === 'month'
                  ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Month Slice (C1–C9)</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
            <span>Lines: <strong className="text-slate-200">{displayedText.split('\n').length}</strong></span>
            <span>Chars: <strong className="text-slate-200">{displayedText.length.toLocaleString()}</strong></span>
            <span>~Tokens: <strong className="text-emerald-300">{Math.ceil(displayedText.length / 4).toLocaleString()}</strong></span>
            {activeTab !== 'full' && (
              <button
                type="button"
                onClick={() => handleCopy(displayedText, activeTab)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-emerald-500/30 font-sans font-bold text-[11px] cursor-pointer"
              >
                {copiedKey === activeTab ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                <span>{copiedKey === activeTab ? 'Copied Section!' : `Copy ${activeTab === 'static' ? 'Static' : 'Month Slice'}`}</span>
              </button>
            )}
          </div>
        </div>

        {/* Prompt Content Viewer */}
        <div className="flex-1 overflow-auto p-4 sm:p-5 bg-slate-950 font-mono text-xs text-slate-200 select-text">
          <pre className="whitespace-pre-wrap leading-relaxed">{displayedText}</pre>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-900 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
          <span>
            Rules R0–R5 loaded from <code className="text-emerald-300">src/services/llm/originalSourceRules.txt</code> (edit to append R6, R7...)
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
