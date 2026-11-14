import { getGrahaTransitPosition, RASHI_LIST_META } from '../data/transitEphemeris';

export const SIGN_PRIMARY_LORD: Record<number, string> = {
  1: 'Mars',
  2: 'Venus',
  3: 'Mercury',
  4: 'Moon',
  5: 'Sun',
  6: 'Mercury',
  7: 'Venus',
  8: 'Mars',
  9: 'Jupiter',
  10: 'Saturn',
  11: 'Saturn',
  12: 'Jupiter'
};

export const DEBILITATION_SIGNS: Record<string, { signIdx: number; exaltSignIdx: number; exaltationLordOfDebSign: string }> = {
  Sun:     { signIdx: 7,  exaltSignIdx: 1,  exaltationLordOfDebSign: 'Saturn' },   // Libra debilitation (Saturn exalts in Libra)
  Moon:    { signIdx: 8,  exaltSignIdx: 2,  exaltationLordOfDebSign: 'Ketu' },     // Scorpio debilitation (no classical planet exalts in Scorpio)
  Mars:    { signIdx: 4,  exaltSignIdx: 10, exaltationLordOfDebSign: 'Jupiter' },  // Cancer debilitation (Jupiter exalts in Cancer)
  Mercury: { signIdx: 12, exaltSignIdx: 6,  exaltationLordOfDebSign: 'Venus' },    // Pisces debilitation (Venus exalts in Pisces)
  Jupiter: { signIdx: 10, exaltSignIdx: 4,  exaltationLordOfDebSign: 'Mars' },     // Capricorn debilitation (Mars exalts in Capricorn)
  Venus:   { signIdx: 6,  exaltSignIdx: 12, exaltationLordOfDebSign: 'Mercury' },  // Virgo debilitation (Mercury exalts in Virgo)
  Saturn:  { signIdx: 1,  exaltSignIdx: 7,  exaltationLordOfDebSign: 'Sun' }       // Aries debilitation (Sun exalts in Aries)
};

export const PLANET_DISPLAY: Record<string, string> = {
  Sun: 'Sun (Surya)',
  Moon: 'Moon (Chandra)',
  Mars: 'Mars (Sevvai)',
  Mercury: 'Mercury (Budha)',
  Jupiter: 'Jupiter (Guru)',
  Venus: 'Venus (Sukra)',
  Saturn: 'Saturn (Sani)',
  Rahu: 'Rahu',
  Ketu: 'Ketu'
};

export const OWNED_SIGNS_BY_PLANET: Record<string, number[]> = {
  Sun: [5],
  Moon: [4],
  Mars: [1, 8],
  Mercury: [3, 6],
  Jupiter: [9, 12],
  Venus: [2, 7],
  Saturn: [10, 11]
};

export interface SameSignMotionTransition {
  grahaKey: string;
  grahaName: string;
  signIndex: number;
  signName: string;
  houseFromLagna: number;
  houseFromMoon: number;
  turnType: 'Retrograde -> Direct' | 'Direct -> Retrograde';
  stationDate: string;
  beforeRange: string;
  afterRange: string;
  summary: string;
  eventImpact: string;
}

export interface ParivartanaYogaEvent {
  kind: 'Transit-Transit' | 'Transit-Natal';
  grahaA: string;
  grahaB: string;
  signAIndex: number;
  signAName: string;
  signBIndex: number;
  signBName: string;
  moonHouseA: number;
  moonHouseB: number;
  lagnaHouseA: number;
  lagnaHouseB: number;
  startDate: string;
  endDate: string;
  yogaClass: 'Maha Parivartana (Kendra/Trikona/Wealth)' | 'Kahala Parivartana' | 'Dainya / Karmic Parivartana';
  bhavaExchangeSummary: string;
  lordshipSummary: string;
  predictedEvents: string;
}

export interface DebilitationNeechaBhangaEvent {
  grahaKey: string;
  grahaName: string;
  signIndex: number;
  signName: string;
  houseFromLagna: number;
  houseFromMoon: number;
  startDate: string;
  endDate: string;
  motionState: 'Retrograde (Neecha-Vakra)' | 'Direct (Neecha-Direct)';
  neechaBhangaStatus: 'NEECHA BHANGA RAJA YOGA' | 'PARTIAL NEECHA BHANGA' | 'DEBILITATION (NEECHA)';
  cancellationReasons: string[];
  summary: string;
  predictedEvents: string;
}

export interface VedicWindowAnalysis {
  startDate: string;
  endDate: string;
  sameSignStations: SameSignMotionTransition[];
  parivartanaYogas: ParivartanaYogaEvent[];
  debilitationEvents: DebilitationNeechaBhangaEvent[];
  consolidatedOneLiner: string;
  possibleEventsSummary: string[];
  promptMarkdownBlock: string;
}

