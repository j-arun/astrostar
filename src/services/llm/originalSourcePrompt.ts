import originalSourceRulesRaw from './originalSourceRules.txt?raw';
import originalSourceRulesBaselineRaw from './originalSourceRulesBaseline.txt?raw';
import { OriginalSourceDomain, VedicHouseContext } from './types';
import { getGrahaTransitPosition, GrahaTransitPosition, NAKSHATRAS } from '../../data/transitEphemeris';
import { calculateTaraBala, calculateChandraBala, computeSarvashtakavarga } from '../../data/parasharaCalculations';
import { getFullVimshottariTimeline, getSookshmaDashaIntervalsForDateRange } from '../../data/dashaCalculator';
import {
  apply001MEEnrichments,
  buildVargaDomainSummary,
  DOMAIN_PROMPT_SPECS,
  evaluateNatalNeechaBhanga,
  VargaChartDef
} from '../../data/vargaAndStrengthData';
import {
  getCleanSignIndex,
  getParasharaAspectEntries
} from './vedicPromptHelpers';

export type OriginalSourceVariant = 'baseline' | 'compact';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

const SIGN_LIST_EN = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

const SIGN_ABBR_EN: Record<string, string> = {
  Aries: 'Ari',
  Taurus: 'Tau',
  Gemini: 'Gem',
  Cancer: 'Can',
  Leo: 'Leo',
  Virgo: 'Vir',
  Libra: 'Lib',
  Scorpio: 'Sco',
  Sagittarius: 'Sag',
  Capricorn: 'Cap',
  Aquarius: 'Aqu',
  Pisces: 'Pis'
};

const OWNED_SIGN_INDICES: Record<string, number[]> = {
  Sun: [5],
  Moon: [4],
  Mars: [1, 8],
  Mercury: [3, 6],
  Jupiter: [9, 12],
  Venus: [2, 7],
  Saturn: [10, 11]
};

// Classical Parashara exaltation & debilitation signs for 7 planets only (matches D9 source; no node exaltation/debilitation flags added).
const CLASSICAL_EXALT_SIGNS: Record<string, number> = {
  Sun: 1,
  Moon: 2,
  Mars: 10,
  Mercury: 6,
  Jupiter: 4,
  Venus: 12,
  Saturn: 7
};

const CLASSICAL_DEBIL_SIGNS: Record<string, number> = {
  Sun: 7,
  Moon: 8,
  Mars: 4,
  Mercury: 12,
  Jupiter: 10,
  Venus: 6,
  Saturn: 1
};

const COMBUSTION_ORBS: Record<string, number> = {
  Moon: 12,
  Mars: 17,
  Mercury: 14,
  Jupiter: 11,
  Venus: 10,
  Saturn: 15
};

const SIGN_PRIMARY_LORD_EN: Record<number, string> = {
  1: 'Mars', 2: 'Venus', 3: 'Mercury', 4: 'Moon',
  5: 'Sun', 6: 'Mercury', 7: 'Venus', 8: 'Mars',
  9: 'Jupiter', 10: 'Saturn', 11: 'Saturn', 12: 'Jupiter'
};

const NAISARGIKA_FRIENDS: Record<string, string[]> = {
  Sun: ['Moon', 'Mars', 'Jupiter'],
  Moon: ['Sun', 'Mercury'],
  Mars: ['Sun', 'Moon', 'Jupiter'],
  Mercury: ['Sun', 'Venus'],
  Jupiter: ['Sun', 'Moon', 'Mars'],
  Venus: ['Mercury', 'Saturn'],
  Saturn: ['Mercury', 'Venus']
};

const NAISARGIKA_ENEMIES: Record<string, string[]> = {
  Sun: ['Venus', 'Saturn'],
  Moon: [],
  Mars: ['Mercury'],
  Mercury: ['Moon'],
  Jupiter: ['Mercury', 'Venus'],
  Venus: ['Sun', 'Moon'],
  Saturn: ['Sun', 'Moon', 'Mars']
};

const HOUR_MS = 60 * 60 * 1000;
const MIN_MS = 60 * 1000;
const IST_OFFSET_MS = (5 * 60 + 30) * MIN_MS;

function toUtcIsoMin(ms: number): string {
  return `${new Date(ms).toISOString().slice(0, 16)}Z`;
}

function toIstDateStr(ms: number): string {
  return new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10);
}

function formatIstRange(startMs: number, endMs: number): string {
  const s = toIstDateStr(startMs);
  const e = toIstDateStr(endMs);
  return s === e ? `IST ${s}` : `IST ${s}..${e}`;
}

function formatUtcEndpoint(ms: number, isStartOfMonthDay: boolean, isEndOfMonthDay: boolean): string {
  const dt = new Date(ms);
  const datePart = dt.toISOString().slice(0, 10);
  const hh = dt.getUTCHours();
  const mm = dt.getUTCMinutes();
  if (isStartOfMonthDay && hh === 0 && mm === 0) return datePart;
  if (isEndOfMonthDay && hh === 23 && mm === 59) return datePart;
  return `${datePart}T${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}Z`;
}

function getNaisargikaDignity(planet: string, signIdx: number, isRetro?: boolean): string {
  if (!signIdx) return '';
  if (CLASSICAL_EXALT_SIGNS[planet] === signIdx) return 'Exalted';
  if (CLASSICAL_DEBIL_SIGNS[planet] === signIdx) return isRetro ? 'Debil-Vakra' : 'Debilitated';
  if ((OWNED_SIGN_INDICES[planet] || []).includes(signIdx)) return 'Own';
  const signLord = SIGN_PRIMARY_LORD_EN[signIdx];
  if (!signLord) return '';
  if ((NAISARGIKA_FRIENDS[planet] || []).includes(signLord)) return 'Friend';
  if ((NAISARGIKA_ENEMIES[planet] || []).includes(signLord)) return 'Enemy';
  if (planet === 'Rahu' || planet === 'Ketu') return '';
  return 'Neutral';
}

function parseDegreeFloat(degStr?: string): number | null {
  if (!degStr) return null;
  const m = String(degStr).match(/(\d{1,2})\s*°\s*(\d{1,2})?(?:\s*'\s*(\d{1,2}))?/);
  if (!m) return null;
  const d = parseInt(m[1], 10);
  const mins = m[2] ? parseInt(m[2], 10) : 0;
  const secs = m[3] ? parseInt(m[3], 10) : 0;
  return d + mins / 60 + secs / 3600;
}

function formatDegreeFromFloat(degInSign: number): string {
  const norm = ((degInSign % 30) + 30) % 30;
  const d = Math.floor(norm);
  const m = Math.floor((norm - d) * 60 + 1e-6);
  const adjD = m >= 60 ? d + 1 : d;
  const adjM = m >= 60 ? m - 60 : m;
  return `${String(adjD).padStart(2, '0')}°${String(adjM).padStart(2, '0')}'`;
}

const TARA_SHORT_LABEL: Record<number, string> = {
  1: 'Janma',
  2: 'Sampat',
  3: 'Vipat',
  4: 'Kshema',
  5: 'Pratyak',
  6: 'Sadhana',
  7: 'Naidhana',
  8: 'Mitra',
  9: 'Parama Mitra'
};

function cleanSign(s?: string): string {
  if (!s) return '';
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
  const out = String(s).replace(/[\u0B80-\u0BFF]+/g, '').trim();
  const paren = out.match(/\((Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)\)/i);
  if (paren) return paren[1];
  for (const [k, v] of Object.entries(map)) {
    if (out.toLowerCase() === k || out.toLowerCase().startsWith(k)) return v;
  }
  return out;
}

function cleanPlanet(p?: string): string {
  if (!p) return '';
  const raw = String(p).replace(/[\u0B80-\u0BFF]+/g, '').split('(')[0].trim();
  const low = raw.toLowerCase();
  if (low === 'surya' || low === 'suryan' || low === 'suriyan' || low === 'ravi') return 'Sun';
  if (low === 'chandra' || low === 'chandran' || low === 'soma') return 'Moon';
  if (low === 'sevvai' || low === 'chevvai' || low === 'mangal' || low === 'angaraka') return 'Mars';
  if (low === 'budha' || low === 'budhan') return 'Mercury';
  if (low === 'guru' || low === 'brihaspati') return 'Jupiter';
  if (low === 'sukra' || low === 'shukra' || low === 'velli') return 'Venus';
  if (low === 'sani' || low === 'shani' || low === 'shaneeshwara') return 'Saturn';
  return raw;
}

function cleanDegree(deg?: string): string {
  if (!deg) return '';
  const m = String(deg).match(/(\d{1,2})\s*°\s*(\d{1,2})?/);
  if (m) return `${m[1].padStart(2, '0')}°${(m[2] || '00').padStart(2, '0')}'`;
  return String(deg).trim();
}

function cleanStar(star?: string, pada?: number): string {
  if (!star) return '';
  let clean = String(star).replace(/[\u0B80-\u0BFF]+/g, '').trim();
  const paren = clean.match(/^[^(]+\(([^)]+)\)/);
  if (paren && paren[1]) clean = paren[1].trim();
  clean = clean.replace(/\(\s*\)/g, '').replace(/\s+P\d+$/i, '').trim();
  return pada ? `${clean} P${pada}` : clean;
}

function signAbbr(signName?: string): string {
  const s = cleanSign(signName);
  return SIGN_ABBR_EN[s] || s.slice(0, 3);
}

function formatIsoDaySpan(startDay: number, endDay: number, year: number, monthIdx: number): string {
  const ym = `${year}-${String(monthIdx + 1).padStart(2, '0')}`;
  const sIso = `${ym}-${String(startDay).padStart(2, '0')}`;
  const eIso = `${ym}-${String(endDay).padStart(2, '0')}`;
  return startDay === endDay ? sIso : `${sIso}..${eIso}`;
}

function formatIsoDayRanges(days: number[], year: number, monthIdx: number): string {
  if (days.length === 0) return '';
  const sorted = Array.from(new Set(days)).sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(formatIsoDaySpan(start, end, year, monthIdx));
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(formatIsoDaySpan(start, end, year, monthIdx));
  return ranges.join(',');
}

function computeExactTaraShort(janmaStarName: string, transitStarName: string): { name: string; num: number; tag: string } {
  const jClean = cleanStar(janmaStarName) || 'Anuradha';
  const tClean = cleanStar(transitStarName);
  if (!tClean) return { name: 'Unknown', num: 0, tag: '' };
  const tb = calculateTaraBala(jClean, tClean);
  const shortName = TARA_SHORT_LABEL[tb.taraNumber] || tb.taraName.replace(/\s+Tara$/i, '').trim();
  return {
    name: shortName,
    num: tb.taraNumber,
    tag: `${shortName} T${tb.taraNumber}`
  };
}

function getDignityTag(planetClean: string, signIdx: number): string {
  if (!signIdx) return '';
  if (CLASSICAL_EXALT_SIGNS[planetClean] === signIdx) return 'Uchha';
  if (CLASSICAL_DEBIL_SIGNS[planetClean] === signIdx) return 'Neecha';
  if ((OWNED_SIGN_INDICES[planetClean] || []).includes(signIdx)) return 'Swakshetra';
  return '';
}

export function isCombustAgainstSun(
  planetClean: string,
  planetLon: number,
  sunLon: number,
  isRetro: boolean
): boolean {
  const baseOrb = COMBUSTION_ORBS[planetClean];
  if (!baseOrb) return false;
  const orb =
    planetClean === 'Mercury'
      ? (isRetro ? 12 : 14)
      : planetClean === 'Venus'
      ? (isRetro ? 8 : 10)
      : baseOrb;
  const diff = Math.abs(planetLon - sunLon);
  const sep = Math.min(diff, 360 - diff);
  return sep <= orb;
}

function formatCompactNeechaBhangaFactors(reasons: string[]): string {
  const kendraMap = new Map<string, { hasLagna: boolean; hasMoon: boolean }>();
  const kendraFrames = new Set<string>();
  const otherItems: string[] = [];
  const otherSeen = new Set<string>();

  for (const rawReason of reasons) {
    const hasLagna = /\bfrom Lagna\b|\bH\d+\s+from Lagna\b|\bH\d+\s+Lagna\b|\bL\d+\b/i.test(rawReason);
    const hasMoon = /\bfrom Moon\b|\bH\d+\s+from Moon\b|\bH\d+\s+Moon\b|\bM\d+\b/i.test(rawReason);
    const r = rawReason.replace(/\s*\([^)]*(?:Moon|Lagna)[^)]*\)/gi, '').trim();
    const low = r.toLowerCase();
    let tag = r;
    let isKendra = false;

    if (low.includes('neecha-vakra') || low.includes('is retrograde')) {
      tag = 'Neecha-Vakra';
    } else if (low.includes('parivartana')) {
      tag = 'Parivartana';
    } else if (low.includes('conjunction')) {
      const m = r.match(/dispositor\s+([A-Za-z]+)/i);
      tag = m ? `disp-conj(${m[1]})` : 'disp-conj';
    } else if (low.includes('7th aspect')) {
      const m = r.match(/dispositor\s+([A-Za-z]+)/i);
      tag = m ? `disp-7th(${m[1]})` : 'disp-7th';
    } else if (low.includes('debilitation sign lord') && low.includes('kendra')) {
      const m = r.match(/lord\s+([A-Za-z]+)/i);
      tag = m ? `tr-disp ${m[1]}` : 'tr-disp';
      isKendra = true;
    } else if (low.includes('natal') && low.includes('dispositor') && low.includes('kendra')) {
      const m = r.match(/Natal\s+([A-Za-z]+)/i);
      tag = m ? `natal-disp ${m[1]}` : 'natal-disp';
      isKendra = true;
    } else if (low.includes('exaltation lord') && low.includes('transits kendra')) {
      const m = r.match(/lord\s+([A-Za-z]+)/i);
      tag = m ? `tr-exalt-in-sign ${m[1]}` : 'tr-exalt-in-sign';
      isKendra = true;
    } else if (low.includes('natal') && low.includes('exalted in') && low.includes('kendra')) {
      const m = r.match(/Natal\s+([A-Za-z]+)/i);
      tag = m ? `natal-exalt-in-sign ${m[1]}` : 'natal-exalt-in-sign';
      isKendra = true;
    } else if (low.includes('natal lord of') && low.includes('exaltation sign') && low.includes('kendra')) {
      const m = r.match(/\(([A-Za-z]+)\)/);
      tag = m ? `natal-exalt-sign-lord ${m[1]}` : 'natal-exalt-sign-lord';
      isKendra = true;
    } else if (low.includes('exaltation sign') && low.includes('kendra')) {
      const m = r.match(/\(([A-Za-z]+)\)/);
      tag = m ? `tr-exalt-sign-lord ${m[1]}` : 'tr-exalt-sign-lord';
      isKendra = true;
    }

    if (isKendra) {
      if (hasLagna) kendraFrames.add('Lagna');
      if (hasMoon) kendraFrames.add('Moon');
      const prev = kendraMap.get(tag) || { hasLagna: false, hasMoon: false };
      kendraMap.set(tag, { hasLagna: prev.hasLagna || hasLagna, hasMoon: prev.hasMoon || hasMoon });
    } else if (!otherSeen.has(tag)) {
      otherSeen.add(tag);
      otherItems.push(tag);
    }
  }

  const kendraItems: string[] = [];
  for (const [tag, fr] of kendraMap.entries()) {
    const fTag = fr.hasLagna && fr.hasMoon ? 'Lagna+Moon' : fr.hasMoon ? 'Moon' : fr.hasLagna ? 'Lagna' : '';
    kendraItems.push(`${tag}${fTag ? `[${fTag}]` : ''}`);
  }
  const parts: string[] = [];
  if (kendraItems.length > 0) {
    const fLabel = kendraFrames.size === 2 ? 'Lagna+Moon' : (Array.from(kendraFrames)[0] || 'Lagna');
    parts.push(`Kendra[${fLabel}](${kendraItems.join(',')})`);
  }
  if (otherItems.length > 0) parts.push(...otherItems);
  return parts.length > 0 ? parts.join(',') : 'none';
}

function resolveMdAdDatesFromFallbackTable(
  context: VedicHouseContext
): { mdStart: string; mdEnd: string; adStart: string; adEnd: string } {
  const d = context.activeDasha;
  if (d.mdStartDate && d.mdEndDate && d.adStartDate && d.adEndDate) {
    return {
      mdStart: d.mdStartDate,
      mdEnd: d.mdEndDate,
      adStart: d.adStartDate,
      adEnd: d.adEndDate
    };
  }
  const tl = getFullVimshottariTimeline();
  const targetDate = d.startDate || `${context.selectedYear}-${String(context.selectedMonth + 1).padStart(2, '0')}-15`;
  let idx = tl.findIndex(([, , , s, e]) => targetDate >= s && targetDate <= e);
  if (idx === -1) {
    const mdShort = cleanPlanet(d.mahadasha).toLowerCase();
    const adShort = cleanPlanet(d.antardasha).toLowerCase();
    const pdShort = cleanPlanet(d.pratyantardasha).toLowerCase();
    idx = tl.findIndex(([m, a, p]) =>
      cleanPlanet(m).toLowerCase() === mdShort &&
      cleanPlanet(a).toLowerCase() === adShort &&
      cleanPlanet(p).toLowerCase() === pdShort
    );
  }
  if (idx === -1) {
    return {
      mdStart: d.mdStartDate || 'not provided',
      mdEnd: d.mdEndDate || 'not provided',
      adStart: d.adStartDate || 'not provided',
      adEnd: d.adEndDate || 'not provided'
    };
  }
  const [md, ad] = tl[idx];
  let mdFirst = idx;
  let mdLast = idx;
  while (mdFirst > 0 && tl[mdFirst - 1][0] === md) mdFirst--;
  while (mdLast + 1 < tl.length && tl[mdLast + 1][0] === md) mdLast++;
  let adFirst = idx;
  let adLast = idx;
  while (adFirst > mdFirst && tl[adFirst - 1][0] === md && tl[adFirst - 1][1] === ad) adFirst--;
  while (adLast < mdLast && tl[adLast + 1][0] === md && tl[adLast + 1][1] === ad) adLast++;

  return {
    mdStart: d.mdStartDate || tl[mdFirst][3],
    mdEnd: d.mdEndDate || tl[mdLast][4],
    adStart: d.adStartDate || tl[adFirst][3],
    adEnd: d.adEndDate || tl[adLast][4]
  };
}

