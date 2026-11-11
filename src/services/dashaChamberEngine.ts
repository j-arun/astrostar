/**
 * Dasha Chamber & Delivery Coupling Engine
 * 
 * Computes:
 * 1. AD Lord Natal Seat (The Pressure Chamber) & Lordship (Owned) Houses
 * 2. Transit Conjunctions in the Chamber (Direct Physical Ingress, with dignities like Jupiter Uccham in Cancer)
 * 3. Transit Aspects (Drishti) on the Chamber (Rahu 7th/trines, Saturn 3/7/10, Mars 4/7/8, Jupiter 5/7/9)
 * 4. Net Polarity Score & Dynamic Narrative Synthesis (e.g. Mixed High-Voltage Breakthrough)
 * 5. Coupling to PD Lord's 3 Nakshatra Gates (The Release Valves for Moon Ignition)
 */

import { RASHI_LIST_META } from '../data/transitEphemeris';
import { toCleanEnglishPlanet } from './llm/adapters';

export interface ChamberTransitOccupant {
  planetKey: string;
  cleanName: string;
  rashiIndex: number;
  rashiName: string;
  houseFromLagna: number;
  houseFromRashi: number;
  degreeSputa?: string;
  nakshatraName?: string;
  pada?: number;
  isRetrograde?: boolean;
  dignity: 'exalted' | 'debilitated' | 'own_sign' | 'moolatrikona' | 'neutral';
  isBenefic: boolean;
  pressurePoints: number; // Positive = Grace/Expansion, Negative = Friction/Urgency
  somaticInfluence: string;
}

export interface ChamberTransitAspect {
  planetKey: string;
  cleanName: string;
  sourceRashiIndex: number;
  sourceRashiName: string;
  sourceHouseFromLagna: number;
  sourceHouseFromRashi: number;
  aspectDistance: number; // 3, 4, 5, 7, 8, 9, 10
  aspectLabel: string; // e.g. "7th Direct Opposition Aspect"
  isBenefic: boolean;
  pressurePoints: number;
  karmicMechanism: string;
}

export interface LordshipHouseStatus {
  rashiIndex: number;
  rashiName: string;
  houseFromLagna: number;
  houseFromRashi: number;
  significations: string;
  occupants: string[];
  aspectingGrahas: string[];
  isAfflicted: boolean;
  isProtected: boolean;
}

export interface ADChamberDynamics {
  adLord: string;
  adCleanName: string;
  adNatalRashiIndex: number;
  adNatalRashiName: string;
  adNatalHouseFromLagna: number;
  adNatalHouseFromRashi: number;
  adNatalNakshatra?: string;
  adNatalPada?: number;
  adNatalRetrograde?: boolean;
  
  // Lordship Houses ruled by AD Lord
  ruledHouses: LordshipHouseStatus[];
  
  // Conjunctions inside the AD Seat
  directOccupants: ChamberTransitOccupant[];
  
  // Incoming Aspects onto the AD Seat
  incomingAspects: ChamberTransitAspect[];
  
  // Net Chamber Energy
  totalConjunctionScore: number;
  totalAspectScore: number;
  netScore: number;
  polarityCategory: 'exalted_breakthrough' | 'high_pressure_crisis' | 'mixed_volatile' | 'steady_baseline' | 'harmonious_ease';
  polarityLabel: string;
  chamberAtmosphereNarrative: string;
  
  // Coupling with PD Lord's 3 Nakshatra Gates
  pdLord: string;
  pdCleanName: string;
  coupledGates: {
    gateIndex: number; // 1, 2, 3
    nakshatraName: string;
    rashiIndex: number;
    rashiName: string;
    houseFromLagna: number;
    houseFromRashi: number;
    portfolioDomain: string;
    ventingEfficiency: 'high_conductance' | 'moderate' | 'latent';
    moonWindowText?: string;
    manifestationType: string;
  }[];
  peakVentingGate: string;
  synthesizedEventSignature: string;
}