function getSignName(idx: number): string {
  return RASHI_LIST_META[idx - 1]?.eng || `Sign ${idx}`;
}

function getHouse(signIdx: number, baseIdx: number): number {
  return (((signIdx - baseIdx) % 12) + 12) % 12 + 1;
}

function isKendra(house: number): boolean {
  return house === 1 || house === 4 || house === 7 || house === 10;
}

function isMahaHouse(house: number): boolean {
  return [1, 2, 4, 5, 7, 9, 10, 11].includes(house);
}

function resolveSignIdxFromName(rashiName?: string): number | null {
  if (!rashiName) return null;
  const low = rashiName.toLowerCase();
  const keys = [
    ['mesham', 'aries'],
    ['rishab', 'taurus'],
    ['mithun', 'gemini'],
    ['katak', 'kadag', 'cancer'],
    ['simh', 'leo'],
    ['kanni', 'virgo'],
    ['thula', 'tula', 'libra'],
    ['vrisch', 'vrish', 'scorpio'],
    ['dhanu', 'sagitt'],
    ['makar', 'capri'],
    ['kumb', 'aquar'],
    ['meen', 'pisce']
  ];
  for (let i = 0; i < keys.length; i++) {
    if (keys[i].some(k => low.includes(k))) return i + 1;
  }
  return null;
}

function resolvePlanetKeyFromName(name?: string): string | null {
  if (!name) return null;
  const low = name.toLowerCase();
  for (const k of ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']) {
    if (low.includes(k.toLowerCase())) return k;
  }
  if (low.includes('surya') || low.includes('சூரிய')) return 'Sun';
  if (low.includes('chandra') || low.includes('சந்திர')) return 'Moon';
  if (low.includes('sevvai') || low.includes('mangal') || low.includes('செவ்வாய்')) return 'Mars';
  if (low.includes('budha') || low.includes('புதன்')) return 'Mercury';
  if (low.includes('guru') || low.includes('brihas') || low.includes('குரு')) return 'Jupiter';
  if (low.includes('sukra') || low.includes('shukra') || low.includes('சுக்கிர')) return 'Venus';
  if (low.includes('sani') || low.includes('shani') || low.includes('சனி')) return 'Saturn';
  return null;
}

function getHouseDomainLabel(house: number): string {
  const map: Record<number, string> = {
    1: 'Self / Health / Identity (1st)',
    2: 'Wealth / Family / Speech (2nd)',
    3: 'Courage / Communication / Short Travel (3rd)',
    4: 'Home / Assets / Mother / Peace (4th)',
    5: 'Creativity / Speculation / Children / Intelligence (5th)',
    6: 'Work / Disputes / Loans / Health Recovery (6th)',
    7: 'Partnerships / Marriage / Contracts / Public Dealings (7th)',
    8: 'Transformation / Inheritance / Research / Hidden Obstacles (8th)',
    9: 'Fortune / Higher Authorities / Dharma / Long Travel (9th)',
    10: 'Career / Status / Executive Power / Karma (10th)',
    11: 'Gains / Income / Networks / Fulfillment (11th)',
    12: 'Expenses / Foreign / Isolation / Liberation (12th)'
  };
  return map[house] || `${house}th Bhava`;
}

function buildParivartanaForecast(
  grahaA: string,
  grahaB: string,
  moonHouseA: number,
  moonHouseB: number,
  lagnaHouseA: number,
  lagnaHouseB: number
): string {
  const pair = [grahaA, grahaB].sort().join('+');
  const houses = new Set([moonHouseA, moonHouseB, lagnaHouseA, lagnaHouseB]);

  if (pair === 'Mars+Sun') {
    if (houses.has(10) || houses.has(1) || houses.has(9)) {
      return 'Strong executive & authority breakthrough: leadership recognition, government/institutional approvals, decisive career moves, heightened willpower and bold action turning stagnant matters into forward command (watch against ego clashes or heated communication).';
    }
    return 'High-energy Surya–Mangala mutual empowerment: courage, competitive victory, property/technical action, and authoritative resolution of pending administrative hurdles.';
  }
  if (houses.has(10) && (houses.has(1) || houses.has(9) || houses.has(11))) {
    return 'Career & Gains Parivartana: professional elevation, role expansion, recognition from seniors, and direct conversion of effort into tangible status or income.';
  }
  if (houses.has(2) && houses.has(11)) {
    return 'Dhana–Labha Parivartana: strong liquidity flow, receivables clearing, bonus/commission opportunities, and financial strengthening.';
  }
  if (houses.has(7) || houses.has(5)) {
    return 'Relationship & Partnership Parivartana: mutual agreements, contract signings, romantic clarity, or collaborative breakthroughs.';
  }
  return `Mutual Bhava Exchange connecting ${getHouseDomainLabel(moonHouseA)} and ${getHouseDomainLabel(moonHouseB)} from Moon — planets support each other\'s portfolios with decisive reciprocal results.`;
}

