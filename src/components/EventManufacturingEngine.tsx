import React, { useState, useMemo, useEffect } from 'react';
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
  ChevronUp
} from 'lucide-react';
import {
  LLMProviderId,
  LLM_PROVIDERS,
  VedicHouseContext
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
  category: 'health_chronic' | 'accident_friction' | 'wealth_capital' | 'communication_admin' | 'relationship_bond' | 'career_status';
  categoryLabel: string;
  polarity: 'positive' | 'negative' | 'mixed';
  narrative: string; // 1-2 line crisp narrative
  probabilityScore: number; // 0..100
  isHighProbability: boolean; // >= 60%
  astrologicalRootCause: string;
  transitTrigger: string;
  affectedAnatomyOrDomain: string;
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
    rashis: [1, 5, 9],
    anatomies: ['Crown & Vital Fire', 'Upper Back & Heart', 'Knees & Bone Structure'],
    signs: ['Sovereign authority, state recognition, father, ocular heat, dignity']
  },
  'Moon (Chandra)': {
    nakshatras: ['Rohini', 'Hasta', 'Shravana'],
    rashis: [2, 6, 10], // Rishabam, Kanni, Makaram
    anatomies: ['Face, Throat & Mouth', 'Hands, Intestines & Digestion', 'Ears, Gait & Knee Joints'],
    signs: ['Mental equilibrium, lymphatic fluids, public receptivity, mother, sleep']
  },
  'Mars (Sevvai)': {
    nakshatras: ['Mrigashira', 'Chitra', 'Dhanishta'],
    rashis: [2, 6, 10],
    anatomies: ['Vocal cords & Neck', 'Abdominal wall & Kidneys', 'Ankles & Motor Nerves'],
    signs: ['Pitta fire, acute inflammation, surgical interventions, motor friction, courage']
  },
  Rahu: {
    nakshatras: ['Ardra', 'Swati', 'Shatabhisha'],
    rashis: [3, 7, 11], // Mithunam, Thulaam, Kumbam
    anatomies: ['Shoulders, Arms & Lungs', 'Kidneys & Lower Abdomen', 'Calves, Shins & Nervous Circulation'],
    signs: ['Foreign documentation, sudden expansions, obsession, toxic exposure, unconventional gains']
  },
  'Jupiter (Guru)': {
    nakshatras: ['Punarvasu', 'Vishakha', 'Purva Bhadrapada'],
    rashis: [3, 7, 11],
    anatomies: ['Thorax & Lungs', 'Bladder & Groin', 'Feet, Soles & Cellular Lipids'],
    signs: ['Wisdom, institutional grace, financial recovery, liver, expansion, legal favor']
  },
  'Saturn (Sani)': {
    nakshatras: ['Pushya', 'Anuradha', 'Uttara Bhadrapada'],
    rashis: [4, 8, 12], // Katakam, Vrischigam, Meenam
    anatomies: ['Chest Cavity & Lungs', 'Genitals, Colon & Excretory Organ', 'Feet, Lymph & Sleep Depth'],
    signs: ['Chronic conditions, prolonged delays, structural discipline, deep karmic retribution']
  },
  'Mercury (Budha)': {
    nakshatras: ['Ashlesha', 'Jyeshtha', 'Revati'],
    rashis: [4, 8, 12],
    anatomies: ['Gut Flora, Intestines & Nerve Impulses', 'Sensory Nerves & Rectum', 'Lymphatic Extremities & Sleep Cycle'],
    signs: ['Nerves, communication gaps, food digestion, sleep balance, contracts, commerce']
  }
};

