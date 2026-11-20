import originalSourceRulesRaw from './originalSourceRules.txt?raw';
import originalSourceRulesBaselineRaw from './originalSourceRulesBaseline.txt?raw';
import { OriginalSourceDomain, VedicHouseContext } from './types';
import { getGrahaTransitPosition, GrahaTransitPosition, NAKSHATRAS } from '../../data/transitEphemeris';
import { calculateTaraBala, calculateChandraBala, computeSarvashtakavarga } from '../../data/parasharaCalculations';
import { getFullVimshottariTimeline } from '../../data/dashaCalculator';
import { apply001MEEnrichments, DOMAIN_PROMPT_SPECS, VargaChartDef } from '../../data/vargaAndStrengthData';
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

function shortDate(isoDate: string): string {
  const m = isoDate.match(/^\d{4}-(\d{2}-\d{2})$/);
  return m ? m[1] : isoDate;
}

function formatDayRangesCompact(days: number[]): string {
  if (days.length === 0) return '';
  const sorted = Array.from(new Set(days)).sort((a, b) => a - b);
  const ranges: string[] = [];
  let start = sorted[0];
  let end = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    if (sorted[i] === end + 1) {
      end = sorted[i];
    } else {
      ranges.push(start === end ? `d${start}` : `d${start}-${end}`);
      start = sorted[i];
      end = sorted[i];
    }
  }
  ranges.push(start === end ? `d${start}` : `d${start}-${end}`);
  return ranges.join(',');
}

function formatContinuousRanges(items: Array<{ day: number; label: string }>): string {
  if (items.length === 0) return '';
  const groups: Array<{ label: string; start: number; end: number }> = [];
  for (const it of items) {
    const last = groups[groups.length - 1];
    if (last && last.label === it.label && it.day === last.end + 1) {
      last.end = it.day;
    } else {
      groups.push({ label: it.label, start: it.day, end: it.day });
    }
  }
  return groups
    .map(g => `${g.label} ${g.start === g.end ? `d${g.start}` : `d${g.start}-${g.end}`}`)
    .join(',');
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
    // Capture Lagna / Moon frame explicitly before stripping verbose parenthesis
    const hasLagna = /Lagna|H\d+\s+Lagna|from Lagna/i.test(rawReason);
    const hasMoon = /Moon|H\d+\s+Moon|from Moon/i.test(rawReason);
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
      tag = m ? `tr-exalt-lord ${m[1]}` : 'tr-exalt-lord';
      isKendra = true;
    } else if (low.includes('natal') && low.includes('exalted in') && low.includes('kendra')) {
      const m = r.match(/Natal\s+([A-Za-z]+)/i);
      tag = m ? `natal-exalt-lord ${m[1]}` : 'natal-exalt-lord';
      isKendra = true;
    } else if (low.includes('exaltation sign') && low.includes('kendra')) {
      const m = r.match(/\(([A-Za-z]+)\)/);
      tag = m ? `exalt-lord ${m[1]}` : 'exalt-lord';
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
    const fTag = fr.hasLagna && fr.hasMoon ? 'L/M' : fr.hasMoon ? 'Moon' : fr.hasLagna ? 'Lagna' : '';
    kendraItems.push(`${tag}${fTag ? `[${fTag}]` : ''}`);
  }
  const parts: string[] = [];
  if (kendraItems.length > 0) {
    const fLabel = kendraFrames.size === 2 ? 'Lagna/Moon' : (Array.from(kendraFrames)[0] || 'Lagna/Moon');
    parts.push(`Kendra[${fLabel}](${kendraItems.join(',')})`);
  }
  if (otherItems.length > 0) parts.push(...otherItems);
  return parts.length > 0 ? parts.join(',') : 'none';
}

function compactYearDate(isoDate: string, year: number): string {
  const prefix = `${year}-`;
  return isoDate.startsWith(prefix) ? isoDate.slice(prefix.length) : isoDate;
}

