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
    .replace(/\b(?:Chandra|Chandran|Soma)\b/gi, 'Moon');
  return res.replace(/[ \t]+/g, ' ').trim();
}

export function buildDefaultD1Block(context: VedicHouseContext): string {
  const lagna = cleanSign(context.natalLagnaSignName) || 'Ascendant';
  const moon = cleanSign(context.natalMoonSignName || context.natalJanmaStar?.rashi_name) || 'Moon Sign';
  const jStar = cleanStar(context.natalJanmaStar?.nakshatra_name || 'Anuradha', context.natalJanmaStar?.pada || 2);
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
    `## NATAL D1 CHART (FIXED BIRTH PROMISE)`,
    `Lagna:${lagna} | JanmaRashi:${moon} | JanmaStar:${jStar}`,
    `D1: ${d1}`,
    `SAV_BASELINE: ${savBaseline}`,
    `BHAVA_KARAKAS: ${karakas}`
  ].join('\n');
}

export function buildDefaultD9Block(context: VedicHouseContext): string {
  const d9 = (context.flattenedNatalD9 && context.flattenedNatalD9.length > 0)
    ? context.flattenedNatalD9.map(p => `${cleanPlanet(p.body_name)}:${cleanSign(p.rashi_name)} ${cleanDegree(p.degree_sputa)}`).join(' | ')
    : 'Standard D9 Navamsha dignity and planetary strength baseline align with natal grid.';
  return [
    `## NATAL D9 NAVAMSHA CHART (FIXED DIVISIONAL STRENGTH)`,
    `D9: ${d9}`
  ].join('\n');
}

export function buildDefaultRulesBlock(mode: 'v2' | 'v3' = 'v3'): string {
  const isDualFold = mode !== 'v2';
  const lawBlock = isDualFold
    ? [
        `## INTERPRETATION & REASONING RULES`,
        `1. TWO-FOLD GOCHARA LAW: Every transit planet acts simultaneously across BOTH Lagna (L#) and Janma Rashi / Moon (M#):`,
        `   - LAGNA FOLD (L# from Ascendant): Determines the OBJECTIVE LIVED EVENT & D1 BHAVA EXECUTION (which concrete life house, lordship & physical reality occurs) and modulates active D1 Lagna house strength via transits, aspects, lord placement & SAV.`,
        `   - MOON FOLD (M# from Janma Rashi): Determines PSYCHOLOGICAL SYNTHESIS & MENTAL FRUITION (how the mind feels, perceives & handles that event via Chandra/Tara Bala & Moon-house distance).`,
        `2. DUAL SYNTHESIS REQUIRED: Bind BOTH folds for every major transit, station, Parivartana & Neecha Bhanga ([Lagna lived event] + [Moon mental experience]).`,
        `3. NATAL PROMISE & D1 STRENGTH: D1/D9 from Lagna set inherent natal capacity; transits + SAV actively strengthen or pressure D1 Lagna houses and judge sky fruitfulness.`,
        `4. DASHA SANCTION: Vimshottari MD/AD/PD lords commission delivery; evaluate D1 house lordships plus both L# and M# transit states.`,
        `5. SAV & MOTION: SAV >=28=effortless fruition, <25=resistance; Vakra=unconventional/non-linear karmic settling; Adisara=urgent/accelerated execution.`,
        `6. TARA & CHANDRA BALA: Weigh favorable (Sampat,Kshema,Sadhana,Mitra,Parama Mitra) vs friction (Vipat,Pratyak,Naidhana) taras; flag Chandrashtama (8th Moon).`,
        `7. STATIONS, PARIVARTANA & NEECHA BHANGA: For same-sign Retrograde<->Direct stations contrast BEFORE (stalled/internal/audit) vs AFTER (external release) using exact dates; for Parivartana analyze BOTH Sign-Lord exchange AND Bhava exchange with exact dates; for Debilitation/Neecha Bhanga explain initial test vs cancellation reversal; end "summarySentence" with a crisp 1-line summary naming active triggers & likely events.`,
        `8. SUPERSET GATE CORRELATION & STRICT MOON TIMING: Correlate major Houses/Lordships with AD Chamber & 3 Nakshatra Gates. Mark "hasMoonSupport":true ONLY if Moon transits OR casts a 7th direct aspect onto involved sign(s) INSIDE the active event date window; put all Moon-supported events FIRST (sorted descending by probabilityScore), followed by background effort events ("hasMoonSupport":false,"latencyStatus":"dormant_latent","moonWindowDates":null).`,
        `9. LANGUAGE: Strict fluent English only (signs Aries..Pisces; planets Sun..Ketu; zero Tamil/Sanskrit terms).`
      ]
    : [
        `## INTERPRETATION & REASONING RULES`,
        `1. MOON-ONLY GOCHARA: Evaluate all transits exclusively from Janma Rashi (Moon Sign); never reckon transits from Lagna or estimate D1 Lagna house strength using transits.`,
        `2. NATAL PROMISE VS TRANSIT: D1 and D9 from Lagna define fixed natal capacity & lordships; Gochara from Moon measures what is fruitfully possible now.`,
        `3. KARAKATWAS & DASHA: MD/AD/PD lords define who is commissioned to deliver; evaluate D1 house lordships plus Moon-relative Gochara.`,
        `4. SAV & MOTION: SAV >=28=effortless fruition, <25=resistance; Vakra=karmic review; Adisara=accelerated push.`,
        `5. STATIONS, PARIVARTANA & NEECHA BHANGA: Contrast before vs after stations using exact dates, cover Parivartana sign & bhava exchange, and Neecha Bhanga cancellation reversal.`,
        `6. STRICT MOON TIMING & CARDS: Mark "hasMoonSupport":true ONLY when Moon transits/7th-aspects inside the active window; sort Moon-supported events FIRST.`,
        `7. LANGUAGE: Strict fluent English only (signs Aries..Pisces; planets Sun..Ketu; zero Tamil/Sanskrit terms).`
      ];
  return lawBlock.join('\n');
}

