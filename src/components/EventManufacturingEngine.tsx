import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Zap,
  Sparkles,
  Compass,
  Layers,
  Clock,
  Eye,
  Copy,
  Check,
  AlertTriangle,
  ShieldCheck,
  Activity,
  ArrowRight,
  TrendingUp,
  RefreshCw,
  Info,
  ChevronDown,
  ChevronUp,
  Key,
  Flame,
  CheckCircle2,
  XCircle
} from 'lucide-react';
import {
  LLMProviderId,
  LLM_PROVIDERS
} from '../services/llm/types';
import { getPreferredGeminiModel } from '../services/llm/geminiModels';
import {
  RASHI_LIST_META,
  NAKSHATRAS,
  NAKSHATRA_LORDS
} from '../data/transitEphemeris';
import {
  toCleanEnglishPlanet,
  toCleanEnglishSign
} from '../services/llm/adapters';
import { PersonMaster } from '../data/horoscopeData';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export type PerspectiveMode = 'lagna' | 'rashi' | 'dual';

export interface ManufacturedEventItem {
  id: string;
  title: string;
  narrative: string; // 1-2 line crisp narrative of what is going to happen
  probabilityScore: number; // 0..100
  isHighProbability: boolean; // >= 60%
  portfolio?: string; // Work, Life, Health, Money, Friends, Love, Trip
  gateTrigger?: string; // Specific Nakshatra gate & transit trigger
}

export interface NakshatraGateInfo {
  nakshatraName: string;
  rashiIndex: number; // 1..12
  rashiName: string;
  houseFromLagna: number;
  houseFromRashi: number;
  anatomicalSeat: string;
  significations: string;
  transitingPlanets: string[];
  moonIngressWindow?: string;
}

interface EventManufacturingEngineProps {
  personId: string;
  activeProfile: PersonMaster;
  natalLagnaIdx: number; // 1..12
  natalRashiIdx: number; // 1..12
  selectedMonth: number; // 0..11
  selectedYear: number;
  activeDashaHierarchy: {
    mahadasha: string;
    antardasha: string;
    pratyantardasha: string;
    startDate: string;
    endDate: string;
  };
  flattenedD1: any[];
  transitPlacements: any[];
  monthlyMoonSpans: any[];
}

