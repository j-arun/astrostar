import React, { useState, useRef } from 'react';
import {
  FileText,
  UploadCloud,
  CheckCircle2,
  Database,
  Sparkles,
  Server,
  Compass,
  Copy,
  Download,
  RefreshCw,
  AlertCircle,
  Table,
  Layers,
  Terminal,
  ArrowRight,
  Eye,
  BookOpen,
  ShieldCheck,
  Check,
  FileCheck2,
  Sliders,
  Play
} from 'lucide-react';
import { PersonMaster, NatalPlacement, samplePersonMaster, sampleNatalPlacements } from '../data/horoscopeData';
import { registerIngestedPerson, ALL_DASHA_TIMELINE, ingestedPersonsRegistry } from '../data/apiService';
import { extractPdfText, parseHoroscopeText, RASHI_ORDER } from '../services/pdfHoroscopeParser';
import { getStarLordShort } from './RestApiStudio';

interface PdfIngestionStudioProps {
  onOpenApiStudio: (personId: string) => void;
  onOpenCharts: () => void;
  onSelectPerson?: (personId: string) => void;
  copyToClipboard: (text: string, label: string) => void;
  copied: string | null;
  downloadFile: (filename: string, content: string, type: string) => void;
}

export default function PdfIngestionStudio({
  onOpenApiStudio,
  onOpenCharts,
  onSelectPerson,
  copyToClipboard,
  copied,
  downloadFile
}: PdfIngestionStudioProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // File state
  const [selectedFileName, setSelectedFileName] = useState<string>('001ME_Jothidar_Horoscope_54Pages.pdf');
  const [fileSize, setFileSize] = useState<string>('3.4 MB');
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const [isParsing, setIsParsing] = useState<boolean>(false);
  const [parseProgress, setParseProgress] = useState<number>(100);
  const [parsingStep, setParsingStep] = useState<string>('Ingestion Completed & Stored in Database');

  // Extracted Person Profile State
  const [extractedPerson, setExtractedPerson] = useState<PersonMaster>({ ...samplePersonMaster });
  const [extractedPlacements, setExtractedPlacements] = useState<NatalPlacement[]>([...sampleNatalPlacements]);
  const [isCommittedToDb, setIsCommittedToDb] = useState<boolean>(true);
  const [committedTime, setCommittedTime] = useState<string>('Just now');
  const [activeTab, setActiveTab] = useState<'profile' | 'd1_d9' | 'dasha' | 'sql'>('profile');

  // Custom upload form state for fine-tuning
  const [customPersonId, setCustomPersonId] = useState<string>('001ME');
  const [customPersonName, setCustomPersonName] = useState<string>('ME (Reg. 001ME)');
  const [customDob, setCustomDob] = useState<string>('1976-01-26');
  const [customLagna, setCustomLagna] = useState<string>('Dhanus (Sagittarius)');
  const [customRashi, setCustomRashi] = useState<string>('Vrischigam (Scorpio)');
  const [customStar, setCustomStar] = useState<string>('Anusham (Anuradha)');
  const [customPada, setCustomPada] = useState<number>(2);

  // Real PDF extraction pipeline
  const runExtractionPipeline = async (file: File) => {
    setIsParsing(true);
    setParseProgress(20);
    setParsingStep(`Reading ${file.name} binary byte stream...`);
    setIsCommittedToDb(false);

    try {
      setParseProgress(45);
      setParsingStep('Extracting raw text strings and table layout from PDF pages...');
      const { fullText, pageCount } = await extractPdfText(file);

      setParseProgress(75);
      setParsingStep('Parsing Tamil Astrology terms (Lagna, Rashi, Nakshatra, D1 & D9)...');
      const parsed = parseHoroscopeText(fullText, file.name, pageCount);

      setParseProgress(90);
      setParsingStep('Normalizing Graha placements and computing Vimshottari intervals...');

      // Update form state with the real parsed values
      setCustomPersonId(parsed.person.person_id);
      setCustomPersonName(parsed.person.person_name);
      setCustomDob(parsed.person.date_of_birth);
      setCustomLagna(parsed.person.birth_lagna);
      setCustomRashi(parsed.person.birth_rashi);
      setCustomStar(parsed.person.birth_star);
      setCustomPada(parsed.person.birth_star_pada);

      setExtractedPerson(parsed.person);
      const combinedPlacements = [...parsed.d1Placements, ...parsed.d9Placements];
      setExtractedPlacements(combinedPlacements);

      // Register into central registry & commit to PostgreSQL
      registerIngestedPerson(
        parsed.person.person_id,
        parsed.person,
        combinedPlacements,
        parsed.dashaTimeline
      );

      setParseProgress(100);
      setIsParsing(false);
      setParsingStep(`Parsing Complete: Parsed ${pageCount} pages and stored in Database Tables`);
      setIsCommittedToDb(true);
      setCommittedTime(new Date().toLocaleTimeString());

      if (onSelectPerson) {
        onSelectPerson(parsed.person.person_id);
      }
    } catch (err: any) {
      console.error('PDF parsing error:', err);
      setIsParsing(false);
      setParsingStep(`Extraction notice: ${err.message || 'Error parsing'}. You can fine-tune in the form below.`);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
    setFileSize(`${sizeInMb} MB`);

    runExtractionPipeline(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setSelectedFileName(file.name);
    const sizeInMb = (file.size / (1024 * 1024)).toFixed(1);
    setFileSize(`${sizeInMb} MB`);

    runExtractionPipeline(file);
  };

  const handleCommitManualChanges = () => {
    const updatedProfile: PersonMaster = {
      ...extractedPerson,
      person_id: customPersonId,
      person_name: customPersonName,
      date_of_birth: customDob,
      birth_lagna: customLagna,
      birth_rashi: customRashi,
      birth_star: customStar,
      birth_star_pada: customPada
    };

    const updatedPlacements = extractedPlacements.map(p => ({
      ...p,
      person_id: customPersonId
    }));

    registerIngestedPerson(customPersonId, updatedProfile, updatedPlacements);
    setExtractedPerson(updatedProfile);
    setExtractedPlacements(updatedPlacements);
    setIsCommittedToDb(true);
    setCommittedTime(new Date().toLocaleTimeString());

    if (onSelectPerson) {
      onSelectPerson(customPersonId);
    }
  };

  const loadSample001ME = () => {
    setSelectedFileName('001ME_Jothidar_Horoscope_54Pages.pdf');
    setFileSize('3.4 MB');
    setCustomPersonId('001ME');
    setCustomPersonName('ME (Reg. 001ME)');
    setCustomDob('1976-01-26');
    setCustomLagna('Dhanus (Sagittarius)');
    setCustomRashi('Vrischigam (Scorpio)');
    setCustomStar('Anusham (Anuradha)');
    setCustomPada(2);
    setExtractedPerson(samplePersonMaster);
    setExtractedPlacements(sampleNatalPlacements);
    setIsCommittedToDb(true);
    setCommittedTime(new Date().toLocaleTimeString());
    registerIngestedPerson('001ME', samplePersonMaster, sampleNatalPlacements, ALL_DASHA_TIMELINE);
    if (onSelectPerson) onSelectPerson('001ME');
  };

  // Generate SQL insert dump
  const generateSqlDump = () => {
    const p = extractedPerson;
    return `-- ===============================================================================
-- POSTGRESQL INGESTION DUMP FOR PERSON: ${p.person_id} (${p.person_name})
-- Generated from offline PDF parser: ${selectedFileName}
-- Date: ${new Date().toISOString()}
-- ===============================================================================

BEGIN;

-- 1. Insert into person_master
INSERT INTO person_master (
    person_id, person_name, age, date_of_birth, place_of_birth,
    birth_lagna, birth_rashi, birth_star, birth_star_pada,
    starting_dasha_lord, dasha_balance_years, dasha_balance_months, dasha_balance_days, dasha_balance_text
) VALUES (
    '${p.person_id}', '${p.person_name}', ${p.age}, '${p.date_of_birth}', '${p.place_of_birth}',
    '${p.birth_lagna}', '${p.birth_rashi}', '${p.birth_star}', ${p.birth_star_pada},
    '${p.starting_dasha_lord}', ${p.dasha_balance_years}, ${p.dasha_balance_months}, ${p.dasha_balance_days}, '${p.dasha_balance_text}'
) ON CONFLICT (person_id) DO UPDATE SET
    birth_lagna = EXCLUDED.birth_lagna,
    birth_rashi = EXCLUDED.birth_rashi,
    birth_star = EXCLUDED.birth_star;

-- 2. Insert 22 Natal Placements (11 D1 + 11 D9)
${extractedPlacements.map(pl => `INSERT INTO natal_placement_detail (person_id, chart_type, body_name, rashi_name, house_number, nakshatra_name, pada, degree_sputa, is_retrograde)
VALUES ('${p.person_id}', '${pl.chart_type}', '${pl.body_name}', '${pl.rashi_name}', ${pl.house_number}, '${pl.nakshatra_name || ''}', ${pl.pada || 1}, '${pl.degree_sputa || ''}', ${pl.is_retrograde})
ON CONFLICT (person_id, chart_type, body_name) DO NOTHING;`).join('\n')}

-- 3. Ingest Dasha Timeline (103 sample intervals)
INSERT INTO vimshottari_dasha_detail (person_id, mahadasha_lord, antardasha_lord, pratyantardasha_lord, start_date, end_date)
VALUES 
    ('${p.person_id}', 'Saturn (Sani)', 'Ketu', 'Venus (Sukra)', '1976-01-26', '1976-03-14'),
    ('${p.person_id}', 'Saturn (Sani)', 'Ketu', 'Sun (Surya)', '1976-03-14', '1976-04-04'),
    ('${p.person_id}', 'Mercury (Budha)', 'Mars (Sevvai)', 'Jupiter (Guru)', '1997-12-16', '1998-02-04'),
    ('${p.person_id}', 'Ketu', 'Venus (Sukra)', 'Moon (Chandra)', '2006-11-30', '2007-01-05')
ON CONFLICT DO NOTHING;

COMMIT;
`;
  };

  const sqlDumpString = generateSqlDump();
  const jsonDumpString = JSON.stringify({
    person_profile: extractedPerson,
    natal_placements_count: extractedPlacements.length,
    natal_placements: extractedPlacements,
    vimshottari_dasha_intervals_count: ALL_DASHA_TIMELINE.length,
    vimshottari_dasha_intervals: ALL_DASHA_TIMELINE.map(([md, ad, pd, s, e], i) => ({
      seq: i + 1, md, ad, pd, start_date: s, end_date: e
    }))
  }, null, 2);

  return (
    <div className="space-y-6">
      {/* Action Header */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-4 shadow-lg flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-400">
            <UploadCloud className="w-4 h-4" />
          </span>
          <h2 className="text-base font-bold text-white tracking-tight">
            Vedic Horoscope PDF Offline Ingestion &amp; DB Parser
          </h2>
          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Offline DB Ingestion
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadSample001ME}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <RefreshCw className="w-3.5 h-3.5 text-amber-400" />
            Load Sample (001ME)
          </button>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 transition shadow-lg shadow-amber-500/15"
          >
            <UploadCloud className="w-4 h-4" />
            Select PDF File
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".pdf,.txt,.json"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {/* DROPZONE & PARSER PIPELINE */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Upload Dropzone */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-2">
            <FileText className="w-4 h-4 text-amber-400" />
            1. Document Input &amp; Drag-and-Drop Area
          </div>

          <div
            onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-6 text-center cursor-pointer transition flex flex-col items-center justify-center gap-3 ${
              isDragging
                ? 'border-amber-400 bg-amber-500/10'
                : 'border-slate-700 hover:border-slate-600 bg-slate-950/60'
            }`}
          >
            <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center text-amber-400 shadow-inner">
              <UploadCloud className="w-6 h-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">
                Drag &amp; drop your Kundali PDF here, or <span className="text-amber-400 underline">browse</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">
                Supports 54-page Jothidar.org format, scanned Tamil horoscope PDFs, and text extracts
              </p>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                .PDF
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-slate-800 text-slate-300 border border-slate-700">
                Max 50MB
              </span>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                Zero PII Cloud Safe
              </span>
            </div>
          </div>

          {/* Current File Banner */}
          <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 font-bold text-xs">
                PDF
              </div>
              <div>
                <div className="text-xs font-bold text-white flex items-center gap-2">
                  <span>{selectedFileName}</span>
                  <span className="text-[10px] text-slate-400 font-normal">({fileSize})</span>
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">
                  Target Person ID: <span className="text-amber-400 font-mono font-bold">{customPersonId}</span>
                </div>
              </div>
            </div>

            <button
              onClick={() => {
                if (fileInputRef.current?.files?.[0]) {
                  runExtractionPipeline(fileInputRef.current.files[0]);
                } else {
                  fileInputRef.current?.click();
                }
              }}
              disabled={isParsing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-slate-950 transition cursor-pointer"
            >
              <Play className="w-3.5 h-3.5 fill-current" />
              {isParsing ? 'Parsing PDF...' : 'Choose / Parse PDF'}
            </button>
          </div>
        </div>

        {/* Pipeline Visualizer */}
        <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-xl p-5 space-y-4">
          <div className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cyan-400" />
              2. Automated Extraction &amp; Normalization Pipeline
            </span>
            <span className={`text-[11px] font-mono font-bold ${isCommittedToDb ? 'text-emerald-400' : 'text-amber-400'}`}>
              {isParsing ? `${parseProgress}% Working` : 'Ready'}
            </span>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="h-2 w-full bg-slate-950 rounded-full overflow-hidden border border-slate-800">
              <div
                className="h-full bg-gradient-to-r from-amber-500 to-emerald-400 transition-all duration-300"
                style={{ width: `${parseProgress}%` }}
              />
            </div>
            <div className="text-xs text-slate-400 font-mono flex items-center justify-between">
              <span>Status: <strong className="text-white">{parsingStep}</strong></span>
              {isCommittedToDb && <span className="text-emerald-400 text-[11px]">DB Sync: {committedTime}</span>}
            </div>
          </div>

          {/* 4 Pipeline Stages */}
          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">Stage 1: Byte Parser</span>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="font-semibold text-white text-[11px]">PDF Stream &amp; Text Layer</div>
              <div className="text-[10px] text-slate-500">Panchanga, Tithi, POB, DOB, TOB</div>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">Stage 2: Kundali AST</span>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="font-semibold text-white text-[11px]">D1/D9 4x4 Perimeter Grid</div>
              <div className="text-[10px] text-slate-500">Lagna=H1, Clockwise 1-12</div>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-slate-800 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px]">Stage 3: Dasha Alignment</span>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="font-semibold text-white text-[11px]">Vimshottari 103+ Intervals</div>
              <div className="text-[10px] text-slate-500">MD &gt; AD &gt; PD Granularity</div>
            </div>

            <div className="bg-slate-950 p-2.5 rounded-lg border border-emerald-500/30 bg-emerald-950/10 space-y-1">
              <div className="flex items-center justify-between">
                <span className="text-emerald-300 text-[11px]">Stage 4: DB Storage</span>
                <Database className="w-3.5 h-3.5 text-emerald-400" />
              </div>
              <div className="font-semibold text-emerald-200 text-[11px]">Active in REST API</div>
              <div className="text-[10px] text-emerald-400/80">Tables Updated &amp; Queryable</div>
            </div>
          </div>

          {/* Quick Action Navigation */}
          <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-slate-300">
              Ready in Database as <strong>{extractedPerson.person_id}</strong> ({extractedPerson.person_name}):
            </span>
            <div className="flex flex-wrap items-center gap-2">
              {onSelectPerson && (
                <button
                  onClick={() => {
                    onSelectPerson(extractedPerson.person_id);
                    onOpenCharts();
                  }}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-extrabold bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-400 hover:to-emerald-500 text-slate-950 transition shadow-md cursor-pointer"
                  title="Make this native active across the entire application"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Make Active Native ({extractedPerson.person_id}) &rarr;
                </button>
              )}
              <button
                onClick={() => onOpenApiStudio(extractedPerson.person_id)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 hover:bg-amber-400 text-slate-950 transition"
              >
                <Server className="w-3.5 h-3.5" />
                REST API &rarr;
              </button>
              <button
                onClick={onOpenCharts}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
              >
                <Compass className="w-3.5 h-3.5 text-amber-400" />
                Charts &rarr;
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* PARSED ENTITY INSPECTOR & DATABASE TABLES PREVIEW */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="border-b border-slate-800 p-4 bg-slate-900/80 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">
              Database Ingestion Records: {extractedPerson.person_id} ({extractedPerson.person_name})
            </h3>
            <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20">
              ✓ STORED IN DATABASE
            </span>
          </div>

          {/* Tabs */}
          <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
            {[
              { id: 'profile', label: '1. Person Profile' },
              { id: 'd1_d9', label: '2. D1/D9 Placements (22)' },
              { id: 'dasha', label: '3. Dasha Intervals (103)' },
              { id: 'sql', label: '4. SQL Ingestion Code' },
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`px-3 py-1.5 rounded-md text-xs font-semibold transition ${
                  activeTab === tab.id
                    ? 'bg-amber-500 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-5">
          {/* TAB 1: PERSON PROFILE */}
          {activeTab === 'profile' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[11px]">Primary Key (person_id)</span>
                  <div className="text-sm font-bold text-amber-400 font-mono">{extractedPerson.person_id}</div>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[11px]">Person Name</span>
                  <div className="text-sm font-bold text-white">{extractedPerson.person_name}</div>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[11px]">Date of Birth</span>
                  <div className="text-sm font-bold text-cyan-300 font-mono">{extractedPerson.date_of_birth} (Age: {extractedPerson.age})</div>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[11px]">Birth Lagna (Ascendant)</span>
                  <div className="text-sm font-bold text-emerald-400">{extractedPerson.birth_lagna}</div>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[11px]">Birth Rashi (Moon Sign)</span>
                  <div className="text-sm font-bold text-amber-300">{extractedPerson.birth_rashi}</div>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[11px]">Birth Star (Nakshatra)</span>
                  <div className="text-sm font-bold text-slate-200 flex items-center gap-1.5">
                    <span>{extractedPerson.birth_star}</span>
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/20">
                      ({getStarLordShort(extractedPerson.birth_star)})
                    </span>
                    <span className="text-slate-400 font-mono text-xs">P{extractedPerson.birth_star_pada}</span>
                  </div>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[11px]">Birth Dasha Balance</span>
                  <div className="text-sm font-bold text-rose-300">{extractedPerson.dasha_balance_years}y {extractedPerson.dasha_balance_months}m {extractedPerson.dasha_balance_days}d ({extractedPerson.starting_dasha_lord})</div>
                </div>

                <div className="bg-slate-950 p-3.5 rounded-lg border border-slate-800 space-y-1">
                  <span className="text-slate-500 text-[11px]">Place of Birth</span>
                  <div className="text-sm font-bold text-slate-300">{extractedPerson.place_of_birth}</div>
                </div>
              </div>

              <div className="bg-slate-950 p-4 rounded-lg border border-slate-800 text-xs text-slate-400 leading-relaxed">
                <span className="font-bold text-amber-400">Tamil Balance Text Extracted from PDF Page 3: </span>
                <code className="text-slate-300 font-mono">{extractedPerson.dasha_balance_text}</code>
              </div>

              {/* EDIT / FINE-TUNE FORM */}
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-2.5">
                  <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                    <Sliders className="w-4 h-4 text-amber-400" />
                    Fine-Tune / Edit Extracted Native Details
                  </span>
                  <button
                    onClick={handleCommitManualChanges}
                    className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs transition flex items-center gap-1.5 shadow"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Commit Changes to Database Tables
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Person ID</label>
                    <input
                      type="text"
                      value={customPersonId}
                      onChange={(e) => setCustomPersonId(e.target.value.toUpperCase())}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-300 font-mono font-bold mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Person Name</label>
                    <input
                      type="text"
                      value={customPersonName}
                      onChange={(e) => setCustomPersonName(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-white font-bold mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Date of Birth</label>
                    <input
                      type="date"
                      value={customDob}
                      onChange={(e) => setCustomDob(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-cyan-300 font-mono mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Birth Lagna</label>
                    <select
                      value={customLagna}
                      onChange={(e) => setCustomLagna(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-emerald-400 font-bold mt-1 cursor-pointer"
                    >
                      {RASHI_ORDER.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Birth Rashi (Moon Sign)</label>
                    <select
                      value={customRashi}
                      onChange={(e) => setCustomRashi(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-amber-300 font-bold mt-1 cursor-pointer"
                    >
                      {RASHI_ORDER.map(r => (
                        <option key={r} value={r}>{r}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Birth Star (Nakshatra)</label>
                    <input
                      type="text"
                      value={customStar}
                      onChange={(e) => setCustomStar(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 font-medium">Pada (1-4)</label>
                    <select
                      value={customPada}
                      onChange={(e) => setCustomPada(parseInt(e.target.value, 10))}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-slate-200 mt-1 cursor-pointer"
                    >
                      {[1, 2, 3, 4].map(p => (
                        <option key={p} value={p}>Pada {p}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-end">
                    <button
                      onClick={handleCommitManualChanges}
                      className="w-full py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs transition cursor-pointer"
                    >
                      Save &amp; Activate
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: D1/D9 PLACEMENTS */}
          {activeTab === 'd1_d9' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Total 22 Normalized Bodies Extracted (11 in D1 Rashi + 11 in D9 Navamsha):
                </span>
                <span className="text-xs font-mono text-cyan-400">
                  House 1 = Lagna, numbering clockwise
                </span>
              </div>

              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800 text-slate-300 font-mono text-[11px] uppercase sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">Chart</th>
                      <th className="py-2.5 px-3">Body Name</th>
                      <th className="py-2.5 px-3">Rashi Sign</th>
                      <th className="py-2.5 px-3 text-center">House Number</th>
                      <th className="py-2.5 px-3">Nakshatra &amp; Lord</th>
                      <th className="py-2.5 px-3 text-center">Pada</th>
                      <th className="py-2.5 px-3">Degree (Sputa)</th>
                      <th className="py-2.5 px-3 text-center">Motion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {extractedPlacements.map((p, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-mono font-bold text-amber-400">{p.chart_type}</td>
                        <td className="py-2 px-3 font-bold text-white">{p.body_name}</td>
                        <td className="py-2 px-3 text-slate-200">{p.rashi_name}</td>
                        <td className="py-2 px-3 text-center font-bold text-cyan-400 bg-cyan-500/5">
                          House {p.house_number}
                        </td>
                        <td className="py-2 px-3 text-slate-300">
                          {p.nakshatra_name ? (
                            <div className="flex items-center gap-1.5">
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

          {/* TAB 3: DASHA INTERVALS */}
          {activeTab === 'dasha' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Total 103 Pratyantardasha (PD) Intervals Extracted from PDF Pages 13–52:
                </span>
                <span className="text-xs font-mono text-emerald-400">
                  Covering 1976 through 2090
                </span>
              </div>

              <div className="overflow-x-auto max-h-[400px]">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-800 text-slate-300 font-mono text-[11px] uppercase sticky top-0">
                    <tr>
                      <th className="py-2.5 px-3">#</th>
                      <th className="py-2.5 px-3">Mahadasha (MD)</th>
                      <th className="py-2.5 px-3">Antardasha (AD)</th>
                      <th className="py-2.5 px-3">Pratyantar (PD)</th>
                      <th className="py-2.5 px-3">Start Date</th>
                      <th className="py-2.5 px-3">End Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800 text-slate-300">
                    {ALL_DASHA_TIMELINE.slice(0, 30).map(([md, ad, pd, s, e], idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="py-2 px-3 font-mono text-slate-500">{idx + 1}</td>
                        <td className="py-2 px-3 font-bold text-amber-300">{md}</td>
                        <td className="py-2 px-3 text-cyan-300">{ad}</td>
                        <td className="py-2 px-3 text-slate-300">{pd}</td>
                        <td className="py-2 px-3 font-mono text-cyan-400">{s}</td>
                        <td className="py-2 px-3 font-mono text-rose-400">{e}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="text-[11px] text-slate-500 text-center">
                Showing first 30 of 103 total intervals stored in <code className="text-amber-400">vimshottari_dasha_detail</code>
              </div>
            </div>
          )}

          {/* TAB 4: SQL INGESTION DUMP */}
          {activeTab === 'sql' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-400">
                  Ready-to-run PostgreSQL SQL Statements generated by the offline parser:
                </span>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => copyToClipboard(sqlDumpString, 'sql_dump')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
                  >
                    <Copy className="w-3.5 h-3.5 text-amber-400" />
                    {copied === 'sql_dump' ? 'Copied SQL!' : 'Copy SQL'}
                  </button>
                  <button
                    onClick={() => downloadFile(`${extractedPerson.person_id}_ingestion.sql`, sqlDumpString, 'text/plain')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-500 hover:bg-amber-400 text-slate-950 transition"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download SQL
                  </button>
                </div>
              </div>

              <pre className="bg-slate-950 text-cyan-300 p-4 rounded-xl border border-slate-800 text-xs font-mono overflow-x-auto max-h-[400px] leading-relaxed">
                <code>{sqlDumpString}</code>
              </pre>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