// Signs ruled by each Vimshottari Lord
export const LORD_OWNED_RASHIS: Record<string, number[]> = {
  'Ketu': [8], // Co-rules Scorpio in classical Nadi
  'Venus (Sukra)': [2, 7], // Rishabam (Taurus), Thulaam (Libra)
  'Sun (Surya)': [5], // Simham (Leo)
  'Moon (Chandra)': [4], // Katakam (Cancer)
  'Mars (Sevvai)': [1, 8], // Mesham (Aries), Vrischigam (Scorpio)
  'Rahu': [11], // Co-rules Aquarius in classical Nadi
  'Jupiter (Guru)': [9, 12], // Dhanus (Sagittarius), Meenam (Pisces)
  'Saturn (Sani)': [10, 11], // Makaram (Capricorn), Kumbam (Aquarius)
  'Mercury (Budha)': [3, 6] // Mithunam (Gemini), Kanni (Virgo)
};

// Exaltation and Debilitation Signs (1-based index)
export const GRAHA_DIGNITY_MAP: Record<string, { exalted: number; debilitated: number; own: number[] }> = {
  Sun: { exalted: 1, debilitated: 7, own: [5] },
  Moon: { exalted: 2, debilitated: 8, own: [4] },
  Mars: { exalted: 10, debilitated: 4, own: [1, 8] },
  Mercury: { exalted: 6, debilitated: 12, own: [3, 6] },
  Jupiter: { exalted: 4, debilitated: 10, own: [9, 12] },
  Venus: { exalted: 12, debilitated: 6, own: [2, 7] },
  Saturn: { exalted: 7, debilitated: 1, own: [10, 11] },
  Rahu: { exalted: 2, debilitated: 8, own: [11] },
  Ketu: { exalted: 8, debilitated: 2, own: [8] }
};

export const HOUSE_SIGNIFICATIONS_SHORT: Record<number, string> = {
  1: 'Physical Self, Vitality, Autonomy & Life Direction',
  2: 'Dhana Wealth, Liquid Capital, Family Lineage & Speech',
  3: 'Initiatives, Courage, Sibling Ties & Communications',
  4: 'Sukha Sthana, Domestic Sanctum, Real Estate & Peace',
  5: 'Purva Punya, Speculation, Creative Intelligence & Children',
  6: 'Shatru/Roga, Competitive Service, Debts & Acute Stress',
  7: 'Kalatra, Strategic Alliances, Public Counterparts & Trade',
  8: 'Ashta/Randhra, Sudden Unearned Wealth, Metamorphosis & Crisis',
  9: 'Bhagya, Dharma, Higher Mentors, Long Travel & Institutional Law',
  10: 'Karma Sthana, Career Authority, Public Rank & Executive Scope',
  11: 'Labha Sthana, High Windfall Incomes, Expansion & Network',
  12: 'Moksha, Foreign Lands, Capital Deployment, Subconscious & Solitude'
};

function normalizeLord(str: string): string {
  if (!str) return 'Saturn (Sani)';
  const s = str.toLowerCase();
  if (s.includes('ketu')) return 'Ketu';
  if (s.includes('venus') || s.includes('sukra')) return 'Venus (Sukra)';
  if (s.includes('sun') || s.includes('surya')) return 'Sun (Surya)';
  if (s.includes('moon') || s.includes('chandra')) return 'Moon (Chandra)';
  if (s.includes('mars') || s.includes('sevvai')) return 'Mars (Sevvai)';
  if (s.includes('rahu')) return 'Rahu';
  if (s.includes('jupiter') || s.includes('guru')) return 'Jupiter (Guru)';
  if (s.includes('saturn') || s.includes('sani')) return 'Saturn (Sani)';
  if (s.includes('mercury') || s.includes('budha')) return 'Mercury (Budha)';
  return str;
}

function getPlanetKey(cleanOrRaw: string): string {
  const norm = normalizeLord(cleanOrRaw);
  if (norm.startsWith('Sun')) return 'Sun';
  if (norm.startsWith('Moon')) return 'Moon';
  if (norm.startsWith('Mars')) return 'Mars';
  if (norm.startsWith('Mercury')) return 'Mercury';
  if (norm.startsWith('Jupiter')) return 'Jupiter';
  if (norm.startsWith('Venus')) return 'Venus';
  if (norm.startsWith('Saturn')) return 'Saturn';
  if (norm.startsWith('Rahu')) return 'Rahu';
  if (norm.startsWith('Ketu')) return 'Ketu';
  return cleanOrRaw;
}

