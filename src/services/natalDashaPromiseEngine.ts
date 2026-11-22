/**
 * Purely Natal + Vimshottari Dasha-Bhukti-PD Promise Engine (ZERO TRANSITS / NO GOCHARA).
 *
 * Evaluates structural chart promise across 6 life aspects:
 *   1. career (Career, Work & Authority)
 *   2. finance (Finance, Wealth & Assets)
 *   3. love (Love, Marriage & Partnerships)
 *   4. family (Family, Home & Lineage)
 *   5. health (Health, Vitality & Recovery)
 *   6. litigations (Litigations, Legal Disputes & Rivals)
 *
 * Considers D1 Rashi, D9 Navamsa, all Divisional Vargas (D2..D30), SAV/BAV Ashtakavarga,
 * Shadbala (when available), Yogas/Doshas, Jaimini Karakas/Arudhas, and MD -> AD -> all 9 PDs.
 */

import {
  CALIBRATED_ASHTAKAVARGA_001ME,
  D1_YOGAS_AND_DOSHAS_001ME,
  SHADBALA_STRENGTHS_001ME,
  VARGA_CHARTS_001ME,
  VargaChartDef,
  YogaDoshaData,
  evaluateNatalNeechaBhanga,
  isChartSignature001ME,
  validateD1YogasAndDoshasAgainstD1
} from '../data/vargaAndStrengthData';
import {
  computeSarvashtakavarga,
  AshtakavargaReport
} from '../data/parasharaCalculations';
import {
  calculateVimshottariTimelineForProfile
} from '../data/dashaCalculator';
import type { DashaEvaluationRecord, DashaIntervalItem } from '../data/apiService';

export type NatalAspectId = 'career' | 'finance' | 'love' | 'family' | 'health' | 'litigations';

export interface NatalAspectSpec {
  id: NatalAspectId;
  label: string;
  shortLabel: string;
  houses: number[];
  primaryHouses: number[];
  karakas: string[];
  vargas: string[];
  subtitle: string;
}

export const NATAL_ASPECT_SPECS: Record<NatalAspectId, NatalAspectSpec> = {
  career: {
    id: 'career',
    label: 'Career & Profession',
    shortLabel: 'Career',
    houses: [10, 6, 11, 2, 9, 1],
    primaryHouses: [10, 6, 11],
    karakas: ['Sun', 'Mercury', 'Saturn', 'Mars', 'Jupiter'],
    vargas: ['D1', 'D9', 'D10'],
    subtitle: 'Karma Bhava, service, promotion, authority & Dasamsa (D10)'
  },
  finance: {
    id: 'finance',
    label: 'Finance & Wealth',
    shortLabel: 'Finance',
    houses: [2, 11, 5, 9, 4, 8],
    primaryHouses: [2, 11, 5],
    karakas: ['Jupiter', 'Venus', 'Mercury', 'Saturn', 'Mars'],
    vargas: ['D1', 'D9', 'D2', 'D11', 'D4'],
    subtitle: 'Dhana & Labha Bhavas, savings, assets, Hora (D2) & Ekadasamsa (D11)'
  },
  love: {
    id: 'love',
    label: 'Love & Marriage',
    shortLabel: 'Love',
    houses: [7, 5, 11, 12, 1],
    primaryHouses: [7, 5, 11],
    karakas: ['Venus', 'Jupiter', 'Moon', 'Mercury'],
    vargas: ['D1', 'D9', 'D7', 'D30'],
    subtitle: 'Kalatra & Poorva Punya Bhavas, spouse harmony & Navamsa (D9)'
  },
  family: {
    id: 'family',
    label: 'Family & Domestic Life',
    shortLabel: 'Family',
    houses: [4, 2, 5, 9, 3],
    primaryHouses: [4, 2, 5],
    karakas: ['Moon', 'Jupiter', 'Sun', 'Venus', 'Mars'],
    vargas: ['D1', 'D9', 'D4', 'D12', 'D7', 'D16'],
    subtitle: 'Sukha, Kutumba, parents (D12), progeny (D7) & fixed home (D4)'
  },
  health: {
    id: 'health',
    label: 'Health & Vitality',
    shortLabel: 'Health',
    houses: [1, 6, 8, 12, 4, 2],
    primaryHouses: [1, 6, 8],
    karakas: ['Sun', 'Saturn', 'Mars', 'Moon', 'Jupiter'],
    vargas: ['D1', 'D9', 'D6', 'D8', 'D27', 'D30'],
    subtitle: 'Lagna immunity, Roga/Ayush, Shashtamsa (D6) & Ashtamsa (D8)'
  },
  litigations: {
    id: 'litigations',
    label: 'Litigations & Disputes',
    shortLabel: 'Litigations',
    houses: [6, 8, 12, 7, 9, 3],
    primaryHouses: [6, 8, 12, 9],
    karakas: ['Mars', 'Saturn', 'Rahu', 'Jupiter', 'Sun'],
    vargas: ['D1', 'D9', 'D6', 'D8', 'D30', 'D4'],
    subtitle: 'Shatru/Rina/Court conflicts (H6), hidden hurdles (H8), losses (H12), legal dharma (H9)'
  }
};

export const NATAL_ASPECT_ORDER: NatalAspectId[] = [
  'career',
  'finance',
  'love',
  'family',
  'health',
  'litigations'
];

export interface NatalPlacementRow {
  chart_type?: string;
  body_name: string;
  rashi_name: string;
  house_number?: number;
  nakshatra_name?: string;
  pada?: number;
  degree_sputa?: string;
  is_retrograde?: boolean;
}

export interface NatalPersonProfileInput {
  person_id: string;
  person_name?: string;
  age?: number;
  date_of_birth?: string;
  place_of_birth?: string;
  birth_lagna: string;
  birth_rashi: string;
  birth_star: string;
  birth_star_pada?: number;
  starting_dasha_lord?: string;
  dasha_balance_years?: number;
  dasha_balance_months?: number;
  dasha_balance_days?: number;
  dasha_balance_text?: string;
}

export interface NatalPdOption {
  index: number;
  mdLord: string;
  adLord: string;
  pdLord: string;
  cleanPdLord: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  savedNote?: string | null;
  savedRating?: 0 | 5 | 10 | null;
}

export interface NatalAdOption {
  index: number;
  mdLord: string;
  adLord: string;
  cleanAdLord: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  pds: NatalPdOption[];
}

export interface NatalMdOption {
  index: number;
  mdLord: string;
  cleanMdLord: string;
  startDate: string;
  endDate: string;
  totalDays: number;
  antardashas: NatalAdOption[];
}

export interface PlanetD1Summary {
  planet: string;
  signIdx: number;
  signName: string;
  hLagna: number;
  hMoon: number;
  degStr: string;
  degFloat: number | null;
  nakshatra: string;
  pada: number;
  isRetro: boolean;
  dignity: string;
  isDebilitated: boolean;
  hasNeechaBhanga: boolean;
  neechaBhangaReasons: string[];
  isCombust: boolean;
  combustGapStr: string | null;
  ownedHousesL: number[];
  ownedHousesM: number[];
  functionalNature: 'Yogakaraka' | 'Functional Benefic' | 'Functional Malefic' | 'Maraka' | 'Neutral' | 'Node';
  conjunctWith: string[];
  aspectTargetsL: number[];
  incomingAspectors: string[];
  savAtSeat: number;
  bavSelfAtSeat: number | null;
  d9Sign: string;
  d9House: number;
  d9Dignity: string;
  isVargottama: boolean;
  shadbalaRatio: number | null;
  shadbalaStatus: string | null;
}

export interface NatalBaselineAspectEval {
  aspectId: NatalAspectId;
  label: string;
  score: number;
  band: 'Strong Promise' | 'Moderate / Balanced Promise' | 'Tested / Delayed Promise';
  verdict: string;
  focusHousesSummary: string;
  vargaSummary: string;
  keyFactors: string[];
}

export interface AspectPeriodEval {
  aspectId: NatalAspectId;
  label: string;
  score: number;
  tone: 'High' | 'Supportive' | 'Mixed' | 'Caution';
  verdict: string;
  rationale: string;
}

export interface DashaSambandhaInfo {
  fromLord: string;
  toLord: string;
  houseDistanceD1: number;
  patternLabel: string;
  patternTone: 'Harmonious' | 'Action-Kendra' | 'Growth-Upachaya' | 'Friction-2/12' | 'Testing-6/8';
  friendshipLabel: 'Mutual Friend' | 'One-Sided Friend' | 'Neutral' | 'Tense / Enemy' | 'Nodal';
  mutualConnection: string;
  summary: string;
}

export interface PdWalkthroughItem {
  pdOption: NatalPdOption;
  pdSummary: PlanetD1Summary;
  linkToMd: DashaSambandhaInfo;
  linkToAd: DashaSambandhaInfo;
  vargaHighlights: string[];
  overallScore: number;
  overallTone: 'Peak / Auspicious' | 'Productive' | 'Mixed / Pivot' | 'Challenging / Careful';
  headlineSummary: string;
  aspectEvaluations: Record<NatalAspectId, AspectPeriodEval>;
}