function compactGateWindowText(raw: string): string {
  return raw
    .replace(/–/g, '-')
    .replace(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+/g, 'd')
    .replace(/\s*\+\s*Natal Seat/gi, ',natal')
    .replace(/\s*,\s*/g, ',')
    .trim();
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

interface DailyPlanetRecord {
  day: number;
  dateStr: string;
  signIdx: number;
  signName: string;
  hLagna: number;
  hMoon: number;
  degStr: string;
  siderealLon: number;
  nakshatra: string;
  pada: number;
  isRetro: boolean;
  motionTag: 'ADISARA' | 'VAKRA' | 'DIRECT';
  isCombust: boolean;
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
 * - 4 Domain Sub-Prompts (`career`, `finance`, `love`, `family`): Attaches domain-specific Divisional Charts (Vargas), minimal Frontier rules, 4-section Output Structure + Option B Readout, and trailing [FOCUS QUESTION] for KV cache reuse
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
  // Spaces enabled in both variants for LLM readability as requested
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
  // STATIC BLOCK (byte-identical across months/sessions for the same chart)
  // =========================================================================
  const rulesText = (isCompact ? originalSourceRulesRaw : originalSourceRulesBaselineRaw).trim();

  // S2 [LORDSHIPS] & S2B [HOUSE LORDS]
  const lordshipEntries = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'].map(p => {
    const signs = OWNED_SIGN_INDICES[p] || [];
    const lHouses = signs.map(s => `L${((s - lagnaIdx + 12) % 12) + 1}`).join(listSep);
    const mHouses = signs.map(s => `M${((s - moonIdx + 12) % 12) + 1}`).join(listSep);
    return isCompact ? `${p}:${lHouses}(${mHouses})` : `${p}: ${lHouses} (${mHouses})`;
  });

  // S3 [D1] — precompute D1 natal coordinates, combustion, conjunctions, and Parashara aspects
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
        const hNum = p.house_number || (sIdx ? ((sIdx - lagnaIdx + 12) % 12) + 1 : '?');
        const deg = cleanDegree(p.degree_sputa) || '-';
        const star = cleanStar(p.nakshatra_name, p.pada) || '-';
        const meta = d1PlanetMetaMap.get(pName);
        const flags: string[] = [];
        if (p.is_retrograde) flags.push('R');
        if (meta?.dignity) flags.push(meta.dignity);
        if (meta?.combustGapStr) flags.push(isCompact ? `Comb(${meta.combustGapStr})` : `Combust(${meta.combustGapStr})`);
        if (meta && meta.conjunctWith.length > 0) flags.push(`Conj:${meta.conjunctWith.join(',')}`);
        if (meta && meta.aspects.length > 0) flags.push(`Asp:${meta.aspects.join(',')}`);
        return `${pName}${sep}${sName}${sep}H${hNum}${sep}${deg}${sep}${star}${flags.length > 0 ? `${sep}${flags.join(listSep)}` : ''}`;
      })
    : ['D1 placements not provided'];

  // [HOUSE LORDS] — explicit H1..H12 lord placement lookup table
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
      houseLordEntries.push(isCompact ? `L${h}:${lord}@H${lm.hL}${fTag}` : `L${h}:${lord}@H${lm.hL}(M${lm.hM})${fTag}`);
    } else {
      houseLordEntries.push(`L${h}:${lord}`);
    }
  }
  const houseLordsBlock = isCompact
    ? houseLordEntries.join('|')
    : `${houseLordEntries.slice(0, 6).join(' | ')}\n${houseLordEntries.slice(6).join(' | ')}`;

  // S4 [D9] — strictly derived & verified (7 classical planets + Vargottama + R; Rahu/Ketu always 180 deg opposite)
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

  // Ensure D9 Rahu & Ketu are mathematically opposite when D1 coordinates exist
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

  // S6 [SAV], [BAV] (All 7 planets + Lagna As), and [PINDAS]
  const bphsReport = computeSarvashtakavarga(lagnaIdx, undefined, context.flattenedNatalD1);
  const savDist = (context.ashtakavargaPayload?.savPointsDistribution && context.ashtakavargaPayload.savTotalSum === 337)
    ? context.ashtakavargaPayload.savPointsDistribution
    : bphsReport.allHousesOverview;
  const savTotalSum = savDist.reduce((acc, s) => acc + s.points, 0);
  const sortedSav = [...savDist].sort((a, b) => a.houseNumber - b.houseNumber);
  const maxSavPts = sortedSav.length > 0 ? Math.max(...sortedSav.map(s => s.points)) : 0;
  const minSavPts = sortedSav.length > 0 ? Math.min(...sortedSav.map(s => s.points)) : 0;
  const maxSavHouses = sortedSav.filter(s => s.points === maxSavPts).map(s => `H${s.houseNumber}`).join(',');
  const minSavHouses = sortedSav.filter(s => s.points === minSavPts).map(s => `H${s.houseNumber}`).join(',');
  const savLine = sortedSav.length > 0
    ? `${sortedSav.map(s => `H${s.houseNumber}:${s.points}`).join(listSep)} | Sum:${savTotalSum} | Avg:${(savTotalSum / 12).toFixed(1)} | Max:${maxSavHouses}(${maxSavPts}) | Min:${minSavHouses}(${minSavPts})`
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
      houseEntries.push(`H${h}:${pts}`);
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

  // [JAIMINI] — Deterministic 7-Karaka Scheme, Karakamsa, AL, UL (A12), and Key Arudhas
  const jaiminiLine = (() => {
    const sevenPlanets = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
    const karakaRanks = ['AK', 'AmK', 'BK', 'MK', 'PK', 'GK', 'DK'];
    const ranked = sevenPlanets
      .map(p => {
        const m = d1PlanetMetaMap.get(p);
        return m && m.degFloat !== null
          ? { planet: p, degFloat: m.degFloat, degStr: m.degStr, hL: m.hL, signIdx: m.signIdx, signName: m.signName }
          : null;
      })
      .filter((x): x is NonNullable<typeof x> => x !== null)
      .sort((a, b) => b.degFloat - a.degFloat);

    if (ranked.length < 7) return 'Jaimini not provided';

    const karakaLine = isCompact
      ? `Scheme: 7-Karaka | ${ranked.map((r, i) => `${karakaRanks[i]}: ${r.planet} (${r.degStr} H${r.hL})`).join(' | ')}`
      : `Scheme: 7-Karaka (Sun..Saturn by D1 deg) | ${ranked.map((r, i) => `${karakaRanks[i]}: ${r.planet} (${r.degStr}, H${r.hL} ${r.signName})`).join(' | ')}`;

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

  // [KARAKAS]
  const karakaItems = [
    'Career: H10, Sun, Mercury, Mars',
    'Wealth: H2, H11, Jupiter',
    'Home: H4, Moon',
    'Love/Progeny: H5, H7, Venus',
    'Health: H1, H6, Saturn'
  ];

  const lordshipHeader = isCompact
    ? `Lagna: ${lagna} | JanmaRashi: ${moon} | JanmaStar: ${janmaStarName} P${janmaPada}\n${lordshipEntries.join(' | ')}`
    : `Lagna: ${lagna} | JanmaRashi: ${moon} | JanmaStar: ${janmaStarName} P${janmaPada}\n${lordshipEntries.join('\n')}`;

  const karakaBlock = isCompact ? karakaItems.join(' | ') : karakaItems.join('\n');

  const staticBlock = [
    `[RULES]\n${rulesText}`,
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
  // MONTH SLICE (rebuilt per month)
  // =========================================================================
  const year = context.selectedYear;
  const monthIdx = context.selectedMonth;
  const monthName = MONTH_NAMES[monthIdx] || 'Month';
  const mNumStr = String(monthIdx + 1).padStart(2, '0');
  const daysInMonth = new Date(year, monthIdx + 1, 0).getDate();
  const rangeStr = `${year}-${mNumStr}-01..${year}-${mNumStr}-${String(daysInMonth).padStart(2, '0')}`;

  const day1Utc = new Date(Date.UTC(year, monthIdx, 1, 12, 0, 0));
  const DAY_MS = 24 * 60 * 60 * 1000;
  const priorDates = [-3, -2, -1].map(off => new Date(day1Utc.getTime() + off * DAY_MS));
  const priorRangeStr = `${priorDates[0].toISOString().slice(5, 10)}..${priorDates[2].toISOString().slice(5, 10)}`;

  // C1 [PERIOD] — includes TZ & daily snapshot time explicitly
  const c1Period = isCompact
    ? `[PERIOD]\n${monthName} ${year}|${rangeStr}|TZ:UTC(IST=+05:30)|Snap:12:00 UTC|Prior3d:${priorRangeStr}`
    : `[PERIOD]\n${monthName} ${year} | ${rangeStr} | TZ: UTC (IST=+05:30) | Daily Snapshot: 12:00 UTC | Prior-3-Day Boundary: ${priorRangeStr}`;

  // Build daily ephemeris records for all 9 planets across days 1..daysInMonth (respecting custom overrides)
  type TransitPlacementItem = NonNullable<VedicHouseContext['allTransitPlacements']>[number];
  const customOverrideMap = new Map<string, TransitPlacementItem>();
  (context.allTransitPlacements || []).forEach(tp => {
    if (tp.is_custom) {
      customOverrideMap.set(cleanPlanet(tp.graha_key), tp);
    }
  });

  const allGrahas = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn', 'Rahu', 'Ketu'];
  const sunLonByDay = new Map<number, number>();
  const rawDailyByGraha = new Map<string, DailyPlanetRecord[]>();

  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(Date.UTC(year, monthIdx, d, 12, 0, 0));
    const customSun = customOverrideMap.get('Sun');
    if (customSun) {
      const sLon = (customSun.transit_rashi_index - 1) * 30 + (customSun.degree_in_sign_float ?? 15);
      sunLonByDay.set(d, sLon);
    } else {
      const sunPos = getGrahaTransitPosition('Sun', dt, lagnaIdx, moonIdx);
      sunLonByDay.set(d, sunPos.sidereal_longitude);
    }
  }

  for (const g of allGrahas) {
    const list: DailyPlanetRecord[] = [];
    const customTp = customOverrideMap.get(g);
    for (let d = 1; d <= daysInMonth; d++) {
      const dt = new Date(Date.UTC(year, monthIdx, d, 12, 0, 0));
      const dateStr = dt.toISOString().slice(0, 10);
      if (customTp) {
        const sIdx = customTp.transit_rashi_index;
        const sLon = (sIdx - 1) * 30 + (customTp.degree_in_sign_float ?? 15);
        const sunLon = sunLonByDay.get(d) ?? sLon;
        const mTag: 'ADISARA' | 'VAKRA' | 'DIRECT' =
          customTp.motion_type === 'Adisara' ? 'ADISARA' : customTp.is_retrograde ? 'VAKRA' : 'DIRECT';
        list.push({
          day: d,
          dateStr,
          signIdx: sIdx,
          signName: SIGN_LIST_EN[sIdx - 1] || cleanSign(customTp.transit_rashi_name),
          hLagna: ((sIdx - lagnaIdx + 12) % 12) + 1,
          hMoon: ((sIdx - moonIdx + 12) % 12) + 1,
          degStr: cleanDegree(customTp.degree_sputa) || '15°00\'',
          siderealLon: sLon,
          nakshatra: cleanStar(customTp.nakshatra_name),
          pada: customTp.pada || 1,
          isRetro: !!customTp.is_retrograde,
          motionTag: mTag,
          isCombust: g !== 'Sun' && isCombustAgainstSun(g, sLon, sunLon, !!customTp.is_retrograde)
        });
      } else {
        const pos: GrahaTransitPosition = getGrahaTransitPosition(g, dt, lagnaIdx, moonIdx);
        const sunLon = sunLonByDay.get(d) ?? pos.sidereal_longitude;
        const mTag: 'ADISARA' | 'VAKRA' | 'DIRECT' =
          pos.motion_type === 'Adisara' ? 'ADISARA' : pos.is_retrograde ? 'VAKRA' : 'DIRECT';
        list.push({
          day: d,
          dateStr,
          signIdx: pos.transit_rashi_index,
          signName: SIGN_LIST_EN[pos.transit_rashi_index - 1] || cleanSign(pos.transit_rashi_name),
          hLagna: pos.relative_to_natal_lagna.house_number,
          hMoon: pos.relative_to_natal_rashi.house_number,
          degStr: cleanDegree(pos.degree_sputa),
          siderealLon: pos.sidereal_longitude,
          nakshatra: cleanStar(pos.graha_pada_chara.nakshatra_name),
          pada: pos.graha_pada_chara.pada,
          isRetro: pos.is_retrograde,
          motionTag: mTag,
          isCombust: g !== 'Sun' && isCombustAgainstSun(g, pos.sidereal_longitude, sunLon, pos.is_retrograde)
        });
      }
    }
    rawDailyByGraha.set(g, list);
  }

  // Format planet lines per sign segment, tagging EXACT Tara per Nakshatra-Pada sub-span!
  const formatPlanetLines = (gKey: string): string[] => {
    const daily = rawDailyByGraha.get(gKey) || [];
    if (daily.length === 0) return [];

    const signSegments: DailyPlanetRecord[][] = [];
    for (const rec of daily) {
      const lastSeg = signSegments[signSegments.length - 1];
      if (!lastSeg || lastSeg[0].signIdx !== rec.signIdx) {
        signSegments.push([rec]);
      } else {
        lastSeg.push(rec);
      }
    }

    const isMultiSign = signSegments.length > 1;

    return signSegments.map(seg => {
      const first = seg[0];
      const last = seg[seg.length - 1];
      const sIdx = first.signIdx;
      const sName = first.signName;
      const coord = `L${first.hLagna}/M${first.hMoon}`;
      const sav = savBySignIdx.get(sIdx);
      const savStr = sav ? ` SAV${sav}` : '';

      const motionStr = formatContinuousRanges(
        seg.map(r => ({ day: r.day, label: r.motionTag }))
      );

      // Data-computed solar combustion date range
      const combustDays = seg.filter(r => r.isCombust).map(r => r.day);
      const combustStr = combustDays.length > 0 ? `Combust ${formatDayRangesCompact(combustDays)}` : '';
      const motionAndCombust = [motionStr, combustStr].filter(Boolean).join(listSep);

      // Compute true sign-degree range including stationary turning extremum if planet reverses inside the sign
      let degSpan = first.degStr === last.degStr ? first.degStr : `${first.degStr}..${last.degStr}`;
      const hasStationTurn = seg.some(r => r.isRetro) && seg.some(r => !r.isRetro);
      if (hasStationTurn && !customOverrideMap.has(gKey)) {
        const scanStartMs = Date.UTC(year, monthIdx, first.day, 0, 0, 0);
        const scanEndMs = Date.UTC(year, monthIdx, last.day, 23, 59, 0);
        let minDeg = Infinity;
        let maxDeg = -Infinity;
        for (let ms = scanStartMs; ms <= scanEndMs; ms += 3600 * 1000) {
          const p = getGrahaTransitPosition(gKey, new Date(ms), lagnaIdx, moonIdx);
          if (p.transit_rashi_index !== sIdx) continue;
          const dSign = p.degree_in_sign_float;
          if (dSign < minDeg) minDeg = dSign;
          if (dSign > maxDeg) maxDeg = dSign;
        }
        if (minDeg <= maxDeg) {
          const minStr = formatDegreeFromFloat(minDeg);
          const maxStr = formatDegreeFromFloat(maxDeg);
          degSpan = `${first.degStr}..${last.degStr} (min ${minStr},max ${maxStr})`;
        }
      }

      // Group consecutive days by nakshatra + pada
      const nakGroups: Array<{ nak: string; pada: number; start: number; end: number }> = [];
      for (const r of seg) {
        const lastG = nakGroups[nakGroups.length - 1];
        if (lastG && lastG.nak === r.nakshatra && lastG.pada === r.pada && r.day === lastG.end + 1) {
          lastG.end = r.day;
        } else {
          nakGroups.push({ nak: r.nakshatra, pada: r.pada, start: r.day, end: r.day });
        }
      }

      let nakWithTaraStr: string;
      if (isCompact) {
        const starRuns: Array<{ nak: string; padas: Array<{ pada: number; start: number; end: number }> }> = [];
        for (const ng of nakGroups) {
          const lastRun = starRuns[starRuns.length - 1];
          if (lastRun && lastRun.nak === ng.nak) {
            lastRun.padas.push({ pada: ng.pada, start: ng.start, end: ng.end });
          } else {
            starRuns.push({ nak: ng.nak, padas: [{ pada: ng.pada, start: ng.start, end: ng.end }] });
          }
        }
        nakWithTaraStr = starRuns
          .map(sr => {
            const padaList = sr.padas
              .map(p => `P${p.pada} ${p.start === p.end ? `d${p.start}` : `d${p.start}-${p.end}`}`)
              .join('/');
            const tara = computeExactTaraShort(janmaStarName, sr.nak);
            return `${sr.nak} ${padaList}(${tara.tag})`;
          })
          .join(',');
      } else {
        nakWithTaraStr = nakGroups
          .map(ng => {
            const dr = ng.start === ng.end ? `d${ng.start}` : `d${ng.start}-${ng.end}`;
            const tara = computeExactTaraShort(janmaStarName, ng.nak);
            return `${ng.nak} P${ng.pada} ${dr} (${tara.tag})`;
          })
          .join(', ');
      }

      const aspEntries = getParasharaAspectEntries(gKey, sIdx, lagnaIdx, moonIdx);
      const aspStr = aspEntries
        .map(e => `${e.label} ${signAbbr(e.targetSign)} L${e.hLagna}/M${e.hMoon}`)
        .join(listSep);

      const segPrefix = isMultiSign
        ? (isCompact
            ? `${gKey}(${first.day === last.day ? `d${first.day}` : `d${first.day}-${last.day}`})`
            : `${gKey} (${first.day === last.day ? `d${first.day}` : `d${first.day}-${last.day}`})`)
        : gKey;

      const aspPrefix = isCompact ? 'asp:' : 'Asp: ';
      return `${segPrefix}${sep}${sName} ${coord}${savStr}${sep}${motionAndCombust}${sep}${degSpan}${sep}${nakWithTaraStr}${sep}${aspPrefix}${aspStr}`;
    });
  };

  // C2 [DASHA] — MD/AD/PD start..end dates, natal house, transit per-segment dignity (never combined), Vakra, Combust
  const { mdStart, mdEnd, adStart, adEnd } = resolveMdAdDatesFromFallbackTable(context);
  const pdStart = context.activeDasha.startDate;
  const pdEnd = context.activeDasha.endDate;

  const formatDashaLordLine = (roleLabel: string, lordNameRaw: string, winStart: string, winEnd: string): string => {
    const lord = cleanPlanet(lordNameRaw);
    const natalRow = (context.flattenedNatalD1 || []).find(p => cleanPlanet(p.body_name) === lord);
    const natalSign = natalRow ? cleanSign(natalRow.rashi_name) : '';
    const natalSignIdx = getCleanSignIndex(natalSign);
    const natalH = natalRow?.house_number || (natalSignIdx ? ((natalSignIdx - lagnaIdx + 12) % 12) + 1 : undefined);
    const natalPart = natalH
      ? (isCompact
          ? `natal H${natalH}${natalSign ? `(${natalSign})` : ''}${natalRow?.is_retrograde ? 'R' : ''}`
          : `natal H${natalH}${natalSign ? ` (${natalSign})` : ''}${natalRow?.is_retrograde ? ' (R)' : ''}`)
      : 'natal not provided';

    const daily = rawDailyByGraha.get(lord) || [];
    if (daily.length === 0) {
      return `${roleLabel} ${lord} ${winStart}..${winEnd}${sep}${natalPart}${sep}transit not provided`;
    }

    const signSpans: Array<{ signName: string; signIdx: number; hL: number; hM: number; start: number; end: number }> = [];
    for (const rec of daily) {
      const last = signSpans[signSpans.length - 1];
      if (!last || last.signIdx !== rec.signIdx) {
        signSpans.push({ signName: rec.signName, signIdx: rec.signIdx, hL: rec.hLagna, hM: rec.hMoon, start: rec.day, end: rec.day });
      } else {
        last.end = rec.day;
      }
    }

    // Per-segment transit + dignity (never combined across different signs)
    const segJoiner = isCompact ? ';' : '; ';
    const transitPart = signSpans.length === 1
      ? (() => {
          const sp = signSpans[0];
          const dig = getDignityTag(lord, sp.signIdx);
          return `transit ${sp.signName} L${sp.hL}/M${sp.hM}${dig ? (isCompact ? `(${dig})` : ` (${dig})`) : ''}`;
        })()
      : `transit ${signSpans.map(sp => {
          const dig = getDignityTag(lord, sp.signIdx);
          return `${sp.signName} L${sp.hL}/M${sp.hM}${dig ? (isCompact ? `(${dig})` : ` (${dig})`) : ''} d${sp.start}-${sp.end}`;
        }).join(segJoiner)}`;

    const flags: string[] = [];

    const retroDays = daily.filter(r => r.isRetro).map(r => r.day);
    if (retroDays.length === daily.length) {
      flags.push('Vakra');
    } else if (retroDays.length > 0) {
      flags.push(`Vakra ${formatDayRangesCompact(retroDays)}`);
    }

    const combustDays = daily.filter(r => r.isCombust).map(r => r.day);
    if (combustDays.length === daily.length) {
      flags.push('Combust');
    } else if (combustDays.length > 0) {
      flags.push(`Combust ${formatDayRangesCompact(combustDays)}`);
    }

    return `${roleLabel} ${lord} ${winStart}..${winEnd}${sep}${natalPart}${sep}${transitPart}${flags.length > 0 ? `${sep}${flags.join(sep)}` : ''}`;
  };

  const c2Dasha = [
    `[DASHA]`,
    formatDashaLordLine('MD', context.activeDasha.mahadasha, mdStart, mdEnd),
    formatDashaLordLine('AD', context.activeDasha.antardasha, adStart, adEnd),
    formatDashaLordLine('PD', context.activeDasha.pratyantardasha, pdStart, pdEnd)
  ].join('\n');

  // C3 [SLOW PLANETS]
  const priorBoundaryRows: string[] = [];
  for (const g of ['Jupiter', 'Saturn', 'Mars', 'Sun', 'Mercury', 'Venus']) {
    if (customOverrideMap.has(g)) continue;
    const pts = priorDates.map(dt => {
      const ds = shortDate(dt.toISOString().slice(0, 10));
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

  // C4 [DOUBLE TRANSIT]
  const jupDaily = rawDailyByGraha.get('Jupiter') || [];
  const satDaily = rawDailyByGraha.get('Saturn') || [];
  const getTouchesForSign = (planet: 'Jupiter' | 'Saturn', sIdx: number): Array<{ signIdx: number; rel: string }> => {
    const out: Array<{ signIdx: number; rel: string }> = [{ signIdx: sIdx, rel: 'Occ' }];
    for (const asp of getParasharaAspectEntries(planet, sIdx, lagnaIdx, moonIdx)) {
      out.push({ signIdx: asp.targetSignIdx, rel: asp.label });
    }
    return out;
  };
  const dtBySignDay = new Map<string, { signIdx: number; jRel: string; sRel: string; days: number[] }>();
  for (let d = 1; d <= daysInMonth; d++) {
    const jr = jupDaily.find(r => r.day === d);
    const sr = satDaily.find(r => r.day === d);
    if (!jr || !sr) continue;
    const jTouches = getTouchesForSign('Jupiter', jr.signIdx);
    const sTouches = getTouchesForSign('Saturn', sr.signIdx);
    for (const jt of jTouches) {
      const st = sTouches.find(x => x.signIdx === jt.signIdx);
      if (!st) continue;
      const key = `${jt.signIdx}|${jt.rel}|${st.rel}`;
      const existing = dtBySignDay.get(key);
      if (existing) {
        existing.days.push(d);
      } else {
        dtBySignDay.set(key, { signIdx: jt.signIdx, jRel: jt.rel, sRel: st.rel, days: [d] });
      }
    }
  }
  const dtFormatted: string[] = [];
  for (const entry of dtBySignDay.values()) {
    const sName = SIGN_LIST_EN[entry.signIdx - 1];
    const hL = ((entry.signIdx - lagnaIdx + 12) % 12) + 1;
    const hM = ((entry.signIdx - moonIdx + 12) % 12) + 1;
    const rangeStrDt = formatDayRangesCompact(entry.days);
    const dtJoin = isCompact ? '+' : ' + ';
    dtFormatted.push(`${sName} L${hL}/M${hM}${sep}${rangeStrDt}${sep}Jupiter ${entry.jRel}${dtJoin}Saturn ${entry.sRel}`);
  }
  const c4DoubleTransit = [
    `[DOUBLE TRANSIT]`,
    ...(dtFormatted.length > 0 ? dtFormatted : ['None'])
  ].join('\n');

  // C5 [FAST PLANETS] — Moon removed (redundant with full continuous [LUNAR])
  const fastLines = ['Sun', 'Mars', 'Mercury', 'Venus'].flatMap(formatPlanetLines);

  const c5FastPlanets = [
    `[FAST PLANETS]`,
    ...fastLines
  ].join('\n');

  // C6 [EVENTS]
  const vse = context.vedicSpecialEvents;
  const eventLines: string[] = [];
  if (vse) {
    if (vse.boundaryIngresses && vse.boundaryIngresses.length > 0) {
      for (const ing of vse.boundaryIngresses) {
        const g = cleanPlanet(ing.grahaKey);
        const fromS = cleanSign(ing.fromSignName);
        const toS = cleanSign(ing.toSignName);
        const tags: string[] = [];
        if (ing.isPriorMonthBoundary) tags.push('PRIOR');
        if (ing.motionType !== 'Normal') tags.push(ing.motionType.toUpperCase());
        const tagStr = tags.length > 0 ? `[${tags.join(listSep)}]` : '';
        const arrow = isCompact ? '->' : ' -> ';
        const dtStr = isCompact ? compactYearDate(ing.ingressDate, year) : ing.ingressDate;
        eventLines.push(`INGRESS ${g} ${fromS}${arrow}${toS} ${dtStr} L${ing.toHouseFromLagna}/M${ing.toHouseFromMoon}${tagStr ? ` ${tagStr}` : ''}`);
      }
    }
    if (vse.sameSignStations && vse.sameSignStations.length > 0) {
      for (const st of vse.sameSignStations) {
        const g = cleanPlanet(st.grahaKey);
        const turnShort = isCompact
          ? (st.turnType === 'Retrograde -> Direct' ? 'R->D' : 'D->R')
          : st.turnType;
        const beforeParts = st.beforeRange.split(' to ').map(x => shortDate(x.trim())).join('..');
        const afterParts = st.afterRange.split(' to ').map(x => shortDate(x.trim())).join('..');
        const label = isCompact ? 'STA' : 'STATION';
        const dtStr = isCompact ? compactYearDate(st.stationDate, year) : st.stationDate;
        const degTag = st.stationDegree
          ? ` @${st.stationDegree}${st.stationTimeUtc ? ` ${st.stationTimeUtc} UTC` : ''}`
          : '';
        eventLines.push(`${label} ${g} ${turnShort} ${cleanSign(st.signName)} L${st.houseFromLagna}/M${st.houseFromMoon} ${dtStr}${degTag}${sep}before ${beforeParts}${sep}after ${afterParts}`);
      }
    } else {
      eventLines.push(isCompact ? 'STA None' : 'STATION None');
    }

    if (vse.parivartanaYogas && vse.parivartanaYogas.length > 0) {
      for (const p of vse.parivartanaYogas) {
        const gA = cleanPlanet(p.grahaA);
        const gB = cleanPlanet(p.grahaB);
        const sA = cleanSign(p.signAName);
        const sB = cleanSign(p.signBName);
        const label = isCompact ? 'PAR' : 'PARIVARTANA';
        const dtSpan = isCompact
          ? `${compactYearDate(p.startDate, year)}..${shortDate(p.endDate)}`
          : `${p.startDate}..${p.endDate}`;
        eventLines.push(`${label} ${gA}<->${gB} ${sA}<->${sB} L${p.lagnaHouseA}<->L${p.lagnaHouseB} M${p.moonHouseA}<->M${p.moonHouseB} ${dtSpan}`);
      }
    } else {
      eventLines.push(isCompact ? 'PAR None' : 'PARIVARTANA None');
    }

    if (vse.debilitationEvents && vse.debilitationEvents.length > 0) {
      for (const d of vse.debilitationEvents) {
        const g = cleanPlanet(d.grahaKey);
        const s = cleanSign(d.signName);
        const mShort = d.motionState.includes('Retrograde') ? 'Vakra' : 'Direct';
        const factorRaw = formatCompactNeechaBhangaFactors(d.cancellationReasons);
        const factorStr = isCompact ? factorRaw : factorRaw.replace(/,/g, ', ');
        const label = isCompact ? 'NB' : 'NEECHABHANGA';
        const dtSpan = isCompact
          ? `${compactYearDate(d.startDate, year)}..${shortDate(d.endDate)}`
          : `${d.startDate}..${d.endDate}`;
        eventLines.push(`${label} ${g} ${s} L${d.houseFromLagna}/M${d.houseFromMoon} ${dtSpan}${sep}${mShort}${sep}${factorStr}`);
      }
    } else {
      eventLines.push(isCompact ? 'NB None' : 'NEECHABHANGA None');
    }
  } else {
    eventLines.push('None');
  }
  const c6Events = [`[EVENTS]`, ...eventLines].join('\n');

  // C8 [LUNAR] — Continuous sub-daily ephemeris scan (1-minute boundary bisection)
  // Guarantees ZERO skipped Nakshatras (e.g. Ardra) and emits exact UTC sign/nakshatra change times
  const moonDatesBySignIdx = new Map<number, string[]>();
  const lunarLines: string[] = [];

  const formatUtcStamp = (ms: number, compactMode: boolean): string => {
    const dt = new Date(ms);
    const day = dt.getUTCDate();
    const hh = String(dt.getUTCHours()).padStart(2, '0');
    const mm = String(dt.getUTCMinutes()).padStart(2, '0');
    if (compactMode) return `d${day} ${hh}:${mm}`;
    return `${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')} ${hh}:${mm}`;
  };

  const isMoonOverridden = customOverrideMap.has('Moon');
  if (isMoonOverridden) {
    // Custom Moon override fallback (daily aggregation)
    const moonDaily = rawDailyByGraha.get('Moon') || [];
    const moonSpans: Array<{ signIdx: number; signName: string; hMoon: number; days: DailyPlanetRecord[] }> = [];
    for (const rec of moonDaily) {
      const last = moonSpans[moonSpans.length - 1];
      if (!last || last.signIdx !== rec.signIdx) {
        moonSpans.push({ signIdx: rec.signIdx, signName: rec.signName, hMoon: rec.hMoon, days: [rec] });
      } else {
        last.days.push(rec);
      }
    }
    for (const ms of moonSpans) {
      const d1 = ms.days[0];
      const dLast = ms.days[ms.days.length - 1];
      const dRangeCompact = d1.day === dLast.day ? `d${d1.day}` : `d${d1.day}-${dLast.day}`;
      const dRangeLabel = isCompact ? dRangeCompact : (d1.day === dLast.day ? `Day ${d1.day}` : `Day ${d1.day}-${dLast.day}`);
      const arr = moonDatesBySignIdx.get(ms.signIdx) || [];
      arr.push(dRangeCompact);
      moonDatesBySignIdx.set(ms.signIdx, arr);
      const tara = computeExactTaraShort(janmaStarName, d1.nakshatra);
      const cb = calculateChandraBala(moonIdx, ms.signIdx);
      const chandraBalaTag = isCompact ? `CB:${cb.isFavorable ? 'Fav' : '-'}` : `ChandraBala: ${cb.isFavorable ? 'Fav' : '-'}`;
      const chandraFlag = ms.hMoon === 8 ? `${sep}CHANDRASHTAMA` : '';
      lunarLines.push(`${dRangeLabel}${sep}${ms.signName} M${ms.hMoon}${sep}${d1.degStr}${sep}${d1.nakshatra} P${d1.pada}(${tara.tag})${sep}${chandraBalaTag}${chandraFlag}`);
    }
  } else {
    const monthStartMs = Date.UTC(year, monthIdx, 1, 0, 0, 0);
    const monthEndMs = Date.UTC(year, monthIdx, daysInMonth, 23, 59, 0);

    const sampleMoonAt = (ms: number) => {
      const pos = getGrahaTransitPosition('Moon', new Date(ms), lagnaIdx, moonIdx);
      return {
        ms,
        signIdx: pos.transit_rashi_index,
        signName: SIGN_LIST_EN[pos.transit_rashi_index - 1] || cleanSign(pos.transit_rashi_name),
        hMoon: pos.relative_to_natal_rashi.house_number,
        degStr: cleanDegree(pos.degree_sputa),
        nak: pos.graha_pada_chara.nakshatra_name,
        pada: pos.graha_pada_chara.pada
      };
    };

    const bisectTransition = (
      tA: number,
      tB: number,
      keyFn: (s: ReturnType<typeof sampleMoonAt>) => string
    ): number => {
      const kA = keyFn(sampleMoonAt(tA));
      let lo = tA;
      let hi = tB;
      while (hi - lo > 60 * 1000) {
        const mid = Math.floor((lo + hi) / 2);
        if (keyFn(sampleMoonAt(mid)) === kA) lo = mid;
        else hi = mid;
      }
      return hi;
    };

    interface SubSpan {
      startMs: number;
      endMs: number;
      signIdx: number;
      signName: string;
      hMoon: number;
      nak: string;
      padas: number[];
      startDeg: string;
      endDeg: string;
    }

    // Step 1 hour across entire month and bisect every (sign|nak|pada) transition to 1-min precision
    const STEP_1H = 60 * 60 * 1000;
    const rawSubSpans: Array<{ startMs: number; endMs: number; state: ReturnType<typeof sampleMoonAt> }> = [];
    let curMs = monthStartMs;
    let curState = sampleMoonAt(curMs);
    let segStartMs = curMs;
    const stateKey = (s: ReturnType<typeof sampleMoonAt>) => `${s.signIdx}|${s.nak}|${s.pada}`;

    while (curMs < monthEndMs) {
      const nextMs = Math.min(monthEndMs, curMs + STEP_1H);
      const nextState = sampleMoonAt(nextMs);
      if (stateKey(nextState) !== stateKey(curState)) {
        const crossMs = bisectTransition(curMs, nextMs, stateKey);
        rawSubSpans.push({ startMs: segStartMs, endMs: crossMs - 60 * 1000, state: curState });
        curState = sampleMoonAt(crossMs);
        segStartMs = crossMs;
        // Handle edge case of multiple transitions in 1 hour (impossible for Moon ~0.55 deg/hr vs 3.33 deg pada, but safe loop)
        while (stateKey(sampleMoonAt(nextMs)) !== stateKey(curState) && nextMs - segStartMs > 60 * 1000) {
          const innerCross = bisectTransition(segStartMs, nextMs, stateKey);
          rawSubSpans.push({ startMs: segStartMs, endMs: innerCross - 60 * 1000, state: curState });
          curState = sampleMoonAt(innerCross);
          segStartMs = innerCross;
        }
      }
      curMs = nextMs;
    }
    rawSubSpans.push({ startMs: segStartMs, endMs: monthEndMs, state: curState });

    // Merge into SignSpans containing ordered NakshatraSegments (preserving ALL traversed Nakshatras + Padas + UTC change times)
    interface NakSeg {
      nak: string;
      padas: number[];
      startMs: number;
      endMs: number;
    }
    interface ContMoonSignSpan {
      signIdx: number;
      signName: string;
      hMoon: number;
      startMs: number;
      endMs: number;
      startDeg: string;
      endDeg: string;
      naks: NakSeg[];
    }
    const signSpansCont: ContMoonSignSpan[] = [];
    for (const sub of rawSubSpans) {
      const endSample = sampleMoonAt(sub.endMs);
      const lastSign = signSpansCont[signSpansCont.length - 1];
      if (!lastSign || lastSign.signIdx !== sub.state.signIdx) {
        signSpansCont.push({
          signIdx: sub.state.signIdx,
          signName: sub.state.signName,
          hMoon: sub.state.hMoon,
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

    for (const ms of signSpansCont) {
      const dStartDay = new Date(ms.startMs).getUTCDate();
      const dEndDay = new Date(ms.endMs).getUTCDate();
      const dRangeCompact = dStartDay === dEndDay ? `d${dStartDay}` : `d${dStartDay}-${dEndDay}`;
      const arr = moonDatesBySignIdx.get(ms.signIdx) || [];
      arr.push(dRangeCompact);
      moonDatesBySignIdx.set(ms.signIdx, arr);

      const timeRangeLabel = `${formatUtcStamp(ms.startMs, isCompact)}..${formatUtcStamp(ms.endMs, isCompact)}${isCompact ? '' : ' UTC'}`;
      const starsWithTara = ms.naks
        .map(st => {
          const tara = computeExactTaraShort(janmaStarName, st.nak);
          const padaPart = st.padas.length > 1
            ? `P${st.padas[0]}-P${st.padas[st.padas.length - 1]}`
            : `P${st.padas[0]}`;
          const tWin = `${formatUtcStamp(st.startMs, true)}..${formatUtcStamp(st.endMs, true)}`;
          return isCompact
            ? `${st.nak} ${padaPart} ${tWin}(${tara.tag})`
            : `${st.nak} ${padaPart} ${tWin} UTC (${tara.tag})`;
        })
        .join(isCompact ? '->' : ' -> ');

      const degRange = ms.startDeg === ms.endDeg ? ms.startDeg : `${ms.startDeg}..${ms.endDeg}`;
      const cb = calculateChandraBala(moonIdx, ms.signIdx);
      const chandraBalaTag = isCompact
        ? `CB:${cb.isFavorable ? 'Fav' : '-'}`
        : `ChandraBala: ${cb.isFavorable ? 'Fav' : '-'}`;
      const chandraFlag = ms.hMoon === 8 ? `${sep}CHANDRASHTAMA` : '';
      lunarLines.push(`${timeRangeLabel}${sep}${ms.signName} M${ms.hMoon}${sep}${degRange}${sep}${starsWithTara}${sep}${chandraBalaTag}${chandraFlag}`);
    }
  }

  const c8Lunar = [
    `[LUNAR]`,
    ...lunarLines
  ].join('\n');

  // C7 [HOUSE MAP]
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
    const daily = rawDailyByGraha.get(g) || [];
    const spans: Array<{ signIdx: number; start: number; end: number }> = [];
    for (const rec of daily) {
      const last = spans[spans.length - 1];
      if (!last || last.signIdx !== rec.signIdx) {
        spans.push({ signIdx: rec.signIdx, start: rec.day, end: rec.day });
      } else {
        last.end = rec.day;
      }
    }
    for (const sp of spans) {
      const dr = sp.start === 1 && sp.end === daysInMonth
        ? ''
        : (sp.start === sp.end ? ` d${sp.start}` : ` d${sp.start}-${sp.end}`);
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

  const houseMapLines: string[] = [];
  for (let hL = 1; hL <= 12; hL++) {
    const sIdx = ((lagnaIdx - 1 + (hL - 1)) % 12) + 1;
    const sName = SIGN_LIST_EN[sIdx - 1];
    const hM = ((sIdx - moonIdx + 12) % 12) + 1;
    const natalOcc = (natalBySignIdx.get(sIdx) || []).join(listSep);
    const transitOcc = (transitBySignIdx.get(sIdx) || []).join(listSep);
    const aspRec = Array.from(new Set(aspectsReceivedBySignIdx.get(sIdx) || [])).join(listSep);
    const moonD = (moonDatesBySignIdx.get(sIdx) || []).join(listSep);

    if (isCompact) {
      const fields = [`L${hL}/M${hM} ${sName}`];
      if (natalOcc) fields.push(`N:${natalOcc}`);
      if (transitOcc) fields.push(`T:${transitOcc}`);
      if (aspRec) fields.push(`Asp:${aspRec}`);
      if (moonD) fields.push(`Moon:${moonD}`);
      houseMapLines.push(fields.join('|'));
    } else {
      houseMapLines.push(
        `L${hL}/M${hM} ${sName} | N: ${natalOcc || '-'} | T: ${transitOcc || '-'} | Asp: ${aspRec || '-'} | Moon: ${moonD || '-'}`
      );
    }
  }
  const c7HouseMap = [`[HOUSE MAP]`, ...houseMapLines].join('\n');

  // C9 [AD CHAMBER/GATES]
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
      const grahas = g.activeGrahasInGate.length > 0
        ? g.activeGrahasInGate.map(ag => {
            const pClean = cleanPlanet(ag.name);
            const isNatal = ag.type === 'natal' || ag.passageWindow === 'Fixed Natal Position';
            const prefix = isNatal ? `natal ${pClean}` : pClean;
            const win = ag.passageWindow && !isNatal ? compactGateWindowText(ag.passageWindow) : '';
            return `${prefix}${win ? (isCompact ? `(${win})` : ` (${win.replace(/,/g, ', ')})`) : ''}`;
          }).join(listSep)
        : '-';
      const gSignIdx = getCleanSignIndex(g.rashiName);
      const exactMoonDates = (gSignIdx ? moonDatesBySignIdx.get(gSignIdx)?.join(listSep) : '') || (g.moonIngressWindow ? compactGateWindowText(g.moonIngressWindow) : '-');
      const mLabel = isCompact ? `Moon:${exactMoonDates}` : `Moon: ${exactMoonDates}`;
      const gLabel = isCompact ? `Grahas:${grahas}` : `Grahas: ${grahas}`;
      return `G${g.gateIndex}${sep}${cleanStar(g.nakshatraName)}${sep}${cleanSign(g.rashiName)}${sep}L${g.houseFromLagna}/M${g.houseFromRashi}${sep}${mLabel}${sep}${gLabel}`;
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

  // SUB-PROMPT BUILDER (Career | Finance | Love | Family)
  const subPromptBlock = (() => {
    if (domain === 'master') return '';
    const spec = DOMAIN_PROMPT_SPECS[domain];
    const domainUpper = domain.toUpperCase();
    const resolvedQuestion = cleanQuestion || spec.defaultQuestion;

    // Spotlight Shadbala & Pindas for primary karakas
    const karakaShadbala = (context.shadbalaStrengths || [])
      .filter(s => spec.primaryKarakas.includes(s.planet))
      .map(s => `${s.planet} ${s.ratio.toFixed(2)} (${s.status}, Dig:${s.dig.toFixed(1)}, Shodashavarga:${s.shodashavargaVimsopaka} ${s.shodashavargaAmsa})`)
      .join(' | ') || 'not provided';

    // Spotlight SAV & BAV for domain focus houses
    const focusAshtak = spec.focusHouses.map(h => {
      const sIdx = ((lagnaIdx + h - 2) % 12) + 1;
      const savPts = savBySignIdx.get(sIdx) ?? '-';
      const kBavs = spec.primaryKarakas
        .slice(0, 3)
        .map(k => `${k.slice(0, 2)}:${bavData?.[k]?.[sIdx] ?? '-'}`)
        .join(',');
      return `H${h}(${signAbbr(SIGN_LIST_EN[sIdx - 1])}) SAV${savPts} [${kBavs}]`;
    }).join(' | ');

    // Spotlight Yogas & Doshas relevant to domain
    const yd = context.yogasAndDoshas;
    const relRaja = (yd?.rajaYogas || []).filter(y => y.domains.includes(domain)).map(y => `${y.name} [${y.participants.join(', ')}]`);
    const relGen = (yd?.generalYogas || []).filter(y => y.domains.includes(domain)).map(y => y.name);
    const relDoshas = (yd?.doshas || []).filter(d => d.domains.includes(domain)).map(d => `${d.name} (${d.status}): ${d.reasons[0] || ''}`);
    const yogaHighlight = [...relRaja, ...relGen].join(', ') || 'See Master [YOGAS]';
    const doshaHighlight = relDoshas.join(' | ') || 'None specific in domain filter';

    // Format ONLY the domain's Divisional Charts (Vargas)
    const formatVargaSection = (chart: VargaChartDef): string => {
      const lagnaLine = `Lagna: ${chart.lagnaSign} ${chart.lagnaDeg}`;
      const rowGroups: string[] = [];
      for (let i = 0; i < 12; i += 4) {
        const chunk = chart.houses.slice(i, i + 4).map(h => {
          const pStr = h.planets.length > 0 ? h.planets.join(', ') : '-';
          return `H${h.house} ${h.sign}: ${pStr}`;
        });
        rowGroups.push(chunk.join(' | '));
      }
      return `[VARGA ${chart.code}: ${chart.name}]\n${lagnaLine}\n${rowGroups.join('\n')}`;
    };

    const vargaSections = spec.vargaCharts.map(code => {
      const chart = context.vargaCharts?.[code];
      if (!chart) return `[VARGA ${code}]\nnot provided`;
      return formatVargaSection(chart);
    });

    const masterAnchorNote = domain === 'love'
      ? `Primary Chart Reference: Evaluate ALL Master [D1], [D9] (Navamsa), [JAIMINI] (UL/A12, A7, DK), strength tables, monthly ephemeris, and [VARGA D7]/[VARGA D30] below.`
      : `Primary Chart Reference: Evaluate ALL Master [D1], [D9], strength tables, monthly ephemeris, and attached [VARGA] charts (${spec.vargaCharts.join(', ')}) below.`;

    const domainRulesLines = [
      `Scope: Act strictly as a Senior Vedic Astrologer (Parashara & Jaimini). Using ONLY the provided natal, strength, yoga/dosha, monthly transit/dasha/lunar ephemeris, and attached ${spec.vargaTagLabel} charts, deliver a deep prediction ONLY for ${spec.topicUpper}.`,
      masterAnchorNote,
      `Constraints: Never say "excerpt", "hypothetical", or add disclaimers/counselor advice. Never invent or recalculate positions. Weigh both Lagna (L#) and Moon (M#), and time windows when Transit Moon is sitting in or 7th-aspecting active houses/significators with Tara and ChandraBala.`,
      `Citation Split: Sections 1-4 MUST cite exact planets, L#/M# houses, Dasha, Varga, SAV/BAV, Tara, CB, and UTC dates behind every statement. Section 5 (Readout) MUST contain ZERO astrological terms (no planets, signs, houses, Dasha, Nakshatra, Tara, Varga, SAV, or Yoga names)—use calm, objective real-world scenarios and specific calendar dates only. Rating Scale: 3 = Highly Likely | 2 = Most Likely | 1 = Possible.`,
      `Follow-ups: Use [OUTPUT STRUCTURE] below for this initial reading. For any follow-up question in the same thread, answer directly and concisely without repeating all 5 sections unless asked.`
    ];

    const outputStructureLines = [
      `[OUTPUT STRUCTURE]`,
      `## 1. ${spec.overviewTitle} (Lagna L# + Moon Lagna M# + Dasha + ${spec.vargaTagLabel})`,
      `## 2. ${spec.matrixTitle}`,
      `| Date Range | ${spec.eventColumnLabel} | Moon Trigger (Sitting / 7th Aspect + Tara / ChandraBala) | Probability (%) | Rating (1-3) |`,
      `## 3. ${spec.breakdownTitle} (When & How Each Happens)`,
      `- Event [#], Date Range + Moon Sitting/Aspect, Probability % & Rating (1-3), Mechanism.`,
      `## 4. ${spec.cautionTitle}`,
      `[Exact caution dates and practical triggers to avoid.]`,
      `## 5. Readout (Plain Real-World Scenarios Only - Zero Astrological Terms)`,
      `### 1. Month Summary`,
      `### 2. Answer to Focus Question (or Key Practical Takeaways if FULL READING)`
    ];

    const focusQuestionBlock = [
      `[FOCUS QUESTION]`,
      resolvedQuestion
    ];

    return [
      `[SUB-PROMPT: ${domainUpper}]`,
      `Domain: ${spec.label} | Focus Houses: ${spec.focusHouses.map(h => `H${h}`).join(', ')} | Primary Karakas: ${spec.primaryKarakas.join(', ')}`,
      ...domainRulesLines,
      `[DOMAIN STRENGTHS]`,
      `Karakas Shadbala: ${karakaShadbala}`,
      `Focus Houses SAV/BAV: ${focusAshtak}`,
      `Highlighted Yogas: ${yogaHighlight}`,
      `Domain Dosha Alert: ${doshaHighlight}`,
      ...vargaSections,
      ...outputStructureLines,
      ...focusQuestionBlock
    ].join('\n');
  })();

  const monthSlice = [
    c1Period,
    c2Dasha,
    c3SlowPlanets,
    c4DoubleTransit,
    c5FastPlanets,
    c6Events,
    c7HouseMap,
    c8Lunar,
    c9AdGates
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
 * Automated Regression Validator for Original Source Prompts (Master + 4 Domain Sub-Prompts).
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
    '[RULES]', '[LORDSHIPS]', '[HOUSE LORDS]', '[D1]', '[D9]',
    '[SHADBALA]', '[SAV]', '[BAV]', '[PINDAS]', '[YOGAS]', '[DOSHAS]', '[JAIMINI]', '[KARAKAS]',
    '[PERIOD]', '[DASHA]', '[SLOW PLANETS]', '[DOUBLE TRANSIT]',
    '[FAST PLANETS]', '[EVENTS]', '[HOUSE MAP]', '[LUNAR]', '[AD CHAMBER/GATES]'
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
    // Verify no extraneous divisional charts from other domains leaked in
    const attachedVargas = Array.from(fullPrompt.matchAll(/\[VARGA (D\d+):/g)).map(m => m[1]);
    for (const vCode of attachedVargas) {
      if (!spec.vargaCharts.includes(vCode)) {
        errors.push(`Domain "${domain}" leaked unrelated divisional chart ${vCode} (allowed: ${spec.vargaCharts.join(', ')})`);
      }
    }
    const requiredStructureTokens = [
      '[OUTPUT STRUCTURE]',
      `## 1. ${spec.overviewTitle}`,
      `## 2. ${spec.matrixTitle}`,
      `| Date Range | ${spec.eventColumnLabel} | Moon Trigger (Sitting / 7th Aspect + Tara / ChandraBala) | Probability (%) | Rating (1-3) |`,
      `## 3. ${spec.breakdownTitle}`,
      `## 4. ${spec.cautionTitle}`,
      '## 5. Readout (Plain Real-World Scenarios Only - Zero Astrological Terms)',
      '### 1. Month Summary',
      '### 2. Answer to Focus Question (or Key Practical Takeaways if FULL READING)',
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

  // 1b. Compaction hygiene checks (zero underscores, zero blank lines)
  if (fullPrompt.includes('_')) {
    errors.push('Prompt contains underscore "_" character (must be zero-underscore text)');
  }
  if (fullPrompt.includes('\n\n')) {
    errors.push('Prompt contains blank line gap "\\n\\n" (must be strictly single-newline)');
  }

  // 2. Forbidden words / prediction-outcome probability prose (scanned ONLY against factual data before [OUTPUT STRUCTURE] and [FOCUS QUESTION])
  const factualDataOnlyPrompt = fullPrompt
    .split('\n[OUTPUT STRUCTURE]')[0]
    .split('\n[FOCUS QUESTION]')[0];

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

  // Helper to split sections cleanly (handles single-newline section boundaries)
  const sectionBody = (tag: string): string => {
    const escaped = tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`${escaped}\\n([\\s\\S]*?)(?=\\n\\[(?:RULES|LORDSHIPS|HOUSE LORDS|D1|D9|SHADBALA|SAV|BAV|PINDAS|YOGAS|DOSHAS|JAIMINI|KARAKAS|PERIOD|DASHA|SLOW PLANETS|DOUBLE TRANSIT|FAST PLANETS|EVENTS|HOUSE MAP|LUNAR|AD CHAMBER\\/GATES|SUB-PROMPT:[^\\]]+|DOMAIN STRENGTHS|VARGA [^\\]]+|OUTPUT STRUCTURE|FOCUS QUESTION)\\]|$)`);
    const m = fullPrompt.match(re);
    return m ? m[1] : '';
  };

  // 4. Duplicate line check across each section
  for (const sec of requiredSections) {
    if (sec === '[RULES]') continue;
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
  const savNums = Array.from(savBody.matchAll(/H\d+:(\d+)/g)).map(m => parseInt(m[1], 10));
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

  // 6. Dasha checks (MD/AD/PD dates present, no combined dignity label like "Swakshetra/Neecha")
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
  // Matches compact, baseline, and timed lunar nakshatra tags (e.g., "Ardra P1-P4 d26 14:52..d27 12:38(Mitra T8)")
  const nakTaraRegex = new RegExp(`(${sortedNaks})\\s+(?:P[1-4](?:-P[1-4])?(?:\\s+(?:d\\d+\\s+\\d{2}:\\d{2}\\.\\.(?:d\\d+\\s+)?\\d{2}:\\d{2}(?:\\s+UTC)?|d\\d+(?:-\\d+)?))?(?:/P[1-4](?:\\s+d\\d+(?:-\\d+)?)?)*)\\s*\\(([A-Za-z ]+?)\\s+T(\\d)\\)`, 'g');

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

  // 9. [LUNAR] continuous nakshatra sequence (no skipped stars!), CB:Fav/-, CHANDRASHTAMA, & sign cross-check
  const lunarLines = sectionBody('[LUNAR]').split('\n').filter(Boolean);
  if (lunarLines.length === 0) {
    errors.push('[LUNAR] has no day rows');
  }
  const lunarNakSequence: number[] = [];
  const isMoonOverridden = (context.allTransitPlacements || []).some(tp => tp.is_custom && cleanPlanet(tp.graha_key) === 'Moon');
  for (const lLine of lunarLines) {
    const signMatch = lLine.match(/\|\s*([A-Za-z]+)\s+M(\d+)\s*\|/);
    if (!signMatch) {
      errors.push(`Unrecognized [LUNAR] row format: "${lLine}"`);
      continue;
    }
    const rSignIdx = getCleanSignIndex(signMatch[1]);
    const rHouseM = parseInt(signMatch[2], 10);
    const expectedHouseM = ((rSignIdx - moonIdx + 12) % 12) + 1;
    if (rHouseM !== expectedHouseM) {
      errors.push(`[LUNAR] M# house mismatch for ${signMatch[1]}: got M${rHouseM}, expected M${expectedHouseM}`);
    }

    // Verify no skipped Moon Nakshatra in chronological order
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

  // 10. Source fact cross-check for Planets, L#/M# Houses, SAV, Motion, Combust dates, and Date bounds
  const savDistMap = new Map<number, number>();
  (context.ashtakavargaPayload?.savPointsDistribution || []).forEach(s => savDistMap.set(s.signIndex, s.points));

  const sunLonByDay = new Map<number, number>();
  for (let d = 1; d <= daysInMonth; d++) {
    const dt = new Date(Date.UTC(year, monthIdx, d, 12, 0, 0));
    sunLonByDay.set(d, getGrahaTransitPosition('Sun', dt, lagnaIdx, moonIdx).sidereal_longitude);
  }

  const checkPlanetSection = (secTag: string) => {
    const lines = sectionBody(secTag).split('\n').filter(l => /^(Jupiter|Saturn|Rahu|Ketu|Sun|Mars|Mercury|Venus)(?:\s*\(d\d+(?:-\d+)?\))?\s*\|/.test(l));
    for (const line of lines) {
      const parts = line.split('|').map(x => x.trim());
      if (parts.length < 6) {
        errors.push(`Malformed planet row in ${secTag}: "${line}"`);
        continue;
      }
      const pMatch = parts[0].match(/^([A-Za-z]+)(?:\s*\(d(\d+)(?:-(\d+))?\))?$/);
      if (!pMatch) continue;
      const gKey = pMatch[1];
      const dStart = pMatch[2] ? parseInt(pMatch[2], 10) : 1;
      const dEnd = pMatch[3] ? parseInt(pMatch[3], 10) : (pMatch[2] ? parseInt(pMatch[2], 10) : daysInMonth);

      if (dStart < 1 || dEnd > daysInMonth || dStart > dEnd) {
        errors.push(`Out-of-month day range d${dStart}-${dEnd} in ${secTag}: "${line}"`);
      }

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

      // Cross-check daily sign, motion, and combustion directly against ephemeris (when not custom-overridden)
      const isOverridden = (context.allTransitPlacements || []).some(tp => tp.is_custom && cleanPlanet(tp.graha_key) === gKey);
      if (!isOverridden) {
        const actualCombustDays: number[] = [];
        const actualMotions: Array<{ day: number; label: string }> = [];
        for (let d = dStart; d <= dEnd; d++) {
          const dt = new Date(Date.UTC(year, monthIdx, d, 12, 0, 0));
          const pos = getGrahaTransitPosition(gKey, dt, lagnaIdx, moonIdx);
          if (pos.transit_rashi_index !== sIdx) {
            errors.push(`Ephemeris sign mismatch for ${gKey} on day ${d}: prompt says ${locM[1]}, ephemeris says ${pos.transit_rashi_name}`);
            break;
          }
          const mLabel = pos.motion_type === 'Adisara' ? 'ADISARA' : pos.is_retrograde ? 'VAKRA' : 'DIRECT';
          actualMotions.push({ day: d, label: mLabel });
          if (gKey !== 'Sun' && isCombustAgainstSun(gKey, pos.sidereal_longitude, sunLonByDay.get(d)!, pos.is_retrograde)) {
            actualCombustDays.push(d);
          }
        }
        const expectedMotionStr = formatContinuousRanges(actualMotions);
        const expectedCombustStr = actualCombustDays.length > 0 ? `Combust ${formatDayRangesCompact(actualCombustDays)}` : '';
        const expectedMotionAndCombust = [expectedMotionStr, expectedCombustStr].filter(Boolean).join(', ');
        if (parts[2] !== expectedMotionAndCombust) {
          errors.push(`Motion/Combust mismatch for ${gKey} d${dStart}-${dEnd}: prompt="${parts[2]}", ephemeris="${expectedMotionAndCombust}"`);
        }
      }
    }
  };

  checkPlanetSection('[SLOW PLANETS]');
  checkPlanetSection('[FAST PLANETS]');

  // 11. Date bounds check inside [EVENTS] (supports full YYYY-MM-DD and year-compacted MM-DD dates)
  const eventLines = sectionBody('[EVENTS]').split('\n').filter(Boolean);
  for (const evLine of eventLines) {
    const fullDates = evLine.match(/\b\d{4}-\d{2}-\d{2}\b/g) || [];
    for (const fd of fullDates) {
      if (fd < priorStartIso || fd > monthEndIso) {
        errors.push(`Date ${fd} outside allowed [${priorStartIso}..${monthEndIso}] window in [EVENTS]: "${evLine}"`);
      }
    }
    const mmddDates = evLine.replace(/\b\d{4}-\d{2}-\d{2}\b/g, '').match(/\b\d{2}-\d{2}\b/g) || [];
    for (const md of mmddDates) {
      const mNum = parseInt(md.slice(0, 2), 10);
      const resolvedYear = monthIdx === 0 && mNum === 12 ? year - 1 : (monthIdx === 11 && mNum === 1 ? year + 1 : year);
      const fd = `${resolvedYear}-${md}`;
      if (fd < priorStartIso || fd > monthEndIso) {
        errors.push(`Date ${fd} outside allowed [${priorStartIso}..${monthEndIso}] window in [EVENTS]: "${evLine}"`);
      }
    }
  }
  if (!sectionBody('[PERIOD]').includes(`${monthStartIso}..${monthEndIso}`)) {
    errors.push(`[PERIOD] missing exact month range ${monthStartIso}..${monthEndIso}`);
  }

  return { valid: errors.length === 0, errors };
}
