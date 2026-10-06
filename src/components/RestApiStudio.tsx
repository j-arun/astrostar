import React, { useState, useMemo, useEffect } from 'react';
import {
  Server,
  Play,
  Copy,
  Download,
  CheckCircle2,
  Calendar,
  Clock,
  Database,
  Sparkles,
  Code2,
  Search,
  ArrowRight,
  Terminal,
  RefreshCw,
  Hash,
  Table,
  Compass,
  AlertCircle,
  Globe,
  Orbit,
  Eye,
  FileText,
  ShieldCheck,
  Wifi,
  WifiOff,
  Activity,
  ChevronDown,
  ChevronUp,
  Layers
} from 'lucide-react';
import {
  HoroscopeApiResponse,
  UserQueryLog,
  executeHoroscopeTimelineQuery,
  normalizeDateString,
  generateLlmMarkdown,
  fetchHoroscopeFromApi,
  pingApiHealth,
  ApiFetchResult
} from '../data/apiService';
import { START_CMD_TEXT, START_SH_TEXT } from '../data/scriptData';

interface RestApiStudioProps {
  apiPersonId: string;
  setApiPersonId: (id: string) => void;
  apiStartDate: string;
  setApiStartDate: (d: string) => void;
  apiEndDate: string;
  setApiEndDate: (d: string) => void;
  apiResponse: HoroscopeApiResponse | null;
  setApiResponse: (res: HoroscopeApiResponse) => void;
  queryHistory: UserQueryLog[];
  setQueryHistory: React.Dispatch<React.SetStateAction<UserQueryLog[]>>;
  copyToClipboard: (text: string, label: string) => void;
  copied: string | null;
  downloadFile: (filename: string, content: string, type: string) => void;
}

// 27 Nakshatra Planetary Lord Mapping (UI-only 3-letter abbreviation: Sat, Jup, Mar, etc.)
export function getStarLordShort(starName?: string): string {
  if (!starName) return '';
  const s = starName.toLowerCase().trim();

  // Ketu (Ket): Ashwini, Magha, Mula
  if (s.includes('ashwini') || s.includes('asvini') || s.includes('aswini') || 
      s.includes('magha') || s.includes('makam') || s.includes('magam') || 
      s.includes('mula') || s.includes('moolam') || s.includes('moola')) {
    return 'Ket';
  }

  // Venus (Ven): Bharani, Purva Phalguni, Purva Ashadha
  if (s.includes('bharani') || s.includes('parani') || 
      s.includes('purva phalguni') || s.includes('pooram') || s.includes('pubba') || 
      s.includes('purva ashadha') || s.includes('pooradam') || s.includes('purvashada')) {
    return 'Ven';
  }

  // Sun (Sun): Krittika, Uttara Phalguni, Uttara Ashadha
  if (s.includes('krittika') || s.includes('krithika') || s.includes('karthigai') || 
      s.includes('uttara phalguni') || s.includes('uthiram') || s.includes('uttaraphalguni') || 
      s.includes('uttara ashadha') || s.includes('uthiradam') || s.includes('uttarashada')) {
    return 'Sun';
  }

  // Moon (Moo): Rohini, Hasta, Shravana
  if (s.includes('rohini') || s.includes('rohithi') || 
      s.includes('hasta') || s.includes('hastham') || 
      s.includes('shravana') || s.includes('thiruvonam') || s.includes('sravana')) {
    return 'Moo';
  }

  // Mars (Mar): Mrigashira, Chitra, Dhanishta
  if (s.includes('mrigashira') || s.includes('mrigashirsham') || s.includes('mirugaseeridam') || 
      s.includes('chitra') || s.includes('chithirai') || 
      s.includes('dhanishta') || s.includes('avittam')) {
    return 'Mar';
  }

  // Rahu (Rah): Ardra, Swati, Shatabhisha
  if (s.includes('ardra') || s.includes('thiruvathirai') || s.includes('arudra') || 
      s.includes('swati') || s.includes('swathi') || 
      s.includes('shatabhisha') || s.includes('sadayam') || s.includes('satabhisha')) {
    return 'Rah';
  }

  // Jupiter (Jup): Punarvasu, Vishakha, Purva Bhadrapada
  if (s.includes('punarvasu') || s.includes('punarpoosam') || 
      s.includes('vishakha') || s.includes('visakam') || 
      s.includes('purva bhadra') || s.includes('poorattathi') || s.includes('poorvabhadra')) {
    return 'Jup';
  }

  // Saturn (Sat): Pushya, Anuradha, Uttara Bhadrapada
  if (s.includes('pushya') || s.includes('poosam') || s.includes('pushyami') || 
      s.includes('anuradha') || s.includes('anusham') || 
      s.includes('uttara bhadra') || s.includes('uthirattathi') || s.includes('uttarabhadra')) {
    return 'Sat';
  }

  // Mercury (Mer): Ashlesha, Jyeshtha, Revati
  if (s.includes('ashlesha') || s.includes('ayilyam') || s.includes('aslesha') || 
      s.includes('jyeshtha') || s.includes('kettai') || s.includes('jyeshta') || 
      s.includes('revati') || s.includes('revathi')) {
    return 'Mer';
  }

  return '';
}

