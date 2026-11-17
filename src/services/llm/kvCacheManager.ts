import { AstroPromptVersion, VedicHouseContext } from './types';

export type KvCacheEngineSlot = 'privateOllama' | 'claudeSonnet' | 'claudeFable' | 'geminiPro';

export interface KvCacheBlockOverrides {
  d1Chart?: string;
  d9Chart?: string;
  rules?: string;
  delivery?: string;
}

export interface KvCacheConfig {
  privateOllama: {
    enabled: boolean;
    flashAttention: boolean;
    kvCacheType: 'q8_0' | 'f16';
    keepAlive: string;
    model?: string;
    primedAt?: string;
    primedHash?: string;
    promptEvalCount?: number;
  };
  claudeSonnet: {
    enabled: boolean;
    model: string;
    primedAt?: string;
    primedHash?: string;
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
  };
  claudeFable: {
    enabled: boolean;
    model: string;
    primedAt?: string;
    primedHash?: string;
    cacheCreationTokens?: number;
    cacheReadTokens?: number;
  };
  geminiPro: {
    enabled: boolean;
    model: string;
    primedAt?: string;
    primedHash?: string;
    cachedContentTokens?: number;
  };
  overrides: KvCacheBlockOverrides;
}

export const KV_CACHE_STORAGE_KEY = 'astro_kv_cache_config_v1';

export const DEFAULT_KV_CACHE_CONFIG: KvCacheConfig = {
  privateOllama: {
    enabled: false,
    flashAttention: true,
    kvCacheType: 'q8_0',
    keepAlive: '30m',
    model: 'hf.co/gnanasreekar/vedic-qwen2.5-14b-GGUF:Q4_K_M'
  },
  claudeSonnet: {
    enabled: false,
    model: 'claude-sonnet-5-5'
  },
  claudeFable: {
    enabled: false,
    model: 'claude-fable-5-1'
  },
  geminiPro: {
    enabled: false,
    model: 'gemini-flash-latest'
  },
  overrides: {}
};

export function loadKvCacheConfig(): KvCacheConfig {
  if (typeof window === 'undefined') {
    return JSON.parse(JSON.stringify(DEFAULT_KV_CACHE_CONFIG));
  }
  try {
    const raw = localStorage.getItem(KV_CACHE_STORAGE_KEY);
    if (!raw) return JSON.parse(JSON.stringify(DEFAULT_KV_CACHE_CONFIG));
    const parsed = JSON.parse(raw);
    return {
      privateOllama: { ...DEFAULT_KV_CACHE_CONFIG.privateOllama, ...(parsed.privateOllama || {}) },
      claudeSonnet: { ...DEFAULT_KV_CACHE_CONFIG.claudeSonnet, ...(parsed.claudeSonnet || {}) },
      claudeFable: { ...DEFAULT_KV_CACHE_CONFIG.claudeFable, ...(parsed.claudeFable || {}) },
      geminiPro: { ...DEFAULT_KV_CACHE_CONFIG.geminiPro, ...(parsed.geminiPro || {}) },
      overrides: { ...(parsed.overrides || {}) }
    };
  } catch {
    return JSON.parse(JSON.stringify(DEFAULT_KV_CACHE_CONFIG));
  }
}

export function saveKvCacheConfig(config: KvCacheConfig): KvCacheConfig {
  const normalized: KvCacheConfig = {
    privateOllama: { ...DEFAULT_KV_CACHE_CONFIG.privateOllama, ...(config.privateOllama || {}) },
    claudeSonnet: { ...DEFAULT_KV_CACHE_CONFIG.claudeSonnet, ...(config.claudeSonnet || {}) },
    claudeFable: { ...DEFAULT_KV_CACHE_CONFIG.claudeFable, ...(config.claudeFable || {}) },
    geminiPro: { ...DEFAULT_KV_CACHE_CONFIG.geminiPro, ...(config.geminiPro || {}) },
    overrides: { ...(config.overrides || {}) }
  };
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(KV_CACHE_STORAGE_KEY, JSON.stringify(normalized));
      window.dispatchEvent(new CustomEvent('astro-kv-cache-updated', { detail: normalized }));
    } catch {}
  }
  return normalized;
}

