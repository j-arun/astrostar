import { VedicHouseContext, LLMThreePartNarrative, LLM_PROVIDERS } from './llm/types';
import { getStructuredPayloadReportSections } from './structuredPayloadReport';
import { createReportFilenameTimestamp } from './reportFilename';

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const sec = ms / 1000;
  if (sec < 60) return `${sec.toFixed(1)}s`;
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${sec.toFixed(1)}s (${m}m ${s}s)`;
}

function cleanNarrativeText(text: string | undefined): string {
  if (!text) return '';
  const trimmed = text.trim();
  if (trimmed.startsWith('{') && (trimmed.includes('"summarySentence"') || trimmed.includes('"part1_probabilityAndScope"'))) {
    try {
      const parsed = JSON.parse(trimmed);
      return parsed.part1_probabilityAndScope || parsed.summarySentence || trimmed;
    } catch {
      const match = trimmed.match(/"part1_probabilityAndScope"\s*:\s*"((?:[^"\\]|\\.)*)"/);
      if (match && match[1]) {
        try {
          return JSON.parse(`"${match[1]}"`);
        } catch {
          return match[1].replace(/\\n/g, '\n').replace(/\\"/g, '"');
        }
      }
    }
  }
  return trimmed;
}

function escapeHtml(str: string | undefined | null): string {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function getReadableEngineName(providerId: string, modelName?: string): string {
  if (providerId === 'claude_sonnet' || providerId === 'claude') {
    return 'Claude Sonnet 5.5';
  }
  if (providerId === 'claude_haiku') {
    return 'Claude Haiku 5.5';
  }
  if (providerId === 'claude_fable') {
    return 'Claude Fable 5.1';
  }
  if (providerId === 'gemini_pro') {
    return 'Google Gemini Pro';
  }
  if (providerId === 'local_qwen') {
    return 'Ollama (Qwen 2.5 7B)';
  }
  if (modelName) {
    if (modelName.toLowerCase().includes('sonnet')) return 'Claude Sonnet 5.5';
    if (modelName.toLowerCase().includes('haiku')) return 'Claude Haiku 5.5';
    if (modelName.toLowerCase().includes('gemini')) return 'Google Gemini Pro';
    if (modelName.toLowerCase().includes('qwen') || modelName.toLowerCase().includes('ollama')) return 'Ollama (Qwen 2.5 7B)';
    return modelName;
  }
  return providerId;
}

export function buildVedicHtmlContent(
  context: VedicHouseContext,
  narrative: LLMThreePartNarrative
): string {
  const monthName = MONTH_NAMES[context.selectedMonth] || `Month ${context.selectedMonth + 1}`;
  const year = context.selectedYear;
  const timePeriodText = `${monthName} ${year}`;

  const providerMeta = LLM_PROVIDERS[narrative.providerUsed] || {
    id: narrative.providerUsed,
    name: narrative.providerUsed === 'local_qwen' ? 'Local Qwen 2.5 7B (Ollama)' : narrative.providerUsed,
    badgeLabel: narrative.providerUsed,
    model: 'custom'
  };

  const modelName = narrative.ollamaStats?.model || providerMeta.model || (narrative.isPrivateLocal ? 'qwen2.5:7b-instruct' : 'gemini-3.8-flash');
  const engineDisplayName = getReadableEngineName(narrative.providerUsed, modelName);

  const now = new Date();
  const formattedTimestamp = now.toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  const scopeLabel = context.isComprehensiveMonthly || !context.houseNumber
    ? 'Full-Month 12-Bhava Comprehensive Synthesis'
    : `House ${context.houseNumber} (${context.rashiName || 'Bhava'}) Activation`;

  const scenariosToRender = (narrative.supplementaryScenarios && narrative.supplementaryScenarios.length > 0)
    ? narrative.supplementaryScenarios
    : [
        {
          id: 'career_job',
          domain: 'career_job',
          title: 'Career & Professional Trajectory',
          verdict: 'Active Momentum / Professional Progress',
          astrologicalReasoning: `10th house Karma and 6th house service receive favorable drishti. The active PD Lord (${context.activeDasha.pratyantardasha}) activates workplace responsibilities and professional visibility.`,
          practicalGuidance: 'Seize key initiatives mid-month; maintain collaborative dialogue with supervisors and prioritize execution over speculation.',
          confidenceScore: 0.85,
          timingWindow: narrative.peakDateRange || 'Days 8–24'
        },
        {
          id: 'love_romance',
          domain: 'love_romance',
          title: 'Love & Romantic Manifestation',
          verdict: 'Emotional Clarity / Constructive Bonding',
          astrologicalReasoning: 'Venus and Moon transits in relation to 5th and 7th lords foster affectionate warmth. Transit drishti softens prior misunderstandings.',
          practicalGuidance: 'Open communication yields mutual trust; avoid sensitive discussions during Chandrashtama dates.',
          confidenceScore: 0.82,
          timingWindow: 'Mid-Month Window'
        },
        {
          id: 'finance_wealth',
          domain: 'finance_wealth',
          title: 'Wealth & Capital Inflows',
          verdict: 'Resource Inflow / Prudent Asset Growth',
          astrologicalReasoning: '2nd house liquid reserves and 11th house gains indicate favorable inflow channels. Sarvashtakavarga strength supports calculated financial decisions.',
          practicalGuidance: 'Channel excess liquidity into secure collateral or high-stability instruments; defer speculative bets.',
          confidenceScore: 0.80,
          timingWindow: narrative.peakDateRange || 'Days 10–22'
        },
        {
          id: 'health_vitality',
          domain: 'health_vitality',
          title: 'Health & Physical Vitality',
          verdict: 'Stamina Stable / Pacing Recommended',
          astrologicalReasoning: '6th house and lagna lord configurations maintain solid constitutional resilience. Pacing recommended during Moon ingress.',
          practicalGuidance: 'Maintain regular sleep cycles, stay well-hydrated, and adopt moderate daily cardiovascular pacing.',
          confidenceScore: 0.88,
          timingWindow: 'Continuous Monthly Balance'
        },
        {
          id: 'family_home',
          domain: 'family_home',
          title: 'Family & Domestic Ambiance',
          verdict: 'Harmonious Foundation / Property Stability',
          astrologicalReasoning: '4th house Sukha and maternal significations remain well-supported under benefic rays and domestic peace alignment.',
          practicalGuidance: 'Invest time in domestic organization; celebrate familial milestones and support maternal health needs.',
          confidenceScore: 0.86,
          timingWindow: 'Entire Evaluated Month'
        }
      ];

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Tamil Om Vedic Horoscope Engine — ${escapeHtml(timePeriodText)} (${escapeHtml(engineDisplayName)})</title>
  <style>
    :root {
      --primary: #d97706;
      --primary-dark: #b45309;
      --primary-light: #fef3c7;
      --slate-900: #0f172a;
      --slate-800: #1e293b;
      --slate-700: #334155;
      --slate-600: #475569;
      --slate-500: #64748b;
      --slate-200: #e2e8f0;
      --slate-100: #f1f5f9;
      --slate-50: #f8fafc;
      --emerald-600: #16a34a;
      --sky-600: #0284c7;
      --rose-600: #e11d48;
      --indigo-600: #4f46e5;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: #f1f5f9;
      color: var(--slate-800);
      line-height: 1.6;
      font-size: 14px;
      padding: 24px 16px;
    }

    .report-container {
      max-width: 960px;
      margin: 0 auto;
      background: #ffffff;
      border: 1px solid var(--slate-200);
      border-radius: 12px;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05);
      padding: 32px 36px;
    }

    /* Print & Floating Utility Bar */
    .utility-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--slate-900);
      color: #ffffff;
      padding: 10px 18px;
      border-radius: 8px;
      margin-bottom: 24px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.15);
    }

    .utility-bar span {
      font-size: 13px;
      font-weight: 600;
      color: #fcd34d;
    }

    .btn-group {
      display: flex;
      gap: 10px;
    }

    .btn {
      background: #d97706;
      color: #ffffff;
      border: none;
      border-radius: 6px;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s;
    }

    .btn:hover {
      background: #b45309;
    }

    /* Header Section */
    .header {
      border-bottom: 2px solid var(--slate-200);
      padding-bottom: 20px;
      margin-bottom: 24px;
    }

    .header-title {
      font-size: 24px;
      font-weight: 800;
      color: var(--slate-900);
      letter-spacing: -0.5px;
    }

    .header-subtitle {
      font-size: 13px;
      color: var(--slate-500);
      margin-top: 4px;
    }

    /* Metadata Grid */
    .meta-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 14px;
      background: var(--slate-50);
      border: 1px solid var(--slate-200);
      border-radius: 10px;
      padding: 16px;
      margin-top: 18px;
    }

    .meta-card {
      display: flex;
      flex-direction: column;
    }

    .meta-label {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--slate-500);
      margin-bottom: 4px;
      letter-spacing: 0.5px;
    }

    .meta-val-primary {
      font-size: 16px;
      font-weight: 800;
      color: var(--slate-900);
    }

    .meta-val-sub {
      font-size: 12px;
      color: var(--slate-600);
      margin-top: 2px;
    }

    /* Section Styles */
    .section {
      margin-bottom: 28px;
    }

    .section-header {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      border-bottom: 1px solid var(--slate-200);
      padding-bottom: 8px;
      margin-bottom: 14px;
    }

    .section-title {
      font-size: 16px;
      font-weight: 700;
      color: var(--slate-900);
      letter-spacing: -0.2px;
    }

    .section-subtitle {
      font-size: 12px;
      color: var(--slate-500);
    }

    /* Dasha Cards */
    .dasha-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 12px;
    }

    .dasha-card {
      border-radius: 8px;
      padding: 14px 16px;
      border: 1px solid transparent;
    }

    .dasha-md {
      background: #fef3c7;
      border-color: #fde68a;
      color: #92400e;
    }
    .dasha-ad {
      background: #e0f2fe;
      border-color: #bae6fd;
      color: #0369a1;
    }
    .dasha-pd {
      background: #dcfce7;
      border-color: #bbf7d0;
      color: #15803d;
    }

    .dasha-label {
      font-size: 11px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }
    .dasha-lord {
      font-size: 17px;
      font-weight: 800;
      color: var(--slate-900);
      margin: 4px 0 2px 0;
    }
    .dasha-sub {
      font-size: 11px;
      color: var(--slate-600);
    }

    /* Planetary Alignment Cards */
    .graha-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-top: 12px;
    }

    .graha-card {
      background: var(--slate-50);
      border: 1px solid var(--slate-200);
      border-radius: 8px;
      padding: 12px 14px;
    }

    .graha-card-title {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: var(--slate-500);
      margin-bottom: 6px;
    }

    .graha-items {
      font-size: 12px;
      color: var(--slate-700);
      line-height: 1.5;
    }

    /* Dual Evaluation */
    .dual-card {
      background: var(--slate-50);
      border: 1px solid var(--slate-200);
      border-radius: 8px;
      padding: 14px;
      margin-bottom: 14px;
    }

    .dual-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 12px;
    }

    .dual-box {
      border-radius: 6px;
      padding: 12px;
    }

    .dual-box-natal {
      background: #fef3c7;
      border: 1px solid #fde68a;
    }

    .dual-box-transit {
      background: #e0f2fe;
      border: 1px solid #bae6fd;
    }

    .dual-box-header {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      font-weight: 700;
      margin-bottom: 6px;
    }

    .dual-synthesis {
      background: var(--slate-100);
      border-radius: 6px;
      padding: 10px 14px;
      font-size: 12px;
      color: var(--slate-800);
      font-weight: 600;
    }

    /* Bottom-Line Synthesis Verdict */
    .verdict-card {
      background: #fffbeb;
      border: 1px solid #f59e0b;
      border-left: 5px solid #d97706;
      border-radius: 8px;
      padding: 16px 18px;
      margin-bottom: 20px;
    }

    .verdict-title {
      font-size: 12px;
      font-weight: 800;
      color: #b45309;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      margin-bottom: 6px;
    }

    .verdict-text {
      font-size: 13.5px;
      color: var(--slate-900);
      line-height: 1.6;
    }

    /* Core 3-Part Cards */
    .part-card {
      background: #ffffff;
      border: 1px solid var(--slate-200);
      border-radius: 8px;
      margin-bottom: 12px;
      overflow: hidden;
    }

    .part-header {
      background: var(--slate-50);
      padding: 10px 14px;
      border-bottom: 1px solid var(--slate-200);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .part-title {
      font-size: 13px;
      font-weight: 700;
    }

    .part-badge {
      font-size: 11px;
      font-weight: 600;
      color: var(--slate-600);
      background: var(--slate-200);
      padding: 2px 8px;
      border-radius: 4px;
    }

    .part-body {
      padding: 14px;
      font-size: 13px;
      color: var(--slate-800);
      line-height: 1.6;
      white-space: pre-line;
    }

    /* Domain Cards */
    .domain-card {
      background: #ffffff;
      border: 1px solid var(--slate-200);
      border-radius: 10px;
      padding: 16px 18px;
      margin-bottom: 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }

    .domain-title-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid var(--slate-100);
      padding-bottom: 10px;
      margin-bottom: 12px;
    }

    .domain-title {
      font-size: 15px;
      font-weight: 700;
      color: var(--slate-900);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .domain-verdict-badge {
      font-size: 12px;
      font-weight: 700;
      color: #d97706;
      background: #fef3c7;
      padding: 2px 10px;
      border-radius: 12px;
    }

    .domain-submeta {
      font-size: 12px;
      color: var(--slate-500);
    }

    .domain-block {
      margin-bottom: 12px;
    }

    .domain-block-title {
      font-size: 11.5px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      color: var(--slate-500);
      margin-bottom: 4px;
    }

    .domain-block-title-green {
      color: var(--emerald-600);
    }

    .domain-block-text {
      font-size: 13px;
      color: var(--slate-800);
      line-height: 1.55;
    }

    /* Sub-Feature Deep Dives */
    .deep-dive-card {
      background: var(--slate-50);
      border: 1px solid var(--slate-200);
      border-radius: 6px;
      padding: 12px 14px;
      margin-top: 10px;
      font-size: 12.5px;
    }

    .deep-dive-title {
      font-weight: 700;
      margin-bottom: 4px;
    }

    .deep-dive-title-amber { color: #b45309; }
    .deep-dive-title-sky { color: var(--sky-600); }
    .deep-dive-title-green { color: var(--emerald-600); }
    .deep-dive-title-rose { color: var(--rose-600); }
    .deep-dive-title-indigo { color: var(--indigo-600); }

    .tag-pill {
      display: inline-block;
      padding: 2px 8px;
      background: #ffe4e6;
      color: #be123c;
      border: 1px solid #fecdd3;
      border-radius: 4px;
      font-size: 11px;
      font-weight: 600;
      margin-right: 6px;
      margin-bottom: 4px;
    }

    .payload-intro { color: var(--slate-600); margin-bottom: 12px; }
    .payload-card { border: 1px solid var(--slate-200); border-radius: 6px; padding: 12px; margin: 10px 0; page-break-inside: avoid; }
    .payload-title { color: var(--slate-900); font-size: 14px; margin-bottom: 3px; }
    .payload-subtitle { color: var(--slate-500); font-size: 11px; margin-bottom: 8px; }
    .payload-row { display: grid; grid-template-columns: minmax(150px, 0.8fr) 2fr; gap: 8px; padding: 6px 0; border-top: 1px solid var(--slate-100); font-size: 11px; overflow-wrap: anywhere; }
    .payload-row strong { color: var(--slate-700); }
    .payload-empty { color: var(--slate-500); font-size: 11px; font-style: italic; }

    /* Footer */
    .report-footer {
      border-top: 1px solid var(--slate-200);
      padding-top: 16px;
      margin-top: 32px;
      display: flex;
      justify-content: space-between;
      color: var(--slate-500);
      font-size: 12px;
    }

    /* Print Stylesheet */
    @media print {
      body {
        background: #ffffff;
        padding: 0;
      }
      .utility-bar {
        display: none !important;
      }
      .report-container {
        border: none;
        box-shadow: none;
        padding: 0;
        max-width: 100%;
      }
      .domain-card {
        page-break-inside: avoid;
      }
      .part-card {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>

  <div class="report-container">
    <!-- Utility Bar (hidden during printing) -->
    <div class="utility-bar">
      <span>✨ Tamil Om Vedic Horoscope Dossier (${escapeHtml(timePeriodText)})</span>
      <div class="btn-group">
        <button class="btn" onclick="window.print()">🖨️ Print / Save PDF</button>
      </div>
    </div>

    <!-- Header Section -->
    <header class="header">
      <h1 class="header-title">TAMIL OM VEDIC HOROSCOPE ENGINE</h1>
      <p class="header-subtitle">Parashara &amp; Jaimini Classical Transit Synthesis &amp; Predictive Analysis</p>

      <div class="meta-grid">
        <div class="meta-card">
          <span class="meta-label">Generated For Month</span>
          <span class="meta-val-primary">${escapeHtml(timePeriodText)}</span>
          <span class="meta-val-sub">${escapeHtml(scopeLabel)}</span>
        </div>

        <div class="meta-card">
          <span class="meta-label">Generated Engine</span>
          <span class="meta-val-primary" style="color: #b45309;">${escapeHtml(engineDisplayName)}</span>
          <span class="meta-val-sub">Model: ${escapeHtml(modelName)}</span>
        </div>

        <div class="meta-card">
          <span class="meta-label">Generated Timestamp</span>
          <span class="meta-val-primary" style="font-size: 14px;">${escapeHtml(formattedTimestamp)}</span>
          <span class="meta-val-sub">Tamil Om Vedic Ephemeris Sync</span>
        </div>

        <div class="meta-card">
          <span class="meta-label">Time Taken</span>
          <span class="meta-val-primary" style="color: var(--emerald-600);">${escapeHtml(formatDuration(narrative.executionTimeMs))}</span>
          <span class="meta-val-sub">Confidence: ${(narrative.overallConfidence * 100).toFixed(0)}%</span>
        </div>
      </div>
    </header>

    <!-- SECTION 1: VIMSHOTTARI DASHA HIERARCHY -->
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">1. VIMSHOTTARI DASHA HIERARCHY</h2>
        <span class="section-subtitle">Active Mahadasha, Antardasha &amp; Pratyantardasha</span>
      </div>

      <div class="dasha-grid">
        <div class="dasha-card dasha-md">
          <div class="dasha-label">MAHADASHA (MD)</div>
          <div class="dasha-lord">${escapeHtml(context.activeDasha.mahadasha || 'Lord')}</div>
          <div class="dasha-sub">Primary Karmic Period Ruler</div>
        </div>

        <div class="dasha-card dasha-ad">
          <div class="dasha-label">ANTARDASHA (AD)</div>
          <div class="dasha-lord">${escapeHtml(context.activeDasha.antardasha || 'Lord')}</div>
          <div class="dasha-sub">Sub-Period Manifestor</div>
        </div>

        <div class="dasha-card dasha-pd">
          <div class="dasha-label">PRATYANTARDASHA (PD)</div>
          <div class="dasha-lord">${escapeHtml(context.activeDasha.pratyantardasha || 'Lord')}</div>
          <div class="dasha-sub">Micro Trigger Window (${escapeHtml(narrative.peakDateRange || 'Entire Month')})</div>
        </div>
      </div>

      <!-- Planetary Graha Positions -->
      ${(context.natalOccupants && context.natalOccupants.length > 0) || (context.transitOccupants && context.transitOccupants.length > 0) ? `
      <div class="graha-grid">
        <div class="graha-card">
          <div class="graha-card-title">Natal Grahas (Birth Grid)</div>
          <div class="graha-items">
            ${context.natalOccupants && context.natalOccupants.length > 0
              ? context.natalOccupants.map(o => `<strong>${escapeHtml(o.body_name)}</strong> ${o.degree_sputa ? `(${escapeHtml(o.degree_sputa)})` : ''} ${o.nakshatra_name ? `• ${escapeHtml(o.nakshatra_name)}` : ''}`).join('<br>')
              : 'Empty or not specified'}
          </div>
        </div>

        <div class="graha-card">
          <div class="graha-card-title">Transit Grahas (Gochara Ephemeris)</div>
          <div class="graha-items">
            ${context.transitOccupants && context.transitOccupants.length > 0
              ? context.transitOccupants.map(t => `<strong>${escapeHtml(t.graha_key)}</strong> ${t.degree_sputa ? `(${escapeHtml(t.degree_sputa)})` : ''} ${t.nakshatra_name ? `• ${escapeHtml(t.nakshatra_name)} P${t.pada || '?'}` : ''}${t.is_retrograde ? ' [R]' : ''}`).join('<br>')
              : 'Governed via Drishti'}
          </div>
        </div>
      </div>
      ` : ''}
    </section>

    <!-- SECTION 2: DUAL EVALUATION & BOTTOM-LINE SYNTHESIS VERDICT -->
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">2. BOTTOM-LINE SYNTHESIS &amp; NATAL EVALUATION</h2>
        <span class="section-subtitle">D1/D9 Karmic Promise vs. Gochara Transit Delivery</span>
      </div>

      ${narrative.natalPromiseVsTransitDelivery ? `
      <div class="dual-card">
        <div class="dual-grid">
          <div class="dual-box dual-box-natal">
            <div class="dual-box-header" style="color: #92400e;">
              <span>1. NATAL PROMISE (D1/D9)</span>
              <span>${((narrative.natalPromiseVsTransitDelivery.natalPromiseScore || 0.88) * 100).toFixed(0)}%</span>
            </div>
            <p style="font-size: 12.5px; color: var(--slate-800);">${escapeHtml(narrative.natalPromiseVsTransitDelivery.natalPromiseVerdict)}</p>
          </div>

          <div class="dual-box dual-box-transit">
            <div class="dual-box-header" style="color: #0369a1;">
              <span>2. GOCHARA TRANSIT DELIVERY</span>
              <span>${((narrative.natalPromiseVsTransitDelivery.transitDeliveryScore || 0.78) * 100).toFixed(0)}%</span>
            </div>
            <p style="font-size: 12.5px; color: var(--slate-800);">${escapeHtml(narrative.natalPromiseVsTransitDelivery.transitDeliveryVerdict)}</p>
          </div>
        </div>

        <div class="dual-synthesis">
          <strong>Synthesis Fruition Verdict:</strong> ${escapeHtml(narrative.natalPromiseVsTransitDelivery.synthesisVerdict)}
        </div>
      </div>
      ` : ''}

      <div class="verdict-card">
        <div class="verdict-title">Bottom-Line Synthesis Verdict</div>
        <div class="verdict-text">${escapeHtml(cleanNarrativeText(narrative.summarySentence) || 'Vedic Parashara synthesis completed.')}</div>
      </div>
    </section>

    <!-- SECTION 3: CORE PARASHARA 3-PART PREDICTIVE ANALYSIS -->
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">3. CORE PARASHARA PREDICTIVE ANALYSIS</h2>
        <span class="section-subtitle">Deterministic Vedic Timing &amp; Ingress Breakdowns</span>
      </div>

      <div class="part-card">
        <div class="part-header">
          <span class="part-title" style="color: #b45309;">Part 1: Event Probability &amp; Scope</span>
          <span class="part-badge">Confidence: ${(narrative.overallConfidence * 100).toFixed(0)}%</span>
        </div>
        <div class="part-body">${escapeHtml(cleanNarrativeText(narrative.part1_probabilityAndScope))}</div>
      </div>

      <div class="part-card">
        <div class="part-header">
          <span class="part-title" style="color: var(--sky-600);">Part 2: Financial &amp; Resource Sources</span>
          <span class="part-badge">Capital &amp; Liquidity Origin</span>
        </div>
        <div class="part-body">${escapeHtml(cleanNarrativeText(narrative.part2_financialAndResources))}</div>
      </div>

      <div class="part-card">
        <div class="part-header">
          <span class="part-title" style="color: var(--emerald-600);">Part 3: Micro-Timing Window (Pratyantardasha)</span>
          <span class="part-badge">Peak: ${escapeHtml(narrative.peakDateRange || 'Active Month Window')}</span>
        </div>
        <div class="part-body">${escapeHtml(cleanNarrativeText(narrative.part3_microTimingWindow))}</div>
      </div>
    </section>

    <!-- SECTION 4: ALL 5 CORE LIFE DOMAINS PREDICTIONS -->
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">4. COMPREHENSIVE 5-DOMAIN LIFE PREDICTIONS</h2>
        <span class="section-subtitle">Career, Romance, Finance, Health &amp; Family</span>
      </div>

      ${scenariosToRender.map((sc: any) => {
        const title = (sc.title || sc.domain).replace(/^[^\w\s]+/, '').trim();
        const conf = ((sc.confidenceScore ?? 0.85) * 100).toFixed(0);

        return `
        <div class="domain-card">
          <div class="domain-title-bar">
            <div class="domain-title">
              <span>${escapeHtml(title)}</span>
              <span class="domain-verdict-badge">${escapeHtml(sc.verdict || 'Evaluated')}</span>
            </div>
            <div class="domain-submeta">
              Window: <strong>${escapeHtml(sc.timingWindow || 'Active Month')}</strong> | Confidence: <strong>${conf}%</strong>
            </div>
          </div>

          <!-- Deep Dive Specifics -->
          ${sc.id === 'career_job' ? `
            ${sc.employmentStatusInference ? `
            <div class="deep-dive-card">
              <div class="deep-dive-title deep-dive-title-amber">Native Employment State: [${escapeHtml(sc.employmentStatusInference.label)}]</div>
              <div><strong>Astrological Deduction (10th Karma &amp; 6th Service):</strong> ${escapeHtml(sc.employmentStatusInference.inferenceReasoning)}</div>
            </div>` : ''}

            ${sc.jobSearchAnalysis ? `
            <div class="deep-dive-card">
              <div class="deep-dive-title deep-dive-title-sky">Job Search &amp; Transition Phase [Momentum: ${escapeHtml(sc.jobSearchAnalysis.momentum || 'Active')}]</div>
              <div><strong>Struggle vs Current Phase:</strong> ${escapeHtml(sc.jobSearchAnalysis.pastStruggleVsCurrentPhase)}</div>
              <div><strong>Auspicious Offer Window:</strong> ${escapeHtml(sc.jobSearchAnalysis.timingAuspiciousness)}</div>
            </div>` : ''}

            ${sc.newJobAcquisition ? `
            <div class="deep-dive-card">
              <div class="deep-dive-title deep-dive-title-green">New Job Acquisition &amp; Workplace Atmosphere</div>
              <div><strong>Role &amp; Mood:</strong> ${escapeHtml(sc.newJobAcquisition.jobTypeAndMood)}</div>
              <div><strong>Atmosphere:</strong> ${escapeHtml(sc.newJobAcquisition.workplaceAtmosphere)}</div>
              <div><strong>Comparison:</strong> ${escapeHtml(sc.newJobAcquisition.comparisonWithCurrentRole)}</div>
            </div>` : ''}

            ${sc.existingJobPhase ? `
            <div class="deep-dive-card">
              <div class="deep-dive-title deep-dive-title-indigo">Existing Job Phase (For Native Currently Serving)</div>
              <div><strong>Workplace Climate:</strong> ${escapeHtml(sc.existingJobPhase.currentPhaseNature)}</div>
              <div><strong>Retention vs Exit Advice:</strong> ${escapeHtml(sc.existingJobPhase.retentionVsExitAdvice)}</div>
            </div>` : ''}
          ` : ''}

          ${sc.id === 'love_romance' ? `
            ${sc.crushStatusInference ? `
            <div class="deep-dive-card">
              <div class="deep-dive-title deep-dive-title-rose">Crush Outlook &amp; Potential [New Attraction: ${escapeHtml(sc.crushStatusInference.newCrushProbability || 'Moderate')}]</div>
              <div><strong>Existing Trajectory:</strong> ${escapeHtml(sc.crushStatusInference.existingCrushTrajectory)}</div>
              <div><strong>Attraction Trigger:</strong> ${escapeHtml(sc.crushStatusInference.newCrushDetails)}</div>
            </div>` : ''}

            ${sc.romanceAtmosphere ? `
            <div class="deep-dive-card">
              <div class="deep-dive-title deep-dive-title-amber">Romance Chemistry (${sc.romanceAtmosphere.chemistryRating || 80}%) &amp; Emotional Weather</div>
              <div>${escapeHtml(sc.romanceAtmosphere.emotionalWeather)}</div>
            </div>` : ''}

            ${sc.manifestationPath ? `
            <div class="deep-dive-card">
              <div class="deep-dive-title deep-dive-title-green">Love Manifestation Horizon [${escapeHtml(sc.manifestationPath.outcomeLabel || 'Favorable')}]</div>
              <div><strong>Likelihood:</strong> ${escapeHtml(sc.manifestationPath.manifestationLikelihood)}</div>
              <div><strong>Astrological Reasoning (5th, 7th &amp; D9):</strong> ${escapeHtml(sc.manifestationPath.astrologicalPathReasoning)}</div>
            </div>` : ''}
          ` : ''}

          ${sc.id === 'finance_wealth' && sc.financeDetails ? `
            <div class="deep-dive-card">
              <div class="deep-dive-title deep-dive-title-amber">Liquid Cashflow &amp; Asset Inflow Breakdown</div>
              <div><strong>Liquidity vs Outflow:</strong> ${escapeHtml(sc.financeDetails.liquidityVsOutflow)}</div>
              <div><strong>Windfalls &amp; Speculation:</strong> ${escapeHtml(sc.financeDetails.windfallAndSpeculation)}</div>
              <div><strong>Debt &amp; Asset Financing:</strong> ${escapeHtml(sc.financeDetails.debtAndAssetFinancing)}</div>
            </div>
          ` : ''}

          ${sc.id === 'health_vitality' && sc.healthDetails ? `
            <div class="deep-dive-card">
              <div class="deep-dive-title deep-dive-title-rose">Health Significations &amp; Vulnerable Zones</div>
              <div style="margin-bottom: 6px;">
                ${(sc.healthDetails.vulnerableZones || []).map((z: string) => `<span class="tag-pill">${escapeHtml(z)}</span>`).join('')}
              </div>
              <div><strong>Mental Tranquility (Sukha):</strong> ${escapeHtml(sc.healthDetails.mentalTranquilityAndStress)}</div>
              <div><strong>Holistic Remedies:</strong> ${escapeHtml(sc.healthDetails.holisticRemedies)}</div>
            </div>
          ` : ''}

          ${sc.id === 'family_home' && sc.familyDetails ? `
            <div class="deep-dive-card">
              <div class="deep-dive-title deep-dive-title-indigo">Domestic Ambiance &amp; Maternal Significations</div>
              <div><strong>Domestic Ambiance:</strong> ${escapeHtml(sc.familyDetails.domesticAmbiance)}</div>
              <div><strong>Maternal Wellbeing:</strong> ${escapeHtml(sc.familyDetails.maternalWellbeing)}</div>
              <div><strong>Property &amp; Relocation:</strong> ${escapeHtml(sc.familyDetails.propertyAndRelocation)}</div>
            </div>
          ` : ''}

          <!-- Detailed Paragraphs if any -->
          ${sc.detailedParagraphs && sc.detailedParagraphs.length > 0 ? `
            <div style="margin-top: 12px; padding: 12px; background: var(--slate-50); border-radius: 6px;">
              <div class="domain-block-title">In-Depth Astrological Analysis &amp; Vedic Synthesis</div>
              ${sc.detailedParagraphs.map((para: string) => `<p style="font-size: 13px; margin-bottom: 8px; line-height: 1.6;">${escapeHtml(para)}</p>`).join('')}
            </div>
          ` : ''}

          <!-- Causal Reasoning -->
          <div class="domain-block" style="margin-top: 12px;">
            <div class="domain-block-title">Astrological Causal Rationale (Drishti &amp; Karakatwa):</div>
            <p class="domain-block-text">${escapeHtml(sc.astrologicalReasoning || 'Consistent with classical astrological configurations.')}</p>
          </div>

          <!-- Practical Guidance -->
          <div class="domain-block">
            <div class="domain-block-title domain-block-title-green">Practical Remedial Guidance:</div>
            <p class="domain-block-text">${escapeHtml(sc.practicalGuidance || 'Align timing with active planetary windows.')}</p>
          </div>
        </div>
        `;
      }).join('')}
    </section>

    <section class="section structured-payload-section">
      <div class="section-header">
        <h2 class="section-title">5. STRUCTURED DATA PAYLOADS (FOLD 2)</h2>
        <span class="section-subtitle">Deterministic Parashara Data</span>
      </div>
      <p class="payload-intro">Pre-calculated ground-truth data used by the reasoning engine.</p>
      ${getStructuredPayloadReportSections(context).map(section => `
        <article class="payload-card">
          <h3 class="payload-title">${escapeHtml(section.title)}</h3>
          ${section.subtitle ? `<p class="payload-subtitle">${escapeHtml(section.subtitle)}</p>` : ''}
          ${section.rows.length > 0 ? section.rows.map(row => `
            <div class="payload-row"><strong>${escapeHtml(row.label)}</strong><span>${escapeHtml(row.value)}</span></div>
          `).join('') : `<p class="payload-empty">${escapeHtml(section.emptyMessage || 'No payload data available.')}</p>`}
        </article>
      `).join('')}
    </section>

    <!-- SECTION 6: CLAUDE EXTENDED REASONING SCRATCHPAD (IF AVAILABLE) -->
    ${narrative.thinkingContent ? `
    <section class="section">
      <div class="section-header">
        <h2 class="section-title">6. EXTENDED REASONING AUDIT LOG</h2>
        <span class="section-subtitle">Deep Ephemeris Chain of Thought</span>
      </div>
      <div style="background: var(--slate-50); border: 1px solid var(--slate-200); border-radius: 8px; padding: 14px; font-family: monospace; font-size: 11px; color: var(--slate-700); white-space: pre-wrap; max-height: 350px; overflow-y: auto;">
        ${escapeHtml(narrative.thinkingContent)}
      </div>
    </section>
    ` : ''}

    <!-- Footer -->
    <footer class="report-footer">
      <div>Tamil Om Vedic Horoscope Engine • Deterministic Sputa &amp; Parashara Ingress Synthesis</div>
      <div>${escapeHtml(timePeriodText)}</div>
    </footer>
  </div>

</body>
</html>`;

  return html;
}

export function generateVedicHtmlReport(
  context: VedicHouseContext,
  narrative: LLMThreePartNarrative
): void {
  const htmlContent = buildVedicHtmlContent(context, narrative);
  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const monthName = MONTH_NAMES[context.selectedMonth] || `Month${context.selectedMonth + 1}`;
  const year = context.selectedYear;
  const timestamp = createReportFilenameTimestamp();

  let providerTag = 'Gemini';
  if (narrative.providerUsed === 'local_qwen') {
    providerTag = 'Ollama-7B';
  } else if (narrative.providerUsed === 'claude_sonnet' || narrative.providerUsed === 'claude') {
    providerTag = 'Claude-Sonnet';
  } else if (narrative.providerUsed === 'claude_haiku') {
    providerTag = 'Claude-Haiku';
  } else if (narrative.providerUsed === 'claude_fable') {
    providerTag = 'Claude-Fable-5.1';
  } else if (narrative.providerUsed === 'gemini_pro') {
    providerTag = 'Gemini';
  }

  const a = document.createElement('a');
  a.href = url;
  a.download = `${monthName}_${year}_${providerTag}_${timestamp}_AstroPredictions.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
