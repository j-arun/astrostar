import { VedicHouseContext, LLMThreePartNarrative, LLMProviderId } from './llm/types';
import { buildVedicHtmlContent } from './htmlReportGenerator';
import { buildVedicWordContent } from './wordReportGenerator';
import { getVedicPdfBase64 } from './pdfReportGenerator';

export interface DocReportEntry {
  engineKey: string; // 'claude_iq' | 'claude_sonnet' | 'gemini_pro' | 'fable_ollama'
  engineName: string;
  categoryLabel: string;
  badge: string;
  providerId: LLMProviderId;
  htmlUrl: string;
  pdfUrl: string;
  docUrl: string;
  timestamp: string;
  hasNarrative: boolean;
  summarySentence?: string;
  dataUrl?: string;
}

export interface MonthCatalog {
  monthName: string;
  monthIndex: number; // 0-11
  reports: Record<string, DocReportEntry>; // keyed by engineKey
}

export interface YearCatalog {
  year: number;
  months: Record<string, MonthCatalog>; // keyed by MonthName, e.g. "October"
}

export interface DocsCatalogResponse {
  years: number[];
  catalog: Record<number, YearCatalog>;
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

export const STANDARD_REASONING_ENGINES = [
  {
    key: 'claude_iq',
    name: 'Claude IQ (Haiku 5.5)',
    categoryLabel: '1. IQ',
    badge: '⚡ IQ Engine',
    providerId: 'claude_haiku' as LLMProviderId,
    color: 'emerald'
  },
  {
    key: 'claude_fable',
    name: 'Claude Fable 5.1',
    categoryLabel: '2. Fable 5.1',
    badge: '📜 Fable 5.1',
    providerId: 'claude_fable' as LLMProviderId,
    color: 'indigo'
  },
  {
    key: 'claude_sonnet',
    name: 'Claude Sonnet 5.5',
    categoryLabel: '3. Sonnet',
    badge: '🧠 Sonnet Engine',
    providerId: 'claude_sonnet' as LLMProviderId,
    color: 'amber'
  },
  {
    key: 'gemini_pro',
    name: 'Google Gemini Pro',
    categoryLabel: '4. Gemini Pro',
    badge: '♊ Gemini Pro',
    providerId: 'gemini_pro' as LLMProviderId,
    color: 'cyan'
  },
  {
    key: 'fable_ollama',
    name: 'Local Ollama (Qwen 7B)',
    categoryLabel: '5. Ollama 7B',
    badge: '🖥️ Local 7B',
    providerId: 'local_qwen' as LLMProviderId,
    color: 'purple'
  }
];

export function mapProviderToEngineKey(providerId: LLMProviderId): string {
  if (providerId === 'claude_haiku') return 'claude_iq';
  if (providerId === 'claude_fable') return 'claude_fable';
  if (providerId === 'claude_sonnet' || providerId === 'claude') return 'claude_sonnet';
  if (providerId === 'gemini_pro') return 'gemini_pro';
  if (providerId === 'local_qwen') return 'fable_ollama';
  return 'claude_fable';
}

/**
 * Saves current report into the web server docs folder via /api/docs/save
 */
export async function saveReportToServerDocs(
  context: VedicHouseContext,
  narrative: LLMThreePartNarrative,
  options?: {
    customEngineKey?: string;
    customEngineName?: string;
  }
): Promise<{ success: boolean; links?: { html: string; pdf: string; doc: string }; error?: string }> {
  try {
    const monthName = MONTH_NAMES[context.selectedMonth] || `Month${context.selectedMonth + 1}`;
    const year = context.selectedYear;

    const engineKey = options?.customEngineKey || mapProviderToEngineKey(narrative.providerUsed);
    const engineMeta = STANDARD_REASONING_ENGINES.find(e => e.key === engineKey);
    const engineName = options?.customEngineName || engineMeta?.name || 'Vedic Reasoning Engine';

    // Generate strings & base64
    const htmlContent = buildVedicHtmlContent(context, narrative);
    const docContent = buildVedicWordContent(context, narrative);
    const pdfBase64 = getVedicPdfBase64(context, narrative);

    const payload = {
      year,
      month: monthName,
      monthIndex: context.selectedMonth,
      engineKey,
      engineName,
      categoryLabel: engineMeta?.categoryLabel || engineName,
      badge: engineMeta?.badge || 'Vedic Engine',
      htmlContent,
      docContent,
      pdfBase64,
      narrative,
      context,
      summarySentence: narrative.summarySentence
    };

    const res = await fetch('/api/docs/save', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || `Server responded with ${res.status}`);
    }

    const data = await res.json();
    return {
      success: true,
      links: data.links
    };
  } catch (err: any) {
    console.error('Failed to save report to server docs:', err);
    return {
      success: false,
      error: err.message || 'Failed to save to server docs'
    };
  }
}