export async function syncKvCacheConfigToServer(config: KvCacheConfig): Promise<void> {
  try {
    await fetch('/api/llm/kv-cache/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  } catch {}
}

export function mapProviderToKvSlot(providerOrEngine: string): KvCacheEngineSlot {
  const p = String(providerOrEngine || '').toLowerCase();
  if (p.includes('fable')) return 'claudeFable';
  if (p.includes('claude') || p.includes('sonnet') || p.includes('haiku')) return 'claudeSonnet';
  if (p.includes('gemini')) return 'geminiPro';
  return 'privateOllama';
}

export function getEngineSlotDisplayName(slot: KvCacheEngineSlot): string {
  switch (slot) {
    case 'privateOllama':
      return 'Private Local LLM (Ollama 14B / 7B)';
    case 'claudeSonnet':
      return 'Anthropic Claude Sonnet';
    case 'claudeFable':
      return 'Claude Fable 5.1';
    case 'geminiPro':
      return 'Google Gemini Pro';
  }
}

export function isKvCacheEnabledForEngine(slot: KvCacheEngineSlot, config?: KvCacheConfig): boolean {
  const cfg = config || loadKvCacheConfig();
  return Boolean(cfg[slot]?.enabled);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

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
  let out = String(s).replace(/[\u0B80-\u0BFF]+/g, '').trim();
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
  const m = String(deg).match(/(\d{1,2})°\s*(\d{1,2})?/);
  if (m) return `${m[1]}°${m[2] || '00'}'`;
  return String(deg).trim();
}

function cleanStar(star?: string, pada?: number): string {
  if (!star) return '';
  let clean = String(star).replace(/[\u0B80-\u0BFF]+/g, '').trim();
  const paren = clean.match(/^[^(]+\(([^)]+)\)/);
  if (paren && paren[1]) clean = paren[1].trim();
  return pada ? `${clean} P${pada}` : clean;
}

function cleanInlineText(text?: string): string {
  if (!text) return '';
  let res = String(text).replace(/[\u0B80-\u0BFF]+/g, '');
  res = res
    .replace(/\b(?:Kadaga|Kadagam|Katakam|Karkataka|Karka)\b/gi, 'Cancer')
    .replace(/\b(?:Meenam|Meena)\b/gi, 'Pisces')
    .replace(/\b(?:Mesham|Mesha)\b/gi, 'Aries')
    .replace(/\b(?:Rishabam|Rishaba|Vrishabha)\b/gi, 'Taurus')
    .replace(/\b(?:Mithunam|Mithuna)\b/gi, 'Gemini')
    .replace(/\b(?:Simham|Simha)\b/gi, 'Leo')
    .replace(/\b(?:Kanni|Kanya)\b/gi, 'Virgo')
    .replace(/\b(?:Thulaam|Thulam|Tula)\b/gi, 'Libra')
    .replace(/\b(?:Vrischigam|Viruchigam|Vrischika|Vruschikam)\b/gi, 'Scorpio')
    .replace(/\b(?:Dhanus|Dhanusu|Dhanu)\b/gi, 'Sagittarius')
    .replace(/\b(?:Makaram|Makara)\b/gi, 'Capricorn')
    .replace(/\b(?:Kumbam|Kumbha)\b/gi, 'Aquarius')
    .replace(/\bGuru\b/gi, 'Jupiter')
    .replace(/\b(?:Sevvai|Chevvai|Mangal|Angaraka)\b/gi, 'Mars')
    .replace(/\b(?:Sukra|Shukra|Velli)\b/gi, 'Venus')
    .replace(/\b(?:Sani|Shani|Shaneeshwara)\b/gi, 'Saturn')
    .replace(/\b(?:Budha|Budhan)\b/gi, 'Mercury')
    .replace(/\b(?:Surya|Suryan|Suriyan|Ravi)\b/gi, 'Sun')
    .replace(/\b(?:Chandra|Chandran|Soma)\b/gi, 'Moon')
    .replace(/\b(Aries|Taurus|Gemini|Cancer|Leo|Virgo|Libra|Scorpio|Sagittarius|Capricorn|Aquarius|Pisces)\s*\(\s*\1\s*\)/gi, '$1');
  return res.replace(/[ \t]+/g, ' ').trim();
}

const SIGN_LIST_EN = [
  'Aries', 'Taurus', 'Gemini', 'Cancer', 'Leo', 'Virgo',
  'Libra', 'Scorpio', 'Sagittarius', 'Capricorn', 'Aquarius', 'Pisces'
];

const OWNED_SIGN_INDICES: Record<string, number[]> = {
  Sun: [5],
  Moon: [4],
  Mars: [1, 8],
  Mercury: [3, 6],
  Jupiter: [9, 12],
  Venus: [2, 7],
  Saturn: [10, 11]
};

export function getCleanSignIndex(signName?: string): number {
  const s = cleanSign(signName).toLowerCase();
  const idx = SIGN_LIST_EN.findIndex(item => item.toLowerCase() === s || s.startsWith(item.toLowerCase().slice(0, 4)));
  return idx >= 0 ? idx + 1 : 0; // 1..12, 0 if unknown
}

export function getOwnedHousesTag(planetClean: string, lagnaIdx: number, moonIdx: number, isDualFold: boolean): string {
  const signs = OWNED_SIGN_INDICES[planetClean];
  if (!signs || signs.length === 0 || !lagnaIdx || !moonIdx) return '';
  const lList = signs.map(s => `L${((s - lagnaIdx + 12) % 12) + 1}`).join(',');
  const mList = signs.map(s => `M${((s - moonIdx + 12) % 12) + 1}`).join(',');
  return isDualFold ? `${lList}(${mList})` : mList;
}

export function buildOwnedHousesMatrix(lagnaIdx: number, moonIdx: number, isDualFold: boolean): string {
  const ordered = ['Sun', 'Moon', 'Mars', 'Mercury', 'Jupiter', 'Venus', 'Saturn'];
  return ordered
    .map(p => `${p}:${getOwnedHousesTag(p, lagnaIdx, moonIdx, isDualFold)}`)
    .join(' | ');
}

export function getParasharaAspectEntries(
  planetClean: string,
  sourceSignIdx: number,
  lagnaIdx: number,
  moonIdx: number
): Array<{ offset: number; label: string; targetSignIdx: number; targetSign: string; hLagna: number; hMoon: number }> {
  if (!sourceSignIdx || sourceSignIdx < 1 || sourceSignIdx > 12) return [];
  const p = planetClean.toLowerCase();
  const defs: Array<{ offset: number; label: string }> = [];
  if (p === 'jupiter') {
    defs.push({ offset: 5, label: '5th' }, { offset: 7, label: '7th' }, { offset: 9, label: '9th' });
  } else if (p === 'saturn') {
    defs.push({ offset: 3, label: '3rd' }, { offset: 7, label: '7th' }, { offset: 10, label: '10th' });
  } else if (p === 'mars') {
    defs.push({ offset: 4, label: '4th' }, { offset: 7, label: '7th' }, { offset: 8, label: '8th' });
  } else if (p === 'rahu' || p === 'ketu') {
    defs.push({ offset: 5, label: '5th' }, { offset: 7, label: '7th' }, { offset: 9, label: '9th' });
  } else {
    defs.push({ offset: 7, label: '7th' });
  }

  return defs.map(d => {
    const tIdx = ((sourceSignIdx - 1 + (d.offset - 1)) % 12) + 1;
    const hL = lagnaIdx ? ((tIdx - lagnaIdx + 12) % 12) + 1 : tIdx;
    const hM = moonIdx ? ((tIdx - moonIdx + 12) % 12) + 1 : tIdx;
    return {
      offset: d.offset,
      label: d.label,
      targetSignIdx: tIdx,
      targetSign: SIGN_LIST_EN[tIdx - 1],
      hLagna: hL,
      hMoon: hM
    };
  });
}

export function formatParasharaAspects(
  planetClean: string,
  sourceSignIdx: number,
  lagnaIdx: number,
  moonIdx: number,
  isDualFold: boolean
): string {
  const entries = getParasharaAspectEntries(planetClean, sourceSignIdx, lagnaIdx, moonIdx);
  return entries
    .map(e => `${e.label}->${e.targetSign}(${isDualFold ? `L${e.hLagna}/M${e.hMoon}` : `M${e.hMoon}`})`)
    .join(', ');
}

export function computeDoubleTransitWindows(
  context: VedicHouseContext,
  lagnaIdx: number,
  moonIdx: number,
  isDualFold: boolean
): string[] {
  const monthShort = (MONTH_NAMES[context.selectedMonth] || 'Mon').slice(0, 3);
  const daysInMonth = new Date(context.selectedYear, context.selectedMonth + 1, 0).getDate();

  const resolveSpanSignIdx = (signName?: string, grahaKey?: string): number => {
    const byName = getCleanSignIndex(signName);
    if (byName) return byName;
    const tr = (context.allTransitPlacements || []).find(t => cleanPlanet(t.graha_key) === grahaKey);
    return tr?.transit_rashi_index || getCleanSignIndex(tr?.transit_rashi_name);
  };

  let jSpans = (context.monthlyMotionSpans || [])
    .filter(s => cleanPlanet(s.grahaKey) === 'Jupiter')
    .map(s => ({
      signIdx: resolveSpanSignIdx(s.signName, 'Jupiter'),
      startDay: s.startDay,
      endDay: s.endDay,
      motion: s.motionType === 'Adisara' ? 'ADISARA' : s.isRetrograde ? 'VAKRA' : 'DIR'
    }))
    .filter(s => s.signIdx > 0);

  let sSpans = (context.monthlyMotionSpans || [])
    .filter(s => cleanPlanet(s.grahaKey) === 'Saturn')
    .map(s => ({
      signIdx: resolveSpanSignIdx(s.signName, 'Saturn'),
      startDay: s.startDay,
      endDay: s.endDay,
      motion: s.motionType === 'Adisara' ? 'ADISARA' : s.isRetrograde ? 'VAKRA' : 'DIR'
    }))
    .filter(s => s.signIdx > 0);

  if (jSpans.length === 0) {
    const jt = (context.allTransitPlacements || []).find(t => cleanPlanet(t.graha_key) === 'Jupiter');
    const jIdx = jt ? (jt.transit_rashi_index || getCleanSignIndex(jt.transit_rashi_name)) : 0;
    if (jIdx) {
      jSpans = [{
        signIdx: jIdx,
        startDay: 1,
        endDay: daysInMonth,
        motion: jt?.motion_type === 'Adisara' ? 'ADISARA' : jt?.is_retrograde ? 'VAKRA' : 'DIR'
      }];
    }
  }
  if (sSpans.length === 0) {
    const st = (context.allTransitPlacements || []).find(t => cleanPlanet(t.graha_key) === 'Saturn');
    const sIdx = st ? (st.transit_rashi_index || getCleanSignIndex(st.transit_rashi_name)) : 0;
    if (sIdx) {
      sSpans = [{
        signIdx: sIdx,
        startDay: 1,
        endDay: daysInMonth,
        motion: st?.motion_type === 'Adisara' ? 'ADISARA' : st?.is_retrograde ? 'VAKRA' : 'DIR'
      }];
    }
  }

  if (jSpans.length === 0 || sSpans.length === 0) return [];

  const getTouches = (planet: 'Jupiter' | 'Saturn', sIdx: number) => {
    const list: Array<{ signIdx: number; tag: string }> = [{ signIdx: sIdx, tag: 'Occupied' }];
    for (const asp of getParasharaAspectEntries(planet, sIdx, lagnaIdx, moonIdx)) {
      list.push({ signIdx: asp.targetSignIdx, tag: `${asp.label}-Asp` });
    }
    return list;
  };

  const results: string[] = [];
  const seen = new Set<string>();
  for (const js of jSpans) {
    for (const ss of sSpans) {
      const wStart = Math.max(js.startDay, ss.startDay);
      const wEnd = Math.min(js.endDay, ss.endDay);
      if (wStart > wEnd) continue;
      const winLabel = wStart === wEnd ? `${monthShort} ${wStart}` : `${monthShort} ${wStart}–${wEnd}`;
      const jTouches = getTouches('Jupiter', js.signIdx);
      const sTouches = getTouches('Saturn', ss.signIdx);

      const hits: string[] = [];
      for (const jt of jTouches) {
        const st = sTouches.find(x => x.signIdx === jt.signIdx);
        if (!st) continue;
        const hL = ((jt.signIdx - lagnaIdx + 12) % 12) + 1;
        const hM = ((jt.signIdx - moonIdx + 12) % 12) + 1;
        const coord = isDualFold ? `L${hL}/M${hM}` : `M${hM}`;
        hits.push(`${SIGN_LIST_EN[jt.signIdx - 1]}(${coord}: Jup ${jt.tag}[${js.motion}] + Sat ${st.tag}[${ss.motion}])`);
      }
      if (hits.length > 0) {
        const line = `- ${winLabel}: ${hits.join(' | ')}`;
        if (!seen.has(line)) {
          seen.add(line);
          results.push(line);
        }
      }
    }
  }
  return results;
}

export function buildDefaultD1Block(context: VedicHouseContext, mode: 'v2' | 'v3' = 'v3'): string {
  const isDualFold = mode !== 'v2';
  const lagna = cleanSign(context.natalLagnaSignName) || 'Ascendant';
  const moon = cleanSign(context.natalMoonSignName || context.natalJanmaStar?.rashi_name) || 'Moon Sign';
  const lagnaIdx = getCleanSignIndex(lagna) || 9;
  const moonIdx = getCleanSignIndex(moon) || 8;
  const jStar = cleanStar(context.natalJanmaStar?.nakshatra_name || 'Anuradha', context.natalJanmaStar?.pada || 2);
  const lordshipMatrix = buildOwnedHousesMatrix(lagnaIdx, moonIdx, isDualFold);

  const d1 = (context.flattenedNatalD1 && context.flattenedNatalD1.length > 0)
    ? context.flattenedNatalD1.map(p =>
        `${cleanPlanet(p.body_name)}:${cleanSign(p.rashi_name)} H${p.house_number || '?'} ${cleanDegree(p.degree_sputa)} ${cleanStar(p.nakshatra_name, p.pada)}${p.is_retrograde ? '[R]' : ''}`
      ).join(' | ')
    : (context.natalOccupants?.length
        ? context.natalOccupants.map(o => `${cleanPlanet(o.body_name)} ${cleanDegree(o.degree_sputa)} ${cleanStar(o.nakshatra_name)}`).join(' | ')
        : 'Baseline Natal D1 grid');
  const savBaseline = context.ashtakavargaPayload?.savPointsDistribution?.length
    ? context.ashtakavargaPayload.savPointsDistribution.map(s => `H${s.houseNumber}:${s.points}`).join(' | ')
    : 'Baseline 12-house SAV';
  const karakas = `Career:H10,Sun,Mercury,Mars | Wealth:H2,H11,Jupiter | Home:H4,Moon | Love/Progeny:H5,H7,Venus | Health:H1,H6,Saturn`;

  return [
    `## 1. NATAL PROMISE & DIVISIONAL BASELINE (FIXED)`,
    `Lagna:${lagna} | JanmaRashi:${moon} | JanmaStar:${jStar}`,
    `HouseLordships: ${lordshipMatrix}`,
    `D1: ${d1}`,
    `SAV_BASELINE: ${savBaseline}`,
    `BHAVA_KARAKAS: ${karakas}`
  ].join('\n');
}

function parseDegreeMinutes(deg?: string): number | null {
  if (!deg) return null;
  const m = String(deg).match(/(\d{1,2})\s*[°:]\s*(\d{1,2})?/);
  if (!m) {
    const f = parseFloat(String(deg));
    return isNaN(f) ? null : Math.round(f * 60);
  }
  const d = parseInt(m[1], 10);
  const mins = m[2] ? parseInt(m[2], 10) : 0;
  return d * 60 + mins;
}

function getD9DignityTag(planetClean: string, signIdx: number): string {
  if (!signIdx) return '';
  const p = planetClean.toLowerCase();
  if (p === 'sun') {
    if (signIdx === 1) return '[Exalted]';
    if (signIdx === 7) return '[Debilitated]';
    if (signIdx === 5) return '[Own]';
  } else if (p === 'moon') {
    if (signIdx === 2) return '[Exalted]';
    if (signIdx === 8) return '[Debilitated]';
    if (signIdx === 4) return '[Own]';
  } else if (p === 'mars') {
    if (signIdx === 10) return '[Exalted]';
    if (signIdx === 4) return '[Debilitated]';
    if (signIdx === 1 || signIdx === 8) return '[Own]';
  } else if (p === 'mercury') {
    if (signIdx === 6) return '[Exalted/Own]';
    if (signIdx === 12) return '[Debilitated]';
    if (signIdx === 3) return '[Own]';
  } else if (p === 'jupiter') {
    if (signIdx === 4) return '[Exalted]';
    if (signIdx === 10) return '[Debilitated]';
    if (signIdx === 9 || signIdx === 12) return '[Own]';
  } else if (p === 'venus') {
    if (signIdx === 12) return '[Exalted]';
    if (signIdx === 6) return '[Debilitated]';
    if (signIdx === 2 || signIdx === 7) return '[Own]';
  } else if (p === 'saturn') {
    if (signIdx === 7) return '[Exalted]';
    if (signIdx === 1) return '[Debilitated]';
    if (signIdx === 10 || signIdx === 11) return '[Own]';
  }
  return '';
}

function computeParasharaD9FromD1(
  flattenedD1?: VedicHouseContext['flattenedNatalD1']
): Array<{
  body_name: string;
  rashi_name: string;
  degree_sputa?: string;
  house_number?: number;
  is_retrograde?: boolean;
}> {
  if (!flattenedD1 || flattenedD1.length === 0) return [];

  const fireStart = 1; // Aries
  const earthStart = 10; // Capricorn
  const airStart = 7; // Libra
  const waterStart = 4; // Cancer

  const rawItems: Array<{
    body_name: string;
    d9SignIdx: number;
    rashi_name: string;
    degree_sputa?: string;
    is_retrograde?: boolean;
  }> = [];

  for (const p of flattenedD1) {
    const sIdx = getCleanSignIndex(p.rashi_name);
    if (!sIdx) continue;
    const totalMins = parseDegreeMinutes(p.degree_sputa);
    const clampedMins = totalMins !== null ? Math.max(0, Math.min(1799, totalMins)) : 0;
    const navPada = Math.min(8, Math.floor(clampedMins / 200));
    const mod4 = (sIdx - 1) % 4;
    const startIdx = mod4 === 0 ? fireStart : mod4 === 1 ? earthStart : mod4 === 2 ? airStart : waterStart;
    const d9SignIdx = ((startIdx - 1 + navPada) % 12) + 1;
    rawItems.push({
      body_name: p.body_name,
      d9SignIdx,
      rashi_name: SIGN_LIST_EN[d9SignIdx - 1],
      degree_sputa: p.degree_sputa,
      is_retrograde: p.is_retrograde
    });
  }

  const lagnaEntry = rawItems.find(x => cleanPlanet(x.body_name).toLowerCase() === 'lagna');
  const d9LagnaIdx = lagnaEntry ? lagnaEntry.d9SignIdx : 0;

  return rawItems.map(item => ({
    body_name: item.body_name,
    rashi_name: item.rashi_name,
    degree_sputa: item.degree_sputa,
    house_number: d9LagnaIdx ? ((item.d9SignIdx - d9LagnaIdx + 12) % 12) + 1 : undefined,
    is_retrograde: item.is_retrograde
  }));
}

export function formatD9PlacementsSummary(context: VedicHouseContext): {
  d9LagnaSign: string;
  d9SummaryLine: string;
  hasData: boolean;
} {
  const sourceD9 =
    context.flattenedNatalD9 && context.flattenedNatalD9.length > 0
      ? context.flattenedNatalD9
      : computeParasharaD9FromD1(context.flattenedNatalD1);

  if (!sourceD9 || sourceD9.length === 0) {
    return {
      d9LagnaSign: '',
      d9SummaryLine: 'D9 placements unavailable in current chart payload.',
      hasData: false
    };
  }

  const d1SignMap = new Map<string, number>();
  (context.flattenedNatalD1 || []).forEach(p => {
    const key = cleanPlanet(p.body_name).toLowerCase();
    const sIdx = getCleanSignIndex(p.rashi_name);
    if (key && sIdx) d1SignMap.set(key, sIdx);
  });

  const lagnaRow = sourceD9.find(p => cleanPlanet(p.body_name).toLowerCase() === 'lagna');
  const d9LagnaIdx = lagnaRow ? getCleanSignIndex(lagnaRow.rashi_name) : 0;
  const d9LagnaSign = d9LagnaIdx ? SIGN_LIST_EN[d9LagnaIdx - 1] : '';

  const formatted = sourceD9.map(p => {
    const pName = cleanPlanet(p.body_name);
    const sIdx = getCleanSignIndex(p.rashi_name);
    const sName = sIdx ? SIGN_LIST_EN[sIdx - 1] : cleanSign(p.rashi_name);
    const hNum = p.house_number || (d9LagnaIdx && sIdx ? ((sIdx - d9LagnaIdx + 12) % 12) + 1 : undefined);
    const hTag = hNum ? ` H${hNum}` : '';
    const rTag = p.is_retrograde ? '[R]' : '';
    const d1Idx = d1SignMap.get(pName.toLowerCase());
    const vargottamaTag = pName.toLowerCase() !== 'lagna' && d1Idx && sIdx && d1Idx === sIdx ? '[Vargottama]' : '';
    const dignityTag = pName.toLowerCase() !== 'lagna' ? getD9DignityTag(pName, sIdx) : '';
    const degTag = cleanDegree(p.degree_sputa);
    const degPart = degTag ? ` ${degTag}` : '';
    return `${pName}:${sName}${hTag}${rTag}${vargottamaTag}${dignityTag}${degPart}`;
  });

  return {
    d9LagnaSign,
    d9SummaryLine: formatted.join(' | '),
    hasData: true
  };
}

export function buildDefaultD9Block(context: VedicHouseContext): string {
  const { d9LagnaSign, d9SummaryLine } = formatD9PlacementsSummary(context);
  const d1Lagna = cleanSign(context.natalLagnaSignName);
  const lines = [`## NATAL D9 NAVAMSHA CHART (FIXED DIVISIONAL STRENGTH)`];
  if (d9LagnaSign) {
    lines.push(`D9_Lagna:${d9LagnaSign}${d1Lagna ? ` (from D1 Lagna:${d1Lagna})` : ''}`);
  }
  lines.push(`D9: ${d9SummaryLine}`);
  return lines.join('\n');
}

export function buildDefaultRulesBlock(mode: 'v2' | 'v3' = 'v3'): string {
  const isDualFold = mode !== 'v2';
  const lawBlock = isDualFold
    ? [
        `## 2. MANDATORY REASONING HIERARCHY (ORDERED BY PREDICTIVE WEIGHT)`,
        `RULE 1 — DUAL-FOLD GOCHARA (LAGNA + MOON): Every transit operates simultaneously across Lagna (L#=objective physical event, D1 Bhava execution & house strength modulation) AND Janma Rashi/Moon (M#=psychological perception, emotional stress/relief & mental fruition). Bind BOTH folds together for every major trigger ([Lagna event] + [Moon mental experience]).`,
        `RULE 2 — TIER 1 DRIVERS: SLOW-PLANET INGRESSES, ADISARA, DOUBLE TRANSIT & PRE-COMPUTED ASPECTS (CRITICAL): Never judge a planet solely by the house it occupies—explicitly evaluate its pre-computed Aspects (Jupiter 5th/7th/9th, Saturn 3rd/7th/10th, Mars 4th/7th/8th, others 7th):`,
        `   - Whenever Jupiter or Saturn crosses a sign boundary (including prior-3-day boundary carry-over) under Adisara (urgent, impatient execution) or Vakra (contrarian karmic audit/reversal), treat BOTH its occupied L#/M# house AND its aspected L#/M# houses (especially ACTIVE DOUBLE-TRANSIT intersections where Jupiter & Saturn jointly touch a sign) as headline turning points.`,
        `   - For Finance & Wealth (part2_financialAndResources & finance_wealth), explicitly synthesize direct 2nd/4th/9th/11th occupancy PLUS any slow-planet 5th/7th/9th/3rd/10th aspects hitting 2nd(cash), 4th(assets/property), 6th(debt/service), 8th(joint/PF), or 11th(gains) from Lagna or Moon, honoring Jupiter as Chart Lagna/4th Lord & Dhana Karaka.`,
        `RULE 3 — TIER 2 DRIVERS: VIMSHOTTARI DASHA & NATAL PROMISE: D1/D9 set inherent natal capacity; MD/AD/PD lords commission what is deliverable—weigh each lord's natal dignity, D1 house ownerships & current L#/M# Gochara.`,
        `RULE 4 — TIER 3 DRIVERS: STATIONS, PARIVARTANA & NEECHA BHANGA: Contrast same-sign Stations BEFORE (stalled/internal audit) vs AFTER (external release) with dates; analyze Parivartana across Sign-Lord & Bhava exchange with dates; contrast Debilitation/Neecha Bhanga initial test vs cancellation reversal with dates.`,
        `RULE 5 — SAV, TARA & CHANDRA BALA: SAV >=28=smooth fruition, <25=friction; weigh favorable (Sampat,Kshema,Sadhana,Mitra,Parama Mitra) vs friction (Vipat,Pratyak,Naidhana) taras and daily Chandra Bala, flagging Chandrashtama (M8) cautions.`,
        `RULE 6 — SUPERSET GATE CORRELATION & STRICT MOON TIMING: Correlate Tier 1–3 drivers & Bhava lordships with AD Chamber & 3 Nakshatra Gates in "supersetSynthesisNote" (2-4 sentences) and "correlatedGateEvents" (10-18+ cards spanning ALL 7 portfolios Work,Money,Love,Health,Life,Friends,Trip—including Slow-Planet Boundary Ingresses/Adisara/Double-Transit, 3 Gates, AD Chamber & Parivartana/Neecha Bhanga/Stations). Mark "hasMoonSupport":true and cite "moonWindowDates" ONLY when Moon transits OR casts a 7th aspect onto involved sign(s) INSIDE that event's active date window; place ALL Moon-supported cards FIRST (descending by probabilityScore), followed by "hasMoonSupport":false ("latencyStatus":"dormant_latent","moonWindowDates":null).`,
        `RULE 7 — LANGUAGE & PROSE PURITY: Strict fluent English only (signs Aries..Pisces; planets Sun..Ketu; zero Tamil/Sanskrit terms). part1_probabilityAndScope, part2_financialAndResources & part3_microTimingWindow MUST be plain multi-paragraph English strings (no nested JSON or markdown fences).`
      ]
    : [
        `## 2. MANDATORY REASONING HIERARCHY (MOON-ONLY GOCHARA)`,
        `RULE 1 — MOON-ONLY GOCHARA: Evaluate all transits exclusively from Janma Rashi (Moon Sign); never reckon transits from Lagna or estimate D1 Lagna house strength using transits.`,
        `RULE 2 — TIER 1 DRIVERS: SLOW-PLANET INGRESSES, ADISARA, DOUBLE TRANSIT & PRE-COMPUTED ASPECTS (CRITICAL): Explicitly evaluate occupied AND pre-computed Moon-relative aspected houses (Jupiter 5th/7th/9th, Saturn 3rd/7th/10th, Mars 4th/7th/8th) including prior-3-day boundary shifts, Adisara acceleration, and Double-Transit overlaps. In Finance, cover 2nd/4th/9th/11th occupancy AND slow-planet aspects onto 2nd/4th/6th/8th/11th.`,
        `RULE 3 — NATAL PROMISE & DASHA: D1/D9 define fixed capacity & lordships; MD/AD/PD lords commission delivery across their ruled D1 houses + Moon-relative Gochara.`,
        `RULE 4 — STATIONS, PARIVARTANA & NEECHA BHANGA: Contrast before vs after stations with exact dates, cover Parivartana sign & bhava exchange, and Neecha Bhanga reversal.`,
        `RULE 5 — SAV, TARA & CHANDRA BALA: SAV >=28=smooth fruition, <25=friction; weigh Taras and flag Chandrashtama (M8) dates.`,
        `RULE 6 — STRICT MOON TIMING & CARDS: Cover Slow-Planet Ingresses/Adisara/Double-Transit, 3 Gates & Special Yogas across all 7 portfolios; mark "hasMoonSupport":true ONLY when Moon transits/7th-aspects inside the active window; sort Moon-supported cards FIRST.`,
        `RULE 7 — LANGUAGE & PROSE PURITY: Strict fluent English only (signs Aries..Pisces; planets Sun..Ketu; zero Tamil/Sanskrit terms).`
      ];
  return lawBlock.join('\n');
}

export type PromptEngineProfile = 'cloud' | 'local_private';

export function resolveEngineProfile(providerOrSlot?: string): PromptEngineProfile {
  const s = String(providerOrSlot || '').toLowerCase();
  if (s.includes('local') || s.includes('ollama') || s.includes('qwen') || s.includes('privateollama')) {
    return 'local_private';
  }
  return 'cloud';
}

export function buildDefaultDeliveryBlock(
  mode: 'v2' | 'v3' = 'v3',
  outputKind: 'json_report' | 'qa_chat' = 'json_report',
  engineProfile: PromptEngineProfile = 'cloud'
): string {
  const isDualFold = mode !== 'v2';
  const verTag = isDualFold ? 'V3' : 'V2';
  const isLocal = engineProfile === 'local_private';

  if (outputKind === 'qa_chat') {
    return [
      `## 3. DELIVERY & RESPONSE CONTRACT`,
      `- Answer strictly from the fixed D1/D9 charts in system context plus the monthly Ephemeris & Question in the user prompt.`,
      `- Apply ${isDualFold ? 'Dual-Fold reasoning (House from Lagna = concrete event; House from Moon = mental experience) plus Pre-Computed Aspects & Double-Transit synthesis' : 'Moon-relative Gochara reasoning plus Pre-Computed Aspects'}.`,
      `- When comparing two user scenarios, include a Markdown comparison table (| Scenario | Alignment Probability | Key Transit Mechanisms |) with percentage likelihoods and a decisive verdict.`,
      `- Output clean structured Markdown headings (###, ####), bullet lists, and bold dates/planets in English.${isLocal ? '\n- Be direct, date-specific, and event-focused—avoid repetitive filler.' : ''}`
    ].join('\n');
  }

  const profileDirective = isLocal
    ? `LOCAL PRIVATE MODEL EXECUTION DISCIPLINE:
- NEVER echo short template hints, generic shorthand codes, field type labels, or placeholder instructions as output values. Replace EVERY single field and array item with genuine predictions derived from this chart and ephemeris.
- Concise Event-First Style: You do NOT need bloated essays—write crisp, high-signal 2–4 sentence paragraphs in "part1–3" and "detailedParagraphs", and invest your precision into naming exact dates, houses (${isDualFold ? 'L#/M#' : 'M#'}), Pre-Computed Aspects, Double-Transit shifts, concrete "predictedSpecificEvents", concrete anatomical "vulnerableZones", and sharp "correlatedGateEvents" (8–14+ cards spanning active portfolios).`
    : `Replace every JSON slot below with rich multi-paragraph astrological synthesis grounded in exact houses (${isDualFold ? 'L#/M#' : 'M#'}), pre-computed aspects, Double-Transit overlaps, Dasha lords, and 10–18+ "correlatedGateEvents".`;

  const pHint1 = isLocal ? '2-3 crisp sentences on transit & Dasha triggers' : 'Detailed paragraph 1 covering core Dasha & Gochara triggers';
  const pHint2 = isLocal ? '2-3 crisp sentences on aspect, Moon window & practical outcome' : 'Detailed paragraph 2 covering aspect intersections, house lords & Moon windows';
  const pHint3 = isLocal ? 'Optional 2-sentence risk or timing caveat' : 'Detailed paragraph 3 covering D9 dignity nuances & risk/opportunity timing';
  const zHint1 = 'Primary vulnerable body system from 6th/8th/Gate seat (e.g. Stomach & digestion)';
  const zHint2 = 'Secondary stress or nervous/sleep area (e.g. Feet/sleep tension)';

  return [
    `## 3. DELIVERY & JSON OUTPUT CONTRACT`,
    `End "summarySentence" with a crisp 1-line summary naming the top active Slow-Planet Ingress/Adisara/Double-Transit, Parivartana, Neecha Bhanga & Station triggers plus likely events.`,
    profileDirective,
    `Return ONLY raw valid JSON matching this structure (no markdown fences or outside commentary):`,
    `{"promptVer":"${verTag}","summarySentence":"Plain English synthesis ending with 1-liner of active Slow-Planet Ingress/Adisara/Double-Transit, Parivartana, Neecha Bhanga & Station triggers & likely events.","natalPromiseVsTransitDelivery":{"natalPromiseScore":0.85,"natalPromiseVerdict":"Natal D1/D9 baseline verdict","transitDeliveryScore":0.78,"transitDeliveryVerdict":"Transit fruition via ${isDualFold ? 'Lagna L# + Moon M# Gochara' : 'Moon Gochara'}, Aspects, Vakra/Adisara & SAV","synthesisVerdict":"Combined natal promise vs monthly delivery verdict"},"part1_probabilityAndScope":"${isLocal ? 'Concise 2-paragraph factual scope, Slow-Planet/Double-Transit & Gate event probabilities.' : 'Multi-paragraph plain English scope, Slow-Planet/Double-Transit & Gate event probabilities.'}","part2_financialAndResources":"${isLocal ? 'Concise 2-paragraph factual analysis covering 2nd/4th/6th/9th/11th & slow-planet aspects.' : 'Multi-paragraph plain English capital, 2nd/4th/6th/9th/11th & slow-planet aspect analysis.'}","part3_microTimingWindow":"${isLocal ? 'Concise 2-paragraph favorable vs Chandrashtama lunar timing windows.' : 'Multi-paragraph plain English favorable vs cautionary lunar timing windows.'}","peakDateRange":"Month DD - DD, YYYY","overallConfidence":0.85,"supplementaryScenarios":[`,
    `{"id":"career_job","title":"Career, Job Search & Professional Standing","verdict":"Clear career verdict","confidenceScore":0.85,"timingWindow":"Month DD - DD, YYYY","astrologicalReasoning":"10th/6th, Dasha & Double-Transit drivers","practicalGuidance":"Actionable career advice","employmentStatusInference":{"status":"currently_serving|actively_seeking|sabbatical_unemployed","label":"Status label","indicatorColor":"green|yellow|amber|red","confidence":0.86,"inferenceReasoning":"10th/6th & Dasha basis"},"jobSearchAnalysis":{"momentum":"Momentum assessment","pastStruggleVsCurrentPhase":"Past vs current contrast","timingAuspiciousness":"Best interview/offer dates"},"newJobAcquisition":{"jobTypeAndMood":"Likely role environment","workplaceAtmosphere":"Team/leadership tone","comparisonWithCurrentRole":"Upgrade or lateral shift"},"existingJobPhase":{"currentPhaseNature":"Current role dynamics","retentionVsExitAdvice":"Hold vs transition guidance"},"detailedParagraphs":["${pHint1}","${pHint2}","${pHint3}"]},`,
    `{"id":"love_romance","title":"Love, Romance, Relationship & Interpersonal Horizon","verdict":"Clear relationship verdict","confidenceScore":0.78,"timingWindow":"Month DD - DD, YYYY","astrologicalReasoning":"5th/7th, Venus & Dasha drivers","practicalGuidance":"Actionable relationship advice","crushStatusInference":{"existingCrushTrajectory":"Trajectory with current interest","newCrushProbability":"High|Moderate|Low","newCrushDetails":"Specific social/transit trigger"},"romanceAtmosphere":{"emotionalWeather":"Emotional tone","chemistryRating":82},"manifestationPath":{"outcomeType":"classical_traditional_marriage|living_together_modern|exploratory_flutter|platonic_delayed","outcomeLabel":"Path label","manifestationLikelihood":"Percentage and condition","astrologicalPathReasoning":"5th/7th/D9/Dasha rationale"},"detailedParagraphs":["${pHint1}","${pHint2}","${pHint3}"]},`,
    `{"id":"health_vitality","title":"Health & Physical Vitality","verdict":"Clear health verdict","confidenceScore":0.76,"timingWindow":"Month DD - DD, YYYY","astrologicalReasoning":"6th/8th/1st, Saturn/Mars & Gate seat","practicalGuidance":"Actionable wellness advice","healthDetails":{"vulnerableZones":["${zHint1}","${zHint2}"],"mentalTranquilityAndStress":"Moon/4th/Chandrashtama stress note","holisticRemedies":"Specific diet/sleep/pacing remedy"},"detailedParagraphs":["${pHint1}","${pHint2}"]},`,
    `{"id":"finance_wealth","title":"Wealth, Cashflow & Assets","verdict":"Clear financial verdict","confidenceScore":0.84,"timingWindow":"Month DD - DD, YYYY","astrologicalReasoning":"2nd/4th/6th/11th & Jupiter/Saturn aspect drivers","practicalGuidance":"Actionable capital advice","financeDetails":{"liquidityVsOutflow":"Inflow vs expense balance","windfallAndSpeculation":"5th/8th/11th windfall or PF/tax view","debtAndAssetFinancing":"6th/4th loan or property asset view"},"detailedParagraphs":["${pHint1}","${pHint2}"]},`,
    `{"id":"family_home","title":"Domestic Peace & Family Harmony","verdict":"Clear domestic verdict","confidenceScore":0.88,"timingWindow":"Month DD - DD, YYYY","astrologicalReasoning":"4th/Moon/Jupiter & Dasha drivers","practicalGuidance":"Actionable family advice","familyDetails":{"domesticAmbiance":"Home atmosphere","maternalWellbeing":"Mother/elders outlook","propertyAndRelocation":"Real estate, vehicle or travel shift"},"detailedParagraphs":["${pHint1}","${pHint2}"]}`,
    `],"predictedSpecificEvents":[{"category":"visa_immigration|financial_pf|property_asset|career_milestone|health_alert","categoryLabel":"Readable category name","eventTitle":"Specific predicted real-world event","likelihood":"High|Moderate|Likely (score%)","likelihoodScore":0.82,"projectedWindow":"Month DD - DD, YYYY","astrologicalTrigger":"${isDualFold ? 'Lagna L# + Moon M# Gochara, Aspects & Dasha' : 'Moon Gochara, Aspects & Dasha'}","concreteImplication":"Exact practical consequence for the native","preventiveRemedy":"Targeted preventive or timing action"}],"supersetSynthesisNote":"2-4 sentence synthesis correlating House/Lordships, AD Chamber, 3 Gates & Moon windows.","correlatedGateEvents":[{"id":"corr-work-1","title":"Specific event title","portfolio":"Work|Money|Love|Health|Life|Friends|Trip","probabilityScore":84,"isHighProbability":true,"latencyStatus":"acute_moon_triggered|dormant_latent","hasMoonSupport":true,"moonWindowDates":"Mon DD-DD","correlatedHousesAndLordships":"Lagna H#/Moon H#(Sign,Lord)+AD link","nakshatraGateTrigger":"Gate name, transits & perspective","narrative":"House lordship + aspect/AD chamber + gate + exact Moon window"}]}`
  ].join('\n');
}

export function hashKvString(str: string): string {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return (h >>> 0).toString(16).padStart(8, '0');
}

export function isStalePlaceholderD9Override(val?: string): boolean {
  if (!val) return false;
  return val.includes('Standard D9 Navamsha dignity and planetary strength baseline align with natal grid');
}

export function buildKvCacheSystemPrefix(
  context: VedicHouseContext,
  mode: 'v2' | 'v3' = 'v3',
  overrides?: KvCacheBlockOverrides,
  outputKind: 'json_report' | 'qa_chat' = 'json_report',
  engineProfile: PromptEngineProfile = 'cloud'
): {
  systemPrompt: string;
  sections: {
    d1Chart: string;
    d9Chart: string;
    rules: string;
    delivery: string;
  };
  systemHash: string;
  systemChars: number;
  systemTokensEst: number;
} {
  const effectiveOverrides = overrides ?? (typeof window !== 'undefined' ? loadKvCacheConfig().overrides : {});
  const d1Chart = (effectiveOverrides.d1Chart && effectiveOverrides.d1Chart.trim()) || buildDefaultD1Block(context, mode);
  const rawD9Override = effectiveOverrides.d9Chart?.trim();
  const d9Chart = (rawD9Override && !isStalePlaceholderD9Override(rawD9Override))
    ? rawD9Override
    : buildDefaultD9Block(context);
  const rules = (effectiveOverrides.rules && effectiveOverrides.rules.trim()) || buildDefaultRulesBlock(mode);
  const delivery = (effectiveOverrides.delivery && effectiveOverrides.delivery.trim()) || buildDefaultDeliveryBlock(mode, outputKind, engineProfile);

  const systemPrompt = [d1Chart, d9Chart, rules, delivery].join('\n\n');
  return {
    systemPrompt,
    sections: { d1Chart, d9Chart, rules, delivery },
    systemHash: hashKvString(systemPrompt),
    systemChars: systemPrompt.length,
    systemTokensEst: Math.round(systemPrompt.length / 4)
  };
}

/**
 * Shared hierarchical Ephemeris (Tier 1 - Tier 5) builder used by both KV Ephemerals & Unified Prompts.
 * Eliminates 4x ingress repetition, surfaces pre-computed Parashara aspects & Double-Transit overlaps,
 * and trims verbose candidate boilerplate while retaining 100% of dates, houses, lords, and Moon windows.
 */
export function buildHierarchicalEphemerisSections(
  context: VedicHouseContext,
  mode: AstroPromptVersion = 'v3'
): {
  horizonLine: string;
  tier1Dasha: string;
  tier2SlowAndDoubleTransit: string;
  tier3FastAndSpecial: string;
  tier4LunarAndSav: string;
  tier5Superset: string;
  inquiryBlock: string;
} {
  const isDualFold = mode !== 'v2';
  const monthName = MONTH_NAMES[context.selectedMonth] || 'Active Month';
  const monthShort = monthName.slice(0, 3);
  const daysInMonth = new Date(context.selectedYear, context.selectedMonth + 1, 0).getDate();
  const mNumStr = String(context.selectedMonth + 1).padStart(2, '0');
  const tailNote = context.vedicSpecialEvents?.priorTailStartDate ? ` + Prior-3D Boundary ${context.vedicSpecialEvents.priorTailStartDate}` : '';
  const periodLabel = context.isMultiYearPrediction
    ? `${context.timelineStartDate}..${context.timelineEndDate}`
    : `${monthName} ${context.selectedYear}`;

  const lagnaIdx = getCleanSignIndex(context.natalLagnaSignName) || 9;
  const moonIdx = getCleanSignIndex(context.natalMoonSignName || context.natalJanmaStar?.rashi_name) || 8;
  const allTransits = context.allTransitPlacements || [];
  const taraMap = new Map<string, string>();
  (context.taraBalaTransitPlanets || []).forEach(tb => {
    taraMap.set(cleanPlanet(tb.graha_key), `${tb.taraName}(T${tb.taraNumber}:${tb.quality})`);
  });

  // Horizon
  const horizonLine = context.isMultiYearPrediction
    ? `## HORIZON: ${periodLabel} | Multi-Year Continuous Synthesis`
    : context.isComprehensiveMonthly || !context.houseNumber
      ? `## HORIZON: ${monthName} ${context.selectedYear} (${context.selectedYear}-${mNumStr}-01..${String(daysInMonth).padStart(2, '0')}${tailNote}) | Full 12-House Synthesis`
      : `## HORIZON: ${periodLabel} | House ${context.houseNumber} (${cleanSign(context.rashiName)}) Score:${(context.activationScore ?? 0).toFixed(2)}`;

  // Tier 1: Vimshottari Dasha Triad
  const dashaSummary = context.dashaDeliveryReport
    ? `Overall Delivery: ${(context.dashaDeliveryReport.overallIndex * 100).toFixed(0)}% (${context.dashaDeliveryReport.status}) | MD:${cleanPlanet(context.activeDasha.mahadasha)}(${context.dashaDeliveryReport.mdDignity},${context.dashaDeliveryReport.mdScore.toFixed(2)}) | AD:${cleanPlanet(context.activeDasha.antardasha)}(${context.dashaDeliveryReport.adDignity},${context.dashaDeliveryReport.adScore.toFixed(2)}) | PD:${cleanPlanet(context.activeDasha.pratyantardasha)}(${context.dashaDeliveryReport.pdDignity},${context.dashaDeliveryReport.pdScore.toFixed(2)})`
    : `MD:${cleanPlanet(context.activeDasha.mahadasha)} > AD:${cleanPlanet(context.activeDasha.antardasha)} > PD:${cleanPlanet(context.activeDasha.pratyantardasha)}`;

  const dashaDossier = (context.dashaLordsDossier || [])
    .slice(0, 3)
    .map(d => {
      const cleanLord = cleanPlanet(d.lordName);
      const owned = getOwnedHousesTag(cleanLord, lagnaIdx, moonIdx, isDualFold) || cleanInlineText(d.ownedHousesTitle);
      return `- ${d.role}[${cleanLord}]: Natal H${d.natalHouseOccupied}(${d.natalDignity}) | Lords:${owned}`;
    })
    .join('\n');

  const multiYearDasha = context.isMultiYearPrediction && context.multiYearDashas?.length
    ? `\nTimeline:\n` + context.multiYearDashas.map((d, idx) => `${idx + 1}|${d.startDate}..${d.endDate}|${cleanPlanet(d.mahadasha)}>${cleanPlanet(d.antardasha)}>${cleanPlanet(d.pratyantardasha)}`).join('\n')
    : '';

  const tier1Dasha = `## TIER 1 — VIMSHOTTARI DASHA (PD:${context.activeDasha.startDate}..${context.activeDasha.endDate})\n${dashaSummary}${dashaDossier ? `\n${dashaDossier}` : ''}${multiYearDasha}`;

  // Helper to format a planet with spans + pre-computed aspects
  const savMap = new Map<number, number>();
  (context.ashtakavargaPayload?.savPointsDistribution || []).forEach(s => {
    savMap.set(s.signIndex, s.points);
  });

  const formatPlanetWithSpansAndAspects = (gKey: string): string => {
    const tr = allTransits.find(t => cleanPlanet(t.graha_key) === gKey);
    const spans = (context.monthlyMotionSpans || []).filter(sp => cleanPlanet(sp.grahaKey) === gKey);
    const ownedTag = getOwnedHousesTag(gKey, lagnaIdx, moonIdx, isDualFold);
    const taraTag = taraMap.get(gKey);
    const metaBits = [ownedTag ? `Lords:${ownedTag}` : '', taraTag ? `Tara:${taraTag}` : ''].filter(Boolean).join(' | ');

    if (gKey === 'Moon') {
      if (!tr) return `- Moon: Moves every ~2.25 days across all 12 signs (see TIER 4 Lunar Timeline)`;
      const hL = tr.house_from_lagna;
      const hM = tr.house_from_moon || hL;
      const coord = isDualFold ? `L${hL}/M${hM}` : `M${hM}`;
      return `- Moon [Day-15 Ref Only — see TIER 4 for 2.25d progression]: ${cleanSign(tr.transit_rashi_name)}(${coord}) ${cleanDegree(tr.degree_sputa)} ${cleanStar(tr.nakshatra_name, tr.pada)}${taraTag ? ` | Tara:${taraTag}` : ''}`;
    }

    if (spans.length > 0) {
      const spanParts = spans.map(sp => {
        const sIdx = getCleanSignIndex(sp.signName) || (tr?.transit_rashi_index ?? 0);
        const sName = sIdx ? SIGN_LIST_EN[sIdx - 1] : cleanSign(sp.signName);
        const hL = sIdx ? ((sIdx - lagnaIdx + 12) % 12) + 1 : tr?.house_from_lagna || 1;
        const hM = sIdx ? ((sIdx - moonIdx + 12) % 12) + 1 : tr?.house_from_moon || 1;
        const coord = isDualFold ? `L${hL}/M${hM}` : `M${hM}`;
        const sav = savMap.get(sIdx) || (tr && cleanSign(tr.transit_rashi_name) === sName ? tr.sav_points : undefined);
        const savStr = sav ? `,SAV${sav}` : '';
        const mTag = sp.motionType === 'Adisara' ? 'ADISARA' : sp.isRetrograde ? 'VAKRA' : 'DIRECT';
        const refBits = tr && cleanSign(tr.transit_rashi_name) === sName
          ? [cleanDegree(tr.degree_sputa), cleanStar(tr.nakshatra_name, tr.pada)].filter(Boolean).join(' ')
          : '';
        const refMatch = refBits ? ` [Mid-month:${refBits}]` : '';
        const aspStr = sIdx ? formatParasharaAspects(gKey, sIdx, lagnaIdx, moonIdx, isDualFold) : '';
        const dayRangeLabel = sp.startDay === sp.endDay ? `Day ${sp.startDay}` : `Days ${sp.startDay}–${sp.endDay}`;
        return `${dayRangeLabel}: ${sName}(${coord}${savStr})[${mTag}]${refMatch}${aspStr ? ` -> Aspects: ${aspStr}` : ''}`;
      });
      return `- ${gKey}${metaBits ? ` [${metaBits}]` : ''}:\n  • ${spanParts.join('\n  • ')}`;
    }

    if (tr) {
      const sIdx = tr.transit_rashi_index || getCleanSignIndex(tr.transit_rashi_name);
      const coord = isDualFold ? `L${tr.house_from_lagna}/M${tr.house_from_moon || tr.house_from_lagna}` : `M${tr.house_from_moon || tr.house_from_lagna}`;
      const mTag = tr.motion_type === 'Adisara' ? 'ADISARA' : tr.motion_type === 'Vakra' || tr.is_retrograde ? 'VAKRA' : 'DIRECT';
      const savStr = tr.sav_points ? `,SAV${tr.sav_points}` : '';
      const aspStr = sIdx ? formatParasharaAspects(gKey, sIdx, lagnaIdx, moonIdx, isDualFold) : '';
      return `- ${gKey}${metaBits ? ` [${metaBits}]` : ''}: ${cleanSign(tr.transit_rashi_name)}(${coord}${savStr})[${mTag}] ${cleanDegree(tr.degree_sputa)} ${cleanStar(tr.nakshatra_name, tr.pada)}${aspStr ? ` -> Aspects: ${aspStr}` : ''}`;
    }
    return '';
  };

  // Tier 2: Slow Planets & Nodes + Prior 3-Day Boundary + Double Transit
  const priorTailBlock = (context.priorMonthTailSummary && context.priorMonthTailSummary.length > 0)
    ? `Prior-3-Day Boundary Continuity (leading into ${monthShort} 1):\n${context.priorMonthTailSummary.map(l => `- ${cleanInlineText(l)}`).join('\n')}`
    : '';
  const slowLines = ['Jupiter', 'Saturn', 'Rahu', 'Ketu'].map(formatPlanetWithSpansAndAspects).filter(Boolean).join('\n');
  const doubleTransitLines = computeDoubleTransitWindows(context, lagnaIdx, moonIdx, isDualFold);
  const doubleTransitBlock = doubleTransitLines.length > 0
    ? `ACTIVE DOUBLE-TRANSIT (JUPITER + SATURN) WINDOWS:\n${doubleTransitLines.join('\n')}`
    : '';

  const tier2SlowAndDoubleTransit = [
    `## TIER 2 — SLOW-PLANET & NODAL GOCHARA (PRIOR-3D, SPAN, LORDSHIP & ASPECTS)`,
    priorTailBlock,
    slowLines,
    doubleTransitBlock
  ].filter(Boolean).join('\n');

  // Tier 3: Fast Planets + Deduplicated Ingresses & Special Yogas
  const fastLines = ['Sun', 'Mars', 'Mercury', 'Venus', 'Moon'].map(formatPlanetWithSpansAndAspects).filter(Boolean).join('\n');
  const vse = context.vedicSpecialEvents;
  const spParts: string[] = [];
  if (vse) {
    if (vse.boundaryIngresses && vse.boundaryIngresses.length > 0) {
      const ingCompact = vse.boundaryIngresses.map(ing => {
        const coord = isDualFold ? `L${ing.toHouseFromLagna}/M${ing.toHouseFromMoon}` : `M${ing.toHouseFromMoon}`;
        const boundaryFlag = ing.isPriorMonthBoundary ? '[PRIOR_BOUNDARY]' : '';
        const mFlag = ing.motionType !== 'Normal' ? `[${ing.motionType.toUpperCase()}]` : '';
        return `${cleanPlanet(ing.grahaKey)} ${cleanSign(ing.fromSignName)}->${cleanSign(ing.toSignName)} on ${ing.ingressDate}(${coord})${boundaryFlag}${mFlag}`;
      });
      spParts.push(`SIGN_INGRESSES(${ingCompact.length}): ${ingCompact.join(' | ')}`);
    } else if (context.monthlyIngressEvents && context.monthlyIngressEvents.length > 0) {
      const onlyActualChanges = context.monthlyIngressEvents
        .filter(e => e.includes('enters') || e.includes('PRIOR BOUNDARY') || e.includes('stations'))
        .slice(0, 10)
        .map(cleanInlineText);
      if (onlyActualChanges.length > 0) {
        spParts.push(`SIGN_INGRESSES: ${onlyActualChanges.join(' | ')}`);
      }
    }
    if (vse.adisaraWindows && vse.adisaraWindows.length > 0) {
      for (const aw of vse.adisaraWindows) {
        const coord = isDualFold ? `L${aw.houseFromLagna}/M${aw.houseFromMoon}` : `M${aw.houseFromMoon}`;
        spParts.push(`ADISARA_FAST: ${cleanPlanet(aw.grahaKey)} across ${aw.signNames.map(cleanSign).join('->')} [${aw.startDate}..${aw.endDate}](${coord}) — accelerated, impatient execution`);
      }
    }
    if (vse.sameSignStations && vse.sameSignStations.length > 0) {
      for (const s of vse.sameSignStations) {
        const coord = isDualFold ? `L${s.houseFromLagna}/M${s.houseFromMoon}` : `M${s.houseFromMoon}`;
        spParts.push(`STATION: ${cleanPlanet(s.grahaKey)} ${s.turnType} in ${cleanSign(s.signName)}(${coord}) on ${s.stationDate} [Before ${s.beforeRange} | After ${s.afterRange}] — ${cleanInlineText(s.eventImpact)}`);
      }
    } else {
      spParts.push(`STATIONS: None`);
    }
    if (vse.parivartanaYogas && vse.parivartanaYogas.length > 0) {
      for (const p of vse.parivartanaYogas) {
        const exchangeCoord = isDualFold
          ? `L${p.lagnaHouseA}<->L${p.lagnaHouseB} / M${p.moonHouseA}<->M${p.moonHouseB}`
          : `M${p.moonHouseA}<->M${p.moonHouseB}`;
        spParts.push(`PARIVARTANA: ${cleanPlanet(p.grahaA)}<->${cleanPlanet(p.grahaB)} (${cleanSign(p.signAName)}<->${cleanSign(p.signBName)}, ${exchangeCoord}) [${p.startDate}..${p.endDate}] — ${cleanInlineText(p.predictedEvents)}`);
      }
    } else {
      spParts.push(`PARIVARTANA: None`);
    }
    if (vse.debilitationEvents && vse.debilitationEvents.length > 0) {
      for (const d of vse.debilitationEvents) {
        const coord = isDualFold ? `L${d.houseFromLagna}/M${d.houseFromMoon}` : `M${d.houseFromMoon}`;
        const reasons = Array.from(new Set(d.cancellationReasons.map(r => cleanInlineText(r.replace(/\s*\(H\d+ from (Moon|Lagna)\)/g, ''))))).slice(0, 3).join('; ');
        spParts.push(`${d.neechaBhangaStatus}: ${cleanPlanet(d.grahaKey)} in ${cleanSign(d.signName)}(${coord}) [${d.startDate}..${d.endDate}, ${d.motionState}]${reasons ? ` | Factors:${reasons}` : ''} — ${cleanInlineText(d.predictedEvents)}`);
      }
    } else {
      spParts.push(`NEECHA_BHANGA: None`);
    }
  }
  const multiYearMaj = context.isMultiYearPrediction && context.multiYearMajorTransits?.length
    ? `MULTI_YEAR_MAJORS:\n` + context.multiYearMajorTransits.map(t => `- ${cleanPlanet(t.grahaKey)}:${cleanSign(t.signName)} ${isDualFold && t.houseFromLagna ? `L${t.houseFromLagna}/M${t.houseFromMoon}` : `M${t.houseFromMoon}`} ${t.startDate}..${t.endDate}[${t.isRetrograde ? 'VAKRA' : 'DIR'}]`).join('\n')
    : '';

  const tier3FastAndSpecial = [
    `## TIER 3 — FAST-PLANET PHASES, INGRESSES & SPECIAL YOGAS`,
    fastLines,
    spParts.length > 0 ? `Special Phenomena:\n- ${spParts.join('\n- ')}` : '',
    multiYearMaj
  ].filter(Boolean).join('\n');

  // Tier 4: Lunar Timing & SAV
  const chandraLine = (context.chandraBalaDailyTimeline || [])
    .map(c => `${c.dayRange}:${cleanSign(c.moonSignName)}(${cleanInlineText(c.moonStarName)},T${c.taraBala.taraNumber}) M${c.houseFromNatalMoon}${c.isChandrashtama ? '[CHANDRASHTAMA]' : c.isFavorable ? '[Fav]' : ''}`)
    .join(' | ');
  const savLine = context.ashtakavargaPayload?.savPointsDistribution?.length
    ? context.ashtakavargaPayload.savPointsDistribution.map(s => `H${s.houseNumber}:${s.points}`).join(' | ')
    : '';
  const multiYearMoons = context.isMultiYearPrediction && context.multiYearMoonTransits?.length
    ? `\nMoon Ingresses(${context.multiYearMoonTransits.length}): ` + context.multiYearMoonTransits.slice(0, 60).map(m => `${m.startDate}..${m.endDate}:${cleanSign(m.signName)} M${m.houseFromMoon}${m.isChandrashtama ? '[AST]' : ''}`).join(' | ')
    : '';

  const tier4LunarAndSav = [
    `## TIER 4 — LUNAR TIMING (CHANDRA BALA & CHANDRASHTAMA) & SAV`,
    chandraLine ? `Lunar Progression: ${chandraLine}` : '',
    savLine ? `SAV Capacity: ${savLine}` : '',
    multiYearMoons
  ].filter(Boolean).join('\n');

  // Tier 5: Superset AD Chamber, 3 Gates, Compact House Map & Candidates
  let tier5Superset = '';
  if (context.eventManufacturingSuperset) {
    const ss = context.eventManufacturingSuperset;
    const ad = ss.adChamberSummary;
    const ruledStr = ad.ruledHouses.length > 0
      ? ad.ruledHouses.map(rh => `${isDualFold ? `L${rh.houseFromLagna}/M${rh.houseFromRashi}` : `M${rh.houseFromRashi}`}(${cleanSign(rh.rashiName)},Occ:${rh.occupants.join(',') || '-'},Asp:${rh.aspectingGrahas.join(',') || '-'})`).join('; ')
      : '';
    const gatesStr = ss.gates.map(g => {
      const grahas = g.activeGrahasInGate.map(ag => `${ag.name}${ag.passageWindow ? `(${ag.passageWindow})` : ''}`).join(',') || 'Moon-only';
      return `- G${g.gateIndex}:${g.nakshatraName}(${cleanSign(g.rashiName)},${isDualFold ? `L${g.houseFromLagna}/M${g.houseFromRashi}` : `M${g.houseFromRashi}`}) | Seat:${g.anatomicalSeat} | Themes:${g.significations} | Moon:${g.moonIngressWindow || '-'} | Grahas:${grahas}`;
    }).join('\n');

    // Compact House-Gate Map enriched with active Jupiter/Saturn aspects
    const aspectMapBySign = new Map<number, string[]>();
    for (const gp of ['Jupiter', 'Saturn', 'Mars', 'Rahu', 'Ketu']) {
      const spans = (context.monthlyMotionSpans || []).filter(sp => cleanPlanet(sp.grahaKey) === gp);
      if (spans.length > 0) {
        for (const sp of spans) {
          const sIdx = getCleanSignIndex(sp.signName);
          if (!sIdx) continue;
          for (const asp of getParasharaAspectEntries(gp, sIdx, lagnaIdx, moonIdx)) {
            const arr = aspectMapBySign.get(asp.targetSignIdx) || [];
            const rng = spans.length > 1 ? ` ${sp.startDay}-${sp.endDay}` : '';
            arr.push(`${gp}(${asp.label}${rng})`);
            aspectMapBySign.set(asp.targetSignIdx, arr);
          }
        }
      } else {
        const tr = allTransits.find(t => cleanPlanet(t.graha_key) === gp);
        const sIdx = tr ? (tr.transit_rashi_index || getCleanSignIndex(tr.transit_rashi_name)) : 0;
        if (sIdx) {
          for (const asp of getParasharaAspectEntries(gp, sIdx, lagnaIdx, moonIdx)) {
            const arr = aspectMapBySign.get(asp.targetSignIdx) || [];
            arr.push(`${gp}(${asp.label})`);
            aspectMapBySign.set(asp.targetSignIdx, arr);
          }
        }
      }
    }

    const houseMapLines = ss.houseLordshipToGateLinks.map(l => {
      const sIdx = getCleanSignIndex(l.rashiName);
      const aspArr = sIdx ? Array.from(new Set(aspectMapBySign.get(sIdx) || [])) : [];
      const coord = isDualFold ? `L${l.houseFromLagna}/M${l.houseFromMoon}` : `M${l.houseFromMoon}`;
      return `- ${coord} ${cleanSign(l.rashiName)}(Lord:${l.rashiLord}): N[${l.natalOccupants.join(',') || '-'}] T[${l.transitOccupants.join(',') || '-'}] Asp[${aspArr.join(',') || '-'}]${l.isActivatedByAdLordship ? ' AD' : ''}${l.matchingGateNakshatra ? ` Gate:${l.matchingGateNakshatra}` : ''} Moon:${l.moonIgnitionDates || '-'}`;
    }).join('\n');

    const evStr = ss.candidateOrSynthesizedEvents.slice(0, 12).map((ev, idx) => {
      const moonTag = ev.hasMoonSupport && ev.moonWindowDates ? `Moon:${ev.moonWindowDates}` : 'Latent(No-Moon)';
      return `${idx + 1}.[${ev.portfolio}] ${ev.title} (${ev.probabilityScore}%,${moonTag}) | ${ev.correlatedHousesAndLordships} | ${ev.nakshatraGateTrigger}`;
    }).join('\n');

    tier5Superset = cleanInlineText([
      `## TIER 5 — SUPERSET AD CHAMBER, 3 GATES & CANDIDATE TRIGGERS (MD:${ss.selectedMd}>AD:${ss.selectedAd}>PD:${ss.deliveringHandClean})`,
      `AD_CHAMBER:${ad.adCleanName}@${cleanSign(ad.adNatalRashiName)}(${isDualFold ? `L${ad.adNatalHouseFromLagna}/M${ad.adNatalHouseFromRashi}` : `M${ad.adNatalHouseFromRashi}`}) ${ad.polarityLabel}(${ad.netScore}) | PeakGate:${ad.peakVentingGate}${ruledStr ? ` | AD_Ruled:${ruledStr}` : ''}`,
      `GATES:\n${gatesStr}`,
      `HOUSE_ASPECT_MAP:\n${houseMapLines}`,
      `CANDIDATE_TRIGGERS:\n${evStr}`
    ].join('\n'));
  }

  const queryText = context.userQuery || `Comprehensive monthly Vedic evaluation for ${periodLabel}.`;
  const inquiryBlock = `## INQUIRY\nQuery: "${queryText}"`;

  return {
    horizonLine,
    tier1Dasha,
    tier2SlowAndDoubleTransit,
    tier3FastAndSpecial,
    tier4LunarAndSav,
    tier5Superset,
    inquiryBlock
  };
}

/**
 * Builds STRICTLY Dynamic Ephemeris + Question Prompt (NO D1/D9/Rules/JSON Schema boilerplate).
 * Strictly hierarchical Tier 1-5 layout with zero repetition and full aspect/Double-Transit visibility.
 */
export function buildEphemeralsOnlyPrompt(
  context: VedicHouseContext,
  mode: AstroPromptVersion = 'v3',
  maxTokenBudget = 2800
): {
  ephemeralsPrompt: string;
  chars: number;
  tokensEst: number;
  withinBudget: boolean;
} {
  const s = buildHierarchicalEphemerisSections(context, mode);
  const candidateSections = [
    s.horizonLine,
    s.tier1Dasha,
    s.tier2SlowAndDoubleTransit,
    s.tier3FastAndSpecial,
    s.tier4LunarAndSav,
    s.tier5Superset,
    s.inquiryBlock
  ].filter(Boolean);

  let combined = candidateSections.join('\n\n');
  const maxChars = Math.max(4000, maxTokenBudget * 4 - 200);
  if (combined.length > maxChars) {
    // Preserve Tier 1 (Dasha), Tier 2 (Slow Planets, Prior-3D, Aspects & Double-Transit), Tier 3 (Ingresses/Special), and Inquiry 100%
    const prioritySections = [
      s.horizonLine,
      s.tier1Dasha,
      s.tier2SlowAndDoubleTransit,
      s.tier3FastAndSpecial,
      s.tier4LunarAndSav.slice(0, 1200),
      s.tier5Superset.slice(0, 2400),
      s.inquiryBlock
    ].filter(Boolean);
    combined = prioritySections.join('\n\n').slice(0, maxChars);
  }

  const tokensEst = Math.round(combined.length / 4);
  return {
    ephemeralsPrompt: combined,
    chars: combined.length,
    tokensEst,
    withinBudget: tokensEst <= maxTokenBudget
  };
}

