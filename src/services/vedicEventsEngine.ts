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
  Moon:    { signIdx: 8,  exaltSignIdx: 2,  exaltationLordOfDebSign: '' },         // Scorpio debilitation (no classical planet exalts in Scorpio)
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
  stationDegree?: string;
  stationTimeUtc?: string;
  stationTimestampUtc?: string;
  stationIstDate?: string;
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
  startTimestampUtc?: string;
  endTimestampUtc?: string;
  startIstDate?: string;
  endIstDate?: string;
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
  startTimestampUtc?: string;
  endTimestampUtc?: string;
  startIstDate?: string;
  endIstDate?: string;
  motionState: 'Retrograde (Neecha-Vakra)' | 'Direct (Neecha-Direct)';
  neechaBhangaStatus: 'NEECHA BHANGA RAJA YOGA' | 'PARTIAL NEECHA BHANGA' | 'DEBILITATION (NEECHA)';
  cancellationReasons: string[];
  summary: string;
  predictedEvents: string;
}

export interface SignIngressEvent {
  grahaKey: string;
  grahaName: string;
  fromSignIndex: number;
  fromSignName: string;
  toSignIndex: number;
  toSignName: string;
  toHouseFromLagna: number;
  toHouseFromMoon: number;
  ingressDate: string;
  ingressTimestampUtc?: string;
  ingressIstDate?: string;
  isPriorMonthBoundary: boolean;
  motionType: 'Normal' | 'Vakra' | 'Adisara';
  summary: string;
  eventImpact: string;
}

export interface AdisaraMotionEvent {
  grahaKey: string;
  grahaName: string;
  signNames: string[];
  startDate: string;
  endDate: string;
  houseFromLagna: number;
  houseFromMoon: number;
  summary: string;
  eventImpact: string;
}