/**
 * Fetches catalog of all reports stored in docs/ on server
 */
export async function fetchDocsCatalog(): Promise<DocsCatalogResponse> {
  try {
    const res = await fetch('/api/docs/catalog');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data;
  } catch (err) {
    console.warn('Could not fetch /api/docs/catalog from server, falling back to local defaults:', err);
    return getFallbackCatalog();
  }
}

/**
 * Loads the full narrative and context from server docs for in-app viewing
 */
export async function loadReportFromServerDocs(
  year: number,
  monthName: string,
  engineKey: string
): Promise<{ narrative: LLMThreePartNarrative; context: VedicHouseContext } | null> {
  try {
    const res = await fetch(`/api/docs/load?year=${year}&month=${encodeURIComponent(monthName)}&engine=${encodeURIComponent(engineKey)}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.success && data.narrative && data.context) {
      return {
        narrative: data.narrative,
        context: data.context
      };
    }
  } catch (err) {
    console.error('Failed to load report from server docs:', err);
  }
  return null;
}

/**
 * Fallback catalog in case server endpoint is temporarily initializing
 */
function getFallbackCatalog(): DocsCatalogResponse {
  const years = [2020, 2022, 2023, 2024, 2025, 2026, 2027];
  const catalog: Record<number, YearCatalog> = {};

  years.forEach(y => {
    catalog[y] = {
      year: y,
      months: {}
    };
  });

  // Pre-seed October 2026 with the 4 engines
  const octReports: Record<string, DocReportEntry> = {};
  STANDARD_REASONING_ENGINES.forEach(eng => {
    octReports[eng.key] = {
      engineKey: eng.key,
      engineName: eng.name,
      categoryLabel: eng.categoryLabel,
      badge: eng.badge,
      providerId: eng.providerId,
      htmlUrl: `/docs/2026/October/${eng.key}/Tamil_Vedic_Report_October_2026_${eng.key}.html`,
      pdfUrl: `/docs/2026/October/${eng.key}/Tamil_Vedic_Report_October_2026_${eng.key}.pdf`,
      docUrl: `/docs/2026/October/${eng.key}/Tamil_Vedic_Report_October_2026_${eng.key}.doc`,
      timestamp: '2026-10-14T08:30:00Z',
      hasNarrative: true,
      summarySentence: `Comprehensive Parashara & Jaimini monthly synthesis for October 2026 evaluated by ${eng.name}.`
    };
  });

  catalog[2026].months['October'] = {
    monthName: 'October',
    monthIndex: 9,
    reports: octReports
  };

  // Pre-seed December 2020 with the 4 engines
  const decReports: Record<string, DocReportEntry> = {};
  STANDARD_REASONING_ENGINES.forEach(eng => {
    decReports[eng.key] = {
      engineKey: eng.key,
      engineName: eng.name,
      categoryLabel: eng.categoryLabel,
      badge: eng.badge,
      providerId: eng.providerId,
      htmlUrl: `/docs/2020/December/${eng.key}/Tamil_Vedic_Report_December_2020_${eng.key}.html`,
      pdfUrl: `/docs/2020/December/${eng.key}/Tamil_Vedic_Report_December_2020_${eng.key}.pdf`,
      docUrl: `/docs/2020/December/${eng.key}/Tamil_Vedic_Report_December_2020_${eng.key}.doc`,
      timestamp: '2020-12-15T12:00:00Z',
      hasNarrative: true,
      summarySentence: `Vedic planetary alignment and Vimshottari transit synthesis for December 2020 by ${eng.name}.`
    };
  });

  catalog[2020].months['December'] = {
    monthName: 'December',
    monthIndex: 11,
    reports: decReports
  };

  return { years, catalog };
}