function buildStationForecast(grahaKey: string, turnType: 'Retrograde -> Direct' | 'Direct -> Retrograde', signName: string, moonHouse: number): string {
  if (turnType === 'Retrograde -> Direct') {
    switch (grahaKey) {
      case 'Mercury':
        return `Mercury turning Direct in ${signName} (H${moonHouse} from Moon) releases frozen contracts, stalled emails, banking/documentation delays, and miscommunications into immediate forward execution.`;
      case 'Venus':
        return `Venus turning Direct in ${signName} (H${moonHouse} from Moon) unblocks stalled finances, receivables, relationship clarity, luxury/comfort decisions, and creative partnerships.`;
      case 'Mars':
        return `Mars turning Direct in ${signName} (H${moonHouse} from Moon) restores physical drive, stalled property/engineering tasks, and decisive action after internal friction.`;
      case 'Jupiter':
        return `Jupiter turning Direct in ${signName} (H${moonHouse} from Moon) brings external fruition to wisdom, legal/visa approvals, financial expansion, and mentor support.`;
      case 'Saturn':
        return `Saturn turning Direct in ${signName} (H${moonHouse} from Moon) resumes long-term career structure, pending judicial/institutional duties, and steady karmic delivery.`;
    }
  } else {
    switch (grahaKey) {
      case 'Mercury':
        return `Mercury turning Retrograde in ${signName} (H${moonHouse} from Moon) triggers re-negotiation, double-checking paperwork, revisiting old contacts, and audit/revision of decisions.`;
      case 'Venus':
        return `Venus turning Retrograde in ${signName} (H${moonHouse} from Moon) prompts reassessment of relationships, past financial commitments, valuation reviews, and reconnecting with past ties.`;
      case 'Mars':
        return `Mars turning Retrograde in ${signName} (H${moonHouse} from Moon) turns assertive energy inward—expect reworking technical plans, avoiding impulsive confrontations, and revisiting stalled projects.`;
      case 'Jupiter':
        return `Jupiter turning Retrograde in ${signName} (H${moonHouse} from Moon) shifts wisdom & expansion inward—reviewing long-term investments, spiritual study, and re-evaluating promises before final sanction.`;
      case 'Saturn':
        return `Saturn turning Retrograde in ${signName} (H${moonHouse} from Moon) initiates karmic audit of past duties, restructuring delays, and unconventional paths to resolve backlog.`;
    }
  }
  return `${grahaKey} ${turnType} station in ${signName} (H${moonHouse} from Moon) marks a clear pivot in pacing.`;
}

function buildDebilitationForecast(
  grahaKey: string,
  motionState: string,
  status: string,
  moonHouse: number
): string {
  const isVakra = motionState.includes('Retrograde');
  const hasBhanga = status !== 'DEBILITATION (NEECHA)';
  const baseDomain: Record<string, string> = {
    Sun: 'authority, father/boss dynamics, vitality, and confidence',
    Moon: 'emotional sensitivity, peace of mind, and domestic calm',
    Mars: 'patience, domestic peace, property/vehicle pressure, and energy pacing',
    Mercury: 'communication precision, contracts, and analytical judgement',
    Jupiter: 'optimism, financial prudence, legal/ethical alignment, and advisory support',
    Venus: 'relationships, financial expectations, comfort, and diplomacy',
    Saturn: 'discipline, patience with delays, and structural stamina'
  };
  const dom = baseDomain[grahaKey] || 'significations';

  if (isVakra && hasBhanga) {
    return `${grahaKey} in Neecha-Vakra with Neecha Bhanga (H${moonHouse} from Moon): initial vulnerability or hyper-criticism around ${dom} reverses strongly into unconventional gains and hidden strength once stabilized.`;
  }
  if (hasBhanga) {
    return `${grahaKey} Debilitated with ${status} (H${moonHouse} from Moon): initial test, extra effort, or compromise around ${dom} is cancelled out and elevates into practical achievement/recovery during the window.`;
  }
  if (isVakra) {
    return `${grahaKey} Neecha-Vakra (H${moonHouse} from Moon): retrograde motion inside debilitation creates intense internal pressure and reversal dynamics around ${dom} until direct station.`;
  }
  return `${grahaKey} Debilitated (H${moonHouse} from Moon): exercise diplomacy, patience, and realistic expectations regarding ${dom}; avoid over-criticality or impulsive commitments.`;
}