export interface NatalDashaPromiseEvaluation {
  personId: string;
  profile: NatalPersonProfileInput;
  lagnaIdx: number;
  lagnaSign: string;
  moonIdx: number;
  moonSign: string;
  janmaStar: string;
  planetsD1: Record<string, PlanetD1Summary>;
  vargas: Record<string, VargaChartDef>;
  ashtakavarga: AshtakavargaReport;
  yogasAndDoshas: YogaDoshaData;
  jaiminiKarakas: Array<{ rank: string; planet: string; degStr: string; hL: number; hM: number }>;
  karakamsa: { signName: string; hL: number; hM: number; hD9: number } | null;
  arudhas: Array<{ label: string; signName: string; hL: number; hM: number }>;
  baselineAspects: Record<NatalAspectId, NatalBaselineAspectEval>;
  selectedMd: NatalMdOption;
  selectedAd: NatalAdOption;
  mdSummary: PlanetD1Summary;
  adSummary: PlanetD1Summary;
  mdAdSambandha: DashaSambandhaInfo;
  mdAspects: Record<NatalAspectId, AspectPeriodEval>;
  adAspects: Record<NatalAspectId, AspectPeriodEval>;
  adExecutiveSummary: string;
  pdWalkthrough: PdWalkthroughItem[];
}

const SIGN_NAMES_EN = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

const SIGN_LORD_EN: Record<number, string> = {
  1: 'Mars', 2: 'Venus', 3: 'Mercury', 4: 'Moon',
  5: 'Sun', 6: 'Mercury', 7: 'Venus', 8: 'Mars',
  9: 'Jupiter', 10: 'Saturn', 11: 'Saturn', 12: 'Jupiter'
};

const OWNED_SIGNS_EN: Record<string, number[]> = {
  Sun: [5],
  Moon: [4],
  Mars: [1, 8],
  Mercury: [3, 6],
  Jupiter: [9, 12],
  Venus: [2, 7],
  Saturn: [10, 11],
  Rahu: [11],
  Ketu: [8]
};

const EXALT_SIGN: Record<string, number> = {
  Sun: 1, Moon: 2, Mars: 10, Mercury: 6, Jupiter: 4, Venus: 12, Saturn: 7
};

const DEBIL_SIGN: Record<string, number> = {
  Sun: 7, Moon: 8, Mars: 4, Mercury: 12, Jupiter: 10, Venus: 6, Saturn: 1
};

const COMBUST_ORB: Record<string, number> = {
  Moon: 12, Mars: 17, Mercury: 14, Jupiter: 11, Venus: 10, Saturn: 15
};

const FRIENDS: Record<string, string[]> = {
  Sun: ['Moon', 'Mars', 'Jupiter'],
  Moon: ['Sun', 'Mercury'],
  Mars: ['Sun', 'Moon', 'Jupiter'],
  Mercury: ['Sun', 'Venus'],
  Jupiter: ['Sun', 'Moon', 'Mars'],
  Venus: ['Mercury', 'Saturn'],
  Saturn: ['Mercury', 'Venus']
};

const ENEMIES: Record<string, string[]> = {
  Sun: ['Venus', 'Saturn'],
  Moon: [],
  Mars: ['Mercury'],
  Mercury: ['Moon'],
  Jupiter: ['Mercury', 'Venus'],
  Venus: ['Sun', 'Moon'],
  Saturn: ['Sun', 'Moon', 'Mars']
};

const NATURAL_BENEFICS = new Set(['Jupiter', 'Venus', 'Mercury', 'Moon']);
const NATURAL_MALEFICS = new Set(['Saturn', 'Mars', 'Rahu', 'Ketu', 'Sun']);

export function cleanNatalSignName(raw?: string): string {
  if (!raw) return '';
  const map: Record<string, string> = {
    mesham: 'Aries', mesha: 'Aries',
    rishabam: 'Taurus', rishaba: 'Taurus', vrishabha: 'Taurus',
    mithunam: 'Gemini', mithuna: 'Gemini',
    kadagam: 'Cancer', katakam: 'Cancer', kadaga: 'Cancer', karkataka: 'Cancer', karka: 'Cancer',
    simham: 'Leo', simha: 'Leo',
    kanni: 'Virgo', kanya: 'Virgo',
    thulaam: 'Libra', thulam: 'Libra', tula: 'Libra',
    vrischigam: 'Scorpio', viruchigam: 'Scorpio', vrischika: 'Scorpio', vruschikam: 'Scorpio',
    dhanus: 'Sagittarius', dhanusu: 'Sagittarius', dhanu: 'Sagittarius',
    makaram: 'Capricorn', makara: 'Capricorn',
    kumbam: 'Aquarius', kumbha: 'Aquarius',
    meenam: 'Pisces', meena: 'Pisces'
  };
  const stripped = String(raw).replace(/[\u0B80-\u0BFF]+/g, '').trim();
  const paren = stripped.match(/\((Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)\)/i);
  if (paren) return paren[1].charAt(0).toUpperCase() + paren[1].slice(1).toLowerCase();
  const low = stripped.toLowerCase();
  for (let i = 0; i < SIGN_NAMES_EN.length; i++) {
    if (low.includes(SIGN_NAMES_EN[i].toLowerCase())) return SIGN_NAMES_EN[i];
  }
  for (const [k, v] of Object.entries(map)) {
    if (low.includes(k)) return v;
  }
  return stripped;
}

export function getSignIdxFromAny(raw?: string, fallback = 1): number {
  const clean = cleanNatalSignName(raw);
  const idx = SIGN_NAMES_EN.findIndex(s => s.toLowerCase() === clean.toLowerCase());
  return idx >= 0 ? idx + 1 : fallback;
}

export function cleanNatalPlanetName(raw?: string): string {
  if (!raw) return '';
  const base = String(raw).replace(/[\u0B80-\u0BFF]+/g, '').split('(')[0].trim().toLowerCase();
  if (base.includes('lagna') || base === 'asc' || base.includes('ascendant')) return 'Lagna';
  if (base.includes('sun') || base.includes('surya') || base.includes('ravi')) return 'Sun';
  if (base.includes('moon') || base.includes('chandra') || base.includes('soma')) return 'Moon';
  if (base.includes('mars') || base.includes('sevvai') || base.includes('chevvai') || base.includes('mangal')) return 'Mars';
  if (base.includes('mercury') || base.includes('budha')) return 'Mercury';
  if (base.includes('jupiter') || base.includes('guru') || base.includes('brihaspati')) return 'Jupiter';
  if (base.includes('venus') || base.includes('sukra') || base.includes('shukra')) return 'Venus';
  if (base.includes('saturn') || base.includes('sani') || base.includes('shani')) return 'Saturn';
  if (base.includes('rahu')) return 'Rahu';
  if (base.includes('ketu')) return 'Ketu';
  if (base.includes('mandi') || base.includes('gulika')) return 'Mandi';
  return raw.trim();
}