export interface VedicWindowAnalysis {
  startDate: string;
  endDate: string;
  priorTailStartDate?: string;
  sameSignStations: SameSignMotionTransition[];
  parivartanaYogas: ParivartanaYogaEvent[];
  debilitationEvents: DebilitationNeechaBhangaEvent[];
  boundaryIngresses: SignIngressEvent[];
  adisaraWindows: AdisaraMotionEvent[];
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
  priorTailDays?: number;
}): VedicWindowAnalysis {
  const {
    startDateStr,
    endDateStr,
    natalLagnaIdx,
    natalRashiIdx,
    flattenedNatalD1 = [],
    overrides = {},
    priorTailDays
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
      boundaryIngresses: [],
      adisaraWindows: [],
      consolidatedOneLiner: 'No valid date window specified.',
      possibleEventsSummary: [],
      promptMarkdownBlock: ''
    };
  }

  const DAY_MS = 24 * 60 * 60 * 1000;
  const HOUR_MS = 60 * 60 * 1000;
  const MIN_MS = 60 * 1000;
  const IST_OFFSET_MS = (5 * 60 + 30) * MIN_MS;
  const toUtcIsoMin = (ms: number) => `${new Date(ms).toISOString().slice(0, 16)}Z`;
  const toIstDate = (ms: number) => new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);

  const formatKendraFrameText = (hLagna: number, hMoon: number): string | null => {
    const kL = isKendra(hLagna);
    const kM = isKendra(hMoon);
    if (kL && kM) return `H${hLagna} from Lagna / H${hMoon} from Moon`;
    if (kL) return `H${hLagna} from Lagna`;
    if (kM) return `H${hMoon} from Moon`;
    return null;
  };

  const totalDays = Math.max(1, Math.round((dEnd.getTime() - dStart.getTime()) / DAY_MS) + 1);
  const isShortWindow = totalDays <= 60;
  // 1-day precision up to 420 days (~14 months), 2-day up to 1500 days (~4 years), 3-day beyond
  const stepDays = totalDays > 1500 ? 3 : (totalDays > 420 ? 2 : 1);
  // Automatically look back 3 days into prior month for monthly/short windows so cross-month boundary ingresses (e.g., Oct 31 -> Nov 1) are never lost
  const effectiveLookbackDays = typeof priorTailDays === 'number'
    ? Math.max(0, priorTailDays)
    : (totalDays <= 45 ? 3 : 0);
  const dScanStart = new Date(dStart.getTime() - effectiveLookbackDays * DAY_MS);
  const scanStartStr = dScanStart.toISOString().slice(0, 10);

  const dStartCanonStr = dStart.toISOString().slice(0, 10);
  const dEndCanonStr = dEnd.toISOString().slice(0, 10);
  const targetStartMs = Date.UTC(dStart.getUTCFullYear(), dStart.getUTCMonth(), dStart.getUTCDate(), 0, 0, 0);
  const targetEndMs = Date.UTC(dEnd.getUTCFullYear(), dEnd.getUTCMonth(), dEnd.getUTCDate(), 23, 59, 0);
  const scanStartUtcMs = Date.UTC(dScanStart.getUTCFullYear(), dScanStart.getUTCMonth(), dScanStart.getUTCDate(), 0, 0, 0);

  const taraGrahas = ['Mercury', 'Venus', 'Mars', 'Jupiter', 'Saturn'];
  const sevenGrahas = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  const allTrackedIngresses = ['Jupiter', 'Saturn', 'Mars', 'Sun', 'Mercury', 'Venus', 'Rahu', 'Ketu'];
  const parivartanaGrahas = ['Sun', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']; // Exclude 2.25-day Moon noise from multi-year alerts

  // Map natal D1 planet positions for Neecha Bhanga checks
  const natalPlanetSigns: Record<string, number> = {};
  for (const np of flattenedNatalD1) {
    const pKey = resolvePlanetKeyFromName(np.body_name);
    const sIdx = resolveSignIdxFromName(np.rashi_name);
    if (pKey && sIdx) natalPlanetSigns[pKey] = sIdx;
  }

  const getPlanetSnapshotAt = (g: string, dt: Date) => {
    const ov = overrides[g];
    if (ov && ov >= 1 && ov <= 12) {
      return {
        signIdx: ov,
        isRetro: false,
        motionType: 'Normal' as const,
        houseLagna: getHouse(ov, natalLagnaIdx),
        houseMoon: getHouse(ov, natalRashiIdx)
      };
    }
    const pos = getGrahaTransitPosition(g, dt, natalLagnaIdx, natalRashiIdx);
    return {
      signIdx: pos.transit_rashi_index,
      isRetro: pos.is_retrograde,
      motionType: pos.motion_type || (pos.is_retrograde ? 'Vakra' as const : 'Normal' as const),
      houseLagna: pos.relative_to_natal_lagna.house_number,
      houseMoon: pos.relative_to_natal_rashi.house_number
    };
  };

  const getDailySnapshot = (dt: Date) => {
    const map: Record<string, { signIdx: number; isRetro: boolean; motionType: 'Normal' | 'Vakra' | 'Adisara'; houseLagna: number; houseMoon: number }> = {};
    for (const g of ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']) {
      map[g] = getPlanetSnapshotAt(g, dt);
    }
    return map;
  };

  // Bisect any sign boundary crossing between tA and tB down to 1-minute precision
  const bisectSignCrossing = (g: string, tA: number, tB: number): number => {
    const sA = getGrahaTransitPosition(g, new Date(tA), natalLagnaIdx, natalRashiIdx).transit_rashi_index;
    let lo = tA;
    let hi = tB;
    while (hi - lo > MIN_MS) {
      const mid = Math.floor((lo + hi) / 2);
      const sMid = getGrahaTransitPosition(g, new Date(mid), natalLagnaIdx, natalRashiIdx).transit_rashi_index;
      if (sMid === sA) lo = mid;
      else hi = mid;
    }
    return hi;
  };

  // Collect sampled days across [dScanStart .. dEnd] (noon UTC for baseline/multi-year aggregation)
  const sampleDates: Date[] = [];
  for (let ms = dScanStart.getTime(); ms <= dEnd.getTime(); ms += stepDays * DAY_MS) {
    sampleDates.push(new Date(ms));
  }
  const lastSampleStr = sampleDates[sampleDates.length - 1]?.toISOString().slice(0, 10);
  if (lastSampleStr !== dEndCanonStr) {
    sampleDates.push(new Date(dEnd));
  }

  const allSnapshots = sampleDates.map(dt => ({
    dateStr: dt.toISOString().slice(0, 10),
    dt,
    planets: getDailySnapshot(dt)
  }));
  const snapshots = allSnapshots.filter(s => s.dateStr >= dStartCanonStr);

  // 1. Detect Same-Sign Retrograde <-> Direct Stations (derive exact stationDate + stationTimeUtc from 1-min turnaround extremum)
  const sameSignStations: SameSignMotionTransition[] = [];
  for (const g of taraGrahas) {
    interface PhaseSegment {
      signIdx: number;
      isRetro: boolean;
      startDate: string;
      endDate: string;
    }
    const phases: PhaseSegment[] = [];
    for (const snap of allSnapshots) {
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

        let exactStationDate = curr.startDate;
        let stationDegree: string | undefined;
        let stationTimeUtc: string | undefined;
        let stationTimestampUtc: string | undefined;
        let stationIstDate: string | undefined;

        if (!overrides[g]) {
          // Search +/- 36h around the noon transition at 1-hour step, then bisect the exact 1-minute isRetro flip
          const tCenterStart = new Date(`${prev.endDate}T12:00:00Z`).getTime() - 24 * HOUR_MS;
          const tCenterEnd = new Date(`${curr.startDate}T12:00:00Z`).getTime() + 24 * HOUR_MS;
          const targetRetro = curr.isRetro;
          let flipLo = tCenterStart;
          let flipHi = tCenterEnd;
          let prevR = getGrahaTransitPosition(g, new Date(tCenterStart), natalLagnaIdx, natalRashiIdx).is_retrograde;
          for (let ms = tCenterStart + HOUR_MS; ms <= tCenterEnd; ms += HOUR_MS) {
            const curR = getGrahaTransitPosition(g, new Date(ms), natalLagnaIdx, natalRashiIdx).is_retrograde;
            if (curR !== prevR && curR === targetRetro) {
              flipLo = ms - HOUR_MS;
              flipHi = ms;
              break;
            }
            prevR = curR;
          }
          const loRetro = getGrahaTransitPosition(g, new Date(flipLo), natalLagnaIdx, natalRashiIdx).is_retrograde;
          while (flipHi - flipLo > MIN_MS) {
            const mid = Math.floor((flipLo + flipHi) / 2);
            const midRetro = getGrahaTransitPosition(g, new Date(mid), natalLagnaIdx, natalRashiIdx).is_retrograde;
            if (midRetro === loRetro) flipLo = mid;
            else flipHi = mid;
          }
          const bestMs = flipHi;
          const bestPos = getGrahaTransitPosition(g, new Date(bestMs), natalLagnaIdx, natalRashiIdx);

          const dm = bestPos.degree_sputa.match(/(\d{1,2})\s*°\s*(\d{1,2})?/);
          stationDegree = dm ? `${dm[1].padStart(2, '0')}°${(dm[2] || '00').padStart(2, '0')}'` : bestPos.degree_sputa;
          exactStationDate = new Date(bestMs).toISOString().slice(0, 10);
          stationTimeUtc = new Date(bestMs).toISOString().slice(11, 16);
          stationTimestampUtc = toUtcIsoMin(bestMs);
          stationIstDate = toIstDate(bestMs);
        }

        const isBoundary = exactStationDate < dStartCanonStr;
        const clampedBeforeStart = prev.startDate < dStartCanonStr ? dStartCanonStr : prev.startDate;
        const beforeStr = `${clampedBeforeStart} to ${exactStationDate}`;
        const afterStr = `${exactStationDate} to ${curr.endDate}`;

        sameSignStations.push({
          grahaKey: g,
          grahaName: gName,
          signIndex: curr.signIdx,
          signName,
          houseFromLagna: hLagna,
          houseFromMoon: hMoon,
          turnType,
          stationDate: exactStationDate,
          stationDegree,
          stationTimeUtc,
          stationTimestampUtc,
          stationIstDate,
          beforeRange: beforeStr,
          afterRange: afterStr,
          summary: `${gName} stations ${turnType === 'Retrograde -> Direct' ? 'DIRECT' : 'RETROGRADE'} inside ${signName} (H${hMoon} from Moon, H${hLagna} from Lagna) on ${stationTimestampUtc || exactStationDate}${stationDegree ? ` @ ${stationDegree}` : ''}${isBoundary ? ' [Prior Boundary Carry-Over]' : ''} (${prev.isRetro ? 'Retro' : 'Direct'} ${beforeStr}, then ${curr.isRetro ? 'Retro' : 'Direct'} ${afterStr})`,
          eventImpact: buildStationForecast(g, turnType, signName, hMoon)
        });
      }
    }
  }
  sameSignStations.sort((a, b) => (a.stationTimestampUtc || a.stationDate).localeCompare(b.stationTimestampUtc || b.stationDate));

  // 1B. Detect Sign Ingresses across [scanStartUtcMs .. targetEndMs] with 1-minute UTC bisection
  const boundaryIngresses: SignIngressEvent[] = [];
  for (const g of allTrackedIngresses) {
    if (isShortWindow && !overrides[g]) {
      const STEP_ING = 6 * HOUR_MS;
      let prevMs = scanStartUtcMs;
      let prevPos = getGrahaTransitPosition(g, new Date(prevMs), natalLagnaIdx, natalRashiIdx);
      for (let ms = scanStartUtcMs + STEP_ING; ms <= targetEndMs + STEP_ING; ms += STEP_ING) {
        const probeMs = Math.min(ms, targetEndMs);
        const currPos = getGrahaTransitPosition(g, new Date(probeMs), natalLagnaIdx, natalRashiIdx);
        if (currPos.transit_rashi_index !== prevPos.transit_rashi_index) {
          const crossMs = bisectSignCrossing(g, prevMs, probeMs);
          if (crossMs >= scanStartUtcMs && crossMs <= targetEndMs) {
            const crossPos = getGrahaTransitPosition(g, new Date(crossMs), natalLagnaIdx, natalRashiIdx);
            const isPriorBoundary = crossMs < targetStartMs;
            const fromSignName = getSignName(prevPos.transit_rashi_index);
            const toSignName = getSignName(crossPos.transit_rashi_index);
            const motionType: 'Normal' | 'Vakra' | 'Adisara' =
              crossPos.motion_type === 'Adisara' || prevPos.motion_type === 'Adisara'
                ? 'Adisara'
                : crossPos.is_retrograde
                ? 'Vakra'
                : 'Normal';
            const gName = PLANET_DISPLAY[g] || g;
            const motionTag = motionType === 'Adisara' ? ' [ADISARA / Accelerated Ingress]' : motionType === 'Vakra' ? ' [Vakra Ingress]' : '';
            const ingTs = toUtcIsoMin(crossMs);
            const ingDate = ingTs.slice(0, 10);
            const ingIst = toIstDate(crossMs);
            const boundaryNote = isPriorBoundary ? ` (Prior-Month Boundary -> active at ${dStartCanonStr} start)` : '';
            boundaryIngresses.push({
              grahaKey: g,
              grahaName: gName,
              fromSignIndex: prevPos.transit_rashi_index,
              fromSignName,
              toSignIndex: crossPos.transit_rashi_index,
              toSignName,
              toHouseFromLagna: crossPos.relative_to_natal_lagna.house_number,
              toHouseFromMoon: crossPos.relative_to_natal_rashi.house_number,
              ingressDate: ingDate,
              ingressTimestampUtc: ingTs,
              ingressIstDate: ingIst,
              isPriorMonthBoundary: isPriorBoundary,
              motionType,
              summary: `${gName} shifts ${fromSignName} -> ${toSignName} (H${crossPos.relative_to_natal_lagna.house_number} Lagna / H${crossPos.relative_to_natal_rashi.house_number} Moon) on ${ingTs}${motionTag}${boundaryNote}`,
              eventImpact: `${g} changing Rashi from ${fromSignName.split(' ')[0]} into ${toSignName.split(' ')[0]} (Lagna H${crossPos.relative_to_natal_lagna.house_number} / Moon H${crossPos.relative_to_natal_rashi.house_number})${motionType === 'Adisara' ? ' under accelerated Adisara velocity triggers rapid sign-shift adjustments, urgent decisions, and immediate reallocation of that house portfolio' : ' initiates a fresh planetary chapter for those houses'}.`
            });
          }
        }
        prevMs = probeMs;
        prevPos = currPos;
        if (probeMs >= targetEndMs) break;
      }
    } else {
      for (let sIdx = 1; sIdx < allSnapshots.length; sIdx++) {
        const prevSnap = allSnapshots[sIdx - 1];
        const currSnap = allSnapshots[sIdx];
        const prevSt = prevSnap.planets[g];
        const currSt = currSnap.planets[g];
        if (!prevSt || !currSt || prevSt.signIdx === currSt.signIdx) continue;

        const isPriorBoundary = currSnap.dateStr <= dStartCanonStr && prevSnap.dateStr < dStartCanonStr;
        const fromSignName = getSignName(prevSt.signIdx);
        const toSignName = getSignName(currSt.signIdx);
        const motionType: 'Normal' | 'Vakra' | 'Adisara' =
          currSt.motionType === 'Adisara' || prevSt.motionType === 'Adisara'
            ? 'Adisara'
            : currSt.isRetro
            ? 'Vakra'
            : 'Normal';
        const gName = PLANET_DISPLAY[g] || g;
        const motionTag = motionType === 'Adisara' ? ' [ADISARA / Accelerated Ingress]' : motionType === 'Vakra' ? ' [Vakra Ingress]' : '';
        const boundaryNote = isPriorBoundary ? ` (Prior-Month Boundary -> active at ${dStartCanonStr} start)` : '';
        boundaryIngresses.push({
          grahaKey: g,
          grahaName: gName,
          fromSignIndex: prevSt.signIdx,
          fromSignName,
          toSignIndex: currSt.signIdx,
          toSignName,
          toHouseFromLagna: currSt.houseLagna,
          toHouseFromMoon: currSt.houseMoon,
          ingressDate: currSnap.dateStr,
          isPriorMonthBoundary: isPriorBoundary,
          motionType,
          summary: `${gName} shifts ${fromSignName} -> ${toSignName} (H${currSt.houseLagna} Lagna / H${currSt.houseMoon} Moon) on ${currSnap.dateStr}${motionTag}${boundaryNote}`,
          eventImpact: `${g} changing Rashi from ${fromSignName.split(' ')[0]} into ${toSignName.split(' ')[0]} (Lagna H${currSt.houseLagna} / Moon H${currSt.houseMoon})${motionType === 'Adisara' ? ' under accelerated Adisara velocity triggers rapid sign-shift adjustments, urgent decisions, and immediate reallocation of that house portfolio' : ' initiates a fresh planetary chapter for those houses'}.`
        });
      }
    }
  }
  boundaryIngresses.sort((a, b) => (a.ingressTimestampUtc || a.ingressDate).localeCompare(b.ingressTimestampUtc || b.ingressDate));

  // 1C. Detect Adisara (Accelerated Motion) Windows for Jupiter & Saturn across [dScanStart .. dEnd]
  const adisaraWindows: AdisaraMotionEvent[] = [];
  for (const g of ['Jupiter', 'Saturn']) {
    let activeStart = '';
    let activeEnd = '';
    const activeSigns = new Set<string>();
    let latestHLagna = 1;
    let latestHMoon = 1;

    const flushAdisara = () => {
      if (!activeStart || !activeEnd) return;
      if (activeEnd >= scanStartStr) {
        const gName = PLANET_DISPLAY[g] || g;
        const signArr = Array.from(activeSigns);
        adisaraWindows.push({
          grahaKey: g,
          grahaName: gName,
          signNames: signArr,
          startDate: activeStart,
          endDate: activeEnd,
          houseFromLagna: latestHLagna,
          houseFromMoon: latestHMoon,
          summary: `${gName} in ADISARA (Accelerated Motion) across ${signArr.join(' -> ')} (H${latestHLagna} Lagna / H${latestHMoon} Moon) [${activeStart} -> ${activeEnd}]`,
          eventImpact: `${g} moving at Adisara velocity across ${signArr.map(s => s.split(' ')[0]).join(' -> ')} compresses long-term fruition into urgent, decisive action involving H${latestHLagna} (Lagna) and H${latestHMoon} (Moon).`
        });
      }
      activeStart = '';
      activeEnd = '';
      activeSigns.clear();
    };

    for (const snap of allSnapshots) {
      const st = snap.planets[g];
      if (st && st.motionType === 'Adisara') {
        if (!activeStart) activeStart = snap.dateStr;
        activeEnd = snap.dateStr;
        activeSigns.add(getSignName(st.signIdx));
        latestHLagna = st.houseLagna;
        latestHMoon = st.houseMoon;
      } else {
        flushAdisara();
      }
    }
    flushAdisara();
  }

  // Helper to get transit snapshot at arbitrary timestamp (respecting overrides)
  const getSnapForPair = (pairList: string[], dt: Date) => {
    const out: Record<string, { signIdx: number; isRetro: boolean; houseLagna: number; houseMoon: number }> = {};
    for (const g of pairList) {
      out[g] = getPlanetSnapshotAt(g, dt);
    }
    return out;
  };

  // 2. Detect Transit-Transit Parivartana Yogas (1-minute exact bounds for <= 45 days; daily snapshot for multi-year)
  const parivartanaYogas: ParivartanaYogaEvent[] = [];
  const parivartanaPairIntervals: Array<{ gA: string; gB: string; startMs: number; endMs: number }> = [];
  const activeParivartanaPairsByDate: Array<Set<string>> = snapshots.map(() => new Set<string>());

  if (totalDays <= 45) {
    // 1-hour scan across [targetStartMs .. targetEndMs], bisecting exact entry and exit to 1-min precision
    const pairList = sevenGrahas;
    const isPairActiveAt = (gA: string, gB: string, ms: number): { active: boolean; signA: number; signB: number } => {
      const stA = getPlanetSnapshotAt(gA, new Date(ms));
      const stB = getPlanetSnapshotAt(gB, new Date(ms));
      if (stA.signIdx === stB.signIdx) return { active: false, signA: stA.signIdx, signB: stB.signIdx };
      const ok = SIGN_PRIMARY_LORD[stA.signIdx] === gB && SIGN_PRIMARY_LORD[stB.signIdx] === gA;
      return { active: ok, signA: stA.signIdx, signB: stB.signIdx };
    };
    const bisectPairEdge = (gA: string, gB: string, tA: number, tB: number, targetActive: boolean): number => {
      let lo = tA;
      let hi = tB;
      while (hi - lo > MIN_MS) {
        const mid = Math.floor((lo + hi) / 2);
        const st = isPairActiveAt(gA, gB, mid);
        if (st.active === targetActive) hi = mid;
        else lo = mid;
      }
      return targetActive ? hi : lo;
    };

    for (let i = 0; i < pairList.length; i++) {
      for (let j = i + 1; j < pairList.length; j++) {
        const gA = pairList[i];
        const gB = pairList[j];
        let inSeg = false;
        let segStartMs = targetStartMs;
        let segSignA = 0;
        let segSignB = 0;
        let prevMs = targetStartMs;
        let prevRes = isPairActiveAt(gA, gB, prevMs);
        if (prevRes.active) {
          inSeg = true;
          segStartMs = prevMs;
          segSignA = prevRes.signA;
          segSignB = prevRes.signB;
        }

        for (let ms = targetStartMs + HOUR_MS; ms <= targetEndMs + HOUR_MS; ms += HOUR_MS) {
          const probeMs = Math.min(ms, targetEndMs);
          const currRes = isPairActiveAt(gA, gB, probeMs);
          if (!inSeg && currRes.active) {
            const exactStart = bisectPairEdge(gA, gB, prevMs, probeMs, true);
            const exactState = isPairActiveAt(gA, gB, exactStart);
            inSeg = true;
            segStartMs = exactStart;
            segSignA = exactState.signA;
            segSignB = exactState.signB;
          } else if (inSeg && (!currRes.active || currRes.signA !== segSignA || currRes.signB !== segSignB)) {
            const exactEnd = bisectPairEdge(gA, gB, prevMs, probeMs, false);
            pushParivartanaEvent(gA, gB, segSignA, segSignB, segStartMs, exactEnd);
            inSeg = false;
            if (currRes.active) {
              const exactStart2 = bisectPairEdge(gA, gB, exactEnd + MIN_MS, probeMs, true);
              inSeg = true;
              segStartMs = exactStart2;
              segSignA = currRes.signA;
              segSignB = currRes.signB;
            }
          }
          prevMs = probeMs;
          prevRes = currRes;
          if (probeMs >= targetEndMs) break;
        }
        if (inSeg) {
          pushParivartanaEvent(gA, gB, segSignA, segSignB, segStartMs, targetEndMs);
        }
      }
    }

    function pushParivartanaEvent(gA: string, gB: string, sA: number, sB: number, sMs: number, eMs: number) {
      const mHA = getHouse(sA, natalRashiIdx);
      const mHB = getHouse(sB, natalRashiIdx);
      const lHA = getHouse(sA, natalLagnaIdx);
      const lHB = getHouse(sB, natalLagnaIdx);
      const isDainya = [6, 8, 12].includes(mHA) || [6, 8, 12].includes(mHB);
      const isMaha = !isDainya && isMahaHouse(mHA) && isMahaHouse(mHB);
      const yogaClass: ParivartanaYogaEvent['yogaClass'] = isMaha
        ? 'Maha Parivartana (Kendra/Trikona/Wealth)'
        : isDainya
        ? 'Dainya / Karmic Parivartana'
        : 'Kahala Parivartana';
      const sAName = getSignName(sA);
      const sBName = getSignName(sB);
      const sTs = toUtcIsoMin(sMs);
      const eTs = toUtcIsoMin(eMs);
      parivartanaPairIntervals.push({ gA, gB, startMs: sMs, endMs: eMs });
      parivartanaYogas.push({
        kind: 'Transit-Transit',
        grahaA: gA,
        grahaB: gB,
        signAIndex: sA,
        signAName: sAName,
        signBIndex: sB,
        signBName: sBName,
        moonHouseA: mHA,
        moonHouseB: mHB,
        lagnaHouseA: lHA,
        lagnaHouseB: lHB,
        startDate: sTs.slice(0, 10),
        endDate: eTs.slice(0, 10),
        startTimestampUtc: sTs,
        endTimestampUtc: eTs,
        startIstDate: toIstDate(sMs),
        endIstDate: toIstDate(eMs),
        yogaClass,
        bhavaExchangeSummary: `From Moon: ${gA} in H${mHA} (${sAName}) <-> ${gB} in H${mHB} (${sBName}) | From Lagna: H${lHA} <-> H${lHB}`,
        lordshipSummary: `${gA} (Lord of ${sBName}, H${mHB} from Moon / H${lHB} from Lagna) sits in ${sAName} (H${mHA}), while ${gB} (Lord of ${sAName}, H${mHA} from Moon / H${lHA} from Lagna) sits in ${sBName} (H${mHB}).`,
        predictedEvents: buildParivartanaForecast(gA, gB, mHA, mHB, lHA, lHB)
      });
    }
  } else {
    const parivartanaMap = new Map<string, ParivartanaYogaEvent>();
    const activeParivartanaKeysYesterday = new Set<string>();

    for (let sIdx = 0; sIdx < snapshots.length; sIdx++) {
      const snap = snapshots[sIdx];
      const pSet = activeParivartanaPairsByDate[sIdx];
      const activePairKeysToday = new Set<string>();
      const pairList = parivartanaGrahas;

      for (let i = 0; i < pairList.length; i++) {
        for (let j = i + 1; j < pairList.length; j++) {
          const gA = pairList[i];
          const gB = pairList[j];
          const stA = snap.planets[gA];
          const stB = snap.planets[gB];
          if (!stA || !stB || stA.signIdx === stB.signIdx) continue;

          if (SIGN_PRIMARY_LORD[stA.signIdx] === gB && SIGN_PRIMARY_LORD[stB.signIdx] === gA) {
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
                bhavaExchangeSummary: `From Moon: ${gA} in H${mHA} (${sAName}) <-> ${gB} in H${mHB} (${sBName}) | From Lagna: H${lHA} <-> H${lHB}`,
                lordshipSummary: `${gA} (Lord of ${sBName}, H${mHB} from Moon / H${lHB} from Lagna) sits in ${sAName} (H${mHA}), while ${gB} (Lord of ${sAName}, H${mHA} from Moon / H${lHA} from Lagna) sits in ${sBName} (H${mHB}).`,
                predictedEvents: buildParivartanaForecast(gA, gB, mHA, mHB, lHA, lHB)
              };
              parivartanaMap.set(`${key}@open`, evt);
            }
          }
        }
      }

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
    }

    for (const [, val] of parivartanaMap.entries()) {
      parivartanaYogas.push(val);
    }
  }
  parivartanaYogas.sort((a, b) => (a.startTimestampUtc || a.startDate).localeCompare(b.startTimestampUtc || b.startDate));

  // Helper to evaluate classical Neecha Bhanga factors cleanly at any timestamp/snapshot (without frame overclaiming)
  const evaluateDebReasonsAt = (
    g: string,
    debMeta: { signIdx: number; exaltSignIdx: number; exaltationLordOfDebSign: string },
    snapPlanets: Record<string, { signIdx: number; isRetro: boolean; houseLagna: number; houseMoon: number }>,
    isActiveParivartana: boolean
  ): string[] => {
    const st = snapPlanets[g];
    if (!st || st.signIdx !== debMeta.signIdx) return [];
    const reasons: string[] = [];
    const dispLord = SIGN_PRIMARY_LORD[debMeta.signIdx];
    const exaltedInDebLord = debMeta.exaltationLordOfDebSign;
    const ownExaltSignLord = SIGN_PRIMARY_LORD[debMeta.exaltSignIdx];

    if (st.isRetro) {
      reasons.push(`${g} is Retrograde (Neecha-Vakra) inside debilitation, reversing weakness into unconventional strength`);
    }

    // 1. Transit Dispositor in Kendra from Lagna and/or Moon
    const dispTransit = snapPlanets[dispLord];
    if (dispTransit) {
      const kText = formatKendraFrameText(dispTransit.houseLagna, dispTransit.houseMoon);
      if (kText) {
        reasons.push(`Debilitation sign lord ${dispLord} transits Kendra (${kText})`);
      }
      if (dispTransit.signIdx === st.signIdx || Math.abs(dispTransit.signIdx - st.signIdx) === 6) {
        reasons.push(`${g} receives ${dispTransit.signIdx === st.signIdx ? 'conjunction' : 'direct 7th aspect'} from dispositor ${dispLord}`);
      }
    }

    // 2. Natal Dispositor in Kendra from Lagna and/or Moon (ONLY emit frames that are actual Kendras!)
    const dispNatalSign = natalPlanetSigns[dispLord];
    if (dispNatalSign) {
      const dHL = getHouse(dispNatalSign, natalLagnaIdx);
      const dHM = getHouse(dispNatalSign, natalRashiIdx);
      const kText = formatKendraFrameText(dHL, dHM);
      if (kText) {
        reasons.push(`Natal ${dispLord} (dispositor of ${getSignName(debMeta.signIdx)}) sits in Kendra (${kText})`);
      }
    }

    // 3. Planet exalted in this debilitation sign in Kendra (transit or natal)
    if (exaltedInDebLord) {
      const exTransit = snapPlanets[exaltedInDebLord];
      if (exTransit) {
        const kText = formatKendraFrameText(exTransit.houseLagna, exTransit.houseMoon);
        if (kText) {
          reasons.push(`Exaltation lord ${exaltedInDebLord} of ${getSignName(debMeta.signIdx)} transits Kendra (${kText})`);
        }
      }
      const exNatalSign = natalPlanetSigns[exaltedInDebLord];
      if (exNatalSign) {
        const eHL = getHouse(exNatalSign, natalLagnaIdx);
        const eHM = getHouse(exNatalSign, natalRashiIdx);
        const kText = formatKendraFrameText(eHL, eHM);
        if (kText) {
          reasons.push(`Natal ${exaltedInDebLord} (planet exalted in ${getSignName(debMeta.signIdx)}) occupies Kendra (${kText})`);
        }
      }
    }

    // 4. Lord of g's own exaltation sign in Kendra (transit or natal)
    if (ownExaltSignLord) {
      const ownExTransit = snapPlanets[ownExaltSignLord];
      if (ownExTransit) {
        const kText = formatKendraFrameText(ownExTransit.houseLagna, ownExTransit.houseMoon);
        if (kText) {
          reasons.push(`Lord of ${g}'s exaltation sign (${ownExaltSignLord}) transits Kendra (${kText})`);
        }
      }
      const ownExNatalSign = natalPlanetSigns[ownExaltSignLord];
      if (ownExNatalSign) {
        const oHL = getHouse(ownExNatalSign, natalLagnaIdx);
        const oHM = getHouse(ownExNatalSign, natalRashiIdx);
        const kText = formatKendraFrameText(oHL, oHM);
        if (kText) {
          reasons.push(`Natal lord of ${g}'s exaltation sign (${ownExaltSignLord}) occupies Kendra (${kText})`);
        }
      }
    }

    if (isActiveParivartana) {
      reasons.push(`${g} participates in an active Parivartana mutual sign exchange`);
    }

    return Array.from(new Set(reasons));
  };

  // 3. Detect Debilitation (Neecha) & Neecha Bhanga Windows (split whenever Retrograde state OR active cancellation reasons change!)
  const debilitationEvents: DebilitationNeechaBhangaEvent[] = [];
  const debCheckGrahas = ['Sun', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];

  for (const g of debCheckGrahas) {
    const debMeta = DEBILITATION_SIGNS[g];
    if (!debMeta) continue;

    if (isShortWindow && !overrides[g]) {
      const relevantPlanets = Array.from(
        new Set([g, SIGN_PRIMARY_LORD[debMeta.signIdx], debMeta.exaltationLordOfDebSign, SIGN_PRIMARY_LORD[debMeta.exaltSignIdx]].filter(Boolean))
      );
      const getDebStateAt = (ms: number) => {
        const dt = new Date(ms);
        const snapPlanets = getSnapForPair(relevantPlanets, dt);
        const st = snapPlanets[g];
        if (!st || st.signIdx !== debMeta.signIdx) {
          return { active: false, isRetro: false, reasons: [] as string[], sig: '' };
        }
        const inPari = parivartanaPairIntervals.some(pi => (pi.gA === g || pi.gB === g) && ms >= pi.startMs && ms <= pi.endMs);
        const reasons = evaluateDebReasonsAt(g, debMeta, snapPlanets, inPari);
        const sig = `${st.isRetro ? 'R' : 'D'}|${[...reasons].sort().join('||')}`;
        return { active: true, isRetro: st.isRetro, reasons, sig };
      };
      const bisectDebChange = (tA: number, tB: number, sigA: string): number => {
        let lo = tA;
        let hi = tB;
        while (hi - lo > MIN_MS) {
          const mid = Math.floor((lo + hi) / 2);
          if (getDebStateAt(mid).sig === sigA) lo = mid;
          else hi = mid;
        }
        return hi;
      };

      const contSegs: Array<{ startMs: number; endMs: number; isRetro: boolean; reasons: string[]; sig: string }> = [];
      let prevMs = targetStartMs;
      let prevState = getDebStateAt(prevMs);
      let openSegStart: number | null = prevState.active ? prevMs : null;
      let openState = prevState;

      for (let ms = targetStartMs + HOUR_MS; ms <= targetEndMs + HOUR_MS; ms += HOUR_MS) {
        const probeMs = Math.min(ms, targetEndMs);
        const currState = getDebStateAt(probeMs);
        if (currState.sig !== openState.sig) {
          const crossMs = bisectDebChange(prevMs, probeMs, openState.sig);
          if (openState.active && openSegStart !== null) {
            contSegs.push({
              startMs: openSegStart,
              endMs: Math.max(openSegStart, crossMs - MIN_MS),
              isRetro: openState.isRetro,
              reasons: openState.reasons,
              sig: openState.sig
            });
          }
          const newState = getDebStateAt(crossMs);
          openSegStart = newState.active ? crossMs : null;
          openState = newState;
        }
        prevMs = probeMs;
        prevState = currState;
        if (probeMs >= targetEndMs) break;
      }
      if (openState.active && openSegStart !== null) {
        contSegs.push({
          startMs: openSegStart,
          endMs: targetEndMs,
          isRetro: openState.isRetro,
          reasons: openState.reasons,
          sig: openState.sig
        });
      }

      for (const seg of contSegs) {
        const reasonList = seg.reasons;
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
        const sTs = toUtcIsoMin(seg.startMs);
        const eTs = toUtcIsoMin(seg.endMs);
        debilitationEvents.push({
          grahaKey: g,
          grahaName: gName,
          signIndex: debMeta.signIdx,
          signName,
          houseFromLagna: hLagna,
          houseFromMoon: hMoon,
          startDate: sTs.slice(0, 10),
          endDate: eTs.slice(0, 10),
          startTimestampUtc: sTs,
          endTimestampUtc: eTs,
          startIstDate: toIstDate(seg.startMs),
          endIstDate: toIstDate(seg.endMs),
          motionState,
          neechaBhangaStatus: status,
          cancellationReasons: reasonList,
          summary: `${gName} Debilitated in ${signName} (H${hMoon} from Moon / H${hLagna} from Lagna) [${sTs} -> ${eTs}] — ${motionState} — Status: ${status}`,
          predictedEvents: buildDebilitationForecast(g, motionState, status, hMoon)
        });
      }
    } else {
      interface DebSegment {
        startDate: string;
        endDate: string;
        isRetro: boolean;
        sig: string;
        reasons: string[];
      }
      const segs: DebSegment[] = [];

      for (let sIdx = 0; sIdx < snapshots.length; sIdx++) {
        const snap = snapshots[sIdx];
        const st = snap.planets[g];
        if (!st || st.signIdx !== debMeta.signIdx) continue;

        const reasonsToday = evaluateDebReasonsAt(
          g,
          debMeta,
          snap.planets,
          !!activeParivartanaPairsByDate[sIdx]?.has(g)
        );
        const sig = `${st.isRetro ? 'R' : 'D'}|${[...reasonsToday].sort().join('||')}`;
        const lastSeg = segs[segs.length - 1];
        const prevDayMs = snap.dt.getTime() - stepDays * DAY_MS;
        const isConsecutive = lastSeg && Math.abs(new Date(`${lastSeg.endDate}T12:00:00Z`).getTime() - prevDayMs) <= stepDays * DAY_MS + 1000;

        if (lastSeg && isConsecutive && lastSeg.sig === sig) {
          lastSeg.endDate = snap.dateStr;
        } else {
          segs.push({
            startDate: snap.dateStr,
            endDate: snap.dateStr,
            isRetro: st.isRetro,
            sig,
            reasons: reasonsToday
          });
        }
      }

      for (const seg of segs) {
        const reasonList = seg.reasons;
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
          summary: `${gName} Debilitated in ${signName} (H${hMoon} from Moon / H${hLagna} from Lagna) [${seg.startDate} -> ${seg.endDate}] — ${motionState} — Status: ${status}`,
          predictedEvents: buildDebilitationForecast(g, motionState, status, hMoon)
        });
      }
    }
  }
  debilitationEvents.sort((a, b) => (a.startTimestampUtc || a.startDate).localeCompare(b.startTimestampUtc || b.startDate));

  // 4. Build Consolidated One-Liner & Possible Events List
  const oneLinerParts: string[] = [];
  const possibleEventsSummary: string[] = [];

  if (boundaryIngresses.length > 0) {
    const prioritizedIngresses = [...boundaryIngresses].sort((a, b) => {
      const slowOrder: Record<string, number> = { Jupiter: 0, Saturn: 1, Rahu: 2, Ketu: 3, Mars: 4, Sun: 5, Venus: 6, Mercury: 7 };
      if (a.isPriorMonthBoundary !== b.isPriorMonthBoundary) return a.isPriorMonthBoundary ? -1 : 1;
      return (slowOrder[a.grahaKey] ?? 9) - (slowOrder[b.grahaKey] ?? 9);
    });
    const ingBits = prioritizedIngresses.map(
      ing => `${ing.grahaKey} ${ing.fromSignName.split(' ')[0]}→${ing.toSignName.split(' ')[0]} on ${ing.ingressDate}${ing.motionType === 'Adisara' ? ' [Adisara]' : ''}${ing.isPriorMonthBoundary ? ' (Boundary→Month Start)' : ''}`
    );
    oneLinerParts.push(`Ingresses: ${ingBits.join('; ')}`);
    prioritizedIngresses.forEach(ing =>
      possibleEventsSummary.push(`[Sign Ingress${ing.isPriorMonthBoundary ? ' — Prior Boundary Carry-Over' : ''} — ${ing.ingressDate}] ${ing.summary}. ${ing.eventImpact}`)
    );
  }

  if (adisaraWindows.length > 0) {
    const adiBits = adisaraWindows.map(
      aw => `${aw.grahaKey} Adisara in ${aw.signNames.map(s => s.split(' ')[0]).join('→')} (${aw.startDate}→${aw.endDate})`
    );
    oneLinerParts.push(`Adisara: ${adiBits.join('; ')}`);
    adisaraWindows.forEach(aw =>
      possibleEventsSummary.push(`[Adisara Fast Motion — ${aw.startDate}→${aw.endDate}] ${aw.eventImpact}`)
    );
  }

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
      : `Standard planetary flow across ${startDateStr} to ${endDateStr} with no sign ingresses, same-sign stations, mutual Parivartana sign exchanges, or debilitation windows.`;

  // 5. Build Compact Structured Prompt Block for LLM (Zero Decorations, Zero Data Loss)
  const lines: string[] = [];
  const lookbackHeaderNote = effectiveLookbackDays > 0 ? ` + Prior ${effectiveLookbackDays}d Boundary ${scanStartStr}` : '';
  lines.push(`## SPECIAL TRANSIT PHENOMENA (${startDateStr}..${endDateStr}${lookbackHeaderNote})`);
  lines.push(`ONE_LINER: ${consolidatedOneLiner}`);

  if (boundaryIngresses.length > 0) {
    lines.push(`SIGN_INGRESSES(${boundaryIngresses.length}):`);
    boundaryIngresses.forEach(ing => {
      lines.push(`- ${ing.summary} | Impact: ${ing.eventImpact}`);
    });
  } else {
    lines.push(`SIGN_INGRESSES(0): None`);
  }

  if (adisaraWindows.length > 0) {
    lines.push(`ADISARA_FAST_MOTION(${adisaraWindows.length}):`);
    adisaraWindows.forEach(aw => {
      lines.push(`- ${aw.summary} | Impact: ${aw.eventImpact}`);
    });
  }

  if (sameSignStations.length > 0) {
    lines.push(`STATIONS(${sameSignStations.length}):`);
    sameSignStations.forEach(s => {
      lines.push(`- ${s.summary} | Impact: ${s.eventImpact}`);
    });
  } else {
    lines.push(`STATIONS(0): None`);
  }

  if (parivartanaYogas.length > 0) {
    lines.push(`PARIVARTANA(${parivartanaYogas.length}):`);
    parivartanaYogas.forEach(p => {
      lines.push(`- ${p.grahaA}<->${p.grahaB} ${p.yogaClass} [${p.startDate}..${p.endDate}] | ${p.bhavaExchangeSummary} | ${p.lordshipSummary} | Event: ${p.predictedEvents}`);
    });
  } else {
    lines.push(`PARIVARTANA(0): None`);
  }

  if (debilitationEvents.length > 0) {
    lines.push(`NEECHA_BHANGA(${debilitationEvents.length}):`);
    debilitationEvents.forEach(d => {
      const compactReasons = Array.from(new Set(d.cancellationReasons.map(r => r.replace(/\s*\(H\d+ from (Moon|Lagna)\)/g, '')))).slice(0, 4);
      lines.push(`- ${d.summary}${compactReasons.length > 0 ? ` | Factors: ${compactReasons.join('; ')}` : ''} | Event: ${d.predictedEvents}`);
    });
  } else {
    lines.push(`NEECHA_BHANGA(0): None`);
  }

  return {
    startDate: startDateStr,
    endDate: endDateStr,
    priorTailStartDate: effectiveLookbackDays > 0 ? scanStartStr : undefined,
    sameSignStations,
    parivartanaYogas,
    debilitationEvents,
    boundaryIngresses,
    adisaraWindows,
    consolidatedOneLiner,
    possibleEventsSummary,
    promptMarkdownBlock: lines.join('\n')
  };
}