export function analyzeVedicWindowEvents(params: {
  startDateStr: string;
  endDateStr: string;
  natalLagnaIdx: number;
  natalRashiIdx: number;
  flattenedNatalD1?: Array<{ body_name: string; rashi_name: string }>;
  overrides?: Record<string, number>;
}): VedicWindowAnalysis {
  const {
    startDateStr,
    endDateStr,
    natalLagnaIdx,
    natalRashiIdx,
    flattenedNatalD1 = [],
    overrides = {}
  } = params;

  const parseMiddayUtc = (ds: string) =>
    /^\d{4}-\d{2}-\d{2}$/.test(ds.trim()) ? new Date(`${ds.trim()}T12:00:00Z`) : new Date(ds);

  const dStart = parseMiddayUtc(startDateStr);
  const dEnd = parseMiddayUtc(endDateStr);

  if (isNaN(dStart.getTime()) || isNaN(dEnd.getTime()) || dStart > dEnd) {
    return {
      startDate: startDateStr,
      endDate: endDateStr,
      sameSignStations: [],
      parivartanaYogas: [],
      debilitationEvents: [],
      consolidatedOneLiner: 'No valid date window specified.',
      possibleEventsSummary: [],
      promptMarkdownBlock: ''
    };
  }

  const DAY_MS = 24 * 60 * 60 * 1000;
  const totalDays = Math.max(1, Math.round((dEnd.getTime() - dStart.getTime()) / DAY_MS) + 1);
  // 1-day precision up to 420 days (~14 months), 2-day up to 1500 days (~4 years), 3-day beyond
  const stepDays = totalDays > 1500 ? 3 : (totalDays > 420 ? 2 : 1);

  const taraGrahas = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
  const sevenGrahas = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  const parivartanaGrahas = ['Sun', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']; // Exclude 2.25-day Moon noise from multi-week yoga alerts unless single-month

  // Map natal D1 planet positions for Neecha Bhanga & Transit-Natal Parivartana checks
  const natalPlanetSigns: Record<string, number> = {};
  for (const np of flattenedNatalD1) {
    const pKey = resolvePlanetKeyFromName(np.body_name);
    const sIdx = resolveSignIdxFromName(np.rashi_name);
    if (pKey && sIdx) natalPlanetSigns[pKey] = sIdx;
  }

  const getDailySnapshot = (dt: Date) => {
    const map: Record<string, { signIdx: number; isRetro: boolean; houseLagna: number; houseMoon: number }> = {};
    for (const g of sevenGrahas) {
      const ov = overrides[g];
      if (ov && ov >= 1 && ov <= 12) {
        map[g] = {
          signIdx: ov,
          isRetro: false,
          houseLagna: getHouse(ov, natalLagnaIdx),
          houseMoon: getHouse(ov, natalRashiIdx)
        };
      } else {
        const pos = getGrahaTransitPosition(g, dt, natalLagnaIdx, natalRashiIdx);
        map[g] = {
          signIdx: pos.transit_rashi_index,
          isRetro: pos.is_retrograde,
          houseLagna: pos.relative_to_natal_lagna.house_number,
          houseMoon: pos.relative_to_natal_rashi.house_number
        };
      }
    }
    return map;
  };

  // Collect sampled days (always includes last day)
  const sampleDates: Date[] = [];
  for (let ms = dStart.getTime(); ms <= dEnd.getTime(); ms += stepDays * DAY_MS) {
    sampleDates.push(new Date(ms));
  }
  const lastSampleStr = sampleDates[sampleDates.length - 1]?.toISOString().slice(0, 10);
  const dEndStr = dEnd.toISOString().slice(0, 10);
  if (lastSampleStr !== dEndStr) {
    sampleDates.push(new Date(dEnd));
  }

  const snapshots = sampleDates.map(dt => ({
    dateStr: dt.toISOString().slice(0, 10),
    dt,
    planets: getDailySnapshot(dt)
  }));

  // 1. Detect Same-Sign Retrograde <-> Direct Stations
  const sameSignStations: SameSignMotionTransition[] = [];
  for (const g of taraGrahas) {
    interface PhaseSegment {
      signIdx: number;
      isRetro: boolean;
      startDate: string;
      endDate: string;
    }
    const phases: PhaseSegment[] = [];
    for (const snap of snapshots) {
      const st = snap.planets[g];
      const last = phases[phases.length - 1];
      if (!last || last.signIdx !== st.signIdx || last.isRetro !== st.isRetro) {
        phases.push({
          signIdx: st.signIdx,
          isRetro: st.isRetro,
          startDate: snap.dateStr,
          endDate: snap.dateStr
        });
      } else {
        last.endDate = snap.dateStr;
      }
    }

    for (let i = 1; i < phases.length; i++) {
      const prev = phases[i - 1];
      const curr = phases[i];
      if (prev.signIdx === curr.signIdx && prev.isRetro !== curr.isRetro) {
        const turnType: 'Retrograde -> Direct' | 'Direct -> Retrograde' =
          !curr.isRetro ? 'Retrograde -> Direct' : 'Direct -> Retrograde';
        const signName = getSignName(curr.signIdx);
        const hLagna = getHouse(curr.signIdx, natalLagnaIdx);
        const hMoon = getHouse(curr.signIdx, natalRashiIdx);
        const gName = PLANET_DISPLAY[g] || g;
        sameSignStations.push({
          grahaKey: g,
          grahaName: gName,
          signIndex: curr.signIdx,
          signName,
          houseFromLagna: hLagna,
          houseFromMoon: hMoon,
          turnType,
          stationDate: curr.startDate,
          beforeRange: `${prev.startDate} to ${prev.endDate}`,
          afterRange: `${curr.startDate} to ${curr.endDate}`,
          summary: `${gName} stations ${turnType === 'Retrograde -> Direct' ? 'DIRECT' : 'RETROGRADE'} inside ${signName} (H${hMoon} from Moon, H${hLagna} from Lagna) on ${curr.startDate} (${prev.isRetro ? 'Retro' : 'Direct'} ${prev.startDate}→${prev.endDate}, then ${curr.isRetro ? 'Retro' : 'Direct'} ${curr.startDate}→${curr.endDate})`,
          eventImpact: buildStationForecast(g, turnType, signName, hMoon)
        });
      }
    }
  }

  // 2. Detect Transit-Transit Parivartana Yogas (Sign & Bhava Mutual Exchanges)
  const parivartanaMap = new Map<string, ParivartanaYogaEvent>();
  const activeParivartanaKeysYesterday = new Set<string>();
  const activeParivartanaPairsByDate: Array<Set<string>> = [];

  for (let sIdx = 0; sIdx < snapshots.length; sIdx++) {
    const snap = snapshots[sIdx];
    const pSet = new Set<string>();
    const activePairKeysToday = new Set<string>();
    const pairList = totalDays <= 45 ? sevenGrahas : parivartanaGrahas;

    for (let i = 0; i < pairList.length; i++) {
      for (let j = i + 1; j < pairList.length; j++) {
        const gA = pairList[i];
        const gB = pairList[j];
        const stA = snap.planets[gA];
        const stB = snap.planets[gB];
        if (!stA || !stB || stA.signIdx === stB.signIdx) continue;

        const lordOfSignA = SIGN_PRIMARY_LORD[stA.signIdx];
        const lordOfSignB = SIGN_PRIMARY_LORD[stB.signIdx];
        if (lordOfSignA === gB && lordOfSignB === gA) {
          pSet.add(gA);
          pSet.add(gB);
          const key = `${gA}-${gB}-${stA.signIdx}-${stB.signIdx}`;
          activePairKeysToday.add(key);

          const mHA = stA.houseMoon;
          const mHB = stB.houseMoon;
          const lHA = stA.houseLagna;
          const lHB = stB.houseLagna;

          const existing = activeParivartanaKeysYesterday.has(key) ? parivartanaMap.get(`${key}@open`) : undefined;
          if (existing) {
            existing.endDate = snap.dateStr;
          } else {
            const isDainya = [6, 8, 12].includes(mHA) || [6, 8, 12].includes(mHB);
            const isMaha = !isDainya && isMahaHouse(mHA) && isMahaHouse(mHB);
            const yogaClass: ParivartanaYogaEvent['yogaClass'] = isMaha
              ? 'Maha Parivartana (Kendra/Trikona/Wealth)'
              : isDainya
              ? 'Dainya / Karmic Parivartana'
              : 'Kahala Parivartana';

            const sAName = getSignName(stA.signIdx);
            const sBName = getSignName(stB.signIdx);
            const evt: ParivartanaYogaEvent = {
              kind: 'Transit-Transit',
              grahaA: gA,
              grahaB: gB,
              signAIndex: stA.signIdx,
              signAName: sAName,
              signBIndex: stB.signIdx,
              signBName: sBName,
              moonHouseA: mHA,
              moonHouseB: mHB,
              lagnaHouseA: lHA,
              lagnaHouseB: lHB,
              startDate: snap.dateStr,
              endDate: snap.dateStr,
              yogaClass,
              bhavaExchangeSummary: `From Moon: ${gA} in H${mHA} (${sAName}) ↔ ${gB} in H${mHB} (${sBName}) | From Lagna: H${lHA} ↔ H${lHB}`,
              lordshipSummary: `${gA} (Lord of ${sBName}, H${mHB} from Moon / H${lHB} from Lagna) sits in ${sAName} (H${mHA}), while ${gB} (Lord of ${sAName}, H${mHA} from Moon / H${lHA} from Lagna) sits in ${sBName} (H${mHB}).`,
              predictedEvents: buildParivartanaForecast(gA, gB, mHA, mHB, lHA, lHB)
            };
            parivartanaMap.set(`${key}@open`, evt);
          }
        }
      }
    }

    // Close any parivartana that ended before today
    for (const prevKey of Array.from(activeParivartanaKeysYesterday)) {
      if (!activePairKeysToday.has(prevKey)) {
        const openEvt = parivartanaMap.get(`${prevKey}@open`);
        if (openEvt) {
          parivartanaMap.delete(`${prevKey}@open`);
          parivartanaMap.set(`${prevKey}@${openEvt.startDate}`, openEvt);
        }
        activeParivartanaKeysYesterday.delete(prevKey);
      }
    }
    for (const k of activePairKeysToday) {
      activeParivartanaKeysYesterday.add(k);
    }
    activeParivartanaPairsByDate.push(pSet);
  }

  // Finalize any still-open parivartanas
  const parivartanaYogas: ParivartanaYogaEvent[] = [];
  for (const [, val] of parivartanaMap.entries()) {
    parivartanaYogas.push(val);
  }
  parivartanaYogas.sort((a, b) => a.startDate.localeCompare(b.startDate));

  // 3. Detect Debilitation (Neecha) & Neecha Bhanga Windows (split by Retrograde vs Direct)
  const debilitationEvents: DebilitationNeechaBhangaEvent[] = [];
  const debCheckGrahas = ['Sun', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

  for (const g of debCheckGrahas) {
    const debMeta = DEBILITATION_SIGNS[g];
    if (!debMeta) continue;

    interface DebSegment {
      startDate: string;
      endDate: string;
      isRetro: boolean;
      reasons: Set<string>;
    }
    const segs: DebSegment[] = [];

    for (let sIdx = 0; sIdx < snapshots.length; sIdx++) {
      const snap = snapshots[sIdx];
      const st = snap.planets[g];
      if (!st || st.signIdx !== debMeta.signIdx) continue;

      // Evaluate classical Neecha Bhanga criteria on this date
      const reasonsToday: string[] = [];
      const dispLord = SIGN_PRIMARY_LORD[debMeta.signIdx];
      const exaltLord = debMeta.exaltationLordOfDebSign;
      const ownExaltLord = SIGN_PRIMARY_LORD[debMeta.exaltSignIdx];

      if (st.isRetro) {
        reasonsToday.push(`${g} is Retrograde (Neecha-Vakra) inside debilitation, reversing weakness into unconventional strength`);
      }

      // Check Transit Dispositor in Kendra from Moon or Lagna
      const dispTransit = snap.planets[dispLord];
      if (dispTransit && (isKendra(dispTransit.houseMoon) || isKendra(dispTransit.houseLagna))) {
        reasonsToday.push(
          `Debilitation sign lord ${dispLord} transits Kendra (${isKendra(dispTransit.houseMoon) ? `H${dispTransit.houseMoon} from Moon` : `H${dispTransit.houseLagna} from Lagna`})`
        );
      }

      // Check Natal Dispositor in Kendra from Moon or Lagna
      const dispNatalSign = natalPlanetSigns[dispLord];
      if (dispNatalSign) {
        const dispNatalHMoon = getHouse(dispNatalSign, natalRashiIdx);
        const dispNatalHLagna = getHouse(dispNatalSign, natalLagnaIdx);
        if (isKendra(dispNatalHMoon) || isKendra(dispNatalHLagna)) {
          reasonsToday.push(
            `Natal ${dispLord} (dispositor of ${getSignName(debMeta.signIdx)}) sits in Kendra (H${dispNatalHLagna} Lagna / H${dispNatalHMoon} Moon)`
          );
        }
      }

      // Check Exaltation lord of that debilitation sign in Kendra (transit or natal)
      const exTransit = snap.planets[exaltLord];
      if (exTransit && (isKendra(exTransit.houseMoon) || isKendra(exTransit.houseLagna))) {
        reasonsToday.push(
          `Exaltation lord ${exaltLord} of ${getSignName(debMeta.signIdx)} transits Kendra (${isKendra(exTransit.houseMoon) ? `H${exTransit.houseMoon} from Moon` : `H${exTransit.houseLagna} from Lagna`})`
        );
      }
      const exNatalSign = natalPlanetSigns[exaltLord];
      if (exNatalSign) {
        const exNHMoon = getHouse(exNatalSign, natalRashiIdx);
        const exNHLagna = getHouse(exNatalSign, natalLagnaIdx);
        if (isKendra(exNHMoon) || isKendra(exNHLagna)) {
          reasonsToday.push(
            `Natal ${exaltLord} (planet exalted in ${getSignName(debMeta.signIdx)}) occupies Kendra (H${exNHLagna} Lagna / H${exNHMoon} Moon)`
          );
        }
      }

      // Check Conjunction or 7th mutual aspect with Dispositor
      if (dispTransit && (dispTransit.signIdx === st.signIdx || Math.abs(dispTransit.signIdx - st.signIdx) === 6)) {
        reasonsToday.push(
          `${g} receives ${dispTransit.signIdx === st.signIdx ? 'conjunction' : 'direct 7th aspect'} from dispositor ${dispLord}`
        );
      }

      // Check Own Exaltation Sign Lord in Kendra (e.g. for Venus debilitation in Virgo, Pisces lord Jupiter in Kendra; for Sun in Libra, Aries lord Mars in Kendra)
      const ownExTransit = ownExaltLord ? snap.planets[ownExaltLord] : undefined;
      if (ownExTransit && (isKendra(ownExTransit.houseMoon) || isKendra(ownExTransit.houseLagna))) {
        reasonsToday.push(
          `Lord of ${g}'s exaltation sign (${ownExaltLord}) transits Kendra (${isKendra(ownExTransit.houseMoon) ? `H${ownExTransit.houseMoon} from Moon` : `H${ownExTransit.houseLagna} from Lagna`})`
        );
      }

      // Check if in active Parivartana
      if (activeParivartanaPairsByDate[sIdx]?.has(g)) {
        reasonsToday.push(`${g} participates in an active Parivartana mutual sign exchange`);
      }

      const lastSeg = segs[segs.length - 1];
      const prevDayMs = snap.dt.getTime() - stepDays * DAY_MS;
      const isConsecutive = lastSeg && Math.abs(new Date(`${lastSeg.endDate}T12:00:00Z`).getTime() - prevDayMs) <= stepDays * DAY_MS + 1000;

      if (lastSeg && isConsecutive && lastSeg.isRetro === st.isRetro) {
        lastSeg.endDate = snap.dateStr;
        reasonsToday.forEach(r => lastSeg.reasons.add(r));
      } else {
        segs.push({
          startDate: snap.dateStr,
          endDate: snap.dateStr,
          isRetro: st.isRetro,
          reasons: new Set(reasonsToday)
        });
      }
    }

    for (const seg of segs) {
      const reasonList = Array.from(seg.reasons);
      const status: DebilitationNeechaBhangaEvent['neechaBhangaStatus'] =
        reasonList.length >= 2
          ? 'NEECHA BHANGA RAJA YOGA'
          : reasonList.length === 1
          ? 'PARTIAL NEECHA BHANGA'
          : 'DEBILITATION (NEECHA)';

      const signName = getSignName(debMeta.signIdx);
      const hLagna = getHouse(debMeta.signIdx, natalLagnaIdx);
      const hMoon = getHouse(debMeta.signIdx, natalRashiIdx);
      const motionState: DebilitationNeechaBhangaEvent['motionState'] = seg.isRetro
        ? 'Retrograde (Neecha-Vakra)'
        : 'Direct (Neecha-Direct)';
      const gName = PLANET_DISPLAY[g] || g;

      debilitationEvents.push({
        grahaKey: g,
        grahaName: gName,
        signIndex: debMeta.signIdx,
        signName,
        houseFromLagna: hLagna,
        houseFromMoon: hMoon,
        startDate: seg.startDate,
        endDate: seg.endDate,
        motionState,
        neechaBhangaStatus: status,
        cancellationReasons: reasonList,
        summary: `${gName} Debilitated in ${signName} (H${hMoon} from Moon / H${hLagna} from Lagna) [${seg.startDate} → ${seg.endDate}] — ${motionState} — Status: ${status}`,
        predictedEvents: buildDebilitationForecast(g, motionState, status, hMoon)
      });
    }
  }

  // 4. Build Consolidated One-Liner & Possible Events List
  const oneLinerParts: string[] = [];
  const possibleEventsSummary: string[] = [];

  if (sameSignStations.length > 0) {
    const stationBits = sameSignStations.map(
      s => `${s.grahaKey} turns ${s.turnType === 'Retrograde -> Direct' ? 'Direct' : 'Retrograde'} in ${s.signName.split(' ')[0]} on ${s.stationDate}`
    );
    oneLinerParts.push(`Stations: ${stationBits.join('; ')}`);
    sameSignStations.forEach(s => possibleEventsSummary.push(`[Motion Pivot — ${s.stationDate}] ${s.eventImpact}`));
  }

  if (parivartanaYogas.length > 0) {
    const pariBits = parivartanaYogas.map(
      p => `${p.grahaA}↔${p.grahaB} Parivartana (H${p.moonHouseA}/H${p.moonHouseB} Moon, ${p.startDate}→${p.endDate})`
    );
    oneLinerParts.push(`Parivartana: ${pariBits.join('; ')}`);
    parivartanaYogas.forEach(p =>
      possibleEventsSummary.push(`[${p.yogaClass} — ${p.startDate}→${p.endDate}] ${p.predictedEvents}`)
    );
  }

  if (debilitationEvents.length > 0) {
    const debBits = debilitationEvents.map(
      d => `${d.grahaKey} ${d.neechaBhangaStatus === 'DEBILITATION (NEECHA)' ? 'Neecha' : 'Neecha-Bhanga'} in ${d.signName.split(' ')[0]} (${d.startDate}→${d.endDate}, ${d.motionState.includes('Retrograde') ? 'Vakra' : 'Direct'})`
    );
    oneLinerParts.push(`Debilitation/Neecha Bhanga: ${debBits.join('; ')}`);
    debilitationEvents.forEach(d =>
      possibleEventsSummary.push(`[${d.neechaBhangaStatus} — ${d.startDate}→${d.endDate}] ${d.predictedEvents}`)
    );
  }

  const consolidatedOneLiner =
    oneLinerParts.length > 0
      ? `${oneLinerParts.join(' | ')}.`
      : `Standard planetary flow across ${startDateStr} to ${endDateStr} with no same-sign stations, mutual Parivartana sign exchanges, or debilitation windows.`;

  // 5. Build Structured Prompt Block for LLM
  const lines: string[] = [];
  lines.push(`### CRITICAL TRANSIT PHENOMENA: SAME-SIGN MOTION STATIONS, PARIVARTANA YOGAS & NEECHA BHANGA (${startDateStr} to ${endDateStr})`);
  lines.push(`[MANDATORY EVALUATION RULE: You MUST explicitly analyze every retrograde↔direct station inside the same house, every Parivartana mutual exchange (at both Bhava and Sign-Lord levels), and every Debilitation/Neecha Bhanga reversal listed below with exact date windows and concrete likely events.]`);
  lines.push(`\n**CONSOLIDATED WINDOW ONE-LINER:** ${consolidatedOneLiner}`);

  if (sameSignStations.length > 0) {
    lines.push(`\n#### A. Retrograde ↔ Direct Motion Shifts Inside Same Sign/House (${sameSignStations.length}):`);
    sameSignStations.forEach(s => {
      lines.push(`  • ${s.summary}`);
      lines.push(`    -> Likely Event Pivot: ${s.eventImpact}`);
    });
  } else {
    lines.push(`\n#### A. Retrograde ↔ Direct Motion Shifts Inside Same Sign: None during ${startDateStr} to ${endDateStr}.`);
  }

  if (parivartanaYogas.length > 0) {
    lines.push(`\n#### B. Parivartana Yoga (Sign-Lord & Bhava-Level Mutual Exchanges) (${parivartanaYogas.length}):`);
    parivartanaYogas.forEach(p => {
      lines.push(`  • **${p.grahaA} ↔ ${p.grahaB} ${p.yogaClass}** [${p.startDate} → ${p.endDate}]`);
      lines.push(`    - ${p.bhavaExchangeSummary}`);
      lines.push(`    - Sign-Lord Exchange: ${p.lordshipSummary}`);
      lines.push(`    - Predicted Manifestation: ${p.predictedEvents}`);
    });
  } else {
    lines.push(`\n#### B. Parivartana Yoga (Mutual Sign/Bhava Exchanges): None active during ${startDateStr} to ${endDateStr}.`);
  }

  if (debilitationEvents.length > 0) {
    lines.push(`\n#### C. Debilitation (Neecha) & Neecha Bhanga Cancellation Windows (${debilitationEvents.length}):`);
    debilitationEvents.forEach(d => {
      lines.push(`  • **${d.summary}**`);
      if (d.cancellationReasons.length > 0) {
        lines.push(`    - Cancellation Factors: ${d.cancellationReasons.join(' | ')}`);
      }
      lines.push(`    - Predicted Manifestation: ${d.predictedEvents}`);
    });
  } else {
    lines.push(`\n#### C. Debilitation (Neecha) & Neecha Bhanga Windows: None active during ${startDateStr} to ${endDateStr}.`);
  }

  return {
    startDate: startDateStr,
    endDate: endDateStr,
    sameSignStations,
    parivartanaYogas,
    debilitationEvents,
    consolidatedOneLiner,
    possibleEventsSummary,
    promptMarkdownBlock: lines.join('\n')
  };
}