export default function RestApiStudio({
  apiPersonId,
  setApiPersonId,
  apiStartDate,
  setApiStartDate,
  apiEndDate,
  setApiEndDate,
  apiResponse,
  setApiResponse,
  queryHistory,
  setQueryHistory,
  copyToClipboard,
  copied,
  downloadFile
}: RestApiStudioProps) {
  const [loading, setLoading] = useState(false);
  const [activeSubTab, setActiveSubTab] = useState<'timeline' | 'natal' | 'transit' | 'markdown' | 'json' | 'clients' | 'audit'>('transit');
  const [dashaSearch, setDashaSearch] = useState('');
  const [selectedChartType, setSelectedChartType] = useState<'D1' | 'D9'>('D1');
  const [transitViewMode, setTransitViewMode] = useState<'timeline_events' | 'saturn_tracker' | 'snapshot_start' | 'snapshot_end'>('timeline_events');
  const [transitSearch, setTransitSearch] = useState('');
  const [selectedGrahaFilter, setSelectedGrahaFilter] = useState<string>('all');
  const [markdownView, setMarkdownView] = useState<'preview' | 'raw'>('preview');
  const [apiBaseUrl, setApiBaseUrl] = useState('http://localhost:5000');
  const [outputFormat, setOutputFormat] = useState<'full' | 'llm_markdown'>('full');
  const [backendStatus, setBackendStatus] = useState<{ ok: boolean; statusText: string; latencyMs: number; details?: any; endpointUsed?: string } | null>(null);
  const [pinging, setPinging] = useState(false);
  const [lastFetchMeta, setLastFetchMeta] = useState<{ source: 'live_server' | 'fallback_simulator'; statusCode: number; durationMs: number; error?: string; endpointUsed?: string } | null>(null);
  const [rawServerMarkdown, setRawServerMarkdown] = useState<string | null>(null);

  // Collapsible section toggles for SAP Query Studio (3 Sections)
  const [expandQueryParams, setExpandQueryParams] = useState<boolean>(true);
  const [expandResponseStudio, setExpandResponseStudio] = useState<boolean>(true);
  const [expandAuditLog, setExpandAuditLog] = useState<boolean>(true);

  const handleExpandAll = () => {
    setExpandQueryParams(true);
    setExpandResponseStudio(true);
    setExpandAuditLog(true);
  };

  const handleCollapseAll = () => {
    setExpandQueryParams(false);
    setExpandResponseStudio(false);
    setExpandAuditLog(false);
  };

  // Resolved transit timeline: always guarantees 9 Grahas Gochara timeline for all views
  const activeTransitTimeline = useMemo(() => {
    if (apiResponse?.transit_ephemeris_timeline) {
      return apiResponse.transit_ephemeris_timeline;
    }
    return executeHoroscopeTimelineQuery(apiPersonId, apiStartDate, apiEndDate).transit_ephemeris_timeline;
  }, [apiResponse, apiPersonId, apiStartDate, apiEndDate]);

  const testBackendConnection = async (targetUrl?: string) => {
    const urlToTest = targetUrl !== undefined ? targetUrl : apiBaseUrl;
    setPinging(true);
    try {
      const res = await pingApiHealth(urlToTest);
      setBackendStatus(res);
      if (res.ok && res.endpointUsed && res.endpointUsed !== apiBaseUrl && res.endpointUsed !== 'relative /api') {
        setApiBaseUrl(res.endpointUsed);
      }
    } finally {
      setPinging(false);
    }
  };

  useEffect(() => {
    testBackendConnection();
  }, [apiBaseUrl]);

  // Automatically refresh and execute query whenever the person ID changes from the top dropdown
  useEffect(() => {
    handleRunQuery();
  }, [apiPersonId]);

  const handleRunQuery = async () => {
    setLoading(true);
    try {
      const result = await fetchHoroscopeFromApi(apiBaseUrl, apiPersonId, apiStartDate, apiEndDate, outputFormat);
      setApiResponse(result.data);
      if (result.rawMarkdown) {
        setRawServerMarkdown(result.rawMarkdown);
      }
      setLastFetchMeta({
        source: result.source,
        statusCode: result.statusCode,
        durationMs: result.durationMs,
        error: result.error,
        endpointUsed: result.endpointUsed
      });
      if (result.source === 'live_server' && result.endpointUsed) {
        const cleanBase = result.endpointUsed.replace(/\/api\/horoscope\/query$/, '');
        if (cleanBase && cleanBase !== apiBaseUrl) {
          setApiBaseUrl(cleanBase);
        }
      }
      setQueryHistory(prev => [
        {
          query_id: result.data.unique_response_id,
          running_number: result.data.running_number,
          person_id: result.data.person_id,
          start_date: result.data.requested_timeline.start_date,
          end_date: result.data.requested_timeline.end_date,
          created_at: result.data.server_timestamp,
          response_payload: result.data
        },
        ...prev.slice(0, 29)
      ]);
    } finally {
      setLoading(false);
    }
  };

  const applyPreset = async (start: string, end: string) => {
    setApiStartDate(start);
    setApiEndDate(end);
    setLoading(true);
    try {
      const result = await fetchHoroscopeFromApi(apiBaseUrl, apiPersonId, start, end, outputFormat);
      setApiResponse(result.data);
      if (result.rawMarkdown) {
        setRawServerMarkdown(result.rawMarkdown);
      }
      setLastFetchMeta({
        source: result.source,
        statusCode: result.statusCode,
        durationMs: result.durationMs,
        error: result.error,
        endpointUsed: result.endpointUsed
      });
      if (result.source === 'live_server' && result.endpointUsed) {
        const cleanBase = result.endpointUsed.replace(/\/api\/horoscope\/query$/, '');
        if (cleanBase && cleanBase !== apiBaseUrl) {
          setApiBaseUrl(cleanBase);
        }
      }
      setQueryHistory(prev => [
        {
          query_id: result.data.unique_response_id,
          running_number: result.data.running_number,
          person_id: result.data.person_id,
          start_date: result.data.requested_timeline.start_date,
          end_date: result.data.requested_timeline.end_date,
          created_at: result.data.server_timestamp,
          response_payload: result.data
        },
        ...prev.slice(0, 29)
      ]);
    } finally {
      setLoading(false);
    }
  };

  // Filter dasha intervals based on user search
  const filteredIntervals = useMemo(() => {
    if (!apiResponse) return [];
    const list = apiResponse.vimshottari_dasha_intervals.intervals;
    if (!dashaSearch.trim()) return list;
    const q = dashaSearch.toLowerCase();
    return list.filter(
      item =>
        item.mahadasha_lord_md.toLowerCase().includes(q) ||
        item.antardasha_lord_ad.toLowerCase().includes(q) ||
        item.pratyantardasha_lord_pd.toLowerCase().includes(q) ||
        item.start_date.includes(q) ||
        item.end_date.includes(q)
    );
  }, [apiResponse, dashaSearch]);

  const jsonString = useMemo(() => {
    return apiResponse ? JSON.stringify(apiResponse, null, 2) : '';
  }, [apiResponse]);

  const llmMarkdownString = useMemo(() => {
    return apiResponse ? generateLlmMarkdown(apiResponse) : '';
  }, [apiResponse]);

  const llmTokenEst = useMemo(() => Math.round(llmMarkdownString.length / 4), [llmMarkdownString]);
  const jsonTokenEst = useMemo(() => Math.round(jsonString.length / 4), [jsonString]);

  const curlCommand = `curl -X POST http://localhost:5000/api/horoscope/query \\
  -H "Content-Type: application/json" \\
  -d '{
    "person_id": "${apiPersonId}",
    "start_date": "${apiStartDate}",
    "end_date": "${apiEndDate}"
  }'`;

  const curlMarkdownCommand = `curl -X POST "http://localhost:5000/api/horoscope/query?format=llm_markdown" \\
  -H "Content-Type: application/json" \\
  -d '{
    "person_id": "${apiPersonId}",
    "start_date": "${apiStartDate}",
    "end_date": "${apiEndDate}",
    "format": "llm_markdown"
  }'`;

  const pythonClientCode = `import requests
import json

# Request Model 2 REST API endpoint (Default Full JSON with All Details)
url = "http://localhost:5000/api/horoscope/query"
payload = {
    "person_id": "${apiPersonId}",
    "start_date": "${apiStartDate}",  # e.g. "January 1998" or "1998-01-01"
    "end_date": "${apiEndDate}"       # e.g. "January 2020" or "2020-01-31"
}

response = requests.post(url, json=payload)
data = response.json()

print(f"Unique Tag:    {data['unique_response_id']}")
print(f"Running Num:   {data['running_number']} (Cycle 1..100)")
print(f"Total PDs:     {data['vimshottari_dasha_intervals']['total_intervals_count']} intervals found")
print(f"Stored in DB:  {data['persisted_in_database']['table']}")
`;

  const pythonMarkdownClientCode = `import requests

# Request Option B: High-Density LLM Markdown (Strictly Sanitized - Zero PII)
url = "http://localhost:5000/api/horoscope/query"
payload = {
    "person_id": "${apiPersonId}",
    "start_date": "${apiStartDate}",
    "end_date": "${apiEndDate}",
    "format": "llm_markdown"   # Automatically strips name, age, DOB, POB, and Tamil text
}

response = requests.post(url, json=payload)
prompt_markdown = response.text  # Direct Markdown text ready to inject into LLM system/user prompt!

print(f"Prompt Size: {len(prompt_markdown)} characters (~{len(prompt_markdown)//4} tokens)")
print(prompt_markdown[:400])

# Ready to pass to Google Gemini or Anthropic Claude:
# gemini_response = client.models.generate_content(
#     model="gemini-2.5-flash",
#     contents=[f"Astrological Data:\\n{prompt_markdown}\\n\\nTask: Analyze career & financial triggers between 2005 and 2010."]
# )
`;

  return (
    <div className="space-y-6">
      {/* Quick Section View Controls for SAP Query Studio */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/80 border border-slate-800/80 px-4 py-2.5 rounded-xl text-xs">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-slate-400 font-semibold flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            <span>SAP Query Studio Sections:</span>
          </span>
          <button
            onClick={() => setExpandQueryParams(!expandQueryParams)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
              expandQueryParams
                ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>1. Query Parameters</span>
            {expandQueryParams ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={() => setExpandResponseStudio(!expandResponseStudio)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
              expandResponseStudio
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>2. Response Studio</span>
            {expandResponseStudio ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
          <button
            onClick={() => setExpandAuditLog(!expandAuditLog)}
            className={`px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer flex items-center gap-1.5 ${
              expandAuditLog
                ? 'bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold'
                : 'bg-slate-900 text-slate-400 hover:text-slate-200 border border-slate-800'
            }`}
          >
            <span>3. Database Audit Log</span>
            {expandAuditLog ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleExpandAll}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition cursor-pointer"
            title="Expand all 3 sections"
          >
            Expand All
          </button>
          <button
            onClick={handleCollapseAll}
            className="px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-medium transition cursor-pointer"
            title="Collapse all 3 sections"
          >
            Collapse All
          </button>
        </div>
      </div>

      {/* SECTION 1: Query Parameters & REST Connection Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm transition-all">
        <div
          onClick={() => setExpandQueryParams(!expandQueryParams)}
          className="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/40 border-b border-slate-800 select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-bold text-white">1. Execute REST API Query (`/api/horoscope/query`)</span>
                {!expandQueryParams && (
                  <span className="text-xs font-mono font-bold text-amber-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    ID: {apiPersonId} &bull; {apiStartDate} &rarr; {apiEndDate}
                  </span>
                )}
              </div>
              <div className="text-xs text-slate-400">
                Accepts ISO format (<code className="text-slate-300">1998-01-01</code>) or Natural Language (<code className="text-slate-300">January 1998</code>)
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
            {backendStatus?.ok ? (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <Wifi className="w-3 h-3" />
                Live Server Online
              </span>
            ) : (
              <span className="hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20" title="Run 'python run_api_server.py'">
                <WifiOff className="w-3 h-3" />
                Simulation Ready
              </span>
            )}
            <button
              onClick={() => setExpandQueryParams(!expandQueryParams)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title={expandQueryParams ? "Minimize Section 1" : "Expand Section 1"}
            >
              {expandQueryParams ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {expandQueryParams && (
          <div className="p-4 sm:p-5 space-y-4">

        {/* Live Backend Connection Bar */}
        <div className="bg-slate-950/70 p-3 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-slate-300 font-semibold flex items-center gap-1.5">
              <Server className="w-3.5 h-3.5 text-indigo-400" /> REST API Server:
            </span>
            <input
              type="text"
              value={apiBaseUrl}
              onChange={e => setApiBaseUrl(e.target.value)}
              placeholder="http://localhost:5000"
              className="bg-slate-900 border border-slate-700 rounded px-2.5 py-1 text-slate-200 font-mono text-xs w-56 focus:outline-none focus:border-amber-400"
            />
            <button
              type="button"
              onClick={() => testBackendConnection()}
              disabled={pinging}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 text-xs transition disabled:opacity-50"
            >
              <RefreshCw className={`w-3 h-3 ${pinging ? 'animate-spin' : ''}`} />
              Test Ping
            </button>
          </div>

          <div className="flex items-center gap-2">
            {backendStatus?.ok ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm">
                <Wifi className="w-3.5 h-3.5" />
                Live Python Server Online ({backendStatus.latencyMs}ms)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20" title="Run 'python run_api_server.py' in your terminal">
                <WifiOff className="w-3.5 h-3.5" />
                Python Server Offline (Run `python run_api_server.py`)
              </span>
            )}
          </div>
        </div>

        {/* Output Format Switcher */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800/60">
          <div className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-amber-400" />
            Query Output Mode:
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setOutputFormat('full');
                setActiveSubTab('json');
              }}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition ${
                outputFormat === 'full'
                  ? 'bg-indigo-600 text-white shadow-sm'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              Default Full JSON (Everything)
            </button>
            <button
              type="button"
              onClick={() => {
                setOutputFormat('llm_markdown');
                setActiveSubTab('markdown');
              }}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold transition ${
                outputFormat === 'llm_markdown'
                  ? 'bg-amber-500 text-slate-950 shadow-sm font-bold'
                  : 'bg-slate-800 text-slate-400 hover:text-white'
              }`}
            >
              <Sparkles className="w-3 h-3 text-amber-400" />
              Option B: LLM Markdown (Zero PII)
            </button>
          </div>
        </div>

        {/* Input fields */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              1. Person ID (Unique Identifier)
            </label>
            <input
              type="text"
              value={apiPersonId}
              onChange={e => setApiPersonId(e.target.value)}
              placeholder="e.g. 001ME"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-amber-400 font-mono font-bold focus:outline-none focus:border-amber-400 transition"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">Registration ID from PDF footer</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              2. Timeline Start Date
            </label>
            <input
              type="text"
              value={apiStartDate}
              onChange={e => setApiStartDate(e.target.value)}
              placeholder="1998-01-01 or January 1998"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-cyan-400 font-mono focus:outline-none focus:border-cyan-400 transition"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">Normalized to: {normalizeDateString(apiStartDate, false)}</span>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-300 mb-1.5">
              3. Timeline End Date
            </label>
            <input
              type="text"
              value={apiEndDate}
              onChange={e => setApiEndDate(e.target.value)}
              placeholder="2020-01-31 or January 2020"
              className="w-full px-3.5 py-2 bg-slate-950 border border-slate-800 rounded-lg text-sm text-rose-400 font-mono focus:outline-none focus:border-rose-400 transition"
            />
            <span className="text-[11px] text-slate-500 mt-1 block">Normalized to: {normalizeDateString(apiEndDate, true)}</span>
          </div>
        </div>

        {/* Quick Presets & Run Action */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-slate-400 mr-1 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5 text-slate-500" /> Presets:
            </span>
            <button
              onClick={() => applyPreset('January 1998', 'January 2020')}
              className="px-2.5 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-amber-300 border border-slate-700 transition"
            >
              ⭐ 1998 to 2020 (User Prompt Period)
            </button>
            <button
              onClick={() => applyPreset('2000-01-01', '2005-12-31')}
              className="px-2.5 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              2000 - 2005
            </button>
            <button
              onClick={() => applyPreset('2026-09-01', '2027-09-01')}
              className="px-2.5 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              Current Year (2026 - 2027)
            </button>
            <button
              onClick={() => applyPreset('1976-01-26', '1989-04-02')}
              className="px-2.5 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              Saturn Mahadasha (1976 - 1989)
            </button>
            <button
              onClick={() => applyPreset('1976-01-26', '2090-04-02')}
              className="px-2.5 py-1 rounded text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition"
            >
              Full Lifetime (1976 - 2090)
            </button>
          </div>

          <button
            onClick={handleRunQuery}
            disabled={loading}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-xs bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 shadow-lg shadow-amber-500/20 transition disabled:opacity-50"
          >
            {loading ? (
              <>
                <RefreshCw className="w-4 h-4 animate-spin" />
                Querying REST Engine...
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                Send API Query &amp; Persist in DB
              </>
            )}
          </button>
        </div>

        {/* Diagnostic Troubleshooting Card when live server could not be reached */}
        {lastFetchMeta?.source === 'fallback_simulator' && (
          <div className="bg-amber-950/20 border border-amber-500/40 rounded-xl p-4 text-xs text-amber-200 space-y-3">
            <div className="flex items-start gap-2.5">
              <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <strong className="text-white block mb-1">
                  Browser Cannot Reach Python Server directly ({apiBaseUrl})
                </strong>
                <p className="text-slate-300 leading-relaxed font-mono text-[11px]">
                  {lastFetchMeta.error}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-amber-500/20">
              <span className="text-slate-400 font-semibold">1-Click Quick Solutions:</span>
              <button
                type="button"
                onClick={() => {
                  setApiBaseUrl('http://127.0.0.1:5000');
                  testBackendConnection('http://127.0.0.1:5000');
                }}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 border border-slate-700 transition font-mono"
              >
                Use 127.0.0.1:5000 (Fixes Windows IPv6)
              </button>
              <button
                type="button"
                onClick={() => {
                  setApiBaseUrl('/api');
                  testBackendConnection('/api');
                }}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-emerald-300 border border-slate-700 transition font-mono"
              >
                Use /api (Vite Dev Proxy)
              </button>
              <button
                type="button"
                onClick={() => {
                  setApiBaseUrl('http://localhost:5000');
                  testBackendConnection('http://localhost:5000');
                }}
                className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition font-mono"
              >
                Use localhost:5000
              </button>
            </div>

            <div className="text-[11px] text-slate-400 bg-slate-950/40 p-2.5 rounded-lg border border-slate-800">
              💡 <strong>Why cURL works but browser doesn't:</strong>
              <ul className="list-disc list-inside mt-1 space-y-0.5 text-slate-300">
                <li>If you are viewing this app via an <strong>HTTPS</strong> cloud URL, modern browsers strictly block HTTP requests to localhost (Mixed Content Security).</li>
                <li>To allow direct browser-to-Python communication, open the app locally at <strong className="text-amber-300">http://localhost:3000</strong> using <code className="text-amber-400">npm run dev</code>.</li>
                <li>On Windows, <code className="text-cyan-300">http://127.0.0.1:5000</code> connects instantly over IPv4 where <code className="text-cyan-300">localhost</code> might resolve to IPv6 <code className="text-slate-400">::1</code>.</li>
              </ul>
            </div>
          </div>
        )}
          </div>
        )}
      </div>

      {/* SECTION 2: Query Response Header & Metadata & Sub-Tab Data Visualizer */}
      {apiResponse && (
        <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm transition-all">
          <div
            onClick={() => setExpandResponseStudio(!expandResponseStudio)}
            className="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-4 cursor-pointer hover:bg-slate-800/40 border-b border-slate-800 select-none"
          >
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
                <Code2 className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-white">2. Query Response &amp; Interactive Analytics Studio</span>
                  <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-400 text-xs font-mono font-bold border border-emerald-500/20">
                    HTTP 200 OK
                  </span>
                  <span className="text-xs font-mono font-bold text-amber-300 bg-slate-950 px-2 py-0.5 rounded border border-slate-800">
                    {apiResponse.unique_response_id}
                  </span>
                  <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 text-xs font-mono font-bold border border-indigo-500/30">
                    #{apiResponse.running_number}
                  </span>
                </div>
                <div className="text-xs text-slate-400 mt-0.5">
                  Vimshottari Dasha intervals, Natal D1/D9 houses, 9-Graha Gochara transits, LLM Markdown, and full JSON payload.
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
              <button
                onClick={() => copyToClipboard(jsonString, 'json_resp')}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5 text-amber-400" />
                {copied === 'json_resp' ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={() =>
                  downloadFile(
                    `${apiResponse.unique_response_id}.json`,
                    jsonString,
                    'application/json'
                  )
                }
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition cursor-pointer"
              >
                <Download className="w-3.5 h-3.5 text-cyan-400" />
                Download
              </button>
              <button
                onClick={() => setExpandResponseStudio(!expandResponseStudio)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
                title={expandResponseStudio ? "Minimize Section 2" : "Expand Section 2"}
              >
                {expandResponseStudio ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {expandResponseStudio && (
            <div className="p-4 sm:p-5 space-y-4">

          {/* Sub-tab Navigation */}
          <div className="flex flex-wrap gap-1 border-b border-slate-800 pb-1">
            {[
              {
                id: 'timeline',
                label: `Vimshottari Dasha Intervals (${apiResponse.vimshottari_dasha_intervals.total_intervals_count})`,
                icon: Calendar
              },
              {
                id: 'natal',
                label: `Natal Placements (D1 & D9 Houses)`,
                icon: Compass
              },
              {
                id: 'transit',
                label: `Transit Ephemeris (9 Grahas Gochara)`,
                icon: Globe
              },
              {
                id: 'markdown',
                label: `🤖 LLM Markdown (Option B - Zero PII)`,
                icon: Sparkles
              },
              {
                id: 'json',
                label: `Full JSON Response Payload`,
                icon: Code2
              },
              {
                id: 'clients',
                label: `cURL & Python Client Snippets`,
                icon: Terminal
              },
              {
                id: 'audit',
                label: `user_queries Transaction Log (${queryHistory.length})`,
                icon: Database
              }
            ].map(tab => {
              const Icon = tab.icon;
              const isActive = activeSubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveSubTab(tab.id as any)}
                  className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition ${
                    isActive
                      ? 'bg-amber-500 text-slate-950 shadow-md'
                      : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {/* SUB-TAB 1: TIMELINE INTERVALS (MD > AD > PD) */}
          {activeSubTab === 'timeline' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-4 pb-3 border-b border-slate-800">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-purple-400" />
                    Granular Vimshottari Timeline Intervals (PD / Anthara Level)
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Spanning <strong className="text-slate-200">{apiResponse.requested_timeline.start_date}</strong> to{' '}
                    <strong className="text-slate-200">{apiResponse.requested_timeline.end_date}</strong>{' '}
                    ({apiResponse.requested_timeline.span_years} years). Every single PD interval is included sequentially.
                  </p>
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Search lord or date..."
                    value={dashaSearch}
                    onChange={e => setDashaSearch(e.target.value)}
                    className="pl-8 pr-3 py-1.5 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                  />
                </div>
              </div>

              {filteredIntervals.length === 0 ? (
                <div className="text-center py-12 text-slate-400 text-xs">
                  No intervals found for this search or timeline range.
                </div>
              ) : (
                <div className="overflow-x-auto max-h-[550px] overflow-y-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800 text-slate-300 font-mono text-[11px] uppercase sticky top-0 z-10">
                      <tr>
                        <th className="py-2.5 px-3 text-center">#</th>
                        <th className="py-2.5 px-3">Mahadasha (MD)</th>
                        <th className="py-2.5 px-3">Antardasha (AD / Bukthi)</th>
                        <th className="py-2.5 px-3">Pratyantardasha (PD / Anthara)</th>
                        <th className="py-2.5 px-3">Start Date</th>
                        <th className="py-2.5 px-3">End Date</th>
                        <th className="py-2.5 px-3 text-center">Duration</th>
                        <th className="py-2.5 px-3">Hierarchy</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {filteredIntervals.map(item => (
                        <tr key={item.sequence_index} className="hover:bg-slate-800/40">
                          <td className="py-2 px-3 text-center font-mono text-slate-500">
                            {item.sequence_index}
                          </td>
                          <td className="py-2 px-3 font-bold text-amber-300">
                            {item.mahadasha_lord_md}
                          </td>
                          <td className="py-2 px-3 font-semibold text-slate-200">
                            {item.antardasha_lord_ad}
                          </td>
                          <td className="py-2 px-3 font-semibold text-purple-300">
                            {item.pratyantardasha_lord_pd}
                          </td>
                          <td className="py-2 px-3 font-mono text-cyan-400">
                            {item.start_date}
                          </td>
                          <td className="py-2 px-3 font-mono text-rose-400">
                            {item.end_date}
                          </td>
                          <td className="py-2 px-3 text-center font-mono text-slate-400">
                            {item.duration_days ? `${item.duration_days}d` : '-'}
                          </td>
                          <td className="py-2 px-3 text-slate-400 font-mono text-[11px]">
                            {item.full_lord_hierarchy}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800">
                <span>Showing {filteredIntervals.length} of {apiResponse.vimshottari_dasha_intervals.total_intervals_count} intervals</span>
                <span className="font-mono text-purple-400">Full MD &gt; AD &gt; PD Hierarchical Tree</span>
              </div>
            </div>
          )}

          {/* SUB-TAB 2: NATAL PLACEMENTS (D1 & D9) */}
          {activeSubTab === 'natal' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Compass className="w-4 h-4 text-cyan-400" />
                    Natal Placements &amp; Relative House Numbers (Lagna = House 1)
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Standardized English planetary bodies, sign names, minute-precision degrees (Sputa), and retrograde flags.
                  </p>
                </div>

                <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
                  <button
                    onClick={() => setSelectedChartType('D1')}
                    className={`px-3 py-1 text-xs rounded font-bold transition ${
                      selectedChartType === 'D1' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    D1 Rashi Chart ({apiResponse.natal_placements.D1_rashi_chart.count} bodies)
                  </button>
                  <button
                    onClick={() => setSelectedChartType('D9')}
                    className={`px-3 py-1 text-xs rounded font-bold transition ${
                      selectedChartType === 'D9' ? 'bg-amber-500 text-slate-950' : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    D9 Navamsha Chart ({apiResponse.natal_placements.D9_navamsha_chart.count} bodies)
                  </button>
                </div>
              </div>

              {/* Table of placements */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800 text-slate-300 font-mono text-[11px] uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Body Name</th>
                      <th className="py-2.5 px-3">Rashi (Sign)</th>
                      <th className="py-2.5 px-3 text-center">House (Relative to Lagna)</th>
                      <th className="py-2.5 px-3">Nakshatra (Star)</th>
                      <th className="py-2.5 px-3 text-center">Pada</th>
                      <th className="py-2.5 px-3">Degree (Sputa)</th>
                      <th className="py-2.5 px-3 text-center">Retrograde</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {(selectedChartType === 'D1'
                      ? apiResponse.natal_placements.D1_rashi_chart.bodies
                      : apiResponse.natal_placements.D9_navamsha_chart.bodies
                    )
                      .sort((a, b) => a.house_number - b.house_number)
                      .map(p => (
                        <tr key={p.body_name} className="hover:bg-slate-800/40">
                          <td className="py-2 px-3 font-bold text-white flex items-center gap-1.5">
                            {p.body_name === 'Lagna' && (
                              <span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />
                            )}
                            {p.body_name}
                          </td>
                          <td className="py-2 px-3 text-slate-200">{p.rashi_name}</td>
                          <td className="py-2 px-3 text-center font-bold text-amber-400 bg-amber-500/5">
                            House {p.house_number}
                          </td>
                          <td className="py-2 px-3 text-slate-300">
                            {p.nakshatra_name ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span>{p.nakshatra_name}</span>
                                {getStarLordShort(p.nakshatra_name) && (
                                  <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                    ({getStarLordShort(p.nakshatra_name)})
                                  </span>
                                )}
                              </div>
                            ) : (
                              '-'
                            )}
                          </td>
                          <td className="py-2 px-3 text-center text-slate-400">{p.pada ?? '-'}</td>
                          <td className="py-2 px-3 font-mono text-cyan-400">{p.degree_sputa || '-'}</td>
                          <td className="py-2 px-3 text-center">
                            {p.is_retrograde ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                RETROGRADE
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[10px]">DIRECT</span>
                            )}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* SUB-TAB: TRANSIT EPHEMERIS (GOCHARA) */}
          {activeSubTab === 'transit' && activeTransitTimeline && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Globe className="w-4 h-4 text-emerald-400" />
                    Ephemeris Transit Engine (Gochara Timeline for 9 Grahas)
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Calculated with Lahiri (Chitra Paksha) Ayanamsha. Computes sign positions, exact minute sputa, nakshatra &amp; pada,
                    and houses relative to both Natal Lagna and Natal Janma Rashi.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex flex-wrap items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                    <button
                      onClick={() => setTransitViewMode('timeline_events')}
                      className={`px-3 py-1 rounded font-semibold transition ${
                        transitViewMode === 'timeline_events' ? 'bg-emerald-500 text-slate-950' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Sign Ingress Events ({activeTransitTimeline.major_transits_timeline_count})
                    </button>
                    <button
                      onClick={() => setTransitViewMode('saturn_tracker')}
                      className={`px-3 py-1 rounded font-semibold transition ${
                        transitViewMode === 'saturn_tracker' ? 'bg-amber-500 text-slate-950 font-bold' : 'text-amber-400 hover:text-white'
                      }`}
                    >
                      🪐 Saturn (Sani) Tracker (~2.5 yrs/sign)
                    </button>
                    <button
                      onClick={() => setTransitViewMode('snapshot_start')}
                      className={`px-3 py-1 rounded font-semibold transition ${
                        transitViewMode === 'snapshot_start' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Start Snapshot ({apiResponse.requested_timeline.start_date})
                    </button>
                    <button
                      onClick={() => setTransitViewMode('snapshot_end')}
                      className={`px-3 py-1 rounded font-semibold transition ${
                        transitViewMode === 'snapshot_end' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      End Snapshot ({apiResponse.requested_timeline.end_date})
                    </button>
                  </div>
                </div>
              </div>

              {/* Native's Reference Banner */}
              <div className="bg-slate-950/90 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="flex flex-wrap items-center justify-between text-xs gap-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-slate-300">Native's Baseline Reference:</span>
                    <span className="px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 font-bold">
                      Lagna: {activeTransitTimeline.natal_reference.natal_lagna_sign}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-rose-500/10 text-rose-400 border border-rose-500/20 font-bold">
                      Janma Rashi: {activeTransitTimeline.natal_reference.natal_rashi_sign}
                    </span>
                  </div>
                  <div className="text-[11px] text-amber-300/90 font-mono">
                    Relative House Rule: ((Transit Sign - Baseline Sign) % 12) + 1
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 bg-slate-900/80 p-2.5 rounded-lg border border-slate-800/80 leading-relaxed">
                  💡 <strong className="text-slate-200">User Specification Verified:</strong> When <strong>Jupiter (Guru)</strong> transits{' '}
                  <strong className="text-amber-300">Katakam (Cancer / Karka)</strong>, the engine calculates it as{' '}
                  <span className="text-cyan-400 font-bold">8th House (Ashtama)</span> from native's Dhanus Lagna, and{' '}
                  <span className="text-rose-400 font-bold">9th House (Bhagya)</span> from native's Vrischigam Moon sign.
                  Each and every Graha is calculated with both perspectives simultaneously!
                </div>
              </div>

              {/* Graha Interactive Filter Bar & Controls */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h5 className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-2">
                      <Compass className="w-4 h-4 text-amber-400" />
                      Planetary Transit Paths &amp; Orbit Progressions ({apiResponse.requested_timeline.start_date} → {apiResponse.requested_timeline.end_date})
                    </h5>
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      Visual path for each planet across your requested timeline. Click any graha to filter both the paths and timeline events table simultaneously:
                    </p>
                  </div>
                  <div className="relative min-w-[200px]">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Filter planet or sign..."
                      value={transitSearch}
                      onChange={e => setTransitSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1 bg-slate-900 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                    />
                  </div>
                </div>

                {/* Quick Graha Filter Pills */}
                <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-800/80">
                  {[
                    { key: 'all', label: 'All 9 Grahas (9 கிரகங்கள்)', icon: '🌟' },
                    { key: 'Saturn', label: 'Saturn (சனி)', icon: '🪐' },
                    { key: 'Jupiter', label: 'Jupiter (குரு)', icon: '⭐' },
                    { key: 'Rahu', label: 'Rahu (ராகு)', icon: '🐉' },
                    { key: 'Ketu', label: 'Ketu (கேது)', icon: '☄️' },
                    { key: 'Mars', label: 'Mars (செவ்வாய்)', icon: '🔴' },
                    { key: 'Sun', label: 'Sun (சூரியன்)', icon: '☀️' },
                    { key: 'Venus', label: 'Venus (சுக்கிரன்)', icon: '✨' },
                    { key: 'Mercury', label: 'Mercury (புதன்)', icon: '🟢' },
                    { key: 'Moon', label: 'Moon (சந்திரன்)', icon: '🌙' },
                  ].map(tab => {
                    const isSelected = selectedGrahaFilter === tab.key;
                    return (
                      <button
                        key={tab.key}
                        onClick={() => setSelectedGrahaFilter(tab.key)}
                        className={`flex items-center gap-1 px-3 py-1 rounded-md text-xs font-semibold transition ${
                          isSelected
                            ? 'bg-amber-500 text-slate-950 shadow font-bold'
                            : 'bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-slate-200 border border-slate-800'
                        }`}
                      >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                      </button>
                    );
                  })}
                  {selectedGrahaFilter !== 'all' && (
                    <button
                      onClick={() => {
                        setSelectedGrahaFilter('all');
                        setTransitSearch('');
                      }}
                      className="ml-auto text-[11px] text-amber-400/80 hover:text-amber-300 underline font-mono"
                    >
                      Reset Filter
                    </button>
                  )}
                </div>
              </div>

              {/* Dynamic Path Illustrations for All (or Filtered) Grahas */}
              {(() => {
                const ALL_GRAHAS_META = [
                  { key: 'Saturn', name: 'Saturn (Sani / சனி)', icon: '🪐', speed: '~2.5 yrs / sign', border: 'border-amber-500/30', headerColor: 'text-amber-400' },
                  { key: 'Jupiter', name: 'Jupiter (Guru / குரு)', icon: '⭐', speed: '~1 yr / sign', border: 'border-yellow-500/30', headerColor: 'text-yellow-400' },
                  { key: 'Rahu', name: 'Rahu (ராகு)', icon: '🐉', speed: '~1.5 yrs / sign (Rx)', border: 'border-purple-500/30', headerColor: 'text-purple-400' },
                  { key: 'Ketu', name: 'Ketu (கேது)', icon: '☄️', speed: '~1.5 yrs / sign (Rx)', border: 'border-rose-500/30', headerColor: 'text-rose-400' },
                  { key: 'Mars', name: 'Mars (Sevvai / செவ்வாய்)', icon: '🔴', speed: '~45 days / sign', border: 'border-red-500/30', headerColor: 'text-red-400' },
                  { key: 'Sun', name: 'Sun (Surya / சூரியன்)', icon: '☀️', speed: '~30 days / sign', border: 'border-orange-500/30', headerColor: 'text-orange-400' },
                  { key: 'Venus', name: 'Venus (Sukra / சுக்கிரன்)', icon: '✨', speed: '~30 days / sign', border: 'border-emerald-500/30', headerColor: 'text-emerald-400' },
                  { key: 'Mercury', name: 'Mercury (Budha / புதன்)', icon: '🟢', speed: '~25 days / sign', border: 'border-green-500/30', headerColor: 'text-green-400' },
                  { key: 'Moon', name: 'Moon (Chandra / சந்திரன்)', icon: '🌙', speed: '~2.25 days / sign', border: 'border-cyan-500/30', headerColor: 'text-cyan-400' },
                ];

                const matchingGrahas = ALL_GRAHAS_META.filter(g => {
                  const matchesPill = selectedGrahaFilter === 'all' || g.key.toLowerCase() === selectedGrahaFilter.toLowerCase();
                  const matchesSearch = !transitSearch.trim() ||
                    g.name.toLowerCase().includes(transitSearch.toLowerCase()) ||
                    g.key.toLowerCase().includes(transitSearch.toLowerCase()) ||
                    activeTransitTimeline.major_transits_timeline.some(ev =>
                      ev.graha_name.toLowerCase().includes(g.key.toLowerCase()) &&
                      (ev.transit_rashi_name.toLowerCase().includes(transitSearch.toLowerCase()) ||
                        ev.start_date.includes(transitSearch) ||
                        ev.end_date.includes(transitSearch))
                    );
                  return matchesPill && matchesSearch;
                });

                if (matchingGrahas.length === 0) {
                  return (
                    <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 text-center text-xs text-slate-400">
                      No planetary paths match filter &ldquo;{selectedGrahaFilter !== 'all' ? selectedGrahaFilter : transitSearch}&rdquo;.
                      <button
                        onClick={() => {
                          setSelectedGrahaFilter('all');
                          setTransitSearch('');
                        }}
                        className="ml-2 underline text-amber-400"
                      >
                        Reset filters
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="space-y-3">
                    {matchingGrahas.map(g => {
                      const planetIngresses = activeTransitTimeline.major_transits_timeline.filter(
                        ev => ev.graha_name.toLowerCase().includes(g.key.toLowerCase())
                      );

                      return (
                        <div
                          key={g.key}
                          className={`bg-slate-950 p-3.5 rounded-xl border ${g.border} space-y-2.5 transition hover:border-slate-600`}
                        >
                          <div className="flex flex-wrap items-center justify-between text-xs gap-2">
                            <div className="flex items-center gap-2">
                              <span className="text-base">{g.icon}</span>
                              <span className={`font-bold ${g.headerColor}`}>{g.name} Path:</span>
                              <span className="text-[11px] text-slate-400 font-mono">
                                ({g.speed})
                              </span>
                            </div>
                            <div className="flex items-center gap-2">
                              <span className="text-[11px] px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 font-mono">
                                {planetIngresses.length} Sign Phase{planetIngresses.length > 1 ? 's' : ''} in Query
                              </span>
                              <button
                                onClick={() => setSelectedGrahaFilter(selectedGrahaFilter === g.key ? 'all' : g.key)}
                                className={`text-[10px] px-2 py-0.5 rounded font-semibold transition ${
                                  selectedGrahaFilter === g.key
                                    ? 'bg-amber-500 text-slate-950'
                                    : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
                                }`}
                              >
                                {selectedGrahaFilter === g.key ? 'Showing Only' : 'Isolate'}
                              </button>
                            </div>
                          </div>

                          {/* Horizontal Path Breadcrumbs */}
                          <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                            {planetIngresses.map((ev, i, arr) => (
                              <React.Fragment key={i}>
                                <div
                                  className="flex-shrink-0 bg-slate-900 border border-slate-700/80 hover:border-amber-400 px-3 py-2 rounded-lg text-center transition shadow-sm"
                                  title={`${ev.graha_name} in ${ev.transit_rashi_name} (${ev.start_date} to ${ev.end_date})`}
                                >
                                  <div className="font-bold text-amber-300 text-xs">
                                    {ev.transit_rashi_name}
                                    <span className="text-[10px] text-slate-400 font-normal ml-1">
                                      ({ev.transit_rashi_tamil})
                                    </span>
                                  </div>
                                  <div className="text-[11px] text-slate-300 font-mono mt-0.5">
                                    {ev.start_date} → {ev.end_date}
                                  </div>
                                  <div className="text-[10px] text-cyan-400 font-semibold mt-0.5">
                                    House {ev.house_from_natal_lagna} (Lagna) &bull; House {ev.house_from_natal_rashi} (Moon)
                                  </div>
                                  <div className="text-[9px] text-slate-400 mt-0.5 font-mono flex items-center justify-center gap-1 flex-wrap">
                                    <span>{ev.nakshatra_name}</span>
                                    {getStarLordShort(ev.nakshatra_name) && (
                                      <span className="text-amber-400 font-bold">({getStarLordShort(ev.nakshatra_name)})</span>
                                    )}
                                    <span className="text-slate-500">P{ev.pada}</span>
                                  </div>
                                </div>
                                {i < arr.length - 1 && (
                                  <ArrowRight className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                                )}
                              </React.Fragment>
                            ))}
                          </div>

                          {/* Sign Shift Notification if multiple ingresses */}
                          {planetIngresses.length > 1 && (
                            <div className="bg-emerald-950/20 border border-emerald-500/20 px-3 py-1.5 rounded-lg text-[11px] text-emerald-200 flex items-center gap-2">
                              <Sparkles className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" />
                              <span>
                                <strong>Sign Ingress Detected:</strong> {g.name} moved from{' '}
                                <strong className="text-white">{planetIngresses[0].transit_rashi_name}</strong> to{' '}
                                <strong className="text-emerald-300">{planetIngresses[1].transit_rashi_name}</strong> on{' '}
                                <strong className="text-white font-mono">{planetIngresses[1].start_date}</strong>!
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })()}

              {/* 9 Graha Snapshot Table */}
              {(transitViewMode === 'snapshot_start' || transitViewMode === 'snapshot_end') && (
                <div className="space-y-3">
                  <div className="bg-amber-950/20 border border-amber-500/30 p-3 rounded-lg text-[11px] text-amber-200 flex items-start gap-2.5">
                    <AlertCircle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
                    <div>
                      <strong className="text-white block mb-0.5">
                        Single-Day Snapshot ({transitViewMode === 'snapshot_start' ? apiResponse.requested_timeline.start_date : apiResponse.requested_timeline.end_date})
                      </strong>
                      <span>
                        This table shows where the 9 Grahas were on <em>this exact single day</em>. On this start date, Saturn happened to be in{' '}
                        <strong className="text-amber-300">
                          {transitViewMode === 'snapshot_start'
                            ? activeTransitTimeline.transit_snapshot_start.find(g => g.graha_key === 'Saturn')?.transit_rashi_name
                            : activeTransitTimeline.transit_snapshot_end.find(g => g.graha_key === 'Saturn')?.transit_rashi_name}
                        </strong>
                        . It did <strong>NOT</strong> stay there for years! To see all dates when Saturn changed signs, switch to{' '}
                        <button
                          type="button"
                          onClick={() => setTransitViewMode('saturn_tracker')}
                          className="underline text-cyan-300 font-bold hover:text-white"
                        >
                          Saturn Tracker
                        </button>{' '}
                        or{' '}
                        <button
                          type="button"
                          onClick={() => setTransitViewMode('timeline_events')}
                          className="underline text-emerald-300 font-bold hover:text-white"
                        >
                          Sign Ingress Events
                        </button>
                        .
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800 text-slate-300 font-mono text-[11px] uppercase">
                      <tr>
                        <th className="py-2.5 px-3">Graha (Planet)</th>
                        <th className="py-2.5 px-3">Transit Rashi (Sign)</th>
                        <th className="py-2.5 px-3">Degree (Sputa)</th>
                        <th className="py-2.5 px-3">Nakshatra &amp; Pada</th>
                        <th className="py-2.5 px-3 text-center bg-cyan-950/30 text-cyan-300">
                          Relative to Lagna ({activeTransitTimeline.natal_reference.natal_lagna_sign.split(' ')[0]})
                        </th>
                        <th className="py-2.5 px-3 text-center bg-rose-950/30 text-rose-300">
                          Relative to Moon ({activeTransitTimeline.natal_reference.natal_rashi_sign.split(' ')[0]})
                        </th>
                        <th className="py-2.5 px-3 text-center">Motion</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {(transitViewMode === 'snapshot_start'
                        ? activeTransitTimeline.transit_snapshot_start
                        : activeTransitTimeline.transit_snapshot_end
                      ).map(g => (
                        <tr key={g.graha_key} className="hover:bg-slate-800/40">
                          <td className="py-2.5 px-3 font-bold text-white flex items-center gap-1.5">
                            <span>{g.graha_name}</span>
                            <span className="text-[10px] text-slate-400 font-normal">({g.graha_tamil})</span>
                          </td>
                          <td className="py-2.5 px-3 font-semibold text-amber-300">
                            {g.transit_rashi_name}{' '}
                            <span className="text-[10px] text-slate-400">({g.transit_rashi_tamil})</span>
                          </td>
                          <td className="py-2.5 px-3 font-mono text-cyan-400">
                            {g.degree_sputa}
                          </td>
                          <td className="py-2.5 px-3 text-slate-300">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-200">{g.graha_pada_chara.nakshatra_name}</span>
                              {getStarLordShort(g.graha_pada_chara.nakshatra_name) && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                  ({getStarLordShort(g.graha_pada_chara.nakshatra_name)})
                                </span>
                              )}
                              <span className="text-amber-400/90 text-[11px] font-mono">Pada {g.graha_pada_chara.pada}</span>
                            </div>
                          </td>
                          <td className="py-2.5 px-3 text-center bg-cyan-950/10">
                            <span className="font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded border border-cyan-500/20">
                              House {g.relative_to_natal_lagna.house_number}
                            </span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              {g.relative_to_natal_lagna.house_title}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center bg-rose-950/10">
                            <span className="font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded border border-rose-500/20">
                              House {g.relative_to_natal_rashi.house_number}
                            </span>
                            <span className="block text-[10px] text-slate-400 mt-0.5">
                              {g.relative_to_natal_rashi.house_title}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-center">
                            {g.is_retrograde ? (
                              <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/30">
                                RETROGRADE
                              </span>
                            ) : (
                              <span className="text-slate-500 text-[10px]">DIRECT</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* Major Sign Ingress Events Timeline */}
              {transitViewMode === 'timeline_events' && (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-400">
                        Chronological list of planetary sign entries throughout the requested timeline:
                      </span>
                      {selectedGrahaFilter !== 'all' && (
                        <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          Filtering: {selectedGrahaFilter}
                        </span>
                      )}
                    </div>
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                      <input
                        type="text"
                        placeholder="Filter planet or sign..."
                        value={transitSearch}
                        onChange={e => setTransitSearch(e.target.value)}
                        className="pl-8 pr-3 py-1 bg-slate-950 border border-slate-800 rounded-lg text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-amber-400"
                      />
                    </div>
                  </div>

                  <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-800 text-slate-300 font-mono text-[11px] uppercase sticky top-0 z-10">
                        <tr>
                          <th className="py-2.5 px-3">Graha</th>
                          <th className="py-2.5 px-3">Transit Rashi</th>
                          <th className="py-2.5 px-3">Start Date</th>
                          <th className="py-2.5 px-3">End Date</th>
                          <th className="py-2.5 px-3 text-center">From Lagna</th>
                          <th className="py-2.5 px-3 text-center">From Rashi</th>
                          <th className="py-2.5 px-3">Star Occupied</th>
                          <th className="py-2.5 px-3">Summary</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {activeTransitTimeline.major_transits_timeline
                          .filter(ev => {
                            const matchesGraha = selectedGrahaFilter === 'all' || ev.graha_name.toLowerCase().includes(selectedGrahaFilter.toLowerCase());
                            const matchesSearch = !transitSearch.trim() ||
                              ev.graha_name.toLowerCase().includes(transitSearch.toLowerCase()) ||
                              ev.transit_rashi_name.toLowerCase().includes(transitSearch.toLowerCase()) ||
                              ev.start_date.includes(transitSearch) ||
                              ev.end_date.includes(transitSearch);
                            return matchesGraha && matchesSearch;
                          })
                          .map((ev, idx) => (
                            <tr key={idx} className="hover:bg-slate-800/40">
                              <td className="py-2 px-3 font-bold text-white">{ev.graha_name}</td>
                              <td className="py-2 px-3 font-semibold text-amber-300">{ev.transit_rashi_name}</td>
                              <td className="py-2 px-3 font-mono text-cyan-400">{ev.start_date}</td>
                              <td className="py-2 px-3 font-mono text-rose-400">{ev.end_date}</td>
                              <td className="py-2 px-3 text-center">
                                <span className="font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded text-[11px]">
                                  House {ev.house_from_natal_lagna}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-center">
                                <span className="font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded text-[11px]">
                                  House {ev.house_from_natal_rashi}
                                </span>
                              </td>
                              <td className="py-2 px-3 text-slate-300">
                                <div className="font-semibold text-slate-200 flex items-center gap-1.5 flex-wrap">
                                  <span>{ev.nakshatra_name}</span>
                                  {getStarLordShort(ev.nakshatra_name) && (
                                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                      ({getStarLordShort(ev.nakshatra_name)})
                                    </span>
                                  )}
                                </div>
                                <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                                  Pada {ev.pada}
                                </div>
                              </td>
                              <td className="py-2 px-3 text-slate-400 text-[11px] font-mono">
                                {ev.summary_text}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Saturn Dedicated Sani Peyarchi Tracker */}
              {transitViewMode === 'saturn_tracker' && (
                <div className="space-y-4">
                  <div className="bg-gradient-to-r from-amber-500/10 via-slate-900 to-indigo-500/10 border border-amber-500/30 rounded-xl p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <h5 className="text-sm font-bold text-white flex items-center gap-2">
                          <span>🪐</span>
                          Saturn (Sani Bhagavan) Orbit &amp; Transit Engine Verification
                        </h5>
                        <p className="text-xs text-slate-300 mt-1 max-w-3xl leading-relaxed">
                          Astronomical Orbital Period: <strong>29.457 Julian Years</strong> for 360° zodiac = <strong>~2.46 years (around 30 months)</strong> per sign.
                          Below is the exact chronological sequence of every Saturn sign ingress across your selected timeline ({apiResponse.requested_timeline.start_date} to {apiResponse.requested_timeline.end_date}). Notice that Saturn systematically advances to the next sign every 2 to 2.8 years!
                        </p>
                      </div>
                      <div className="bg-slate-950 px-3 py-1.5 rounded-lg border border-slate-800 text-xs font-mono text-amber-400">
                        Rate: ~12.2° per year (~2.5 yrs / 30°)
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-800 text-slate-300 font-mono text-[11px] uppercase">
                        <tr>
                          <th className="py-2.5 px-3">#</th>
                          <th className="py-2.5 px-3">Transit Sign</th>
                          <th className="py-2.5 px-3">Start Date</th>
                          <th className="py-2.5 px-3">End Date</th>
                          <th className="py-2.5 px-3 text-center">Duration</th>
                          <th className="py-2.5 px-3 text-center bg-cyan-950/20 text-cyan-300">House from Lagna</th>
                          <th className="py-2.5 px-3 text-center bg-rose-950/20 text-rose-300">House from Moon</th>
                          <th className="py-2.5 px-3">Star &amp; Pada</th>
                          <th className="py-2.5 px-3 text-center">Stay Length</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-800 text-slate-300">
                        {activeTransitTimeline.major_transits_timeline
                          .filter(ev => ev.graha_name.includes('Saturn') || ev.graha_name.includes('சனி'))
                          .map((ev, idx) => {
                            let durStr = '-';
                            try {
                              const d1 = new Date(ev.start_date);
                              const d2 = new Date(ev.end_date);
                              const days = Math.round((d2.getTime() - d1.getTime()) / (1000 * 60 * 60 * 24));
                              const yrs = (days / 365.25).toFixed(1);
                              durStr = `${days} days (~${yrs} yrs)`;
                            } catch {}

                            return (
                              <tr key={idx} className="hover:bg-slate-800/40">
                                <td className="py-2.5 px-3 font-mono text-slate-500">{idx + 1}</td>
                                <td className="py-2.5 px-3 font-bold text-amber-300">
                                  {ev.transit_rashi_name} <span className="text-[10px] text-slate-400 font-normal">({ev.transit_rashi_tamil})</span>
                                </td>
                                <td className="py-2.5 px-3 font-mono text-cyan-400">{ev.start_date}</td>
                                <td className="py-2.5 px-3 font-mono text-rose-400">{ev.end_date}</td>
                                <td className="py-2.5 px-3 text-center font-mono font-semibold text-emerald-400 bg-emerald-500/5">
                                  {durStr}
                                </td>
                                <td className="py-2.5 px-3 text-center bg-cyan-950/10">
                                  <span className="font-bold text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded text-[11px]">
                                    House {ev.house_from_natal_lagna}
                                  </span>
                                  <span className="block text-[10px] text-slate-400 mt-0.5">{ev.house_from_natal_lagna_title}</span>
                                </td>
                                <td className="py-2.5 px-3 text-center bg-rose-950/10">
                                  <span className="font-bold text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded text-[11px]">
                                    House {ev.house_from_natal_rashi}
                                  </span>
                                  <span className="block text-[10px] text-slate-400 mt-0.5">{ev.house_from_natal_rashi_title}</span>
                                </td>
                                <td className="py-2.5 px-3 text-slate-300">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="font-semibold text-slate-200">{ev.nakshatra_name}</span>
                                    {getStarLordShort(ev.nakshatra_name) && (
                                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                        ({getStarLordShort(ev.nakshatra_name)})
                                      </span>
                                    )}
                                    <span className="text-slate-400 text-[11px] font-mono">(P{ev.pada})</span>
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-center">
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                    ~2.5 YRS / SIGN
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* SUB-TAB: OPTION B HIGH-DENSITY LLM MARKDOWN (ZERO PII) */}
          {activeSubTab === 'markdown' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex flex-wrap items-center justify-between pb-3 border-b border-slate-800 gap-4">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    Option B: High-Density LLM Markdown Prompt (Strict Zero-PII)
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Anonymized astrological context matrix engineered specifically for Gemini Pro, Claude 3.5, and GPT-4o reasoning.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800 text-xs">
                    <button
                      onClick={() => setMarkdownView('preview')}
                      className={`px-3 py-1 rounded font-semibold transition ${
                        markdownView === 'preview' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Formatted View
                    </button>
                    <button
                      onClick={() => setMarkdownView('raw')}
                      className={`px-3 py-1 rounded font-semibold transition ${
                        markdownView === 'raw' ? 'bg-amber-500 text-slate-950 shadow-sm' : 'text-slate-400 hover:text-white'
                      }`}
                    >
                      Raw Prompt Code
                    </button>
                  </div>

                  <button
                    onClick={() => copyToClipboard(llmMarkdownString, 'llm_md')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white transition shadow-sm"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    {copied === 'llm_md' ? 'Copied LLM Prompt!' : 'Copy Clean LLM Prompt'}
                  </button>

                  <button
                    onClick={() =>
                      downloadFile(
                        `${apiResponse.person_id}_llm_prompt.md`,
                        llmMarkdownString,
                        'text/markdown'
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                  >
                    <Download className="w-3.5 h-3.5 text-cyan-400" />
                    Download .md
                  </button>
                </div>
              </div>

              {/* Badges / Metrics Bar */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <ShieldCheck className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">PII Sanitization</div>
                    <div className="text-xs font-bold text-emerald-400">100% Stripped &amp; Anonymous</div>
                  </div>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Prompt Footprint</div>
                    <div className="text-xs font-bold text-amber-300">~{llmTokenEst.toLocaleString()} tokens</div>
                  </div>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                    <Clock className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Prompt Space Saved</div>
                    <div className="text-xs font-bold text-cyan-300">
                      {Math.max(0, Math.round((1 - llmTokenEst / (jsonTokenEst || 1)) * 100))}% reduction vs JSON
                    </div>
                  </div>
                </div>

                <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/10 border border-purple-500/20 text-purple-400">
                    <Globe className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="text-[11px] text-slate-400">Gochara (Transit)</div>
                    <div className="text-xs font-bold text-purple-300">Dual Houses (H_L &amp; H_M)</div>
                  </div>
                </div>
              </div>

              {/* Zero-PII Guarantee Notice */}
              <div className="text-xs text-slate-400 bg-slate-950/60 p-3 rounded-xl border border-slate-800/80 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                <div className="leading-relaxed">
                  <strong className="text-slate-200">Zero-PII Sanitization Guarantee:</strong> Human personal names, age, birth date, birth place, and Tamil prose are permanently excluded from this payload. The LLM only receives astrological coordinates (Lagna, Moon, planetary degrees, D1/D9 matrices, sequential PD sub-periods, and transit house activations).
                </div>
              </div>

              {/* Content Body */}
              {markdownView === 'raw' ? (
                <pre className="bg-slate-950 text-cyan-300 p-4 rounded-xl border border-slate-800 text-xs font-mono overflow-x-auto max-h-[550px] leading-relaxed select-all">
                  <code>{llmMarkdownString}</code>
                </pre>
              ) : (
                <div className="bg-slate-950 p-5 rounded-xl border border-slate-800 text-xs text-slate-200 max-h-[550px] overflow-y-auto space-y-4 font-mono leading-relaxed select-all">
                  <pre className="whitespace-pre-wrap font-mono text-slate-300 text-xs leading-relaxed">
                    {llmMarkdownString}
                  </pre>
                </div>
              )}
            </div>
          )}

          {activeSubTab === 'json' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    Standardized REST API JSON Response Structure
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Includes unique response tag, 1..100 sequence, person profile, D1/D9 placements, and all PD intervals.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(jsonString, 'raw_json')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                  >
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    {copied === 'raw_json' ? 'Copied!' : 'Copy JSON'}
                  </button>
                  <button
                    onClick={() =>
                      downloadFile(
                        `${apiResponse.unique_response_id}.json`,
                        jsonString,
                        'application/json'
                      )
                    }
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download JSON
                  </button>
                </div>
              </div>

              <pre className="bg-slate-950 text-cyan-300 p-4 rounded-xl border border-slate-800 text-xs font-mono overflow-x-auto max-h-[550px] leading-relaxed">
                <code>{jsonString}</code>
              </pre>
            </div>
          )}

          {/* SUB-TAB 4: CLIENT CALL SNIPPETS */}
          {activeSubTab === 'clients' && (
            <div className="space-y-4">
              {/* How to run API server & All-In-One Launcher */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Terminal className="w-4 h-4 text-emerald-400" />
                    Unified One-Go Startup Script (starts both REST API &amp; UI together)
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(START_CMD_TEXT, 'copy_start_cmd')}
                      className="inline-flex items-center gap-1 text-xs text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 px-2.5 py-1 rounded border border-slate-700 transition"
                    >
                      <Copy className="w-3 h-3 text-amber-400" />
                      {copied === 'copy_start_cmd' ? 'Copied start.cmd!' : 'Copy start.cmd'}
                    </button>
                    <button
                      onClick={() => downloadFile('start.cmd', START_CMD_TEXT, 'text/plain')}
                      className="inline-flex items-center gap-1 text-xs text-slate-950 font-bold bg-amber-500 hover:bg-amber-400 px-2.5 py-1 rounded transition"
                    >
                      <Download className="w-3 h-3" />
                      Download start.cmd
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Avoid starting UI and Python services separately! Use the newly updated <strong>start.cmd</strong> (Windows) or <strong>npm run start:all</strong> (Cross-Platform) to launch both the Python REST API server (port 5000) and the Vite frontend (port 3000) simultaneously with live console health &amp; readiness status:
                </p>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs font-mono">
                  <div className="bg-slate-950 p-3.5 rounded-lg border border-amber-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-amber-400 font-bold text-[11px]">Option A: Windows Batch (start.cmd)</span>
                      <button
                        onClick={() => copyToClipboard('start.cmd', 'cmd_bat')}
                        className="text-slate-400 hover:text-white"
                      >
                        {copied === 'cmd_bat' ? 'Copied' : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <code className="text-emerald-300 block">start.cmd</code>
                    <p className="text-[11px] text-slate-400 font-sans">
                      Double-click in Windows Explorer or execute in cmd. Launches REST API in a monitored window and starts the Vite UI.
                    </p>
                  </div>

                  <div className="bg-slate-950 p-3.5 rounded-lg border border-cyan-500/30 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-cyan-400 font-bold text-[11px]">Option B: Cross-Platform (NPM / Node)</span>
                      <button
                        onClick={() => copyToClipboard('npm run start:all', 'cmd_npm_all')}
                        className="text-slate-400 hover:text-white"
                      >
                        {copied === 'cmd_npm_all' ? 'Copied' : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                    <code className="text-cyan-300 block">npm run start:all</code>
                    <p className="text-[11px] text-slate-400 font-sans">
                      Runs concurrently on Windows, Linux, and macOS. Streams both service outputs with colored tags.
                    </p>
                  </div>
                </div>

                <div className="text-[11px] text-slate-400 bg-slate-950/60 p-2.5 rounded-lg border border-slate-800 space-y-1">
                  <div className="font-semibold text-slate-300">Individual Manual Commands:</div>
                  <div className="flex flex-wrap items-center gap-3 font-mono">
                    <span className="text-amber-400">Terminal 1: <code>python run_api_server.py</code> (Port 5000)</span>
                    <span className="text-slate-600">|</span>
                    <span className="text-cyan-400">Terminal 2: <code>npm run dev</code> (Port 3000)</span>
                  </div>
                </div>
              </div>

              {/* Option B: LLM Markdown Request (Zero PII) */}
              <div className="bg-gradient-to-br from-slate-900 to-indigo-950/40 border border-indigo-500/30 rounded-xl p-5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400" />
                    <span className="text-sm font-bold text-white">
                      Option B: Direct LLM Prompt Call (format=llm_markdown, Zero PII)
                    </span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      PII Stripped
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => copyToClipboard(curlMarkdownCommand, 'curl_md')}
                      className="inline-flex items-center gap-1 text-xs text-slate-200 hover:text-white bg-slate-800 px-2.5 py-1 rounded border border-slate-700"
                    >
                      <Copy className="w-3 h-3 text-cyan-400" />
                      {copied === 'curl_md' ? 'Copied cURL!' : 'Copy cURL'}
                    </button>
                    <button
                      onClick={() => copyToClipboard(pythonMarkdownClientCode, 'py_md')}
                      className="inline-flex items-center gap-1 text-xs text-slate-200 hover:text-white bg-slate-800 px-2.5 py-1 rounded border border-slate-700"
                    >
                      <Copy className="w-3 h-3 text-emerald-400" />
                      {copied === 'py_md' ? 'Copied Python!' : 'Copy Python'}
                    </button>
                  </div>
                </div>

                <p className="text-xs text-slate-300 leading-relaxed">
                  Call the API with <code className="text-amber-300 font-mono">format=llm_markdown</code>. The server automatically excludes all personal identifiers (name, age, DOB, POB, Tamil text) and returns a concise, token-compressed Markdown document with 100% of astrological coordinates ready for Gemini or Claude.
                </p>

                <pre className="bg-slate-950 text-cyan-300 p-4 rounded-xl border border-slate-800 text-xs font-mono overflow-x-auto leading-relaxed">
                  <code>{curlMarkdownCommand}</code>
                </pre>
              </div>

              {/* cURL Example (Default Full JSON) */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Code2 className="w-4 h-4 text-cyan-400" />
                    Default Full JSON Response (cURL Command)
                  </div>
                  <button
                    onClick={() => copyToClipboard(curlCommand, 'curl')}
                    className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white bg-slate-800 px-2.5 py-1 rounded border border-slate-700"
                  >
                    <Copy className="w-3 h-3 text-amber-400" />
                    {copied === 'curl' ? 'Copied!' : 'Copy cURL'}
                  </button>
                </div>
                <pre className="bg-slate-950 text-slate-200 p-4 rounded-xl border border-slate-800 text-xs font-mono overflow-x-auto leading-relaxed">
                  <code>{curlCommand}</code>
                </pre>
              </div>

              {/* Python requests Example (Option B vs Full) */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-white">
                    <Code2 className="w-4 h-4 text-emerald-400" />
                    Python Client Example (Option B: LLM Markdown Prompt Injection)
                  </div>
                  <button
                    onClick={() => copyToClipboard(pythonMarkdownClientCode, 'py_client')}
                    className="inline-flex items-center gap-1 text-xs text-slate-300 hover:text-white bg-slate-800 px-2.5 py-1 rounded border border-slate-700"
                  >
                    <Copy className="w-3 h-3 text-amber-400" />
                    {copied === 'py_client' ? 'Copied!' : 'Copy Python'}
                  </button>
                </div>
                <pre className="bg-slate-950 text-emerald-300 p-4 rounded-xl border border-slate-800 text-xs font-mono overflow-x-auto leading-relaxed">
                  <code>{pythonMarkdownClientCode}</code>
                </pre>
              </div>
            </div>
          )}

          {/* SUB-TAB 5: TRANSACTION AUDIT LOG (user_queries) */}
          {activeSubTab === 'audit' && (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                <div>
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Database className="w-4 h-4 text-purple-400" />
                    Transaction Audit Table: `user_queries`
                  </h4>
                  <p className="text-xs text-slate-400 mt-0.5">
                    Stores the generated JSON response, requested time period, and cycling 1..100 running number for every API call.
                  </p>
                </div>
                <span className="text-xs font-mono bg-purple-500/10 text-purple-300 px-2.5 py-1 rounded border border-purple-500/20">
                  Cycling Sequence: user_query_seq (1..100)
                </span>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800 text-slate-300 font-mono text-[11px] uppercase">
                    <tr>
                      <th className="py-2.5 px-3">Unique Query ID</th>
                      <th className="py-2.5 px-3 text-center">Running #</th>
                      <th className="py-2.5 px-3">Person ID</th>
                      <th className="py-2.5 px-3">Start Date</th>
                      <th className="py-2.5 px-3">End Date</th>
                      <th className="py-2.5 px-3">Created Timestamp</th>
                      <th className="py-2.5 px-3 text-center">Payload Saved</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {queryHistory.map((item, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="py-2.5 px-3 font-mono font-bold text-amber-300">
                          {item.query_id}
                        </td>
                        <td className="py-2.5 px-3 text-center font-mono">
                          <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                            #{item.running_number}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 font-mono text-slate-300">{item.person_id}</td>
                        <td className="py-2.5 px-3 font-mono text-cyan-400">{item.start_date}</td>
                        <td className="py-2.5 px-3 font-mono text-rose-400">{item.end_date}</td>
                        <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                          {item.created_at ? new Date(item.created_at).toLocaleString() : 'Just now'}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                            JSONB Stored
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
            </div>
          )}
        </div>
      )}

      {/* SECTION 3: Database Transaction Audit Table (user_queries) */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-sm transition-all">
        <div
          onClick={() => setExpandAuditLog(!expandAuditLog)}
          className="p-3.5 sm:p-4 flex flex-wrap items-center justify-between gap-3 cursor-pointer hover:bg-slate-800/40 border-b border-slate-800 select-none"
        >
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400">
              <Database className="w-4 h-4" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-white">3. Database Transaction Audit Table (`user_queries`)</span>
                <span className="text-xs font-mono bg-purple-500/10 text-purple-300 px-2 py-0.5 rounded border border-purple-500/20">
                  {queryHistory.length} Logged Queries
                </span>
              </div>
              <div className="text-xs text-slate-400">
                Stores generated JSON responses, time spans, and cycling 1..100 sequence numbers.
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5" onClick={(e) => e.stopPropagation()}>
            <span className="text-xs font-mono text-slate-400 hidden sm:inline">
              Sequence: user_query_seq (1..100)
            </span>
            <button
              onClick={() => setExpandAuditLog(!expandAuditLog)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition cursor-pointer"
              title={expandAuditLog ? "Minimize Section 3" : "Expand Section 3"}
            >
              {expandAuditLog ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {expandAuditLog && (
          <div className="p-4 sm:p-5">
            <div className="overflow-x-auto border border-slate-800 rounded-xl">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-800 text-slate-300 font-mono text-[11px] uppercase">
                  <tr>
                    <th className="py-2.5 px-3">Unique Query ID</th>
                    <th className="py-2.5 px-3 text-center">Running #</th>
                    <th className="py-2.5 px-3">Person ID</th>
                    <th className="py-2.5 px-3">Start Date</th>
                    <th className="py-2.5 px-3">End Date</th>
                    <th className="py-2.5 px-3">Created Timestamp</th>
                    <th className="py-2.5 px-3 text-center">Payload Saved</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800 text-slate-300">
                  {queryHistory.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-800/40">
                      <td className="py-2.5 px-3 font-mono font-bold text-amber-300">
                        {item.query_id}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono">
                        <span className="px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 font-bold border border-indigo-500/30">
                          #{item.running_number}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-300">{item.person_id}</td>
                      <td className="py-2.5 px-3 font-mono text-cyan-400">{item.start_date}</td>
                      <td className="py-2.5 px-3 font-mono text-rose-400">{item.end_date}</td>
                      <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                        {item.created_at ? new Date(item.created_at).toLocaleString() : 'Just now'}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          JSONB Stored
                        </span>
                      </td>
                    </tr>
                  ))}
                  {queryHistory.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-6 text-center text-slate-500 italic">
                        No transactions recorded yet in user_queries table.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
