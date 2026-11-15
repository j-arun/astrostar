import { RASHI_LIST_META } from '../data/transitEphemeris';
import { computeADChamberDynamics, ADChamberDynamics } from './dashaChamberEngine';
import { analyzeVedicWindowEvents, VedicWindowAnalysis } from './vedicEventsEngine';
import type {
  CorrelatedManufacturedEvent,
  EventManufacturingSupersetPayload,
  GatePerspective,
  HouseLordshipToGateLink,
  SupersetGateGrahaDetail,
  SupersetNakshatraGateSummary
} from './llm/types';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export type { GatePerspective };

export interface ActiveTransitGrahaDetail extends SupersetGateGrahaDetail {}

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

export interface ManufacturedEventItem {
  id: string;
  title: string;
  narrative: string;
  probabilityScore: number;
  isHighProbability: boolean;
  portfolio?: string;
  gateTrigger?: string;
  hasMoonSupport?: boolean;
  moonWindowDates?: string;
  latencyStatus?: 'acute_moon_triggered' | 'dormant_latent';
}

export const LORD_NAKSHATRA_GATES: Record<
  string,
  { nakshatras: string[]; rashis: number[]; anatomies: string[]; signs: string[] }
> = {
  Ketu: {
    nakshatras: ['Ashwini', 'Magha', 'Mula'],
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

const HOUSE_PORTFOLIO_LABELS: Record<number, { portfolio: string; label: string }> = {
  1: { portfolio: 'Health', label: '1st Lagna (Vitality, Physical Body, Self)' },
  2: { portfolio: 'Money', label: '2nd Dhana (Liquid Cash, Family, Speech)' },
  3: { portfolio: 'Trip', label: '3rd Sahaja (Short Trips, Friends/Peers, Documentation)' },
  4: { portfolio: 'Life', label: '4th Sukha (Home, Mother, Fixed Property)' },
  5: { portfolio: 'Love', label: '5th Putra (Romance, Speculation, Intellect)' },
  6: { portfolio: 'Health', label: '6th Ari (Service Work, Health Obstacles, Debts)' },
  7: { portfolio: 'Love', label: '7th Kalatra (Partnership, Marriage, Public Deals)' },
  8: { portfolio: 'Money', label: '8th Randhra (Joint Finance, Unexpected Shifts, Stress)' },
  9: { portfolio: 'Trip', label: '9th Bhagya (Long Travel, Visas, Fortune/Mentors)' },
  10: { portfolio: 'Work', label: '10th Karma (Career Elevation, Authority, Role)' },
  11: { portfolio: 'Friends', label: '11th Labha (Income Gains, Network Circles, Wishes)' },
  12: { portfolio: 'Trip', label: '12th Vyaya (Foreign Relocation, Expenses, Sleep)' }
};

export function cleanEnglishPlanetName(raw: string): string {
  if (!raw) return 'Mercury';
  const low = raw.toLowerCase();
  if (low.includes('ketu') || low.includes('கேது')) return 'Ketu';
  if (low.includes('rahu') || low.includes('ராகு')) return 'Rahu';
  if (low.includes('venus') || low.includes('sukra') || low.includes('சுக்கிரன்')) return 'Venus';
  if (low.includes('sun') || low.includes('surya') || low.includes('சூரியன்')) return 'Sun';
  if (low.includes('moon') || low.includes('chandra') || low.includes('சந்திரன்')) return 'Moon';
  if (low.includes('mars') || low.includes('sevvai') || low.includes('செவ்வாய்') || low.includes('kuja')) return 'Mars';
  if (low.includes('jupiter') || low.includes('guru') || low.includes('வியாழன்') || low.includes('குரு')) return 'Jupiter';
  if (low.includes('saturn') || low.includes('sani') || low.includes('சனி')) return 'Saturn';
  if (low.includes('mercury') || low.includes('budha') || low.includes('புதன்')) return 'Mercury';
  if (low.includes('lagna') || low.includes('asc')) return 'Lagna';
  return raw.split('(')[0].trim();
}

export function cleanEnglishSignName(raw: string): string {
  if (!raw) return '';
  return raw.split('(')[0].trim();
}

export function normalizeLordKey(lordStr: string): string {
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

export function computeNakshatraGateDetails(params: {
  deliveringHandKey: string;
  natalLagnaIdx: number;
  natalRashiIdx: number;
  selectedMonth: number;
  transitPlacements: any[];
  monthlyGrahaSpans?: any[];
  flattenedD1: any[];
  monthlyMoonSpans: any[];
}): NakshatraGateInfo[] {
  const {
    deliveringHandKey,
    natalLagnaIdx,
    natalRashiIdx,
    selectedMonth,
    transitPlacements,
    monthlyGrahaSpans,
    flattenedD1,
    monthlyMoonSpans
  } = params;

  const lordMeta = LORD_NAKSHATRA_GATES[normalizeLordKey(deliveringHandKey)] || LORD_NAKSHATRA_GATES['Mercury (Budha)'];
  const monthShort = (MONTH_NAMES[selectedMonth] || 'Month').slice(0, 3);

  return lordMeta.nakshatras.map((nakName, idx) => {
    const rIdx = lordMeta.rashis[idx];
    const rMeta = RASHI_LIST_META.find(r => r.index === rIdx) || RASHI_LIST_META[0];
    const hLagna = ((rIdx - natalLagnaIdx + 12) % 12) + 1;
    const hRashi = ((rIdx - natalRashiIdx + 12) % 12) + 1;

    const grahaMap = new Map<string, ActiveTransitGrahaDetail>();

    for (const t of transitPlacements || []) {
      const signMatch =
        t.transit_rashi_index === rIdx || t.signIndex === rIdx || t.sign_index === rIdx;
      if (signMatch) {
        const gKey = t.graha_key || t.graha_name;
        const cleanName = cleanEnglishPlanetName(gKey);
        grahaMap.set(cleanName, {
          name: cleanName,
          key: gKey,
          type: 'transit_current',
          passageWindow: 'Active in House'
        });
      }
    }

    for (const span of monthlyGrahaSpans || []) {
      if (span.sign_index === rIdx || span.signIndex === rIdx) {
        const cleanName = cleanEnglishPlanetName(span.graha_key || span.graha_name);
        const windowStr = `${monthShort} ${span.start_day}–${span.end_day}`;
        const existing = grahaMap.get(cleanName);
        if (existing) {
          existing.passageWindow = windowStr;
          existing.isExalted = span.is_exalted;
        } else {
          grahaMap.set(cleanName, {
            name: cleanName,
            key: span.graha_key || cleanName,
            type: 'monthly_passage',
            passageWindow: windowStr,
            isExalted: span.is_exalted
          });
        }
      }
    }

    for (const np of flattenedD1 || []) {
      const rashiNorm = (np.rashi_name || '').toLowerCase();
      const signNorm = (rMeta.eng || '').toLowerCase();
      if (rashiNorm && (signNorm.includes(rashiNorm) || rashiNorm.includes(signNorm.slice(0, 4)))) {
        const cleanName = cleanEnglishPlanetName(np.body_name);
        if (cleanName === 'Lagna') continue;
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

    const matchedMoonSpans = (monthlyMoonSpans || []).filter(
      (m: any) => m.signIndex === rIdx || m.houseNumber === hLagna
    );
    const moonIngressWindow =
      matchedMoonSpans.length > 0
        ? matchedMoonSpans.map((m: any) => `${monthShort} ${m.startDay}–${m.endDay}`).join(', ')
        : undefined;

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
}

export function buildHouseLordshipToGateLinks(params: {
  natalLagnaIdx: number;
  natalRashiIdx: number;
  selectedMonth: number;
  flattenedD1: any[];
  transitPlacements: any[];
  monthlyMoonSpans: any[];
  gateDetails: NakshatraGateInfo[];
  adChamberDynamics: ADChamberDynamics;
}): HouseLordshipToGateLink[] {
  const {
    natalLagnaIdx,
    natalRashiIdx,
    selectedMonth,
    flattenedD1,
    transitPlacements,
    monthlyMoonSpans,
    gateDetails,
    adChamberDynamics
  } = params;

  const monthShort = (MONTH_NAMES[selectedMonth] || 'Month').slice(0, 3);
  const links: HouseLordshipToGateLink[] = [];

  for (let hLagna = 1; hLagna <= 12; hLagna++) {
    const signIdx = ((natalLagnaIdx - 1 + (hLagna - 1)) % 12) + 1;
    const hMoon = ((signIdx - natalRashiIdx + 12) % 12) + 1;
    const signMeta = RASHI_LIST_META.find(r => r.index === signIdx) || RASHI_LIST_META[0];
    const cleanSign = cleanEnglishSignName(signMeta.eng);

    const natalOcc = (flattenedD1 || [])
      .filter(p => {
        const norm = (p.rashi_name || '').toLowerCase();
        const sLow = signMeta.eng.toLowerCase();
        const cLow = cleanSign.toLowerCase();
        const match =
          p.house_number === hLagna ||
          norm.includes(cLow) ||
          sLow.includes(norm.slice(0, 4));
        return match && cleanEnglishPlanetName(p.body_name) !== 'Lagna';
      })
      .map(p => `${cleanEnglishPlanetName(p.body_name)}${p.is_retrograde ? '(R)' : ''}`);

    const transitOcc = (transitPlacements || [])
      .filter(t => t.transit_rashi_index === signIdx)
      .map(t => `${cleanEnglishPlanetName(t.graha_key)}${t.is_retrograde ? '(R)' : ''}`);

    const isAdRuled = adChamberDynamics.ruledHouses.some(rh => rh.rashiIndex === signIdx);
    const matchingGate = gateDetails.find(g => g.rashiIndex === signIdx);
    const moonSpan = (monthlyMoonSpans || []).find(m => m.signIndex === signIdx);
    const moonDates = matchingGate?.moonIngressWindow || (moonSpan ? `${monthShort} ${moonSpan.startDay}–${moonSpan.endDay}` : undefined);

    const domainMeta = HOUSE_PORTFOLIO_LABELS[hLagna] || { portfolio: 'Life', label: `House ${hLagna}` };

    links.push({
      houseFromLagna: hLagna,
      houseFromMoon: hMoon,
      rashiName: cleanSign,
      rashiLord: cleanEnglishPlanetName(signMeta.lord),
      portfolioLabel: `${domainMeta.portfolio} • ${domainMeta.label}`,
      natalOccupants: Array.from(new Set(natalOcc)),
      transitOccupants: Array.from(new Set(transitOcc)),
      isActivatedByAdLordship: isAdRuled,
      isActivatedByDeliveringHandGate: !!matchingGate,
      matchingGateNakshatra: matchingGate ? `${matchingGate.nakshatraName} (${matchingGate.rashiName.split(' ')[0]})` : undefined,
      moonIgnitionDates: moonDates
    });
  }

  return links;
}

function buildDeterministicPortfolioCandidates(params: {
  selectedMonth: number;
  selectedYear: number;
  gateDetails: NakshatraGateInfo[];
  gatePerspectives: Record<number, GatePerspective>;
  adChamberDynamics: ADChamberDynamics;
  houseLinks: HouseLordshipToGateLink[];
  vedicSpecialEvents: VedicWindowAnalysis;
}): CorrelatedManufacturedEvent[] {
  const {
    selectedMonth,
    gateDetails,
    gatePerspectives,
    adChamberDynamics,
    houseLinks,
    vedicSpecialEvents
  } = params;

  const monthShort = (MONTH_NAMES[selectedMonth] || 'Month').slice(0, 3);
  const events: CorrelatedManufacturedEvent[] = [];

  const getMoonWindowForLagnaHouse = (lagnaHouse: number): string | undefined => {
    const link = houseLinks.find(l => l.houseFromLagna === lagnaHouse);
    return link?.moonIgnitionDates;
  };

  // 1. Direct Nakshatra Gate Events (1-to-3) correlated with Houses & Lordships
  gateDetails.forEach((gate, idx) => {
    const link = houseLinks.find(l => l.houseFromLagna === gate.houseFromLagna);
    const persp = gatePerspectives[idx] || 'combined';
    const perspLabel =
      persp === 'lagna'
        ? 'From Lagna (Physical/Anatomy)'
        : persp === 'rashi'
        ? 'From Janma Rashi (Psychological/Fortune)'
        : 'Combined Lagna+Moon';
    const transitingGrahas = gate.activeGrahasInGate.filter(g => g.type !== 'natal');
    const hasTransit = transitingGrahas.length > 0;
    const hasMoon = !!gate.moonIngressWindow;
    const baseProb = hasTransit && hasMoon ? 82 - idx * 4 : hasMoon ? 64 - idx * 3 : 38;
    const domainMeta = HOUSE_PORTFOLIO_LABELS[gate.houseFromLagna] || { portfolio: 'Life', label: `House ${gate.houseFromLagna}` };

    const grahaDesc =
      gate.activeGrahasInGate.length > 0
        ? gate.activeGrahasInGate.map(g => `${g.name}${g.passageWindow ? ` (${g.passageWindow})` : ''}`).join(', ')
        : 'Empty transit gate (responds strictly during Moon 2.5-day pulse)';

    const chamberAdNote = link?.isActivatedByAdLordship
      ? ` + Direct ${adChamberDynamics.adCleanName} AD Lordship house`
      : '';

    events.push({
      id: `det-gate-${idx + 1}`,
      title: `${gate.nakshatraName} Gate Trigger (${cleanEnglishSignName(gate.rashiName)}): ${domainMeta.portfolio} Activity`,
      portfolio: domainMeta.portfolio,
      probabilityScore: Math.max(25, Math.min(92, baseProb)),
      isHighProbability: baseProb >= 60,
      latencyStatus: hasTransit && hasMoon ? 'acute_moon_triggered' : hasMoon ? 'acute_moon_triggered' : 'dormant_latent',
      hasMoonSupport: hasMoon,
      moonWindowDates: gate.moonIngressWindow,
      correlatedHousesAndLordships: `Lagna H${gate.houseFromLagna} / Moon H${gate.houseFromRashi} (${cleanEnglishSignName(gate.rashiName)}, Lord: ${link?.rashiLord || 'Lord'})${chamberAdNote}`,
      nakshatraGateTrigger: `Gate ${idx + 1}: ${gate.nakshatraName} [${perspLabel}] • Grahas: ${grahaDesc}`,
      narrative: hasTransit
        ? `${adChamberDynamics.pdCleanName} Delivering Hand channels ${adChamberDynamics.adCleanName} AD chamber pressure (${adChamberDynamics.polarityLabel}) through ${gate.nakshatraName}. Expect felt developments around ${gate.significations.toLowerCase()} and ${gate.anatomicalSeat.toLowerCase()}, peaking during Moon window ${gate.moonIngressWindow || monthShort}.`
        : `${gate.nakshatraName} holds latent receptivity in Lagna H${gate.houseFromLagna} / Moon H${gate.houseFromRashi}. Brief awareness arises mainly during Moon transit (${gate.moonIngressWindow || 'approx 2.5 days'}).`,
      source: 'deterministic_gate_candidate'
    });
  });

  // 2. Parivartana / Neecha Bhanga / Station Events correlated to Houses & Gates
  vedicSpecialEvents.parivartanaYogas.forEach((p, idx) => {
    const linkA = houseLinks.find(l => l.houseFromLagna === p.lagnaHouseA);
    const linkB = houseLinks.find(l => l.houseFromLagna === p.lagnaHouseB);
    const portfolio =
      p.lagnaHouseA === 10 || p.lagnaHouseB === 10 || p.lagnaHouseA === 6 || p.lagnaHouseB === 6
        ? 'Work'
        : p.lagnaHouseA === 2 || p.lagnaHouseB === 2 || p.lagnaHouseA === 11 || p.lagnaHouseB === 11
        ? 'Money'
        : p.lagnaHouseA === 5 || p.lagnaHouseB === 5 || p.lagnaHouseA === 7 || p.lagnaHouseB === 7
        ? 'Love'
        : 'Life';
    const moonWin = linkA?.moonIgnitionDates || linkB?.moonIgnitionDates || gateDetails[0]?.moonIngressWindow;
    events.push({
      id: `det-parivartana-${idx + 1}`,
      title: `Parivartana Exchange: ${cleanEnglishPlanetName(p.grahaA)} <-> ${cleanEnglishPlanetName(p.grahaB)} (${p.yogaClass})`,
      portfolio,
      probabilityScore: 86,
      isHighProbability: true,
      latencyStatus: 'acute_moon_triggered',
      hasMoonSupport: !!moonWin,
      moonWindowDates: moonWin || `${p.startDate.slice(5)} to ${p.endDate.slice(5)}`,
      correlatedHousesAndLordships: `Lagna H${p.lagnaHouseA} (${p.signAName}) <-> H${p.lagnaHouseB} (${p.signBName}) | ${p.bhavaExchangeSummary} | ${p.lordshipSummary}`,
      nakshatraGateTrigger: `Parivartana Sign & Bhava Exchange (${p.startDate} to ${p.endDate}) vented via ${adChamberDynamics.peakVentingGate}`,
      narrative: `${p.predictedEvents || 'Mutual house & lordship exchange binds actions and outcomes between these two houses.'} Active from ${p.startDate} to ${p.endDate}.`,
      source: 'deterministic_gate_candidate'
    });
  });

  vedicSpecialEvents.sameSignStations.forEach((s, idx) => {
    const link = houseLinks.find(l => l.houseFromLagna === s.houseFromLagna);
    const portfolio = HOUSE_PORTFOLIO_LABELS[s.houseFromLagna]?.portfolio || 'Life';
    const moonWin = link?.moonIgnitionDates || gateDetails[0]?.moonIngressWindow;
    events.push({
      id: `det-station-${idx + 1}`,
      title: `${cleanEnglishPlanetName(s.grahaKey)} Turns ${s.turnType} in Same House (${s.signName})`,
      portfolio,
      probabilityScore: 79,
      isHighProbability: true,
      latencyStatus: 'acute_moon_triggered',
      hasMoonSupport: !!moonWin,
      moonWindowDates: moonWin || s.stationDate,
      correlatedHousesAndLordships: `Lagna H${s.houseFromLagna} / Moon H${s.houseFromMoon} (${s.signName}, Lord: ${link?.rashiLord || 'Lord'})`,
      nakshatraGateTrigger: `Station Date ${s.stationDate} (Before ${s.beforeRange} -> After ${s.afterRange})`,
      narrative: `${s.summary} ${s.eventImpact}`,
      source: 'deterministic_gate_candidate'
    });
  });

  vedicSpecialEvents.debilitationEvents.forEach((d, idx) => {
    const link = houseLinks.find(l => l.houseFromLagna === d.houseFromLagna);
    const portfolio = HOUSE_PORTFOLIO_LABELS[d.houseFromLagna]?.portfolio || 'Work';
    events.push({
      id: `det-neecha-${idx + 1}`,
      title: `${cleanEnglishPlanetName(d.grahaKey)} in ${d.signName}: ${d.neechaBhangaStatus}`,
      portfolio,
      probabilityScore: d.neechaBhangaStatus.includes('BHANGA') ? 76 : 64,
      isHighProbability: true,
      latencyStatus: 'acute_moon_triggered',
      hasMoonSupport: !!(link?.moonIgnitionDates),
      moonWindowDates: link?.moonIgnitionDates || `${d.startDate.slice(5)} to ${d.endDate.slice(5)}`,
      correlatedHousesAndLordships: `Lagna H${d.houseFromLagna} / Moon H${d.houseFromMoon} (${d.signName}, Lord: ${link?.rashiLord || 'Lord'})`,
      nakshatraGateTrigger: `${d.neechaBhangaStatus} (${d.cancellationReasons.join('; ') || d.motionState})`,
      narrative: `${d.summary} ${d.predictedEvents}`,
      source: 'deterministic_gate_candidate'
    });
  });

  // 3. Ensure Complete 7-Portfolio Coverage (Work, Money, Love, Health, Life, Friends, Trip)
  const portfolioTemplates: Array<{
    portfolio: string;
    houses: number[];
    title: string;
    narrativeBuilder: (matchingLinks: HouseLordshipToGateLink[]) => string;
  }> = [
    {
      portfolio: 'Work',
      houses: [10, 6],
      title: 'Career Authority, Role Execution & Workload Shift',
      narrativeBuilder: links =>
        `10th Karma (${links[0]?.rashiName}, Lord ${links[0]?.rashiLord}) & 6th Service (${links[1]?.rashiName}) process under ${adChamberDynamics.adCleanName} AD chamber (${adChamberDynamics.polarityLabel}) and vent through ${adChamberDynamics.peakVentingGate}.`
    },
    {
      portfolio: 'Money',
      houses: [2, 11],
      title: 'Liquidity Flow, Settlement & Capital Allocation',
      narrativeBuilder: links =>
        `2nd Dhana (${links[0]?.rashiName}, Lord ${links[0]?.rashiLord}) & 11th Labha (${links[1]?.rashiName}) govern cashflow stability, reimbursements, and strategic savings decisions.`
    },
    {
      portfolio: 'Love',
      houses: [5, 7],
      title: 'Relational Clarity, Attraction & Interpersonal Dialogue',
      narrativeBuilder: links =>
        `5th Purva Punya (${links[0]?.rashiName}, Lord ${links[0]?.rashiLord}) & 7th Kalatra (${links[1]?.rashiName}) clarify emotional expectations, boundaries, or unresolved heart dialogues.`
    },
    {
      portfolio: 'Health',
      houses: [1, 8, 6],
      title: 'Somatic Stress Watch, Gut/Sleep Rhythm & Vitality Pacing',
      narrativeBuilder: links =>
        `Lagna (${links[0]?.rashiName}), 8th (${links[1]?.rashiName}) & 6th (${links[2]?.rashiName}) interact with ${adChamberDynamics.pdCleanName}'s anatomical seats (${gateDetails.map(g => g.anatomicalSeat).join(' / ')}); manage rest around Chandrashtama/Moon pulses.`
    },
    {
      portfolio: 'Life',
      houses: [4, 9],
      title: 'Domestic Sanctuary, Mother & Property/Home Focus',
      narrativeBuilder: links =>
        `4th Sukha (${links[0]?.rashiName}, Lord ${links[0]?.rashiLord}) & 9th Bhagya (${links[1]?.rashiName}) steer household upkeep, family conversations, and fixed asset planning.`
    },
    {
      portfolio: 'Friends',
      houses: [11, 3],
      title: 'Peer Circle Engagement, Social Exchanges & Advisory Support',
      narrativeBuilder: links =>
        `11th Network (${links[0]?.rashiName}, Lord ${links[0]?.rashiLord}) & 3rd Peers (${links[1]?.rashiName}) indicate selective reconnection or practical coordination with trusted associates.`
    },
    {
      portfolio: 'Trip',
      houses: [3, 9, 12],
      title: 'Short Movement, Paperwork Readiness & Long-Distance / Visa Planning',
      narrativeBuilder: links =>
        `3rd Short-Trip (${links[0]?.rashiName}), 9th Long-Journey (${links[1]?.rashiName}) & 12th Foreign (${links[2]?.rashiName}) regulate travel logistics, consular/official documentation, and commuting rhythm.`
    }
  ];

  portfolioTemplates.forEach((tpl, idx) => {
    const alreadyHas = events.some(e => e.portfolio.toLowerCase() === tpl.portfolio.toLowerCase() && e.probabilityScore >= 65);
    const matchedLinks = tpl.houses
      .map(h => houseLinks.find(l => l.houseFromLagna === h))
      .filter((x): x is HouseLordshipToGateLink => Boolean(x));

    const hasTransit = matchedLinks.some(l => l.transitOccupants.length > 0);
    const hasGate = matchedLinks.some(l => l.isActivatedByDeliveringHandGate);
    const hasAdLord = matchedLinks.some(l => l.isActivatedByAdLordship);
    const score = alreadyHas
      ? Math.max(40, (hasTransit ? 62 : 44) + (hasAdLord ? 10 : 0))
      : Math.min(84, (hasGate ? 66 : 48) + (hasTransit ? 14 : 0) + (hasAdLord ? 8 : 0));

    const moonWin =
      matchedLinks.find(l => l.moonIgnitionDates)?.moonIgnitionDates ||
      getMoonWindowForLagnaHouse(tpl.houses[0]);

    const housesDesc = matchedLinks
      .map(
        l =>
          `H${l.houseFromLagna}/M${l.houseFromMoon} ${l.rashiName} (Lord: ${l.rashiLord}${
            l.transitOccupants.length ? `; Transit: ${l.transitOccupants.join(', ')}` : ''
          })`
      )
      .join(' + ');

    const gateNote =
      matchedLinks.find(l => l.matchingGateNakshatra)?.matchingGateNakshatra ||
      adChamberDynamics.peakVentingGate;

    events.push({
      id: `det-portfolio-${tpl.portfolio.toLowerCase()}-${idx}`,
      title: tpl.title,
      portfolio: tpl.portfolio,
      probabilityScore: score,
      isHighProbability: score >= 60,
      latencyStatus: score >= 60 && moonWin ? 'acute_moon_triggered' : 'dormant_latent',
      hasMoonSupport: !!moonWin && (hasGate || hasTransit),
      moonWindowDates: moonWin,
      correlatedHousesAndLordships: housesDesc,
      nakshatraGateTrigger: `AD Chamber (${adChamberDynamics.adCleanName}) -> Gate: ${gateNote}`,
      narrative: tpl.narrativeBuilder(matchedLinks),
      source: 'deterministic_gate_candidate'
    });
  });

  // Deduplicate by title and sort highest probability first
  const seen = new Set<string>();
  return events
    .filter(ev => {
      const k = ev.title.toLowerCase().trim();
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    })
    .sort((a, b) => b.probabilityScore - a.probabilityScore);
}

export function buildEventManufacturingSnapshot(params: {
  selectedMonth: number;
  selectedYear: number;
  natalLagnaIdx: number;
  natalRashiIdx: number;
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
  overrideMd?: string;
  overrideAd?: string;
  overrideHandKey?: string;
  gatePerspectives?: Record<number, GatePerspective>;
  preSynthesizedEvents?: CorrelatedManufacturedEvent[] | ManufacturedEventItem[];
  preSynthesizedModel?: string;
  vedicSpecialEvents?: VedicWindowAnalysis;
}): EventManufacturingSupersetPayload {
  const selectedMd = normalizeLordKey(params.overrideMd || params.activeDashaHierarchy.mahadasha);
  const selectedAd = normalizeLordKey(params.overrideAd || params.activeDashaHierarchy.antardasha);
  const deliveringHandKey = normalizeLordKey(params.overrideHandKey || params.activeDashaHierarchy.pratyantardasha);
  const deliveringHandClean = cleanEnglishPlanetName(deliveringHandKey);
  const gatePerspectives: Record<number, GatePerspective> = {
    0: params.gatePerspectives?.[0] || 'combined',
    1: params.gatePerspectives?.[1] || 'combined',
    2: params.gatePerspectives?.[2] || 'combined'
  };

  const gateDetails = computeNakshatraGateDetails({
    deliveringHandKey,
    natalLagnaIdx: params.natalLagnaIdx,
    natalRashiIdx: params.natalRashiIdx,
    selectedMonth: params.selectedMonth,
    transitPlacements: params.transitPlacements || [],
    monthlyGrahaSpans: params.monthlyGrahaSpans || [],
    flattenedD1: params.flattenedD1 || [],
    monthlyMoonSpans: params.monthlyMoonSpans || []
  });

  const adChamberDynamics = computeADChamberDynamics({
    adLord: selectedAd,
    pdLord: deliveringHandKey,
    natalLagnaIdx: params.natalLagnaIdx,
    natalRashiIdx: params.natalRashiIdx,
    natalPlacements: params.flattenedD1 || [],
    transitPlacements: params.transitPlacements || [],
    monthlyMoonSpans: params.monthlyMoonSpans || []
  });

  const daysInMonth = new Date(params.selectedYear, params.selectedMonth + 1, 0).getDate();
  const mStr = String(params.selectedMonth + 1).padStart(2, '0');
  const vedicSpecialEvents =
    params.vedicSpecialEvents ||
    analyzeVedicWindowEvents({
      startDateStr: `${params.selectedYear}-${mStr}-01`,
      endDateStr: `${params.selectedYear}-${mStr}-${String(daysInMonth).padStart(2, '0')}`,
      natalLagnaIdx: params.natalLagnaIdx,
      natalRashiIdx: params.natalRashiIdx,
      flattenedNatalD1: (params.flattenedD1 || []).map((p: any) => ({
        body_name: p.body_name || '',
        rashi_name: p.rashi_name || ''
      }))
    });

  const houseLinks = buildHouseLordshipToGateLinks({
    natalLagnaIdx: params.natalLagnaIdx,
    natalRashiIdx: params.natalRashiIdx,
    selectedMonth: params.selectedMonth,
    flattenedD1: params.flattenedD1 || [],
    transitPlacements: params.transitPlacements || [],
    monthlyMoonSpans: params.monthlyMoonSpans || [],
    gateDetails,
    adChamberDynamics
  });

  const deterministicCandidates = buildDeterministicPortfolioCandidates({
    selectedMonth: params.selectedMonth,
    selectedYear: params.selectedYear,
    gateDetails,
    gatePerspectives,
    adChamberDynamics,
    houseLinks,
    vedicSpecialEvents
  });

  const liveRaw = params.preSynthesizedEvents || [];
  const usedLiveEventEngineEvents = liveRaw.length > 0;

  const liveConverted: CorrelatedManufacturedEvent[] = liveRaw.map((item: any, idx: number) => {
    const portfolio = item.portfolio || 'Life';
    const matchingLink =
      houseLinks.find(l => l.portfolioLabel.toLowerCase().startsWith(portfolio.toLowerCase())) ||
      houseLinks[0];
    const fallbackHouseDesc = matchingLink
      ? `Lagna H${matchingLink.houseFromLagna} / Moon H${matchingLink.houseFromMoon} (${matchingLink.rashiName}, Lord: ${matchingLink.rashiLord})`
      : `${adChamberDynamics.adCleanName} AD Chamber H${adChamberDynamics.adNatalHouseFromLagna}`;

    return {
      id: item.id || `live-evt-${idx + 1}`,
      title: item.title,
      portfolio,
      probabilityScore: item.probabilityScore ?? 65,
      isHighProbability: Boolean(item.isHighProbability ?? (item.probabilityScore ?? 65) >= 60),
      latencyStatus:
        item.latencyStatus ||
        (item.hasMoonSupport || (item.probabilityScore ?? 65) >= 60 ? 'acute_moon_triggered' : 'dormant_latent'),
      hasMoonSupport: Boolean(item.hasMoonSupport),
      moonWindowDates: item.moonWindowDates,
      correlatedHousesAndLordships: item.correlatedHousesAndLordships || fallbackHouseDesc,
      nakshatraGateTrigger: item.nakshatraGateTrigger || item.gateTrigger || adChamberDynamics.peakVentingGate,
      narrative: item.narrative,
      source: 'live_event_engine_llm'
    };
  });

  // Combine live events (if any) with deterministic gate/portfolio events, keeping top coverage across portfolios
  const combinedMap = new Map<string, CorrelatedManufacturedEvent>();
  for (const ev of [...liveConverted, ...deterministicCandidates]) {
    const key = `${ev.portfolio.toLowerCase()}::${ev.title.toLowerCase().slice(0, 32)}`;
    if (!combinedMap.has(key)) {
      combinedMap.set(key, ev);
    }
  }
  const combinedEvents = Array.from(combinedMap.values())
    .sort((a, b) => b.probabilityScore - a.probabilityScore)
    .slice(0, 16);

  const gates: SupersetNakshatraGateSummary[] = gateDetails.map((g, idx) => ({
    gateIndex: idx + 1,
    nakshatraName: g.nakshatraName,
    rashiIndex: g.rashiIndex,
    rashiName: cleanEnglishSignName(g.rashiName),
    houseFromLagna: g.houseFromLagna,
    houseFromRashi: g.houseFromRashi,
    perspective: gatePerspectives[idx] || 'combined',
    anatomicalSeat: g.anatomicalSeat,
    significations: g.significations,
    moonIngressWindow: g.moonIngressWindow,
    activeGrahasInGate: g.activeGrahasInGate
  }));

  return {
    generatedAt: new Date().toISOString(),
    selectedMd: cleanEnglishPlanetName(selectedMd),
    selectedAd: cleanEnglishPlanetName(selectedAd),
    deliveringHandKey,
    deliveringHandClean,
    adChamberSummary: {
      adCleanName: adChamberDynamics.adCleanName,
      adNatalRashiName: cleanEnglishSignName(adChamberDynamics.adNatalRashiName),
      adNatalHouseFromLagna: adChamberDynamics.adNatalHouseFromLagna,
      adNatalHouseFromRashi: adChamberDynamics.adNatalHouseFromRashi,
      polarityLabel: adChamberDynamics.polarityLabel,
      netScore: adChamberDynamics.netScore,
      peakVentingGate: adChamberDynamics.peakVentingGate,
      atmosphereNarrative: adChamberDynamics.chamberAtmosphereNarrative,
      directOccupants: adChamberDynamics.directOccupants.map(
        o =>
          `${o.cleanName}${o.dignity === 'exalted' ? ' [EXALTED]' : ''} (${
            o.pressurePoints > 0 ? `+${o.pressurePoints}` : o.pressurePoints
          } pts)`
      ),
      incomingAspects: adChamberDynamics.incomingAspects.map(
        a =>
          `${a.cleanName} [${a.aspectLabel} from H${a.sourceHouseFromLagna}] (${
            a.pressurePoints > 0 ? `+${a.pressurePoints}` : a.pressurePoints
          } pts)`
      ),
      ruledHouses: adChamberDynamics.ruledHouses.map(rh => ({
        houseFromLagna: rh.houseFromLagna,
        houseFromRashi: rh.houseFromRashi,
        rashiName: cleanEnglishSignName(rh.rashiName),
        occupants: rh.occupants,
        aspectingGrahas: rh.aspectingGrahas
      }))
    },
    gates,
    houseLordshipToGateLinks: houseLinks,
    candidateOrSynthesizedEvents: combinedEvents,
    usedLiveEventEngineEvents,
    eventEngineModelUsed: params.preSynthesizedModel
  };
}
