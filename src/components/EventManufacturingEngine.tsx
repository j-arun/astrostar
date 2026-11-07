import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  Zap,
  Sparkles,
  Compass,
  Moon,
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
  CheckCircle2,
  XCircle,
  Cpu
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

export type GatePerspective = 'lagna' | 'rashi' | 'combined';

export interface ManufacturedEventItem {
  id: string;
  title: string;
  narrative: string; // 1-2 line crisp narrative of what is going to happen
  probabilityScore: number; // 0..100
  isHighProbability: boolean; // >= 60%
  portfolio?: string; // Work, Life, Health, Money, Friends, Love, Trip
  gateTrigger?: string; // Specific Nakshatra gate & transit trigger
}

export interface ActiveTransitGrahaDetail {
  name: string;
  key: string;
  type: 'transit_current' | 'monthly_passage' | 'natal';
  passageWindow?: string;
  isExalted?: boolean;
}

export interface NakshatraGateInfo {
  nakshatraName: string;
  rashiIndex: number; // 1..12
  rashiName: string;
  houseFromLagna: number;
  houseFromRashi: number;
  anatomicalSeat: string;
  significations: string;
  activeGrahasInGate: ActiveTransitGrahaDetail[];
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
  monthlyGrahaSpans?: any[];
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
  monthlyMoonSpans,
  monthlyGrahaSpans
}) => {
  // 1. Available Delivering Hands for Selection (Including Mercury PD, Saturn PD, Saturn AD, Venus MD, etc.)
  const availableHands = useMemo(() => {
    const list: { id: string; label: string; subLabel: string; role: 'PD' | 'AD' | 'MD'; rawName: string }[] = [];
    
    // Active PD (Active Month Teeth)
    const pdKey = normalizeLordKey(activeDashaHierarchy.pratyantardasha);
    list.push({
      id: `PD-${pdKey}`,
      label: `${toCleanEnglishPlanet(pdKey)} PD`,
      subLabel: 'Active Teeth',
      role: 'PD',
      rawName: pdKey
    });

    // Previous Saral Delivery / Complementary Key Hand: Saturn PD
    const saturnKey = 'Saturn (Sani)';
    if (!list.some(item => item.id === `PD-${saturnKey}`)) {
      list.push({
        id: `PD-${saturnKey}`,
        label: `${toCleanEnglishPlanet(saturnKey)} PD`,
        subLabel: 'Previous Saral Hand',
        role: 'PD',
        rawName: saturnKey
      });
    }

    // AD (Delivering Antardasha)
    const adKey = normalizeLordKey(activeDashaHierarchy.antardasha);
    if (!list.some(item => item.rawName === adKey && item.role === 'AD')) {
      list.push({
        id: `AD-${adKey}`,
        label: `${toCleanEnglishPlanet(adKey)} AD`,
        subLabel: 'Delivering Hand',
        role: 'AD',
        rawName: adKey
      });
    }

    // MD (Mahadasha Canvas)
    const mdKey = normalizeLordKey(activeDashaHierarchy.mahadasha);
    if (!list.some(item => item.rawName === mdKey && item.role === 'MD')) {
      list.push({
        id: `MD-${mdKey}`,
        label: `${toCleanEnglishPlanet(mdKey)} MD`,
        subLabel: 'Dasha Lord',
        role: 'MD',
        rawName: mdKey
      });
    }

    // Complementary key lords so user can test any hand
    const remainingLords = ['Venus (Sukra)', 'Mars (Sevvai)', 'Jupiter (Guru)', 'Rahu', 'Sun (Surya)', 'Moon (Chandra)', 'Ketu'];
    for (const lord of remainingLords) {
      if (!list.some(item => item.rawName === lord)) {
        list.push({
          id: `GRAHA-${lord}`,
          label: `${toCleanEnglishPlanet(lord)}`,
          subLabel: '3 Gates',
          role: 'PD',
          rawName: lord
        });
      }
    }

    return list;
  }, [activeDashaHierarchy]);

  // Selected Delivering Hand
  const [selectedHandKey, setSelectedHandKey] = useState<string>(() => {
    return normalizeLordKey(activeDashaHierarchy.pratyantardasha) || 'Mercury (Budha)';
  });

  // Per-Gate Evaluation Perspective State: Gate 0, Gate 1, Gate 2
  // Options: 'lagna' | 'rashi' | 'combined'
  const [gatePerspectives, setGatePerspectives] = useState<Record<number, GatePerspective>>({
    0: 'combined',
    1: 'combined',
    2: 'combined'
  });

  const handleSetGatePerspective = (gateIdx: number, mode: GatePerspective) => {
    setGatePerspectives(prev => ({
      ...prev,
      [gateIdx]: mode
    }));
  };

  // Model & Provider Selection (Google Gemini / Anthropic Claude / Local Qwen)
  const [selectedProvider, setSelectedProvider] = useState<LLMProviderId>('gemini_pro');
  
  // API Keys: Both Google Gemini & Anthropic Claude
  const [geminiApiKey, setGeminiApiKey] = useState<string>(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('astro_gemini_api_key') : '') || '';
  });
  const [anthropicApiKey, setAnthropicApiKey] = useState<string>(() => {
    return (typeof window !== 'undefined' ? localStorage.getItem('astro_anthropic_api_key') : '') || '';
  });
  const [showKeyDrawer, setShowKeyDrawer] = useState<boolean>(false);

  // Active Key for current selected provider
  const isCurrentProviderKeyConfigured = useMemo(() => {
    if (selectedProvider === 'gemini_pro') return !!geminiApiKey.trim();
    if (selectedProvider === 'claude_sonnet' || selectedProvider === 'claude_haiku') return !!anthropicApiKey.trim();
    return true; // local qwen does not need cloud key
  }, [selectedProvider, geminiApiKey, anthropicApiKey]);

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

  // 2. Compute the 3 Nakshatra Entry Gates with COMPLETE Planetary Passages (Transit + Spans + Natal)
  const gateDetails = useMemo<NakshatraGateInfo[]>(() => {
    const lordMeta = LORD_NAKSHATRA_GATES[selectedHandKey] || LORD_NAKSHATRA_GATES['Mercury (Budha)'];
    
    return lordMeta.nakshatras.map((nakName, idx) => {
      const rIdx = lordMeta.rashis[idx];
      const rMeta = RASHI_LIST_META.find(r => r.index === rIdx) || RASHI_LIST_META[0];
      const hLagna = ((rIdx - natalLagnaIdx + 12) % 12) + 1;
      const hRashi = ((rIdx - natalRashiIdx + 12) % 12) + 1;

      const grahaMap = new Map<string, ActiveTransitGrahaDetail>();

      // A. Match Current Transits in this sign (from transitPlacements)
      for (const t of (transitPlacements || [])) {
        const signMatch = (
          t.transit_rashi_index === rIdx ||
          t.signIndex === rIdx ||
          t.sign_index === rIdx ||
          t.relative_to_natal_lagna?.house_number === hLagna
        );
        if (signMatch) {
          const gKey = t.graha_key || t.graha_name;
          const cleanName = toCleanEnglishPlanet(gKey);
          grahaMap.set(cleanName, {
            name: cleanName,
            key: gKey,
            type: 'transit_current',
            passageWindow: 'Active in House'
          });
        }
      }

      // B. Match Monthly Graha Spans passing through this sign during the selected month
      for (const span of (monthlyGrahaSpans || [])) {
        if (span.sign_index === rIdx || span.signIndex === rIdx) {
          const cleanName = toCleanEnglishPlanet(span.graha_key || span.graha_name);
          const windowStr = `${MONTH_NAMES[selectedMonth].slice(0, 3)} ${span.start_day}–${span.end_day}`;
          const existing = grahaMap.get(cleanName);
          if (existing) {
            existing.passageWindow = windowStr;
            existing.isExalted = span.is_exalted;
          } else {
            grahaMap.set(cleanName, {
              name: cleanName,
              key: span.graha_key,
              type: 'monthly_passage',
              passageWindow: windowStr,
              isExalted: span.is_exalted
            });
          }
        }
      }

      // C. Match Natal Occupants situated at birth in this sign (from flattenedD1)
      for (const np of (flattenedD1 || [])) {
        const rashiNorm = (np.rashi_name || '').toLowerCase();
        const signNorm = (rMeta.eng || '').toLowerCase();
        if (signNorm.includes(rashiNorm) || rashiNorm.includes(signNorm.slice(0, 4))) {
          const cleanName = toCleanEnglishPlanet(np.body_name);
          const existing = grahaMap.get(cleanName);
          if (existing) {
            existing.passageWindow = `${existing.passageWindow || 'Transit'} + Natal Seat`;
          } else {
            grahaMap.set(cleanName, {
              name: `${cleanName} (Natal)`,
              key: np.body_name,
              type: 'natal',
              passageWindow: 'Fixed Natal Position'
            });
          }
        }
      }

      // D. Find Moon ingress dates for this sign
      const moonSpan = (monthlyMoonSpans || []).find((m: any) => m.signIndex === rIdx || m.houseNumber === hLagna);
      const moonIngressWindow = moonSpan ? `${MONTH_NAMES[selectedMonth].slice(0, 3)} ${moonSpan.startDay}–${moonSpan.endDay}` : undefined;

      return {
        nakshatraName: nakName,
        rashiIndex: rIdx,
        rashiName: rMeta.eng,
        houseFromLagna: hLagna,
        houseFromRashi: hRashi,
        anatomicalSeat: lordMeta.anatomies[idx] || 'Vital Organs & Nerves',
        significations: lordMeta.signs[0] || 'Karmic fruition gate',
        activeGrahasInGate: Array.from(grahaMap.values()),
        moonIngressWindow
      };
    });
  }, [selectedHandKey, natalLagnaIdx, natalRashiIdx, transitPlacements, monthlyGrahaSpans, flattenedD1, monthlyMoonSpans, selectedMonth]);

  // 3. Complete Raw Prompt Payload for LLM Execution with Per-Gate Perspectives
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