interface ContinuousPlanetState {
  signIdx: number;
  signName: string;
  hLagna: number;
  hMoon: number;
  nakshatra: string;
  pada: number;
  degStr: string;
  degFloat: number;
  siderealLon: number;
  isRetro: boolean;
  motionTag: 'ADISARA' | 'VAKRA' | 'DIRECT';
  isCombust: boolean;
}

interface ContinuousStateSpan {
  startMs: number;
  endMs: number;
  state: ContinuousPlanetState;
  endDegStr: string;
}

interface ContMoonNakSeg {
  nak: string;
  padas: number[];
  startMs: number;
  endMs: number;
}

interface ContMoonSignSpan {
  signIdx: number;
  signName: string;
  hLagna: number;
  hMoon: number;
  oppSignIdx: number;
  oppSignName: string;
  oppHLagna: number;
  oppHMoon: number;
  startMs: number;
  endMs: number;
  startDeg: string;
  endDeg: string;
  naks: ContMoonNakSeg[];
}

export interface OriginalSourcePromptResult {
  staticBlock: string;
  monthSlice: string;
  subPromptBlock: string;
  fullPrompt: string;
  meta: {
    variant: OriginalSourceVariant;
    domain: OriginalSourceDomain;
    focusQuestion?: string;
    monthLabel: string;
    dateRange: string;
    charCount: number;
    lineCount: number;
    estTokens: number;
  };
}

/**
 * Builds the "Original Source" (Original Heartbeat) holistic raw-data prompt.
 * Supports:
 * - Master Prompt (`domain = 'master'`): D1, D9, Shadbala, 7-Planet Ashtakavarga + As + Sodhya Pindas, Yogas/Doshas, Jaimini + Monthly Ephemeris
 * - 6 Domain Sub-Prompts (`career`, `finance`, `love`, `family`, `health`, `litigation`): Attaches domain-specific Divisional Charts (Vargas), minimal Frontier rules, 4-section Output Structure + Option B Readout, and trailing [FOCUS QUESTION] for KV cache reuse
 * - Two variants (`compact` readable LLM format with spaces, `baseline` full-label 14B format)
 * Completely independent of existing v1/v2/v3 prompts.
 */