export function buildDefaultDeliveryBlock(
  mode: 'v2' | 'v3' = 'v3',
  outputKind: 'json_report' | 'qa_chat' = 'json_report'
): string {
  const isDualFold = mode !== 'v2';
  const verTag = isDualFold ? 'V3' : 'V2';
  if (outputKind === 'qa_chat') {
    return [
      `## DELIVERY & RESPONSE CONTRACT`,
      `- Answer strictly from the fixed D1/D9 charts in system context plus the monthly Ephemeris & Question in the user prompt.`,
      `- Apply ${isDualFold ? 'Dual-Fold reasoning (House from Lagna = concrete event; House from Moon = mental experience)' : 'Moon-relative Gochara reasoning'}.`,
      `- When comparing two user scenarios, include a Markdown comparison table (| Scenario | Alignment Probability | Key Transit Mechanisms |) with percentage likelihoods and a decisive verdict.`,
      `- Output clean structured Markdown headings (###, ####), bullet lists, and bold dates/planets in English.`
    ].join('\n');
  }

  return [
    `## DELIVERY & JSON OUTPUT CONTRACT`,
    `PROSE RULE: part1_probabilityAndScope, part2_financialAndResources, part3_microTimingWindow MUST be plain-text multi-paragraph English strings (zero nested JSON/code fences).`,
    `Return ONLY raw valid JSON matching this schema:`,
    `{"promptVer":"${verTag}","summarySentence":"Plain English synthesis ending with 1-liner of active Parivartana/Neecha Bhanga/station triggers & likely events.","natalPromiseVsTransitDelivery":{"natalPromiseScore":0.85,"natalPromiseVerdict":"string","transitDeliveryScore":0.78,"transitDeliveryVerdict":"string(${isDualFold ? 'Lagna L# + Moon M# Gochara' : 'Moon Gochara'},Vakra/Adisara,SAV)","synthesisVerdict":"string"},"part1_probabilityAndScope":"Multi-paragraph plain English scope & event probabilities.","part2_financialAndResources":"Multi-paragraph plain English capital, 2nd/4th/9th/11th analysis.","part3_microTimingWindow":"Multi-paragraph plain English favorable vs cautionary lunar timing windows.","peakDateRange":"Month DD - DD, YYYY","overallConfidence":0.85,"supplementaryScenarios":[`,
    `{"id":"career_job","title":"Career, Job Search & Professional Standing","verdict":"string","confidenceScore":0.85,"timingWindow":"Month DD - DD, YYYY","astrologicalReasoning":"10th/6th/Dasha","practicalGuidance":"string","employmentStatusInference":{"status":"currently_serving|actively_seeking|sabbatical_unemployed","label":"string","indicatorColor":"green|yellow|amber|red","confidence":0.86,"inferenceReasoning":"10th/6th & Dasha"},"jobSearchAnalysis":{"momentum":"string","pastStruggleVsCurrentPhase":"string","timingAuspiciousness":"string"},"newJobAcquisition":{"jobTypeAndMood":"string","workplaceAtmosphere":"string","comparisonWithCurrentRole":"string"},"existingJobPhase":{"currentPhaseNature":"string","retentionVsExitAdvice":"string"},"detailedParagraphs":["p1","p2","p3"]},`,
    `{"id":"love_romance","title":"Love, Romance, Relationship & Interpersonal Horizon","verdict":"string","confidenceScore":0.78,"timingWindow":"Month DD - DD, YYYY","astrologicalReasoning":"5th/7th/Venus/Dasha","practicalGuidance":"string","crushStatusInference":{"existingCrushTrajectory":"string","newCrushProbability":"High|Moderate|Low","newCrushDetails":"string"},"romanceAtmosphere":{"emotionalWeather":"string","chemistryRating":82},"manifestationPath":{"outcomeType":"classical_traditional_marriage|living_together_modern|exploratory_flutter|platonic_delayed","outcomeLabel":"string","manifestationLikelihood":"string","astrologicalPathReasoning":"string"},"detailedParagraphs":["p1","p2","p3"]},`,
    `{"id":"health_vitality","title":"Health & Physical Vitality","verdict":"string","confidenceScore":0.76,"timingWindow":"Month DD - DD, YYYY","astrologicalReasoning":"6th/8th/Saturn/Mars","practicalGuidance":"string","healthDetails":{"vulnerableZones":["z1","z2"],"mentalTranquilityAndStress":"string","holisticRemedies":"string"},"detailedParagraphs":["p1","p2"]},`,
    `{"id":"finance_wealth","title":"Wealth, Cashflow & Assets","verdict":"string","confidenceScore":0.84,"timingWindow":"Month DD - DD, YYYY","astrologicalReasoning":"2nd/4th/11th","practicalGuidance":"string","financeDetails":{"liquidityVsOutflow":"string","windfallAndSpeculation":"string","debtAndAssetFinancing":"string"},"detailedParagraphs":["p1","p2"]},`,
    `{"id":"family_home","title":"Domestic Peace & Family Harmony","verdict":"string","confidenceScore":0.88,"timingWindow":"Month DD - DD, YYYY","astrologicalReasoning":"4th/Moon/Dasha","practicalGuidance":"string","familyDetails":{"domesticAmbiance":"string","maternalWellbeing":"string","propertyAndRelocation":"string"},"detailedParagraphs":["p1","p2"]}`,
    `],"predictedSpecificEvents":[{"category":"visa_immigration|financial_pf|property_asset|career_milestone|health_alert","categoryLabel":"string","eventTitle":"string","likelihood":"string","likelihoodScore":0.82,"projectedWindow":"Month DD - DD, YYYY","astrologicalTrigger":"${isDualFold ? 'Lagna L# + Moon M# Gochara & Dasha' : 'Moon Gochara & Dasha'}","concreteImplication":"string","preventiveRemedy":"string"}],"supersetSynthesisNote":"2-4 sentence synthesis correlating House/Lordships, AD Chamber, 3 Gates & Moon windows.","correlatedGateEvents":[{"id":"corr-work-1","title":"string","portfolio":"Work|Money|Love|Health|Life|Friends|Trip","probabilityScore":84,"isHighProbability":true,"latencyStatus":"acute_moon_triggered|dormant_latent","hasMoonSupport":true,"moonWindowDates":"Mon DD-DD","correlatedHousesAndLordships":"Lagna H#/Moon H#(Sign,Lord)+AD link","nakshatraGateTrigger":"Gate name, transits & perspective","narrative":"house lordship + AD chamber + gate + timing"}]}`
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

export function buildKvCacheSystemPrefix(
  context: VedicHouseContext,
  mode: 'v2' | 'v3' = 'v3',
  overrides?: KvCacheBlockOverrides,
  outputKind: 'json_report' | 'qa_chat' = 'json_report'
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
  const d1Chart = (effectiveOverrides.d1Chart && effectiveOverrides.d1Chart.trim()) || buildDefaultD1Block(context);
  const d9Chart = (effectiveOverrides.d9Chart && effectiveOverrides.d9Chart.trim()) || buildDefaultD9Block(context);
  const rules = (effectiveOverrides.rules && effectiveOverrides.rules.trim()) || buildDefaultRulesBlock(mode);
  const delivery = (effectiveOverrides.delivery && effectiveOverrides.delivery.trim()) || buildDefaultDeliveryBlock(mode, outputKind);

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
 * Builds STRICTLY Dynamic Ephemeris + Question Prompt (NO D1/D9/Rules/JSON Schema boilerplate).
 * Strictly caps output size <= maxTokenBudget (default 2,000 tokens / ~7,600 chars) so KV-cached engines
 * only ever evaluate fresh transit ephemeris and user questions.
 */
export function buildEphemeralsOnlyPrompt(
  context: VedicHouseContext,
  mode: AstroPromptVersion = 'v3',
  maxTokenBudget = 2000
): {
  ephemeralsPrompt: string;
  chars: number;
  tokensEst: number;
  withinBudget: boolean;
} {
  const isDualFold = mode !== 'v2';
  const monthName = MONTH_NAMES[context.selectedMonth] || 'Active Month';
  const periodLabel = context.isMultiYearPrediction
    ? `${context.timelineStartDate}..${context.timelineEndDate}`
    : `${monthName} ${context.selectedYear}`;

  // 1. Dynamic Transits
  const allTransits = context.allTransitPlacements || [];
  const transitsBlock = allTransits.length > 0
    ? allTransits.map(t => {
        const hLagna = t.house_from_lagna;
        const hMoon = t.house_from_moon || t.house_from_lagna;
        const houseCoord = isDualFold ? `L${hLagna} M${hMoon}` : `M${hMoon}`;
        const motion = t.motion_type === 'Vakra' ? 'VAKRA' : t.motion_type === 'Adisara' ? 'ADISARA' : 'Direct';
        const sav = t.sav_points ? ` SAV${t.sav_points}` : '';
        return `${cleanPlanet(t.graha_key)}:${cleanSign(t.transit_rashi_name)} ${houseCoord}${sav} ${motion} ${cleanDegree(t.degree_sputa)} ${cleanStar(t.nakshatra_name, t.pada)}`;
      }).join('\n')
    : 'Transits computed per ephemeris.';

  // 2. Dynamic Dasha
  const dashaSummary = context.dashaDeliveryReport
    ? `Delivery:${(context.dashaDeliveryReport.overallIndex * 100).toFixed(0)}%(${context.dashaDeliveryReport.status}) | MD:${cleanPlanet(context.activeDasha.mahadasha)}(${context.dashaDeliveryReport.mdDignity}) | AD:${cleanPlanet(context.activeDasha.antardasha)}(${context.dashaDeliveryReport.adDignity}) | PD:${cleanPlanet(context.activeDasha.pratyantardasha)}(${context.dashaDeliveryReport.pdDignity})`
    : `MD:${cleanPlanet(context.activeDasha.mahadasha)} > AD:${cleanPlanet(context.activeDasha.antardasha)} > PD:${cleanPlanet(context.activeDasha.pratyantardasha)}`;

  const dashaDossier = (context.dashaLordsDossier || [])
    .slice(0, 3)
    .map(d => `${d.role}[${cleanPlanet(d.lordName)}]: H${d.natalHouseOccupied}(${d.natalDignity}) | ${cleanInlineText(d.ownedHousesTitle)}`)
    .join('\n');

  // 3. Ingresses & Motion Phases
  const ingressLines = (context.monthlyIngressEvents || []).slice(0, 6).map(e => `- ${cleanInlineText(e)}`).join('\n');
  const motionSpans = (context.monthlyMotionSpans || []).slice(0, 8)
    .map(sp => `${cleanPlanet(sp.grahaKey)}:${cleanSign(sp.signName)} D${sp.startDay}-${sp.endDay}[${sp.isRetrograde ? 'VAKRA' : 'DIR'}]`)
    .join(' | ');

  // 4. Special Window Phenomena (Parivartana / Neecha Bhanga / Stations)
  const specialBlock = context.vedicSpecialEvents?.promptMarkdownBlock
    ? cleanInlineText(context.vedicSpecialEvents.promptMarkdownBlock).slice(0, 1400)
    : (context.vedicSpecialEvents?.consolidatedOneLiner ? `SPECIAL: ${cleanInlineText(context.vedicSpecialEvents.consolidatedOneLiner)}` : '');

  // 5. Compact Tara Bala & Chandra Bala highlights
  const taraLine = (context.taraBalaTransitPlanets || [])
    .map(t => `${cleanPlanet(t.graha_key)}:${t.taraName}(T${t.taraNumber})`)
    .join(' | ');
  const chandraLine = (context.chandraBalaDailyTimeline || [])
    .map(c => `${c.dayRange}:${cleanSign(c.moonSignName)} M${c.houseFromNatalMoon}${c.isChandrashtama ? '[AST]' : c.isFavorable ? '[Fav]' : ''}`)
    .join(' | ');

  // 6. Compact AD Chamber + 3 Gates + Top Candidate Events
  let supersetCompact = '';
  if (context.eventManufacturingSuperset) {
    const ss = context.eventManufacturingSuperset;
    const ad = ss.adChamberSummary;
    const gatesStr = ss.gates.map(g => {
      const grahas = g.activeGrahasInGate.map(ag => ag.name).join(',') || 'Moon';
      return `G${g.gateIndex}:${g.nakshatraName}(${cleanSign(g.rashiName)},L${g.houseFromLagna}/M${g.houseFromRashi}) Moon:${g.moonIngressWindow || 'T'} Grahas:${grahas}`;
    }).join(' | ');
    const evStr = ss.candidateOrSynthesizedEvents.slice(0, 6).map((ev, idx) =>
      `${idx + 1}.[${ev.portfolio}] ${ev.title} (${ev.probabilityScore}%,${ev.hasMoonSupport ? `Moon:${ev.moonWindowDates || 'Yes'}` : 'Latent'})`
    ).join('\n');
    supersetCompact = cleanInlineText(
      `AD_CHAMBER:${ad.adCleanName}@${cleanSign(ad.adNatalRashiName)}(L${ad.adNatalHouseFromLagna}/M${ad.adNatalHouseFromRashi}) ${ad.polarityLabel}(${ad.netScore}) Peak:${ad.peakVentingGate}\nGATES: ${gatesStr}\nCANDIDATES:\n${evStr}`
    );
  }

  const horizonLine = context.isMultiYearPrediction
    ? `HORIZON: ${periodLabel} (Multi-Year)`
    : context.isComprehensiveMonthly || !context.houseNumber
      ? `HORIZON: ${periodLabel} | Full 12-House Synthesis`
      : `HORIZON: ${periodLabel} | House ${context.houseNumber} (${cleanSign(context.rashiName)}) Score:${(context.activationScore ?? 0).toFixed(2)}`;

  const queryText = context.userQuery || `Synthesize complete Vedic evaluation & correlated events for ${periodLabel}.`;

  const candidateSections = [
    horizonLine,
    `## DASHA (${context.activeDasha.startDate}..${context.activeDasha.endDate})\n${dashaSummary}${dashaDossier ? `\n${dashaDossier}` : ''}`,
    `## GOCHARA EPHEMERIS (${periodLabel})\n${transitsBlock}`,
    (ingressLines || motionSpans) ? `## INGRESS & MOTION\n${ingressLines}${motionSpans ? `\nPhases: ${motionSpans}` : ''}` : '',
    specialBlock,
    taraLine ? `## TARA_BALA: ${taraLine}` : '',
    chandraLine ? `## CHANDRA_BALA: ${chandraLine}` : '',
    supersetCompact ? `## SUPERSET_GATES\n${supersetCompact}` : '',
    `## INQUIRY\n"${queryText}"`
  ].filter(Boolean);

  let combined = candidateSections.join('\n\n');
  const maxChars = Math.max(2000, maxTokenBudget * 4 - 200);
  if (combined.length > maxChars) {
    // Shed lower-priority bulk while keeping Horizon, Dasha, Gochara, Special, and Inquiry 100% intact
    const prioritySections = [
      horizonLine,
      `## DASHA (${context.activeDasha.startDate}..${context.activeDasha.endDate})\n${dashaSummary}`,
      `## GOCHARA EPHEMERIS (${periodLabel})\n${transitsBlock}`,
      specialBlock,
      supersetCompact ? `## SUPERSET_GATES\n${supersetCompact.slice(0, 1400)}` : '',
      chandraLine ? `## CHANDRA_BALA: ${chandraLine.slice(0, 700)}` : '',
      `## INQUIRY\n"${queryText}"`
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