[THE THREE NAKSHATRA ENTRY GATES FOR DELIVERING HAND: ${cleanHand}]
${gateDetails.map((g, idx) => {
  const pMode = gatePerspectives[idx] || 'combined';
  const pLabel = pMode === 'lagna'
    ? 'EVALUATED FROM LAGNA (Physical Body, Anatomy, Somatic Scars & Vulnerability)'
    : pMode === 'rashi'
    ? 'EVALUATED FROM JANMA RASHI (Psychological Fruition, Mental Perception & Fortunes)'
    : 'COMBINED DUAL SYNTHESIS (Lagna Somatic Vulnerability + Moon Experiential Fruition)';

  const grahasStr = g.activeGrahasInGate.length > 0
    ? g.activeGrahasInGate.map(gr => `${gr.name} [${gr.passageWindow || 'In Gate'}]`).join(', ')
    : 'None (Clear Gate)';

  return `Gate ${idx + 1}: ${g.nakshatraName} in ${g.rashiName}
- Chosen Evaluation Perspective: ${pLabel}
- House from Lagna: House ${g.houseFromLagna}
- House from Janma Rashi (Moon): House ${g.houseFromRashi}
- Anatomical Seat & Karakatwa: ${g.anatomicalSeat} — ${g.significations}
- Transiting Grahas & People Passing/Crashing in this Gate: ${grahasStr}
- Moon (Chandra) Gate Passage Window: ${g.moonIngressWindow || 'Approx. 2.25-day lunar trigger'}
`;
}).join('\n')}