function isNaturalBenefic(planetKey: string): boolean {
  return ['Jupiter', 'Venus', 'Mercury', 'Moon'].includes(planetKey);
}

/**
 * Computes complete AD Chamber Dynamics + PD Coupling
 */
export function computeADChamberDynamics(params: {
  adLord: string;
  pdLord: string;
  natalLagnaIdx: number;
  natalRashiIdx: number;
  natalPlacements: any[];
  transitPlacements: any[];
  monthlyMoonSpans?: any[];
}): ADChamberDynamics {
  const {
    adLord,
    pdLord,
    natalLagnaIdx,
    natalRashiIdx,
    natalPlacements = [],
    transitPlacements = [],
    monthlyMoonSpans = []
  } = params;

  const normalizedAd = normalizeLord(adLord);
  const normalizedPd = normalizeLord(pdLord);
  const adClean = toCleanEnglishPlanet(normalizedAd);
  const pdClean = toCleanEnglishPlanet(normalizedPd);
  const adKey = getPlanetKey(normalizedAd);

  // 1. Resolve AD Lord's Natal Placement (The Chamber Seat)
  // Search natal placements array for matching body_name
  const natalAdRecord = natalPlacements.find((p: any) => {
    const bName = (p.body_name || p.graha_name || p.name || '').toLowerCase();
    const matchKey = adKey.toLowerCase();
    return bName.includes(matchKey) || (matchKey === 'saturn' && bName.includes('sani')) ||
      (matchKey === 'jupiter' && bName.includes('guru')) ||
      (matchKey === 'mars' && bName.includes('sevvai')) ||
      (matchKey === 'venus' && bName.includes('sukra')) ||
      (matchKey === 'mercury' && bName.includes('budha')) ||
      (matchKey === 'sun' && bName.includes('surya')) ||
      (matchKey === 'moon' && bName.includes('chandra'));
  });

  // Fallback defaults if natal record not present in payload
  let adRashiIdx = 4; // Katakam (Cancer) default
  let adHouseLagna = 8;
  let adHouseMoon = 9;
  let adNakshatra = 'Pushya';
  let adPada = 1;
  let adIsRetro = true;

  if (natalAdRecord) {
    if (typeof natalAdRecord.rashi_name === 'string') {
      const foundRashi = RASHI_LIST_META.find(r =>
        r.eng.toLowerCase().includes(natalAdRecord.rashi_name.toLowerCase()) ||
        r.tamil.toLowerCase().includes(natalAdRecord.rashi_name.toLowerCase())
      );
      if (foundRashi) adRashiIdx = foundRashi.index;
    } else if (typeof natalAdRecord.rashi_index === 'number') {
      adRashiIdx = natalAdRecord.rashi_index;
    } else if (typeof natalAdRecord.house_number === 'number') {
      adRashiIdx = ((natalLagnaIdx - 1 + natalAdRecord.house_number - 1) % 12) + 1;
    }

    adHouseLagna = natalAdRecord.house_number || (((adRashiIdx - natalLagnaIdx + 12) % 12) + 1);
    adHouseMoon = ((adRashiIdx - natalRashiIdx + 12) % 12) + 1;
    adNakshatra = natalAdRecord.nakshatra_name || 'Pushya';
    adPada = natalAdRecord.pada || 1;
    adIsRetro = !!natalAdRecord.is_retrograde;
  } else {
    // Standard calculation from Lagna if no explicit record
    adHouseLagna = ((adRashiIdx - natalLagnaIdx + 12) % 12) + 1;
    adHouseMoon = ((adRashiIdx - natalRashiIdx + 12) % 12) + 1;
  }

  const adRashiMeta = RASHI_LIST_META.find(r => r.index === adRashiIdx) || RASHI_LIST_META[3];

  // 2. Lordship Houses ruled by AD Lord
  const ownedRashis = LORD_OWNED_RASHIS[normalizedAd] || [adRashiIdx];
  const ruledHouses: LordshipHouseStatus[] = ownedRashis.map(rIdx => {
    const rMeta = RASHI_LIST_META.find(r => r.index === rIdx) || RASHI_LIST_META[0];
    const hLagna = ((rIdx - natalLagnaIdx + 12) % 12) + 1;
    const hRashi = ((rIdx - natalRashiIdx + 12) % 12) + 1;

    // Check which transits are in this owned rashi
    const occupants = transitPlacements
      .filter((t: any) => (t.transit_rashi_index === rIdx || t.signIndex === rIdx))
      .map((t: any) => toCleanEnglishPlanet(t.graha_key || t.graha_name));

    // Check which transits aspect this owned rashi
    const aspectingGrahas: string[] = [];
    for (const t of transitPlacements) {
      const tRIdx = t.transit_rashi_index ?? t.signIndex;
      if (tRIdx === undefined || tRIdx === rIdx) continue;
      const dist = ((rIdx - tRIdx + 12) % 12) + 1;
      const gKey = getPlanetKey(t.graha_key || t.graha_name);
      
      let aspects = (dist === 7);
      if (gKey === 'Saturn' && (dist === 3 || dist === 10)) aspects = true;
      if (gKey === 'Mars' && (dist === 4 || dist === 8)) aspects = true;
      if ((gKey === 'Jupiter' || gKey === 'Rahu' || gKey === 'Ketu') && (dist === 5 || dist === 9)) aspects = true;

      if (aspects) {
        aspectingGrahas.push(`${toCleanEnglishPlanet(gKey)} (${dist}th)`);
      }
    }

    const hasMaleficOccupant = occupants.some(o => ['Rahu', 'Ketu', 'Saturn', 'Mars'].includes(o));
    const hasBeneficOccupant = occupants.some(o => ['Jupiter', 'Venus'].includes(o));

    return {
      rashiIndex: rIdx,
      rashiName: rMeta.eng,
      houseFromLagna: hLagna,
      houseFromRashi: hRashi,
      significations: HOUSE_SIGNIFICATIONS_SHORT[hLagna] || 'Domain of Activity',
      occupants,
      aspectingGrahas,
      isAfflicted: hasMaleficOccupant,
      isProtected: hasBeneficOccupant
    };
  });

  // 3. Evaluate Direct Conjunctions inside the AD Seat (adRashiIdx)
  const directOccupants: ChamberTransitOccupant[] = [];
  let totalConjunctionScore = 0;

  for (const t of transitPlacements) {
    const tRIdx = t.transit_rashi_index ?? t.signIndex ?? t.sign_index;
    if (tRIdx === adRashiIdx) {
      const gKey = getPlanetKey(t.graha_key || t.graha_name);
      const clean = toCleanEnglishPlanet(gKey);
      const benefic = isNaturalBenefic(gKey);

      // Determine Dignity in this sign
      let dignity: 'exalted' | 'debilitated' | 'own_sign' | 'moolatrikona' | 'neutral' = 'neutral';
      const dMap = GRAHA_DIGNITY_MAP[gKey];
      if (dMap) {
        if (dMap.exalted === adRashiIdx) dignity = 'exalted';
        else if (dMap.debilitated === adRashiIdx) dignity = 'debilitated';
        else if (dMap.own.includes(adRashiIdx)) dignity = 'own_sign';
      }

      // Calculate Pressure Points
      let pts = 0;
      let somatic = '';

      if (gKey === 'Jupiter') {
        pts = dignity === 'exalted' ? 45 : 30;
        somatic = dignity === 'exalted'
          ? 'Supreme divine armor, occult illumination, acute turnaround from crisis, high institutional sanction.'
          : 'Protective wisdom, financial expansion, legal/institutional relief.';
      } else if (gKey === 'Venus') {
        pts = dignity === 'exalted' ? 40 : 25;
        somatic = 'Luxury pacification, diplomatic alliance, liquid cash resolution, somatic ease.';
      } else if (gKey === 'Mercury') {
        pts = 15;
        somatic = 'Rapid contractual paperwork, analytical negotiations, sharp nervous agility.';
      } else if (gKey === 'Moon') {
        pts = 20;
        somatic = '2.5-day acute somatic trigger; psychological emotional culmination of ongoing events.';
      } else if (gKey === 'Rahu') {
        pts = -35;
        somatic = 'Obsessive psychological turbulence, sudden shocks, unconventional foreign moves, intense hunger.';
      } else if (gKey === 'Ketu') {
        pts = -30;
        somatic = 'Sudden detachment, karmic dissolution, nerve/spinal sensitivity, intuitive breaks.';
      } else if (gKey === 'Saturn') {
        pts = -20;
        somatic = 'Heavy structural accountability, chronic delays, bone/joint stiffness, enduring discipline.';
      } else if (gKey === 'Mars') {
        pts = dignity === 'exalted' ? 20 : -25;
        somatic = dignity === 'exalted'
          ? 'Disciplined heroic drive, surgical precision, triumph over adversaries.'
          : 'Pitta heat, acute confrontation, inflammatory flare-up, impatient exertion.';
      } else if (gKey === 'Sun') {
        pts = -15;
        somatic = 'High ego friction with authorities, executive heat, vitality test, government scrutiny.';
      }

      totalConjunctionScore += pts;

      directOccupants.push({
        planetKey: gKey,
        cleanName: clean,
        rashiIndex: adRashiIdx,
        rashiName: adRashiMeta.eng,
        houseFromLagna: adHouseLagna,
        houseFromRashi: adHouseMoon,
        degreeSputa: t.degree_sputa,
        nakshatraName: t.nakshatra_name || t.graha_pada_chara?.nakshatra_name,
        pada: t.pada || t.graha_pada_chara?.pada,
        isRetrograde: !!t.is_retrograde,
        dignity,
        isBenefic: benefic,
        pressurePoints: pts,
        somaticInfluence: somatic
      });
    }
  }

  // 4. Evaluate Incoming Aspects (Drishti) onto the AD Seat (adRashiIdx)
  const incomingAspects: ChamberTransitAspect[] = [];
  let totalAspectScore = 0;

  for (const t of transitPlacements) {
    const tRIdx = t.transit_rashi_index ?? t.signIndex ?? t.sign_index;
    if (tRIdx === undefined || tRIdx === adRashiIdx) continue;

    const gKey = getPlanetKey(t.graha_key || t.graha_name);
    const clean = toCleanEnglishPlanet(gKey);
    const dist = ((adRashiIdx - tRIdx + 12) % 12) + 1; // 1-based distance from transit planet to AD seat
    const benefic = isNaturalBenefic(gKey);
    const srcRMeta = RASHI_LIST_META.find(r => r.index === tRIdx) || RASHI_LIST_META[0];
    const srcHouseLagna = ((tRIdx - natalLagnaIdx + 12) % 12) + 1;
    const srcHouseMoon = ((tRIdx - natalRashiIdx + 12) % 12) + 1;

    let hasAspect = false;
    let aspectLabel = '';
    let pts = 0;
    let karmicMech = '';

    // A. 7th General Opposition Aspect for ALL Grahas
    if (dist === 7) {
      hasAspect = true;
      aspectLabel = '7th Direct Opposition Aspect';
      if (gKey === 'Rahu') {
        pts = -25;
        karmicMech = 'Direct 180° gaze injecting acute psychological obsession, urgency, and sudden shocks from opposite house.';
      } else if (gKey === 'Ketu') {
        pts = -20;
        karmicMech = 'Direct 180° spiritual detachment and sudden severing of external expectations.';
      } else if (gKey === 'Saturn') {
        pts = -20;
        karmicMech = 'Direct cold stare enforcing long-term duty, delay, and relentless institutional friction.';
      } else if (gKey === 'Mars') {
        pts = -25;
        karmicMech = 'Direct confrontational gaze igniting friction, arguments, and urgent physical actions.';
      } else if (gKey === 'Jupiter') {
        pts = 30;
        karmicMech = 'Supreme direct Parashari gaze radiating divine blessing, dispute settlement, and moral authority.';
      } else if (gKey === 'Venus') {
        pts = 20;
        karmicMech = 'Harmonizing direct gaze soothing friction, attracting allies, and unlocking financial release.';
      } else {
        pts = benefic ? 10 : -10;
        karmicMech = `${clean} directly casting full 7th aspect onto the delivery seat.`;
      }
    }

    // B. Special Aspects
    // Saturn: 3rd and 10th
    if (gKey === 'Saturn' && (dist === 3 || dist === 10)) {
      hasAspect = true;
      aspectLabel = `${dist}th Special Aspect (Saturn's Grip)`;
      pts = -20;
      karmicMech = dist === 3
        ? '3rd special drishti: Demands intense self-exertion, courage under pressure, and overcoming structural inertia.'
        : '10th special drishti: Demands organizational accountability, heavy executive load, and career restructuring.';
    }

    // Mars: 4th and 8th
    if (gKey === 'Mars' && (dist === 4 || dist === 8)) {
      hasAspect = true;
      aspectLabel = `${dist}th Special Aspect (Mars's Strike)`;
      pts = -25;
      karmicMech = dist === 4
        ? '4th special drishti: Disrupts internal peace/sukha, domestic security, and forces urgent renovations or changes.'
        : '8th special drishti: Lethal transformative gaze pushing hidden vulnerabilities, surgical matters, and sudden pivots.';
    }

    // Jupiter: 5th and 9th (Trinal Drishti)
    if (gKey === 'Jupiter' && (dist === 5 || dist === 9)) {
      hasAspect = true;
      aspectLabel = `${dist}th Special Trinal Aspect (Guru's Grace)`;
      pts = 35;
      karmicMech = dist === 5
        ? '5th trinal drishti: Purva punya ignition, exceptional advisory intellect, creative breakthrough, and child/speculative favor.'
        : '9th trinal drishti: Supreme Dharma grace, foreign fortune, executive sponsor protection, and institutional vindication.';
    }

    // Rahu & Ketu: 5th and 9th (Nodal Trinal Drishti)
    if ((gKey === 'Rahu' || gKey === 'Ketu') && (dist === 5 || dist === 9)) {
      hasAspect = true;
      aspectLabel = `${dist}th Nodal Trinal Aspect`;
      pts = gKey === 'Rahu' ? -20 : -15;
      karmicMech = gKey === 'Rahu'
        ? 'Rahu trinal ray: Unconventional desires, high-stakes temptation, foreign entanglements, and unexpected twists.'
        : 'Ketu trinal ray: Inward withdrawal, karmic cleansing, dissolution of worldly pride, and heightened intuition.';
    }

    if (hasAspect) {
      totalAspectScore += pts;
      incomingAspects.push({
        planetKey: gKey,
        cleanName: clean,
        sourceRashiIndex: tRIdx,
        sourceRashiName: srcRMeta.eng,
        sourceHouseFromLagna: srcHouseLagna,
        sourceHouseFromRashi: srcHouseMoon,
        aspectDistance: dist,
        aspectLabel,
        isBenefic: benefic,
        pressurePoints: pts,
        karmicMechanism: karmicMech
      });
    }
  }

  // 5. Net Polarity Synthesis
  const netScore = totalConjunctionScore + totalAspectScore;
  const hasStrongMaleficPressure = incomingAspects.some(a => a.pressurePoints <= -20) || directOccupants.some(o => o.pressurePoints <= -25);
  const hasStrongBeneficShield = directOccupants.some(o => o.pressurePoints >= 30) || incomingAspects.some(a => a.pressurePoints >= 25);

  let polarityCategory: 'exalted_breakthrough' | 'high_pressure_crisis' | 'mixed_volatile' | 'steady_baseline' | 'harmonious_ease';
  let polarityLabel = '';

  if (hasStrongMaleficPressure && hasStrongBeneficShield) {
    polarityCategory = 'mixed_volatile';
    polarityLabel = 'Mixed High-Voltage Breakthrough (Crisis Converted to Victory)';
  } else if (netScore >= 35 || directOccupants.some(o => o.dignity === 'exalted' && o.isBenefic)) {
    polarityCategory = 'exalted_breakthrough';
    polarityLabel = 'Exalted Breakthrough & Sovereign Protection [+]';
  } else if (netScore <= -30) {
    polarityCategory = 'high_pressure_crisis';
    polarityLabel = 'High Karmic Friction & Extreme Event Emitter [-]';
  } else if (netScore >= 15) {
    polarityCategory = 'harmonious_ease';
    polarityLabel = 'Harmonious Growth & Supportive Flow [+]';
  } else {
    polarityCategory = 'steady_baseline';
    polarityLabel = 'Moderate Baseline Transit (Controlled Delivery)';
  }

  // Construct Atmosphere Narrative
  let chamberAtmosphereNarrative = '';
  const conjunctNames = directOccupants.map(o => `${o.cleanName}${o.dignity === 'exalted' ? ' [EXALTED]' : ''}`).join(', ') || 'None';
  const aspectNames = incomingAspects.map(a => `${a.cleanName} (${a.aspectLabel} from H${a.sourceHouseFromLagna})`).join('; ') || 'None';

  if (polarityCategory === 'mixed_volatile') {
    chamberAtmosphereNarrative = `The AD Chamber in ${adRashiMeta.eng} (House ${adHouseLagna}) is an acute event-emitting epicenter. Transiting malefic rays (${aspectNames}) generate sharp urgency and external pressure, while powerful benefic presence (${conjunctNames}) guarantees divine mitigation and institutional turnaround.`;
  } else if (polarityCategory === 'exalted_breakthrough') {
    chamberAtmosphereNarrative = `The AD Chamber enjoys sovereign elevation. With ${conjunctNames} sitting directly in the seat and benevolent aspect support, challenges are converted into significant personal and financial expansions.`;
  } else if (polarityCategory === 'high_pressure_crisis') {
    chamberAtmosphereNarrative = `The AD Chamber is under acute karmic friction. Malefic transits (${conjunctNames}; ${aspectNames}) apply relentless structural pressure on House ${adHouseLagna}. Requires deliberate pacing and caution against impulsive pivots.`;
  } else {
    chamberAtmosphereNarrative = `The AD Chamber operates with standard baseline dynamics. Direct occupants: ${conjunctNames}. Incoming rays: ${aspectNames}.`;
  }

  // 6. Coupling with PD Lord's 3 Nakshatra Gates (The Release Valves)
  const PD_NAKSHATRA_MAP: Record<string, { nakshatras: string[]; rashis: number[]; domains: string[] }> = {
    'Ketu': {
      nakshatras: ['Ashwini', 'Magha', 'Mula'],
      rashis: [1, 5, 9],
      domains: ['Head & Cranium / Instinctual Ventures', 'Heart & Identity / Executive Restructuring', 'Sacrum & Higher Wisdom / Karmic Release']
    },
    'Venus (Sukra)': {
      nakshatras: ['Bharani', 'Purva Phalguni', 'Purva Ashadha'],
      rashis: [1, 5, 9],
      domains: ['Strategic Creative Risks & High Speculation', 'Executive Leadership & Foreign Authority', 'Personal Brand & Autonomy Milestone']
    },
    'Sun (Surya)': {
      nakshatras: ['Krittika', 'Uttara Phalguni', 'Uttara Ashadha'],
      rashis: [2, 6, 10],
      domains: ['Financial Speech & Liquid Assets', 'Competitive Victory & Health Restructuring', 'Public Rank & Executive Career Authority']
    },
    'Moon (Chandra)': {
      nakshatras: ['Rohini', 'Hasta', 'Shravana'],
      rashis: [2, 6, 10],
      domains: ['Domestic Wealth & Family Sanctuary', 'Skill Handcraft & Daily Operations', 'Institutional Listening & Career Reputation']
    },
    'Mars (Sevvai)': {
      nakshatras: ['Mrigashira', 'Chitra', 'Dhanishta'],
      rashis: [3, 7, 11],
      domains: ['Contractual Courage & Team Action', 'Strategic Business Alliances & Negotiations', 'Large Network Windfalls & Organizational Gains']
    },
    'Rahu': {
      nakshatras: ['Ardra', 'Swati', 'Shatabhisha'],
      rashis: [3, 7, 11],
      domains: ['Unconventional Tech & Media Ventures', 'Independent Partnerships & Foreign Trade', 'Mass Networking & Sudden High Income Spikes']
    },
    'Jupiter (Guru)': {
      nakshatras: ['Punarvasu', 'Vishakha', 'Purva Bhadrapada'],
      rashis: [4, 8, 12],
      domains: ['Home Consolidation & Inner Stillness', 'Legacy Wealth, Inheritance & Deep Research', 'Foreign Settlements & Spiritual Detachment']
    },
    'Saturn (Sani)': {
      nakshatras: ['Pushya', 'Anuradha', 'Uttara Bhadrapada'],
      rashis: [4, 8, 12],
      domains: ['Institutional Roots & Enduring Responsibility', 'Deep Confidential Research & Financial Defense', 'Foreign Rebalancing & Long-term Karma Clearing']
    },
    'Mercury (Budha)': {
      nakshatras: ['Ashlesha', 'Jyeshtha', 'Revati'],
      rashis: [4, 8, 12],
      domains: ['Strategic Contract Drafting & Analytical Prudence', 'Occult Seniority & Bureaucratic Negotiations', 'Global Communication & Complete Project Wrap-up']
    }
  };

  const pdMeta = PD_NAKSHATRA_MAP[normalizedPd] || PD_NAKSHATRA_MAP['Venus (Sukra)'];

  const coupledGates = pdMeta.nakshatras.map((nakName, idx) => {
    const rIdx = pdMeta.rashis[idx];
    const rMeta = RASHI_LIST_META.find(r => r.index === rIdx) || RASHI_LIST_META[0];
    const hLagna = ((rIdx - natalLagnaIdx + 12) % 12) + 1;
    const hRashi = ((rIdx - natalRashiIdx + 12) % 12) + 1;

    // Check if transiting Moon enters this gate
    let moonWindowText = 'Standard 2.5-day cycle';
    const moonSpan = monthlyMoonSpans.find((m: any) =>
      m.nakshatra_name === nakName || m.nakshatraName === nakName || m.signIndex === rIdx
    );
    if (moonSpan && (moonSpan.date_window || moonSpan.dates)) {
      moonWindowText = moonSpan.date_window || moonSpan.dates;
    }

    const domain = pdMeta.domains[idx] || 'General Life Portfolio';

    const isKendraTrikona = [1, 4, 5, 7, 9, 10].includes(hLagna);
    const ventingEfficiency: 'high_conductance' | 'moderate' | 'latent' = isKendraTrikona ? 'high_conductance' : 'moderate';

    return {
      gateIndex: idx + 1,
      nakshatraName: nakName,
      rashiIndex: rIdx,
      rashiName: rMeta.eng,
      houseFromLagna: hLagna,
      houseFromRashi: hRashi,
      portfolioDomain: domain,
      ventingEfficiency,
      moonWindowText,
      manifestationType: `Physical release through House ${hLagna} (${rMeta.eng}) under ${pdClean}'s ${nakName} gate.`
    };
  });

  const peakGate = coupledGates.find(g => g.ventingEfficiency === 'high_conductance') || coupledGates[0];

  const synthesizedEventSignature = `Pressure accumulated in the ${adClean} AD Chamber (House ${adHouseLagna} in ${adRashiMeta.eng}) discharges through ${pdClean}'s Gate ${peakGate.gateIndex} (${peakGate.nakshatraName} in House ${peakGate.houseFromLagna}). Under ${polarityLabel}, expected event manifests as: "${peakGate.portfolioDomain}" during the active lunar trigger window.`;

  return {
    adLord: normalizedAd,
    adCleanName: adClean,
    adNatalRashiIndex: adRashiIdx,
    adNatalRashiName: adRashiMeta.eng,
    adNatalHouseFromLagna: adHouseLagna,
    adNatalHouseFromRashi: adHouseMoon,
    adNatalNakshatra: adNakshatra,
    adNatalPada: adPada,
    adNatalRetrograde: adIsRetro,
    ruledHouses,
    directOccupants,
    incomingAspects,
    totalConjunctionScore,
    totalAspectScore,
    netScore,
    polarityCategory,
    polarityLabel,
    chamberAtmosphereNarrative,
    pdLord: normalizedPd,
    pdCleanName: pdClean,
    coupledGates,
    peakVentingGate: `${peakGate.nakshatraName} (Gate ${peakGate.gateIndex})`,
    synthesizedEventSignature
  };
}
