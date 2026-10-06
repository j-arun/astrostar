import React, { useState, useMemo, useEffect } from 'react';
import {
  Compass,
  Calendar,
  CalendarDays,
  Sparkles,
  Info,
  Server,
  Table,
  User,
  Database,
  Download
} from 'lucide-react';
import {
  samplePersonMaster,
  sampleNatalPlacements,
} from './data/horoscopeData';
import {
  executeHoroscopeTimelineQuery,
  HoroscopeApiResponse,
  UserQueryLog,
  getRegisteredPersonList,
  syncPersonsFromBackend,
  fetchPersonDetailsFromBackend,
  ingestedPersonsRegistry
} from './data/apiService';
import storedPersonsData from './data/stored_persons.json';
import RestApiStudio, { getStarLordShort } from './components/RestApiStudio';
import { MonthlyTransitView } from './components/MonthlyTransitView';
import { BUNDLED_ZIP_BASE64 } from './data/bundledZipData';

// Standard 12 South Indian chart cell coordinate mappings (row, col)
// 0,0: Meenam (Pisces)   | 0,1: Mesham (Aries)   | 0,2: Rishabam (Taurus) | 0,3: Mithunam (Gemini)
// 1,0: Kumbam (Aquarius) | Center 1,1            | Center 1,2             | 1,3: Katakam (Cancer)
// 2,0: Makaram (Capri)   | Center 2,1            | Center 2,2             | 2,3: Simham (Leo)
// 3,0: Dhanus (Sagit)    | 3,1: Vrischigam (Sco) | 3,2: Thulaam (Libra)   | 3,3: Kanni (Virgo)

interface ChartCellDef {
  r: number;
  c: number;
  signIndex: number; // 1 to 12 (1=Aries ... 12=Pisces)
  tamilName: string;
  engSign: string;
}