[CRITICAL PARASHARA REASONING LAWS FOR EVENT MANUFACTURING]
1. The Delivering Hand (${cleanHand}) acts as the executive delivery hand. Its 3 Nakshatras (${gateDetails.map(g => g.nakshatraName).join(', ')}) are the physical gates into the chart.
2. Whenever transiting planets (e.g. Mars, Sun, Venus, Mercury, Jupiter, Saturn, Rahu, Ketu, Moon) pass or crash through that gate, the event MANUFACTURES.
3. Every gate has its chosen evaluation perspective (From Lagna = physical body & anatomy; From Janma = psychological fruition & fortune; Combined = dual synthesis).
4. For example:
   - When multiple grahas (Mars, Venus, Mercury, Jupiter) pass through Ashlesha in Cancer (8th from Lagna, 9th from Moon), acute digestive heat, acid flare-ups, communication bursts, or sleep disturbances manifest.
   - When Saturn/Venus activate 1st-8th houses, scars or existing marks turn into chronic dermatological delays.
5. Manufacture 4 to 6 authentic, specific events that will manifest during this period based on the planets crossing these gates and each gate's chosen perspective.
6. For each event, provide:
   - title: Direct headline of the event
   - narrative: Crisp 1-to-2 line description of the exact physical, financial, or relational manifestation
   - probabilityScore: Realistic integer probability (e.g. 75, 65, 55, 40, 25)
   - portfolio: Assign to one portfolio category from: Work, Life, Health, Money, Friends, Love, Trip
   - gateTrigger: The specific Nakshatra gate, chosen perspective, and planetary transit passage that triggered this event