function parseDegreeFloat(degStr?: string): number | null {
  if (!degStr) return null;
  const m = String(degStr).match(/(\d{1,2})\s*[°:]\s*(\d{1,2})?(?:\s*'\s*(\d{1,2}))?/);
  if (!m) {
    const f = parseFloat(String(degStr));
    return isNaN(f) ? null : ((f % 30) + 30) % 30;
  }
  const d = parseInt(m[1], 10);
  const mins = m[2] ? parseInt(m[2], 10) : 0;
  const secs = m[3] ? parseInt(m[3], 10) : 0;
  return d + mins / 60 + secs / 3600;
}

function formatDegStr(degFloat: number): string {
  const norm = ((degFloat % 30) + 30) % 30;
  const d = Math.floor(norm);
  const m = Math.floor((norm - d) * 60 + 1e-6);
  const adjD = m >= 60 ? d + 1 : d;
  const adjM = m >= 60 ? 0 : m;
  return `${String(adjD).padStart(2, '0')}°${String(adjM).padStart(2, '0')}'`;
}

function getAspectOffsets(planet: string): number[] {
  if (planet === 'Jupiter' || planet === 'Rahu' || planet === 'Ketu') return [5, 7, 9];
  if (planet === 'Saturn') return [3, 7, 10];
  if (planet === 'Mars') return [4, 7, 8];
  return [7];
}

function getSignDignity(planet: string, signIdx: number, isRetro?: boolean): string {
  if (!signIdx || planet === 'Lagna' || planet === 'Mandi') return '';
  if (EXALT_SIGN[planet] === signIdx) return 'Exalted';
  if (DEBIL_SIGN[planet] === signIdx) return isRetro ? 'Debil-Vakra' : 'Debilitated';
  if ((OWNED_SIGNS_EN[planet] || []).includes(signIdx)) return 'Own';
  if (planet === 'Rahu' || planet === 'Ketu') return 'Neutral';
  const lord = SIGN_LORD_EN[signIdx];
  if ((FRIENDS[planet] || []).includes(lord)) return 'Friend';
  if ((ENEMIES[planet] || []).includes(lord)) return 'Enemy';
  return 'Neutral';
}

function computeVargaSignIndex(vargaNum: number, d1SignIdx: number, degFloat: number): number {
  const deg = Math.max(0, Math.min(29.9999, degFloat));
  const isOdd = d1SignIdx % 2 === 1;
  const mod4 = (d1SignIdx - 1) % 4; // 0=Movable, 1=Fixed, 2=Dual, 3=Movable? Wait: Aries(1)->0 Movable, Taurus(2)->1 Fixed, Gemini(3)->2 Dual, Cancer(4)->3? No, mod3!
  const modality = (d1SignIdx - 1) % 3; // 0=Movable(1,4,7,10), 1=Fixed(2,5,8,11), 2=Dual(3,6,9,12)

  switch (vargaNum) {
    case 2: {
      // Parashara Hora: Odd 0-15 Leo(5), 15-30 Cancer(4); Even 0-15 Cancer(4), 15-30 Leo(5)
      if (isOdd) return deg < 15 ? 5 : 4;
      return deg < 15 ? 4 : 5;
    }
    case 3: {
      const part = Math.floor(deg / 10); // 0,1,2
      const offset = part === 0 ? 0 : part === 1 ? 4 : 8;
      return ((d1SignIdx - 1 + offset) % 12) + 1;
    }
    case 4: {
      const part = Math.floor(deg / 7.5); // 0..3
      const offset = part * 3;
      return ((d1SignIdx - 1 + offset) % 12) + 1;
    }
    case 6: {
      const part = Math.floor(deg / 5); // 0..5
      const start = isOdd ? 1 : 7;
      return ((start - 1 + part) % 12) + 1;
    }
    case 7: {
      const part = Math.floor(deg / (30 / 7)); // 0..6
      const start = isOdd ? d1SignIdx : ((d1SignIdx + 5) % 12) + 1; // 7th from sign
      return ((start - 1 + part) % 12) + 1;
    }
    case 8: {
      const part = Math.floor(deg / 3.75); // 0..7
      const start = modality === 0 ? 1 : modality === 1 ? 9 : 5; // Movable->Ari, Fixed->Sag, Dual->Leo
      return ((start - 1 + part) % 12) + 1;
    }
    case 9: {
      const part = Math.min(8, Math.floor(deg / (30 / 9)));
      const el = (d1SignIdx - 1) % 4; // 0=Fire(Ari=1), 1=Earth(Cap=10), 2=Air(Lib=7), 3=Water(Can=4)
      const start = el === 0 ? 1 : el === 1 ? 10 : el === 2 ? 7 : 4;
      return ((start - 1 + part) % 12) + 1;
    }
    case 10: {
      const part = Math.min(9, Math.floor(deg / 3));
      const start = isOdd ? d1SignIdx : ((d1SignIdx + 7) % 12) + 1; // 9th from sign
      return ((start - 1 + part) % 12) + 1;
    }
    case 11: {
      // Rudramsa / Ekadasamsa: anti-zodiacal from Aries (step = part)
      const part = Math.min(10, Math.floor(deg / (30 / 11)));
      const start = ((12 - (d1SignIdx - 1)) % 12) + 1;
      return ((start - 1 + part) % 12) + 1;
    }
    case 12: {
      const part = Math.min(11, Math.floor(deg / 2.5));
      return ((d1SignIdx - 1 + part) % 12) + 1;
    }
    case 16: {
      const part = Math.min(15, Math.floor(deg / (30 / 16)));
      const start = modality === 0 ? 1 : modality === 1 ? 5 : 9;
      return ((start - 1 + part) % 12) + 1;
    }
    case 27: {
      const part = Math.min(26, Math.floor(deg / (30 / 27)));
      const el = (d1SignIdx - 1) % 4;
      const start = el === 0 ? 1 : el === 1 ? 4 : el === 2 ? 7 : 10;
      return ((start - 1 + part) % 12) + 1;
    }
    case 30: {
      if (isOdd) {
        if (deg < 5) return 1; // Aries
        if (deg < 10) return 11; // Aquarius
        if (deg < 18) return 9; // Sagittarius
        if (deg < 25) return 3; // Gemini
        return 7; // Libra
      } else {
        if (deg < 5) return 2; // Taurus
        if (deg < 12) return 6; // Virgo
        if (deg < 20) return 12; // Pisces
        if (deg < 25) return 10; // Capricorn
        return 8; // Scorpio
      }
    }
    default:
      void mod4;
      return d1SignIdx;
  }
}

export function computeAllVargasForPerson(
  personId: string,
  d1Rows: NatalPlacementRow[],
  d9Rows: NatalPlacementRow[],
  lagnaIdx: number,
  moonIdx: number
): Record<string, VargaChartDef> {
  if (personId === '001ME' || isChartSignature001ME(lagnaIdx, moonIdx, d1Rows)) {
    return VARGA_CHARTS_001ME;
  }

  const vargaSpecs: Array<{ code: string; num: number; name: string }> = [
    { code: 'D2', num: 2, name: 'Hora' },
    { code: 'D3', num: 3, name: 'Drekkana' },
    { code: 'D4', num: 4, name: 'Chaturthamsa' },
    { code: 'D6', num: 6, name: 'Shashtamsa' },
    { code: 'D7', num: 7, name: 'Saptamsa' },
    { code: 'D8', num: 8, name: 'Ashtamsa' },
    { code: 'D10', num: 10, name: 'Dasamsa' },
    { code: 'D11', num: 11, name: 'Ekadasamsa' },
    { code: 'D12', num: 12, name: 'Dwadasamsa' },
    { code: 'D16', num: 16, name: 'Shodasamsa' },
    { code: 'D27', num: 27, name: 'Bhamsa' },
    { code: 'D30', num: 30, name: 'Trimsamsa' }
  ];

  const out: Record<string, VargaChartDef> = {};

  for (const spec of vargaSpecs) {
    const lagnaRow = d1Rows.find(r => cleanNatalPlanetName(r.body_name) === 'Lagna');
    const lagnaDeg = parseDegreeFloat(lagnaRow?.degree_sputa) ?? 15;
    const vLagnaSignIdx = computeVargaSignIndex(spec.num, lagnaIdx, lagnaDeg);

    const houses: Array<{ house: number; sign: string; planets: string[] }> = Array.from({ length: 12 }, (_, i) => {
      const hNum = i + 1;
      const sIdx = ((vLagnaSignIdx + hNum - 2) % 12) + 1;
      return {
        house: hNum,
        sign: SIGN_NAMES_EN[sIdx - 1],
        planets: []
      };
    });

    for (const row of d1Rows) {
      const pName = cleanNatalPlanetName(row.body_name);
      if (!pName || pName === 'Lagna' || pName === 'Mandi') continue;
      const sIdx = getSignIdxFromAny(row.rashi_name, 0);
      if (!sIdx) continue;
      const dFloat = parseDegreeFloat(row.degree_sputa) ?? 15;
      const targetSIdx = computeVargaSignIndex(spec.num, sIdx, dFloat);
      const hNum = ((targetSIdx - vLagnaSignIdx + 12) % 12) + 1;
      const targetH = houses.find(h => h.house === hNum);
      if (targetH) {
        targetH.planets.push(`${pName} ${formatDegStr(dFloat)}`);
      }
    }

    out[spec.code] = {
      code: spec.code,
      name: spec.name,
      lagnaSign: SIGN_NAMES_EN[vLagnaSignIdx - 1],
      lagnaDeg: formatDegStr(lagnaDeg),
      houses
    };
  }

  void d9Rows;
  return out;
}

/**
 * Group flat PD timeline intervals into nested MD -> AD -> 9 PDs
 */
export function buildDashaHierarchyTree(
  profile: NatalPersonProfileInput,
  apiIntervals?: DashaIntervalItem[],
  savedNotes: DashaEvaluationRecord[] = []
): NatalMdOption[] {
  const noteLookup = new Map<string, DashaEvaluationRecord>();
  for (const rec of savedNotes) {
    const key = [
      cleanNatalPlanetName(rec.mahadasha_lord_md),
      cleanNatalPlanetName(rec.antardasha_lord_ad),
      cleanNatalPlanetName(rec.pratyantardasha_lord_pd),
      rec.start_date
    ].join('|');
    noteLookup.set(key, rec);
  }

  const rawRows: Array<{
    md: string;
    ad: string;
    pd: string;
    start: string;
    end: string;
    days: number;
  }> = apiIntervals && apiIntervals.length > 0
    ? apiIntervals.map(it => ({
        md: it.mahadasha_lord_md,
        ad: it.antardasha_lord_ad,
        pd: it.pratyantardasha_lord_pd,
        start: it.start_date,
        end: it.end_date,
        days: it.duration_days ?? Math.max(1, Math.round((Date.parse(it.end_date) - Date.parse(it.start_date)) / 86400000))
      }))
    : calculateVimshottariTimelineForProfile(profile).map(([md, ad, pd, s, e]) => ({
        md,
        ad,
        pd,
        start: s,
        end: e,
        days: Math.max(1, Math.round((Date.parse(e) - Date.parse(s)) / 86400000))
      }));

  const mdGroups: Array<{
    mdLord: string;
    cleanMdLord: string;
    startDate: string;
    endDate: string;
    adGroups: Array<{
      adLord: string;
      cleanAdLord: string;
      startDate: string;
      endDate: string;
      pds: NatalPdOption[];
    }>;
  }> = [];

  for (const row of rawRows) {
    const cleanMd = cleanNatalPlanetName(row.md);
    const cleanAd = cleanNatalPlanetName(row.ad);
    const cleanPd = cleanNatalPlanetName(row.pd);

    let lastMd = mdGroups[mdGroups.length - 1];
    if (!lastMd || lastMd.cleanMdLord !== cleanMd) {
      lastMd = {
        mdLord: row.md,
        cleanMdLord: cleanMd,
        startDate: row.start,
        endDate: row.end,
        adGroups: []
      };
      mdGroups.push(lastMd);
    } else {
      lastMd.endDate = row.end;
    }

    let lastAd = lastMd.adGroups[lastMd.adGroups.length - 1];
    if (!lastAd || lastAd.cleanAdLord !== cleanAd) {
      lastAd = {
        adLord: row.ad,
        cleanAdLord: cleanAd,
        startDate: row.start,
        endDate: row.end,
        pds: []
      };
      lastMd.adGroups.push(lastAd);
    } else {
      lastAd.endDate = row.end;
    }

    const noteRec = noteLookup.get(`${cleanMd}|${cleanAd}|${cleanPd}|${row.start}`);
    lastAd.pds.push({
      index: lastAd.pds.length + 1,
      mdLord: row.md,
      adLord: row.ad,
      pdLord: row.pd,
      cleanPdLord: cleanPd,
      startDate: row.start,
      endDate: row.end,
      totalDays: row.days,
      savedNote: noteRec?.notes ?? null,
      savedRating: noteRec?.evaluation_rating ?? null
    });
  }

  return mdGroups.map((m, mIdx) => {
    const mDays = Math.max(1, Math.round((Date.parse(m.endDate) - Date.parse(m.startDate)) / 86400000));
    return {
      index: mIdx + 1,
      mdLord: m.mdLord,
      cleanMdLord: m.cleanMdLord,
      startDate: m.startDate,
      endDate: m.endDate,
      totalDays: mDays,
      antardashas: m.adGroups.map((a, aIdx) => ({
        index: aIdx + 1,
        mdLord: m.mdLord,
        adLord: a.adLord,
        cleanAdLord: a.cleanAdLord,
        startDate: a.startDate,
        endDate: a.endDate,
        totalDays: Math.max(1, Math.round((Date.parse(a.endDate) - Date.parse(a.startDate)) / 86400000)),
        pds: a.pds
      }))
    };
  });
}

function buildDynamicYogasAndDoshas(
  personId: string,
  d1Rows: NatalPlacementRow[],
  lagnaIdx: number,
  moonIdx: number
): YogaDoshaData {
  if (personId === '001ME' || isChartSignature001ME(lagnaIdx, moonIdx, d1Rows)) {
    return validateD1YogasAndDoshasAgainstD1(D1_YOGAS_AND_DOSHAS_001ME, d1Rows, lagnaIdx, moonIdx);
  }

  const pSign = new Map<string, number>();
  for (const row of d1Rows) {
    const p = cleanNatalPlanetName(row.body_name);
    const s = getSignIdxFromAny(row.rashi_name, 0);
    if (p && s && p !== 'Lagna' && p !== 'Mandi') pSign.set(p, s);
  }

  const houseSign = (h: number) => ((lagnaIdx + h - 2) % 12) + 1;
  const houseLord = (h: number) => SIGN_LORD_EN[houseSign(h)];
  const hFrom = (s: number, base: number) => ((s - base + 12) % 12) + 1;
  const isKendra = (h: number) => [1, 4, 7, 10].includes(h);

  const rajaYogas: YogaDoshaData['rajaYogas'] = [];
  const generalYogas: YogaDoshaData['generalYogas'] = [];
  const doshas: YogaDoshaData['doshas'] = [];

  const sSun = pSign.get('Sun') || 0;
  const sMoon = pSign.get('Moon') || 0;
  const sMars = pSign.get('Mars') || 0;
  const sMerc = pSign.get('Mercury') || 0;
  const sJup = pSign.get('Jupiter') || 0;
  const sVen = pSign.get('Venus') || 0;
  const sSat = pSign.get('Saturn') || 0;

  // Dharma Karmadhipati
  const l9 = houseLord(9);
  const l10 = houseLord(10);
  const s9 = pSign.get(l9) || 0;
  const s10 = pSign.get(l10) || 0;
  if (s9 && s10 && (s9 === s10 || getAspectOffsets(l9).some(o => ((s9 - 1 + o - 1) % 12) + 1 === s10))) {
    rajaYogas.push({
      name: 'Dharma Karmadhipati Raja Yoga',
      participants: Array.from(new Set([l9, l10])),
      condition: `L9 (${l9}) at L${hFrom(s9, lagnaIdx)} linked with L10 (${l10}) at L${hFrom(s10, lagnaIdx)}`,
      domains: ['career', 'finance']
    });
  }

  // Gaja Kesari Yoga
  if (sMoon && sJup && isKendra(hFrom(sJup, sMoon))) {
    generalYogas.push({
      name: 'Gaja Kesari Yoga',
      condition: `Jupiter in M${hFrom(sJup, sMoon)} Kendra from Natal Moon`,
      domains: ['career', 'finance', 'family']
    });
  }

  // Budha-Aditya / Nipuna
  if (sSun && sMerc && sSun === sMerc) {
    generalYogas.push({
      name: 'Budha-Aditya (Nipuna) Yoga',
      condition: `Sun and Mercury conjoined in L${hFrom(sSun, lagnaIdx)} ${SIGN_NAMES_EN[sSun - 1]}`,
      domains: ['career', 'finance']
    });
  }

  // Chandra Mangala
  if (sMoon && sMars && (sMoon === sMars || hFrom(sMars, sMoon) === 7)) {
    generalYogas.push({
      name: 'Chandra-Mangala Yoga',
      condition: `Moon (L${hFrom(sMoon, lagnaIdx)}) & Mars (L${hFrom(sMars, lagnaIdx)}) mutual 1/7 connection`,
      domains: ['finance', 'career']
    });
  }

  // Pancha Mahapurusha check
  const mahapurusha = [
    { p: 'Mars', name: 'Ruchaka Yoga', signs: [1, 8, 10], domains: ['career', 'health'] as any },
    { p: 'Mercury', name: 'Bhadra Yoga', signs: [3, 6], domains: ['career', 'finance'] as any },
    { p: 'Jupiter', name: 'Hamsa Yoga', signs: [4, 9, 12], domains: ['career', 'love', 'family'] as any },
    { p: 'Venus', name: 'Malavya Yoga', signs: [2, 7, 12], domains: ['love', 'finance', 'family'] as any },
    { p: 'Saturn', name: 'Sasa Yoga', signs: [7, 10, 11], domains: ['career', 'finance'] as any }
  ];
  for (const m of mahapurusha) {
    const s = pSign.get(m.p) || 0;
    if (s && m.signs.includes(s) && isKendra(hFrom(s, lagnaIdx))) {
      rajaYogas.push({
        name: `${m.name} (Pancha Mahapurusha)`,
        participants: [m.p],
        condition: `${m.p} in Kendra L${hFrom(s, lagnaIdx)} ${SIGN_NAMES_EN[s - 1]} (Own/Exalted)`,
        domains: m.domains
      });
    }
  }

  // Vipareeta Raja Yoga
  for (const h of [6, 8, 12]) {
    const dl = houseLord(h);
    const ds = pSign.get(dl) || 0;
    if (ds && [6, 8, 12].includes(hFrom(ds, lagnaIdx))) {
      rajaYogas.push({
        name: 'Vipareetha Raja Yoga',
        participants: [dl],
        condition: `L${h} lord ${dl} placed in Dusthana L${hFrom(ds, lagnaIdx)} (gain after adversity/conflict)`,
        domains: ['career', 'health']
      });
      break;
    }
  }

  // Neecha Bhanga check
  for (const p of ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn']) {
    const nb = evaluateNatalNeechaBhanga(p, d1Rows, lagnaIdx, moonIdx);
    if (nb.isDebilitated && nb.hasNeechaBhanga) {
      rajaYogas.push({
        name: `Neecha Bhanga Raja Yoga (${p})`,
        participants: [p],
        condition: `${p} debilitated in L${hFrom(pSign.get(p) || 1, lagnaIdx)} cancelled via ${nb.reasons.join('; ')}`,
        domains: ['career', 'finance', 'love', 'family', 'health']
      });
    }
  }

  // Manglik check
  if (sMars && [1, 2, 4, 7, 8, 12].includes(hFrom(sMars, lagnaIdx))) {
    const hMars = hFrom(sMars, lagnaIdx);
    const isOwnExalt = [1, 8, 10].includes(sMars);
    doshas.push({
      name: 'Kuja (Manglik) Consideration',
      status: isOwnExalt ? 'Mitigated (Own/Exalt)' : 'Active',
      reasons: [`Mars in L${hMars} ${SIGN_NAMES_EN[sMars - 1]} influences marital/partnership temperament (L7/L8/L12).`],
      domains: ['love', 'family']
    });
  }

  // Pitru Dosha check
  if (sSun) {
    const h9S = houseSign(9);
    const malefics = ['Saturn', 'Mars', 'Rahu', 'Ketu'];
    const hits = malefics.filter(m => {
      const ms = pSign.get(m);
      if (!ms) return false;
      return ms === sSun || ms === h9S || getAspectOffsets(m).some(o => ((ms - 1 + o - 1) % 12) + 1 === sSun);
    });
    if (hits.length > 0) {
      doshas.push({
        name: 'Pitru / 9th-Sun Affliction Check',
        status: 'Present',
        reasons: [`Sun (L${hFrom(sSun, lagnaIdx)}) or 9th Bhava touched by ${hits.join(', ')}`],
        domains: ['family', 'career']
      });
    }
  }

  void sVen;
  void sSat;
  return { rajaYogas, generalYogas, doshas };
}

function getMutualSambandha(
  fromSummary: PlanetD1Summary,
  toSummary: PlanetD1Summary
): DashaSambandhaInfo {
  const dist = ((toSummary.signIdx - fromSummary.signIdx + 12) % 12) + 1;
  let patternLabel = `${dist}th from ${fromSummary.planet}`;
  let patternTone: DashaSambandhaInfo['patternTone'] = 'Harmonious';

  if (dist === 1) {
    patternLabel = '1/1 Yuti (Conjoined in Same Sign)';
    patternTone = 'Action-Kendra';
  } else if (dist === 5 || dist === 9) {
    patternLabel = `${dist}/${14 - dist} Trikona Harmony (Punya Flow)`;
    patternTone = 'Harmonious';
  } else if (dist === 4 || dist === 7 || dist === 10) {
    patternLabel = `${dist}/${14 - dist} Kendra Mutual Drive`;
    patternTone = 'Action-Kendra';
  } else if (dist === 3 || dist === 11) {
    patternLabel = `${dist}/${14 - dist} Upachaya Effort & Gains`;
    patternTone = 'Growth-Upachaya';
  } else if (dist === 6 || dist === 8) {
    patternLabel = `${dist}/${14 - dist} Shadashtaka (Testing / Upheaval)`;
    patternTone = 'Testing-6/8';
  } else {
    patternLabel = `${dist}/${14 - dist} Dwirdwadasha (Adjustment / Outflow)`;
    patternTone = 'Friction-2/12';
  }

  let friendshipLabel: DashaSambandhaInfo['friendshipLabel'] = 'Neutral';
  if (
    fromSummary.planet === 'Rahu' || fromSummary.planet === 'Ketu' ||
    toSummary.planet === 'Rahu' || toSummary.planet === 'Ketu'
  ) {
    friendshipLabel = 'Nodal';
  } else if (fromSummary.planet === toSummary.planet) {
    friendshipLabel = 'Mutual Friend';
  } else {
    const f1 = (FRIENDS[fromSummary.planet] || []).includes(toSummary.planet);
    const f2 = (FRIENDS[toSummary.planet] || []).includes(fromSummary.planet);
    const e1 = (ENEMIES[fromSummary.planet] || []).includes(toSummary.planet);
    const e2 = (ENEMIES[toSummary.planet] || []).includes(fromSummary.planet);
    if (f1 && f2) friendshipLabel = 'Mutual Friend';
    else if ((f1 && !e2) || (f2 && !e1)) friendshipLabel = 'One-Sided Friend';
    else if (e1 || e2) friendshipLabel = 'Tense / Enemy';
  }

  const connParts: string[] = [];
  if (fromSummary.signIdx === toSummary.signIdx) {
    connParts.push(`Conjoined in L${fromSummary.hLagna} ${fromSummary.signName}`);
  }
  if (fromSummary.aspectTargetsL.includes(toSummary.hLagna)) {
    connParts.push(`${fromSummary.planet} aspects ${toSummary.planet} (L${toSummary.hLagna})`);
  }
  if (toSummary.aspectTargetsL.includes(fromSummary.hLagna)) {
    connParts.push(`${toSummary.planet} aspects ${fromSummary.planet} (L${fromSummary.hLagna})`);
  }
  if (SIGN_LORD_EN[toSummary.signIdx] === fromSummary.planet) {
    connParts.push(`${fromSummary.planet} is dispositor of ${toSummary.planet}`);
  }
  if (SIGN_LORD_EN[fromSummary.signIdx] === toSummary.planet) {
    connParts.push(`${toSummary.planet} is dispositor of ${fromSummary.planet}`);
  }
  const mutualConnection = connParts.length > 0
    ? connParts.join('; ')
    : `No direct Yuti/Drishti; linked via ${dist}/${14 - dist} axis`;

  const summary = `${toSummary.planet} stands in ${patternLabel} from ${fromSummary.planet} (${friendshipLabel}). ${mutualConnection}.`;

  return {
    fromLord: fromSummary.planet,
    toLord: toSummary.planet,
    houseDistanceD1: dist,
    patternLabel,
    patternTone,
    friendshipLabel,
    mutualConnection,
    summary
  };
}

function scorePlanetGeneralStrength(p: PlanetD1Summary): number {
  let s = 56;
  if (p.dignity === 'Exalted') s += 18;
  else if (p.dignity === 'Own') s += 14;
  else if (p.dignity === 'Friend') s += 7;
  else if (p.dignity === 'Enemy') s -= 7;
  else if (p.isDebilitated) s += p.hasNeechaBhanga ? 6 : -14;

  if (p.isVargottama) s += 10;
  if (p.d9Dignity === 'Exalted' || p.d9Dignity === 'Own') s += 7;
  if (p.d9Dignity === 'Debilitated') s -= 6;
  if (p.isCombust) s -= 10;
  if (p.isRetro) s += 3; // Cheshta bala intensity

  if (p.shadbalaRatio !== null) {
    s += p.shadbalaRatio >= 1.15 ? 8 : p.shadbalaRatio >= 1.0 ? 4 : -6;
  }
  if (p.savAtSeat >= 30) s += 6;
  else if (p.savAtSeat < 25) s -= 6;

  if (p.functionalNature === 'Yogakaraka') s += 10;
  else if (p.functionalNature === 'Functional Benefic') s += 5;
  else if (p.functionalNature === 'Functional Malefic') s -= 4;

  return Math.max(15, Math.min(96, s));
}

function getToneFromScore(score: number): AspectPeriodEval['tone'] {
  if (score >= 72) return 'High';
  if (score >= 56) return 'Supportive';
  if (score >= 42) return 'Mixed';
  return 'Caution';
}

function evaluateAspectForLord(
  aspectId: NatalAspectId,
  lord: PlanetD1Summary,
  baselineScore: number,
  vargas: Record<string, VargaChartDef>,
  partnerLord?: PlanetD1Summary,
  sambandha?: DashaSambandhaInfo
): AspectPeriodEval {
  const spec = NATAL_ASPECT_SPECS[aspectId];
  let score = Math.round(baselineScore * 0.45 + scorePlanetGeneralStrength(lord) * 0.45);
  const reasons: string[] = [];

  const ownedMatches = lord.ownedHousesL.filter(h => spec.houses.includes(h));
  const primaryOwnedMatches = lord.ownedHousesL.filter(h => spec.primaryHouses.includes(h));
  const sitsInTarget = spec.houses.includes(lord.hLagna);
  const aspectsTarget = spec.houses.filter(h => lord.aspectTargetsL.includes(h));
  const isKaraka = spec.karakas.includes(lord.planet);

  if (primaryOwnedMatches.length > 0) {
    score += aspectId === 'litigations' ? -6 : 11;
    reasons.push(`${lord.planet} owns L${primaryOwnedMatches.join('/L')}`);
  } else if (ownedMatches.length > 0) {
    score += aspectId === 'litigations' ? -3 : 6;
    reasons.push(`${lord.planet} owns L${ownedMatches.join('/L')}`);
  }

  if (sitsInTarget) {
    const isDusthana = [6, 8, 12].includes(lord.hLagna);
    if (aspectId === 'litigations') {
      if (lord.hLagna === 6 && NATURAL_MALEFICS.has(lord.planet)) {
        score += 8; // Upachaya enemy victory
        reasons.push(`${lord.planet} in L6 yields competitive edge in disputes`);
      } else if (lord.hLagna === 8 || lord.hLagna === 12) {
        score -= 10;
        reasons.push(`${lord.planet} activates L${lord.hLagna} legal friction/expense`);
      } else if (lord.hLagna === 9) {
        score += 8;
        reasons.push(`${lord.planet} in L9 supports dharma & legal relief`);
      }
    } else if (aspectId === 'health') {
      if (isDusthana) {
        score -= lord.hasNeechaBhanga ? 4 : 10;
        reasons.push(`sits in Dusthana L${lord.hLagna}${lord.hasNeechaBhanga ? ' (NB recovery)' : ' (health watch)'}`);
      } else {
        score += 8;
        reasons.push(`occupies L${lord.hLagna}`);
      }
    } else {
      if (isDusthana && !spec.primaryHouses.includes(lord.hLagna)) {
        score -= 4;
        reasons.push(`placed in Dusthana L${lord.hLagna}`);
      } else {
        score += 10;
        reasons.push(`occupies focus L${lord.hLagna}`);
      }
    }
  } else if ([6, 8, 12].includes(lord.hLagna)) {
    if (aspectId === 'litigations') {
      score -= 8;
      reasons.push(`D1 seat in L${lord.hLagna} stirs conflict/cost`);
    } else {
      score -= 5;
      reasons.push(`sits in L${lord.hLagna}`);
    }
  }

  if (aspectsTarget.length > 0) {
    score += aspectId === 'litigations' && NATURAL_MALEFICS.has(lord.planet) ? -4 : 5;
    reasons.push(`aspects L${aspectsTarget.slice(0, 2).join('/L')}`);
  }

  if (isKaraka) {
    score += aspectId === 'litigations' ? -3 : 6;
    reasons.push(`natural karaka for ${spec.shortLabel}`);
  }

  // Divisional Varga seat boost for primary aspect Varga
  const primaryVargaCode = spec.vargas.find(v => v !== 'D1' && v !== 'D9') || 'D9';
  const vChart = vargas[primaryVargaCode];
  if (vChart) {
    const hFound = vChart.houses.find(h =>
      h.planets.some(p => cleanNatalPlanetName(p) === lord.planet)
    );
    if (hFound) {
      const vSignIdx = getSignIdxFromAny(hFound.sign, 1);
      const vDig = getSignDignity(lord.planet, vSignIdx);
      if (vDig === 'Exalted' || vDig === 'Own') {
        score += 8;
        reasons.push(`${primaryVargaCode} H${hFound.house}(${vDig})`);
      } else if (vDig === 'Debilitated') {
        score -= 7;
        reasons.push(`${primaryVargaCode} H${hFound.house}(Debil)`);
      } else if ([1, 4, 5, 7, 9, 10, 11].includes(hFound.house)) {
        score += 4;
        reasons.push(`${primaryVargaCode} H${hFound.house}`);
      } else {
        reasons.push(`${primaryVargaCode} H${hFound.house}`);
      }
    }
  }

  if (sambandha) {
    if (sambandha.patternTone === 'Harmonious' || sambandha.patternTone === 'Action-Kendra') {
      score += 6;
    } else if (sambandha.patternTone === 'Testing-6/8') {
      score -= 10;
      reasons.push(`MD-AD 6/8 Shadashtaka friction`);
    } else if (sambandha.patternTone === 'Friction-2/12') {
      score -= 6;
      reasons.push(`MD-AD 2/12 tension`);
    }
  }

  if (partnerLord) {
    const pStrength = scorePlanetGeneralStrength(partnerLord);
    if (pStrength >= 70) score += 4;
    else if (pStrength <= 42) score -= 5;
  }

  score = Math.max(18, Math.min(95, score));
  const tone = getToneFromScore(score);

  // Special framing for Litigations: high score = Protected/Victory/Resolved; low score = Legal Exposure/Friction
  let verdict = '';
  if (aspectId === 'litigations') {
    verdict =
      score >= 70
        ? 'Protected / Upper Hand in Disputes'
        : score >= 55
        ? 'Manageable / Negotiated Resolution'
        : score >= 42
        ? 'Caution: Contention & Paperwork Friction'
        : 'Elevated Legal / Rival Vulnerability';
  } else if (aspectId === 'health') {
    verdict =
      score >= 70
        ? 'Vitality & Resilient Recovery'
        : score >= 55
        ? 'Stable with Routine Pacing'
        : score >= 42
        ? 'Sensitivity / Stress Fatigue'
        : 'Vulnerable: Preventive Care Priority';
  } else {
    verdict =
      score >= 72
        ? `Strong Natal Delivery for ${spec.shortLabel}`
        : score >= 56
        ? `Supportive Progress in ${spec.shortLabel}`
        : score >= 42
        ? `Mixed / Effort-Driven ${spec.shortLabel}`
        : `Constrained / Tested ${spec.shortLabel}`;
  }

  const rationale = reasons.length > 0
    ? `${lord.planet} (L${lord.hLagna}/M${lord.hMoon}${lord.dignity ? `, ${lord.dignity}` : ''}): ${reasons.join(' | ')}.`
    : `${lord.planet} at L${lord.hLagna}/M${lord.hMoon} (${lord.dignity || 'Neutral'}), D9 H${lord.d9House}.`;

  return {
    aspectId,
    label: spec.label,
    score,
    tone,
    verdict,
    rationale
  };
}

export function evaluateNatalDashaPromise(params: {
  personId: string;
  profile: NatalPersonProfileInput;
  placements: NatalPlacementRow[];
  apiIntervals?: DashaIntervalItem[];
  savedNotes?: DashaEvaluationRecord[];
  selectedMdIndex?: number;
  selectedAdIndex?: number;
}): {
  dashaTree: NatalMdOption[];
  evaluation: NatalDashaPromiseEvaluation;
} {
  const {
    personId,
    profile,
    placements,
    apiIntervals,
    savedNotes = [],
    selectedMdIndex,
    selectedAdIndex
  } = params;

  const d1Rows = placements.filter(p => !p.chart_type || p.chart_type === 'D1');
  const d9Rows = placements.filter(p => p.chart_type === 'D9');

  const lagnaRow = d1Rows.find(p => cleanNatalPlanetName(p.body_name) === 'Lagna');
  const moonRow = d1Rows.find(p => cleanNatalPlanetName(p.body_name) === 'Moon');

  const lagnaIdx = getSignIdxFromAny(lagnaRow?.rashi_name || profile.birth_lagna, 9);
  const moonIdx = getSignIdxFromAny(moonRow?.rashi_name || profile.birth_rashi, 8);
  const lagnaSign = SIGN_NAMES_EN[lagnaIdx - 1];
  const moonSign = SIGN_NAMES_EN[moonIdx - 1];
  const janmaStar = `${profile.birth_star || moonRow?.nakshatra_name || 'Anuradha'} P${profile.birth_star_pada || moonRow?.pada || 1}`;

  const is001ME = personId === '001ME' || isChartSignature001ME(lagnaIdx, moonIdx, d1Rows);

  const ashtakavarga: AshtakavargaReport = is001ME
    ? {
        savTotalPoints: CALIBRATED_ASHTAKAVARGA_001ME.savTotalPoints,
        savTotalSum: CALIBRATED_ASHTAKAVARGA_001ME.savTotalSum,
        bavByPlanet: CALIBRATED_ASHTAKAVARGA_001ME.bavByPlanet,
        targetHousePoints: 0,
        targetHouseStrength: 'Strong (28-32)',
        allHousesOverview: CALIBRATED_ASHTAKAVARGA_001ME.allHousesOverview
      }
    : computeSarvashtakavarga(lagnaIdx, undefined, d1Rows);

  const vargas = computeAllVargasForPerson(personId, d1Rows, d9Rows, lagnaIdx, moonIdx);
  const yogasAndDoshas = buildDynamicYogasAndDoshas(personId, d1Rows, lagnaIdx, moonIdx);

  // D9 lookup
  const d9LagnaRow = d9Rows.find(r => cleanNatalPlanetName(r.body_name) === 'Lagna');
  const d9LagnaIdx = d9LagnaRow
    ? getSignIdxFromAny(d9LagnaRow.rashi_name, 1)
    : computeVargaSignIndex(9, lagnaIdx, parseDegreeFloat(lagnaRow?.degree_sputa) ?? 15);

  const d9Lookup = new Map<string, { signIdx: number; signName: string; hD9: number }>();
  for (const row of d1Rows) {
    const pName = cleanNatalPlanetName(row.body_name);
    if (!pName || pName === 'Lagna' || pName === 'Mandi') continue;
    const matchedD9 = d9Rows.find(r => cleanNatalPlanetName(r.body_name) === pName);
    const d1S = getSignIdxFromAny(row.rashi_name, 1);
    const sIdx = matchedD9
      ? getSignIdxFromAny(matchedD9.rashi_name, 1)
      : computeVargaSignIndex(9, d1S, parseDegreeFloat(row.degree_sputa) ?? 15);
    const hD9 = matchedD9?.house_number || (((sIdx - d9LagnaIdx + 12) % 12) + 1);
    d9Lookup.set(pName, {
      signIdx: sIdx,
      signName: SIGN_NAMES_EN[sIdx - 1],
      hD9
    });
  }

  // Sun longitude for combustion
  const sunRow = d1Rows.find(r => cleanNatalPlanetName(r.body_name) === 'Sun');
  const sunSignIdx = sunRow ? getSignIdxFromAny(sunRow.rashi_name, 0) : 0;
  const sunDeg = sunRow ? parseDegreeFloat(sunRow.degree_sputa) : null;
  const sunLon = sunSignIdx && sunDeg !== null ? (sunSignIdx - 1) * 30 + sunDeg : null;

  // Sign occupants for conjunctions
  const occupantsBySign = new Map<number, string[]>();
  for (const row of d1Rows) {
    const pName = cleanNatalPlanetName(row.body_name);
    const sIdx = getSignIdxFromAny(row.rashi_name, 0);
    if (!pName || !sIdx || pName === 'Lagna' || pName === 'Mandi') continue;
    const list = occupantsBySign.get(sIdx) || [];
    list.push(pName);
    occupantsBySign.set(sIdx, list);
  }

  const shadbalaMap = new Map(
    (is001ME ? SHADBALA_STRENGTHS_001ME : []).map(s => [s.planet, s])
  );

  // Build PlanetD1Summary map for all 9 Vimshottari lords
  const nineGrahas = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
  const rawPlanets: Record<string, PlanetD1Summary> = {};

  for (const g of nineGrahas) {
    const row = d1Rows.find(r => cleanNatalPlanetName(r.body_name) === g);
    const sIdx = row ? getSignIdxFromAny(row.rashi_name, lagnaIdx) : lagnaIdx;
    const hL = row?.house_number || (((sIdx - lagnaIdx + 12) % 12) + 1);
    const hM = ((sIdx - moonIdx + 12) % 12) + 1;
    const degFloat = row ? parseDegreeFloat(row.degree_sputa) : null;
    const degStr = degFloat !== null ? formatDegStr(degFloat) : (row?.degree_sputa || '-');
    const isRetro = !!row?.is_retrograde;
    const dignity = getSignDignity(g, sIdx, isRetro);
    const nb = (g !== 'Rahu' && g !== 'Ketu')
      ? evaluateNatalNeechaBhanga(g, d1Rows, lagnaIdx, moonIdx)
      : { isDebilitated: false, hasNeechaBhanga: false, reasons: [] };

    let isCombust = false;
    let combustGapStr: string | null = null;
    if (g !== 'Sun' && g !== 'Rahu' && g !== 'Ketu' && sunLon !== null && degFloat !== null) {
      const pLon = (sIdx - 1) * 30 + degFloat;
      const diff = Math.abs(pLon - sunLon);
      const gap = Math.min(diff, 360 - diff);
      const orb = COMBUST_ORB[g] ?? 10;
      const effOrb = (g === 'Mercury' || g === 'Venus') && isRetro ? orb - 2 : orb;
      if (gap <= effOrb) {
        isCombust = true;
        combustGapStr = formatDegStr(gap);
      }
    }

    const ownedSigns = OWNED_SIGNS_EN[g] || [];
    const ownedHousesL = ownedSigns.map(s => ((s - lagnaIdx + 12) % 12) + 1).sort((a, b) => a - b);
    const ownedHousesM = ownedSigns.map(s => ((s - moonIdx + 12) % 12) + 1).sort((a, b) => a - b);

    let functionalNature: PlanetD1Summary['functionalNature'] = 'Neutral';
    if (g === 'Rahu' || g === 'Ketu') {
      functionalNature = 'Node';
    } else {
      const isK = ownedHousesL.some(h => [1, 4, 7, 10].includes(h));
      const isT = ownedHousesL.some(h => [1, 5, 9].includes(h));
      const isD = ownedHousesL.some(h => [6, 8, 12].includes(h));
      const isM = ownedHousesL.some(h => [2, 7].includes(h));
      if (isK && isT) functionalNature = 'Yogakaraka';
      else if (isT) functionalNature = 'Functional Benefic';
      else if (isD) functionalNature = 'Functional Malefic';
      else if (isM) functionalNature = 'Maraka';
      else if (isK) functionalNature = 'Functional Benefic';
    }

    const aspectTargetsL = getAspectOffsets(g).map(off => ((hL - 1 + off - 1) % 12) + 1);
    const d9Info = d9Lookup.get(g) || { signIdx: sIdx, signName: SIGN_NAMES_EN[sIdx - 1], hD9: hL };
    const d9Dig = (g !== 'Rahu' && g !== 'Ketu') ? getSignDignity(g, d9Info.signIdx) : '';
    const shad = shadbalaMap.get(g);

    rawPlanets[g] = {
      planet: g,
      signIdx: sIdx,
      signName: SIGN_NAMES_EN[sIdx - 1],
      hLagna: hL,
      hMoon: hM,
      degStr,
      degFloat,
      nakshatra: row?.nakshatra_name || '-',
      pada: row?.pada || 1,
      isRetro,
      dignity,
      isDebilitated: nb.isDebilitated,
      hasNeechaBhanga: nb.hasNeechaBhanga,
      neechaBhangaReasons: nb.reasons,
      isCombust,
      combustGapStr,
      ownedHousesL,
      ownedHousesM,
      functionalNature,
      conjunctWith: (occupantsBySign.get(sIdx) || []).filter(o => o !== g),
      aspectTargetsL,
      incomingAspectors: [],
      savAtSeat: ashtakavarga.savTotalPoints[sIdx] ?? 28,
      bavSelfAtSeat: ashtakavarga.bavByPlanet?.[g]?.[sIdx] ?? null,
      d9Sign: d9Info.signName,
      d9House: d9Info.hD9,
      d9Dignity: d9Dig,
      isVargottama: d9Info.signIdx === sIdx,
      shadbalaRatio: shad ? shad.ratio : null,
      shadbalaStatus: shad ? `${shad.ratio.toFixed(2)} (${shad.status})` : null
    };
  }

  // Populate incoming aspectors
  for (const targetG of nineGrahas) {
    const tH = rawPlanets[targetG].hLagna;
    rawPlanets[targetG].incomingAspectors = nineGrahas.filter(
      srcG => srcG !== targetG && rawPlanets[srcG].aspectTargetsL.includes(tH)
    );
  }

  // Jaimini 7-Karaka + Karakamsa + Arudhas
  const sevenPlanets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  const karakaRanks = ['AK', 'AmK', 'BK', 'MK', 'PK', 'GK', 'DK'];
  const ranked7 = sevenPlanets
    .map(p => ({ p, sum: rawPlanets[p] }))
    .filter(x => x.sum.degFloat !== null)
    .sort((a, b) => (b.sum.degFloat ?? 0) - (a.sum.degFloat ?? 0));

  const jaiminiKarakas = ranked7.map((item, idx) => ({
    rank: karakaRanks[idx] || `K${idx + 1}`,
    planet: item.p,
    degStr: item.sum.degStr,
    hL: item.sum.hLagna,
    hM: item.sum.hMoon
  }));

  const akInfo = ranked7[0] ? d9Lookup.get(ranked7[0].p) : null;
  const karakamsa = akInfo
    ? {
        signName: akInfo.signName,
        hL: ((akInfo.signIdx - lagnaIdx + 12) % 12) + 1,
        hM: ((akInfo.signIdx - moonIdx + 12) % 12) + 1,
        hD9: akInfo.hD9
      }
    : null;

  const computeArudha = (houseNum: number) => {
    const hSignIdx = ((lagnaIdx + houseNum - 2) % 12) + 1;
    const lord = SIGN_LORD_EN[hSignIdx];
    const lSignIdx = rawPlanets[lord]?.signIdx || hSignIdx;
    const steps = ((lSignIdx - hSignIdx + 12) % 12) + 1;
    let arSign = ((lSignIdx + steps - 2) % 12) + 1;
    const dist = ((arSign - hSignIdx + 12) % 12) + 1;
    if (dist === 1 || dist === 7) {
      arSign = ((hSignIdx + 8) % 12) + 1;
    }
    return {
      signName: SIGN_NAMES_EN[arSign - 1],
      hL: ((arSign - lagnaIdx + 12) % 12) + 1,
      hM: ((arSign - moonIdx + 12) % 12) + 1
    };
  };

  const arudhas = [
    { label: 'AL (A1)', ...computeArudha(1) },
    { label: 'A5', ...computeArudha(5) },
    { label: 'A7', ...computeArudha(7) },
    { label: 'A10', ...computeArudha(10) },
    { label: 'A11', ...computeArudha(11) },
    { label: 'UL (A12)', ...computeArudha(12) }
  ];

  // Baseline evaluation for all 6 aspects
  const baselineAspects = {} as Record<NatalAspectId, NatalBaselineAspectEval>;

  for (const aspectId of NATAL_ASPECT_ORDER) {
    const spec = NATAL_ASPECT_SPECS[aspectId];
    let score = 58;
    const factors: string[] = [];
    const houseDetails: string[] = [];

    for (const hNum of spec.primaryHouses) {
      const hSignIdx = ((lagnaIdx + hNum - 2) % 12) + 1;
      const hLordName = SIGN_LORD_EN[hSignIdx];
      const lordSum = rawPlanets[hLordName];
      const sav = ashtakavarga.savTotalPoints[hSignIdx] ?? 28;
      const occupants = nineGrahas.filter(g => rawPlanets[g].hLagna === hNum);

      if (sav >= 30) score += 5;
      else if (sav >= 28) score += 2;
      else if (sav < 25) score -= 5;

      if (lordSum) {
        if (aspectId === 'litigations') {
          if (hNum === 6 && (lordSum.dignity === 'Own' || lordSum.dignity === 'Exalted')) {
            score += 6;
          } else if ((hNum === 8 || hNum === 12) && [6, 8, 12].includes(lordSum.hLagna)) {
            score -= 6;
          }
        } else {
          if (lordSum.dignity === 'Exalted' || lordSum.dignity === 'Own') score += 7;
          else if (lordSum.isDebilitated && !lordSum.hasNeechaBhanga) score -= 7;
          else if (lordSum.hasNeechaBhanga) score += 4;
          if ([1, 4, 5, 7, 9, 10, 11].includes(lordSum.hLagna)) score += 4;
          else if ([6, 8, 12].includes(lordSum.hLagna)) score -= 4;
        }
      }

      for (const occ of occupants) {
        if (NATURAL_BENEFICS.has(occ)) score += aspectId === 'litigations' ? 4 : 4;
        if (NATURAL_MALEFICS.has(occ) && aspectId !== 'litigations') score -= 2;
      }

      houseDetails.push(
        `L${hNum}(lord ${hLordName}@L${lordSum?.hLagna || '?'}, SAV ${sav}${occupants.length ? `, occ:${occupants.join('/')}` : ''})`
      );
    }

    // Karaka check
    const primaryKaraka = spec.karakas[0];
    const kSum = rawPlanets[primaryKaraka];
    if (kSum) {
      const kStr = scorePlanetGeneralStrength(kSum);
      if (kStr >= 68) score += 6;
      else if (kStr <= 45) score -= 6;
      factors.push(`Karaka ${primaryKaraka} at L${kSum.hLagna}/M${kSum.hMoon} (${kSum.dignity || 'Neutral'}, D9 H${kSum.d9House})`);
    }

    // Varga summary line
    const vargaBits: string[] = [];
    for (const vCode of spec.vargas) {
      if (vCode === 'D1') continue;
      if (vCode === 'D9' && kSum) {
        vargaBits.push(`D9:${kSum.planet}@H${kSum.d9House}${kSum.isVargottama ? '(Vargottama)' : kSum.d9Dignity ? `(${kSum.d9Dignity})` : ''}`);
        continue;
      }
      const vc = vargas[vCode];
      if (vc && kSum) {
        const seat = vc.houses.find(h => h.planets.some(p => cleanNatalPlanetName(p) === kSum.planet));
        if (seat) vargaBits.push(`${vCode}:Lagna ${vc.lagnaSign}, ${kSum.planet}@H${seat.house}`);
      }
    }

    // Relevant Yogas / Doshas
    const domainForYoga = aspectId === 'litigations' ? 'health' : aspectId;
    const matchedYogas = [
      ...yogasAndDoshas.rajaYogas.filter(y => y.domains.includes(domainForYoga as any)).map(y => y.name),
      ...yogasAndDoshas.generalYogas.filter(y => y.domains.includes(domainForYoga as any)).map(y => y.name)
    ].slice(0, 3);
    if (matchedYogas.length > 0) {
      score += 5;
      factors.push(`Yogas: ${matchedYogas.join(', ')}`);
    }

    const matchedDoshas = yogasAndDoshas.doshas.filter(d => d.domains.includes(domainForYoga as any));
    if (matchedDoshas.length > 0) {
      score -= 4;
      factors.push(`Dosha Watch: ${matchedDoshas.map(d => d.name).join(', ')}`);
    }

    score = Math.max(22, Math.min(95, score));
    const band: NatalBaselineAspectEval['band'] =
      score >= 68 ? 'Strong Promise' : score >= 52 ? 'Moderate / Balanced Promise' : 'Tested / Delayed Promise';

    const verdict =
      aspectId === 'litigations'
        ? score >= 68
          ? 'Strong legal resilience & capacity to prevail over rivals'
          : score >= 52
          ? 'Manageable legal karma; caution during Dusthana Dashas'
          : 'Elevated dispute sensitivity; avoid speculative legal escalation'
        : score >= 68
        ? `High structural natal ceiling in ${spec.shortLabel}`
        : score >= 52
        ? `Solid but effort-catalyzed ${spec.shortLabel} promise`
        : `Gradual / karmically tested ${spec.shortLabel} path requiring careful Dasha selection`;

    baselineAspects[aspectId] = {
      aspectId,
      label: spec.label,
      score,
      band,
      verdict,
      focusHousesSummary: houseDetails.join(' | '),
      vargaSummary: vargaBits.join(' • ') || 'D1 & D9 foundational alignment',
      keyFactors: factors
    };
  }

  // Build Dasha Tree & Pick Selected MD / AD
  const dashaTree = buildDashaHierarchyTree(profile, apiIntervals, savedNotes);
  const todayIso = new Date().toISOString().slice(0, 10);

  let mdIdx = typeof selectedMdIndex === 'number' && selectedMdIndex >= 0 && selectedMdIndex < dashaTree.length
    ? selectedMdIndex
    : dashaTree.findIndex(m => m.startDate <= todayIso && m.endDate >= todayIso);
  if (mdIdx < 0) mdIdx = 0;

  const selectedMd = dashaTree[mdIdx];
  let adIdx = typeof selectedAdIndex === 'number' && selectedAdIndex >= 0 && selectedAdIndex < selectedMd.antardashas.length
    ? selectedAdIndex
    : selectedMd.antardashas.findIndex(a => a.startDate <= todayIso && a.endDate >= todayIso);
  if (adIdx < 0) adIdx = 0;

  const selectedAd = selectedMd.antardashas[adIdx];

  const mdSummary = rawPlanets[selectedMd.cleanMdLord] || rawPlanets['Venus'];
  const adSummary = rawPlanets[selectedAd.cleanAdLord] || rawPlanets['Saturn'];
  const mdAdSambandha = getMutualSambandha(mdSummary, adSummary);

  // MD Level & AD Level evaluations across all 6 aspects
  const mdAspects = {} as Record<NatalAspectId, AspectPeriodEval>;
  const adAspects = {} as Record<NatalAspectId, AspectPeriodEval>;

  for (const aspectId of NATAL_ASPECT_ORDER) {
    const baseScore = baselineAspects[aspectId].score;
    mdAspects[aspectId] = evaluateAspectForLord(aspectId, mdSummary, baseScore, vargas);
    adAspects[aspectId] = evaluateAspectForLord(
      aspectId,
      adSummary,
      Math.round((baseScore + mdAspects[aspectId].score) / 2),
      vargas,
      mdSummary,
      mdAdSambandha
    );
  }

  const topAdAspects = [...NATAL_ASPECT_ORDER]
    .filter(a => a !== 'litigations')
    .sort((a, b) => adAspects[b].score - adAspects[a].score);

  const adExecutiveSummary =
    `${selectedMd.cleanMdLord} MD (${selectedMd.startDate} to ${selectedMd.endDate}) sets a ${mdSummary.functionalNature} foundation from L${mdSummary.hLagna}/M${mdSummary.hMoon} (${mdSummary.dignity || 'Neutral'}, D9 H${mdSummary.d9House}). ` +
    `Inside it, ${selectedAd.cleanAdLord} AD (${selectedAd.startDate} to ${selectedAd.endDate}) establishes a ${mdAdSambandha.patternLabel} axis from L${adSummary.hLagna}/M${adSummary.hMoon} (owns L${adSummary.ownedHousesL.join('/L') || 'Node'}). ` +
    `Strongest natal promise centers on ${NATAL_ASPECT_SPECS[topAdAspects[0]].shortLabel} (${adAspects[topAdAspects[0]].score}%) & ${NATAL_ASPECT_SPECS[topAdAspects[1]].shortLabel} (${adAspects[topAdAspects[1]].score}%), while ${NATAL_ASPECT_SPECS.litigations.shortLabel} reads "${adAspects.litigations.verdict}".`;

  // Sequential Walkthrough across ALL 9 Pratyantardashas in this MD-AD
  const pdWalkthrough: PdWalkthroughItem[] = selectedAd.pds.map(pdOpt => {
    const pdSum = rawPlanets[pdOpt.cleanPdLord] || rawPlanets['Sun'];
    const linkToMd = getMutualSambandha(mdSummary, pdSum);
    const linkToAd = getMutualSambandha(adSummary, pdSum);

    const vargaHighlights: string[] = [];
    vargaHighlights.push(`D9 H${pdSum.d9House} ${pdSum.d9Sign}${pdSum.isVargottama ? ' (Vargottama)' : pdSum.d9Dignity ? ` (${pdSum.d9Dignity})` : ''}`);
    for (const vCode of ['D10', 'D2', 'D4', 'D7', 'D6']) {
      const vc = vargas[vCode];
      const seat = vc?.houses.find(h => h.planets.some(p => cleanNatalPlanetName(p) === pdSum.planet));
      if (seat) {
        const sIdx = getSignIdxFromAny(seat.sign, 1);
        const dig = getSignDignity(pdSum.planet, sIdx);
        vargaHighlights.push(`${vCode} H${seat.house}${dig ? ` (${dig})` : ''}`);
      }
    }

    const aspectEvals = {} as Record<NatalAspectId, AspectPeriodEval>;
    let sumScores = 0;
    for (const aspectId of NATAL_ASPECT_ORDER) {
      const blendedBase = Math.round((adAspects[aspectId].score * 0.55) + (baselineAspects[aspectId].score * 0.45));
      const ev = evaluateAspectForLord(aspectId, pdSum, blendedBase, vargas, adSummary, linkToAd);
      aspectEvals[aspectId] = ev;
      sumScores += ev.score;
    }

    const overallScore = Math.round(sumScores / NATAL_ASPECT_ORDER.length);
    const overallTone: PdWalkthroughItem['overallTone'] =
      overallScore >= 68
        ? 'Peak / Auspicious'
        : overallScore >= 56
        ? 'Productive'
        : overallScore >= 46
        ? 'Mixed / Pivot'
        : 'Challenging / Careful';

    const bestPdAspect = [...NATAL_ASPECT_ORDER]
      .sort((a, b) => aspectEvals[b].score - aspectEvals[a].score)[0];

    const headlineSummary =
      `${pdSum.planet} PD from L${pdSum.hLagna}/M${pdSum.hMoon} (${linkToAd.patternLabel} from AD ${adSummary.planet}, ${linkToMd.houseDistanceD1}th from MD ${mdSummary.planet}) activates ${pdSum.ownedHousesL.length ? `L${pdSum.ownedHousesL.join('/L')}` : 'nodal karmic axes'} — spotlight on ${NATAL_ASPECT_SPECS[bestPdAspect].shortLabel} (${aspectEvals[bestPdAspect].verdict}).`;

    return {
      pdOption: pdOpt,
      pdSummary: pdSum,
      linkToMd,
      linkToAd,
      vargaHighlights,
      overallScore,
      overallTone,
      headlineSummary,
      aspectEvaluations: aspectEvals
    };
  });

  return {
    dashaTree,
    evaluation: {
      personId,
      profile,
      lagnaIdx,
      lagnaSign,
      moonIdx,
      moonSign,
      janmaStar,
      planetsD1: rawPlanets,
      vargas,
      ashtakavarga,
      yogasAndDoshas,
      jaiminiKarakas,
      karakamsa,
      arudhas,
      baselineAspects,
      selectedMd,
      selectedAd,
      mdSummary,
      adSummary,
      mdAdSambandha,
      mdAspects,
      adAspects,
      adExecutiveSummary,
      pdWalkthrough
    }
  };
}
