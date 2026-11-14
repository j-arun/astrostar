import { VedicHouseContext, LLMThreePartNarrative, LLM_PROVIDERS } from './llm/types';

export type PredictionCacheScope = 'monthly' | 'multi_year' | 'house';

export interface CachedPredictionSummary {
  cacheId: string;
  title: string;
  scope: PredictionCacheScope;
  personId?: string;
  personName?: string;
  dateRange: string;
  providerUsed: string;
  modelUsed: string;
  createdAt: string;
  summaryPreview: string;
  htmlUrl?: string;
}

export interface CachedPredictionEntry extends CachedPredictionSummary {
  promptSent: string;
  context: VedicHouseContext;
  narrative: LLMThreePartNarrative;
  htmlContent?: string;
}

const LOCAL_CACHE_KEY = 'astro_prediction_cache_v1';
const MAX_LOCAL_ENTRIES = 12;

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export function resolvePredictionScope(context: VedicHouseContext): PredictionCacheScope {
  if (context.isMultiYearPrediction) return 'multi_year';
  if (context.isComprehensiveMonthly) return 'monthly';
  return 'house';
}

export function buildPredictionDateRange(context: VedicHouseContext): string {
  if (context.isMultiYearPrediction && context.timelineStartDate && context.timelineEndDate) {
    return `${context.timelineStartDate} → ${context.timelineEndDate}`;
  }
  const monthName = MONTH_NAMES[context.selectedMonth] || `Month ${context.selectedMonth + 1}`;
  return `${monthName} ${context.selectedYear}`;
}

export function buildPredictionCacheTitle(context: VedicHouseContext): string {
  const scope = resolvePredictionScope(context);
  const range = buildPredictionDateRange(context);
  if (scope === 'multi_year') {
    return `Multi-Year Prediction (${range})`;
  }
  if (scope === 'monthly') {
    return `Monthly Vedic Report (${range})`;
  }
  return `House ${context.houseNumber || '?'} • ${context.rashiName || 'Bhava'} (${range})`;
}

export function sanitizeContextForCache(context: VedicHouseContext): VedicHouseContext {
  const {
    abortSignal: _abortSignal,
    geminiApiKey: _geminiKey,
    anthropicApiKey: _anthropicKey,
    ...rest
  } = context;
  return {
    ...rest,
    multiYearMoonTransits: rest.multiYearMoonTransits ? rest.multiYearMoonTransits.slice(0, 420) : undefined
  };
}

export function sanitizeNarrativeForCache(narrative: LLMThreePartNarrative): LLMThreePartNarrative {
  const {
    rawRequestBody: _rawReq,
    rawResponseBody: _rawRes,
    ...rest
  } = narrative;
  return rest;
}

export function resolveModelUsedLabel(narrative: LLMThreePartNarrative): string {
  if (narrative.ollamaStats?.model) return narrative.ollamaStats.model;
  return LLM_PROVIDERS[narrative.providerUsed]?.model || narrative.providerUsed;
}

export function buildPredictionCacheId(
  context: VedicHouseContext,
  narrative: LLMThreePartNarrative,
  now = new Date()
): string {
  const scope = resolvePredictionScope(context);
  const dateSlug = buildPredictionDateRange(context)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 32);
  const providerSlug = String(narrative.providerUsed || 'llm').replace(/[^a-z0-9_]/gi, '');
  const ts = now.toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `pred_${scope}_${dateSlug}_${providerSlug}_${ts}`;
}