export function buildOriginalSourcePrompt(
  rawContext: VedicHouseContext,
  variant: OriginalSourceVariant = 'compact',
  domainArg?: OriginalSourceDomain,
  focusQuestionArg?: string
): OriginalSourcePromptResult {
  const domain: OriginalSourceDomain = domainArg || rawContext.originalSourceDomain || 'master';
  const rawQuestion = focusQuestionArg !== undefined ? focusQuestionArg : rawContext.focusQuestion;
  const cleanQuestion = (rawQuestion || '')
    .replace(/[\r\n]+/g, ' ')
    .replace(/_/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
  const isCompact = variant === 'compact';
  const sep = ' | ';
  const listSep = ', ';

  const lagna = cleanSign(rawContext.natalLagnaSignName) || 'Sagittarius';
  const moon = cleanSign(rawContext.natalMoonSignName || rawContext.natalJanmaStar?.rashi_name) || 'Scorpio';
  const lagnaIdx = getCleanSignIndex(lagna) || 9;
  const moonIdx = getCleanSignIndex(moon) || 8;
  const context = apply001MEEnrichments(rawContext, lagnaIdx, moonIdx);
  const janmaStarName = cleanStar(context.natalJanmaStar?.nakshatra_name || 'Anuradha');
  const janmaPada = context.natalJanmaStar?.pada || 2;

  // =========================================================================
  // STATIC BLOCK (byte-identical across months/sessions for the same chart; zero years/months)
  // =========================================================================
  const conventionsText = isCompact
    ? [
        `HouseNotation: D1 uses L#(Lagna)/M#(Moon) ONLY; H# is strictly for Divisional charts (D9/D10/D2/D4/D6/D7/D8/D11/D12/D16/D27/D30)`,
        `TimeZones: Data=UTC(+00:00) ISO YYYY-MM-DD or YYYY-MM-DDTHH:MMZ | Readout Sec5 uses precomputed [IST YYYY-MM-DD] (+05:30) ONLY`,
        `RatingBands: 3=Highly Likely(70-90%) | 2=Most Likely(50-69%) | 1=Possible(25-49%) | Two-Support Rule: Rating>=2 needs >=2 independent supports`
      ].join('\n')
    : [
        `House Notation: D1 Rashi placements, Transits, Aspects, SAV, and BAV strictly use L# (house from Lagna) and M# (house from Moon). H# is reserved exclusively for Divisional charts (D9 Navamsa and Domain Vargas D2..D30).`,
        `Time Zones: All ephemeris dates and times in Sections 1-4 are UTC (+00:00) in ISO format (YYYY-MM-DD or YYYY-MM-DDTHH:MMZ). Precomputed IST (+05:30) calendar dates are labeled [IST YYYY-MM-DD] and MUST be used for Section 5 Readout real-world calendar dates.`,
        `Rating & Verdict Calibration: Rating 3 = Highly Likely (70-90%), Rating 2 = Most Likely (50-69%), Rating 1 = Possible (25-49%). Two-Support Rule: Assign Rating 2 or 3 only when at least 2 independent active supports align (e.g., Dasha/SD + slow/fast trigger + favorable Moon Sit/7th-Asp); single-factor triggers cap at Rating 1.`
      ].join('\n');

  const rulesText = (isCompact ? originalSourceRulesRaw : originalSourceRulesBaselineRaw).trim();

  // S2 [LORDSHIPS] & S2B [HOUSE LORDS] (using L# / M# exclusively)
  const lordshipEntries = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].map(p => {
    const signs = OWNED_SIGN_INDICES[p] || [];
    const lHouses = signs.map(s => `L${((s - lagnaIdx + 12) % 12) + 1}`).join(listSep);
    const mHouses = signs.map(s => `M${((s - moonIdx + 12) % 12) + 1}`).join(listSep);
    return isCompact ? `${p}:${lHouses}(${mHouses})` : `${p}: ${lHouses} (${mHouses})`;
  });

  // S3 [D1] — precompute D1 natal coordinates, combustion, Natal Neecha Bhanga, conjunctions, and Parashara aspects
  const d1Raw = context.flattenedNatalD1 || [];
  const d1SunRow = d1Raw.find(p => cleanPlanet(p.body_name) === 'Sun');
  const d1SunSignIdx = d1SunRow ? getCleanSignIndex(d1SunRow.rashi_name) : 0;
  const d1SunDeg = d1SunRow ? parseDegreeFloat(d1SunRow.degree_sputa) : null;
  const d1SunLon = d1SunSignIdx && d1SunDeg !== null ? (d1SunSignIdx - 1) * 30 + d1SunDeg : null;

  const d1CoOccupantsBySign = new Map<number, string[]>();
  const d1PlanetMetaMap = new Map<string, {
    signIdx: number;
    signName: string;
    hL: number;
    hM: number;
    degFloat: number | null;
    degStr: string;
    isRetro: boolean;
    dignity: string;
    combustGapStr: string | null;
    conjunctWith: string[];
    aspects: string[];
  }>();

  for (const p of d1Raw) {
    const pName = cleanPlanet(p.body_name);
    const sIdx = getCleanSignIndex(p.rashi_name);
    if (!pName || !sIdx) continue;
    const arr = d1CoOccupantsBySign.get(sIdx) || [];
    if (pName !== 'Lagna') arr.push(pName);
    d1CoOccupantsBySign.set(sIdx, arr);
  }

  for (const p of d1Raw) {
    const pName = cleanPlanet(p.body_name);
    const sIdx = getCleanSignIndex(p.rashi_name);
    if (!pName || !sIdx) continue;
    const hL = p.house_number || (((sIdx - lagnaIdx + 12) % 12) + 1);
    const hM = ((sIdx - moonIdx + 12) % 12) + 1;
    const degFloat = parseDegreeFloat(p.degree_sputa);
    const degStr = cleanDegree(p.degree_sputa) || '-';
    const isRetro = !!p.is_retrograde;
    const dignity = pName === 'Lagna' ? '' : getNaisargikaDignity(pName, sIdx, isRetro);

    let combustGapStr: string | null = null;
    if (pName !== 'Sun' && pName !== 'Lagna' && pName !== 'Rahu' && pName !== 'Ketu' && pName !== 'Mandi' && d1SunLon !== null && degFloat !== null) {
      const pLon = (sIdx - 1) * 30 + degFloat;
      if (isCombustAgainstSun(pName, pLon, d1SunLon, isRetro)) {
        const diff = Math.abs(pLon - d1SunLon);
        const gap = Math.min(diff, 360 - diff);
        const gDeg = Math.floor(gap);
        const gMin = Math.round((gap - gDeg) * 60);
        combustGapStr = `${gDeg}°${String(gMin).padStart(2, '0')}'`;
      }
    }

    const conjunctWith = pName === 'Lagna'
      ? []
      : (d1CoOccupantsBySign.get(sIdx) || []).filter(other => other !== pName);

    const aspects = (pName === 'Lagna' || pName === 'Mandi')
      ? []
      : getParasharaAspectEntries(pName, sIdx, lagnaIdx, moonIdx).map(a => `${a.label}:${signAbbr(a.targetSign)}(L${a.hLagna}/M${a.hMoon})`);

    d1PlanetMetaMap.set(pName, {
      signIdx: sIdx,
      signName: SIGN_LIST_EN[sIdx - 1] || cleanSign(p.rashi_name),
      hL,
      hM,
      degFloat,
      degStr,
      isRetro,
      dignity,
      combustGapStr,
      conjunctWith,
      aspects
    });
  }

  const d1Lines = d1Raw.length > 0
    ? d1Raw.map(p => {
        const pName = cleanPlanet(p.body_name);
        const sName = cleanSign(p.rashi_name);
        const sIdx = getCleanSignIndex(sName);
        const hL = p.house_number || (sIdx ? ((sIdx - lagnaIdx + 12) % 12) + 1 : 1);
        const hM = sIdx ? ((sIdx - moonIdx + 12) % 12) + 1 : 1;
        const deg = cleanDegree(p.degree_sputa) || '-';
        const star = cleanStar(p.nakshatra_name, p.pada) || '-';
        const meta = d1PlanetMetaMap.get(pName);
        const flags: string[] = [];
        if (p.is_retrograde) flags.push('R');
        if (meta?.dignity) flags.push(meta.dignity);
        if (pName !== 'Lagna' && pName !== 'Mandi' && pName !== 'Rahu' && pName !== 'Ketu') {
          const natalNb = evaluateNatalNeechaBhanga(pName, d1Raw, lagnaIdx, moonIdx);
          if (natalNb.isDebilitated && natalNb.hasNeechaBhanga) {
            flags.push(`NB(${natalNb.reasons.join('; ')})`);
          }
        }
        if (meta?.combustGapStr) flags.push(isCompact ? `Comb(${meta.combustGapStr})` : `Combust(${meta.combustGapStr})`);
        if (meta && meta.conjunctWith.length > 0) flags.push(`Conj:${meta.conjunctWith.join(',')}`);
        if (meta && meta.aspects.length > 0) flags.push(`Asp:${meta.aspects.join(',')}`);
        return `${pName}${sep}${sName}${sep}L${hL}/M${hM}${sep}${deg}${sep}${star}${flags.length > 0 ? `${sep}${flags.join(listSep)}` : ''}`;
      })
    : ['D1 placements not provided'];

  // [HOUSE LORDS] — explicit L1..L12 lord placement lookup table (using L# / M#, zero H#)
  const houseLordEntries: string[] = [];
  for (let h = 1; h <= 12; h++) {
    const hSignIdx = ((lagnaIdx + h - 2) % 12) + 1;
    const lord = SIGN_PRIMARY_LORD_EN[hSignIdx];
    const lm = d1PlanetMetaMap.get(lord);
    if (lm) {
      const f: string[] = [];
      if (lm.isRetro) f.push('R');
      if (lm.dignity === 'Own' || lm.dignity === 'Exalted' || lm.dignity.startsWith('Debil')) f.push(lm.dignity);
      if (lm.combustGapStr) f.push(isCompact ? 'Comb' : 'Combust');
      const fTag = f.length > 0 ? `(${f.join(',')})` : '';
      houseLordEntries.push(isCompact ? `L${h}:${lord}@L${lm.hL}${fTag}` : `L${h}:${lord}@L${lm.hL}(M${lm.hM})${fTag}`);
    } else {
      houseLordEntries.push(`L${h}:${lord}`);
    }
  }
  const houseLordsBlock = isCompact
    ? houseLordEntries.join('|')
    : `${houseLordEntries.slice(0, 6).join(' | ')}\n${houseLordEntries.slice(6).join(' | ')}`;

  // S4 [D9] — strictly derived & verified (H# = D9 house from D9 Lagna)
  const computeD9FromD1 = (): NonNullable<VedicHouseContext['flattenedNatalD9']> => {
    const d1 = context.flattenedNatalD1 || [];
    if (d1.length === 0) return [];
    const rawItems: Array<{ body_name: string; d9SignIdx: number; rashi_name: string; is_retrograde?: boolean }> = [];
    for (const p of d1) {
      const sIdx = getCleanSignIndex(p.rashi_name);
      if (!sIdx) continue;
      const degM = String(p.degree_sputa || '').match(/(\d{1,2})\s*[°:]\s*(\d{1,2})?/);
      const totalMins = degM ? parseInt(degM[1], 10) * 60 + (degM[2] ? parseInt(degM[2], 10) : 0) : 0;
      const clampedMins = Math.max(0, Math.min(1799, totalMins));
      const navPada = Math.min(8, Math.floor(clampedMins / 200));
      const mod4 = (sIdx - 1) % 4;
      const startIdx = mod4 === 0 ? 1 : mod4 === 1 ? 10 : mod4 === 2 ? 7 : 4;
      const d9SignIdx = ((startIdx - 1 + navPada) % 12) + 1;
      rawItems.push({
        body_name: p.body_name,
        d9SignIdx,
        rashi_name: SIGN_LIST_EN[d9SignIdx - 1],
        is_retrograde: p.is_retrograde
      });
    }
    const lagnaItem = rawItems.find(x => cleanPlanet(x.body_name).toLowerCase() === 'lagna');
    const d9LagnaIdx = lagnaItem ? lagnaItem.d9SignIdx : 0;
    return rawItems.map(item => ({
      body_name: item.body_name,
      rashi_name: item.rashi_name,
      house_number: d9LagnaIdx ? ((item.d9SignIdx - d9LagnaIdx + 12) % 12) + 1 : undefined,
      is_retrograde: item.is_retrograde
    }));
  };

  const fallbackD9List = computeD9FromD1();
  const rawD9Input = (context.flattenedNatalD9 && context.flattenedNatalD9.length > 0)
    ? context.flattenedNatalD9
    : fallbackD9List;

  const d9LagnaEntry = rawD9Input.find(p => cleanPlanet(p.body_name).toLowerCase() === 'lagna');
  const d9LagnaIdxResolved = d9LagnaEntry ? getCleanSignIndex(d9LagnaEntry.rashi_name) : 0;
  const d9RahuRow = rawD9Input.find(p => cleanPlanet(p.body_name) === 'Rahu');
  const d9KetuRow = rawD9Input.find(p => cleanPlanet(p.body_name) === 'Ketu');
  const d9RahuS = d9RahuRow ? getCleanSignIndex(d9RahuRow.rashi_name) : 0;
  const d9KetuS = d9KetuRow ? getCleanSignIndex(d9KetuRow.rashi_name) : 0;
  const d9NodesOpposite = d9RahuS > 0 && d9KetuS > 0 && ((d9RahuS - d9KetuS + 12) % 12) === 6;

  const d9Source = (!d9NodesOpposite && fallbackD9List.length > 0)
    ? rawD9Input.map(row => {
        const cleanB = cleanPlanet(row.body_name);
        if (cleanB === 'Rahu' || cleanB === 'Ketu') {
          const derived = fallbackD9List.find(x => cleanPlanet(x.body_name) === cleanB);
          return derived || row;
        }
        return row;
      })
    : rawD9Input;

  const d9SignByPlanet = new Map<string, { signIdx: number; signName: string; hD9: number }>();
  let d9Lines: string[] = [];
  if (d9Source.length > 0) {
    const d1SignMap = new Map<string, number>();
    (context.flattenedNatalD1 || []).forEach(p => {
      const k = cleanPlanet(p.body_name).toLowerCase();
      const s = getCleanSignIndex(p.rashi_name);
      if (k && s) d1SignMap.set(k, s);
    });
    d9Lines = d9Source.map(p => {
      const pName = cleanPlanet(p.body_name);
      const sIdx = getCleanSignIndex(p.rashi_name);
      const sName = sIdx ? SIGN_LIST_EN[sIdx - 1] : cleanSign(p.rashi_name);
      const hNum = d9LagnaIdxResolved && sIdx ? ((sIdx - d9LagnaIdxResolved + 12) % 12) + 1 : (p.house_number || 1);
      if (sIdx) d9SignByPlanet.set(pName, { signIdx: sIdx, signName: sName, hD9: hNum });
      const flags: string[] = [];
      if (pName.toLowerCase() !== 'lagna') {
        if (CLASSICAL_EXALT_SIGNS[pName] === sIdx) flags.push('Exalted');
        else if (CLASSICAL_DEBIL_SIGNS[pName] === sIdx) flags.push('Debilitated');
        if ((OWNED_SIGN_INDICES[pName] || []).includes(sIdx)) flags.push('Own');
        if (d1SignMap.get(pName.toLowerCase()) === sIdx) flags.push('Vargottama');
        if (p.is_retrograde) flags.push('R');
      }
      return `${pName}${sep}${sName}${sep}H${hNum}${flags.length > 0 ? `${sep}${flags.join(listSep)}` : ''}`;
    });
  } else {
    d9Lines = ['D9 placements not provided'];
  }

  // S5 [SHADBALA]
  const shadbalaBlock = context.shadbalaStrengths && context.shadbalaStrengths.length > 0
    ? context.shadbalaStrengths.map(s => {
        if (isCompact) {
          return `${s.planet} ${s.ratio.toFixed(2)} (${s.total.toFixed(1)}/${s.required}, ${s.percent.toFixed(1)}% ${s.status}) | Sth:${s.sthana.toFixed(1)}, Dig:${s.dig.toFixed(1)}, Kaa:${s.kaala.toFixed(1)}, Che:${s.cheshta.toFixed(1)}, Nai:${s.naisargika.toFixed(1)}, Dri:${s.drik.toFixed(1)} | Ishta:${s.ishtaPhala.toFixed(1)}, Kashta:${s.kashtaPhala.toFixed(1)} | Shadvarga:${s.shadvargaVimsopaka}(${s.shadvargaAmsa}), Shodashavarga:${s.shodashavargaVimsopaka}(${s.shodashavargaAmsa}; ${s.shodashavargaCharts.join('/') || '-'})`;
        }
        return `${s.planet} | Ratio: ${s.ratio.toFixed(2)} (${s.total.toFixed(2)}/${s.required}, ${s.percent.toFixed(1)}%, ${s.status}) | Sthana:${s.sthana.toFixed(2)}, Dig:${s.dig.toFixed(2)}, Kaala:${s.kaala.toFixed(2)}, Cheshta:${s.cheshta.toFixed(2)}, Naisargika:${s.naisargika.toFixed(2)}, Drik:${s.drik.toFixed(2)} | Harsha:${s.harsha.toFixed(1)}, Ishta:${s.ishtaPhala.toFixed(2)}, Kashta:${s.kashtaPhala.toFixed(2)} | Vimsopaka: Shadvarga ${s.shadvargaVimsopaka} (${s.shadvargaAmsa}), Dashavarga ${s.dashavargaVimsopaka} (${s.dashavargaAmsa}), Shodashavarga ${s.shodashavargaVimsopaka} (${s.shodashavargaAmsa}; Charts: ${s.shodashavargaCharts.join(', ') || '-'})`;
      }).join('\n')
    : 'Shadbala not provided';

  // S6 [SAV], [BAV] (All 7 planets + Lagna As), and [PINDAS] — using L1..L12 consistently
  const bphsReport = computeSarvashtakavarga(lagnaIdx, undefined, context.flattenedNatalD1);
  const savDist = (context.ashtakavargaPayload?.savPointsDistribution && context.ashtakavargaPayload.savTotalSum === 337)
    ? context.ashtakavargaPayload.savPointsDistribution
    : bphsReport.allHousesOverview;
  const savTotalSum = savDist.reduce((acc, s) => acc + s.points, 0);
  const sortedSav = [...savDist].sort((a, b) => a.houseNumber - b.houseNumber);
  const maxSavPts = sortedSav.length > 0 ? Math.max(...sortedSav.map(s => s.points)) : 0;
  const minSavPts = sortedSav.length > 0 ? Math.min(...sortedSav.map(s => s.points)) : 0;
  const maxSavHouses = sortedSav.filter(s => s.points === maxSavPts).map(s => `L${s.houseNumber}`).join(',');
  const minSavHouses = sortedSav.filter(s => s.points === minSavPts).map(s => `L${s.houseNumber}`).join(',');
  const savLine = sortedSav.length > 0
    ? `${sortedSav.map(s => `L${s.houseNumber}:${s.points}`).join(listSep)} | Sum:${savTotalSum} | Avg:${(savTotalSum / 12).toFixed(1)} | Max:${maxSavHouses}(${maxSavPts}) | Min:${minSavHouses}(${minSavPts})`
    : 'SAV not provided';

  const savBySignIdx = new Map<number, number>();
  savDist.forEach(s => savBySignIdx.set(s.signIndex, s.points));

  const bavData = context.ashtakavargaPayload?.bavByPlanet || bphsReport.bavByPlanet;
  const lagnaBavMap = context.ashtakavargaPayload?.lagnaBav;
  const formatBavRow = (label: string, pMap: Record<number, number> | undefined, suffixNote = ''): string => {
    if (!pMap) return `${label}: not provided`;
    const houseEntries: string[] = [];
    let total = 0;
    for (let h = 1; h <= 12; h++) {
      const sIdx = ((lagnaIdx + h - 2) % 12) + 1;
      const pts = pMap[sIdx] ?? 0;
      total += pts;
      houseEntries.push(`L${h}:${pts}`);
    }
    return isCompact
      ? `${label}(${total}${suffixNote}): ${houseEntries.join(', ')}`
      : `${label} BAV (${total}${suffixNote}): ${houseEntries.join(', ')}`;
  };
  const all7Planets: Array<'Sun' | 'Moon' | 'Mars' | 'Mercury' | 'Jupiter' | 'Venus' | 'Saturn'> = [
    'Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'
  ];
  const bavRows: string[] = bavData
    ? all7Planets.map(p => formatBavRow(p, bavData[p]))
    : ['BAV not provided'];
  if (lagnaBavMap) {
    bavRows.push(formatBavRow('As(Lagna)', lagnaBavMap, ', excl. SAV'));
  }
  const bavBlock = bavRows.join('\n');

  const pindasBlock = context.ashtakavargaPayload?.sodhyaPindas && context.ashtakavargaPayload.sodhyaPindas.length > 0
    ? (isCompact
        ? context.ashtakavargaPayload.sodhyaPindas.map(p => `${p.planet}: R${p.rasiPinda}+G${p.grahaPinda}=${p.sodhyaPinda} (${p.pct}%)`).join(' | ')
        : context.ashtakavargaPayload.sodhyaPindas.map(p => `${p.planet}: Rasi ${p.rasiPinda} + Graha ${p.grahaPinda} = Sodhya ${p.sodhyaPinda} (${p.pct}%)`).join(' | '))
    : 'Sodhya Pindas not provided';

  // S7 [YOGAS] & [DOSHAS]
  const yogasBlock = (() => {
    const yd = context.yogasAndDoshas;
    if (!yd) return 'Yogas not provided';
    const rajaStr = yd.rajaYogas.length > 0
      ? `Raja Yogas (${yd.rajaYogas.length}): ${yd.rajaYogas.map(y => `${y.name} [${y.participants.join(', ')}] (${y.condition})`).join(' | ')}`
      : 'Raja Yogas: None';
    const genStr = yd.generalYogas.length > 0
      ? `General Yogas (${yd.generalYogas.length}): ${yd.generalYogas.map(y => isCompact ? `${y.name} (${y.condition})` : `${y.name}: ${y.condition}`).join(' | ')}`
      : 'General Yogas: None';
    return `${rajaStr}\n${genStr}`;
  })();

  const doshasBlock = (() => {
    const yd = context.yogasAndDoshas;
    if (!yd) return 'Doshas not provided';
    if (yd.doshas.length === 0) return 'None';
    return yd.doshas.map(d => `${d.name} (${d.status}): ${d.reasons.join('; ')}`).join('\n');
  })();

  // [JAIMINI] — Deterministic 7-Karaka Scheme using D1 L#/M# and D9 H#
  const jaiminiLine = (() => {
    const sevenPlanets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
    const karakaRanks = ['AK', 'AmK', 'BK', 'MK', 'PK', 'GK', 'DK'];
    const ranked = sevenPlanets
      .map(p => {
        const m = d1PlanetMetaMap.get(p);
        return m && m.degFloat !== null
          ? { planet: p, degFloat: m.degFloat, degStr: m.degStr, hL: m.hL, hM: m.hM, signIdx: m.signIdx, signName: m.signName }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.degFloat - a.degFloat);

    if (ranked.length < 7) return 'Jaimini not provided';

    const karakaLine = isCompact
      ? `Scheme: 7-Karaka | ${ranked.map((r, i) => `${karakaRanks[i]}: ${r.planet} (${r.degStr} L${r.hL}/M${r.hM})`).join(' | ')}`
      : `Scheme: 7-Karaka (Sun..Saturn by D1 deg) | ${ranked.map((r, i) => `${karakaRanks[i]}: ${r.planet} (${r.degStr}, L${r.hL}/M${r.hM} ${r.signName})`).join(' | ')}`;

    const akPlanet = ranked[0].planet;
    const kkD9 = d9SignByPlanet.get(akPlanet);
    let kkStr = 'Karakamsa: not provided';
    if (kkD9) {
      const kkHL = ((kkD9.signIdx - lagnaIdx + 12) % 12) + 1;
      const kkHM = ((kkD9.signIdx - moonIdx + 12) % 12) + 1;
      kkStr = isCompact
        ? `KK: ${kkD9.signName} (D1 L${kkHL}/M${kkHM}, D9 H${kkD9.hD9})`
        : `Karakamsa (KK): ${kkD9.signName} (D1 L${kkHL}/M${kkHM}, D9 H${kkD9.hD9})`;
    }

    const computeArudhaSignIdx = (houseNum: number): number => {
      const hSignIdx = ((lagnaIdx + houseNum - 2) % 12) + 1;
      const lord = SIGN_PRIMARY_LORD_EN[hSignIdx];
      const lordSignIdx = d1PlanetMetaMap.get(lord)?.signIdx || hSignIdx;
      const steps = ((lordSignIdx - hSignIdx + 12) % 12) + 1;
      let arudhaSignIdx = ((lordSignIdx + steps - 2) % 12) + 1;
      const distFromHouse = ((arudhaSignIdx - hSignIdx + 12) % 12) + 1;
      if (distFromHouse === 1 || distFromHouse === 7) {
        arudhaSignIdx = ((hSignIdx + 9 - 1) % 12) + 1;
      }
      return arudhaSignIdx;
    };

    const arudhaSpecs: Array<{ label: string; h: number }> = [
      { label: 'AL(A1)', h: 1 },
      { label: 'A5', h: 5 },
      { label: 'A7', h: 7 },
      { label: 'A10', h: 10 },
      { label: 'A11', h: 11 },
      { label: 'UL(A12)', h: 12 }
    ];
    const arudhaParts = arudhaSpecs.map(sp => {
      const sIdx = computeArudhaSignIdx(sp.h);
      const sName = SIGN_LIST_EN[sIdx - 1];
      const hL = ((sIdx - lagnaIdx + 12) % 12) + 1;
      const hM = ((sIdx - moonIdx + 12) % 12) + 1;
      return `${sp.label}: ${sName} (L${hL}/M${hM})`;
    });

    return `${karakaLine}\n${kkStr}${sep}${arudhaParts.join(listSep)}`;
  })();

  // [KARAKAS] — harmonized with DOMAIN_PROMPT_SPECS and using L#
  const karakaItems = [
    'Career: L10, L6, L11, Mercury, Sun, Saturn, Mars, Jupiter',
    'Wealth: L2, L11, L5, L9, L4, Jupiter, Venus, Mercury, Saturn, Mars',
    'Home/Family: L4, L2, L5, L9, L3, Moon, Jupiter, Sun, Venus, Mars',
    'Love/Progeny: L5, L7, L12, L11, Venus, Jupiter, Mercury, Moon',
    'Health: L1, L6, L8, L12, L4, L2, Saturn, Sun, Mars, Moon, Jupiter',
    'Litigation: L6, L8, L12, L7, L9, L3, Mars, Saturn, Rahu, Jupiter, Sun'
  ];

  const lordshipHeader = isCompact
    ? `Lagna: ${lagna} | JanmaRashi: ${moon} | JanmaStar: ${janmaStarName} P${janmaPada}\n${lordshipEntries.join(' | ')}`
    : `Lagna: ${lagna} | JanmaRashi: ${moon} | JanmaStar: ${janmaStarName} P${janmaPada}\n${lordshipEntries.join('\n')}`;

  const karakaBlock = isCompact ? karakaItems.join(' | ') : karakaItems.join('\n');

  const staticBlock = [
    `[RULES]\n${rulesText}`,
    `[CONVENTIONS]\n${conventionsText}`,
    `[LORDSHIPS]\n${lordshipHeader}`,
    `[HOUSE LORDS]\n${houseLordsBlock}`,
    `[D1]\n${d1Lines.join('\n')}`,
    `[D9]\n${d9Lines.join('\n')}`,
    `[SHADBALA]\n${shadbalaBlock}`,
    `[SAV]\n${savLine}`,
    `[BAV]\n${bavBlock}`,
    `[PINDAS]\n${pindasBlock}`,
    `[YOGAS]\n${yogasBlock}`,
    `[DOSHAS]\n${doshasBlock}`,
    `[JAIMINI]\n${jaiminiLine}`,
    `[KARAKAS]\n${karakaBlock}`
  ].join('\n');

  // =========================================================================
  // MONTH SLICE (rebuilt per month with continuous 1-minute UTC bisection)
  // =========================================================================
  const year = context.selectedYear;
  const monthIdx = context.selectedMonth;
  const monthName = MONTH_NAMES[monthIdx] || 'Month';
  const mNumStr = String(monthIdx + 1).padStart(2, '0');
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const monthStartIso = `${year}-${mNumStr}-01`;
  const monthEndIso = `${year}-${mNumStr}-${String(daysInMonth).padStart(2, '0')}`;
  const rangeStr = `${monthStartIso}..${monthEndIso}`;

  const monthStartMs = Date.UTC(year, monthIdx, 1, 0, 0, 0);
  const monthEndMs = Date.UTC(year, monthIdx, daysInMonth, 23, 59, 0);

  const day1Utc = new Date(Date.UTC(year, monthIdx, 1, 12, 0, 0));
  const DAY_MS = 24 * HOUR_MS;
  const priorDates = [-3, -2, -1].map(off => new Date(day1Utc.getTime() + off * DAY_MS));
  const priorRangeStr = `${priorDates[0].toISOString().slice(0, 10)}..${priorDates[2].toISOString().slice(0, 10)}`;

  // C1 [PERIOD] & [PERSON]
  const c1Period = isCompact
    ? `[PERIOD]\n${monthName} ${year}|${rangeStr}|TZ:UTC(IST=+05:30)|Prior3d:${priorRangeStr}`
    : `[PERIOD]\n${monthName} ${year} | ${rangeStr} | TZ: UTC (IST=+05:30; Precomputed [IST YYYY-MM-DD]) | Prior-3-Day Boundary: ${priorRangeStr}`;

  const resolvedAge = (() => {
    const dob = context.personProfile?.dateOfBirth;
    if (dob && /^\d{4}-\d{2}-\d{2}$/.test(dob)) {
      const bY = parseInt(dob.slice(0, 4), 10);
      const bM = parseInt(dob.slice(5, 7), 10);
      let a = year - bY;
      if (monthIdx + 1 < bM) a -= 1;
      if (a >= 0) return a;
    }
    return context.personProfile?.age ?? 50;
  })();

  const c1Person = isCompact
    ? `[PERSON]\nAge:${resolvedAge}|Lagna:${lagna}|JanmaRashi:${moon}|JanmaStar:${janmaStarName} P${janmaPada}|Context:general reading (no undisclosed occupation, marital status, or pending decision supplied)`
    : `[PERSON]\nAge: ${resolvedAge} | Lagna: ${lagna} | JanmaRashi: ${moon} | JanmaStar: ${janmaStarName} P${janmaPada} | User Context: General reading (no undisclosed job title, marital status, or pending decision provided; do not invent or assume one)`;

  // Map custom overrides
  type TransitPlacementItem = NonNullable<VedicHouseContext['allTransitPlacements']>[number];
  const customOverrideMap = new Map<string, TransitPlacementItem>();
  (context.allTransitPlacements || []).forEach(tp => {
    if (tp.is_custom) {
      customOverrideMap.set(cleanPlanet(tp.graha_key), tp);
    }
  });

  // Exact station turnaround map from vedicSpecialEvents (ensures 1-minute synchronization across [DASHA], [FAST PLANETS], [EVENTS], and [TRIGGER WINDOWS])
  const stationExactMsMap = new Map<string, number>();
  for (const st of context.vedicSpecialEvents?.sameSignStations || []) {
    if (st.stationTimestampUtc) {
      const tMs = Date.parse(st.stationTimestampUtc);
      if (!isNaN(tMs)) stationExactMsMap.set(cleanPlanet(st.grahaKey), tMs);
    }
  }

  // Continuous 3-hour scan + 1-minute boundary bisection for non-Moon planets
  const nonMoonGrahas = ['Sun', 'Mars', 'Mercury', 'Venus', 'Jupiter', 'Saturn', 'Rahu', 'Ketu'];
  const contSpansByGraha = new Map<string, ContinuousStateSpan[]>();

  const samplePlanetContinuous = (gKey: string, ms: number): ContinuousPlanetState => {
    const customTp = customOverrideMap.get(gKey);
    const customSun = customOverrideMap.get('Sun');
    const dt = new Date(ms);

    let sunLon: number;
    if (customSun) {
      sunLon = (customSun.transit_rashi_index - 1) * 30 + (customSun.degree_in_sign_float ?? 15);
    } else {
      sunLon = getGrahaTransitPosition('Sun', dt, lagnaIdx, moonIdx).sidereal_longitude;
    }

    if (customTp) {
      const sIdx = customTp.transit_rashi_index;
      const sLon = (sIdx - 1) * 30 + (customTp.degree_in_sign_float ?? 15);
      const mTag: 'ADISARA' | 'VAKRA' | 'DIRECT' =
        customTp.motion_type === 'Adisara' ? 'ADISARA' : customTp.is_retrograde ? 'VAKRA' : 'DIRECT';
      return {
        signIdx: sIdx,
        signName: SIGN_LIST_EN[sIdx - 1] || cleanSign(customTp.transit_rashi_name),
        hLagna: ((sIdx - lagnaIdx + 12) % 12) + 1,
        hMoon: ((sIdx - moonIdx + 12) % 12) + 1,
        nakshatra: cleanStar(customTp.nakshatra_name),
        pada: customTp.pada || 1,
        degStr: cleanDegree(customTp.degree_sputa) || '15°00\'',
        degFloat: customTp.degree_in_sign_float ?? 15,
        siderealLon: sLon,
        isRetro: !!customTp.is_retrograde,
        motionTag: mTag,
        isCombust: gKey !== 'Sun' && isCombustAgainstSun(gKey, sLon, sunLon, !!customTp.is_retrograde)
      };
    }

    const pos: GrahaTransitPosition = getGrahaTransitPosition(gKey, dt, lagnaIdx, moonIdx);
    const mTag: 'ADISARA' | 'VAKRA' | 'DIRECT' =
      pos.motion_type === 'Adisara' ? 'ADISARA' : pos.is_retrograde ? 'VAKRA' : 'DIRECT';
    return {
      signIdx: pos.transit_rashi_index,
      signName: SIGN_LIST_EN[pos.transit_rashi_index - 1] || cleanSign(pos.transit_rashi_name),
      hLagna: pos.relative_to_natal_lagna.house_number,
      hMoon: pos.relative_to_natal_rashi.house_number,
      nakshatra: cleanStar(pos.graha_pada_chara.nakshatra_name),
      pada: pos.graha_pada_chara.pada,
      degStr: cleanDegree(pos.degree_sputa),
      degFloat: pos.degree_in_sign_float,
      siderealLon: pos.sidereal_longitude,
      isRetro: pos.is_retrograde,
      motionTag: mTag,
      isCombust: gKey !== 'Sun' && isCombustAgainstSun(gKey, pos.sidereal_longitude, sunLon, pos.is_retrograde)
    };
  };

  const stateSignature = (st: ContinuousPlanetState): string =>
    `${st.signIdx}|${st.nakshatra}|${st.pada}|${st.motionTag}|${st.isCombust ? 1 : 0}`;

  const bisectPlanetState = (gKey: string, tA: number, tB: number, sigA: string): number => {
    let lo = tA;
    let hi = tB;
    while (hi - lo > MIN_MS) {
      const mid = Math.floor((lo + hi) / 2);
      if (stateSignature(samplePlanetContinuous(gKey, mid)) === sigA) lo = mid;
      else hi = mid;
    }
    return hi;
  };

  for (const g of nonMoonGrahas) {
    if (customOverrideMap.has(g)) {
      const st = samplePlanetContinuous(g, monthStartMs);
      contSpansByGraha.set(g, [{ startMs: monthStartMs, endMs: monthEndMs, state: st, endDegStr: st.degStr }]);
      continue;
    }

    const spans: ContinuousStateSpan[] = [];
    const STEP_SCAN = 3 * HOUR_MS;
    let curMs = monthStartMs;
    let curState = samplePlanetContinuous(g, curMs);
    let segStartMs = curMs;

    while (curMs < monthEndMs) {
      const nextMs = Math.min(monthEndMs, curMs + STEP_SCAN);
      const nextState = samplePlanetContinuous(g, nextMs);
      if (stateSignature(nextState) !== stateSignature(curState)) {
        const crossMs = bisectPlanetState(g, curMs, nextMs, stateSignature(curState));
        const endSample = samplePlanetContinuous(g, Math.max(segStartMs, crossMs - MIN_MS));
        spans.push({
          startMs: segStartMs,
          endMs: Math.max(segStartMs, crossMs - MIN_MS),
          state: curState,
          endDegStr: endSample.degStr
        });
        curState = samplePlanetContinuous(g, crossMs);
        segStartMs = crossMs;
        while (stateSignature(samplePlanetContinuous(g, nextMs)) !== stateSignature(curState) && nextMs - segStartMs > MIN_MS) {
          const innerCross = bisectPlanetState(g, segStartMs, nextMs, stateSignature(curState));
          const innerEndSample = samplePlanetContinuous(g, Math.max(segStartMs, innerCross - MIN_MS));
          spans.push({
            startMs: segStartMs,
            endMs: Math.max(segStartMs, innerCross - MIN_MS),
            state: curState,
            endDegStr: innerEndSample.degStr
          });
          curState = samplePlanetContinuous(g, innerCross);
          segStartMs = innerCross;
        }
      }
      curMs = nextMs;
    }
    const finalEndSample = samplePlanetContinuous(g, monthEndMs);
    spans.push({
      startMs: segStartMs,
      endMs: monthEndMs,
      state: curState,
      endDegStr: finalEndSample.degStr
    });
    contSpansByGraha.set(g, spans);
  }

  // Group continuous spans by sign, and render exact ISO dates / UTC timestamps
  const formatContinuousSpanLabel = (sMs: number, eMs: number, hasTimeDetail: boolean): string => {
    const startIsStart = sMs === monthStartMs;
    const endIsEnd = eMs === monthEndMs;
    const sStr = hasTimeDetail ? formatUtcEndpoint(sMs, startIsStart, false) : new Date(sMs).toISOString().slice(0, 10);
    const eStr = hasTimeDetail ? formatUtcEndpoint(eMs, false, endIsEnd) : new Date(eMs).toISOString().slice(0, 10);
    return sStr === eStr ? sStr : `${sStr}..${eStr}`;
  };

  interface MergedLabelWindow {
    label: string;
    startMs: number;
    endMs: number;
  }

  const mergeByKey = <T>(
    items: T[],
    keyFn: (it: T) => string,
    rangeFn: (it: T) => { startMs: number; endMs: number }
  ): MergedLabelWindow[] => {
    const out: MergedLabelWindow[] = [];
    for (const it of items) {
      const k = keyFn(it);
      const r = rangeFn(it);
      const last = out[out.length - 1];
      if (last && last.label === k && r.startMs <= last.endMs + 2 * HOUR_MS) {
        last.endMs = Math.max(last.endMs, r.endMs);
      } else {
        out.push({ label: k, startMs: r.startMs, endMs: r.endMs });
      }
    }
    return out;
  };

  const formatPlanetLines = (gKey: string): string[] => {
    const spans = contSpansByGraha.get(gKey) || [];
    if (spans.length === 0) return [];

    // Group by continuous sign occupation
    const signGroups: ContinuousStateSpan[][] = [];
    for (const sp of spans) {
      const last = signGroups[signGroups.length - 1];
      if (!last || last[0].state.signIdx !== sp.state.signIdx) {
        signGroups.push([sp]);
      } else {
        last.push(sp);
      }
    }

    const isMultiSign = signGroups.length > 1;
    const isFastPlanet = gKey === 'Sun' || gKey === 'Mars' || gKey === 'Mercury' || gKey === 'Venus';

    return signGroups.map(seg => {
      const first = seg[0];
      const last = seg[seg.length - 1];
      const sIdx = first.state.signIdx;
      const sName = first.state.signName;
      const coord = `L${first.state.hLagna}/M${first.state.hMoon}`;
      const sav = savBySignIdx.get(sIdx);
      const savStr = sav ? ` SAV${sav}` : '';

      const motionWins = mergeByKey(
        seg,
        it => it.state.motionTag,
        it => ({ startMs: it.startMs, endMs: it.endMs })
      );
      const motionStr = motionWins
        .map(w => `${w.label} ${formatContinuousSpanLabel(w.startMs, w.endMs, isFastPlanet)}`)
        .join(',');

      const combustWins = mergeByKey(
        seg.filter(it => it.state.isCombust),
        () => 'Combust',
        it => ({ startMs: it.startMs, endMs: it.endMs })
      );
      const combustStr = combustWins.length > 0
        ? `Combust ${combustWins.map(w => formatContinuousSpanLabel(w.startMs, w.endMs, isFastPlanet)).join(',')}`
        : '';
      const motionAndCombust = [motionStr, combustStr].filter(Boolean).join(listSep);

      let degSpan = first.state.degStr === last.endDegStr ? first.state.degStr : `${first.state.degStr}..${last.endDegStr}`;
      const hasStationTurn = seg.some(r => r.state.isRetro) && seg.some(r => !r.state.isRetro);
      if (hasStationTurn && !customOverrideMap.has(gKey)) {
        let minDeg = Infinity;
        let maxDeg = -Infinity;
        for (let ms = first.startMs; ms <= last.endMs; ms += HOUR_MS) {
          const p = getGrahaTransitPosition(gKey, new Date(ms), lagnaIdx, moonIdx);
          if (p.transit_rashi_index !== sIdx) continue;
          const dSign = p.degree_in_sign_float;
          if (dSign < minDeg) minDeg = dSign;
          if (dSign > maxDeg) maxDeg = dSign;
        }
        const stMs = stationExactMsMap.get(gKey);
        if (stMs && stMs >= first.startMs && stMs <= last.endMs) {
          const p = getGrahaTransitPosition(gKey, new Date(stMs), lagnaIdx, moonIdx);
          if (p.transit_rashi_index === sIdx) {
            if (p.degree_in_sign_float < minDeg) minDeg = p.degree_in_sign_float;
            if (p.degree_in_sign_float > maxDeg) maxDeg = p.degree_in_sign_float;
          }
        }
        if (minDeg <= maxDeg) {
          const minStr = formatDegreeFromFloat(minDeg);
          const maxStr = formatDegreeFromFloat(maxDeg);
          degSpan = `${first.state.degStr}..${last.endDegStr} (min ${minStr},max ${maxStr})`;
        }
      }

      const nakWins = mergeByKey(
        seg,
        it => `${it.state.nakshatra}|${it.state.pada}`,
        it => ({ startMs: it.startMs, endMs: it.endMs })
      ).map(w => {
        const [nak, pStr] = w.label.split('|');
        return { nak, pada: parseInt(pStr, 10), startMs: w.startMs, endMs: w.endMs };
      });

      let nakWithTaraStr: string;
      if (isCompact) {
        const starRuns: Array<{ nak: string; padas: Array<{ pada: number; startMs: number; endMs: number }> }> = [];
        for (const ng of nakWins) {
          const lastRun = starRuns[starRuns.length - 1];
          if (lastRun && lastRun.nak === ng.nak) {
            lastRun.padas.push({ pada: ng.pada, startMs: ng.startMs, endMs: ng.endMs });
          } else {
            starRuns.push({ nak: ng.nak, padas: [{ pada: ng.pada, startMs: ng.startMs, endMs: ng.endMs }] });
          }
        }
        nakWithTaraStr = starRuns
          .map(sr => {
            const padaList = sr.padas
              .map(p => `P${p.pada} ${formatContinuousSpanLabel(p.startMs, p.endMs, false)}`)
              .join('/');
            const tara = computeExactTaraShort(janmaStarName, sr.nak);
            return `${sr.nak} ${padaList}(${tara.tag})`;
          })
          .join(',');
      } else {
        nakWithTaraStr = nakWins
          .map(ng => {
            const dr = formatContinuousSpanLabel(ng.startMs, ng.endMs, false);
            const tara = computeExactTaraShort(janmaStarName, ng.nak);
            return `${ng.nak} P${ng.pada} ${dr} (${tara.tag})`;
          })
          .join(', ');
      }

      const aspEntries = getParasharaAspectEntries(gKey, sIdx, lagnaIdx, moonIdx);
      const aspStr = aspEntries
        .map(e => `${e.label} ${signAbbr(e.targetSign)} L${e.hLagna}/M${e.hMoon}`)
        .join(listSep);

      const signSpanLabel = formatContinuousSpanLabel(first.startMs, last.endMs, isFastPlanet);
      const segPrefix = isMultiSign
        ? (isCompact ? `${gKey}(${signSpanLabel})` : `${gKey} (${signSpanLabel})`)
        : gKey;

      const aspPrefix = isCompact ? 'asp:' : 'Asp: ';
      return `${segPrefix}${sep}${sName} ${coord}${savStr}${sep}${motionAndCombust}${sep}${degSpan}${sep}${nakWithTaraStr}${sep}${aspPrefix}${aspStr}`;
    });
  };

  // C2 [DASHA] — MD/AD/PD + Sookshma Dasha (SD) sub-periods, natal L#/M#, exact continuous transit dignity, Vakra, Combust
  const { mdStart, mdEnd, adStart, adEnd } = resolveMdAdDatesFromFallbackTable(context);
  const pdStart = context.activeDasha.startDate;
  const pdEnd = context.activeDasha.endDate;
  const sdIntervals = getSookshmaDashaIntervalsForDateRange(monthStartIso, monthEndIso);

  const formatDashaLordLine = (roleLabel: string, lordNameRaw: string, winStart: string, winEnd: string): string => {
    const lord = cleanPlanet(lordNameRaw);
    const natalRow = (context.flattenedNatalD1 || []).find(p => cleanPlanet(p.body_name) === lord);
    const natalSign = natalRow ? cleanSign(natalRow.rashi_name) : '';
    const natalSignIdx = getCleanSignIndex(natalSign);
    const natalHL = natalRow?.house_number || (natalSignIdx ? ((natalSignIdx - lagnaIdx + 12) % 12) + 1 : undefined);
    const natalHM = natalSignIdx ? ((natalSignIdx - moonIdx + 12) % 12) + 1 : undefined;
    const natalPart = natalHL
      ? (isCompact
          ? `natal L${natalHL}/M${natalHM ?? '?'}${natalSign ? `(${natalSign})` : ''}${natalRow?.is_retrograde ? 'R' : ''}`
          : `natal L${natalHL}/M${natalHM ?? '?'}${natalSign ? ` (${natalSign})` : ''}${natalRow?.is_retrograde ? ' (R)' : ''}`)
      : 'natal not provided';

    const spans = contSpansByGraha.get(lord) || [];
    if (spans.length === 0) {
      return `${roleLabel} ${lord} ${winStart}..${winEnd}${sep}${natalPart}${sep}transit not provided`;
    }

    const signWins = mergeByKey(
      spans,
      it => `${it.state.signIdx}|${it.state.signName}|${it.state.hLagna}|${it.state.hMoon}`,
      it => ({ startMs: it.startMs, endMs: it.endMs })
    ).map(w => {
      const [sIdxStr, sName, hLStr, hMStr] = w.label.split('|');
      return {
        signIdx: parseInt(sIdxStr, 10),
        signName: sName,
        hL: parseInt(hLStr, 10),
        hM: parseInt(hMStr, 10),
        startMs: w.startMs,
        endMs: w.endMs
      };
    });

    const isFast = lord === 'Sun' || lord === 'Mars' || lord === 'Mercury' || lord === 'Venus';
    const segJoiner = isCompact ? ';' : '; ';
    const transitPart = signWins.length === 1
      ? (() => {
          const sp = signWins[0];
          const dig = getDignityTag(lord, sp.signIdx);
          return `transit ${sp.signName} L${sp.hL}/M${sp.hM}${dig ? (isCompact ? `(${dig})` : ` (${dig})`) : ''}`;
        })()
      : `transit ${signWins.map(sp => {
          const dig = getDignityTag(lord, sp.signIdx);
          return `${sp.signName} L${sp.hL}/M${sp.hM}${dig ? (isCompact ? `(${dig})` : ` (${dig})`) : ''} ${formatContinuousSpanLabel(sp.startMs, sp.endMs, isFast)}`;
        }).join(segJoiner)}`;

    const flags: string[] = [];
    const retroWins = mergeByKey(
      spans.filter(it => it.state.isRetro),
      () => 'Vakra',
      it => ({ startMs: it.startMs, endMs: it.endMs })
    );
    if (retroWins.length === 1 && retroWins[0].startMs === monthStartMs && retroWins[0].endMs === monthEndMs) {
      flags.push('Vakra');
    } else if (retroWins.length > 0) {
      flags.push(`Vakra ${retroWins.map(w => formatContinuousSpanLabel(w.startMs, w.endMs, isFast)).join(',')}`);
    }

    const combustWins = mergeByKey(
      spans.filter(it => it.state.isCombust),
      () => 'Combust',
      it => ({ startMs: it.startMs, endMs: it.endMs })
    );
    if (combustWins.length === 1 && combustWins[0].startMs === monthStartMs && combustWins[0].endMs === monthEndMs) {
      flags.push('Combust');
    } else if (combustWins.length > 0) {
      flags.push(`Combust ${combustWins.map(w => formatContinuousSpanLabel(w.startMs, w.endMs, isFast)).join(',')}`);
    }

    return `${roleLabel} ${lord} ${winStart}..${winEnd}${sep}${natalPart}${sep}${transitPart}${flags.length > 0 ? `${sep}${flags.join(sep)}` : ''}`;
  };

  const sdLine = sdIntervals.length > 0
    ? (isCompact
        ? `SD(${cleanPlanet(context.activeDasha.pratyantardasha)}): ${sdIntervals.map(s => `${cleanPlanet(s.sookshmadasha)} ${s.startTimestampUtc}..${s.endTimestampUtc} [${formatIstRange(Date.parse(s.startTimestampUtc), Date.parse(s.endTimestampUtc))}]`).join(' | ')}`
        : `SD (${cleanPlanet(context.activeDasha.pratyantardasha)} PD Sub-Periods): ${sdIntervals.map(s => `${cleanPlanet(s.sookshmadasha)} ${s.startTimestampUtc}..${s.endTimestampUtc} [${formatIstRange(Date.parse(s.startTimestampUtc), Date.parse(s.endTimestampUtc))}]`).join(' | ')}`)
    : 'SD not provided';

  const c2Dasha = [
    `[DASHA]`,
    formatDashaLordLine('MD', context.activeDasha.mahadasha, mdStart, mdEnd),
    formatDashaLordLine('AD', context.activeDasha.antardasha, adStart, adEnd),
    formatDashaLordLine('PD', context.activeDasha.pratyantardasha, pdStart, pdEnd),
    sdLine
  ].join('\n');

  // C3 [SLOW PLANETS] — Prior3d with full ISO dates + Slow Planet continuous spans
  const priorBoundaryRows: string[] = [];
  for (const g of ['Jupiter', 'Saturn', 'Mars', 'Sun', 'Mercury', 'Venus']) {
    if (customOverrideMap.has(g)) continue;
    const pts = priorDates.map(dt => {
      const ds = dt.toISOString().slice(0, 10);
      const pos = getGrahaTransitPosition(g, dt, lagnaIdx, moonIdx);
      const tag = pos.motion_type === 'Adisara' ? 'ADISARA' : pos.is_retrograde ? 'VAKRA' : 'DIRECT';
      return { ds, sign: cleanSign(pos.transit_rashi_name), deg: cleanDegree(pos.degree_sputa), tag, sIdx: pos.transit_rashi_index };
    });
    const day1Pos = getGrahaTransitPosition(g, day1Utc, lagnaIdx, moonIdx);
    const hadChange = pts.some((p, i) => i > 0 && (p.sIdx !== pts[i - 1].sIdx || p.tag !== pts[i - 1].tag))
      || pts[pts.length - 1].sIdx !== day1Pos.transit_rashi_index
      || pts[pts.length - 1].tag !== (day1Pos.motion_type === 'Adisara' ? 'ADISARA' : day1Pos.is_retrograde ? 'VAKRA' : 'DIRECT');
    if (hadChange || g === 'Jupiter' || g === 'Saturn') {
      const pPrefix = isCompact ? `Prior3d:${g}` : `Prior-3-Day Boundary ${g}:`;
      priorBoundaryRows.push(`${pPrefix} ${pts.map(p => `${p.ds} ${p.sign} ${p.deg} ${p.tag}`).join(sep)}`);
    }
  }

  const slowPlanetLines = ['Jupiter', 'Saturn', 'Rahu', 'Ketu'].flatMap(formatPlanetLines);
  const c3SlowPlanets = [
    `[SLOW PLANETS]`,
    ...priorBoundaryRows,
    ...slowPlanetLines
  ].join('\n');

  // C4 [DOUBLE TRANSIT] — Continuous Jupiter + Saturn overlaps using ISO dates
  const jupSignWins = mergeByKey(
    contSpansByGraha.get('Jupiter') || [],
    it => `${it.state.signIdx}`,
    it => ({ startMs: it.startMs, endMs: it.endMs })
  ).map(w => ({ signIdx: parseInt(w.label, 10), startMs: w.startMs, endMs: w.endMs }));

  const satSignWins = mergeByKey(
    contSpansByGraha.get('Saturn') || [],
    it => `${it.state.signIdx}`,
    it => ({ startMs: it.startMs, endMs: it.endMs })
  ).map(w => ({ signIdx: parseInt(w.label, 10), startMs: w.startMs, endMs: w.endMs }));

  const getTouchesForSign = (planet: 'Jupiter' | 'Saturn', sIdx: number): Array<{ signIdx: number; rel: string }> => {
    const out: Array<{ signIdx: number; rel: string }> = [{ signIdx: sIdx, rel: 'Occ' }];
    for (const asp of getParasharaAspectEntries(planet, sIdx, lagnaIdx, moonIdx)) {
      out.push({ signIdx: asp.targetSignIdx, rel: asp.label });
    }
    return out;
  };

  interface DoubleTransitWin {
    signIdx: number;
    jRel: string;
    sRel: string;
    startMs: number;
    endMs: number;
  }
  const dtWins: DoubleTransitWin[] = [];
  for (const jw of jupSignWins) {
    for (const sw of satSignWins) {
      const oStart = Math.max(jw.startMs, sw.startMs);
      const oEnd = Math.min(jw.endMs, sw.endMs);
      if (oStart > oEnd) continue;
      const jTouches = getTouchesForSign('Jupiter', jw.signIdx);
      const sTouches = getTouchesForSign('Saturn', sw.signIdx);
      for (const jt of jTouches) {
        const st = sTouches.find(x => x.signIdx === jt.signIdx);
        if (!st) continue;
        dtWins.push({ signIdx: jt.signIdx, jRel: jt.rel, sRel: st.rel, startMs: oStart, endMs: oEnd });
      }
    }
  }
  const dtFormatted = dtWins.map(entry => {
    const sName = SIGN_LIST_EN[entry.signIdx - 1];
    const hL = ((entry.signIdx - lagnaIdx + 12) % 12) + 1;
    const hM = ((entry.signIdx - moonIdx + 12) % 12) + 1;
    const sav = savBySignIdx.get(entry.signIdx);
    const savTag = sav ? ` SAV${sav}` : '';
    const rangeStrDt = formatContinuousSpanLabel(entry.startMs, entry.endMs, false);
    const dtJoin = isCompact ? '+' : ' + ';
    return `${sName} L${hL}/M${hM}${savTag}${sep}${rangeStrDt}${sep}Jupiter ${entry.jRel}${dtJoin}Saturn ${entry.sRel}`;
  });
  const c4DoubleTransit = [
    `[DOUBLE TRANSIT]`,
    ...(dtFormatted.length > 0 ? dtFormatted : ['None'])
  ].join('\n');

  // C5 [FAST PLANETS] — Sun, Mars, Mercury, Venus (Moon owned by [LUNAR])
  const fastLines = ['Sun', 'Mars', 'Mercury', 'Venus'].flatMap(formatPlanetLines);
  const c5FastPlanets = [
    `[FAST PLANETS]`,
    ...fastLines
  ].join('\n');

  // C6 [EVENTS] — Strictly chronological by UTC timestamp, with [IST YYYY-MM-DD], zero d#, zero [L/M] overclaiming
  const vse = context.vedicSpecialEvents;
  interface SortableEventLine {
    sortKey: string;
    line: string;
  }
  const sortableEvents: SortableEventLine[] = [];

  if (vse) {
    for (const ing of vse.boundaryIngresses || []) {
      const g = cleanPlanet(ing.grahaKey);
      const fromS = cleanSign(ing.fromSignName);
      const toS = cleanSign(ing.toSignName);
      const tags: string[] = [];
      if (ing.isPriorMonthBoundary) tags.push('PRIOR');
      if (ing.motionType !== 'Normal') tags.push(ing.motionType.toUpperCase());
      const tagStr = tags.length > 0 ? `[${tags.join(listSep)}]` : '';
      const arrow = isCompact ? '->' : ' -> ';
      const ts = ing.ingressTimestampUtc || ing.ingressDate;
      const istTag = ing.ingressIstDate ? ` [IST ${ing.ingressIstDate}]` : '';
      sortableEvents.push({
        sortKey: ts,
        line: `INGRESS ${g} ${fromS}${arrow}${toS} ${ts}${istTag} L${ing.toHouseFromLagna}/M${ing.toHouseFromMoon}${tagStr ? ` ${tagStr}` : ''}`
      });
    }

    for (const st of vse.sameSignStations || []) {
      const g = cleanPlanet(st.grahaKey);
      const turnShort = isCompact
        ? (st.turnType === 'Retrograde -> Direct' ? 'R->D' : 'D->R')
        : st.turnType;
      const beforeParts = st.beforeRange.split(' to ').map(x => x.trim()).join('..');
      const afterParts = st.afterRange.split(' to ').map(x => x.trim()).join('..');
      const label = isCompact ? 'STA' : 'STATION';
      const ts = st.stationTimestampUtc || st.stationDate;
      const istTag = st.stationIstDate ? ` [IST ${st.stationIstDate}]` : '';
      const degTag = st.stationDegree ? ` @${st.stationDegree}` : '';
      sortableEvents.push({
        sortKey: ts,
        line: `${label} ${g} ${turnShort} ${cleanSign(st.signName)} L${st.houseFromLagna}/M${st.houseFromMoon} ${ts}${istTag}${degTag}${sep}before ${beforeParts}${sep}after ${afterParts}`
      });
    }

    for (const p of vse.parivartanaYogas || []) {
      const gA = cleanPlanet(p.grahaA);
      const gB = cleanPlanet(p.grahaB);
      const sA = cleanSign(p.signAName);
      const sB = cleanSign(p.signBName);
      const label = isCompact ? 'PAR' : 'PARIVARTANA';
      const sTs = p.startTimestampUtc || p.startDate;
      const eTs = p.endTimestampUtc || p.endDate;
      const istTag = p.startIstDate && p.endIstDate
        ? (p.startIstDate === p.endIstDate ? ` [IST ${p.startIstDate}]` : ` [IST ${p.startIstDate}..${p.endIstDate}]`)
        : '';
      sortableEvents.push({
        sortKey: sTs,
        line: `${label} ${gA}<->${gB} ${sA}<->${sB} L${p.lagnaHouseA}<->L${p.lagnaHouseB} M${p.moonHouseA}<->M${p.moonHouseB} ${sTs}..${eTs}${istTag}`
      });
    }

    for (const d of vse.debilitationEvents || []) {
      const g = cleanPlanet(d.grahaKey);
      const s = cleanSign(d.signName);
      const mShort = d.motionState.includes('Retrograde') ? 'Vakra' : 'Direct';
      const factorRaw = formatCompactNeechaBhangaFactors(d.cancellationReasons);
      const factorStr = isCompact ? factorRaw : factorRaw.replace(/,/g, ', ');
      const label = isCompact ? 'NB' : 'NEECHABHANGA';
      const sTs = d.startTimestampUtc || d.startDate;
      const eTs = d.endTimestampUtc || d.endDate;
      const istTag = d.startIstDate && d.endIstDate
        ? (d.startIstDate === d.endIstDate ? ` [IST ${d.startIstDate}]` : ` [IST ${d.startIstDate}..${d.endIstDate}]`)
        : '';
      sortableEvents.push({
        sortKey: sTs,
        line: `${label} ${g} ${s} L${d.houseFromLagna}/M${d.houseFromMoon} ${sTs}..${eTs}${istTag}${sep}${mShort}${sep}${factorStr}`
      });
    }
  }

  sortableEvents.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  const eventLines = sortableEvents.length > 0 ? sortableEvents.map(e => e.line) : ['None'];
  const c6Events = [`[EVENTS]`, ...eventLines].join('\n');

  // C8 [LUNAR] — Continuous 1-hour scan + 1-min bisection, precomputing Sitting (L#/M#/SAV), 7th-Aspect (L#/M#/SAV), Tara, CB, and IST dates
  const moonSitWindowsBySignIdx = new Map<number, string[]>();
  const moonAspWindowsBySignIdx = new Map<number, string[]>();
  const moonNakWindowsByName = new Map<string, ContMoonNakSeg[]>();
  const contMoonSignSpans: ContMoonSignSpan[] = [];
  const lunarLines: string[] = [];

  const isMoonOverridden = customOverrideMap.has('Moon');
  if (isMoonOverridden) {
    const spans = contSpansByGraha.get('Moon') || [];
    const customMoonTp = customOverrideMap.get('Moon')!;
    const sIdx = customMoonTp.transit_rashi_index;
    const sName = SIGN_LIST_EN[sIdx - 1] || cleanSign(customMoonTp.transit_rashi_name);
    const hL = ((sIdx - lagnaIdx + 12) % 12) + 1;
    const hM = ((sIdx - moonIdx + 12) % 12) + 1;
    const oppIdx = ((sIdx + 5) % 12) + 1;
    const oppName = SIGN_LIST_EN[oppIdx - 1];
    const oppHL = ((oppIdx - lagnaIdx + 12) % 12) + 1;
    const oppHM = ((oppIdx - moonIdx + 12) % 12) + 1;
    const sitSav = savBySignIdx.get(sIdx) ?? 28;
    const aspSav = savBySignIdx.get(oppIdx) ?? 28;
    const nakName = cleanStar(customMoonTp.nakshatra_name) || 'Anuradha';
    const pada = customMoonTp.pada || 1;
    const tara = computeExactTaraShort(janmaStarName, nakName);
    const cb = calculateChandraBala(moonIdx, sIdx);
    const chandraBalaTag = isCompact ? `CB:${cb.isFavorable ? 'Fav' : '-'}` : `ChandraBala: ${cb.isFavorable ? 'Fav' : '-'}`;
    const chandraFlag = hM === 8 ? `${sep}CHANDRASHTAMA` : '';
    const dStr = `${monthStartIso}..${monthEndIso}`;
    moonSitWindowsBySignIdx.set(sIdx, [dStr]);
    moonAspWindowsBySignIdx.set(oppIdx, [dStr]);
    lunarLines.push(
      `${dStr} [${formatIstRange(monthStartMs, monthEndMs)}]${sep}Sit:${sName} L${hL}/M${hM} SAV${sitSav}${sep}7thAsp:${oppName} L${oppHL}/M${oppHM} SAV${aspSav}${sep}${cleanDegree(customMoonTp.degree_sputa) || '15°00\''}${sep}${nakName} P${pada} ${dStr}(${tara.tag})${sep}${chandraBalaTag}${chandraFlag}`
    );
    void spans;
  } else {
    const sampleMoonAt = (ms: number) => {
      const pos = getGrahaTransitPosition('Moon', new Date(ms), lagnaIdx, moonIdx);
      return {
        ms,
        signIdx: pos.transit_rashi_index,
        signName: SIGN_LIST_EN[pos.transit_rashi_index - 1] || cleanSign(pos.transit_rashi_name),
        hLagna: pos.relative_to_natal_lagna.house_number,
        hMoon: pos.relative_to_natal_rashi.house_number,
        degStr: cleanDegree(pos.degree_sputa),
        nak: pos.graha_pada_chara.nakshatra_name,
        pada: pos.graha_pada_chara.pada
      };
    };

    const bisectMoon = (tA: number, tB: number, keyFn: (s: ReturnType<typeof sampleMoonAt>) => string): number => {
      const kA = keyFn(sampleMoonAt(tA));
      let lo = tA;
      let hi = tB;
      while (hi - lo > MIN_MS) {
        const mid = Math.floor((lo + hi) / 2);
        if (keyFn(sampleMoonAt(mid)) === kA) lo = mid;
        else hi = mid;
      }
      return hi;
    };

    const rawSubSpans: Array<{ startMs: number; endMs: number; state: ReturnType<typeof sampleMoonAt> }> = [];
    let curMs = monthStartMs;
    let curState = sampleMoonAt(curMs);
    let segStartMs = curMs;
    const moonKey = (s: ReturnType<typeof sampleMoonAt>) => `${s.signIdx}|${s.nak}|${s.pada}`;

    while (curMs < monthEndMs) {
      const nextMs = Math.min(monthEndMs, curMs + HOUR_MS);
      const nextState = sampleMoonAt(nextMs);
      if (moonKey(nextState) !== moonKey(curState)) {
        const crossMs = bisectMoon(curMs, nextMs, moonKey);
        rawSubSpans.push({ startMs: segStartMs, endMs: Math.max(segStartMs, crossMs - MIN_MS), state: curState });
        curState = sampleMoonAt(crossMs);
        segStartMs = crossMs;
        while (moonKey(sampleMoonAt(nextMs)) !== moonKey(curState) && nextMs - segStartMs > MIN_MS) {
          const innerCross = bisectMoon(segStartMs, nextMs, moonKey);
          rawSubSpans.push({ startMs: segStartMs, endMs: Math.max(segStartMs, innerCross - MIN_MS), state: curState });
          curState = sampleMoonAt(innerCross);
          segStartMs = innerCross;
        }
      }
      curMs = nextMs;
    }
    rawSubSpans.push({ startMs: segStartMs, endMs: monthEndMs, state: curState });

    for (const sub of rawSubSpans) {
      const endSample = sampleMoonAt(sub.endMs);
      const lastSign = contMoonSignSpans[contMoonSignSpans.length - 1];
      if (!lastSign || lastSign.signIdx !== sub.state.signIdx) {
        const oppIdx = ((sub.state.signIdx + 5) % 12) + 1;
        contMoonSignSpans.push({
          signIdx: sub.state.signIdx,
          signName: sub.state.signName,
          hLagna: sub.state.hLagna,
          hMoon: sub.state.hMoon,
          oppSignIdx: oppIdx,
          oppSignName: SIGN_LIST_EN[oppIdx - 1],
          oppHLagna: ((oppIdx - lagnaIdx + 12) % 12) + 1,
          oppHMoon: ((oppIdx - moonIdx + 12) % 12) + 1,
          startMs: sub.startMs,
          endMs: sub.endMs,
          startDeg: sub.state.degStr,
          endDeg: endSample.degStr,
          naks: [{ nak: sub.state.nak, padas: [sub.state.pada], startMs: sub.startMs, endMs: sub.endMs }]
        });
      } else {
        lastSign.endMs = sub.endMs;
        lastSign.endDeg = endSample.degStr;
        const lastNak = lastSign.naks[lastSign.naks.length - 1];
        if (lastNak && lastNak.nak === sub.state.nak) {
          if (lastNak.padas[lastNak.padas.length - 1] !== sub.state.pada) {
            lastNak.padas.push(sub.state.pada);
          }
          lastNak.endMs = sub.endMs;
        } else {
          lastSign.naks.push({ nak: sub.state.nak, padas: [sub.state.pada], startMs: sub.startMs, endMs: sub.endMs });
        }
      }
    }

    for (const ms of contMoonSignSpans) {
      for (const nSeg of ms.naks) {
        const arrN = moonNakWindowsByName.get(nSeg.nak) || [];
        arrN.push(nSeg);
        moonNakWindowsByName.set(nSeg.nak, arrN);
      }

      const utcRange = `${toUtcIsoMin(ms.startMs)}..${toUtcIsoMin(ms.endMs)}`;
      const istRange = formatIstRange(ms.startMs, ms.endMs);
      const sitArr = moonSitWindowsBySignIdx.get(ms.signIdx) || [];
      sitArr.push(`${utcRange}[${istRange}]`);
      moonSitWindowsBySignIdx.set(ms.signIdx, sitArr);

      const aspArr = moonAspWindowsBySignIdx.get(ms.oppSignIdx) || [];
      aspArr.push(`${utcRange}[${istRange}] (from ${ms.signName})`);
      moonAspWindowsBySignIdx.set(ms.oppSignIdx, aspArr);

      const sitSav = savBySignIdx.get(ms.signIdx) ?? 28;
      const aspSav = savBySignIdx.get(ms.oppSignIdx) ?? 28;
      const sitLabel = isCompact
        ? `Sit:${ms.signName} L${ms.hLagna}/M${ms.hMoon} SAV${sitSav}`
        : `Sit: ${ms.signName} L${ms.hLagna}/M${ms.hMoon} SAV${sitSav}`;
      const aspLabel = isCompact
        ? `7thAsp:${ms.oppSignName} L${ms.oppHLagna}/M${ms.oppHMoon} SAV${aspSav}`
        : `7thAsp: ${ms.oppSignName} L${ms.oppHLagna}/M${ms.oppHMoon} SAV${aspSav}`;

      const starsWithTara = ms.naks
        .map(st => {
          const tara = computeExactTaraShort(janmaStarName, st.nak);
          const padaPart = st.padas.length > 1
            ? `P${st.padas[0]}-P${st.padas[st.padas.length - 1]}`
            : `P${st.padas[0]}`;
          const tWin = `${toUtcIsoMin(st.startMs)}..${toUtcIsoMin(st.endMs)}`;
          return isCompact
            ? `${st.nak} ${padaPart} ${tWin}(${tara.tag})`
            : `${st.nak} ${padaPart} ${tWin} (${tara.tag})`;
        })
        .join(isCompact ? '->' : ' -> ');

      const degRange = ms.startDeg === ms.endDeg ? ms.startDeg : `${ms.startDeg}..${ms.endDeg}`;
      const cb = calculateChandraBala(moonIdx, ms.signIdx);
      const chandraBalaTag = isCompact
        ? `CB:${cb.isFavorable ? 'Fav' : '-'}`
        : `ChandraBala: ${cb.isFavorable ? 'Fav' : '-'}`;
      const chandraFlag = ms.hMoon === 8 ? `${sep}CHANDRASHTAMA` : '';

      lunarLines.push(`${utcRange} [${istRange}]${sep}${sitLabel}${sep}${aspLabel}${sep}${degRange}${sep}${starsWithTara}${sep}${chandraBalaTag}${chandraFlag}`);
    }
  }

  const c8Lunar = [
    `[LUNAR]`,
    ...lunarLines
  ].join('\n');

  // C7 [HOUSE MAP] — using exact continuous sign spans + ISO dates + Moon Sit & 7th-Aspect dates
  const natalBySignIdx = new Map<number, string[]>();
  (context.flattenedNatalD1 || []).forEach(p => {
    const sIdx = getCleanSignIndex(p.rashi_name);
    if (!sIdx) return;
    const arr = natalBySignIdx.get(sIdx) || [];
    arr.push(`${cleanPlanet(p.body_name)}${p.is_retrograde ? '(R)' : ''}`);
    natalBySignIdx.set(sIdx, arr);
  });

  const transitBySignIdx = new Map<number, string[]>();
  const aspectsReceivedBySignIdx = new Map<number, string[]>();

  for (const g of ['Sun', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu']) {
    const signWins = mergeByKey(
      contSpansByGraha.get(g) || [],
      it => `${it.state.signIdx}`,
      it => ({ startMs: it.startMs, endMs: it.endMs })
    ).map(w => ({ signIdx: parseInt(w.label, 10), startMs: w.startMs, endMs: w.endMs }));

    const isFast = g === 'Sun' || g === 'Mars' || g === 'Mercury' || g === 'Venus';
    for (const sp of signWins) {
      const dr = sp.startMs === monthStartMs && sp.endMs === monthEndMs
        ? ''
        : ` ${formatContinuousSpanLabel(sp.startMs, sp.endMs, isFast)}`;
      const tArr = transitBySignIdx.get(sp.signIdx) || [];
      tArr.push(`${g}${dr}`);
      transitBySignIdx.set(sp.signIdx, tArr);

      for (const asp of getParasharaAspectEntries(g, sp.signIdx, lagnaIdx, moonIdx)) {
        const aArr = aspectsReceivedBySignIdx.get(asp.targetSignIdx) || [];
        aArr.push(`${g} ${asp.label}${dr}`);
        aspectsReceivedBySignIdx.set(asp.targetSignIdx, aArr);
      }
    }
  }

  const formatCompactIsoDayWin = (ms: number, endMs: number): string => {
    const s = new Date(ms).toISOString().slice(0, 10);
    const e = new Date(endMs).toISOString().slice(0, 10);
    return s === e ? s : `${s}..${e}`;
  };

  const houseMapLines: string[] = [];
  for (let hL = 1; hL <= 12; hL++) {
    const sIdx = ((lagnaIdx - 1 + (hL - 1)) % 12) + 1;
    const sName = SIGN_LIST_EN[sIdx - 1];
    const hM = ((sIdx - moonIdx + 12) % 12) + 1;
    const natalOcc = (natalBySignIdx.get(sIdx) || []).join(listSep);
    const transitOcc = (transitBySignIdx.get(sIdx) || []).join(listSep);
    const aspRec = Array.from(new Set(aspectsReceivedBySignIdx.get(sIdx) || [])).join(listSep);
    const moonSitD = contMoonSignSpans
      .filter(ms => ms.signIdx === sIdx)
      .map(ms => formatCompactIsoDayWin(ms.startMs, ms.endMs))
      .join(listSep);

    if (isCompact) {
      const fields = [`L${hL}/M${hM} ${sName}`];
      if (natalOcc) fields.push(`N:${natalOcc}`);
      if (transitOcc) fields.push(`T:${transitOcc}`);
      if (aspRec) fields.push(`Asp:${aspRec}`);
      if (moonSitD) fields.push(`MoonSit:${moonSitD}`);
      houseMapLines.push(fields.join('|'));
    } else {
      houseMapLines.push(
        `L${hL}/M${hM} ${sName} | N: ${natalOcc || '-'} | T: ${transitOcc || '-'} | Asp: ${aspRec || '-'} | MoonSit: ${moonSitD || '-'}`
      );
    }
  }
  const c7HouseMap = [`[HOUSE MAP]`, ...houseMapLines].join('\n');

  // C9 [AD CHAMBER/GATES] — using exact continuous Moon/Graha ISO windows (zero d#, zero day-1 lag)
  let c9AdGates = `[AD CHAMBER/GATES]\nNot provided`;
  if (context.eventManufacturingSuperset) {
    const ss = context.eventManufacturingSuperset;
    const ad = ss.adChamberSummary;
    const adCoord = `L${ad.adNatalHouseFromLagna}/M${ad.adNatalHouseFromRashi}`;
    const ruledStr = ad.ruledHouses.length > 0
      ? ad.ruledHouses.map(rh => {
          const occClean = rh.occupants.map(cleanPlanet).filter(Boolean);
          const aspClean = rh.aspectingGrahas.map(a => a.replace(/[()]/g, '').trim()).filter(Boolean);
          const inner: string[] = [];
          if (occClean.length > 0) inner.push(isCompact ? `T:${occClean.join(',')}` : `T: ${occClean.join(', ')}`);
          if (aspClean.length > 0) inner.push(isCompact ? `Asp:${aspClean.join(',')}` : `Asp: ${aspClean.join(', ')}`);
          const detail = inner.length > 0
            ? (isCompact ? `(${inner.join(';')})` : ` (${inner.join('; ')})`)
            : '';
          return `L${rh.houseFromLagna}/M${rh.houseFromRashi} ${cleanSign(rh.rashiName)}${detail}`;
        }).join(isCompact ? ';' : '; ')
      : '-';

    const gateLines = ss.gates.map(g => {
      const gSignIdx = getCleanSignIndex(g.rashiName);
      const gNak = cleanStar(g.nakshatraName);

      // Compute exact active Grahas in gate sign from our continuous scans + Natal D1
      const grahaTags: string[] = [];
      for (const np of context.flattenedNatalD1 || []) {
        const pn = cleanPlanet(np.body_name);
        if (!pn || pn === 'Lagna' || pn === 'Mandi') continue;
        if (getCleanSignIndex(np.rashi_name) === gSignIdx) {
          grahaTags.push(`natal ${pn}`);
        }
      }
      for (const pName of ['Jupiter', 'Saturn', 'Rahu', 'Ketu', 'Sun', 'Mars', 'Mercury', 'Venus']) {
        const pSignWins = mergeByKey(
          (contSpansByGraha.get(pName) || []).filter(sp => sp.state.signIdx === gSignIdx),
          it => `${it.state.signIdx}`,
          it => ({ startMs: it.startMs, endMs: it.endMs })
        );
        if (pSignWins.length > 0) {
          const isFast = pName === 'Sun' || pName === 'Mars' || pName === 'Mercury' || pName === 'Venus';
          const wText = pSignWins.map(w => formatContinuousSpanLabel(w.startMs, w.endMs, isFast)).join(',');
          grahaTags.push(`${pName}(${wText})`);
        }
      }

      // Exact Moon window inside THAT Gate's Nakshatra + exact Moon 7th-aspect onto Gate's sign
      const nakHits = moonNakWindowsByName.get(gNak) || [];
      const exactMoonNakText = nakHits.length > 0
        ? nakHits.map(n => `${toUtcIsoMin(n.startMs)}..${toUtcIsoMin(n.endMs)}[${formatIstRange(n.startMs, n.endMs)}]`).join(listSep)
        : (moonSitWindowsBySignIdx.get(gSignIdx)?.join(listSep) || '-');
      const oppAspText = moonAspWindowsBySignIdx.get(gSignIdx)?.join(listSep) || '-';

      const mLabel = isCompact ? `MoonStar:${exactMoonNakText}` : `Moon Star: ${exactMoonNakText}`;
      const aLabel = isCompact ? `Moon7thAsp:${oppAspText}` : `Moon 7th-Asp: ${oppAspText}`;
      const gLabel = isCompact ? `Grahas:${grahaTags.join(',') || '-'}` : `Grahas: ${grahaTags.join(', ') || '-'}`;
      return `G${g.gateIndex}${sep}${gNak}${sep}${cleanSign(g.rashiName)}${sep}L${g.houseFromLagna}/M${g.houseFromRashi}${sep}${mLabel}${sep}${aLabel}${sep}${gLabel}`;
    });

    const adHeader = isCompact
      ? `ADCHAMBER:natal ${cleanPlanet(ad.adCleanName)}@${cleanSign(ad.adNatalRashiName)}(${adCoord})|Ruled:${ruledStr}`
      : `ADCHAMBER: natal ${cleanPlanet(ad.adCleanName)} @ ${cleanSign(ad.adNatalRashiName)} (${adCoord}) | Ruled: ${ruledStr}`;

    c9AdGates = [
      `[AD CHAMBER/GATES]`,
      adHeader,
      ...gateLines
    ].join('\n');
  }

  // C10 [TRIGGER WINDOWS] — Unified chronological ledger joining Events, SD switches, Gates, and Moon Sit/7th-Aspect + Tara/CB
  const summarizeMoonOverlapForWindow = (wStartMs: number, wEndMs: number, focusSignIndices: number[]): string => {
    if (contMoonSignSpans.length === 0) return 'Moon n/a';
    const focusSet = new Set(focusSignIndices.filter(Boolean));
    const hits: string[] = [];

    for (const ms of contMoonSignSpans) {
      if (ms.endMs < wStartMs || ms.startMs > wEndMs) continue;
      const oStart = Math.max(ms.startMs, wStartMs);
      const oEnd = Math.min(ms.endMs, wEndMs);
      const isSitHit = focusSet.size === 0 || focusSet.has(ms.signIdx);
      const isAspHit = focusSet.has(ms.oppSignIdx);
      if (focusSet.size > 0 && !isSitHit && !isAspHit && wEndMs - wStartMs > 4 * DAY_MS) continue;

      const ovNaks = ms.naks.filter(n => n.endMs >= oStart && n.startMs <= oEnd);
      const taraTags = Array.from(new Set(ovNaks.map(n => computeExactTaraShort(janmaStarName, n.nak).tag))).join('/');
      const cb = calculateChandraBala(moonIdx, ms.signIdx);
      const cbStr = cb.isFavorable ? 'CB:Fav' : 'CB:-';
      const relStr = isSitHit && isAspHit
        ? `Sit:${ms.signName}(L${ms.hLagna}/M${ms.hMoon})+7thAsp:${ms.oppSignName}(L${ms.oppHLagna}/M${ms.oppHMoon})`
        : isAspHit
        ? `7thAsp:${ms.oppSignName}(L${ms.oppHLagna}/M${ms.oppHMoon}) from ${ms.signName}(M${ms.hMoon})`
        : `Sit:${ms.signName}(L${ms.hLagna}/M${ms.hMoon})/7thAsp:${ms.oppSignName}(L${ms.oppHLagna}/M${ms.oppHMoon})`;
      const timeBit = formatIstRange(oStart, oEnd);
      hits.push(`${relStr} [${timeBit}] (${taraTags || 'Tara'},${cbStr}${ms.hMoon === 8 ? ',CHANDRASHTAMA' : ''})`);
    }

    if (hits.length === 0) {
      // Fallback: show Moon placement active at window start
      const atStart = contMoonSignSpans.find(ms => wStartMs >= ms.startMs && wStartMs <= ms.endMs) || contMoonSignSpans[0];
      if (!atStart) return 'Moon n/a';
      const cb = calculateChandraBala(moonIdx, atStart.signIdx);
      const nAt = atStart.naks.find(n => wStartMs >= n.startMs && wStartMs <= n.endMs) || atStart.naks[0];
      const tara = nAt ? computeExactTaraShort(janmaStarName, nAt.nak).tag : 'Tara';
      return `Sit:${atStart.signName}(L${atStart.hLagna}/M${atStart.hMoon})/7thAsp:${atStart.oppSignName}(L${atStart.oppHLagna}/M${atStart.oppHMoon}) [${formatIstRange(wStartMs, wEndMs)}] (${tara},${cb.isFavorable ? 'CB:Fav' : 'CB:-'})`;
    }
    return hits.slice(0, 3).join('; ');
  };

  interface TriggerLedgerRow {
    sortMs: number;
    line: string;
  }
  const triggerRows: TriggerLedgerRow[] = [];

  if (vse) {
    for (const ing of vse.boundaryIngresses || []) {
      const ts = ing.ingressTimestampUtc || `${ing.ingressDate}T12:00Z`;
      const ms = Date.parse(ts);
      const sav = savBySignIdx.get(ing.toSignIndex) ?? 28;
      const g = cleanPlanet(ing.grahaKey);
      const moonOv = summarizeMoonOverlapForWindow(ms, Math.min(monthEndMs, ms + 24 * HOUR_MS), [ing.toSignIndex]);
      triggerRows.push({
        sortMs: ms,
        line: `${toUtcIsoMin(ms)} [${formatIstRange(ms, ms)}]${sep}INGRESS: ${g} ${cleanSign(ing.fromSignName)}->${cleanSign(ing.toSignName)}${ing.isPriorMonthBoundary ? '(PRIOR)' : ''}${sep}L${ing.toHouseFromLagna}/M${ing.toHouseFromMoon} SAV${sav}${sep}Moon: ${moonOv}`
      });
    }

    for (const st of vse.sameSignStations || []) {
      const ts = st.stationTimestampUtc || `${st.stationDate}T12:00Z`;
      const ms = Date.parse(ts);
      const sav = savBySignIdx.get(st.signIndex) ?? 28;
      const g = cleanPlanet(st.grahaKey);
      const moonOv = summarizeMoonOverlapForWindow(Math.max(monthStartMs, ms - 12 * HOUR_MS), Math.min(monthEndMs, ms + 36 * HOUR_MS), [st.signIndex]);
      triggerRows.push({
        sortMs: ms,
        line: `${toUtcIsoMin(ms)} [${formatIstRange(ms, ms)}]${sep}STA: ${g} ${st.turnType === 'Retrograde -> Direct' ? 'R->D' : 'D->R'} ${cleanSign(st.signName)}${st.stationDegree ? ` @${st.stationDegree}` : ''}${sep}L${st.houseFromLagna}/M${st.houseFromMoon} SAV${sav}${sep}Moon: ${moonOv}`
      });
    }

    for (const p of vse.parivartanaYogas || []) {
      const sMs = Date.parse(p.startTimestampUtc || `${p.startDate}T00:00Z`);
      const eMs = Date.parse(p.endTimestampUtc || `${p.endDate}T23:59Z`);
      const moonOv = summarizeMoonOverlapForWindow(sMs, eMs, [p.signAIndex, p.signBIndex]);
      triggerRows.push({
        sortMs: sMs,
        line: `${toUtcIsoMin(sMs)}..${toUtcIsoMin(eMs)} [${formatIstRange(sMs, eMs)}]${sep}PAR: ${cleanPlanet(p.grahaA)}<->${cleanPlanet(p.grahaB)} ${cleanSign(p.signAName)}<->${cleanSign(p.signBName)}${sep}L${p.lagnaHouseA}<->L${p.lagnaHouseB} M${p.moonHouseA}<->M${p.moonHouseB}${sep}Moon: ${moonOv}`
      });
    }

    for (const d of vse.debilitationEvents || []) {
      const sMs = Date.parse(d.startTimestampUtc || `${d.startDate}T00:00Z`);
      const eMs = Date.parse(d.endTimestampUtc || `${d.endDate}T23:59Z`);
      const sav = savBySignIdx.get(d.signIndex) ?? 28;
      const mShort = d.motionState.includes('Retrograde') ? 'Vakra' : 'Direct';
      const moonOv = summarizeMoonOverlapForWindow(sMs, eMs, [d.signIndex]);
      triggerRows.push({
        sortMs: sMs,
        line: `${toUtcIsoMin(sMs)}..${toUtcIsoMin(eMs)} [${formatIstRange(sMs, eMs)}]${sep}NB: ${cleanPlanet(d.grahaKey)} ${cleanSign(d.signName)}(${mShort})${sep}L${d.houseFromLagna}/M${d.houseFromMoon} SAV${sav}${sep}Moon: ${moonOv}`
      });
    }
  }

  for (const sd of sdIntervals) {
    const sMs = Date.parse(sd.startTimestampUtc);
    const eMs = Date.parse(sd.endTimestampUtc);
    const sdLord = cleanPlanet(sd.sookshmadasha);
    const sdNatal = d1PlanetMetaMap.get(sdLord);
    const sdSpan = (contSpansByGraha.get(sdLord) || [])[0];
    const focusSigns = [sdNatal?.signIdx || 0, sdSpan?.state.signIdx || 0].filter(Boolean);
    const moonOv = summarizeMoonOverlapForWindow(sMs, Math.min(eMs, sMs + 72 * HOUR_MS), focusSigns);
    triggerRows.push({
      sortMs: sMs,
      line: `${sd.startTimestampUtc}..${sd.endTimestampUtc} [${formatIstRange(sMs, eMs)}]${sep}SD: ${cleanPlanet(sd.pratyantardasha)}/${sdLord}${sep}${sdNatal ? `natal L${sdNatal.hL}/M${sdNatal.hM}` : 'natal'}${sep}Moon(start): ${moonOv}`
    });
  }

  if (context.eventManufacturingSuperset) {
    for (const g of context.eventManufacturingSuperset.gates) {
      const gNak = cleanStar(g.nakshatraName);
      const gSignIdx = getCleanSignIndex(g.rashiName);
      const sav = savBySignIdx.get(gSignIdx) ?? 28;
      for (const hit of moonNakWindowsByName.get(gNak) || []) {
        const tara = computeExactTaraShort(janmaStarName, gNak).tag;
        const cb = calculateChandraBala(moonIdx, gSignIdx);
        triggerRows.push({
          sortMs: hit.startMs,
          line: `${toUtcIsoMin(hit.startMs)}..${toUtcIsoMin(hit.endMs)} [${formatIstRange(hit.startMs, hit.endMs)}]${sep}GATE G${g.gateIndex}: Moon in ${gNak}(${cleanSign(g.rashiName)})${sep}L${g.houseFromLagna}/M${g.houseFromRashi} SAV${sav}${sep}Moon: Sit:${cleanSign(g.rashiName)}(L${g.houseFromLagna}/M${g.houseFromRashi}) (${tara},${cb.isFavorable ? 'CB:Fav' : 'CB:-'})`
        });
      }
    }
  }

  triggerRows.sort((a, b) => a.sortMs - b.sortMs);
  const c10TriggerWindows = [
    `[TRIGGER WINDOWS]`,
    ...(triggerRows.length > 0 ? triggerRows.map(r => r.line) : ['None'])
  ].join('\n');

  // SUB-PROMPT BUILDER (Career | Finance | Love | Family | Health | Litigation)
  const subPromptBlock = (() => {
    if (domain === 'master') return '';
    const spec = DOMAIN_PROMPT_SPECS[domain];
    const domainUpper = domain.toUpperCase();
    const resolvedQuestion = cleanQuestion || spec.defaultQuestion;

    // Non-redundant Domain Pointer referencing Master [SHADBALA], [SAV]/[BAV], [YOGAS], [DOSHAS] (no duplicate reprints!)
    const yd = context.yogasAndDoshas;
    const relRaja = (yd?.rajaYogas || []).filter(y => y.domains.includes(domain)).map(y => y.name);
    const relGen = (yd?.generalYogas || []).filter(y => y.domains.includes(domain)).map(y => y.name);
    const relDoshas = (yd?.doshas || []).filter(d => d.domains.includes(domain)).map(d => `${d.name}(${d.status})`);
    const yogaNames = [...relRaja, ...relGen].join(', ') || 'See Master [YOGAS]';
    const doshaNames = relDoshas.join(', ') || 'None specific';

    // Format domain Divisional Charts using buildVargaDomainSummary (Sign, H#, Dignity, Domain-Lord summary; zero un-reconciled degrees!)
    const formatVargaSection = (chart: VargaChartDef): string => {
      const summary = buildVargaDomainSummary(chart, spec.focusHouses);
      const rowGroups: string[] = [];
      for (let i = 0; i < 12; i += 4) {
        rowGroups.push(summary.planetRows.slice(i, i + 4).join(' | '));
      }
      return `[VARGA ${chart.code}: ${chart.name}]\n${summary.domainSummaryLine}\n${rowGroups.join('\n')}`;
    };

    const vargaSections = spec.vargaCharts.map(code => {
      const chart = context.vargaCharts?.[code];
      if (!chart) return `[VARGA ${code}]\nnot provided`;
      return formatVargaSection(chart);
    });

    const masterAnchorNote = domain === 'love'
      ? `Primary Chart Reference: Evaluate ALL Master [D1], [D9] (Navamsa), [JAIMINI] (UL/A12, A7, DK), [SHADBALA], [SAV]/[BAV], [YOGAS]/[DOSHAS], monthly ephemeris/[TRIGGER WINDOWS], and [VARGA D7]/[VARGA D30] below.`
      : `Primary Chart Reference: Evaluate ALL Master [D1], [D9], [SHADBALA], [SAV]/[BAV], [YOGAS]/[DOSHAS], monthly ephemeris/[TRIGGER WINDOWS], and attached [VARGA] charts (${spec.vargaCharts.join(', ')}) below.`;

    const domainRulesLines = [
      `Scope: Act strictly as a Senior Vedic Astrologer (Parashara & Jaimini). Using ONLY the provided Master chart, [PERSON], monthly ephemeris, [LUNAR], [TRIGGER WINDOWS], and attached ${spec.vargaTagLabel} charts, deliver a deep prediction ONLY for ${spec.topicUpper}.`,
      masterAnchorNote,
      `Constraints: Never say "excerpt", "hypothetical", or add disclaimers/counselor advice. Never invent or recalculate positions, and do NOT invent undisclosed job title, marital status, or pending decisions beyond [PERSON]. Weigh both Lagna (L#) and Moon (M#), and use the precomputed Moon Sitting / 7th-Aspect + Tara + ChandraBala windows in [LUNAR] and [TRIGGER WINDOWS].`,
      `Citation Split & Calibration: Sections 1-4 MUST cite exact planets, L#/M# houses, Dasha/SD, Varga (H#), SAV/BAV, Tara, CB, and UTC dates behind every claim. Section 5 (Readout) MUST contain ZERO astrological terms (no planet, sign, house, L#/M#/H#, Dasha, Nakshatra, Tara, CB, Varga, SAV, or Yoga names) and MUST cite ONLY precomputed [IST YYYY-MM-DD] calendar dates in calm, objective real-world scenarios. Rating & Band Rule: 3 = Highly Likely (70-90%) | 2 = Most Likely (50-69%) | 1 = Possible (25-49%); Rating 2 or 3 requires >=2 independent active supports (Two-Support Rule), else cap at Rating 1.`,
      `Output Contract: Whenever [OUTPUT STRUCTURE] appears below, ALWAYS emit ALL 5 numbered sections (## 1 through ## 5) AND BOTH ### subsections inside ## 5 verbatim in exact order, keeping Sections 1-4 concise so ## 4 and ## 5 are NEVER truncated, and directly answer [FOCUS QUESTION] inside ### 2. Answer to Focus Question. Never omit, rename, merge, or renumber any heading, never wrap output in code fences, and never add preamble before ## 1 or epilogue after ### 2. (Only on a subsequent follow-up message in the same thread without [OUTPUT STRUCTURE] may you reply concisely.)`
    ];

    const outputStructureLines = [
      `[OUTPUT STRUCTURE]`,
      `Format Rules: Start immediately with ## 1. Copy EVERY ## 1..## 5 and ### 1..### 2 heading below 100% verbatim (no extra colons, subtitles, shortened titles, parenthetical edits, or bold-only headings). NEVER use ### or #### subheadings inside Sections 1, 2, 3, or 4. Emit pure Markdown only (no code fences, no --- dividers). Follow the concise length budget per section so Section 4 and Section 5 ALWAYS render completely.`,
      `## 1. ${spec.overviewTitle} (Lagna L# + Moon Lagna M# + Dasha + ${spec.vargaTagLabel})`,
      `[2-3 concise paragraphs summarizing natal capacity (citing [D1], [D9], [SHADBALA]), MD/AD/PD/SD delivery, L#/M# slow-planet shifts, and ${spec.vargaTagLabel} (H#) highlights with UTC dates.]`,
      `## 2. ${spec.matrixTitle}`,
      `| Date Range | ${spec.eventColumnLabel} | Moon Trigger (Sitting / 7th Aspect + Tara / ChandraBala) | Probability (%) | Rating (1-3) |`,
      `| :--- | :--- | :--- | :--- | :--- |`,
      `| YYYY-MM-DD..YYYY-MM-DD | [Concrete event matching Event # in Sec 3] | [Moon Sit or 7th-Asp + Tara + CB] | [80%, 60%, or 35%] | [1, 2, or 3] |`,
      `[Emit 4-7 valid 5-column Markdown table rows sorted chronologically using UTC dates; single line per row; match Rating 3=70-90%, 2=50-69%, 1=25-49% with >=2 supports for Rating>=2.]`,
      `## 3. ${spec.breakdownTitle} (When & How Each Happens)`,
      `- Event 1: [Exact Event Title matching row 1 of Sec 2] | Dates: YYYY-MM-DD..YYYY-MM-DD | Moon Trigger: [Sit/7th-Asp + Tara + CB] | Verdict: [NN]% (Rating [1-3]) | Mechanism: [Concise D1/D9/${spec.vargaTagLabel}/Dasha/SD/SAV support].`,
      `[Emit one flat "- Event #:" bullet for EVERY row in Section 2 in matching order (1-2 sentences each); NEVER use ### subheadings inside Section 3.]`,
      `## 4. ${spec.cautionTitle}`,
      `- YYYY-MM-DD..YYYY-MM-DD | Trigger: [Exact Chandrashtama M8 / Friction Tara T3/T5/T7 / Combustion / Tense Aspect with L#/M#] | Avoid: [Specific practical caution].`,
      `[MANDATORY SECTION: ALWAYS emit "## 4. ${spec.cautionTitle}" verbatim with 3-5 flat "- " bullets using UTC dates. NEVER omit, merge, rename, or replace with prose/tables.]`,
      `## 5. Readout (Plain Real-World Scenarios Only - Zero Astrological Terms)`,
      `[MANDATORY SECTION: Right-side Readout panel using precomputed IST (+05:30) calendar dates ONLY. Use ONLY the exact two ### headings below. Zero astrological terms anywhere in Section 5.]`,
      `### 1. Month Summary`,
      `[2-3 calm, plain-English paragraphs (no jargon) summarizing the month's real-world pacing, key IST opportunity dates, and IST caution dates.]`,
      `### 2. Answer to Focus Question`,
      `[MANDATORY SECTION: Always emit this exact heading verbatim and non-empty. If [FOCUS QUESTION] asks a specific question, answer THAT EXACT QUESTION directly in sentence 1 with a clear Yes/No/Conditional verdict, IST calendar dates, and practical next steps in 2-5 plain-English sentences. If [FOCUS QUESTION] is ${spec.defaultQuestion}, state the overall month verdict in sentence 1 followed by 3-5 "- " plain-English practical takeaways with IST calendar dates.]`
    ];

    const focusQuestionBlock = [
      `[FOCUS QUESTION]`,
      resolvedQuestion
    ];

    return [
      `[SUB-PROMPT: ${domainUpper}]`,
      `Domain: ${spec.label} | Focus Houses (D1): ${spec.focusHouses.map(h => `L${h}`).join(', ')} | Primary Karakas: ${spec.primaryKarakas.join(', ')}`,
      ...domainRulesLines,
      `[DOMAIN STRENGTHS]`,
      `Master Reference: Use [SHADBALA] for ${spec.primaryKarakas.join(', ')}; use [SAV]/[BAV] for ${spec.focusHouses.map(h => `L${h}`).join(', ')}.`,
      `Highlighted Yogas (details in [YOGAS]): ${yogaNames}`,
      `Domain Dosha Filter (details in [DOSHAS]): ${doshaNames}`,
      ...vargaSections,
      ...outputStructureLines,
      ...focusQuestionBlock
    ].join('\n');
  })();

  const monthSlice = [
    c1Period,
    c1Person,
    c2Dasha,
    c3SlowPlanets,
    c4DoubleTransit,
    c5FastPlanets,
    c6Events,
    c7HouseMap,
    c8Lunar,
    c9AdGates,
    c10TriggerWindows
  ].join('\n');

  const resolvedMetaQuestion = domain === 'master'
    ? (cleanQuestion || undefined)
    : (cleanQuestion || DOMAIN_PROMPT_SPECS[domain].defaultQuestion);

  const fullPrompt = subPromptBlock
    ? `${staticBlock}\n${monthSlice}\n${subPromptBlock}`
    : cleanQuestion
    ? `${staticBlock}\n${monthSlice}\n[FOCUS QUESTION]\n${cleanQuestion}`
    : `${staticBlock}\n${monthSlice}`;
  const lineCount = fullPrompt.split('\n').length;

  return {
    staticBlock,
    monthSlice,
    subPromptBlock,
    fullPrompt,
    meta: {
      variant,
      domain,
      focusQuestion: resolvedMetaQuestion,
      monthLabel: `${monthName} ${year}`,
      dateRange: rangeStr,
      charCount: fullPrompt.length,
      lineCount,
      estTokens: Math.ceil(fullPrompt.length / 4)
    }
  };
}

/**
 * Automated Regression Validator for Original Source Prompts (Master + 6 Domain Sub-Prompts).
 */
export function validateOriginalSourcePrompt(
  result: OriginalSourcePromptResult,
  rawContext: VedicHouseContext,
  variant: OriginalSourceVariant = result.meta?.variant || 'compact',
  domainArg?: OriginalSourceDomain
): { valid: boolean; errors: string[] } {
  const domain: OriginalSourceDomain = domainArg || result.meta?.domain || rawContext.originalSourceDomain || 'master';
  const isCompact = variant === 'compact';
  const errors: string[] = [];
  const { staticBlock, fullPrompt } = result;

  const year = rawContext.selectedYear;
  const monthIdx = rawContext.selectedMonth;
  const mNumStr = String(monthIdx + 1).padStart(2, '0');
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const monthStartIso = `${year}-${mNumStr}-01`;
  const monthEndIso = `${year}-${mNumStr}-${String(daysInMonth).padStart(2, '0')}`;
  const priorStartDt = new Date(Date.UTC(year, monthIdx, 1 - 3, 12, 0, 0));
  const priorStartIso = priorStartDt.toISOString().slice(0, 10);

  const lagna = cleanSign(rawContext.natalLagnaSignName) || 'Sagittarius';
  const moon = cleanSign(rawContext.natalMoonSignName || rawContext.natalJanmaStar?.rashi_name) || 'Scorpio';
  const lagnaIdx = getCleanSignIndex(lagna) || 9;
  const moonIdx = getCleanSignIndex(moon) || 8;
  const context = apply001MEEnrichments(rawContext, lagnaIdx, moonIdx);
  const janmaStarName = cleanStar(context.natalJanmaStar?.nakshatra_name || 'Anuradha') || 'Anuradha';

  // 1. Required Master sections
  const requiredSections = [
    '[RULES]', '[CONVENTIONS]', '[LORDSHIPS]', '[HOUSE LORDS]', '[D1]', '[D9]',
    '[SHADBALA]', '[SAV]', '[BAV]', '[PINDAS]', '[YOGAS]', '[DOSHAS]', '[JAIMINI]', '[KARAKAS]',
    '[PERIOD]', '[PERSON]', '[DASHA]', '[SLOW PLANETS]', '[DOUBLE TRANSIT]',
    '[FAST PLANETS]', '[EVENTS]', '[HOUSE MAP]', '[LUNAR]', '[AD CHAMBER/GATES]', '[TRIGGER WINDOWS]'
  ];
  for (const sec of requiredSections) {
    if (!fullPrompt.includes(sec)) {
      errors.push(`Missing required section: ${sec}`);
    }
  }

  // 1a. Domain Sub-Prompt, Varga exclusivity, Output Structure (including Readout Option B), and trailing Focus Question validation
  if (domain === 'master') {
    if (result.subPromptBlock || /^\[SUB-PROMPT:/m.test(fullPrompt) || /^\[VARGA D\d+:/mi.test(fullPrompt) || /^\[OUTPUT STRUCTURE\]/m.test(fullPrompt)) {
      errors.push('Master prompt must not attach [SUB-PROMPT:], [OUTPUT STRUCTURE], or divisional [VARGA D2..D144] charts');
    }
  } else {
    const spec = DOMAIN_PROMPT_SPECS[domain];
    const subTag = `[SUB-PROMPT: ${domain.toUpperCase()}]`;
    if (!fullPrompt.includes(subTag)) {
      errors.push(`Missing required domain header: ${subTag}`);
    }
    if (!fullPrompt.includes('[DOMAIN STRENGTHS]')) {
      errors.push(`Missing [DOMAIN STRENGTHS] in ${subTag}`);
    }
    for (const code of spec.vargaCharts) {
      if (!fullPrompt.includes(`[VARGA ${code}:`)) {
        errors.push(`Domain "${domain}" missing expected divisional chart [VARGA ${code}:`);
      }
    }
    const attachedVargas = Array.from(fullPrompt.matchAll(/\[VARGA (D\d+):/g)).map(m => m[1]);
    for (const vCode of attachedVargas) {
      if (!spec.vargaCharts.includes(vCode)) {
        errors.push(`Domain "${domain}" leaked unrelated divisional chart ${vCode} (allowed: ${spec.vargaCharts.join(', ')})`);
      }
    }
    const requiredStructureTokens = [
      'Output Contract:',
      '[OUTPUT STRUCTURE]',
      'Format Rules:',
      `## 1. ${spec.overviewTitle} (Lagna L# + Moon Lagna M# + Dasha + ${spec.vargaTagLabel})`,
      `## 2. ${spec.matrixTitle}`,
      `| Date Range | ${spec.eventColumnLabel} | Moon Trigger (Sitting / 7th Aspect + Tara / ChandraBala) | Probability (%) | Rating (1-3) |`,
      '| :--- | :--- | :--- | :--- | :--- |',
      `## 3. ${spec.breakdownTitle} (When & How Each Happens)`,
      `## 4. ${spec.cautionTitle}`,
      '## 5. Readout (Plain Real-World Scenarios Only - Zero Astrological Terms)',
      '### 1. Month Summary',
      '### 2. Answer to Focus Question',
      '[MANDATORY SECTION:',
      '[FOCUS QUESTION]'
    ];
    for (const tok of requiredStructureTokens) {
      if (!fullPrompt.includes(tok)) {
        errors.push(`Domain "${domain}" missing required Output Structure / Readout token: "${tok}"`);
      }
    }
    const osIdx = fullPrompt.indexOf('[OUTPUT STRUCTURE]');
    const fqIdx = fullPrompt.indexOf('[FOCUS QUESTION]');
    if (osIdx !== -1 && fqIdx !== -1 && fqIdx <= osIdx) {
      errors.push(`Domain "${domain}" [FOCUS QUESTION] must appear AFTER [OUTPUT STRUCTURE] to preserve KV cache prefix`);
    }
  }

  // 1b. Compaction hygiene & symbol-collision checks (zero underscores, zero blank lines, zero d# day shorthand, zero H# on D1)
  if (fullPrompt.includes('_')) {
    errors.push('Prompt contains underscore "_" character (must be zero-underscore text)');
  }
  if (fullPrompt.includes('\n\n')) {
    errors.push('Prompt contains blank line gap "\\n\\n" (must be strictly single-newline)');
  }

  const factualDataOnlyPrompt = fullPrompt
    .split('\n[OUTPUT STRUCTURE]')[0]
    .split('\n[FOCUS QUESTION]')[0];

  // Ensure lowercase d# day shorthand (e.g., d1, d1-5, d14) is eliminated everywhere outside [FOCUS QUESTION]
  const dayShorthandMatches = factualDataOnlyPrompt.match(/\bd\d+(?:-\d+)?\b/g);
  if (dayShorthandMatches && dayShorthandMatches.length > 0) {
    errors.push(`Day shorthand d# found (use ISO YYYY-MM-DD dates instead): ${dayShorthandMatches.slice(0, 5).join(', ')}`);
  }

  // 2. Forbidden words / prediction-outcome probability prose (scanned ONLY against factual data before [OUTPUT STRUCTURE] and [FOCUS QUESTION])
  const forbiddenPatterns: Array<{ label: string; regex: RegExp }> = [
    { label: 'probab', regex: /probab/i },
    { label: 'outcome-%', regex: /\b\d+(?:\.\d+)?%\s*(?:chance|likely|likelihood|odds|confidence|success)\b/i },
    { label: 'Auspicious', regex: /\bAuspicious\b/i },
    { label: 'Dusthana Placement', regex: /Dusthana Placement/i },
    { label: 'Standard Placement', regex: /Standard Placement/i },
    { label: 'Moderate Baseline', regex: /Moderate Baseline/i },
    { label: 'releases', regex: /\breleases\b/i },
    { label: 'elevation', regex: /\belevation\b/i },
    { label: 'JSON', regex: /\bJSON\b/ },
    { label: 'Task:', regex: /\bTask:/i },
    { label: 'Query:', regex: /\bQuery:/i },
    { label: 'Role:', regex: /\bRole:/i },
    { label: 'CANDIDATE TRIGGERS', regex: /CANDIDATE[\s_]+TRIGGERS/ },
    { label: 'Overall Delivery', regex: /Overall Delivery/i },
    { label: 'Seat:', regex: /\bSeat:/i },
    { label: 'Themes:', regex: /\bThemes:/i },
    { label: 'PeakGate', regex: /\bPeakGate\b/i }
  ];
  for (const fp of forbiddenPatterns) {
    if (fp.regex.test(factualDataOnlyPrompt)) {
      errors.push(`Forbidden token found in factual prompt data: ${fp.label}`);
    }
  }

  // 3. Static block immutability check (no months or 4-digit years inside static block)
  for (const mName of MONTH_NAMES) {
    if (new RegExp(`\\b${mName}\\b`, 'i').test(staticBlock)) {
      errors.push(`Month name "${mName}" leaked into STATIC BLOCK`);
    }
  }
  if (/\b(?:19|20)\d{2}\b/.test(staticBlock)) {
    errors.push(`Year/timestamp leaked into STATIC BLOCK`);
  }

  // Helper to split sections cleanly
  const sectionBody = (tag: string): string => {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`${escaped}\\n([\\s\\S]*?)(?=\\n\\[(?:RULES|CONVENTIONS|LORDSHIPS|HOUSE LORDS|D1|D9|SHADBALA|SAV|BAV|PINDAS|YOGAS|DOSHAS|JAIMINI|KARAKAS|PERIOD|PERSON|DASHA|SLOW PLANETS|DOUBLE TRANSIT|FAST PLANETS|EVENTS|HOUSE MAP|LUNAR|AD CHAMBER\\/GATES|TRIGGER WINDOWS|SUB-PROMPT:[^\\]]+|DOMAIN STRENGTHS|VARGA [^\\]]+|OUTPUT STRUCTURE|FOCUS QUESTION)\\]|$)`);
    const m = fullPrompt.match(re);
    return m ? m[1] : '';
  };

  // Ensure D1 tables ([HOUSE LORDS], [D1], [SAV], [BAV]) never use H# (use L# exclusively)
  for (const d1Sec of ['[HOUSE LORDS]', '[D1]', '[SAV]', '[BAV]']) {
    const body = sectionBody(d1Sec);
    if (/\bH(?:1[0-2]|[1-9])\b/.test(body)) {
      errors.push(`Found ambiguous H# notation inside D1 section ${d1Sec} (must use L#/M# strictly)`);
    }
  }

  // 4. Duplicate line check across each section
  for (const sec of requiredSections) {
    if (sec === '[RULES]' || sec === '[CONVENTIONS]') continue;
    const body = sectionBody(sec);
    const lines = body.split('\n').map(l => l.trim()).filter(Boolean);
    const seen = new Set<string>();
    for (const line of lines) {
      if (seen.has(line)) {
        errors.push(`Duplicate line in ${sec}: "${line}"`);
      }
      seen.add(line);
    }
  }

  // 5. D9 Node Flag check + Rahu/Ketu strict 180-degree opposition check
  const d9Lines = sectionBody('[D9]').split('\n').filter(Boolean);
  let d9RahuSign = '';
  let d9KetuSign = '';
  for (const line of d9Lines) {
    if (/^(Rahu|Ketu)\b/i.test(line) && /(Exalted|Debilitated)/i.test(line)) {
      errors.push(`D9 Node flag violation (invented Exalted/Debilitated): "${line}"`);
    }
    const rm = line.match(/^Rahu\s*\|\s*([A-Za-z]+)\s*\|/);
    if (rm) d9RahuSign = rm[1];
    const km = line.match(/^Ketu\s*\|\s*([A-Za-z]+)\s*\|/);
    if (km) d9KetuSign = km[1];
  }
  if (d9RahuSign && d9KetuSign) {
    const rIdx = getCleanSignIndex(d9RahuSign);
    const kIdx = getCleanSignIndex(d9KetuSign);
    if (rIdx && kIdx && ((rIdx - kIdx + 12) % 12) !== 6) {
      errors.push(`[D9] Rahu (${d9RahuSign}) and Ketu (${d9KetuSign}) are NOT opposite (must be 6 signs / 180 deg apart)`);
    }
  }

  // 5b. SAV sum === 337 check & [FAST PLANETS] Moon removal check
  const savBody = sectionBody('[SAV]');
  const savNums = Array.from(savBody.matchAll(/L\d+:(\d+)/g)).map(m => parseInt(m[1], 10));
  if (savNums.length === 12) {
    const sum = savNums.reduce((a, b) => a + b, 0);
    if (sum !== 337) {
      errors.push(`[SAV] sum is ${sum}, must equal exact Parashara 337 bindus`);
    }
  }
  const fastBody = sectionBody('[FAST PLANETS]');
  if (/^Moon(?:\s*\(| \|)/m.test(fastBody)) {
    errors.push(`[FAST PLANETS] contains redundant Moon line (owned by [LUNAR])`);
  }

  // 6. Dasha checks (MD/AD/PD + SD dates present, no combined dignity label like "Swakshetra/Neecha")
  const dashaBody = sectionBody('[DASHA]');
  const dashaLines = dashaBody.split('\n').filter(Boolean);
  const { mdStart, mdEnd, adStart, adEnd } = resolveMdAdDatesFromFallbackTable(context);
  if (!dashaBody.includes(`${mdStart}..${mdEnd}`)) {
    errors.push(`Missing MD date range ${mdStart}..${mdEnd} in [DASHA]`);
  }
  if (!dashaBody.includes(`${adStart}..${adEnd}`)) {
    errors.push(`Missing AD date range ${adStart}..${adEnd} in [DASHA]`);
  }
  if (!dashaBody.includes(`${context.activeDasha.startDate}..${context.activeDasha.endDate}`)) {
    errors.push(`Missing PD date range ${context.activeDasha.startDate}..${context.activeDasha.endDate} in [DASHA]`);
  }
  if (!/^SD\b/m.test(dashaBody)) {
    errors.push(`Missing Sookshma Dasha (SD) line in [DASHA]`);
  }
  for (const dl of dashaLines) {
    if (/(Swakshetra|Uchha|Neecha)\/(Swakshetra|Uchha|Neecha)/i.test(dl)) {
      errors.push(`Combined dignity slash found in [DASHA]: "${dl}"`);
    }
  }

  // 7. AD Chamber label checks
  const adBody = sectionBody('[AD CHAMBER/GATES]');
  const adHeaderLine = adBody.split('\n')[0] || '';
  if (context.eventManufacturingSuperset) {
    if (!/ADCHAMBER:\s*natal\s+/i.test(adHeaderLine)) {
      errors.push(`ADCHAMBER must label natal position as "natal <Planet>@...": "${adHeaderLine}"`);
    }
    const ruledSegment = adHeaderLine.split('Ruled:')[1] || '';
    if (/\bN:/i.test(ruledSegment)) {
      errors.push(`ADCHAMBER Ruled houses must use "T:" for transits, not "N:": "${ruledSegment}"`);
    }
  }

  // 8. Every Nakshatra Tara check across [SLOW PLANETS], [FAST PLANETS], and [LUNAR]
  const sortedNaks = [...NAKSHATRAS].sort((a, b) => b.length - a.length).map(n => n.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|');
  const nakTaraRegex = new RegExp(`(${sortedNaks})\\s+(?:P[1-4](?:-P[1-4])?(?:\\s+(?:\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}Z)?\\.\\.\\d{4}-\\d{2}-\\d{2}(?:T\\d{2}:\\d{2}Z)?|\\d{4}-\\d{2}-\\d{2}))?(?:/P[1-4]\\s+(?:\\d{4}-\\d{2}-\\d{2}(?:\\.\\.\\d{4}-\\d{2}-\\d{2})?))*)\\s*\\(([A-Za-z ]+?)\\s+T(\\d)\\)`, 'g');

  for (const secTag of ['[SLOW PLANETS]', '[FAST PLANETS]', '[LUNAR]']) {
    const secText = sectionBody(secTag);
    const lines = secText.split('\n').filter(Boolean);
    for (const line of lines) {
      let m: RegExpExecArray | null;
      nakTaraRegex.lastIndex = 0;
      while ((m = nakTaraRegex.exec(line)) !== null) {
        const foundNak = m[1];
        const foundTaraName = m[2].trim();
        const foundTaraNum = parseInt(m[3], 10);
        const expected = computeExactTaraShort(janmaStarName, foundNak);
        if (foundTaraNum !== expected.num || foundTaraName !== expected.name) {
          errors.push(`Tara mismatch in ${secTag} for "${foundNak}": got "${foundTaraName} T${foundTaraNum}", expected "${expected.name} T${expected.num}" (line: "${line}")`);
        }
      }
    }
  }

  // 9. [LUNAR] continuous nakshatra sequence (no skipped stars!), Sit + 7thAsp opposition, CB:Fav/-, CHANDRASHTAMA
  const lunarLines = sectionBody('[LUNAR]').split('\n').filter(Boolean);
  if (lunarLines.length === 0) {
    errors.push('[LUNAR] has no day rows');
  }
  const lunarNakSequence: number[] = [];
  const isMoonOverridden = (context.allTransitPlacements || []).some(tp => tp.is_custom && cleanPlanet(tp.graha_key) === 'Moon');
  for (const lLine of lunarLines) {
    const sitMatch = lLine.match(/\|\s*Sit:\s*([A-Za-z]+)\s+L(\d+)\/M(\d+)\s+SAV\d+\s*\|/);
    const aspMatch = lLine.match(/\|\s*7thAsp:\s*([A-Za-z]+)\s+L(\d+)\/M(\d+)\s+SAV\d+\s*\|/);
    if (!sitMatch || !aspMatch) {
      errors.push(`Unrecognized [LUNAR] Sit/7thAsp format: "${lLine}"`);
      continue;
    }
    const rSignIdx = getCleanSignIndex(sitMatch[1]);
    const rHouseL = parseInt(sitMatch[2], 10);
    const rHouseM = parseInt(sitMatch[3], 10);
    const expectedHouseL = ((rSignIdx - lagnaIdx + 12) % 12) + 1;
    const expectedHouseM = ((rSignIdx - moonIdx + 12) % 12) + 1;
    if (rHouseL !== expectedHouseL || rHouseM !== expectedHouseM) {
      errors.push(`[LUNAR] Sit L#/M# mismatch for ${sitMatch[1]}: got L${rHouseL}/M${rHouseM}, expected L${expectedHouseL}/M${expectedHouseM}`);
    }
    const aspSignIdx = getCleanSignIndex(aspMatch[1]);
    if (((aspSignIdx - rSignIdx + 12) % 12) !== 6) {
      errors.push(`[LUNAR] 7thAsp (${aspMatch[1]}) is not opposite Sit (${sitMatch[1]})`);
    }

    let nm: RegExpExecArray | null;
    nakTaraRegex.lastIndex = 0;
    while ((nm = nakTaraRegex.exec(lLine)) !== null) {
      const nIdx = NAKSHATRAS.indexOf(nm[1]);
      if (nIdx !== -1) lunarNakSequence.push(nIdx);
    }

    const expectedFav = calculateChandraBala(moonIdx, rSignIdx).isFavorable;
    const favTag = isCompact ? 'CB:Fav' : 'ChandraBala: Fav';
    const dashTag = isCompact ? 'CB:-' : 'ChandraBala: -';
    const hasFav = lLine.includes(favTag);
    const hasDash = lLine.includes(dashTag);
    if (expectedFav && !hasFav) {
      errors.push(`[LUNAR] missing "${favTag}" for M${rHouseM} in "${lLine}"`);
    }
    if (!expectedFav && !hasDash) {
      errors.push(`[LUNAR] missing "${dashTag}" for M${rHouseM} in "${lLine}"`);
    }
    if (rHouseM === 8 && !lLine.includes('CHANDRASHTAMA')) {
      errors.push(`[LUNAR] M8 row missing CHANDRASHTAMA: "${lLine}"`);
    }
    if (rHouseM !== 8 && lLine.includes('CHANDRASHTAMA')) {
      errors.push(`[LUNAR] non-M8 row falsely flagged CHANDRASHTAMA: "${lLine}"`);
    }
  }
  if (!isMoonOverridden) {
    for (let i = 1; i < lunarNakSequence.length; i++) {
      const prevN = lunarNakSequence[i - 1];
      const currN = lunarNakSequence[i];
      if (currN !== prevN && currN !== (prevN + 1) % 27) {
        errors.push(`[LUNAR] skipped Nakshatra detected: ${NAKSHATRAS[prevN]} -> ${NAKSHATRAS[currN]}`);
      }
    }
  }

  // [HOUSE MAP] L#/M# house cross-check
  const hmLines = sectionBody('[HOUSE MAP]').split('\n').filter(Boolean);
  for (const hmLine of hmLines) {
    const hm = hmLine.match(/^L(\d+)\/M(\d+)\s+([A-Za-z]+)\s*\|/);
    if (!hm) continue;
    const hL = parseInt(hm[1], 10);
    const hM = parseInt(hm[2], 10);
    const sIdx = getCleanSignIndex(hm[3]);
    const expHL = ((sIdx - lagnaIdx + 12) % 12) + 1;
    const expHM = ((sIdx - moonIdx + 12) % 12) + 1;
    if (hL !== expHL || hM !== expHM) {
      errors.push(`[HOUSE MAP] house mismatch for ${hm[3]}: got L${hL}/M${hM}, expected L${expHL}/M${expHM}`);
    }
  }

  // 10. Source fact cross-check for Planets, L#/M# Houses, SAV, and Date bounds
  const savDistMap = new Map<number, number>();
  (context.ashtakavargaPayload?.savPointsDistribution || []).forEach(s => savDistMap.set(s.signIndex, s.points));

  const checkPlanetSection = (secTag: string) => {
    const lines = sectionBody(secTag).split('\n').filter(l => /^(Jupiter|Saturn|Rahu|Ketu|Sun|Mars|Mercury|Venus)(?:\s*\([^)]+\))?\s*\|/.test(l));
    for (const line of lines) {
      const parts = line.split('|').map(x => x.trim());
      if (parts.length < 6) {
        errors.push(`Malformed planet row in ${secTag}: "${line}"`);
        continue;
      }
      const pMatch = parts[0].match(/^([A-Za-z]+)/);
      if (!pMatch) continue;
      const gKey = pMatch[1];

      const locM = parts[1].match(/^([A-Za-z]+)\s+L(\d+)\/M(\d+)(?:\s+SAV(\d+))?$/);
      if (!locM) {
        errors.push(`Malformed sign/house/SAV field in ${secTag}: "${parts[1]}"`);
        continue;
      }
      const sIdx = getCleanSignIndex(locM[1]);
      const hL = parseInt(locM[2], 10);
      const hM = parseInt(locM[3], 10);
      const savVal = locM[4] ? parseInt(locM[4], 10) : undefined;

      const expHL = ((sIdx - lagnaIdx + 12) % 12) + 1;
      const expHM = ((sIdx - moonIdx + 12) % 12) + 1;
      if (hL !== expHL || hM !== expHM) {
        errors.push(`House mismatch on ${gKey} in ${locM[1]}: got L${hL}/M${hM}, expected L${expHL}/M${expHM}`);
      }
      const expSav = savDistMap.get(sIdx);
      if (expSav !== undefined && savVal !== expSav) {
        errors.push(`SAV mismatch on ${gKey} in ${locM[1]}: got ${savVal}, expected ${expSav}`);
      }
    }
  };

  checkPlanetSection('[SLOW PLANETS]');
  checkPlanetSection('[FAST PLANETS]');

  // 11. Chronological order + Date bounds check inside [EVENTS] and [TRIGGER WINDOWS]
  const checkChronologicalAndBounds = (secTag: string, allowIstNextMonthDay = false) => {
    const lines = sectionBody(secTag).split('\n').filter(Boolean);
    let prevStart = '';
    for (const evLine of lines) {
      if (evLine === 'None') continue;
      // Only check UTC dates (before "[IST") against strict UTC bounds; IST dates may naturally cross 1 day into next month on last day evening
      const utcPart = evLine.replace(/\[IST\s+\d{4}-\d{2}-\d{2}(?:\.\.\d{4}-\d{2}-\d{2})?\]/g, '');
      const fullDates = utcPart.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
      for (const fd of fullDates) {
        if (fd < priorStartIso || fd > monthEndIso) {
          errors.push(`UTC Date ${fd} outside allowed [${priorStartIso}..${monthEndIso}] window in ${secTag}: "${evLine}"`);
        }
      }
      const firstTsMatch = evLine.match(/\b(\d{4}-\d{2}-\d{2}(?:T\d{2}:\d{2}Z)?)/);
      if (firstTsMatch) {
        const curKey = firstTsMatch[1];
        if (prevStart && curKey < prevStart) {
          errors.push(`Non-chronological order in ${secTag}: "${curKey}" appears after "${prevStart}"`);
        }
        prevStart = curKey;
      }
      void allowIstNextMonthDay;
    }
  };
  checkChronologicalAndBounds('[EVENTS]');
  checkChronologicalAndBounds('[TRIGGER WINDOWS]', true);

  if (!sectionBody('[PERIOD]').includes(`${monthStartIso}..${monthEndIso}`)) {
    errors.push(`[PERIOD] missing exact month range ${monthStartIso}..${monthEndIso}`);
  }

  return { valid: errors.length === 0, errors };
}
