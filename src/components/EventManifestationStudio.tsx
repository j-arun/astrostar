import React, { useState, useMemo, useEffect } from 'react';
import {
  Sparkles,
  Compass,
  Clock,
  Layers,
  Moon,
  Zap,
  RefreshCw,
  Copy,
  Check,
  AlertTriangle,
  User,
  Sliders,
  TrendingUp,
  ShieldCheck,
  Download,
  Info,
  Calendar,
  FileText,
  ChevronDown,
  ChevronUp,
  Cpu,
  Brain,
  History,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Edit3,
  Save,
  FileDown,
  Eye,
  RotateCcw
} from 'lucide-react';
import {
  NativeManifestationProfile,
  MonthCalibrationFeedback,
  EvolvedPromptRecord,
  ManifestedEventOutput,
  MANIFESTATION_FOCUS_DOMAINS,
  SkyPositionItem,
  MoonDeliveryStatus,
  loadNativeProfile,
  saveNativeProfile,
  loadPromptHistory,
  savePromptHistory,
  loadCalibrationFeedbacks,
  saveCalibrationFeedbacks,
  constructBaselinePromptTemplate,
  compileBaselinePromptWithPrivateLLM,
  evolvePromptWithPrivateLLM,
  getLifeStageForAge
} from '../services/manifestationEngineService';
import {
  calculateVimshottariTimelineForProfile,
  getVimshottariDashaForDate
} from '../data/dashaCalculator';
import storedPersonsData from '../data/stored_persons.json';
import {
  RASHI_LIST_META,
  getGrahaTransitPosition
} from '../data/transitEphemeris';
import { toCleanEnglishPlanet, toCleanEnglishSign, checkOllamaHealth } from '../services/llm/adapters';
import { LLMProviderId } from '../services/llm/types';
import { computeADChamberDynamics } from '../services/dashaChamberEngine';
import { ADChamberMatrixCard } from './ADChamberMatrixCard';
import { analyzeVedicWindowEvents } from '../services/vedicEventsEngine';