// 9 Planetary Lords & their 3 Nakshatra Gates
const LORD_NAKSHATRA_GATES: Record<string, { nakshatras: string[]; rashis: number[]; anatomies: string[]; signs: string[] }> = {
  Ketu: {
    nakshatras: ['Ashwini', 'Magha', 'Mula'],
    rashis: [1, 5, 9], // Mesham, Simham, Dhanus
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

function parseEventsFromLlmResponse(rawText: string): ManufacturedEventItem[] {
  let cleaned = (rawText || '').trim();
  
  // Strip markdown code fences if present (```json ... ```)
  if (cleaned.includes('```')) {
    cleaned = cleaned.replace(/```(?:json)?/gi, '').replace(/```/g, '').trim();
  }

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  const firstBracket = cleaned.indexOf('[');
  const lastBracket = cleaned.lastIndexOf(']');

  let parsedData: any = null;

  if (firstBrace !== -1 && lastBrace !== -1) {
    try {
      parsedData = JSON.parse(cleaned.substring(firstBrace, lastBrace + 1));
    } catch {}
  }

  if (!parsedData && firstBracket !== -1 && lastBracket !== -1) {
    try {
      parsedData = JSON.parse(cleaned.substring(firstBracket, lastBracket + 1));
    } catch {}
  }

  if (!parsedData) {
    try {
      parsedData = JSON.parse(cleaned);
    } catch {}
  }

  const rawList: any[] = Array.isArray(parsedData)
    ? parsedData
    : Array.isArray(parsedData?.events)
    ? parsedData.events
    : Array.isArray(parsedData?.manufacturedEvents)
    ? parsedData.manufacturedEvents
    : [];

  return rawList.map((item: any, idx: number) => {
    const rawProb = item.probabilityScore ?? item.probability ?? item.score ?? 60;
    const probNum = typeof rawProb === 'number' ? rawProb : parseInt(String(rawProb).replace(/\D/g, '') || '60', 10);
    const clampedProb = Math.max(10, Math.min(95, isNaN(probNum) ? 60 : probNum));

    return {
      id: item.id || `evt-${Date.now()}-${idx + 1}`,
      title: item.title || item.eventTitle || item.name || `Event ${idx + 1}`,
      narrative: item.narrative || item.description || item.manifestation || 'Lived manifestation manufactured during this period.',
      probabilityScore: clampedProb,
      isHighProbability: clampedProb >= 60,
      portfolio: item.portfolio || item.category || 'Life',
      gateTrigger: item.gateTrigger || item.astrologicalRootCause || item.trigger || 'Active Dasha Lord + Nakshatra Gate Passage'
    };
  });
}

export const EventManufacturingEngine: React.FC<EventManufacturingEngineProps> = ({
  personId,
  activeProfile,
  natalLagnaIdx,
  natalRashiIdx,
  selectedMonth,
  selectedYear,
  activeDashaHierarchy,
  flattenedD1,
  transitPlacements,
  monthlyMoonSpans
}) => {
  // 1. Available Delivering Hands for Selection
  const availableHands = useMemo(() => {
    const list: { id: string; label: string; role: 'AD' | 'PD' | 'MD'; rawName: string }[] = [];
    
    // MD
    const mdKey = normalizeLordKey(activeDashaHierarchy.mahadasha);
    list.push({ id: `MD-${mdKey}`, label: `${toCleanEnglishPlanet(mdKey)} MD`, role: 'MD', rawName: mdKey });

    // AD (Delivering Antardasha)
    const adKey = normalizeLordKey(activeDashaHierarchy.antardasha);
    if (!list.some(item => item.rawName === adKey)) {
      list.push({ id: `AD-${adKey}`, label: `${toCleanEnglishPlanet(adKey)} AD (Delivering Hand)`, role: 'AD', rawName: adKey });
    }

    // PD (Active Month Teeth)
    const pdKey = normalizeLordKey(activeDashaHierarchy.pratyantardasha);
    if (!list.some(item => item.rawName === pdKey)) {
      list.push({ id: `PD-${pdKey}`, label: `${toCleanEnglishPlanet(pdKey)} PD (Month Teeth)`, role: 'PD', rawName: pdKey });
    }

    // Complementary key lords (Saturn and Mercury often active in sub-periods)
    for (const complementary of ['Mercury (Budha)', 'Saturn (Sani)', 'Venus (Sukra)', 'Mars (Sevvai)', 'Jupiter (Guru)', 'Rahu', 'Sun (Surya)']) {
      if (!list.some(item => item.rawName === complementary)) {
        list.push({ id: `SUB-${complementary}`, label: `${toCleanEnglishPlanet(complementary)}`, role: 'PD', rawName: complementary });
      }
    }

    return list;
  }, [activeDashaHierarchy]);

  // Selected Delivering Hand
  const [selectedHandKey, setSelectedHandKey] = useState<string>(() => {
    return normalizeLordKey(activeDashaHierarchy.pratyantardasha) || 'Mercury (Budha)';
  });

  // Perspective Mode: Lagna, Rashi, or Dual
  const [perspective, setPerspective] = useState<PerspectiveMode>('dual');

  // Model & Provider Selection (Default: Google Gemini)
  const [selectedProvider, setSelectedProvider] = useState<LLMProviderId>('gemini_pro');
  
  // API Key management directly in the engine card
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('astro_gemini_api_key') : '') || '';
  });
  const [showKeyInput, setShowKeyInput] = useState<boolean>(false);

  // Synthesis & Result State (Starts empty - NO HARDCODED PRE-POPULATION)
  const [manufacturedEvents, setManufacturedEvents] = useState<ManufacturedEventItem[]>([]);
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [synthesisSeconds, setSynthesisSeconds] = useState<number>(0);
  const [lastSynthesizedModel, setLastSynthesizedModel] = useState<string | null>(null);
  const [lastExecutionTimeMs, setLastExecutionTimeMs] = useState<number | null>(null);
  const [synthesisError, setSynthesisError] = useState<string | null>(null);

  // Prompt Inspector Modal State
  const [showPromptModal, setShowPromptModal] = useState<boolean>(false);
  const [promptCopied, setPromptCopied] = useState<boolean>(false);

  // Timer for active synthesis
  const timerRef = useRef<any>(null);

  // 2. Compute the 3 Nakshatra Entry Gates for the Selected Delivering Hand
  const gateDetails = useMemo<NakshatraGateInfo[]>(() => {
    const lordMeta = LORD_NAKSHATRA_GATES[selectedHandKey] || LORD_NAKSHATRA_GATES['Mercury (Budha)'];
    
    return lordMeta.nakshatras.map((nakName, idx) => {
      const rIdx = lordMeta.rashis[idx];
      const rMeta = RASHI_LIST_META.find(r => r.index === rIdx) || RASHI_LIST_META[0];
      const hLagna = ((rIdx - natalLagnaIdx + 12) % 12) + 1;
      const hRashi = ((rIdx - natalRashiIdx + 12) % 12) + 1;

      // Find transiting planets in this sign this month
      const planetsInSign = (transitPlacements || [])
        .filter((t: any) => t.sign_index === rIdx || t.house_from_lagna === hLagna)
        .map((t: any) => t.graha_name || t.graha_key);

      // Find Moon ingress dates for this sign
      const moonSpan = (monthlyMoonSpans || []).find((m: any) => m.signIndex === rIdx || m.houseNumber === hLagna);
      const moonIngressWindow = moonSpan ? `Day ${moonSpan.startDay}–${moonSpan.endDay}` : undefined;

      return {
        nakshatraName: nakName,
        rashiIndex: rIdx,
        rashiName: rMeta.eng,
        houseFromLagna: hLagna,
        houseFromRashi: hRashi,
        anatomicalSeat: lordMeta.anatomies[idx] || 'Vital Organs & Nerves',
        significations: lordMeta.signs[0] || 'Karmic fruition gate',
        transitingPlanets: Array.from(new Set(planetsInSign)),
        moonIngressWindow
      };
    });
  }, [selectedHandKey, natalLagnaIdx, natalRashiIdx, transitPlacements, monthlyMoonSpans]);

  // 3. Complete Raw Prompt Payload for Gemini / LLM Execution
  const promptPayload = useMemo(() => {
    const monthName = MONTH_NAMES[selectedMonth] || 'Active Month';
    const cleanHand = toCleanEnglishPlanet(selectedHandKey);
    const cleanMd = toCleanEnglishPlanet(activeDashaHierarchy.mahadasha);
    const cleanAd = toCleanEnglishPlanet(activeDashaHierarchy.antardasha);
    const cleanPd = toCleanEnglishPlanet(activeDashaHierarchy.pratyantardasha);

    return `You are an elite Classical Vedic Astrologer executing the "EVENT MANUFACTURING ENGINE" under Parashara & Nadi timing laws.

[HORIZON & DELIVERING HAND IDENTIFICATION]
- Target Month: ${monthName} ${selectedYear}
- Ascendant (Lagna): ${RASHI_LIST_META[natalLagnaIdx - 1]?.eng || 'Sagittarius'} (House 1)
- Janma Rashi (Moon Sign): ${RASHI_LIST_META[natalRashiIdx - 1]?.eng || 'Scorpio'} (Janma Rashi)
- Active Mahadasha (MD): ${cleanMd}
- Active Antardasha (AD): ${cleanAd}
- Active Pratyantardasha (PD) [Teeth of the Month]: ${cleanPd}
- SELECTED DELIVERING HAND TARGET: ${cleanHand}
- EVALUATION PERSPECTIVE: ${perspective === 'lagna' ? 'STRICTLY FROM LAGNA (Physical Body, Anatomy, Somatic Scars & Vulnerabilities)' : perspective === 'rashi' ? 'STRICTLY FROM MOON (Psychological Reality, Perception, Experiential Fruition)' : 'DUAL COMBINED SYNTHESIS (Lagna Physical Reality + Moon Experiential Reality)'}

[THE THREE NAKSHATRA ENTRY GATES FOR DELIVERING HAND: ${cleanHand}]
${gateDetails.map((g, idx) => `Gate ${idx + 1}: ${g.nakshatraName} in ${g.rashiName}
- House from Lagna: House ${g.houseFromLagna}
- House from Janma Rashi (Moon): House ${g.houseFromRashi}
- Anatomical Seat & Karakatwa: ${g.anatomicalSeat} — ${g.significations}
- Transiting Planets Passing this Gate this Month: ${g.transitingPlanets.length > 0 ? g.transitingPlanets.join(', ') : 'None'}
- Moon (Chandra) Gate Passage Window: ${g.moonIngressWindow || 'Approx. 2.25-day lunar transit'}
`).join('\n')}

[CRITICAL PARASHARA REASONING LAWS FOR EVENT MANUFACTURING]
1. The Delivering Hand (${cleanHand}) acts as the executive delivery hand. Its 3 Nakshatras (${gateDetails.map(g => g.nakshatraName).join(', ')}) are the physical gates into the chart.
2. Whenever a transiting planet (such as Mars, Saturn, Sun, Venus, or the Moon) crosses that gate, the event MANUFACTURES.
3. Lagna determines physical vulnerability and bodily seats (e.g., Venus in Lagna + Saturn AD = facial scar or chronic skin delay; Mars in 8th house Ashlesha = digestive burning, gut flora inflammation, sleep disturbance).
4. Moon determines the experiential weather, timing of fruition, and psychological impact.
5. Manufacture 4 to 6 authentic, specific events that will manifest during this time frame.
6. For each event, provide:
   - title: Direct headline of the event
   - narrative: Crisp 1-to-2 line description of the exact physical, financial, or relational manifestation
   - probabilityScore: Realistic integer probability (e.g. 75, 65, 55, 40, 25)
   - portfolio: Assign to one portfolio category from: Work, Life, Health, Money, Friends, Love, Trip
   - gateTrigger: The specific Nakshatra gate and planetary passage that triggered this event

OUTPUT FORMAT REQUIREMENT:
Return ONLY a valid JSON object matching this schema:
{
  "deliveringHand": "${cleanHand}",
  "perspective": "${perspective}",
  "events": [
    {
      "id": "evt-1",
      "title": "Specific event title",
      "narrative": "Crisp 1-to-2 line physical or experiential manifestation statement.",
      "probabilityScore": 75,
      "portfolio": "Health | Work | Money | Life | Love | Friends | Trip",
      "gateTrigger": "Nakshatra gate + transit planet passage"
    }
  ]
}`;
  }, [selectedMonth, selectedYear, natalLagnaIdx, natalRashiIdx, activeDashaHierarchy, selectedHandKey, perspective, gateDetails]);

  // Copy prompt helper
  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptPayload);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch {}
  };

  // Save custom key helper
  const handleSaveApiKey = (keyVal: string) => {
    const trimmed = keyVal.trim();
    setGeminiApiKey(trimmed);
    if (typeof window !== 'undefined') {
      localStorage.setItem('astro_gemini_api_key', trimmed);
    }
  };

  // Real LLM Synthesis Execution directly calling Gemini / Claude / Ollama
  const handleSynthesizeEvents = async () => {
    setIsSynthesizing(true);
    setSynthesisError(null);
    setSynthesisSeconds(0);
    const startMs = Date.now();

    timerRef.current = setInterval(() => {
      setSynthesisSeconds(prev => prev + 1);
    }, 1000);

    try {
      const activeKey = (
        geminiApiKey ||
        (typeof window !== 'undefined' ? localStorage.getItem('astro_gemini_api_key') : '') ||
        ''
      ).trim();

      const modelToUse = getPreferredGeminiModel();

      // Dispatch request to server proxy endpoint
      let endpoint = '/api/llm/gemini';
      if (selectedProvider === 'claude_sonnet' || selectedProvider === 'claude_haiku') {
        endpoint = '/api/llm/claude';
      }

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(activeKey ? { 'x-goog-api-key': activeKey, 'x-api-key': activeKey } : {})
        },
        body: JSON.stringify({
          prompt: promptPayload,
          model: modelToUse,
          apiKey: activeKey || undefined
        })
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok || data.error) {
        const errorMsg = data.error || `HTTP ${res.status}: Failed to reach LLM endpoint`;
        setSynthesisError(errorMsg);
        throw new Error(errorMsg);
      }

      const rawLlmText = data.text || '';
      const parsedEvents = parseEventsFromLlmResponse(rawLlmText);

      if (parsedEvents.length === 0) {
        throw new Error('LLM responded, but returned an unparseable event list format. Inspect the prompt payload.');
      }

      setManufacturedEvents(parsedEvents);
      setLastSynthesizedModel(data.model || modelToUse);
      setLastExecutionTimeMs(Date.now() - startMs);
    } catch (err: any) {
      console.error('Event Manufacturing Engine Synthesis Error:', err);
      // Keep synthesisError set for clear UI alert
    } finally {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="bg-slate-900/95 border-2 border-purple-500/40 rounded-2xl p-5 sm:p-6 space-y-5 shadow-2xl shadow-purple-950/20">
      {/* HEADER: TITLE & CORE CONTROLS */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-purple-500/20 border border-purple-500/40 text-purple-300">
              <Zap className="w-5 h-5 fill-current animate-pulse" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white tracking-wide flex items-center gap-2">
                <span>Event Manufacturing Engine</span>
                <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/40">
                  Nadi &amp; Parashara Gates
                </span>
              </h3>
              <p className="text-xs text-slate-400">
                Delivering Hand ({toCleanEnglishPlanet(selectedHandKey)}) + 3 Nakshatra Gates + Planetary Passages = Direct Event Manufacture.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Key toggle */}
          <button
            type="button"
            onClick={() => setShowKeyInput(!showKeyInput)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
              geminiApiKey
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/40'
                : 'bg-slate-950 border-amber-500/50 text-amber-300 hover:bg-slate-800'
            }`}
            title="Configure or view Gemini API Key"
          >
            <Key className="w-3.5 h-3.5" />
            <span>{geminiApiKey ? 'Gemini Key Configured' : 'Configure Gemini Key'}</span>
          </button>

          {/* Prompt Inspector */}
          <button
            type="button"
            onClick={() => setShowPromptModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-purple-500/40 text-purple-300 font-bold text-xs transition cursor-pointer shadow-sm active:scale-95"
            title="Inspect complete raw prompt payload generated by the engine that gets posted to LLM"
          >
            <Eye className="w-3.5 h-3.5 text-purple-400" />
            <span>Inspect Prompt</span>
          </button>

          {/* Model Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-semibold">Model:</span>
            <select
              value={selectedProvider}
              onChange={e => setSelectedProvider(e.target.value as LLMProviderId)}
              className="bg-slate-950 border border-slate-700 text-purple-300 font-bold text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-purple-400 cursor-pointer"
            >
              <option value="gemini_pro" className="bg-slate-900 text-white">Google Gemini 2.5 Flash / Pro</option>
              <option value="claude_sonnet" className="bg-slate-900 text-white">Anthropic Claude 3.5 Sonnet</option>
              <option value="local_qwen" className="bg-slate-900 text-white">Local Qwen (Ollama)</option>
            </select>
          </div>

          {/* Primary Action Button */}
          <button
            type="button"
            onClick={handleSynthesizeEvents}
            disabled={isSynthesizing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white font-extrabold text-xs transition shadow-lg shadow-purple-600/30 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSynthesizing ? 'animate-spin' : ''}`} />
            <span>{isSynthesizing ? `Synthesizing via Gemini (${synthesisSeconds}s)...` : 'Synthesize Events via LLM'}</span>
          </button>
        </div>
      </div>

      {/* OPTIONAL IN-CARD API KEY INPUT DRAWER */}
      {showKeyInput && (
        <div className="bg-slate-950 p-3.5 rounded-xl border border-purple-500/30 space-y-2 animate-fadeIn">
          <div className="flex items-center justify-between">
            <label className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
              <Key className="w-3.5 h-3.5 text-amber-400" />
              <span>Google Gemini API Key (Stored securely in browser localStorage):</span>
            </label>
            <a
              href="https://aistudio.google.com/apikey"
              target="_blank"
              rel="noreferrer"
              className="text-[11px] text-amber-400 hover:underline"
            >
              Get free key &rarr;
            </a>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="password"
              value={geminiApiKey}
              onChange={e => handleSaveApiKey(e.target.value)}
              placeholder="Paste your AI Studio Gemini API Key (AIzaSy...)"
              className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 font-mono"
            />
            <button
              type="button"
              onClick={() => setShowKeyInput(false)}
              className="px-3 py-1.5 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition"
            >
              Done
            </button>
          </div>
        </div>
      )}

      {/* ERROR BANNER IF LLM CALL RETURNED AN ERROR */}
      {synthesisError && (
        <div className="bg-rose-950/60 border border-rose-500/70 p-3.5 rounded-xl space-y-2 text-rose-200 text-xs animate-shake">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-extrabold text-white">Gemini API Call Failed:</span>
              <p className="font-mono text-[11.5px] text-rose-300 leading-snug">{synthesisError}</p>
            </div>
          </div>
          <div className="pt-2 border-t border-rose-800/40 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-rose-300">
              Enter your active Google Gemini API key from <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer" className="underline font-bold text-amber-300">aistudio.google.com</a> to generate directly:
            </span>
            <button
              type="button"
              onClick={() => setShowKeyInput(true)}
              className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px]"
            >
              Update Key &amp; Retry
            </button>
          </div>
        </div>
      )}

      {/* SECTION 1: DELIVERING HANDS SELECTION BUTTONS */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-extrabold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>1. Select Delivering Hand (Click to activate teeth &amp; gates):</span>
          </label>
          <span className="text-[11px] text-slate-400 font-mono">
            Active Month PD: <strong className="text-amber-300">{toCleanEnglishPlanet(activeDashaHierarchy.pratyantardasha)}</strong>
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
          {availableHands.map(hand => {
            const isSelected = selectedHandKey === hand.rawName;
            return (
              <button
                key={hand.id}
                type="button"
                onClick={() => {
                  setSelectedHandKey(hand.rawName);
                  setSynthesisError(null);
                }}
                className={`p-2.5 rounded-xl border text-left transition cursor-pointer flex flex-col justify-between ${
                  isSelected
                    ? 'bg-gradient-to-b from-purple-900/60 to-slate-950 border-purple-400 text-white ring-2 ring-purple-500/40 shadow-md shadow-purple-950/40'
                    : 'bg-slate-950/70 border-slate-800 text-slate-300 hover:bg-slate-800 hover:border-slate-700'
                }`}
              >
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-[9px] uppercase font-bold px-1.5 py-0.2 rounded ${
                    hand.role === 'PD'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : hand.role === 'AD'
                      ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/40'
                      : 'bg-purple-500/20 text-purple-300 border border-purple-500/40'
                  }`}>
                    {hand.role}
                  </span>
                  {isSelected && <Zap className="w-3 h-3 text-amber-400 fill-current animate-pulse" />}
                </div>
                <span className="text-xs font-black truncate block">
                  {toCleanEnglishPlanet(hand.rawName)}
                </span>
                <span className="text-[9.5px] text-slate-400 truncate block mt-0.5">
                  3 Gates Active
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: DUAL PERSPECTIVE TOGGLE (FROM LAGNA vs. FROM RASHI) */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 p-3 rounded-xl border border-slate-800">
        <div className="flex items-center gap-2">
          <Compass className="w-4 h-4 text-cyan-400" />
          <span className="text-xs font-bold text-slate-200">
            2. Evaluation Perspective:
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setPerspective('lagna')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              perspective === 'lagna'
                ? 'bg-cyan-500 text-slate-950 shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
            title="Focus on physical anatomy, Lagna houses, scars, bodily symptoms, and structural reality"
          >
            From Lagna (Physical Body &amp; Anatomy)
          </button>
          <button
            type="button"
            onClick={() => setPerspective('rashi')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              perspective === 'rashi'
                ? 'bg-amber-500 text-slate-950 shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
            title="Focus on Moon perspective, psychological weather, fortune, and emotional fruition"
          >
            From Janma Rashi (Mind &amp; Fortune)
          </button>
          <button
            type="button"
            onClick={() => setPerspective('dual')}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition cursor-pointer ${
              perspective === 'dual'
                ? 'bg-purple-500 text-white shadow'
                : 'bg-slate-900 text-slate-400 hover:text-white border border-slate-800'
            }`}
            title="Complete Parashara dual synthesis combining Lagna physical reality and Moon experiential reality"
          >
            Dual Combined (Lagna + Rashi)
          </button>
        </div>
      </div>

      {/* SECTION 3: THE 3 NAKSHATRA ENTRY GATES OF THIS DELIVERING HAND */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <label className="text-xs font-extrabold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>3. Three Nakshatra Entry Gates for {toCleanEnglishPlanet(selectedHandKey)}:</span>
          </label>
          <span className="text-[11px] text-slate-400">
            Planetary passages across these gates manufacture the events
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {gateDetails.map((gate, idx) => (
            <div
              key={gate.nakshatraName}
              className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2 hover:border-purple-500/40 transition"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 font-mono text-xs flex items-center justify-center font-bold">
                    {idx + 1}
                  </span>
                  <span className="text-sm font-extrabold text-white">
                    {gate.nakshatraName}
                  </span>
                </div>
                <span className="text-xs font-bold text-amber-300 bg-amber-950/40 px-2 py-0.5 rounded border border-amber-800/50">
                  {gate.rashiName.split(' ')[0]}
                </span>
              </div>

              {/* Dual House Coordinates */}
              <div className="grid grid-cols-2 gap-1.5 text-center text-xs">
                <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">From Lagna</span>
                  <span className="font-extrabold text-cyan-300">House {gate.houseFromLagna}</span>
                </div>
                <div className="bg-slate-900 p-1.5 rounded-lg border border-slate-800">
                  <span className="text-[10px] text-slate-400 block font-semibold">From Rashi</span>
                  <span className="font-extrabold text-amber-300">House {gate.houseFromRashi}</span>
                </div>
              </div>

              {/* Anatomy & Significations */}
              <div className="text-[11px] text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800/70 space-y-0.5">
                <span className="font-bold text-purple-300 block">Anatomical Seat:</span>
                <p className="text-slate-300 leading-tight">{gate.anatomicalSeat}</p>
              </div>

              {/* Transit Occupants / Passages */}
              <div className="text-[11px] pt-1 border-t border-slate-800/80 space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-slate-400 font-semibold">Transits Inside Gate:</span>
                  <span className="font-bold text-white">
                    {gate.transitingPlanets.length > 0 ? (
                      <span className="text-rose-400 font-mono">{gate.transitingPlanets.join(', ')}</span>
                    ) : (
                      <span className="text-slate-500 italic">None</span>
                    )}
                  </span>
                </div>
                {gate.moonIngressWindow && (
                  <div className="flex items-center justify-between text-[10px] text-amber-300 font-mono">
                    <span>Moon Ingress Trigger:</span>
                    <span>{gate.moonIngressWindow}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* SECTION 4: MANUFACTURED EVENTS (DIRECT FROM LLM - NO HARDCODED PRE-POPULATION) */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-extrabold text-white flex items-center gap-1.5 uppercase tracking-wider">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>4. Manufactured Probable Events ({manufacturedEvents.length} Events):</span>
          </label>
          {lastExecutionTimeMs !== null && (
            <span className="text-[11px] text-emerald-400 font-mono font-semibold">
              ✓ Generated in {(lastExecutionTimeMs / 1000).toFixed(1)}s via {lastSynthesizedModel}
            </span>
          )}
        </div>

        {/* LOADING STATE */}
        {isSynthesizing && (
          <div className="bg-slate-950 border-2 border-dashed border-purple-500/50 rounded-xl p-8 text-center space-y-3 animate-pulse">
            <RefreshCw className="w-8 h-8 text-purple-400 animate-spin mx-auto" />
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-white">
                Contacting Google Gemini ({synthesisSeconds}s)...
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Synthesizing entry gate passages, Lagna somatic seats, and Rashi fortune conditions for Delivering Hand: <strong className="text-purple-300">{toCleanEnglishPlanet(selectedHandKey)}</strong>.
              </p>
            </div>
          </div>
        )}

        {/* EMPTY STATE: INVITING ACTION TO MANUFACTURE VIA GEMINI */}
        {!isSynthesizing && manufacturedEvents.length === 0 && (
          <div className="bg-slate-950 border border-slate-800 rounded-xl p-8 text-center space-y-4">
            <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 text-purple-400 flex items-center justify-center mx-auto">
              <Sparkles className="w-6 h-6 animate-pulse" />
            </div>
            <div className="space-y-1 max-w-lg mx-auto">
              <h4 className="text-sm font-bold text-white">
                Ready to Manufacture Events for {toCleanEnglishPlanet(selectedHandKey)}
              </h4>
              <p className="text-xs text-slate-400">
                The 3 Nakshatra entry gates are set. Click the button below to send the chart alignment to Google Gemini and generate the authentic list of manufactured events.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSynthesizeEvents}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs transition shadow-lg shadow-purple-600/30 cursor-pointer active:scale-95"
            >
              <Zap className="w-4 h-4 fill-current text-amber-300" />
              <span>Manufacture Events via Google Gemini</span>
            </button>
          </div>
        )}

        {/* LIST OF EVENTS GENERATED BY LLM */}
        {!isSynthesizing && manufacturedEvents.length > 0 && (
          <div className="space-y-3">
            {manufacturedEvents.map((event, idx) => (
              <div
                key={event.id}
                className={`p-4 rounded-xl border transition space-y-2.5 ${
                  event.isHighProbability
                    ? 'bg-slate-950 border-purple-500/50 shadow-md shadow-purple-950/20'
                    : 'bg-slate-950/70 border-slate-800'
                }`}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold text-slate-400">
                      Event {idx + 1}.
                    </span>
                    <h4 className="text-sm font-extrabold text-white">
                      {event.title}
                    </h4>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Optional Portfolio Tag */}
                    {event.portfolio && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                        {event.portfolio}
                      </span>
                    )}

                    {/* Probability Score Badge */}
                    <span className={`text-xs font-black px-2.5 py-0.5 rounded-lg border font-mono flex items-center gap-1 ${
                      event.probabilityScore >= 70
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : event.probabilityScore >= 50
                        ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                        : 'bg-slate-800 text-slate-300 border-slate-700'
                    }`}>
                      <TrendingUp className="w-3 h-3" />
                      <span>{event.probabilityScore}% Probable</span>
                    </span>
                  </div>
                </div>

                {/* 1-2 LINE MANIFESTATION NARRATIVE */}
                <p className="text-xs sm:text-[13px] text-slate-200 leading-relaxed font-medium bg-slate-900/70 p-3 rounded-lg border border-slate-800">
                  {event.narrative}
                </p>

                {/* Astrological Gate Trigger */}
                {event.gateTrigger && (
                  <div className="text-[11px] text-slate-400 pt-0.5">
                    <strong className="text-purple-300">Trigger Mechanism: </strong>
                    <span>{event.gateTrigger}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* MODAL: RAW PROMPT INSPECTOR (EYE ICON) */}
      {showPromptModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fadeIn">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-4xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-400">
                  <Eye className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-extrabold text-white flex items-center gap-2">
                    <span>Event Manufacturing Engine Prompt Payload</span>
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40">
                      {LLM_PROVIDERS[selectedProvider]?.name || 'Google Gemini Pro'}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Exact string payload transmitted to the LLM engine containing delivering hands, 3 Nakshatra gates, Lagna/Rashi dual coordinates, and transit trigger events.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleCopyPrompt}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-500 hover:bg-purple-400 text-slate-950 font-bold text-xs transition cursor-pointer shadow active:scale-95"
                  title="Copy complete raw prompt to clipboard"
                >
                  {promptCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{promptCopied ? 'Copied!' : 'Copy Prompt'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowPromptModal(false)}
                  className="p-1.5 rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 transition cursor-pointer"
                >
                  &times;
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-auto p-4 bg-slate-950 font-mono text-xs text-slate-200 select-text">
              <pre className="whitespace-pre-wrap leading-relaxed">{promptPayload}</pre>
            </div>

            <div className="p-3 bg-slate-900 border-t border-slate-800 flex items-center justify-between text-xs text-slate-400">
              <span className="flex items-center gap-1.5 text-purple-300">
                <ShieldCheck className="w-4 h-4 text-emerald-400" />
                <span>Strict Parashara &amp; Nadi Gate Formulation</span>
              </span>
              <button
                type="button"
                onClick={() => setShowPromptModal(false)}
                className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold cursor-pointer"
              >
                Close Inspector
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EventManufacturingEngine;