OUTPUT FORMAT REQUIREMENT:
Return ONLY a valid JSON object matching this schema:
{
  "deliveringHand": "${cleanHand}",
  "events": [
    {
      "id": "evt-1",
      "title": "Specific event title",
      "narrative": "Crisp 1-to-2 line physical or experiential manifestation statement.",
      "probabilityScore": 75,
      "portfolio": "Health | Work | Money | Life | Love | Friends | Trip",
      "gateTrigger": "Nakshatra gate + transit planet passage + evaluation perspective"
    }
  ]
}`;
  }, [selectedMonth, selectedYear, natalLagnaIdx, natalRashiIdx, activeDashaHierarchy, selectedHandKey, gateDetails, gatePerspectives]);

  // Copy prompt helper
  const handleCopyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(promptPayload);
      setPromptCopied(true);
      setTimeout(() => setPromptCopied(false), 2000);
    } catch {}
  };

  // Save custom keys
  const handleSaveGeminiKey = (keyVal: string) => {
    const trimmed = keyVal.trim();
    setGeminiApiKey(trimmed);
    if (typeof window !== 'undefined') {
      localStorage.setItem('astro_gemini_api_key', trimmed);
    }
  };

  const handleSaveAnthropicKey = (keyVal: string) => {
    const trimmed = keyVal.trim();
    setAnthropicApiKey(trimmed);
    if (typeof window !== 'undefined') {
      localStorage.setItem('astro_anthropic_api_key', trimmed);
    }
  };

  // Generic LLM Synthesis Execution supporting Gemini, Claude, and Ollama
  const handleSynthesizeEvents = async () => {
    setIsSynthesizing(true);
    setSynthesisError(null);
    setSynthesisSeconds(0);
    const startMs = Date.now();

    timerRef.current = setInterval(() => {
      setSynthesisSeconds(prev => prev + 1);
    }, 1000);

    try {
      let endpoint = '/api/llm/gemini';
      let payloadBody: any = { prompt: promptPayload };

      if (selectedProvider === 'claude_sonnet' || selectedProvider === 'claude_haiku') {
        endpoint = '/api/llm/claude';
        const activeClaudeKey = (
          anthropicApiKey ||
          (typeof window !== 'undefined' ? localStorage.getItem('astro_anthropic_api_key') : '') ||
          ''
        ).trim();

        const activeClaudeModel = (
          (typeof window !== 'undefined' ? localStorage.getItem('astro_anthropic_model') : '') ||
          'claude-sonnet-5-5'
        );

        payloadBody = {
          prompt: promptPayload,
          model: activeClaudeModel,
          apiKey: activeClaudeKey || undefined
        };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(activeClaudeKey ? { 'x-api-key': activeClaudeKey } : {})
          },
          body: JSON.stringify(payloadBody)
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
          const errorMsg = data.error || `HTTP ${res.status}: Failed to reach Claude endpoint`;
          setSynthesisError(errorMsg);
          throw new Error(errorMsg);
        }

        const rawLlmText = data.text || '';
        const parsedEvents = parseEventsFromLlmResponse(rawLlmText);
        if (parsedEvents.length === 0) {
          throw new Error('Claude responded, but returned an unparseable event list format. Inspect the prompt payload.');
        }

        setManufacturedEvents(parsedEvents);
        setLastSynthesizedModel(data.model || activeClaudeModel);
        setLastExecutionTimeMs(Date.now() - startMs);

      } else {
        // Google Gemini or Local Qwen
        endpoint = '/api/llm/gemini';
        const activeGeminiKey = (
          geminiApiKey ||
          (typeof window !== 'undefined' ? localStorage.getItem('astro_gemini_api_key') : '') ||
          ''
        ).trim();

        const modelToUse = getPreferredGeminiModel();

        payloadBody = {
          prompt: promptPayload,
          model: modelToUse,
          apiKey: activeGeminiKey || undefined
        };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(activeGeminiKey ? { 'x-goog-api-key': activeGeminiKey, 'x-api-key': activeGeminiKey } : {})
          },
          body: JSON.stringify(payloadBody)
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok || data.error) {
          const errorMsg = data.error || `HTTP ${res.status}: Failed to reach Gemini endpoint`;
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
      }
    } catch (err: any) {
      console.error('Event Manufacturing Engine Synthesis Error:', err);
    } finally {
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
      setIsSynthesizing(false);
    }
  };

  const activeProviderName = useMemo(() => {
    if (selectedProvider === 'gemini_pro') return 'Gemini';
    if (selectedProvider === 'claude_sonnet') return 'Claude Sonnet';
    if (selectedProvider === 'local_qwen') return 'Qwen';
    return 'LLM';
  }, [selectedProvider]);

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
                Delivering Hand ({toCleanEnglishPlanet(selectedHandKey)}) + 3 Entry Gates + Graha Ingress Passages = Direct Event Manufacture in LLM.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Dual API Keys toggle */}
          <button
            type="button"
            onClick={() => setShowKeyDrawer(!showKeyDrawer)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer ${
              isCurrentProviderKeyConfigured
                ? 'bg-emerald-950/40 border-emerald-500/50 text-emerald-300 hover:bg-emerald-900/40'
                : 'bg-slate-950 border-amber-500/50 text-amber-300 hover:bg-slate-800'
            }`}
            title="Configure or verify Google Gemini & Anthropic Claude API keys"
          >
            <Key className="w-3.5 h-3.5" />
            <span>{isCurrentProviderKeyConfigured ? `${activeProviderName} Key Ready` : `Setup ${activeProviderName} Key`}</span>
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

          {/* Primary Action Button: MANUFACTURE EVENTS IN LLM */}
          <button
            type="button"
            onClick={handleSynthesizeEvents}
            disabled={isSynthesizing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white font-extrabold text-xs transition shadow-lg shadow-purple-600/30 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSynthesizing ? 'animate-spin' : ''}`} />
            <span>{isSynthesizing ? `Synthesizing via ${activeProviderName} (${synthesisSeconds}s)...` : 'Manufacture Events in LLM'}</span>
          </button>
        </div>
      </div>

      {/* DUAL API KEYS DRAWER (GEMINI & CLAUDE) */}
      {showKeyDrawer && (
        <div className="bg-slate-950 p-4 rounded-xl border border-purple-500/30 space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between pb-2 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <Key className="w-4 h-4 text-amber-400" />
              <span className="text-xs font-extrabold text-white">LLM API Key Settings</span>
            </div>
            <button
              type="button"
              onClick={() => setShowKeyDrawer(false)}
              className="text-xs text-slate-400 hover:text-white px-2 py-0.5 rounded bg-slate-900"
            >
              Close
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* 1. Google Gemini Key */}
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-cyan-300 flex items-center gap-1">
                  <span>Google Gemini API Key:</span>
                  {geminiApiKey ? <Check className="w-3 h-3 text-emerald-400" /> : <AlertTriangle className="w-3 h-3 text-amber-400" />}
                </span>
                <a
                  href="https://aistudio.google.com/apikey"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-amber-400 hover:underline"
                >
                  Get key &rarr;
                </a>
              </div>
              <input
                type="password"
                value={geminiApiKey}
                onChange={e => handleSaveGeminiKey(e.target.value)}
                placeholder="AIzaSy... (Gemini key stored in browser)"
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 font-mono"
              />
              <span className="text-[10px] text-slate-500 block">
                {geminiApiKey ? '✓ Stored in browser localStorage' : 'No key set — uses default service environment'}
              </span>
            </div>

            {/* 2. Anthropic Claude Key */}
            <div className="bg-slate-900/80 p-3 rounded-lg border border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-300 flex items-center gap-1">
                  <span>Anthropic Claude API Key:</span>
                  {anthropicApiKey ? <Check className="w-3 h-3 text-emerald-400" /> : <AlertTriangle className="w-3 h-3 text-amber-400" />}
                </span>
                <a
                  href="https://console.anthropic.com/settings/keys"
                  target="_blank"
                  rel="noreferrer"
                  className="text-[10px] text-amber-400 hover:underline"
                >
                  Get key &rarr;
                </a>
              </div>
              <input
                type="password"
                value={anthropicApiKey}
                onChange={e => handleSaveAnthropicKey(e.target.value)}
                placeholder="sk-ant-... (Claude key stored in browser)"
                className="w-full bg-slate-950 border border-slate-700 rounded px-2.5 py-1 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-purple-400 font-mono"
              />
              <span className="text-[10px] text-slate-500 block">
                {anthropicApiKey ? '✓ Stored in browser localStorage' : 'No key set — uses default server key if configured'}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ERROR BANNER IF LLM CALL RETURNED AN ERROR */}
      {synthesisError && (
        <div className="bg-rose-950/60 border border-rose-500/70 p-3.5 rounded-xl space-y-2 text-rose-200 text-xs animate-shake">
          <div className="flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <span className="font-extrabold text-white">{activeProviderName} Generation Error:</span>
              <p className="font-mono text-[11.5px] text-rose-300 leading-snug">{synthesisError}</p>
            </div>
          </div>
          <div className="pt-2 border-t border-rose-800/40 flex flex-wrap items-center justify-between gap-2">
            <span className="text-[11px] text-rose-300">
              Verify your API key or active balance, or configure keys directly:
            </span>
            <button
              type="button"
              onClick={() => setShowKeyDrawer(true)}
              className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px]"
            >
              Open Key Settings
            </button>
          </div>
        </div>
      )}

      {/* SECTION 1: DELIVERING HANDS SELECTION BUTTONS */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-extrabold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>1. Select Delivering Hand (Saral Delivery &amp; Month Teeth):</span>
          </label>
          <div className="flex items-center gap-2 text-[11px] text-slate-400 font-mono">
            <span>Teeth: <strong className="text-amber-300">{toCleanEnglishPlanet(activeDashaHierarchy.pratyantardasha)} PD</strong></span>
            <span className="text-slate-600">&bull;</span>
            <span>Delivery: <strong className="text-cyan-300">{toCleanEnglishPlanet(activeDashaHierarchy.antardasha)} AD</strong></span>
          </div>
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
                  {hand.label}
                </span>
                <span className="text-[9px] text-slate-400 truncate block mt-0.5">
                  {hand.subLabel}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SECTION 2: THREE NAKSHATRA ENTRY GATES WITH ICON-BASED PERSPECTIVE SWITCHES */}
      <div className="space-y-2.5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-extrabold text-slate-200 flex items-center gap-1.5 uppercase tracking-wider">
            <Layers className="w-3.5 h-3.5 text-purple-400" />
            <span>2. Three Nakshatra Entry Gates for {toCleanEnglishPlanet(selectedHandKey)}:</span>
          </label>
          <span className="text-[11px] text-purple-300">
            Switch perspectives with icons: <strong className="text-cyan-300">Asc</strong> (Lagna) &bull; <strong className="text-amber-300">Moon</strong> (Janma) &bull; <strong className="text-purple-300">Both</strong> (Combined)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {gateDetails.map((gate, idx) => {
            const currentGatePerspective = gatePerspectives[idx] || 'combined';

            return (
              <div
                key={gate.nakshatraName}
                className="bg-slate-950 border border-slate-800 rounded-xl p-3.5 space-y-2.5 hover:border-purple-500/40 transition flex flex-col justify-between"
              >
                <div className="space-y-2">
                  {/* Gate Title & Rashi */}
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
                      <span className="text-[10px] text-slate-400 block font-semibold">From Janma</span>
                      <span className="font-extrabold text-amber-300">House {gate.houseFromRashi}</span>
                    </div>
                  </div>

                  {/* Anatomy & Significations */}
                  <div className="text-[11px] text-slate-300 bg-slate-900/60 p-2 rounded-lg border border-slate-800/70 space-y-0.5">
                    <span className="font-bold text-purple-300 block text-[10.5px]">Anatomical Seat:</span>
                    <p className="text-slate-300 leading-tight">{gate.anatomicalSeat}</p>
                  </div>

                  {/* ALL TRANSITING GRAHAS PASSING THROUGH / CRASHED IN THIS GATE */}
                  <div className="text-[11px] pt-1 border-t border-slate-800/80 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 font-semibold text-[10.5px]">
                        Grahas Active in Gate ({gate.activeGrahasInGate.length}):
                      </span>
                      {gate.activeGrahasInGate.length > 0 ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-500/20 text-rose-300 border border-rose-500/40">
                          Active Ingress
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500 italic">Clear Gate</span>
                      )}
                    </div>

                    {gate.activeGrahasInGate.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {gate.activeGrahasInGate.map(gr => (
                          <span
                            key={gr.name}
                            className={`px-1.5 py-0.5 rounded text-[10px] font-bold border flex items-center gap-1 ${
                              gr.type === 'natal'
                                ? 'bg-slate-800 border-slate-600 text-slate-300'
                                : gr.isExalted
                                ? 'bg-amber-950/80 border-amber-500/70 text-amber-200'
                                : 'bg-gradient-to-r from-rose-950/80 to-purple-950/80 border-rose-500/50 text-rose-200'
                            }`}
                            title={`${gr.name}: ${gr.passageWindow || 'In Gate'}`}
                          >
                            <span className="text-amber-400 text-[8px]">{gr.isExalted ? '★' : '•'}</span>
                            <span>{gr.name}</span>
                            {gr.passageWindow && (
                              <span className="text-[8.5px] opacity-75 font-mono">
                                ({gr.passageWindow.replace(`${MONTH_NAMES[selectedMonth].slice(0, 3)} `, '')})
                              </span>
                            )}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="text-[10.5px] text-slate-500 italic">
                        No planets currently occupying this sign
                      </p>
                    )}

                    {/* Moon Ingress Window */}
                    {gate.moonIngressWindow && (
                      <div className="flex items-center justify-between text-[10px] text-amber-300 font-mono bg-amber-950/20 px-2 py-0.5 rounded border border-amber-900/30">
                        <span>Moon Trigger:</span>
                        <span>{gate.moonIngressWindow}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* COMPACT SEGMENTED ICON SWITCH: [Asc] [Moon] [Asc + Moon] */}
                <div className="pt-2.5 border-t border-slate-800/80 flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center gap-1">
                    <span>Perspective:</span>
                  </span>

                  <div className="inline-flex items-center p-0.5 rounded-lg bg-slate-900 border border-slate-800 shadow-inner">
                    {/* Switch 1: Ascendant (Lagna) */}
                    <button
                      type="button"
                      onClick={() => handleSetGatePerspective(idx, 'lagna')}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                        currentGatePerspective === 'lagna'
                          ? 'bg-cyan-500 text-slate-950 font-black shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="From Lagna (Ascendant - Physical Body, Anatomy & Scars)"
                    >
                      <Compass className="w-3 h-3" />
                      <span>Asc</span>
                    </button>

                    {/* Switch 2: Janma (Moon) */}
                    <button
                      type="button"
                      onClick={() => handleSetGatePerspective(idx, 'rashi')}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-1 transition cursor-pointer ${
                        currentGatePerspective === 'rashi'
                          ? 'bg-amber-500 text-slate-950 font-black shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="From Janma Rashi (Moon - Psychological Weather & Fortune)"
                    >
                      <Moon className="w-3 h-3 fill-current" />
                      <span>Moon</span>
                    </button>

                    {/* Switch 3: Combined (Both Ascendant + Moon) */}
                    <button
                      type="button"
                      onClick={() => handleSetGatePerspective(idx, 'combined')}
                      className={`px-2 py-1 rounded-md text-[10px] font-bold flex items-center gap-0.5 transition cursor-pointer ${
                        currentGatePerspective === 'combined'
                          ? 'bg-purple-500 text-white font-black shadow'
                          : 'text-slate-400 hover:text-slate-200'
                      }`}
                      title="Combined Dual Perspective (Ascendant + Moon)"
                    >
                      <Compass className="w-3 h-3" />
                      <span className="text-[8.5px] font-black">+</span>
                      <Moon className="w-3 h-3 fill-current" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* SECTION 3: MANUFACTURED EVENTS (DIRECT FROM LLM - NO HARDCODED PRE-POPULATION) */}
      <div className="space-y-3 pt-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label className="text-xs font-extrabold text-white flex items-center gap-1.5 uppercase tracking-wider">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>3. Manufactured Probable Events ({manufacturedEvents.length} Events):</span>
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
                Contacting {activeProviderName} ({synthesisSeconds}s)...
              </h4>
              <p className="text-xs text-slate-400 max-w-md mx-auto">
                Synthesizing entry gate passages, Lagna somatic seats, and Rashi fortune conditions for Delivering Hand: <strong className="text-purple-300">{toCleanEnglishPlanet(selectedHandKey)}</strong> with customized icon perspectives.
              </p>
            </div>
          </div>
        )}

        {/* EMPTY STATE: INVITING ACTION TO MANUFACTURE IN LLM */}
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
                The 3 Nakshatra entry gates, their transiting grahas, and your selected per-gate icon switches are set. Click below to synthesize and manifest the probable events in {activeProviderName}.
              </p>
            </div>
            <button
              type="button"
              onClick={handleSynthesizeEvents}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-extrabold text-xs transition shadow-lg shadow-purple-600/30 cursor-pointer active:scale-95"
            >
              <Zap className="w-4 h-4 fill-current text-amber-300" />
              <span>Manufacture Events in LLM</span>
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
                      {LLM_PROVIDERS[selectedProvider]?.name || activeProviderName}
                    </span>
                  </h3>
                  <p className="text-xs text-slate-400">
                    Exact string payload transmitted to the LLM engine containing delivering hands, 3 Nakshatra gates, per-gate Lagna/Rashi icon switch states, and all transiting grahas.
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