function readLocalCache(): CachedPredictionEntry[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(LOCAL_CACHE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalCache(entries: CachedPredictionEntry[]): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  let candidate = entries.slice(0, MAX_LOCAL_ENTRIES);
  while (candidate.length > 0) {
    try {
      localStorage.setItem(LOCAL_CACHE_KEY, JSON.stringify(candidate));
      return;
    } catch {
      // Drop htmlContent first on quota pressure, then oldest entries
      const hasHtml = candidate.some(e => Boolean(e.htmlContent));
      if (hasHtml) {
        candidate = candidate.map(({ htmlContent: _h, ...rest }) => rest);
      } else {
        candidate = candidate.slice(0, -1);
      }
    }
  }
}

export function toCacheSummary(entry: CachedPredictionEntry): CachedPredictionSummary {
  return {
    cacheId: entry.cacheId,
    title: entry.title,
    scope: entry.scope,
    personId: entry.personId,
    personName: entry.personName,
    dateRange: entry.dateRange,
    providerUsed: entry.providerUsed,
    modelUsed: entry.modelUsed,
    createdAt: entry.createdAt,
    summaryPreview: entry.summaryPreview,
    htmlUrl: entry.htmlUrl
  };
}

export async function savePredictionToCache(
  context: VedicHouseContext,
  narrative: LLMThreePartNarrative,
  htmlContent?: string,
  personMeta?: { personId?: string; personName?: string }
): Promise<CachedPredictionEntry> {
  const now = new Date();
  const cacheId = buildPredictionCacheId(context, narrative, now);
  const cleanContext = sanitizeContextForCache(context);
  const cleanNarrative = sanitizeNarrativeForCache(narrative);
  const entry: CachedPredictionEntry = {
    cacheId,
    title: buildPredictionCacheTitle(cleanContext),
    scope: resolvePredictionScope(cleanContext),
    personId: personMeta?.personId,
    personName: personMeta?.personName,
    dateRange: buildPredictionDateRange(cleanContext),
    providerUsed: LLM_PROVIDERS[cleanNarrative.providerUsed]?.name || cleanNarrative.providerUsed,
    modelUsed: resolveModelUsedLabel(cleanNarrative),
    createdAt: now.toISOString(),
    summaryPreview: (cleanNarrative.summarySentence || cleanNarrative.part1_probabilityAndScope || '').slice(0, 220),
    promptSent: cleanNarrative.promptSent || '',
    context: cleanContext,
    narrative: cleanNarrative,
    htmlUrl: htmlContent ? `/docs/prediction_cache/${cacheId}.html` : undefined
  };

  // Persist locally without bloating storage with duplicate html string if disk saves it
  const existing = readLocalCache().filter(e => e.cacheId !== cacheId);
  writeLocalCache([entry, ...existing]);

  // Persist JSON + HTML onto disk via Vite dev server middleware
  if (typeof fetch === 'function' && typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/prediction-cache/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cacheEntry: entry, htmlContent })
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.htmlUrl) {
          entry.htmlUrl = data.htmlUrl;
        }
      }
    } catch (err) {
      console.warn('Server prediction cache save skipped:', err);
    }
  }

  return entry;
}

export async function listCachedPredictions(): Promise<CachedPredictionSummary[]> {
  const localSummaries = readLocalCache().map(toCacheSummary);
  let serverSummaries: CachedPredictionSummary[] = [];

  if (typeof fetch === 'function' && typeof window !== 'undefined') {
    try {
      const res = await fetch('/api/prediction-cache/list');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data?.items)) {
          serverSummaries = data.items;
        }
      }
    } catch {
      // Local fallback only
    }
  }

  const byId = new Map<string, CachedPredictionSummary>();
  [...serverSummaries, ...localSummaries].forEach(item => {
    if (item?.cacheId && !byId.has(item.cacheId)) {
      byId.set(item.cacheId, item);
    }
  });

  return Array.from(byId.values()).sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export async function loadCachedPrediction(cacheId: string): Promise<CachedPredictionEntry | null> {
  if (!cacheId) return null;

  if (typeof fetch === 'function' && typeof window !== 'undefined') {
    try {
      const res = await fetch(`/api/prediction-cache/load?id=${encodeURIComponent(cacheId)}`);
      if (res.ok) {
        const data = await res.json();
        if (data?.success && data?.entry) {
          return data.entry as CachedPredictionEntry;
        }
      }
    } catch {
      // Fall back to localStorage
    }
  }

  const localHit = readLocalCache().find(e => e.cacheId === cacheId);
  return localHit || null;
}