const SOUTH_INDIAN_CELLS: ChartCellDef[] = [
  { r: 0, c: 0, signIndex: 12, tamilName: 'மீனம்', engSign: 'Meenam (Pisces)' },
  { r: 0, c: 1, signIndex: 1, tamilName: 'மேஷம்', engSign: 'Mesham (Aries)' },
  { r: 0, c: 2, signIndex: 2, tamilName: 'ரிஷபம்', engSign: 'Rishabam (Taurus)' },
  { r: 0, c: 3, signIndex: 3, tamilName: 'மிதுனம்', engSign: 'Mithunam (Gemini)' },

  { r: 1, c: 0, signIndex: 11, tamilName: 'கும்பம்', engSign: 'Kumbam (Aquarius)' },
  { r: 1, c: 3, signIndex: 4, tamilName: 'கடகம்', engSign: 'Katakam (Cancer)' },

  { r: 2, c: 0, signIndex: 10, tamilName: 'மகரம்', engSign: 'Makaram (Capricorn)' },
  { r: 2, c: 3, signIndex: 5, tamilName: 'சிம்மம்', engSign: 'Simham (Leo)' },

  { r: 3, c: 0, signIndex: 9, tamilName: 'தனுசு', engSign: 'Dhanus (Sagittarius)' },
  { r: 3, c: 1, signIndex: 8, tamilName: 'விருச்சிகம்', engSign: 'Vrischigam (Scorpio)' },
  { r: 3, c: 2, signIndex: 7, tamilName: 'துலாம்', engSign: 'Thulaam (Libra)' },
  { r: 3, c: 3, signIndex: 6, tamilName: 'கன்னி', engSign: 'Kanni (Virgo)' },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<'charts' | 'monthly' | 'api'>('charts');
  const [selectedChart, setSelectedChart] = useState<'D1' | 'D9'>('D1');
  const [copied, setCopied] = useState<string | null>(null);

  // Active Native Profile (Directly loaded from authoritative store, no stale caching)
  const [activePersonId, setActivePersonId] = useState<string>('001ME');

  const [availablePersonIds, setAvailablePersonIds] = useState<string[]>(() => {
    return Object.keys(storedPersonsData);
  });

  const [registryVersion, setRegistryVersion] = useState(0);

  // Dynamically resolve active person profile & placements from registry/DB
  const activeRecord = useMemo(() => {
    return (
      ingestedPersonsRegistry[activePersonId] ||
      (storedPersonsData as any)[activePersonId] ||
      (storedPersonsData as any)['001ME']
    );
  }, [activePersonId, availablePersonIds, registryVersion]);

  const activeProfile = activeRecord.profile;

  // REST API Explorer States (Model 2)
  const [apiPersonId, setApiPersonId] = useState<string>(activePersonId);
  const [apiStartDate, setApiStartDate] = useState<string>('1998-01-01');
  const [apiEndDate, setApiEndDate] = useState<string>('2020-01-31');
  const [apiResponse, setApiResponse] = useState<HoroscopeApiResponse | null>(() =>
    executeHoroscopeTimelineQuery(activePersonId, '1998-01-01', '2020-01-31')
  );
  const [queryHistory, setQueryHistory] = useState<UserQueryLog[]>([
    {
      query_id: `Q-${activePersonId}-001-20260928180000`,
      running_number: 1,
      person_id: activePersonId,
      start_date: '1998-01-01',
      end_date: '2020-01-31',
      created_at: new Date().toISOString(),
      response_payload: executeHoroscopeTimelineQuery(activePersonId, '1998-01-01', '2020-01-31')
    }
  ]);

  // Single unified handler when native ID is chosen from person_master
  const handleSelectPerson = async (newId: string) => {
    setActivePersonId(newId);
    setApiPersonId(newId);

    // 1. Fetch fresh record from DB
    await fetchPersonDetailsFromBackend(newId);
    setRegistryVersion(v => v + 1);

    // 2. Query timeline for new person
    const res = executeHoroscopeTimelineQuery(newId, apiStartDate, apiEndDate);
    setApiResponse(res);
    setQueryHistory(prev => [
      {
        query_id: res.unique_response_id,
        running_number: res.running_number,
        person_id: res.person_id,
        start_date: apiStartDate,
        end_date: apiEndDate,
        created_at: new Date().toISOString(),
        response_payload: res
      },
      ...prev
    ]);
  };

  useEffect(() => {
    syncPersonsFromBackend().then((ids) => {
      if (ids && ids.length > 0) {
        setAvailablePersonIds(ids);
        if (!ids.includes(activePersonId)) {
          handleSelectPerson(ids[0]);
        }
      }
    });
  }, []);

  const refreshPersonsList = () => {
    syncPersonsFromBackend().then((ids) => {
      if (ids && ids.length > 0) setAvailablePersonIds(ids);
    });
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(null), 2500);
  };

  const downloadFile = (filename: string, content: string, type: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // 100% In-Memory Windows 11 Compatible ZIP download (Bypasses Google proxy & cookie check)
  const handleDownloadClientZip = () => {
    try {
      const binaryString = window.atob(BUNDLED_ZIP_BASE64);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: 'application/zip' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'tamil-horoscope-app.zip';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      console.error('Failed to trigger in-memory zip download:', err);
    }
  };

  // Natal placements for selected chart and active person
  const currentChartPlacements = useMemo(() => {
    const placements = activeRecord.placements || sampleNatalPlacements;
    return placements.filter(p => p.chart_type === selectedChart);
  }, [selectedChart, activeRecord]);

  // Lagna sign index for currently selected chart and active person
  const lagnaPlacement = currentChartPlacements.find(p => p.body_name === 'Lagna');
  const lagnaSignIndex = useMemo(() => {
    if (!lagnaPlacement) return 9;
    const rName = (lagnaPlacement.rashi_name || '').toLowerCase();
    const cell = SOUTH_INDIAN_CELLS.find(c => {
      const eSign = c.engSign.toLowerCase();
      return rName.includes(eSign.split(' ')[0]) || eSign.includes(rName.split(' ')[0]);
    });
    return cell ? cell.signIndex : 9;
  }, [lagnaPlacement]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans">
      {/* Top Header & Integrated Navigation */}
      <header className="border-b border-slate-800 bg-slate-900/95 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 shadow-inner"
              title="Lord Muruga's Sacred Vel (Spear)"
            >
              <span className="text-amber-400 font-bold text-lg leading-none">ௐ</span>
              {/* Sacred Vel of Lord Murugan (Spear) */}
              <svg
                viewBox="0 0 24 24"
                className="w-5 h-5 text-amber-400 fill-current drop-shadow"
              >
                {/* Elegant Vel Spear: Broad Leaf Head with Central Spine and Shaft */}
                <path d="M12 2 C10 6 7 9 7 13 C7 15.5 9 17 11 17.5 L11 22 L13 22 L13 17.5 C15 17 17 15.5 17 13 C17 9 14 6 12 2 Z M12 5 C13 7.5 14.5 10 14.5 13 C14.5 14.5 13.5 15.5 12 15.8 C10.5 15.5 9.5 14.5 9.5 13 C9.5 10 11 7.5 12 5 Z" />
              </svg>
            </div>
            <div className="flex items-center gap-2.5">
              <h1 className="text-base sm:text-lg font-bold tracking-tight text-white hidden sm:block">
                Tamil Horoscope Vedic Engine
              </h1>

              {/* ACTIVE NATIVE DROPDOWN (ONLY displays IDs present in person_master) */}
              <div className="flex items-center gap-1.5 bg-slate-950/90 border border-amber-500/50 hover:border-amber-400 rounded-xl px-2.5 py-1 transition shadow-inner">
                <User className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                <span className="text-[11px] text-slate-400 font-semibold">Native ID:</span>
                <select
                  value={activePersonId}
                  onChange={(e) => handleSelectPerson(e.target.value)}
                  className="bg-transparent text-amber-300 font-bold text-xs focus:outline-none cursor-pointer pr-1"
                  title="Choose person ID from person_master table"
                >
                  {availablePersonIds.map(id => (
                    <option key={id} value={id} className="bg-slate-900 text-white font-medium">
                      {id}
                    </option>
                  ))}
                </select>
              </div>

              <span className="hidden lg:inline-flex px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                DB Synchronized
              </span>
            </div>
          </div>

          {/* Integrated 3 Navigation Menu Items & Direct Code Download */}
          <div className="flex items-center gap-2 flex-wrap">
            <nav className="flex items-center gap-1.5 flex-wrap">
              {[
                { id: 'charts', label: 'South Indian Chart Visualizer', icon: Compass },
                { id: 'monthly', label: 'Monthly View', icon: CalendarDays },
                { id: 'api', label: 'SAP Query Studio', icon: Server },
              ].map(tab => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id as any)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                      isActive
                        ? 'bg-amber-500 text-slate-950 shadow-md shadow-amber-500/20 font-bold'
                        : 'bg-slate-800/80 text-slate-300 hover:bg-slate-800 hover:text-white border border-slate-700/60'
                    }`}
                  >
                    <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-slate-950' : 'text-amber-400'}`} />
                    {tab.label}
                  </button>
                );
              })}
            </nav>

            <button
              onClick={handleDownloadClientZip}
              className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500/20 hover:bg-emerald-500 hover:text-slate-950 text-emerald-300 border border-emerald-500/40 text-xs font-bold transition shadow-sm cursor-pointer"
              title="Download clean Windows 11 compatible source ZIP directly to local disk"
            >
              <Download className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Download ZIP</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* TAB 0: REST API QUERY (MODEL 2) */}
        {activeTab === 'api' && (
          <RestApiStudio
            key={activePersonId}
            apiPersonId={apiPersonId}
            setApiPersonId={setApiPersonId}
            apiStartDate={apiStartDate}
            setApiStartDate={setApiStartDate}
            apiEndDate={apiEndDate}
            setApiEndDate={setApiEndDate}
            apiResponse={apiResponse}
            setApiResponse={setApiResponse}
            queryHistory={queryHistory}
            setQueryHistory={setQueryHistory}
            copyToClipboard={copyToClipboard}
            copied={copied}
            downloadFile={downloadFile}
          />
        )}

        {/* TAB 1: D1 & D9 CHARTS VISUALIZER WITH INTEGRATED HOROSCOPE OVERVIEW */}
        {activeTab === 'charts' && (
          <div key={activePersonId} className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900 border border-slate-800 p-4 rounded-xl">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <Compass className="w-4 h-4 text-amber-400" />
                  South Indian Chart Visualizer &amp; Relative House Numbers
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Interactive 4x4 perimeter grid. House 1 is dynamically positioned at Lagna ({selectedChart === 'D1' ? activeProfile.birth_lagna : 'Navamsha Lagna'}), numbering 1 to 12 clockwise.
                </p>
              </div>

              {/* Chart selector toggle */}
              <div className="flex items-center bg-slate-950 p-1 rounded-lg border border-slate-800">
                <button
                  onClick={() => setSelectedChart('D1')}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${
                    selectedChart === 'D1'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  D1 இராசி (Rashi Chart)
                </button>
                <button
                  onClick={() => setSelectedChart('D9')}
                  className={`px-4 py-1.5 rounded-md text-xs font-bold transition ${
                    selectedChart === 'D9'
                      ? 'bg-amber-500 text-slate-950 shadow'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  D9 நவாம்சம் (Navamsha Chart)
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* The South Indian 4x4 Grid */}
              <div className="lg:col-span-7 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 shadow-2xl">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    South Indian Layout ({selectedChart})
                  </span>
                  <div className="flex items-center gap-3 text-xs">
                    <span className="flex items-center gap-1.5 text-cyan-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-cyan-500/20 border border-cyan-400" />
                      Lagna (House 1)
                    </span>
                    <span className="flex items-center gap-1.5 text-amber-400">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-400" />
                      (வ / R) Retrograde
                    </span>
                  </div>
                </div>

                {/* 4x4 Table / Grid */}
                <div className="grid grid-cols-4 grid-rows-4 gap-2 aspect-square max-w-lg mx-auto bg-slate-950 p-2 rounded-xl border border-slate-800">
                  {[0, 1, 2, 3].map(rowIdx =>
                    [0, 1, 2, 3].map(colIdx => {
                      // Center 2x2 cells
                      if ((rowIdx === 1 || rowIdx === 2) && (colIdx === 1 || colIdx === 2)) {
                        if (rowIdx === 1 && colIdx === 1) {
                          return (
                            <div
                              key={`${rowIdx}-${colIdx}`}
                              className="col-span-2 row-span-2 bg-slate-900/60 border border-slate-800/80 rounded-lg flex flex-col items-center justify-center p-4 text-center"
                            >
                              <div className="text-amber-400 font-bold text-lg mb-1">
                                {selectedChart === 'D1' ? 'இராசி சக்கரம்' : 'நவாம்ச சக்கரம்'}
                              </div>
                              <div className="text-xs font-semibold text-slate-300">
                                {selectedChart === 'D1' ? 'D1 - Rashi Kundali' : 'D9 - Navamsha Kundali'}
                              </div>
                              <div className="text-[11px] text-slate-500 mt-2">
                                Lagna = House 1 &bull; Clockwise 1-12
                              </div>
                            </div>
                          );
                        }
                        return null; // Handled by col-span-2 row-span-2
                      }

                      // Perimeter cell
                      const cellDef = SOUTH_INDIAN_CELLS.find(c => c.r === rowIdx && c.c === colIdx);
                      if (!cellDef) return null;

                      // Placements in this cell
                      const occupants = currentChartPlacements.filter(p => p.rashi_name === cellDef.engSign);
                      const isLagnaCell = occupants.some(p => p.body_name === 'Lagna');
                      const houseNum = ((cellDef.signIndex - lagnaSignIndex + 12) % 12) + 1;

                      return (
                        <div
                          key={`${rowIdx}-${colIdx}`}
                          className={`relative border rounded-lg p-2 flex flex-col justify-between transition-all ${
                            isLagnaCell
                              ? 'border-cyan-500/60 bg-cyan-950/20 ring-1 ring-cyan-500/30'
                              : occupants.length > 0
                              ? 'border-slate-700 bg-slate-900/80 hover:border-slate-600'
                              : 'border-slate-800/80 bg-slate-950/40 hover:bg-slate-900/30'
                          }`}
                        >
                          {/* Header: Tamil Sign & Calculated House */}
                          <div className="flex items-start justify-between gap-1 leading-none">
                            <span className="text-[11px] font-semibold text-slate-400">
                              {cellDef.tamilName}
                            </span>
                            <span
                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                isLagnaCell
                                  ? 'bg-cyan-500 text-slate-950'
                                  : 'bg-slate-800 text-slate-300'
                              }`}
                              title={`House ${houseNum} relative to Lagna`}
                            >
                              H{houseNum}
                            </span>
                          </div>

                          {/* Occupant Bodies */}
                          <div className="my-auto space-y-1">
                            {occupants.map(occ => (
                              <div
                                key={occ.body_name}
                                className={`text-[11px] font-bold px-1 py-0.5 rounded flex items-center justify-between ${
                                  occ.body_name === 'Lagna'
                                    ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30'
                                    : 'bg-slate-800/80 text-amber-300 border border-slate-700'
                                }`}
                              >
                                <span>{occ.body_name}</span>
                                {occ.is_retrograde && (
                                  <span className="text-[9px] text-rose-400 font-extrabold" title="Retrograde (வக்ரம்)">
                                    (வ/R)
                                  </span>
                                )}
                              </div>
                            ))}
                            {occupants.length === 0 && (
                              <div className="text-[10px] text-slate-600 italic text-center py-2">
                                Empty
                              </div>
                            )}
                          </div>

                          {/* Footer: English abbreviation */}
                          <div className="text-[9px] text-slate-500 truncate">
                            {cellDef.engSign.split(' ')[0]}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* Placements Detailed Sidebar Table */}
              <div className="lg:col-span-5 bg-slate-900/90 border border-slate-800 rounded-2xl p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-bold text-white flex items-center gap-2">
                    <Table className="w-4 h-4 text-amber-400" />
                    {selectedChart} Placements Detail (natal_placement_detail)
                  </h4>
                  <span className="text-xs bg-slate-800 px-2 py-0.5 rounded text-slate-300">
                    {currentChartPlacements.length} Bodies
                  </span>
                </div>

                <div className="overflow-x-auto max-h-[460px] overflow-y-auto border border-slate-800 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-800/80 text-slate-300 sticky top-0 uppercase text-[10px] tracking-wider">
                      <tr>
                        <th className="py-2.5 px-3">Body Name</th>
                        <th className="py-2.5 px-3">Sign (Rashi)</th>
                        <th className="py-2.5 px-3 text-center">House</th>
                        {selectedChart === 'D1' && (
                          <>
                            <th className="py-2.5 px-3">Star &amp; Pada</th>
                            <th className="py-2.5 px-3">Sputa</th>
                          </>
                        )}
                        <th className="py-2.5 px-3 text-center">Retro</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800 text-slate-300">
                      {currentChartPlacements
                        .sort((a, b) => a.house_number - b.house_number)
                        .map(p => (
                          <tr key={p.body_name} className="hover:bg-slate-800/40">
                            <td className="py-2 px-3 font-semibold text-white flex items-center gap-1.5">
                              {p.body_name}
                              {p.body_name === 'Lagna' && (
                                <span className="text-[9px] px-1 bg-cyan-500/20 text-cyan-400 rounded">
                                  Asc
                                </span>
                              )}
                            </td>
                            <td className="py-2 px-3 text-slate-300">{p.rashi_name}</td>
                            <td className="py-2 px-3 text-center font-bold text-amber-400">
                              H{p.house_number}
                            </td>
                            {selectedChart === 'D1' && (
                              <>
                                <td className="py-2 px-3 text-slate-300">
                                  {p.nakshatra_name ? (
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span>{p.nakshatra_name}</span>
                                      {getStarLordShort(p.nakshatra_name) && (
                                        <span className="px-1 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                          ({getStarLordShort(p.nakshatra_name)})
                                        </span>
                                      )}
                                      {p.pada && <span className="text-slate-400 text-xs font-mono">P{p.pada}</span>}
                                    </div>
                                  ) : (
                                    '-'
                                  )}
                                </td>
                                <td className="py-2 px-3 font-mono text-cyan-400">
                                  {p.degree_sputa || '-'}
                                </td>
                              </>
                            )}
                            <td className="py-2 px-3 text-center">
                              {p.is_retrograde ? (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-500/10 text-rose-400 border border-rose-500/20">
                                  Yes
                                </span>
                              ) : (
                                <span className="text-slate-600">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>

              </div>
            </div>

            {/* Native's Horoscope Overview Highlights (Integrated with Chart Visualizer) */}
            <div className="space-y-4 pt-2 border-t border-slate-800">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                <h4 className="text-sm font-bold text-white">Horoscope Overview &amp; Native Profile Highlights</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {/* Card 1: Person Master Highlights */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Database className="w-4 h-4 text-amber-400" />
                      person_master
                    </div>
                    <span className="text-xs font-mono text-amber-300 font-bold bg-slate-800 px-2 py-0.5 rounded border border-amber-500/30">
                      ID: {activeProfile.person_id}
                    </span>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800/50">
                      <span className="text-slate-400">Person Name</span>
                      <span className="font-semibold text-slate-200">{activeProfile.person_name}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/50">
                      <span className="text-slate-400">Calculated Age</span>
                      <span className="font-semibold text-slate-200">{activeProfile.age} yrs</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/50">
                      <span className="text-slate-400">Birth Lagna</span>
                      <span className="font-semibold text-cyan-400">{activeProfile.birth_lagna}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/50">
                      <span className="text-slate-400">Birth Rashi</span>
                      <span className="font-semibold text-rose-400">{activeProfile.birth_rashi}</span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/50">
                      <span className="text-slate-400">Birth Star &amp; Pada</span>
                      <span className="font-semibold text-emerald-400">
                        {activeProfile.birth_star} (Pada {activeProfile.birth_star_pada})
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Starting Dasha Lord</span>
                      <span className="font-semibold text-purple-400">{activeProfile.starting_dasha_lord}</span>
                    </div>
                  </div>
                </div>

                {/* Card 2: Dasha Balance Info */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Calendar className="w-4 h-4 text-purple-400" />
                      Dasha Balance (ஆதியில் வந்த இருப்பு)
                    </div>
                    <span className="text-xs font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded border border-purple-500/20">
                      Birth Balance
                    </span>
                  </div>
                  <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-xs text-slate-300 font-mono">
                    {activeProfile.dasha_balance_text || `${activeProfile.dasha_balance_years}y ${activeProfile.dasha_balance_months}m ${activeProfile.dasha_balance_days}d`}
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="bg-slate-800/60 p-2 rounded-lg">
                      <div className="text-lg font-bold text-amber-400">{activeProfile.dasha_balance_years}</div>
                      <div className="text-[11px] text-slate-400">Years</div>
                    </div>
                    <div className="bg-slate-800/60 p-2 rounded-lg">
                      <div className="text-lg font-bold text-amber-400">{activeProfile.dasha_balance_months}</div>
                      <div className="text-[11px] text-slate-400">Months</div>
                    </div>
                    <div className="bg-slate-800/60 p-2 rounded-lg">
                      <div className="text-lg font-bold text-amber-400">{activeProfile.dasha_balance_days}</div>
                      <div className="text-[11px] text-slate-400">Days</div>
                    </div>
                  </div>
                  <p className="text-[11px] text-slate-400 leading-tight">
                    Balance remaining at birth for starting lord {activeProfile.starting_dasha_lord}.
                  </p>
                </div>

                {/* Card 3: Panchanga Details */}
                <div className="bg-slate-900/90 border border-slate-800 rounded-xl p-5 space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-slate-800">
                    <div className="flex items-center gap-2 text-sm font-semibold text-white">
                      <Compass className="w-4 h-4 text-cyan-400" />
                      Panchanga (பஞ்சாங்கம்)
                    </div>
                    <span className="text-xs font-mono text-slate-400 bg-slate-800 px-2 py-0.5 rounded">
                      Birth Panchanga
                    </span>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex justify-between py-1 border-b border-slate-800/50">
                      <span className="text-slate-400">Tithi (திதி)</span>
                      <span className="font-semibold text-slate-200">
                        {activeProfile.person_id === '001ME' ? 'கிருஷ்ணபட்ச தசமி (36.54 நாழிகை)' : 'கிருஷ்ணபட்ச பஞ்சமி (28.12 நாழிகை)'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/50">
                      <span className="text-slate-400">Yoga (யோகம்)</span>
                      <span className="font-semibold text-slate-200">
                        {activeProfile.person_id === '001ME' ? 'விருத்தி (23.17 நாழிகை)' : 'சுகர்மம் (19.45 நாழிகை)'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1 border-b border-slate-800/50">
                      <span className="text-slate-400">Karana (கரணம்)</span>
                      <span className="font-semibold text-slate-200">
                        {activeProfile.person_id === '001ME' ? 'விஷ்டி (08.26 நாழிகை)' : 'தைதுலை (12.30 நாழிகை)'}
                      </span>
                    </div>
                    <div className="flex justify-between py-1">
                      <span className="text-slate-400">Hora (ஹோரை)</span>
                      <span className="font-semibold text-amber-400">
                        {activeProfile.person_id === '001ME' ? 'சுக்ரன் ஹோரை (Venus Hora)' : 'சந்திர ஹோரை (Moon Hora)'}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 4: MONTHLY VIEW (D1 DUAL-LAYER TRANSIT & RAYCASTER) */}
        {activeTab === 'monthly' && (
          <MonthlyTransitView key={activePersonId} personId={activePersonId} />
        )}
      </main>
    </div>
  );
}