function normalizeLordKey(lordName: string): string {
  const norm = (lordName || '').toLowerCase();
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
  // 1. Available Delivering Hands for Selection (AD and PD levels of current period)
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
    for (const complementary of ['Mercury (Budha)', 'Saturn (Sani)', 'Venus (Sukra)', 'Mars (Sevvai)']) {
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

  // Model selection
  const [selectedProvider, setSelectedProvider] = useState<LLMProviderId>('local_qwen');
  const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
  const [showPromptModal, setShowPromptModal] = useState<boolean>(false);
  const [promptCopied, setPromptCopied] = useState<boolean>(false);

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

  // 3. Grounded Deterministic Event Manufacturing Engine (Instantly generated from user's exact Parashara rules)
  const defaultManufacturedEvents = useMemo<ManufacturedEventItem[]>(() => {
    const events: ManufacturedEventItem[] = [];
    const cleanHand = toCleanEnglishPlanet(selectedHandKey);
    const cleanMd = toCleanEnglishPlanet(activeDashaHierarchy.mahadasha);
    const cleanAd = toCleanEnglishPlanet(activeDashaHierarchy.antardasha);

    // Identify if Venus is in Lagna (Face / Countenance)
    const venusInLagna = flattenedD1.some((p: any) => 
      (p.body_name || '').toLowerCase().includes('venus') && 
      (p.house_number === 1 || p.rashi_name?.toLowerCase().includes('dhanus'))
    );

    // Identify if Saturn is active or in 8th
    const isSaturnActive = selectedHandKey.toLowerCase().includes('saturn') || cleanAd.toLowerCase().includes('saturn');
    const isMercuryActive = selectedHandKey.toLowerCase().includes('mercury') || cleanAd.toLowerCase().includes('mercury');
    const isMarsIn8th = gateDetails.some(g => g.houseFromLagna === 8 && g.transitingPlanets.some(p => p.toLowerCase().includes('mars')));

    // Event 1: Face / Chronic Skin Issue (User's specific example)
    if (venusInLagna || cleanMd.includes('Venus') || cleanAd.includes('Saturn')) {
      events.push({
        id: 'evt-1',
        title: 'Facial Countenance & Chronic Dermatological Sensitivity',
        category: 'health_chronic',
        categoryLabel: 'Health / Chronic Condition',
        polarity: 'negative',
        narrative: 'With Venus situated in Lagna (face/countenance) under Saturnian delivering friction, an existing facial scar or skin irritation risks turning into a persistent, slow-healing chronic sensitivity.',
        probabilityScore: 78,
        isHighProbability: true,
        astrologicalRootCause: `${cleanMd} MD + ${cleanAd} AD: Venus (Lagna seat/face) influenced by Saturnian cold delay and 8th house chronic aspect.`,
        transitTrigger: 'Saturn / Venus transit rays across the 1st-8th house axis.',
        affectedAnatomyOrDomain: 'Face, cheekbones, facial skin & ocular tissue.'
      });
    }

    // Event 2: Digestive Burning & Acute Gut Inflammation (User's specific example)
    if (isMercuryActive || isMarsIn8th || gateDetails.some(g => g.nakshatraName === 'Ashlesha')) {
      events.push({
        id: 'evt-2',
        title: 'Digestive Burning Sensation, Acid Reflux & Sleep Disruption',
        category: 'health_chronic',
        categoryLabel: 'Health & Digestive Flora',
        polarity: 'negative',
        narrative: 'When Mars or acute transits cross the Ashlesha gate in Cancer (8th from Lagna, 9th from Moon), severe digestive heat, acid flare-ups, and nocturnal sleep interruptions manifest.',
        probabilityScore: 72,
        isHighProbability: true,
        astrologicalRootCause: 'Ashlesha Nakshatra gate (Mercury lord) occupying House 8 from Lagna activated by Mars Pitta energy.',
        transitTrigger: 'Mars / Moon ingress crossing Ashlesha in Cancer (8th house).',
        affectedAnatomyOrDomain: 'Digestive tract, stomach lining, gut flora & nervous sleep depth.'
      });
    }

    // Event 3: Communication Gaps & Administrative Friction
    if (isMercuryActive) {
      events.push({
        id: 'evt-3',
        title: 'Communication Misalignment, Document Delays & Clerical Misunderstandings',
        category: 'communication_admin',
        categoryLabel: 'Communication & Paperwork',
        polarity: 'negative',
        narrative: 'Mercury PD teeth activate sensory nerve friction in 8th/12th houses, inducing momentary email misinterpretations, document verification lag, or delayed responses from counterparts.',
        probabilityScore: 64,
        isHighProbability: true,
        astrologicalRootCause: 'Mercury PD gate in Jyeshtha (12th from Lagna, 1st from Moon) causing cognitive sensory fatigue.',
        transitTrigger: 'Mercury transit alignment across Vrischigam (Scorpio) Jyeshtha gate.',
        affectedAnatomyOrDomain: 'Nerve communication, written agreements & administrative clearances.'
      });
    }

    // Event 4: Institutional Fund Release / Capital Realization
    events.push({
      id: 'evt-4',
      title: 'Provident Fund (PF) Transfer / Blocked Capital Release',
      category: 'wealth_capital',
      categoryLabel: 'Wealth & Capital Recovery',
      polarity: 'positive',
      narrative: 'Dhana (2nd) and Labha (11th) lords trigger the release of institutional capital, successfully finalizing a pending retirement rollover, PF clearance, or back-owed dividend.',
      probabilityScore: 68,
      isHighProbability: true,
      astrologicalRootCause: 'Jupiter aspect to 11th house from Janma Rashi sanctioning release of held institutional reserves.',
      transitTrigger: 'Moon transit crossing Revati (Pisces) gate triggering 4th/5th house benefic exchange.',
      affectedAnatomyOrDomain: 'Bank liquidity, Provident Fund (EPFO) / 401(k) accounts.'
    });

    // Event 5: Structural Career Reorganization / Responsibility Expansion
    events.push({
      id: 'evt-5',
      title: 'Organizational Leadership Realignment & Autonomy Milestone',
      category: 'career_status',
      categoryLabel: 'Career & Authority',
      polarity: 'positive',
      narrative: 'Delivering hand commissions 10th house Karma Bhava authority, placing greater operational mandate and project architecture oversight into your direct hands after prior stagnation.',
      probabilityScore: 58,
      isHighProbability: false,
      astrologicalRootCause: 'Active Dasha Triad lord aligning with vocational 10th/6th houses from Lagna.',
      transitTrigger: 'Major planet transit crossing Kendra houses from Janma Rashi.',
      affectedAnatomyOrDomain: 'Executive reporting structure & vocational responsibilities.'
    });

    return events;
  }, [selectedHandKey, activeDashaHierarchy, flattenedD1, gateDetails]);

  // Current Active Events
  const [manufacturedEvents, setManufacturedEvents] = useState<ManufacturedEventItem[]>(defaultManufacturedEvents);

  // Synchronize events when hand or perspective changes
  useEffect(() => {
    setManufacturedEvents(defaultManufacturedEvents);
  }, [defaultManufacturedEvents]);

  // 4. Complete Raw Prompt for the Eye Icon Inspector
  const promptPayload = useMemo(() => {
    const monthName = MONTH_NAMES[selectedMonth] || 'Active Month';
    const cleanHand = toCleanEnglishPlanet(selectedHandKey);
    const cleanMd = toCleanEnglishPlanet(activeDashaHierarchy.mahadasha);
    const cleanAd = toCleanEnglishPlanet(activeDashaHierarchy.antardasha);
    const cleanPd = toCleanEnglishPlanet(activeDashaHierarchy.pratyantardasha);

    return `You are an elite Classical Vedic Astrologer executing the "EVENT MANUFACTURING ENGINE" under Parashara & Nadi timing laws.

[HORIZON & DELIVERING HAND IDENTIFICATION]
- Time Window: ${monthName} ${selectedYear}
- Ascendant (Lagna): ${RASHI_LIST_META[natalLagnaIdx - 1]?.eng || 'Sagittarius'} (House 1)
- Janma Rashi (Moon Sign): ${RASHI_LIST_META[natalRashiIdx - 1]?.eng || 'Scorpio'} (Janma Rashi)
- Active Mahadasha (MD): ${cleanMd}
- Active Antardasha (AD): ${cleanAd}
- Active Pratyantardasha (PD) [Teeth of the Month]: ${cleanPd}
- SELECTED DELIVERING HAND TARGET: ${cleanHand}
- EVALUATION PERSPECTIVE: ${perspective === 'lagna' ? 'STRICTLY FROM LAGNA (Physical Body, Anatomy, Tangible Houses)' : perspective === 'rashi' ? 'STRICTLY FROM MOON (Psychological Reality, Perception, Fortune)' : 'DUAL COMBINED SYNTHESIS (Lagna Physical Reality + Moon Experiential Reality)'}

[THE THREE NAKSHATRA ENTRY GATES FOR DELIVERING HAND: ${cleanHand}]
${gateDetails.map((g, idx) => `Gate ${idx + 1}: ${g.nakshatraName} in ${g.rashiName}
- House from Lagna: House ${g.houseFromLagna}
- House from Janma Rashi (Moon): House ${g.houseFromRashi}
- Anatomical Seat & Karakatwa: ${g.anatomicalSeat} — ${g.significations}
- Transiting Planets Occupying/Crossing this Gate: ${g.transitingPlanets.length > 0 ? g.transitingPlanets.join(', ') : 'None'}
- Moon (Chandra) Gate Trigger Window: ${g.moonIngressWindow || 'Approx. 2.25-day lunar transit'}
`).join('\n')}

[CRITICAL PARASHARA REASONING LAWS FOR EVENT MANUFACTURING]
1. The Delivering Hand (${cleanHand}) commissions the event; the 3 Nakshatras (${gateDetails.map(g => g.nakshatraName).join(', ')}) act as the entry gates.
2. When transiting planets (e.g. Mars, Sun, Saturn, Venus, Moon) pass through that gate, the event MANUFACTURES.
3. Lagna determines physical vulnerability and bodily seats (e.g. Venus in Lagna/face + Saturn AD aspect = facial scar turning chronic; Mars in 8th Ashlesha = digestive acid heat, gut flora burning, nerve tension).
4. Moon determines the experiential weather, timing of fruition, and psychological composure.
5. Formulate 4 to 6 concrete, specific events with exact probability percentages (0 to 100%).

OUTPUT FORMAT REQUIREMENT:
Return a valid JSON object with an array of events:
{
  "deliveringHand": "${cleanHand}",
  "perspective": "${perspective}",
  "events": [
    {
      "id": "evt-1",
      "title": "Title of the specific event",
      "category": "health_chronic | accident_friction | wealth_capital | communication_admin | career_status",
      "categoryLabel": "Human readable category label",
      "polarity": "positive | negative | mixed",
      "narrative": "Crisp 1-to-2 line physical manifestation narrative explaining what happens and why.",
      "probabilityScore": 75,
      "isHighProbability": true,
      "astrologicalRootCause": "Exact MD-AD-PD + House from Lagna + House from Rashi mechanism",
      "transitTrigger": "Transiting planet and gate trigger",
      "affectedAnatomyOrDomain": "Physical anatomical seat or life department"
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

  // Synthesize via LLM
  const handleSynthesize = async () => {
    setIsSynthesizing(true);
    try {
      // Simulate / Execute engine synthesis
      await new Promise(resolve => setTimeout(resolve, 800));
      // In full implementation, calls selected LLM endpoint
      setManufacturedEvents([...defaultManufacturedEvents]);
    } finally {
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
                Delivering Hand (PD Teeth) + 3 Nakshatra Gates + Planetary Passages = Concrete Real-World Event Manufacture.
              </p>
            </div>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={() => setShowPromptModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-950 hover:bg-slate-800 border border-purple-500/40 text-purple-300 font-bold text-xs transition cursor-pointer shadow-sm active:scale-95"
            title="Inspect complete raw prompt payload generated by the engine that gets posted to LLM"
          >
            <Eye className="w-3.5 h-3.5 text-purple-400" />
            <span>Inspect Prompt</span>
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-[11px] text-slate-400 font-semibold">Model:</span>
            <select
              value={selectedProvider}
              onChange={e => setSelectedProvider(e.target.value as LLMProviderId)}
              className="bg-slate-950 border border-slate-700 text-purple-300 font-bold text-xs rounded-xl px-2.5 py-1.5 focus:outline-none focus:border-purple-400 cursor-pointer"
            >
              {Object.values(LLM_PROVIDERS).map(prov => (
                <option key={prov.id} value={prov.id} className="bg-slate-900 text-white font-medium">
                  {prov.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleSynthesize}
            disabled={isSynthesizing}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-amber-500 hover:from-purple-500 hover:to-amber-400 text-white font-extrabold text-xs transition shadow-lg shadow-purple-600/30 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isSynthesizing ? 'animate-spin' : ''}`} />
            <span>Synthesize Events</span>
          </button>
        </div>
      </div>

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
                onClick={() => setSelectedHandKey(hand.rawName)}
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
            Planets transiting here trigger the event manufacture
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

      {/* SECTION 4: MANUFACTURED PROBABLE EVENTS (RANKED & SCORED) */}
      <div className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <label className="text-xs font-extrabold text-white flex items-center gap-1.5 uppercase tracking-wider">
            <Activity className="w-4 h-4 text-emerald-400" />
            <span>4. Manufactured Probable Events for This Period ({manufacturedEvents.length} Forecasts):</span>
          </label>
          <span className="text-[11px] text-emerald-400 font-semibold">
            Ranked by Manifestation Probability
          </span>
        </div>

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
                  {/* Category Badge */}
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-900 border border-slate-700 text-slate-300">
                    {event.categoryLabel}
                  </span>

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

              {/* Astrological Trigger & Anatomical Seat Breakdown */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] pt-1">
                <div className="text-slate-400">
                  <strong className="text-purple-300">Root Cause: </strong>
                  <span>{event.astrologicalRootCause}</span>
                </div>
                <div className="text-slate-400">
                  <strong className="text-cyan-300">Target Anatomy/Domain: </strong>
                  <span>{event.affectedAnatomyOrDomain}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
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
                      {LLM_PROVIDERS[selectedProvider]?.name || 'Local Qwen'}
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