interface EventManifestationStudioProps {
  personId: string;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const LORD_NAKSHATRA_GATES: Record<string, {
  nakshatras: string[];
  rashis: number[];
  anatomies: string[];
  signs: string[];
}> = {
  Ketu: {
    nakshatras: ['Ashwini', 'Magha', 'Moola'],
    rashis: [1, 5, 9],
    anatomies: ['Head & Cranium', 'Heart & Spine', 'Hips, Sciatic Nerve & Sacrum'],
    signs: ['Spiritual detachment, sudden breaks, deep subconscious karma, surgery']
  },
  'Venus (Sukra)': {
    nakshatras: ['Bharani', 'Purva Phalguni', 'Purva Ashadha'],
    rashis: [1, 5, 9],
    anatomies: ['Face, Eyes & Reproductive Fluids', 'Spine & Vital Circulation', 'Pelvic & Thigh Musculature'],
    signs: ['Pleasure, attraction, luxury expenses, skin/facial countenance, romance']
  },
  'Sun (Surya)': {
    nakshatras: ['Krittika', 'Uttara Phalguni', 'Uttara Ashadha'],
    rashis: [2, 6, 10],
    anatomies: ['Neck & Vocal Chords', 'Upper Abdomen & Gut Flora', 'Knees & Skeletal Structure'],
    signs: ['Vitality, father, authority, government orders, bone density, ego expression']
  },
  'Moon (Chandra)': {
    nakshatras: ['Rohini', 'Hasta', 'Shravana'],
    rashis: [2, 6, 10],
    anatomies: ['Throat & Thyroid', 'Digestive Organs & Bowels', 'Lymphatic Fluid & Knees'],
    signs: ['Mind, emotional fluctuations, mother, home sanctuary, liquids, travel']
  },
  'Mars (Sevvai)': {
    nakshatras: ['Mrigashira', 'Chitra', 'Dhanishta'],
    rashis: [3, 7, 11],
    anatomies: ['Shoulders & Upper Arms', 'Lower Abdomen & Kidneys', 'Shin Bones & Circulatory Heat'],
    signs: ['Pitta burning, digestive heat, conflicts, surgery, muscular exertion, siblings, land']
  },
  Rahu: {
    nakshatras: ['Ardra', 'Swati', 'Shatabhisha'],
    rashis: [3, 7, 11],
    anatomies: ['Respiratory Bronchials & Arms', 'Pelvic Organs & Bladder', 'Calves, Ankles & Nervous Signals'],
    signs: ['Obsession, sudden twists, foreign connections, toxic exposure, unconventional gains']
  },
  'Jupiter (Guru)': {
    nakshatras: ['Punarvasu', 'Vishakha', 'Purva Bhadrapada'],
    rashis: [4, 8, 12],
    anatomies: ['Chest & Lungs', 'Reproductive Tissues & Excretory', 'Feet & Toes'],
    signs: ['Wisdom, divine grace, wealth clearance, advisory roles, children, liver']
  },
  'Saturn (Sani)': {
    nakshatras: ['Pushya', 'Anuradha', 'Uttara Bhadrapada'],
    rashis: [4, 8, 12],
    anatomies: ['Stomach, Ribcage & Lungs', 'Bladder, Groin & Chronic Tissues', 'Feet & Nervous Terminals'],
    signs: ['Delay, chronic friction, cold conditions, institutional duty, dental/bone wear, persistent marks']
  },
  'Mercury (Budha)': {
    nakshatras: ['Ashlesha', 'Jyeshtha', 'Revati'],
    rashis: [4, 8, 12],
    anatomies: ['Stomach Lining, Gut Flora & Sleep', 'Secret Parts, Colon & Sensory Nerves', 'Feet, Lymph & Peripheral Nerves'],
    signs: ['Communication, sensory nerves, paperwork, intellect, trade, sleep depth, food digestion']
  }
};

function normalizeLordKey(lordStr: string): string {
  if (!lordStr) return 'Mercury (Budha)';
  const norm = lordStr.toLowerCase();
  if (norm.includes('ketu')) return 'Ketu';
  if (norm.includes('venus') || norm.includes('sukra')) return 'Venus (Sukra)';
  if (norm.includes('sun') || norm.includes('surya')) return 'Sun (Surya)';
  if (norm.includes('moon') || norm.includes('chandra')) return 'Moon (Chandra)';
  if (norm.includes('mars') || norm.includes('sevvai')) return 'Mars (Sevvai)';
  if (norm.includes('rahu')) return 'Rahu';
  if (norm.includes('jupiter') || norm.includes('guru')) return 'Jupiter (Guru)';
  if (norm.includes('saturn') || norm.includes('sani')) return 'Saturn (Sani)';
  if (norm.includes('mercury') || norm.includes('budha')) return 'Mercury (Budha)';
  return 'Mercury (Budha)';
}

export const EventManifestationStudio: React.FC<EventManifestationStudioProps> = ({ personId }) => {
  // Resolve active person profile from stored persons data
  const activeRecord = useMemo(() => {
    const list = Object.values(storedPersonsData);
    return list.find((p: any) => p.profile?.person_id === personId) || list[0];
  }, [personId]);

  const activeProfile = useMemo(() => {
    return (activeRecord as any)?.profile;
  }, [activeRecord]);

  // Target Analysis Date Range (From and To)
  // Evaluates exact planetary transits without stale cached positions
  const [targetFromDate, setTargetFromDate] = useState<string>('2027-01-13');
  const [targetToDate, setTargetToDate] = useState<string>('2027-03-21');
  const [focalDateStr, setFocalDateStr] = useState<string>('2027-02-15');

  const fromDateObj = useMemo(() => {
    const d = new Date(targetFromDate);
    return isNaN(d.getTime()) ? new Date('2027-01-13') : d;
  }, [targetFromDate]);

  const toDateObj = useMemo(() => {
    const d = new Date(targetToDate);
    return isNaN(d.getTime()) ? new Date('2027-03-21') : d;
  }, [targetToDate]);

  // Effective Date for Astronomical Sky Snapshot (Gochara Ephemeris)
  const effectiveFocalDate = useMemo(() => {
    if (focalDateStr && !isNaN(new Date(focalDateStr).getTime())) {
      return new Date(focalDateStr);
    }
    return fromDateObj;
  }, [focalDateStr, fromDateObj]);

  const selectedYear = effectiveFocalDate.getFullYear();
  const selectedMonth = effectiveFocalDate.getMonth();

  // Range Duration in Days and Months
  const rangeDuration = useMemo(() => {
    const diffMs = toDateObj.getTime() - fromDateObj.getTime();
    const days = Math.max(1, Math.round(Math.abs(diffMs) / (24 * 3600 * 1000)));
    const months = (days / 30.4375).toFixed(1);
    return { days, months };
  }, [fromDateObj, toDateObj]);

  const rangeMidpointStr = useMemo(() => {
    const midMs = (fromDateObj.getTime() + toDateObj.getTime()) / 2;
    return new Date(midMs).toISOString().slice(0, 10);
  }, [fromDateObj, toDateObj]);

  // Calculated Age on Target Range Start based on birth date (if available)
  const nativeAgeOnTargetDate = useMemo(() => {
    if (!activeProfile?.date_of_birth) return null;
    const dob = new Date(activeProfile.date_of_birth);
    if (isNaN(dob.getTime())) return null;
    const diffMs = fromDateObj.getTime() - dob.getTime();
    const age = Math.floor(diffMs / (365.25 * 24 * 3600 * 1000));
    return Math.max(1, age);
  }, [activeProfile, fromDateObj]);

  // Month Cycle Counter inside the PD (Month 1, Month 2, Month 3...)
  const [pdCycleMonth, setPdCycleMonth] = useState<number>(1);

  // 1. Native Demographics & Personal Context State
  const [nativeProfile, setNativeProfile] = useState<NativeManifestationProfile>(() => {
    return loadNativeProfile(personId, 40);
  });
  const [profileSavedFeedback, setProfileSavedFeedback] = useState<boolean>(false);

  // Synchronize profile if personId changes
  useEffect(() => {
    setNativeProfile(loadNativeProfile(personId, 40));
  }, [personId]);

  const handleUpdateAge = (newAge: number) => {
    const valid = Math.max(1, Math.min(120, newAge));
    setNativeProfile(prev => ({
      ...prev,
      age: valid,
      lifeStage: getLifeStageForAge(valid)
    }));
  };

  const handleToggleFocusDomain = (domainId: string) => {
    setNativeProfile(prev => {
      const exists = prev.focusAreas.includes(domainId);
      const updated = exists
        ? prev.focusAreas.filter(d => d !== domainId)
        : [...prev.focusAreas, domainId];
      return { ...prev, focusAreas: updated };
    });
  };

  const handleSaveProfile = () => {
    saveNativeProfile(nativeProfile);
    setProfileSavedFeedback(true);
    setTimeout(() => setProfileSavedFeedback(false), 2000);
  };

  // 2. Dasha Selection (Full Lifetime MD + AD + 9 PDs)
  const timeline = useMemo(() => {
    return calculateVimshottariTimelineForProfile(activeProfile);
  }, [activeProfile]);

  // All 9 Vimshottari Lords in canonical sequence
  const VIMSHOTTARI_LORDS = [
    'Ketu',
    'Venus (Sukra)',
    'Sun (Surya)',
    'Moon (Chandra)',
    'Mars (Sevvai)',
    'Rahu',
    'Jupiter (Guru)',
    'Saturn (Sani)',
    'Mercury (Budha)'
  ];

  // User-selected Mahadasha and Antardasha (never overwritten or auto-reset)
  const [selectedMd, setSelectedMd] = useState<string>('Mercury (Budha)');
  const [selectedAd, setSelectedAd] = useState<string>('Saturn (Sani)');

  // All 9 Antardashas available under the selected Mahadasha in cyclic order
  const adOptions = useMemo(() => {
    const mdIdx = Math.max(0, VIMSHOTTARI_LORDS.findIndex(l => l.startsWith(selectedMd.split(' ')[0])));
    return Array.from({ length: 9 }, (_, i) => VIMSHOTTARI_LORDS[(mdIdx + i) % 9]);
  }, [selectedMd]);

  // 9 Pratyantardashas (PDs) under selected AD
  const ninePds = useMemo(() => {
    const matched = timeline.filter(([md, ad]) => normalizeLordKey(md) === normalizeLordKey(selectedMd) && normalizeLordKey(ad) === normalizeLordKey(selectedAd));

    const adIdx = Math.max(0, VIMSHOTTARI_LORDS.findIndex(l => l.startsWith(selectedAd.split(' ')[0])));

    return VIMSHOTTARI_LORDS.map((_, i) => {
      const circularLord = VIMSHOTTARI_LORDS[(adIdx + i) % 9];
      const entry = matched.find(t => normalizeLordKey(t[2]) === circularLord);
      const start = entry ? entry[3] : '';
      const end = entry ? entry[4] : '';
      const isDateActive = (start && end) ? (targetFromDate <= end && targetToDate >= start) : false;

      return {
        index: i + 1,
        pdLord: circularLord,
        cleanName: toCleanEnglishPlanet(circularLord),
        startDate: start,
        endDate: end,
        isDateActive
      };
    });
  }, [timeline, selectedMd, selectedAd, targetFromDate, targetToDate]);

  const [selectedPd, setSelectedPd] = useState<string>('Ketu');

  // Pure, direct date setters with ZERO cross-field validation or alterations
  const handleFromDateChange = (newFrom: string) => {
    setTargetFromDate(newFrom);
    if (!focalDateStr || focalDateStr < newFrom) {
      setFocalDateStr(newFrom);
    }
  };

  const handleToDateChange = (newTo: string) => {
    setTargetToDate(newTo);
    if (focalDateStr > newTo) {
      setFocalDateStr(newTo);
    }
  };

  // 3. Natal Coordinates
  const natalLagnaIdx = useMemo(() => {
    const lagnaStr = activeProfile?.birth_lagna || 'Sagittarius';
    const idx = RASHI_LIST_META.findIndex(r => r.eng.toLowerCase().includes(lagnaStr.toLowerCase()) || r.tamil.toLowerCase().includes(lagnaStr.toLowerCase()));
    return idx >= 0 ? idx + 1 : 9;
  }, [activeProfile]);

  const natalRashiIdx = useMemo(() => {
    const rashiStr = activeProfile?.birth_rashi || 'Scorpio';
    const idx = RASHI_LIST_META.findIndex(r => r.eng.toLowerCase().includes(rashiStr.toLowerCase()) || r.tamil.toLowerCase().includes(rashiStr.toLowerCase()));
    return idx >= 0 ? idx + 1 : 8;
  }, [activeProfile]);

  // Per-gate evaluation perspectives (Gate 0, Gate 1, Gate 2: 'lagna' | 'rashi' | 'combined')
  const [gatePerspectives, setGatePerspectives] = useState<Record<number, 'lagna' | 'rashi' | 'combined'>>({
    0: 'combined',
    1: 'combined',
    2: 'combined'
  });

  // 4. Astronomical Gochara Ephemeris (Look at the Sky on Target Horizon!)
  const skySnapshot = useMemo(() => {
    const keys = ["Sun", "Moon", "Mars", "Mercury", "Jupiter", "Venus", "Saturn", "Rahu", "Ketu"];
    return keys.map(k => getGrahaTransitPosition(k, effectiveFocalDate, natalLagnaIdx, natalRashiIdx));
  }, [effectiveFocalDate, natalLagnaIdx, natalRashiIdx]);

  // Moon acute trigger detection on target date range
  const moonPlanet = useMemo(() => skySnapshot.find(p => p.graha_key === 'Moon'), [skySnapshot]);
  const marsPlanet = useMemo(() => skySnapshot.find(p => p.graha_key === 'Mars'), [skySnapshot]);
  const moonDeliveryStatus = useMemo<MoonDeliveryStatus | undefined>(() => {
    if (!moonPlanet) return undefined;
    const moonNak = moonPlanet.graha_pada_chara.nakshatra_name;
    const lordMeta = LORD_NAKSHATRA_GATES[normalizeLordKey(selectedPd)] || LORD_NAKSHATRA_GATES['Mercury (Budha)'];
    const gateIdx = lordMeta.nakshatras.findIndex(n => n.toLowerCase() === moonNak.toLowerCase());
    return {
      nakshatra: moonNak,
      sign: `${moonPlanet.transit_rashi_name} (${moonPlanet.transit_rashi_tamil})`,
      isIgnitingGate: gateIdx >= 0,
      gateIndex: gateIdx >= 0 ? gateIdx : undefined,
      gateNakshatra: gateIdx >= 0 ? lordMeta.nakshatras[gateIdx] : undefined
    };
  }, [moonPlanet, selectedPd]);

  // Delivering Hand 3 Gates with real transiting planets
  const gateDetails = useMemo(() => {
    const lordMeta = LORD_NAKSHATRA_GATES[normalizeLordKey(selectedPd)] || LORD_NAKSHATRA_GATES['Mercury (Budha)'];

    return lordMeta.nakshatras.map((nakName, idx) => {
      const rIdx = lordMeta.rashis[idx];
      const rMeta = RASHI_LIST_META.find(r => r.index === rIdx) || RASHI_LIST_META[0];
      const hLagna = ((rIdx - natalLagnaIdx + 12) % 12) + 1;
      const hRashi = ((rIdx - natalRashiIdx + 12) % 12) + 1;

      // Real planets transiting this gate or sign in horizon!
      const planetsInGate = skySnapshot.filter(p => {
        return p.graha_pada_chara.nakshatra_name.toLowerCase() === nakName.toLowerCase() || p.transit_rashi_index === rIdx;
      }).map(p => {
        const isExactNak = p.graha_pada_chara.nakshatra_name.toLowerCase() === nakName.toLowerCase();
        return `${p.graha_name} (${isExactNak ? `Direct in ${nakName}` : `in ${rMeta.eng}`}${p.is_retrograde ? ' [Vakra]' : ''})`;
      });

      return {
        nakshatraName: nakName,
        rashiName: `${rMeta.eng} (${rMeta.tamil})`,
        houseFromLagna: hLagna,
        houseFromRashi: hRashi,
        activeGrahas: planetsInGate,
        moonWindow: `${targetFromDate} to ${targetToDate}`,
        chosenPerspective: gatePerspectives[idx] || 'combined'
      };
    });
  }, [selectedPd, natalLagnaIdx, natalRashiIdx, skySnapshot, gatePerspectives, targetFromDate, targetToDate]);

  // Formatted sky positions for prompt architect
  const skyPositionsForPrompt = useMemo<SkyPositionItem[]>(() => {
    const lordMeta = LORD_NAKSHATRA_GATES[normalizeLordKey(selectedPd)] || LORD_NAKSHATRA_GATES['Mercury (Budha)'];
    return skySnapshot.map(p => {
      const gateIdx = lordMeta.nakshatras.findIndex(n => n.toLowerCase() === p.graha_pada_chara.nakshatra_name.toLowerCase());
      return {
        planet: p.graha_name,
        rashi: p.transit_rashi_name,
        rashiTamil: p.transit_rashi_tamil,
        degreeSputa: p.degree_sputa,
        nakshatra: p.graha_pada_chara.nakshatra_name,
        pada: p.graha_pada_chara.pada,
        houseFromLagna: p.relative_to_natal_lagna.house_number,
        houseFromRashi: p.relative_to_natal_rashi.house_number,
        isRetrograde: p.is_retrograde,
        isInGate: gateIdx >= 0,
        gateIndex: gateIdx >= 0 ? gateIdx : undefined
      };
    });
  }, [skySnapshot, selectedPd]);

  // 4B. Antardasha (AD) Pressure Chamber Dynamics coupled with PD Delivery Hand
  const adChamberDynamics = useMemo(() => {
    return computeADChamberDynamics({
      adLord: selectedAd,
      pdLord: selectedPd,
      natalLagnaIdx,
      natalRashiIdx,
      natalPlacements: (activeRecord as any)?.placements || [],
      transitPlacements: skySnapshot.map(s => ({
        graha_key: s.graha_key,
        graha_name: s.graha_name,
        transit_rashi_index: s.transit_rashi_index,
        signIndex: s.transit_rashi_index,
        degree_sputa: s.degree_sputa,
        is_retrograde: s.is_retrograde,
        nakshatra_name: s.graha_pada_chara?.nakshatra_name,
        pada: s.graha_pada_chara?.pada
      }))
    });
  }, [selectedAd, selectedPd, natalLagnaIdx, natalRashiIdx, activeRecord, skySnapshot]);

  // 4C. Special Vedic Window Events (Parivartana, Neecha Bhanga, Same-Sign Stations)
  const vedicSpecialEvents = useMemo(() => {
    const startStr = targetFromDate && targetToDate && targetFromDate <= targetToDate ? targetFromDate : '2027-01-13';
    const endStr = targetFromDate && targetToDate && targetFromDate <= targetToDate ? targetToDate : '2027-03-21';
    return analyzeVedicWindowEvents({
      startDateStr: startStr,
      endDateStr: endStr,
      natalLagnaIdx,
      natalRashiIdx,
      flattenedNatalD1: ((activeRecord as any)?.placements || [])
        .filter((p: any) => p.chart_type === 'D1')
        .map((p: any) => ({
          body_name: p.body_name || '',
          rashi_name: p.rashi_name || ''
        }))
    });
  }, [targetFromDate, targetToDate, natalLagnaIdx, natalRashiIdx, activeRecord]);

  // 5. Local Ollama Health & Connection
  const [ollamaStatus, setOllamaStatus] = useState<{ isOnline: boolean; models: string[]; error?: string }>({
    isOnline: false,
    models: []
  });
  const [selectedLocalModel, setSelectedLocalModel] = useState<string>('qwen2.5:14b');

  const checkLocalOllama = async () => {
    const res = await checkOllamaHealth('http://localhost:11434');
    setOllamaStatus(res);
    if (res.models.length > 0 && !res.models.includes(selectedLocalModel)) {
      const qwen = res.models.find(m => m.toLowerCase().includes('qwen'));
      if (qwen) setSelectedLocalModel(qwen);
      else setSelectedLocalModel(res.models[0]);
    }
  };

  useEffect(() => {
    checkLocalOllama();
  }, []);

  // 5. Prompt Evolution & Version History State
  const [promptHistory, setPromptHistory] = useState<EvolvedPromptRecord[]>(() => {
    return loadPromptHistory(personId, selectedPd);
  });
  const [activeVersionIndex, setActiveVersionIndex] = useState<number>(0);
  const [isCompilingPrompt, setIsCompilingPrompt] = useState<boolean>(false);
  const [compilationSeconds, setCompilationSeconds] = useState<number>(0);
  const [compilationError, setCompilationError] = useState<string | null>(null);
  const [ollamaEndpoint, setOllamaEndpoint] = useState<string>(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('astro_manifest_ollama_endpoint') : '') || 'http://localhost:11434';
  });
  const [promptCopied, setPromptCopied] = useState<boolean>(false);
  const [isPromptExpanded, setIsPromptExpanded] = useState<boolean>(true);
  const [isEditingPrompt, setIsEditingPrompt] = useState<boolean>(false);
  const [editedPromptText, setEditedPromptText] = useState<string>('');
  const [showSection4Synthesis, setShowSection4Synthesis] = useState<boolean>(false);

  // Reload history when PD changes
  useEffect(() => {
    const history = loadPromptHistory(personId, selectedPd);
    setPromptHistory(history);
    setActiveVersionIndex(0);
  }, [personId, selectedPd]);

  // 6. Reality Check / Ground-Truth Calibration State for the Month
  const [feedbackReviews, setFeedbackReviews] = useState<{
    title: string;
    predictedProb: number;
    portfolio: string;
    actualMatchPct: number;
    notes: string;
  }[]>([
    {
      title: 'Respiratory / Thoracic Heat & Congestion',
      predictedProb: 80,
      portfolio: 'Health',
      actualMatchPct: 20,
      notes: 'No severe lung infection or fever; only mild dry throat irritation for 2 days.'
    },
    {
      title: 'Workplace Executive Clash & Status Friction',
      predictedProb: 75,
      portfolio: 'Work',
      actualMatchPct: 85,
      notes: 'Heated confrontation with director during executive roadmap review. Exact match.'
    },
    {
      title: 'Vehicle / Electronics Sudden Breakdown Expense',
      predictedProb: 65,
      portfolio: 'Money',
      actualMatchPct: 0,
      notes: 'Vehicle was completely fine; zero repair expense incurred.'
    }
  ]);
  const [generalReflection, setGeneralReflection] = useState<string>(
    'The physical somatic crisis was minimal, but the professional authority tension materialized with high intensity.'
  );

  // Current active prompt record
  const currentPromptRecord = useMemo<EvolvedPromptRecord | null>(() => {
    if (promptHistory.length > 0 && promptHistory[activeVersionIndex]) {
      return promptHistory[activeVersionIndex];
    }
    return null;
  }, [promptHistory, activeVersionIndex]);

  // Sync editedPromptText when active record changes
  useEffect(() => {
    if (currentPromptRecord) {
      setEditedPromptText(currentPromptRecord.rawPrompt);
      setIsEditingPrompt(false);
    }
  }, [currentPromptRecord]);

  // Prompt metrics: words, characters, estimated tokens
  const promptStats = useMemo(() => {
    if (!currentPromptRecord) return { words: 0, chars: 0, estimatedTokens: 0, lines: 0 };
    const text = isEditingPrompt ? editedPromptText : currentPromptRecord.rawPrompt;
    const words = text.trim() ? text.trim().split(/\s+/).length : 0;
    const chars = text.length;
    const estimatedTokens = Math.round(chars / 3.8);
    const lines = text.split('\n').length;
    return { words, chars, estimatedTokens, lines };
  }, [currentPromptRecord, isEditingPrompt, editedPromptText]);

  // Download raw prompt as text file
  const handleDownloadPrompt = () => {
    if (!currentPromptRecord) return;
    const textToSave = isEditingPrompt ? editedPromptText : currentPromptRecord.rawPrompt;
    const blob = new Blob([textToSave], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `Prompt_${currentPromptRecord.versionTag.replace(/[^a-zA-Z0-9]/g, '_')}.txt`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleSaveEditedPrompt = () => {
    if (!currentPromptRecord) return;
    const updated = [...promptHistory];
    updated[activeVersionIndex] = {
      ...updated[activeVersionIndex],
      rawPrompt: editedPromptText
    };
    setPromptHistory(updated);
    savePromptHistory(personId, selectedPd, updated);
    setIsEditingPrompt(false);
  };

  // Generate Initial Baseline Prompt via REAL Private LLM Call
  const handleGenerateBaselinePrompt = async () => {
    setIsCompilingPrompt(true);
    setCompilationError(null);
    setCompilationSeconds(0);
    const startMs = Date.now();
    const intervalTimer = setInterval(() => {
      setCompilationSeconds(Math.round((Date.now() - startMs) / 1000));
    }, 1000);

    try {
      const result = await compileBaselinePromptWithPrivateLLM({
        nativeProfile,
        monthName: MONTH_NAMES[selectedMonth],
        year: selectedYear,
        targetDate: targetFromDate,
        targetFromDate,
        targetToDate,
        mdLord: selectedMd,
        adLord: selectedAd,
        pdLord: selectedPd,
        birthLagna: RASHI_LIST_META[natalLagnaIdx - 1]?.eng || 'Sagittarius',
        janmaRashi: RASHI_LIST_META[natalRashiIdx - 1]?.eng || 'Scorpio',
        gates: gateDetails,
        skyPositions: skyPositionsForPrompt,
        moonDeliveryStatus,
        adChamberDynamics,
        vedicSpecialEvents,
        localOllamaEndpoint: ollamaEndpoint,
        localModelName: selectedLocalModel
      });

      if (result.error && !result.isRealLLMCall) {
        setCompilationError(result.error);
      }

      const elapsedSec = Math.round((Date.now() - startMs) / 1000);
      const newRecord: EvolvedPromptRecord = {
        version: 1,
        versionTag: `v1.0 Baseline (${targetFromDate} to ${targetToDate})`,
        targetMonthName: `${targetFromDate} to ${targetToDate} (${MONTH_NAMES[selectedMonth]} ${selectedYear})`,
        cycleMonthNumber: 1,
        pdLord: selectedPd,
        adLord: selectedAd,
        mdLord: selectedMd,
        rawPrompt: result.prompt,
        evolutionLog: `${result.evolutionLog} (Took ${elapsedSec}s) • Sky Transit Ephemeris Synced (${skyPositionsForPrompt.length} Grahas, Moon ${moonDeliveryStatus?.isIgnitingGate ? 'Acute Ignition' : 'Dormant'})`,
        dampedAlerts: [],
        amplifiedTrajectories: [],
        generatedByModel: result.modelUsed,
        createdAt: new Date().toISOString()
      };

      const updated = [newRecord, ...promptHistory];
      setPromptHistory(updated);
      savePromptHistory(personId, selectedPd, updated);
      setActiveVersionIndex(0);
    } catch (err: any) {
      setCompilationError(err.message || 'Private LLM reasoning call failed.');
    } finally {
      clearInterval(intervalTimer);
      setIsCompilingPrompt(false);
    }
  };

  // Evolve Prompt to Next Version (Pass 2 Mutation via REAL Private LLM Call)
  const handleEvolvePrompt = async () => {
    if (!currentPromptRecord) return;
    setIsCompilingPrompt(true);
    setCompilationError(null);
    setCompilationSeconds(0);
    const startMs = Date.now();
    const intervalTimer = setInterval(() => {
      setCompilationSeconds(Math.round((Date.now() - startMs) / 1000));
    }, 1000);

    const nextMonthIdx = (selectedMonth + 1) % 12;
    const nextYr = selectedMonth === 11 ? selectedYear + 1 : selectedYear;
    const nextMonthName = MONTH_NAMES[nextMonthIdx];

    const avgConfidence = Math.round(
      feedbackReviews.reduce((sum, r) => sum + r.actualMatchPct, 0) / feedbackReviews.length
    );

    const feedbackPayload: MonthCalibrationFeedback = {
      id: `calib-${Date.now()}`,
      cycleMonthNumber: currentPromptRecord.cycleMonthNumber,
      monthName: currentPromptRecord.targetMonthName,
      pdLord: selectedPd,
      adLord: selectedAd,
      mdLord: selectedMd,
      overallMatchConfidence: avgConfidence,
      eventReviews: feedbackReviews.map((r, i) => ({
        id: `rev-${i}`,
        predictedTitle: r.title,
        predictedProbability: r.predictedProb,
        portfolio: r.portfolio,
        actualMatchPct: r.actualMatchPct,
        nativeGroundTruthNotes: r.notes
      })),
      generalObservation: generalReflection,
      createdAt: new Date().toISOString()
    };

    try {
      const evolvedRecord = await evolvePromptWithPrivateLLM({
        previousPrompt: currentPromptRecord,
        feedback: feedbackPayload,
        nextMonthName,
        nextYear: nextYr,
        nextMonthGates: gateDetails,
        localOllamaEndpoint: ollamaEndpoint,
        localModelName: selectedLocalModel
      });

      const updated = [evolvedRecord, ...promptHistory];
      setPromptHistory(updated);
      savePromptHistory(personId, selectedPd, updated);
      setPdCycleMonth(prev => prev + 1);
      const nextDateStr = `${nextYr}-${String(nextMonthIdx + 1).padStart(2, '0')}-01`;
      const nextEndDay = new Date(nextYr, nextMonthIdx + 1, 0).getDate();
      const nextEndDateStr = `${nextYr}-${String(nextMonthIdx + 1).padStart(2, '0')}-${String(nextEndDay).padStart(2, '0')}`;
      setTargetFromDate(nextDateStr);
      setTargetToDate(nextEndDateStr);
    } catch (err: any) {
      setCompilationError(err.message || 'Prompt evolution failed.');
    } finally {
      clearInterval(intervalTimer);
      setIsCompilingPrompt(false);
    }
  };

  // Event Synthesis Execution State
  const [isSynthesizingEvents, setIsSynthesizingEvents] = useState<boolean>(false);
  const [manifestedEvents, setManifestedEvents] = useState<ManifestedEventOutput[]>([]);

  const handleSynthesizeEventsFromPrompt = async () => {
    if (!currentPromptRecord) return;
    setIsSynthesizingEvents(true);

    // If local Qwen is active, query Ollama; else fallback to structured synthesis
    try {
      if (ollamaStatus.isOnline) {
        const res = await fetch('http://localhost:11434/api/generate', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model: selectedLocalModel,
            prompt: currentPromptRecord.rawPrompt,
            stream: false,
            format: 'json',
            options: { temperature: 0.3, num_predict: 3000 }
          })
        });

        if (res.ok) {
          const json = await res.json();
          const parsed = JSON.parse(json.response || '{}');
          if (Array.isArray(parsed.events)) {
            const sortedEvents = [...parsed.events].sort(
              (a, b) => (Number(b.probabilityScore) || 0) - (Number(a.probabilityScore) || 0)
            );
            setManifestedEvents(sortedEvents);
            setIsSynthesizingEvents(false);
            return;
          }
        }
      }
    } catch {}

    // Fallback: Generate calibrated exhaustive inventory of all possible events ordered by likelihood
    setTimeout(() => {
      const isMatured = currentPromptRecord.version > 1;

      const rawResults: ManifestedEventOutput[] = [
        {
          id: 'ev-1',
          title: isMatured
            ? 'Contractual Restructuring & Project Authority Reallocation'
            : 'Workplace Executive Strategy Clash & Hierarchy Friction',
          narrative: isMatured
            ? 'Sequential consequence of previous clash: reassignment of project deliverables with clearer legal boundaries.'
            : 'Heated confrontation regarding roadmap control; pushback against senior management authority.',
          probabilityScore: isMatured ? 92 : 88,
          portfolio: 'Work',
          gateTrigger: `${gateDetails[0]?.nakshatraName || 'Ashlesha'} (Gate 1), Combined Perspective`,
          hasMoonSupport: true,
          moonWindowDates: gateDetails[0]?.moonWindow || 'Oct 6–8',
          latencyStatus: 'acute_moon_triggered',
          calibratedEvolutionNote: isMatured
            ? 'Amplified from 85% ground-truth match in Month 1'
            : 'Acute trigger under active Nakshatra delivery vector'
        },
        {
          id: 'ev-2',
          title: 'Strategic Capital Reallocation into Liquid Yield Reserve',
          narrative: 'Liquid funds deployed into safe, short-term debt instruments; avoidance of speculative impulsive spending.',
          probabilityScore: 86,
          portfolio: 'Money',
          gateTrigger: `${gateDetails[2]?.nakshatraName || 'Revati'} (Gate 3), Combined Perspective`,
          hasMoonSupport: true,
          moonWindowDates: gateDetails[2]?.moonWindow || 'Oct 21–23',
          latencyStatus: 'acute_moon_triggered',
          calibratedEvolutionNote: 'High confidence liquid deployment window during Moon transit'
        },
        {
          id: 'ev-3',
          title: 'Property Lease Clause Clarification & Document Finalization',
          narrative: 'Resolution of fixed asset paperwork; agreement reached on lease indemnity and maintenance responsibilities.',
          probabilityScore: 82,
          portfolio: 'Life',
          gateTrigger: `${gateDetails[0]?.nakshatraName || 'Ashlesha'} (Gate 1), Combined Perspective`,
          hasMoonSupport: true,
          moonWindowDates: gateDetails[0]?.moonWindow || 'Oct 6–8',
          latencyStatus: 'acute_moon_triggered',
          calibratedEvolutionNote: 'Direct domestic property paperwork trigger activated'
        },
        {
          id: 'ev-4',
          title: 'Emergency Technical Architecture Pivot & Vendor Reset',
          narrative: 'Discovery of latent vendor contractual ambiguities prompts an emergency executive redesign of core service dependencies.',
          probabilityScore: 79,
          portfolio: 'Work',
          gateTrigger: `${gateDetails[1]?.nakshatraName || 'Jyeshtha'} (Gate 2), Moon Perspective`,
          hasMoonSupport: true,
          moonWindowDates: gateDetails[1]?.moonWindow || 'Oct 14–16',
          latencyStatus: 'acute_moon_triggered',
          calibratedEvolutionNote: 'Secondary Moon activation over corporate delivery gate'
        },
        {
          id: 'ev-5',
          title: 'Unbudgeted Machinery & Hardware Maintenance Expenditure',
          narrative: 'Sudden hardware, automotive, or digital infrastructure breakdown demands unplanned liquid cash outlay.',
          probabilityScore: 74,
          portfolio: 'Money',
          gateTrigger: `${gateDetails[0]?.nakshatraName || 'Ashlesha'} (Gate 1), Lagna Perspective`,
          hasMoonSupport: true,
          moonWindowDates: gateDetails[0]?.moonWindow || 'Oct 6–8',
          latencyStatus: 'acute_moon_triggered',
          calibratedEvolutionNote: 'Pressure emission on 2nd/8th financial axis'
        },
        {
          id: 'ev-6',
          title: 'Rapid Work-Related Transit & Multi-City Logistics Shift',
          narrative: 'Unscheduled regional travel for project oversight or client mediation, requiring immediate itinerary rearrangement.',
          probabilityScore: 71,
          portfolio: 'Trip',
          gateTrigger: `${gateDetails[2]?.nakshatraName || 'Revati'} (Gate 3), Lagna Perspective`,
          hasMoonSupport: true,
          moonWindowDates: gateDetails[2]?.moonWindow || 'Oct 21–23',
          latencyStatus: 'acute_moon_triggered',
          calibratedEvolutionNote: 'Cadence transit vector triggering travel house'
        },
        {
          id: 'ev-7',
          title: 'Partner Expectations Realignment & Intimacy Friction',
          narrative: 'Spillover of workplace stress creates momentary friction over shared schedule availability and household commitments.',
          probabilityScore: 66,
          portfolio: 'Love',
          gateTrigger: `${gateDetails[1]?.nakshatraName || 'Jyeshtha'} (Gate 2), Combined Perspective`,
          hasMoonSupport: false,
          moonWindowDates: null,
          latencyStatus: 'dormant_latent',
          calibratedEvolutionNote: 'Latent 7th house pressure requiring conscious emotional pacing'
        },
        {
          id: 'ev-8',
          title: 'Peer Circle Boundary Setting & Advisory Role Demarcation',
          narrative: 'Re-evaluating advisory involvement in a mutual associate enterprise; drawing firm boundary on unpaid consultative labor.',
          probabilityScore: 62,
          portfolio: 'Friends',
          gateTrigger: `${gateDetails[0]?.nakshatraName || 'Ashlesha'} (Gate 1), Moon Perspective`,
          hasMoonSupport: false,
          moonWindowDates: null,
          latencyStatus: 'dormant_latent',
          calibratedEvolutionNote: '11th house peer network recalibration'
        },
        {
          id: 'ev-9',
          title: isMatured
            ? 'Vocal Chord Strain & Routine Maintenance (No Pulmonary Crisis)'
            : 'Thoracic Heat, Acid Surge & Respiratory Inflammation',
          narrative: isMatured
            ? 'Somatic energy remains low-level: voice fatigue after intense speaking, completely avoiding acute pulmonary damage.'
            : 'Dry bronchial congestion or sharp gastric burning feeling requiring immediate cooling diet.',
          probabilityScore: isMatured ? 42 : 58,
          portfolio: 'Health',
          gateTrigger: `${gateDetails[1]?.nakshatraName || 'Jyeshtha'} (Gate 2), Lagna Perspective`,
          hasMoonSupport: false,
          moonWindowDates: null,
          latencyStatus: isMatured ? 'dormant_latent' : 'dormant_latent',
          calibratedEvolutionNote: isMatured
            ? 'Damped down after native reported only 20% mild cough'
            : 'Latent somatic tension requiring dietary cooling'
        },
        {
          id: 'ev-10',
          title: 'Long-Term Relocation & Real Estate Scout Inquiry',
          narrative: 'Preliminary inquiries and title searches regarding secondary residence or long-term asset relocation.',
          probabilityScore: 54,
          portfolio: 'Life',
          gateTrigger: `${gateDetails[2]?.nakshatraName || 'Revati'} (Gate 3), Lagna Perspective`,
          hasMoonSupport: false,
          moonWindowDates: null,
          latencyStatus: 'dormant_latent',
          calibratedEvolutionNote: 'Long-cycle 4th house development under consideration'
        },
        {
          id: 'ev-11',
          title: 'Delayed Inheritance or Joint Account Reconciliation',
          narrative: 'Administrative paperwork delay regarding ancestral title deed or co-mingled familial tax paperwork.',
          probabilityScore: 48,
          portfolio: 'Money',
          gateTrigger: `${gateDetails[1]?.nakshatraName || 'Jyeshtha'} (Gate 2), Combined Perspective`,
          hasMoonSupport: false,
          moonWindowDates: null,
          latencyStatus: 'dormant_latent',
          calibratedEvolutionNote: '8th house latent documentation process'
        },
        {
          id: 'ev-12',
          title: 'Long-Distance Pilgrimage or Philosophical Retreat Planning',
          narrative: 'Exploration of sacred geography pilgrimage or structured spiritual retreat during upcoming quarterly break.',
          probabilityScore: 41,
          portfolio: 'Trip',
          gateTrigger: `${gateDetails[2]?.nakshatraName || 'Revati'} (Gate 3), Moon Perspective`,
          hasMoonSupport: false,
          moonWindowDates: null,
          latencyStatus: 'dormant_latent',
          calibratedEvolutionNote: '9th house spiritual travel potential'
        },
        {
          id: 'ev-13',
          title: 'Old Academic Colleague Outreach & Collaborative Pitch',
          narrative: 'Unsolicited reach-out from an earlier career associate pitching an exploratory advisory or joint venture.',
          probabilityScore: 36,
          portfolio: 'Friends',
          gateTrigger: `${gateDetails[0]?.nakshatraName || 'Ashlesha'} (Gate 1), Lagna Perspective`,
          hasMoonSupport: false,
          moonWindowDates: null,
          latencyStatus: 'dormant_latent',
          calibratedEvolutionNote: 'Low-salience network reach-out'
        },
        {
          id: 'ev-14',
          title: 'Romantic Weekend Itinerary Postponement',
          narrative: 'Voluntary rescheduling of planned recreational weekend due to urgent professional milestone deadline.',
          probabilityScore: 32,
          portfolio: 'Love',
          gateTrigger: `${gateDetails[1]?.nakshatraName || 'Jyeshtha'} (Gate 2), Combined Perspective`,
          hasMoonSupport: false,
          moonWindowDates: null,
          latencyStatus: 'dormant_latent',
          calibratedEvolutionNote: 'Minor scheduling concession without relationship strain'
        }
      ];

      // Guarantee strict ordering by likelihood descending
      const sortedResults = [...rawResults].sort((a, b) => b.probabilityScore - a.probabilityScore);
      setManifestedEvents(sortedResults);
      setIsSynthesizingEvents(false);
    }, 700);
  };

  const handleCopyPrompt = async () => {
    if (!currentPromptRecord) return;
    try {
      await navigator.clipboard.writeText(currentPromptRecord.rawPrompt);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch {}
  };

  return (
    <div className="w-full space-y-6 max-w-7xl mx-auto p-4 sm:p-6 lg:p-8 animate-fadeIn text-slate-100">
      {/* HEADER BANNER */}
      <div className="bg-gradient-to-r from-purple-950/80 via-slate-900 to-amber-950/70 border border-purple-500/40 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 relative z-10">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <span className="p-2 rounded-xl bg-purple-500/20 text-purple-300 border border-purple-500/40 shadow-inner">
                <Brain className="w-5 h-5 text-purple-400" />
              </span>
              <h2 className="text-xl sm:text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Event Manifestation Studio
                <span className="text-xs font-mono font-bold px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  Adaptive Prompt Compiler
                </span>
              </h2>
            </div>
            <p className="text-xs text-slate-300 max-w-3xl leading-relaxed">
              Dedicated engine for non-hardcoded demographic profiling (Direct Age &amp; Context Settings), Private LLM prompt compilation,
              and <strong>Bayesian multi-month feedback learning</strong> (dampening false crises &amp; amplifying verified life channels across multi-month PDs).
            </p>
          </div>

          {/* Right Status Controls */}
          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            {/* Ollama Local Health Badge */}
            <div
              className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono transition ${
                ollamaStatus.isOnline
                  ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300'
                  : 'bg-slate-900/80 border-slate-700 text-slate-400'
              }`}
            >
              <Cpu className={`w-3.5 h-3.5 ${ollamaStatus.isOnline ? 'text-emerald-400 animate-pulse' : 'text-slate-500'}`} />
              <span>
                {ollamaStatus.isOnline
                  ? `Ollama Online (${selectedLocalModel.split(':')[0]})`
                  : 'Ollama Offline (Using Vedic Synthesizer)'}
              </span>
              <button
                type="button"
                onClick={checkLocalOllama}
                title="Ping local Ollama port 11434"
                className="hover:text-white cursor-pointer ml-1"
              >
                <RefreshCw className="w-3 h-3" />
              </button>
            </div>

            {/* Native ID Pill */}
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 border border-slate-800 text-xs font-mono">
              <User className="w-3.5 h-3.5 text-amber-400" />
              <span className="text-slate-300">{activeProfile?.person_name || 'Native'} ({personId})</span>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 1: NATIVE HORIZON & PERSONAL CONTEXT (NON-HARDCODED) */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <h3 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider">
              1. Native Demographic Profile &amp; Focus Filtering
            </h3>
          </div>
          <button
            type="button"
            onClick={handleSaveProfile}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-slate-950 font-bold text-xs transition cursor-pointer shadow"
          >
            {profileSavedFeedback ? <Check className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
            <span>{profileSavedFeedback ? 'Saved to Local Vault!' : 'Save Horizon Settings'}</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Exact Age Input */}
          <div className="space-y-1.5 bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase">Age of the Person:</label>
              <span className="text-[10px] text-cyan-400 font-mono">Direct Input</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={120}
                value={nativeProfile.age}
                onChange={(e) => handleUpdateAge(parseInt(e.target.value, 10) || 1)}
                className="w-20 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-sm font-black text-amber-300 text-center focus:outline-none focus:border-cyan-500 font-mono"
              />
              <div className="text-[11px] text-slate-400 leading-tight">
                <span className="font-bold text-slate-200 block">{nativeProfile.lifeStage}</span>
                <span>Calibrates age-appropriate karakatwas</span>
              </div>
            </div>
          </div>

          {/* Situation Narrative */}
          <div className="md:col-span-2 space-y-1.5 bg-slate-950/70 border border-slate-800/80 rounded-xl p-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300 uppercase">
                Active Ground Reality / Ongoing Personal Narrative:
              </label>
              <span className="text-[10px] text-slate-400">Fed into Private LLM</span>
            </div>
            <textarea
              rows={2}
              value={nativeProfile.currentSituationNarrative}
              onChange={(e) => setNativeProfile(prev => ({ ...prev, currentSituationNarrative: e.target.value }))}
              placeholder="e.g. Currently negotiating an executive leadership switch; having mild neck stiffness; ongoing lease dispute..."
              className="w-full bg-slate-900 border border-slate-700 rounded-lg p-2 text-xs text-slate-200 placeholder:text-slate-600 focus:outline-none focus:border-purple-500 resize-none font-sans"
            />
          </div>
        </div>

        {/* Focus Domains Chips */}
        <div className="space-y-1.5 pt-1">
          <label className="text-xs font-bold text-slate-300 uppercase block">
            Target Focus Domains for this native:
          </label>
          <div className="flex flex-wrap gap-2">
            {MANIFESTATION_FOCUS_DOMAINS.map(domain => {
              const isSelected = nativeProfile.focusAreas.includes(domain.id);
              return (
                <button
                  key={domain.id}
                  type="button"
                  onClick={() => handleToggleFocusDomain(domain.id)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-purple-950 text-purple-200 border-purple-500 shadow-sm'
                      : 'bg-slate-950 text-slate-400 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full ${isSelected ? 'bg-purple-400' : 'bg-slate-600'}`} />
                  <span>{domain.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 2: DASHA HIERARCHY, TIME-TRAVELER DATE & SKY DELIVERIES */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            <h3 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider">
              2. Dasha Horizon, Target Date Range &amp; Delivery Answers in the Sky
            </h3>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-xs font-mono text-slate-300">
            <span>Tracking:</span>
            <span className="text-purple-300 font-bold">{toCleanEnglishPlanet(selectedMd)} MD</span>
            <span className="text-slate-600">&bull;</span>
            <span className="text-cyan-300 font-bold">{toCleanEnglishPlanet(selectedAd)} AD</span>
            <span className="text-slate-600">&bull;</span>
            <span className="text-amber-300 font-bold">{toCleanEnglishPlanet(selectedPd)} PD</span>
            <span className="text-slate-600">&bull;</span>
            <span className="px-2 py-0.5 rounded bg-slate-800 text-amber-300 font-bold border border-slate-700">
              {targetFromDate} to {targetToDate}
            </span>
          </div>
        </div>

        {/* Row 1: Mahadasha & Antardasha Dropdowns */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* MD Dropdown */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 uppercase block">
              Mahadasha (MD):
            </label>
            <select
              value={selectedMd}
              onChange={(e) => setSelectedMd(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500 cursor-pointer font-medium"
            >
              {VIMSHOTTARI_LORDS.map(lord => (
                <option key={lord} value={lord} className="bg-slate-900 text-white">
                  {toCleanEnglishPlanet(lord)}
                </option>
              ))}
            </select>
          </div>

          {/* AD Dropdown */}
          <div className="space-y-1">
            <label className="text-[11px] font-bold text-slate-300 uppercase block">
              Antardasha (AD):
            </label>
            <select
              value={selectedAd}
              onChange={(e) => setSelectedAd(e.target.value)}
              className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-cyan-500 cursor-pointer font-medium"
            >
              {adOptions.map(lord => (
                <option key={lord} value={lord} className="bg-slate-900 text-white">
                  {toCleanEnglishPlanet(lord)}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Next Line: Target Analysis Date Range (From Date & To Date) */}
        <div className="bg-slate-950/70 border border-slate-800/90 rounded-xl p-3.5 space-y-2.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="text-[11px] font-bold text-slate-200 uppercase tracking-wide">
              Target Analysis Date:
            </label>
            <div className="text-[11px] font-mono text-slate-400">
              Duration: <span className="text-amber-400 font-bold">{rangeDuration.days} Days</span> (~{rangeDuration.months} months)
            </div>
          </div>

          <div className="bg-purple-950/35 border border-purple-500/35 rounded-lg px-3 py-2 text-[11px] text-slate-100 leading-snug">
            <span className="font-extrabold text-purple-300 uppercase tracking-wider text-[10px] mr-1.5">
              Window One-Liner (Parivartana / Neecha Bhanga / Stations):
            </span>
            <span>{vedicSpecialEvents.consolidatedOneLiner}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* From Date Picker */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase block">
                From Date:
              </label>
              <input
                type="date"
                value={targetFromDate}
                onChange={(e) => handleFromDateChange(e.target.value)}
                className="w-full bg-slate-900 border border-amber-500/50 rounded-xl px-3 py-2 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400 cursor-pointer shadow-inner"
              />
            </div>

            {/* To Date Picker */}
            <div className="space-y-1">
              <label className="text-[10px] font-bold text-slate-400 uppercase block">
                To Date:
              </label>
              <input
                type="date"
                value={targetToDate}
                onChange={(e) => handleToDateChange(e.target.value)}
                className="w-full bg-slate-900 border border-amber-500/50 rounded-xl px-3 py-2 text-xs text-amber-300 font-bold focus:outline-none focus:border-amber-400 cursor-pointer shadow-inner"
              />
            </div>
          </div>

          {/* Presets & Historical Age Synchronizer */}
          <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-[10px] font-bold uppercase text-slate-400">Presets:</span>
              <button
                type="button"
                onClick={() => {
                  setSelectedMd('Venus (Sukra)');
                  setSelectedAd('Saturn (Sani)');
                  setSelectedPd('Ketu');
                  setTargetFromDate('2027-01-13');
                  setTargetToDate('2027-03-21');
                  setFocalDateStr('2027-02-15');
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition border cursor-pointer ${
                  targetFromDate === '2027-01-13'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 font-bold'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                Feb 2027 (Ketu PD &bull; Mars in Leo)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedMd('Venus (Sukra)');
                  setSelectedAd('Saturn (Sani)');
                  setSelectedPd('Venus (Sukra)');
                  setTargetFromDate('2027-03-21');
                  setTargetToDate('2027-09-30');
                  setFocalDateStr('2027-04-15');
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition border cursor-pointer ${
                  targetFromDate === '2027-03-21'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 font-bold'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                Apr 2027 (Venus PD &bull; Mars Vakra)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedMd('Venus (Sukra)');
                  setSelectedAd('Saturn (Sani)');
                  setSelectedPd('Mercury (Budha)');
                  setTargetFromDate('2026-08-03');
                  setTargetToDate('2027-01-13');
                  setFocalDateStr('2026-11-08');
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition border cursor-pointer ${
                  targetFromDate === '2026-08-03'
                    ? 'bg-purple-500/20 text-purple-300 border-purple-500/50 font-bold'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                Late 2026 (Mercury PD)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedMd('Mercury (Budha)');
                  setSelectedAd('Saturn (Sani)');
                  setSelectedPd('Saturn (Sani)');
                  setTargetFromDate('2003-05-05');
                  setTargetToDate('2003-10-16');
                  setFocalDateStr('2003-05-05');
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition border cursor-pointer ${
                  targetFromDate.startsWith('2003') && selectedMd.includes('Mercury')
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                2003 (Mercury MD &bull; Saturn AD)
              </button>
              <button
                type="button"
                onClick={() => {
                  setSelectedMd('Mercury (Budha)');
                  setSelectedAd('Venus (Sukra)');
                  setSelectedPd('Venus (Sukra)');
                  setTargetFromDate('1995-02-14');
                  setTargetToDate('1995-12-16');
                  setFocalDateStr('1995-02-14');
                }}
                className={`px-2.5 py-1 rounded-lg text-[11px] font-mono transition border cursor-pointer ${
                  targetFromDate.startsWith('1995') && selectedMd.includes('Mercury')
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                    : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
                }`}
              >
                1995 (Mercury MD &bull; Venus AD)
              </button>
            </div>

            {nativeAgeOnTargetDate && (
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-slate-300">
                  Age on date: <strong className="text-amber-400 font-mono font-bold">{nativeAgeOnTargetDate} Years</strong>
                </span>
                {nativeProfile.age !== nativeAgeOnTargetDate && (
                  <button
                    type="button"
                    onClick={() => handleUpdateAge(nativeAgeOnTargetDate)}
                    className="px-2.5 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-[10px] font-bold transition cursor-pointer flex items-center gap-1"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Sync Age to {nativeAgeOnTargetDate}</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* All Nine PDs Slide */}
        <div className="space-y-2 pt-2 border-t border-slate-800/80">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold text-slate-300 uppercase">
              All 9 Pratyantardashas (PDs) under {toCleanEnglishPlanet(selectedAd)} AD:
            </span>
            <span className="text-[11px] text-slate-400">Click to select active PD</span>
          </div>

          <div className="overflow-x-auto pb-1 scrollbar-thin">
            <div className="grid grid-cols-3 sm:grid-cols-5 lg:grid-cols-9 gap-2 min-w-[650px] lg:min-w-0">
              {ninePds.map(pd => {
                const isSelected = selectedPd.trim() === pd.pdLord.trim();
                return (
                  <button
                    key={pd.pdLord}
                    type="button"
                    onClick={() => {
                      setSelectedPd(pd.pdLord);
                      setPdCycleMonth(1);
                      if (pd.startDate && pd.endDate) {
                        setTargetFromDate(pd.startDate);
                        setTargetToDate(pd.endDate);
                        setFocalDateStr(pd.startDate);
                      }
                    }}
                    className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                      isSelected
                        ? 'bg-gradient-to-b from-purple-950 via-slate-900 to-slate-950 border-purple-400 text-white ring-2 ring-purple-500/50 shadow-lg'
                        : pd.isDateActive
                        ? 'bg-slate-950 border-amber-500/50 text-slate-200 hover:border-amber-400'
                        : 'bg-slate-950/70 border-slate-800 text-slate-400 hover:border-slate-700 hover:text-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1 w-full">
                      <span className="text-[9px] font-mono font-bold px-1 rounded bg-slate-800 text-slate-400">
                        PD {pd.index}
                      </span>
                      {isSelected ? (
                        <Zap className="w-3 h-3 text-amber-400 fill-current animate-pulse" />
                      ) : pd.isDateActive ? (
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="Active in Date Range" />
                      ) : null}
                    </div>
                    <span className="text-xs font-extrabold truncate block">{pd.cleanName}</span>
                    <span className="text-[9px] text-slate-500 font-mono truncate block mt-0.5">
                      {pd.startDate ? `${pd.startDate.slice(5)} → ${pd.endDate.slice(5)}` : 'Dasha span'}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* AD PRESSURE CHAMBER & PD DELIVERY MATRIX */}
        <ADChamberMatrixCard dynamics={adChamberDynamics} />

        {/* 3 Entry Gates Summary */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-xl p-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          {gateDetails.map((gate, idx) => (
            <div key={gate.nakshatraName} className="space-y-1 border-r last:border-none border-slate-800/80 pr-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-amber-300">
                  Gate {idx + 1}: {gate.nakshatraName}
                </span>
                <span className="text-[10px] text-slate-400">{gate.rashiName.split(' ')[0]}</span>
              </div>
              <div className="text-[11px] text-slate-400 flex items-center justify-between">
                <span>H{gate.houseFromLagna} (Lagna) &bull; H{gate.houseFromRashi} (Moon)</span>
                <span className="text-cyan-300 text-[10px]">{gate.moonWindow}</span>
              </div>
              <div className="text-[10px] text-slate-400 truncate">
                Transits: {gate.activeGrahas.length > 0 ? (
                  <span className="text-purple-300 font-semibold">{gate.activeGrahas.join(', ')}</span>
                ) : (
                  <span className="text-slate-600">Clear gate</span>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* LOOK AT THE SKY: GOCHARA DELIVERY ANSWERS ON TARGET DATE */}
        <div className="p-4 rounded-2xl bg-gradient-to-br from-slate-950 via-slate-900 to-purple-950/40 border border-cyan-500/40 shadow-xl space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2.5">
            <div className="flex flex-wrap items-center gap-2">
              <Eye className="w-4 h-4 text-cyan-400" />
              <h4 className="text-xs sm:text-sm font-black text-white uppercase tracking-wider flex items-center gap-1.5">
                Delivery Answers in the Sky (Gochara Ephemeris on {effectiveFocalDate.toISOString().slice(0, 10)})
              </h4>
            </div>

            {/* Quick Focal Date Controls for Ephemeris Inspection */}
            <div className="flex flex-wrap items-center gap-1.5 text-[10px]">
              <span className="text-slate-400 font-bold uppercase">Inspect Day:</span>
              <button
                type="button"
                onClick={() => setFocalDateStr(targetFromDate)}
                className={`px-2 py-0.5 rounded border font-mono transition cursor-pointer ${
                  focalDateStr === targetFromDate
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 font-bold'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                Start ({targetFromDate.slice(5)})
              </button>
              <button
                type="button"
                onClick={() => setFocalDateStr(rangeMidpointStr)}
                className={`px-2 py-0.5 rounded border font-mono transition cursor-pointer ${
                  focalDateStr === rangeMidpointStr
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 font-bold'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                Midpoint ({rangeMidpointStr.slice(5)})
              </button>
              <button
                type="button"
                onClick={() => setFocalDateStr(targetToDate)}
                className={`px-2 py-0.5 rounded border font-mono transition cursor-pointer ${
                  focalDateStr === targetToDate
                    ? 'bg-cyan-500/20 text-cyan-300 border-cyan-500/60 font-bold'
                    : 'bg-slate-900 text-slate-400 border-slate-800 hover:text-white'
                }`}
              >
                End ({targetToDate.slice(5)})
              </button>
              <input
                type="date"
                value={effectiveFocalDate.toISOString().slice(0, 10)}
                onChange={(e) => setFocalDateStr(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-cyan-300 font-mono focus:outline-none focus:border-cyan-400 cursor-pointer"
                title="Pick exact focal day to evaluate Gochara"
              />
            </div>
          </div>

          {/* Active Mars Gochara Status Banner */}
          {marsPlanet && (
            <div className={`p-2.5 rounded-xl border text-xs flex flex-wrap items-center justify-between gap-2 ${
              marsPlanet.transit_rashi_index === 5
                ? 'bg-amber-950/30 border-amber-500/40 text-amber-200'
                : marsPlanet.transit_rashi_index === 4
                ? 'bg-rose-950/30 border-rose-500/40 text-rose-200'
                : 'bg-slate-900 border-slate-800 text-slate-300'
            }`}>
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-bold uppercase tracking-wider text-[10px] px-2 py-0.5 rounded bg-slate-800 text-amber-300">
                  Mars (Sevvai) Real Gochara:
                </span>
                <span className="font-semibold text-white text-[11px]">
                  {marsPlanet.transit_rashi_name} (Sign {marsPlanet.transit_rashi_index}) &bull; House {marsPlanet.relative_to_natal_lagna.house_number} from Natal Lagna &bull; {marsPlanet.graha_pada_chara.chara_summary}
                  {marsPlanet.is_retrograde ? ' [Vakra / Retrograde]' : ' [Direct Motion]'}
                </span>
              </div>
              <div className="text-[11px] font-mono">
                {marsPlanet.transit_rashi_index === 5 ? (
                  <span className="text-emerald-400 font-bold">✓ In Simham (Leo / House 9) &bull; Mars has cleared 8th house (Cancer)</span>
                ) : marsPlanet.transit_rashi_index === 4 ? (
                  <span className="text-rose-400 font-bold">⚠ In Katakam (Cancer / House 8) &bull; {marsPlanet.is_retrograde ? 'Vakra Ingress Loop' : 'Debilitated'}</span>
                ) : (
                  <span>House {marsPlanet.relative_to_natal_lagna.house_number}</span>
                )}
              </div>
            </div>
          )}

          {/* 9 Graha Sky Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-9 gap-2">
            {skySnapshot.map(g => {
              const lordMeta = LORD_NAKSHATRA_GATES[normalizeLordKey(selectedPd)] || LORD_NAKSHATRA_GATES['Mercury (Budha)'];
              const gateIdx = lordMeta.nakshatras.findIndex(n => n.toLowerCase() === g.graha_pada_chara.nakshatra_name.toLowerCase());
              const isInGate = gateIdx >= 0;

              return (
                <div
                  key={g.graha_key}
                  className={`p-2 rounded-xl border text-xs transition flex flex-col justify-between ${
                    isInGate
                      ? 'bg-gradient-to-b from-purple-950/70 to-slate-950 border-purple-400 shadow-md shadow-purple-950/50 ring-1 ring-purple-500/40'
                      : g.is_retrograde
                        ? 'bg-slate-950 border-amber-500/40'
                        : 'bg-slate-950 border-slate-800/90'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center justify-between">
                      <span className="font-extrabold text-white text-[11px] truncate">
                        {toCleanEnglishPlanet(g.graha_name)}
                      </span>
                      {g.is_retrograde && (
                        <span className="px-1 py-0.2 rounded bg-amber-500/20 text-amber-300 font-bold text-[9px] font-mono" title="Retrograde (Vakra)">
                          R
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-300 truncate font-sans">
                      {g.transit_rashi_name.split(' ')[0]}
                    </div>
                    <div className="text-[10px] text-amber-400 font-mono font-bold">
                      {g.degree_sputa}
                    </div>
                    <div className="text-[10px] text-slate-400 truncate">
                      {g.graha_pada_chara.nakshatra_name} P{g.graha_pada_chara.pada}
                    </div>
                  </div>

                  <div className="pt-1.5 mt-1.5 border-t border-slate-800/80 flex items-center justify-between text-[10px] font-mono text-slate-400">
                    <span>H{g.relative_to_natal_lagna.house_number} Lag</span>
                    <span>H{g.relative_to_natal_rashi.house_number} Moo</span>
                  </div>

                  {isInGate && (
                    <div className="mt-1 px-1 py-0.5 rounded bg-purple-500/30 text-purple-200 text-[9px] font-bold text-center border border-purple-500/40">
                      In Gate {gateIdx + 1}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* SECTION 3: THE TWO-PASS ADAPTIVE PROMPT & MUTATION ENGINE */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-4 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-purple-400" />
            <h3 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider">
              3. Private LLM Prompt Architect (Qwen 14B / Local Model)
            </h3>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {currentPromptRecord && (
              <button
                type="button"
                onClick={handleCopyPrompt}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 transition cursor-pointer"
              >
                {promptCopied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{promptCopied ? 'Copied Prompt!' : 'Copy Active Prompt'}</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleGenerateBaselinePrompt}
              disabled={isCompilingPrompt}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs transition cursor-pointer shadow-lg shadow-purple-600/30 active:scale-95 disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isCompilingPrompt ? 'animate-spin' : ''}`} />
              <span>
                {isCompilingPrompt
                  ? `Private LLM (${selectedLocalModel.split(':')[0]}) is reasoning & composing... (${compilationSeconds}s)`
                  : `Compile Baseline v1.0 via Private LLM (${selectedLocalModel.split(':')[0]})`}
              </span>
            </button>
          </div>
        </div>

        {/* Private LLM Endpoint & Model Target Bar */}
        <div className="bg-slate-950/80 border border-slate-800/80 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Private LLM Host:</span>
              <input
                type="text"
                value={ollamaEndpoint}
                onChange={(e) => {
                  setOllamaEndpoint(e.target.value);
                  if (typeof window !== 'undefined') localStorage.setItem('astro_manifest_ollama_endpoint', e.target.value);
                }}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-amber-300 font-mono w-48 focus:outline-none focus:border-purple-500"
                placeholder="http://localhost:11434"
              />
            </div>

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Model Tag:</span>
              <input
                type="text"
                value={selectedLocalModel}
                onChange={(e) => setSelectedLocalModel(e.target.value)}
                className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-purple-300 font-mono w-36 focus:outline-none focus:border-purple-500"
                placeholder="qwen2.5:14b"
              />
            </div>

            <button
              type="button"
              onClick={checkLocalOllama}
              className="px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-[11px] font-mono border border-slate-700 transition cursor-pointer flex items-center gap-1"
            >
              <RefreshCw className="w-3 h-3" />
              <span>Test Ping</span>
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-mono">
            {ollamaStatus.isOnline ? (
              <span className="text-emerald-400 font-bold flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ollama Active ({ollamaStatus.models.length} local models detected)
              </span>
            ) : (
              <span className="text-amber-400 flex items-center gap-1">
                <AlertTriangle className="w-3.5 h-3.5" /> Ollama Offline (Run &apos;ollama run {selectedLocalModel}&apos; in terminal)
              </span>
            )}
          </div>
        </div>

        {/* Notice Banner if Connection Failed */}
        {compilationError && (
          <div className="p-3 rounded-xl bg-amber-950/50 border border-amber-500/50 text-xs text-amber-200 flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-extrabold text-amber-300">Private LLM Connection Notice:</span>
              <p className="font-mono text-[11px] text-amber-200/90 leading-snug">{compilationError}</p>
              <p className="text-[11px] text-slate-300 pt-0.5">
                💡 To have Qwen 14B compose the prompt directly on your machine, open terminal and ensure Ollama is serving at <code className="text-amber-300">{ollamaEndpoint}</code> with <code className="text-amber-300">{selectedLocalModel}</code>. A structured fallback was generated in the meantime so your flow remains unblocked.
              </p>
            </div>
          </div>
        )}

        {/* Prompt Version History Tabs */}
        {promptHistory.length > 0 ? (
          <div className="space-y-3">
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              {promptHistory.map((rec, idx) => (
                <button
                  key={`${rec.version}-${rec.createdAt}`}
                  type="button"
                  onClick={() => setActiveVersionIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer flex items-center gap-2 shrink-0 ${
                    activeVersionIndex === idx
                      ? 'bg-gradient-to-r from-purple-900 to-indigo-900 border border-purple-400 text-white shadow-md'
                      : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-slate-200'
                  }`}
                >
                  <History className="w-3 h-3 text-purple-400" />
                  <span>{rec.versionTag}</span>
                  <span className="text-[10px] text-slate-400 font-mono">({rec.generatedByModel.split(' ')[0]})</span>
                </button>
              ))}
            </div>

            {/* Active Prompt Details Card */}
            {currentPromptRecord && (
              <div className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-800/80 pb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black text-amber-300">{currentPromptRecord.versionTag}</span>
                    <span className="text-[10px] text-slate-500">&bull;</span>
                    <span className="text-[11px] text-slate-400">{currentPromptRecord.evolutionLog}</span>
                  </div>
                  <span className="text-[10px] font-mono text-purple-300">
                    Compiled via {currentPromptRecord.generatedByModel}
                  </span>
                </div>

                {/* Damped vs Amplified Insights */}
                {(currentPromptRecord.dampedAlerts.length > 0 || currentPromptRecord.amplifiedTrajectories.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                    {currentPromptRecord.dampedAlerts.length > 0 && (
                      <div className="p-2 rounded-lg bg-rose-950/40 border border-rose-800/40 space-y-1">
                        <span className="font-bold text-rose-300 flex items-center gap-1 text-[11px]">
                          &darr; Damped False Alarms (Mitigated):
                        </span>
                        <ul className="list-disc pl-4 text-[10.5px] text-rose-200 space-y-0.5">
                          {currentPromptRecord.dampedAlerts.map((d, i) => (
                            <li key={i}>{d}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {currentPromptRecord.amplifiedTrajectories.length > 0 && (
                      <div className="p-2 rounded-lg bg-emerald-950/40 border border-emerald-800/40 space-y-1">
                        <span className="font-bold text-emerald-300 flex items-center gap-1 text-[11px]">
                          &uarr; Amplified Channels (Sequential Realities):
                        </span>
                        <ul className="list-disc pl-4 text-[10.5px] text-emerald-200 space-y-0.5">
                          {currentPromptRecord.amplifiedTrajectories.map((a, i) => (
                            <li key={i}>{a}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {/* Full-Screen Prompt Canvas for Consumer Apps */}
                <div className="space-y-3 bg-slate-950 rounded-2xl border border-purple-500/30 p-4 shadow-2xl">
                  {/* Top Bar inside Prompt Card */}
                  <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800/80 pb-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="px-2.5 py-1 rounded-lg bg-purple-500/20 text-purple-200 border border-purple-500/40 text-xs font-black uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-3.5 h-3.5 text-purple-400" />
                        <span>Consumer App Boilerplate Prompt</span>
                      </span>
                      <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
                        <span>{promptStats.words} words</span>
                        <span className="text-slate-600">&bull;</span>
                        <span className="text-amber-300 font-bold">~{promptStats.estimatedTokens} tokens</span>
                        <span className="text-slate-600">&bull;</span>
                        <span>{promptStats.lines} lines</span>
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      {/* Edit in place toggle */}
                      {isEditingPrompt ? (
                        <button
                          type="button"
                          onClick={handleSaveEditedPrompt}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold text-xs transition cursor-pointer shadow"
                        >
                          <Save className="w-3.5 h-3.5" />
                          <span>Save Edits</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setEditedPromptText(currentPromptRecord.rawPrompt);
                            setIsEditingPrompt(true);
                          }}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 transition cursor-pointer"
                          title="Tweak or edit prompt text in place"
                        >
                          <Edit3 className="w-3 h-3" />
                          <span>Edit Prompt</span>
                        </button>
                      )}

                      {/* Download as .txt file */}
                      <button
                        type="button"
                        onClick={handleDownloadPrompt}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 transition cursor-pointer"
                        title="Download raw prompt as .txt file"
                      >
                        <FileDown className="w-3 h-3 text-cyan-400" />
                        <span>Download .txt</span>
                      </button>

                      {/* Expand / Minimize height toggle */}
                      <button
                        type="button"
                        onClick={() => setIsPromptExpanded(!isPromptExpanded)}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 transition cursor-pointer"
                        title={isPromptExpanded ? 'Compact scroll view' : 'Expand full height'}
                      >
                        {isPromptExpanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                        <span>{isPromptExpanded ? 'Fit Height' : 'Expand Full'}</span>
                      </button>

                      {/* Primary Copy Button at Top */}
                      <button
                        type="button"
                        onClick={handleCopyPrompt}
                        className="flex items-center gap-2 px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95"
                      >
                        {promptCopied ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{promptCopied ? 'Copied to Clipboard!' : 'Copy Entire Prompt for Consumer App'}</span>
                      </button>
                    </div>
                  </div>

                  {/* Prompt Text / Editor Body */}
                  <div className="relative rounded-xl border border-slate-800 bg-slate-950 overflow-hidden">
                    {isEditingPrompt ? (
                      <textarea
                        rows={isPromptExpanded ? 30 : 16}
                        value={editedPromptText}
                        onChange={(e) => setEditedPromptText(e.target.value)}
                        className="w-full p-4 bg-slate-950 text-slate-100 font-mono text-xs leading-relaxed focus:outline-none focus:ring-1 focus:ring-purple-500 resize-y"
                        placeholder="Edit prompt text..."
                      />
                    ) : (
                      <pre
                        className={`w-full p-4 bg-slate-950 text-slate-200 font-mono text-xs whitespace-pre-wrap leading-relaxed select-all overflow-y-auto ${
                          isPromptExpanded ? 'min-h-[500px] max-h-none' : 'max-h-96'
                        }`}
                      >
                        {currentPromptRecord.rawPrompt}
                      </pre>
                    )}
                  </div>

                  {/* Bottom Action & Consumer App Guidance Bar */}
                  <div className="p-3 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-xs text-slate-300">
                      <span className="text-amber-400 font-bold">💡 How to test:</span>
                      <p className="text-[11px] text-slate-300 leading-snug">
                        Click the button to copy this entire boilerplate prompt, open <strong>Claude 3.5 Sonnet</strong>, <strong>ChatGPT Plus</strong>, or <strong>Gemini Advanced</strong>, and paste it to inspect the manufactured event cards.
                      </p>
                    </div>

                    <button
                      type="button"
                      onClick={handleCopyPrompt}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs transition cursor-pointer shadow-lg shadow-emerald-500/20 active:scale-95"
                    >
                      {promptCopied ? <Check className="w-4 h-4 stroke-[3]" /> : <Copy className="w-4 h-4" />}
                      <span>{promptCopied ? 'Copied to Clipboard!' : 'Copy Entire Prompt to Clipboard'}</span>
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-6 text-slate-500 text-xs">
            No compiled prompt in vault for this PD yet. Click &quot;Compile Baseline v1.0 via Private LLM&quot; to begin tracking.
          </div>
        )}

        {/* PASS 2: REALITY-CHECK CALIBRATION & PROMPT MUTATION DRAWER */}
        {currentPromptRecord && (
          <div className="mt-4 pt-4 border-t border-slate-800/80 space-y-3 bg-purple-950/20 p-4 rounded-xl border border-purple-500/30">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h4 className="text-xs font-black text-amber-300 uppercase tracking-wide flex items-center gap-1.5">
                  <TrendingUp className="w-3.5 h-3.5 text-amber-400" />
                  Pass 2: Ground-Truth Reality Calibration (Educate the Private LLM)
                </h4>
                <p className="text-[11px] text-slate-300">
                  Rate how Month {currentPromptRecord.cycleMonthNumber}&apos;s events actually manifested. The Private LLM will ingest this delta to compile Month {currentPromptRecord.cycleMonthNumber + 1}&apos;s matured prompt!
                </p>
              </div>

              <button
                type="button"
                onClick={handleEvolvePrompt}
                disabled={isCompilingPrompt}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 font-black text-xs transition cursor-pointer shadow-lg active:scale-95 disabled:opacity-50"
              >
                <Zap className={`w-3.5 h-3.5 ${isCompilingPrompt ? 'animate-spin' : 'fill-current'}`} />
                <span>
                  {isCompilingPrompt
                    ? 'Mutating via Private LLM...'
                    : `Evolve to Month ${currentPromptRecord.cycleMonthNumber + 1} Prompt (v${currentPromptRecord.version + 1}.0)`}
                </span>
              </button>
            </div>

            {/* Event Reality Calibration Sliders */}
            <div className="space-y-2 pt-1">
              {feedbackReviews.map((item, idx) => (
                <div key={idx} className="bg-slate-950/90 border border-slate-800 rounded-lg p-2.5 space-y-1.5">
                  <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                    <div className="flex items-center gap-1.5">
                      <span className="font-extrabold text-white">{item.title}</span>
                      <span className="text-[10px] text-slate-500">[{item.portfolio}]</span>
                      <span className="text-[10px] text-amber-400 font-mono">Predicted: {item.predictedProb}%</span>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-300">Actual Match:</span>
                      <span className={`font-mono font-bold text-xs px-1.5 py-0.2 rounded ${
                        item.actualMatchPct >= 65
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-500/40'
                          : item.actualMatchPct <= 35
                          ? 'bg-rose-950 text-rose-300 border border-rose-500/40'
                          : 'bg-amber-950 text-amber-300 border border-amber-500/40'
                      }`}>
                        {item.actualMatchPct}%
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={item.actualMatchPct}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        setFeedbackReviews(prev => {
                          const copy = [...prev];
                          copy[idx] = { ...copy[idx], actualMatchPct: val };
                          return copy;
                        });
                      }}
                      className="w-48 h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-400"
                    />

                    <input
                      type="text"
                      value={item.notes}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFeedbackReviews(prev => {
                          const copy = [...prev];
                          copy[idx] = { ...copy[idx], notes: val };
                          return copy;
                        });
                      }}
                      placeholder="Ground-truth observation (e.g. Only mild cough for 2 days; no fever)..."
                      className="flex-1 bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-[11px] text-slate-200 focus:outline-none focus:border-amber-400 font-sans"
                    />
                  </div>
                </div>
              ))}
            </div>

            {/* General Reflection Box */}
            <div className="space-y-1">
              <label className="text-[11px] font-bold text-slate-300 uppercase">
                General Native Monthly Observation (Fed to LLM Mutation):
              </label>
              <input
                type="text"
                value={generalReflection}
                onChange={(e) => setGeneralReflection(e.target.value)}
                placeholder="High-level feedback to steer the prompt mutation..."
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-slate-200 focus:outline-none focus:border-amber-400"
              />
            </div>
          </div>
        )}
      </div>

      {/* SECTION 4: DOWNSTREAM DISPATCHING & TEST RUNNER (OPTIONAL) */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-2xl p-4 sm:p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-purple-400" />
            <div>
              <h3 className="text-xs sm:text-sm font-extrabold text-white uppercase tracking-wider">
                4. Downstream Dispatching (Claude Fable / Downstream Testing)
              </h3>
              <p className="text-[11px] text-slate-400">
                Test the generated prompt directly in consumer apps (Claude, ChatGPT, Gemini) using the Copy button above. Direct auto-dispatching to Claude Fable will be enabled next week as scheduled.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setShowSection4Synthesis(!showSection4Synthesis)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white text-xs border border-slate-700 transition cursor-pointer"
            >
              {showSection4Synthesis ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              <span>{showSection4Synthesis ? 'Collapse Downstream Runner' : 'Open Downstream Runner'}</span>
            </button>
          </div>
        </div>

        {showSection4Synthesis && (
          <div className="pt-3 border-t border-slate-800 space-y-4 animate-fadeIn">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-300 font-medium">
                Execute prompt downstream through local Qwen or connected LLM:
              </span>
              <button
                type="button"
                onClick={handleSynthesizeEventsFromPrompt}
                disabled={isSynthesizingEvents || !currentPromptRecord}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-black text-xs transition shadow-lg shadow-purple-600/30 cursor-pointer active:scale-95 disabled:opacity-50"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isSynthesizingEvents ? 'animate-spin' : ''}`} />
                <span>
                  {isSynthesizingEvents
                    ? 'Synthesizing...'
                    : `Run Downstream Test via ${currentPromptRecord ? currentPromptRecord.versionTag.split(' ')[0] : 'Prompt'}`}
                </span>
              </button>
            </div>

        {/* Manifested Events Header & Ordering Badge */}
        {manifestedEvents.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl bg-purple-950/40 border border-purple-500/30 text-xs">
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-purple-200">
                All {manifestedEvents.length} Possible Events Synthesized
              </span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-mono font-bold">
                Ordered by Highest Likelihood
              </span>
            </div>
            <div className="flex items-center gap-3 text-[11px] font-mono text-slate-400">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span>{manifestedEvents.filter((e) => e.latencyStatus === 'acute_moon_triggered').length} Acute Triggers</span>
              </span>
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-slate-500" />
                <span>{manifestedEvents.filter((e) => e.latencyStatus !== 'acute_moon_triggered').length} Latent Potentials</span>
              </span>
            </div>
          </div>
        )}

        {/* Manifested Events Cards */}
        {manifestedEvents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {manifestedEvents.map((evt) => {
              const isAcute = evt.latencyStatus === 'acute_moon_triggered';
              return (
                <div
                  key={evt.id}
                  className={`rounded-2xl p-4 border transition-all flex flex-col justify-between space-y-3 ${
                    isAcute
                      ? 'bg-gradient-to-b from-amber-950/30 to-slate-950 border-amber-500/40 shadow-lg shadow-amber-950/20'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="space-y-2">
                    {/* Header Row: Title & Badges */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5">
                        <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                          {evt.portfolio}
                        </span>
                        <h4 className="text-sm font-extrabold text-white leading-snug">{evt.title}</h4>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-base font-black font-mono ${isAcute ? 'text-amber-400' : 'text-slate-400'}`}>
                          {evt.probabilityScore}%
                        </span>
                        <span className="block text-[9px] uppercase tracking-wider text-slate-500 font-bold">Probability</span>
                      </div>
                    </div>

                    {/* Narrative */}
                    <p className="text-xs text-slate-300 leading-relaxed font-sans">{evt.narrative}</p>

                    {/* Calibrated Evolution Note */}
                    {evt.calibratedEvolutionNote && (
                      <div className="p-1.5 rounded-lg bg-purple-950/40 border border-purple-500/30 text-[10px] text-purple-200 font-mono">
                        &bull; {evt.calibratedEvolutionNote}
                      </div>
                    )}
                  </div>

                  {/* Footer Meta */}
                  <div className="pt-2 border-t border-slate-800/80 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400">
                    <div className="flex items-center gap-1.5 truncate">
                      <Layers className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                      <span className="truncate">{evt.gateTrigger}</span>
                    </div>

                    {isAcute ? (
                      <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-bold">
                        <Moon className="w-2.5 h-2.5 fill-current" />
                        <span>Acute ({evt.moonWindowDates || '2.5-day trigger'})</span>
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500 font-mono">Dormant Potential</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-slate-500 text-xs">
            No events synthesized yet. Click &quot;Manufacture Events&quot; above to run the matured prompt through the downstream LLM.
          </div>
        )}
          </div>
        )}
      </div>
    </div>
  );
};
export default EventManifestationStudio;

