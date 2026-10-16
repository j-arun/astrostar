import React, { useState, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  FileText,
  Calendar,
  ChevronRight,
  ChevronDown,
  Globe,
  FileCode,
  Download,
  ExternalLink,
  Sparkles,
  CheckCircle2,
  RefreshCw,
  Search,
  HardDrive,
  Eye,
  Server,
  Layers,
  ChevronLeft
} from 'lucide-react';
import {
  fetchDocsCatalog,
  loadReportFromServerDocs,
  saveReportToServerDocs,
  DocsCatalogResponse,
  STANDARD_REASONING_ENGINES,
  DocReportEntry
} from '../services/docsStorageService';
import { VedicHouseContext, LLMThreePartNarrative } from '../services/llm/types';

interface DocsBreadcrumbSidebarProps {
  currentYear?: number;
  currentMonthIndex?: number; // 0-11
  currentContext?: VedicHouseContext;
  currentNarrative?: LLMThreePartNarrative | null;
  onLoadReportIntoApp?: (narrative: LLMThreePartNarrative, context: VedicHouseContext) => void;
  className?: string;
  isCollapsible?: boolean;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const DocsBreadcrumbSidebar: React.FC<DocsBreadcrumbSidebarProps> = ({
  currentYear = 2026,
  currentMonthIndex = 9,
  currentContext,
  currentNarrative,
  onLoadReportIntoApp,
  className = '',
  isCollapsible = true
}) => {
  const [catalogData, setCatalogData] = useState<DocsCatalogResponse | null>(null);
  const [isLoadingCatalog, setIsLoadingCatalog] = useState<boolean>(true);
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);
  const [selectedMonthName, setSelectedMonthName] = useState<string>(MONTH_NAMES[currentMonthIndex] || 'October');
  const [selectedEngineKey, setSelectedEngineKey] = useState<string>('claude_sonnet');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isSavingCurrent, setIsSavingCurrent] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);

  // Load catalog on mount
  const refreshCatalog = async () => {
    setIsLoadingCatalog(true);
    try {
      const cat = await fetchDocsCatalog();
      setCatalogData(cat);
    } catch (e) {
      console.error('Error loading docs catalog:', e);
    } finally {
      setIsLoadingCatalog(false);
    }
  };

  useEffect(() => {
    refreshCatalog();
  }, []);

  // Update selected year/month if props change
  useEffect(() => {
    if (currentYear) setSelectedYear(currentYear);
    if (currentMonthIndex !== undefined && MONTH_NAMES[currentMonthIndex]) {
      setSelectedMonthName(MONTH_NAMES[currentMonthIndex]);
    }
  }, [currentYear, currentMonthIndex]);

  // Handle saving current active narrative into the server docs folder
  const handleSaveCurrentToDocs = async () => {
    if (!currentContext || !currentNarrative) return;
    setIsSavingCurrent(true);
    setSaveSuccessMsg(null);
    try {
      const res = await saveReportToServerDocs(currentContext, currentNarrative);
      if (res.success) {
        setSaveSuccessMsg('✓ Saved to server docs/ folder!');
        await refreshCatalog();
        setTimeout(() => setSaveSuccessMsg(null), 3500);
      } else {
        setSaveSuccessMsg(`Failed: ${res.error}`);
        setTimeout(() => setSaveSuccessMsg(null), 4000);
      }
    } catch (e: any) {
      setSaveSuccessMsg(`Error: ${e.message}`);
      setTimeout(() => setSaveSuccessMsg(null), 4000);
    } finally {
      setIsSavingCurrent(false);
    }
  };

  // Handle clicking "View in App" for a saved report
  const handleLoadReport = async (year: number, monthName: string, engineKey: string) => {
    try {
      const res = await loadReportFromServerDocs(year, monthName, engineKey);
      if (res && onLoadReportIntoApp) {
        onLoadReportIntoApp(res.narrative, res.context);
        setSelectedEngineKey(engineKey);
        setSelectedYear(year);
        setSelectedMonthName(monthName);
      }
    } catch (err) {
      console.error('Failed to load report:', err);
    }
  };

  const yearsList = catalogData?.years || [2020, 2022, 2023, 2024, 2025, 2026, 2027];
  const activeYearData = catalogData?.catalog[selectedYear];
  const activeMonthData = activeYearData?.months[selectedMonthName];

  // If collapsed, show a slim toggle bar
  if (isCollapsed) {
    return (
      <div className={`bg-slate-950 border-r border-slate-800 p-2 flex flex-col items-center justify-between text-slate-400 ${className}`}>
        <button
          onClick={() => setIsCollapsed(false)}
          className="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-amber-400 border border-slate-700/80 transition cursor-pointer"
          title="Expand Year-Wise Docs Navigation & Breadcrumbs"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
        <div className="py-6 flex flex-col items-center gap-4 text-xs font-mono font-bold writing-mode-vertical">
          <span className="text-amber-400">DOCS ARCHIVE</span>
          <span className="text-slate-300">{selectedYear}</span>
          <span className="text-slate-400">{selectedMonthName}</span>
        </div>
        <button
          onClick={refreshCatalog}
          className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-500 hover:text-slate-300 transition"
          title="Refresh Catalog"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <aside className={`w-80 md:w-96 bg-slate-950 border-r border-slate-800/90 flex flex-col h-full text-slate-200 select-none shadow-xl ${className}`}>
      {/* 1. TOP HEADER & BREADCRUMB TRAIL */}
      <div className="p-3.5 border-b border-slate-800/80 bg-slate-900/80 space-y-2.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <HardDrive className="w-3.5 h-3.5" />
            </div>
            <span className="text-xs font-bold text-white tracking-wide uppercase">
              Web Server Docs Archive
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={refreshCatalog}
              disabled={isLoadingCatalog}
              className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-amber-300 transition cursor-pointer"
              title="Refresh Reports Catalog from Server"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoadingCatalog ? 'animate-spin text-amber-400' : ''}`} />
            </button>
            {isCollapsible && (
              <button
                onClick={() => setIsCollapsed(true)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition cursor-pointer"
                title="Collapse Sidebar"
              >
                <ChevronLeft className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* INTERACTIVE BREADCRUMB BAR */}
        <div className="flex items-center gap-1 text-[11px] font-mono bg-slate-950 px-2.5 py-1.5 rounded-lg border border-slate-800 overflow-x-auto whitespace-nowrap scrollbar-none">
          <button
            onClick={() => {}}
            className="text-amber-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
          >
            <Folder className="w-3 h-3 text-amber-400" />
            <span>docs</span>
          </button>
          <span className="text-slate-600">/</span>

          {/* Year Breadcrumb */}
          <span className="text-cyan-300 font-bold">
            {selectedYear}
          </span>
          <span className="text-slate-600">/</span>

          {/* Month Breadcrumb */}
          <span className="text-purple-300 font-bold">
            {selectedMonthName}
          </span>
          <span className="text-slate-600">/</span>

          {/* Active Engine */}
          <span className="text-emerald-400 font-bold truncate max-w-[100px]" title={selectedEngineKey}>
            {selectedEngineKey.replace('claude_', '').replace('gemini_', '').replace('fable_', '')}
          </span>
        </div>

        {/* Quick Search filter */}
        <div className="relative">
          <Search className="w-3 h-3 text-slate-500 absolute left-2.5 top-2.5" />
          <input
            type="text"
            placeholder="Filter year, month, or engine..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-7 pr-2.5 py-1 text-[11px] text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-500/50"
          />
        </div>
      </div>

      {/* 2. MAIN NAVIGATION TREE: YEARS -> MONTHS -> 4 ENGINES */}
      <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
        {/* YEAR SELECTION STRIP (Starts from 2022 & includes 2020 as requested) */}
        <div>
          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-[10.5px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
              <Calendar className="w-3 h-3 text-amber-400" />
              <span>Year-Wise Navigation</span>
            </span>
            <span className="text-[10px] text-slate-500">From 2022+</span>
          </div>

          <div className="grid grid-cols-4 gap-1.5 bg-slate-900/60 p-1.5 rounded-xl border border-slate-800/80">
            {yearsList.map(y => {
              const isSelected = selectedYear === y;
              const hasReports = catalogData?.catalog[y] && Object.keys(catalogData.catalog[y].months).length > 0;
              return (
                <button
                  key={y}
                  onClick={() => setSelectedYear(y)}
                  className={`py-1 px-1.5 rounded-lg text-center font-mono text-xs font-bold transition cursor-pointer relative ${
                    isSelected
                      ? 'bg-amber-500 text-slate-950 shadow-sm font-extrabold'
                      : hasReports
                      ? 'bg-slate-800/90 text-amber-300 hover:bg-slate-800 border border-amber-500/30'
                      : 'bg-slate-950/80 text-slate-400 hover:text-slate-200 hover:bg-slate-800/50 border border-slate-800/60'
                  }`}
                >
                  <span>{y}</span>
                  {hasReports && !isSelected && (
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-amber-400 ring-2 ring-slate-950 animate-pulse" />
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* MONTH TABS UNDER SELECTED YEAR */}
        <div>
          <div className="flex items-center justify-between mb-1.5 px-1">
            <span className="text-[10.5px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
              <FolderOpen className="w-3 h-3 text-cyan-400" />
              <span>Months for {selectedYear}</span>
            </span>
            {activeYearData && Object.keys(activeYearData.months).length > 0 && (
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.2 rounded border border-emerald-500/20">
                {Object.keys(activeYearData.months).length} Active Month{Object.keys(activeYearData.months).length > 1 ? 's' : ''}
              </span>
            )}
          </div>

          <div className="grid grid-cols-3 gap-1 bg-slate-900/40 p-1.5 rounded-xl border border-slate-800/60">
            {MONTH_NAMES.map((mName, idx) => {
              const isSelected = selectedMonthName === mName;
              const monthData = activeYearData?.months[mName];
              const reportCount = monthData ? Object.keys(monthData.reports).length : 0;

              return (
                <button
                  key={mName}
                  onClick={() => setSelectedMonthName(mName)}
                  className={`py-1.5 px-1 rounded-lg text-center text-[11px] font-semibold transition cursor-pointer flex flex-col items-center justify-center gap-0.5 ${
                    isSelected
                      ? 'bg-cyan-500 text-slate-950 font-bold shadow'
                      : reportCount > 0
                      ? 'bg-slate-800/90 text-slate-100 hover:bg-slate-800 border border-cyan-500/40 font-bold'
                      : 'bg-slate-950/60 text-slate-400 hover:text-slate-200 hover:bg-slate-900 border border-slate-800/40'
                  }`}
                >
                  <span className="truncate">{mName.slice(0, 3)}</span>
                  {reportCount > 0 ? (
                    <span className={`text-[9px] font-mono px-1 rounded ${isSelected ? 'bg-slate-950 text-cyan-300' : 'bg-cyan-500/20 text-cyan-300'}`}>
                      {reportCount} runs
                    </span>
                  ) : (
                    <span className="text-[8.5px] opacity-40">-</span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. FOUR REASONING ENGINE LINKS FOR SELECTED MONTH */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <span className="text-[10.5px] uppercase font-bold tracking-wider text-slate-400 flex items-center gap-1">
              <Layers className="w-3 h-3 text-purple-400" />
              <span>4 Reasoning Engine Reports</span>
            </span>
            <span className="text-[10px] text-slate-500">
              {selectedMonthName} {selectedYear}
            </span>
          </div>

          {/* List the 4 Standard Engines */}
          <div className="space-y-2">
            {STANDARD_REASONING_ENGINES.map((engine) => {
              const reportEntry: DocReportEntry | undefined = activeMonthData?.reports[engine.key];
              const isEngineActive = selectedEngineKey === engine.key;

              // Color classes based on engine
              const borderColor =
                engine.key === 'claude_iq'
                  ? 'border-emerald-500/40 hover:border-emerald-400'
                  : engine.key === 'claude_fable'
                  ? 'border-indigo-500/40 hover:border-indigo-400'
                  : engine.key === 'claude_sonnet'
                  ? 'border-amber-500/40 hover:border-amber-400'
                  : engine.key === 'gemini_pro'
                  ? 'border-cyan-500/40 hover:border-cyan-400'
                  : 'border-purple-500/40 hover:border-purple-400';

              const badgeColor =
                engine.key === 'claude_iq'
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : engine.key === 'claude_fable'
                  ? 'bg-indigo-500/10 text-indigo-300 border-indigo-500/30'
                  : engine.key === 'claude_sonnet'
                  ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                  : engine.key === 'gemini_pro'
                  ? 'bg-cyan-500/10 text-cyan-300 border-cyan-500/30'
                  : 'bg-purple-500/10 text-purple-300 border-purple-500/30';

              return (
                <div
                  key={engine.key}
                  className={`bg-slate-900 border rounded-xl p-3 transition shadow-sm space-y-2.5 ${borderColor} ${
                    isEngineActive ? 'ring-1 ring-amber-400/50 bg-slate-900/95' : ''
                  }`}
                >
                  {/* Engine Title Bar */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">
                        {engine.categoryLabel}
                      </span>
                      <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${badgeColor}`}>
                        {engine.name}
                      </span>
                    </div>

                    {reportEntry ? (
                      <span className="text-[10px] font-mono text-emerald-400 flex items-center gap-1">
                        <CheckCircle2 className="w-3 h-3 text-emerald-400" />
                        <span>Available</span>
                      </span>
                    ) : (
                      <span className="text-[10px] font-mono text-slate-500">
                        Not Run Yet
                      </span>
                    )}
                  </div>

                  {/* Summary Snippet if available */}
                  {reportEntry?.summarySentence && (
                    <p className="text-[11px] text-slate-300 line-clamp-2 leading-relaxed bg-slate-950/60 p-2 rounded-lg border border-slate-800/80">
                      {reportEntry.summarySentence}
                    </p>
                  )}

                  {/* 3 DIRECT LINKS: HTML, PDF, WORD + IN-APP VIEW */}
                  <div className="pt-1 border-t border-slate-800/60 flex flex-wrap items-center gap-1.5">
                    {/* 1. HTML LINK */}
                    <a
                      href={reportEntry?.htmlUrl || `/docs/${selectedYear}/${selectedMonthName}/${engine.key}/Tamil_Vedic_Report_${selectedMonthName}_${selectedYear}_${engine.key}.html`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 text-[11px] font-semibold transition cursor-pointer"
                      title="Open full standalone HTML dossier in new tab"
                    >
                      <Globe className="w-3 h-3 text-indigo-400" />
                      <span>HTML</span>
                    </a>

                    {/* 2. PDF LINK */}
                    <a
                      href={reportEntry?.pdfUrl || `/docs/${selectedYear}/${selectedMonthName}/${engine.key}/Tamil_Vedic_Report_${selectedMonthName}_${selectedYear}_${engine.key}.pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      download
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-rose-500/10 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-[11px] font-semibold transition cursor-pointer"
                      title="Download PDF version from server"
                    >
                      <FileText className="w-3 h-3 text-rose-400" />
                      <span>PDF</span>
                    </a>

                    {/* 3. WORD LINK */}
                    <a
                      href={reportEntry?.docUrl || `/docs/${selectedYear}/${selectedMonthName}/${engine.key}/Tamil_Vedic_Report_${selectedMonthName}_${selectedYear}_${engine.key}.doc`}
                      download
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-sky-500/10 hover:bg-sky-500/20 text-sky-300 border border-sky-500/30 text-[11px] font-semibold transition cursor-pointer"
                      title="Download Word (.doc) version from server"
                    >
                      <FileCode className="w-3 h-3 text-sky-400" />
                      <span>Word</span>
                    </a>

                    {/* 4. IN-APP LOAD BUTTON */}
                    <button
                      onClick={() => handleLoadReport(selectedYear, selectedMonthName, engine.key)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded-md bg-amber-500/10 hover:bg-amber-500/20 text-amber-300 hover:text-amber-200 border border-amber-500/30 text-[11px] font-semibold transition cursor-pointer ml-auto"
                      title="Load this report into the application viewer"
                    >
                      <Eye className="w-3 h-3 text-amber-400" />
                      <span>View in App</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* 4. FOOTER TOOLBAR: AUTO-SAVE TO SERVER DOCS */}
      <div className="p-3 bg-slate-900 border-t border-slate-800 space-y-2">
        {saveSuccessMsg && (
          <div className="text-[11px] text-emerald-400 font-semibold bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-1.5 rounded-lg text-center animate-in fade-in">
            {saveSuccessMsg}
          </div>
        )}

        <button
          onClick={handleSaveCurrentToDocs}
          disabled={isSavingCurrent || !currentNarrative}
          className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-bold text-xs shadow-md shadow-amber-500/10 transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          title="Save active report into the server /docs folder across HTML, PDF, and Word formats"
        >
          <Server className={`w-3.5 h-3.5 ${isSavingCurrent ? 'animate-spin' : ''}`} />
          <span>
            {isSavingCurrent
              ? 'Saving to Server docs/...'
              : 'Save Active Report to Server Docs'}
          </span>
        </button>

        <div className="text-[10px] text-slate-400 text-center leading-tight">
          Stores files to <code className="text-amber-300 font-mono">/docs/{selectedYear}/{selectedMonthName}/</code> on server
        </div>
      </div>
    </aside>
  );
};
